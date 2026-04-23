import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Settlement, Transfer } from '../types';
import { handleFirestoreError } from './errorService';

export const settlementService = {
  createSettlement: async (settlement: Omit<Settlement, 'settledAt' | 'status'>) => {
    try {
      await addDoc(collection(db, 'settlements'), {
        ...settlement,
        status: 'completed',
        settledAt: serverTimestamp(),
      });
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
