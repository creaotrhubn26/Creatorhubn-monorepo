# The Role Room — Admin Room Operating System

### Hvorfor systemet er bygget som det er, og hvordan det gir leverage

> Sist oppdatert: 2026-05-26
> Søsterdokumenter: `TheRoleRoom-Content-Marketing-Plan.md`, `TheRoleRoom-Outreach-Plan.md`

---

## Kjernepremisset

Norsk filmbransje er ~500 mennesker. Klassisk B2B SaaS-strategi (volum-outreach, paid acquisition, growth hacking) er ikke bare ineffektiv her — den er aktiv skadelig. Én generisk mail som treffer feil casting director i Oslo, og ryktet er satt før The Role Room rekker å bygges.

Samtidig er Daniel solo-lead. Han må gjøre arbeidet til 5 mennesker uten å sende en eneste generisk melding. Det krever et operativsystem, ikke en SaaS-bunke.

Admin Room er det operativsystemet.

---

## 1. Tid-multiplikator for solo-lead

| Aktivitet | Manuelt | Med systemet |
|-----------|---------|--------------|
| Voice memo → LinkedIn-essay + newsletter-intro + 3 quote-cards | 3-4 timer | 30 min (Whisper + Claude) |
| Personlig outreach-DM til CD med spesifikke referanser | 8-10 min | 30 sek (AI-personalisering) |
| Newsletter-utgave → LinkedIn + IG + quote-cards | 2-3 timer | 5 min (Phase 4d cross-post) |
| Sjekke hvem som trenger Touch 2 denne uka | Umulig uten CRM | 1 blikk på Tier-1-tab |

**Konkret utfall:** ~10 timer/uke frigjort som ellers ville gått til content-massaje og memory-arbeid. Den tiden går til møter — den eneste aktiviteten som faktisk bygger relasjoner i Norge.

---

## 2. Quality at scale i et 500-personers marked

Outreach Plan-prinsippet *"20 deeply personalised > 200 generiske"* er nå håndhevet av systemet. Du kan ikke sende en outreach-DM uten at Claude ser:

- `recent_productions` (hva de jobber med)
- `mutual_connection` (hvem som kan introdusere)
- `city`, `segment`, `notes` (kontekst)

Hvis disse mangler, advarer dialogen: *"Legg til siste produksjoner i target-redigering for at Claude skal kunne henvise spesifikt til arbeidet deres."*

Systemet gjør spamming vanskeligere enn å gjøre det riktig. Det er den eneste defansable B2B-strategien i Norge.

---

## 3. Memory-extension som CRM

Ingen husker 500 mennesker. Touch-cadence-prikkene (0 → 1 → 2 → 3) viser per target hvor du er i 3-touch-regelen fra Outreach Plan:

- **0** — Ingen touch
- **1** — Engaged offentlig (kommentar, repost)
- **2** — Ga substantiv value (artikkel, stat, intro)
- **3** — ASK (DM, mail, møte)

"Klar for ask"-statkortet teller targets ferdig med Touch 1+2. Hver fredag morgen ser du nøyaktig hvem du skal følge opp. Det er forskjellen på 18 mnd relasjonsbygging vs. 3 mnd kaos.

Når du logger inn etter en ferie er det ingen "hvor var jeg?" — systemet har husket for deg.

---

## 4. GEO / AI-citation som moat — 18-måneders spillet

6 pillar-sider (`/casting-svindel-tegn`, `/barn-samtykke-film`, `/casting-rapport-2026`, `/bak-castingen`, `/vart-syn`, `/selvtape-tips`) er publisert med:

- Article-schema JSON-LD
- Speakable-metadata
- FAQ-schema der relevant
- Sitemap-registrering
- Brief-arkiv-lenker

Disse trener ChatGPT, Perplexity og Claude på at The Role Room er kilden for "norsk casting", "casting-svindel", "barneskuespiller-compliance", "selvtape-tips". I 2027 spør folk AI før Google. Hver pillar-side er et frø som vokser uten at du gjør noe mer.

**Det er gratis brand som konkurrenter (Skuespillerkatalogen, Backstage) ikke kan kjøpe seg ut av.** Det krever 12-18 mnd å bygge — så jo tidligere, desto bedre.

---

## 5. Compliance + safety som differensiering

Hele tone-stacken er bevisst:

- **Pillar 1 Trust & Safety** — defines kategorien
- **Pillar 4 Compliance** — taler til produsentens skjulte smerte (Arbeidstilsynet, GDPR, A-melding)
- **Outreach-template for produsenter** — leder med "Hvordan håndterer dere Arbeidstilsynet-forhåndssamtykke?"

Hver touchpoint trener markedet på at The Role Room er "the safe choice" vs. konkurrentenes volume play. Det er en moat AI ikke kan bryte (AI har ikke en mening om sikkerhet) og volum-konkurrenter ikke vil bygge (de tjener på volum, ikke kvalitet).

Det selger seg selv hos produsenter med juridisk eksponering — og *alle* norske produsenter har juridisk eksponering når barn er involvert.

---

## 6. Referral-graf som vekstmotor

Når 5 CDs er onboardet, flipper playbook-en fra cold outreach til varm intro. Referral-graf-feltet (`referred_by_id` + `referral_generation`) sporer kjeden:

- **Generation 1** — Direkte intro fra Daniel's nettverk
- **Generation 2** — Intro fra en jeg ble intro'ert til
- **Generation 3** — Tredje grad

Ved Generation 3 bør du være på ~50 CDs uten en eneste kald DM. Det er fastest growth loop som finnes for norsk B2B. Systemet er klart for det — du trenger bare data.

---

## 7. Newsletter som relasjons-trener

Norwegian Casting Brief (egen stack, ingen Beehiiv) gjør tre ting samtidig:

1. **Mental availability** — Byron Sharp-prinsippet. Ukentlig touchpoint på 500 mennesker uten å mase
2. **GEO-bonus** — hver sendte utgave publiseres på `/brief/[slug]` med Article-schema
3. **Audience-segmentering** — opens/clicks tracker hvem som faktisk er engaged

Repurpose-knappen (Phase 4d) gjør hver utgave til 5 kanaler. Cross-post er systemets håndtering av "1 piece → 10 outputs"-prinsippet fra Content Marketing Plan.

---

## Den korte versjonen

> Admin Room er bygd så **én person kan drive forretningsutvikling i norsk filmbransje med disiplinen til et 10-personers team** — og samtidig la 18 måneders kompounding fra GEO + relasjoner + brand bygge moat-en mens du sover.

---

## Hva som faktisk må gjøres for at systemet skal virke

Systemet er verdiløst uten data. Konkret startpunkt (uke 1 av Outreach Plan finnes som checklist i Tier-1 CRM):

1. **Mandag:** Voice memo 30 min om denne uka i bransjen → 3 utkast levert av Claude
2. **Tirsdag:** Fyll inn `recent_productions` for 15 Tier-1 CDs (10 min/target = 2.5 t totalt)
3. **Onsdag:** Generér AI-personlig DM for én CD → send
4. **Torsdag:** Samme for én produsent
5. **Fredag:** Sjekk Tier-1-tab — hvem er klar for Touch 2?
6. **Sluttuka:** Newsletter sendes automatisk fredag 08:00

Etter 4 uker har du ~60 mennesker i CRM, ~20 med ekte engagement-historikk, ~5 møter booket, og GEO-frøene er begynt å spire. Det er da moat-en blir synlig.

---

## Hvor systemet ligger i koden

- **Tier-1 CRM + Outreach:** `frontend/client/src/components/admin/content-marketing/IndustryTargetsTab.tsx` + `backend/server/admin-room-industry-targets-routes.ts` + `backend/server/admin-room-outreach-routes.ts`
- **Newsletter Studio:** `frontend/client/src/components/admin/content-marketing/NewsletterStudioTab.tsx` + `backend/server/role-room-newsletter-*-routes.ts`
- **Pillar-sider:** `frontend/client/src/components/admin/content-marketing/*Page.tsx` + `marketingPagesConfig.ts`
- **Migrasjon-historikk:** `backend/migrations/162-173_*`

Endepunkter: alt under `/api/admin-room/*`, gated på `daniel@creatorhubn.com`.
