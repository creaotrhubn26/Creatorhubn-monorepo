# Leadgrid — Produktdokumentasjon

> Strategisk produktdokumentasjon for posisjonering, investor-pitcher, onboarding,
> strategisk planlegging og partner-outreach (byråer, B2B-salgsteam, franchise-kjeder,
> markedsavdelinger).
>
> Sist oppdatert: 2026-06-20.

---

## Sammendrag (TL;DR)

**Leadgrid er det kartbaserte CRM-operativsystemet for solgte fordistribuerte salgsteam** —
fra første kalde pin på kartet, gjennom auto-onboarding av kunden med BRREG-oppslag, til
løpende oppfølging, ad-tech-eksponering og rapportering oppover i hierarkiet. Mens
[TheRoleRoom](./THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md) eier reisen for film- og
innholdsproduksjon, eier **Leadgrid** reisen for det moderne feltsalgs- og
markedsoperasjons­teamet. Det er det andre flaggskipet i **CreatorHub**.

- **Produkt-arkitektur:** iPad-først (TestFlight live, v0.5.0 build 20260621) med web-hub
  for super-admin og markedssjef. Alle 49 super-admin-tabs har full iPad-paritet — Daniel
  bruker iPad i felt, ikke laptop.
- **Multi-rolle:** super_admin → markedssjef → teamleder → salgskonsulent → promotør →
  research. Hver rolle har egne backdrops (22 tematiske bakgrunner i iPad-appen), egne
  views, og separat RBAC (45-key matrise + per-bruker overstyringer).
- **Forretningsmodell:** SaaS-abonnement (gratis Solo / 199 kr Solo Pro / 990 kr Agency /
  Enterprise on-request). **Pre-revenue** — modellen er bygget i Stripe og DB
  (`plan_limits`-katalog seeded), men de første kundene er fortsatt i pipeline.
- **Posisjon:** konkurrenten er fragmenteringen (Pipedrive + Google Maps + Excel + WhatsApp
  + manuell BRREG-oppslag), ikke ett enkelt produkt. Strategi: **«kart-først, mobil-først,
  norsk-først»** — bygg den eneste CRM-en som faktisk lever på iPaden ute i felt, med live
  selger-pins og distanse-til-lead som førsteklasses primitiver.
- **Vekstmotorer:** salgshierarkiet selv er en vekstmotor — én markedssjef tar med seg et
  helt team. Ad-tech-stack (Google/Meta/LinkedIn/TikTok) gir markedssjefen tilbake-syklus
  fra annonse → lead → onboardet kunde → faktisk omsetning, transparent på kartet.
- **Ambisjon:** Norge → Norden → Europa. 3 år: brukt av norske B2B-avdelinger og
  agenturer som lever på feltsalg (energi, telekom, eiendomstjenester, agro, foodservice).
  10 år: standarden for «hvor er teamet, hvor er pengene, hvor skal vi neste» i Europa.
- **Ærlig status:** pre-revenue, iPad-appen er på TestFlight (ikke i App Store ennå),
  ad-tech-modulen og analyzer-API-et er bygget men ikke kjørt mot betalende kunde, og
  Meta/LinkedIn-conversion-APIene venter på App Review (samme prosess som TheRoleRoom).

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

### 1.1 Leadgrid i én setning

> **Leadgrid er det kartbaserte CRM-operativsystemet som tar et salgsteam fra første
> dropped pin i felt, gjennom auto-onboarding av kunden, til faktisk omsetning rapportert
> oppover — alt på iPad, på norsk, med live selger-pins og ad-tech innebygget.**

### 1.2 Leadgrid i ett avsnitt

Leadgrid er et **prosjekt-operativsystem for B2B-feltsalg og markedsoperasjoner**. Der de
fleste CRM-er ble bygget for telefon-/e-post-selgere som sitter ved en pult (Pipedrive,
HubSpot, Salesforce), er Leadgrid bygget rundt **kartet som førsteklasses primitiv** og
**iPaden som primær flate**. Reisen begynner med en pin: en promotør eller salgskonsulent
ute i felt dropper en pin på kartet, fyller inn et minimum av data (org-nummer eller
adresse), og Leadgrid auto-onboarder kunden via BRREG-oppslag, bedrifts-logo-fetch
(apple-touch → og:image → favicon → Google s2-fallback), og Claude-baserte rangeringer.
Salgskonsulenten ser distanse og kjøre-tid til alle leads, kan navigere direkte i Maps,
og lederen kan se hele teamet sitt live på kartet (GDPR opt-in, watchPosition). Markeds­
sjefen får tilbake-syklus: hvilke annonser ble sett, hvilke leads ble til kunder, hvor
mye fakturerte vi inn. Der konkurrentene stopper ved «pipeline-tab», fortsetter Leadgrid
til **«hvor sto teamet, hva ble solgt, hva kostet det å skaffe kunden, og hva neste»**.

### 1.3 Hva Leadgrid IKKE er

Avgrensningen er like viktig som definisjonen. Leadgrid er:

- **Ikke en generisk CRM som tilfeldigvis har et kart.** Kartet er sentrum, ikke en fane.
  Hver kjerne-arbeidsflyt (lead-fangst, lead-tildeling, distanse-/rute-planlegging,
  selger-posisjon, klient-portal) er bygget ut fra kart-primitiv-en.
- **Ikke en ren markedsføringsplattform.** Annonser, conversion-tracking og
  ad-tech-stack ligger inne, men formålet er å lukke loopen mellom *spend* og *omsetning*
  — ikke å erstatte en kreatør- eller byrå-prosess.
- **Ikke et regnskaps- eller faktura-system.** Leadgrid eksponerer transparent oversikt
  over hva som er solgt og hva som er fakturert (via Stripe), men erstatter ikke
  Tripletex / Visma / PowerOffice.
- **Ikke kun for store team.** Solo-tieren (gratis) er en bevisst on-ramp for
  enkeltselgere og mikro-byråer — et team kan starte alene og legge til hierarki når de
  vokser, uten å bytte verktøy.
- **Ikke en talent- eller crew-database.** Leadgrid handler om *kundene dine* og *teamet
  ditt*. Hvis du trenger å forvalte freelancere/talents, lever det i TheRoleRoom (1.4).
- **Ikke et generisk «field service»-verktøy.** Leadgrid optimaliserer for *salg*, ikke
  for service-utførelse (montørruter, varelevering, etc.). Disse er nabokategorier som
  potensielt kan integreres, men ikke kjernen.
- **Ikke det samme som TheRoleRoom.** TheRoleRoom = film- og innholdsproduksjon.
  Leadgrid = feltsalg + B2B-CRM. Begge er flaggskip under CreatorHub. Se 1.4.

### 1.4 Forholdet til CreatorHub og TheRoleRoom

**CreatorHub er merkevaren og paraplyen. TheRoleRoom og Leadgrid er to flaggskip under
den, som dekker hver sin profesjon.**

- **TheRoleRoom** = operativsystemet for **film- og innholdsproduksjon** (idé → casting →
  produksjon → distribusjon → sett). Persona: produsenter, casting directors,
  innholdsprodusenter, dansestudio. Se [`THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md`](./THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md).
- **Leadgrid** = operativsystemet for **B2B-feltsalg og markedsoperasjoner** (pin →
  onboard → oppfølging → omsetning → rapportering). Persona: markedssjefer,
  salgskonsulenter, promotører, B2B-byråer.

```
CREATORHUB  (merkevaren + den brede plattformen for kreativt arbeid og operasjoner)
│   Academy (læring)  ·  Community (fellesskap)
│
├─ THE ROLE ROOM  ★ FLAGGSKIPET FOR FILM- OG INNHOLDSPRODUKSJON
│      idé → casting → produksjon → distribusjon → sett
│
└─ LEADGRID  ★ FLAGGSKIPET FOR B2B-FELTSALG OG MARKEDSOPERASJONER
       pin → onboard → oppfølging → omsetning → rapportering
       (iPad-først, kart-først, norsk-først)
```

**Hvorfor to flaggskip og ikke ett:** profesjonene er ulike og kjøperne er ulike. En
produsent vil aldri kjøpe en CRM-pakke fordi de eier en castingflate; en markedssjef vil
aldri kjøpe en castingflate fordi de bruker Leadgrid. Men begge produktene **deler
infrastruktur**: samme auth, samme Stripe-konto, samme org-modell, samme Claude- og
WhatsApp-integrasjoner, samme B2-arkivering. Kostnadssiden multipliseres ikke; verdien
gjør.

**Mulig fremtidig kryss-syklus:** en markedssjef på Leadgrid som *også* skal lage en
kunde-case-video kjøper minutter i Post Agent. En produsent på TheRoleRoom som *også*
selger reklamefilm til lokale bedrifter låner Leadgrid-pinene som lead-pipeline.
Ingenting av dette er live ennå — men arkitektur-grunnlaget (felles `organizations`-rad,
felles `users.role`-felt) gjør det rimelig å åpne.

---

## Seksjon 2 — Kjernefunksjonalitet

> Denne seksjonen beskriver det som **eksisterer i dag** (iPad-app v0.5.0 på TestFlight +
> web-hub i prod), ikke roadmap. Statusen («live» vs. «beta») er markert eksplisitt.

### 2.1 To kundevendte flater: iPad-app + web-hub

Leadgrid eksisterer i **to flater som deler samme backend og samme database**:

| Flate | Hvor | Persona | Status |
|---|---|---|---|
| **iPad-app (Leadgrid)** | TestFlight (bundle `com.creatorhubn.LeadMapApp`, ASC `6781389356`) | Markedssjef + salgskonsulent + promotør + super_admin | ✅ Live på TestFlight, v0.5.0 build 20260621 |
| **Web-hub (Admin Room)** | `theroleroom.com` (samme deploy) | Super_admin + markedssjef | ✅ Live |
| **Klient-portal (white-label)** | Per-org subdomene | Sluttkunde (organisasjonen som ble solgt til) | ✅ Live (Agency-tier) |

Web-hub-en er ikke en separat applikasjon — den er en del av samme React-frontend som
hoster TheRoleRoom, men gates på `users.role` og `appState.activeOrganizationId`.
iPad-appen er en native SwiftUI-app som snakker direkte mot `/api/leadgrid/*`-endepunktene.

### 2.2 Kjernemodul — Kart og leads (LIVE)

Den **definerende modulen**. Alt annet i produktet henger på denne.

| Funksjon | Hva den gjør |
|---|---|
| **Pin-konstellasjoner** | Hver lead er en pin på kartet, kategorisert som lead (drop-pin), kunde, konkurrent (diamant) eller markedslandskap-element. Klynging ved zoom-ut. |
| **Distanse + drive-time** | Hver pin viser distanse fra selgers nåværende posisjon, kjøre-tid via Google Maps, og en «naviger»-knapp som åpner Maps med riktig destinasjon. |
| **Live selger-pins** | Med GDPR opt-in (`watchPosition`) ser markedssjefen hele teamet sitt live på kartet — hvor er promotørene, hvor sto de sist, hvilken kunde er de inne på. 60s heartbeat → online-badge. |
| **Filter-toggles** | Vis kun leads, vis kun konkurrenter, vis kun mine vs. teamets. Per-rolle defaults. |
| **Lead-fangst** | Drop en pin → fyll org-nr eller adresse → BRREG-oppslag + bedrifts-logo-auto-fetch (apple-touch → og:image → favicon → Google s2) → ferdig kort. Tar < 30 sek per pin i felt. |
| **Lead-tildeling** | Markedssjef/teamleder tildeler eller balanserer leads til selgere, med full audit-trail. |
| **Status-historikk** | Hver status-endring (kalt → møte → tilbud → vunnet/tapt) er sporet med tidsstempel og hvem som endret. |

### 2.3 Kjernemodul — Salgshierarki + RBAC (LIVE)

Leadgrid er multi-tenant (org-arkitektur), og innenfor hver org støttes et **fire-niveau
salgshierarki** + super_admin:

```
SUPER_ADMIN  (Creatorhub AS — Daniel; ser alle orgs)
│
└─ ORG (kjøper, f.eks. et byrå eller en intern markedsavdeling)
    │
    └─ MARKEDSSJEF                    ── eier orgens kart, ad-spend, rapporter
        │
        └─ TEAMLEDER                  ── eier et team av selgere
            │
            └─ SALGSKONSULENT         ── tar ekte salgsmøter, lukker
            │
            └─ PROMOTØR               ── første-touch, dropper pins, varmer opp
            │
            └─ RESEARCH               ── Claude-assistert lead-research, SWOT
```

**RBAC-matrise:** 45 keys (read/write per sub-flate) + per-bruker overstyringer. Audit på
hvert key-endring. Eksempel: en promotør kan `lead.create` og `lead.update_status`, men
ikke `team.balance_leads` eller `ad_spend.view_total`.

**Profil-krav:** alle brukere må ha 4 påkrevde felt (profilbilde, e-post, telefon,
tittel) før de kan operere på org-en. Online-badge 60s heartbeat.

### 2.4 Kjernemodul — Auto-onboarding + BRREG (LIVE)

Den **tids-multiplikatoren** som gjør pin → kunde til en 30-sekunds-affære.

| Steg | Hva skjer automatisk |
|---|---|
| 1. Drop pin + org-nr eller adresse | — |
| 2. BRREG-oppslag | Navn, org-form, ansatte, omsetning, daglig leder, adresse |
| 3. Bedrifts-logo-fetch | Apple-touch-icon → `og:image` → favicon → Google s2-fallback. Låst til org-eier. |
| 4. Claude-skåring | Recommendation-rank basert på bransje, størrelse, signaler |
| 5. Lead-kort generert | Klart til første kontakt; promotør kan registrere besøk umiddelbart |
| 6. (Solo Pro / Agency) Automation-regel | Trigger e-post/SMS/WhatsApp-velkomst på første status-skift |

Plan-grense: Solo gratis 3 auto-onboards/mnd, Solo Pro 30/mnd, Agency ubegrenset.

### 2.5 Kjernemodul — Ad-tech-stack (LIVE)

For markedssjefer som vil lukke loopen mellom annonse-spend og omsetning.

| Integrasjon | Hva støttes | Status |
|---|---|---|
| **Google Ads** | Pixel-provisjon, conversion-rules (lead/demo/signup), reporting | ✅ Live (AW-conversion-tracking aktiv) |
| **Meta (FB/IG)** | Pixel, CAPI, audience-sync | ✅ Live (App Review pending — se 4.7) |
| **LinkedIn Ads** | Insight Tag, Conversion Rules, Reporting; CAPI + Lead Sync «Review in progress» | ✅ Live (delvis) |
| **TikTok Ads** | Pixel, conversion API | ✅ Live |
| **GA4 / GTM / GSC** | Verktøy for å verifisere installasjon og se trafikk per landingsside | ✅ Live |
| **Approval-flow** | Markedssjef sender utkast → super_admin godkjenner | ✅ Live |

Lead Map → markedslandskap kobler **konkurrenters posisjon på kartet** (lagt av research
eller hentet fra `market_scan_competitors`-tabellen) med en **threat-vurdering** og en
**Claude-anbefalt prioritering** av hvilke leads salgskonsulenten bør prioritere først.

### 2.6 Kjernemodul — Klient-portal (white-label, Agency-tier, LIVE)

Sluttkunden (organisasjonen som ble solgt til av byrået) får en **egen white-label
portal** på et per-org-subdomene. Der ser de:

- Hvor mange leads har byrået jobbet med denne måneden
- Hvilke kunder er onboardet (auto-onboard-historikk)
- Hvilke annonser kjører og hva spend-en er
- Hvilke rapporter er klare for nedlasting

Dette er **Leadgrids svar på TheRoleRooms «alle i loop»-prinsipp**: transparens mellom
leverandør (byrå/markedsavdeling) og kunde (organisasjonen som mottar tjenesten).

### 2.7 Tverrgående: kommunikasjon (LIVE)

| Kanal | Bruk | Merknad |
|---|---|---|
| **WhatsApp Business (Meta Cloud API)** | Lead-velkomster, team-meldinger, status-oppdateringer | 10 templates APPROVED (NO+EN). 0,12 NOK/utility-melding NO. |
| **SMS (Twilio)** | Selger-påminnelser, kunde-bekreftelser | Fakturert per melding |
| **E-post (Resend)** | Newsletter-nurture, rapporter, klient-portal-invitasjoner | Per-org branding |
| **Push (APNS)** | Lead tildelt, ny status, team-meldinger på iPad | Live i appen |
| **Bell-inbox** | Alle varsler samlet i én feed | Live (web + iPad) |

### 2.8 Tverrgående: AI-lag — Claude (LIVE for research, BETA for anbefaling)

Drevet av Claude. Tre live-bruks-områder:

1. **Lead-research:** ta org-nummer + sosiale signaler → generer SWOT, identifiser
   beslutningstaker-roller, foreslå inngangsvinkel.
2. **Konkurrent-SWOT:** for hver konkurrent på markedslandskap-kartet, en Claude-rapport
   over styrker/svakheter/trusler/muligheter, oppdatert kvartalsvis.
3. **Anbefalingsrang:** sorter leads etter sannsynlighet for å lukkes (Claude
   recommendation_rank-felt på `crm_customers`).

Beta (ikke live): autonomous outreach (Claude som sender første DM selv) — bygd, ikke
skipet ennå pga. tillit-/governance-spørsmål.

### 2.9 Integrasjoner

| Integrasjon | Rolle | Status |
|---|---|---|
| **Stripe** | Abonnement + EHF-faktura | ✅ Live (`plan_limits`-katalog seeded) |
| **BRREG** | Norske selskapsoppslag i auto-onboarding | ✅ Live |
| **Google Maps** | Distanse, kjøre-tid, naviger-knapp | ✅ Live |
| **Google Workspace** | Calendar (møte-booking), e-signatur, Sheet-eksport | ✅ Live |
| **Claude (Anthropic)** | Lead-research, SWOT, ranking | ✅ Live |
| **Meta Cloud API (WhatsApp)** | Lead-/team-kommunikasjon | ✅ Live |
| **Twilio** | SMS | ✅ Live |
| **APNS** | iPad-push | ✅ Live |
| **Google/Meta/LinkedIn/TikTok Ads** | Ad-tech-stack | ✅ Live (delvis, se 2.5) |
| **GA4 / GTM / GSC** | Installasjons-verifisering | ✅ Live |
| **BankID / Vipps** | Verifisering / norsk betaling | 🎯 Planlagt — Vipps lav prioritet siden EHF dekker |

### 2.10 Interne vekst-/ops-verktøy (IKKE kundeprodukt)

Disse modulene finnes i super_admin-hub-en, men er verktøy Creatorhub AS bruker selv —
ikke kundefunksjoner: B2B-pipeline (leads inn til Creatorhub som org), Customer Success-
dashboard (renewals + churn-risk), partner-applikasjoner, developer-program, observability/
plattform-helse, migrations-trigger, B2-arkiv-oversikt. Markedssjefer ser ikke disse.

### 2.11 Oppsummering: kjerne vs. støttende

- **Kjerne (live):** Kart + leads, salgshierarki + RBAC, auto-onboarding + BRREG,
  ad-tech-stack, klient-portal.
- **Kjerne-nær (live):** kommunikasjon (WhatsApp/SMS/e-post/push/bell), Claude-research.
- **Støttende infrastruktur (live):** iPad-app, web-hub, klient-portal, Stripe-billing.
- **Fremtidig kjerne-differensiator (beta):** autonomous outreach via Claude.
- **Ikke kundeprodukt:** super_admin-interne ops-verktøy.

---

## Seksjon 3 — Målgrupper og bruskcases

### 3.1 Forretningsmodell-struktur: B2B og B2B2B (ikke B2C)

Leadgrid er **ren B2B, med en B2B2B-vinkling**. Hver org-kjøper drar gjerne med seg en
*kunde* (sluttkunden) inn på klient-portalen, men sluttkunden betaler ikke direkte.

| Persona | Kjøper (buyer) | Brukere som dras inn (B2B2B) |
|---|---|---|
| **B2B-byrå** | Byrået | Byråets kunder (via klient-portal) |
| **Intern markedsavdeling** | Selskapets eier av markedsbudsjettet | Salgskonsulentene + promotørene |
| **Feltsalgs-team i bransje** (energi, telekom, agro, foodservice) | Markedssjef / salgsdirektør | Selgerne ute i felt |
| **Franchise-kjede** | Hovedkontor | Hver franchisetaker |

### 3.2 Komplett liste over brukertyper

| # | Brukertype | Kontekst |
|---|---|---|
| 1 | Super_admin | Creatorhub AS — ser alle orgs (Daniel) |
| 2 | Markedssjef | Org-eier — eier kart, ad-spend, rapporter |
| 3 | Teamleder | Eier et team av selgere |
| 4 | Salgskonsulent | Lukker salg, eier kunde-relasjonen |
| 5 | Promotør | Felt — dropper pins, første-touch |
| 6 | Research | Claude-assistert lead-research + SWOT |
| 7 | Klient (sluttkunde) | Bruker klient-portalen (white-label, Agency) |
| 8 | Partner | B2B-byrå-partner som ressurs-byttes via partner-program |

### 3.3 Jobber, frekvens og retention per brukertype

| Brukertype | Primær jobb | Sekundær jobb | Frekvens | Hva får dem tilbake |
|---|---|---|---|---|
| **Markedssjef** | Lukke loopen spend → omsetning | Team-styring, rapporter oppover | **Daglig** | Live ROI-bilde, ingen Excel-konsolidering |
| **Teamleder** | Balansere leads, coache selgere | Følge live-pins, ukerapport | **Daglig** | Ser teamet sitt på kartet i sanntid |
| **Salgskonsulent** | Lukke salg | Oppfølging, ruteplanlegging | **Daglig** | Distanse-til-lead + Maps-navigasjon |
| **Promotør** | Dekke geografisk område med pins | Første-touch-kontakt | **Daglig (i felt)** | iPad-først, ikke en laptop-CRM |
| **Research** | Claude-research per lead/konkurrent | SWOT, beslutningstaker-roller | Episodisk per kvartal | Datadrevet prioritering for selgerne |
| **Klient (sluttkunde)** | Se hva byrået leverer | Verifisere spend → resultat | Ukentlig | White-label-portal, transparent |

### 3.4 Hvorfor markedssjef er retention-kjernen

Den vanlige svakheten ved feltsalg-CRM-er er at selgerne blir trukket tilbake til
WhatsApp/Excel når de er stresset. Leadgrid binder retention på **markedssjef-nivået**:

- **Spend-rapporter:** når annonse-spend først er kalibrert mot Leadgrid-conversion-rules,
  vil markedssjefen sjekke ROI-en daglig — det er hans/hennes egen bonus.
- **Ad-tech-stack-innlåsing:** Meta/Google/LinkedIn/TikTok-conversion-konfig er ikke
  triviell å rive løs og bygge opp et annet sted.
- **Live-team-bilde:** markedssjefen ser hele teamet sitt på kartet — dette finnes ikke
  i Pipedrive/HubSpot/Salesforce.
- **Sluttkunden vil ha klient-portalen:** når byrå-kunden først har vent seg til den
  white-label-portalen, blir det dyrt å bytte for byrået.

### 3.5 Primære vs. sekundære bruskcases

- **Primære:** (1) feltsalg i B2B-bransjer med geografisk distribuerte kunder (energi,
  telekom, agro, foodservice, eiendomstjenester); (2) B2B-markedsføringsbyrå som vil
  levere transparente spend → omsetning-rapporter til kunde; (3) franchise-kjede som vil
  ha samme arbeidsflyt i alle ledd.
- **Sekundære:** intern markedsavdeling som vil samle alt ad-tech + CRM på ett sted;
  enkelt-selger som vil bygge sin egen pipeline (Solo-tier).

### 3.6 Retention-ankrene

De sticky brukerne er **markedssjefer** (daglig spend-overvåking) og **selgere i felt**
(daglig pin-dropping + Maps-navigasjon). Promotører er mer episodiske (kampanjebasert),
men låst via push-varsler og bell-inbox.

---

## Seksjon 4 — Teknisk arkitektur (høynivå)

### 4.1 Tech stack

| Lag | Teknologi |
|---|---|
| **iPad-app** | SwiftUI (iOS 17+), GRDB (lokal cache), URLSession, Fastlane (TestFlight) |
| **Web-frontend** | React + Vite, MUI, React Query |
| **Backend** | Node ≥20, Express 5, modulær monolitt (samme `index.ts` som TheRoleRoom) |
| **Database** | PostgreSQL (Neon, serverless) + Drizzle ORM |
| **Realtime** | Socket.io (web) + APNS push (iPad) |
| **AI** | Claude (Anthropic) |
| **Maps/geo** | Google Maps SDK (iOS + web) |
| **Hosting** | Vercel (frontend) + Render (backend) |
| **Fillagring** | Backblaze B2 (per-org bucket) |
| **CI/CD** | GitHub Actions + EAS (for Tauri-naboprodukter) + Fastlane (iOS) |

### 4.2 Arkitektur-stil: delt monolitt med produkt-bundles

Leadgrid bor i samme **modulær monolitt** som TheRoleRoom. Backend-koden er separert i
~120+ moduler (dep-injection-mønster), og Leadgrid-spesifikke ruter ligger som
`leadgrid-*-routes.ts`-filer (`leadgrid-billing-routes.ts`,
`leadgrid-onboarding-routes.ts`, `leadgrid-client-portal-routes.ts`, osv.).

**Hvorfor delt monolitt:** lav drifts­kompleksitet, gjenbruk av auth/Stripe/Claude/
WhatsApp-integrasjoner, én database-migrasjonspipeline. Skal Leadgrid senere splittes ut
som egen tjeneste, er modulgrensene allerede tegnet.

### 4.3 iPad-først-arkitektur

Leadgrid er det første produktet i monorepoet som er **iPad-først** (TheRoleRoom har en
iPad-companion for talents, men kjernen lever på web). Konsekvenser:

- **Lokal cache (GRDB):** alle leads/kunder synkroniseres lokalt på iPaden så promotørene
  kan jobbe offline når det blir spotty 4G på vidda.
- **APNS push:** lead tildelt → push umiddelbart, ikke avhengig av at appen er åpen.
- **Native kart:** Google Maps SDK direkte i SwiftUI, ikke en WebView-wrapper.
- **49 super_admin-tabs har full iPad-paritet:** Daniel bruker iPad i felt — alle web-
  funksjoner er bygd ut native på iPad i 29 faser (PR-er #760–#820).
- **22 tematiske backdrops** mapped per rolle (markedssjef/super_admin/salgshierarki/
  research) for at brukeren skal se «hvor er jeg» på et blunk.

### 4.4 Data som samles inn — og hvorfor

| Datakategori | Hvorfor | Sensitivitet |
|---|---|---|
| Selger-posisjon (lat/lng) | Live team-bilde på kartet | **Høy** — GDPR opt-in obligatorisk |
| Lead-/kunde-data (org-nr, navn, kontakt) | Drive CRM | Moderat |
| BRREG-snapshots | Auto-onboarding | Lav (offentlige data) |
| Ad-tokens (Google/Meta/LinkedIn/TikTok OAuth) | Ad-tech-stack | **Høy** — kryptert |
| AI-bruk (Claude-token, prompts) | Research + governance | Moderat |
| Klient-portal-aksess | White-label leveranse | Moderat |

### 4.5 GDPR / personvern-arkitektur

**Prinsipp:** all data lagres i **EU/EØS** (Neon EU-region, B2 EU-bucket). Selger-
posisjon er det mest sensitive feltet.

**På plass i dag:**
- **Selger-pin opt-in:** ingen `watchPosition` uten eksplisitt consent. Audit per session.
- **45-key RBAC:** per-bruker overstyringer, audit per endring.
- **Audit-logg:** alle status-skift, alle tildelinger, alle ad-tech-actions.
- **Krypterte ad-tokens:** Google/Meta/LinkedIn/TikTok OAuth-tokens i `integration_accounts`.

**Kjent gap / i pipeline:**
- Databehandleravtale (DPA) — i pipeline (deles med TheRoleRoom).
- BankID for verifisering av sluttkunde og av selgere i felt — gated på betalende kunder.
- Datatilsynet-dialog om sikkerhetsnivå — i pipeline.

### 4.6 Sikkerhet og verifisering

**På plass i dag:** API-nøkkel-håndhevelse, CORS, HTTPS, krypterte tokens, audit-logg,
samtykkesporing for posisjonsdeling.

**Planlagt — BankID:**
- Verifisere sluttkundens kontaktperson ved første onboarding
- Verifisere selgere når de jobber med større kontrakter
- Cost: ~3–8 NOK/signering via Signicat eller direkte OIDC (delt prosess med TheRoleRoom)

### 4.7 Åpne punkter / kjente tekniske gap

1. **Meta CAPI/Lead Sync app review** — «Review in progress», blokkerer server-side events.
2. **LinkedIn CAPI/Lead Sync** — samme status.
3. **DPA + Datatilsynet-klassifisering** — i pipeline.
4. **App Store-publisering** (ut av TestFlight) — pending kommersiell beslutning.
5. **Offline-mode for promotører i felt** — GRDB-cache finnes, men full konfliktløsning på
   sync-back er ikke ferdig.
6. **8 eksponerte tokens** (felles med TheRoleRoom, fra historisk dialog) — krever
   rotering: META_APP_ACCESS_TOKEN, STRIPE_SECRET_KEY, DATABASE_URL, NEON_API_KEY,
   VERCEL_TOKEN, RENDER_TOKEN, TWILIO_AUTH_TOKEN, ANTHROPIC_API_KEY.

---

## Seksjon 5 — Forretningsmodell

### 5.1 Status: pre-revenue

Leadgrid er **pre-revenue** — ingen betalende kunder ennå. Plan-katalogen er bygget i
`plan_limits`-tabellen (migrasjon 0312), prisene er konfigurert i Stripe, og første
betalende kunde er i pipeline.

### 5.2 Inntektsmodell — abonnement (kjernen)

Per måned, eks. mva (kilde: `plan_limits`-seed):

| Plan | Pris/mnd | Aktive kunder | Auto-onboards/mnd | Playbooks | Team-medlemmer | Automation | Custom fields | Pitch Deck Studio | White-label | Salgshierarki | Audit-logg |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Solo (gratis)** | 0 kr | 1 | 3 | 3 | 1 | ❌ | ❌ | ❌ | ❌ | ❌ | 7 dager |
| **Solo Pro** | **199 kr** | 10 | 30 | Ubegrenset | 1 | ✅ | ✅ | ✅ | ❌ | ❌ | 90 dager |
| **Agency** | **990 kr** | Ubegrenset | Ubegrenset | Ubegrenset | Ubegrenset | ✅ | ✅ | ✅ | ✅ | ✅ | 365 dager |
| **Enterprise** | Custom | Ubegrenset | Ubegrenset | Ubegrenset | Ubegrenset | ✅ | ✅ | ✅ | ✅ | ✅ | 730 dager |

> Alle beløp er seed-defaults; **Stripe er kilde til sannhet og admin-redigerbar.**

### 5.3 Usage-baserte strømmer

| Strøm | Modell | Merknad |
|---|---|---|
| WhatsApp | 0,12 NOK / utility-melding (NO) | Via Meta Cloud API. 10 templates APPROVED. |
| SMS | 2,00 kr/stk (eks. mva) | Twilio-kost ~0,65 kr → margin ~1,35 kr |
| Ad-tech management-fee | Klient-forhandlet (20 % påslag-mønster fra MedInnova) | Per kunde, ikke standard |

### 5.4 Billing-modell: abonnement + faktura + grace-vindu

- **Abonnement** via Stripe — månedlig, per org, med 14-dagers trial.
- **Fakturabasert (EHF)** for Agency- og Enterprise-tier.
- **14-dagers grace-vindu** etter nedgradering eller mislykket betaling (`plan_grace`-
  tabell) — kunden mister ikke data umiddelbart.
- **Overage-billing:** når auto-onboards / e-poster / Claude-calls overstiger plan-grensen,
  faktureres overforbruk separat (`leadgrid-overage-billing.ts`).
- **Comp/tester-tilgang:** administrert utenom Stripe.

### 5.5 Planlagte / fremtidige inntektsstrømmer

**Bekreftede planer:**

- **Markedsplass for B2B-bransjer:** kostnaden per BRREG-oppslag og per Maps-API-call
  pakkes inn som «Bransje-pakker» (Telekom, Energi, Agro, Foodservice) med kuratert
  konkurrent-landskap og pre-trained Claude-prompts.
- **Partner-program:** byrå-til-byrå-henvisning gir % av første-års kontrakt.
- **Pitch Deck Studio som add-on:** finnes i iPad-appen (worktree `pitch-deck-studio`),
  kan monetiseres som premium-funksjon for byråer.

**Monetiseringskandidater (forslag til vurdering):**

1. **Per-pin overforbruk** — gratis tier dekker N pins, deretter per-pin-pris.
2. **Verifisert tillit-tier** når BankID er på plass — verifiserte selgere er en premium
   funksjon for større kunder.
3. **Klient-portal som standalone-produkt** — solgt direkte til sluttkunden, ikke gjennom
   byrået, som en transparens-pakke.
4. **Ad-spend % som revenue-share** — alternativ til faste plan-priser for byråer som
   forhandlinger godt med kundene sine.
5. **Salgsdata-anonymisert benchmark** — markedssjefer får tilgang til anonymiserte
   benchmark-tall (close-rates per bransje, gjennomsnittlig auto-onboard-tid, osv.) i
   Agency+-planer.

### 5.6 Enhetsøkonomi

Pre-revenue — ingen målte CAC/LTV-tall. Kostnadssiden er instrumentert:

- Per-org plan-bruk (`plan_usage` per måned)
- Claude-token-kostnad per org
- Hosting-allokering
- Per-org B2-bruk

**Vekstmål (definert):**

- **50 betalende orgs** innen 12 måneder
- **5 Agency-tier-orgs** (de mest verdifulle)
- **3 Enterprise-pilot** (én per bransje: energi, telekom, agro)

**Illustrativt regneeksempel (antakelser — må valideres):** 50 orgs fordelt 35 Solo Pro
(199 kr) + 12 Agency (990 kr) + 3 Enterprise (~5 000 kr) ≈ **33 800 kr/mnd** (~405 000
kr/år) bare fra abonnement, før ad-tech-management-fee og overage.

---

## Seksjon 6 — Markedsposisjon

### 6.1 Konkurransebildet: fragmentert status quo, ingen kart-først konkurrent

Den ekte konkurrenten er **fragmenteringen** — norske B2B-feltsalgs-team koordinerer i dag
med:

- **Pipedrive + Google Maps + Excel + WhatsApp** — fire verktøy, ingen sannhet
- **HubSpot/Salesforce** — for «kontorselger» — har ikke ekte kartfunksjonalitet eller
  iPad-først-arkitektur
- **Lokale norske CRM-er (SuperOffice, Visma CRM)** — gjør jobben for telefon-/e-post-
  selger, men er ikke bygd for live-felt-team

Det finnes internasjonale «field sales»-CRM-er (Outfield, SPOTIO, Badger Maps), men de
er amerikanske, ikke norske-tilpassede (ingen BRREG, ingen EHF, ingen norsk Maps-
optimalisering), og ingen integrerer ad-tech-stack på markedssjef-nivå.

Kampen står primært mot **fragmentering og «vi har Excel»-treghet**, ikke mot én
dominerende aktør.

### 6.2 Partnere, ikke konkurrenter — «integrer, ikke angrip»

Strategien er felles med TheRoleRoom:

| Aktør | Rolle |
|---|---|
| **BRREG** | Datagrunnlag for auto-onboarding (offentlig API) |
| **Google Maps** | Distanse, kjøre-tid, navigasjon (betalt API) |
| **Meta / Google / LinkedIn / TikTok** | Ad-tech-stack-integrasjoner |
| **SuperOffice / Visma CRM / Tripletex** | Ønsket integrasjon (eksporter til regnskap, importer fra eksisterende CRM) |
| **B2B-byråer** | Kjøpere + partnere — byråene bruker Leadgrid for sine kunder |
| **Bransjeforeninger (NHO Service, Energi Norge, Abelia)** | Distribusjonskanal mot medlemmer |

### 6.3 Plass i økosystemet

Leadgrid sitter i skjæringspunktet mellom fire verdener: **B2B-CRM**, **maps/geo**,
**ad-tech** og **markedsføringsbyrå-operasjoner**. Posisjonen er å være **det første
verktøyet som lukker loopen mellom hvor teamet står, hvilke annonser kjører, hvilke
kunder ble onboardet, og hvor mye omsetning det genererte** — alt på iPaden, ute i felt.

### 6.4 Kategorien: «kart-først CRM»

Leadgrid jakter ikke på å vinne den eksisterende CRM-kategorien — produktet **definerer
en ny under-kategori**: «kart-først CRM» / «field-sales operating system». Forankret i
en overbevisning:

> **«Selg skjer der folk er. Verktøyet må vite hvor folk er.»**

Beskrivende er kategorien *operativsystemet der et feltsalgs-team koordinerer hvor det er,
hva det selger, hva det koster å skaffe kunden, og hva neste er — alt på iPad, med
markedssjefen i loop på spend → omsetning*.

### 6.5 Den unike posisjonen (det ingen andre har)

1. **iPad-først native.** Ikke en mobile-responsive web-CRM, men ekte SwiftUI med
   GRDB-cache, native kart, APNS push. Promotøren føler ikke at hun jobber i en
   nedstrippet versjon.
2. **Live team-pins på kartet.** GDPR-opt-in, men når det er aktivert, er det det
   markedssjefen som lever av.
3. **Auto-onboarding med BRREG + Claude.** 30 sekunder fra pin til klart lead-kort med
   anbefalt prioritering.
4. **Ad-tech-stack innebygd.** Spend → conversion → lead → kunde → omsetning, alt på ett
   sted. Ingen separat HubSpot ↔ Google Ads-integrasjon.
5. **Norsk-/EU-native.** BRREG, EHF-faktura, EU-datalagring, norsk Maps-optimalisering,
   BankID på vei.
6. **Salgshierarki som førsteklasses primitiv.** Markedssjef → teamleder → salgskonsulent
   → promotør → research er ikke en RBAC-konfigurasjon, men hele produktets datamodell.
7. **Klient-portal (white-label).** Byråer leverer transparens som standard, ikke som en
   Excel-rapport hver fredag.

---

## Seksjon 7 — Vekstmotorer og nettverkseffekter

### 7.1 Vekstmotorer

**Salgshierarkiet selv (den primære motoren):**

- **Én markedssjef tar med seg et helt team.** Markedssjef velger Leadgrid → 5–50
  selgere/promotører får automatisk lisens. Dette er en multiplikator innebygget i
  forretningsmodellen (Agency-tier = ubegrenset team-medlemmer).
- **Byrå-til-kunde-eksponering:** når byrå-orgen viser klient-portalen til sluttkunden,
  blir sluttkunden eksponert for Leadgrid-merkevaren — en framtidig kjøper hvis de senere
  vil ta noe in-house.

**Partner-program (B2B-byrå-til-byrå):**

- **Henvisningsbonus:** byrå A henviser byrå B → % av første-års kontrakt.
- **Co-marketing:** «Powered by Leadgrid»-badge på klient-portalen kan slås av i
  Agency+ (white-label).

**Bransje-pakker som distribusjonskanal:**

- Når «Telekom-pakken» eller «Energi-pakken» er bygget med pre-trained Claude-prompts og
  kuratert konkurrent-landskap, blir distribusjonen lettere via bransjeforeninger.

**Cross-produkt-funnel fra CreatorHub/TheRoleRoom:**

- En produsent på TheRoleRoom som *også* eier en reklamefilm-byrå er en perfekt Leadgrid-
  kandidat. Cross-sell internt — men ikke koblet på data-nivå (samme funnel-prinsipp som
  Role Room ↔ CreatorHub).

> **Sterkeste enkeltmotor:** **Agency-tier-byråer** — de er motorenes motor. Hver
> Agency-kunde tar med 10–50 selgere og en håndfull sluttkunder.

### 7.2 Nettverkseffekter

- **Konkurrent-landskap som delt verdi:** når Research-rollen kartlegger en konkurrent i
  én region, sees denne mappingen av alle orgs i samme bransje (anonymisert). Jo flere
  brukere, jo bedre konkurrent-bilde.
- **Anonymisert benchmark:** close-rates per bransje, gjennomsnittlig pin-til-kunde-tid,
  spend-per-onboarding — Agency+-tier får tilgang. Jo flere brukere, jo mer pålitelig
  benchmark.
- **Ad-tech-stack-data:** når flere orgs kjører conversion-tracking gjennom Leadgrid,
  bygger plattformen opp en samlet forståelse av hva som faktisk virker per bransje (uten
  å bryte personvern).

### 7.3 Switching cost etter 12 måneder

Etter et år på Leadgrid er det dyrt å forlate — av både harde og myke grunner:

**Harde (data og oppsett):**
- Hele lead-/kunde-historikken (med status-skift, audit, attribusjons-data)
- Ad-tech-conversion-konfig på Google/Meta/LinkedIn/TikTok (krevende å rive løs)
- BRREG-snapshots og bedrifts-logo-cache
- Klient-portal-tilpasninger (white-label, branding, custom fields)
- 45-key RBAC-matrise med per-bruker overstyringer

**Myke (atferd og opplevelse):**
- **Live team-bilde:** markedssjef vil ikke gi opp live-pins. Det er som å miste
  «hvor er flyet?» når man er flytrafikkontroller.
- **iPad-vane:** promotørene har bygget en muskel-minne for hvor knapper er i appen.
- **Sluttkunde-forventning:** sluttkunden har vent seg til klient-portalens transparens.

---

## Seksjon 8 — Ambisjon og tidshorisont

### 8.1 Hvor stort: ambisjonsnivået

Ambisjonen er **stor**. Geografisk er stigen **Norge → Norden → Europa**. EU-data­lagring
og EHF-/BRREG-mønster er allerede arkitektonisk grunnlag, men hver region krever lokale
ekvivalenter (svensk Bolagsverket, dansk CVR, finsk YTJ, tysk Handelsregister).

**Bransje-pakker som vekstvektor:** energi → telekom → eiendomstjenester → agro →
foodservice → bygg. Hver bransje får sin egen kuraterte konkurrent-database og pre-trained
Claude-prompts. Når en pakke har 5–10 referansekunder i en bransje, er den selvselgende.

**Adopsjonslogikken:** vise **bevis** — at en markedssjef faktisk vet mer om sin egen
spend → omsetning-loop enn hun gjorde i Excel. Når det er bevist for én bransje, henger
flere aktører på. Nøkkelen er å **penetrere et marked som ikke visste at det trengte
verktøyet** — feltselgere som har levd med Excel og WhatsApp i 10 år har lav forventning,
men høy aha-respons første gang de ser live team-pins på iPaden.

**Filosofien — effektivisere, ikke erstatte:** Leadgrid skal ikke erstatte selgeren,
men gi henne **gode neste-steg**. AI (Claude) er på vei dypere inn, men det er
mennesket som lukker salget.

### 8.2 3-årsvisjonen

> Leadgrid brukes av de toneangivende **B2B-feltsalgs-byråene i Norge**, har **3–5
> bransje-pakker** med referansekunder, og er **forventet standard** når en markedssjef
> sier «vi trenger en CRM som ser ut som vår faktiske arbeidsflyt».

### 8.3 10-årsvisjonen

> Leadgrid (og CreatorHub) er det europeiske operativsystemet for B2B-feltsalg og
> markedsoperasjoner. «Hvor står teamet, hva selger vi, hva koster det å skaffe kunden»
> blir et spørsmål man stiller iPaden, ikke et regneark.

### 8.4 Hva må være sant for at den største visjonen realiseres

| Forutsetning | Hva det krever |
|---|---|
| **Bransje-anker-kunder** | At 3 norske referansekunder per bransje gir caser som kan løftes til Norden |
| **Kapital** | Finansiering til å skalere produkt + marked på flere markeder samtidig |
| **Teknologi** | Meta/LinkedIn CAPI godkjent, BankID-løsning på plass, Stripe-billing skalert til EHF i flere land |
| **Team** | Grunnleggeren må gå fra solo til å **ansette i CreatorHub** — Leadgrid trenger en kommersiell ansvarlig + en kunde-suksess-rolle |
| **Lokale partnere** | I hver region trengs en partner som forstår lokal BRREG-ekvivalent og lokal feltsalg-kultur |

> Den ærlige flaskehalsen i dag: dette er i stor grad et solo-drevet produkt, og iPad-
> appen er fortsatt på TestFlight (ikke i App Store). Den største visjonen forutsetter at
> team, kapital og partnere bygges opp rundt det — og at Leadgrid får sine første
> betalende kunder for å validere prismodellen.

---

## Tillegg — anbefalte neste leveranser

Underveis dukket det opp tre konkrete behov som fortjener egne dokumenter:

1. **Leadgrid Content Marketing-plan** — pillar-sider og content-strategi for hver av de
   identifiserte bransjene (energi, telekom, agro, foodservice). Levert som
   `Leadgrid-Content-Marketing-Plan.md`.
2. **Leadgrid Outreach-plan** — segmenter og templates for B2B-byrå og markedssjef-
   outreach. Levert som `Leadgrid-Outreach-Plan.md`.
3. **Leadgrid Enhetsøkonomi-/break-even-modell** — basert på pris-katalog (5.2) og
   kostnadsdata, mot målene 50 orgs / 5 Agency / 3 Enterprise første 12 måneder.

### Avgrensning mot TheRoleRoom

Stripe-kontoen, plan-katalogen og org-modellen er delt med TheRoleRoom. Det betyr at en
organisasjon i prinsippet kan ha **både** en Role Room-lisens (f.eks. innholdsprodusent
495 kr) **og** en Leadgrid-lisens (f.eks. Solo Pro 199 kr) på samme `organizations`-rad.
I praksis er dette en sjelden kombinasjon, og produktene markedsføres separat. Dette
dokumentet dekker Leadgrids inntektsstrømmer; TheRoleRoom-priser ligger i
[`THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md`](./THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md).
