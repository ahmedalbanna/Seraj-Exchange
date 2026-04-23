import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  doc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification } from '../types';
import { handleFirestoreError } from './errorService';

export const notificationService = {
  subscribeToNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
  },

  createNotification: async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'notifications');
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      handleFirestoreError(error, 'update', `notifications/${notificationId}`);
    }
  },

  markAllAsRead: async (userId: string) => {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { read: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'update', 'notifications');
    }
  },

  sendToRole: async (role: string, notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'>) => {
    try {
      const usersQ = query(collection(db, 'users'), where('role', '==', role));
      const usersSnap = await getDocs(usersQ);
      const batch = writeBatch(db);
      usersSnap.docs.forEach(userDoc => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          ...notification,
          userId: userDoc.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'create', 'notifications');
    }
  },

  sendToBranchManagers: async (branchId: string, notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'>) => {
    try {
      const usersQ = query(
        collection(db, 'users'), 
        where('branchId', '==', branchId),
        where('role', 'in', ['manager', 'admin'])
      );
      const usersSnap = await getDocs(usersQ);
      const batch = writeBatch(db);
      usersSnap.docs.forEach(userDoc => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          ...notification,
          userId: userDoc.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'create', 'notifications');
    }
  }
};
