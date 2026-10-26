# 0024 – Banläggare som roll tas bort

**Kontext:** Rollen `course_setter` (beslut 0006) fick läsa events och bara ändra `courseFiles`. I praktiken är det samma personer som publicerar, och en extra nivå gör behörighetsmodellen svårare att förklara.

**Beslut:** `course_setter` tas bort. De som lägger in banor och resultat är `publisher`. Nivåerna blir: besökare (publikt), `member`, `publisher`, `board`, `superadmin`. Specialregeln `courseSetterUpdate` och `isCourseSetter()` är borttagna ur `firestore.rules`, och Storage, Function `setResultsPublished` och UI:t släpper bara in publicerare och uppåt. Beslut 0006 ersätts.

**Konsekvenser:**
- Befintliga konton med `course_setter` måste få `publisher` (och `course_setter` tas bort ur `permissions`) innan de loggar in nästa gång, annars tappar de åtkomsten.
- Fältet `courseSetter` på event ("Ansvarig", fritext) är oförändrat.
- Publicerare ser och ändrar nu allt i ett event, inte bara banor.
