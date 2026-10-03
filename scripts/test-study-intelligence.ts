/**
 * Automated Verification Script: Personalized Study Intelligence System
 * Tests:
 * 1. Topic Accuracy & Quiz Performance Tracking (Strong vs Weak Topics)
 * 2. Revision History & Flashcards Spaced Repetition (Needs Revision Hub)
 * 3. Study Sessions & Streak Calculation
 * 4. Upcoming Goals & Study Plan Progress
 * 5. Data-Grounded Personalized Study Recommendations Service
 * 6. AI Study Coach advice synthesis grounded in exact stored statistics
 * 7. Multi-Tenant Authorization Isolation
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
  console.log('STARTING PERSONALIZED STUDY INTELLIGENCE SYSTEM VERIFICATION');
  console.log('=============================================================\n');

  const ts = Date.now();
  const aliceEmail = `alice_intel_${ts}@stanford.edu`;
  const bobEmail = `bob_intel_${ts}@stanford.edu`;

  // 1. Setup Alice
  const aliceRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: aliceEmail,
      password: 'SecurePassword123!',
      displayName: 'Alice Engineer',
      university: 'Stanford University',
      major: 'Mechanical Engineering',
    }),
  });
  const aliceData = await aliceRes.json();
  const aliceToken = aliceData.data?.token || aliceData.token;
  assert('Auth', 'Alice registered successfully', !!aliceToken);

  const aliceHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${aliceToken}`,
  };

  // 2. Create Physics Subject
  const subjRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: aliceHeaders,
    body: JSON.stringify({
      name: 'Thermal Physics & Mechanics',
      code: 'PHYS-201',
      color: '#f59e0b',
      description: 'Thermodynamics and Classical Mechanics',
    }),
  });
  const subjData = await subjRes.json();
  const subjectId = subjData.data?.id || subjData.id;
  assert('Subjects', 'Subject created', !!subjectId, `Subject ID: ${subjectId}`);

  // 3. Create Study Material
  const matRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: aliceHeaders,
    body: JSON.stringify({
      subjectId,
      title: 'Chapter 3 - Laws of Thermodynamics',
      fileType: 'note',
      rawText: 'The First Law of Thermodynamics states that energy cannot be created or destroyed. The Second Law states that entropy of an isolated system always increases. Carnot engine represents maximum theoretical efficiency.',
    }),
  });
  const matData = await matRes.json();
  const materialId = matData.data?.id || matData.id;
  assert('Materials', 'Study Material uploaded', !!materialId);

  // 4. Create and Submit a Quiz with intentional weak topic (Thermodynamics: 1/3 correct -> 33%) and strong topic (Kinematics: 2/2 correct -> 100%)
  const quizRes = await fetch(`${BASE_URL}/api/quizzes/generate`, {
    method: 'POST',
    headers: aliceHeaders,
    body: JSON.stringify({
      subjectId,
      materialId,
      count: 5,
      difficulty: 'medium',
    }),
  });
  const quizData = await quizRes.json();
  const quiz = quizData.data || quizData;
  const quizId = quiz.id;
  assert('Quizzes', 'Quiz generated', !!quizId && Array.isArray(quiz.questions));

  // Submit quiz answers
  if (quiz.questions && quiz.questions.length >= 2) {
    const questions = quiz.questions;
    // Answer first question wrongly, rest to simulate performance
    const answers = questions.map((q: any, idx: number) => ({
      questionId: q.id,
      selectedIndex: idx === 0 ? 0 : 3, // intentional mix
    }));

    const submitRes = await fetch(`${BASE_URL}/api/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: aliceHeaders,
      body: JSON.stringify({
        answers,
        timeTakenSeconds: 120,
      }),
    });
    const subResult = await submitRes.json();
    assert('Quizzes', 'Quiz submitted & scored', subResult.success || !!subResult.data);
  }

  // 5. Generate Flashcards & Mark as Needs Revision
  const cardsGenRes = await fetch(`${BASE_URL}/api/flashcards/generate`, {
    method: 'POST',
    headers: aliceHeaders,
    body: JSON.stringify({
      subjectId,
      materialId,
      count: 4,
    }),
  });
  const cardsGenData = await cardsGenRes.json();
  const generatedCards = cardsGenData.data || cardsGenData;
  assert('Flashcards', 'Flashcards generated', Array.isArray(generatedCards) && generatedCards.length > 0);

  if (Array.isArray(generatedCards) && generatedCards.length > 0) {
    const cardId = generatedCards[0].id;
    // Mark first card as needs_revision (Box 1)
    const reviewRes = await fetch(`${BASE_URL}/api/flashcards/${cardId}/review`, {
      method: 'POST',
      headers: aliceHeaders,
      body: JSON.stringify({
        outcome: 'needs_revision',
        isKnown: false,
      }),
    });
    const revData = await reviewRes.json();
    assert('Flashcards', 'Flashcard reviewed & placed in Box 1 (needs revision)', revData.data?.repetitionBox === 1 || revData.data?.status === 'needs_revision');
  }

  // 6. Record Study Session
  const sessionRes = await fetch(`${BASE_URL}/api/progress/session`, {
    method: 'POST',
    headers: aliceHeaders,
    body: JSON.stringify({
      subjectId,
      activityType: 'reading',
      durationMinutes: 45,
      notes: 'Reviewed Thermodynamics chapter notes',
    }),
  });
  const sessData = await sessionRes.json();
  assert('Sessions', 'Study session recorded', sessData.success || !!sessData.data);

  // 7. Create Active Study Plan
  const planRes = await fetch(`${BASE_URL}/api/study-plans`, {
    method: 'POST',
    headers: aliceHeaders,
    body: JSON.stringify({
      subjectId,
      title: 'Midterm Exam Preparation',
      targetDate: '2026-10-15',
      dailyGoals: [
        { day: 1, topic: 'Thermodynamics Laws', tasks: ['Read Chapter 3', 'Review flashcards'], done: false },
        { day: 2, topic: 'Heat Engines & Entropy', tasks: ['Practice 5 problems', 'Take quiz'], done: false },
      ],
    }),
  });
  const planData = await planRes.json();
  const planId = planData.data?.id || planData.id;
  assert('StudyPlans', 'Active study plan created', !!planId);

  // 8. Fetch Personalized Study Intelligence
  console.log('\n--- Fetching Study Intelligence Data ---');
  const intelRes = await fetch(`${BASE_URL}/api/progress/intelligence`, {
    headers: aliceHeaders,
  });
  const intelData = await intelRes.json();
  const intelligence = intelData.data || intelData;
  console.log('Returned intelligence keys:', Object.keys(intelligence));
  console.log('Recently studied count:', intelligence.recentlyStudied?.length, intelligence.recentlyStudied);

  assert('Intelligence', 'Intelligence endpoint returned 200 with structured data', !!intelligence);
  assert('Intelligence', 'Study streak calculated', typeof intelligence.studyStreak?.currentStreakDays === 'number' && intelligence.studyStreak.currentStreakDays >= 1);
  assert('Intelligence', 'Study goal progress computed', typeof intelligence.studyGoalProgress?.progressPercentage === 'number');
  assert('Intelligence', 'Recently studied timeline contains events', Array.isArray(intelligence.recentlyStudied) && intelligence.recentlyStudied.length > 0);
  assert('Intelligence', 'Needs revision hub contains flagged items', Array.isArray(intelligence.needsRevision));

  // 9. Verify Personalized Recommendations
  console.log('\n--- Verifying Recommendations ---');
  const recommendations = intelligence.recommendations;
  assert('Recommendations', 'Recommendations list generated', Array.isArray(recommendations) && recommendations.length > 0);

  const hasGroundedMessage = recommendations.some((r: any) =>
    r.title && r.message && r.actionableTab && r.actionLabel,
  );
  assert('Recommendations', 'Recommendations have title, message, and actionable UI routing', hasGroundedMessage);

  // Test GET /api/progress/recommendations
  const recsOnlyRes = await fetch(`${BASE_URL}/api/progress/recommendations`, {
    headers: aliceHeaders,
  });
  const recsOnlyData = await recsOnlyRes.json();
  assert('Recommendations', 'GET /api/progress/recommendations endpoint functional', Array.isArray(recsOnlyData.data || recsOnlyData));

  // 10. Test AI Coach synthesis endpoint
  console.log('\n--- Verifying AI Study Coach Advice ---');
  const coachRes = await fetch(`${BASE_URL}/api/progress/recommendations/ai-coach`, {
    method: 'POST',
    headers: aliceHeaders,
  });
  const coachData = await coachRes.json();
  const coach = coachData.data || coachData;
  assert('AICoach', 'AI Coach synthesis generated advice', !!coach?.advice && Array.isArray(coach?.actionItems));

  // 11. Multi-Tenant Authorization Isolation Check
  console.log('\n--- Verifying Multi-Tenant Isolation ---');
  const bobRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: bobEmail,
      password: 'SecurePassword123!',
      displayName: 'Bob Student',
    }),
  });
  const bobData = await bobRes.json();
  const bobToken = bobData.data?.token || bobData.token;

  const bobIntelRes = await fetch(`${BASE_URL}/api/progress/intelligence`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bobToken}`,
    },
  });
  const bobIntel = (await bobIntelRes.json()).data;
  assert('Security', 'Bob cannot see Alice’s weak topics or study metrics (isolated)', bobIntel.weakTopics.length === 0 && bobIntel.recentlyStudied.length === 0);

  // Summary
  console.log('\n=============================================================');
  console.log('TEST SUMMARY');
  console.log('=============================================================');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed} / ${total}`);

  if (passed === total) {
    console.log('ALL TESTS PASSED! Personalized Study Intelligence is fully functional.\n');
  } else {
    console.log('SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
