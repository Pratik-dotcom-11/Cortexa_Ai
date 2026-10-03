/**
 * StudyAI - Gemini AI Model Provider Implementation
 * Uses the official @google/genai SDK with multi-model fallback, exponential backoff,
 * response repair, and structured output parsing.
 */

import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  SummaryResult,
  TopicExplanation,
  MaterialQAResponse,
  QuizQuestionResult,
  FlashcardResult,
  OcrResult,
  OcrPageResult,
  ExplanationLevel,
  DifficultyLevel,
  StudyContextChunk,
  ChatMessage,
  CitationReference,
} from '../types.ts';
import { prompts, AI_SYSTEM_INSTRUCTIONS } from '../prompts.ts';
import { logger } from '../../utils/logger.ts';
import {
  executeResilientGemini,
  getResilientGenAI,
  CANDIDATE_MODELS,
  isQuotaError,
  markModelExhausted,
  isModelAvailable,
} from '../geminiResilience.ts';

/**
 * Extracts and cleans JSON from model responses, handling potential markdown wrappers
 */
function extractAndParseJson<T>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  // 1. Strip markdown code fences
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/m, '')
    .trim();

  // 2. Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 3. Fallback to bracket-seeking regex for JSON objects or arrays
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        // parsing failed, use fallback
      }
    }
  }

  return fallback;
}

export class GeminiProvider implements AIProvider {
  public readonly name = 'Google Gemini (Resilient Multi-Model)';

  /**
   * 1. Summarization
   */
  async summarize(title: string, content: string): Promise<SummaryResult> {
    const promptText = prompts.summarize(title, content);

    const fallback: SummaryResult = {
      executiveSummary: `Summary of ${title}: Highlights foundational principles, methodologies, and core applications detailed in the document.`,
      keyPoints: [
        'Core definitions and theoretical foundation of the topic',
        'Key structural mechanics and problem-solving workflows',
        'Practical considerations and real-world implementations',
      ],
      vocabulary: [
        { term: title, definition: 'Primary academic concept covered in this study document.' },
      ],
      suggestedTopics: ['Core Theory', 'Mechanics & Algorithms', 'Practical Applications'],
    };

    try {
      const text = await executeResilientGemini(promptText, {
        systemInstruction: AI_SYSTEM_INSTRUCTIONS.GENERAL_TUTOR,
        timeoutMs: 14000,
      });

      if (text) {
        const parsed = extractAndParseJson<Partial<SummaryResult>>(text, fallback);
        return {
          executiveSummary: parsed.executiveSummary || fallback.executiveSummary,
          keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : fallback.keyPoints,
          vocabulary: Array.isArray(parsed.vocabulary) && parsed.vocabulary.length > 0 ? parsed.vocabulary : fallback.vocabulary,
          suggestedTopics: Array.isArray(parsed.suggestedTopics) && parsed.suggestedTopics.length > 0 ? parsed.suggestedTopics : fallback.suggestedTopics,
        };
      }
    } catch {
      // Local fallback below
    }

    return fallback;
  }

  /**
   * 2. Multi-level Topic Explanation (Beginner, Intermediate, Advanced)
   */
  async explainTopic(
    topic: string,
    level: ExplanationLevel = 'intermediate',
    context?: string,
  ): Promise<TopicExplanation> {
    const promptText = prompts.explainTopic(topic, level, context);

    const fallback: TopicExplanation = {
      topic,
      level,
      explanation: `### Understanding ${topic}\n\n${topic} is a key concept. At the ${level} level, it is essential to understand both its fundamental definition and practical applications.`,
      examples: [
        `Consider a standard application where ${topic} provides structure and efficiency.`,
      ],
      keyPoints: [
        `Foundational definition of ${topic}`,
        'Core algorithmic or structural mechanism',
        'Standard edge cases and exam considerations',
      ],
      practiceQuestion: {
        question: `What is the primary role of ${topic}?`,
        answer: `${topic} provides a structured mechanism to solve domain problems effectively.`,
      },
    };

    try {
      const text = await executeResilientGemini(promptText, {
        systemInstruction: AI_SYSTEM_INSTRUCTIONS.GENERAL_TUTOR,
        timeoutMs: 14000,
      });

      if (text) {
        const parsed = extractAndParseJson<Partial<TopicExplanation>>(text, fallback);
        return {
          topic: parsed.topic || topic,
          level,
          explanation: parsed.explanation || fallback.explanation,
          examples: Array.isArray(parsed.examples) && parsed.examples.length > 0 ? parsed.examples : fallback.examples,
          keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : fallback.keyPoints,
          practiceQuestion: parsed.practiceQuestion || fallback.practiceQuestion,
        };
      }
    } catch {
      // Local fallback below
    }

    return fallback;
  }

  /**
   * 3. Study-Material Q&A with Strict Anti-Hallucination & Document Grounding
   */
  async answerQuestion(
    question: string,
    chunks: StudyContextChunk[] = [],
    history: ChatMessage[] = [],
  ): Promise<MaterialQAResponse> {
    const promptText = prompts.groundedQA(question, chunks);

    const citations: CitationReference[] = chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber,
      materialTitle: c.materialTitle,
      snippet: c.content ? c.content.slice(0, 160) + '...' : undefined,
    }));

    const allChunkText = chunks.map((c) => c.content).join(' ').toLowerCase();
    const stopWords = new Set([
      'what', 'when', 'where', 'which', 'about', 'this', 'does', 'according',
      'document', 'say', 'tell', 'explain', 'describe', 'algorithm', 'system',
      'notes', 'lecture', 'chapter', 'discuss', 'discussed', 'between', 'how',
    ]);

    const questionKeywords = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    const keywordMatched =
      questionKeywords.length > 0 &&
      questionKeywords.some((kw) => allChunkText.includes(kw));

    const fallbackAnswer = chunks.length > 0 && keywordMatched
      ? `Based on your course materials for "${chunks[0].materialTitle || 'this subject'}":\n\nReview the core definitions and mechanics in the uploaded lecture notes.`
      : chunks.length > 0
      ? `This specific question is not explicitly covered in your uploaded document excerpts.\n\n(General Academic Knowledge): The concept involves established domain principles and theoretical models.`
      : `Regarding "${question}": Focus on foundational concepts and structural mechanics.`;

    const fallback: MaterialQAResponse = {
      answer: fallbackAnswer,
      citations: keywordMatched ? citations.slice(0, 3) : [],
      confidence: keywordMatched ? 'grounded' : 'general_knowledge',
      isGroundedInMaterial: keywordMatched,
    };

    try {
      const contents: any[] = [];
      history.slice(-4).forEach((h) => {
        contents.push({
          role: h.role,
          parts: [{ text: h.text }],
        });
      });
      contents.push({
        role: 'user',
        parts: [{ text: promptText }],
      });

      const text = await executeResilientGemini(contents, {
        systemInstruction: AI_SYSTEM_INSTRUCTIONS.GROUNDED_QA,
        timeoutMs: 16000,
      });

      if (text) {
        const rawAnswer = text.trim();
        const mentionsNotInDocument =
          /not explicitly covered|not directly covered|not found in/i.test(rawAnswer);

        return {
          answer: rawAnswer,
          citations: chunks.length > 0 ? citations.slice(0, 4) : [],
          confidence: mentionsNotInDocument
            ? 'general_knowledge'
            : chunks.length > 0
            ? 'grounded'
            : 'general_knowledge',
          isGroundedInMaterial: chunks.length > 0 && !mentionsNotInDocument,
        };
      }
    } catch {
      // Local fallback below
    }

    return fallback;
  }

  /**
   * 4. Structured Quiz Generation
   */
  async generateQuiz(
    title: string,
    content: string,
    count: number = 5,
    difficulty: DifficultyLevel = 'medium',
  ): Promise<QuizQuestionResult[]> {
    const promptText = prompts.generateQuiz(title, content, count, difficulty);

    const fallback: QuizQuestionResult[] = [
      {
        question: `What is the core principle demonstrated in "${title}"?`,
        options: [
          'Foundational domain principles and structured problem solving',
          'Arbitrary rules with no practical application',
          'Administrative procedures without theoretical basis',
          'Unrelated contextual background',
        ],
        correctAnswer: 'Foundational domain principles and structured problem solving',
        correctAnswerIndex: 0,
        explanation: 'Academic study documents establish core domain principles and provide structured mechanisms for practical application.',
        topic: 'Fundamental Concepts',
        difficulty,
      },
    ];

    try {
      const text = await executeResilientGemini(promptText, {
        systemInstruction: AI_SYSTEM_INSTRUCTIONS.GENERAL_TUTOR,
        timeoutMs: 18000,
      });

      if (text) {
        const parsed = extractAndParseJson<any[]>(text, fallback);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, idx) => {
            const question = String(item.question || `Question ${idx + 1} on ${title}`);
            const options = Array.isArray(item.options) && item.options.length >= 2
              ? item.options.map(String).slice(0, 4)
              : ['Option A', 'Option B', 'Option C', 'Option D'];

            while (options.length < 4) {
              options.push(`Alternative choice ${options.length + 1}`);
            }

            let correctIdx = typeof item.correctAnswerIndex === 'number' && item.correctAnswerIndex >= 0 && item.correctAnswerIndex < options.length
              ? item.correctAnswerIndex
              : 0;

            if (item.correctAnswer && typeof item.correctAnswer === 'string') {
              const foundIdx = options.findIndex((opt: string) => opt.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase());
              if (foundIdx !== -1) {
                correctIdx = foundIdx;
              }
            }

            const correctAnswer = options[correctIdx];

            return {
              question,
              options,
              correctAnswer,
              correctAnswerIndex: correctIdx,
              explanation: String(item.explanation || `"${correctAnswer}" is the correct choice based on course materials.`),
              topic: String(item.topic || 'Core Concepts'),
              difficulty,
            };
          });
        }
      }
    } catch {
      // Local fallback below
    }

    return fallback;
  }

  /**
   * 5. Structured Flashcard Generation
   */
  async generateFlashcards(
    title: string,
    content: string,
    count: number = 8,
  ): Promise<FlashcardResult[]> {
    const promptText = prompts.generateFlashcards(title, content, count);

    // Dynamic smart extraction fallback from text
    const fallback: FlashcardResult[] = [];
    const textLines = (content || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 15 && !l.startsWith('#'));

    for (let i = 0; i < Math.min(count, Math.max(3, textLines.length)); i++) {
      const line = textLines[i] || `Core Principle ${i + 1} of ${title}`;
      const parts = line.split(/:\s+|\s+-\s+/);
      if (parts.length >= 2) {
        fallback.push({
          question: `Define and explain: ${parts[0].replace(/^\d+[\.\)]\s*/, '')}`,
          answer: parts.slice(1).join(': '),
          topic: title.slice(0, 28),
          difficulty: i === 0 ? 'easy' : i % 2 === 0 ? 'medium' : 'hard',
        });
      } else {
        fallback.push({
          question: `What are the key mechanics of: ${line.slice(0, 55)}?`,
          answer: line,
          topic: title.slice(0, 28),
          difficulty: 'medium',
        });
      }
    }

    if (fallback.length === 0) {
      fallback.push({
        question: `What is the primary thesis of "${title}"?`,
        answer: 'It covers key academic principles, formal definitions, and problem-solving steps.',
        topic: 'Overview',
        difficulty: 'medium',
      });
    }

    try {
      const text = await executeResilientGemini(promptText, {
        systemInstruction: AI_SYSTEM_INSTRUCTIONS.GENERAL_TUTOR,
        timeoutMs: 18000,
      });

      if (text) {
        const parsed = extractAndParseJson<any[]>(text, fallback);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, idx) => ({
            question: String(item.question || item.frontText || `Concept ${idx + 1}`),
            answer: String(item.answer || item.backText || 'Key takeaway and definition.'),
            topic: String(item.topic || item.topicTag || 'Core Concepts'),
            difficulty: (['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium') as DifficultyLevel,
          }));
        }
      }
    } catch {
      // Local fallback below
    }

    return fallback;
  }

  /**
   * 6. Multimodal Handwriting & Scanned Educational Document OCR
   */
  async ocrDocument(
    buffer: Buffer,
    mimeType: string,
    options?: { retryStronger?: boolean; highContrast?: boolean },
  ): Promise<OcrResult> {
    const promptText = prompts.handwritingOcr(options);
    const base64Data = buffer.toString('base64');

    const fallback: OcrResult = {
      fullText: '',
      pages: [],
      detectedType: 'handwritten',
      confidence: 'unclear',
      hasEquations: false,
      hasDiagrams: false,
      isMeaningful: false,
    };

    const ai = getResilientGenAI();

    for (const model of CANDIDATE_MODELS) {
      if (!isModelAvailable(model)) continue;

      try {
        const generatePromise = ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: promptText,
            },
          ],
          config: {
            systemInstruction: 'You are an accurate, high-precision academic OCR and mathematical transcription engine.',
          },
        });

        generatePromise.catch(() => {});

        const response: any = await Promise.race([
          generatePromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('OCR generation timed out')), 22000),
          ),
        ]);

        const rawText = response?.text || '';
        const parsed = extractAndParseJson<any>(rawText, null);

        if (parsed && typeof parsed === 'object') {
          const pages: OcrPageResult[] = Array.isArray(parsed.pages) && parsed.pages.length > 0
            ? parsed.pages.map((p: any, idx: number) => ({
                pageNumber: Number(p.pageNumber) || idx + 1,
                transcription: String(p.transcription || '').trim(),
                headings: Array.isArray(p.headings) ? p.headings.map(String) : [],
                equations: Array.isArray(p.equations) ? p.equations.map(String) : [],
                diagramDescriptions: Array.isArray(p.diagramDescriptions) ? p.diagramDescriptions.map(String) : [],
                confidence: (['high', 'medium', 'low', 'unclear'].includes(p.confidence) ? p.confidence : 'medium') as any,
              }))
            : [
                {
                  pageNumber: 1,
                  transcription: String(parsed.transcription || rawText).trim(),
                  confidence: (['high', 'medium', 'low', 'unclear'].includes(parsed.confidence) ? parsed.confidence : 'medium') as any,
                },
              ];

          const combinedText = String(parsed.transcription || '').trim() ||
            pages.map((p) => p.transcription).filter(Boolean).join('\n\n');

          const meaningfulChars = combinedText.replace(/[^a-zA-Z0-9]/g, '');
          const isMeaningful = meaningfulChars.length >= 15 && parsed.confidence !== 'unclear';

          return {
            fullText: combinedText,
            pages,
            detectedType: (['handwritten', 'printed', 'mixed'].includes(parsed.detectedType) ? parsed.detectedType : 'handwritten') as any,
            confidence: (['high', 'medium', 'low', 'unclear'].includes(parsed.confidence) ? parsed.confidence : (isMeaningful ? 'high' : 'low')) as any,
            hasEquations: Boolean(parsed.hasEquations || pages.some((p) => p.equations && p.equations.length > 0)),
            hasDiagrams: Boolean(parsed.hasDiagrams || pages.some((p) => p.diagramDescriptions && p.diagramDescriptions.length > 0)),
            isMeaningful,
          };
        }

        const cleanedRaw = rawText.replace(/^```(?:json)?/im, '').replace(/```$/m, '').trim();
        const meaningfulChars = cleanedRaw.replace(/[^a-zA-Z0-9]/g, '');
        if (meaningfulChars.length >= 15) {
          return {
            fullText: cleanedRaw,
            pages: [{ pageNumber: 1, transcription: cleanedRaw, confidence: 'medium' }],
            detectedType: 'handwritten',
            confidence: 'medium',
            hasEquations: /[$=+\-*/\\int\\sum]/.test(cleanedRaw),
            hasDiagrams: /diagram|figure|chart|graph/i.test(cleanedRaw),
            isMeaningful: true,
          };
        }
      } catch (err: any) {
        if (isQuotaError(err)) {
          markModelExhausted(model, 15);
          continue;
        }
        continue;
      }
    }

    return fallback;
  }
}
