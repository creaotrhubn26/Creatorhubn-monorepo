# TheRoleRoom — Produktdokumentasjon

> Strategisk produktdokumentasjon for posisjonering, investor-pitcher, onboarding,
> strategisk planlegging og partner-outreach (NSF, NFI, produksjonsselskaper, byråer).
>
> Sist oppdatert: 2026-05-27.

---

## Sammendrag (TL;DR)

**TheRoleRoom er operativsystemet for film- og innholdsproduksjoner** — det tar en
produksjon fra idé og planlegging, gjennom casting og gjennomføring, helt til den er
**distribuert og sett**. Casting er inngangsdøra; produktet eier reisen videre. Det er
flaggskipet i **CreatorHub**, den bredere plattformen for kreativt arbeid.

- **Tre live vertikaler:** Produksjons-OS (produksjonsteam), innholdsprodusent-løsning, og
  dansestudio. Pluss et **AI-lag (The Role Room Agent)** i beta.
- **Forretningsmodell:** abonnement (795 kr/sete produksjonsteam, 495 kr innholdsprodusent,
  dans 149–2 490 kr) + EHF-faktura + usage. **Pre-revenue** — modellen er bygget i Stripe,
  ingen betalende kunder ennå.
- **Posisjon:** konkurrenten er fragmenteringen (Excel + e-post + WhatsApp + Facebook), ikke
  én SaaS. Strategi: **«integrer, ikke angrip»** — bli systemet NSF/NFI/NRK/TV2 selv vil
  bruke. Manifest: *«Hver god fortelling starter med de rette menneskene i de rette rollene.»*
- **Vekst:** referral + B2B2C-eksponering + CreatorHub-funnel. Switching cost: akkumulerte
  prosjekter, data-eierskap, og **støy-eliminering** i produksjon.
- **Ambisjon:** Norge → Europa (EU-arkitektur lagt) → globalt. 3 år: brukt av de største
  produksjonsselskapene + uunnværlig for utdanningsinstitusjoner. 10 år: bindevevet som gjør
  produksjon til en fryd, ikke en byrde.
- **Ærlig status:** pre-revenue, i stor grad solo-drevet, med compliance (DPA/BankID) i
  pipeline. Den største visjonen forutsetter partnerskap, kapital, teknologi og team.

## Innhold

1. [Produkt-oversikt](#seksjon-1--produkt-oversikt)
2. [Kjernefunksjonalitet](#seksjon-2--kjernefunksjonalitet)
3. [Målgrupper og bruskcases](#seksjon-3--målgrupper-og-bruskcases)
4. [Teknisk arkitektur (høynivå)](#seksjon-4--teknisk-arkitektur-høynivå)
5. [Forretningsmodell](#seksjon-5--forretningsmodell)
6. [Markedsposisjon](#seksjon-6--markedsposisjon)
7. [Vekstmotorer og nettverkseffekter](#seksjon-7--vekstmotorer-og-nettverkseffekter)
8. [Ambisjon og tidshorisont](#seksjon-8--ambisjon-og-tidshorisont)

---

## Seksjon 1 — Produkt-oversikt

### 1.1 TheRoleRoom i én setning

> **TheRoleRoom er operativsystemet for film- og innholdsproduksjoner — det tar en produksjon fra idé og planlegging, gjennom casting og gjennomføring, helt til den ferdige produksjonen er distribuert og sett av et publikum.**

### 1.2 TheRoleRoom i ett avsnitt

TheRoleRoom er et **prosjekt-operativsystem for film- og innholdsproduksjon**. Der de
fleste verktøyene i bransjen dekker bare ett trinn — et castingverktøy, et budsjettark,
et prosjektstyringsverktøy, et annonseverktøy — samler TheRoleRoom hele produksjonens
livsløp i ett system, organisert rundt **produksjonen som enhet**. Reisen begynner
allerede i idé- og utviklingsfasen: TheRoleRoom hjelper et team å modne idéen fram til
den er klar til å søke finansiering (NFI, tilskudd, investorer) — uten selv å håndtere
selve finansieringen. Casting er inngangsdøra: det akutte, konkrete behovet som får et
team inn. Men selve produktet eier reisen videre — manus og scenebrytning, crew og utstyr, lokasjoner og
produksjonsdager, budsjett og klientgodkjenning, og til slutt distribusjon og
markedsføring slik at produksjonen faktisk når et publikum. En AI-agent (drevet av
Claude) ligger på toppen og hjelper teamet å planlegge, produsere og markedsføre. Der
konkurrentene stopper når filmen er ferdig, fortsetter TheRoleRoom til den er **sett**.

### 1.3 Hva TheRoleRoom IKKE er

Avgrensningen er like viktig som definisjonen. TheRoleRoom er:

- **Ikke en castingplattform.** Casting er inngangsdøra, ikke sentrum. Å redusere
  TheRoleRoom til «en castingplattform» er som å kalle et operativsystem «en
  fil-utforsker» — det er én synlig funksjon, ikke produktet.
- **Ikke en talent-markedsplass.** Systemet er bygget rundt *produksjonen* (prosjektet),
  ikke rundt enkeltpersoners karrierer. Det er ikke en «LinkedIn for skuespillere» eller
  en database man abonnerer på for å bli oppdaget. Enheten er prosjektet, ikke personen.
- **Ikke et internt produksjonsverktøy som slutter når filmen er ferdig.** Løftet
  strekker seg forbi «ferdig produsert» til «distribuert og sett». Markedsførings-,
  annonse- og distribusjonsmodulene er andre halvdel av løftet, ikke påheng.
- **Ikke et regnskaps- eller lønnssystem.** TheRoleRoom gir økonomisk *oversikt* over
  produksjonen (budsjett, estimat vs. faktisk forbruk), men fører ikke regnskap, kjører
  ikke lønn og erstatter ikke et regnskapssystem.
- **Ikke et finansieringsverktøy.** Plattformen håndterer ikke tilskudd, investering
  eller utbetaling. Den hjelper teamet å modne idéen fram til de er *klare til å søke*
  finansiering — selve finansieringen skjer utenfor produktet.
- **Ikke et generisk prosjektstyringsverktøy.** Det er spesialisert for film- og
  innholdsproduksjonens faktiske arbeidsflyt og roller (regissør, produsent,
  casting director, foto, manus m.fl.) — ikke et tomt Kanban-brett.
- **Ikke det samme som CreatorHub.** CreatorHub er den brede plattformen for kreativt
  arbeid på tvers av fag; TheRoleRoom er det spesialiserte proff-flaggskipet for film og
  innhold. Se 1.4.

### 1.4 Forholdet til CreatorHub

**CreatorHub er merkevaren og paraplyen. TheRoleRoom er flaggskipet under den.**

**CreatorHub** er i seg selv et produkt — *plattformen for kreativt arbeid*: et
prosjektstyringssystem for ulike profesjoner og for bedrifter, der man kan administrere
prosjekter, samarbeide med team og gjennomføre produksjon i ett system. Visjonen er et
**sammenkoblet kreativt økosystem** for å administrere, gjennomføre og skalere kreativt
arbeid — med innebygde verktøy, produkter og fellesskap. CreatorHub har tre kjerne-
brukergrupper:

- **Kreatører** med prosjekter og idéer
- **Team** som skal koordinere arbeid og leveranser
- **Fagpersoner** som skal lære, bidra og skape nye muligheter

Rundt plattformen ligger **CreatorHub Academy** (læring) og **CreatorHub Community**
(fellesskap).

**Stigen (creator → proff):** CreatorHub og TheRoleRoom er *ikke* direkte koblet på
data-nivå — koblingen er en **funnel/progresjonsstige**. Bruker du CreatorHub og vil
«opp et nivå» mot å bli filmprodusent, er TheRoleRoom dit du går. CreatorHub fanger den
brede kreative befolkningen; TheRoleRoom er proff-destinasjonen for dem som skal bygge
ekte film-/innholdsproduksjon.

```
CREATORHUB  (merkevaren + den brede plattformen for kreativt arbeid)
│   Academy (læring)  ·  Community (fellesskap)
│   Brukere: kreatører · team · fagpersoner · bedrifter
│
│        �️  funnel / progresjon (oppdagelse, ikke datadeling)
│
└─ THE ROLE ROOM  ★ FLAGGSKIPET
      Proff-nivået: operativsystemet for hele film-/innholdsproduksjonen
      idé → utvikling/manus → casting → produksjon → distribusjon → publikum
              (idéen modnes til «klar til å søke finansiering» — uten at
               plattformen håndterer selve finansieringen)
            │
            └─ POST AGENT  (post-produksjon)
                  • tjener Role Room  +  frittstående produkt
                  • rolle: lavterskel on-ramp til post-produksjon —
                    organiser og gjør klart, lever videre til avanserte
                    verktøy som DaVinci Resolve
```

**Post Agent** er et post-produksjonsverktøy som *både* tjener TheRoleRoom *og* står på
egne ben som frittstående produkt. Rollen er å være en lavterskel **on-ramp** til
post-produksjon: kom raskt i gang, organiser og gjør klart materialet — og lever sømløst
videre til tyngre profesjonelle verktøy som DaVinci Resolve.

---

## Seksjon 2 — Kjernefunksjonalitet

> Denne seksjonen beskriver det som **eksisterer i dag**, ikke roadmap. Statusen
> («live» vs. «beta») er markert eksplisitt, slik at investorer og partnere kan stole på
> skillet mellom det som er i drift og det som er under utvikling.

### 2.1 Slik er produktet bygget: fire live vertikaler + ett AI-lag i beta

TheRoleRoom er ikke én flate, men fire kundevendte vertikaler under samme plattform,
pluss et AI-lag (Agenten) som ennå er internt under utvikling. Produksjons-OS, innholds-
produsent-løsningen og dansestudio matcher pris-tierene i forretningsmodellen; Talents-
app/Talent Registry er den nyeste vertikalen og tjener byrå- og talent-siden av økosystemet.

| Lag / vertikal | Persona | Status |
|---|---|---|
| **Produksjons-OS** | Produksjonsteam (795 kr/sete, min. 3) | ✅ Live |
| **Innholdsprodusent-løsning** (uten Agent) | Innholdsprodusent (495 kr/sete, min. 1) | ✅ Live |
| **Dansestudio-vertikal** | Profesjonelle dansere / dansestudio | ✅ Live |
| **Talents-app + Talent Registry** | Skuespillere + casting-byrå + produsenter | ✅ Live (ny — BankID + per-org B2 i pipeline) |
| **The Role Room Agent** (AI-lag) | Begge — særlig innholdsprodusent | 🟡 Beta — ikke skipet, testes internt |

### 2.2 Kjernemoduler — Produksjons-OS (LIVE)

Hjertet for **produksjonsteam**. Eier produksjonen fra rollebesetning til ferdig levert,
med transparent økonomi- og godkjenningsflyt mellom leverandør og kunde.

| Modul | Problem den løser | For hvem | Hvordan |
|---|---|---|---|
| **Casting & talent** | Finne og håndtere de rette folkene til roller, med dokumentert samtykke | Casting director, produsent, regissør | Prosjekter, roller/karakterer, kandidatpool, scheduling, consent m/signatur, tilgangskoder/PIN |
| **Produksjonsledelse** | Holde styr på alt det fysiske rundt en innspilling | Produksjonsleder, foto-team, crew | Crew, lokasjoner, props, produksjonsdager, shot lists/storyboard, utstyr + booking/checkout |
| **Manus** | Ett kontrollert manus i stedet for 12 e-postversjoner | Manusforfatter, script editor, reader | Versjonering og låsing, scene-breakdown (akter, INT/EXT, karakterliste), screenplay-format |
| **Klient-samarbeid & økonomisk oversikt** | Transparent godkjenning og budsjettkontroll mellom leverandør og kunde | Produsent ↔ klient (client_reviewer) | Faser/timeline, budsjett (estimat vs. faktisk, NOK), client reviews/godkjenning, intake-skjema, materialbibliotek |

### 2.3 Kjernemoduler — Distribusjon & markedsføring (LIVE) — «get it seen»

Andre halvdel av løftet: ikke bare lage produksjonen, men få den **sett**.

| Modul | Problem den løser | For hvem | Hvordan |
|---|---|---|---|
| **Annonsering** | Betalt distribusjon på tvers av kanaler, i ett grensesnitt | Produsent / innholdsprodusent | Meta, Google, LinkedIn, TikTok — OAuth, kampanjer, budsjett, spend-sync, KPI, management fee |
| **Content marketing** | Planlegge og produsere organisk innhold rundt produksjonen | Innholdsprodusent / markedsfører | Marketing-plan, carousel-generator, feed-strategi |
| **Social publishing** | Publisere uten å hoppe mellom verktøy | Innholdsprodusent | Instagram-publisering |

### 2.4 Kjernevertikal — Innholdsprodusent-løsning (LIVE, uten Agent)

For **innholdsprodusenter** (frilans/individuelle, 495 kr/sete). Tre jobber: **digital
markedsføring**, **innholdsplanlegging**, og et **samarbeidssystem mellom
innholdsprodusent (leverandør) og klient (kunde)** med transparent oversikt mellom
partene. Alt utenom Agenten er live.

### 2.5 Kjernevertikal — Dansestudio (LIVE)

Egen vertikal for profesjonelle dansere og dansestudioer.

| Funksjon | Hva den gjør |
|---|---|
| Booking av timer | Time-/klassebooking |
| Koreografi / produksjon | Planlegge og produsere dansenummer/forestillinger |
| Casting til danseoppdrag | Finne dansere til oppdrag |
| Medlemshåndtering | Administrere medlemmer i studioet |
| Formasjonstrening | Verktøy for at danseteam kan trene på formasjon |
| Event-dashboard | Planleggingsoversikt over kommende events |
| Åpne auditions | Oversikt over åpne auditions |
| Skadelogg | Logg over skader (helse/oppfølging) |
| Øvingslogg | Logg over øving/trening |

Ønskede partnerorganisasjoner i denne vertikalen: **Skuda** og **NoDa** (se Seksjon 6).

### 2.6 Kjernevertikal — Talents-app + Talent Registry (LIVE — ny)

Den **talent-vendte halvdelen** av plattformen. Komplementerer Produksjons-OS-en
(2.2): der Produksjons-OS handler om *prosjektet*, handler Talents-app om *menneskene*
som besetter rollene. Live i koden under `/talents/*`-flaten med 9 sider, med flere
GDPR-relaterte primitiver bygget inn fra starten.

| Side | Hvem | Hva |
|---|---|---|
| `/talents` | Talent + agency | Dashboard — oversikt over aktive consents, kommende auditions, partnerinvitasjoner |
| **`/talents/registry`** | **Agency (Stella/NSF/produsenter)** | **Talent Registry — pixel-implementert søkeflate med 7 regioner: avanserte filtre, featured-carousel, 4-kolonners grid, saved searches. KUN consent-filtrerte resultater — agency ser bare talenter som har gitt eksplisitt consent.** |
| `/talents/profiles` | Talent | Min profil + onboarding-wizard — headshot, showreel, resume, alt-photos |
| `/talents/self-tapes` | Talent | Self-tape Studio — innebygget opptaker, AI-feedback, format-presets |
| `/talents/auditions` | Talent | Aktive audition-invitasjoner fra agency/produsent |
| `/talents/partners` | Talent | Partners & Collaboration — hvilke agency/produsenter har du gitt consent til |
| `/talents/audit` | Talent | «Hvem har sett meg?» — full audit-trail per visning av profil og media |
| `/talents/partnerships` | Agency | Samarbeid-flate for byrå — administrere talent-roster, sende reverse-consent-invitasjoner |
| `/talents/settings` | Talent + agency | Innstillinger — varsler, sletting, BankID-status, BYO-storage |

**Talent Registry (spesifikt) — den nye, sentrale flaten:**
Bygget rundt fire prinsipper:

1. **Consent-filtrert by default.** Agency ser bare talenter som har aktiv `talent_consent_registry`-rad med matchende scope. Ingen «søk og oppdag random talent» — det er per design.
2. **Audit-trail per visning.** Hver gang en agency-bruker åpner et talent-kort, logges det. Talenten kan se akkurat når og av hvem under `/talents/audit`.
3. **Reverse-consent ved foreslag.** Hvis agency vil foreslå en ny talent (ikke i eget roster), sendes en signed invitasjon (akseptert via `talent_proposal_accept`-flow). Når BankID lander (P0 fremtidig), brukes BankID-signering her.
4. **Mindreårige strengere.** Talenter < 18 år krever foresatte-samtykke (per `talent_guardians`-tabell). Under 13: kun foreldre signerer; 13–15: foreldre + barn parallelt; 16–17: barn kan signere selv men foreldre varsles (jf. norsk barnelov §33).

**Backend-flater:**
- `role-room-talent-uploads-routes.ts` — direkte fil-opplastning via presigned PUT
- `role-room-talent-gdpr-routes.ts` — GDPR-eksport (Artikkel 15/20), sletting (Artikkel 17), consent-historikk
- `talent_consent_registry`, `talent_guardians`, `talent_bankid_audit` (planlagt)

**Storage-arkitektur (per 2026-06-07):**
- **Admin-B2** (the-role-room-prod) — kun for `daniel@creatorhubn.com`
- **Per-org-tier (1 GB inkludert)** — hver produksjonsteam / innholdsprodusent / casting-byrå får 1 GB på admin-B2 ved oppretting
- **BYO B2** — etter 1 GB må org koble egen Backblaze (Creatorhub One Desk-pattern via `storage_providers`)
- **Skuespillere** lever i casting-byråets bucket — har ingen egen kvote, men ser hostende byrås brukte/tilgjengelige GB
- **1-klikks migrate** når org går fra admin-B2 til BYO (frigir admin-kvoten)
- **Varsler** ved 80 % / 95 % / 100 % via Resend + Twilio

**BankID-integrasjon (P0 fremtidig, jf. talents-app/ROADMAP.md):**
- Profil-oppretting (én gang per talent)
- Reverse-consent accept fra agency-proposal
- GDPR-sletting (forhindrer hijack-sletting)
- Cost: ~3–8 NOK per signering via Signicat eller direkte OIDC

**Status:** Talent Registry og kjerne-uploads er live i koden, men trenger
**BankID** for full identitets-tillit og **per-org B2-bucket** for skalerbar lagring.
Tre under-tasker (L3a/b/c) sporet for storage-arkitekturen.

### 2.7 AI-lag — The Role Room Agent (BETA — ikke skipet)

Drevet av Claude. Testes internt og er under utvikling — **ikke et live kundeprodukt
ennå**. Når den skipes, er den ment særlig for **innholdsprodusenter**, og skal levere:

- **Konkurrentanalyse** — inkludert konkurrenter i nær (geografisk) radius
- **Partner-discovery** — finne potensielle samarbeidspartnere for kunden
- **Merch-kobling** — koble kunden til merch-selskaper for deres nisje og brand
- **Ads & markedsføring** — planlegge og kjøre for kunden
- Alt med **transparent oversikt mellom partene** (leverandør ↔ kunde)

Merk: flere av disse motorene finnes allerede internt (se 2.9). Det nye i Agenten er at
de pekes mot **kundens** virksomhet, ikke selskapets egen.

### 2.8 Tverrgående: kommunikasjon (LIVE)

Brukt på tvers av alle vertikaler.

| Kanal | Bruk | Merknad |
|---|---|---|
| **WhatsApp Business** | Team-invitasjoner, statusoppdateringer, webhook-events | Fakturert per bruk |
| **SMS (Twilio)** | Kandidat-/team-påminnelser | Fakturert per melding (2,00 kr eks. mva) |
| **E-post / nyhetsbrev** | Bekreftelser, «Norwegian Casting Brief» | Double-opt-in |

### 2.9 Integrasjoner

| Integrasjon | Rolle | Status |
|---|---|---|
| **Stripe** | Betaling / abonnement | ✅ Live (se Seksjon 5 for abonnement + faktura) |
| **Claude (Anthropic)** | AI-agent, content-strategi, generering | ✅ Live |
| **Replicate** | AI-bildegenerering | ✅ Live |
| **Meta (FB/IG/WhatsApp)** | Annonser, publisering, kommunikasjon | ✅ Live |
| **Google Ads / LinkedIn Ads / TikTok** | Annonsering | ✅ Live |
| **Google Workspace** | Drive, Calendar, Meet, e-signatur | ✅ Live |
| **Twilio** | SMS | ✅ Live |
| **Printful** | Merch-mockups | ✅ Live (primært internt/Agent) |
| **BRREG** | Norske selskapsoppslag | ✅ Live |
| **Norsk juridisk data** | Juridiske referanser | ✅ Live |
| **BankID** | Verifisering av ekte personer | 🎯 Planlagt — klart mål |
| **Vipps** | Norsk betaling | ◔ Mulig, lav prioritet (abonnement/faktura dekker behovet) |
| **A-melding / Altinn** | Lønnsrapportering | ✖️ Irrelevant — TheRoleRoom er ikke et lønnssystem |
| **Arbeidstilsynet** | Trivsel og trygghet i bransjen | 🤝 Ønsket *samarbeid* (ikke teknisk integrasjon) |

### 2.10 Interne vekst-/ops-verktøy (IKKE kundeprodukt)

Disse `role-room-*`-modulene finnes i koden, men er verktøy selskapet bruker for å vokse
og drive forretning — ikke kundefunksjoner: merch-partner-discovery, investor-deck-
generering, education-outreach/inquiries, website-analyzer, creator-discovery og
nyhetsbrevet «Norwegian Casting Brief». Noen deler motor med planlagte Agent-funksjoner
(2.6), men i kundeproduktet pekes motoren mot kundens egen virksomhet.

### 2.11 Oppsummering: kjerne vs. støttende

- **Kjerne (live):** Produksjons-OS (casting + produksjon + manus + klient/økonomi),
  innholdsprodusent-løsning, dansestudio-vertikal, **Talents-app + Talent Registry**.
- **Kjerne-nær, «get it seen» (live):** annonsering + content marketing + publisering.
- **Støttende infrastruktur (live):** kommunikasjon (WhatsApp/SMS/e-post), integrasjoner,
  åpen plattform-API.
- **Fremtidig kjerne-differensiator (beta):** The Role Room Agent.
- **Ikke kundeprodukt:** interne vekst-/ops-verktøy.

---

## Seksjon 3 — Målgrupper og bruskcases

### 3.1 Forretningsmodell-struktur: B2B og B2B2C — ingen ekte B2C

TheRoleRoom er **overveiende B2B, med en innebygd B2B2C-motor**. Det finnes *ingen* ekte
B2C-flate: enkeltpersoner (skuespillere) betaler ikke for å bli oppdaget. Skuespiller-
portalen er en **informasjonsflate**, ikke et betalt produkt.

| Persona | Kjøper (buyer) | Brukere som dras inn (B2B2C) |
|---|---|---|
| **Produksjonsteam** | Produksjonsselskap, innkjøpere, byrå | Crew, skuespillere, klient/kunde |
| **Innholdsprodusent** | Innholdsprodusenten | Flere klienter (kunder) — som gjester på prosjekt-/kommunikasjonsflaten |
| **Dansestudio** | Studioet | Dansere / medlemmer |
| **Utdanningsinstitusjon** | Institusjonen (partner) | Studenter |

**B2B2C-motoren:** kjøperen drar med seg ikke-betalende brukere (klienter, medlemmer,
crew) inn på plattformen. Disse opplever produktet uten å betale — og blir en kilde til
videre vekst (se Seksjon 7).

**Statist-/skuespillerflaten** bygges bevisst videre via **samarbeid og integrasjon med
de store aktørene i markedet** — ikke ved å bygge en konkurrerende database fra null
(«integrer, ikke angrip», se Seksjon 6).

### 3.2 Komplett liste over brukertyper

| # | Brukertype | Kontekst |
|---|---|---|
| 1 | Produsent | Produksjonsteam (ofte kjøper/eier) |
| 2 | Produksjonsselskap | Organisasjon / kjøper |
| 3 | Innkjøper | Kjøper |
| 4 | Byrå (agency) | Kjøper + forvalter talent på tvers |
| 5 | Regissør (director) | Produksjonsteam |
| 6 | Casting director | Produksjonsteam |
| 7 | Produksjonsleder | Produksjonsteam |
| 8 | Foto-team (camera) | Produksjonsteam |
| 9 | Manusforfatter (writer) | Idé-/utviklingsfase |
| 10 | Script editor | Idé-/utviklingsfase |
| 11 | Reader (manus-leser) | Idé-/utviklingsfase |
| 12 | Klient / kunde (client_reviewer) | Godkjenning (produksjon + innholdsprodusent) |
| 13 | Innholdsprodusent | Egen vertikal |
| 14 | Dansestudio (eier/admin) | Dansevertikal |
| 15 | Danser / medlem | Dansevertikal |
| 16 | Skuespiller | Portal (informasjon) |
| 17 | Statist | Fremtidig — via integrasjon med store aktører |
| 18 | Utdanningsinstitusjon | Partnersegment (produksjons-OS) |

### 3.3 Jobber, frekvens og retention per brukertype

| Brukertype | Primær jobb | Sekundær jobb | Frekvens | Hva får dem tilbake |
|---|---|---|---|---|
| **Produsent / produksjonsteam** | Eie hele produksjonsflyten fra idé til ferdig | Budsjett, klientgodkjenning, distribusjon | **Kontinuerlig** (idé-pipeline) | Idéer forsvinner ikke; full oversikt; eierskap til egne data |
| **Innholdsprodusent** | Levere digital markedsføring + innhold til klienter | Klient-kommunikasjon, planlegging | **Høy** (daglig/ukentlig) | Flere løpende klienter |
| **Dansestudio + medlemmer** | Drive studio: timer, medlemmer, events | Casting til oppdrag, logger | **Høy** (ukentlig+) | Booking, øvings-/skadelogg, auditions |
| **Casting director** | Finne og håndtere kandidater | Scheduling, samtykke | Bursty (casting-fase) | Ny produksjon i pipeline |
| **Crew / foto** | Utføre under produksjon | Utstyr, produksjonsdager | Bursty (under produksjon) | Kalt inn til neste produksjon |
| **Manus (writer/editor/reader)** | Utvikle og kvalitetssikre manus | Scene-breakdown | Idé-/utviklingsfase | Pipeline av nye idéer |
| **Klient / kunde** | Godkjenne og kommunisere | Følge fremdrift | Episodisk | Godkjenningsforespørsel |
| **Byrå** | Forvalte talent på tvers av produksjoner | Booking | Medium–høy | Nye oppdrag/produksjoner |
| **Skuespiller** | Hente informasjon | — | Lav | Relevant info i portalen |

### 3.4 Hvorfor produksjonsteam IKKE er episodisk (retention-kjernen)

Den vanlige svakheten ved produksjonsverktøy er at de er **prosjektbaserte og episodiske**:
intens bruk under en produksjon, stillhet mellom. TheRoleRoom unngår dette ved å eie det
aller første steget — **idé og manus**:

- **Idéer forsvinner ikke.** Plattformen løser en reell flaskehals: gode idéer som går
  tapt mellom produksjoner. Idé-pipeline er alltid aktiv, også når ingen produksjon
  ruller.
- **Idé-validering.** Teamet vil ha bekreftet at en idé er verdt å satse på *før* de
  binder ressurser. Det gir en kontinuerlig grunn til å komme tilbake.
- **Eierskap = switching cost.** Produksjonsteamet eier prosjektet og dataene sine i
  plattformen. Akkumulert verdi øker over tid, og gjør det dyrere å forlate (se Seksjon 7).
- **Full produksjonsflyt-oversikt.** For dem som allerede har idéen klar, er verdien at
  ett verktøy gir oversikt over hele flyten — effektivisering, planlegging og høy
  produksjonskvalitet.

### 3.5 Primære vs. sekundære bruskcases

- **Primære:** (1) ta en produksjon fra idé → ferdig → sett (produksjonsteam); (2) levere
  digital markedsføring/innhold til klienter (innholdsprodusent); (3) drive dansestudio
  med medlemmer, timer og events.
- **Sekundære:** annonsering/betalt distribusjon, merch, partner-discovery (i dag internt /
  i Agenten som beta), education-partnerskap.

### 3.6 Retention-ankrene

De kontinuerlige, sticky brukerne — de som holder plattformen «levende» — er
**innholdsprodusenter** og **dansestudioer** (gjentakende drift), samt **produksjonsteam**
gjennom idé-pipeline og data-eierskap. Episodiske brukere (klient, crew, skuespiller)
dras inn via B2B2C-motoren og bidrar til vekst snarere enn til daglig retention.

---

## Seksjon 4 — Teknisk arkitektur (høynivå)

### 4.1 Tech stack

| Lag | Teknologi |
|---|---|
| **Språk** | TypeScript (Node ≥20) |
| **Backend** | Express 5, modulær monolitt |
| **Database** | PostgreSQL (Neon, serverless) + Drizzle ORM |
| **Realtime** | Socket.io |
| **Frontend** | React + Next.js, MUI, React Query |
| **Bygg/test** | Vite, esbuild, Playwright (E2E) |
| **Hosting** | Vercel |
| **Fillagring** | AWS S3 / Cloudflare R2 |
| **AI** | Claude (Anthropic), Replicate |

### 4.2 Arkitektur-stil: modulær monolitt med en gryende plattformkjerne

TheRoleRoom er bygget som en **modulær monolitt** — ikke mikrotjenester. Role-room-koden
er delt opp i ~142 moduler (via et dep-injection-ekstraksjonsmønster), men kjører som én
backend. Dette gir lav drifts­kompleksitet for et lite team, samtidig som modulgrensene gjør
det mulig å skille ut tjenester senere hvis skala krever det.

CreatorHub er et **monorepo** der flere produkter (TheRoleRoom, Post Agent, Live Set,
Resolve Script Manager) deler kodebase.

### 4.3 API- og plattformstrategi: fra integrasjonsflate til offentlig plattform

I koden finnes en **dedikert integrasjonskjerne**: `integration_accounts`, API-nøkler,
webhooks, `object_mappings` og `event_outbox`. Dette er ikke bare interne koblinger — det
er arkitektur lagt for at TheRoleRoom skal bli en **plattform andre bygger på**.

- **Mål (ikke live ennå):** et **offentlig API** som gjør TheRoleRoom til det foretrukne,
  sammenkoblende verktøyet i bransjen.
- **Tiltenkte integrasjonspartnere:** statist-/skuespillerdatabaser, utstyrsaktører (f.eks.
  foto.no), læringsplattformer/skolesystemer (utdanningssegmentet), og kringkastere som
  **NRK** og **TV2** der det er mulig.
- **Strategisk betydning:** Dette gjør «operativsystem»-påstanden konkret — et OS kjennetegnes
  ved at andre kobler seg på det. (Se Seksjon 6 og 8.)
- **Status:** integrasjonskjernen finnes i koden; det *offentlige* API-et er et mål, ikke
  lansert.

### 4.4 Data som samles inn — og hvorfor

| Datakategori | Hvorfor | Sensitivitet |
|---|---|---|
| Profil-/kontaktdata (navn, e-post, telefon) | Identifisere og kontakte deltakere | Moderat |
| Casting-data (bilder, video, kandidatinfo) | Vurdere og besette roller | **Høy** — kan omfatte mindreårige |
| Samtykke/signaturer | Dokumentere lovlig grunnlag for deltakelse | Høy |
| Produksjonsdata (budsjett, plan, manus) | Drive produksjonen | Forretningssensitiv |
| Integrasjons-tokens (Google, Meta m.fl.) | Koble eksterne tjenester | Høy — lagres kryptert |
| AI-bruk (Claude-token, prompts) | Levere agent + governance/audit | Moderat |

### 4.5 GDPR / personvern-arkitektur

**Prinsipp:** all data lagres i **EU/EØS** og følger EU-regelverk — et bevisst krav som
også muliggjør skalering til andre europeiske land over tid.

**På plass i dag (i koden):**
- Samtykke-håndtering for kandidater (consent, signaturer, PIN/tilgangskoder, utløp)
- AI-consent (scope-basert) + AI-governance (oversikt, audit, samtykkelister)
- Audit-logging og krypterte integrasjons-tokens

**Kjent gap / i pipeline (bevisst sekvensert etter å skaffe brukere):**
- **Databehandleravtale (DPA)** er ikke på plass ennå — i pipeline.
- Planlagt dialog med **Datatilsynet** om sikkerhetsnivå-klassifisering (nivå 3 eller 4).
- Behov for ekstern bistand til å velge riktig personvern-/compliance-løsning.

> Ærlig status for investorer/partnere: personvern-fundamentet (samtykke, audit, EU-lagring)
> finnes, men formell compliance-modenhet (DPA, klassifisering) er en kjent, planlagt
> oppgave — ikke et oversett hull.

### 4.6 Sikkerhet og verifisering

**På plass i dag:** API-nøkkel-håndhevelse og CORS på role-room-API-et, krypterte tokens,
samtykke med PIN/tilgangskoder, audit-logg.

**Planlagt — BankID:**
- **Hvorfor:** verifisere at folk er ekte, og styrke **tilliten** til produktet (kritisk for
  casting, mindreårige og partnere som NRK/TV2/NFI).
- **Status:** planlagt, men gated på betalende kunder pga. kostnad. Vurderer leverandør
  (navn nevnt: «Idura» — *bør verifiseres*) og er ikke avklart på hvilken løsning/nivå.

### 4.7 Åpne punkter / kjente tekniske gap

1. **DPA + Datatilsynet-klassifisering** — i pipeline; trenger ekstern bistand.
2. **BankID-leverandør og -løsning** — ikke valgt; gated på inntekt.
3. **Verifiser regionkonfigurasjon** (Neon / Vercel / S3-R2) faktisk er satt til EU/EØS.
4. **Offentlig API** — arkitektur finnes, men produktisering/dokumentasjon for tredjeparter
   gjenstår.

---

## Seksjon 5 — Forretningsmodell

### 5.1 Status: pre-revenue

TheRoleRoom er **pre-revenue** — ingen betalende kunder ennå. Monetiseringsmodellen er
imidlertid **bygget og konfigurert i Stripe** (totalt 32 aktive priser i Stripe-kontoen,
fordelt på *både* TheRoleRoom og CreatorHub — se avgrensning i 5.7). Målet er å konvertere
de første betalende kundene.

> Skrives derfor som «slik er modellen ment å tjene penger», ikke «slik tjenes penger i dag».

### 5.2 Inntektsmodell — abonnement (kjernen)

**Produksjon & innhold** (per sete/mnd, eks. mva):

| Plan | Pris | Minimum |
|---|---|---|
| Produksjonsteam | 795 kr/sete | 3 seter |
| Innholdsprodusent | 495 kr/sete | 1 sete |

**Dans — frilans** (`dance_freelance`):

| Plan | Mnd | År | Merknad |
|---|---|---|---|
| Frilanser Free | 0 kr | 0 kr | Watermark, 5 GB |
| Frilanser | 149 kr | 1 490 kr | Ubegrenset reel, NAV-rapport, casting-eksport |
| Frilanser Pro | 299 kr | 2 990 kr | + AI-tagging, analytics, add-on-kvalifisert |

**Dans — studio** (`dance_studio`):

| Plan | Mnd | År | Merknad |
|---|---|---|---|
| Studio Start | 599 kr | 5 990 kr | <50 elever, 1 admin |
| Studio | 1 199 kr | 11 990 kr | 50–200 elever, 5 admins, EHF-faktura |
| Studio Pro | 2 490 kr | 24 900 kr | 200+, 15 admins, white-label |
| Studio Enterprise | Custom | Custom | 20+, dedikert support, SSO |

**Add-ons (dans):** 4 à-la-carte-moduler tilgjengelig for planer med `addon_eligible`
(Frilanser Pro / studio-planer). Eksakte beløp vedlikeholdes i Stripe.

> Alle beløp er seed-defaults fra koden; **Stripe er kilde til sannhet og admin-redigerbar.**

### 5.3 Usage-baserte strømmer

| Strøm | Modell | Merknad |
|---|---|---|
| SMS | 2,00 kr/stk (eks. mva) | Twilio-kost ~0,65 kr → margin ~1,35 kr |
| WhatsApp | Per bruk | Fakturert per melding |
| Ads management fee | Klient-forhandlet | 20 % påslag var *spesifikt for MedInnova*, ikke standard |

### 5.4 Billing-modell: abonnement + faktura

- **Abonnement** via Stripe — månedlig/årlig, per sete, med trial-perioder (14–30 dager).
- **Fakturabasert (EHF)** for studio-/B2B-tier — derfor er Vipps lav prioritet:
  betalingsbehovet dekkes av abonnement + faktura, særlig ved volum.
- **Comp/tester-tilgang** finnes utenom Stripe (administrert).

### 5.5 Planlagte / fremtidige inntektsstrømmer

**Bekreftede planer:**

- **Post Agent** — selges som **add-on på TheRoleRoom** (samt frittstående produkt).
- **The Role Room Agent** — premium-/add-on-strøm når den skipes fra beta.
- **Offentlig API / plattform** — partner-/plattformavgift når API-et åpnes.
- **Utdanning** — egen lisens-/partnermodell.

**Monetiseringskandidater (forslag til vurdering, grunnet i eksisterende funksjonalitet):**

1. **Transaksjons-/formidlingsandel** når talent-/statistflaten modnes — referral-/
   integrasjons-revenue-share med de store aktørene (i tråd med «integrer, ikke angrip»).
2. **Verifisert tillit-tier** når BankID er på plass — verifiserte profiler/produksjoner
   som premium (tillit som betalt funksjon).
3. **Merch revenue-share** — andel av merch-salg via Printful-koblingen når Agenten kobler
   kunder til merch-selskaper.
4. **Tilskudds-/grant-readiness-modul** — `grants`-funksjonen finnes allerede; en betalt
   modul for søknadsklargjøring rimer med posisjoneringen «modne idéen til den er klar til
   å søke finansiering».
5. **Overforbruks-billing** — overage på lagring/AI à la SMS-modellen.
6. **White-label / byrå-tier** — white-label finnes i Studio Pro; kan tilbys byråer og
   institusjoner som egen B2B-pakke.
7. **CRM-add-on** — Role Room har en Tier-1 CRM-flate; kan pakkes som add-on for klient-
   og talent-relasjonshåndtering.

### 5.6 Enhetsøkonomi

Siden produktet er pre-revenue finnes det **ingen målte CAC/LTV/retention-tall** ennå.
Kostnadssiden er imidlertid instrumentert i koden:

- Per-bruker lønnsomhets-tracking
- AI-token-kostnad (Claude, i USD)
- Hosting-allokering (~$1,20 / aktiv bruker / mnd)
- Faste plattformkostnader brutt ned per kategori (AI, hosting, CDN, lagring, database,
  dev-verktøy, monitoring, e-post)

Dette gir et godt grunnlag for å beregne dekningsbidrag per kunde så snart inntekt kommer.

**Vekstmål (definert):**

- **500 brukere** totalt
- **~15 produksjonsselskaper**

**Illustrativt regneeksempel (antakelser — må valideres):** 15 produksjonsselskaper à 3
seter à 795 kr ≈ **36 000 kr/mnd** (~430 000 kr/år) bare fra produksjonsteam-abonnement,
før add-ons og usage. 500 brukere fordelt over øvrige tiers gir et betydelig tillegg, men
fordelingen må fastsettes før et reelt ARR-tall kan beregnes.

> CAC/LTV/retention er **ennå ikke fastsatt** (pre-revenue). Et eget enhetsøkonomi-/
> break-even-notat anbefales som neste steg — kostnadsdataene over gjør det fullt mulig.

---

## Seksjon 6 — Markedsposisjon

### 6.1 Konkurransebildet: fragmentert status quo, ingen helhetlig konkurrent

Den ekte konkurrenten er ikke en annen plattform — det er **fragmenteringen selv**. Norske
produksjonsteam, innholdsprodusenter og dansestudioer koordinerer i dag med:

- **Excel + e-post + WhatsApp** — manuelt, spredt, ingen felles sannhet
- **Facebook og andre sosiale medier** — der casting-rop, auditions og distribusjon skjer
  uformelt

Det finnes internasjonale verktøy per «skive» (StudioBinder, Yamdu, Celtx for produksjon;
Spotlight, Casting Networks for casting; Jackrabbit for dans; Later/Hootsuite for sosialt),
men **ingen eier hele flyten idé → sett som ett system**, og få er tilpasset det norske
markedet. Kampen står derfor primært mot **non-consumption og kaos**, ikke mot én dominerende
aktør — historisk en av de sterkeste posisjonene et produkt kan ha.

### 6.2 Partnere, ikke konkurrenter — «integrer, ikke angrip»

| Aktør | Rolle |
|---|---|
| Statist-/skuespillerdatabaser | Integrasjonspartner (talent-tilgang) |
| NRK / TV2 | Ønsket integrasjonspartner |
| foto.no | Utstyrsintegrasjon |
| Læringsplattformer / skolesystemer | Utdanningssegmentet |
| **NSF / NFI** | Potensielle konkurrenter — men posisjoneres som **samarbeidspartnere** |

Strategien er bevisst: TheRoleRoom vil bli **systemet de etablerte aktørene selv ønsker å
bruke og samarbeide med**, ikke det som forsøker å fortrenge dem. NSF (Norsk
Skuespillerforbund) og NFI (Norsk Filminstitutt) *kan* være konkurrenter, men håndteres som
allierte — målet er at de plugger seg på, ikke at de utkonkurreres.

### 6.3 Plass i økosystemet

TheRoleRoom sitter i skjæringspunktet mellom fem verdener: **film/produksjon**,
**content/markedsføring**, **AI**, **SaaS** og **marketplace/plattform**. Posisjonen er å
være **bindevevet** som kobler disse sammen for norsk (og etter hvert europeisk)
film- og innholdsproduksjon.

### 6.4 Kategorien: merket *er* kategorien

TheRoleRoom jakter ikke på å vinne en eksisterende kategori — produktet **definerer en ny**,
forankret i en overbevisning:

> **«Hver god fortelling starter med de rette menneskene i de rette rollene.»**

Beskrivende er kategorien *operativsystemet der en produksjon besettes, koordineres og føres
fra de rette menneskene til en ferdig, sett fortelling — med alle i loop på hva som skjer og
når*. Men ambisjonen er at selve navnet skal være det som huskes: at «**The Role Room**» blir
begrepet folk bruker, slik at produktet *er* kategorien. Role Room skal være **der
progresjonen skjer** — stedet en produksjon vokser, og der alle parter deler samme bilde av
fremdrift.

### 6.5 Den unike posisjonen (det ingen andre har)

1. **Eier hele flyten idé → sett som ett OS.** De fleste verktøy stopper ved «ferdig
   produsert». Role Room fortsetter til «sett».
2. **Eier starten — idéen.** Idéer forsvinner ikke; idé-pipeline gjør bruken kontinuerlig,
   ikke episodisk (se Seksjon 3).
3. **«Integrer, ikke angrip».** Blir infrastruktur snarere enn en utfordrer — det åpner
   samarbeid med aktører som ellers ville vært konkurrenter.
4. **Norsk-/EU-native.** EU-datalagring, EHF-faktura, NAV-rapport, BRREG, norsk juridisk
   data, BankID på vei — passer det lokale markedet på en måte internasjonale verktøy ikke
   gjør.
5. **Transparens og «alle i loop».** Delt sannhet mellom leverandør og kunde, gjennom hele
   produksjonen.
6. **AI-lag på toppen** (Agenten, beta) — planlegging, markedsføring og innsikt innebygd.

---

## Seksjon 7 — Vekstmotorer og nettverkseffekter

### 7.1 Vekstmotorer

**Referral / word-of-mouth (den primære, tilsiktede motoren):**

- **Produksjonsselskaper anbefaler andre** — belønnet med bedre pris, fordeler
  («benefactors»), eller affiliate-perks (f.eks. kamerautstyr fra foto.no, eller verktøy
  som DaVinci Resolve og Adobe).
- **Dansere anbefaler dansere** — frilanser til frilanser.
- **CreatorHub-nivået er bygget for anbefaling:** anbefal CreatorHub til en annen kreatør
  → enklere administrasjon, mer fokus på det kreative, og deling av kunnskap. CreatorHub
  dekker profesjonsbaserte brukere (musikkprodusenter, fotografer, videografer, team).

**B2B2C-eksponering:** gjester som dras inn (klienter, crew, dansere, skuespillere)
opplever produktet uten å betale, og blir en kilde til konvertering og anbefaling.

**CreatorHub-funnel:** creators som «går opp et nivå» mot proff produksjon, ledes til
Role Room.

**Affiliate som dobbel motor:** affiliate-lenker (foto.no, DaVinci, Adobe m.fl.) er både en
vekst-incentiv *og* en potensiell inntektsstrøm (jf. Seksjon 5.5).

> **Sterkeste enkeltmotor:** **produksjonsteam** — de har størst ROI gitt hva Role Room
> tilbyr. Hvis innsatsen skal konsentreres ett sted, er det her.

### 7.2 Nettverkseffekter

- **To-sidig plattform:** flere integrasjoner (talent-databaser, foto.no, NRK/TV2) → mer
  verdi for produksjoner → flere produksjoner → mer attraktivt for integrasjonspartnere.
- **Tette vertikale miljøer:** produksjonsselskaper og dansestudioer er små, tett
  sammenvevde bransjer der anbefaling sprer seg raskt.
- **Produkt-suite-innvev:** jo flere CreatorHub-produkter (Live Set-mode, Post Agent →
  DaVinci) som veves inn i arbeidsflyten, jo sterkere blir både verdien og innlåsingen.

### 7.3 Switching cost etter 12 måneder

Etter et år på plattformen er det dyrt å forlate Role Room — av både harde og myke grunner:

**Harde (data og oppsett):**
- Alle prosjektene de har startet, med full **kontroll og eierskap** over prosjektet
- Akkumulert idé-pipeline, manus-versjoner, talent-/crew-relasjoner, budsjetthistorikk,
  klient-godkjenningslogg og oppsatte integrasjoner
- Arbeidsflyt-spesifikke artefakter: **storyboard med tegnefunksjon**, **lokasjonsanalyse**,
  **Live Set-mode** (bro mellom produksjon og post-produksjon)

**Myke (atferd og opplevelse):**
- **Støy-eliminering:** Role Room fjerner kaoset i produksjonssammenheng. Når et team
  først har opplevd ro, oversikt og «alle i loop», er det smertefullt å gå tilbake til
  Excel + e-post + WhatsApp.
- **Hele måten å jobbe på** er bygget rundt Role Room — verktøyet blir infrastrukturen
  teamet tenker gjennom.

---

## Seksjon 8 — Ambisjon og tidshorisont

### 8.1 Hvor stort: ambisjonsnivået

Ambisjonen er **stor** — troen er at dette kan bli kjempestort. Geografisk er stigen
**Norge først → Europa** (muliggjort av EU-datalagringen lagt allerede i arkitekturen) →
**globalt som en reell mulighet**. Den internasjonale ambisjonen bæres av Role Room som
flaggskip, via CreatorHub-paraplyen.

**Utdanningsinstitusjoner som tillits- og inntektskile:** ved å bli verktøyet
utdanningsinstitusjoner bruker, bygges bredere tillit i hele bransjen — som igjen drar
flere aktører med.

**Adopsjonslogikken:** skape en **FOMO-effekt**, men forankret i **bevis** — at
produksjonene til selskapene faktisk blir enklere med Role Room. Når det er bevist, henger
flere aktører seg på, og investorer blir en reell mulighet. Nøkkelen er å **penetrere et
marked som ikke visste at det trengte verktøyet**.

**Filosofien — effektivisere, ikke erstatte:** Role Room skal ikke erstatte noens funksjon,
men gjøre arbeidet mer effektivt. AI er på vei, men **det menneskelige perspektivet er det AI
ikke kan ta fra oss** — kunsten er å gi AI den riktige informasjonen for å levere godt. Og
Role Room er allerede et godt produkt **«out of the box»**, ikke avhengig av AI for
kjerneverdien.

### 8.2 3-årsvisjonen

> Role Room brukes av **flere av de største produksjonsselskapene**, er **det foretrukne
> systemet**, og er et verktøy **utdanningsinstitusjoner blir avhengige av å bruke**.

### 8.3 10-årsvisjonen

> Investorer er med og gjør Role Room om til det foretrukne systemet som gjør at
> **produksjon og prosjektstyring blir en fryd — ikke en byrde eller flaskehals**. Role Room
> (og CreatorHub) er da bindevevet for film- og innholdsproduksjon, det bransjen
> koordineres gjennom.

### 8.4 Hva må være sant for at den største visjonen realiseres

| Forutsetning | Hva det krever |
|---|---|
| **Partnerskap** | At aktører som NSF/NFI, NRK/TV2, foto.no, talent-databaser og utdanningsinstitusjoner kobler seg på — «integrer, ikke angrip» må lykkes |
| **Kapital** | Finansiering til å skalere produkt og marked |
| **Teknologi** | Agenten skipes, offentlig API åpnes, BankID + compliance på plass |
| **Team** | Grunnleggeren må gå fra solo til å **ansette flere i CreatorHub** slik at produktet kan skalere |

> Den ærlige flaskehalsen i dag: dette er i stor grad et solo-drevet produkt. Den største
> visjonen forutsetter at team, kapital og partnerskap bygges opp rundt det.

---

## Tillegg — anbefalte neste leveranser

Underveis dukket det opp tre konkrete behov som fortjener egne dokumenter:

1. **Personvern-/compliance-notat** — DPA, Datatilsynet-dialog (sikkerhetsnivå 3 vs. 4),
   EU-region-verifisering. (Fra Seksjon 4.)
2. **BankID-beslutningsnotat** — leverandørvalg og løsningsnivå. (Fra Seksjon 4.)
3. **Enhetsøkonomi-/break-even-modell** — basert på prising (Seksjon 5) og kostnadsdata,
   mot målene 500 brukere / ~15 produksjonsselskaper. (Fra Seksjon 5–7.)

### 5.7 Avgrensning mot CreatorHub

De 32 aktive Stripe-prisene spenner over **både TheRoleRoom og CreatorHub**. CreatorHub-
produkter (f.eks. resume-/CV-maler, fotograf-verktøy, `nextrole`-marketplace) har sin egen
prising og er **utenfor scope** for dette dokumentet. Dette dokumentet dekker Role Rooms
inntektsstrømmer.
