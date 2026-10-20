# OK Eken – funktions- och innehållskrav (från Erik, 2026-10-18)

Ren informationsinsamling inför prototypbygget – inget som ändrar designförslagen just nu.

## 1. Eventdetalj med kontrolltema
- Kontroll-/orienteringssymbol högst upp i eventet som visar **när eventet är aktivt** – start och slut, inte bara ett datum.
- Typfall: träning tisdag, banorna hänger ute till söndag → ska synas som en period.
- Möjlighet att **ladda ner banor** (som på nuvarande okeken.se).

## 2. Roller och behörigheter
- Nivåer: **gäst**, **medlem**, **banläggare**, **publicerare**, **styrelse**, **superadmin**.
- Inte en enkel admin/ej-admin-modell: funktioner (behörigheter) kopplas på vanliga konton, ett konto kan ha flera.
- Superadmin slår på de funktioner man vill ha per konto.
- Oklart om "admin" behövs alls – styrelse kan ersätta det. (Beslut 2026-10-20: ingen separat admin.)

## 3. Automatisering vid publicering
- När bana/träning läggs upp ska systemet underlätta kopplingar till **sociala medier** (t.ex. Facebook).
- Stöd för **Livelox** (banor, banreplays). (Parkerat 2026-10-20: inga öppna API:er.)

## 4. Närvaroregistrering på träningar
- Ersätter dagens papperslappar.
- Interaktiv lista över vilka som deltagit på varje träning.
- Man kan **registrera sig i efterhand** och ange sin **tid**, valfritt publicera den.
- Tänkt kiosk-läge: dator/platta vid träningen där man skriver in sig.

## Frågor att ta ställning till senare
- Datamodell för event med start/slut + banor (Firebase).
- Hur gäster/icke-medlemmar ska registreras vid närvaro (namn utan konto?).
- Livelox- och sociala medier-API:er: vad är möjligt vs. förifylld länk/text.
