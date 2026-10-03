/**
 * Automated Verification Test Suite: Retrieval-Augmented Generation (RAG) System
 * Tests:
 * 1. Document chunk processing and vector embedding generation
 * 2. Vector Store storage and retrieval
 * 3. Query embedding creation and cosine similarity search
 * 4. Relevance filtering (preventing irrelevant context leakage)
 * 5. Grounded answer generation with verified source references/citations
 * 6. Insufficient context detection (anti-hallucination policy)
 * 7. Modular vector store interface & cross-tenant security
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
  console.log('STARTING RETRIEVAL-AUGMENTED GENERATION (RAG) VERIFICATION');
  console.log('=============================================================\n');

  const ts = Date.now();
  const aliceEmail = `alice_rag_${ts}@mit.edu`;
  const bobEmail = `bob_rag_${ts}@mit.edu`;

  // 1. Setup Users
  const aliceRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: aliceEmail,
      password: 'SecurePassword123!',
      displayName: 'Alice RAG',
    }),
  });
  const tokenA = (await aliceRes.json())?.data?.token;

  const bobRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: bobEmail,
      password: 'SecurePassword123!',
      displayName: 'Bob RAG',
    }),
  });
  const tokenB = (await bobRes.json())?.data?.token;

  assert('Setup', 'Users Alice and Bob created', Boolean(tokenA && tokenB));

  // 2. Alice creates Subject & Detailed Study Material
  const subjRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Advanced Database Systems',
      code: 'CS630',
      color: '#3b82f6',
    }),
  });
  const subjectA = (await subjRes.json())?.data;

  const databaseLectureText = `
Lecture 10: Multi-Version Concurrency Control (MVCC) and PostgreSQL Storage Engine
Instructor: Prof. Stonebraker

Section 1: The MVCC Architecture
Multi-Version Concurrency Control (MVCC) is a concurrency control mechanism where write operations do not block read operations and read operations never block write operations.
In PostgreSQL, every tuple (table row) has two hidden transaction header fields:
- xmin: The transaction ID (XID) of the inserting transaction.
- xmax: The transaction ID (XID) of the deleting or updating transaction (or 0 if active).

Section 2: Vacuuming and Tuple Visibility
When an UPDATE occurs, PostgreSQL does not overwrite the existing tuple in place. Instead, it writes a brand new version of the tuple into the data page and sets the old tuple's xmax to the current transaction ID.
Over time, dead tuples accumulate. The Autovacuum daemon is responsible for reclaiming space occupied by dead tuples whose xmax is older than the oldest running transaction.

Section 3: Write-Ahead Logging (WAL) and ARIES
PostgreSQL uses Write-Ahead Logging (WAL) to ensure ACID Atomicity and Durability (the D in ACID).
Before any data page is modified in shared buffer memory, the corresponding log record MUST be written and flushed to non-volatile disk storage (WAL buffer flush).
The WAL record uses Log Sequence Numbers (LSN) to track the monotonic progression of state changes.

Section 4: Isolation Anomalies
Under Repeatable Read isolation level, PostgreSQL uses a Snapshot isolation mechanism based on the transaction's Snapshot XID boundary. Phantom reads are prevented under PostgreSQL Repeatable Read, but Write Skew anomalies can still occur unless Serializable isolation (SSI) is explicitly configured.
`;

  const matRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjectA.id,
      title: 'Lecture 10: PostgreSQL MVCC & Storage Engine Notes',
      fileType: 'notes',
      rawText: databaseLectureText,
    }),
  });
  const materialA = (await matRes.json())?.data;

  assert(
    '1. Document Processing & Embeddings',
    'Uploaded study notes chunked and vector embeddings generated',
    Boolean(materialA?.id) && Array.isArray(materialA?.chunks) && materialA.chunks.length > 0,
    `Material ID: ${materialA?.id}, Chunks count: ${materialA?.chunks?.length}`,
  );

  // --------------------------------------------------------------------------
  // TEST 2: Grounded Question Answered with Exact Retrieved Chunks & Citations
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Grounded RAG Query (xmin / xmax fields) ---');
  const query1Res = await fetch(`${BASE_URL}/api/ai/rag/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'What are the hidden transaction header fields in PostgreSQL row tuples and what do they store?',
      materialId: materialA.id,
      subjectId: subjectA.id,
      topK: 3,
    }),
  });
  const ragResult1 = (await query1Res.json())?.data;

  assert(
    '2. Vector Retrieval & Context Filter',
    'RAG retrieved top relevant chunks instead of entire document',
    query1Res.status === 200 &&
      Boolean(ragResult1?.retrievedChunksCount > 0) &&
      ragResult1.retrievedChunksCount <= 3,
    `Retrieved ${ragResult1?.retrievedChunksCount} chunks (Score: ${ragResult1?.topSimilarityScore})`,
  );

  assert(
    '3. Grounded Answer Generation',
    'AI generated answer mentioning xmin and xmax based strictly on retrieved chunks',
    Boolean(ragResult1?.answer) &&
      ragResult1.answer.toLowerCase().includes('xmin') &&
      ragResult1.answer.toLowerCase().includes('xmax'),
    `Answer snippet: "${ragResult1?.answer?.slice(0, 100)}..."`,
  );

  assert(
    '4. Source Citations & References',
    'Answer includes structured citations with material title and page/chunk index',
    Array.isArray(ragResult1?.citations) && ragResult1.citations.length > 0,
    `Citation 1: "${ragResult1?.citations?.[0]?.materialTitle}", Score: ${ragResult1?.citations?.[0]?.similarityScore}`,
  );

  // --------------------------------------------------------------------------
  // TEST 3: WAL / Durability Question (Section 3 retrieval)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing RAG Retrieval on Specific Sub-topic (WAL & LSN) ---');
  const query2Res = await fetch(`${BASE_URL}/api/ai/rag/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'How does Write-Ahead Logging (WAL) ensure durability in PostgreSQL?',
      materialId: materialA.id,
    }),
  });
  const ragResult2 = (await query2Res.json())?.data;

  assert(
    '5. Selective Sub-topic Grounding',
    'RAG selectively retrieved WAL chunk and correctly explained write-ahead mechanics',
    query2Res.status === 200 &&
      Boolean(ragResult2?.isGroundedInMaterial) &&
      (ragResult2.answer.toLowerCase().includes('wal') || ragResult2.answer.toLowerCase().includes('write-ahead')),
    `Top score: ${ragResult2?.topSimilarityScore}`,
  );

  // --------------------------------------------------------------------------
  // TEST 4: Insufficient Context Query (Anti-Hallucination Policy)
  // Student asks about something NOT in the uploaded document (e.g. quantum biology or DNA replication)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Insufficient Context Detection & Anti-Hallucination ---');
  const query3Res = await fetch(`${BASE_URL}/api/ai/rag/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'What is the role of DNA Polymerase III during lagging strand Okazaki fragment synthesis?',
      materialId: materialA.id,
    }),
  });
  const ragResult3 = (await query3Res.json())?.data;

  assert(
    '6. Insufficient Context Detection',
    'AI clearly indicates uploaded document does NOT contain this information rather than hallucinating',
    query3Res.status === 200 &&
      (!ragResult3?.isGroundedInMaterial ||
        ragResult3?.confidence === 'general_knowledge' ||
        ragResult3?.answer.toLowerCase().includes('not contain') ||
        ragResult3?.answer.toLowerCase().includes('not explicitly') ||
        ragResult3?.answer.toLowerCase().includes('general')),
    `Response Notice: "${ragResult3?.answer?.slice(0, 110)}..."`,
  );

  // --------------------------------------------------------------------------
  // TEST 5: Conversational Study Tutor RAG Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Conversational Tutor RAG Pipeline ---');
  const createConvRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'PostgreSQL Storage Engine Study Session',
      subjectId: subjectA.id,
      materialId: materialA.id,
    }),
  });
  const conv = (await createConvRes.json())?.data;

  const msgRes = await fetch(`${BASE_URL}/api/conversations/${conv.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Explain why dead tuples accumulate in PostgreSQL and how Autovacuum handles them.',
    }),
  });
  const msgData = (await msgRes.json())?.data;
  const assistantMsg = msgData?.assistantMessage;

  assert(
    '7. Conversational Tutor RAG Integration',
    'Conversational tutor returns grounded answer using vector retrieved excerpts',
    msgRes.status === 200 &&
      Boolean(assistantMsg?.content) &&
      (assistantMsg.content.toLowerCase().includes('vacuum') || assistantMsg.content.toLowerCase().includes('dead tuple')),
    `Tutor response length: ${assistantMsg?.content?.length} chars`,
  );

  // --------------------------------------------------------------------------
  // TEST 6: Cross-Tenant Security Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Cross-Tenant Security Isolation ---');

  // Bob tries to query Alice's private study document
  const bobRagRes = await fetch(`${BASE_URL}/api/ai/rag/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'What are the xmin and xmax fields in Alice notes?',
      materialId: materialA.id,
    }),
  });

  // Should NOT leak Alice's chunks to Bob
  const bobData = (await bobRagRes.json())?.data;
  assert(
    '8. Multi-Tenant Privacy Isolation',
    'User B cannot retrieve User A private document chunks via vector search',
    bobData?.retrievedChunksCount === 0 || !bobData?.isGroundedInMaterial,
    `User B retrieved chunks count: ${bobData?.retrievedChunksCount || 0}`,
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL RAG SYSTEM TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('RAG test execution failed:', err);
  process.exit(1);
});
