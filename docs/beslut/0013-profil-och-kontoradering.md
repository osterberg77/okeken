# 0013 – Profil, inställningar och radering av konto

**Kontext:** Användare ska kunna hantera sitt eget konto: profil, e-post, lösenord, integritetsval, bild och färg, och ta bort kontot permanent (Erik 2026-10-22). Behöver också följa rätten till radering i GDPR.

**Beslut:**
- **Sida:** `/profil` (`ProfilePage`, klientsida, kräver inloggning), länkad från kontomenyn. Fyra kort: Profil (namn, färg, bild), Inloggning (byt e-post och lösenord), Integritet (standardval för namn i svar, status för godkännande, ta tillbaka godkännandet) och Ta bort kontot.
- **Profilfält på `users/{uid}`:** `avatarColor` (id ur en fast palett i `src/lib/avatar.ts`, speglad i reglerna), `photoUrl` (token-URL till `avatars/<uid>.jpg`, tom sträng = ingen), `hideNameInRsvp` (bool). Användaren får bara ändra dessa och `displayName` på sitt eget dokument, aldrig behörigheter; ingen annan kan ändra dem, inte heller styrelsen. Regler: `firestore.rules`, tester i `tests/rules/firestore.test.ts`.
- **Profilbild:** klienten beskär till kvadrat, 256 px JPEG. Storage `avatars/<uid>.jpg`: bara ägaren skriver och raderar, JPEG högst 500 kB; inloggade får hämta. Bilden visas via token-URL (som bildbankens bilder, beslut 0007), så den som har länken kan se den tills filen raderas.
- **Byte av e-post:** `verifyBeforeUpdateEmail` (bekräftelselänk till den nya adressen, kräver nuvarande lösenord). När inloggningen fått den nya adressen synkar klienten `users.email`; reglerna tillåter bara en e-poständring som är lika med den bekräftade adressen i token. Konton som loggar in med Google byter adress hos Google. Konton utan lösenord får en länk för att välja ett först.
- **Lösenordsbyte:** `reauthenticateWithCredential` + `updatePassword`.
- **Ta tillbaka godkännande:** användaren tar bort sitt eget `consent`-fält (regel); frågan kommer igen vid nästa inloggning, se beslut 0011.
- **Radering:** Cloud Function `deleteMyAccount` (callable, europe-north1, Admin SDK) i `functions/src/delete-account.ts`. Kräver inloggning som är högst 10 minuter gammal (klienten bekräftar lösenordet precis före) och att användaren skrivit "RADERA". Raderar i ordning: svar på events (`rsvps/*/responses/<uid>`), profilbilden, `users/<uid>`, inloggningskontot sist, så att ett avbrott går att köra om. Sista superadmin kan inte radera sig själv. Tester mot Auth-, Firestore- och Storage-emulatorerna i `tests/server/delete-account.test.ts` (körs av `npm run test:rules`).

**Vad som blir kvar vid radering (medvetet):**
- uid i `createdBy`/`updatedBy`/`uploadedBy` på events, sidor, bilder m.m.: utan användardokument och konto går ett uid inte att koppla till en person.
- Styrelsens protokoll (närvaro, att göra, sekreterare/justerare, omnämnanden) med de namn som stod där när de skrevs: det är föreningens handlingar. Behöver styrelsen ändå ta bort ett namn görs det manuellt av superadmin.
- Fritext som andra skrivit, t.ex. banläggarens namn på ett event, rensas inte automatiskt. Säg till i så fall så ändrar en publicerare texten.

**Konsekvenser / öppet:**
- Radering av en användare som styrelsen vill "ta bort" (inte användaren själv) finns inte; superadmin får göra det i Firebase-konsolen. Policyn lovar radering på begäran.
- Ingen "ladda ner mina uppgifter" i appen än; kopia ges på begäran via e-post (se policyn).
- Profilbilder visas bara på profilsidan och i kontomenyn. Visning bredvid namn i listor kan läggas till senare.
- Ny `getFunctions`-klient pekar på Functions-emulatorn när `PUBLIC_FIREBASE_EMULATORS=true`, så att raderingen går att prova lokalt.
