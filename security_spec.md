# Firestore Security Specification: HasilTax Buddy & Admin Monitor

This document establishes the security specs for the HasilTax Buddy application and sets up a robust attribute-based access control (ABAC) architecture.

## 1. Data Invariants
- **Authentication**: All read and write operations on search logs/conversations require a valid user session.
- **Identity Integrity**: A user can only read, create, or update conversations where the `userId` field matches their `request.auth.uid`. No user can read or write other users' chat logs.
- **Admin Isolation**: The `analytics` collection stores global chatbot query statistics, which must strictly be **immutable** once written, and can **ONLY** be read by authorized administrators (checks against `/admins/{userId}`).
- **Input Bounds**: Document IDs must be alphanumeric strings (`isValidId`), and long field strings (like query texts) must be size-bounded to prevent Denial of Wallet resource exhaustion.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads present potential attacks designed to bypass identity, structure, or permissions constraints. Our security rules will return `PERMISSION_DENIED` for all of them:

### Challenge 1: Privilege Escalation (Self-Assigned Admin)
1. **Payload 1**: Attempt to create an admin credential document inside `/admins/attacker_uid` as a regular logged-in client.
2. **Payload 2**: Attempt to write an analytics log with custom field `isAdmin = true` to spoof administrative role properties.

### Challenge 2: Cross-Tenant Data Leak (Spying on other tax clients)
3. **Payload 3**: Authenticated user `user_abc` attempts to read `/conversations/session_xyz` belonging to `user_def`.
4. **Payload 4**: Authenticated user `user_abc` attempts to perform a list query on `/conversations` without filtering by their own `userId`.

### Challenge 3: Impersonation & Identity Spoofing
5. **Payload 5**: Authenticated user `user_abc` attempts to create `/conversations/session_123` with `userId` set to `victim_uid`.
6. **Payload 6**: Authenticated user `user_abc` attempts to modify an existing tax session by changing the immutable `userId` field from `user_abc` to `another_user`.

### Challenge 4: State Validation & Terminal Locks
7. **Payload 7**: Attempt to write comments or feedback status on an analytics log after a terminal lock rating is set.
8. **Payload 8**: Multi-field update modifying the conversation `createdAt` field (marked immutable after generation).

### Challenge 5: Resource Poisoning (Denial of Wallet)
9. **Payload 9**: Attempt to inject a 10MB string as the conversation title.
10. **Payload 10**: Attempt to inject special script injections or junk emoji strings as a document ID (e.g. `/conversations/../bad_chars`).

### Challenge 6: Orphaned Writes & Malformed Objects
11. **Payload 11**: Creating a conversation document missing required properties like `messages` list or initial `createdAt` timestamp.
12. **Payload 12**: Writing a `SearchAnalytics` event with a negative domain count or invalid types (e.g. `citedDomains` specified as a single string instead of a structured array).

---

## 3. Test Runner Specification

The test runner asserts that each of the "Dirty Dozen" payloads results in an explicit and immediate `PERMISSION_DENIED` from Firestore. It checks:
- Standard reads are guarded behind identity.
- Write actions validate the schema fields exactly.
- Global monitoring analytics are only readable by admins existing in the `/admins/` lock list.
