# ROADMAP — Seraj Exchange

> Scope: Stabilize security, fix BROKEN core flows, then complete financial operations. All references use `file_path:line_number`.

## 0. Baseline (2026-08-23)

**Stack:** React 19 / Vite 6 / Tailwind 4 / Firebase 12 (custom DB `firebase-applet-config.json:6`) / React Router 7. No backend, no tests, no CI.
**Deployed rules:** `firestore.rules:1` is **weaker** than `DRAFT_firestore.rules:1`. 3/12 Dirty Dozen payloads in `security_spec.md:11` currently PASS when they must DENY: #2 Ghost Field, #3 Privilege Escalation, #8 Malicious ID.
**Broken flows:** Teller cannot see inbound transfers (`src/services/transferService.ts:152`), receive always fails if ID notes supplied (`src/services/transferService.ts:61` vs `firestore.rules:118`), branch notifications never deliver (`src/services/notificationService.ts:93`), new users orphaned to `branchId:'main'` which does not exist (`src/components/AuthProvider.tsx:70` vs `src/lib/seed.ts:11`).
**Debt:** Placeholder package name `package.json:2`, dead deps (`express`, `@google/genai`, `dotenv`, `motion`), client-exposed `GEMINI_API_KEY` via `vite.config.ts:11`, `README.md:1` is template.

---

## Phase 0 — Hotfixes (P0, 3-5 days) — DO NOT DEPLOY WITHOUT THIS

Goal: Make `firestore.rules` enforce `security_spec.md:1` invariants. Block privilege escalation.

### 0.1 Firestore Rules Hardening
- [ ] **Fix self role escalation** `firestore.rules:69`. Change self-update path from `hasOnly(['displayName','role'])` to `hasOnly(['displayName'])`. Add role enum guard for admin path: `incoming().role in ['Administrator','Supervisor','Teller']`. Source: `DRAFT_firestore.rules:49`.
- [ ] **Block Ghost Field Injection** `firestore.rules:28-49`. Add `&& data.keys().size()==6` to `isValidExchangeRate` (draft `DRAFT_firestore.rules:22`) and `&& data.keys().size()==13` (or strict allow-list) to `isValidTransferBase`. Without this, payload #2 passes.
- [ ] **Enforce ID length on document ID** `firestore.rules:21` defines `isValidId` but never used on `rateId`/`branchId`/`transferId`. Add `&& isValidId(rateId)` etc. to each `match /collection/{id}` create rule. Blocks payload #8.
- [ ] **Fix receive rule** `firestore.rules:118-127`. Service `src/services/transferService.ts:66-69` now writes `receiverIdType/receiverIdNumber/notes` but rule allows only `['status','receivedBy','receivedAt']`. Change to `hasOnly(['status','receivedBy','receivedAt','receiverIdType','receiverIdNumber','notes'])` and validate `receiverIdType in ['nationalId','passport','familyCard','other']`.
- [ ] **Fix notifications create** `firestore.rules:59` `allow create: if isVerified()` allows spoofing any `userId`. Require `incoming().userId == request.auth.uid` OR restrict `sendToBranchManagers` to server-side. Otherwise spam vector.
- [ ] **Restore `isVerified`** `firestore.rules:11` currently `return isSignedIn()`. Re-enable `request.auth.token.email_verified==true` per `DRAFT_firestore.rules:11` for production, or gate sensitive collections (`users`, `branches`) behind it.
- [ ] **Move global deny** `firestore.rules:5` to bottom (or remove). Semantics are ORed but placement is misleading; keep as catch-all last match.
- [ ] **Sync branch write** `firestore.rules:93` ensure `balances` cannot be set by non-admin (already correct) but add field validation `balances is map` if admin.

### 0.2 Client Privilege Removal
- [ ] **Remove role selector** `src/components/Layout.tsx:114-125`. Delete `<select value={profile.role} onChange=>updateDoc>` . Replace with read-only badge. Only `src/pages/Users.tsx:42` (admin) may call `src/services/userService.ts:28`.
- [ ] **Fix `isSupervisor` semantics** `src/components/AuthProvider.tsx:86` currently excludes Administrator. Change to `['Supervisor','Administrator'].includes(role)` to match `firestore.rules:19`. Update all `isAdministrator||isSupervisor` checks to use canonical helper.
- [ ] **Fix role strings** `src/services/notificationService.ts:93` `where('role','in',['manager','admin'])` never matches `types.ts:3`. Change to `['Supervisor','Administrator']` and `['Teller']` equivalents. Same for `DRAFT_firestore.rules:13`.

**Exit criteria:** `firebase emulators:exec` dirty-dozen suite returns `PERMISSION_DENIED` for all 12 payloads in `security_spec.md:11`. Manual test: Teller cannot `updateDoc(users/self,{role:'Administrator'})`.

---

## Phase 1 — Core Flow Restoration (P1, 1-2 weeks)

Goal: Transfers usable end-to-end for Teller.

### 1.1 Transfers Visibility
- [ ] **Fix Teller subscription** `src/services/transferService.ts:152-175`. Current query only `where('fromBranchId','==',branchId)`. Implement dual subscription: `fromBranchId==B` + `toBranchId==B` merged client-side (or Cloud Function composite view). Same fix in `src/pages/Dashboard.tsx:43-49`.
- [ ] **Dashboard stats** `src/pages/Dashboard.tsx:61-66` are hardcoded. Replace with aggregation query or summary doc; at minimum compute `pending` from snapshot.
- [ ] **Validate `profile.branchId`** `src/components/AuthProvider.tsx:70` defaults to `'main'` which `src/lib/seed.ts:12` never creates (auto-ID branches). Seed with deterministic ID `main` or assign first branch ID after creation. Add guard: if `branchId=='none'` or missing, block transfer create with UI error.

### 1.2 Receive & Audit
- [ ] **Repair `receive()`** `src/services/transferService.ts:56-97`. Already batch-writes audit log; ensure it respects updated rule (0.1). Add error toast via `src/services/errorService.ts:16` instead of silent `handleFirestoreError` throw.
- [ ] **Settlement linking** `src/services/settlementService.ts:73` writes `transferIds:[]` placeholder. Populate with queried outstanding transfers or remove field until implemented. Document invariant gap.

### 1.3 Seed & Branch Setup
- [ ] **Gate seeding** `src/main.tsx:8` + `src/lib/seed.ts:4`. Only run when `auth.currentUser && isAdministrator`. Replace sequential `addDoc` loop with `writeBatch`. Handle `permission-denied` gracefully (currently `catch(console.error)` hides).

**Exit criteria:** Teller at Branch A creates transfer to Branch B; Teller at B sees it in `Transfers.tsx:79` and can `receive`. Audit log appears in `AuditLogs.tsx:18`.

---

## Phase 2 — Financial Integrity (P2, 2-4 weeks)

### 2.1 Exchange Rates & Currencies
- [ ] **Centralize writes** `src/pages/ExchangeRates.tsx:50` uses raw `addDoc`; route through new `src/services/exchangeRateService.ts` with validation `>0`, `baseCurrency!=targetCurrency`, length 3.
- [ ] **Currency service error handling** `src/services/currencyService.ts:17-29` add try/catch + `handleFirestoreError` parity.
- [ ] **Immutability** Ensure `firestore.rules:86-89` explicitly `allow update, delete: if false` for `exchange_rates` (draft `DRAFT_firestore.rules:60`).

### 2.2 Branches & Balances
- [ ] **Expose balance mutation** `src/pages/Branches.tsx:147-149` buttons are no-ops. Implement `branchService.deposit/withdraw` as admin-only `runTransaction` updating `balances` map transactionally.
- [ ] **Fix valuation** `src/pages/Branches.tsx:51-63` `convertToBase` currently multiplies direct rate but should divide; handle missing rate as `null` not `0`. Add cache for latest `exchange_rates` snapshot `36`.
- [ ] **Indexes** Add `firestore.indexes.json` for `transfers (fromBranchId ASC, issuedAt DESC)`, `(toBranchId ASC, issuedAt DESC)`, `(fromBranchId, toBranchId, status)`. Document in `README.md`.

### 2.3 Configuration & Build
- [ ] **Package hygiene** `package.json:2` rename to `seraj-exchange`, version `0.1.0`, move `vite` to dev only, remove `express/dotenv/@google/genai/motion` or justify.
- [ ] **Env** Remove `vite.config.ts:11` `define` exposure; use `import.meta.env.VITE_GEMINI_API_KEY` if needed, or delete key if unused. Ensure `.env.example:1` matches actual `loadEnv`.
- [ ] **Tooling** Add `lint`, `typecheck`, `test:emulators` scripts, GitHub Actions, and `tsc --noEmit` passes (currently `src/pages/Dashboard.tsx:211` duplicate `cn` local vs `src/lib/utils.ts:4`).

**Exit criteria:** Admin can manage currencies/rates, branch total estimate correct, no dead deps, `npm run lint && tsc` green.

---

## Phase 3 — Hardening & Scale (P3, 4-8 weeks)

- [ ] **Firestore emulator test suite** for `security_spec.md:25` — 12 denial tests + invariants (positive/negative amount, serverTimestamp enforcement `security_spec.md:9`, orphan branch, terminal state). Run in CI on every `firestore.rules` change.
- [ ] **Pagination & cost control** `src/services/transferService.ts:152`, `src/services/auditService.ts:6`, `src/pages/ExchangeRates.tsx:31` all `limit(20/50/200)` unbounded subscriptions. Add cursor pagination and `limit` + unsubscribe on idle.
- [ ] **Notifications lifecycle** `src/components/NotificationCenter.tsx:121` `مسح جميع التنبيهات` button no-op; implement batch delete + security rule `allow delete: if resource.data.userId==uid`.
- [ ] **Auth hardening** Enforce `email_verified` in production, add passwordless or 2FA for `Administrator`, rotate `firebase-applet-config.json:4` apiKey if committed publicly.
- [ ] **Observability** Replace `console.error` with structured logging; surface `src/services/errorService.ts:20` JSON to UI toast with `path/operationType`.
- [ ] **Docs** Rewrite `README.md` (setup, `npm install`, emulator, seed, rules deploy), add `SECURITY.md` mapping each invariant to rule line, and `CONTRIBUTING.md`.

---

## Milestones & Ownership

| Milestone | Owner | Effort | Dependency |
|-----------|-------|--------|------------|
| M0 Hotfix merge + rules deploy | Security | 3-5d | Phase 0 |
| M1 Teller E2E transfer demo | Frontend | 1-2w | M0 |
| M2 Rate/currency + branch ledger | Backend/Firebase | 2-4w | M1 |
| M3 Emulator CI + pagination | Platform | 4-8w | M2 |

## Risks

*   `firebase-applet-config.json:7` custom DB ID — rules deploy must target same ID or silently miss.
*   Tailwind dynamic `bg-${color}` in `src/pages/Dashboard.tsx:94` will purge in production build — visual regression.
*   No Cloud Functions: all enforcement is rules-only; complex settlement reconciliation (currency conversion, idempotency) may require functions later.

## How to Validate This Roadmap

1. `npm install && npm run lint` passes after Phase 2.
2. `firebase emulators:exec --only firestore "npm test"` green for 12 payloads.
3. Manual QA matrix: Teller/Supervisor/Administrator x create/receive/cancel/rate-update across two branches.
4. `git log --oneline` shows Phase 0 commit before any feature commit.
