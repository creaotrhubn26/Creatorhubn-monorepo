# Creatorhub One Desk

Mac-companion til CreatorHub. Søsterprosjekt til [iPad CaptureApp](../../ipad/CaptureApp/).

## Hva den gjør

1. **Minnekort-ingest etter oppdrag** — auto-detekterer SD/CF/CFexpress-mounts, matcher mot prosjektets planlagte `memoryCardConfigs` (fra `ProjectCreationWithMemoryCards`-wizarden), kopierer parallelt til N destinasjoner med xxHash64-verifisering. Bruker eksisterende `dit_backup_*`-tabeller.
2. **iPad-paring (LAN)** — Bonjour-discovery av CaptureApp-iPader på samme nettverk, QR/PIN-bekreftelse (AirDrop-stil), åpner WebSocket mot iPad's session-stream. Når iPad pusher asset til backend, speiler Desk parallelt til lokal RAID — Desk er en *ekstra* mirror, ikke source-of-truth.

## Hva den ikke gjør

- Ingen kontakt med Post Agent. Helt separat binær, separate minisign-nøkler, separat release-kanal.
- Ingen modifikasjon av kilde-kort (read-only). Kun kopierer.
- Ingen sletting. Aldri.

## Status

**F0 — scaffold** ✅
**F1–F7** — pending

Se hovedplan i samtalen som opprettet appen, eller [[project_creatorhub_one_desk]] (kommer).

## Dev

```bash
cd apps/creatorhub-one-desk
npm install
npm run tauri dev
```

## TODO før første real-bruker release

- [ ] **Roter minisign-nøkkel** fra passordløs dev-key (id `44F19650DE0B1E3A`) til en eier-eksklusiv nøkkel med passord. Se "Roter nøkkel før real release" nedenfor.
- [ ] **Apple Developer ID-signing** — appen er per nå usignert. Brukere møter Gatekeeper-warning og må right-click → Open. For betalte kunder bør vi enten:
   1. Få Apple Developer ID-cert ($99/år) og sette `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` + `APPLE_SIGNING_IDENTITY` som GitHub secrets, ELLER
   2. Notarize gjennom Apple's notarytool så DMG-en åpner uten warning.
- [ ] **Erstatt placeholder-ikoner** i `src-tauri/icons/` (kopiert fra Post Agent — må byttes med Desk-branding før real release).

## Bygg lokalt

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/macos/Creatorhub One Desk.app`

Usignert i v0.1.x — brukerne må right-click → Open første gang.

## Distribusjon + auto-updater (F7)

Tag-trigget GitHub Actions: `creatorhub-one-desk-v*` → bygger `.app.tar.gz` for både aarch64 og x86_64, signerer med minisign, uploader til en GitHub Release med `latest.json`-manifest. Tauri-updater-plugin'en sjekker manifestet og prompt'er brukeren ved oppstart.

### Minisign-nøkler
- **Lokalt:** `~/.tauri/one-desk` (privat) + `~/.tauri/one-desk.pub` (offentlig)
- **Public key:** embedded i `tauri.conf.json` under `plugins.updater.pubkey`
- **HELT SEPARAT** fra Post Agent's nøkler — de to appene kan aldri utilsiktet bytte signing-identitet

### GitHub secrets som må settes for release-workflowen
- `TAURI_SIGNING_PRIVATE_KEY_ONE_DESK` — innholdet av `~/.tauri/one-desk` (base64-blob)
- `TAURI_SIGNING_PRIVATE_KEY_ONE_DESK_PASSWORD` — tom string (passordløs dev-nøkkel)

Sett dem via `Settings → Secrets and variables → Actions` på GitHub-repoet.

### Slik lager du en release
```bash
# 1. Verifiser keypar + pubkey-konsistens lokalt (anbefalt før push)
./scripts/verify-updater-key.sh

# 2. Push tag for å trigge release-workflow
git tag creatorhub-one-desk-v0.1.1
git push origin creatorhub-one-desk-v0.1.1
# Watch: .github/workflows/release-creatorhub-one-desk.yml
```

Release-workflowen har en **pre-flight-step** som stopper builden hvis:
- `TAURI_SIGNING_PRIVATE_KEY_ONE_DESK`-secret er tom (forhindrer usignerte release-binærer som auto-updater ville avvist stille)
- `plugins.updater.pubkey` i `tauri.conf.json` ikke er gyldig minisign-format
- Den fortsatt bruker placeholder/dev-keyen (advarsel, ikke fatal — kan overstyres når du har bevisst valgt å bruke den)

### Roter nøkkel før real release

Dev-keyen (`44F19650DE0B1E3A`) er passordløs og generert fra utviklerens lokale maskin — IKKE en sikker langtidsidentitet for produksjon.

```bash
# 1. Generér ny nøkkel MED passord (lagre passordet i 1Password eller lignende)
minisign -G -s ~/.tauri/one-desk -p ~/.tauri/one-desk.pub
chmod 600 ~/.tauri/one-desk

# 2. Lim base64-encoded pubkey inn i tauri.conf.json
cat ~/.tauri/one-desk.pub | base64 | tr -d '\n'
# Erstatt verdi av plugins.updater.pubkey i src-tauri/tauri.conf.json

# 3. Verifiser konsistens
./scripts/verify-updater-key.sh

# 4. Oppdater GitHub secrets:
#    - TAURI_SIGNING_PRIVATE_KEY_ONE_DESK     = innholdet av ~/.tauri/one-desk
#    - TAURI_SIGNING_PRIVATE_KEY_ONE_DESK_PASSWORD = passordet du satte
#    Bruk: gh secret set TAURI_SIGNING_PRIVATE_KEY_ONE_DESK < ~/.tauri/one-desk

# 5. Commit + tag som vanlig
git add src-tauri/tauri.conf.json
git commit -m "chore(one-desk): rotér updater-nøkkel til prod-key"
git tag creatorhub-one-desk-v0.2.0
git push origin main creatorhub-one-desk-v0.2.0
```

**Viktig**: brukere som har gammel-signerte binærer (signert med dev-key) vil IKKE få oppdateringen automatisk — nye release-binærer er signert med ny key, og deres app verifiserer med gammel pubkey. Du må enten:
- Sende dem en migration-melding (manuell re-install)
- Beholde dual-key under en migrasjons-periode (krever Tauri-updater-konfig som ikke er ferdig støttet)
- Akseptere at dev-key-brukere ikke får oppdateringer (akseptabelt hvis dev-keyen aldri ble distribuert til real-kunder)

Workflowen lager en GitHub Release med:
- `creatorhub-one-desk-darwin-aarch64.app.tar.gz` (+ `.sig`)
- `creatorhub-one-desk-darwin-x86_64.app.tar.gz` (+ `.sig`)
- `creatorhub-one-desk-darwin-{arch}.json` (manifest auto-updater leser)

Brukere som allerede har Desk installert vil få oppdaterings-prompt ved neste oppstart.

Beta-kanal: opt-in via egen distribusjonslenke (kommer senere — F7 dekker bare hoved-kanalen).

## Arkitektur

```
┌────────────────────┐
│  Canon R5          │
└─────────┬──────────┘
          │ CCAPI Wi-Fi
          ▼
┌────────────────────┐
│  iPad CaptureApp   │  (ipad/CaptureApp/ — shipped)
└─────────┬──────────┘
          │ Bonjour + WebSocket (LAN)
          ▼
┌────────────────────┐
│  Creatorhub One    │  DENNE APPEN
│  Desk (Mac)        │  - Live mirror fra iPad
│                    │  - Post-shoot ingest fra fysiske kort
└─────────┬──────────┘
          │ HTTPS (/api/capture/* + /api/dit/*)
          ▼
┌────────────────────┐
│  CreatorHub backend│
└────────────────────┘
```
