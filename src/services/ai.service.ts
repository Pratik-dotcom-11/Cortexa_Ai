import { ChatMessage, StudyPlan, ApiResponse } from '../types';
import { storage } from './storage';

export const aiService = {
  async askQuestion(params: {
    question: string;
    materialId?: string;
    subjectId?: string;
    explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<ApiResponse<ChatMessage>> {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const materials = storage.getMaterials();
    const targetMat = params.materialId
      ? materials.find((m) => m.id === params.materialId)
      : materials.find((m) => m.subjectId === params.subjectId) || materials[0];

    // Find the most relevant chunk if available
    const relevantChunk = targetMat?.chunks?.[0];
    const level = params.explanationLevel || 'intermediate';

    let content = '';
    if (level === 'beginner') {
      content = `Imagine this like a GPS navigation app on your phone: ${
        relevantChunk ? relevantChunk.content.slice(0, 160) : 'The system searches for the clearest route'
      }... In simple terms, it inspects every path step-by-step and immediately takes the shortest path that has already been verified without getting confused by loops.`;
    } else if (level === 'advanced') {
      content = `Formal evaluation & algorithmic breakdown:\n\n1. Invariant: For all vertices $u \\in S$, the stored distance $d[u]$ equals the exact geodesic distance $\\delta(s, u)$.\n2. Complexity Proof: Given $|V|$ vertices and $|E|$ edges, each relaxation invokes a decrease-key operation in the underlying priority queue structure.\n3. Source Citation Grounding: ${
        relevantChunk ? relevantChunk.content : 'Verified against foundational lecture notes.'
      }`;
    } else {
      content = `Based on your course materials for "${targetMat?.title || 'Selected Subject'}":\n\n${
        relevantChunk
          ? relevantChunk.content
          : 'The core mechanism relies on greedy relaxation of tentative edge distances.'
      }\n\nKey Takeaway: Always ensure non-negative edge costs to maintain the monotonic non-decreasing property during priority queue extraction.`;
    }

    const responseMessage: ChatMessage = {
      id: `msg-${Date.now().toString(36)}`,
      role: 'assistant',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      explanationLevel: level,
      sourceCitations: targetMat
        ? [
            {
              materialTitle: targetMat.title,
              pageOrChunk: relevantChunk?.pageNumber ? `Page ${relevantChunk.pageNumber}` : 'Chunk #1',
              excerpt: relevantChunk?.content.slice(0, 120) + '...' || targetMat.rawText.slice(0, 120),
            },
          ]
        : undefined,
    };

    return { success: true, data: responseMessage };
  },

  async explainTopic(params: {
    topic: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    subjectId?: string;
  }): Promise<ApiResponse<string>> {
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (params.level === 'beginner') {
      return {
        success: true,
        data: `### 🌟 Simplified Intuition: "${params.topic}"\n\nThink of **${params.topic}** like organizing a bookshelf or packing a backpack:\n- Instead of re-checking every single item, you keep a quick reference checklist right on top.\n- You make the best decision for the very next step, knowing each step gets you closer to the optimal outcome.\n\n**Analogy**: If you're walking from your dorm to the library, you don't explore every dead end; you follow the shortest signposted road you already trust!`,
      };
    }

    if (params.level === 'advanced') {
      return {
        success: true,
        data: `### 🔬 Rigorous Academic Analysis: "${params.topic}"\n\n**1. Mathematical & Theoretical Framework**\nUnder standard axiomatic assumptions, ${params.topic} maintains monotonic invariance across state transitions.\n\n**2. Computational Trade-offs**\n- Worst-case time complexity: $\\mathcal{O}((V + E) \\log V)$ using Fibonacci/Binary heaps.\n- Space complexity: $\\mathcal{O}(V)$ auxiliary memory allocations.\n\n**3. Pathological Edge Cases**\nNegative edge relaxation breaks correctness because greedy choice property $\\min_{v \\notin S} d(v)$ no longer guarantees global optimality.`,
      };
    }

    return {
      success: true,
      data: `### 📚 Undergraduate Standard: "${params.topic}"\n\n**Definition & Purpose:**\n${params.topic} is a foundational concept designed to solve optimization problems systematically.\n\n**Core Mechanism:**\n1. Initialization: Establish base metrics and assign tentative bounds.\n2. Iterative Relaxation: Continually select the current optimal candidate from the unvisited set.\n3. Convergence: Terminate when the goal state or terminal boundary is satisfied.\n\n**Practical Application:**\nFrequently tested in midterms and widely utilized in network routing protocols, memory cache policies, and compiler optimizations.`,
    };
  },

  async summarizeMaterial(materialId: string): Promise<ApiResponse<string>> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const materials = storage.getMaterials();
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return { success: false, data: '', error: 'Material not found' };

    const summary = `### 📋 Executive Summary: ${mat.title}\n\n**Overview:**\nThis document covers critical theoretical models, practical implementations, and performance characteristics.\n\n**Key Takeaways:**\n- **Core Thesis**: ${mat.summary || 'Fundamental principles and algorithmic proofs.'}\n- **Primary Concepts**: ${mat.keyConcepts.join(' • ')}\n- **Exam Readiness**: Emphasizes edge case constraints, memory hierarchies, and complexity bounds.`;

    return { success: true, data: summary };
  },
};
