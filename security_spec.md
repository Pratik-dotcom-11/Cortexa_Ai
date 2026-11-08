# Cortexa (StudyAI) Firestore Security Specification

## 1. Data Invariants

1. **Default Deny Safety Net**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: All write operations require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
3. **PII Split-Collection Isolation**:
   - `/users/{userId}` stores non-sensitive profile metadata (`uid`, `displayName`, `university`, `major`, `photoUrl`, `createdAt`, `updatedAt`) and is readable/writable strictly by the owner (`request.auth.uid == userId`).
   - `/users/{userId}/private/{docId}` (where `docId == 'info'`) isolates PII (`email`) and is accessible strictly to the owner (`request.auth.uid == userId`).
4. **Master Gate & Relational Integrity**:
   - `/subjects/{subjectId}` must have `ownerId == request.auth.uid`.
   - `/studyNotes/{noteId}` cannot be created unless its referenced parent `/subjects/$(incoming().subjectId)` exists and `get(/databases/$(database)/documents/subjects/$(incoming().subjectId)).data.ownerId == request.auth.uid`.
5. **Immutable Ownership & Creation Timestamps**:
   - `uid`, `ownerId`, `subjectId`, and `createdAt` are immortal fields and cannot be mutated during updates (`incoming().ownerId == existing().ownerId`, `incoming().createdAt == existing().createdAt`).
6. **Temporal Integrity**:
   - On `create`: `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - On `update`: `incoming().updatedAt == request.time`.
7. **Strict Key & Volumetric Boundaries**:
   - Every string field enforces strict `.size()` bounds and regex patterns from `firebase-blueprint.json`.
   - Every `create` enforces `hasAll` and `hasOnly` key allowlists.
   - Every `update` wraps with `isValid[Entity](incoming())` and uses action-based `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
8. **Query Enforcer (No Blanket Reads)**:
   - Every `allow list` rule restricts `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` inside list blocks.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 — Unverified Email Write (Spoof Attack)**:
   - Target: `POST /users/user_123`
   - Auth: `{ uid: "user_123", token: { email: "student@uni.edu", email_verified: false } }`
   - Expected: `PERMISSION_DENIED`

2. **Payload 2 — Shadow Field Injection on UserProfile Create**:
   - Target: `POST /users/user_123`
   - Data: `{ uid: "user_123", displayName: "Alex", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED` (blocked by `hasOnly`)

3. **Payload 3 — Cross-User PII Read on `/users/{userId}/private/info`**:
   - Target: `GET /users/victim_uid/private/info`
   - Auth: `{ uid: "attacker_uid", token: { email_verified: true } }`
   - Expected: `PERMISSION_DENIED`

4. **Payload 4 — Identity Spoofing on Subject Creation**:
   - Target: `POST /subjects/subj_1`
   - Auth: `{ uid: "attacker_uid", token: { email_verified: true } }`
   - Data: `{ ownerId: "victim_uid", name: "Algorithms", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED`

5. **Payload 5 — ID Poisoning (1.5KB Document ID)**:
   - Target: `POST /subjects/{1500_char_id}`
   - Auth: `{ uid: "user_123", token: { email_verified: true } }`
   - Expected: `PERMISSION_DENIED` (blocked by `isValidId`)

6. **Payload 6 — Denial of Wallet Oversized String**:
   - Target: `POST /subjects/subj_1`
   - Data: `{ ownerId: "user_123", name: "A".repeat(5000), createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED` (blocked by `name.size() <= 120`)

7. **Payload 7 — Orphaned StudyNote Creation (Non-Existent Subject)**:
   - Target: `POST /studyNotes/note_1`
   - Data: `{ ownerId: "user_123", subjectId: "non_existent_subj", title: "Lecture 1", content: "Notes", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED` (blocked by `exists()` and parent `ownerId` check)

8. **Payload 8 — Cross-Tenant Parent Attach on StudyNote**:
   - Target: `POST /studyNotes/note_1`
   - Data: `{ ownerId: "user_123", subjectId: "other_users_subj", title: "Lecture 1", content: "Notes", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED`

9. **Payload 9 — Immortal Field Mutation (`ownerId` or `createdAt` tampering on update)**:
   - Target: `PATCH /subjects/subj_1`
   - Data: `{ ownerId: "new_owner", name: "Updated", createdAt: NEW_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED`

10. **Payload 10 — Value Poisoning on Update (Invalid Type in Allowed Key)**:
    - Target: `PATCH /subjects/subj_1`
    - Data: `{ ownerId: "user_123", name: 99999, createdAt: EXISTING_TIME, updatedAt: SERVER_TIME }`
    - Expected: `PERMISSION_DENIED` (blocked by `isValidSubject(incoming())`)

11. **Payload 11 — Client Forged Timestamp (`createdAt != request.time`)**:
    - Target: `POST /subjects/subj_1`
    - Data: `{ ownerId: "user_123", name: "Physics", createdAt: "2020-01-01T00:00:00Z", updatedAt: SERVER_TIME }`
    - Expected: `PERMISSION_DENIED`

12. **Payload 12 — Unauthorized Blanket Collection List**:
    - Target: `LIST /subjects` without `where('ownerId', '==', request.auth.uid)`
    - Auth: `{ uid: "user_123", token: { email_verified: true } }`
    - Expected: `PERMISSION_DENIED`
