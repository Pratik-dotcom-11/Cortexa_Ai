import { Flashcard, ApiResponse } from '../types';
import { storage } from './storage';

export const flashcardService = {
  async getFlashcards(subjectId?: string): Promise<ApiResponse<Flashcard[]>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let cards = storage.getFlashcards();
    if (subjectId) {
      cards = cards.filter((c) => c.subjectId === subjectId);
    }
    return { success: true, data: cards };
  },

  async reviewFlashcard(
    cardId: string,
    outcome: 'again' | 'hard' | 'good' | 'easy',
  ): Promise<ApiResponse<Flashcard>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const cards = storage.getFlashcards();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return { success: false, data: null as any, error: 'Flashcard not found' };

    // Leitner Box progression
    if (outcome === 'again') {
      card.repetitionBox = 1;
    } else if (outcome === 'hard') {
      card.repetitionBox = Math.max(1, card.repetitionBox);
    } else if (outcome === 'good') {
      card.repetitionBox = Math.min(5, card.repetitionBox + 1);
    } else if (outcome === 'easy') {
      card.repetitionBox = Math.min(5, card.repetitionBox + 2);
    }

    card.lastReviewedAt = new Date().toISOString();
    // Schedule next review based on Leitner Box
    const daysToAdd = Math.pow(2, card.repetitionBox - 1);
    card.nextReviewAt = new Date(Date.now() + daysToAdd * 86400000).toISOString();

    storage.setFlashcards(cards);
    return { success: true, data: card };
  },

  async createFlashcard(params: {
    subjectId: string;
    materialId?: string;
    frontText: string;
    backText: string;
    topicTag?: string;
    difficultyLevel?: 'easy' | 'medium' | 'hard';
  }): Promise<ApiResponse<Flashcard>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const user = storage.getUser();
    const newCard: Flashcard = {
      id: `fc-${Date.now().toString(36)}`,
      userId: user?.id || 'usr-student-01',
      subjectId: params.subjectId,
      materialId: params.materialId,
      frontText: params.frontText,
      backText: params.backText,
      topicTag: params.topicTag || 'General Review',
      difficultyLevel: params.difficultyLevel || 'medium',
      repetitionBox: 1,
      createdAt: new Date().toISOString(),
    };

    const cards = storage.getFlashcards();
    cards.unshift(newCard);
    storage.setFlashcards(cards);

    return { success: true, data: newCard, message: 'Flashcard created' };
  },

  async generateFlashcards(params: {
    subjectId: string;
    materialId: string;
    count?: number;
  }): Promise<ApiResponse<Flashcard[]>> {
    await new Promise((resolve) => setTimeout(resolve, 800)); // AI generation
    const user = storage.getUser();
    const materials = storage.getMaterials();
    const mat = materials.find((m) => m.id === params.materialId);

    const generated: Flashcard[] = [
      {
        id: `fc-${Date.now().toString(36)}-1`,
        userId: user?.id || 'usr-student-01',
        subjectId: params.subjectId,
        materialId: params.materialId,
        frontText: `What is the key takeaway from "${mat?.title || 'this material'}"?`,
        backText: mat?.summary || 'Core foundations, algorithmic constraints, and space/time tradeoffs.',
        topicTag: mat?.keyConcepts[0] || 'Core Theory',
        difficultyLevel: 'medium',
        repetitionBox: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: `fc-${Date.now().toString(36)}-2`,
        userId: user?.id || 'usr-student-01',
        subjectId: params.subjectId,
        materialId: params.materialId,
        frontText: `Identify the main architectural advantage detailed in ${mat?.title || 'Section 1'}.`,
        backText: 'Provides consistent sub-linear access guarantees under high concurrency workloads.',
        topicTag: mat?.keyConcepts[1] || 'Architecture',
        difficultyLevel: 'hard',
        repetitionBox: 1,
        createdAt: new Date().toISOString(),
      },
    ];

    const cards = storage.getFlashcards();
    cards.unshift(...generated);
    storage.setFlashcards(cards);

    return {
      success: true,
      data: generated,
      message: `${generated.length} flashcards generated from document`,
    };
  },
};
