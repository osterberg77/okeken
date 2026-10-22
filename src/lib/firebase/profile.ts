import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { prepareAvatar } from '../image-resize';
import { setPostponed } from '../consent';
import { app, auth, db } from './client';
import { setRememberedSignIn } from './flags';
import { storage } from './storage';

function functions() {
  const fns = getFunctions(app, 'europe-north1');
  const g = globalThis as { __okekenFunctionsEmulator?: boolean };
  if (import.meta.env.PUBLIC_FIREBASE_EMULATORS === 'true' && !g.__okekenFunctionsEmulator) {
    g.__okekenFunctionsEmulator = true;
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  }
  return fns;
}

function currentUser() {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('not signed in'), { code: 'auth/requires-recent-login' });
  return user;
}

/** Har kontot ett lösenord (även e-postlänk-konton får ett om de valt det)? Google-konton saknar det. */
export function hasPasswordLogin(): boolean {
  return !!auth.currentUser?.providerData.some((p) => p.providerId === 'password');
}

export function usesGoogle(): boolean {
  return !!auth.currentUser?.providerData.some((p) => p.providerId === 'google.com');
}

/** Bekräftar med nuvarande lösenord (krävs av Firebase för känsliga ändringar). */
async function confirmPassword(password: string): Promise<void> {
  const user = currentUser();
  if (!user.email) throw new Error('no email');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

export interface ProfileFields {
  displayName: string;
  avatarColor: string;
  hideNameInRsvp: boolean;
}

export async function saveProfile(uid: string, fields: ProfileFields): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...fields });
  const user = auth.currentUser;
  if (user && user.displayName !== fields.displayName) await updateProfile(user, { displayName: fields.displayName });
}

/** Skalar till 256 px JPEG, laddar upp till avatars/<uid>.jpg och sparar adressen på användaren. */
export async function uploadAvatar(uid: string, file: File): Promise<void> {
  const blob = await prepareAvatar(file);
  const fileRef = ref(storage, `avatars/${uid}.jpg`);
  // Fast filnamn som skrivs över när bilden byts: kort cachetid så att en ny bild syns inom några minuter
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=300' });
  await updateDoc(doc(db, 'users', uid), { photoUrl: await getDownloadURL(fileRef) });
}

export async function removeAvatar(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { photoUrl: '' });
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`));
  } catch {
    // Filen fanns inte (redan borttagen)
  }
}

/** Skickar en bekräftelselänk till den nya adressen; adressen byts först när länken klickats. */
export async function requestEmailChange(newEmail: string, password: string): Promise<void> {
  await confirmPassword(password);
  await verifyBeforeUpdateEmail(currentUser(), newEmail, { url: new URL('/profil', location.origin).href });
}

export async function changePassword(current: string, next: string): Promise<void> {
  await confirmPassword(current);
  await updatePassword(currentUser(), next);
}

/** Tar tillbaka godkännandet av integritetspolicyn; användaren får frågan igen vid nästa inloggning. */
export async function withdrawConsent(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { consent: deleteField() });
  setPostponed(false);
}

/** Raderar kontot och dess uppgifter permanent (Cloud Function deleteMyAccount) och loggar ut. */
export async function deleteAccount(password: string | null): Promise<void> {
  if (password !== null) await confirmPassword(password);
  const call = httpsCallable<void, { ok: true }>(functions(), 'deleteMyAccount', { timeout: 120_000 });
  await call();
  setRememberedSignIn(false);
  setPostponed(false);
  await firebaseSignOut(auth).catch(() => {});
}
