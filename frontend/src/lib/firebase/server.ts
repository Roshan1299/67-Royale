import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length === 0) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin credentials. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env vars.');
      }

      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error) {
      console.error('[Firebase Admin] Initialization error:', error);
      throw error;
    }
  }
  return getApps()[0];
}

// Get Firestore instance (server-side)
export function getDb(): Firestore {
  return getFirestore(getAdminApp());
}

// Get Auth instance (server-side)
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

// Verify Firebase ID token from request Authorization header
export async function verifyAuthToken(request: Request): Promise<{
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
} | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[verifyAuthToken] No Bearer token in Authorization header');
    return null;
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      console.error('[verifyAuthToken] Invalid token value:', token);
      return null;
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      displayName: decoded.name || decoded.email || 'Anonymous',
      photoURL: decoded.picture || null,
      email: decoded.email || null,
    };
  } catch (error) {
    console.error('[verifyAuthToken] Token verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
