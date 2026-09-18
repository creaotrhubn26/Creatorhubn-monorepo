# SenseAid Explore — TestFlight

Alt som kan skriptes ligger i repoet: `fastlane/` (lane `ios beta`),
`fastlane/ExportOptions.plist` (manuell signering), `Reiseguide/PrivacyInfo.xcprivacy`
(personvernmanifest) og GitHub-workflowen `.github/workflows/senseaid-testflight.yml`.
Det som står igjen er klikk i Apple Developer og App Store Connect som krever
Apple-ID med Admin/App Manager-rolle, og som gjøres én gang.

Signering og opplasting bruker de samme repo-secrets som LeadMap og Capture
(`BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `KEYCHAIN_PASSWORD`,
`APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`,
`APP_STORE_CONNECT_API_KEY_CONTENT`). Ingen nye secrets trengs.

## Engangs-steg (ca. 10 minutter)

### 1. Registrer bundle-ID-en

[developer.apple.com/account](https://developer.apple.com/account) →
Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App:

- Description: `SenseAid Explore`
- Bundle ID (explicit): `com.creatorhubn.reiseguide`
- Capabilities: ingen ekstra. (Bakgrunnslyd og deep link trenger ikke
  capability; bakgrunns-geofencing i fase 2 trenger heller ikke.)

Provisioning-profilen «SenseAid Explore App Store» lages av fastlane (sigh)
ved første kjøring, mot «Apple Distribution: Creatorhub AS»-certet i secrets.
Skulle det feile, lag den manuelt: Profiles → **+** → App Store Connect →
velg bundle-ID-en og distribusjons-certet → navn `SenseAid Explore App Store`.

### 2. Opprett app-recordet

[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps →
**+** → New App:

- Platform: **iOS**
- Name: `SenseAid Explore` (navnet må være ledig globalt i App Store; er det
  tatt, bruk f.eks. `SenseAid Explore – lydguide` her, visningsnavnet på
  telefonen er uansett «SenseAid Explore» fra `project.yml`)
- Primary Language: **Norwegian (Bokmål)**
- Bundle ID: `com.creatorhubn.reiseguide`
- SKU: `SENSEAID-EXPLORE-01`
- User Access: Full Access

### 3. Kjør workflowen

GitHub → Actions → **SenseAid Explore TestFlight** → Run workflow → velg
grenen (`claude/project-thread-xxx8zg` fram til PR #2384 er merget, deretter
`main`). Jobben tar 10–15 minutter, og buildnummeret blir UTC-tidsstempelet
(`20260918153000`), så hver kjøring er strengt høyere enn forrige.

Alternativt lokalt på en Mac med Xcode 26 og fastlane:

```bash
cd ipad/Reiseguide
fastlane ios beta        # uten ASC-nøkkel i miljøet brukes Xcode-kontoen din
```

Apple prosesserer bygget i 5–20 minutter og sender e-post.

### 4. TestFlight

App Store Connect → appen → **TestFlight**:

- Første bygg: fyll **Test Information** (kontakt-e-post, personvern-URL
  `https://creatorhubn.com/privacy-policy`). Eksportsamsvar er allerede
  besvart i appen (`ITSAppUsesNonExemptEncryption: false`).
- **Internal Testing** → lag gruppe (f.eks. «SenseAid») → legg til testere
  (opptil 100, må være med i teamet i App Store Connect). Invitasjonen kommer
  på e-post innen et minutt; installer via TestFlight-appen på iPhone.
- **External Testing** (inntil 10 000, via offentlig lenke) krever en kort
  Beta App Review av Apple første gang; innholdet i `fastlane/changelog.txt`
  vises som «What to Test».

## Hva testeren møter

- Lyd finnes ikke ennå (Soniox-pipelinen kjøres når nøkkelen er på plass i
  Render); avspilleren viser «Lyden er ikke klar ennå» og simulert teksting.
- Bilder er plassholdere (fotorettigheter).
- Mock-paywall: første sted er åpent, resten låses opp med «kjøp» uten betaling.
- Posisjon bes om først ved «Bruk posisjonen min»; testere langt fra Oslo kan
  bruke listen og kartet uten posisjon.

## Neste testversjon

Oppdater `fastlane/changelog.txt` og kjør workflowen igjen. `MARKETING_VERSION`
(0.1) i `project.yml` bumpes bare ved en ny «ekte» versjon; buildnummeret
settes automatisk.

## Hvis noe feiler

- `No profiles for 'com.creatorhubn.reiseguide' were found`: bundle-ID-en er
  ikke registrert (steg 1), eller ASC-nøkkelen mangler App Manager-rolle
  (ASC → Users and Access → Integrations → nøkkelen → Edit Access).
- `Cloud signing permission error`: ExportOptions bruker manuell signering
  nettopp for å unngå dette; sjekk at profilnavnet i `ExportOptions.plist` og
  `Fastfile` (`PROFILE_NAME`) er identiske.
- ITMS-91053 (missing API declaration): `Reiseguide/PrivacyInfo.xcprivacy`
  mangler i bundlen; sjekk at XcodeGen tok den med som ressurs.
- Gym-loggen lastes opp som artifact `senseaid-gym-log` når jobben feiler.
