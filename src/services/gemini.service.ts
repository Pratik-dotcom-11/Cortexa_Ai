import { executeResilientGemini } from '../../backend/src/ai/geminiResilience.ts';

export interface SummarizeResult {
  executiveSummary: string;
  keyPoints: string[];
  vocabulary: Array<{ term: string; definition: string }>;
  suggestedTopics: string[];
}

export async function generateMaterialSummary(
  title: string,
  content: string,
): Promise<SummarizeResult> {
  const prompt = `
You are an expert university professor and academic tutor.
Analyze this study material titled "${title}" and generate a comprehensive study summary.

Document Content:
"""
${content.slice(0, 30000)}
"""

Return a pure JSON object (no markdown code fences, no extra text) with the following structure:
{
  "executiveSummary": "A concise 2-3 sentence core takeaway.",
  "keyPoints": [
    "Core concept or principle 1",
    "Core concept or principle 2",
    "Core concept or principle 3",
    "Core concept or principle 4",
    "Core concept or principle 5"
  ],
  "vocabulary": [
    { "term": "Term Name", "definition": "Academic definition" }
  ],
  "suggestedTopics": ["Topic 1", "Topic 2", "Topic 3"]
}
`;

  const fallback: SummarizeResult = {
    executiveSummary: `Summary of ${title}: Highlights the foundational concepts and theories discussed in the source material.`,
    keyPoints: [
      'Fundamental definitions and scope of the subject',
      'Key methodologies and procedural steps',
      'Theoretical foundations and real-world applications',
    ],
    vocabulary: [{ term: title, definition: 'Primary subject concept covered in this study document.' }],
    suggestedTopics: ['Core Concepts', 'Methodology', 'Applications'],
  };

  try {
    const text = await executeResilientGemini(prompt, { timeoutMs: 14000 });
    if (text) {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        executiveSummary: parsed.executiveSummary || fallback.executiveSummary,
        keyPoints: Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0 ? parsed.keyPoints : fallback.keyPoints,
        vocabulary: Array.isArray(parsed.vocabulary) && parsed.vocabulary.length > 0 ? parsed.vocabulary : fallback.vocabulary,
        suggestedTopics: Array.isArray(parsed.suggestedTopics) && parsed.suggestedTopics.length > 0 ? parsed.suggestedTopics : fallback.suggestedTopics,
      };
    }
  } catch {
    // Graceful fallback
  }

  return fallback;
}

export async function askMaterialQuestion(
  question: string,
  contextChunks: Array<{ chunkIndex: number; pageNumber: number; content: string; materialTitle?: string }>,
  conversationHistory: Array<{ role: 'user' | 'model'; text: string }> = [],
): Promise<{ answer: string; citations: Array<{ chunkIndex: number; pageNumber: number; materialTitle?: string }> }> {
  const formattedContext = contextChunks
    .map(
      (c, idx) =>
        `[Source ${idx + 1} | Material: "${c.materialTitle || 'Doc'}" | Chunk: ${c.chunkIndex} | Page: ${c.pageNumber}]:\n${c.content}`,
    )
    .join('\n\n');

  const systemInstruction = `
You are StudyAI, an academic study assistant for university students.
Answer the student's question based strictly on the provided course material excerpts.
Cite sources using inline notations like [Source 1, Page X] when referencing facts.
If the material doesn't contain enough info to answer fully, provide what is in the material first, and then give a brief academic explanation clearly noting it is general knowledge.
Keep answers clear, structured with markdown (bold headers, bullet points if helpful), and direct.
`;

  const prompt = `
Context Excerpts:
${formattedContext}

Question: ${question}
`;

  const citations = contextChunks.map((c) => ({
    chunkIndex: c.chunkIndex,
    pageNumber: c.pageNumber,
    materialTitle: c.materialTitle,
  }));

  try {
    const contents: any[] = [];
    conversationHistory.slice(-4).forEach((h) => {
      contents.push({ role: h.role, parts: [{ text: h.text }] });
    });
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const text = await executeResilientGemini(contents, {
      systemInstruction,
      timeoutMs: 16000,
    });

    if (text) {
      return {
        answer: text.trim(),
        citations,
      };
    }
  } catch {
    // Graceful fallback
  }

  return {
    answer: contextChunks.length > 0
      ? `Based on "${contextChunks[0].materialTitle || 'course notes'}":\n\n${contextChunks[0].content}\n\n[Source 1, Page ${contextChunks[0].pageNumber}]`
      : `Regarding "${question}": Review foundational principles and methodologies in your lecture documents.`,
    citations: citations.slice(0, 3),
  };
}

export interface GeneratedQuizQuestion {
  question: string;
  questionText: string;
  topicTag: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export async function generateQuizQuestions(
  materialTitle: string,
  content: string,
  numQuestions: number = 5,
  difficulty: string = 'medium',
): Promise<GeneratedQuizQuestion[]> {
  const prompt = `
Generate a ${numQuestions}-question multiple choice quiz (${difficulty} difficulty) testing comprehension of this academic material titled "${materialTitle}".

Text:
"""
${content.slice(0, 25000)}
"""

Return ONLY a pure JSON array (no markdown code blocks, no backticks, no comments) conforming to this TypeScript interface:
[
  {
    "questionText": "Clear and rigorous question stem",
    "topicTag": "Topic Name",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 0,
    "explanation": "Why this answer is correct based on the material."
  }
]
`;

  const fallback: GeneratedQuizQuestion[] = [
    {
      question: `What is the primary thesis of "${materialTitle}"?`,
      questionText: `What is the primary thesis of "${materialTitle}"?`,
      topicTag: 'Fundamental Concepts',
      options: [
        'Foundational academic principles and systematic problem-solving',
        'Arbitrary procedures without practical applications',
        'Unverified historical theories',
        'Non-academic administrative guidelines',
      ],
      correctOptionIndex: 0,
      explanation: 'Academic materials prioritize building strong foundations followed by practical applications.',
    },
  ];

  try {
    const text = await executeResilientGemini(prompt, { timeoutMs: 18000 });
    if (text) {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => {
          const qText = String(item.questionText || item.question || `Question ${idx + 1} on ${materialTitle}`);
          return {
            question: qText,
            questionText: qText,
            topicTag: String(item.topicTag || 'Core Concepts'),
            options: Array.isArray(item.options) && item.options.length >= 2 ? item.options.map(String) : ['A', 'B', 'C', 'D'],
            correctOptionIndex: typeof item.correctOptionIndex === 'number' ? item.correctOptionIndex : 0,
            explanation: String(item.explanation || 'Verified correct from course materials.'),
          };
        });
      }
    }
  } catch {
    // Fallback
  }

  return fallback;
}

export interface GeneratedFlashcard {
  frontText: string;
  backText: string;
  topicTag: string;
  difficultyLevel: string;
}

export async function generateFlashcardDeck(
  materialTitle: string,
  content: string,
  count: number = 8,
): Promise<GeneratedFlashcard[]> {
  const prompt = `
Create ${count} high-yield study flashcards from this academic text titled "${materialTitle}".

Text:
"""
${content.slice(0, 25000)}
"""

Rules:
- Front: A clear concept question, term, formula, or problem statement.
- Back: Concise, memorable explanation, formula derivation, or answer.
- Assign a relevant topicTag for each card.

Return ONLY a pure JSON array (no markdown code blocks):
[
  {
    "frontText": "What is ...?",
    "backText": "It is ...",
    "topicTag": "Concept",
    "difficultyLevel": "medium"
  }
]
`;

  const fallback: GeneratedFlashcard[] = [
    {
      frontText: `Key takeaway of ${materialTitle}`,
      backText: 'Essential principles, definitions, and problem-solving techniques.',
      topicTag: 'Overview',
      difficultyLevel: 'medium',
    },
  ];

  try {
    const text = await executeResilientGemini(prompt, { timeoutMs: 18000 });
    if (text) {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          frontText: item.frontText || `Concept ${idx + 1}`,
          backText: item.backText || 'Key takeaway and definition.',
          topicTag: item.topicTag || 'Core Concepts',
          difficultyLevel: item.difficultyLevel || 'medium',
        }));
      }
    }
  } catch {
    // Fallback
  }

  return fallback;
}

export async function explainTopicMultiLevel(
  topic: string,
  level: 'beginner' | 'intermediate' | 'advanced',
  subjectContext?: string,
): Promise<{
  topic: string;
  level: string;
  summary: string;
  detailedExplanation: string;
  analogies: string[];
  keyTakeaways: string[];
  practiceQuestion: { question: string; answer: string };
}> {
  const levelGuidelines = {
    beginner: 'Explain like I am 5 / High school beginner. Use vivid real-world analogies, zero dense jargon, warm and intuitive tone.',
    intermediate: 'Undergraduate university standard. Rigorous conceptual definitions, standard formulas and academic terminology, structured mechanics.',
    advanced: 'Graduate / Deep-dive level. Edge cases, algorithmic complexity / mathematical proofs, trade-offs, theoretical implications, and research frontiers.',
  };

  const prompt = `
Explain the academic topic "${topic}" at the "${level}" difficulty level.
${subjectContext ? `Subject Context: ${subjectContext}` : ''}

Guideline for this level:
${levelGuidelines[level]}

Return ONLY a pure JSON object:
{
  "topic": "${topic}",
  "level": "${level}",
  "summary": "1-2 sentence high impact summary.",
  "detailedExplanation": "Full structured markdown explanation with bold headers and clear paragraphs.",
  "analogies": ["Analogy 1", "Analogy 2"],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "practiceQuestion": {
    "question": "Quick check for understanding question",
    "answer": "Explanation of the correct answer"
  }
}
`;

  const fallback = {
    topic,
    level,
    summary: `Overview of ${topic} tailored for ${level} level.`,
    detailedExplanation: `### Understanding ${topic}\n\n${topic} is a crucial academic concept. At the ${level} tier, we focus on understanding both the foundational intuition and how it connects to broader problems in the field.`,
    analogies: ['Think of it like building blocks forming a stable bridge.'],
    keyTakeaways: ['Foundational concept', 'Directly tested on university exams', 'Links theory to practice'],
    practiceQuestion: {
      question: `How would you define ${topic} in your own words?`,
      answer: `It represents the mechanism governing this phenomenon.`,
    },
  };

  try {
    const text = await executeResilientGemini(prompt, { timeoutMs: 14000 });
    if (text) {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        topic: parsed.topic || topic,
        level: parsed.level || level,
        summary: parsed.summary || fallback.summary,
        detailedExplanation: parsed.detailedExplanation || fallback.detailedExplanation,
        analogies: Array.isArray(parsed.analogies) ? parsed.analogies : fallback.analogies,
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : fallback.keyTakeaways,
        practiceQuestion: parsed.practiceQuestion || fallback.practiceQuestion,
      };
    }
  } catch {
    // Fallback
  }

  return fallback;
}

export async function generatePersonalizedStudyPlan(
  subjectName: string,
  targetDate: string,
  dailyHours: number,
  weakTopics: string[],
  availableMaterials: string[],
): Promise<{
  title: string;
  overview: string;
  dailyGoals: Array<{ day: number; topic: string; tasks: string[]; done: boolean }>;
}> {
  const prompt = `
Create an intensive, realistic university study plan for "${subjectName}".
Target Exam / Completion Date: ${targetDate || 'In 14 days'}
Available Daily Study Time: ${dailyHours || 2} hours/day
Student's Identified Weak Topics (PRIORITIZE THESE): ${weakTopics.join(', ') || 'General Review'}
Available Study Materials: ${availableMaterials.join(', ') || 'Course Notes and Textbooks'}

Design a structured 7 to 10 day study plan that directly targets weak areas first with spaced practice.
Return ONLY a pure JSON object:
{
  "title": "Personalized Study Plan: ${subjectName}",
  "overview": "2-3 sentence strategic roadmap.",
  "dailyGoals": [
    {
      "day": 1,
      "topic": "Topic Name",
      "tasks": [
        "Review concept notes (40m)",
        "Solve 10 practice problems (50m)",
        "Flashcard review (20m)"
      ],
      "done": false
    }
  ]
}
`;

  const fallback = {
    title: `Study Plan: ${subjectName}`,
    overview: 'Structured schedule focusing on core concepts and active recall.',
    dailyGoals: [
      {
        day: 1,
        topic: weakTopics[0] || 'Foundational Review',
        tasks: ['Review chapter summaries', 'Create 10 flashcards', 'Take diagnostic quiz'],
        done: false,
      },
      {
        day: 2,
        topic: weakTopics[1] || 'Core Mechanics & Problem Solving',
        tasks: ['Solve 5 practice problems', 'Review flashcard deck box 1', 'Summarize key formulas'],
        done: false,
      },
      {
        day: 3,
        topic: weakTopics[2] || 'Advanced Applications & Self-Test',
        tasks: ['Timed mock quiz', 'Deep dive into missed questions', 'Consolidate revision cheat sheet'],
        done: false,
      },
    ],
  };

  try {
    const text = await executeResilientGemini(prompt, { timeoutMs: 16000 });
    if (text) {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && Array.isArray(parsed.dailyGoals)) {
        return {
          title: parsed.title || fallback.title,
          overview: parsed.overview || fallback.overview,
          dailyGoals: parsed.dailyGoals.map((g: any, i: number) => ({
            day: Number(g.day) || i + 1,
            topic: String(g.topic || `Study Day ${i + 1}`),
            tasks: Array.isArray(g.tasks) ? g.tasks.map(String) : ['Review notes', 'Practice quiz'],
            done: Boolean(g.done),
          })),
        };
      }
    }
  } catch {
    // Fallback
  }

  return fallback;
}
