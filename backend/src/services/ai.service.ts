/**
 * StudyAI - AI Service Export & Type Aliases
 * Re-exports the unified AI service orchestrator and provider-agnostic types.
 */

import {
  SummaryResult,
  TopicExplanation,
  QuizQuestionResult,
  FlashcardResult,
} from '../ai/types.ts';

export * from '../ai/types.ts';
export * from '../ai/ai.service.ts';
export { GeminiProvider } from '../ai/providers/gemini.provider.ts';

// Backward-compatible type aliases
export type SummarizeResponse = SummaryResult;
export type ExplainResponse = TopicExplanation;
export type GeneratedQuestion = QuizQuestionResult & {
  questionText?: string;
  topicTag?: string;
  correctOptionIndex?: number;
};
export type GeneratedFlashcard = FlashcardResult & {
  frontText?: string;
  backText?: string;
  topicTag?: string;
  difficultyLevel?: string;
};
