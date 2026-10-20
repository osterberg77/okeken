import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// Webbappens konfiguration är publik; skyddet ligger i säkerhetsreglerna.
const config = {
  apiKey: 'AIzaSyBnEE_ZPZPK88pZYKXYHf8699BFlyunyz0',
  authDomain: 'okeken.firebaseapp.com',
  projectId: 'okeken',
  storageBucket: 'okeken.firebasestorage.app',
  messagingSenderId: '1034481154088',
  appId: '1:1034481154088:web:0e48eae28f5ded5e73dd1d',
};

export const app = getApps()[0] ?? initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
auth.languageCode = 'sv';

// `PUBLIC_FIREBASE_EMULATORS=true npm run dev` + `npm run emulators` för lokal utveckling
const g = globalThis as { __okekenEmulators?: boolean };
if (import.meta.env.PUBLIC_FIREBASE_EMULATORS === 'true' && !g.__okekenEmulators) {
  g.__okekenEmulators = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
}
