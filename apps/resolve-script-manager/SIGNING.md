# Code-signing & notarisering — Post Agent (macOS)

Når dette er på plass, **sitter Skjermopptak/Tilgjengelighet permanent** (iPhone
Mirroring + Mac-skjerm-opptak virker in-app), og appen åpner uten Gatekeeper-
advarsel. Repoet er allerede forberedt:

- `src-tauri/entitlements.plist` — hardened runtime + tillat ffmpeg/python-subprosesser
- `src-tauri/tauri.conf.json` → `bundle.macOS.entitlements` peker på fila
- `.github/workflows/release-post-agent.yml` — signerer + notariserer **automatisk
  når `APPLE_*`-secrets finnes**, ellers usignert som før

## Forutsetning
Aktivt **Apple Developer Program**-medlemskap (individuelt eller organisasjon).

## 1. Lag «Developer ID Application»-sertifikat
1. Nøkkelring → Sertifikatassistent → **Be om et sertifikat fra en sertifiseringsinstans** → lagre CSR til disk (e-post + navn, «Lagret til disk»).
2. `developer.apple.com/account` → Certificates → **+** → **Developer ID Application** → last opp CSR → last ned `.cer`.
3. Dobbeltklikk `.cer` → installeres i nøkkelringen.
4. Verifiser: `security find-identity -v -p codesigning` → skal vise `Developer ID Application: <navn> (<TEAMID>)`.

## 2. Eksporter sertifikatet til .p12 (for CI)
1. Nøkkelring → høyreklikk sertifikatet (med privatnøkkelen under) → **Eksporter** → `.p12` → sett et passord.
2. Base64-enkod for GitHub secret:
   ```sh
   base64 -i Certificates.p12 | pbcopy   # ligger nå på utklippstavla
   ```

## 3. Notariserings-credentials
- **APPLE_ID**: din Apple-ID (e-post).
- **APPLE_PASSWORD**: app-spesifikt passord — lag på `appleid.apple.com` → Logg inn & sikkerhet → App-spesifikke passord.
- **APPLE_TEAM_ID**: 10-tegns Team ID (vises i parentes i `security find-identity`, eller på developer.apple.com → Membership).

## 4. Sett GitHub repo-secrets
`gh secret set <NAVN>` (eller Settings → Secrets → Actions):

| Secret | Verdi |
|--------|-------|
| `APPLE_CERTIFICATE` | base64 av `.p12` (steg 2) |
| `APPLE_CERTIFICATE_PASSWORD` | passordet du satte på `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: <navn> (<TEAMID>)` (eksakt) |
| `APPLE_ID` | Apple-ID e-post |
| `APPLE_PASSWORD` | app-spesifikt passord |
| `APPLE_TEAM_ID` | 10-tegns Team ID |

Deretter: push en `post-agent-v*`-tag som før → workflowen bygger **signert + notarisert** automatisk.

## 5. Lokal signert build (for testing før release)
```sh
cd apps/resolve-script-manager
export APPLE_SIGNING_IDENTITY="Developer ID Application: <navn> (<TEAMID>)"
export APPLE_ID="<apple-id>"
export APPLE_PASSWORD="<app-spesifikt-passord>"
export APPLE_TEAM_ID="<TEAMID>"
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/post-agent)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build -- --target aarch64-apple-darwin
```
Tauri signerer med hardened runtime + entitlements og notariserer hvis `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` er satt.

## Merknader
- **ffmpeg er ikke bundlet** — appen finner den på systemet (`find_ffmpeg`). Den trenger derfor ikke signeres av oss. (Vurder å bundle en signert ffmpeg senere for å slippe Homebrew-avhengighet.)
- Skjermopptak/Kamera krever ingen *entitlement* — det er rene TCC-runtime-tillatelser. Men en **signert** app beholder grant-en (usignert/ad-hoc gjør ikke det på macOS 15).
- `disable-library-validation` er nødvendig for at hardened runtime skal tillate å spawne ffmpeg/python som ikke er signert med samme Team ID.
