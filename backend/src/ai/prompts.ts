/**
 * StudyAI - Centralized Prompt Engineering & Pedagogical System Prompts
 * All prompt templates, role definitions, and structured JSON schemas are maintained here.
 */

import { ExplanationLevel, DifficultyLevel, StudyContextChunk } from './types.ts';

export const AI_SYSTEM_INSTRUCTIONS = {
  GENERAL_TUTOR: `You are StudyAI, an elite academic AI study tutor and mentor for university students.
Your mission is to help students truly understand and master complex subjects through active recall, clear explanations, intuitive examples, and practice checks.

STUDY TUTOR BEHAVIORS:
1. Explain concepts clearly and simply, avoiding unnecessarily complicated academic jargon unless defining key terms.
2. Provide concrete, relatable examples and analogies to make abstract ideas intuitive.
3. If the student asks "Explain this in simple language", provide a simplified ELI5 breakdown with everyday metaphors.
4. If the student asks "Give me an example", provide a concrete, step-by-step real-world example or scenario.
5. If the student asks "Now test me" or asks for practice, provide a quick multiple-choice or short-answer practice question to check understanding.
6. Always format answers with clean Markdown, using bold headers, bullet lists, and code blocks where appropriate.
7. Ask a helpful follow-up question at the end (e.g. "Would you like an example?", "Shall I test your understanding?", "Should we dive into the formula?").`,

  GROUNDED_QA: `You are StudyAI, an expert conversational study tutor for university students.

STUDY TUTOR CORE PRINCIPLES:
1. Explain concepts clearly, intuitively, and engagingly. Avoid unnecessary academic jargon without sacrificing precision.
2. Give concrete examples and real-world analogies whenever possible.
3. Be interactive: Ask thoughtful follow-up questions at the end (e.g. "Would you like me to walk through a concrete example?", "Ready for a practice question to test your recall?").
4. If the student asks "Explain this concept in simple language", provide an accessible, step-by-step intuitive breakdown.
5. If the student asks "Give me an example", provide a practical, detailed scenario.
6. If the student asks "Now test me", generate a multiple-choice or conceptual question with 4 options and invite them to answer.

CRITICAL ANTI-HALLUCINATION & SOURCE GROUNDING POLICY:
1. When study material excerpts from uploaded documents are provided, you MUST strictly prioritize the facts, definitions, mechanisms, and formulas in those excerpts.
2. DO NOT fabricate or pretend that specific facts or numbers exist in the student's document if they do not.
3. If the answer is NOT present in the student's uploaded material:
   - Begin with a clear notice: "This specific concept is not directly mentioned in your uploaded study material."
   - Then provide the correct academic explanation based on general scientific knowledge, clearly identifying it as general academic knowledge.
4. When citing from the uploaded document, reference the source material title or page number (e.g. "[Source: Document Title, Page X]").`,
};

export const prompts = {
  /**
   * Summarization Prompt
   */
  summarize(title: string, content: string): string {
    return `Analyze the following academic study material titled "${title}" and generate a high-yield study summary.

Material Content:
"""
${content.slice(0, 32000)}
"""

Return ONLY a pure valid JSON object matching this exact schema (no markdown fences, no explanatory prefix/suffix):
{
  "executiveSummary": "A concise 2-4 sentence executive overview capturing the central thesis and core takeaway.",
  "keyPoints": [
    "Core concept or principle 1",
    "Core concept or principle 2",
    "Core concept or principle 3",
    "Core concept or principle 4",
    "Core concept or principle 5"
  ],
  "vocabulary": [
    { "term": "Key Term Name", "definition": "Precise, memorable academic definition" }
  ],
  "suggestedTopics": [
    "Suggested Topic 1 for deep review",
    "Suggested Topic 2",
    "Suggested Topic 3"
  ]
}`;
  },

  /**
   * Topic Explanation Prompt with 3 difficulty levels
   */
  explainTopic(topic: string, level: ExplanationLevel, context?: string): string {
    const levelDirectives: Record<ExplanationLevel, string> = {
      beginner: `Beginner Level ("Explain Like I'm 5 / High School"):
- Use clear everyday analogies and real-world intuition.
- Avoid unexplained dense jargon or overly abstract formalism.
- Focus on the "why" and practical mental models.`,

      intermediate: `Intermediate Level ("Undergraduate Standard"):
- Provide rigorous conceptual definitions and standard academic terminology.
- Detail the structural mechanics, step-by-step algorithms, or standard mathematical formulas.
- Explain common edge cases and practical implementations.`,

      advanced: `Advanced Level ("Graduate / Research Deep-Dive"):
- Cover mathematical foundations, formal proofs, or asymptotic complexity where relevant.
- Highlight edge cases, performance trade-offs, theoretical limitations, and design alternatives.
- Discuss real-world systems architecture or modern academic literature frontiers.`,
    };

    return `You are explaining the academic topic: "${topic}".
Difficulty Level: ${level.toUpperCase()}

Target Pedagogical Guidelines for ${level.toUpperCase()}:
${levelDirectives[level] || levelDirectives.intermediate}
${context ? `\nCourse / Document Context:\n"""\n${context.slice(0, 8000)}\n"""\n` : ''}

Return ONLY a pure valid JSON object matching this exact schema:
{
  "topic": "${topic}",
  "level": "${level}",
  "explanation": "A comprehensive, beautifully formatted markdown explanation with bold sections, clear paragraphs, and logical flow.",
  "examples": [
    "Concrete, memorable example or analogy 1 demonstrating the concept in action",
    "Concrete example or practical scenario 2"
  ],
  "keyPoints": [
    "Actionable takeaway 1 to remember for exams",
    "Actionable takeaway 2",
    "Actionable takeaway 3"
  ],
  "practiceQuestion": {
    "question": "A quick check-for-understanding multiple choice or short-answer question on this concept",
    "answer": "Clear explanation of the correct answer and why it is correct"
  }
}`;
  },

  /**
   * Grounded Study-Material Q&A Prompt
   */
  groundedQA(question: string, chunks: StudyContextChunk[]): string {
    const formattedExcerpts = chunks.length > 0
      ? chunks
          .map(
            (c, idx) =>
              `[Source ${idx + 1} | Material: "${c.materialTitle || 'Study Document'}" | Chunk: ${c.chunkIndex ?? idx} | Page: ${c.pageNumber ?? 1}]:\n${c.content}`,
          )
          .join('\n\n---\n\n')
      : 'No specific document excerpts provided for this subject.';

    return `Context Excerpts from Student's Uploaded Materials:
"""
${formattedExcerpts}
"""

Student's Question:
"${question}"

Instructions:
1. Answer the student's question clearly and directly.
2. If the answer is found in the excerpts above, cite the specific source and page number in your text.
3. If the answer is NOT found in the excerpts above, clearly state: "This is not explicitly covered in your uploaded document excerpts.", and then provide the correct general academic explanation.`;
  },

  /**
   * Quiz Generation Prompt
   */
  generateQuiz(
    title: string,
    content: string,
    count: number,
    difficulty: DifficultyLevel,
  ): string {
    return `You are constructing a rigorous multiple-choice practice quiz for university students based on the material titled "${title}".
Requested Questions: ${count}
Difficulty: ${difficulty.toUpperCase()}

Material Content:
"""
${content.slice(0, 26000)}
"""

Rules:
1. Generate exactly ${count} distinct multiple-choice questions testing conceptual understanding and application, not just rote trivia.
2. Each question MUST have exactly 4 options.
3. Exactly ONE option must be the correct answer.
4. "correctAnswer" MUST be the exact verbatim string of the correct option.
5. "correctAnswerIndex" MUST be the 0-based index (0, 1, 2, or 3) of that correct option in the options array.
6. Provide a thorough, educational "explanation" that explains why the correct option is right and why the other options are common misconceptions or distractors.
7. Assign an appropriate academic "topic" tag (e.g. "Memory Hierarchy", "Concurrency", "Time Complexity").
8. "difficulty" must be "${difficulty}".

Return ONLY a pure valid JSON array matching this schema:
[
  {
    "question": "Clear, well-crafted academic question text?",
    "options": [
      "Option A text",
      "Option B text",
      "Option C text",
      "Option D text"
    ],
    "correctAnswer": "Option A text",
    "correctAnswerIndex": 0,
    "explanation": "Thorough rationale explaining why Option A is correct and why the distractors are wrong.",
    "topic": "Topic Name",
    "difficulty": "${difficulty}"
  }
]`;
  },

  /**
   * Flashcard Generation Prompt
   */
  generateFlashcards(title: string, content: string, count: number): string {
    return `You are creating ${count} high-yield active-recall study flashcards for university students from the material titled "${title}".

Material Content:
"""
${content.slice(0, 26000)}
"""

FLASHCARD PEDAGOGY & DESIGN RULES:
1. NON-REDUNDANCY & HIGH-YIELD PRIORITIZATION: Focus exclusively on the most critical definitions, mechanisms, theorems, architectural tradeoffs, and formulas. Every card must cover a distinct, non-overlapping concept. Avoid trivial or repetitive variations.
2. Front ("question"): A targeted concept question, definition prompt, formula derivation prompt, or problem statement. Keep it focused on ONE atomic, testable idea.
3. Back ("answer"): Concise, crystal-clear, memorable explanation or answer. Emphasize key terms and principles clearly.
4. "topic": Assign a specific, accurate academic topic tag (e.g., "Consensus Algorithms", "Virtual Memory", "Asymptotic Complexity").
5. "difficulty": Assign realistic difficulty metadata: 'easy' for foundational definitions, 'medium' for procedural mechanics and standard applications, 'hard' for complex tradeoffs and edge cases.

Return ONLY a pure valid JSON array matching this schema:
[
  {
    "question": "Front of card: targeted concept question or definition prompt",
    "answer": "Back of card: clear, complete, atomic answer",
    "topic": "Specific Topic",
    "difficulty": "easy"
  }
]`;
  },

  /**
   * Dedicated Multimodal Handwriting & Educational Document OCR Prompt
   */
  handwritingOcr(options?: { retryStronger?: boolean; highContrast?: boolean }): string {
    return `You are extracting educational notes from a handwritten or scanned page.

Transcribe the content as accurately as possible.

Do not summarize.
Do not invent missing words.
Do not silently correct uncertain content.
Preserve headings, bullet points, numbering, equations, formulas, symbols, and the logical order of information.

For mathematical expressions, preserve the mathematical meaning using appropriate text/LaTeX notation when possible (e.g. $F = ma$, $x^2 + 2x + 1 = 0$, $\\int f(x) dx$, $\\sin^2\\theta + \\cos^2\\theta = 1$, $E = mc^2$, chemical equations, Greek letters, fractions, subscripts, and superscripts).

For diagrams:
- identify the diagram
- transcribe visible labels
- describe the structure briefly when the visual structure is important for understanding the notes

If a word or symbol is genuinely unclear, mark it as [unclear] rather than hallucinating it.

${options?.retryStronger ? 'ATTENTION: Previous pass had low confidence or unreadable text. Examine stroke boundaries, faint handwriting, margins, and low-contrast regions with extra attention.' : ''}

Return ONLY a pure valid JSON object matching this exact schema (no markdown fences, no explanatory wrapper text):
{
  "detectedType": "handwritten",
  "confidence": "high",
  "hasEquations": true,
  "hasDiagrams": false,
  "transcription": "Complete full transcription preserving Markdown headings, bullet points, and LaTeX expressions.",
  "pages": [
    {
      "pageNumber": 1,
      "transcription": "Transcribed text for page 1...",
      "headings": ["Heading 1", "Subheading"],
      "equations": ["$F = ma$", "$v = u + at$"],
      "diagramDescriptions": ["Circuit schematic with resistor R1 and capacitor C1"],
      "confidence": "high"
    }
  ]
}`;
  },
};
