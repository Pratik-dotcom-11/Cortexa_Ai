export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
  university?: string | null;
  major?: string | null;
  createdAt: string;
}

export interface Subject {
  id: number;
  name: string;
  code?: string | null;
  color?: string | null;
  description?: string | null;
  materialsCount?: number;
  quizzesCount?: number;
  flashcardsCount?: number;
  createdAt: string;
}

export interface MaterialChunk {
  id: number;
  materialId: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber: number;
  createdAt: string;
}

export interface StudyMaterial {
  id: number;
  subjectId: number;
  title: string;
  fileType: string;
  fileSize: number;
  rawText: string;
  summary?: string | null;
  keyConcepts?: string[];
  status: string;
  originalFileName?: string | null;
  pageCount?: number;
  chunks?: MaterialChunk[];
  createdAt: string;
}

export interface HighlightPoint {
  x: number; // 0..1 relative to canvas width
  y: number; // 0..1 relative to canvas height
}

export interface HighlightAnnotation {
  id: string;
  type: 'freehand' | 'box';
  pageNumber: number;
  color: string;
  strokeWidth: number;
  points?: HighlightPoint[]; // for freehand
  rect?: {
    x: number; // 0..1
    y: number; // 0..1
    width: number; // 0..1
    height: number; // 0..1
  };
  createdAt: string;
}

export interface CommentAnnotation {
  id: string;
  pageNumber: number;
  x: number; // 0..1 relative to canvas width
  y: number; // 0..1 relative to canvas height
  text: string;
  tag?: 'Question' | 'Important' | 'Formula' | 'Summary' | 'Note';
  color: string;
  author?: string;
  createdAt: string;
  resolved?: boolean;
}

export interface MaterialAnnotationsData {
  materialId: number;
  highlights: HighlightAnnotation[];
  comments: CommentAnnotation[];
  updatedAt?: string;
}

export interface Question {
  id: number;
  quizId: number;
  questionText: string;
  topicTag: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
}

export interface Quiz {
  id: number;
  subjectId: number;
  materialId?: number | null;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  totalQuestions: number;
  attemptsCount?: number;
  bestScore?: number | null;
  questions?: Question[];
  createdAt: string;
}

export interface QuizAttempt {
  id: number;
  quizId: number;
  score: string | number;
  totalAnswered: number;
  correctAnswers: number;
  userAnswers: Array<{ questionId: number; selectedIndex: number; isCorrect: boolean }>;
  timeTakenSeconds: number;
  completedAt: string;
}

export interface Flashcard {
  id: number;
  subjectId: number;
  materialId?: number | null;
  frontText: string;
  backText: string;
  topicTag: string;
  difficultyLevel: 'easy' | 'medium' | 'hard' | string;
  status?: 'new' | 'learning' | 'needs_revision' | 'known' | 'mastered' | string;
  reviewCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  repetitionBox: number;
  subjectName?: string;
  materialTitle?: string;
  lastReviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TopicProgress {
  id: number;
  subjectId: number;
  topicName: string;
  totalQuestionsAttempted: number;
  totalCorrect: number;
  masteryStatus: 'mastered' | 'improving' | 'needs_focus';
  accuracy: number | string;
  lastPracticedAt?: string | null;
}

export interface StudyPlanGoal {
  day: number;
  topic: string;
  tasks: string[];
  done: boolean;
}

export interface StudyPlan {
  id: number;
  subjectId: number;
  title: string;
  targetDate?: string | null;
  dailyGoals: StudyPlanGoal[];
  isActive: boolean;
  overview?: string;
  createdAt: string;
}

export interface StudyRecommendation {
  id: string;
  type: 'weak_topic' | 'spaced_repetition' | 'study_plan' | 'mastery' | 'streak';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionableTab: 'materials' | 'quizzes' | 'flashcards' | 'planner' | 'ai-room';
  actionLabel: string;
  actionMeta?: Record<string, any>;
  topicName?: string;
  subjectId?: number;
  subjectName?: string;
  materialId?: number;
  materialTitle?: string;
  metricBadge?: string;
}

export interface TopicMasteryItem {
  id: number;
  subjectId: number;
  subjectName?: string;
  subjectColor?: string;
  topicName: string;
  totalQuestionsAttempted: number;
  totalCorrect: number;
  accuracy: number;
  masteryStatus: 'mastered' | 'improving' | 'needs_focus' | string;
  lastPracticedAt?: string | null;
}

export interface RevisionItem {
  id: string;
  type: 'weak_topic' | 'flashcard_box1' | 'flashcard_needs_revision' | 'overdue_flashcard';
  title: string;
  reason: string;
  subjectId?: number;
  subjectName?: string;
  topicName?: string;
  flashcardId?: number;
  materialId?: number;
  repetitionBox?: number;
  lastReviewedAt?: string | null;
  urgency: 'high' | 'medium' | 'low';
}

export interface RecentActivityItem {
  id: string;
  type: 'quiz' | 'flashcard' | 'study_session' | 'material_upload';
  title: string;
  subtitle?: string;
  timestamp: string;
  score?: number;
  durationMinutes?: number;
  subjectId?: number;
  subjectName?: string;
  meta?: Record<string, any>;
}

export interface StudyStreakData {
  currentStreakDays: number;
  longestStreakDays: number;
  activeToday: boolean;
  lastActiveDate: string | null;
  recentActiveDates: string[];
}

export interface StudyGoalProgressData {
  totalGoals: number;
  completedGoals: number;
  progressPercentage: number;
  activePlansCount: number;
  dailyMinutesTarget: number;
  dailyMinutesLoggedToday: number;
  dailyGoalMet: boolean;
  upcomingGoals: Array<{
    planId: number;
    planTitle: string;
    subjectName?: string;
    day: number;
    topic: string;
    tasks: string[];
    targetDate?: string | null;
    done: boolean;
  }>;
}

export interface StudyIntelligenceData {
  strongTopics: TopicMasteryItem[];
  weakTopics: TopicMasteryItem[];
  needsRevision: RevisionItem[];
  recentlyStudied: RecentActivityItem[];
  studyStreak: StudyStreakData;
  studyGoalProgress: StudyGoalProgressData;
  recommendations: StudyRecommendation[];
  metricsSummary: {
    totalStudyMinutes: number;
    totalStudyHours: number;
    averageQuizScore: number;
    totalQuizzesTaken: number;
    totalFlashcards: number;
    flashcardsMastered: number;
    totalMaterials: number;
    totalSubjects: number;
  };
}

export interface DashboardStats {
  totalSubjects: number;
  totalMaterials: number;
  totalQuizzes: number;
  totalAttempts: number;
  totalStudyMinutes: number;
  averageQuizScore: number;
  weakTopicsCount: number;
  weakTopicsList: TopicProgress[];
}

export type ChatMode =
  | 'auto'
  | 'study'
  | 'coding'
  | 'explain'
  | 'solve'
  | 'writing'
  | 'brainstorm'
  | 'general';

export interface MessageCitation {
  chunkIndex?: number;
  pageNumber?: number;
  materialTitle?: string;
  snippet?: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  mode?: ChatMode | string;
  resolvedMode?: ChatMode | string;
  citations?: MessageCitation[];
  isGroundedInMaterial?: boolean;
  confidence?: 'grounded' | 'general_knowledge' | 'partial';
  suggestedFollowUps?: string[];
  createdAt: string;
}

export interface ConversationSummary {
  id: number;
  userId: string;
  subjectId?: number | null;
  materialId?: number | null;
  mode?: ChatMode | string;
  subjectName?: string;
  materialTitle?: string;
  title: string;
  lastMessageSnippet?: string | null;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

