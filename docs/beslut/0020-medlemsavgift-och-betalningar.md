# 0020 – Medlemsavgift och medlemsbetalningar

**Kontext:** Klubben vill att den som blir medlem kan fylla i vilka som ingår (t.ex. en familj), få avgiften uträknad och betala med Swish, medan kassören ser betalningarna i systemet och prickar av dem. På sikt ska systemet själv hålla koll på vem som betalat för året (2026-10-23).

**Beslut:**
- **Avgiftstabell:** `membershipFees/{år}` med Swish-nummer, avgiftsklasser (namn, kronor, förklaring) och valfritt familjetak (från `minPeople` personer med högst `maxAdults` vuxna kostar det aldrig mer än `amount`; klasser markeras som vuxna med `adult`). Förval när inget år är sparat: Vuxen 200 kr, Ungdom t.o.m. 16 år 100 kr, familj (1–2 vuxna + barn) 450 kr. Att barnen är hemmaboende kontrolleras inte. Publik läsning, bara styrelse och superadmin skriver. Ett nytt år i adminvyn utgår från förra årets tabell.
- **Betalningar:** `membershipPayments/{id}` med år, referenskod (`OKE-XXXX`), betalare, personer (namn + klass), belopp, `status` (`pending` | `paid` | `cancelled`), `source` (`web` | `manual`). Webbetalningar skapas bara av Function `createMembershipPayment` (öppen för alla, även utloggade), som **räknar beloppet själv** från tabellen och kopplar till kontot om besökaren är inloggad. Klienter kan inte skapa webbetalningar, så ingen kan sätta sitt eget pris.
- **Swish utan avtal:** QR-sträng `C<nummer>;<belopp>;<meddelande>;0` och länk `swish://payment?data=…` (samma format som Coworken, Swish QR-spec). Meddelandet innehåller referenskoden. Ingen automatisk betalbekräftelse: betalningen står som väntande tills styrelsen markerar den betald mot kontoutdraget. Swish Handel-API (avtal, certifikat) valdes bort som för stort.
- **Behörighet:** styrelse och superadmin (`canManageMembership`). Ingen ny roll. Betalaren kan läsa sin egen betalning.
- **Status per person och år:** härleds ur betalningarna ("Vem har betalat?"), ingen egen collection. Manuell registrering (kontant, bank, tidigare system) skapar en betald betalning med `source: manual`.
- **Beroende:** `qrcode.react` (liten, samma som Coworken) för QR-koden.
- **GDPR:** betalningar innehåller namn och valfri e-post. De behålls som bokföringsunderlag; vid kontoradering tas bara `uid` bort (`deleteAccountData`). Betalda betalningar kan inte raderas av klienten.

**Kvar:** koppla personer i betalningar till `members` (uid) och visa "Medlemsavgift betald" på medlemmens profil; påminnelser; export till CSV; en betalning kan ännu inte ändras (belopp/personer) efter skapandet – radera och skapa ny.

**Tillägg 2026-10-24 – Inställningar och startavgift:**
- Admin-sidan heter nu **Inställningar** (`/admin/installningar`, SettingsAdmin; `/admin/medlemsavgift` omdirigeras). Den innehåller Swish-nummer, **startavgift** och medlemsavgiftens klasser/familjetak, per år i `membershipFees/{år}`.
- `startFee` (hela kronor, 0–10000, valfritt fält, 0 = ingen) är förvalt Swish-belopp efter registrering på `/ute` (beslut 0022). Är den 0 visas en helt valfri Swish-länk.
- **Belopp är förifyllda men ändringsbara**: Swish-länken har `amount.editable: true` och QR-strängen mask `2`. Betalningen avprickas mot referenskoden i meddelandet, inte mot beloppet. Masken `2` (belopp ändringsbart) är antagen utifrån Swish QR-specen och ej provad på en riktig telefon.
