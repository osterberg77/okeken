# CLAUDE.md – OK Eken

Ny hemsida för orienteringsklubben OK Eken (ersätter okeken.se på Wix). Liten klubb, lite trafik: **enkelt och publiceringsvänligt går före fiffigt.**

Läs `docs/plan.md` först. Vid konflikt gäller `docs/plan.md` och `docs/beslut/` före övriga dokument.

## Kärnprinciper

- **Statiskt först.** Alla publika sidor prerenderas av Astro och serveras från Firebase Hosting. Firestore är bara redigeringsbackend. Publicering = rebuild (ca 1–2 min).
- **Besökare ser aldrig opublicerat.** Bygget läser endast publicerad data. Admin/preview är klientsida bakom inloggning, och varje sådan vy använder `StatusBadge`.
- **Säkerhet ligger i reglerna**, inte i UI:t. Varje ny collection/Storage-sökväg kräver regler i `firestore.rules`/`storage.rules` och ett regeltest mot emulatorn.
- **Hemligheter aldrig i repot** (Eventor-nyckel, service account, GitHub-token).
- **Minsta möjliga beroenden och JS.** Fråga innan ett nytt tungt beroende läggs till.

## Konventioner

- Kod, identifierare, filnamn och commits på **engelska**. UI-text och dokumentation på **svenska**.
- Rolldata använder engelska nycklar: `member`, `course_setter`, `publisher`, `board`, `superadmin`.
- Datum/tider: lagra som Firestore-timestamp (UTC), visa alltid i `Europe/Stockholm`. Bygget körs i UTC på GitHub Actions, så ange tidszon explicit vid formatering.
- Markdown renderas med `src/lib/markdown.ts` både i bygget och i preview; rå HTML escapas och bara säkra länkar släpps igenom.
- TypeScript strict. Delade typer för Firestore-dokument på ett ställe (`src/types/`), används av både Astro-bygget och admin.
- Komponenter som visas både publikt och i admin-preview (t.ex. eventdetalj) skrivs **en gång** som React-komponent: Astro renderar den till ren HTML vid build, admin renderar den live. Samma Markdown-renderare på båda sidor.
- Håll `docs/` uppdaterade när implementationen avviker. Nya arkitekturbeslut får en ADR i `docs/beslut/`.

## Kommandon

- `npm run dev` – lokal utveckling
- `npm run build` – statisk build till `dist/`
- `npm run preview` – förhandsgranska bygget
- `npm run check` – typkontroll (`astro check`), kör före commit
- `npm run emulators` – Firebase-emulatorer (Auth, Firestore, Storage, Hosting)
- `npm run test:rules` – regeltester (vitest) mot Firestore-emulatorn; körs också i CI före deploy
- `npm run dev` läser publicerade events från produktionens Firestore (kräver `gcloud auth application-default login`)
- Lokalt mot emulatorer: `npm run emulators` + `npm run dev:emu` (Firestore-emulatorn på port 8180); fyll emulatorn med `FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 node scripts/seed-events.mjs`
- `node scripts/seed-events.mjs` – importerar `seed/events/*.md` till Firestore (hoppar över befintliga)
- `node scripts/set-permissions.mjs <e-post> <behörighet…>` – sätter behörigheter med Admin SDK (första superadmin); kräver `gcloud auth application-default login`

## Kommunikation (WhatsApp)

- Byggkanalen är WhatsApp-gruppen **"OK Eken - hemsidebygge"** (JID `120363413962914017@g.us`), nåbar via MCP-servern `whatsapp`. Där postas change-log vid större ändringar, och Erik ber ibland Claude läsa gruppen efter förslag och kommentarer som underlag för vidare bygge.
- När Claude postar i gruppen börjar meddelandet alltid med **"🤖 AI-byggaren:"** så att alla ser att det är Claude och inte Erik som skriver.
- Skriv på svenska, kort och för klubbmedlemmar (inte tekniskt). Posta bara det som är live, och bara när Erik bett om det eller godkänt texten.

## Arbetssätt och modellval

Orkestrera själv och delegera med subagenter där det sparar tid eller kontext. Riktlinjer:

| Uppgift | Modell |
|---|---|
| Leta i kod/dokument, sammanställa fakta, läsa API-scheman (t.ex. Eventors `/api/schema`), inventera innehåll på gamla okeken.se, enkla mekaniska ändringar | **Haiku** |
| Implementera väldefinierade delar med tydlig spec (CRUD, formulär, workflows, regeltester, seed-skript) | **Sonnet** |
| Design och layout, arkitektur, säkerhetsregler och behörighetslogik, publiceringspipelinen, granskning av andras arbete, allt där fel blir dyrt | **Opus** |

- Ge subagenter en avgränsad uppgift med filvägar och acceptanskriterier; de startar utan kontext.
- Säkerhetsregler och rollogik granskas alltid av Opus innan de anses klara.
- Verifiera visuellt i webbläsaren (mobil + desktop) innan UI-arbete rapporteras klart.
