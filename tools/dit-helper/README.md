# @theroleroom/dit-helper

Native CLI for DIT-backup-tracking på The Role Room-produksjoner.

> **Bruker du foto/video for vendor-oppdrag (ikke film-DIT)?** Vurder
> [Creatorhub One Desk](../../apps/creatorhub-one-desk/) i stedet — samme
> backend-flow, men med GUI for å pare iPad CaptureApp, velge destinasjoner
> visuelt, og se progress-bars i sanntid. CLI-en her er fortsatt rett verktøy
> for headless film-DIT-stations (cinema-formater, scriptbar pipeline).

## Hva den gjør

1. **Watcher kamera-kort-mounts** (eller andre konfigurerte stier)
2. **Detecterer nye media-filer** (.mxf, .braw, .ari, .r3d, .mov, .mp4, .wav)
3. **Kopierer parallelt** til alle konfigurerte destinasjoner (RAID, offsite, archive)
4. **Verifiserer med xxHash64** (industri-standard via Pomfort)
5. **Rapporterer status real-time** til The Role Room backend → vises i LiveSetMode

## Installasjon

```bash
npm install -g @theroleroom/dit-helper
```

Eller kjør direkte uten install:

```bash
npx @theroleroom/dit-helper init
```

## Bruksflyt

### Steg 1: Hent helper-token fra LiveSetMode

1. Åpne The Role Room → ditt prosjekt → LiveSetMode
2. Gå til **DIT-tab → Helper Tokens**
3. Klikk **"Generér nytt token for denne DIT-station"**
4. Tokenet vises EN gang — kopiér umiddelbart

### Steg 2: Konfigurer CLI

```bash
dit-helper init
```

Du blir spurt om:
- Backend URL (default: produksjon)
- Project ID (kopier fra Role Room-URL)
- Helper token (fra Steg 1)
- Watch-stier (default: `/Volumes` på macOS)
- Fil-mønstre (default: vanlige cinema-formater)

### Steg 3: Test forbindelsen

```bash
dit-helper test
```

Skal liste alle konfigurerte destinasjoner for prosjektet.

### Steg 4: Start watcher

```bash
dit-helper watch
```

Nå:
- Mount et kamera-kort
- Helper detekterer nye filer
- Hver fil kopieres + verifiseres parallelt til alle destinasjoner
- Status synlig i LiveSetMode TakeRow-pips (grønn ved verifisert)

## Architecture

```
┌────────────────────┐
│  Camera card       │  ← USB/Thunderbolt mount
│  /Volumes/A001/    │
└─────────┬──────────┘
          │ fs.watch
          ▼
┌────────────────────┐
│  dit-helper CLI    │  ← Detection + xxHash64 + copy
│  (runs on Mac)     │
└─────────┬──────────┘
          │ POST /api/dit/jobs (Bearer token)
          ▼
┌────────────────────┐
│  Role Room backend │  ← dit_backup_jobs + events
│  (Render)          │
└─────────┬──────────┘
          │ GET /api/dit/take-status
          ▼
┌────────────────────┐
│  LiveSetMode UI    │  ← TakeRow viser pips per destinasjon
└────────────────────┘
```

## Hash-algoritme: xxHash64

Industri-standard for film-backup (brukt av Pomfort Silverstack, ShotPut Pro).
~10x raskere enn MD5 og kollisjonsfri for vårt bruks-volum.
Fallback til SHA-256 hvis xxhash-wasm ikke kan lastes.

## Security

- Tokens lagres med 0600-permissions i `~/.dit-helper/config.json`
- Tokens hashes med SHA-256 før lagring i backend (klartekst kun i config-fil + ved første visning)
- Tokens utløper etter 90 dager (kan tilbakekalles når som helst fra LiveSetMode)
- Helper er **read-only fra DIT-station-perspektiv** — den kopierer FRA kort TIL destinasjon. Aldri sletting eller modifikasjon av kilde.
- Audit-spor: hver jobs-status-endring logges i `dit_backup_events`-tabellen

## Compliance

- **Filmmaterialet lagres aldri lokalt** utenfor de konfigurerte destinasjonene
- All metadata sendes til vår egen backend (dataene eies av prosjektet)
- Sjekksum-verifisering hindrer korrupt-data-deploy

## Endringslogg

### 0.1.1 (2026-05-30)
- Bytt fra `GET /api/dit/projects/:id/destinations` (admin-gated) til
  `GET /api/dit/projects/:id/info` (helper-token-gated). Den gamle URL-en
  ga 401/403 fordi tokenet ikke har admin-rolle. Fix er backward-kompatibel
  — samme destinasjons-data, helper-token virker nå
- `dit-helper test` viser også prosjekt-navn nå (i tillegg til
  destinasjons-liste)

### 0.1.0 (2026-05-22)
- Første release: init, test, watch, status

## Publisering

Daniels valg — ikke gjort automatisk. For å pushe ny versjon til npm:

```bash
cd tools/dit-helper
npm publish --access public
```

Krever at du er logget inn på npm under en konto som har skrive-tilgang
til `@theroleroom/dit-helper`-pakken.

## Lisens

MIT
