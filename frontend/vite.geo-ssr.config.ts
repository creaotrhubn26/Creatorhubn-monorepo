/**
 * vite.geo-ssr.config.ts
 *
 * Egen, minimal config for SSR-bygget av geo-prerender-entryen
 * (GEO-prerendering av pillar-sidene på theroleroom.com). Holdes adskilt
 * fra hoved-vite.config.ts fordi den har multi-page rollup-input og
 * browser-polyfills som ikke gjelder et node-bygg.
 *
 * Kjøres av `npm run build` etter klient-bygget:
 *   vite build --config vite.geo-ssr.config.ts
 *   node scripts/run-geo-prerender.mjs
 */

import { defineConfig } from 'vite';

export default defineConfig({
  root: './client',
  build: {
    ssr: 'src/prerender/geo-prerender-entry.tsx',
    outDir: 'dist-geo',
    emptyOutDir: true,
    target: 'node20',
    sourcemap: false,
  },
  ssr: {
    // Bundle MUI + emotion inn i entryen så node-runtime slipper å
    // resolve ESM/CJS-variantene deres — react/react-dom forblir eksterne.
    noExternal: [/^@mui\//, /^@emotion\//],
  },
});
