# 0006 – (Ersatt av 0024) Banläggare redigerar `courseFiles` själva

**Kontext:** PDF-banor (`courseFiles` på events) kunde bara kopplas till ett event av publicerare, trots att banläggaren redan fick ladda upp filerna till Storage. Banor laddas ofta upp sent (kvällen före eller samma dag), och banläggaren ska inte behöva vänta på en publicerare. Samtidigt får banläggaren inte kunna ändra eller publicera något annat i eventet.

**Beslut:** `course_setter` får läsa alla events och uppdatera ett event bara så att `courseFiles` ändras (plus `updatedBy`/`updatedAt`). Är eventet publicerat får samma skrivning sätta `published.courseFiles` till exakt utkastets lista, medan resten av `published`, `publishedAt`, `status` och `slug` måste vara oförändrade. Banorna går då live vid nästa bygge (Function `onEventWritten` ser att `published` ändrats) utan att övriga, opublicerade utkastsändringar följer med. På utkast och avpublicerade events ändras bara utkastets lista. Reglerna finns i `firestore.rules` (`courseSetterUpdate`), testerna i `tests/rules/events.test.ts`.

**Konsekvenser:**
- Banläggare ser utkast till events (även sådant som inte rör banor). Accepterat: små risker, och de behöver se eventet för att välja rätt.
- `publishedAt` ändras inte när banläggaren publicerar banor, så delningsknappen påverkas inte. Opublicerade banändringar som en publicerare gjort i utkastet går också live när banläggaren sparar, eftersom listan alltid kopieras i sin helhet.
- Regelvalideringen av 8 banor ligger nära taket på 1 000 uttryck per anrop. `validCourseFile` hålls därför kort (längder i regex) och den dyra innehållskontrollen ligger sist i publicerarregeln. Lägg inte till fler kontroller per bana utan att köra testet med 8 banor och maxlängder.
- Storage är oförändrat: banläggare kunde redan ladda upp till `courses/<eventId>/` (bara nya filer, PDF, max 10 MB).
