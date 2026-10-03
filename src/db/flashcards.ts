import { db } from './index.ts';
import { flashcards } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';

export async function getFlashcards(userId: string, subjectId?: number, materialId?: number) {
  try {
    const conditions = [eq(flashcards.userId, userId)];
    if (subjectId) conditions.push(eq(flashcards.subjectId, subjectId));
    if (materialId) conditions.push(eq(flashcards.materialId, materialId));

    return await db
      .select()
      .from(flashcards)
      .where(and(...conditions))
      .orderBy(desc(flashcards.createdAt));
  } catch (error) {
    console.error('Error fetching flashcards:', error);
    throw new Error('Failed to fetch flashcards', { cause: error });
  }
}

export async function createFlashcards(
  userId: string,
  subjectId: number,
  materialId: number | null,
  cards: Array<{ frontText: string; backText: string; topicTag?: string; difficultyLevel?: string }>,
) {
  try {
    if (!cards.length) return [];

    const inserted = await db
      .insert(flashcards)
      .values(
        cards.map((c) => ({
          userId,
          subjectId,
          materialId: materialId || null,
          frontText: c.frontText,
          backText: c.backText,
          topicTag: c.topicTag || 'General',
          difficultyLevel: c.difficultyLevel || 'medium',
          repetitionBox: 1,
        })),
      )
      .returning();

    return inserted;
  } catch (error) {
    console.error('Error creating flashcards:', error);
    throw new Error('Failed to save flashcards', { cause: error });
  }
}

export async function updateFlashcardRepetition(
  userId: string,
  cardId: number,
  action: 'again' | 'hard' | 'good' | 'easy',
) {
  try {
    const [card] = await db
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .limit(1);

    if (!card) throw new Error('Flashcard not found');

    let newBox = card.repetitionBox || 1;
    if (action === 'again') newBox = 1;
    else if (action === 'hard') newBox = Math.max(1, newBox);
    else if (action === 'good') newBox = Math.min(5, newBox + 1);
    else if (action === 'easy') newBox = Math.min(5, newBox + 2);

    const [updated] = await db
      .update(flashcards)
      .set({
        repetitionBox: newBox,
        lastReviewedAt: new Date(),
      })
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .returning();

    return updated;
  } catch (error) {
    console.error('Error updating flashcard review:', error);
    throw new Error('Failed to update flashcard review state', { cause: error });
  }
}

export async function deleteFlashcard(userId: string, cardId: number) {
  try {
    await db
      .delete(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)));
    return true;
  } catch (error) {
    console.error('Error deleting flashcard:', error);
    throw new Error('Failed to delete flashcard', { cause: error });
  }
}
