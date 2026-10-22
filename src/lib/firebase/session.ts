import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { CONSENT_VERSION, setPostponed } from '../consent';
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

/** Mejl från Firebase (bekräftelse, nytt lösenord) leder tillbaka hit */
function returnToLogin() {
  return { url: new URL('/logga-in', location.origin).href };
}

/**
 * Lösenordskonton måste ha bekräftat e-postadressen innan de får ett users-dokument
 * (se firestore.rules). Obekräftade loggas ut och får ett nytt bekräftelsemejl.
 */
export async function signInWithPassword(email: string, password: string): Promise<'ok' | 'unverified'> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  if (!user.emailVerified) {
    await sendEmailVerification(user, returnToLogin());
    await firebaseSignOut(auth);
    return 'unverified';
  }
  await ensureUserDoc(user);
  setRememberedSignIn(true);
  return 'ok';
}

export async function createAccount(name: string, email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(user, { displayName: name });
  await sendEmailVerification(user, returnToLogin());
  await firebaseSignOut(auth);
}

/** Används både för "Glömt lösenord?" och för att välja lösenord första gången */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email, returnToLogin());
}

/** Sparar att användaren godkänt integritetspolicyn i nuvarande version (se firestore.rules). */
export async function acceptConsent(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { consent: { version: CONSENT_VERSION, acceptedAt: serverTimestamp() } });
}

export async function signOut(): Promise<void> {
  setRememberedSignIn(false);
  setPostponed(false);
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
        const consent = typeof data?.consent?.version === 'string' ? { version: data.consent.version } : undefined;
        callback({ ...base, displayName: data?.displayName || base.displayName, permissions: toPermissions(data?.permissions), consent });
      },
      () => callback({ ...base, permissions: [] }),
    );
  });
  return () => {
    stopProfile();
    stopAuth();
  };
}
