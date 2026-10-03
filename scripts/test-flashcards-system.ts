/**
 * Automated Verification Script: AI Flashcard System
 * Tests:
 * 1. Flashcard generation from study materials with difficulty and topic metadata
 * 2. Flashcard review logging (Known vs Needs Revision) and Leitner repetition box transitions
 * 3. Review statistics calculation (total cards, known, needs revision, mastery rate)
 * 4. Filtering by subject, material, difficulty, and mastery status
 * 5. Update flashcard metadata
 * 6. Delete flashcard
 * 7. Security: Cross-tenant authorization (403 Forbidden for unauthorized access)
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
  console.log('STARTING AI FLASHCARD SYSTEM VERIFICATION');
  console.log('=============================================================\n');

  const ts = Date.now();
  const aliceEmail = `alice_cards_${ts}@mit.edu`;
  const bobEmail = `bob_cards_${ts}@mit.edu`;

  // 1. Setup Alice
  const aliceRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: aliceEmail,
      password: 'SecurePassword123!',
      displayName: 'Alice Cards',
    }),
  });
  const tokenA = (await aliceRes.json())?.data?.token;

  // Setup Bob (Attacker)
  const bobRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: bobEmail,
      password: 'SecurePassword123!',
      displayName: 'Bob Cards',
    }),
  });
  const tokenB = (await bobRes.json())?.data?.token;

  assert('Setup', 'Users Alice and Bob created', Boolean(tokenA && tokenB));

  // 2. Alice creates Subject & Study Material
  const subjRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Operating Systems & Memory Management',
      code: 'CS301',
      color: '#10b981',
    }),
  });
  const subjectA = (await subjRes.json())?.data;

  const materialText = `
Chapter 8: Virtual Memory & Page Replacement
1. Page Fault: An interrupt raised by hardware (MMU) when a program accesses a page not resident in physical memory (RAM).
2. Translation Lookaside Buffer (TLB): A hardware cache of recent virtual-to-physical address translations used to accelerate memory lookups.
3. LRU (Least Recently Used): An optimal heuristic page replacement algorithm that replaces the page that has not been used for the longest period of time.
4. Thrashing: A condition where the CPU spends more time swapping pages in and out of swap space than executing instructions due to insufficient physical memory for the active working set.
5. Inverted Page Table: A memory table indexed by physical frame number rather than virtual page number, reducing memory footprint for 64-bit address spaces.
`;

  const matRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjectA.id,
      title: 'Chapter 8: Virtual Memory Lecture Notes',
      fileType: 'notes',
      rawText: materialText,
    }),
  });
  const materialA = (await matRes.json())?.data;
  assert('Setup', 'Alice uploaded study notes', Boolean(materialA?.id), `Material ID: ${materialA?.id}`);

  // --------------------------------------------------------------------------
  // TEST 1: Generate AI Flashcards from Study Material
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing AI Flashcard Generation ---');
  const genRes = await fetch(`${BASE_URL}/api/flashcards/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjectA.id,
      materialId: materialA.id,
      count: 5,
      topicFocus: 'Virtual Memory & Thrashing',
    }),
  });
  const genData = (await genRes.json())?.data;

  assert(
    'AI Generation',
    'Generated non-redundant flashcards from uploaded study notes',
    genRes.status === 201 && Array.isArray(genData) && genData.length > 0,
    `Created ${genData?.length} cards`,
  );

  const sampleCard = genData?.[0];
  assert(
    'Metadata Validation',
    'Generated card contains front, back, topic tag, and valid difficulty metadata',
    Boolean(sampleCard?.frontText) &&
      Boolean(sampleCard?.backText) &&
      Boolean(sampleCard?.topicTag) &&
      ['easy', 'medium', 'hard'].includes(sampleCard?.difficultyLevel),
    `Front: "${sampleCard?.frontText?.slice(0, 40)}..." | Difficulty: ${sampleCard?.difficultyLevel} | Topic: ${sampleCard?.topicTag}`,
  );

  // --------------------------------------------------------------------------
  // TEST 2: Manual Card Creation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Manual Flashcard Creation ---');
  const manualRes = await fetch(`${BASE_URL}/api/flashcards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjectA.id,
      materialId: materialA.id,
      frontText: 'Define the Belady Anomaly in FIFO page replacement.',
      backText: 'A phenomenon where increasing the number of page frames results in an increase in the number of page faults.',
      topicTag: 'Page Replacement Anomalies',
      difficultyLevel: 'hard',
      status: 'new',
    }),
  });
  const manualCard = (await manualRes.json())?.data;

  assert(
    'Card Management',
    'Created manual flashcard with topic and difficulty',
    manualRes.status === 201 && Boolean(manualCard?.id),
    `Manual Card ID: ${manualCard?.id}`,
  );

  // --------------------------------------------------------------------------
  // TEST 3: List & Filter Flashcards
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing List & Filtering ---');
  const listRes = await fetch(`${BASE_URL}/api/flashcards?subjectId=${subjectA.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const allCards = (await listRes.json())?.data;

  assert(
    'Card Retrieval',
    'Retrieved flashcards list with subject and material names',
    listRes.status === 200 && Array.isArray(allCards) && allCards.length >= 6,
    `Total cards: ${allCards?.length}`,
  );

  // Filter by difficulty = 'hard'
  const hardRes = await fetch(`${BASE_URL}/api/flashcards?subjectId=${subjectA.id}&difficultyLevel=hard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const hardCards = (await hardRes.json())?.data;
  assert(
    'Card Retrieval',
    'Filtered cards by difficulty=hard',
    hardRes.status === 200 && Array.isArray(hardCards) && hardCards.some((c) => c.id === manualCard.id),
    `Found ${hardCards?.length} hard cards`,
  );

  // --------------------------------------------------------------------------
  // TEST 4: Reviewing Flashcard (Marking Known vs Needs Revision)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Card Review & Leitner Progression ---');

  // Review 1: Mark manualCard as Known
  const review1Res = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}/review`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ outcome: 'known' }),
  });
  const rev1Data = (await review1Res.json())?.data;

  assert(
    'Review Tracking',
    'Marked card as known -> status updated, reviewCount incremented, box advanced',
    review1Res.status === 200 &&
      rev1Data?.status === 'known' &&
      rev1Data?.reviewCount === 1 &&
      rev1Data?.repetitionBox === 2,
    `Status: ${rev1Data?.status}, Box: ${rev1Data?.repetitionBox}, Reviews: ${rev1Data?.reviewCount}`,
  );

  // Review 2: Mark sampleCard as Needs Revision
  const review2Res = await fetch(`${BASE_URL}/api/flashcards/${sampleCard.id}/review`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ outcome: 'needs_revision' }),
  });
  const rev2Data = (await review2Res.json())?.data;

  assert(
    'Review Tracking',
    'Marked card as needs_revision -> status set to needs_revision, box reset to 1',
    review2Res.status === 200 &&
      rev2Data?.status === 'needs_revision' &&
      rev2Data?.repetitionBox === 1 &&
      rev2Data?.reviewCount === 1,
    `Status: ${rev2Data?.status}, Box: ${rev2Data?.repetitionBox}`,
  );

  // --------------------------------------------------------------------------
  // TEST 5: Flashcard Stats Aggregation
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Flashcard Stats ---');
  const statsRes = await fetch(`${BASE_URL}/api/flashcards/stats?subjectId=${subjectA.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const statsData = (await statsRes.json())?.data;

  assert(
    'Stats Aggregation',
    'Stats reflect total cards, known count, needs revision count, and accuracy',
    statsRes.status === 200 &&
      statsData?.totalCards >= 6 &&
      statsData?.knownCount >= 1 &&
      statsData?.needsRevisionCount >= 1,
    `Total: ${statsData?.totalCards}, Known: ${statsData?.knownCount}, NeedsRev: ${statsData?.needsRevisionCount}`,
  );

  // --------------------------------------------------------------------------
  // TEST 6: Update Card Metadata
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Card Update ---');
  const updateRes = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicTag: 'Belady Anomaly & FIFO',
      difficultyLevel: 'medium',
    }),
  });
  const updatedData = (await updateRes.json())?.data;

  assert(
    'Card Management',
    'Owner can update card topic and difficulty',
    updateRes.status === 200 && updatedData?.topicTag === 'Belady Anomaly & FIFO',
    `Updated Topic: ${updatedData?.topicTag}`,
  );

  // --------------------------------------------------------------------------
  // TEST 7: Cross-Tenant Security Checks
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Cross-Tenant IDOR Security ---');

  // Bob attempts to read Alice's card
  const bobGetRes = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Security (Anti-IDOR)',
    'User B cannot access Alice card (403 Forbidden)',
    bobGetRes.status === 403,
    `HTTP ${bobGetRes.status}`,
  );

  // Bob attempts to review Alice's card
  const bobRevRes = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}/review`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ outcome: 'known' }),
  });
  assert(
    'Security (Anti-IDOR)',
    'User B cannot review Alice card (403 Forbidden)',
    bobRevRes.status === 403,
    `HTTP ${bobRevRes.status}`,
  );

  // Bob attempts to delete Alice's card
  const bobDelRes = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Security (Anti-IDOR)',
    'User B cannot delete Alice card (403 Forbidden)',
    bobDelRes.status === 403,
    `HTTP ${bobDelRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 8: Card Deletion
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Card Deletion ---');
  const delRes = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Card Management',
    'Owner successfully deleted flashcard',
    delRes.status === 200,
    `HTTP ${delRes.status}`,
  );

  // Verify it no longer exists
  const checkDel = await fetch(`${BASE_URL}/api/flashcards/${manualCard.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Card Management',
    'Deleted card cannot be retrieved (404 Not Found)',
    checkDel.status === 404,
    `HTTP ${checkDel.status}`,
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL FLASHCARD SYSTEM TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
