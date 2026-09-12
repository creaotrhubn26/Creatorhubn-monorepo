# The Role Room MCP-server — designdokument

**Status:** Forslag (til gjennomgang) · **Eier:** daniel@creatorhubn.com · **Sist oppdatert:** 2026-07-27

---

## 1. Formål

Eksponere The Role Rooms produksjonsdata og -handlinger som **MCP-verktøy** (Model Context Protocol) slik at eksterne AI-klienter — Claude Desktop, Cursor, ChatGPT-connectors, kundens egen Claude — kan lese status og lage utkast direkte fra sin egen chat, mot *live* Role Room-data.

Dette gjør The Role Room til en **agent-klar plattform** uten å åpne en ny, usikret flate: MCP-serveren er et **tynt lag oppå det eksisterende, herdede Integration v1-API-et**.

### Retning (viktig avklaring)
- **I dag:** The Role Room er MCP-*klient* (agenten konsumerer Meta/TikTok/Google Ads-MCP via Anthropic-SDK; `role-room-agent-mcp.ts`, read-only allowlist).
- **Dette dokumentet:** det inverse — The Role Room som MCP-*server*. Mønsteret speiler REKNARENs `POST /mcp`.

---

## 2. Mål og ikke-mål

**Mål**
- Standardisert, scopet, revisjonssporet AI-tilgang til prosjekt-/casting-/crew-/planleggingsdata.
- Gjenbruk av eksisterende auth (`rri_`-nøkler), scopes, tilgangskontroll, rate-limit og samtykke-lag — ingen ny auth-kode.
- Read-first. Skriv kun som **utkast** i eksisterende godkjennings-workflow.

**Ikke-mål (i denne omgang)**
- Ingen auto-utsendelse utad (call sheet-e-post, kontraktsignering, agency-varsler) via MCP.
- Ingen ny RBAC-modell — vi respekterer den som finnes.
- Ingen eksponering av talent-PII utover eksisterende samtykke-scope.

---

## 3. Arkitektur

```
AI-klient (Claude Desktop / Cursor / ChatGPT)
      │  JSON-RPC 2.0 (streamable HTTP)
      ▼
POST /api/role-room/mcp        ← ny: role-room-mcp-routes.ts
      │  Bearer rri_...  →  gjenbruk v1-auth (scope + eier + rate-limit)
      ▼
MCP-verktøy (tynne wrappere)   ← ny: role-room-mcp-tools.ts
      │  kaller INTERNE service-funksjoner (ikke rå SQL)
      ▼
Integration v1-lag  +  samtykke-maskering  +  casting-service-funksjoner
      ▼
Postgres (Neon)
```

**Prinsipp:** MCP-laget inneholder *ingen* forretningslogikk eller tilgangskontroll av eget. Hvert verktøy validerer scope via de samme primitivene som v1-rutene og kaller de samme service-funksjonene. Én sannhet.

**Nye filer**
- `backend/server/role-room-mcp-routes.ts` — JSON-RPC-handler, montert `POST /api/role-room/mcp` i `index.ts`.
- `backend/server/role-room-mcp-tools.ts` — verktøy-katalog (definisjoner + handlers).
- `backend/server/role-room-mcp-auth.ts` — tynn adapter som gjenbruker `rri_`-validering + scope-sjekk.
- `backend/server/role-room-mcp-tools.test.ts` — enhetstester (scope-gating, samtykke-maskering, feilkoder).

**Gjenbrukte primitiver (IKKE dupliser)**
- API-nøkkel-validering + scope (`hasScope`, integration-konto-eier) — `role-room-integrations-v1-routes.ts`.
- Prosjekt-tilgang: eier **ELLER** `casting_user_roles` — `casting-project-ownership.ts` + v1-mønster.
- Samtykke/PII-maskering for talent — `requireActiveConsent` / agency-search-maskering.
- Rate-limit per integrasjonskonto (v1) + mønster fra `role-room-agent-ratelimit.ts`.

---

## 4. Transport og protokoll

- **Endepunkt:** `POST /api/role-room/mcp`
- **Protokoll:** JSON-RPC 2.0, MCP «Streamable HTTP»-transport.
- **Rammeverk:** `@modelcontextprotocol/sdk` (server-siden). Alternativt håndrullet JSON-RPC som REKNAREN — men SDK-en gir `initialize`/`tools`/`resources`/`prompts` gratis + fremtidssikring.
- **MCP-metoder som støttes (F1):** `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`. (`prompts/*` i senere fase.)
- **Content-Type:** `application/json`; svar kan streames (SSE) for lange verktøy.

---

## 5. Autentisering og autorisasjon

**Auth:** `Authorization: Bearer rri_<nøkkel>` — nøyaktig samme nøkler som Integration v1.
- Nøkkel hashes (SHA256) og slås opp i `roleRoomIntegrationApiKeys` → gir integrasjonskonto + scopes + utløp.
- Ingen sesjon-token (`creatorhub_auth_sessions`) i MCP — kun `rri_`-nøkler (maskin-til-maskin). Konsument-innlogging (OAuth) kommer i Fase 3.

**Scopes (hierarkisk, eksisterende):** `admin` ⊃ `*.write` ⊃ `*.read`; ressurs-spesifikke som `projects.read`, `candidates.read`, `projects.write`.
- Hvert verktøy deklarerer påkrevd scope. `tools/call` avvises med JSON-RPC-feil hvis nøkkelen mangler scopet.
- `tools/list` filtreres til kun verktøy nøkkelen har scope for (klienten ser bare det den kan bruke).

**Prosjekt-tilgang:** alle prosjekt-scopede verktøy sjekker eier **ELLER** medlem i `casting_user_roles` for det `projectId`-et — fail-closed (samme som v1).

**Rate-limit:** per integrasjonskonto (`rateLimitPerMinute`), + global per-nøkkel-tak. Overskridelse → JSON-RPC-feil `-32029` (rate_limited) med `retryAfter`.

**Tenant-isolasjon:** integrasjonskontoen er tenant-grensen; ingen verktøy kan nå prosjekter utenfor kontoens tilgang.

---

## 6. Samtykke og PII (GDPR)

Kritisk, fordi candidate/talent-data er sensitivt.

- **Talent-verktøy arver samtykke-maskering.** `rr_list_candidates` og evt. talent-oppslag kaller de samme maskerings-funksjonene som agency-search — felt utenfor consent-scope returneres som «ikke delt», aldri rå.
- **Ingen bulk-eksport av PII.** Lister paginert + felt-begrenset; ingen «dump alle kandidater med e-post».
- **Audit:** hvert `tools/call` logges (konto, verktøy, projectId, scope, tidsstempel) — gjenbruk `talent_access_audit`-mønsteret der talent-PII berøres.
- **Databehandler-kontekst:** MCP-nøkler regnes som en integrasjon; dekkes av samme DPA som Integration v1.

---

## 7. Verktøy-katalog

Navnekonvensjon: `rr_<verb>_<substantiv>`. Alle prosjekt-scopede verktøy tar `projectId`.

### 7.1 Lese-verktøy (Fase 1)

| Verktøy | Scope | Kilde (v1/service) | Input | Returnerer |
|---|---|---|---|---|
| `rr_list_projects` | `projects.read` | `GET /projects` | `{ status?, updatedAfter?, limit?, cursor? }` | Prosjekter (id, navn, status, oppdatert) |
| `rr_get_project` | `projects.read` | `GET /projects/:id` | `{ projectId }` | Fullt prosjekt (uten sensitive underressurser) |
| `rr_list_roles` | `roles.read` | `GET /projects/:id/roles` | `{ projectId }` | Roller å caste (navn, krav, status, tildelt) |
| `rr_list_candidates` | `candidates.read` | `GET /projects/:id/candidates` | `{ projectId, roleId?, status? }` | Kandidater — **samtykke-maskert** |
| `rr_list_crew` | `crew.read` | `GET /projects/:id/crew` | `{ projectId, department? }` | Crew (navn, rolle, avdeling, tilgjengelighet) |
| `rr_list_schedules` | `schedules.read` | `GET /projects/:id/schedules` | `{ projectId, from?, to? }` | Auditions/opptaksdager |
| `rr_get_client_intake` | `projects.read` | `GET /projects/:id/client-intake` | `{ projectId }` | Brief: mål, leveranser, målgruppe, føringer |
| `rr_list_call_sheets` | `projects.read` | call-sheet-routes | `{ projectId }` | Call sheets (metadata, ikke utsendelse) |
| `rr_check_availability` | `crew.read` | availability-sync | `{ projectId, date }` | Hvem er ledig/opptatt den dagen |

### 7.2 Utkast-/forslag-verktøy (Fase 2 — aldri auto-utsendelse)

| Verktøy | Scope | Effekt | Merk |
|---|---|---|---|
| `rr_draft_task` | `projects.write` | Oppretter **utkast** i `roleRoomPhaseTimelineItems` | Fase/eier/frist; synlig i UI til godkjenning |
| `rr_upsert_client_intake` | `projects.write` | Foreslår/oppdaterer brief | Idempotent (v1 upsert) |
| `rr_draft_call_sheet` | `projects.write` | Lager **utkast** til call sheet | **Sender ikke** — utsendelse skjer i UI m/ bekreftelse |
| `rr_propose_candidate_status` | `candidates.write` | Foreslår statusendring | Commit + agency-varsel skjer kun via UI-bekreftelse |

**Bevisst utelatt fra MCP (auto-eksekvering for farlig):** `POST /call-sheets/send`, kontraktsignering, sletting, agency-utsendelser. Disse forblir UI-/bekreftelses-gated.

### 7.3 Verktøy-skjema (eksempel, JSON Schema)

```json
{
  "name": "rr_list_candidates",
  "description": "List kandidater for en casting-rolle i et prosjekt. Personopplysninger er samtykke-maskert: felt uten aktivt samtykke returneres som null/\"ikke delt\".",
  "inputSchema": {
    "type": "object",
    "properties": {
      "projectId": { "type": "string", "description": "Casting-prosjektets id" },
      "roleId":    { "type": "string", "description": "Valgfritt: filtrer på én rolle" },
      "status":    { "type": "string", "enum": ["considered","shortlisted","offered","confirmed","declined"] }
    },
    "required": ["projectId"],
    "additionalProperties": false
  }
}
```

---

## 8. Resources (Fase 1, valgfritt)

Eksponer «prosjekt» som en lesbar MCP-**resource** slik at klienter kan `@`-referere et prosjekt:
- `resources/list` → `role-room://project/{projectId}` (navn + status).
- `resources/read` → kompakt prosjektsammendrag (roller, crew-antall, neste opptaksdag) — samme tilgangs-/maskeringsregler.

## 9. Prompts (Fase 4)

Ferdige maler klienten kan hente via `prompts/get`, f.eks. «Lag call sheet-utkast for opptaksdag», «Oppsummer castingstatus». Reduserer feilbruk av verktøyene.

---

## 10. Sikkerhetsmodell (oppsummert)

1. **Read-first.** Skriv kun som utkast; ingen utadvendt auto-handling.
2. **Auto-eksekvering forutsatt.** Fordi MCP-connectoren kjører aktiverte verktøy uten bekreftelse, er skrive-verktøyene designet så «worst case» = et utkast som må godkjennes.
3. **Scope + eierskap fail-closed** på hvert kall.
4. **Samtykke-maskering** på all talent-PII.
5. **Rate-limit + audit** per konto/verktøy.
6. **Ingen rå SQL i MCP-laget** — kun gjenbruk av service-funksjoner.

---

## 11. Feilhåndtering (JSON-RPC)

| Kode | Betydning |
|---|---|
| `-32601` | Ukjent metode/verktøy |
| `-32602` | Ugyldige argumenter (skjema-validering) |
| `-32001` | Uautentisert (mangler/ugyldig `rri_`-nøkkel) |
| `-32003` | Manglende scope for verktøyet |
| `-32004` | Ingen tilgang til `projectId` |
| `-32029` | Rate-limit (inkl. `retryAfter`) |
| `-32000` | Intern feil (sanitert melding) |

---

## 12. Faseplan

- **Fase 1 (~2–3 dager):** `POST /api/role-room/mcp` + `rri_`-auth-gjenbruk + 9 lese-verktøy + prosjekt-resource. Enhetstester. → kunder kan koble Claude Desktop og *spørre om* alt, trygt.
- **Fase 2 (~2 dager):** utkast-/forslag-verktøy i eksisterende godkjennings-workflow.
- **Fase 3 (~2–3 dager):** OAuth/Dynamic Client Registration + «Sign in with The Role Room» + `.well-known` + connector-guide (som Canvas-oppsettsarket).
- **Fase 4:** Prompts, webhooks→MCP-notifikasjoner, selv-konsum i Role Rooms egen agent.

---

## 13. Observability

- Strukturert logg per `tools/call`: konto, verktøy, projectId, scope, varighet, utfall.
- Gjenbruk Control Center-mønsteret for feil/anomali (rate-spike i MCP-kall = signal).
- Metrikker: kall per verktøy, avvisningsrate per feilkode, p95-latens.

---

## 14. Åpne beslutninger (trenger avklaring)

1. **SDK vs. håndrullet:** bruke `@modelcontextprotocol/sdk` (anbefalt) eller speile REKNARENs håndrullede `POST /mcp`?
2. **Egne MCP-scopes** (`mcp.read`) eller gjenbruke v1-scopes direkte (anbefalt: gjenbruk)?
3. **Talent-verktøy i F1?** Kandidater er mest verdifulle men mest sensitive — inkludere `rr_list_candidates` fra start (samtykke-maskert) eller vente til F2?
4. **Resources i F1** eller utsette til etter tools?
5. **Utdannings-scope:** egne education-verktøy (kull/oppgaver/vurdering) som en parallell verktøy-familie, eller separat MCP?

---

## 15. Testplan

- Enhetstester: scope-gating (avvis uten scope), prosjekt-tilgang (eier/medlem/avvist), samtykke-maskering (PII skjult uten consent), feilkoder, skjema-validering.
- Kontrakttest: `tools/list` matcher katalogen; forms pinnet så drift feiler CI.
- Røyktest: koble en ekte MCP-klient (Claude Desktop / MCP Inspector) mot en test-`rri_`-nøkkel og verifiser `initialize` → `tools/list` → `tools/call` ende-til-ende.
