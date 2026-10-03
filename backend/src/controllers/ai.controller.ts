import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { aiService } from '../services/ai.service.ts';
import { materialsService } from '../services/materials.service.ts';
import { subjectsService } from '../services/subjects.service.ts';
import { progressService } from '../services/progress.service.ts';
import { studyPlanService } from '../services/studyPlan.service.ts';
import { ragService } from '../rag/rag.service.ts';
import { sendSuccess } from '../utils/response.ts';
import { BadRequestError, NotFoundError } from '../utils/errors.ts';
import { ExplanationLevel, DifficultyLevel } from '../ai/types.ts';

export const aiController = {
  /**
   * 1. Summarization Endpoint
   */
  async summarize(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, title, materialId } = req.body;
      let textToSummarize = content || '';
      let docTitle = title || 'Study Document';

      if (materialId) {
        const material = await materialsService.getMaterialById(req.user!.uid, Number(materialId));
        textToSummarize = material.rawText;
        docTitle = material.title;
      }

      const result = await aiService.summarize(docTitle, textToSummarize);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  /**
   * 2. Topic Explanation Endpoint (Beginner, Intermediate, Advanced)
   */
  async explain(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topic, level, subjectContext, materialId } = req.body;
      let context = subjectContext;

      if (materialId) {
        const material = await materialsService.getMaterialById(req.user!.uid, Number(materialId));
        if (material) {
          context = `${context ? context + '\n\n' : ''}Material Title: ${material.title}\n${material.rawText.slice(0, 4000)}`;
        }
      }

      const rawLevel = String(level || 'intermediate').toLowerCase();
      const validLevel: ExplanationLevel = (['beginner', 'intermediate', 'advanced'].includes(rawLevel)
        ? rawLevel
        : 'intermediate') as ExplanationLevel;

      const result = await aiService.explain(topic, validLevel, context);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  /**
   * 3. Study-Material Grounded Q&A / RAG Endpoint
   */
  async chat(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, materialId, subjectId, conversationHistory } = req.body;

      const result = await ragService.queryGrounded(req.user!.uid, question, {
        materialId: materialId ? Number(materialId) : undefined,
        subjectId: subjectId ? Number(subjectId) : undefined,
        topK: 4,
        conversationHistory: conversationHistory || [],
      });

      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  /**
   * 4. Dedicated RAG Query Endpoint
   */
  async ragQuery(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, materialId, subjectId, topK } = req.body;

      const result = await ragService.queryGrounded(req.user!.uid, question, {
        materialId: materialId ? Number(materialId) : undefined,
        subjectId: subjectId ? Number(subjectId) : undefined,
        topK: topK ? Number(topK) : 4,
      });

      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  },

  /**
   * 5. Structured Quiz Generation Endpoint
   */
  async generateQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, content, materialId, count, difficulty } = req.body;
      let rawContent = content || '';
      let quizTitle = title || 'Practice Quiz';

      if (materialId) {
        const material = await materialsService.getMaterialById(req.user!.uid, Number(materialId));
        rawContent = material.rawText;
        quizTitle = material.title;
      }

      const questionCount = Math.min(Math.max(Number(count) || 5, 1), 20);
      const diff: DifficultyLevel = (['easy', 'medium', 'hard'].includes(String(difficulty).toLowerCase())
        ? String(difficulty).toLowerCase()
        : 'medium') as DifficultyLevel;

      const questions = await aiService.generateQuizQuestions(quizTitle, rawContent, questionCount, diff);
      sendSuccess(res, { title: quizTitle, difficulty: diff, questions }, 200);
    } catch (err) {
      next(err);
    }
  },

  /**
   * 6. Structured Flashcard Generation Endpoint
   */
  async generateFlashcards(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, content, materialId, count } = req.body;
      let rawContent = content || '';
      let cardTitle = title || 'Flashcards';

      if (materialId) {
        const material = await materialsService.getMaterialById(req.user!.uid, Number(materialId));
        rawContent = material.rawText;
        cardTitle = material.title;
      }

      const cardCount = Math.min(Math.max(Number(count) || 8, 1), 25);
      const cards = await aiService.generateFlashcards(cardTitle, rawContent, cardCount);
      sendSuccess(res, cards, 200);
    } catch (err) {
      next(err);
    }
  },

  /**
   * 7. Personalized AI Study Plan Generation Endpoint
   */
  async generateStudyPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId, targetDate, dailyHours } = req.body;
      const userId = req.user!.uid;

      // 1. Determine target subject
      let targetSubjId = Number(subjectId);
      if (isNaN(targetSubjId) || targetSubjId <= 0) {
        const userSubjects = await subjectsService.getSubjects(userId);
        if (userSubjects.length === 0) {
          throw new BadRequestError('Please create at least one subject/course before generating an AI study plan.');
        }
        targetSubjId = userSubjects[0].id;
      }

      const subject = await subjectsService.getSubjectById(userId, targetSubjId);
      if (!subject) {
        throw new NotFoundError('Subject not found');
      }

      // 2. Retrieve identified weak topics and study materials
      const weakTopics = await progressService.getWeakTopics(userId, subject.id);
      const materials = await materialsService.getMaterials(userId, subject.id);

      const weakTopicNames = weakTopics.map((w: any) => w.topicName);
      const materialTitles = materials.map((m: any) => m.title);

      // 3. Generate study plan
      const hours = Number(dailyHours) || 2;
      const cleanDate = targetDate ? String(targetDate).trim() : 'In 14 days';

      const generated = await aiService.generateStudyPlan(
        subject.name,
        cleanDate,
        hours,
        weakTopicNames,
        materialTitles,
      );

      // 4. Save directly to database / storage
      const savedPlan = await studyPlanService.createStudyPlan(userId, {
        subjectId: subject.id,
        title: generated.title || `Personalized Study Plan: ${subject.name}`,
        targetDate: cleanDate,
        dailyGoals: generated.dailyGoals,
      });

      sendSuccess(
        res,
        { ...savedPlan, overview: generated.overview },
        201,
        'Personalized AI Study Plan generated successfully',
      );
    } catch (err) {
      next(err);
    }
  },
};
