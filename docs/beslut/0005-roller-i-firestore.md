# 0005 – Roller i Firestore i stället för custom claims

**Kontext:** Behörigheter kopplas på vanliga konton och ska kunna tilldelas från en admin-sida (superadmin allt, styrelse ett urval). Liten klubb, få användare, låg trafik.

**Beslut:** Behörigheter lagras i `users/{uid}.permissions` och kontrolleras i `firestore.rules`/`storage.rules` med `get()`. Admin-sidan skriver direkt till dokumentet; reglerna uttrycker delegeringen.

**Konsekvenser:** Ingen Cloud Function för tilldelning, ingen claims-synk, ändringar gäller direkt (ingen tokenförnyelse). Kostnad: en extra dokumentläsning per regelkontroll, försumbart vid klubbens volym. Delegeringsreglerna är den känsliga delen och ska täckas av regeltester.
