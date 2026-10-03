export interface User {
  id: string;
  email: string;
  fullName: string;
  university?: string;
  major?: string;
  weeklyGoalHours?: number;
  createdAt: string;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  code: string;
  color: string;
  description: string;
  createdAt: string;
  materialsCount?: number;
  quizzesCount?: number;
  flashcardsCount?: number;
  masteryScore?: number; // 0 - 100
}

export interface MaterialChunk {
  id: string;
  materialId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber?: number;
}

export interface StudyMaterial {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  fileType: 'pdf' | 'notes' | 'markdown' | 'doc';
  fileSizeBytes: number;
  rawText: string;
  summary?: string;
  keyConcepts: string[];
  chunksCount: number;
  chunks?: MaterialChunk[];
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  quizId: string;
  questionText: string;
  topicTag: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  userId: string;
  subjectId: string;
  materialId?: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  totalQuestions: number;
  questions: Question[];
  createdAt: string;
  lastAttemptScore?: number;
}

export interface UserAnswer {
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  quizTitle: string;
  subjectId: string;
  score: number; // percentage
  correctAnswers: number;
  totalQuestions: number;
  userAnswers: UserAnswer[];
  timeTakenSeconds: number;
  completedAt: string;
}

export interface Flashcard {
  id: string;
  userId: string;
  subjectId: string;
  materialId?: string;
  frontText: string;
  backText: string;
  topicTag: string;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  repetitionBox: number; // 1 to 5
  lastReviewedAt?: string;
  nextReviewAt?: string;
  createdAt: string;
}

export interface TopicProgress {
  id: string;
  userId: string;
  subjectId: string;
  topicName: string;
  totalQuestionsAttempted: number;
  totalCorrect: number;
  accuracyPercentage: number;
  masteryStatus: 'needs_focus' | 'improving' | 'mastered';
  lastPracticedAt: string;
}

export interface StudyPlanTask {
  id: string;
  title: string;
  topic: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface StudyPlanDay {
  dayNumber: number;
  dateStr: string;
  dayName: string;
  tasks: StudyPlanTask[];
}

export interface StudyPlan {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  targetExamDate?: string;
  days: StudyPlanDay[];
  isActive: boolean;
  createdAt: string;
}

export interface StudySession {
  id: string;
  userId: string;
  subjectId?: string;
  activityType: 'read_material' | 'quiz' | 'flashcard_review' | 'ai_chat';
  durationMinutes: number;
  startedAt: string;
  notes?: string;
}

export interface DashboardStats {
  totalStudyHours: number;
  weeklyGoalHours: number;
  currentStreakDays: number;
  overallQuizAccuracy: number;
  totalMaterials: number;
  totalFlashcards: number;
  weakTopicsCount: number;
  recentQuizzes: QuizAttempt[];
  upcomingTasks: StudyPlanTask[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourceCitations?: {
    materialTitle: string;
    pageOrChunk: string;
    excerpt: string;
  }[];
  explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}
