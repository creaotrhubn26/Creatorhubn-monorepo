# Post Agent ↔ Photoshop — arkitektur

Ende-til-ende bro mellom **The Role Room Post Agent** (Tauri-app) og **Adobe Photoshop**, etablert 2026-05-30/31 via 6 sammenhengende PR-er.

Verifisert: `ping → pong` mot Photoshop 2026.

## Stack-oversikt

```
┌─────────────────────────────────────────────────────────────┐
│                    Post Agent (Tauri)                       │
│                                                             │
│  ┌─────────────────┐    ┌───────────────────┐               │
│  │ React frontend  │    │  Rust backend     │               │
│  │                 │    │                   │               │
│  │  Dialogs        │    │  WS-server :1733  │◄──────┐       │
│  │  • Bridge       │    │  (photoshop_      │       │       │
│  │  • Templates    │    │   bridge.rs)      │       │       │
│  │  • Agent        │    │                   │       │       │
│  │  • PSD-galleri  │    │  PSD parser       │       │       │
│  │                 │    │  (psd_indexer.rs) │       │       │
│  │  Services       │    │                   │       │       │
│  │  • photoshop    │    │  Claude proxy     │       │       │
│  │    Bridge       │    │  (claude_chat)    │       │       │
│  │    Service      │    │                   │       │       │
│  │  • psd          │◄───┤  Tauri commands   │       │       │
│  │    Indexer      │    │  & events         │       │       │
│  │    Service      │    │                   │       │       │
│  │                 │    │                   │       │       │
│  │  Agents         │    └───────────────────┘       │       │
│  │  • photoshop    │                                │       │
│  │    Tools        │                                │       │
│  └────────┬────────┘                                │       │
│           │                                         │       │
└───────────┼─────────────────────────────────────────┼───────┘
            │                                         │
            ▼                                         │ WS
   ┌────────────────┐                                 │
   │  Claude API    │                                 │
   │  (via Anthropic│                                 │
   │   eller Role   │                                 │
   │   Room proxy)  │                                 │
   └────────────────┘                                 │
                                                      │
                                          ┌───────────┴────────┐
                                          │ Adobe Photoshop    │
                                          │                    │
                                          │  ┌──────────────┐  │
                                          │  │ UXP Plugin   │  │
                                          │  │ "Post Agent  │  │
                                          │  │  Bridge"     │  │
                                          │  │              │  │
                                          │  │ • WS client  │  │
                                          │  │ • Command    │  │
                                          │  │   dispatcher │  │
                                          │  │ • Event push │  │
                                          │  └──────┬───────┘  │
                                          │         │          │
                                          │    Photoshop DOM   │
                                          │    (executeAsModal)│
                                          └────────────────────┘
```

## Komponenter

### Rust-backend (`apps/resolve-script-manager/src-tauri/src/`)

- **`photoshop_bridge.rs`** — WS-server på `127.0.0.1:1733`. Tar imot én aktiv UXP-plugin om gangen (overskriver ved ny tilkobling). Request/response korreleres via UUID. Push-events fra plugin emittes til frontend som `photoshop://event` + `photoshop://status`.
  - **Kritisk**: spawnes via `tauri::async_runtime::spawn`, IKKE `tokio::spawn`. Tauri's `setup()`-callback har ikke tokio-reactor aktiv ennå — `tokio::spawn` der panicker og crasher hele appen via `tao::did_finish_launching`.
- **`psd_indexer.rs`** — Skanner mappe for `.psd`/`.psb`-filer og returnerer metadata (dimensjoner, layer-tre, embedded PNG-thumbnail) via `psd`-crate. Parsing kjøres i `tokio::spawn_blocking`. Graceful fallback hvis `psd::rgba()` panicker.

Tauri-commands eksponert til frontend:
- `photoshop_send_command(command, params)` — send hvilken som helst kommando til UXP-plugin
- `photoshop_status()` — hent bridge-tilstand
- `psd_index_directory(dir, max_depth)` — skann mappe
- `psd_get_info(path)` — enkeltfil

### UXP-plugin (`apps/post-agent-photoshop-plugin/`)

Vanilla JS, ingen build-pipeline. Sideloades via Adobe UXP Developer Tool.

- **`manifest.json`** — UXP v6, host PS 23+, network-permission for `ws://localhost:1733`. NB: ikke ha `"icons": []` — tom array crasher UDT's egen JS-validator.
- **`index.js`** — WS-klient med eksponensiell backoff (500ms → 8s). Alle DOM-mutasjoner wrappet i `core.executeAsModal()`. Pusher `photoshop.action`-events ved `open`/`close`/`select`/`make`.

v1-kommando-vokabular:
| Kommando | Beskrivelse |
|---|---|
| `ping` | Helse-sjekk |
| `app.info` | PS-versjon + åpne dokumenter |
| `doc.open` | Åpne fil fra absolutt sti |
| `doc.save` | Lagre aktivt dokument |
| `doc.export` | Eksporter til jpg/png/psd/tiff |
| `smartObject.replace` | Bytt smart-object-innhold |
| `text.setContents` | Endre tekst i named text-layer |
| `layer.toggle` | Vis/skjul navngitt layer |
| `template.scan` | Finn alle `{{key}}`-felter i en template-PSD |
| `template.render` | Fyll templater fra data, eksporter, lukk uten å lagre |

### TypeScript-services (`apps/resolve-script-manager/src/`)

- **`services/photoshopBridgeService.ts`** — Typed wrapper rundt `photoshop_send_command` + event-listeners. Eksponerer `photoshop.openDocument()`, `exportDocument()`, `renderTemplate()`, etc.
- **`services/psdIndexerService.ts`** — Typed wrapper rundt PSD-indekseren.
- **`hooks/usePhotoshopStatus.ts`** — React-hook som abonnerer på live bridge-status + active document.
- **`agents/photoshopTools.ts`** — Anthropic tool-definitions for hver photoshop-kommando + dispatcher (`runPhotoshopTool`) som lar Claude styre Photoshop via tool-use-protokollen.

### React-dialoger

| Dialog | Bruk |
|---|---|
| `PhotoshopBridgeDialog` | Dev/test-panel — kjør hver v1-kommando manuelt med input-felter |
| `PhotoshopTemplateDialog` | Skann template → fyll `{{key}}`-felter → render og eksporter |
| `PhotoshopAgentDialog` | **AI Creative Director MVP** — naturlig språk → Claude → agentic loop med tool-use |
| `PsdGalleryDialog` | Thumbnail-galleri over .psd/.psb i en mappe (uten Photoshop) |
| `PhotoshopStatusPill` | Live-pille i HeaderBar med aktivt doc-navn |

## PR-historikk

| PR | Tema | Status |
|---|---|---|
| #35 | Photoshop UXP bridge + templater | uke 1+2 fundament |
| #36 | Hotfix `/me` schemaDegraded | prod-kritisk sideeffekt |
| #39 | Rust PSD indexer + galleri | uke 3 — psd-crate, helt isolert |
| #40 | Live Photoshop status pill | uke 3 — demonstrerer event-bro |
| #41 | Claude tool-defs | uke 3 — eksponerer vokabularet for AI |
| #43 | Photoshop Agent dialog | uke 3 — AI Creative Director MVP |

Stack: `main ← #35 ← #41 ← #43`, `#35 ← #40`, `#39` parallelt fra main.

Anbefalt merge-rekkefølge: #36 (prod) → #35 → #39 → #41 → #40 → #43.

## Slik utvider du

### Legg til en ny Photoshop-kommando

1. **UXP-plugin** (`index.js`): legg til en handler i `COMMANDS`-objektet. Wrap DOM-mutasjon i `core.executeAsModal()`.
2. **TS-service** (`photoshopBridgeService.ts`): legg til en typed metode i `photoshop`-objektet som kaller `send("din.command", params)`.
3. **Claude tools** (`agents/photoshopTools.ts`): legg til en `ClaudeToolDefinition` i `PHOTOSHOP_TOOLS`-array, og en case i `dispatch()`.
4. **Test**: åpne `PhotoshopBridgeDialog` og verifiser kommandoen manuelt før du forventer at Claude bruker den.

### Legg til en ny event fra Photoshop

1. **UXP-plugin**: i `registerActionNotifiers()`, abonner på flere Adobe-events. Emit via `emitEvent("din.event", { data })`.
2. **Service**: bruk eksisterende `onEvent`-listener i frontend; pattern-match på `event.event === "din.event"`.

## Distribusjon

For utvikling: sideload via Adobe UXP Developer Tool (gratis, krever bare Creative Cloud-bruker).

For produksjon (utsatt med vilje): pakke som `.ccx` via UDT → sende inn til Adobe Exchange for offentlig listing (krever Adobe Developer-konto + review).

## Gotchas

- **Manifest med `"icons": []`** → crasher UDT's JS-validator. Bare ikke ha icons-feltet hvis ikke du har ikoner.
- **Photoshop i headless mode** → UXP-plugin laster ikke. Sørg for at PS har minst ett åpent dokument før Load.
- **`tokio::spawn` i Tauri `setup()`** → panic. Bruk `tauri::async_runtime::spawn`.
- **Parallelle Claude-sesjoner i samme repo** → branch-flippage. Hver sesjon må bo i sin egen `git worktree`. Se `.claude/projects/-Users-danielqazi-Creatorhubn-monorepo/memory/feedback_parallel_sessions_use_worktrees.md`.

## Hva som gjenstår

- **Auto-install UXP-plugin på første start** — krever Adobe-spesifikk infrastruktur (UXP CLI eller Exchange-signing). Utsatt til vi har en distribusjonsstrategi.
- **Wire `PhotoshopAgentDialog`-flowen inn i `CreativeEditorView`'s Claude Co-Editor** — så agent-funksjonen er tilgjengelig fra hovedflowen, ikke bare som standalone-dialog.
- **Batch-runner med watch folder** — fallback for ren batch-prosessering uten UXP (folder-konvensjon + Photoshop Droplet).
