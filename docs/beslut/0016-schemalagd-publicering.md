# 0016 – Schemalagd publicering

**Kontext:** Publicerare vill skriva klart ett event i förväg och låta det gå live vid en viss tid (2026-10-22).

**Beslut:**
- Fältet `publishAt` (timestamp eller `null`) på `events/{id}`. Det ingår **inte** i ögonblicksbilden `published`, så det syns inte som "opublicerade ändringar". Bara publicerare, styrelse och superadmin skriver det (banläggarregeln tillåter inte nyckeln). Fältet är valfritt (äldre events saknar det).
- Cloud Function `publishScheduled` (Cloud Scheduler, var 15:e minut, `functions/src/scheduled-publish.ts`) hittar events med `publishAt <= nu` och publicerar **utkastet som det ser ut då**: ögonblicksbild, adress (första gången, samma regler som `publishEvent`), `publishedAt`, `publishAt` töms. Skrivningen startar bygget via `onEventWritten`, så det tar 15 min + 1–2 min som mest efter vald tid.
- Ändras eventet precis under körningen hoppas det över (`lastUpdateTime`-villkor) och tas med nästa körning.
- Knapparna Publicera och Avpublicera tömmer `publishAt`. Ändra tid eller Avbryt schemaläggning görs i editorn (`scheduleEvent`).
- Läget `scheduled` ("SCHEMALAGD – publiceras <tid>") går före de andra lägena i listor, editorns etikett och `StatusBadge` (`displayState`). Kalendern för inloggade ser fortfarande utkastets vanliga läge.
- Gäller events, inte infosidor.

**Att veta:**
- Funktionen ligger i `europe-west1`: Cloud Scheduler finns inte i `europe-north1` (där de andra funktionerna ligger).
- Kräver Cloud Scheduler API och att deploykontot `github-deploy@` får skapa schemajobb (`roles/cloudscheduler.admin`). Utan det misslyckas Functions-deployen.
- Regler: `validPublishAt` i `firestore.rules`, tester i `tests/rules/events.test.ts`; Functionens logik: `tests/server/scheduled-publish.test.ts`.
