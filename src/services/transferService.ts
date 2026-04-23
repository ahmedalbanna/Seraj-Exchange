import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transfer } from '../types';
import { handleFirestoreError } from './errorService';

export const transferService = {
  create: async (transfer: Omit<Transfer, 'issuedAt' | 'issuedBy' | 'status'>, userId: string) => {
    try {
      const docRef = await addDoc(collection(db, 'transfers'), {
        ...transfer,
        status: 'pending',
        issuedBy: userId,
        issuedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', 'transfers');
    }
  },

  receive: async (transferId: string, userId: string) => {
    try {
      const docRef = doc(db, 'transfers', transferId);
      await updateDoc(docRef, {
        status: 'received',
        receivedBy: userId,
        receivedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `transfers/${transferId}`);
    }
  },

  updateStatus: async (transferId: string, status: TransferStatus, notes?: string) => {
    try {
      const docRef = doc(db, 'transfers', transferId);
      const updates: any = { status };
      if (notes !== undefined) updates.notes = notes;
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, 'update', `transfers/${transferId}`);
    }
  },

  cancel: async (transferId: string) => {
    try {
      const docRef = doc(db, 'transfers', transferId);
      await updateDoc(docRef, {
        status: 'cancelled',
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `transfers/${transferId}`);
    }
  },

  subscribeToBranchTransfers: (branchId: string, isAdmin: boolean, callback: (transfers: Transfer[]) => void) => {
    const transfersRef = collection(db, 'transfers');
    
    let q;
    if (isAdmin) {
      q = query(transfersRef, orderBy('issuedAt', 'desc'));
    } else {
      q = query(
        transfersRef, 
        where('fromBranchId', '==', branchId), 
        orderBy('issuedAt', 'desc')
      );
    }

    return onSnapshot(q, (snapshot) => {
      const transfers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transfer));
      callback(transfers);
    }, (error) => {
      console.error("Error subscribing to transfers", error);
    });
  }
};
