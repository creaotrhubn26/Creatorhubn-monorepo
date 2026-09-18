/**
 * Perf-vakt (Fase 8a): validering og spillstart på en stor graf skal holde seg
 * langt under det som merkes i UI. Budsjettet er romslig (CI-runnere varierer),
 * poenget er å fange kvadratisk oppførsel, ikke millisekunder.
 */
import { describe, expect, it } from 'vitest';

import { createPlaySession } from './engine';
import { validateStoryGraph } from './validate';
import type { RuntimeConnection, RuntimeElement, RuntimeGraph } from './types';

const ELEMENTS = 2000;
const BUDGET_MS = 1500;
const code = (s: string) => `<pre><code>${s}</code></pre>`;

function bigGraph(): RuntimeGraph {
  const elements: RuntimeElement[] = [];
  const connections: RuntimeConnection[] = [];
  const boards = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, name: `Akt ${i + 1}`, customId: null }));
  for (let i = 0; i < ELEMENTS; i++) {
    const id = `e${i}`;
    const isBranch = i % 10 === 5;
    elements.push({
      id, boardId: `b${i % 10}`, kind: isBranch ? 'branch' : 'element',
      titleHtml: `<p>Scene ${i}</p>`,
      contentHtml: isBranch ? '' : `<p>Tekst ${i}</p>${i % 3 === 0 ? code(`gold += ${i % 7}`) : ''}`,
      customId: `s_${i}`, jumperTargetId: null, sortOrder: i,
      branchConditions: isBranch
        ? [{ id: `c_${i}_a`, script: `gold >= ${i}`, label: 'Rik' }, { id: `c_${i}_b`, script: null, label: 'Ellers' }]
        : [],
    });
    if (i + 1 < ELEMENTS) {
      if (isBranch) {
        connections.push({ id: `k${i}a`, sourceId: id, targetId: `e${i + 1}`, sourceOutputKey: `c_${i}_a`, labelHtml: '', sortOrder: 0 });
        connections.push({ id: `k${i}b`, sourceId: id, targetId: `e${Math.min(i + 2, ELEMENTS - 1)}`, sourceOutputKey: `c_${i}_b`, labelHtml: '', sortOrder: 1 });
      } else {
        connections.push({ id: `k${i}`, sourceId: id, targetId: `e${i + 1}`, sourceOutputKey: 'default', labelHtml: `<p>Videre ${i}</p>`, sortOrder: 0 });
        // Ekstra sidevalg annenhver scene → ~3 000 koblinger totalt.
        if (i % 2 === 0) connections.push({ id: `k${i}x`, sourceId: id, targetId: `e${Math.min(i + 5, ELEMENTS - 1)}`, sourceOutputKey: 'default', labelHtml: '<p>Snarvei</p>', sortOrder: 1 });
      }
    }
  }
  return {
    settings: { startingElementId: 'e0' },
    boards, elements, connections,
    components: [{ id: 'c1', name: 'Nora', customId: null }],
    elementComponents: [{ elementId: 'e0', componentId: 'c1', sortOrder: 0 }],
    attributes: [],
    variables: [{ id: 'v_gold', name: 'gold', type: 'int', defaultValue: 0 }],
  };
}

describe('narrative-runtime perf-vakt', () => {
  const graph = bigGraph();

  it(`validerer ${ELEMENTS} elementer / ${graph.connections.length} koblinger innen ${BUDGET_MS} ms`, () => {
    const t0 = performance.now();
    const issues = validateStoryGraph(graph);
    const ms = performance.now() - t0;
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`starter og spiller 300 valg innen ${BUDGET_MS} ms`, () => {
    const t0 = performance.now();
    const session = createPlaySession(graph, { rng: () => 0.5 });
    let view = session.start();
    expect(view?.elementId).toBe('e0');
    for (let n = 0; n < 300 && view && !view.deadEnd && view.options.length > 0; n++) {
      view = session.choose(view.options[0].connectionId);
    }
    const ms = performance.now() - t0;
    expect(session.getState().visits['e0']).toBe(1);
    expect(Object.keys(session.getState().visits).length).toBeGreaterThan(100);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
