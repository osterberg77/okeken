# OK Eken – underlag från nuvarande sida (okeken.se, Wix) – 2026-10-18

Själva innehållet (sidtexter, data, PDF:er) ligger i arkivet `Projects/okeken/gamla-sajten/content/` (utanför repot). Det här dokumentet är analysen.

## Sidkarta idag
- HEM (hero, nyhetsruta, 2 senaste träningar, nyhetsbrev, "Bli medlem"-CTA)
- TRÄNING & TÄVLING (/traning-tavling)
  - Träningskalender (/traningskalender) – lista, ~16 inlägg 2026
  - Terrängspår i Botorp – Vita 6,5 km, Röda 4,0 km, Blå 1,5 km, PDF-karta per spår
  - Tävla (/tavla) – Eventor-info, länkar Eventor/ÖOF/SOFT
  - Stöd för träningsansvarig – långt rutindokument
  - Lägga till veckans bana i Livelox (guide)
  - Banläggning – Purple Pen (guide)
- BLI MEDLEM – förmåner, avgifter, ansökningsformulär (Idrottonline-fält)
- OM OK EKEN – historik + föreningsfakta
- NYHETER (+ EKEN-NYTT ARKIV: PDF:er 2012–2021, månadsvis)
- BLOGG – 2 inlägg (dec 2022), författare Erik

## Innehållstyper att modellera (admin)
- Nyhet: rubrik, datum, text, bild
- Träning: datum (tisdag), v-nummer, rubrik, plats/text, banläggare, kartor/PDF A–D, Livelox-länk, ev. koordinater/parkering
- Bloggpost: rubrik, författare, datum, lästid, bild
- Spår: namn, längd, höjdmeter, karta-PDF
- Statiska sidor (Om, Bli medlem, Tävla, guider)
- Arkiv: PDF-lista år/månad
- Filer/bilder (Firebase Storage)

## Funktioner
- Träningskalender med säsongslogik ("säsong avslutad", återstart april)
- Nyhetsbrev-prenumeration (finns idag)
- Medlemsansökan (idag Idrottonline-formulär inbäddat) – avgör: bädda in/länka vidare/eget formulär
- Länkar: Facebook (OKEkenOrientering), Eventor, Livelox
- Hämta karta (PDF)
- Intern/lågtröskel-admin för träningsansvariga (idag mailar de material till klubbens e-post)

## Grafisk profil (uppmätt)
- Logotyp: femkantig sköld, lila (eller vit) bakgrund, grön/gul ek + texten "OK EKEN ÅTVID". Se `../../assets/logo/`
- Temafärger (Wix): lila #9C397B, mörklila #682652, ljuslila #DEAFCE, grön #31A947, mörkgrön #21712F, senap/olivguld #AA9215, röd #ED1C24, blå #0088CB, gul #FFCB05, beige #EBE7DB
- Typsnitt: Poppins (semibold rubriker, extralight brödtext), Avenir Light, Assistant
- Stil: helbreds skogsfoto som hero med stor vit rubrik; färgade kort/rutor ovanpå; versala små etiketter; outline-knappar "LÄS MER ›"
- Bilder: stockfoton (Unsplash/Pixabay), inga egna

## Observationer
- Inga egna foton, ingen styrelse/kontaktlista, ingen sponsorsektion, ingen resultat-/framgångssida, ingen karta över träningsplatser
- Blogg och Nyheter är nästan tomma – slå ihop?
- Medlemsinfo och kontaktuppgifter är duplicerade på flera sidor → ett ställe i admin
- Träningsansvariga skickar PDF:er via mail → direkt uppladdning i admin tar bort mellanledet

## Öppna frågor
- Egen färgprofil/manual, eller fortsätter lila + grön?
- Behålls Idrottonline för medlemsregister och formulär?
- Nyhetsbrev: vilken tjänst används idag?
- Egna foton/logotyp i vektor? (Logotyp i vektor finns nu, se `assets/logo/`.)
