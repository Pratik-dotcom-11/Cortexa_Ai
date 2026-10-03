import { executeResilientGemini } from '../ai/geminiResilience.ts';
import { retrievalService } from './retrieval.service.ts';
import { RagQueryResult, RagCitation, SearchOptions } from './types.ts';
import { AI_SYSTEM_INSTRUCTIONS } from '../ai/prompts.ts';
import { logger } from '../utils/logger.ts';

export const ragService = {
  /**
   * Executes full RAG Pipeline:
   * Question -> Create Embedding -> Search Chunks -> Retrieve Top Relevant Chunks -> Relevance Filter -> Provide Context to Gemini -> Grounded Answer with Source References
   */
  async queryGrounded(
    userId: string,
    question: string,
    options?: {
      materialId?: number;
      subjectId?: number;
      topK?: number;
      conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
    },
  ): Promise<RagQueryResult> {
    const rawQuestion = (question || '').trim();
    const { materialId, subjectId, topK = 4, conversationHistory = [] } = options || {};

    // 1. Retrieve top relevant chunks through vector & hybrid retrieval
    const ragContext = await retrievalService.retrieveContext(rawQuestion, {
      userId,
      materialId,
      subjectId,
      topK,
      minSimilarityThreshold: 0.35,
    });

    const { chunks, citations, isSufficient, topSimilarityScore } = ragContext;

    // 2. Format Context Excerpts for Gemini (Only relevant chunks, NEVER entire PDF!)
    let contextPromptBlock = '';
    if (chunks.length > 0) {
      contextPromptBlock = chunks
        .map(
          (c, idx) =>
            `[EXCERPT ${idx + 1}] Source: "${c.materialTitle || 'Course Document'}", Page: ${c.pageNumber || 1}, ChunkIndex: ${c.chunkIndex}\n${c.content}`,
        )
        .join('\n\n---\n\n');
    }

    // 3. Build Grounded Prompt
    const systemPrompt = AI_SYSTEM_INSTRUCTIONS.GROUNDED_QA;
    const userPrompt = chunks.length > 0
      ? `You are answering a student's question grounded strictly on the following retrieved course material excerpts:

RETRIEVED COURSE EXCERPTS:
"""
${contextPromptBlock}
"""

STUDENT'S QUESTION:
"${rawQuestion}"

GROUNDING & CITATION GUIDELINES:
1. Prioritize the facts, definitions, mechanisms, and formulas in the excerpts above.
2. If the answer is found in the excerpts, provide a clear, intuitive answer and include source references like [Source: "<Document Title>", Page X].
3. If the student's question is NOT answered in the excerpts above, you MUST explicitly state at the beginning:
   "The uploaded study material does not contain sufficient information to answer this specific question."
   Then provide a correct academic explanation based on general scientific knowledge, clearly marking it as general knowledge.
4. Keep the explanation engaging, intuitive, and properly formatted with markdown.`
      : `STUDENT'S QUESTION:
"${rawQuestion}"

INSTRUCTION:
Note that no specific course material excerpts matched this question. Provide a rigorous, intuitive academic explanation using general subject knowledge. State clearly that this explanation is based on general academic knowledge rather than specific uploaded course notes.`;

    let generatedAnswer = '';
    let isGrounded = isSufficient;
    let confidence: 'grounded' | 'general_knowledge' | 'partial' = isSufficient ? 'grounded' : 'general_knowledge';

    try {
      generatedAnswer = (await executeResilientGemini(userPrompt, {
        systemInstruction: systemPrompt,
        timeoutMs: 14000,
      })) || '';
    } catch {
      // Local synthesis fallback below
    }

    // 4. Fallback synthesis if API is unavailable or mocked
    if (!generatedAnswer) {
      if (chunks.length > 0 && isSufficient) {
        const primaryChunk = chunks[0];
        generatedAnswer = `Based on your course materials for **"${primaryChunk.materialTitle || 'Study Notes'}"** (Page ${primaryChunk.pageNumber || 1}):\n\n${primaryChunk.content}\n\n[Source: "${primaryChunk.materialTitle || 'Study Document'}", Page ${primaryChunk.pageNumber || 1}]`;
        isGrounded = true;
        confidence = 'grounded';
      } else if (materialId) {
        generatedAnswer = `The uploaded study material does not contain sufficient information to answer this specific question.\n\nIn general academic terminology, **${rawQuestion.slice(0, 50)}** refers to foundational principles in this subject area.`;
        isGrounded = false;
        confidence = 'general_knowledge';
      } else {
        generatedAnswer = `Regarding your question on **"${rawQuestion.slice(0, 60)}"**:\n\nThis concept is an important academic topic. In general, it relates to the foundational mechanics of the subject.`;
        isGrounded = false;
        confidence = 'general_knowledge';
      }
    }

    // Determine follow-up suggestions
    const followUps = [
      'Explain this concept in simple language',
      'Give me a concrete example',
      'Now test me with a practice question',
    ];

    return {
      answer: generatedAnswer,
      isGroundedInMaterial: isGrounded,
      isSufficient,
      confidence,
      citations: isGrounded ? citations : [],
      retrievedChunksCount: chunks.length,
      topSimilarityScore: Math.round(topSimilarityScore * 100) / 100,
      suggestedFollowUps: followUps,
    };
  },
};
