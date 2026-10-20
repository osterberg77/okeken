// Ingen Firebase-import här: används av headern för att avgöra om Firebase ska laddas alls.

const SIGNED_IN_KEY = 'okeken:signedIn';

export function rememberedSignIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRememberedSignIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Privat läge e.d. – headern visar då "Logga in" tills sidan laddat sessionen.
  }
}

/** Säker intern sökväg att skicka användaren till efter inloggning */
export function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
