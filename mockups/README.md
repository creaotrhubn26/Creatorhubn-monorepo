# Design Mockups — The Role Room

Full-page screenshots av prod-grensesnittet med MOCK-watermark.
PNG-filer er **gitignored** (regenererbare).

## Regenerere

```bash
node scripts/capture-design-mockups.mjs
```

Krever Playwright + Chromium installert. Skriptet besøker 12 sider
× 2 viewports (desktop 1440×900 + mobile 390×844) = 24 screenshots.

## Per side

Default mot prod (`https://theroleroom.com`):

| Slug | URL | Beskrivelse |
|---|---|---|
| `home` | `/` | Forside |
| `talentportal` | `/talentportal` | Talentportal-landing |
| `for-studenter` | `/for-studenter` | Student-SEO-side |
| `film-tv-utdanning` | `/film-tv-utdanning` | Film+TV-studie-landing |
| `innholdsprodusenter` | `/innholdsprodusenter` | Content creator-side |
| `alternatives` | `/alternatives` | Konkurrent-indeks |
| `vs-studiobinder` | `/vs-studiobinder` | vs StudioBinder |
| `vs-castingnetworks` | `/vs-castingnetworks` | vs Casting Networks |
| `presse` | `/presse` | Pressepakke |
| `utdanningsinstitusjon` | `/utdanningsinstitusjon` | Utdanningsinstitusjon-landing |
| `en-home` | `/en` | Multi-lang Home |
| `en-for-studenter` | `/en/for-studenter` | Multi-lang student-page |

## Custom URL

```bash
node scripts/capture-design-mockups.mjs --url https://theroleroom.com/dansestudio
```

## Headful (for debug)

```bash
node scripts/capture-design-mockups.mjs --headful
```

## Mot lokal dev

```bash
MOCKUP_BASE_URL=http://localhost:5001 node scripts/capture-design-mockups.mjs
```

## Watermark-strategi

Hver screenshot får tre overlays slik at det er tydelig at det er
mockup, ikke produksjonsklart materiale:
- Diagonale røde stripes (lav opacity, 28° rotasjon)
- Stor diagonal "MOCK · DESIGN PREVIEW"-tekst i bakgrunnen
- Rød corner-badge øverst til høyre

Injiseres som CSS via `page.addStyleTag()` etter `networkidle`-load,
før screenshot tas.
