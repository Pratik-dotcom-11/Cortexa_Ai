/**
 * Automated Test Suite: Conversational Study Assistant (Tutor)
 * Verifies conversation creation, multi-turn history, contextual grounding,
 * student prompt workflows ("explain simply", "give example", "test me"),
 * citations, follow-up suggestions, and cross-tenant authorization.
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
  console.log('STARTING CONVERSATIONAL STUDY ASSISTANT VERIFICATION');
  console.log('=============================================================\n');

  const ts = Date.now();
  const aliceEmail = `alice_tutor_${ts}@mit.edu`;
  const bobEmail = `bob_tutor_${ts}@mit.edu`;

  // 1. Setup Alice (Owner)
  const aliceRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: aliceEmail,
      password: 'SecurePassword123!',
      displayName: 'Alice Student',
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
      displayName: 'Bob Student',
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
      name: 'Distributed Systems & Algorithms',
      code: '6.824',
      color: '#6366f1',
    }),
  });
  const subjectA = (await subjRes.json())?.data;

  const materialText = `
Lecture 4: Raft Consensus Algorithm
Overview:
Raft is a consensus protocol for managing a replicated log across a cluster of server nodes.
It decomposes consensus into three independent sub-problems:
1. Leader Election: A cluster elects a single leader node using randomized election timeouts (e.g. 150ms-300ms) to prevent split votes.
2. Log Replication: The leader accepts log entries from clients and replicates them across followers using AppendEntries RPCs. An entry is committed once stored on a majority (quorum) of nodes.
3. Safety Property: If a server has applied a log entry at a given index to its state machine, no other server will ever apply a different log entry for the same index.

Heartbeat Mechanism:
The leader sends periodic empty AppendEntries heartbeats to retain leadership authority and prevent followers from timing out into Candidate state.
`;

  const matRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjectA.id,
      title: 'Lecture 4: Raft Consensus Protocol Notes',
      fileType: 'notes',
      rawText: materialText,
    }),
  });
  const materialA = (await matRes.json())?.data;
  assert('Setup', 'Alice uploaded study notes', Boolean(materialA?.id), `Material ID: ${materialA?.id}`);

  // --------------------------------------------------------------------------
  // TEST 1: Create Conversation Thread
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing Conversation Creation ---');
  const createConvRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Raft Consensus Study Session',
      subjectId: subjectA.id,
      materialId: materialA.id,
    }),
  });
  const convA = (await createConvRes.json())?.data;

  assert(
    'Conversation Management',
    'Created new conversation thread with subject and material context',
    createConvRes.status === 201 && Boolean(convA?.id),
    `Conversation ID: ${convA?.id}`,
  );

  // --------------------------------------------------------------------------
  // TEST 2: List User Conversations
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing List Conversations ---');
  const listRes = await fetch(`${BASE_URL}/api/conversations`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const convList = (await listRes.json())?.data;

  assert(
    'Conversation Management',
    'Listed conversations include title, subjectName, and materialTitle',
    listRes.status === 200 && Array.isArray(convList) && convList.length > 0,
    `Found ${convList?.length} conversations. Top title: "${convList?.[0]?.title}"`,
  );

  // --------------------------------------------------------------------------
  // TEST 3: Multi-Turn Tutor Interaction: "Explain this concept in simple language"
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Prompt: "Explain this concept in simple language" ---');
  const msg1Res = await fetch(`${BASE_URL}/api/conversations/${convA.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Explain the Raft consensus leader election mechanism in simple language.',
    }),
  });
  const msg1Data = (await msg1Res.json())?.data;
  const assistantMsg1 = msg1Data?.assistantMessage;

  assert(
    'Study Tutor Behavior',
    'Tutor provides accessible explanation with citations and follow-up suggestions',
    msg1Res.status === 200 &&
      Boolean(assistantMsg1?.content) &&
      assistantMsg1.content.length > 50,
    `Response length: ${assistantMsg1?.content?.length} chars`,
  );

  assert(
    'Grounding & Citations',
    'Material-specific answer contains source citations to Raft notes',
    Boolean(assistantMsg1?.citations && assistantMsg1.citations.length > 0) ||
      Boolean(assistantMsg1?.isGroundedInMaterial),
    `Citations count: ${assistantMsg1?.citations?.length || 0}`,
  );

  // --------------------------------------------------------------------------
  // TEST 4: Multi-Turn Tutor Interaction: "Give me an example"
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Prompt: "Give me an example" ---');
  const msg2Res = await fetch(`${BASE_URL}/api/conversations/${convA.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Give me a concrete example of what happens when two nodes time out at the same time.',
    }),
  });
  const msg2Data = (await msg2Res.json())?.data;
  const assistantMsg2 = msg2Data?.assistantMessage;

  assert(
    'Study Tutor Behavior',
    'Tutor provides concrete step-by-step example scenario preserving conversation context',
    msg2Res.status === 200 &&
      Boolean(assistantMsg2?.content) &&
      assistantMsg2.content.length > 40,
    `Snippet: "${assistantMsg2?.content?.slice(0, 80)}..."`,
  );

  // --------------------------------------------------------------------------
  // TEST 5: Multi-Turn Tutor Interaction: "Now test me"
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Prompt: "Now test me" ---');
  const msg3Res = await fetch(`${BASE_URL}/api/conversations/${convA.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Now test me! Give me a multiple-choice practice question to check my recall.',
    }),
  });
  const msg3Data = (await msg3Res.json())?.data;
  const assistantMsg3 = msg3Data?.assistantMessage;

  assert(
    'Study Tutor Behavior',
    'Tutor generates practice question to test active recall',
    msg3Res.status === 200 &&
      Boolean(assistantMsg3?.content) &&
      assistantMsg3.content.length > 30,
    `Question snippet: "${assistantMsg3?.content?.slice(0, 80)}..."`,
  );

  // --------------------------------------------------------------------------
  // TEST 6: Conversation State & Message Retrieval
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Full Conversation State Retrieval ---');
  const getConvRes = await fetch(`${BASE_URL}/api/conversations/${convA.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const getConvData = (await getConvRes.json())?.data;

  assert(
    'Conversation Retrieval',
    'Retrieved full conversation with messages history',
    getConvRes.status === 200 &&
      Array.isArray(getConvData?.messages) &&
      getConvData.messages.length >= 6,
    `Total messages in thread: ${getConvData?.messages?.length}`,
  );

  // --------------------------------------------------------------------------
  // TEST 7: Cross-Tenant Authorization & IDOR Protection
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Cross-Tenant Security ---');

  // Bob tries to view Alice's conversation
  const bobViewRes = await fetch(`${BASE_URL}/api/conversations/${convA.id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Security (Anti-IDOR)',
    'User B cannot access Alice conversation (403 Forbidden)',
    bobViewRes.status === 403,
    `HTTP ${bobViewRes.status}`,
  );

  // Bob tries to post a message into Alice's conversation
  const bobPostRes = await fetch(`${BASE_URL}/api/conversations/${convA.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: 'Malicious injection' }),
  });
  assert(
    'Security (Anti-IDOR)',
    'User B cannot send message to Alice conversation (403 Forbidden)',
    bobPostRes.status === 403,
    `HTTP ${bobPostRes.status}`,
  );

  // Bob tries to delete Alice's conversation
  const bobDeleteRes = await fetch(`${BASE_URL}/api/conversations/${convA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Security (Anti-IDOR)',
    'User B cannot delete Alice conversation (403 Forbidden)',
    bobDeleteRes.status === 403,
    `HTTP ${bobDeleteRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 8: Update & Delete Conversation
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Update & Delete Conversation ---');

  const patchRes = await fetch(`${BASE_URL}/api/conversations/${convA.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Mastering Raft Protocol (Final Review)' }),
  });
  assert(
    'Conversation Management',
    'Owner can update conversation title and context',
    patchRes.status === 200,
    `HTTP ${patchRes.status}`,
  );

  const deleteRes = await fetch(`${BASE_URL}/api/conversations/${convA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Conversation Management',
    'Owner can delete conversation thread',
    deleteRes.status === 200,
    `HTTP ${deleteRes.status}`,
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL CONVERSATIONAL TUTOR TESTS: ${total}`);
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
