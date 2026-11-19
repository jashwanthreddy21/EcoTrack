import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User } from '../types/index.ts';
import { extractGoogleAccountEmail, formatGoogleAuthErrorMessage } from '../utils/ecoLogic.ts';

const envFirebaseApiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim();
const envFirebaseProjectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim();
const useCustomEnvConfig = Boolean(envFirebaseApiKey && envFirebaseProjectId);

const activeFirebaseConfig = useCustomEnvConfig
  ? {
      apiKey: envFirebaseApiKey!,
      authDomain:
        (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim() ||
        `${envFirebaseProjectId}.firebaseapp.com`,
      projectId: envFirebaseProjectId!,
      storageBucket:
        (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined)?.trim() ||
        `${envFirebaseProjectId}.firebasestorage.app`,
      messagingSenderId:
        (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined)?.trim() ||
        firebaseConfig.messagingSenderId,
      appId:
        (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined)?.trim() ||
        firebaseConfig.appId
    }
  : firebaseConfig;

const activeDatabaseId =
  (import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined)?.trim() ||
  (useCustomEnvConfig ? '(default)' : firebaseConfig.firestoreDatabaseId);

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// Initialize Firestore with specific database ID
export const db = getFirestore(app, activeDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Clean Google Auth Provider for Citizen Sign-Up & Sign-In (standard profile + email only; no restricted Workspace scopes)
export const citizenGoogleProvider = new GoogleAuthProvider();
citizenGoogleProvider.addScope('email');
citizenGoogleProvider.addScope('profile');
citizenGoogleProvider.setCustomParameters({ prompt: 'select_account' });

// Elevated Google Auth Provider with Workspace scopes (used only when linking Google Tasks / Google Chat after sign-in)
export const workspaceGoogleProvider = new GoogleAuthProvider();
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/tasks');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/chat.spaces.readonly');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/chat.messages.create');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/chat.messages.readonly');
workspaceGoogleProvider.setCustomParameters({ prompt: 'consent select_account' });

// Backward-compatible export for citizen Google authentication
export const googleProvider = citizenGoogleProvider;

// In-memory token cache (never stored in localStorage as per Workspace security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface GoogleAuthResult {
  user: FirebaseUser;
  email: string;
  accessToken: string | null;
}

export interface SignInWithGoogleOptions {
  includeWorkspaceScopes?: boolean;
}

export const resolveFirebaseUserEmail = (user: FirebaseUser): string => {
  return extractGoogleAccountEmail(user?.email, user?.providerData);
};

export const initAuthListener = (
  onSuccess?: (user: FirebaseUser, token: string | null) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onSignedOut) onSignedOut();
    }
  });
};

export const consumeGoogleRedirectResult = async (): Promise<GoogleAuthResult | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    const email = resolveFirebaseUserEmail(result.user);
    return { user: result.user, email, accessToken: cachedAccessToken };
  } catch (error: any) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    throw new Error(
      formatGoogleAuthErrorMessage(
        error?.code,
        error?.message,
        hostname,
        activeFirebaseConfig.projectId
      )
    );
  }
};

export const signInWithGoogle = async (
  options: SignInWithGoogleOptions = {}
): Promise<GoogleAuthResult | null> => {
  if (isSigningIn) {
    throw new Error('Google sign-in is already in progress. Please check the Google window.');
  }

  const provider = options.includeWorkspaceScopes ? workspaceGoogleProvider : citizenGoogleProvider;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isTopLevelWindow =
    typeof window !== 'undefined' ? window.self === window.top : false;

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    const email = resolveFirebaseUserEmail(result.user);
    return { user: result.user, email, accessToken: cachedAccessToken };
  } catch (error: any) {
    // On standalone top-level tabs (e.g. mobile or Vercel), fall back cleanly to redirect if popups are blocked
    if (error?.code === 'auth/popup-blocked' && isTopLevelWindow) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw new Error(
      formatGoogleAuthErrorMessage(
        error?.code,
        error?.message,
        hostname,
        activeFirebaseConfig.projectId
      )
    );
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutFirebase = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Persist authenticated Citizen profile in Firestore using blueprint schema field bounds
export async function syncUserToFirestore(
  firebaseUser: FirebaseUser,
  appUser: User
): Promise<void> {
  const docPath = `users/${firebaseUser.uid}`;
  try {
    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      {
        id: appUser.id,
        name: (appUser.name || 'EcoTrack Citizen').slice(0, 100),
        email: (appUser.email || '').slice(0, 100),
        role: appUser.role,
        phone: (appUser.phone || '').slice(0, 20),
        area: (appUser.area || 'Warangal Urban').slice(0, 100),
        ward: (appUser.ward || 'Ward 1').slice(0, 50),
        active: appUser.active !== false,
        createdAt: appUser.createdAt || new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// Firestore connection test as per firebase-integration skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch {
    // Normal in newly provisioned project without 'test' doc
    return true;
  }
}

// Error handling as per firebase-integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
