// Skriver den deterministiske gjennomspillingen av et Story Graph-/Arcweave-project.json.
//   node examples/transcript.mjs ../fixtures/sample-project.json
// Samme format som C#-/GDScript-lasterne — diff mot fixtures/sample-project.expected.txt.
import { readFileSync } from 'node:fs';
import { loadArcweaveProject, playTranscript } from '../dist/index.js';

const file = process.argv[2] ?? new URL('../../fixtures/sample-project.json', import.meta.url);
const project = JSON.parse(readFileSync(file, 'utf8'));
const { graph, warnings } = loadArcweaveProject(project);
for (const w of warnings) console.error(`warning: ${w}`);
process.stdout.write(playTranscript(graph));
