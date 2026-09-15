import { describe, expect, it } from 'vitest';

import { createPlaySession } from './engine';
import { validateScripts, validateStoryGraph } from './validate';
import type { RuntimeElement, RuntimeGraph } from './types';

const code = (s: string) => `<pre><code>${s}</code></pre>`;

function el(over: Partial<RuntimeElement> & { id: string }): RuntimeElement {
  return {
    boardId: 'b1', kind: 'element', titleHtml: `<p>${over.id}</p>`, contentHtml: '', customId: null,
    jumperTargetId: null, branchConditions: [], sortOrder: 0, ...over,
  };
}

function graph(): RuntimeGraph {
  return {
    settings: { startingElementId: 'start' },
    boards: [{ id: 'b1', name: 'Akt 1', customId: null }],
    components: [{ id: 'c_merchant', name: 'Kjøpmannen', customId: null }],
    elementComponents: [{ elementId: 'market', componentId: 'c_merchant', sortOrder: 0 }],
    attributes: [{ ownerKind: 'component', ownerId: 'c_merchant', name: 'mood', type: 'string', value: 'sur' }],
    variables: [{ id: 'v_gold', name: 'gold', type: 'int', defaultValue: 0 }],
    elements: [
      el({ id: 'start', contentHtml: `<p>Du finner en pung.</p>${code('gold += 10')}` }),
      el({ id: 'market', contentHtml: `${code('if gold >= 10')}<p>Velkommen, rik venn!</p>${code('else')}<p>Ingen penger, ingen varer.</p>${code('endif')}${code('show("Du har ", gold, " gull")')}` }),
      el({ id: 'choice', kind: 'branch', branchConditions: [{ id: 'c_yes', script: 'gold >= 10', label: 'Ja' }, { id: 'c_no', script: null, label: 'Ellers' }] }),
      el({ id: 'rich' }),
      el({ id: 'poor' }),
      el({ id: 'jump', kind: 'jumper', jumperTargetId: 'start' }),
      el({ id: 'loopA', kind: 'jumper', jumperTargetId: 'loopB' }),
      el({ id: 'loopB', kind: 'jumper', jumperTargetId: 'loopA' }),
    ],
    connections: [
      { id: 'k1', sourceId: 'start', targetId: 'market', sourceOutputKey: 'default', labelHtml: '<p>Gå til markedet</p>', sortOrder: 0 },
      { id: 'k2', sourceId: 'market', targetId: 'choice', sourceOutputKey: 'default', labelHtml: `<p>Kjøp</p>${code('gold -= 10')}`, sortOrder: 0 },
      { id: 'k3', sourceId: 'choice', targetId: 'rich', sourceOutputKey: 'c_yes', labelHtml: '', sortOrder: 0 },
      { id: 'k4', sourceId: 'choice', targetId: 'poor', sourceOutputKey: 'c_no', labelHtml: '', sortOrder: 1 },
      { id: 'k5', sourceId: 'rich', targetId: 'jump', sourceOutputKey: 'default', labelHtml: '<p>Igjen</p>', sortOrder: 0 },
      { id: 'k6', sourceId: 'poor', targetId: 'loopA', sourceOutputKey: 'default', labelHtml: '<p>Inn i sløyfa</p>', sortOrder: 0 },
    ],
  };
}

describe('createPlaySession', () => {
  it('starter på startelementet, kjører skript og gir valg', () => {
    const s = createPlaySession(graph());
    const v = s.start();
    expect(v?.elementId).toBe('start');
    expect(v?.html).toBe('<p>Du finner en pung.</p>');
    expect(s.getState().variables.gold).toBe(10);
    expect(s.getState().visits).toEqual({ start: 1 });
    expect(v?.options.map((o) => o.labelHtml)).toEqual(['<p>Gå til markedet</p>']);
    expect(v?.deadEnd).toBe(false);
  });

  it('betinget innhold, show(), taler fra komponent, etikett-skript ved valg og auto-ruting i forgrening', () => {
    const s = createPlaySession(graph());
    s.start();
    const market = s.choose('k1');
    expect(market?.elementId).toBe('market');
    expect(market?.html).toBe('<p>Velkommen, rik venn!</p><p class="narrative-show">Du har 10 gull</p>');
    expect(market?.speakerName).toBe('Kjøpmannen');
    expect(market?.options[0]).toMatchObject({ labelHtml: '<p>Kjøp</p>', hasScript: true });
    const after = s.choose('k2'); // etikett: gold -= 10 → 0 → forgrening → else → poor
    expect(s.getState().variables.gold).toBe(0);
    expect(after?.elementId).toBe('poor');
    expect(s.getState().log.some((l) => l.kind === 'branch')).toBe(true);
  });

  it('rik vei når gold holder, og jumper tilbake til start', () => {
    const s = createPlaySession(graph());
    s.start();
    s.choose('k1');
    s.setVariable('gold', 25);
    const v = s.choose('k2'); // 25-10=15 ≥ 10 → rich
    expect(v?.elementId).toBe('rich');
    const back = s.choose('k5'); // jumper → start (skript kjøres igjen: +10)
    expect(back?.elementId).toBe('start');
    expect(s.getState().variables.gold).toBe(25);
    expect(s.getState().visits.start).toBe(2);
  });

  it('sløyfevakt stopper jumper-ring', () => {
    const s = createPlaySession(graph(), { maxJumps: 10 });
    s.start();
    s.choose('k1');
    s.choose('k2'); // poor
    const v = s.choose('k6');
    expect(v?.deadEnd).toBe(true);
    expect(s.getState().log.at(-1)?.message).toMatch(/hopp på rad/);
  });

  it('back gjenoppretter variabler og visits uten å kjøre skript på nytt; restart nullstiller', () => {
    const s = createPlaySession(graph());
    s.start();
    s.choose('k1');
    expect(s.canBack()).toBe(true);
    const v = s.back();
    expect(v?.elementId).toBe('start');
    expect(s.getState().variables.gold).toBe(10);
    expect(s.getState().visits).toEqual({ start: 1 });
    expect(v?.html).toBe('<p>Du finner en pung.</p>');
    expect(s.canBack()).toBe(false);
    s.choose('k1');
    s.restart();
    expect(s.getState().variables.gold).toBe(10); // start kjørte +10 på nytt fra 0
    expect(s.getState().visits).toEqual({ start: 1 });
  });

  it('skopede komponent-attributter er variabler', () => {
    const s = createPlaySession(graph());
    expect(s.getVariableDefs().map((d) => d.name)).toEqual(['gold', 'Kjopmannen.mood']);
    s.start();
    expect(s.getState().variables['Kjopmannen.mood']).toBe('sur');
  });

  it('uten startelement og uten elementer → null + logg', () => {
    const g = graph();
    g.settings.startingElementId = null;
    g.elements = [];
    const s = createPlaySession(g);
    expect(s.start()).toBeNull();
    expect(s.getState().log[0].message).toMatch(/Ingen startelement/);
  });
});

describe('validateScripts / validateStoryGraph', () => {
  it('finner parse-feil, ukjente variabler og manglende element-referanser', () => {
    const g = graph();
    g.elements.push(el({ id: 'bad', contentHtml: code('if gold >') }));
    g.elements.push(el({ id: 'unknown', contentHtml: code('mana += 1\nvisits(nowhere)') }));
    g.elements.push(el({ id: 'badbranch', kind: 'branch', branchConditions: [{ id: 'x', script: 'gold >=', label: null }] }));
    const issues = validateScripts(g);
    expect(issues.some((i) => i.elementId === 'bad' && /skriptfeil/.test(i.message))).toBe(true);
    expect(issues.some((i) => i.elementId === 'unknown' && /ukjent variabel «mana»/.test(i.message))).toBe(true);
    expect(issues.some((i) => i.elementId === 'unknown' && /fant ikke element «nowhere»/.test(i.message))).toBe(true);
    expect(issues.some((i) => i.elementId === 'badbranch' && /betingelse 1/.test(i.message))).toBe(true);
    // gyldige skript gir ingen merknader
    expect(issues.some((i) => i.elementId === 'start' || i.elementId === 'market')).toBe(false);
  });

  it('validateStoryGraph slår sammen struktur og skript', () => {
    const issues = validateStoryGraph(graph());
    expect(issues.some((i) => i.elementId === 'loopA' && /kan ikke nås/.test(i.message))).toBe(false); // nås via jumper
    expect(issues.some((i) => i.elementId === 'jump')).toBe(false);
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });
});
