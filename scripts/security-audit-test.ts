/**
 * Comprehensive Security & Authorization Test Suite for StudyAI
 * Tests:
 * 1. Secure Signup & Validation (password length, duplicate emails)
 * 2. Secure Login & Invalid Credentials Rejection
 * 3. Secret Protection (Password hashes never leaked)
 * 4. Token Cryptographic Verification & Rejection of Forged/Unsigned Tokens
 * 5. Logout & Token Revocation
 * 6. Cross-Tenant IDOR & Unauthorized Access on:
 *    - Subjects (GET, PUT, DELETE)
 *    - Materials (GET, DELETE)
 *    - Quizzes (GET, SUBMIT, DELETE)
 *    - Flashcards (PUT, DELETE)
 *    - Study Plans (GET, PUT, DELETE)
 *    - Progress / Study Sessions
 *    - Cross-linking (User B referencing User A's subject or material)
 * 7. SQL Injection Immunity
 * 8. XSS Sanitization
 * 9. Security Headers & Payload Controls
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
  console.log('STARTING CRITICAL SECURITY & AUTHORIZATION AUDIT TESTS');
  console.log('=============================================================\n');

  const timestamp = Date.now();
  const userAEmail = `victim_${timestamp}@test.edu`;
  const userBEmail = `attacker_${timestamp}@test.edu`;
  const testPassword = 'StrongPassword123!';

  // --------------------------------------------------------------------------
  // TEST 1: Password Validation on Signup
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Signup Validation & Password Rules ---');
  const shortPassRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `short_${timestamp}@test.edu`, password: 'short' }),
  });
  assert(
    'Signup Validation',
    'Reject short password (<8 characters)',
    shortPassRes.status === 400,
    `HTTP ${shortPassRes.status}`,
  );

  const invalidEmailRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: testPassword }),
  });
  assert(
    'Signup Validation',
    'Reject invalid email format',
    invalidEmailRes.status === 400,
    `HTTP ${invalidEmailRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 2: Signup User A & User B
  // --------------------------------------------------------------------------
  const signupARes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userAEmail,
      password: testPassword,
      displayName: 'Alice Student',
      university: 'State University',
      major: 'Computer Science',
    }),
  });
  const signupAData = await signupARes.json();
  const tokenA = signupAData?.data?.token;
  const userA = signupAData?.data?.user;

  assert(
    'Signup',
    'User A successfully signed up',
    signupARes.status === 201 && !!tokenA,
    `Status ${signupARes.status}`,
  );

  // Duplicate email registration must be rejected
  const dupARes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userAEmail,
      password: testPassword,
      displayName: 'Alice Duplicate',
    }),
  });
  assert(
    'Signup',
    'Reject duplicate email registration',
    dupARes.status === 400,
    `Status ${dupARes.status}`,
  );

  // Signup User B (Attacker)
  const signupBRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userBEmail,
      password: testPassword,
      displayName: 'Bob Attacker',
      university: 'State University',
      major: 'Cybersecurity',
    }),
  });
  const signupBData = await signupBRes.json();
  const tokenB = signupBData?.data?.token;
  const userB = signupBData?.data?.user;

  assert(
    'Signup',
    'User B successfully signed up',
    signupBRes.status === 201 && !!tokenB,
    `Status ${signupBRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 3: Secret Protection
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Secret Exposure Protection ---');
  assert(
    'Secret Protection',
    'Password hash is NOT exposed in signup response',
    userA.passwordHash === undefined && signupAData.passwordHash === undefined,
  );

  const meARes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const meAData = await meARes.json();
  assert(
    'Secret Protection',
    'Password hash is NOT exposed in /api/auth/me',
    meAData?.data?.passwordHash === undefined,
  );

  // --------------------------------------------------------------------------
  // TEST 4: Secure Login & Timing Attack Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Login Authentication ---');
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userAEmail, password: 'WrongPassword123!' }),
  });
  assert(
    'Login',
    'Reject incorrect password with 401',
    wrongPassRes.status === 401,
    `Status ${wrongPassRes.status}`,
  );

  const nonexistentUserRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `nonexistent_${timestamp}@test.edu`, password: testPassword }),
  });
  assert(
    'Login',
    'Reject non-existent user with 401 without enumeration',
    nonexistentUserRes.status === 401,
    `Status ${nonexistentUserRes.status}`,
  );

  const validLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userAEmail, password: testPassword }),
  });
  assert(
    'Login',
    'Successful login with valid credentials',
    validLoginRes.status === 200,
    `Status ${validLoginRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 5: Unsigned and Forged Token Rejection (Authorization Bypass Prevention)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Token Forgery & Bypass Protection ---');
  const unsignedBypassRes = await fetch(`${BASE_URL}/api/subjects`, {
    headers: { Authorization: `Bearer demo-student-token-${userA.uid}` },
  });
  assert(
    'Token Security',
    'Reject unsigned pseudo-token bypass attempt with 401',
    unsignedBypassRes.status === 401,
    `Status ${unsignedBypassRes.status}`,
  );

  const forgedJwtRes = await fetch(`${BASE_URL}/api/subjects`, {
    headers: { Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiJmYWtlIn0.invalidsignature` },
  });
  assert(
    'Token Security',
    'Reject forged signature JWT with 401',
    forgedJwtRes.status === 401,
    `Status ${forgedJwtRes.status}`,
  );

  const missingTokenRes = await fetch(`${BASE_URL}/api/subjects`);
  assert(
    'Protected Routes',
    'Reject missing Authorization header with 401',
    missingTokenRes.status === 401,
    `Status ${missingTokenRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 6: User A Creates Resources
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Provisioning User A Resources for Cross-Tenant Testing ---');
  // 6a. Subject
  const createSubjRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Computer Networks CS455',
      code: 'CS455',
      color: '#4f46e5',
      description: 'Private student network notes',
    }),
  });
  const subjA = (await createSubjRes.json())?.data;
  assert('Resource Setup', 'User A creates private subject', !!subjA?.id, `Subject ID: ${subjA?.id}`);

  // 6b. Material
  const createMatRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjA.id,
      title: 'TCP Flow Control & Congestion Notes',
      rawText: 'TCP uses sliding windows and AIMD congestion control to prevent buffer overflows.',
      fileType: 'note',
    }),
  });
  const matA = (await createMatRes.json())?.data;
  assert('Resource Setup', 'User A creates private material', !!matA?.id, `Material ID: ${matA?.id}`);

  // 6c. Quiz
  const createQuizRes = await fetch(`${BASE_URL}/api/quizzes/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjA.id,
      materialId: matA.id,
      count: 2,
      difficulty: 'medium',
    }),
  });
  const quizA = (await createQuizRes.json())?.data;
  assert('Resource Setup', 'User A creates private quiz', !!quizA?.id, `Quiz ID: ${quizA?.id}`);

  // 6d. Flashcard
  const createCardRes = await fetch(`${BASE_URL}/api/flashcards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjA.id,
      materialId: matA.id,
      frontText: 'What is AIMD in TCP?',
      backText: 'Additive Increase Multiplicative Decrease',
      topicTag: 'Congestion',
    }),
  });
  const cardA = (await createCardRes.json())?.data;
  assert('Resource Setup', 'User A creates private flashcard', !!cardA?.id, `Flashcard ID: ${cardA?.id}`);

  // 6e. Study Plan
  const createPlanRes = await fetch(`${BASE_URL}/api/study-plan`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjA.id,
      title: 'Midterm Exam Cram Plan',
      targetDate: '2026-11-01',
    }),
  });
  const planA = (await createPlanRes.json())?.data;
  assert('Resource Setup', 'User A creates private study plan', !!planA?.id, `Plan ID: ${planA?.id}`);

  // --------------------------------------------------------------------------
  // TEST 7: SECURITY TESTS - User B Attempts Unauthorized Access (IDOR)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. EXECUTING SECURITY TESTS: Unauthorized Cross-Tenant Access ---');

  // 7a. Access User A's Subject
  const userBGetSubj = await fetch(`${BASE_URL}/api/subjects/${subjA.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot GET User A subject',
    userBGetSubj.status === 403,
    `HTTP ${userBGetSubj.status} (Forbidden)`,
  );

  const userBUpdateSubj = await fetch(`${BASE_URL}/api/subjects/${subjA.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Hacked Subject Name' }),
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot UPDATE User A subject',
    userBUpdateSubj.status === 403,
    `HTTP ${userBUpdateSubj.status} (Forbidden)`,
  );

  const userBDeleteSubj = await fetch(`${BASE_URL}/api/subjects/${subjA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot DELETE User A subject',
    userBDeleteSubj.status === 403,
    `HTTP ${userBDeleteSubj.status} (Forbidden)`,
  );

  // 7b. Access User A's Material
  const userBGetMat = await fetch(`${BASE_URL}/api/materials/${matA.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot GET User A study material',
    userBGetMat.status === 403,
    `HTTP ${userBGetMat.status} (Forbidden)`,
  );

  const userBDeleteMat = await fetch(`${BASE_URL}/api/materials/${matA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot DELETE User A study material',
    userBDeleteMat.status === 403,
    `HTTP ${userBDeleteMat.status} (Forbidden)`,
  );

  // 7c. Access User A's Quiz
  const userBGetQuiz = await fetch(`${BASE_URL}/api/quizzes/${quizA.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot GET User A quiz',
    userBGetQuiz.status === 403,
    `HTTP ${userBGetQuiz.status} (Forbidden)`,
  );

  const userBSubmitQuiz = await fetch(`${BASE_URL}/api/quizzes/${quizA.id}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userSelections: [] }),
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot SUBMIT to User A quiz',
    userBSubmitQuiz.status === 403,
    `HTTP ${userBSubmitQuiz.status} (Forbidden)`,
  );

  const userBDeleteQuiz = await fetch(`${BASE_URL}/api/quizzes/${quizA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot DELETE User A quiz',
    userBDeleteQuiz.status === 403,
    `HTTP ${userBDeleteQuiz.status} (Forbidden)`,
  );

  // 7d. Access User A's Flashcard
  const userBUpdateCard = await fetch(`${BASE_URL}/api/flashcards/${cardA.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ frontText: 'Tampered Card' }),
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot UPDATE User A flashcard',
    userBUpdateCard.status === 403,
    `HTTP ${userBUpdateCard.status} (Forbidden)`,
  );

  const userBDeleteCard = await fetch(`${BASE_URL}/api/flashcards/${cardA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot DELETE User A flashcard',
    userBDeleteCard.status === 403,
    `HTTP ${userBDeleteCard.status} (Forbidden)`,
  );

  // 7e. Access User A's Study Plan
  const userBGetPlan = await fetch(`${BASE_URL}/api/study-plan/${planA.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot GET User A study plan',
    userBGetPlan.status === 403,
    `HTTP ${userBGetPlan.status} (Forbidden)`,
  );

  const userBUpdatePlan = await fetch(`${BASE_URL}/api/study-plan/${planA.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Hacked Study Plan' }),
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot UPDATE User A study plan',
    userBUpdatePlan.status === 403,
    `HTTP ${userBUpdatePlan.status} (Forbidden)`,
  );

  const userBDeletePlan = await fetch(`${BASE_URL}/api/study-plan/${planA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Authorization (IDOR)',
    'User B cannot DELETE User A study plan',
    userBDeletePlan.status === 403,
    `HTTP ${userBDeletePlan.status} (Forbidden)`,
  );

  // 7f. Cross-linking attack: User B creates material/card/session referencing User A's subject
  const userBCrossMat = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjA.id,
      title: 'Malicious Injected Note',
      rawText: 'Attacker payload',
    }),
  });
  assert(
    'Cross-Linking Authorization',
    'User B cannot create material attached to User A subject',
    userBCrossMat.status === 403,
    `HTTP ${userBCrossMat.status}`,
  );

  const userBCrossSession = await fetch(`${BASE_URL}/api/progress/session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjA.id,
      activityType: 'study',
      durationMinutes: 60,
    }),
  });
  assert(
    'Cross-Linking Authorization',
    'User B cannot record study session attached to User A subject',
    userBCrossSession.status === 403,
    `HTTP ${userBCrossSession.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 8: Logout and Token Revocation
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Logout & Token Revocation ---');
  const logoutARes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert('Logout', 'User A logout returns success 200', logoutARes.status === 200, `HTTP ${logoutARes.status}`);

  // Immediate reuse of revoked token must be rejected with 401
  const reuseTokenARes = await fetch(`${BASE_URL}/api/subjects`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Token Revocation',
    'Revoked token immediately rejected with 401 on subsequent requests',
    reuseTokenARes.status === 401,
    `HTTP ${reuseTokenARes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 9: SQL Injection Immunity
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing SQL Injection Immunity ---');
  const sqliRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: "CS101'; DROP TABLE users; --",
      code: "CS101' OR '1'='1",
      color: '#4f46e5',
    }),
  });
  const sqliData = await sqliRes.json();
  assert(
    'SQL Injection',
    'SQL injection characters are treated as literal text, no SQL error',
    sqliRes.status === 201 && typeof sqliData?.data?.id === 'number',
    `Created ID ${sqliData?.data?.id}`,
  );

  // Verify users table was not dropped
  const verifyUsersRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'SQL Injection',
    'Database integrity maintained (users table intact)',
    verifyUsersRes.status === 200,
  );

  // --------------------------------------------------------------------------
  // TEST 10: XSS Sanitization
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Testing XSS Input Sanitization ---');
  const xssRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Safe Name <script>alert("XSS")</script>',
      code: '<b>CS</b>',
      color: '#4f46e5',
    }),
  });
  const xssData = await xssRes.json();
  const createdSubject = xssData?.data;
  assert(
    'XSS Prevention',
    'HTML angle brackets stripped from stored subject name',
    createdSubject?.name !== undefined && !createdSubject.name.includes('<') && !createdSubject.name.includes('>'),
    `Stored name: "${createdSubject?.name}", code: "${createdSubject?.code}"`,
  );

  // --------------------------------------------------------------------------
  // TEST 11: Security Headers
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Testing HTTP Security Headers ---');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const nosniff = healthRes.headers.get('x-content-type-options');
  const frameOptions = healthRes.headers.get('x-frame-options');
  const xPoweredBy = healthRes.headers.get('x-powered-by');

  assert('Security Headers', 'X-Content-Type-Options: nosniff present', nosniff === 'nosniff');
  assert('Security Headers', 'X-Frame-Options: SAMEORIGIN present', frameOptions === 'SAMEORIGIN');
  assert('Security Headers', 'X-Powered-By is hidden/removed', xPoweredBy === null);

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL SECURITY TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Security test runner error:', err);
  process.exit(1);
});
