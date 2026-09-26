# Leadgrid — GDPR-pakke for lydopptak av salgssamtaler (fase 2)

Status: UTKAST 2026-07-17 · Eier: Daniel (behandlingsansvarlig: Creatorhub AS / kunde-org)
Gjelder: opptak av fysiske møter og VoIP-samtaler i Leadgrid, transkripsjon
(Whisper), LLM-analyse og publisering som lærings-eksempler i Leadbook.

Denne pakken må være GODKJENT og implementert FØR fase 2 (ekte lyd) skrus på.
Fase 1 (tekstbaserte eksempler, kuratert + anonymiserbar) er bevisst designet
for minimal friksjon og er alt i drift.

## 1. Rettslig ramme (Norge)

- **Straffeloven § 205**: lovlig å ta opp samtaler man selv deltar i. Dette
  løser det strafferettslige — IKKE personvernet.
- **GDPR/personopplysningsloven**: opptaket inneholder personopplysninger om
  både kunden og selgeren → krever behandlingsgrunnlag, informasjon,
  formålsbegrensning, minimering, sletting.
- **Arbeidsmiljøloven kap. 9 + Datatilsynets retningslinjer for
  kontrolltiltak**: systematisk opptak av ansattes samtaler er et
  kontrolltiltak → krever drøfting med ansatte/tillitsvalgte, saklig grunn,
  proporsjonalitet, og skriftlig rutine. Dette gjelder KUNDE-ORGENE våre —
  Leadgrid må gjøre det lett for dem å gjøre det riktig.

## 2. Roller

- **Behandlingsansvarlig**: kunde-organisasjonen (f.eks. et salgsfirma).
- **Databehandler**: Creatorhub AS (Leadgrid) — krever oppdatert
  databehandleravtale (DPA) som dekker lydopptak, transkripsjon og
  underleverandører.
- **Underleverandører som må inn i DPA-en**: Backblaze B2 (lagring),
  OpenAI (Whisper-transkripsjon), Anthropic (analyse), Render (drift),
  Neon (metadata). Dataflyt utenfor EØS → SCC-er må verifiseres per leverandør.

## 3. Behandlingsgrunnlag

| Behandling | Registrert | Grunnlag |
|---|---|---|
| Opptak av møte | Kunden | **Samtykke** (art. 6(1)(a)) — eksplisitt, pr. samtale |
| Opptak av møte | Selgeren | Berettiget interesse (art. 6(1)(f)) + kontrolltiltaks-prosess (aml.) |
| Transkripsjon + LLM-analyse | Begge | Samme som opptaket (formål: kvalitet/opplæring) |
| Publisering som eksempel | Kunden | Anonymisering (utenfor GDPR) ELLER nytt samtykke |
| Publisering som eksempel | Selgeren | Berettiget interesse; selger kan reservere seg |

Vurdering: samtykke fra kunden er riktig grunnlag for selve opptaket fordi
maktbalansen er jevn og det er en reell frivillighet. For ansatte er samtykke
IKKE gyldig grunnlag (skjev maktbalanse) — derfor kontrolltiltaks-sporet.

## 4. Samtykke-flyten i appen (implementasjonskrav fase 2)

1. Selger starter «Ta opp møte» → appen viser et samtykke-kort som LESES OPP
   for kunden: hva tas opp, formål (kvalitetssikring og intern opplæring),
   lagringstid, retten til å trekke samtykket.
2. Kunden bekrefter muntlig PÅ opptaket + selger krysser av. Tidsstempel +
   ordlyd-versjon logges i databasen (`consent_version`, `consented_at`).
3. Uten bekreftelse: opptak kan ikke startes (hard gate, ikke advarsel).
4. Trekk av samtykke: enkel flate i appen (og e-postkontakt) → opptaket +
   transkript + avledede eksempler slettes innen 30 dager; eksempler som alt
   er ANONYMISERT (se §6) består, siden de ikke lenger er personopplysninger.

## 4b. Nexus-notater (lagt til 2026-09-25)

Nexus (tegneflaten) kan ta opp møter. To modus, og forskjellen er hvilke
personopplysninger som blir liggende:

| Modus | Krever nøkkel | Hva lagres |
|---|---|---|
| **Referat** (standard) | nei | Transkripsjon laget PÅ ENHETEN, med tidsstempler. Lyden kastes. |
| **Lyd og referat** | `leadbookLydopptak` | Som over, pluss rå lyd med slettefrist. |

Referat-modus holder §5-prinsippet om at rå lyd ikke persisteres, og er
derfor tilgjengelig uten §7-bekreftelsen. Talegjenkjenningen kjører med
skyfallback AVSLÅTT: feiler den lokale modellen, feiler økten synlig i
stedet for å sende lyden til Apple uten at noen får vite det.

Blekk-synkingen (strøket lyser der lyden står) virker i BEGGE modus. Den
binder seg til transkripsjonens tidsstempler, ikke til lydfilen — det var
det som gjorde det mulig å holde prinsippet uten å miste funksjonen.

Implementert: `leadgrid-nexus-lyd-retensjon.ts` (90 dager, tak 365),
`leadgrid_nexus_sletting_logg` (etterprøvbarhet), og
`POST /api/leadgrid/canvas/retensjon/kjor` (cron-utløst, token-beskyttet).

Samtykke per samtale (§4 punkt 1–3) er implementert: lyd-modus åpner
samtykke-kortet før mikrofonen starter, og opptaket kan ikke begynne uten
bekreftelse. Samtykke-ID-en lagres på opptaket.

**Ordlyden er en EGEN versjon** (`nexus-lyd-v1-2026-09-25`). Leadbook sin
tekst sier «Opptaket lagres ikke, kun teksten» — sant for referat-modus,
usant for lyd-modus. Gjenbrukt versjon ville gitt et samtykke til noe annet
enn det vi gjør, og det ser ut som etterlevelse i loggen mens det er det
motsatte. Nexus-teksten oppgir at lyden tas opp, at den slettes etter 90
dager, og retten til å trekke.

§4 punkt 4 er implementert: «Kunden trekker samtykket» står på lydkortet
når opptaket er lagret. Lyden slettes UMIDDELBART, ikke innen 30 dager —
fristen i §5 er en yttergrense, ikke et mål. Referatet fjernes sammen med
den: kunden trakk samtykket til opptaket, ikke bare til lydfilen.
Slettingen føres i leadgrid_nexus_sletting_logg med grunn «trukket_samtykke».

GJENSTÅR for lyd-modus — ikke kode:
- §8: DPIA er ikke gjennomført. Utkast med kartlagt risiko og seks åpne
  spørsmål: docs/leadgrid-dpia-nexus-lydopptak.md. To av spørsmålene er
  reelle hull uten tiltak i dag (tredjepart i rommet, sensitive kategorier)
- DPA-en må dekke lagret lyd fra Nexus, ikke bare Leadbook-transkripsjon

Begge krever en juridisk vurdering, ikke en commit. Referat-modus er
upåvirket og kan brukes i dag.

## 5. Lagring og sletting

- Lyd: B2, kryptert i ro, presigned URL-er med kort levetid (samme mønster
  som Academy-video).
- **Retention**: rå lyd slettes automatisk etter **90 dager** (konfigurerbart
  per org, aldri lenger enn 12 mnd). Transkript består kun hvis det er
  omgjort til kuratert eksempel; ellers slettes det med lyden.
- Sletterutine: cron-jobb + logg av hva som ble slettet når (etterprøvbarhet).
- Backup-kjeder må respektere slettingen (B2 lifecycle rules).

## 6. Anonymisering før publisering

Publiserte eksempler skal som HOVEDREGEL anonymiseres:
- Kundenavn → bransje + region («byggfirma, Østlandet») — feltet
  `customer_label` er alt designet for dette.
- Automatisk maskering i transkript: navn, telefonnumre, e-poster, adresser,
  org-numre (regex + LLM-pass før publisering — implementeres som del av
  struktureringsendepunktet).
- Beløp kan beholdes (ikke personopplysning i seg selv).
- Selgers navn beholdes internt (org-intern deling er formålet) — men selger
  skal kunne be om at et eksempel fjernes.

## 7. Ansatt-sporet (per kunde-org — Leadgrid leverer malene)

- [ ] Drøftingsmøte med ansatte/tillitsvalgte gjennomført og referert
- [ ] Skriftlig rutine: formål, hvem har tilgang, lagringstid, konsekvenser
- [ ] Informasjonsskriv til alle selgere (Leadgrid leverer mal)
- [ ] Selgere kan se egne opptak og be om sletting
- [ ] Opptak brukes ALDRI alene som grunnlag for sanksjoner (kun coaching)

## 8. DPIA-sjekkliste (vurdering av personvernkonsekvenser)

Systematisk opptak + AI-analyse av samtaler vil normalt kreve DPIA:
- [ ] Beskrivelse av behandlingen og formål (dette dokumentet §1–6)
- [ ] Nødvendighet/proporsjonalitet: kan formålet nås med mindre? (ja delvis:
      fase 1 tekst — derfor er lyd opt-in tilleggsfunksjon, ikke default)
- [ ] Risikovurdering: gjenkjennbar stemme, sensitive ytringer i samtaler,
      feiltranskripsjon, LLM-hallusinering i analyse
- [ ] Tiltak: samtykke-gate, kort retention, anonymisering, tilgangsstyring
      (rolle-gated i feature-matrisen), kryptering, audit-logg
- [ ] Databehandleravtaler + SCC verifisert for alle underleverandører
- [ ] Godkjent av behandlingsansvarlig før lansering

## 9. Teknisk kravliste (fase 2-implementasjonen)

1. `leadbook_recordings`-tabell: consent_version, consented_at, retention_until,
   b2_key, status (recorded|transcribed|deleted)
2. Samtykke-gate i opptaks-UI (hard, med opplest tekst)
3. B2 lifecycle-regel + slette-cron m/ logg
4. Whisper-pipeline (mønsteret finnes i leadgrid-meeting-notes-service)
5. Anonymiserings-pass (regex + LLM) før publisering
6. Selger-innsyn: «Mine opptak» m/ slett-forespørsel
7. Feature-matrise: egen entitlement-nøkkel (`leadbookLydopptak`), av som
   default — org må aktivt skru på ETTER at §7-sjekklisten er bekreftet
8. Org-onboarding-skjerm som krever avkryssing av §7 før nøkkelen kan åpnes

## Konklusjon

Fase 1 (tekst) dekker læringsbehovet uten juridisk friksjon. Fase 2 (lyd)
er gjennomførbart med flyten over — den dyre biten er ikke teknikken, men
at HVER kunde-org må gjennom §7/§8. Derfor: lyd som separat, default-av
tilleggsfunksjon med innebygd compliance-onboarding.
