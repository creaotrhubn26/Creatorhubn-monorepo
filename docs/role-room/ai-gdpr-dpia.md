# The Role Room — AI GDPR / DPIA-underlag

Arbeidsdokument som konsoliderer GDPR-kravene vi må oppfylle før Role Room Agent kan prosessere personopplysninger. Dette er ikke en juridisk godkjent DPIA, men **kravene, arkitekturen og kodehooks som må på plass** før DPO kan signere en.

## 1. Hva behandles og hvorfor

| Kategori | Felt | Formål | Rettsgrunnlag |
|---|---|---|---|
| Klientbrief | prosjektmål, målgruppe, leveranser, referanser | Agenten foreslår scope / leveransebrekk / review-oppsett | Art. 6.1b (avtale) |
| Reviews | status, kommentartekst, beslutninger | Agenten sammenfatter beslutningspunkter | Art. 6.1b |
| Tidslinje | faser, items, frister, status | Agenten foreslår neste-steg, flagger risiko | Art. 6.1b |
| Kandidater | navn, e-post, telefon, rolle, notater | Agenten foreslår matching, casting-oppsett | **Art. 6.1a (samtykke)** |
| Crew | navn, e-post, telefon, rolle, tilgjengelighet | Agenten foreslår bemanning | **Art. 6.1a (samtykke)** |

Kandidat- og crew-data krever eksplisitt samtykke — de er identifiserbare personer som ikke har inngått avtale med oss, kun med klienten.

## 2. Databehandlere og underbehandlere

- **I dag:** Cohere (via `backend/server/role-room-agent.ts`). **Status: mangler DPA i våre registre.**
- **Målbilde:** Anthropic Claude. Krever:
  - Signert Data Processing Agreement (Anthropic standard DPA)
  - Modell-lokalisering: Anthropic kjører US-regioner. Vi må legge inn SCC (Standard Contractual Clauses) og oppdatert personvernerklæring.
  - No-training flagg: Anthropic API trener ikke på bedriftsdata by default. Dokumentér dette med lenke til Anthropic DPA.
- **Auditloggen selv** lagres i vår egen PostgreSQL — intern databehandler.

## 3. Roller

- **Behandlingsansvarlig:** CreatorHubn AS.
- **Databehandler:** Anthropic Inc. (eller Cohere inntil Claude-migrering).
- **Registrerte:** klienter, kandidater, crew-medlemmer.

## 4. Tekniske og organisatoriske tiltak som MÅ ligge inne før lansering

### 4.1. Samtykkehåndtering (Art. 6.1a, Art. 7)

- [x] **Frontend samtykkelag:** `components/role-room/services/aiConsentService.ts` + `components/role-room/components/ai/AiConsentGate.tsx` (levert denne runden, localStorage-basert).
- [ ] **Backend samtykketabell:** `role_room_ai_consent` med kolonner `project_id, user_id, scope, granted_at, revoked_at, note, processor`. Kritisk — localStorage alene er ikke gyldig bevis.
- [ ] **Server-side enforcement:** `/api/role-room/agent/*` må sjekke backend-consent-tabell før AI-kall. 403 hvis mangler.
- [ ] **Tilbaketrekking (Art. 7.3):** UI i profilmodalen (`RoleRoomMobileProfileSheet`) med tilbaketrekkings-knapp som slett-kaskader auditloggen for det prosjektet.

### 4.2. Dataminimering (Art. 5.1c, Art. 25)

- [x] **Frontend pseudonymisering:** `services/aiPseudonymize.ts` levert. Kandidatnavn/e-post/telefon erstattes med `{{candidate_N}}` før POST til backend.
- [ ] **Backend re-pseudonymisering:** backend må re-sjekke og scrubbe evt. PII som sniker seg gjennom frontend (belt-and-suspenders).
- [ ] **Scope-respekt:** backend må verifisere at payloaden ikke overgår `scope`-feltet i samtykkeloggen. Eks. hvis scope=`brief_only` må ikke reviews/tidslinje sendes.

### 4.3. Transparens (Art. 13, 14, 22)

- [x] **Banner-komponent:** `components/ai/AiTransparencyBanner.tsx` viser model, felt, retensjon og tilbaketrekkings-knapp.
- [ ] **Personvernerklæring oppdatert:** legg til Anthropic som underbehandler, overføringsgrunnlag (SCC), retensjon (12 mnd), no-training, rettigheter.
- [ ] **"Vis mine AI-data"-endpoint:** `/api/users/me/ai-interactions` (GET) som returnerer alle AI-kall for innlogget bruker + mulighet til å be om sletting.

### 4.4. Auditlogg (Art. 30, 32)

- [ ] **Utvide `utils/auditLogger.ts`** med `ai_call` kategori: `{ project_id, user_id, model, prompt_tokens, completion_tokens, fields_included, entity_count, consent_record_id, created_at }`.
- [ ] **Ikke logg selve prompt-innholdet** — kun metadata. Prompt-innhold inneholder PII og gjør auditloggen til ny risikokilde.
- [ ] **Retensjon:** 12 mnd automatisk sletting. Overstyrbar bare av DPO med audit-event.
- [ ] **Admin-visning:** filtrer audit-log per prosjekt/bruker/modell for internkontroll.

### 4.5. Rettigheter (Art. 15-22)

- [ ] Innsyn: `/api/users/me/ai-interactions`.
- [ ] Retting: N/A for AI-output (rådata hos oss), men lenkes mot retting av underliggende brief/kandidat-data.
- [ ] Sletting: kaskade-slett audit-log når bruker/prosjekt slettes. Bruk eksisterende `deletion-audit-schema.ts` pattern.
- [ ] Portabilitet: N/A for AI-svar (avledet data).
- [ ] Innsigelse (Art. 21): AI-samtykke kan trekkes inn når som helst.
- [ ] Automatiserte beslutninger (Art. 22): AI-forslag må alltid bekreftes av bruker — ingen auto-handlinger. Tool-use-lag må gate hver handling bak bekreftelse.

### 4.6. Sikkerhet (Art. 32)

- [ ] TLS 1.2+ til Anthropic (default i SDK).
- [ ] API-nøkkel i backend env (`ANTHROPIC_API_KEY`) — aldri eksponert til frontend.
- [ ] Rate-limit per prosjekt/bruker: maks N kall/min for å hindre dataekstraksjon.
- [ ] Feilhåndtering: log tokens + statuskode, aldri payload.

## 5. DPIA — høyrisiko-vurdering (Art. 35)

Fordi vi behandler identifiserbare kandidatdata for beslutningsstøtte, utløser dette DPIA-krav. Krever separat dokument signert av DPO. Dette filen er grunnlaget.

**Høyrisiko-faktorer tilstede:**
- Systematisk monitorering: nei.
- Storskala-behandling: middels (< 10 000 registrerte).
- Følsomme data: nei (ingen helse/bio/rase).
- Automatiserte beslutninger med rettslige virkninger: **nei** — agenten foreslår bare, mennesket bestemmer. Dette må dokumenteres tydelig.

Konklusjon: DPIA bør gjennomføres formelt, men risikonivået er håndterbart med tiltakene i seksjon 4.

## 6. Claude-integrasjonsforslag (arkitektur)

Ikke-GDPR, bare noterer for neste implementasjonsfase:

- `backend/server/role-room-agent-claude.ts` ved siden av eksisterende Cohere-versjon, bak feature flag `ROLE_ROOM_AGENT_MODEL=claude|cohere`.
- Default: `claude-sonnet-4-5`. Flagget `ROLE_ROOM_AGENT_MODEL=opus` for tunge oppgaver (scope-analyse, budsjettkonfliktdeteksjon).
- **Prompt caching:** bruk `cache_control: { type: 'ephemeral' }` på prosjekt-kontekst-blokken. 5-min TTL matcher typisk brukerøkt. Estimert 90% kostnadskutt for follow-up spørsmål.
- **Tool use:** definer tools `create_review`, `update_brief_field`, `flag_scope_impact`. Agenten foreslår tool-call → frontend viser bekreftelsesmodal → ved godkjenning sendes call tilbake til vår egen API (ikke Anthropic gjør noe på egenhånd).
- **Streaming:** på for lange svar (> ~200 tokens estimert). SSE eller chunked fetch.
- **System prompt:** inkluder pseudonymisering-regler og no-decision-autonomy-regel.

## 7. Statussammendrag — hva som må leveres

**Frontend (delvis levert denne runden):**
- [x] Pseudonymization util
- [x] Consent gate + banner
- [ ] Consent UI i profilmodal (tilbaketrekking)
- [ ] Audit-visning for egen bruker

**Backend (må bygges):**
- [ ] DB-tabell `role_room_ai_consent`
- [ ] Endpoint `/api/role-room/ai-consent` (GET/POST/DELETE)
- [ ] Server-side consent-gate middleware
- [ ] Backend pseudonymisering backstop
- [ ] Audit-log `ai_call` kategori
- [ ] Claude-klient (bak flagg)
- [ ] Prompt caching
- [ ] Tool-use med bekreftelseskjede
- [ ] Retensjon cronjob (12 mnd sletting)

**Juridisk / prosess:**
- [ ] Signert DPA med Anthropic
- [ ] Oppdatert personvernerklæring
- [ ] DPIA signert av DPO
- [ ] Databehandlerregister oppdatert
- [ ] Opplæring av produksjons-team om AI-bruk
