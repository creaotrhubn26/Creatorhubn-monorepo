# Photoshop-templates-kokebok

Slik lager du PSD-er som Post Agent kan fylle automatisk. Konvensjonen er enkel: gi de layers du vil ha utfylt et **navn på formen `{{key}}`** i Photoshop's Layers-panel.

## Grunnregler

- Konvensjon: `{{key}}` — to krøllparenteser rundt en kort identifikator
- Bruk små bokstaver + understrek: `{{title}}`, `{{poster_url}}`, `{{event_date}}`
- ÉN-til-én: ett `{{key}}`-layer per felt. Hvis du har samme navn på to layers, fylles bare den første.
- Bare to layer-typer støttes:
  - **Text-layers** → blir tekst-felter (string)
  - **Smart objects** → blir fil-felter (bilde du peker på)
- Andre layer-typer (vanlige raster-layers, fill-layers, justerings-layers) med `{{key}}`-navn ignoreres med en advarsel.

## Tre eksempler

### 1. Instagram-post-template (1080×1080)

```
Layers-panel (top-til-bunn):
  {{title}}            ← Text-layer (stor heading)
  {{subtitle}}         ← Text-layer (mindre under)
  {{date}}             ← Text-layer (hjørne)
  {{logo}}             ← Smart object (firma-logo)
  {{background}}       ← Smart object (BG-bilde)
  Decorative shape     ← Vanlig layer, ignoreres
```

Bruk i Post Agent → Photoshop Templates → fyll skjemaet → eksporter PNG/JPG.

### 2. Casting-call-poster (1080×1920, 9:16)

```
Layers-panel:
  {{role_name}}        ← Text-layer (rolle-navn øverst)
  {{production_title}} ← Text-layer
  {{audition_date}}    ← Text-layer
  {{character_photo}}  ← Smart object (character-bilde)
  Branded frame        ← Vanlig layer, ignoreres
  {{brand_logo}}       ← Smart object (Role Room-logo)
```

### 3. Wedding-album-cover (3000×3000)

```
Layers-panel:
  {{couple_names}}     ← Text-layer (Mary & John)
  {{wedding_date}}     ← Text-layer
  {{main_photo}}       ← Smart object (hovedbilde)
  {{secondary_photo}}  ← Smart object (sekundærbilde)
  {{venue_name}}       ← Text-layer
  Cursive ornament     ← Vanlig layer, ignoreres
```

## Slik gjør du smart-object av et bilde

1. Åpne PSD-en i Photoshop
2. Lag en ny layer hvor smart-object skal være
3. **File → Place Embedded…** → velg en plassholder-bilde (en hvilken som helst .jpg/.png)
4. Bildet blir lagt inn som smart object (du ser en liten ikon-merking på layeren)
5. Dobbeltklikk navnet i Layers-panelet → gi det navn `{{key}}`

Når Post Agent kjører `template.render`, blir innholdet i denne smart-object byttet ut med fila du peker på i skjemaet. Originalen i templatet er urørt — Post Agent åpner kopien, fyller, eksporterer, lukker uten å lagre.

## Slik gjør du text-layer dynamisk

1. **T**-verktøyet → klikk et sted i kanvas
2. Skriv en plassholder-tekst (samme tekst-stil du vil ha senere)
3. Dobbeltklikk navnet i Layers-panelet → gi det `{{key}}`

Når Post Agent fyller feltet, beholder den tekststil (skrifttype, farge, størrelse). Du designer én gang, fyller mange ganger.

## Tips

- **Test skanning først**: før du bruker `Photoshop Agent`, åpne `Photoshop Templates…` og pek på PSD-en. Skannings-resultatet viser nøyaktig hvilke felter Post Agent ser. Hvis et felt ikke vises, sjekk at layer-navnet matcher `{{key}}`-mønsteret (krøllparenteser + ingen mellomrom rundt key).
- **Bevar templatet read-only**: lagre PSD-en i en mappe du ikke jobber daglig i. Post Agent åpner og lukker uten å lagre, men hvis du redigerer templatet manuelt mens Post Agent kjører, kan du ende opp med å overskrive arbeidet ditt.
- **Naming-konvensjon**: bruk samme `{{key}}`-navn på tvers av templater når mulig. Hvis alle dine templater bruker `{{title}}`, `{{date}}`, `{{logo}}`, kan du bygge gjenbrukbare data-objekter i Photoshop Agent-prompts.

## Fall-back: ikke alle templater må navngis

Hvis du bare vil bruke Post Agent for å åpne/eksportere uten utfylling, trenger du ikke `{{key}}`-konvensjonen. Bruk **Photoshop Bridge…** for å:
- Åpne PSD i Photoshop fra Post Agent
- Eksportere det aktive dokumentet til JPG/PNG/PSD/TIFF
- Lagre over original

Det er én-til-én med menyene i Photoshop. Templater er bare for å automatisere repetitivt arbeid.
