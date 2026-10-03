import { eq, and, desc, inArray } from 'drizzle-orm';
import { db, isDbActive } from '../config/database.ts';
import { flashcards, studyMaterials, subjects } from '../models/schema.ts';
import { subjectsService } from './subjects.service.ts';
import { materialsService } from './materials.service.ts';
import { aiService } from './ai.service.ts';
import { NotFoundError, ForbiddenError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { sanitizeString } from './auth.service.ts';

// In-memory fallback map for high-availability test environments and offline development
const memoryCards = new Map<number, any>();
let nextCardId = 500;

export interface CreateFlashcardInput {
  subjectId: number;
  materialId?: number;
  frontText: string;
  backText: string;
  topicTag?: string;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  status?: string;
}

export interface UpdateFlashcardInput {
  frontText?: string;
  backText?: string;
  topicTag?: string;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  status?: string;
  repetitionBox?: number;
}

export interface ReviewFlashcardInput {
  outcome?: 'known' | 'needs_revision' | 'easy' | 'good' | 'hard' | 'again';
  isKnown?: boolean;
}

export const flashcardsService = {
  /**
   * List flashcards with filtering and subject/material joins
   */
  async getFlashcards(
    userId: string,
    filters: {
      subjectId?: number;
      materialId?: number;
      difficultyLevel?: string;
      status?: string;
      topicTag?: string;
    } = {},
  ) {
    const { subjectId, materialId, difficultyLevel, status, topicTag } = filters;

    if (isDbActive()) {
      try {
        const conditions = [eq(flashcards.userId, userId)];

        if (subjectId) conditions.push(eq(flashcards.subjectId, subjectId));
        if (materialId) conditions.push(eq(flashcards.materialId, materialId));
        if (difficultyLevel) conditions.push(eq(flashcards.difficultyLevel, difficultyLevel));
        if (status) conditions.push(eq(flashcards.status, status));
        if (topicTag) conditions.push(eq(flashcards.topicTag, topicTag));

        const list = await db
          .select({
            id: flashcards.id,
            userId: flashcards.userId,
            subjectId: flashcards.subjectId,
            materialId: flashcards.materialId,
            frontText: flashcards.frontText,
            backText: flashcards.backText,
            topicTag: flashcards.topicTag,
            difficultyLevel: flashcards.difficultyLevel,
            status: flashcards.status,
            reviewCount: flashcards.reviewCount,
            correctCount: flashcards.correctCount,
            incorrectCount: flashcards.incorrectCount,
            repetitionBox: flashcards.repetitionBox,
            lastReviewedAt: flashcards.lastReviewedAt,
            createdAt: flashcards.createdAt,
            updatedAt: flashcards.updatedAt,
          })
          .from(flashcards)
          .where(and(...conditions))
          .orderBy(desc(flashcards.createdAt));

        // Enriched with joined metadata
        const enriched = await Promise.all(
          list.map(async (c) => {
            let subjectName: string | undefined;
            let materialTitle: string | undefined;

            if (c.subjectId) {
              const [subj] = await db
                .select({ name: subjects.name })
                .from(subjects)
                .where(eq(subjects.id, c.subjectId))
                .limit(1);
              if (subj) subjectName = subj.name;
            }

            if (c.materialId) {
              const [mat] = await db
                .select({ title: studyMaterials.title })
                .from(studyMaterials)
                .where(eq(studyMaterials.id, c.materialId))
                .limit(1);
              if (mat) materialTitle = mat.title;
            }

            return {
              ...c,
              subjectName,
              materialTitle,
            };
          }),
        );

        return enriched;
      } catch (err: any) {
        logger.debug(`Postgres getFlashcards notice: ${err.message}`);
      }
    }

    let list = Array.from(memoryCards.values()).filter((c) => c.userId === userId);
    if (subjectId) list = list.filter((c) => c.subjectId === subjectId);
    if (materialId) list = list.filter((c) => c.materialId === materialId);
    if (difficultyLevel) list = list.filter((c) => c.difficultyLevel === difficultyLevel);
    if (status) list = list.filter((c) => c.status === status);
    if (topicTag) list = list.filter((c) => c.topicTag?.toLowerCase() === topicTag.toLowerCase());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Get single flashcard by ID with strict ownership validation
   */
  async getFlashcardById(userId: string, cardId: number) {
    if (isDbActive()) {
      try {
        const [found] = await db
          .select()
          .from(flashcards)
          .where(eq(flashcards.id, cardId))
          .limit(1);

        if (found) {
          if (found.userId !== userId) {
            throw new ForbiddenError('You do not have permission to access this flashcard');
          }
          return found;
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError || err instanceof NotFoundError) throw err;
        logger.debug(`Postgres getFlashcardById notice: ${err.message}`);
      }
    }

    const mem = memoryCards.get(cardId);
    if (!mem) throw new NotFoundError('Flashcard not found');
    if (mem.userId !== userId) throw new ForbiddenError('You do not have permission to access this flashcard');
    return mem;
  },

  /**
   * Create a single new flashcard
   */
  async createFlashcard(userId: string, data: CreateFlashcardInput) {
    // 1. Authorize subject ownership
    await subjectsService.getSubjectById(userId, data.subjectId);

    // 2. Authorize material ownership if linked
    if (data.materialId) {
      await materialsService.getMaterialById(userId, data.materialId);
    }

    const front = sanitizeString(data.frontText);
    const back = sanitizeString(data.backText);
    const topic = sanitizeString(data.topicTag) || 'General';
    const diff = ['easy', 'medium', 'hard'].includes(data.difficultyLevel || '')
      ? data.difficultyLevel!
      : 'medium';

    if (isDbActive()) {
      try {
        const [created] = await db
          .insert(flashcards)
          .values({
            userId,
            subjectId: data.subjectId,
            materialId: data.materialId || null,
            frontText: front,
            backText: back,
            topicTag: topic,
            difficultyLevel: diff,
            status: data.status || 'new',
            reviewCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            repetitionBox: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        memoryCards.set(created.id, created);
        return created;
      } catch (err: any) {
        logger.debug(`Postgres createFlashcard notice: ${err.message}`);
      }
    }

    const newCard = {
      id: ++nextCardId,
      userId,
      subjectId: data.subjectId,
      materialId: data.materialId || null,
      frontText: front,
      backText: back,
      topicTag: topic,
      difficultyLevel: diff,
      status: data.status || 'new',
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      repetitionBox: 1,
      lastReviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryCards.set(newCard.id, newCard);
    return newCard;
  },

  /**
   * Update flashcard metadata or content
   */
  async updateFlashcard(userId: string, cardId: number, data: UpdateFlashcardInput) {
    await this.getFlashcardById(userId, cardId);

    const front = data.frontText ? sanitizeString(data.frontText) : undefined;
    const back = data.backText ? sanitizeString(data.backText) : undefined;
    const topic = data.topicTag ? sanitizeString(data.topicTag) : undefined;

    const updates: any = { updatedAt: new Date() };
    if (front !== undefined) updates.frontText = front;
    if (back !== undefined) updates.backText = back;
    if (topic !== undefined) updates.topicTag = topic;
    if (data.difficultyLevel !== undefined) updates.difficultyLevel = data.difficultyLevel;
    if (data.status !== undefined) updates.status = data.status;
    if (data.repetitionBox !== undefined) updates.repetitionBox = data.repetitionBox;

    if (isDbActive()) {
      try {
        const [updated] = await db
          .update(flashcards)
          .set(updates)
          .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
          .returning();

        if (updated) {
          memoryCards.set(cardId, updated);
          return updated;
        }
      } catch (err: any) {
        logger.debug(`Postgres updateFlashcard notice: ${err.message}`);
      }
    }

    const mem = memoryCards.get(cardId);
    if (mem && mem.userId === userId) {
      if (front !== undefined) mem.frontText = front;
      if (back !== undefined) mem.backText = back;
      if (topic !== undefined) mem.topicTag = topic;
      if (data.difficultyLevel !== undefined) mem.difficultyLevel = data.difficultyLevel;
      if (data.status !== undefined) mem.status = data.status;
      if (data.repetitionBox !== undefined) mem.repetitionBox = data.repetitionBox;
      mem.updatedAt = new Date();
      return mem;
    }
    throw new NotFoundError('Flashcard not found');
  },

  /**
   * Log active recall review for a card: marks known/needs_revision or Leitner confidence
   */
  async reviewFlashcard(userId: string, cardId: number, data: ReviewFlashcardInput) {
    const card = await this.getFlashcardById(userId, cardId);

    let isCorrect = false;
    let newBox = card.repetitionBox || 1;
    let newStatus = card.status || 'learning';

    const outcome = data.outcome || (data.isKnown ? 'known' : 'needs_revision');

    switch (outcome) {
      case 'known':
      case 'good':
        isCorrect = true;
        newBox = Math.min(5, (card.repetitionBox || 1) + 1);
        newStatus = newBox >= 4 ? 'mastered' : 'known';
        break;
      case 'easy':
        isCorrect = true;
        newBox = Math.min(5, (card.repetitionBox || 1) + 2);
        newStatus = newBox >= 4 ? 'mastered' : 'known';
        break;
      case 'hard':
        isCorrect = true;
        newBox = card.repetitionBox || 1; // Stay in current box
        newStatus = 'learning';
        break;
      case 'needs_revision':
      case 'again':
      default:
        isCorrect = false;
        newBox = 1; // Drop back to Box 1
        newStatus = 'needs_revision';
        break;
    }

    const currentReviewCount = Number(card.reviewCount || 0);
    const currentCorrectCount = Number(card.correctCount || 0);
    const currentIncorrectCount = Number(card.incorrectCount || 0);

    const updates = {
      reviewCount: currentReviewCount + 1,
      correctCount: isCorrect ? currentCorrectCount + 1 : currentCorrectCount,
      incorrectCount: !isCorrect ? currentIncorrectCount + 1 : currentIncorrectCount,
      repetitionBox: newBox,
      status: newStatus,
      lastReviewedAt: new Date(),
      updatedAt: new Date(),
    };

    if (isDbActive()) {
      try {
        const [updated] = await db
          .update(flashcards)
          .set(updates)
          .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
          .returning();

        if (updated) {
          memoryCards.set(cardId, updated);
          return updated;
        }
      } catch (err: any) {
        logger.debug(`Postgres reviewFlashcard notice: ${err.message}`);
      }
    }

    const mem = memoryCards.get(cardId);
    if (mem && mem.userId === userId) {
      Object.assign(mem, updates);
      return mem;
    }
    throw new NotFoundError('Flashcard not found');
  },

  /**
   * Delete a single flashcard
   */
  async deleteFlashcard(userId: string, cardId: number) {
    await this.getFlashcardById(userId, cardId);

    if (isDbActive()) {
      try {
        await db
          .delete(flashcards)
          .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)));
      } catch (err: any) {
        logger.debug(`Postgres deleteFlashcard notice: ${err.message}`);
      }
    }

    memoryCards.delete(cardId);
    return { success: true, message: 'Flashcard deleted successfully' };
  },

  /**
   * Bulk delete flashcards by ID array or by subject/material
   */
  async deleteFlashcardsBulk(
    userId: string,
    options: { cardIds?: number[]; subjectId?: number; materialId?: number },
  ) {
    const { cardIds, subjectId, materialId } = options;

    if (isDbActive()) {
      try {
        if (cardIds && cardIds.length > 0) {
          await db
            .delete(flashcards)
            .where(and(eq(flashcards.userId, userId), inArray(flashcards.id, cardIds)));
        } else if (materialId) {
          await db
            .delete(flashcards)
            .where(and(eq(flashcards.userId, userId), eq(flashcards.materialId, materialId)));
        } else if (subjectId) {
          await db
            .delete(flashcards)
            .where(and(eq(flashcards.userId, userId), eq(flashcards.subjectId, subjectId)));
        }
        return { success: true, message: 'Flashcards deleted successfully' };
      } catch (err: any) {
        logger.debug(`Postgres deleteFlashcardsBulk notice: ${err.message}`);
      }
    }

    for (const [id, c] of memoryCards.entries()) {
      if (c.userId === userId) {
        if (cardIds && cardIds.includes(id)) memoryCards.delete(id);
        else if (materialId && c.materialId === materialId) memoryCards.delete(id);
        else if (subjectId && c.subjectId === subjectId) memoryCards.delete(id);
      }
    }
    return { success: true, message: 'Flashcards deleted successfully' };
  },

  /**
   * AI Flashcard Generator: prioritizes important non-redundant concepts
   */
  async generateFlashcards(
    userId: string,
    data: {
      subjectId: number;
      materialId?: number;
      count?: number;
      topicFocus?: string;
    },
  ) {
    await subjectsService.getSubjectById(userId, data.subjectId);
    let title = 'Study Topic';
    let content = '';

    if (data.materialId) {
      const material = await materialsService.getMaterialById(userId, data.materialId);
      title = material.title;
      content = material.rawText;
    } else {
      const mats = await materialsService.getMaterials(userId, data.subjectId);
      if (mats.length > 0) {
        title = mats[0].title;
        content = mats[0].rawText;
      }
    }

    if (data.topicFocus) {
      title = `${title} - Focus: ${data.topicFocus}`;
    }

    const count = Math.min(Math.max(Number(data.count) || 8, 1), 25);
    const generated = await aiService.generateFlashcards(title, content, count);

    // Save and return non-redundant cards
    const createdCards: any[] = [];
    for (const card of generated) {
      const created = await this.createFlashcard(userId, {
        subjectId: data.subjectId,
        materialId: data.materialId,
        frontText: card.question,
        backText: card.answer,
        topicTag: card.topic || 'Core Concept',
        difficultyLevel: card.difficulty || 'medium',
        status: 'new',
      });
      createdCards.push(created);
    }

    return createdCards;
  },

  /**
   * Get review summary stats for student flashcards
   */
  async getFlashcardStats(userId: string, subjectId?: number) {
    const cards = await this.getFlashcards(userId, { subjectId });

    const totalCards = cards.length;
    const knownCount = cards.filter((c) => c.status === 'known' || c.status === 'mastered').length;
    const needsRevisionCount = cards.filter((c) => c.status === 'needs_revision').length;
    const newCount = cards.filter((c) => !c.status || c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const totalReviews = cards.reduce((sum, c) => sum + (c.reviewCount || 0), 0);
    const totalCorrect = cards.reduce((sum, c) => sum + (c.correctCount || 0), 0);

    const masteryRate = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

    return {
      totalCards,
      knownCount,
      needsRevisionCount,
      newCount,
      learningCount,
      totalReviews,
      masteryRate,
      dueForReview: cards.filter(
        (c) => c.status === 'needs_revision' || !c.lastReviewedAt || c.repetitionBox === 1,
      ).length,
    };
  },
};
