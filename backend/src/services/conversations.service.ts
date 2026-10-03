import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db, isDbActive } from '../config/database.ts';
import {
  conversations,
  conversationMessages,
  subjects,
  studyMaterials,
} from '../models/schema.ts';
import { subjectsService } from './subjects.service.ts';
import { materialsService } from './materials.service.ts';
import { retrievalService } from '../rag/retrieval.service.ts';
import {
  executeUniversalChat,
  ChatMode,
} from '../ai/universalChat.ts';
import { NotFoundError, ForbiddenError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { sanitizeString } from './auth.service.ts';

// In-memory fallback map for development resilience
interface MemoryConversation {
  id: number;
  userId: string;
  subjectId?: number | null;
  materialId?: number | null;
  mode?: string | null;
  title: string;
  lastMessageSnippet?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryMessage {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  mode?: string | null;
  resolvedMode?: string | null;
  citations: any[];
  isGroundedInMaterial: boolean;
  confidence: string;
  suggestedFollowUps: string[];
  createdAt: Date;
}

const memoryConversations = new Map<number, MemoryConversation>();
const memoryMessages = new Map<number, MemoryMessage[]>();
let nextConvId = 100;
let nextMsgId = 1000;

export const conversationsService = {
  /**
   * List all conversations for the authenticated user
   */
  async getConversations(userId: string) {
    if (isDbActive()) {
      try {
        const convList = await db
          .select({
            id: conversations.id,
            userId: conversations.userId,
            subjectId: conversations.subjectId,
            materialId: conversations.materialId,
            mode: conversations.mode,
            title: conversations.title,
            lastMessageSnippet: conversations.lastMessageSnippet,
            createdAt: conversations.createdAt,
            updatedAt: conversations.updatedAt,
          })
          .from(conversations)
          .where(eq(conversations.userId, userId))
          .orderBy(desc(conversations.updatedAt));

        // Attach subject & material names
        const enriched = await Promise.all(
          convList.map(async (c) => {
            let subjectName: string | undefined;
            let materialTitle: string | undefined;

            if (c.subjectId) {
              const [subj] = await db
                .select({ name: subjects.name, code: subjects.code, color: subjects.color })
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

            const [msgCount] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(conversationMessages)
              .where(eq(conversationMessages.conversationId, c.id));

            return {
              ...c,
              mode: c.mode || 'auto',
              subjectName,
              materialTitle,
              messageCount: msgCount?.count || 0,
            };
          }),
        );

        return enriched;
      } catch (err: any) {
        logger.debug(`Postgres getConversations notice: ${err.message}`);
      }
    }

    const list = Array.from(memoryConversations.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return list.map((c) => {
      const msgs = memoryMessages.get(c.id) || [];
      return {
        ...c,
        mode: c.mode || 'auto',
        messageCount: msgs.length,
      };
    });
  },

  /**
   * Get single conversation by ID with all messages
   */
  async getConversationById(userId: string, id: number) {
    if (isDbActive()) {
      try {
        const [conv] = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, id))
          .limit(1);

        if (conv) {
          if (conv.userId !== userId) {
            throw new ForbiddenError('You do not have access to this conversation');
          }

          let subject: any = null;
          if (conv.subjectId) {
            const [s] = await db
              .select()
              .from(subjects)
              .where(eq(subjects.id, conv.subjectId))
              .limit(1);
            subject = s || null;
          }

          let material: any = null;
          if (conv.materialId) {
            const [m] = await db
              .select()
              .from(studyMaterials)
              .where(eq(studyMaterials.id, conv.materialId))
              .limit(1);
            material = m || null;
          }

          const msgs = await db
            .select()
            .from(conversationMessages)
            .where(eq(conversationMessages.conversationId, id))
            .orderBy(asc(conversationMessages.createdAt));

          return {
            ...conv,
            mode: conv.mode || 'auto',
            subject,
            material,
            messages: msgs,
          };
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError) throw err;
        logger.debug(`Postgres getConversationById notice: ${err.message}`);
      }
    }

    const memConv = memoryConversations.get(id);
    if (!memConv) throw new NotFoundError('Conversation not found');
    if (memConv.userId !== userId) throw new ForbiddenError('You do not have access to this conversation');

    let subject: any = null;
    if (memConv.subjectId) {
      try {
        subject = await subjectsService.getSubjectById(userId, memConv.subjectId);
      } catch {
        subject = null;
      }
    }

    let material: any = null;
    if (memConv.materialId) {
      try {
        material = await materialsService.getMaterialById(userId, memConv.materialId);
      } catch {
        material = null;
      }
    }

    const msgs = memoryMessages.get(id) || [];
    return {
      ...memConv,
      mode: memConv.mode || 'auto',
      subject,
      material,
      messages: msgs,
    };
  },

  /**
   * Create a new conversation thread
   */
  async createConversation(
    userId: string,
    data: { title?: string; subjectId?: number; materialId?: number; mode?: string },
  ) {
    if (data.subjectId) {
      await subjectsService.getSubjectById(userId, data.subjectId);
    }
    if (data.materialId) {
      await materialsService.getMaterialById(userId, data.materialId);
    }

    const cleanTitle = data.title ? sanitizeString(data.title) : 'New Chat';
    const initialMode = data.mode || 'auto';

    if (isDbActive()) {
      try {
        const [created] = await db
          .insert(conversations)
          .values({
            userId,
            subjectId: data.subjectId || null,
            materialId: data.materialId || null,
            mode: initialMode,
            title: cleanTitle || 'New Chat',
            lastMessageSnippet: 'Chat initiated',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        memoryConversations.set(created.id, created);
        memoryMessages.set(created.id, []);
        return created;
      } catch (err: any) {
        logger.debug(`Postgres createConversation notice: ${err.message}`);
      }
    }

    const newId = ++nextConvId;
    const memConv: MemoryConversation = {
      id: newId,
      userId,
      subjectId: data.subjectId,
      materialId: data.materialId,
      mode: initialMode,
      title: cleanTitle || 'New Chat',
      lastMessageSnippet: 'Chat initiated',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryConversations.set(newId, memConv);
    memoryMessages.set(newId, []);
    return memConv;
  },

  /**
   * Send a message and generate a multi-mode Cortexa AI response
   */
  async sendMessage(
    userId: string,
    conversationId: number,
    data: { content: string; mode?: ChatMode; materialId?: number; subjectId?: number },
  ) {
    const rawQuestion = (data.content || '').trim();
    if (!rawQuestion) {
      throw new Error('Message content cannot be empty');
    }

    const conversation = await this.getConversationById(userId, conversationId);
    const activeMode: ChatMode = data.mode || (conversation.mode as ChatMode) || 'auto';
    const activeMaterialId = data.materialId !== undefined ? data.materialId : conversation.materialId;
    const activeSubjectId = data.subjectId !== undefined ? data.subjectId : conversation.subjectId;

    // 1. Format recent conversation history for multi-turn context
    const conversationHistory = (conversation.messages || [])
      .slice(-8)
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // 2. Save user message
    let userMsg: any;
    if (isDbActive()) {
      try {
        const [inserted] = await db
          .insert(conversationMessages)
          .values({
            conversationId,
            role: 'user',
            content: rawQuestion,
            mode: activeMode,
            citations: [],
            isGroundedInMaterial: false,
            confidence: 'grounded',
            createdAt: new Date(),
          })
          .returning();
        userMsg = inserted;
      } catch {
        // Fallback to memory
      }
    }

    if (!userMsg) {
      const newId = ++nextMsgId;
      userMsg = {
        id: newId,
        conversationId,
        role: 'user',
        content: rawQuestion,
        mode: activeMode,
        citations: [],
        isGroundedInMaterial: false,
        confidence: 'grounded',
        suggestedFollowUps: [],
        createdAt: new Date(),
      };
      const msgs = memoryMessages.get(conversationId) || [];
      msgs.push(userMsg);
      memoryMessages.set(conversationId, msgs);
    }

    // 3. Grounded Retrieval (if study material or subject is specified)
    let contextChunks: any[] = [];
    let materialTitle: string | undefined = conversation.material?.title;
    let subjectName: string | undefined = conversation.subject?.name;

    if (activeMaterialId) {
      try {
        const retrieved = await retrievalService.retrieveContext(rawQuestion, {
          userId,
          materialId: activeMaterialId,
          topK: 4,
          minSimilarityThreshold: 0.25,
        });

        if (retrieved.chunks.length > 0) {
          contextChunks = retrieved.chunks;
          if (retrieved.chunks[0].materialTitle) {
            materialTitle = retrieved.chunks[0].materialTitle;
          }
        } else {
          // If vector search score was below threshold on broad/summary questions, load material's initial chunks
          const mat = await materialsService.getMaterialById(userId, activeMaterialId);
          if (mat) {
            materialTitle = mat.title;
            if (mat.chunks && mat.chunks.length > 0) {
              contextChunks = mat.chunks.slice(0, 4).map((c: any) => ({
                chunkIndex: c.chunkIndex,
                pageNumber: c.pageNumber,
                content: c.content,
                materialTitle: mat.title,
              }));
            } else if (mat.rawText) {
              contextChunks = [
                {
                  chunkIndex: 0,
                  pageNumber: 1,
                  content: mat.rawText.slice(0, 3500),
                  materialTitle: mat.title,
                },
              ];
            }
          }
        }
      } catch (err) {
        logger.debug(`Retrieval context notice: ${err}`);
      }
    } else if (activeSubjectId) {
      try {
        const retrieved = await retrievalService.retrieveContext(rawQuestion, {
          userId,
          subjectId: activeSubjectId,
          topK: 4,
          minSimilarityThreshold: 0.28,
        });

        if (retrieved.chunks.length > 0) {
          contextChunks = retrieved.chunks;
          if (retrieved.chunks[0].materialTitle) {
            materialTitle = retrieved.chunks[0].materialTitle;
          }
        }
      } catch (err) {
        logger.debug(`Retrieval context notice: ${err}`);
      }
    }

    // 4. Execute Multi-Mode Universal Chat Engine
    const aiResponse = await executeUniversalChat(userId, rawQuestion, {
      mode: activeMode,
      contextChunks,
      conversationHistory,
      subjectName,
      materialTitle,
    });

    // 5. Save assistant response
    let assistantMsg: any;
    if (isDbActive()) {
      try {
        const [inserted] = await db
          .insert(conversationMessages)
          .values({
            conversationId,
            role: 'assistant',
            content: aiResponse.answer,
            mode: activeMode,
            resolvedMode: aiResponse.resolvedMode,
            citations: aiResponse.citations || [],
            isGroundedInMaterial: aiResponse.isGroundedInMaterial,
            confidence: aiResponse.confidence || 'grounded',
            suggestedFollowUps: aiResponse.suggestedFollowUps,
            createdAt: new Date(),
          })
          .returning();
        assistantMsg = inserted;

        // Auto-generate a clean, concise title from the first question if default
        const isDefaultTitle =
          conversation.title === 'New Study Session' ||
          conversation.title === 'New Study Conversation' ||
          conversation.title === 'New Chat';

        const updatedTitle = isDefaultTitle
          ? rawQuestion.slice(0, 42).trim() + (rawQuestion.length > 42 ? '...' : '')
          : conversation.title;

        await db
          .update(conversations)
          .set({
            title: updatedTitle,
            mode: activeMode,
            lastMessageSnippet: aiResponse.answer.slice(0, 100),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
      } catch {
        // Fallback to memory
      }
    }

    if (!assistantMsg) {
      const newId = ++nextMsgId;
      assistantMsg = {
        id: newId,
        conversationId,
        role: 'assistant',
        content: aiResponse.answer,
        mode: activeMode,
        resolvedMode: aiResponse.resolvedMode,
        citations: aiResponse.citations || [],
        isGroundedInMaterial: aiResponse.isGroundedInMaterial,
        confidence: aiResponse.confidence || 'grounded',
        suggestedFollowUps: aiResponse.suggestedFollowUps,
        createdAt: new Date(),
      };
      const msgs = memoryMessages.get(conversationId) || [];
      msgs.push(assistantMsg);
      memoryMessages.set(conversationId, msgs);

      const conv = memoryConversations.get(conversationId);
      if (conv) {
        if (
          conv.title === 'New Study Session' ||
          conv.title === 'New Study Conversation' ||
          conv.title === 'New Chat'
        ) {
          conv.title = rawQuestion.slice(0, 42).trim() + (rawQuestion.length > 42 ? '...' : '');
        }
        conv.mode = activeMode;
        conv.lastMessageSnippet = aiResponse.answer.slice(0, 100);
        conv.updatedAt = new Date();
      }
    }

    return {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      resolvedMode: aiResponse.resolvedMode,
      suggestedFollowUps: aiResponse.suggestedFollowUps,
      contextActions: aiResponse.contextActions,
    };
  },

  /**
   * Update conversation context or title
   */
  async updateConversation(
    userId: string,
    id: number,
    data: { title?: string; subjectId?: number | null; materialId?: number | null; mode?: string },
  ) {
    await this.getConversationById(userId, id);

    if (data.subjectId) {
      await subjectsService.getSubjectById(userId, data.subjectId);
    }
    if (data.materialId) {
      await materialsService.getMaterialById(userId, data.materialId);
    }

    const updates: any = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = sanitizeString(data.title);
    if (data.mode !== undefined) updates.mode = data.mode;
    if (data.subjectId !== undefined) updates.subjectId = data.subjectId;
    if (data.materialId !== undefined) updates.materialId = data.materialId;

    if (isDbActive()) {
      try {
        const [updated] = await db
          .update(conversations)
          .set(updates)
          .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
          .returning();
        return updated;
      } catch {
        // Fallback
      }
    }

    const conv = memoryConversations.get(id);
    if (conv) {
      if (data.title !== undefined) conv.title = sanitizeString(data.title);
      if (data.mode !== undefined) conv.mode = data.mode;
      if (data.subjectId !== undefined) conv.subjectId = data.subjectId || undefined;
      if (data.materialId !== undefined) conv.materialId = data.materialId || undefined;
      conv.updatedAt = new Date();
    }
    return conv;
  },

  /**
   * Delete a conversation thread
   */
  async deleteConversation(userId: string, id: number) {
    await this.getConversationById(userId, id);

    if (isDbActive()) {
      try {
        await db
          .delete(conversations)
          .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
      } catch {
        // Fallback
      }
    }

    memoryConversations.delete(id);
    memoryMessages.delete(id);

    return { success: true, message: 'Conversation deleted successfully' };
  },
};

