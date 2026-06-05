import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Define the operation enum as instructed by skills guide
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Global references — initialized synchronously from the bundled config
let isFirebaseAvailable = false;
let db: any = null;
let auth: any = null;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);
    auth = getAuth(app);
    isFirebaseAvailable = true;
  }
} catch (e) {
  console.warn("Firebase initialization failed:", e);
}

export { isFirebaseAvailable, db, auth };

// Structured Firestore error mapper as strictly mandated by skills guide
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Hardened Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Google Pop-up Authentication helper helper
export async function signInWithGoogle(): Promise<User | null> {
  if (!isFirebaseAvailable || !auth) {
    throw new Error("Firebase auth services are not yet available. Please configure Firebase via Settings.");
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Auth popup completed with error:", error);
    throw error;
  }
}

// Signs out active user session
export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}
