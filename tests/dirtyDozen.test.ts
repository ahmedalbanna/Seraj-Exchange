// @ts-nocheck
/**
 * Dirty Dozen — Firestore Security Rules Denial Tests
 * Spec: security_spec.md:11 (12 payloads must return PERMISSION_DENIED)
 * Run: firebase emulators:exec --only firestore "npm run test:rules"
 *
 * Requires @firebase/rules-unit-testing + vitest (dev).
 * Database: ai-studio-449339a8-b160-4b8d-93f0-adb5004965ca per firebase-applet-config.json
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'gen-lang-client-0654383136';
const DATABASE_ID = 'ai-studio-449339a8-b160-4b8d-93f0-adb5004965ca';

// Helper to create authenticated context with email_verified
function verifiedContext(uid: string, email: string, role: string, branchId: string) {
  return testEnv.authenticatedContext(uid, { email, email_verified: true });
}

beforeAll(async () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed minimal branches and users for tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const firestore = ctx.firestore();
    // Branches must exist for orphan checks
    await setDoc(doc(firestore, `branches/main`), { name: 'Main', location: 'Sanaa', balances: { USD: 1000 } });
    await setDoc(doc(firestore, `branches/branch-aden`), { name: 'Aden', location: 'Aden', balances: { USD: 1000 } });
    // Users
    await setDoc(doc(firestore, `users/alice`), { uid: 'alice', email: 'alice@example.com', displayName: 'Alice', role: 'Teller', branchId: 'main' });
    await setDoc(doc(firestore, `users/bob`), { uid: 'bob', email: 'bob@example.com', displayName: 'Bob', role: 'Teller', branchId: 'branch-aden' });
    await setDoc(doc(firestore, `users/admin1`), { uid: 'admin1', email: 'admin@example.com', displayName: 'Admin', role: 'Administrator', branchId: 'main' });
  });
});

describe('Dirty Dozen — must DENY', () => {
  it('1. Identity Spoofing: issuedBy != auth.uid → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(
      addDoc(collection(db, 'transfers'), {
        senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
        amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
        fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
        issuedAt: serverTimestamp(), issuedBy: 'bob' // spoof
      })
    );
  });

  it('2. Ghost Field Injection: isVerified:true → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(
      addDoc(collection(db, 'transfers'), {
        senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
        amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
        fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
        issuedAt: serverTimestamp(), issuedBy: 'alice', isVerified: true
      } as any)
    );
  });

  it('3. Privilege Escalation: Teller self role -> Administrator → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'Administrator' }));
  });

  it('4. Invalid Rate: negative rate → DENY', async () => {
    const admin = verifiedContext('admin1', 'admin@example.com', 'Administrator', 'main');
    const db = admin.firestore();
    await assertFails(addDoc(collection(db, 'exchange_rates'), {
      baseCurrency: 'USD', targetCurrency: 'YER', officialRate: -5, marketRate: 10, updatedBy: 'admin1', date: serverTimestamp()
    }));
  });

  it('5. Orphaned Transfer: toBranchId not exists → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(addDoc(collection(db, 'transfers'), {
      senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
      amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
      fromBranchId: 'main', toBranchId: 'ghost-branch', status: 'pending',
      issuedAt: serverTimestamp(), issuedBy: 'alice'
    }));
  });

  it('6. Cross-Branch Hijack: Branch A receive for Branch B → DENY', async () => {
    // Create transfer main->aden as admin, then try receive as alice (main) not aden
    const admin = verifiedContext('admin1', 'admin@example.com', 'Administrator', 'main');
    let transferId: string;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const ref = await addDoc(collection(db, 'transfers'), {
        senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
        amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
        fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
        issuedAt: serverTimestamp(), issuedBy: 'admin1'
      });
      transferId = ref.id;
    });
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(updateDoc(doc(db, `transfers/${transferId!}`), { status: 'received', receivedBy: 'alice', receivedAt: serverTimestamp() }));
  });

  it('7. Timestamp Fraud: client date not request.time → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(addDoc(collection(db, 'transfers'), {
      senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
      amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
      fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
      issuedAt: new Date('2000-01-01'), issuedBy: 'alice'
    } as any));
  });

  it('8. Malicious ID: 2KB rateId → DENY', async () => {
    const admin = verifiedContext('admin1', 'admin@example.com', 'Administrator', 'main');
    const db = admin.firestore();
    const longId = 'a'.repeat(2048);
    await assertFails(setDoc(doc(db, `exchange_rates/${longId}`), {
      baseCurrency: 'USD', targetCurrency: 'YER', officialRate: 530, marketRate: 535, updatedBy: 'admin1', date: serverTimestamp()
    }));
  });

  it('9. Balance Manipulation: Teller write branches → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(updateDoc(doc(db, 'branches/main'), { balances: { USD: 999 } }));
  });

  it('10. Terminal State Break: change amount on received → DENY', async () => {
    let transferId: string;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const ref = await addDoc(collection(db, 'transfers'), {
        senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
        amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
        fromBranchId: 'main', toBranchId: 'branch-aden', status: 'received',
        issuedAt: serverTimestamp(), issuedBy: 'alice', receivedBy: 'bob', receivedAt: serverTimestamp()
      });
      transferId = ref.id;
    });
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(updateDoc(doc(db, `transfers/${transferId!}`), { amount: 999 }));
  });

  it('11. PII Leak: Teller list users → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(getDoc(doc(db, 'users/bob'))); // get other user should fail for non-admin
  });

  it('12. Negative Amount: amount -100 → DENY', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertFails(addDoc(collection(db, 'transfers'), {
      senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
      amount: -100, currency: 'USD', exchangeRate: 1, totalAmount: -100,
      fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
      issuedAt: serverTimestamp(), issuedBy: 'alice'
    }));
  });
});

describe('Positive — should SUCCEED', () => {
  it('Teller creates valid transfer from own branch', async () => {
    const alice = verifiedContext('alice', 'alice@example.com', 'Teller', 'main');
    const db = alice.firestore();
    await assertSucceeds(addDoc(collection(db, 'transfers'), {
      senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
      amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
      fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
      issuedAt: serverTimestamp(), issuedBy: 'alice'
    }));
  });

  it('Receiver branch can mark received', async () => {
    let transferId: string;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const ref = await addDoc(collection(db, 'transfers'), {
        senderName: 'S', senderPhone: '1', receiverName: 'R', receiverPhone: '2',
        amount: 100, currency: 'USD', exchangeRate: 1, totalAmount: 100,
        fromBranchId: 'main', toBranchId: 'branch-aden', status: 'pending',
        issuedAt: serverTimestamp(), issuedBy: 'alice'
      });
      transferId = ref.id;
    });
    const bob = verifiedContext('bob', 'bob@example.com', 'Teller', 'branch-aden');
    const db = bob.firestore();
    await assertSucceeds(updateDoc(doc(db, `transfers/${transferId!}`), { status: 'received', receivedBy: 'bob', receivedAt: serverTimestamp() }));
  });
});
