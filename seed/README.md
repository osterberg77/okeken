# Seed

Startmaterial som `scripts/seed-events.mjs` importerade till Firestore 2026-10-21. Firestore är nu källan; ändra events i admin, inte här.

- `pages/*.md` – infosidor flyttade från gamla okeken.se (Om klubben, Bli medlem, Träning och tävling, Tävla, Terrängspår, guider). Importerade som utkast i produktion 2026-10-21; Erik läser igenom och publicerar. `node scripts/seed-pages.mjs` lägger dem som utkast; publicera i admin.
- `events/*.md` – de senaste träningarna från gamla okeken.se (hösten 2026), med frontmatter enligt `docs/datamodell.md`. Filnamnet är eventets `slug`. Tider i svensk tid (`+02:00`).

Det återkommande stycket om nedladdning av banor ("Här finns veckans banor … brevlådan vid starten") är borttaget ur texterna. Det bör bli en gemensam text för alla träningar i stället för att upprepas i varje event.
