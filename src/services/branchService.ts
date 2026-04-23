import { 
  collection, 
  getDocs, 
  onSnapshot 
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
    }
  },

  subscribeToBranches: (callback: (branches: Branch[]) => void) => {
    return onSnapshot(collection(db, 'branches'), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });
  }
};
