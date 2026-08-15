# EU-only infrastruktur — migreringsplan (Neon, R2, Vercel)

> Oppfølging av policy-beslutningen i `docs/evidence/2026-08-role-room-eu-only-infra-decision.yaml`
> (kontoeier, 2026-08-15): «alt må være i EU som følger norske
> standarder». Dekker de tre gjenstående ikke-EU-punktene etter at Render
> allerede har sin egen plan (`05-render-frankfurt-migrasjon-plan.md`).
>
> **Dette er en plan, ikke en utført migrering.** Alle fire steg under
> krever handling i et dashboard du eier — jeg kan ikke utføre noen av
> dem herfra. Ingenting i denne filen er utført.

---

## 0. Rekkefølge, anbefalt

1. ~~**Neon (§1)**~~ — ✅ **gjennomført 2026-08-15**, se nedenfor.
2. **R2 (§2)** — lavest risiko, ingen kunde-nedetid hvis gjort riktig (les/skriv kan dobbeltkjøres mot to bøtter i en overgangsperiode).
3. **Render (§5)** — se egen plan.
4. **Vercel (§3)** og **B2-arkiv-bøtter (§4)** — lavest hastverk, ingen levende-database-risiko.

## 1. Neon — London (UK) → EU-region — ✅ GJENNOMFØRT 2026-08-15

Migrert til `AWS eu-central-1` (Frankfurt) — bekreftet av kontoeier via ny hostname (`eu-central-1.aws.neon.tech`). Se `docs/evidence/2026-08-role-room-neon-eu-migration-complete.yaml`.

**Gjenstår, ikke bekreftet i denne økten:**
- [ ] `neondb_owner`-passordet rotert på den NYE databasen (anbefalt uansett, jf. denne øktens tidligere hendelse med en live connection string limt inn i chatten på den gamle London-databasen — den gamle strengen er nå pensjonert sammen med det gamle prosjektet, men det er ikke det samme som å ha bekreftet et rotert passord på den nye).
- [ ] Det gamle London-prosjektet slettet (eller bevisst beholdt en kort periode som sikkerhetsmargin — bekreft hvilket).
- [x] `DATABASE_URL` i Render-dashboardet oppdatert til ny Frankfurt-streng — **oppdatert 2026-08-15, redeploy pågår.** Verifiser `/api/health` og et par ekte endepunkter når deployen er ferdig før dette regnes som fullt bekreftet (samme prinsipp som Render-planens smoke-test-steg).

## 2. Cloudflare R2 — sett EU-jurisdiction

**Nåværende:** ingen jurisdiction-restriksjon (globalt/auto-endepunkt), verifisert i ~15 route-filer via `CLOUDFLARE_R2_ENDPOINT`-env-var.

**Cloudflare R2 støtter EU-jurisdiction**, men kun ved bøtte-opprettelse — kan ikke endres på en eksisterende bøtte. En EU-jurisdiction-bøtte bruker et eget endepunkt-mønster: `https://<account_id>.eu.r2.cloudflarestorage.com` (bekreft eksakt format i Cloudflare sin dokumentasjon ved gjennomføring).

**Steg:**
1. Opprett en ny R2-bøtte med `jurisdiction: eu` (Cloudflare dashboard → R2 → Create bucket → Jurisdictional restrictions → European Union, eller via `wrangler`/API med jurisdiction-parameter).
2. Kopier eksisterende objekter fra gammel til ny bøtte (Cloudflare har et innebygd super-slurp/migrerings-verktøy for R2, eller `rclone`/S3-kompatibel sync — vurder volum før valg av metode).
3. Oppdater `CLOUDFLARE_R2_ENDPOINT` (og evt. `CLOUDFLARE_R2_MODELS_BUCKETS`/bøttenavn-env-var) i Render-dashboardet til den nye EU-bøtten.
4. Redeploy, verifiser opplasting/nedlasting fungerer mot ny bøtte.
5. Behold gammel bøtte i en sikkerhetsperiode før sletting (samme prinsipp som over) — spesielt viktig her siden R2 ikke har en enkel "revert env var"-rollback slik Render/Vercel-cutover har; en slettet bøtte er borte.

**Kode-endring nødvendig:** ingen — endepunkt og bøttenavn er allerede env-var-styrt overalt (`process.env.CLOUDFLARE_R2_ENDPOINT` osv.), ikke hardkodet. Dette er rent en dashboard + env-var-operasjon.

## 3. Vercel — vurder function-region

**Nåværende:** ingen `regions`-felt i `frontend/vercel.json`. Vercel sitt Hobby/standard-oppsett kjører serverless functions i `iad1` (Washington DC) med mindre Pro-planen konfigurerer noe annet.

**Lavere prioritet enn Neon/Render/R2** fordi frontend-en her hovedsakelig er statisk (Vite-bygget) + `rewrites` som proxyer API-kall videre til Render — selve personopplysningsbehandlingen skjer på backend/database, ikke i Vercel sitt lag. Statiske assets serveres uansett fra Vercels globale edge-nettverk (cache-noder i EU også), som er en annen ting enn "hvor kjører compute/lagres data".

**Anbefalt handling:** bekreft om Vercel-prosjektet faktisk bruker Serverless/Edge Functions til noe som behandler persondata (usikkert uten å lese hele `api/`-mappen i frontend-prosjektet, hvis en slik finnes) — hvis svaret er nei (kun statisk + rewrites), er ingen migrering nødvendig her, bare en presis formulering i leverandørrisiko-dokumentet om at Vercel ikke behandler persondata server-side. Hvis ja: legg til `"regions": ["fra1"]` (Frankfurt) i `vercel.json` for de aktuelle functions — dette KAN gjøres uten nedetid siden det er en vanlig deploy, ikke en service-gjenoppretting.

## 4. Backblaze B2 — sjekk akademi-/firma-arkiv-bøtter

**Nåværende:** produksjonsbøtten (`the-role-room-prod`) er allerede `eu-central-003` (Amsterdam) — korrekt, ingen handling. Akademi-/firma-arkiv-bøttene faller til B2 sin US-default med mindre eksplisitt satt.

**Steg:**
1. Sjekk `B2_REGION`-env-var (eller tilsvarende) for akademi-/firma-arkiv-tjenestene spesifikt — samme mønster som `backend/server/b2-archive-helper.ts:32` (`const B2_REGION = process.env.B2_REGION || "eu-central-003"` — bekreft at DENNE defaulten faktisk brukes for alle arkiv-bøtter, ikke bare produksjonsbøtten).
2. Hvis en bøtte allerede feilaktig ble opprettet i US-default: samme mønster som R2 — ny bøtte i riktig region + datamigrering, B2-region kan ikke endres på en eksisterende bøtte heller.

Dette er den minst hastende av de fire — sannsynligvis lite/ikke-persondata-tungt arkivinnhold, men bør bekreftes, ikke antas.

## 5. Render

Se egen, allerede skrevet plan: `docs/soc2/05-render-frankfurt-migrasjon-plan.md`. Ingen endring i den planen som følge av denne policy-beslutningen — den var allerede EU-rettet.

## 6. Åpne punkter

- **[AVKLAR]** Eksakt Neon-målregion (Frankfurt anbefalt, men bekreft tilgjengelig regionliste ved gjennomføring)
- **[AVKLAR]** Migreringsmetode for Neon (Neon-native branching/replikering vs. `pg_dump`) — avhenger av databasestørrelse på gjennomføringstidspunktet
- **[AVKLAR]** Om Vercel faktisk kjører persondata-behandlende functions (§3) — avgjør om noen handling trengs der i det hele tatt
- **[AVKLAR]** Dato/rekkefølge for samkjøring med Render-migreringen (§0, anbefalt samme vindu som Neon)
- **[AVKLAR]** Eier og gjennomføringsdato for hvert punkt

---

**Eier:** **[AVKLAR.]**
**Status:** Plan — ikke påbegynt. Render har egen plan (05); denne dekker Neon, R2, Vercel, B2-arkiv.
