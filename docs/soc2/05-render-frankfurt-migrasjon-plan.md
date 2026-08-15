# Render Frankfurt-migrering — plan (utkast)

> Operasjonell oppfølging av `docs/evidence/2026-08-role-room-render-region-default.yaml`
> (bekreftet 2026-08-15 via Render API: `creatorhub-backend` og
> `creatorhub-gfpgan-runner` kjører i Oregon, ikke EU). Del av
> `docs/soc2/00-KICKOFF-PLAN.md` (Fase 4) og leverandørrisiko-policyen
> (`03-leverandorrisiko-policy.md` §3).
>
> **Dette er en plan, ikke en utført migrering.** Region kan ikke endres
> på en kjørende Render-tjeneste — den må gjenopprettes. Det er en
> produksjonsendring med planlagt nedetid som du initierer selv, i et
> vindu du velger. Ingenting i denne filen er utført.

---

## 1. Omfang

**Flyttes:**
- `creatorhub-backend` (srv-d76ob60ule4c73dv2p60) — hoved-API-et, all Role Room-trafikk
- `creatorhub-gfpgan-runner` (srv-d7dm8va8qa3s73bjthh0) — bilde-enhancement-tjeneste kalt fra backend (`PHOTO_ENHANCER_GFPGAN_URL`)
- `creatorhub-nextrole-cron` (cron-jobb, root `render.yaml`) — følger med samme blueprint, ingen egen inbound-trafikk

**IKKE i omfang (samme Render-konto, andre produkter):**
- `tidum-backend`, den umerkede `backend`-tjenesten — ikke Role Room, ikke rørt her
- `reknaren-*`-gruppen — allerede Frankfurt-pinnet, ingen handling nødvendig

## 2. Kritisk avhengighet FØR du starter: Neon-region

Å flytte backend til Frankfurt uten å vite hvor databasen ligger kan **forverre** situasjonen (cross-region-latens Frankfurt↔Oregon hvis Neon er US) i tillegg til at det ikke løser residens-spørsmålet alene — data "lagres" i databasen, ikke bare i compute. `docs/evidence/2026-08-role-room-eu-region-status.yaml` har Neon som fortsatt uverifisert.

**Anbefalt rekkefølge:** bekreft Neon-region (Neon-dashboard → prosjekt → Settings → region, eller `SELECT current_setting('region')`-ekvivalent i deres UI) FØR du utfører denne planen. Hvis Neon også må flyttes til EU, bør de to migreringene planlegges sammen (én nedetid, ikke to).

## 3. Kritisk risiko: hardkodet hostname

Render gir en ny tjeneste en **ny, tilfeldig** `*.onrender.com`-hostname — du kan ikke beholde `creatorhub-backend-rtbl.onrender.com` på en nyopprettet Frankfurt-tjeneste. Denne hostnamen er hardkodet (ikke env-var-styrt) i minst disse filene:

| Fil | Linjer | Bruk |
|---|---|---|
| `frontend/vercel.json` | 78, 98, 1007, 1011, 1020 | `rewrites` — proxyer `/api/*`, `/g/*`, `.well-known/*` fra Vercel til backend |
| `netlify.toml` | 73, 79, 91 | Samme rewrite-mønster for Netlify-siden |

**Dette betyr:** cutover er IKKE bare "opprett ny tjeneste og pek DNS om" — det krever en kode-commit (oppdatere disse to filene) synkronisert med når den nye tjenesten er verifisert klar. Gjør dette galt og alle `/api/*`-kall fra frontend 404'er/timer ut for hele The Role Room + Leadgrid.

**Anbefalt fiks i samme slag:** legg til en Render **custom domain** (f.eks. `api.theroleroom.com` eller `backend.creatorhubn.com`) på den nye Frankfurt-tjenesten, og pek `vercel.json`/`netlify.toml` til den custom-domenet i stedet for et rått `.onrender.com`-navn. Det gjør neste regionbytte (eller Render→annen leverandør) usynlig for frontend-konfigen — ingen ny kode-endring neste gang.

Sjekk også `frontend/.env.example` linje 4 (`VITE_API_URL=https://backend-djm5.onrender.com`) — allerede en avvikende/utdatert hostname der fra tidligere; ryddes samtidig, lav prioritet.

## 4. Steg-for-steg

### Fase A — Forberedelse (ingen nedetid, kan gjøres når som helst før cutover)

1. **Eksporter alle env vars** fra begge eksisterende tjenester i Render-dashboardet (Environment-fanen → "Copy" eller manuell nedskrift). `render.yaml`/`backend/render.yaml` lister nøklene (`sync: false`-verdiene finnes KUN i dashboardet, ikke i git).
2. **Bekreft Neon-region** (§2) og avgjør om den skal flyttes samtidig.
3. **Registrer et custom domain** for backend hvis det ikke finnes (§3) — dette steget kan gjøres uavhengig av regionbyttet og bør helst gjøres FØR, som egen liten endring, for å redusere antall variabler i selve cutover-vinduet.

### Fase B — Bygg ny tjeneste i Frankfurt (ingen nedetid — kjører parallelt med Oregon)

4. Dupliser `backend/render.yaml`/root `render.yaml`-service-definisjonen med `region: frankfurt` og et midlertidig annet navn (f.eks. `creatorhub-backend-fra`) — IKKE overskriv den eksisterende blueprint-servicen, opprett en ny separat service i Render-dashboardet ("New Web Service", velg Frankfurt).
5. Lim inn alle env vars fra steg 1.
6. Deploy. Verifiser build grønn og `/api/health` svarer 200.
7. Gjenta for `creatorhub-gfpgan-runner` (ny Frankfurt-instans), og oppdater den nye backend-instansens `PHOTO_ENHANCER_GFPGAN_URL` til å peke på den nye gfpgan-URL-en.
8. **Smoke-test direkte mot den nye `.onrender.com`-URL-en** (før noe DNS/rewrite-endring) — logg inn, hent et prosjekt, last opp et bilde gjennom gfpgan-runneren, test SAML/SCIM-login-flyten. Dette skjer isolert, null risiko for live-trafikk siden ingenting peker dit ennå.

### Fase C — Cutover (planlagt vindu, kort nedetid)

9. Sett den nye tjenesten på custom domain (§3) hvis ikke allerede gjort i Fase A.
10. Oppdater `frontend/vercel.json` (5 linjer) og `netlify.toml` (3 linjer) til å peke på custom-domenet (eller den nye rå Frankfurt-URL-en om du dropper custom domain — ikke anbefalt, se §3).
11. Commit + push denne ene endringen alene (ikke bland med annet PR-arbeid) — Vercel/Netlify redeployer automatisk fra `main`.
12. Verifiser i produksjon: last theroleroom.com, sjekk at `/api/health` og et par ekte endepunkter (login, prosjektliste) svarer fra den nye backend'en (sjekk `Server-Timing`-header eller logg-tidsstempler i Render-dashboardet for å bekrefte trafikken faktisk går til Frankfurt-instansen, ikke cachet CDN-respons).
13. Overvåk feilrater/latency i minst 1–2 timer aktivt (Render-loggene + eventuell APM) før du forlater vinduet.

### Fase D — Opprydding (etter trygghetsperiode, f.eks. 5–7 dager senere)

14. Når Frankfurt-instansen har kjørt stabilt: slett de gamle Oregon-tjenestene (`creatorhub-backend`, `creatorhub-gfpgan-runner`) i Render-dashboardet.
15. Rydd bort det midlertidige tjenestenavnet hvis du brukte et (`creatorhub-backend-fra` → gi den det permanente navnet, eller la det stå — kosmetisk, ikke funksjonelt viktig).
16. Oppdater `docs/soc2/03-leverandorrisiko-policy.md` §3 (Render-raden: region fra "US, SCC-er" til "EU (Frankfurt)") og skriv en ny `docs/evidence/`-fil som dokumenterer gjennomført migrering (kilde: ny Render API-sjekk som viser `frankfurt`).
17. Oppdater `THE-ROLE-ROOM-DATABEHANDLERAVTALE-MAL.md` §5 tilsvarende.

## 5. Rollback

Så lenge Fase D (sletting av gamle tjenester) ikke er utført, er rollback triviell: revert commit'en fra steg 11 (`vercel.json`/`netlify.toml` peker tilbake til den gamle Oregon-hostnamen), push. De gamle tjenestene har kjørt uendret i parallell hele tiden og tar umiddelbart imot trafikk igjen. **Dette er nettopp grunnen til at Fase D har en ventetid** — ikke slett noe før du er trygg.

## 6. Estimert nedetid

Med custom-domain-tilnærmingen i §3: **null til noen få minutter** — cutover er i praksis en DNS/rewrite-config-endring pekt på en allerede-verifisert-frisk tjeneste, ikke en cold-start av ny infrastruktur under press. Uten custom domain (rå `.onrender.com`-URL i configen): samme lave nedetid teknisk sett, men høyere risiko for en glemt referanse et sted som ikke ble fanget i grep-søket over.

## 7. Åpne punkter i denne planen

- **[AVKLAR]** Neon-region (§2) — må bekreftes/besluttes før dato settes
- **[AVKLAR]** Custom-domain-navn for backend, hvis det velges (§3)
- **[AVKLAR]** Dato/vindu for Fase C — bør velges i lavtrafikk-periode
- **[AVKLAR]** Hvem overvåker i Fase C steg 13, og eskaleringsvei hvis noe feiler (jf. `02-hendelseshandtering-policy.md`)

---

**Eier:** **[AVKLAR.]**
**Status:** Plan — ikke påbegynt.
