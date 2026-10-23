/**
 * Version av integritetspolicyn som användaren godkänner. Höjs den (t.ex. när policyn ändras i sak)
 * får alla frågan igen vid nästa inloggning. Datumet ska följa texten på /integritet.
 */
export const CONSENT_VERSION = '2026-10-23';

export interface Consent {
  version: string;
}

export function hasCurrentConsent(consent: Consent | undefined): boolean {
  return consent?.version === CONSENT_VERSION;
}

const POSTPONED_KEY = 'okeken:consentPostponed';

// sessionStorage: "Fråga senare" gäller bara tills fliken stängs eller användaren loggar ut,
// så den som inte godkänt får frågan igen vid nästa inloggning.
export function postponed(): boolean {
  try {
    return sessionStorage.getItem(POSTPONED_KEY) === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function setPostponed(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(POSTPONED_KEY, CONSENT_VERSION);
    else sessionStorage.removeItem(POSTPONED_KEY);
  } catch {
    // Utan lagring frågas användaren bara igen vid nästa sidladdning
  }
}
