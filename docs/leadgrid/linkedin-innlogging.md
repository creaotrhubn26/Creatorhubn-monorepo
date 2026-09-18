# Logg inn med LinkedIn (web + Leadgrid iOS)

Innlogging med LinkedIn er en tredje innloggingsmetode ved siden av e-post/passord
og Google. Den bruker samme LinkedIn-app som Markedssjef-modus-publiseringen og
cockpiten, men ber bare om `openid profile email` («Sign In with LinkedIn using
OpenID Connect»). Publiserings-scopene spørres fortsatt først når kortet i
Markedssjef-modus trenger dem.

## Flyt

**Web** (`LoginModal`, dekker `/login` og `/leadgrid/login`):

1. «Fortsett med LinkedIn» → `POST /api/auth/linkedin/oauth/start` `{returnPath, browserOrigin}`
   → `{authorizationUrl}`; state `lgn_<32 hex>` lagres i databasen (10 min).
2. LinkedIn → `/api/auth/linkedin/callback` (samme registrerte URL som tilkoblingen).
   Forwarderen i `index.ts` sender `lgn_`-states til `/api/auth/linkedin/login-callback`.
3. Callback bytter code → userinfo, finner/oppretter bruker, lager CreatorHub-sesjon og en
   engangs «transfer»; redirect til `returnPath?chLinkedInStatus=success&chLinkedInTransfer=<id>`.
4. `bootstrapCreatorHubLinkedInLoginRedirect()` (main-app.tsx) henter
   `GET /api/auth/linkedin/session-result/:id` og lagrer sesjonen i `localStorage`
   som Google-flyten. Feil vises i innloggingsmodalen via samme feilnøkkel som Google.

**Leadgrid iOS** (`PairingView`):

1. `GET /api/leadgrid/auth/linkedin/start?platform=ios` → `{auth_url, state}`.
2. `ASWebAuthenticationSession` (`LinkedInSignInService.swift`) → callback →
   `leadgrid://oauth?linkedin_transfer=<id>` (feil: `?error=…`).
3. `POST /api/leadgrid/auth/linkedin/exchange` `{transfer, deviceInfo}` → `{bearer, user, …}`;
   bearer lagres i `ipad_tokens` med `source='linkedin_signin'` og hydreres ved boot som Google-bearers.

## Hvem blir du logget inn som

Rekkefølge i `resolveOrCreateUserFromLinkedIn` (`backend/server/linkedin-login.ts`):

1. `user_auth_identities ('linkedin', sub)` — tidligere LinkedIn-innlogging.
2. `role_room_linkedin_connections.linkedin_member_id` — eksisterende publiserings-tilkobling.
3. `users` på e-post — **bare når LinkedIn sier e-posten er verifisert** (ellers avvises innloggingen,
   samme krav som Google-flytene; hindrer kontoovertakelse via uverifisert e-post).
4. Ny bruker: rolle `member`, placeholder-passord, solo_free-organisasjon (som Leadgrid-Google).

Deaktiverte kontoer avvises. Identiteten upsertes ved hver innlogging. Publiserings-tilkoblingen
røres ikke av innloggingen.

## Hva som fylles i profilen

| Fra LinkedIn userinfo | Til | Regel |
|---|---|---|
| `given_name` / `family_name` (ellers `name` splittet) | `users.first_name` / `last_name` | bare når tomt |
| `picture` | `users.profile_image_url` | lastes ned (maks 2 MB, 5 s) og lagres i R2 under `leadgrid/profile-images/<userId>/`, bare når tomt |
| `email` | `users.email` | bare ved opprettelse |
| hele svaret | `user_auth_identities.profile` | alltid |

Headline, tittel, selskap og stillinger fylles **ikke**: de krever `r_basicprofile`, som LinkedIn
forbeholder partnerprogrammet (`docs/evidence/2026-09-linkedin-oidc-login-claims.yaml`).

## Konfig

- Samme nøkler som tilkoblingen: `ROLE_ROOM_LINKEDIN_CLIENT_ID/SECRET` (fallback `LINKEDIN_CLIENT_ID/SECRET`)
  og `ROLE_ROOM_LINKEDIN_REDIRECT_URI`. Ingen ny redirect-URL hos LinkedIn.
- `LINKEDIN_LOGIN_ENABLED=off` skjuler knappene (web og iOS spør `GET /api/auth/linkedin/login-status`)
  og gir 503 på start. Ingen deploy nødvendig.
- Migrasjon `0618_user_auth_identities.sql`.

## Ikke i denne fasen

- «Koble LinkedIn-konto» fra Min profil for passord-brukere (de kobles automatisk ved første
  LinkedIn-innlogging når e-posten matcher og er verifisert).
- Storyboard Studio (`ios-storyboard`).
- Speiling av navn/bilde ved senere innlogginger (valgt bort: brukerens redigeringer skal vinne).
