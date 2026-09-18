// Spilltest-telemetri (Story Graph Fase 8e): koble motorens onEvent til inntaket.
// Kjør: STORYGRAPH_URL=https://<backend> STORYGRAPH_PLAYTEST_TOKEN=sgp_… node playtest-telemetry.mjs
import { createSessionFromArcweave, loadArcweaveProject, sampleArcweaveProject } from '../dist/index.js';

const url = `${process.env.STORYGRAPH_URL ?? 'http://localhost:3003'}/api/role-room/narrative/playtest/events`;
const token = process.env.STORYGRAPH_PLAYTEST_TOKEN ?? '';
const sessionId = crypto.randomUUID(); // tilfeldig per økt — aldri bruker-id
const queue = [];
const sceneCodeFor = (graph, elementId) => graph.elements.find((e) => e.id === elementId)?.customId ?? elementId;

async function flush() {
  if (queue.length === 0 || !token) return;
  const events = queue.splice(0, 500);
  // Alltid 204 — feil skal aldri stoppe spillet.
  await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ events }) }).catch(() => undefined);
}

const project = sampleArcweaveProject();
const { graph } = loadArcweaveProject(project);
const started = Date.now();
const session = createSessionFromArcweave(project, {
  onEvent: (ev) => {
    const sceneCode = sceneCodeFor(graph, ev.elementId);
    if (ev.kind === 'enter') queue.push({ sessionId, sceneCode, event: 'enter', build: 'example' });
    if (ev.kind === 'choose') queue.push({ sessionId, sceneCode, event: 'choice', connectionId: ev.connectionId, tMs: Date.now() - started });
    if (queue.length >= 50) void flush();
  },
});
let view = session.start();
for (let i = 0; i < 5 && view && view.options.length; i += 1) view = session.choose(view.options[0].connectionId);
await flush();
console.log(token ? `sendte hendelser for økt ${sessionId}` : `${queue.length} hendelser i kø for økt ${sessionId} — sett STORYGRAPH_PLAYTEST_TOKEN for å sende`);
