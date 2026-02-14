import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length === 0) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
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
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      displayName: decoded.name || decoded.email || 'Anonymous',
      photoURL: decoded.picture || null,
      email: decoded.email || null,
    };
  } catch {
    return null;
  }
}
