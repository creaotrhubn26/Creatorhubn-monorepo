# Marketing screenshots

Genererer rene PNG-er av theroleroom.com- og creatorhubn.com-sidene til
blog-covers, OG-bilder, pitch deck-slides, presse-kit og lignende.

## Hva er "airbrushing"?

Før screenshot injiseres en CSS som:
- Skjuler cookie-popups (Cookiebot, Klaro, generelle)
- Skjuler dev/admin-pills (`[data-dev-pill]`, `.debug-overlay`, etc.)
- Skjuler beta/preview-merker (overstyr m/ `--keep-beta`)
- Pauser alle animasjoner så vi ikke fanger mid-state
- Skjuler scrollbars
- Tvinger lazy-loaded bilder til synlig

## Kjøre

```bash
# Default: theroleroom.com, alle viewports (mobile + tablet + desktop), alle ruter
npm run marketing:screenshots

# Local dev-server
npm run marketing:screenshots:local

# Custom base + ruter
node scripts/marketing-screenshots.playwright.mjs \
  --base https://creatorhubn.com \
  --routes /,/blog,/academy

# Bare desktop, behold beta-merker
node scripts/marketing-screenshots.playwright.mjs \
  --viewport desktop \
  --keep-beta
```

## Output

`client/public/marketing-screenshots/{route}-{viewport}.png`

Eksempel:
- `home-desktop.png` — 1440×900 forsidebilde for OG
- `home-mobile.png` — 390×844 fullpage for app-store-screenshots
- `pitch-desktop.png` — pitch-deck-side til investorer
- `for-byraer-tablet.png` — sales-deck til byrå-møter

## Tips

- For PNG → WebP/AVIF: `cwebp -q 85 input.png -o output.webp` (manuelt etterpå)
- For tilpassede rute-stier: pass `--routes /custom,/another`
- For å se nettleseren under kjøring (debug): endre `headless: true` til `false` i scriptet

## Viewports

| Navn    | Bredde × Høyde | Devicepixelratio | Bruk |
|---------|----------------|------------------|------|
| mobile  | 390 × 844      | 2x               | iPhone 14, app-store, IG Story |
| tablet  | 1024 × 1366    | 2x               | iPad Pro, sales-deck |
| desktop | 1440 × 900     | 2x               | MacBook Pro 14", OG-images, blog |

## Tilpassing av ruter

Default-ruter i scriptet:
- `/` (home)
- `/for-byraer`
- `/faq`
- `/pitch`
- `/talent-registry`

Endre `DEFAULT_ROUTES` i scriptet, eller bruk `--routes`-flagget.
