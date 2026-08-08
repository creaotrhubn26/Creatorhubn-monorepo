# The Role Room — LTI 1.3 registrering i Moodle

Denne guiden registrerer The Role Room som et LTI 1.3 Advantage-verktøy i en
**Moodle-instans** (institusjonens server eller Moodle-hostingtjeneste med
admin-tilgang). Da kan undervisere åpne The Role Room rett fra Moodle (SSO),
og karakterer + klasseliste synkes automatisk (AGS + NRPS).

> ℹ️ Du trenger **admin-tilgang** til Moodle-instansen for å registrere LTI-verktøy.
> Kontakt systemadministrator hvis du er lærer uten admin-rettigheter.

## Hva LTI 1.3 Advantage gir

- **SSO (Single Sign-On):** Elever og lærere logges inn automatisk via Moodle.
- **Karaktertilbakeføring (AGS):** Karakterer satt i The Role Room sendes automatisk
  til Moodles karakterbok.
- **Klasseliste (NRPS):** Elevlisten importeres fra Moodle, og rollen
  (student/lærer) gjenkjennes automatisk.
- **Innholdsvalg (Deep Linking):** Lærere kan velge aktiviteter/oppgaver
  innen The Role Room uten å forlate Moodle.

## Steg 1 — Registrer The Role Room automatisk

Moodle 3.8+ støtter **dynamisk registrering** — du trenger bare den ene URL-en:

```
https://www.theroleroom.com/api/role-room/lti/register
```

1. Logg inn i Moodle som **admin** → **Site administration** (eller «Nettstedadministrasjon»).
2. Gå til **Plugins** (eller «Utvidelser») → **Activity modules** (eller «Aktivitetsmoduler»)
   → **External tool** (eller «Eksternt verktøy») → **Manage tools** (eller «Håndter verktøy»).
3. Klikk **Configure a tool automatically** (eller «Konfigurer verktøy automatisk»).
4. Lim inn registrerings-URL-en: `https://www.theroleroom.com/api/role-room/lti/register`
5. Klikk **Submit** (eller «Send inn»).

Moodle vil nå hente konfigurasjonen fra The Role Room og opprette verktøyet.

## Steg 2 — Vent på godkjenning

Etter registrering vil verktøyet vises i listen som **venter godkjenning** (pending).
The Role Room-admin må godkjenne registreringen før verktøyet kan brukes:

1. Logg inn i **The Role Room Admin** (super-admin-panel).
2. Gå til **LTI-plattformer** (eller «Integrations»).
3. Finn Moodle-instansen med status «Venter godkjenning» («Pending»).
4. Klikk **Godkjenn** (eller «Approve»).

Etter godkjenning kan undervisere bruke verktøyet straks.

## Steg 3 — Test launchen

1. Logg inn i Moodle som **lærer**.
2. Åpne et kurs → legg til aktivitet → velg **External tool** → søk etter
   **The Role Room** → velg den → lagre.
3. Klikk på The Role Room-aktiviteten. Du skal logges inn automatisk uten
   å måtte oppgi passord.
4. Hvis du er lærer: test å sette en karakter og klikk **Send til LMS**.
   Karakteren skal dukke opp i Moodles karakterbok innen få sekunder.

## Fallback — Manuell registrering

Hvis dynamisk registrering ikke fungerer eller Moodle-versjonen er eldre (< 3.8),
kan du registrere verktøyet manuelt med disse verdiene:

| Felt | Verdi |
|---|---|
| **Tool name** | The Role Room |
| **Tool URL** | `https://www.theroleroom.com/api/role-room/lti/launch` |
| **Issuer** | `https://www.theroleroom.com` |
| **Client ID** | (oppgis av The Role Room ved manuell registrering) |
| **Deployment ID** | (oppgis av The Role Room ved manuell registrering) |
| **Auth login URL** | `https://www.theroleroom.com/api/role-room/lti/login` |
| **Token URL** | `https://www.theroleroom.com/api/role-room/lti/token` |
| **JWKS URL** | `https://www.theroleroom.com/api/role-room/lti/jwks` |

Aktivér følgende **scopes:**
- `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly`
- `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem`
- `https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly`
- `https://purl.imsglobal.org/spec/lti-ags/scope/score`
- `https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly`

Kontakt The Role Room-support (support@theroleroom.com) for Client ID og
Deployment ID ved manuell registrering.

## Samme standard — fungerer på Canvas og andre LMS-er

LTI 1.3 Advantage er en åpen standard. The Role Room registreres akkurat
på samme måte i Canvas (se [Canvas-guiden](lti-canvas-registrering.md)), Google
Classroom, Blackboard og andre LMS-er som støtter LTI 1.3.

## Feilsøking

- **Verktøyet vises ikke etter godkjenning:** tøm Moodles cache
  (Site administration → Development → Purge all caches), og refresh siden.
- **Login gir 401 / infinite redirect:** sjekk at **Issuer** og **Client ID**
  stemmer nøyaktig med verdiene i The Role Room Admin.
- **Klasseliste tom / elever mangler:** kontroller at NRPS-scopet er aktivert,
  og at kurset har elever registrert i Moodle.
- **Karakterer sendes ikke tilbake til Moodle:** sjekk at AGS-scopet er aktivert
  og at du klikker **Send til LMS** i The Role Room.

Kontakt **support@theroleroom.com** hvis problemene vedvarer.
