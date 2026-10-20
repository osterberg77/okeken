import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { PERMISSIONS, type Permission, type Session } from '../../types/user';
import { auth, db } from './client';
import { setRememberedSignIn } from './flags';

const EMAIL_KEY = 'okeken:emailForSignIn';

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Skapar users/{uid} utan behörigheter vid första inloggningen (se firestore.rules). */
async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, {
    displayName: user.displayName ?? '',
    email: user.email,
    permissions: [],
    createdAt: serverTimestamp(),
  });
}

export async function signInWithGoogle(): Promise<void> {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureUserDoc(user);
  setRememberedSignIn(true);
}

export async function sendEmailLink(email: string, next: string): Promise<void> {
  const url = new URL('/logga-in', location.origin);
  if (next !== '/') url.searchParams.set('next', next);
  await sendSignInLinkToEmail(auth, email, { url: url.href, handleCodeInApp: true });
  storage()?.setItem(EMAIL_KEY, email);
}

export function isEmailLink(): boolean {
  return isSignInWithEmailLink(auth, location.href);
}

/** E-postadressen som länken skickades till, om den öppnas i samma webbläsare */
export function pendingEmail(): string | null {
  return storage()?.getItem(EMAIL_KEY) ?? null;
}

export async function completeEmailLink(email: string): Promise<void> {
  const { user } = await signInWithEmailLink(auth, email, location.href);
  storage()?.removeItem(EMAIL_KEY);
  await ensureUserDoc(user);
  setRememberedSignIn(true);
}

export async function signOut(): Promise<void> {
  setRememberedSignIn(false);
  await firebaseSignOut(auth);
}

function toPermissions(value: unknown): Permission[] {
  return Array.isArray(value) ? value.filter((p): p is Permission => PERMISSIONS.includes(p)) : [];
}

/** Följer inloggning och behörigheter. Anropar med null när ingen är inloggad. */
export function watchSession(callback: (session: Session | null) => void): () => void {
  let stopProfile = () => {};
  const stopAuth = onAuthStateChanged(auth, (user) => {
    stopProfile();
    if (!user) {
      setRememberedSignIn(false);
      callback(null);
      return;
    }
    setRememberedSignIn(true);
    const base = { uid: user.uid, email: user.email ?? '', displayName: user.displayName ?? '' };
    stopProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data();
        callback({ ...base, displayName: data?.displayName || base.displayName, permissions: toPermissions(data?.permissions) });
      },
      () => callback({ ...base, permissions: [] }),
    );
  });
  return () => {
    stopProfile();
    stopAuth();
  };
}
