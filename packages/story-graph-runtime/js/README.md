# @creatorhub/story-graph-runtime (JS/TS)

Den delte spillmotoren fra Story Graph (samme kode som Play Mode i The Role Room),
pakket for spill og verktøy i JavaScript/TypeScript. Leser `export.json` fra
Story Graph (Arcweave-kompatibel `project.json`) og spiller historien med full
arcscript-støtte (tolken er den samme som i editoren).

```js
import { createSessionFromArcweave } from '@creatorhub/story-graph-runtime';

const session = createSessionFromArcweave(JSON.parse(projectJson));
let view = session.start();          // { elementId, html, options[], deadEnd, speakerName, ... }
view = session.choose(view.options[0].connectionId);
session.getState();                  // { variables, visits, historyDepth, log }
session.back(); session.restart(); session.setVariable('gold', 99);
```

Nettleser uten bundler: `dist/index.global.js` eksponerer `window.StoryGraphRuntime`.

- `loadArcweaveProject(project)` → `{ graph, warnings }` (runtime-grafen, uten notater/posisjoner)
- `createPlaySession(graph, { rng?, startElementId?, maxJumps? })` — motoren direkte
- `playTranscript(graph, { maxSteps?, pick? })` — deterministisk gjennomspilling som tekst
  (samme format som Unity-/Godot-lasterne; `node examples/transcript.mjs <project.json>`)
- `validateStoryGraph(graph)` — struktur- og skriptmerknader

Bygges fra `frontend/shared/narrative-runtime-pkg` med `npm run build:narrative-runtime-pkg`
(esbuild ESM + IIFE, d.ts via tsc). `dist/` er committet; paritetstesten
`frontend/shared/narrative-runtime/package-parity.test.ts` feiler hvis dist er utdatert.
