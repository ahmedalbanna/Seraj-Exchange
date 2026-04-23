import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError } from './errorService';

export const userService = {
  getAll: async (): Promise<UserProfile[]> => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
    } catch (error) {
      handleFirestoreError(error, 'list', 'users');
    }
  },

  subscribeToUsers: (callback: (users: UserProfile[]) => void) => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      callback(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });
  },

  updateRoleAndBranch: async (userId: string, role: UserRole, branchId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role, branchId });
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${userId}`);
    }
  }
};
