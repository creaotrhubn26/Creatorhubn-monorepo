# Fra AI til fullt redigerbar PSD — designdokument

Hvordan kommer Post Agent fra **"Lag en plakat for Vinterforestillingen"** (naturlig språk) til en **PSD som Irlin kan åpne i Photoshop, endre tittel, bytte bilde, justere fargen** — uten å miste noe?

## Visjon

Det avgjørende prinsippet: **AI leverer aldri et flatet bilde**. Resultatet er alltid en **PSD med separable, navngitte layers** der hvert beslutningspunkt (tittel, bilde, farge, layout) kan endres manuelt etterpå.

Når Irlin sier *"Lag plakat for Vinterforestilling 2026 — moderne, mørk stemning, fokus på solo-dansere"*, skal hun få:

- En PSD-fil i Photoshop
- Med `{{title}}` text-layer hun kan endre uten å re-prompte
- Med `{{hero_image}}` smart-object hun kan bytte ut
- Med justerings-layers for farge-mood hun kan finjustere
- Med separable layers per element så ingen del er hardkodet til andre

Hvis hun ikke liker fonten, endrer hun fonten. Hvis hun vil ha lysere bakgrunn, drar hun et opacity-slider. Hvis hun vil ha en annen tittel-størrelse, drar hun text-handles. **Alt er Photoshop-native, ikke AI-prison.**

## De fire lagene

Flowen krever fire lag som henger sammen:

```
┌──────────────────────────────────────────────────────────────┐
│  LAG 1: Prompt → Spec (Claude som "art director")            │
│    Input:  "Plakat for vinterforestilling, mørk stemning…"   │
│    Output: { dimensions, palette, fonts, layout, image_prompts } │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  LAG 2: Image generation (AI Gateway → Flux/DALL-E/SD)       │
│    Input:  image_prompts fra LAG 1                           │
│    Output: Genererte PNG-filer på disk                       │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  LAG 3: PSD-bygger (UXP plugin)                              │
│    Input:  Spec + image-paths                                │
│    Output: PSD med separable layers, smart-objects, text     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  LAG 4: Iterativt redigeringsverktøy                         │
│    "Endre bare tittel → re-generer bare tittel-layer"        │
│    "Skift mood til lyst → bytt palette + re-generer bilder"  │
└──────────────────────────────────────────────────────────────┘
```

## Hva vi har vs hva som mangler

| Komponent | Status | Hva som finnes |
|---|---|---|
| **Claude proxy (Tauri-side)** | ✅ Komplett | `claude_chat` med tool-support, AI Gateway tilgang |
| **PSD-bygger for text-layers** | ✅ Komplett | `template.scaffold` lager doc + TextLayers |
| **Smart-object FYLL** | ✅ Komplett | `smartObject.replace` bytter ut innhold |
| **Smart-object SCAFFOLDING** | ❌ Mangler | Vi kan fylle eksisterende smart objects, ikke lage nye fra scratch |
| **AI image generation** | ❌ Mangler | Ingen wired integrasjon til image-API |
| **Prompt → Spec-konvertering** | ❌ Mangler | Krever ny system-prompt + JSON-schema for "art director" |
| **End-to-end orkestrering** | ❌ Mangler | Det vi har er enkelt-funksjonaliteter, ikke "én knapp som kjører alt" |
| **Iterativ re-generering** | ❌ Mangler | Trenger state-tracking på hva som ble generert, og diff-basert re-gen |

## Roadmap — 4 phases

### Phase 1: Smart-object scaffolding (M)
**Mål**: UXP-plugin kan lage NYE smart-object-layers fra fil-path, ikke bare bytte eksisterende.

**Hvorfor først**: Uten dette kan AI-genererte bilder ikke embedes som smart objects i en scaffolded PSD. Vi sitter fast med text-only templater.

**Konkret**:
- Ny UXP-kommando `template.scaffold` får støtte for `image_placeholder`-felt med valgfri `file_path`
- batchPlay `placedLayerCreate` med fil-token
- Test: scaffold en PSD med 2 text-layers + 2 smart-object-layers fra disk

**Levering**: Én PR. ~2-3 timer arbeid.

### Phase 2: AI image generation via Vercel AI Gateway (M)
**Mål**: Tauri-command som tar et prompt, genererer bilde via AI Gateway, returnerer fil-path.

**Hvorfor**: Image-generation er hjertet i AI Creative Director. Vi har allerede AI Gateway-tilgang via Role Room-proxy.

**Konkret**:
- Backend route `/api/post-agent/ai/generate-image` som proxer mot AI Gateway med model-strenger som `"black-forest-labs/flux-1.1-pro"` eller `"google/imagen-3"`
- Tauri-command `ai_generate_image(prompt, options)` som kaller backend + lagrer resultat til `~/Library/Application Support/.../generated/<uuid>.png`
- TS-service + dialog for å teste manuelt før vi wirer inn i agent-flow

**Levering**: 2 PRs (backend + frontend). ~3-4 timer.

**Tradeoff**: Flere image-modeller har ulike priser/hastighet/kvalitet. Vi starter med én default (Flux 1.1 Pro for fotorealisme), legger til Imagen 3 / DALL-E som alternativer i settings.

### Phase 3: Prompt → Spec ("Art Director"-rolle) (M)
**Mål**: Claude konverterer fri brukerinput til en strukturert JSON-spec som beskriver hele PSD-en.

**Hvorfor**: Uten dette mellomlaget er det ingen reproducerbarhet og ingen mulighet for iterativ re-gen.

**Konkret**:
- Ny system-prompt + tool-definition `generate_template_spec` med JSON-schema:
  ```ts
  {
    name: string,
    dimensions: { width, height },
    palette: { primary, secondary, accent, background },
    fonts: { heading, body },
    fields: Field[],          // text + image_placeholder + adjustment_layer
    layout_hint: string,      // for vår egen mental modell
    image_prompts: { [key]: string },  // per smart-object hvilken AI-prompt
  }
  ```
- Demo-dialog som tar `"Plakat for X"` → viser spec som JSON → "Kjør generation"-knapp som driver Phase 1+2+3.

**Levering**: 1 PR. ~2-3 timer.

### Phase 4: End-to-end orkestrering + iterativ re-gen (L)
**Mål**: Én knapp som tar et prompt og leverer en PSD. Pluss "Bare endre title"-flow som re-genererer kun deler.

**Hvorfor**: Brukeren skal aldri se de tre underliggende phaseene — bare resultatet.

**Konkret**:
- Ny dialog `PhotoshopCreateDialog` med:
  - Stort prompt-felt
  - Live preview underveis ("Genererer spec…" → "Lager bilder…" → "Bygger PSD…")
  - Sluttilstand: viser thumbnail + "Åpne i Photoshop"-knapp + "Re-generer X"-actions per feltgruppe
- State-store for hver generering (spec, image-paths, output-path) lagret i `~/Library/.../creations/<uuid>.json`
- Re-gen-flow: behold spec, bytt ett felt (f.eks. ny image-prompt), regenerer kun det smart-object'et + re-render PSD

**Levering**: 2-3 PRs. ~6-10 timer.

## Total estimat

| Phase | Estimat | Verdier |
|---|---|---|
| Phase 1 — Smart-object scaffolding | ~3t | Fundament uten det er ingenting redigerbart |
| Phase 2 — AI image generation | ~4t | Selve magien — Irlin får visuelle alternativer |
| Phase 3 — Art Director-rolle | ~3t | Reproducerbarhet + struktur |
| Phase 4 — E2E orkestrering + iterativ | ~8t | Sluttbruker-opplevelsen |
| **TOTAL** | **~18 timer** | Komplett "alt redigerbart e2e" |

Phase 1 og 2 kan parallelliseres (forskjellig kode-areal). Phase 3 må vente på 1+2. Phase 4 må vente på 1+2+3.

## Trade-offs å diskutere

### Image-modell-valg
- **Flux 1.1 Pro** (Black Forest Labs): topp fotorealisme, ~$0.04/bilde
- **Imagen 3** (Google): god typografi-håndtering, ~$0.04/bilde
- **DALL-E 3** (OpenAI): klassisk men dyrere
- **Stable Diffusion 3.5** (open): kjøres lokalt? Krever GPU

Anbefaling: Start med Flux 1.1 Pro via AI Gateway. Bytt senere hvis Irlin ber om noe spesifikt.

### Hvor mye skal AI bestemme?
**Maksimalt AI**: brukeren sier én setning, AI velger ALT (font, layout, fargevalg, bilder).
**Minimalt AI**: brukeren spec'er detaljert, AI genererer bare bildene.

Anbefaling: Start *maksimalt AI* (lavest friksjon for Irlin), men lagre spec'en så brukeren kan tweak'e den manuelt etterpå (font-bytte, palette-justering) UTEN å re-generere bilder.

### Kostnad per generering
Med Flux + Claude Sonnet for spec:
- Spec-generering: ~$0.02 (1 claude-kall)
- 2-3 bilder per template: ~$0.10-0.15
- PSD-bygging: gratis (lokal UXP)
- **Per komplett template: ~$0.12-0.17**

For 10 templater per uke = ~$1.50/uke i AI-kostnader. Trivielt.

### Iterativ re-gen vs full re-gen
Phase 4 er der det blir vanskelig. Hvis Irlin sier *"jeg liker alt unntatt bakgrunnsbilde"*, må vi:
- Beholde spec + alle andre genererte bilder
- Re-generere kun det ene bildet med samme prompt + variations-flag
- Re-render PSD med ny bilde, samme alt annet

Krever state-tracking. Phase 4 spesifiserer dette.

## Hva jeg foreslår nå

Hvis du vil ha noe levert raskt: **Phase 1 (smart-object scaffolding)** er strengt tatt en blocker for Irlin's nåværende workflow også — hun kan ikke bruke `scaffoldTemplate` til å lage templater med bilde-felter ennå. Den fikser et hull selv om vi ikke gjør Phase 2-4 før om noen uker.

Hvis du har energi/tid: **Phase 1 + Phase 2 i parallell**. Da har vi det grunnleggende "AI lager bilde → bilde havner i PSD"-loopen på plass innen et par timer.

Phase 3+4 er det jeg ville utsatt til Irlin har testet Phase 1+2-resultatet og fortalt hva som mangler.
