# Security Specification - Seraj Exchange

## 1. Data Invariants
- A transfer cannot be created without a valid `fromBranchId` and `toBranchId`.
- Only the receiver's branch can mark a transfer as 'received'.
- Only admins or managers can update exchange rates.
- Users can only view transfers associated with their assigned branch (unless they are global admins).
- Amounts and exchange rates must be positive numbers.
- `issuedAt` and `receivedAt` must be server timestamps.

## 2. The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: User A creates a transfer and sets `issuedBy` to User B's UID.
2. **Ghost Field Injection**: Adding `isVerified: true` to a transfer payload.
3. **Privilege Escalation**: A clerk trying to update their own `role` to 'admin' in `/users`.
4. **Invalid Rate**: Setting an exchange rate to a negative number or zero.
5. **Orphaned Transfer**: Creating a transfer to a `toBranchId` that doesn't exist.
6. **Cross-Branch Hijack**: Clerk from Branch A trying to mark a transfer destined for Branch B as 'received'.
7. **Timestamp Fraud**: Providing a client-side date for `issuedAt` instead of `request.time`.
8. **Malicious ID**: Creating a rate with a 2KB string as ID to bloat storage.
9. **Balance Manipulation**: Lowering a branch's balance directly by a clerk.
10. **Terminal State Break**: Trying to change the `amount` of a transfer already marked as 'received'.
11. **PII Leak**: Authenticated user trying to list all emails in `/users` without relevant branch association.
12. **Negative Amount**: Sending a transfer with `amount: -100`.

## 3. Test Runner Concept
The tests will verify that all the above payloads return `PERMISSION_DENIED`.
