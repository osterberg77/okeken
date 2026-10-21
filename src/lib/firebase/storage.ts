import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { app } from './client';

export const storage = getStorage(app);

const g = globalThis as { __okekenStorageEmulator?: boolean };
if (import.meta.env.PUBLIC_FIREBASE_EMULATORS === 'true' && !g.__okekenStorageEmulator) {
  g.__okekenStorageEmulator = true;
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
