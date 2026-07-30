# Role Room Integration v1 — integratorguide

Praktisk guide til REST-API-et for integrasjoner mot The Role Room.
Maskinlesbar kontrakt: `GET /api/integrations/v1/role-room/openapi.json`.

Base-URL: `https://www.theroleroom.com/api/integrations/v1/role-room`

---

## Kom i gang

### 1. Skaff en API-nøkkel

Nøkler hører til en *integrasjonskonto*. Kontoen bestemmer hvilke scopes
nøklene kan få, og hvilken rate limit som gjelder.

```bash
# Opprett konto (krever en nøkkel med admin-tilgang)
curl -X POST "$BASE/admin/accounts" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "content-type: application/json" \
  -d '{"slug":"mitt-system","displayName":"Mitt system","allowedScopes":["projects.read"]}'

# Opprett nøkkel på kontoen
curl -X POST "$BASE/admin/accounts/$ACCOUNT_ID/api-keys" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "content-type: application/json" \
  -d '{"label":"produksjon","scopes":["projects.read"]}'
```

> Klartekst-nøkkelen returneres **kun i dette ene svaret**. Databasen lagrer
> bare en SHA-256-hash. Mister du den, må du lage en ny.

### 2. Bekreft at nøkkelen virker

```bash
curl "$BASE/projects?limit=1" -H "Authorization: Bearer rri_…"
```

Nøkkelen kan sendes som `Authorization: Bearer rri_…` eller `x-api-key: rri_…`.

---

## Kontrakter du må kjenne

### Konvolutter

Alt er innpakket. Suksess:

```json
{ "data": [ … ], "meta": { "requestId": "…", "limit": 50, "offset": 0, "hasMore": true } }
```

Feil:

```json
{ "error": { "code": "missing_idempotency_key", "message": "…", "requestId": "…" } }
```

`requestId` går igjen i `x-request-id`-headeren. **Logg den.** Det er det
raskeste sporet når noe skal feilsøkes i ettertid.

### Idempotens — på alle skriv

Hver `POST`, `PATCH` og `PUT` krever `Idempotency-Key`. Uten den: `400`.

| Situasjon | Resultat |
|---|---|
| Ny nøkkel | Operasjonen utføres |
| Samme nøkkel, samme kropp | Det opprinnelige svaret gjentas, med `x-idempotency-replayed: true` |
| Samme nøkkel, **annen** kropp | `409 idempotency_key_conflict` |
| Samme nøkkel, forrige kall pågår fortsatt | `409 idempotency_in_progress` |

Dette er den anbefalte måten å håndtere retry på: et nettverksbrudd midt i en
`POST` kan trygt prøves om igjen med samme nøkkel uten å opprette dubletter.

Bruk én nøkkel per logisk operasjon — typisk en UUID du genererer før første
forsøk og gjenbruker gjennom hele retry-kjeden.

### Paginering

`limit` (1–100, default 50) og `offset`. `meta.hasMore` sier om det finnes
mer etter denne siden — foretrekk den framfor å sammenligne `data.length`
med `limit`.

### Inkrementell synk

`GET /projects` tar `updatedAfter` (ISO-tidspunkt). Lagre tidspunktet for
forrige vellykkede kjøring og send det inn neste gang, så henter du bare det
som er endret:

```bash
curl "$BASE/projects?updatedAfter=2026-07-01T00:00:00Z&limit=100" \
  -H "Authorization: Bearer $KEY"
```

### Rate limits

Hvert svar bærer `x-rate-limit-limit` og `x-rate-limit-remaining`. Ved
overskridelse: `429` med `retry-after` (sekunder). Respekter headeren framfor
å prøve straks — gjentatte kall mens du er begrenset forlenger ikke vinduet,
men gir deg heller ingen data.

Default er 120 kall/minutt per konto, justerbart per konto.

### Webhooks

Registrer en URL og hvilke events du vil ha:

```bash
curl -X POST "$BASE/admin/accounts/$ACCOUNT_ID/webhooks" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "content-type: application/json" \
  -d '{"url":"https://mitt-system.no/hooks/roleroom","events":["project.created","project.updated"],"secret":"…"}'
```

Tilgjengelige events: `project.created`, `project.updated`, `mapping.upserted`.

Utsending går via en utboks med gjenforsøk. Endepunktet ditt bør svare `2xx`
raskt og gjøre selve arbeidet asynkront, og det bør tåle å motta samme event
flere ganger.

### Id-koblinger

Slipp å holde din egen oversettelsestabell — `PUT /projects/{id}/mappings`
lagrer koblingen mellom din eksterne id og Role Rooms id, og
`GET` henter den tilbake.

---

## Testing uten å røre produksjonsdata

**Det finnes i dag ingen isolert sandbox-instans.** Inntil den er på plass er
dette den anbefalte framgangsmåten, og den dekker de fleste behov:

1. **Egen integrasjonskonto for testing.** Opprett en konto med slug
   `mitt-system-test`. Rate limit og scopes settes uavhengig av
   produksjonskontoen, og nøklene kan trekkes tilbake uten å påvirke drift.

2. **Kun lesescope først.** Gi testnøkkelen `projects.read` alene til
   integrasjonen er verifisert. Da kan den ikke skrive noe uansett hva koden
   din finner på.

3. **Et dedikert testprosjekt.** Opprett ett prosjekt som eies av testkontoens
   bruker. Nøkler ser kun prosjekter brukeren eier eller er medlem av, så et
   testprosjekt er reelt avgrenset fra ekte produksjoner.

4. **`GET /health` og `GET /openapi.json`** krever ingen autentisering og
   egner seg til oppkoblings- og CI-sjekker.

Når du senere gir testnøkkelen `projects.write`, husk at idempotens-nøkler er
scopet per konto — testkallene dine kolliderer ikke med produksjonskallene.

---

## Feilkoder

| Kode | HTTP | Betydning |
|---|---|---|
| `missing_idempotency_key` | 400 | Skriv uten `Idempotency-Key` |
| `idempotency_key_conflict` | 409 | Samme nøkkel, annen kropp |
| `idempotency_in_progress` | 409 | Forrige kall med samme nøkkel er ikke ferdig |
| `invalid_api_key` | 401 | Ukjent, tilbaketrukket eller utløpt nøkkel |
| `insufficient_scope` | 403 | Nøkkelen mangler nødvendig scope |
| `project_not_found` | 404 | Prosjektet finnes ikke, eller nøkkelen har ikke tilgang |
| `rate_limited` | 429 | Se `retry-after` |

`404` brukes bevisst også når prosjektet finnes men nøkkelen mangler tilgang —
en integrasjon skal ikke kunne kartlegge hvilke prosjekter som eksisterer.

---

## Se også

- `openapi.json` — maskinlesbar kontrakt, alltid i synk med ruteren (holdt av
  test i `role-room-integrations-v1-openapi.test.ts`)
- MCP-serveren for AI-klienter: `POST /api/role-room/mcp`, verktøyliste på
  `GET /api/role-room/mcp/manifest`
