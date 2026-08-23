import { 
  collection, 
  getDocs, 
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Branch } from '../types';
import { handleFirestoreError } from './errorService';

export const branchService = {
  getAll: async (): Promise<Branch[]> => {
    try {
      const snap = await getDocs(collection(db, 'branches'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
    } catch (error) {
      handleFirestoreError(error, 'list', 'branches');
      return [];
    }
  },

  subscribeToBranches: (callback: (branches: Branch[]) => void) => {
    return onSnapshot(collection(db, 'branches'), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    }, (error) => {
      console.error("Error subscribing to branches", error);
    });
  },

  adjustBalance: async (branchId: string, currency: string, delta: number, userId: string, reason: string = 'MANUAL_ADJUSTMENT') => {
    if (!branchId) throw new Error("branchId required");
    if (!currency || currency.length < 3) throw new Error("currency required");
    if (delta === 0) throw new Error("delta cannot be 0");
    if (!userId) throw new Error("userId required");

    try {
      await runTransaction(db, async (tx) => {
        const branchRef = doc(db, 'branches', branchId);
        const branchSnap = await tx.get(branchRef);
        if (!branchSnap.exists()) throw new Error(`Branch ${branchId} not found`);
        const data = branchSnap.data() as Branch;
        const balances = { ...(data.balances || {}) } as Record<string, number>;
        const current = balances[currency] ?? 0;
        const next = current + delta;
        if (next < 0) throw new Error(`Insufficient ${currency} balance: ${current} + ${delta} would be negative`);
        balances[currency] = next;
        tx.update(branchRef, { balances });

        // Audit log for balance movement (admin-only doc, but creator must be current user)
        const auditRef = doc(collection(db, 'audit_logs'));
        tx.set(auditRef, {
          action: delta > 0 ? 'BRANCH_DEPOSIT' : 'BRANCH_WITHDRAWAL',
          entityId: branchId,
          entityType: 'transfer',
          amount: Math.abs(delta),
          currency,
          exchangeRate: 1,
          details: { reason, delta, previous: current, next, branchId },
          userId,
          timestamp: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `branches/${branchId}`);
    }
  },

  deposit: async (branchId: string, currency: string, amount: number, userId: string) => {
    if (amount <= 0) throw new Error("Deposit amount must be > 0");
    return branchService.adjustBalance(branchId, currency, amount, userId, 'DEPOSIT');
  },

  withdraw: async (branchId: string, currency: string, amount: number, userId: string) => {
    if (amount <= 0) throw new Error("Withdrawal amount must be > 0");
    return branchService.adjustBalance(branchId, currency, -amount, userId, 'WITHDRAWAL');
  }
};
