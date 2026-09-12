# CreatorHub Pro Tools Companion 0.3

Native macOS/Windows-companion (Tauri 2) som kjører ved siden av **Pro Tools** og
synker arbeidet inn i den koblede EaseVerse-låtens **Sound Room** i CreatorHub:

- **Markører** (fra «Export Session Info as Text») → `audio_review_sections` på gjeldende review-versjon
- **Bounces** (nye filer i «Bounced Files»-mappa) → nye `audio_review_versjoner` (review starter automatisk)
- **Metadata** (samplerate/bitdybde/spor, og tempo/key der det finnes) → review + EaseVerse-track
- **Tidskodet feedback** fra Sound Room → locate/markør direkte i Pro Tools
- **Keeper/reference** → sikker lokal staging og import på nytt lydspor
- **Export til review** → 24-bit WAV i den valgte `Bounced Files`-mappa
- **Pro Tools Intro-preflight** → spor-/routinggrenser og konkrete stem-tiltak
- **Review Console** → revisjonsbrief, oppgaver, sign-off, A/B-status og neste uløste kommentar i samme vindu som DAW-arbeidet
- **Ett trykk til review** → snapshot, `ExportMix`, EBU R128/true-peak-QC, opplasting og ny Sound Room-versjon
- **Session Snapshot / Recall** → versjonskoblet spor-, playlist-, routing- og eksportkildetilstand; recall forhåndsviser og gjenoppretter mute/solo/aktiv/synlig/mappe-status etter et automatisk recovery-snapshot
- **Leveransefabrikk** → eksplisitte master/instrumental/acapella/clean/TV-busser eller alle oppdagede stems; aldri skjult master-fallback
- **Intro-sikker kopi** → `SaveSessionAs` før overskytende spor settes inaktive; originalsesjonen forblir urørt
- **Bakgrunnsdrift** → systemstatusfelt, valgfri oppstart ved innlogging, offline feedback-cache og diagnosepakke uten tokens

## PTSL og robust filmodus

Når Avids lisensierte lokale PTSL-klient er installert, bruker Companion PTSL på
`localhost:31416` for direkte handlinger. SDK-kilde, generert klient og
rammeverk ligger aldri i dette repoet. Lokalt forventes klienten her:

- macOS/Linux: `~/.creatorhub-protools-companion/ptsl/ptslcmd`
- Windows: `%USERPROFILE%\.creatorhub-protools-companion\ptsl\ptslcmd.exe`

På utviklermaskiner oppdages også en bygget `ptslcmd` under
`~/Downloads/PTSL_SDK_CPP.*/install/*/Release/ptslcmd/`. Dette er kun lokal
oppdagelse; Avid-SDK-en blir aldri pakket inn i Companion.

Alternativt kan `CREATORHUB_PTSLCMD` peke til en lisensiert lokal build.

«Session Info as Text» og bounce-watcher er fortsatt den portable fallbacken:

> **Pro Tools → File → Export → Session Info as Text…**
> Huk av «Markers» (og gjerne «Track List»). Lagre som `.txt`.

Companionen overvåker den eksporterte fila. Hver gang du re-eksporterer (eller
lagrer over den), synkes markørene på nytt. Bounce-mappa overvåkes separat for
nye lydfiler.

Watcher-køen er atomisk, fortsetter etter app-/maskinomstart og bruker stabil
filfingerprint/idempotens slik at offline arbeid ikke dupliseres.

PTSL-tilstanden observeres adaptivt hvert 12. sekund og et nytt snapshot lagres
bare når den kanoniske tilstanden endrer fingerprint. Avids `ptslcmd` åpner én
tilkobling per kjøring; ekte, vedvarende `PollEvents` krever derfor en fremtidig
oppdatering av den lisensierte lokale helperen. Companion hevder ikke native
event-stream når den kjører denne adaptive modusen.

## AAX Review Console-grense

`apps/creatorhub-protools-aax/` inneholder en kompilert og testet C++17-adapter,
protokollskjema og kontrakttest for en tynn AAX-visning. Den kobler bare til
`127.0.0.1:31417`, bruker en separat 256-bit hemmelighet fra macOS Keychain eller
Windows Credential Manager og får aldri CreatorHub device-tokenet.

En distribuerbar `.aaxplugin` er med vilje ikke generert: Avids lisensierte AAX
SDK, AAX-wrapper/signering og iLok-autorisasjon må legges til i en lukket
Avid-releasejobb. Adapteren er den ferdige, leverandørnøytrale grensen denne
wrapperen skal kalle fra en worker-tråd, aldri fra audio-tråden.

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
- **Automatiske oppdateringer:** app-/installerarkiv signeres med Companionens
  egen Tauri/minisign-nøkkel og beskrives i `protools-companion-latest.json` for
  `darwin-aarch64`, `darwin-x86_64` og `windows-x86_64`.

Windows-releasen feiler lukket dersom app-binæren, EXE-installerens eller MSI-ens
Authenticode-signatur/tidsstempel ikke er gyldig. Signering bruker GitHub OIDC;
ingen privat kode-signeringnøkkel lagres i repoet eller på runneren.

Følgende GitHub-konfigurasjon må finnes før en release-tag opprettes:

- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- Updater-secrets: `TAURI_SIGNING_PRIVATE_KEY_PROTOOLS`,
  `TAURI_SIGNING_PRIVATE_KEY_PROTOOLS_PASSWORD`
- Variables: `AZURE_ARTIFACT_SIGNING_ENDPOINT`,
  `AZURE_ARTIFACT_SIGNING_RESOURCE_GROUP`, `AZURE_ARTIFACT_SIGNING_ACCOUNT`,
  `AZURE_ARTIFACT_SIGNING_PROFILE`

Appregistreringen må ha en federert credential med subject
`repo:creaotrhubn26/Creatorhubn-monorepo:environment:protools-companion-release`
og rollen **Artifact Signing Certificate Profile Signer** på Public Trust-profilen.
Workflowen verifiserer at profilen finnes og er aktiv før det kostbare native
Windows-bygget starter.
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
| `src-tauri/src/local_ipc.rs` | Autentisert og størrelsesbegrenset AAX ↔ Companion-loopback |
| `src/ReviewConsole.tsx` | Sound Room-feedback, markører, oppgaver, sign-off og beslutninger |
| `src/ProducerTools.tsx` | Ett-trykks-review, snapshot, Intro-kopi og leveransefabrikk |
| `src/OperationsPanel.tsx` | Autostart, signert updater og sanert diagnostikk |
| `src/App.tsx` | Paring → sesjons-oppsett → samlet produsentarbeidsflate |

Backend: `backend/server/protools-companion-routes.ts` (paring, sesjoner, markører,
snapshot, delivery jobs/manifester, feedback og bounce-presign/complete).
Companion-auth gjenbruker `desktop_device_tokens`; snapshots, bounces og jobs
valideres alltid mot samme bruker og Companion-session.

> Ikonene er midlertidig kopiert fra One Desk — bytt til egne før release.
