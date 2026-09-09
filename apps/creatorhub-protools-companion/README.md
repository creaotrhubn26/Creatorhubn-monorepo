# Creatorhub Pro Tools Companion

Native macOS/Windows-companion (Tauri 2) som kjører ved siden av **Pro Tools** og
synker arbeidet inn i den koblede EaseVerse-låtens **Sound Room** i CreatorHub:

- **Markører** (fra «Export Session Info as Text») → `audio_review_sections` på gjeldende review-versjon
- **Bounces** (nye filer i «Bounced Files»-mappa) → nye `audio_review_versjoner` (review starter automatisk)
- **Metadata** (samplerate/bitdybde/spor, og tempo/key der det finnes) → review + EaseVerse-track

## Hvorfor «Session Info as Text»?

Pro Tools har ingen åpen marker-/scripting-API på vanlige lisenser. Den eneste
pålitelige veien til markører uten AAX/EuCon er teksteksporten:

> **Pro Tools → File → Export → Session Info as Text…**
> Huk av «Markers» (og gjerne «Track List»). Lagre som `.txt`.

Companionen overvåker den eksporterte fila. Hver gang du re-eksporterer (eller
lagrer over den), synkes markørene på nytt. Bounce-mappa overvåkes separat for
nye lydfiler.

> Live playhead-sync er ikke med i v1 (krever MTC/EuCon). Markører + bounces er
> det som gir mest verdi i review-flyten.

## Slik kobler du til

1. I CreatorHub: åpne **Sound Room → «Pro Tools Companion»** og lag en paringskode.
2. I companionen: skriv inn den 6-sifrede koden → **Koble til**.
3. Velg **EaseVerse-låt** (Sound Room), **Session Info-fila** og **Bounced Files-mappa**.
4. **Start overvåking.** Eksporter Session Info / bounce i Pro Tools som vanlig — det
   dukker opp i Sound Room automatisk.

## Utvikling

```bash
cd apps/creatorhub-protools-companion
npm ci
npm run tauri dev      # kjør appen lokalt (krever Rust-toolchain)
npm run tauri build    # lokalt bygg; release-signering/notarisering skjer i CI
```

Ren logikk (Pro Tools-tekstparseren) er enhetstestet:

```bash
cd src-tauri && cargo test
```

## Desktop-release

Workflowen `.github/workflows/protools-companion-release.yml` publiserer først når
alle støttede installere er bygget og kontrollert:

- **macOS Apple Silicon + Intel:** Developer ID-signert og Apple-notarisert DMG.
- **Windows x64:** anbefalt NSIS EXE-installer og MSI for administrert utrulling,
  bygget og testet på en native Windows-runner.
- **Integritet:** `SHA256SUMS.txt` publiseres sammen med installerne.

Windows-installerne er foreløpig ikke Authenticode-signert og kan derfor utløse
SmartScreen. Brukeren kan velge «Mer informasjon» → «Kjør likevel» og kontrollere
filens SHA-256 mot release-sjekksummen. Legg til en Windows-kodesigneringsleverandør
før denne advarselen fjernes fra Sound Room.

Ved release må versjonen være identisk i `package.json`, `src-tauri/tauri.conf.json`
og `src-tauri/Cargo.toml`; `package-lock.json` og `Cargo.lock` skal være committed.

## Arkitektur

| Fil | Ansvar |
|-----|--------|
| `src-tauri/src/ptx_parser.rs` | Parser «Session Info as Text» → markører/metadata (enhetstestet) |
| `src-tauri/src/api_client.rs` | HTTP mot backendens `/api/protools/*` (device-token) |
| `src-tauri/src/processing.rs` | Les eksport → push markører/metadata/bounce til backend |
| `src-tauri/src/watcher.rs` | `notify`-fil-overvåking + debounce/stabilitets-sjekk |
| `src-tauri/src/config.rs` | Persistert config i `~/.creatorhub-protools-companion/` |
| `src/App.tsx` | Paring → sesjons-oppsett → dashboard + aktivitetslogg |

Backend: `backend/server/protools-companion-routes.ts` (paring, sesjoner, markører,
metadata, bounce-presign/complete). Companion-auth gjenbruker `desktop_device_tokens`.

> Ikonene er midlertidig kopiert fra One Desk — bytt til egne før release.
