# Security — Seraj Exchange

> Canonical invariants: `security_spec.md:1`. Enforced in `firestore.rules:1` (hardened P0). Database: `gen-lang-client-0654383136 / ai-studio-449339a8-b160-4b8d-93f0-adb5004965ca` (`firebase-applet-config.json:6`).

## Invariant → Rule Mapping

| # | Invariant (security_spec.md) | Rule Enforcement |
|---|-------------------------------|-----------------|
| 1 | Transfer requires valid `fromBranchId` + `toBranchId` | `firestore.rules:34` `isValidTransferBase` + `isValidId` on both; `152` `exists(branches/toBranchId)` |
| 2 | Only receiver branch can mark `received` | `firestore.rules:161-171` `getUserData().branchId == existing().toBranchId` && `status pending→received` && `receivedBy==uid`/`receivedAt==request.time` |
| 3 | Only admins/managers update rates | `firestore.rules:124-127` `allow create: if isSupervisor() && isValidExchangeRate()` ; `exchangeRateService.ts:11` client validation |
| 4 | Users view only own branch transfers (unless admin) | `firestore.rules:137-150` `get`/`list` checks `branchId == from/to` or `isAdministrator/isSupervisor`; `transferService.ts:152` dual query merges inbound+outbound for Teller |
| 5 | Amounts/rates positive | `firestore.rules:28,41,44` `>0` ; `exchangeRateService.ts:11`, `currencyService.ts:17` client checks |
| 6 | `issuedAt`/`receivedAt` = server timestamp | `firestore.rules:31,36,154,166` `== request.time` ; `transferService.ts:21` `serverTimestamp()` |
| 7 | `issuedBy` = auth.uid | `firestore.rules:154` ; `transferService.ts:24` |
| 8 | ID length ≤64 + regex | `firestore.rules:16` `isValidId` on every `{id}` param `79,85,92,110,117,124,130,137,152,159` |

## Dirty Dozen — Denial Tests (`tests/dirtyDozen.test.ts:1`)

| # | Payload | Expected | Rule Line |
|---|---------|----------|-----------|
| 1 | Identity Spoofing (`issuedBy` spoof) | DENY | `154` `issuedBy==uid` |
| 2 | Ghost Field `isVerified:true` | DENY | `25,36,66` `keys().size()==6|13` |
| 3 | Privilege Escalation self `role->admin` | DENY | `100-107` `hasOnly(['displayName'])` for self; `Layout.tsx:113` removed selector |
| 4 | Invalid Rate negative | DENY | `28-29` `>0` |
| 5 | Orphaned `toBranchId` ghost | DENY | `157` `exists(branches/toBranchId)` |
| 6 | Cross-Branch Hijack | DENY | `164` `toBranchId == existing.toBranchId` |
| 7 | Timestamp Fraud | DENY | `31,36,154` `==request.time` |
| 8 | Malicious 2KB ID | DENY | `16,79,85,92` `isValidId` on `{rateId,branchId,transferId}` |
| 9 | Balance Manipulation (clerk writes branch) | DENY | `130-134` `isAdministrator()` only; `branchService.ts:25` transaction |
|10 | Terminal State Break (amount on received) | DENY | `167` `hasOnly([status,receivedBy,...])` |
|11 | PII Leak `list users` | DENY | `*p` `94` `allow list: if isAdministrator()` |
|12 | Negative Amount | DENY | `41` `amount>0` |

Run locally:

```bash
npm install
firebase emulators:exec --only firestore "npm run test:rules"
# or
npm run test:watch
```

CI: `.github/workflows/ci.yml` runs `lint`, `typecheck`, and `test:rules` on each PR (see `firebase.json:1` emulator config).

## Roles

* `Administrator` | `Supervisor` | `Teller` (`types.ts:3`). `isSupervisor()` includes Administrator (`firestore.rules:13`), client `AuthProvider.tsx:86` mirrors. `users/{uid}` self-create only as `Teller` (`95`), update self only `displayName` (`105`), admin may set `role`/`branchId` (`101-104`).

## Secrets

* `firebase-applet-config.json:4` contains `apiKey` — client Firebase keys are public by design but rotate if leaked externally. Do not commit `firebase-admin` credentials.
* Client `GEMINI_API_KEY` removed from `vite.config.ts:11` (P2) — use `VITE_GEMINI_API_KEY` if needed, never `process.env` define.

## Reporting

Report vulnerabilities privately via GitHub Security Advisories. Do not open public issues with exploit details.
