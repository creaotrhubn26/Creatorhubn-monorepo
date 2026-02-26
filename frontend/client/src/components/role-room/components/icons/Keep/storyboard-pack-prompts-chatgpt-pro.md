# Storyboard Pack Prompts (ChatGPT Pro)

Use these directly in ChatGPT (Images).  
Target: `1536x1024`, cinematic, no logos, no text overlays, no watermark.

## Global style lock (paste once first)

```text
Create storyboard concept frames for a professional film previsualization tool UI.
Output one image per request.
Hard constraints:
- Landscape 1536x1024
- Cinematic grayscale or muted film palette
- High detail line/paint hybrid suitable for storyboard production
- Strong composition with foreground/midground/background depth
- No text, no logos, no watermark, no UI chrome
- Keep visual continuity across all outputs: same world tone, realistic lighting behavior, production-ready framing
```

## File naming map

Save each output with these exact names:

```text
noir-pack-01.png
noir-pack-02.png
noir-pack-03.png
noir-pack-04.png
commercial-pack-01.png
commercial-pack-02.png
commercial-pack-03.png
commercial-pack-04.png
action-pack-01.png
action-pack-02.png
action-pack-03.png
action-pack-04.png
drama-pack-01.png
drama-pack-02.png
drama-pack-03.png
drama-pack-04.png
```

## Noir Lighting Pack (4)

### `noir-pack-01.png`
```text
Noir lighting pack frame: rainy midnight alley, lone detective in trench coat, hard key light from upper-right, deep crushed shadows, wet asphalt reflections, 50mm lens feel, f/1.8 depth separation, high-contrast chiaroscuro, gritty charcoal grain.
```

### `noir-pack-02.png`
```text
Noir lighting pack frame: interior interrogation room, subject half-lit from side practical lamp, smoke haze, venetian-blind shadow bands across wall and face, 85mm lens compression look, dramatic black levels, stark tonal separation, cinematic storyboard ink+wash style.
```

### `noir-pack-03.png`
```text
Noir lighting pack frame: rooftop confrontation at night, backlight rim from city glow, strong negative fill, foreground pistol silhouette, distant skyline bokeh, low-angle composition, heavy shadow massing, contrast-rich monochrome storyboard render.
```

### `noir-pack-04.png`
```text
Noir lighting pack frame: abandoned corridor chase moment, hard overhead practicals creating pools of light and darkness, motion implied in pose, long perspective lines, 35mm lens cinematic framing, textured graphite + ink shadows.
```

## Commercial High-Key Pack (4)

### `commercial-pack-01.png`
```text
Commercial high-key pack frame: bright modern loft interior, clean soft daylight wrap, smiling subject in center-third composition, minimal shadows, gentle contrast, 35mm lens feel, airy premium ad aesthetic, polished storyboard paint style.
```

### `commercial-pack-02.png`
```text
Commercial high-key pack frame: product hero setup on sleek tabletop, soft box lighting from both sides, subtle reflection, high exposure midtones, no crushed blacks, elegant composition for brand commercial previsualization.
```

### `commercial-pack-03.png`
```text
Commercial high-key pack frame: lifestyle kitchen scene, subject reaching for product, warm-neutral white balance, soft edge transitions, background softly out of focus, clean and optimistic tone, smooth airbrush-like storyboard rendering.
```

### `commercial-pack-04.png`
```text
Commercial high-key pack frame: outdoor city morning walk, broad soft daylight, bright wardrobe values, controlled highlights, minimal shadow density, wide framing with generous negative space for campaign-style composition.
```

## Action Crosshatch Pack (4)

### `action-pack-01.png`
```text
Action crosshatch pack frame: close-up hero aiming weapon while running through debris-filled street, dynamic dutch angle, dense diagonal crosshatching in shadows, impact streaks, aggressive line energy, gritty black-and-white storyboard style.
```

### `action-pack-02.png`
```text
Action crosshatch pack frame: hand-to-hand fight in narrow corridor, strong perspective push, speed lines and directional hatch texture, fractured light shafts, high kinetic tension, rough ink rendering with layered hatch density.
```

### `action-pack-03.png`
```text
Action crosshatch pack frame: vehicle pursuit through industrial zone, low tracking angle, smoke and sparks, motion blur implied through hatch direction changes, high-contrast value blocks, intense cinematic composition.
```

### `action-pack-04.png`
```text
Action crosshatch pack frame: explosion aftermath with protagonist emerging, backlit dust cloud, debris silhouettes, thick ink strokes + sharp crosshatch shadows, dramatic center framing with forward motion cue.
```

## Soft Drama Wash Pack (4)

### `drama-pack-01.png`
```text
Soft drama wash pack frame: intimate two-character conversation in quiet apartment at dusk, soft window light, gentle falloff, low-flow watercolor wash texture, warm midtone bias, 85mm shallow depth feel, emotional stillness.
```

### `drama-pack-02.png`
```text
Soft drama wash pack frame: character alone on bus at night, reflective mood, cool ambient with warm practical highlights, smooth tonal transitions, subtle grain, understated cinematic composition focused on emotion.
```

### `drama-pack-03.png`
```text
Soft drama wash pack frame: park bench reunion at golden hour, diffused backlight, soft edges, layered atmospheric depth, restrained contrast, painterly storyboard wash style, intimate framing.
```

### `drama-pack-04.png`
```text
Soft drama wash pack frame: bedroom morning aftermath scene, soft natural side light, muted palette, delicate shadows, calm contemplative tone, gradual watercolor buildup, cinematic human-centered composition.
```

## Quick import note

After generating, place files in:

`frontend/client/src/components/role-room/components/icons/Keep/`

If you want, I can next wire these exact filenames into `FrameDrawingEditor` pack preview slots so the left panel uses real images instead of placeholders.
