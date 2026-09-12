# Mockup Video — POC

Pakk en video (f.eks. en Post Agent screen recording) inn i en device-mockup
som auto-justerer seg, og eksporter resultatet som ny video. Pluss et
Playwright-script som lager en video av en hvilken som helst nettside.

**Null nye avhengigheter** — alt bygger på nettleser-native API-er
(Canvas 2D + `MediaRecorder` + `captureStream`) og Playwright/tsx som allerede
ligger i repoet.

## Filer

| Fil | Ansvar |
|---|---|
| `fitRect.ts` | Ren `object-fit: cover/contain`-matematikk — kjernen i "auto-justering". |
| `deviceGeometry.ts` | Maskin-lesbar skjerm-geometri per enhet (utledet fra `DeviceMockup.tsx`). |
| `renderMockupFrame.ts` | Tegner én komposittert frame på canvas (bakgrunn → ramme → video → notch/island). |
| `useMockupVideoExporter.ts` | React-hook: kilde-video → mockup → ny video via MediaRecorder. |
| `MockupVideoStudio.tsx` | Demo-UI: velg video + enhet + fyll/bakgrunn, live-preview, eksporter. |
| `../../../../../scripts/url-to-video.ts` | "Lag en video av denne nettsiden" via Playwright. |

## Bruk — video i mockup (i appen)

```tsx
import { MockupVideoStudio } from '.../post-agent/mockup-video';
// monter <MockupVideoStudio /> i en Post Agent-tab.
```

Eller programmatisk:

```ts
const exporter = useMockupVideoExporter();
exporter.start(videoEl, { variant: 'iphone', fit: 'cover',
  background: { kind: 'gradient', from: '#312e81', to: '#0b1120' }, pixelRatio: 5 });
// → exporter.lastBlob når ferdig; exporter.downloadLastBlob()
```

## Bruk — nettside → video

```bash
node_modules/.bin/tsx scripts/url-to-video.ts https://theroleroom.no \
  --device iphone --seconds 10 --out theroleroom-iphone.webm
# (engang: node_modules/.bin/playwright install chromium)
```

Begge funksjonene deler samme rør: nettside→video gir en rå opptak, som
mockup-compositoren pakker inn — uavhengig av om kilden er Playwright, en
`getDisplayMedia`-opptak eller en Resolve-clip.

## Verifisert

- `fitRect` + `deviceGeometry`: 24/24 assertions grønt (logikk).
- tsc: 0 feil i denne modulen (kjørt mot `frontend/tsconfig.json`).
- `url-to-video.ts`: typechecker rent standalone.

## Ikke kjørt ende-til-ende ennå

- Selve MediaRecorder-eksporten (krever ekte nettleser + en video-fil).
- Playwright-opptaket mot en live URL (krever `playwright install chromium`).
- Vitest-filene i `__tests__/` (repoets vitest-config er scope'et til
  story-arc-studio; logikken er i stedet verifisert via tsx). Utvid
  `vitest.config.ts`-globben for å kjøre dem i CI.
```
