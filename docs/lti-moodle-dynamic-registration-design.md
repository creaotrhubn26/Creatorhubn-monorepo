# Moodle-integrasjon via LTI 1.3 Dynamic Registration

**Dato:** 2026-08-09
**Status:** Godkjent design → klar for implementeringsplan
**Kontekst:** Noroff (potensiell kunde) tilbyr studier innenfor The Role Rooms felt og bruker **Moodle** som LMS. The Role Room har allerede en fullstendig **LTI 1.3 Advantage**-integrasjon (launch/SSO, AGS grade-passback, NRPS-roster, Deep Linking) bygget og E2E-verifisert mot Canvas + saLTIre.

## Problem og innsikt

LTI 1.3 Advantage er en **LMS-agnostisk IMS-standard**. Moodle 4.x er en sertifisert LTI 1.3-plattform. Kjernen i vår integrasjon (`role_room_lti_platforms`-modellen, rolle-parsing på standard LTI-URNs, AGS/NRPS på standard claim-URLer) er allerede plattform-nøytral — en Moodle-instans er bare enda en plattform-rad.

Det som mangler for en god Moodle-onboarding er **hvordan** en Moodle-instans registrerer seg. I dag skjer registrering manuelt (super-admin fyller inn issuer/client_id/deployment_id/URLer), og `/lti/config` produserer Canvas Developer Key-JSON som Moodle ikke konsumerer.

**Løsning:** implementer IMS **LTI Dynamic Registration** — en Moodle-admin limer inn én URL, og verktøyet konfigureres automatisk begge veier. Standarden støttes av både Moodle 4.x og Canvas, så samme kode tjener begge.

## Mål

- En Moodle-admin kan koble The Role Room til sin Moodle ved å lime inn én registrerings-URL (`/lti/register`), uten manuell felt-utfylling.
- Registreringen oppretter automatisk en `role_room_lti_platforms`-rad med korrekt issuer/client_id/deployment_id/endepunkter.
- Etter at en Role Room super-admin **godkjenner** tenanten, virker full launch/SSO + AGS grade-passback + NRPS-roster + Deep Linking uendret (gjenbruk av eksisterende maskineri).
- Samme flyt fungerer for Canvas 4.x (bonus, ingen ekstra kode).

## Ikke-mål (bevisst avgrenset, YAGNI)

- **Moodle-spesifikke custom-param-substitusjoner** for semester/seksjon. `$Canvas.*`-variablene virker ikke i Moodle; Moodle bruker «groups» ≠ Canvas-seksjoner. For pilot: håndter fravær grasiøst (allerede gjort — `term`/`sections` blir `null`) og bruk CSV-import for kull. Moodle-group→kull-mapping tas ved dokumentert behov.
- **Moodle-native plugin** (lokal Moodle-modul). Unødvendig — LTI 1.3 er standarden.
- **Feide/OIDC-SSO** for Moodle. Separat spor; LTI-launchen vouch-er allerede for brukeren.

## Arkitektur

Legg til en selv-registrerings-inngang **foran** den eksisterende generiske plattform-modellen. Ingen endring i launch-, AGS-, NRPS- eller Deep Linking-flyten.

```
Moodle-admin
  │  limer inn /lti/register-URL i Moodle (External tool → LTI Advantage)
  ▼
Moodle  ──GET /lti/register?openid_configuration=…&registration_token=… ──►  The Role Room
                                                                              │
   ┌──────────────────────────────────────────────────────────────────────────┘
   │ 1. validér openid_configuration-URL (HTTPS + ikke-privat; assertSafeHttpsUrl)
   │ 2. GET openid_configuration → issuer, auth/token-endpoint, jwks_uri,
   │    registration_endpoint, lti-platform-configuration (product_family)
   │ 3. POST klient-registrering → registration_endpoint (Bearer registration_token)
   │    body = buildToolConfiguration() (oidc-login, target-link, jwks, scopes,
   │    meldinger, claims, private_key_jwt)
   │ 4. parse svar → client_id + tool-config → deployment_id
   │ 5. UPSERT role_room_lti_platforms (status='pending')
   │ 6. returner HTML som poster {subject:'org.imsglobal.lti.close'} til parent
   ▼
Moodle lukker registrerings-vinduet, verktøyet er aktivt (men launches gated til godkjent)

  … senere …
Role Room super-admin  ──POST /lti/platforms/:id/approve──►  status='approved'
Faglærer i Moodle  ──launch──►  eksisterende /lti/launch (uendret) → SSO + AGS + NRPS
```

## Komponenter

### 1. Delt tool-config-bygger — `buildToolConfiguration()`
Trekk verktøyets selvbeskrivelse (i dag inline i `/lti/config`, Canvas-format) ut til én ren funksjon som returnerer IMS `https://purl.imsglobal.org/spec/lti-tool-configuration`-objektet:
- `client_name`, `initiate_login_uri` (`/lti/login`), `redirect_uris` (`[/lti/launch]`), `jwks_uri` (`/lti/jwks`).
- `token_endpoint_auth_method: "private_key_jwt"` (vi signerer client_assertion med tool-nøkkelen — allerede implementert via `signClientAssertion`).
- `grant_types`, `response_types`, `scope` = `[...AGS_SCOPES, NRPS_SCOPE]`.
- `messages`: `LtiResourceLinkRequest` (course navigation) + `LtiDeepLinkingRequest` (content selection).
- `claims`: `["sub","iss","name","email","given_name","family_name"]`.
- `custom_parameters`: plattform-nøytrale + valgfri Moodle/Canvas-variant (ikke-blokkerende).

Brukes av BÅDE Canvas-`/lti/config` (uendret utad) og den nye dynamic registration-POST-en. **Én sannhet** for verktøy-metadata.

### 2. Dynamic Registration-endepunkt — `GET /lti/register`
Server-side (ingen klient-JS-avhengighet for selve registreringen):
- **a. SSRF-vakt:** `assertSafeHttpsUrl(openid_configuration)` (gjenbruk; HTTPS + ikke localhost/privat-IP).
- **b. Hent platform openid-config** via `fetchPlatform` (timeout + samme vakt). Krev: `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `registration_endpoint`. Les `https://purl.imsglobal.org/spec/lti-platform-configuration` → `product_family_code` (moodle/canvas) til visning.
- **c. POST registrering** til `registration_endpoint` med `Authorization: Bearer <registration_token>` og body fra byggeren, pakket i `https://purl.imsglobal.org/spec/lti-tool-configuration`. `token_endpoint_auth_method: private_key_jwt`.
- **d. Parse svar** → `client_id`; `deployment_id` fra returnert `lti-tool-configuration.deployment_id`.
- **e. UPSERT plattform** (se datamodell) med `status='pending'`.
- **f. Retur-HTML** som poster `{subject:'org.imsglobal.lti.close'}` til `window.parent.opener ?? window.opener ?? window.parent` (per spec) → plattformen lukker vinduet. Ved feil: vis feilmelding i samme HTML (ikke bare 500).

### 3. Godkjennings-gate (super-admin)
- `role_room_lti_platforms.status` ∈ `{pending, approved}`. Dynamic reg → `pending`. Manuelt registrerte + eksisterende rader → `approved` (backfill).
- **Launch-håndhevelse:** i `/lti/launch`, etter at plattform er slått opp, avvis `status !== 'approved'` med `403 platform_not_approved` + klar melding («Institusjonen er registrert, men venter på godkjenning fra The Role Room»).
- **Admin-endepunkter** (super-admin, gjenbruk `requireAdmin`):
  - `GET /lti/platforms` — list (inkl. pending, m/ product_family + issuer + registrert-tidspunkt).
  - `POST /lti/platforms/:id/approve` — sett `approved`.
  - `DELETE /lti/platforms/:id` — avvis/slett en pending (eller fjern tenant).
- **Admin-UI:** en enkel liste i Admin Room / super-admin-flaten med «Godkjenn»/«Avvis» per pending plattform. (Kan gjenbruke eksisterende LTI-admin-UI hvis det finnes; ellers minimal ny seksjon.)

## Datamodell / migrasjon

Ny migrasjon (neste ledige nummer):
```sql
ALTER TABLE role_room_lti_platforms
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';   -- eksisterende = godkjent
ALTER TABLE role_room_lti_platforms
  ADD COLUMN IF NOT EXISTS product_family TEXT;                       -- 'moodle' | 'canvas' | …
ALTER TABLE role_room_lti_platforms
  ADD COLUMN IF NOT EXISTS registered_via TEXT;                       -- 'manual' | 'dynamic'
ALTER TABLE role_room_lti_platforms
  ALTER COLUMN owner_user_id DROP NOT NULL;                           -- plattform-eid ved dynamic reg
```
- `owner_user_id` blir nullable: dynamic registration er plattform-initiert uten Role Room-sesjon, så det finnes ingen bruker-eier. Launch-flyten bruker faglærerens sesjon, ikke `platform.owner_user_id`, og exam-readiness bruker sesjonens `uid` — så plattform-eier er kun bokføring. Manuell registrering setter fortsatt eier.
- UPSERT-nøkkel: `(issuer, client_id)` (en Moodle kan re-registrere idempotent).

## Sikkerhet

- **Åpen registrering er per-spec** (plattform-initiert), men skaper en abuse-vektor: en rogue issuer kunne auto-provisjonere education-kontoer via `mintLtiEducationSession`. **Godkjennings-gaten** stopper dette — ingen launch før super-admin godkjenner tenanten. Dette er riktig for et betalt produkt: Moodle-admin gjør sin del selvbetjent, VI kontrollerer hvem som slipper inn.
- **SSRF:** all henting av plattform-URLer (openid-config, registration_endpoint, senere token/jwks/AGS/NRPS) går via `fetchPlatform` (HTTPS + ikke-privat-host + timeout) — gjenbruk av eksisterende hardening.
- **Signatur:** launches verifiseres uansett mot plattformens `jwks_uri` (RS256 + issuer + audience + deployment_id) — uendret.
- **registration_token** presenteres kun til plattformens registration_endpoint (autentiserer OSS mot plattformen); det gater ikke hvem som registrerer mot oss — derav godkjennings-gaten.

## Feilhåndtering

- Ugyldig/privat `openid_configuration` → HTML-feilside «ugyldig registrerings-URL».
- Openid-config mangler påkrevde endepunkter → HTML-feil «plattformen mangler LTI-endepunkter».
- Registrerings-POST feiler (4xx/5xx fra plattform) → HTML-feil m/ plattformens melding.
- Launch fra `pending`/ukjent plattform → `403` m/ forklarende melding.
- Alle plattform-fetches: timeout via `fetchPlatform` (ingen hengende registrering).

## Testing (E2E-strenghet som Canvas)

- **Enhetstester:** `buildToolConfiguration()` (korrekt IMS-form), openid-config-parsing (mangler-felt → feil), plattform-UPSERT (idempotent på issuer+client_id), launch-gate (pending → 403, approved → OK).
- **E2E mot ekte Moodle (MoodleCloud-sandkasse):** registrer verktøy via dynamic registration → super-admin godkjenner → faglærer-launch → sett karakter (AGS, verifiser i Moodle-karakterbok) → les roster (NRPS). Speiler Canvas/saLTIre-verifiseringen.
- **Merk (praktisk):** oppretting av MoodleCloud-trial er konto-oppretting som agenten ikke gjør — Daniel oppretter trial-instansen, deretter driver agenten registrering/launch/AGS/NRPS mot den. Alternativ: Docker-Moodle bak ngrok (må være offentlig reachable fordi prod-verktøyet POST-er registrering tilbake).

## Gjenbruk (uendret)

`/lti/login`, `/lti/launch`, `/lti/jwks`, `verifyIdToken`, `signClientAssertion`, AGS `pushScore`/`fetchResults`, NRPS `fetchRoster`, Deep Linking, `mintLtiEducationSession`, `fetchPlatform`, `assertSafeHttpsUrl`. Dynamic registration legger kun til inngangen + godkjennings-gaten.

## Åpne punkter / risiko

- **Moodle deployment_id-levering:** Moodle returnerer `deployment_id` i tool-config-svaret ved registrering. Hvis en Moodle-versjon leverer det via en separat kanal, må e-post/manuell utfylling støttes som fallback (verifiseres i E2E).
- **Én vs flere deployments:** UPSERT på (issuer, client_id) antar én deployment per tenant i pilot. Fler-deployment (samme Moodle, flere kurs-kontekster) håndteres av eksisterende per-launch deployment_id-validering; ekstra rader tas ved behov.
- **product_family-avhengig oppførsel:** hold koden product_family-agnostisk; bruk feltet kun til visning/diagnostikk, ikke til logikk-forgreining (unngå Canvas/Moodle-if-er).
