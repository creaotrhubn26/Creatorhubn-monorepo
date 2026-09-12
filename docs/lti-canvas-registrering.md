# The Role Room — LTI 1.3 registrering i Canvas

Denne guiden registrerer The Role Room som et LTI 1.3 Advantage-verktøy i en
**Canvas admin-instans** (institusjonens Canvas eller en Canvas test-/trial-
konto med admin). Da kan faglærere åpne The Role Room rett fra Canvas (SSO),
og karakterer + klasseliste synkes automatisk (AGS + NRPS).

> ℹ️ Canvas «Free for Teachers» (canvas.instructure.com) kan **ikke** lage LTI
> Developer Keys — du trenger en instans med admin-tilgang (institusjon eller
> Canvas-trial med admin). saLTIre (saltire.lti.app) er allerede verifisert som
> gratis referanseplattform hvis du bare vil teste protokollen.

## Vår tool-konfigurasjon (autogenerert, alltid oppdatert)

Alt Canvas trenger ligger som ferdig JSON på:

```
https://www.theroleroom.com/api/role-room/lti/config
```

Denne inkluderer `oidc_initiation_url`, `target_link_uri`, `public_jwk_url`,
alle scopes (AGS grade-passback + NRPS roster) og Canvas-`extensions` med
placements (`course_navigation`, `assignment_selection`, `link_selection`) og
`privacy_level: public` (så Canvas sender navn/e-post — kreves for innlogging
og roster-matching).

## Steg 1 — Opprett Developer Key (LTI) i Canvas

1. Logg inn i Canvas som **admin** → **Admin** → velg kontoen.
2. **Developer Keys** → **+ Developer Key** → **+ LTI Key**.
3. Method: **Enter URL** → lim inn:
   `https://www.theroleroom.com/api/role-room/lti/config`
   (Canvas henter hele konfigurasjonen selv. Alternativt: Method «Paste JSON»
   og lim inn responsen fra endepunktet over.)
4. **Save**. Sett nøkkelen til **ON** (state-kolonnen).
5. Noter **Client ID** (tallet i Details-kolonnen, f.eks. `10000000000123`).

## Steg 2 — Legg til appen i kontoen/kurset

1. **Admin** → **Settings** → **Apps** → **View App Configurations** →
   **+ App**.
2. Configuration Type: **By Client ID** → lim inn Client ID fra steg 1 →
   **Submit** → **Install**.
   (Eller installer på kurs-nivå: Kurs → **Settings** → **Apps**.)

## Steg 3 — Registrer Canvas-instansen hos oss

I The Role Room admin (super-admin) → **Integrasjoner** → **LTI 1.3 —
LMS-plattformer** → skjemaet «Registrer plattform», med Canvas-verdiene:

| Felt | Canvas-verdi (produksjons-Canvas) |
|---|---|
| Issuer | `https://canvas.instructure.com` |
| Client ID | fra steg 1 |
| Auth login URL | `https://sso.canvaslms.com/api/lti/authorize_redirect` |
| Token URL | `https://sso.canvaslms.com/login/oauth2/token` |
| JWKS URL | `https://sso.canvaslms.com/api/lti/security/jwks` |
| Deployment ID | (valgfritt; Canvas viser den under appens Deployment) |

> For eldre/regionale Canvas-instanser kan vertsnavnet være `canvas.instructure.com`
> i stedet for `sso.canvaslms.com`. Bruk verdiene Canvas oppgir under Developer
> Key → **Details**.

## Steg 4 — Test launchen

1. I et Canvas-kurs → venstremenyen skal nå ha **The Role Room**
   (`course_navigation`-placement). Klikk den.
2. Første launch: du havner i **Utdannings-workspace** (faglærer), autentisert,
   uten ekstra pålogging.
3. **Vurdering** → **LMS-klasseliste (LTI)** → rosteret hentes fra Canvas (NRPS)
   → sett en karakter per student → **Send til LMS** → karakteren havner i
   Canvas-karakterboka (AGS).

## Feilsøking

- **Launch gir 401/redirect-loop:** sjekk at Issuer/Client ID matcher nøyaktig,
  og at Developer Key er **ON**.
- **Roster tomt / «LMS-en delte ikke klasseliste (NRPS)»:** sjekk at NRPS-scopet
  er haket av på Developer Key (det ligger i `/lti/config`, men bekreft i Canvas
  under Key → **Scopes**).
- **Karakter havner ikke i karakterboka:** oppgaven i Canvas må ha en tilknyttet
  kolonne (line item). Canvas oppretter denne automatisk ved
  `assignment_selection`-launch; ellers oppretter vi den via AGS ved første push.
- **Navn/e-post mangler:** `privacy_level` må være **public** på Developer Key.

## Standarder som brukes

- **LTI 1.3 Core** — third-party-initiert OIDC-launch (SSO fra Canvas).
- **AGS** (Assignment and Grade Services) — karakter → Canvas-karakterbok.
- **NRPS** (Names and Role Provisioning Services) — klasse-roster + student-`sub`.

Alt er verifisert ende-til-ende mot saLTIre-referanseplattformen; Canvas bruker
de samme standardene.
