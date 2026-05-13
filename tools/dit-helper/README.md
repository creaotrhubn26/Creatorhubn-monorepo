# @theroleroom/dit-helper

Native CLI for DIT-backup-tracking på The Role Room-produksjoner.

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

## Lisens

MIT
