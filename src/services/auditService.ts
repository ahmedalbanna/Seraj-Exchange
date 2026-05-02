import { collection, query, orderBy, onSnapshot, getDocs, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLog } from '../types';

export const auditService = {
  subscribeToAuditLogs: (callback: (logs: AuditLog[]) => void, limitCount: number = 100) => {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
      callback(logs);
    }, (error) => {
      console.error("Error subscribing to audit logs", error);
    });
  },
  
  getLogsByEntity: async (entityId: string, entityType: string) => {
    const q = query(
      collection(db, 'audit_logs'),
      where('entityId', '==', entityId),
      where('entityType', '==', entityType),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AuditLog));
  }
};
