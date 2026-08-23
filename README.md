# Seraj Exchange — سراج للصرافة

> Branch-based FX transfer ledger with Firestore security hardening, real-time reconciliation, and deterministic seeding.

Live: AI Studio `449339a8-b160-4b8d-93f0-adb5004965ca` · Stack: React 19 + Vite 6 + Tailwind 4 + Firebase 12 + React Router 7 + Recharts + Framer Motion

## Quick Start

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint + tsc
```

No `.env` required for core. Copy template if using AI:

```bash
cp .env.example .env.local
# edit VITE_GEMINI_API_KEY / VITE_APP_URL if needed
```

Firebase config is in `firebase-applet-config.json` (project `gen-lang-client-0654383136`, DB `ai-studio-449339a8...`). Auth is Google popup; first user self-registers as `Teller` with empty `branchId` until an `Administrator` assigns via **Users** (`src/pages/Users.tsx:42`).

## Firestore

```bash
firebase emulators:start --only firestore,auth   # or npm run emulators
npm run test:rules   # Dirty Dozen (security_spec.md) via vitest + rules-unit-testing
npm run test:watch
firebase deploy --only firestore:rules            # hardened rules (Phase 0)
firebase deploy --only firestore:indexes          # 8 composites (firestore.indexes.json)
```

*Rules:* `firestore.rules` enforces 6 invariants + 12 denial tests (see `SECURITY.md`). `isVerified` requires `email_verified==true` (`firestore.rules:6`). All IDs validated via `isValidId` (`size<=64`, regex).

*Indexes:* `transfers` `fromBranchId+issuedAt`, `toBranchId+issuedAt`, `from+to+status`; `exchange_rates date`, `notifications userId+createdAt/read`, `audit_logs timestamp`, `settlements settledAt` (`firestore.indexes.json:1`).

*Seed:* `src/lib/seed.ts` creates 4 branches with deterministic IDs (`main`, `branch-aden`, `branch-mukalla`, `branch-taiz`) + 2 rates via `writeBatch`, gated behind verified `Administrator` (triggered in `AuthProvider.tsx` on admin login). `main` must exist — Tellers default `branchId=''` until assigned.

## Architecture

```
src/
  components/AuthProvider.tsx  # role migration, branch assignment, isSupervisor includes Administrator
  components/Layout.tsx        # read-only role badge (no self-escalation), branch warning
  pages/
    Transfers.tsx              # dual-subscription (from+to), pagination 25+, receive modal with ID validation
    Dashboard.tsx              # dual-fetch 50+50 for Teller / 100 for admin, computes pending/sent/received locally
    Branches.tsx               # convertToBase returns null if no rate, deposit/withdraw via transaction + audit
    ExchangeRates.tsx          # via exchangeRateService, pagination 20+
    AuditLogs.tsx              # paginated 50+, search
    Reconciliation.tsx         # settlementService auto-links transferIds
  services/
    transferService.ts         # create/receive/cancel, subscribeToBranchTransfers(limit)
    branchService.ts           # getAll/subscribe/adjustBalance (runTransaction)
    exchangeRateService.ts     # subscribe/addRate with client validation mirroring rules
    currencyService.ts         # subscribe/add/update/delete with errorService
    settlementService.ts       # createSettlement auto-links outstanding IDs
    notificationService.ts     # subscribe limit 50, sendToRole/BranchManagers, clearAll (500 chunk)
    auditService.ts            # subscribe limit
    errorService.ts            # handleFirestoreError -> logger.error + throw JSON
  lib/
    firebase.ts                # init with firebase-applet-config.json + custom DB ID
    seed.ts
    logger.ts                  # structured JSON logger (level, timestamp, path, userId)
    utils.ts                   # cn
```

## Phases Completed

* **P0 Hotfixes (505073f):** ghost-field `keys().size()` checks, `isValidId` on all IDs, `users` self-update `hasOnly(['displayName'])`, `transfers` receive allows `receiverIdType/Number/notes`, `notifications` `isValidNotification`, `isVerified` email check, global deny last, Layout role selector removed.
* **P1 Core Flow (29ff895):** Teller dual-query merge, Dashboard real stats, `branchId=''` unassigned guard, seed deterministic + admin-gated via `writeBatch`.
* **P2 Financial (91a0ade):** `exchangeRateService`, `currencyService` hardening, `branchService` transactional ledger, `Branches` valuation fix, 8 indexes, package hygiene (`seraj-exchange 0.1.0`, remove `express/dotenv/genai/motion`), `vite.config` secret removal.
* **P3 Hardening (this):** pagination (transfers 25+, audit 50+, rates 20+, notifications 50), `NotificationCenter` clear-all, `logger.ts` + `errorService` structured, `tests/dirtyDozen.test.ts` 12+2 tests, `firebase.json`/`firestore.indexes.json`, `SECURITY.md` mapping, `CONTRIBUTING.md`, CI `ci.yml`.

See `ROADMAP.md` for full plan.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev |
| `npm run build` | Vite build |
| `npm run lint` | eslint + tsc |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | vitest run |
| `npm run test:rules` | firebase emulator + dirty dozen |
| `npm run emulators` | firestore/auth emulator |

## Security

See `SECURITY.md:1` for invariant→rule mapping and test runner. Every rules change must update `tests/dirtyDozen.test.ts` and `SECURITY.md`. Report vulnerabilities via GitHub Security Advisories.

## Contributing

See `CONTRIBUTING.md:1` for branch flow, seed, indexes, and PR checklist.

## License

Private — internal exchange house system.
