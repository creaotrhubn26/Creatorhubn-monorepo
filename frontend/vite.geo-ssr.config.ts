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

import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: './client',
  resolve: {
    alias: {
      // Speiler customPathResolver i hoved-configen for @/-imports
      // (Leadgrid-sidene bruker @/components, @/utils, @/hooks).
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'client/src/assets'),
    },
  },
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
