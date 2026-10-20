# OK Eken – designriktning (från AI Studio-utkastet) – 2026-10-18

Utkastet (Gemini, React 19 + Tailwind 4 + motion + lucide, mockdata, Firebase tänkt) är en **riktning**, inte en spec: enkel kalender och eventpublicering, inte mycket mer. Underlaget i okeken-underlag.md ska därför läsas som urval – bara det som stödjer den riktningen tas med.

## Kärnidé
- Startsidan = tidslinje/kalender överst (oändlig åt båda håll, default ca 7 dagar bakåt och framåt, markerat datum ca 1/4 från vänster, "Idag"-knapp, lör/sön ljusgrå)
- Aktivitetslista under: valt datum först, sedan kommande, ca 6 st eller 2 månader, "visa fler"
- Desktop: lista till vänster + detaljvy till höger (första event förvalt). Mobil: klick öppnar event
- Kategorier med färg + ikon: Träning, Tävling, Möte, Information, Händelse. Filterchips (Alla/Träning/Tävling/Möte)
- Detaljvy: info, tid, plats, karta (simulerad, ev. Google Maps senare)
- Meny: Kalender + Om oss (undermeny: Om klubben, Bli medlem, Nybörjare, Dokument)
- Logga in-knapp (modal, simulerad) – för admin/publicering
- Header: endast logotyp (SVG, okeken.svg) + meny; footer med logotyp + kontaktinfo
- Profil: skogsgrön #2E7D32, lila #7B1FA2, guldgul, pastellbakgrunder; typografi Plus Jakarta Sans

## Vad som behövs från nuvarande sida
- Event/träningar (tisdagsträning kl 17–18, apr–jun och aug–okt), tävlingar via Eventor-länk
- Info-sidor: Om klubben (historik, föreningsfakta), Bli medlem (förmåner, avgifter 200/100/450, formulär), Nybörjare (tisdagsträning, banor A–D), Dokument (Eken-Nytt-arkiv, spårkartor, guider)
- Firebase: events-collection (typ, titel, datum/tid, plats, text, bilder/PDF, Livelox-länk, banläggare), admin-inloggning, Storage för PDF/kartor

## Utanför scope (tills vidare)
Blogg, nyhetsbrev, medlemsinloggning, sponsorer, resultat
