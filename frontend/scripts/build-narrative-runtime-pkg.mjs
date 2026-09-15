// Bygger @creatorhub/story-graph-runtime (packages/story-graph-runtime/js) fra den
// delte motoren: ESM + IIFE (global `StoryGraphRuntime`) med esbuild, d.ts via tsc,
// og eksempel-fixture (Arcweave project.json + forventet gjennomspilling) som
// C#-/GDScript-lasterne sjekkes mot (CHECKLIST.md). Artefaktene committes.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = path.resolve(root, '../packages/story-graph-runtime');
const entry = path.join(root, 'shared/narrative-runtime-pkg/index.ts');
const dist = path.join(pkg, 'js/dist');
mkdirSync(dist, { recursive: true });

const banner = { js: '/* @creatorhub/story-graph-runtime — generert av `npm run build:narrative-runtime-pkg` (frontend/shared/narrative-runtime-pkg). Ikke rediger for hånd. */' };
const common = { entryPoints: [entry], bundle: true, target: 'es2018', charset: 'utf8', legalComments: 'none', banner };
await build({ ...common, format: 'esm', outfile: path.join(dist, 'index.js') });
await build({ ...common, format: 'iife', globalName: 'StoryGraphRuntime', minify: true, outfile: path.join(dist, 'index.global.js') });

rmSync(path.join(dist, 'types'), { recursive: true, force: true });
execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['-p', path.join(root, 'scripts/tsconfig.narrative-runtime-pkg.json')], { stdio: 'inherit' });

// Fixture + forventet transkript fra den ferdige ESM-bundelen (samme kode som pakken).
const mod = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const project = mod.sampleArcweaveProject();
mkdirSync(path.join(pkg, 'fixtures'), { recursive: true });
writeFileSync(path.join(pkg, 'fixtures/sample-project.json'), `${JSON.stringify(project, null, 2)}\n`);
const transcript = mod.playTranscript(mod.loadArcweaveProject(project).graph);
writeFileSync(path.join(pkg, 'fixtures/sample-project.expected.txt'), transcript);

console.log('[narrative-runtime-pkg] bygget js/dist (esm, iife, types) + fixtures/sample-project.{json,expected.txt}');
