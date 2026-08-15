# Leverandørrisiko — policy (utkast)

> SOC 2 Type II-kjernepolicy. Del av `docs/soc2/00-KICKOFF-PLAN.md` (Fase 4).
> Bygget 2026-08-15. **Utkast — trenger en navngitt eier som formelt vedtar
> den, og bør kvalitetssikres av noen med reell SOC 2-revisjonserfaring.**

---

## 1. Formål

Sikre at underleverandører (databehandlere/infrastruktur-leverandører) som
har tilgang til eller behandler data på vegne av Creatorhub AS er vurdert,
bundet av avtale, og overvåkes for endringer som påvirker risikobildet.

## 2. Vurdering før en ny leverandør tas i bruk

Før en ny leverandør/tjeneste integreres i produksjon, skal følgende
avklares:

1. Hvilke data vil leverandøren ha tilgang til?
2. Har leverandøren egen SOC 2-rapport, ISO 27001-sertifisering, eller
   tilsvarende? (Be om den — de fleste seriøse leverandører har en.)
3. Hvilket land/region lagres data i, og er overføringsgrunnlaget avklart
   (SCC/DPF for USA-baserte leverandører)?
4. Kan leverandøren signere en databehandleravtale (DPA)?

## 3. Nåværende leverandørliste (faktisk verifisert, ikke antatt)

Denne listen er hentet direkte fra `THE-ROLE-ROOM-DATABEHANDLERAVTALE-MAL.md`
§5 (Fase 3) og `docs/evidence/2026-08-role-room-eu-region-status.yaml` —
ikke en generisk mal-liste, men det som faktisk er verifisert i bruk i
kodebasen.

> **Policy-beslutning (2026-08-15, kontoeier):** «alt må være i EU som
> følger norske standarder» — en strengere linje enn GDPRs eget minimum
> (som ville akseptert UK-adekvans for Neon). Se
> `docs/evidence/2026-08-role-room-eu-only-infra-decision.yaml` for
> beslutningsgrunnlaget og `docs/soc2/06-eu-only-infrastruktur-
> migreringsplan.md` for konkret migreringsplan. **Neon er migrert
> (2026-08-15)** — Render og R2 gjenstår.

| Leverandør | Funksjon | Region/status |
|---|---|---|
| Neon, Inc. | Database (PostgreSQL) | **✅ EU, migrert 2026-08-15**: AWS eu-central-1 (Frankfurt) — flyttet fra London (UK). Se `docs/evidence/2026-08-role-room-neon-eu-migration-complete.yaml`. |
| Render Services, Inc. | Applikasjonshosting | Bekreftet 2026-08-15 (Render API): Oregon (US). **Ikke EU — migrering til Frankfurt planlagt**, se `05-render-frankfurt-migrasjon-plan.md`. |
| Vercel Inc. | Statisk frontend-hosting | Bekreftet LIVE produksjon; ingen region pinnet. Lavest prioritet av de fire (mest statisk/edge, begrenset direkte persondatabehandling) — se `06-eu-only-infrastruktur-migreringsplan.md` §3. |
| Cloudflare, Inc. (R2) | Objektlagring — opplastede bilder/video | Globalt nettverk, IKKE jurisdiction-bundet. **Krever ny bøtte med EU-jurisdiction + datamigrering** — kan ikke endres på eksisterende bøtte. Se `06-eu-only-infrastruktur-migreringsplan.md` §2. |
| Backblaze, Inc. (B2) | Objektlagring — Role Room-arkiv/dokumenter | **EU-bekreftet** for produksjonsbøtten (`eu-central-003`, Amsterdam) — eneste leverandør som allerede oppfyller policy-beslutningen. Akademi-/firma-arkiv-bøtter faller til US-default med mindre separat konfigurert — bør sjekkes, se `06-eu-only-infrastruktur-migreringsplan.md` §4. |
| Anthropic PBC | AI-assistert bearbeiding (kun der aktivert) | US, SCC-er |
| Stripe, Inc. | Betalingsbehandling | US, SCC-er/DPF |
| Google LLC | Innlogging/Workspace-integrasjon | EU-datalagring for Workspace-tjenester |
| Twilio Inc. | SMS/WhatsApp-varsler | US, SCC-er |

**Netlify** er IKKE i denne listen ennå — repoets egen dokumentasjon
(`plugins/creatorhub-engineering/skills/release-readiness/SKILL.md`) sier
DNS-cutover ikke er gjort, men dette bør avklares eksplisitt (se
Compliance-veikartets kjente åpne punkt) før eventuell SOC 2-scope
inkluderer/ekskluderer den.

## 4. DPA-status

**Ingen av leverandørene over er bekreftet med signert DPA i denne
gjennomgangen** — `GDPR_COMPLIANCE_CHECKLIST`s `dpa-subprocessors`-punkt
(Fase 0/3) står fortsatt som `pending`. De fleste (Neon, Vercel, Stripe,
Anthropic, Google, Twilio) har standard-DPA-er som aksepteres online —
dette er lavthengende frukt, ikke et reelt hindringspunkt, men det er
**ikke gjort** ennå og bør lukkes før en revisor spør om det.

## 5. Løpende overvåking

**[AVKLAR — ingen automatisert prosess funnet.]** Anbefalt: når Vanta (eller
tilsvarende) er koblet til (§1 i kickoff-planen), bruk dens
leverandør-overvåking fremfor en manuell liste — reduserer risikoen for at
denne policyen selv blir utdatert.

## 6. Ved bytte av underleverandør

Jf. `THE-ROLE-ROOM-DATABEHANDLERAVTALE-MAL.md` §5: kunder skal varsles minst
**[AVKLAR — frist ikke fastsatt i malen ennå]** før en ny underdatabehandler
tas i bruk eller en eksisterende byttes ut.

---

**Eier:** **[AVKLAR.]**
**Neste gjennomgang:** **[AVKLAR — anbefalt: hver gang en ny leverandør
legges til, i tillegg til en årlig full gjennomgang.]**
