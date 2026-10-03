/**
 * StudyAI - Core AI Service Abstraction Types
 * Provider-agnostic domain interfaces and contracts.
 */

export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface SummaryResult {
  executiveSummary: string;
  keyPoints: string[];
  vocabulary: Array<{ term: string; definition: string }>;
  suggestedTopics: string[];
}

export interface TopicExplanation {
  topic: string;
  level: ExplanationLevel;
  explanation: string;
  examples: string[];
  keyPoints: string[];
  practiceQuestion?: {
    question: string;
    answer: string;
  };
}

export interface CitationReference {
  chunkIndex?: number;
  pageNumber?: number;
  materialTitle?: string;
  snippet?: string;
}

export interface MaterialQAResponse {
  answer: string;
  citations: CitationReference[];
  confidence: 'grounded' | 'general_knowledge' | 'partial';
  isGroundedInMaterial: boolean;
  suggestedFollowUps?: string[];
}

export interface QuizQuestionResult {
  question: string;
  options: string[];
  correctAnswer: string;
  correctAnswerIndex: number;
  explanation: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export interface FlashcardResult {
  question: string;
  answer: string;
  topic: string;
  difficulty: DifficultyLevel;
}

export interface OcrPageResult {
  pageNumber: number;
  transcription: string;
  headings?: string[];
  equations?: string[];
  diagramDescriptions?: string[];
  confidence: 'high' | 'medium' | 'low' | 'unclear';
}

export interface OcrResult {
  fullText: string;
  pages: OcrPageResult[];
  detectedType: 'handwritten' | 'printed' | 'mixed';
  confidence: 'high' | 'medium' | 'low' | 'unclear';
  hasEquations: boolean;
  hasDiagrams: boolean;
  isMeaningful: boolean;
}

export interface StudyContextChunk {
  chunkIndex?: number;
  pageNumber?: number;
  content: string;
  materialTitle?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Pluggable AI Model Provider Interface
 */
export interface AIProvider {
  readonly name: string;

  summarize(title: string, content: string): Promise<SummaryResult>;

  explainTopic(
    topic: string,
    level: ExplanationLevel,
    context?: string,
  ): Promise<TopicExplanation>;

  answerQuestion(
    question: string,
    chunks: StudyContextChunk[],
    history?: ChatMessage[],
  ): Promise<MaterialQAResponse>;

  generateQuiz(
    title: string,
    content: string,
    count: number,
    difficulty: DifficultyLevel,
  ): Promise<QuizQuestionResult[]>;

  generateFlashcards(
    title: string,
    content: string,
    count: number,
  ): Promise<FlashcardResult[]>;

  ocrDocument?(
    buffer: Buffer,
    mimeType: string,
    options?: { retryStronger?: boolean; highContrast?: boolean },
  ): Promise<OcrResult>;
}
