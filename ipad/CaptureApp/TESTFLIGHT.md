# CaptureApp — TestFlight deploy

Klargjort infrastruktur i `ipad/CaptureApp/` som trengs for TestFlight.
Resten er manuell Xcode- og App Store Connect-klikking som krever
Apple-ID-login og kan ikke skriptes.

## Hva som allerede er i repoet

- `CaptureApp/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`
  — 1024×1024 iOS AppIcon (gullfarget CH på mørk slate-gradient)
- `CaptureApp/Assets.xcassets/AppIcon.appiconset/Contents.json`
  — iOS 17+ single-size AppIcon-manifest
- `CaptureApp/PrivacyInfo.xcprivacy`
  — privacy manifest (photos, user id, email — alle "App Functionality",
    ingen tracking, ingen ad-SDK-er)
- `ExportOptions.plist` — template for `xcodebuild -exportArchive` når
  vi senere setter opp CI

Regenerer ikonet ved behov:
```bash
node backend/scripts/generate-capture-app-icon.mjs
```

## Første TestFlight-opplasting (~15 min)

### 1. Åpne prosjektet i Xcode
```bash
open ipad/CaptureApp/CaptureApp.xcodeproj
```

### 2. Legg nye filer i Xcode-prosjektet
Filene eksisterer på disk men må registreres i `project.pbxproj`:

1. Dra `CaptureApp/Assets.xcassets/` fra Finder inn i Xcode-prosjekt-
   navigatøren (venstre panel), slipp under `CaptureApp`-gruppen.
   Dialogen — hak av **CaptureApp** under "Add to targets".
   **"Copy items if needed" skal være AV** (filen ligger allerede i
   riktig mappe).
2. Dra `CaptureApp/PrivacyInfo.xcprivacy` inn i samme gruppe, samme
   innstillinger.

### 3. Sett Development Team
`CaptureApp` target → **Signing & Capabilities**:
- Logg inn med Apple-ID hvis ikke allerede (Xcode → Settings → Accounts)
- Velg team fra dropdown (Creatorhub AS)
- **Automatically manage signing** skal være avhuket
- Når team er satt, Xcode laster provisioning-profilen automatisk

Bundle ID `com.creatorhubn.capture` må være registrert i Apple Developer
Portal på teamet ditt. Første gang må du:
- [developer.apple.com/account](https://developer.apple.com/account) →
  Certificates, Identifiers & Profiles → Identifiers → **+**
- App IDs → App → Bundle ID: `com.creatorhubn.capture`
  Description: "CreatorHub Capture"
- Capabilities: ingen spesielle trenges for MVP. (Associated Domains,
  Push Notifications, Background Modes kan legges til senere.)

### 4. Opprett App Store Connect-record
[appstoreconnect.apple.com](https://appstoreconnect.apple.com) →
My Apps → **+** → New App:
- Platform: **iOS**
- Name: `CreatorHub Capture`
- Primary Language: **Norwegian (Bokmål)**
- Bundle ID: `com.creatorhubn.capture` (skal vises i dropdown etter
  stegene over)
- SKU: `CAPTURE-01`
- User Access: Full Access

### 5. Archive + upload
I Xcode, med fysisk iPad eller "Any iOS Device (arm64)" valgt som
destinasjon (ikke simulator):
- **Product → Archive**
- Organizer åpner når det er ferdig
- Velg arkivet → **Distribute App** → **App Store Connect** → **Upload**
- Automatic signing → Upload

Første bygg prosesseres på Apple-siden i 5–20 minutter. Du får e-post
når det er klart.

### 6. TestFlight
App Store Connect → **TestFlight**-fanen på appen din:
- Build lista: velg det nyopplastede → fyll inn **Test Details**
  (what to test: "Phase 2B — logg inn med Google ID-token, velg et
  prosjekt, tether mot R5/R6 mkII, lever som UniversalShowcase-galleri")
- **Internal Testing** → Add testers (opptil 100, umiddelbar tilgang)
- Test-e-posten din mottar TestFlight-invitasjon innen 1 minutt
- Installer på iPad via TestFlight-app-en

## Version-bump-rutine for hver nye build

Før hver nye `Archive`:

```bash
# Bump build number (siste tallet etter punktum). MARKETING_VERSION
# (1.0) bumpes bare ved "ekte" release; CURRENT_PROJECT_VERSION bumpes
# hver build som går opp til App Store Connect.
cd ipad/CaptureApp
agvtool next-version -all
```

Eller sett manuelt i project.pbxproj: søk `CURRENT_PROJECT_VERSION`,
øk `1` → `2` osv.

`MARKETING_VERSION` (1.0 nå) beholdes til første offentlige release.

## Kjente gaps som senere kan påvirke App Store Review

Ingen av disse stopper TestFlight — bare full App Store-release:

1. **Native Google Sign-In SDK** — Phase 2B bruker paste-Google-ID-token
   som MVP. For release bør vi integrere [GoogleSignIn-Swift](https://github.com/google/GoogleSignIn-iOS).
2. **Screenshots + beskrivelse** — App Store Connect krever iPad-screenshots
   (12.9", 11") + salgstekst før release-submit. TestFlight trenger ikke dette.
3. **Demo-video** — ikke påkrevd for TestFlight, påkrevd for App Review
   ved første release.
4. **App Privacy Policy URL** — pek på `https://theroleroom.com/privacy`
   eller lag en egen for CaptureApp.

## Hvis Archive-knappen er grået ut

- Bekreft at destinasjonen er "Any iOS Device (arm64)" (ikke en simulator)
- Bekreft at `Signing & Capabilities` viser "Signing Certificate: Apple
  Distribution" og en provisioning-profil
- Rydd build-cache: Product → Clean Build Folder (⇧⌘K)
