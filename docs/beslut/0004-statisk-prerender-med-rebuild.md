# 0004 – Statisk prerender med rebuild vid publicering

**Kontext:** Sajten ska vara snabb, statisk och sökbar, och delning till SoMe ska ge korrekta förhandsvisningar. Några sekunders-/minuters fördröjning vid publicering accepteras. Krav: live preview, enkel korrigering/avpublicering, schemalagd publicering.

**Beslut:** Alla publika sidor prerenderas med Astro. Firestore är redigeringsbackend. Publicering/avpublicering/schemalagd tid triggar rebuild via Cloud Function → GitHub Actions. Preview görs klientsida i admin.

**Konsekvenser:** ~1–2 min till live. Delningsknappen väntar på `meta/build.lastBuildAt`. Kräver nattligt fullbygge som skyddsnät. SSR + CDN-cache är ett möjligt senare steg.
