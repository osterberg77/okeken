# Seed

Startmaterial som seed-skriptet (byggordning steg 4) skriver till Firestore. Fram till dess kan bygget läsa filerna direkt.

- `events/*.md` – de senaste träningarna från gamla okeken.se (hösten 2026), med frontmatter enligt `docs/datamodell.md`. Filnamnet är eventets `slug`. Tider i svensk tid (`+02:00`).

Det återkommande stycket om nedladdning av banor ("Här finns veckans banor … brevlådan vid starten") är borttaget ur texterna. Det bör bli en gemensam text för alla träningar i stället för att upprepas i varje event.
