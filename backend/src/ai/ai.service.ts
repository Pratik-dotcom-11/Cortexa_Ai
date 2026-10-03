/**
 * StudyAI - Core AI Service Orchestrator
 * Provides model-agnostic AI capabilities, input sanitization, and fallback management.
 */

import {
  AIProvider,
  SummaryResult,
  TopicExplanation,
  MaterialQAResponse,
  QuizQuestionResult,
  FlashcardResult,
  OcrResult,
  ExplanationLevel,
  DifficultyLevel,
  StudyContextChunk,
  ChatMessage,
} from './types.ts';
import { GeminiProvider } from './providers/gemini.provider.ts';
import { sanitizeString } from '../services/auth.service.ts';
import { logger } from '../utils/logger.ts';

class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new GeminiProvider();
  }

  /**
   * Allows hot-swapping or testing alternative AI model providers
   */
  public setProvider(provider: AIProvider): void {
    logger.info(`Switching AI Provider to: ${provider.name}`);
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  /**
   * 1. Summarization
   */
  async summarize(title: string, content: string): Promise<SummaryResult> {
    const safeTitle = sanitizeString(title) || 'Study Material';
    const safeContent = (content || '').trim();

    if (!safeContent) {
      return {
        executiveSummary: `No readable content provided for ${safeTitle}.`,
        keyPoints: ['Empty document'],
        vocabulary: [],
        suggestedTopics: ['Overview'],
      };
    }

    return await this.provider.summarize(safeTitle, safeContent);
  }

  /**
   * 2. Topic Explanation (Beginner, Intermediate, Advanced)
   */
  async explain(
    topic: string,
    level: ExplanationLevel = 'intermediate',
    subjectContext?: string,
  ): Promise<TopicExplanation> {
    const safeTopic = sanitizeString(topic) || 'Core Subject Topic';
    const validLevel: ExplanationLevel = (['beginner', 'intermediate', 'advanced'].includes(level)
      ? level
      : 'intermediate') as ExplanationLevel;
    const safeContext = subjectContext ? sanitizeString(subjectContext) : undefined;

    return await this.provider.explainTopic(safeTopic, validLevel, safeContext);
  }

  /**
   * 3. Study-Material Q&A with Strict Document Prioritization & Anti-Hallucination
   */
  async chat(
    question: string,
    contextChunks: StudyContextChunk[] = [],
    conversationHistory: ChatMessage[] = [],
  ): Promise<MaterialQAResponse> {
    const safeQuestion = sanitizeString(question);
    if (!safeQuestion) {
      return {
        answer: 'Please provide a valid question about your study materials.',
        citations: [],
        confidence: 'general_knowledge',
        isGroundedInMaterial: false,
      };
    }

    const safeChunks = contextChunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber,
      content: sanitizeString(c.content),
      materialTitle: c.materialTitle ? sanitizeString(c.materialTitle) : undefined,
    }));

    return await this.provider.answerQuestion(safeQuestion, safeChunks, conversationHistory);
  }

  /**
   * 4. Structured Quiz Generation
   */
  async generateQuizQuestions(
    title: string,
    content: string,
    count: number = 5,
    difficulty: DifficultyLevel = 'medium',
  ): Promise<QuizQuestionResult[]> {
    const safeTitle = sanitizeString(title) || 'Course Topic';
    const safeContent = (content || '').trim();
    const safeCount = Math.min(Math.max(Number(count) || 5, 1), 20);
    const validDiff: DifficultyLevel = (['easy', 'medium', 'hard'].includes(difficulty)
      ? difficulty
      : 'medium') as DifficultyLevel;

    return await this.provider.generateQuiz(safeTitle, safeContent, safeCount, validDiff);
  }

  /**
   * 5. Structured Flashcard Generation
   */
  async generateFlashcards(
    title: string,
    content: string,
    count: number = 8,
  ): Promise<FlashcardResult[]> {
    const safeTitle = sanitizeString(title) || 'Course Topic';
    const safeContent = (content || '').trim();
    const safeCount = Math.min(Math.max(Number(count) || 8, 1), 25);

    return await this.provider.generateFlashcards(safeTitle, safeContent, safeCount);
  }

  /**
   * 6. Multimodal Handwriting & Educational Document OCR
   */
  async ocrDocument(
    buffer: Buffer,
    mimeType: string,
    options?: { retryStronger?: boolean; highContrast?: boolean },
  ): Promise<OcrResult> {
    if (!this.provider.ocrDocument) {
      return {
        fullText: '',
        pages: [],
        detectedType: 'handwritten',
        confidence: 'unclear',
        hasEquations: false,
        hasDiagrams: false,
        isMeaningful: false,
      };
    }
    return await this.provider.ocrDocument(buffer, mimeType, options);
  }

  /**
   * 7. Personalized AI Study Plan Generation
   */
  async generateStudyPlan(
    subjectName: string,
    targetDate: string,
    dailyHours: number,
    weakTopics: string[] = [],
    availableMaterials: string[] = [],
  ): Promise<{
    title: string;
    overview: string;
    dailyGoals: Array<{ day: number; topic: string; tasks: string[]; done: boolean }>;
  }> {
    const safeSubject = sanitizeString(subjectName) || 'Course Topic';
    const safeDate = targetDate ? sanitizeString(targetDate) : 'In 14 days';
    const hours = Math.min(Math.max(Number(dailyHours) || 2, 1), 12);

    const { generatePersonalizedStudyPlan } = await import('../../../src/services/gemini.service.ts');
    return await generatePersonalizedStudyPlan(
      safeSubject,
      safeDate,
      hours,
      weakTopics,
      availableMaterials,
    );
  }
}

export const aiService = new AIService();
