import http from 'http';
import app from '../src/server.ts';

const PORT = 3999;

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on http://127.0.0.1:${PORT}`);

  let authToken = '';
  let subjectId = 0;
  let materialId = 0;
  let quizId = 0;
  let flashcardId = 0;
  let studyPlanId = 0;

  async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
    const url = `http://127.0.0.1:${PORT}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${msg}`);
    }
    console.log(`  ✓ ${msg}`);
  }

  try {
    console.log('\n--- 1. Testing Authentication ---');
    // POST /api/auth/signup
    const testEmail = `test_${Date.now()}@university.edu`;
    const signupRes = await request('/api/auth/signup', {
      method: 'POST',
      body: { email: testEmail, password: 'password123', displayName: 'Test Student' },
    });
    assert(signupRes.status === 201, `Signup returned 201 (got ${signupRes.status})`);
    assert(signupRes.data.success === true, 'Signup response has success: true');
    assert(!!signupRes.data.data.token, 'Signup returned JWT token');
    authToken = signupRes.data.data.token;

    // POST /api/auth/login
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'password123' },
    });
    assert(loginRes.status === 200, 'Login returned 200');
    assert(!!loginRes.data.data.token, 'Login returned valid token');

    // GET /api/auth/me
    const meRes = await request('/api/auth/me', { token: authToken });
    assert(meRes.status === 200, 'GET /api/auth/me returned 200');
    assert(meRes.data.data.email === testEmail, 'GET /api/auth/me returned correct email');

    // POST /api/auth/logout
    const logoutRes = await request('/api/auth/logout', { method: 'POST', token: authToken });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returned 200');

    console.log('\n--- 2. Testing Subjects ---');
    // POST /api/subjects
    const createSub = await request('/api/subjects', {
      method: 'POST',
      token: authToken,
      body: { name: 'Distributed Systems', code: 'CS450', color: '#6366f1', description: 'Consensus protocols' },
    });
    assert(createSub.status === 201, 'POST /api/subjects returned 201');
    assert(createSub.data.data.name === 'Distributed Systems', 'Subject name matches');
    subjectId = createSub.data.data.id;

    // GET /api/subjects
    const getSubs = await request('/api/subjects', { token: authToken });
    assert(getSubs.status === 200, 'GET /api/subjects returned 200');
    assert(Array.isArray(getSubs.data.data), 'GET /api/subjects returned array');

    // GET /api/subjects/:id
    const getSub = await request(`/api/subjects/${subjectId}`, { token: authToken });
    assert(getSub.status === 200, 'GET /api/subjects/:id returned 200');

    // PUT /api/subjects/:id
    const updateSub = await request(`/api/subjects/${subjectId}`, {
      method: 'PUT',
      token: authToken,
      body: { description: 'Updated consensus protocols & Raft' },
    });
    assert(updateSub.status === 200, 'PUT /api/subjects/:id returned 200');

    console.log('\n--- 3. Testing Materials ---');
    // POST /api/materials
    const createMat = await request('/api/materials', {
      method: 'POST',
      token: authToken,
      body: {
        subjectId,
        title: 'Raft Consensus Algorithm',
        rawText: 'Raft is a consensus algorithm designed as an alternative to Paxos. It was meant to be more understandable than Paxos by means of separation of logic. Raft decomposes consensus into leader election, log replication, and safety.',
        fileType: 'note',
      },
    });
    assert(createMat.status === 201, 'POST /api/materials returned 201');
    assert(createMat.data.data.title === 'Raft Consensus Algorithm', 'Material title matches');
    materialId = createMat.data.data.id;

    // GET /api/materials
    const getMats = await request('/api/materials', { token: authToken });
    assert(getMats.status === 200, 'GET /api/materials returned 200');

    // GET /api/materials/:id
    const getMat = await request(`/api/materials/${materialId}`, { token: authToken });
    assert(getMat.status === 200, 'GET /api/materials/:id returned 200');

    console.log('\n--- 4. Testing AI Endpoints ---');
    // POST /api/ai/summarize
    const aiSum = await request('/api/ai/summarize', {
      method: 'POST',
      token: authToken,
      body: { materialId },
    });
    assert(aiSum.status === 200, 'POST /api/ai/summarize returned 200');
    assert(!!aiSum.data.data.executiveSummary, 'AI summarize returned executiveSummary');

    // POST /api/ai/explain
    const aiExp = await request('/api/ai/explain', {
      method: 'POST',
      token: authToken,
      body: { topic: 'Byzantine Fault Tolerance', level: 'intermediate' },
    });
    assert(aiExp.status === 200, 'POST /api/ai/explain returned 200');
    assert(!!aiExp.data.data.detailedExplanation, 'AI explain returned detailedExplanation');

    // POST /api/ai/chat
    const aiChat = await request('/api/ai/chat', {
      method: 'POST',
      token: authToken,
      body: { question: 'What is leader election in Raft?', materialId },
    });
    assert(aiChat.status === 200, 'POST /api/ai/chat returned 200');
    assert(!!aiChat.data.data.answer, 'AI chat returned answer');

    // POST /api/ai/generate-quiz
    const aiGenQuiz = await request('/api/ai/generate-quiz', {
      method: 'POST',
      token: authToken,
      body: { materialId, count: 3, difficulty: 'medium' },
    });
    assert(aiGenQuiz.status === 200, 'POST /api/ai/generate-quiz returned 200');

    // POST /api/ai/generate-flashcards
    const aiGenCards = await request('/api/ai/generate-flashcards', {
      method: 'POST',
      token: authToken,
      body: { materialId, count: 4 },
    });
    assert(aiGenCards.status === 200, 'POST /api/ai/generate-flashcards returned 200');

    console.log('\n--- 5. Testing Quizzes ---');
    // POST /api/quizzes/generate
    const genQuiz = await request('/api/quizzes/generate', {
      method: 'POST',
      token: authToken,
      body: { subjectId, materialId, count: 3, difficulty: 'medium' },
    });
    assert(genQuiz.status === 201, 'POST /api/quizzes/generate returned 201');
    quizId = genQuiz.data.data.id;
    const questions = genQuiz.data.data.questions || [];

    // GET /api/quizzes
    const getQuizList = await request(`/api/quizzes?subjectId=${subjectId}`, { token: authToken });
    assert(getQuizList.status === 200, 'GET /api/quizzes returned 200');

    // GET /api/quizzes/:id
    const getQuiz = await request(`/api/quizzes/${quizId}`, { token: authToken });
    assert(getQuiz.status === 200, 'GET /api/quizzes/:id returned 200');

    // POST /api/quizzes/:id/submit
    const userSelections = questions.map((q: any) => ({
      questionId: q.id,
      selectedIndex: 0,
    }));
    const submitQuizRes = await request(`/api/quizzes/${quizId}/submit`, {
      method: 'POST',
      token: authToken,
      body: { userSelections, timeTakenSeconds: 45 },
    });
    assert(submitQuizRes.status === 200, 'POST /api/quizzes/:id/submit returned 200');
    assert(submitQuizRes.data.data.score !== undefined, 'Quiz attempt score returned');

    console.log('\n--- 6. Testing Flashcards ---');
    // POST /api/flashcards
    const createCard = await request('/api/flashcards', {
      method: 'POST',
      token: authToken,
      body: {
        subjectId,
        materialId,
        frontText: 'What are the 3 subproblems of Raft?',
        backText: 'Leader election, log replication, and safety.',
        topicTag: 'Consensus',
      },
    });
    assert(createCard.status === 201, 'POST /api/flashcards returned 201');
    flashcardId = createCard.data.data.id;

    // GET /api/flashcards
    const getCards = await request(`/api/flashcards?subjectId=${subjectId}`, { token: authToken });
    assert(getCards.status === 200, 'GET /api/flashcards returned 200');

    // PUT /api/flashcards/:id
    const updateCard = await request(`/api/flashcards/${flashcardId}`, {
      method: 'PUT',
      token: authToken,
      body: { repetitionBox: 2 },
    });
    assert(updateCard.status === 200, 'PUT /api/flashcards/:id returned 200');

    console.log('\n--- 7. Testing Progress ---');
    // GET /api/progress
    const getProg = await request('/api/progress', { token: authToken });
    assert(getProg.status === 200, 'GET /api/progress returned 200');
    assert(getProg.data.data.totalQuizzesTaken !== undefined, 'Progress has totalQuizzesTaken');

    // GET /api/progress/subjects
    const getSubProg = await request('/api/progress/subjects', { token: authToken });
    assert(getSubProg.status === 200, 'GET /api/progress/subjects returned 200');

    // GET /api/progress/topics
    const getTopProg = await request('/api/progress/topics', { token: authToken });
    assert(getTopProg.status === 200, 'GET /api/progress/topics returned 200');

    console.log('\n--- 8. Testing Study Planner ---');
    // POST /api/study-plan
    const createPlan = await request('/api/study-plan', {
      method: 'POST',
      token: authToken,
      body: {
        subjectId,
        title: 'Distributed Systems Exam Prep',
        targetDate: '2026-10-15',
        dailyGoals: [
          { day: 1, topic: 'Raft Basics', tasks: ['Read paper', 'Review flashcards'], done: false },
          { day: 2, topic: 'Paxos vs Raft', tasks: ['Compare state machine replication'], done: false },
        ],
      },
    });
    assert(createPlan.status === 201, 'POST /api/study-plan returned 201');
    studyPlanId = createPlan.data.data.id;

    // GET /api/study-plan
    const getPlans = await request('/api/study-plan', { token: authToken });
    assert(getPlans.status === 200, 'GET /api/study-plan returned 200');

    // PUT /api/study-plan/:id
    const updatePlan = await request(`/api/study-plan/${studyPlanId}`, {
      method: 'PUT',
      token: authToken,
      body: { title: 'Distributed Systems Mastery Plan' },
    });
    assert(updatePlan.status === 200, 'PUT /api/study-plan/:id returned 200');

    console.log('\n--- 9. Testing Deletions & Resource Authorization ---');
    // DELETE /api/flashcards/:id
    const delCard = await request(`/api/flashcards/${flashcardId}`, { method: 'DELETE', token: authToken });
    assert(delCard.status === 200, 'DELETE /api/flashcards/:id returned 200');

    // DELETE /api/materials/:id
    const delMat = await request(`/api/materials/${materialId}`, { method: 'DELETE', token: authToken });
    assert(delMat.status === 200, 'DELETE /api/materials/:id returned 200');

    // DELETE /api/subjects/:id
    const delSub = await request(`/api/subjects/${subjectId}`, { method: 'DELETE', token: authToken });
    assert(delSub.status === 200, 'DELETE /api/subjects/:id returned 200');

    console.log('\n========================================');
    console.log(' ALL 32 ENDPOINTS TESTED SUCCESSFULLY! ');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
