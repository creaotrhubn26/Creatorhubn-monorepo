import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPlaySession, validateStoryGraph } from '../narrative-runtime';
import { createSequentialIdFactory } from './ids';
import { convertInkExpression, fromInk, InkImportError } from './ink';

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const opts = () => ({ projectId: 'p1', now: '2026-09-15T00:00:00.000Z', idFactory: createSequentialIdFactory(), title: 'sample' });
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('ink — delsett', () => {
  const { graph, warnings, stats } = fromInk(fixture('sample.ink'), opts());
  const byTitle = (t: string) => graph.elements.find((e) => text(e.titleHtml) === t)!;
  const targetsOf = (id: string) => graph.connections.filter((c) => c.sourceId === id).map((c) => [text(c.labelHtml), text(graph.elements.find((e) => e.id === c.targetId)!.titleHtml)]);

  it('VAR/CONST → variabler; INCLUDE og knot-parametre varsles', () => {
    expect(graph.variables.map((v) => [v.name, v.type, v.defaultValue])).toEqual([['gold', 'int', 0], ['brave', 'bool', false], ['MAX', 'int', 3]]);
    expect(warnings.some((w) => w.message.includes('CONST «MAX»'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('INCLUDE other.ink'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('Knot-parametre «smith(x)»'))).toBe(true);
  });

  it('topp-nivå-innhold blir startelement med divert til knot; tags og kommentarer fjernes', () => {
    const start = byTitle('Start');
    expect(graph.settings.startingElementId).toBe(start.id);
    expect(start.contentHtml).toBe('<p>Du våkner i en stille landsby.</p>');
    expect(targetsOf(start.id)).toEqual([['', 'village']]);
  });

  it('~ tilordning → kodeblokk, {x} → show(x), valg → koblinger, gate → forgrening, gather etter valg', () => {
    const village = byTitle('village');
    expect(village.contentHtml).toBe('<pre><code>gold += 10</code></pre><p>Du finner en pung med</p><pre><code>show(gold)</code></pre><p>gull.</p>');
    const out = targetsOf(village.id);
    expect(out).toEqual([['Gå til markedet', 'Gå til markedet'], ['Kjøp et sverd', 'Kjøp et sverd'], ['Sov videre', 'Sov videre']]);
    // Gate → forgreningselement
    const gate = graph.elements.find((e) => e.kind === 'branch')!;
    expect(gate.branchConditions.map((c) => c.script)).toEqual(['gold >= 10', null]);
    const gateOut = graph.connections.filter((c) => c.sourceId === gate.id);
    expect(gateOut).toHaveLength(1);
    expect(gateOut[0].sourceOutputKey).toBe(gate.branchConditions[0].id);
    const sword = graph.elements.find((e) => e.id === gateOut[0].targetId)!;
    expect(sword.contentHtml).toBe('<p>Smeden smiler.</p><pre><code>brave = true</code></pre>');
    expect(targetsOf(sword.id)).toEqual([['', 'smith']]);
    // Valg-kropp med divert
    const market = graph.elements.find((e) => e.id === graph.connections.find((c) => c.sourceId === village.id)!.targetId)!;
    expect(market.contentHtml).toBe('<p>Du går mot markedet.</p>');
    expect(targetsOf(market.id)).toEqual([['', 'market']]);
    // Sticky valg uten divert → kobles til gather
    const sleep = graph.elements.find((e) => text(e.titleHtml) === 'Sov videre')!;
    expect(sleep.contentHtml).toBe('<p>Du sover.</p>');
    const gather = graph.elements.find((e) => e.id === targetsOf(sleep.id)[0] && false) ?? graph.elements.find((e) => e.contentHtml.includes('Dagen går'))!;
    expect(graph.connections.some((c) => c.sourceId === sleep.id && c.targetId === gather.id)).toBe(true);
    expect(gather.contentHtml).toBe('<p>Dagen går.</p><pre><code>if brave</code></pre><p>Du føler deg modig.</p><pre><code>else</code></pre><p>Du er fortsatt redd.</p><pre><code>endif</code></pre>');
    // Divert til stitch village.evening
    expect(targetsOf(gather.id)).toEqual([['', 'village › evening']]);
  });

  it('stitch, sekvenser som tekst + varsel, END/DONE uten kobling, engangs-varsel', () => {
    const evening = byTitle('village › evening');
    expect(evening.contentHtml).toBe('<p>Kvelden kommer. Månen / Stjernene lyser.</p>');
    expect(targetsOf(evening.id)).toEqual([]);
    expect(targetsOf(byTitle('market').id)).toEqual([]);
    expect(warnings.some((w) => w.message.includes('Sekvensen «{&Månen|Stjernene}»'))).toBe(true);
    expect(warnings.some((w) => /2 engangs-valg/.test(w.message))).toBe(true);
    expect(stats.unsupported).toBeGreaterThanOrEqual(2);
  });

  it('grafen validerer uten skriptfeil og spiller: gold = 10 etter village', () => {
    const scriptErrors = validateStoryGraph(graph).filter((i) => i.level === 'error' && /skript/i.test(i.message));
    expect(scriptErrors).toEqual([]);
    const session = createPlaySession(graph);
    const view = session.start()!;
    expect(text(view.element.titleHtml)).toBe('Start');
    const village = session.choose(view.options[0].connectionId)!;
    expect(text(village.element.titleHtml)).toBe('village');
    expect(session.getState().variables.gold).toBe(10);
    expect(village.html).toContain('10');
    expect(village.options).toHaveLength(3);
  });

  it('convertInkExpression + avvisning', () => {
    expect(convertInkExpression('not brave and gold = 3')).toBe('! brave and gold == 3');
    expect(convertInkExpression('x >= 2 || name == "a"')).toBe('x >= 2 || name == "a"');
    expect(() => fromInk('bare tekst uten ink', opts())).toThrow(InkImportError);
  });
});
