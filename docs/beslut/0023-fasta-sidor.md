# 0023 – Fasta sidor med redigerbar text

**Kontext:** `/ute` och `/medlemsavgift` är routes med inbyggda widgetar (formulär). Texten var hårdkodad, men klubben vill själv kunna ändra rubrik och ingress (Erik 2026-10-24). Markdown behövs inte, men den vanliga sideditorn duger.

**Beslut:**
- En fast sida är en **vanlig infosida** i `pages` vars adress är en av `FIXED_PAGE_SLUGS` (`src/lib/slug.ts`): `ute` och `medlemsavgift`. Ingen ny collection, inget nytt fält och ingen ny adminsida; `/admin/sidor` märker dem med "Fast sida".
- Routen (`ute.astro`, `medlemsavgift.astro`) hämtar sidans publicerade titel och text med `getFixedPage()` och skickar dem till widgeten som `title` och `introHtml`. Utan publicerad sida används standardtexten, så QR-koden och betalningslänken går aldrig sönder.
- `[slug].astro` hoppar över de fasta adresserna. Adresserna är **reserverade** i `RESERVED_PAGE_SLUGS` och `firestore.rules`, så ingen kan skapa dem för hand. Dokumenten skapas en gång med `scripts/seed-fixed-pages.mjs` (Admin SDK, redan publicerade).
- Adressen är låst efter publicering och en publicerad sida kan inte raderas (befintliga regler), så skylten med QR-koden kan inte förlora sin adress. Avpublicering ger standardtexten.
- Widgeten väljs av routen och kan inte ändras i admin. Vill vi senare lägga en widget på en vanlig sida får sidan ett fält `widget`; det är inte byggt.

**Att veta:**
- Kör `node scripts/seed-fixed-pages.mjs` en gång mot produktion och deploya reglerna (`ute` blev reserverad).
- Publicerad text slår igenom vid nästa bygge, som för alla sidor.
