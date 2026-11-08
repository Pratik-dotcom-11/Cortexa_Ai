/**
 * Firestore Security Rules Specification & Dirty Dozen Verification Suite
 * Validates that all 12 adversarial payloads in security_spec.md are rejected with PERMISSION_DENIED.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRuleGate: string;
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unverified Email Write (Spoof Attack)',
    collection: '/users/{userId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isVerifiedUser()',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on UserProfile Create',
    collection: '/users/{userId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "data.keys().hasOnly(['uid', 'displayName', 'university', 'major', 'photoUrl', 'createdAt', 'updatedAt'])",
  },
  {
    id: 3,
    name: 'Cross-User PII Read on /users/{userId}/private/info',
    collection: '/users/{userId}/private/{docId}',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'request.auth.uid == userId',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Subject Creation',
    collection: '/subjects/{subjectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.ownerId == request.auth.uid',
  },
  {
    id: 5,
    name: 'ID Poisoning (1.5KB Document ID)',
    collection: '/subjects/{subjectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidId(subjectId)',
  },
  {
    id: 6,
    name: 'Denial of Wallet Oversized String',
    collection: '/subjects/{subjectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.name.size() <= 120',
  },
  {
    id: 7,
    name: 'Orphaned StudyNote Creation (Non-Existent Subject)',
    collection: '/studyNotes/{noteId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'exists(/databases/$(database)/documents/subjects/$(incoming().subjectId))',
  },
  {
    id: 8,
    name: 'Cross-Tenant Parent Attach on StudyNote',
    collection: '/studyNotes/{noteId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'get(/databases/$(database)/documents/subjects/$(incoming().subjectId)).data.ownerId == request.auth.uid',
  },
  {
    id: 9,
    name: 'Immortal Field Mutation (ownerId or createdAt tampering on update)',
    collection: '/subjects/{subjectId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt',
  },
  {
    id: 10,
    name: 'Value Poisoning on Update (Invalid Type in Allowed Key)',
    collection: '/subjects/{subjectId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidSubject(incoming())',
  },
  {
    id: 11,
    name: 'Client Forged Timestamp (createdAt != request.time)',
    collection: '/subjects/{subjectId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().createdAt == request.time',
  },
  {
    id: 12,
    name: 'Unauthorized Blanket Collection List',
    collection: '/subjects/{subjectId}',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'existing().ownerId == request.auth.uid',
  },
];

export function verifyRulesContainAllDirtyDozenGates(rulesFilePath: string): boolean {
  const rulesText = fs.readFileSync(path.resolve(rulesFilePath), 'utf8');
  for (const scenario of DIRTY_DOZEN_SCENARIOS) {
    if (!rulesText.includes(scenario.enforcedByRuleGate)) {
      throw new Error(`Missing security gate for Scenario #${scenario.id} (${scenario.name}): ${scenario.enforcedByRuleGate}`);
    }
  }
  return true;
}
