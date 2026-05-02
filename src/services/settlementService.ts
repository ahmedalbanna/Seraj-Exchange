import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Settlement, Transfer } from '../types';
import { handleFirestoreError } from './errorService';

export const settlementService = {
  createSettlement: async (settlement: Omit<Settlement, 'settledAt' | 'status'>, userId: string) => {
    try {
      const batch = writeBatch(db);
      
      const settlementRef = doc(collection(db, 'settlements'));
      batch.set(settlementRef, {
        ...settlement,
        status: 'completed',
        settledAt: serverTimestamp(),
      });
      
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: 'SETTLEMENT_CREATED',
        entityId: settlementRef.id,
        entityType: 'settlement',
        amount: settlement.amount,
        currency: settlement.currency,
        exchangeRate: settlement.appliedRate,
        details: {
          fromBranchId: settlement.fromBranchId,
          toBranchId: settlement.toBranchId,
          settledAmount: settlement.settledAmount,
        },
        userId,
        timestamp: serverTimestamp(),
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'create', 'settlements');
    }
  },

  subscribeToSettlements: (callback: (settlements: Settlement[]) => void) => {
    return onSnapshot(collection(db, 'settlements'), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Settlement)));
    });
  },

  getOutstandingBalances: async (fromBranchId: string, toBranchId: string) => {
    try {
      const q = query(
        collection(db, 'transfers'), 
        where('fromBranchId', '==', fromBranchId),
        where('toBranchId', '==', toBranchId),
        where('status', 'in', ['pending', 'processing'])
      );
      
      const snap = await getDocs(q);
      const transfers = snap.docs.map(d => d.data() as Transfer);
      
      const balances: Record<string, number> = {};
      transfers.forEach(t => {
        balances[t.currency] = (balances[t.currency] || 0) + t.amount;
      });
      
      return balances;
    } catch (error) {
      handleFirestoreError(error, 'list', 'transfers');
    }
  }
};
