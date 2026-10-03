/**
 * Complete Study Material Upload Pipeline Test Suite
 * Tests every stage:
 * 1. Upload & Validation (type restriction, size limits, magic bytes)
 * 2. Safe storage & filename sanitization
 * 3. Text extraction & cleaning
 * 4. Semantic chunking
 * 5. Corrupted PDF graceful handling
 * 6. Empty PDF graceful handling
 * 7. Subject & User ownership authorization
 * 8. Private file download authorization (Anti-IDOR)
 * 9. AI availability & deletion cleanup
 */

import fs from 'node:fs';
import path from 'node:path';

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

// Generate valid minimal PDF with specific text content
function createTestPdf(textContent: string): Buffer {
  const streamData = `BT /F1 12 Tf 72 712 Td (${textContent.replace(/[()\\]/g, '')}) Tj ET`;
  const streamLength = Buffer.byteLength(streamData);

  const pdfString = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> >> endobj
4 0 obj <</Length ${streamLength}>> stream
${streamData}
endstream
endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000236 00000 n 
0000000330 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
407
%%EOF`;

  return Buffer.from(pdfString);
}

// Empty PDF (page with 0 text content)
function createEmptyPdf(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>>>> >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
trailer <</Size 4 /Root 1 0 R>>
startxref
190
%%EOF`;
  return Buffer.from(pdfString);
}

async function run() {
  console.log('\n=============================================================');
  console.log('STARTING STUDY MATERIAL UPLOAD PIPELINE VERIFICATION');
  console.log('=============================================================\n');

  const timestamp = Date.now();
  const userAEmail = `student_${timestamp}@university.edu`;
  const userBEmail = `attacker_${timestamp}@university.edu`;

  // 1. Authenticate User A & User B
  const userARes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userAEmail,
      password: 'SecurePassword123!',
      displayName: 'Alice Student',
    }),
  });
  const userAData = await userARes.json();
  const tokenA = userAData?.data?.token;

  const userBRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userBEmail,
      password: 'SecurePassword123!',
      displayName: 'Bob Attacker',
    }),
  });
  const userBData = await userBRes.json();
  const tokenB = userBData?.data?.token;

  assert('Setup', 'Users Alice and Bob created', !!tokenA && !!tokenB);

  // 2. Create Course/Subject for Alice
  const subjRes = await fetch(`${BASE_URL}/api/subjects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Distributed Systems CS670',
      code: 'CS670',
      color: '#6366f1',
    }),
  });
  const subjectA = (await subjRes.json())?.data;
  assert('Setup', 'Alice created target subject', !!subjectA?.id, `Subject ID: ${subjectA?.id}`);

  // --------------------------------------------------------------------------
  // TEST 1: Reject Non-PDF File Types
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Testing File Type Restrictions ---');
  const txtFormData = new FormData();
  txtFormData.append(
    'file',
    new Blob(['This is a plain text file, not a PDF'], { type: 'text/plain' }),
    'notes.txt',
  );
  txtFormData.append('subjectId', String(subjectA.id));

  const txtRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: txtFormData,
  });
  assert(
    'Type Validation',
    'Reject non-PDF file extension (.txt)',
    txtRes.status === 400,
    `HTTP ${txtRes.status}`,
  );

  // Fake PDF: Named .pdf but without %PDF- magic bytes
  const fakePdfFormData = new FormData();
  fakePdfFormData.append(
    'file',
    new Blob(['GIF89a Fake Image Content disguised as PDF file'], {
      type: 'application/pdf',
    }),
    'fake.pdf',
  );
  fakePdfFormData.append('subjectId', String(subjectA.id));

  const fakePdfRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: fakePdfFormData,
  });
  assert(
    'Magic Byte Validation',
    'Reject file missing %PDF- magic bytes signature',
    fakePdfRes.status === 400,
    `HTTP ${fakePdfRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 2: File Size Restrictions
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing File Size Restrictions ---');
  // Under minimum (tiny 10 bytes)
  const tinyFormData = new FormData();
  tinyFormData.append('file', new Blob(['%PDF-1.4\n'], { type: 'application/pdf' }), 'tiny.pdf');
  tinyFormData.append('subjectId', String(subjectA.id));

  const tinyRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: tinyFormData,
  });
  assert(
    'Size Validation',
    'Reject file below minimum size threshold (<50 bytes)',
    tinyRes.status === 400,
    `HTTP ${tinyRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 3: Corrupted PDF Handling (Graceful 400, no server crash)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Corrupted PDF Handling ---');
  const corruptedBuffer = Buffer.from(
    '%PDF-1.4\n<< /Malformed /Broken /Corrupted << stream corrupted non-pdf binary trailer garbage endstream',
  );
  const corruptFormData = new FormData();
  corruptFormData.append(
    'file',
    new Blob([new Uint8Array(corruptedBuffer)], { type: 'application/pdf' }),
    'corrupted_lecture.pdf',
  );
  corruptFormData.append('subjectId', String(subjectA.id));

  const corruptRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: corruptFormData,
  });
  const corruptData = await corruptRes.json();
  assert(
    'Error Handling',
    'Corrupted PDF returns graceful HTTP 400 (not 500)',
    corruptRes.status === 400,
    `Status ${corruptRes.status}: ${corruptData?.message || corruptData?.error}`,
  );

  // --------------------------------------------------------------------------
  // TEST 4: Empty PDF Handling (No extractable text)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Empty PDF Handling ---');
  const emptyPdfBuffer = createEmptyPdf();
  const emptyFormData = new FormData();
  emptyFormData.append(
    'file',
    new Blob([new Uint8Array(emptyPdfBuffer)], { type: 'application/pdf' }),
    'empty_scanned.pdf',
  );
  emptyFormData.append('subjectId', String(subjectA.id));

  const emptyRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: emptyFormData,
  });
  const emptyData = await emptyRes.json();
  const errMsg = emptyData?.message || emptyData?.error || '';
  assert(
    'Error Handling',
    'Empty or unextractable PDF returns graceful HTTP 400',
    emptyRes.status === 400 && (errMsg.toLowerCase().includes('text') || errMsg.toLowerCase().includes('empty')),
    `Status ${emptyRes.status}: ${errMsg}`,
  );

  // --------------------------------------------------------------------------
  // TEST 5: Valid PDF Upload & Full Pipeline Execution
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Valid PDF Upload & Pipeline Execution ---');
  const lectureText =
    'Raft Consensus Protocol and Fault Tolerance in Distributed Key Value Stores. Raft elects a leader using randomized election timeouts. Leaders handle log replication across follower nodes and ensure state machine safety.';
  const validPdfBuffer = createTestPdf(lectureText);

  // Test unsafe filename with path traversal characters: ../../../etc/malicious.pdf
  const validFormData = new FormData();
  validFormData.append(
    'file',
    new Blob([new Uint8Array(validPdfBuffer)], { type: 'application/pdf' }),
    '../../../etc/Raft_Consensus_Lecture_04.pdf',
  );
  validFormData.append('subjectId', String(subjectA.id));
  validFormData.append('title', 'Raft Consensus Protocol Lecture');

  const validUploadRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: validFormData,
  });
  const validUploadData = await validUploadRes.json();
  const materialA = validUploadData?.data;

  assert(
    'Pipeline Success',
    'PDF processed and returned HTTP 201 Created',
    validUploadRes.status === 201 && !!materialA?.id,
    `Material ID: ${materialA?.id}`,
  );

  assert(
    'Text Cleaning',
    'Cleaned text contains extracted content',
    Boolean(materialA?.rawText?.includes('Raft Consensus Protocol')),
    `Length: ${materialA?.rawText?.length} chars`,
  );

  assert(
    'Semantic Chunking',
    'Document was split into semantic chunks',
    Array.isArray(materialA?.chunks) && materialA?.chunks?.length > 0,
    `Chunks count: ${materialA?.chunks?.length}`,
  );

  assert(
    'Filename Sanitization',
    'Path traversal characters stripped from originalFileName',
    Boolean(materialA?.originalFileName && !materialA.originalFileName.includes('/') && !materialA.originalFileName.includes('..')),
    `Sanitized: ${materialA?.originalFileName}`,
  );

  assert(
    'Safe Storage',
    'Stored file path is within uploads directory',
    Boolean(typeof materialA?.storedPath === 'string' && materialA?.storedPath.includes('uploads')),
    `Path: ${materialA?.storedPath}`,
  );

  // Verify file was written to disk
  assert(
    'Physical Storage',
    'Stored file exists on disk',
    Boolean(materialA?.storedPath && fs.existsSync(materialA.storedPath)),
  );

  // --------------------------------------------------------------------------
  // TEST 6: Ownership & Cross-Tenant Subject Authorization
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Subject Ownership & Tenant Isolation ---');
  // Attacker (User B) attempts to upload a PDF linked to Alice's Subject (subjectA.id)
  const crossTenantFormData = new FormData();
  crossTenantFormData.append(
    'file',
    new Blob([new Uint8Array(validPdfBuffer)], { type: 'application/pdf' }),
    'hacked.pdf',
  );
  crossTenantFormData.append('subjectId', String(subjectA.id));

  const crossTenantRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: crossTenantFormData,
  });
  assert(
    'Authorization',
    'User B cannot upload PDF into User A subject (403 Forbidden)',
    crossTenantRes.status === 403,
    `HTTP ${crossTenantRes.status}`,
  );

  // --------------------------------------------------------------------------
  // TEST 7: Private Authorized PDF File Download
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Authorized Private File Download (Anti-IDOR) ---');

  // 7a. Unauthenticated download attempt -> 401
  const unauthDownloadRes = await fetch(`${BASE_URL}/api/materials/${materialA.id}/download`);
  assert(
    'Private Download',
    'Unauthenticated download rejected with 401 Unauthorized',
    unauthDownloadRes.status === 401,
    `HTTP ${unauthDownloadRes.status}`,
  );

  // 7b. User B (Attacker) attempts to download Alice's PDF -> 403 Forbidden
  const userBDownloadRes = await fetch(`${BASE_URL}/api/materials/${materialA.id}/download`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    'Private Download',
    'User B (unauthorized) download rejected with 403 Forbidden',
    userBDownloadRes.status === 403,
    `HTTP ${userBDownloadRes.status}`,
  );

  // 7c. User A (Owner) downloads PDF -> 200 OK with correct PDF headers
  const ownerDownloadRes = await fetch(`${BASE_URL}/api/materials/${materialA.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const downloadedBytes = Buffer.from(await ownerDownloadRes.arrayBuffer());
  const contentType = ownerDownloadRes.headers.get('content-type');
  const nosniff = ownerDownloadRes.headers.get('x-content-type-options');

  assert(
    'Private Download',
    'Owner downloads PDF with 200 OK, application/pdf and nosniff headers',
    Boolean(
      ownerDownloadRes.status === 200 &&
        contentType?.includes('application/pdf') &&
        nosniff === 'nosniff' &&
        downloadedBytes.subarray(0, 5).toString('ascii') === '%PDF-',
    ),
    `Size: ${downloadedBytes.length} bytes`,
  );

  // --------------------------------------------------------------------------
  // TEST 8: Availability to AI Services (Quizzes & Flashcards Generation)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Availability to AI Services ---');
  const quizRes = await fetch(`${BASE_URL}/api/quizzes/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subjectId: subjectA.id,
      materialId: materialA.id,
      count: 2,
      difficulty: 'medium',
    }),
  });
  const quizData = await quizRes.json();
  assert(
    'AI Integration',
    'Uploaded PDF is immediately usable to generate AI quizzes',
    quizRes.status === 201 && !!quizData?.data?.id,
    `Quiz ID: ${quizData?.data?.id}`,
  );

  // --------------------------------------------------------------------------
  // TEST 9: Deletion & Disk Cleanup
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Testing Material Deletion & File Cleanup ---');
  const deleteRes = await fetch(`${BASE_URL}/api/materials/${materialA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    'Cleanup',
    'Owner deletes material successfully',
    deleteRes.status === 200,
    `HTTP ${deleteRes.status}`,
  );

  // Verify file removed from disk
  assert(
    'Cleanup',
    'Physical PDF file was removed from storage upon deletion',
    Boolean(!materialA?.storedPath || !fs.existsSync(materialA.storedPath)),
    `File removed: ${materialA?.storedPath}`,
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL PIPELINE TESTS: ${total}`);
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
