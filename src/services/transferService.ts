import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transfer, TransferStatus } from '../types';
import { handleFirestoreError } from './errorService';

export const transferService = {
  create: async (transfer: Omit<Transfer, 'issuedAt' | 'issuedBy' | 'status'>, userId: string) => {
    try {
      const batch = writeBatch(db);
      
      const transferRef = doc(collection(db, 'transfers'));
      batch.set(transferRef, {
        ...transfer,
        status: 'pending',
        issuedBy: userId,
        issuedAt: serverTimestamp(),
      });
      
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: 'TRANSFER_CREATED',
        entityId: transferRef.id,
        entityType: 'transfer',
        amount: transfer.amount,
        currency: transfer.currency,
        exchangeRate: transfer.exchangeRate,
        senderDetails: {
          name: transfer.senderName,
          phone: transfer.senderPhone
        },
        receiverDetails: {
          name: transfer.receiverName,
          phone: transfer.receiverPhone
        },
        userId,
        timestamp: serverTimestamp(),
      });
      
      await batch.commit();
      return transferRef.id;
    } catch (error) {
      handleFirestoreError(error, 'write', 'transfers');
      return null;
    }
  },

  receive: async (transferId: string, userId: string, transferData: Transfer, receiveDetails?: { receiverIdType: string, receiverIdNumber: string, notes: string }) => {
    try {
      const batch = writeBatch(db);
      
      const transferRef = doc(db, 'transfers', transferId);
      const updates: Record<string, unknown> = {
        status: 'received',
        receivedBy: userId,
        receivedAt: serverTimestamp(),
      };
      if (receiveDetails) {
        updates.receiverIdType = receiveDetails.receiverIdType;
        updates.receiverIdNumber = receiveDetails.receiverIdNumber;
        if (receiveDetails.notes) updates.notes = receiveDetails.notes;
      }
      batch.update(transferRef, updates);
      
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: 'TRANSFER_RECEIVED',
        entityId: transferId,
        entityType: 'transfer',
        amount: transferData.amount,
        currency: transferData.currency,
        exchangeRate: transferData.exchangeRate,
        senderDetails: {
          name: transferData.senderName,
          phone: transferData.senderPhone
        },
        receiverDetails: {
          name: transferData.receiverName,
          phone: transferData.receiverPhone
        },
        userId,
        timestamp: serverTimestamp(),
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'update', `transfers/${transferId}`);
    }
  },

  updateStatus: async (transferId: string, status: TransferStatus, notes: string | undefined, userId: string, transferData: Transfer) => {
    try {
      const batch = writeBatch(db);
      
      const docRef = doc(db, 'transfers', transferId);
      const updates: Record<string, unknown> = { status };
      if (notes !== undefined) updates.notes = notes;
      batch.update(docRef, updates);
      
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: `TRANSFER_STATUS_CHANGED_${status.toUpperCase()}`,
        entityId: transferId,
        entityType: 'transfer',
        amount: transferData.amount,
        currency: transferData.currency,
        exchangeRate: transferData.exchangeRate,
        details: { notes },
        userId,
        timestamp: serverTimestamp(),
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'update', `transfers/${transferId}`);
    }
  },

  cancel: async (transferId: string, userId: string, transferData: Transfer) => {
    try {
      const batch = writeBatch(db);
      
      const docRef = doc(db, 'transfers', transferId);
      batch.update(docRef, { status: 'cancelled' });
      
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: 'TRANSFER_CANCELLED',
        entityId: transferId,
        entityType: 'transfer',
        amount: transferData.amount,
        currency: transferData.currency,
        exchangeRate: transferData.exchangeRate,
        userId,
        timestamp: serverTimestamp(),
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'update', `transfers/${transferId}`);
    }
  },

  subscribeToBranchTransfers: (branchId: string, isAdministrator: boolean, isSupervisor: boolean, callback: (transfers: Transfer[]) => void) => {
    const transfersRef = collection(db, 'transfers');
    
    if (isAdministrator || isSupervisor) {
      const q = query(transfersRef, orderBy('issuedAt', 'desc'));
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

    // Teller: merge inbound + outbound (Firestore has no OR across fields)
    if (!branchId) {
      callback([]);
      return () => {};
    }

    const qFrom = query(transfersRef, where('fromBranchId', '==', branchId), orderBy('issuedAt', 'desc'));
    const qTo = query(transfersRef, where('toBranchId', '==', branchId), orderBy('issuedAt', 'desc'));

    let fromTransfers: Transfer[] = [];
    let toTransfers: Transfer[] = [];
    let fromLoaded = false;
    let toLoaded = false;

    const emit = () => {
      if (!fromLoaded || !toLoaded) return;
      const map = new Map<string, Transfer>();
      [...fromTransfers, ...toTransfers].forEach(t => {
        if (t.id) map.set(t.id, t);
      });
      const merged = Array.from(map.values()).sort((a, b) => {
        const aTime = a.issuedAt?.toMillis?.() ?? 0;
        const bTime = b.issuedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
      callback(merged);
    };

    const unsubFrom = onSnapshot(qFrom, (snap) => {
      fromTransfers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transfer));
      fromLoaded = true;
      emit();
    }, (error) => {
      console.error("Error subscribing to outbound transfers", error);
      fromLoaded = true;
      emit();
    });

    const unsubTo = onSnapshot(qTo, (snap) => {
      toTransfers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transfer));
      toLoaded = true;
      emit();
    }, (error) => {
      // Missing composite index (toBranchId + issuedAt) will surface here
      console.error("Error subscribing to inbound transfers (check Firestore index for toBranchId+issuedAt)", error);
      toLoaded = true;
      emit();
    });

    return () => {
      unsubFrom();
      unsubTo();
    };
  }
};
