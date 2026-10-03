import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Users table (keyed on Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  university: text('university'),
  major: text('major'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Subjects table
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  code: text('code'),
  color: text('color').default('#6366f1'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Study Materials table
export const studyMaterials = pgTable('study_materials', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  fileType: text('file_type').notNull(), // 'pdf', 'note', 'text'
  fileSize: integer('file_size').default(0),
  rawText: text('raw_text').notNull(),
  summary: text('summary'),
  keyConcepts: jsonb('key_concepts').$type<string[]>().default([]),
  status: text('status').default('processed'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Material Chunks for search and future RAG
export const materialChunks = pgTable('material_chunks', {
  id: serial('id').primaryKey(),
  materialId: integer('material_id')
    .references(() => studyMaterials.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').default(0),
  pageNumber: integer('page_number').default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quizzes
export const quizzes = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  materialId: integer('material_id').references(() => studyMaterials.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  difficulty: text('difficulty').default('medium'),
  totalQuestions: integer('total_questions').notNull().default(5),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Questions
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id')
    .references(() => quizzes.id, { onDelete: 'cascade' })
    .notNull(),
  questionText: text('question_text').notNull(),
  topicTag: text('topic_tag').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  correctOptionIndex: integer('correct_option_index').notNull(),
  explanation: text('explanation').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quiz Attempts
export const quizAttempts = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  quizId: integer('quiz_id')
    .references(() => quizzes.id, { onDelete: 'cascade' })
    .notNull(),
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  totalAnswered: integer('total_answered').notNull(),
  correctAnswers: integer('correct_answers').notNull(),
  userAnswers: jsonb('user_answers')
    .$type<
      Array<{
        questionId: number;
        selectedIndex: number;
        isCorrect: boolean;
      }>
    >()
    .notNull(),
  timeTakenSeconds: integer('time_taken_seconds').default(0),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
});

// Flashcards
export const flashcards = pgTable('flashcards', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  materialId: integer('material_id').references(() => studyMaterials.id, {
    onDelete: 'set null',
  }),
  frontText: text('front_text').notNull(),
  backText: text('back_text').notNull(),
  topicTag: text('topic_tag').default('General'),
  difficultyLevel: text('difficulty_level').default('medium'),
  repetitionBox: integer('repetition_box').default(1),
  lastReviewedAt: timestamp('last_reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Topic Progress
export const topicProgress = pgTable('topic_progress', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  topicName: text('topic_name').notNull(),
  totalQuestionsAttempted: integer('total_questions_attempted')
    .default(0)
    .notNull(),
  totalCorrect: integer('total_correct').default(0).notNull(),
  masteryStatus: text('mastery_status').default('needs_focus').notNull(),
  lastPracticedAt: timestamp('last_practiced_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Study Sessions
export const studySessions = pgTable('study_sessions', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id').references(() => subjects.id, {
    onDelete: 'set null',
  }),
  activityType: text('activity_type').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  notes: text('notes'),
});

// Study Plans
export const studyPlans = pgTable('study_plans', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  subjectId: integer('subject_id')
    .references(() => subjects.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  targetDate: text('target_date'),
  dailyGoals: jsonb('daily_goals')
    .$type<
      Array<{
        day: number;
        topic: string;
        tasks: string[];
        done: boolean;
      }>
    >()
    .notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subjects: many(subjects),
  materials: many(studyMaterials),
  quizzes: many(quizzes),
  flashcards: many(flashcards),
  sessions: many(studySessions),
  plans: many(studyPlans),
  notifications: many(notifications),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  user: one(users, {
    fields: [subjects.userId],
    references: [users.uid],
  }),
  materials: many(studyMaterials),
  quizzes: many(quizzes),
  flashcards: many(flashcards),
  topicProgress: many(topicProgress),
}));

export const studyMaterialsRelations = relations(
  studyMaterials,
  ({ one, many }) => ({
    subject: one(subjects, {
      fields: [studyMaterials.subjectId],
      references: [subjects.id],
    }),
    chunks: many(materialChunks),
    quizzes: many(quizzes),
    flashcards: many(flashcards),
  }),
);

export const materialChunksRelations = relations(materialChunks, ({ one }) => ({
  material: one(studyMaterials, {
    fields: [materialChunks.materialId],
    references: [studyMaterials.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [quizzes.subjectId],
    references: [subjects.id],
  }),
  material: one(studyMaterials, {
    fields: [quizzes.materialId],
    references: [studyMaterials.id],
  }),
  questions: many(questions),
  attempts: many(quizAttempts),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
}));
