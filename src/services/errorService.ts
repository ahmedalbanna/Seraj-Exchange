import { auth } from '../lib/firebase';
import { logger } from '../lib/logger';

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const firebaseError = error as { code: string; message: string };
  const user = auth.currentUser;
  const baseCtx = {
    path,
    operationType,
    userId: user?.uid || 'anonymous',
    extra: { code: firebaseError?.code, message: firebaseError?.message } as Record<string, unknown>,
  };

  if (firebaseError?.code === 'permission-denied') {
    const errorInfo: FirestoreErrorInfo = {
      error: firebaseError.message,
      operationType,
      path,
      authInfo: {
        userId: user?.uid || 'anonymous',
        email: user?.email || 'none',
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || true,
        providerInfo: user?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || '',
        })) || [],
      }
    };
    logger.error(`Firestore permission-denied at ${path || 'unknown'}`, baseCtx);
    throw new Error(JSON.stringify(errorInfo));
  }

  // Non-permission errors also structured
  if (firebaseError?.code) {
    logger.error(`Firestore error ${firebaseError.code} at ${path || 'unknown'}`, baseCtx);
  } else {
    logger.error(`Unknown Firestore error at ${path || 'unknown'}`, { ...baseCtx, extra: { error: String(error) } });
  }

  throw error;
}
