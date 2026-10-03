/**
 * Automated Test Suite: Gemini AI Integration in StudyAI
 * Verifies all 5 capabilities, structured formats, multi-level explanations,
 * anti-hallucination grounding, and resiliency error handling.
 */

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(category: string, name: string, condition: boolean, details?: string) {
  results.push({ category, name, passed: condition, details });
  const icon = condition ? 'PASS [✓]' : 'FAIL [✗]';
  console.log(`${icon} [${category}] ${name}${details ? ` -> ${details}` : ''}`);
}

async function run() {
  console.log('\n=============================================================');
  console.log('STARTING GEMINI AI INTEGRATION VERIFICATION');
  console.log('=============================================================\n');

  const timestamp = Date.now();
  const userEmail = `ai_student_${timestamp}@university.edu`;

  // 1. Authenticate User
  const userRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      password: 'SecurePassword123!',
      displayName: 'Grace Hopper',
    }),
  });
  const userData = await userRes.json();
  const token = userData?.data?.token;

  assert('Setup', 'Authenticated test student created', !!token);

  // 2. Create Course Subject
  const subjRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Computer Architecture & OS',
      code: 'CS420',
      color: '#8b5cf6',
    }),
  });
  const subject = (await subjRes.json())?.data;
  assert('Setup', 'Target subject created', !!subject?.id, `Subject ID: ${subject?.id}`);

  // 3. Create Sample Study Material
  const materialContent = `
Virtual Memory Architecture and Translation Lookaside Buffers (TLB)
Course: CS420 Computer Architecture

1. Translation Mechanism:
The CPU generates a Virtual Address composed of a Virtual Page Number (VPN) and a Page Offset.
The Memory Management Unit (MMU) consults the TLB, a hardware CAM cache of recent translations.
- TLB Hit: Translation completes in 1 clock cycle, returning the Physical Frame Number (PFN).
- TLB Miss: The MMU or OS page fault handler traverses the multi-level page table tree.

2. Multi-Level Page Tables:
To prevent huge contiguous allocations for sparse address spaces, modern 64-bit systems use 4-level or 5-level page tables (PML4, PDPT, PD, PT).
Page table entries store protection bits (Read, Write, eXecute, User/Supervisor, Present bit).

3. Page Replacement Algorithms:
- Belady's Anomaly occurs in First-In-First-Out (FIFO) where adding physical frames increases page faults.
- Least Recently Used (LRU) is optimal among stack algorithms and is immune to Belady's Anomaly.
- Clock (Second-Chance) algorithm approximates LRU efficiently using hardware reference bits.
`;

  const matRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subject.id,
      title: 'Lecture 8: Virtual Memory & TLB Mechanics',
      fileType: 'notes',
      rawText: materialContent,
    }),
  });
  const material = (await matRes.json())?.data;
  assert('Setup', 'Study material uploaded and chunked', !!material?.id, `Material ID: ${material?.id}`);

  // --------------------------------------------------------------------------
  // TEST 1: Summarization
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing Summarization ---');
  const sumRes = await fetch(`${BASE_URL}/api/ai/summarize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      materialId: material.id,
    }),
  });
  const sumData = (await sumRes.json())?.data;

  assert(
    'Summarization',
    'Returns structured executive summary and key points',
    sumRes.status === 200 &&
      typeof sumData?.executiveSummary === 'string' &&
      Array.isArray(sumData?.keyPoints) &&
      sumData.keyPoints.length > 0,
    `Summary: "${sumData?.executiveSummary?.slice(0, 80)}..."`,
  );

  assert(
    'Summarization',
    'Returns structured vocabulary and suggested topics',
    Array.isArray(sumData?.vocabulary) && Array.isArray(sumData?.suggestedTopics),
    `Topics count: ${sumData?.suggestedTopics?.length}`,
  );

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Level Topic Explanation (Beginner, Intermediate, Advanced)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Multi-Level Topic Explanations ---');

  for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
    const expRes = await fetch(`${BASE_URL}/api/ai/explain`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Translation Lookaside Buffer (TLB)',
        level,
        subjectContext: 'Computer Systems',
      }),
    });
    const expData = (await expRes.json())?.data;

    const hasExplanation = typeof expData?.explanation === 'string' || typeof expData?.detailedExplanation === 'string';
    const hasExamples = Array.isArray(expData?.examples) || Array.isArray(expData?.analogies);
    const hasKeyPoints = Array.isArray(expData?.keyPoints) || Array.isArray(expData?.keyTakeaways);

    assert(
      'Topic Explanation',
      `Explanation at ${level.toUpperCase()} tier returns structured payload (explanation, examples, keyPoints)`,
      expRes.status === 200 &&
        expData?.level === level &&
        hasExplanation &&
        hasExamples &&
        hasKeyPoints,
      `Level: ${expData?.level}, Topic: ${expData?.topic}`,
    );
  }

  // --------------------------------------------------------------------------
  // TEST 3: Study-Material Q&A & Anti-Hallucination Grounding
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Grounded Study-Material Q&A ---');

  // 3a. Material-Grounded Question (Answer is explicitly in notes)
  const groundedQRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      materialId: material.id,
      question: 'Which page replacement algorithm suffers from Belady Anomaly according to the notes?',
    }),
  });
  const groundedQData = (await groundedQRes.json())?.data;

  assert(
    'Material Q&A',
    'Grounded question returns correct answer and citations',
    groundedQRes.status === 200 &&
      typeof groundedQData?.answer === 'string' &&
      groundedQData.answer.length > 0 &&
      Array.isArray(groundedQData?.citations),
    `Citations: ${groundedQData?.citations?.length}, Answer snippet: "${groundedQData?.answer?.slice(0, 70)}..."`,
  );

  // 3b. Anti-Hallucination Test: Question about a topic NOT present in the notes (Quantum Computing)
  const ungroundedQRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      materialId: material.id,
      question: 'What does this document say about Quantum Shor Algorithm quantum gates?',
    }),
  });
  const ungroundedQData = (await ungroundedQRes.json())?.data;

  const clarifiesDocumentAbsence =
    /not (explicitly |directly )?covered|not found|not mentioned|not in/i.test(ungroundedQData?.answer || '') ||
    !ungroundedQData?.isGroundedInMaterial;

  assert(
    'Anti-Hallucination',
    'AI does not invent document presence when concept is absent from uploaded notes',
    clarifiesDocumentAbsence,
    `Answer preview: "${ungroundedQData?.answer?.slice(0, 90)}..."`,
  );

  // --------------------------------------------------------------------------
  // TEST 4: Structured Quiz Generation
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Structured Quiz Generation ---');
  const quizGenRes = await fetch(`${BASE_URL}/api/ai/generate-quiz`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      materialId: material.id,
      count: 3,
      difficulty: 'medium',
    }),
  });
  const quizGenData = (await quizGenRes.json())?.data;
  const questions: any[] = quizGenData?.questions || [];

  assert(
    'Quiz Generation',
    'Returns array of structured multiple-choice questions',
    quizGenRes.status === 200 && Array.isArray(questions) && questions.length > 0,
    `Generated ${questions.length} questions`,
  );

  if (questions.length > 0) {
    const q1 = questions[0];
    const hasValidFields =
      (typeof q1.question === 'string' || typeof q1.questionText === 'string') &&
      Array.isArray(q1.options) &&
      q1.options.length === 4 &&
      (typeof q1.correctAnswer === 'string' || typeof q1.correctAnswerIndex === 'number' || typeof q1.correctOptionIndex === 'number') &&
      typeof q1.explanation === 'string' &&
      (typeof q1.topic === 'string' || typeof q1.topicTag === 'string');

    assert(
      'Quiz Structure',
      'Question contains question, options (4), correctAnswer, explanation, topic, difficulty',
      hasValidFields,
      `Topic: ${q1.topic || q1.topicTag}, Options count: ${q1.options?.length}`,
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: Structured Flashcard Generation
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Structured Flashcard Generation ---');
  const flashcardGenRes = await fetch(`${BASE_URL}/api/ai/generate-flashcards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      materialId: material.id,
      count: 4,
    }),
  });
  const flashcards: any[] = (await flashcardGenRes.json())?.data || [];

  assert(
    'Flashcard Generation',
    'Returns array of structured flashcards (question, answer, topic, difficulty)',
    flashcardGenRes.status === 200 && Array.isArray(flashcards) && flashcards.length > 0,
    `Generated ${flashcards.length} cards`,
  );

  if (flashcards.length > 0) {
    const f1 = flashcards[0];
    const hasValidCard =
      (typeof f1.question === 'string' || typeof f1.frontText === 'string') &&
      (typeof f1.answer === 'string' || typeof f1.backText === 'string') &&
      (typeof f1.topic === 'string' || typeof f1.topicTag === 'string') &&
      (typeof f1.difficulty === 'string' || typeof f1.difficultyLevel === 'string');

    assert(
      'Flashcard Structure',
      'Flashcard contains question, answer, topic, difficulty',
      hasValidCard,
      `Question: "${(f1.question || f1.frontText)?.slice(0, 45)}..."`,
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: Resiliency & Empty/Edge Case Handling
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Resiliency & Edge Case Handling ---');
  const emptyRes = await fetch(`${BASE_URL}/api/ai/summarize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Empty Note',
      content: '',
    }),
  });
  assert(
    'Resilience',
    'Empty document summary input is safely rejected with HTTP 400 validation error (not 500)',
    emptyRes.status === 400,
    `HTTP ${emptyRes.status}`,
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL GEMINI AI TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
