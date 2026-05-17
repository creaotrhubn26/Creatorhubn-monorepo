# CLAP-SFX-bibliotek — bygging og deployment

Dette dokumentet forklarer hvordan du bygger og oppdaterer
CLAP-embedded sample-biblioteket som driver auto-SFX-foreslagene i
Animatic-spilleren (`/api/sfx/match`).

## Oversikt

Systemet har tre artefakter:

```
data/sfx-manifest.json      ← du redigerer (sample-URL-er + metadata)
        ↓ [build-sfx-library.ts]
data/sfx-library.json       ← genereres (inneholder CLAP-embeddings)
        ↓ [/api/sfx/match]
runtime-treff               ← bruker får forslag i UI
```

**Manifestet** er en kuratert liste over lyd-samples du vil ha
tilgjengelig som forslag. Hver entry har en URL (HTTP eller fil),
en kategori-ID som matcher `sfxCategories.ts`, og lisens-info.

**Biblioteket** er manifestet pluss en 512-dim CLAP-embedding per
sample. Det er denne fila backend leser inn ved oppstart.

## Forutsetninger

- `@xenova/transformers` ≥ 2.17 (allerede installert i `backend/`)
- Internett ved første kjøring (modellen lastes ned, ~150 MB,
  cache'es i `~/.cache/huggingface/`)
- For audio-dekoding fungerer WAV best out-of-the-box. For
  MP3/OGG/etc. trenger `read_audio()` `ffmpeg` på `PATH`.

## Trinn 1: Skaff samples

**Lovlige kilder for kommersielt bruk (verifisert mai 2026):**

| Kilde | Lisens | Notater |
|-------|--------|---------|
| [Freesound (CC0-filter)](https://freesound.org/browse/tags/CC0/) | CC0 | ~70k+ CC0-sounds, gratis API. **Anbefalt.** |
| [Pixabay Sound](https://pixabay.com/sound-effects/) | Pixabay License | Funksjonelt CC0, ingen attribusjon |
| [BigSoundBank](https://bigsoundbank.com/) | Royalty-free | 3 500+ WAV/MP3/OGG |
| [OpenGameArt.org (CC0)](https://opengameart.org/) | CC0 | Game-fokusert |

**❌ IKKE trygt for kommersielt bruk uten betaling:**
- [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/) (RemArc) — **kun personlig/utdanning**. Kommersielt = $5-1995 via Pro Sound Effects.
- ZapSplat free tier — krever attribusjon + samples kan ikke være primær verdi (TOS-konflikt med en SFX-library-feature).
- Splice, EpidemicSound (krever abonnement).
- YouTube-rips, "free sound packs" uten klar lisens.

## Automatisk kuratering fra Freesound

Det enkleste er å la et script laste ned ekte CC0-samples fra Freesound:

```bash
# 1. Få gratis API-nøkkel: https://freesound.org/apiv2/apply/
export FREESOUND_API_KEY=din-nøkkel-her

# 2. Kjør curation-scriptet (default 2 samples per kategori = ~70 totalt)
cd backend
npm run sfx:curate-freesound

# Eller flere per kategori (max 5):
npm run sfx:curate-freesound -- --per-category 3
```

Scriptet:
- Søker Freesound API per kategori med streng `license:"Creative Commons 0"`-filter
- **Dobbeltsjekker** lisens-URL på hver sample (URL-parser sjekker hostname = creativecommons.org og path = /publicdomain/zero/1.0)
- Avviser look-alike-domener og non-CC0
- Laster ned mp3-preview, konverterer til 48kHz mono WAV via ffmpeg
- Skriver inn i `data/sfx-manifest.json` (legger til, dupliserer ikke)

Krav: `ffmpeg` på PATH + Freesound API-nøkkel.

Etter kjøring, kjør `npm run sfx:build` for å embeddte de nye samplene via CLAP.

## Trinn 2: Last opp samples til CDN

Backend må kunne hente lydene ved bygge-tid. To opsjoner:

1. **Statisk-server fra Express** — legg WAV-filene i
   `backend/public/sfx/` og pek manifestet til `/sfx/...`. Krever
   at backend serverer den mappa (de fleste oppsett gjør det).

2. **Eksterne CDN/S3** — last opp og pek på direkte-URL-er.
   Sikrer at filene har CORS-headere hvis frontend skal preview'e
   dem direkte.

Du finner et eksempel-manifest i `sfx-manifest.example.json` —
kopier det til `sfx-manifest.json` og redigér.

## Trinn 3: Kjør embedding-pipelinen

```bash
cd backend
npx tsx scripts/build-sfx-library.ts \
  --manifest data/sfx-manifest.json \
  --output data/sfx-library.json
```

Output:
- Første kjøring: ~30 sekunder for modell-nedlasting + initialisering
- Per sample: ~1-3 sekunder (audio-decode + CLAP-forward-pass)
- Fila skrives atomisk via `.tmp` + `rename` — trygt å kjøre mens
  serveren er oppe

## Trinn 4: Reload på server

Etter ny `sfx-library.json`:

```bash
curl -X POST http://localhost:3000/api/sfx/library/reload
```

Eller restart serveren. Library-cache er per-prosess.

## Verifiser

```bash
curl http://localhost:3000/api/sfx/library/stats
# { sampleCount: 42, embeddingModel: "Xenova/clap-htsat-unfused", ... }

curl -X POST http://localhost:3000/api/sfx/match \
  -H "Content-Type: application/json" \
  -d '{"prompt":"door slam","topK":3}'
```

## Tips

- **Start lite**: 30-50 samples gir allerede meningsfulle resultater
  for de mest brukte kategoriene. Utvid etter behov.
- **Bredde over dybde**: én bra sample per kategori er bedre enn 10
  varianter av samme dør-smell. CLAP er god til generalisering.
- **Inkluder ambient**: CLAP forstår "rain" og "wind" godt. Ambient-
  lag i SFX-systemet (`layer: 'ambient'`) drar mye nytte av dette.
- **Test-prompt for hver kategori**: kjør match-endepunktet for
  hver `category.id` etter bygging og sjekk at top-1 faktisk er
  riktig. Hvis ikke, legg til mer signal-rik sample.

## Hvis modellen ikke laster

@xenova/transformers laster modellen fra Hugging Face Hub på
første kjøring. Hvis det henger:

- Sjekk internett-tilkobling
- Sjekk `~/.cache/huggingface/` — om delvis nedlasting, slett og
  prøv igjen
- Sett `HF_HUB_OFFLINE=1` for å tvinge bruk av cache (om allerede
  nedlastet)
- Sjekk firewall hvis bak proxy
