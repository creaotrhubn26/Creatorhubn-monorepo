# The Role Room i Canvas — oppsettsark for IT/Canvas-admin

**Til:** Canvas-administrator ved Høyskolen Kristiania / Den norske filmskolen (Høgskolen i Innlandet)
**Fra:** The Role Room
**Formål:** Koble The Role Room til deres Canvas via **LTI 1.3 Advantage**, slik at faglærere kan starte verktøyet fra emnet, hente klasse-/kulldata og sende karakter tilbake til Canvas-karakterboka.

Hele oppsettet tar ~10 minutter. Dere trenger **ingen** filoverføring, VPN eller egen server — kun én registrering i Canvas. All data hentes i sanntid via Canvas' standard-API-er (samme mekanikk som Turnitin/Gradescope bruker).

---

## Hva The Role Room er (kort)
Et produksjonsverktøy for film-/TV-/medieutdanning: studentproduksjoner, roller, oppgaver og vurdering. Integrasjonen gjør at faglærer slipper dobbeltføring — klasselister og karakterer synkroniseres mot Canvas (og dermed FS, som er kilden bak Canvas).

---

## Steg 1 — Opprett en LTI-nøkkel (Developer Key)
**Admin → Developer Keys → `+ Developer Key` → `+ LTI Key`.**

Velg **«Enter URL»** under *Method*, og lim inn vår konfigurasjons-URL:

```
https://www.theroleroom.com/api/role-room/lti/config
```

Denne URL-en fyller automatisk inn redirect-URIer, placements, JWKS og scopes. Sett så:

- **Redirect URIs** (fylles vanligvis auto; bekreft at denne finnes):
  `https://www.theroleroom.com/api/role-room/lti/launch`
- **Privacy Level: `Public`** ← *viktig.* Uten dette får vi ikke navn/e-post i klasselisten, og kull-import blir ubrukelig.

Lagre, og sett nøkkelen til **ON** (state = *On* i Developer Keys-lista).

---

## Steg 2 — Slå på LTI Advantage-tjenestene
På samme nøkkel, bekreft at disse er aktive (huk av under *LTI Advantage Services*):

- ☑️ **Can create and view assignment data in the gradebook** (AGS) — karakter tilbake
- ☑️ **Can view assignment data in the gradebook** (AGS – lese)
- ☑️ **Can view submission data** (AGS – resultat)
- ☑️ **Can retrieve user data associated with the context** (NRPS) — klasseliste **+ seksjoner/kull**
- ☑️ **Can lookup Account information**
- Deep Linking følger med fra config-URL-en (placements for oppgavevalg).

---

## Steg 3 — Aktiver appen i ett emne (pilot)
Legg til appen i **ett ekte emne** (helst med en klasse fra FS):

**Emne → Settings → Apps → `+ App` → By Client ID** → lim inn **Client ID** fra Steg 1.

For en fullverdig pilot, velg gjerne et emne som har:
- en **faglærer** og noen **studenter**, og
- **minst to seksjoner/kull** (fra FS) — så vi kan bekrefte at hvert kull havner riktig.

Appen dukker opp i emnemenyen som **«The Role Room»**.

---

## Anbefalt: kjør piloten i test-miljøet først (ingen prod-risiko)
Hver Instructure-hostede Canvas har et **test-miljø** som oppdateres fra prod hver helg — ideelt for å prøve integrasjonen mot ekte emne-/FS-data **uten** å røre live Canvas:

- Adresse: `https://<institusjon>.test.instructure.com` (f.eks. `kristiania.test.instructure.com`)
- Registrer Developer Key-en her **først** (samme steg 1–3 som over).
- 🔑 **Viktig:** i test-miljøet er *issuer* alltid `https://canvas.test.instructure.com` (ikke deres subdomene). Oppgi dette som «Canvas-adresse» til oss for test — så registrerer vi test som en egen plattform hos oss, adskilt fra prod.

Når piloten er verifisert i test, gjentar dere steg 1–3 i prod.

---

## Steg 4 — Send oss fire verdier
Fra Developer Key-en og Canvas-oppsettet, send oss:

| Verdi | Hvor den finnes |
|---|---|
| **Client ID** | Developer Keys-lista (tallet under *Details*) |
| **Deployment ID** | Emne/konto → appens *Deployment ID* (eller vi henter den ved første launch) |
| **Canvas-adresse (issuer)** | F.eks. `https://kristiania.instructure.com` |
| **Kontaktperson** | Navn + e-post for pilot-oppfølging |

Auth-/token-/JWKS-URL-ene er standard for Canvas og trenger dere ikke oppgi — vi utleder dem fra Canvas-adressen.

---

## Hva vi tester i piloten
1. **Oppstart** fra emnet → faglærer lander i et autentisert arbeidsrom med riktig rolle.
2. **Klasseliste** (NRPS) → ekte studenter med navn/e-post.
3. **Kull/seksjoner** → ett Role Room-kull per Canvas-seksjon.
4. **Karakter** (AGS) → karakter fra vurdering lander på riktig students rad i Canvas-karakterboka.
5. **Deep Linking** → faglærer kan velge/opprette en produksjonsoppgave direkte fra Canvas.

---

## Personvern / GDPR (kort)
- Vi henter **kun** data for emnet appen er aktivert i (Canvas' NRPS-scope er emne-avgrenset).
- Data hentes i sanntid via Canvas-API-er; vi speiler ikke FS direkte.
- Behandlingsgrunnlag og databehandleravtale avklares med institusjonen før produksjonsbruk.
- Feide-innlogging er et **separat, valgfritt** spor (ikke nødvendig for Canvas-oppstart).

---

## Kontakt
The Role Room · daniel@creatorhubn.com · https://www.theroleroom.com

*Teknisk detalj for de som vil verifisere: konfigurasjons-URL-en over returnerer en standard LTI 1.3 tool-konfigurasjon (message_type `LtiResourceLinkRequest` + `LtiDeepLinkingRequest`, scopes for AGS + NRPS, og vår offentlige JWKS på `/lti/jwks`).*
