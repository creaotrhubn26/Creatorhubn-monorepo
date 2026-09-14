# Talent-selvregistrering og /talents som hjem

Dato: 2026-09-15
Status: godkjent design, klar for implementasjonsplan

## Problemet

En skuespiller kan ikke komme inn i The Role Room i dag. Alt nedstrøms er bygget
— talent-profil, samtykke-registry, Self-Tape Studio, byrå-søk med maskering —
men det finnes ingen vei til en konto.

Kartlegging av dagens innganger (alle lest i `origin/main`):

| Inngang | Hva som skjer |
| --- | --- |
| Byrå foreslår talent, e-post med `/talents/registry-invite?token=` | `GET /api/role-room/talent-proposals/:token` er offentlig, så forslaget kan leses. `POST .../accept` svarer 401 «Du må logge inn for å akseptere forslaget» (`role-room-agency-proposals-routes.ts:316`). |
| Skole promoterer avgangsstudent, student gjør `POST talent/claim` | Krever ordinær CreatorHub-konto (`resolveUser`). |
| Casting-invitasjon til `/talentportal?inviteToken=` | `GET /talent/portal` krever innlogget e-post (`role-room-routes.ts:19752`). |
| Selvregistrering fra landingssiden | Finnes ikke. `POST /api/invite-requests` krever `companyName` og et org.nr som slår opp i Brønnøysund (`invite-requests-routes.ts:432`). En privatperson får 400. |
| Google-innlogging med ny e-post | Avvist: «Google-kontoen er ikke knyttet til en aktiv CreatorHub-konto» (`creatorhub-google-routes.ts`). |

Eneste faktiske vei inn i dag er at en superadmin oppretter brukeren manuelt.
Samtidig lover landingssidens FAQ «en dedikert talentportal hvor skuespillere
registrerer seg direkte», og `/talentportal` ligger i sitemap med priority 0.9.

I tillegg finnes to ulike talent-flater. En bruker med `role='talent'` som logger
inn på forsiden havner i `TalentPortalView` (prosjekt-bundet kandidatflate:
auditions og self-tape for ett prosjekt). Talents-appen på `/talents`
(egen profil, samtykke, partnere, Self-Tape Studio) er en annen flate, åpen for
enhver innlogget bruker. En talent finner aldri den andre uten direktelenke.

## Beslutninger

1. **Åpen selvregistrering.** Skuespilleren oppretter kontoen selv, uten
   organisasjonsnummer og uten at en admin godkjenner først.
2. **E-postkode før konto.** Gjenbruker `email-verification-service.ts`
   (6-sifret kode, bcrypt-hashet, 10 min TTL, maks 5 forsøk, per-(e-post,
   purpose) cooldown) med ny purpose `talent_signup`.
3. **Usynlig til samtykke gis.** Profilen opprettes som `profile_status='draft'`
   uten rader i `talent_consent_registry`, og er derfor ikke synlig i
   byrå-søk. Maskeringen trenger ingen endring.
4. **`talent` blir en ekte rolle** i `ADMIN_ROLE_CATALOG`, slik at rollen
   overlever `normalizeAdminRoleId()` og bæres i sesjonen.
5. **`/talents` er hjemmet** for en innlogget talent. `/talentportal` består
   uendret for prosjekt-spesifikke invitasjonslenker som allerede er sendt ut.

## Arkitektur

### Ny backend-rutefil: `backend/server/role-room-talent-signup-routes.ts`

Egen fil, registrert fra `index.ts` på linje med de andre Role Room-rutefilene.
Rører ingen delt auth-sti. Mønsteret er kopiert fra `client-portal-routes.ts:226`
(`POST /api/client/portal/register`), som allerede gjør verifiser-kode →
opprett bruker → mint sesjon.

Avhengigheter inn (samme stil som nabofilene): `app`, `pool`, `activeSessions`,
`persistAuthSession`, og turnstile-tjenesten fra
`createRoleRoomTurnstileService`.

#### `POST /api/role-room/talents/signup/request-code`

Request: `{ email, turnstileToken? }`

1. IP-rate-limit (se Sikkerhet).
2. Turnstile-verifisering når `ROLE_ROOM_TURNSTILE_SECRET_KEY` er satt; hopper
   over når den ikke er konfigurert, slik education-inquiry-flyten gjør.
3. `sendVerificationCode(pool, { email, purpose: 'talent_signup', ipAddress })`.

Response: `{ ok: true, expiresAt }`. Svaret skiller **ikke** på om e-posten
allerede har en konto — det ville lekket hvem som er registrert. En e-post som
allerede har konto får i stedet en «du har allerede en konto, logg inn»-e-post,
og endepunktet svarer identisk.

#### `POST /api/role-room/talents/signup`

Request: `{ email, code, password, displayName }`

1. `verifyCode(pool, { email, purpose: 'talent_signup', code })` — feil kode
   eller utløpt gir 400 `invalid_code`.
2. Passord minst 8 tegn, ellers 400 `weak_password`.
3. **Eksisterende e-post gir 409 `account_exists`.** Dette er det viktigste
   avviket fra klientportal-malen: den bruker `ON CONFLICT (email) DO UPDATE SET
   password = EXCLUDED.password`, som her ville latt hvem som helst med tilgang
   til en verifiseringskode overskrive passordet på en eksisterende konto.
   Signup oppretter kun nye kontoer; gjenvinning av konto går via
   passord-tilbakestilling.
4. Oppretter `users`-rad: `role='talent'`, bcrypt-hashet passord, `username`
   avledet fra e-post slik de andre inngangene gjør.
5. Oppretter `talents`-rad: `owner_user_id` = ny bruker, `display_name`,
   `email`, `profile_status='draft'`. Ingen samtykke-rader.
6. Minter sesjon (`activeSessions.set` + `persistAuthSession`) med
   `role='talent'`, og returnerer `{ sessionToken, user }` slik at frontend
   kan lagre sesjonen uten en ekstra innlogging.

Response: `201 { sessionToken, user, talentId }`.

### Rollekatalogen

`talent` legges i `ADMIN_ROLE_CATALOG` (`backend/server/index.ts`) med
`permissions: ['dashboard:read']`. Dette er ikke en adminrolle og skal ikke inn i
`ADMIN_SESSION_ROLES` — den eneste grunnen til at den må stå i katalogen er at
`normalizeAdminRoleId()` returnerer `'user'` for id-er som ikke finnes der, og
da blir rollen stille vasket bort i sesjonsoppbyggingen. Dette er nøyaktig
feilklassen som ble rettet for `super_admin` i PR #2332.

### Frontend

**Ny offentlig side `/talents/registrer`** (`TalentSignupPage.tsx`, plassert
sammen med de andre accept-sidene i `talents-app/pages/`). Rendres uten
app-shell, på samme måte som `PartnerInviteAcceptPage` og
`TalentProposalAcceptPage`, via en ny `isTalentSignupPath()`-sjekk i
`TalentsApp.tsx` og en gren i `casting-main.tsx` som ligger **før** auth-gaten
(siden brukeren per definisjon ikke er innlogget).

To steg i samme skjema: e-post → kode sendt → kode + navn + passord → ferdig.
Ved suksess lagres sesjonen via `authSessionService` og brukeren sendes til
`retur`-adressen hvis den finnes, ellers til `/talents`.

Ikke en ny fane i `LoginDialog.tsx`. Den filen er allerede rundt 7000 linjer, og
registreringen har ingen avhengighet til persona-velgeren eller den kommersielle
onboardingen som bor der.

**Retur-adresse lukker blindveiene.** `TalentProposalAcceptPage` og
skole-claim-flyten viser i dag en 401-feil for en uinnlogget bruker. De skal i
stedet lenke til `/talents/registrer?retur=<nåværende url>`, slik at
skuespilleren oppretter konto og kommer tilbake for å fullføre aksepten.
`retur` valideres som en relativ sti på samme origin før redirect.

**Hjemruting.** I `casting-main.tsx` avgjør `shouldRenderTalentsApp` i dag kun
på sti. Den utvides: innlogget med `role === 'talent'` og ingen annen matchende
rute → render `TalentsApp`. `talentPortalIntent` (altså `/talentportal` eller
`?portal=talent` med `inviteToken`) sjekkes først og beholder dagens
`TalentPortalView`, slik at invitasjonslenker som allerede er sendt ut fortsetter
å virke.

## Dataflyt

```
Skuespiller åpner /talents/registrer (evt. med ?retur=/talents/registry-invite?token=…)
  → POST /api/role-room/talents/signup/request-code   (turnstile + IP-grense)
  → e-post med 6-sifret kode                          (email-verification-service)
  → POST /api/role-room/talents/signup                (kode + passord + navn)
      ├─ users-rad:   role='talent'
      ├─ talents-rad: owner_user_id, profile_status='draft'
      └─ sesjon mintet + persistert
  → frontend lagrer sesjon
  → retur-adresse hvis satt, ellers /talents
```

Talenten lander på `DashboardPage`, som allerede håndterer `talent = null` og
tom profil med «Opprett profil» og en fullførings-måler. Ingen endring der.

## Feilhåndtering

| Situasjon | Svar |
| --- | --- |
| Ugyldig e-postformat | 400 `invalid_email` |
| For mange forsøk fra samme IP | 429 `too_many_requests` med `retryAfterSeconds` |
| Turnstile feiler | 400 `captcha_failed` |
| Feil eller utløpt kode | 400 `invalid_code` |
| Maks kodeforsøk brukt | 400 `invalid_code` (tjenesten invaliderer koden selv) |
| Passord under 8 tegn | 400 `weak_password` |
| E-post har allerede konto | 409 `account_exists` med lenke til innlogging |
| E-post ikke konfigurert i miljøet | 503 `email_not_configured` — flyten kan ikke fullføres uten e-post |

Frontend viser norsk tekst per kode. Kode-sending svarer likt for kjent og ukjent
e-post, se over.

## Sikkerhet og personvern

- **Ingen kontoovertakelse.** 409 ved eksisterende e-post, aldri passord-overskriving.
- **IP-rate-limit** på `request-code`: samme in-memory-mønster som
  `_inviteRateLimited` i `invite-requests-routes.ts`. Verifiseringstjenestens
  egen cooldown er per e-post og stopper ikke en angriper som varierer adressen.
- **Ingen data delt før samtykke.** Draft-profil uten rader i
  `talent_consent_registry` er usynlig i agency-search, som krever
  `basic_profile`-scope via `HAVING bool_or(...)`.
- **Ingen privilegie-eskalering.** `talent` har kun `dashboard:read` og er ikke i
  `ADMIN_SESSION_ROLES`, så `requireAdminSession` avviser rollen som før.
- **GDPR art. 13.** Registreringsskjemaet viser hva profilen er, at den er
  usynlig til talenten selv deler den, og hvem som er behandlingsansvarlig —
  samme informasjon som `ROLE_ROOM_TALENTS_INFO` allerede gir i
  skole-pipelinens samtykkekort. Teksten gjenbrukes, ikke skrives på nytt.

## Testing

Backend (vitest, `role-room-talent-signup-routes.test.ts`):

1. `request-code` uten gyldig e-post → 400.
2. `request-code` svarer likt for kjent og ukjent e-post.
3. `signup` uten verifisert kode → 400 `invalid_code`.
4. `signup` med passord under 8 tegn → 400 `weak_password`.
5. `signup` på eksisterende e-post → 409, og passordet i `users` er uendret.
6. `signup` på ny e-post → `users.role='talent'`, `talents.profile_status='draft'`,
   `talents.owner_user_id` satt, ingen samtykke-rader, sesjon mintet.

Rollekatalog (ny fil `admin-role-catalog-talent.test.ts`, samme stil som
`admin-users-super-admin-guard.test.ts` fra PR #2332):

7. `normalizeAdminRoleId('talent')` returnerer `'talent'`.
8. `talent` gir ikke admin-tilgang: `ADMIN_SESSION_ROLES.has('talent')` er false.

Frontend: `tsc --noEmit` og ESLint er required CI. En Playwright-test på
registreringsskjemaet er ønskelig, men avhenger av at e-postkoden kan leses i
testmiljø — tas som eget punkt i planen, ikke som blokker.

Manuell verifisering før ferdig: registrer en talent mot staging, bekreft at
profilen ikke dukker opp i byrå-søk, gi så ett samtykke og bekreft at den gjør
det.

## Utenfor omfang

- Google-innlogging som registreringsvei. Kan legges til senere uten
  datamodell-endring.
- Å slå sammen `TalentPortalView` og Talents-appen. `/talentportal` består som
  prosjekt-spesifikk flate i denne runden.
- Å endre markedsføringsteksten på landingssiden. Etter denne endringen stemmer
  den som den står.
- Passord-tilbakestilling for talents. `POST /api/auth/request-password-reset`
  finnes allerede og dekker behovet.

## Åpne punkter

- Juridisk gjennomgang av samtykketeksten i registreringsskjemaet. Teksten
  gjenbrukes fra skole-pipelinen, som selv står oppført med «juridisk signoff»
  som gjenstående.
- Om en talent skal kunne registrere seg uten passord senere (magic link). Ikke
  nødvendig nå; verifiseringstjenesten støtter mønsteret hvis det blir aktuelt.
