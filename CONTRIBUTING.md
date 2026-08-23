# Contributing — Seraj Exchange

## Prereqs

* Node 20+, npm 10+
* Firebase CLI (`npm i -g firebase-tools`) for emulator

## Setup

```bash
npm install
cp .env.example .env.local   # fill VITE_* if needed
npm run dev                  # vite on :3000
```

Firebase config is in `firebase-applet-config.json` (custom DB `ai-studio-449339a8...`). No `.env` needed for emulator.

## Firestore

```bash
firebase emulators:start --only firestore,auth   # or npm run emulators
# In another shell
npm run test:rules   # Dirty Dozen per security_spec.md
npm run typecheck    # tsc --noEmit
npm run lint         # eslint + tsc
```

* Rules: `firestore.rules` (hardened P0, see `SECURITY.md`). Test: `tests/dirtyDozen.test.ts`.
* Indexes: `firestore.indexes.json` — 8 composites for `transfers` (`fromBranchId+issuedAt`, `toBranchId+issuedAt`, `from+to+status`), `exchange_rates`, `notifications`, `audit_logs`, `settlements`. Deploy: `firebase deploy --only firestore:indexes`.
* Seed: `src/lib/seed.ts` deterministic IDs (`main`, `branch-aden` …) via `writeBatch`, gated behind verified `Administrator` (`AuthProvider.tsx` triggers on admin login). First user is `Teller` with empty `branchId` until admin assigns via `src/pages/Users.tsx`.

## Branch & Transfers Flow (P1)

* Teller visibility: `transferService.ts:subscribeToBranchTransfers` merges `fromBranchId==B` + `toBranchId==B` (Firestore has no OR). Requires composite indexes `toBranchId+issuedAt`/`fromBranchId+issuedAt` — error surfaces as console “missing index” with link.
* Dashboard stats: fetches 50+50 for Teller, 100 for admin, computes `pending/total_sent/total_received` locally; real prod should use Cloud Function aggregation.
* Pagination: `Transfers.tsx` `transferLimit` 25+ (`load more`), `AuditLogs.tsx` 50+, `ExchangeRates.tsx` 20+ — all `onSnapshot` with `limit()`, unsubscribe on unmount to control cost.
* Notifications: `notificationService.ts` `subscribeToNotifications` limit 50, `clearAll` batch deletes 500/chunk, `sendToBranchManagers` queries `role in [Supervisor,Administrator]`.

## Financial Integrity (P2)

* Rates: `exchangeRateService.ts` validates `length==3`, `base!=target`, `>0`; `firestore.rules` enforces `keys().size()==6` ghost check.
* Branch ledger: `branchService.ts` `deposit`/`withdraw` via `runTransaction` (read `balances`, check `next>=0`, `update` + `audit_logs` `BRANCH_DEPOSIT/WITHDRAWAL`). `Branches.tsx` `convertToBase` returns `null` if no rate path, total skips null.
* Currency: `currencyService.ts` validates `code/name/symbol`, error via `errorService.ts`.

## Observability (P3)

* Logger: `src/lib/logger.ts` JSON lines (`timestamp`, `level`, `message`, `path`, `operationType`, `userId`). `errorService.ts` logs `permission-denied` with `authInfo` before throwing `JSON.stringify(FirestoreErrorInfo)`.
* Replace `console.error` with `logger.error` in services; UI surfaces via error boundaries (future: toast).

## Conventions

* Commit: Conventional Commits (`fix(security):`, `feat(core):`, `feat(financial):`). Phase 0-2 already: `505073f`, `29ff895`, `91a0ade`.
* Type: `npm run typecheck` must pass; no `any` without justification.
* Rules: every change to `firestore.rules` must add/adjust test in `tests/dirtyDozen.test.ts` and update `SECURITY.md` mapping.

## PR Checklist

- [ ] `npm run lint && npm run typecheck` green
- [ ] `firebase emulators:exec --only firestore "npm run test:rules"` 12/12 DENY + 2 Succeed
- [ ] Updated `SECURITY.md` if rules changed
- [ ] Added pagination/limit for new collections
- [ ] No `process.env` secret exposure in `vite.config.ts`
