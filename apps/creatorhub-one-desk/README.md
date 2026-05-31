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

## TODO før første release

- [ ] Erstatt placeholder-ikoner i `src-tauri/icons/` (kopiert fra Post Agent — må byttes med Desk-branding før release)
- [ ] Generér nye minisign-nøkler (IKKE gjenbruk Post Agent-nøklene)
- [ ] Sett opp release-workflow (kommer i F7)

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
git tag creatorhub-one-desk-v0.1.1
git push origin creatorhub-one-desk-v0.1.1
# Watch: .github/workflows/release-creatorhub-one-desk.yml
```

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
