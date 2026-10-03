import express, { type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import backendApiRouter from './backend/src/routes/index.ts';
import { requestLogger } from './backend/src/middleware/logger.middleware.ts';
import { errorHandler } from './backend/src/middleware/error.middleware.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid, updateUserProfile } from './src/db/users.ts';
import {
  getSubjectsByUser,
  createSubject,
  getSubjectById,
  updateSubject,
  deleteSubject,
} from './src/db/subjects.ts';
import {
  getMaterialsBySubject,
  getAllMaterialsByUser,
  getMaterialById,
  createMaterialWithChunks,
  searchChunks,
  deleteMaterial,
} from './src/db/materials.ts';
import {
  getQuizzesBySubject,
  getQuizById,
  createQuizWithQuestions,
  submitQuizAttempt,
} from './src/db/quizzes.ts';
import {
  getFlashcards,
  createFlashcards,
  updateFlashcardRepetition,
  deleteFlashcard,
} from './src/db/flashcards.ts';
import {
  getTopicProgressBySubject,
  getWeakTopics,
  recordStudySession,
  getStudySessions,
  getDashboardOverview,
} from './src/db/progress.ts';
import {
  getStudyPlans,
  createStudyPlan,
  toggleStudyPlanDay,
  deleteStudyPlan,
} from './src/db/studyPlans.ts';
import { chunkDocumentText } from './src/services/chunker.service.ts';
import {
  generateMaterialSummary,
  askMaterialQuestion,
  generateQuizQuestions,
  generateFlashcardDeck,
  explainTopicMultiLevel,
  generatePersonalizedStudyPlan,
} from './src/services/gemini.service.ts';

dotenv.config();

// Process Resilience Handlers
process.on('unhandledRejection', (reason: any) => {
  console.warn('Process unhandledRejection caught:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('Process uncaughtException caught:', err?.message || err);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security: Hide server technology header
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Hardened CORS
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// Safe request body limits (prevents payload-based memory exhaustion DoS)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(requestLogger);

// Mount Modular StudyAI Backend REST API
app.use('/api', backendApiRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -----------------------------------------------------------------------------
// AUTH & USER ROUTES
// -----------------------------------------------------------------------------
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { university, major } = req.body;
    const dbUser = await getOrCreateUser(
      user.uid,
      user.email || '',
      user.name || '',
      user.picture || '',
      university,
      major,
    );
    res.json({ user: dbUser });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = await getUserByUid(req.user!.uid);
    if (!dbUser) {
      return res.status(404).json({ error: 'User record not found' });
    }
    res.json({ user: dbUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, university, major } = req.body;
    const updated = await updateUserProfile(req.user!.uid, {
      displayName,
      university,
      major,
    });
    res.json({ user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// SUBJECTS ROUTES
// -----------------------------------------------------------------------------
app.get('/api/subjects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await getSubjectsByUser(req.user!.uid);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, color, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subject name is required' });
    }
    const created = await createSubject(req.user!.uid, {
      name: name.trim(),
      code: code?.trim(),
      color,
      description,
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subjects/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = Number(req.params.id);
    const subject = await getSubjectById(req.user!.uid, subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json(subject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/subjects/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = Number(req.params.id);
    const updated = await updateSubject(req.user!.uid, subjectId, req.body);
    if (!updated) return res.status(404).json({ error: 'Subject not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subjects/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = Number(req.params.id);
    await deleteSubject(req.user!.uid, subjectId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// STUDY MATERIALS & CHUNKS & SEARCH
// -----------------------------------------------------------------------------
app.get('/api/materials', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId } = req.query;
    if (subjectId) {
      const list = await getMaterialsBySubject(req.user!.uid, Number(subjectId));
      return res.json(list);
    }
    const list = await getAllMaterialsByUser(req.user!.uid);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials/search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const query = String(req.query.q || '');
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const results = await searchChunks(req.user!.uid, query, subjectId);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const materialId = Number(req.params.id);
    const material = await getMaterialById(req.user!.uid, materialId);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(material);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, title, fileType, rawText, fileSize } = req.body;
    if (!subjectId || !title || !rawText) {
      return res.status(400).json({ error: 'Subject ID, title, and text content are required' });
    }

    // 1. Semantic Sliding-Window Chunking (immediate search + future RAG ready)
    const chunks = chunkDocumentText(rawText);

    // 2. Generate initial AI summary and key concepts
    let summaryText = '';
    let keyConcepts: string[] = [];
    try {
      const aiSummary = await generateMaterialSummary(title, rawText);
      summaryText = aiSummary.executiveSummary;
      keyConcepts = aiSummary.suggestedTopics;
    } catch (e) {
      console.warn('Could not generate initial summary on upload:', e);
    }

    // 3. Persist material and chunks to PostgreSQL
    const material = await createMaterialWithChunks(req.user!.uid, Number(subjectId), {
      title,
      fileType: fileType || 'text',
      fileSize: fileSize || rawText.length,
      rawText,
      summary: summaryText,
      keyConcepts,
      chunks,
    });

    res.status(201).json(material);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/materials/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const materialId = Number(req.params.id);
    await deleteMaterial(req.user!.uid, materialId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// AI SERVICES (SUMMARIZE, CHAT WITH DOCS, MULTI-LEVEL EXPLAIN, STUDY PLAN)
// -----------------------------------------------------------------------------
app.post('/api/ai/summarize', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { materialId } = req.body;
    const material = await getMaterialById(req.user!.uid, Number(materialId));
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const summaryResult = await generateMaterialSummary(material.title, material.rawText);
    res.json(summaryResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { materialId, question, conversationHistory } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    let contextChunks: any[] = [];
    if (materialId) {
      const material = await getMaterialById(req.user!.uid, Number(materialId));
      if (material && material.chunks) {
        // Find most relevant chunks or pass first several chunks
        contextChunks = material.chunks.slice(0, 5).map((c) => ({
          chunkIndex: c.chunkIndex,
          pageNumber: c.pageNumber,
          content: c.content,
          materialTitle: material.title,
        }));
      }
    } else {
      // Cross-document search
      const searched = await searchChunks(req.user!.uid, question);
      contextChunks = searched.slice(0, 5).map((s) => ({
        chunkIndex: s.chunkIndex,
        pageNumber: s.pageNumber,
        content: s.content,
        materialTitle: s.materialTitle,
      }));
    }

    const result = await askMaterialQuestion(question, contextChunks, conversationHistory || []);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/explain', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, level, subjectContext } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const validLevel = ['beginner', 'intermediate', 'advanced'].includes(level)
      ? level
      : 'intermediate';

    const explanation = await explainTopicMultiLevel(topic, validLevel, subjectContext);
    res.json(explanation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/study-plan', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, targetDate, dailyHours } = req.body;
    const subject = await getSubjectById(req.user!.uid, Number(subjectId));
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const weakTopics = await getWeakTopics(req.user!.uid, subject.id);
    const materials = await getMaterialsBySubject(req.user!.uid, subject.id);

    const generated = await generatePersonalizedStudyPlan(
      subject.name,
      targetDate,
      Number(dailyHours) || 2,
      weakTopics.map((w) => w.topicName),
      materials.map((m) => m.title),
    );

    // Save directly to study_plans table
    const saved = await createStudyPlan(
      req.user!.uid,
      subject.id,
      generated.title,
      targetDate || null,
      generated.dailyGoals,
    );

    res.status(201).json({ ...saved, overview: generated.overview });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// QUIZZES & ASSESSMENT
// -----------------------------------------------------------------------------
app.get('/api/quizzes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId } = req.query;
    if (!subjectId) return res.status(400).json({ error: 'Subject ID required' });

    const list = await getQuizzesBySubject(req.user!.uid, Number(subjectId));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quizzes/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, materialId, count, difficulty } = req.body;
    const material = await getMaterialById(req.user!.uid, Number(materialId));
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const questionCount = Math.min(Math.max(Number(count) || 5, 3), 15);
    const generatedQuestions = await generateQuizQuestions(
      material.title,
      material.rawText,
      questionCount,
      difficulty || 'medium',
    );

    const quiz = await createQuizWithQuestions(
      req.user!.uid,
      Number(subjectId),
      material.id,
      {
        title: `${material.title} Practice Quiz`,
        difficulty: difficulty || 'medium',
        questions: generatedQuestions,
      },
    );

    res.status(201).json(quiz);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quizzes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const quizId = Number(req.params.id);
    const includeAnswers = req.query.review === 'true';
    const quiz = await getQuizById(req.user!.uid, quizId, includeAnswers);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json(quiz);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quizzes/:id/submit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const quizId = Number(req.params.id);
    const { userSelections, timeTakenSeconds } = req.body;
    if (!Array.isArray(userSelections)) {
      return res.status(400).json({ error: 'userSelections array is required' });
    }

    const evaluation = await submitQuizAttempt(
      req.user!.uid,
      quizId,
      userSelections,
      Number(timeTakenSeconds) || 0,
    );

    res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// FLASHCARDS & SPACED REPETITION
// -----------------------------------------------------------------------------
app.get('/api/flashcards', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const materialId = req.query.materialId ? Number(req.query.materialId) : undefined;
    const cards = await getFlashcards(req.user!.uid, subjectId, materialId);
    res.json(cards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flashcards/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, materialId, count } = req.body;
    const material = await getMaterialById(req.user!.uid, Number(materialId));
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const cardCount = Math.min(Math.max(Number(count) || 8, 3), 20);
    const generated = await generateFlashcardDeck(material.title, material.rawText, cardCount);

    const saved = await createFlashcards(
      req.user!.uid,
      Number(subjectId),
      material.id,
      generated,
    );

    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flashcards', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, materialId, frontText, backText, topicTag } = req.body;
    if (!subjectId || !frontText || !backText) {
      return res.status(400).json({ error: 'Subject ID, frontText and backText required' });
    }

    const [created] = await createFlashcards(req.user!.uid, Number(subjectId), materialId || null, [
      { frontText, backText, topicTag },
    ]);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/flashcards/:id/review', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cardId = Number(req.params.id);
    const { outcome } = req.body; // 'again', 'hard', 'good', 'easy'
    const updated = await updateFlashcardRepetition(req.user!.uid, cardId, outcome);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/flashcards/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cardId = Number(req.params.id);
    await deleteFlashcard(req.user!.uid, cardId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// PROGRESS, ANALYTICS & WEAK TOPICS
// -----------------------------------------------------------------------------
app.get('/api/progress/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getDashboardOverview(req.user!.uid);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/weak-topics', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const weakList = await getWeakTopics(req.user!.uid, subjectId);
    res.json(weakList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/topics', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const list = await getTopicProgressBySubject(req.user!.uid, subjectId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/progress/session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, activityType, durationMinutes, notes } = req.body;
    const session = await recordStudySession(req.user!.uid, {
      subjectId: subjectId ? Number(subjectId) : undefined,
      activityType: activityType || 'study',
      durationMinutes: Number(durationMinutes) || 15,
      notes,
    });
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await getStudySessions(req.user!.uid);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// STUDY PLANS
// -----------------------------------------------------------------------------
app.get('/api/study-plans', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const plans = await getStudyPlans(req.user!.uid, subjectId);
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/study-plans/:id/toggle', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const planId = Number(req.params.id);
    const { day } = req.body;
    const updated = await toggleStudyPlanDay(req.user!.uid, planId, Number(day));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/study-plans/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const planId = Number(req.params.id);
    await deleteStudyPlan(req.user!.uid, planId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// VITE MIDDLEWARE (DEV) OR STATIC ASSETS (PROD)
// -----------------------------------------------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // The host preview serves this Express process without a Vite HMR
        // WebSocket, so prevent Vite from injecting a client that retries it.
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyAI server running at http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error starting StudyAI server:', err);
});
