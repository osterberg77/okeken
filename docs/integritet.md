# Var visas personuppgifter, och för vem

Facit om någon frågar. **Varje ny vy som visar en person läggs in här** (och måste respektera "Dölj mig", beslut 0018). Nivåer: **Besökare** (ej inloggad), **Medlem**, **Banläggare** (för eventet), **Publicerare**, **Styrelse**, **Superadmin**. "Dold" = personen har valt "Dölj mig" (`users.hidden`).

| Plats | Vad visas | Besökare | Medlem | Banläggare/publicerare | Styrelse/superadmin | Dold person |
|---|---|---|---|---|---|---|
| Publik resultatlista (event) | Namn, bana, tid | Alla utom dolda | – (samma sida) | – | – | Utelämnas helt, placeringar numreras om |
| Intern startlista/resultat (adminvy) | Namn, bana, tider, ungdom, medlemslänk | – | – | Alla, även dolda (för sitt event) | Alla | Syns för behöriga, märks inte på publik sida |
| "Publicerat av" på event | Namn och bild | Bara om godkänd policy och inte dold | Samma | Samma | Samma | Visas inte |
| Svar på events (Kommer…) | Namn, status | – | Namn utom dolda ("n vill inte visa namn") | – | Alla, dolda märkta "(dolt)" | Räknas, namn `''` |
| Medlemslistan `members` | Namn, bild, `hidden` | – | Ej idag (planerat: bara `hidden == false`, beslut 0019) | Alla (för namnsökning) | Alla | Ej sökbar för medlemmar |
| Profil (`users`) | E-post, behörigheter, samtycke | – | Bara egen | – | Alla | – |
| Styrelsens protokoll | Omnämnanden | – | – | – | Styrelse/superadmin | Föreningens handlingar, hanteras manuellt |
| `courseSetter` på event | Fritext | Visas som skrivet | – | – | – | **Filtreras inte** (fritext) |

## Kvar utanför kontroll
- Eventor/Livelox: personer visas enligt deras regler.
- Fritext (sidtexter, banläggarnamn, protokoll) filtreras inte automatiskt.
- Google-cache, Wayback och liknande; borttagning kan begäras hos dem.
- Hosting-releaser sparas; rulla inte tillbaka förbi en ändring av "Dölj mig" eller en radering.
