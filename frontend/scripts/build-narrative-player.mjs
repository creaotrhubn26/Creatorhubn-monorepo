// Bygger Story Graph standalone-spiller (vanilla DOM over delt runtime) til
// client/public/embed/narrative-player.js som IIFE med global `StoryGraphPlayer`.
// Artefakten committes så dev/e2e virker uten byggesteg; `npm run build`
// bygger den på nytt før vite kopierer public/.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(root, 'shared/narrative-player/standalone.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'StoryGraphPlayer',
  minify: true,
  target: 'es2018',
  legalComments: 'none',
  charset: 'utf8',
  outfile: path.join(root, 'client/public/embed/narrative-player.js'),
  banner: { js: '/* Story Graph standalone player — generert av `npm run build:narrative-player` (frontend/shared/narrative-player). Ikke rediger for hånd. */' },
});

console.log('[narrative-player] bygget client/public/embed/narrative-player.js');
