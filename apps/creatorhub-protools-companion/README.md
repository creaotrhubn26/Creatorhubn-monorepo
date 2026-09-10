# Creatorhub Pro Tools Companion

Native macOS/Windows-companion (Tauri 2) som kjører ved siden av **Pro Tools** og
synker arbeidet inn i den koblede EaseVerse-låtens **Sound Room** i CreatorHub:

- **Markører** (fra «Export Session Info as Text») → `audio_review_sections` på gjeldende review-versjon
- **Bounces** (nye filer i «Bounced Files»-mappa) → nye `audio_review_versjoner` (review starter automatisk)
- **Metadata** (samplerate/bitdybde/spor, og tempo/key der det finnes) → review + EaseVerse-track
- **Tidskodet feedback** fra Sound Room → locate/markør direkte i Pro Tools
- **Keeper/reference** → sikker lokal staging og import på nytt lydspor
- **Export til review** → 24-bit WAV i den valgte `Bounced Files`-mappa
- **Pro Tools Intro-preflight** → spor-/routinggrenser og konkrete stem-tiltak

## PTSL og robust filmodus

Når Avids lisensierte lokale PTSL-klient er installert, bruker Companion PTSL på
`localhost:31416` for direkte handlinger. SDK-kilde, generert klient og
rammeverk ligger aldri i dette repoet. Lokalt forventes klienten her:

- macOS/Linux: `~/.creatorhub-protools-companion/ptsl/ptslcmd`
- Windows: `%USERPROFILE%\.creatorhub-protools-companion\ptsl\ptslcmd.exe`

Alternativt kan `CREATORHUB_PTSLCMD` peke til en lisensiert lokal build.

«Session Info as Text» og bounce-watcher er fortsatt den portable fallbacken:

> **Pro Tools → File → Export → Session Info as Text…**
> Huk av «Markers» (og gjerne «Track List»). Lagre som `.txt`.

Companionen overvåker den eksporterte fila. Hver gang du re-eksporterer (eller
lagrer over den), synkes markørene på nytt. Bounce-mappa overvåkes separat for
nye lydfiler.

Watcher-køen er atomisk, fortsetter etter omstart og bruker stabil
filfingerprint/idempotens slik at offline arbeid ikke dupliseres.

## Slik kobler du til

1. I CreatorHub: åpne **Sound Room → «Pro Tools Companion»** og lag en paringskode.
2. I companionen: skriv inn den 6-sifrede koden → **Koble til**.
3. Velg **EaseVerse-låt**, Pro Tools-utgave, **Session Info-fila** og **Bounced Files-mappa**.
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

Den ignorerte live-testen krever åpen Pro Tools-session og lokalt lisensiert
`ptslcmd`; testlyd og bounce-mappe gis via miljøvariablene
`CREATORHUB_PTSL_LIVE_AUDIO` og `CREATORHUB_PTSL_LIVE_BOUNCE_DIR`.

## Desktop-release

Workflowen `.github/workflows/protools-companion-release.yml` publiserer først når
alle støttede installere er bygget og kontrollert:

- **macOS Apple Silicon + Intel:** Developer ID-signert og Apple-notarisert DMG.
- **Windows x64:** anbefalt NSIS EXE-installer og MSI for administrert utrulling,
  bygget på en native Windows-runner og Authenticode-signert med Azure Artifact
  Signing Public Trust.
- **Windows install-smoke:** MSI pakkes ut og kontrolleres; NSIS installeres,
  appen startes og avinstalleres på den disposable Windows-runneren.
- **Integritet:** `SHA256SUMS.txt` publiseres sammen med installerne.

Windows-releasen feiler lukket dersom app-binæren, EXE-installerens eller MSI-ens
Authenticode-signatur/tidsstempel ikke er gyldig. Signering bruker GitHub OIDC;
ingen privat kode-signeringnøkkel lagres i repoet eller på runneren.

Følgende GitHub-konfigurasjon må finnes før en release-tag opprettes:

- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- Variables: `AZURE_ARTIFACT_SIGNING_ENDPOINT`,
  `AZURE_ARTIFACT_SIGNING_ACCOUNT`, `AZURE_ARTIFACT_SIGNING_PROFILE`

Appregistreringen må ha en federert credential med subject
`repo:creaotrhubn26/Creatorhubn-monorepo:environment:protools-companion-release`
og rollen **Artifact Signing Certificate Profile Signer** på Public Trust-profilen.
GitHub-environmentet tillater bare tags som matcher `protools-companion-v*`, samt
`main` for kontrollerte manuelle reruns som fortsatt bygger en immutable tag.

Ved release må versjonen være identisk i `package.json`, `src-tauri/tauri.conf.json`
og `src-tauri/Cargo.toml`; `package-lock.json` og `Cargo.lock` skal være committed.

## Arkitektur

| Fil | Ansvar |
|-----|--------|
| `src-tauri/src/ptx_parser.rs` | Parser «Session Info as Text» → markører/metadata (enhetstestet) |
| `src-tauri/src/api_client.rs` | HTTP mot backendens `/api/protools/*` (device-token) |
| `src-tauri/src/processing.rs` | Les eksport → push markører/metadata/bounce til backend |
| `src-tauri/src/ptsl.rs` | Lisensiert lokal PTSL-transport for locate/marker/import/export |
| `src-tauri/src/command_processor.rs` | Varig, device-scopet Sound Room → Pro Tools-kommandokø |
| `src-tauri/src/intro_preflight.rs` | Pro Tools Intro-grenser og stem/flatten-anbefalinger |
| `src-tauri/src/watcher.rs` | `notify`-fil-overvåking + debounce/stabilitets-sjekk |
| `src-tauri/src/config.rs` | Persistert config i `~/.creatorhub-protools-companion/` |
| `src/App.tsx` | Paring → sesjons-oppsett → dashboard + aktivitetslogg |

Backend: `backend/server/protools-companion-routes.ts` (paring, sesjoner, markører,
metadata, bounce-presign/complete). Companion-auth gjenbruker `desktop_device_tokens`.

> Ikonene er midlertidig kopiert fra One Desk — bytt til egne før release.
