import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPlaySession, validateStoryGraph } from '../narrative-runtime';
import { createSequentialIdFactory } from './ids';
import { convertTwineExpression, fromTwee, TweeImportError } from './twee';
import { sniffImportFormat } from './sniff';

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const opts = () => ({ projectId: 'p1', now: '2026-09-15T00:00:00.000Z', idFactory: createSequentialIdFactory() });
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('twee — SugarCube', () => {
  const result = fromTwee(fixture('sugarcube.twee'), opts());
  const { graph, warnings, stats } = result;
  const byTitle = (t: string) => graph.elements.find((e) => text(e.titleHtml) === t)!;

  it('leser StoryTitle, StoryData.start og hopper over skript-passasjer', () => {
    expect(graph.settings.title).toBe('Pungen');
    expect(graph.settings.startingElementId).toBe(byTitle('Landsbyen').id);
    expect(graph.elements.map((e) => text(e.titleHtml))).toEqual(['Landsbyen', 'Markedet', 'Smeden', 'Slutt', 'Ukjent']);
    expect(warnings.some((w) => /«StoryInit».*hoppet over/.test(w.message))).toBe(true);
    expect(stats.elements).toBe(5);
  });

  it('posisjon/størrelse/tag-tema, <<set>> → kodeblokk, tekst → avsnitt', () => {
    const start = byTitle('Landsbyen');
    expect(start.x).toBe(260);
    expect(start.y).toBe(180);
    expect(start.customId).toBe('Landsbyen');
    expect(start.contentHtml).toBe('<pre><code>gold = 0</code></pre><p>Du våkner i en stille landsby.</p>');
    expect(byTitle('Markedet').theme).toBe('green');
  });

  it('lenker → koblinger med etikett; setter-suffiks → kodeblokk i etiketten', () => {
    const start = byTitle('Landsbyen');
    const out = graph.connections.filter((c) => c.sourceId === start.id);
    expect(out.map((c) => [text(c.labelHtml), text(graph.elements.find((e) => e.id === c.targetId)!.titleHtml)])).toEqual([
      ['Gå til markedet', 'Markedet'], ['Sov videre', 'Landsbyen'],
    ]);
    const market = byTitle('Markedet');
    const home = graph.connections.find((c) => c.sourceId === market.id && c.labelHtml.startsWith('<p>Gå hjem'))!;
    expect(home.labelHtml).toBe('<p>Gå hjem</p><pre><code>gold -= 5</code></pre>');
  });

  it('<<if>>/<<else>>/<</if>> → if/else/endif rundt prose; <<link>> → kobling; ukjent makro beholdes + varsel', () => {
    const market = byTitle('Markedet');
    expect(market.contentHtml).toContain('<pre><code>gold += 10</code></pre>');
    expect(market.contentHtml).toContain('<pre><code>if gold &gt;= 10</code></pre><p>Du har råd til et sverd.</p><pre><code>else</code></pre><p>Tomme lommer.</p><pre><code>endif</code></pre>');
    expect(market.contentHtml).toContain('&lt;&lt;unknownmacro &quot;x&quot;&gt;&gt;');
    const sword = graph.connections.find((c) => c.sourceId === market.id && text(c.labelHtml) === 'Kjøp sverd')!;
    expect(text(graph.elements.find((e) => e.id === sword.targetId)!.titleHtml)).toBe('Smeden');
    expect(warnings.some((w) => w.message.includes('<<unknownmacro>>'))).toBe(true);
    expect(stats.unsupported).toBeGreaterThanOrEqual(2); // unknownmacro + manglende lenkemål
  });

  it('passasje med kun <<goto>> → jumper; variabler med inferert type; manglende lenkemål varsles', () => {
    const end = byTitle('Slutt');
    expect(end.kind).toBe('jumper');
    expect(end.jumperTargetId).toBe(byTitle('Landsbyen').id);
    expect(graph.variables.map((v) => [v.name, v.type, v.defaultValue])).toEqual([['gold', 'int', 0], ['sword', 'bool', true]]);
    expect(warnings.some((w) => /«Mangler» som ikke finnes/.test(w.message))).toBe(true);
    expect(graph.connections.some((c) => c.sourceId === byTitle('Ukjent').id)).toBe(false);
  });

  it('grafen validerer uten skriptfeil og kan spilles', () => {
    const issues = validateStoryGraph(graph).filter((i) => i.level === 'error' && /skript/i.test(i.message));
    expect(issues).toEqual([]);
    const session = createPlaySession(graph);
    const view = session.start()!;
    expect(text(view.element.titleHtml)).toBe('Landsbyen');
    const next = session.choose(view.options[0].connectionId)!;
    expect(text(next.element.titleHtml)).toBe('Markedet');
    expect(next.html).toContain('Du har råd til et sverd.');
    expect(session.getState().variables.gold).toBe(10);
  });
});

describe('twee — Harlowe (best effort)', () => {
  const { graph, warnings } = fromTwee(fixture('harlowe.twee'), opts());
  const byTitle = (t: string) => graph.elements.find((e) => text(e.titleHtml) === t)!;

  it('(set:), (if:)[..](else:)[..], (link-goto:), (goto:) oversettes; «it» → variabelen', () => {
    const entry = byTitle('Inngang');
    expect(entry.contentHtml).toBe('<pre><code>keys = 1</code></pre><p>Du står foran tårnet.</p><pre><code>if keys &gt; 0</code></pre><p>Du har en nøkkel.</p><pre><code>else</code></pre><p>Ingen nøkkel.</p><pre><code>endif</code></pre>');
    const out = graph.connections.filter((c) => c.sourceId === entry.id).map((c) => [text(c.labelHtml), text(graph.elements.find((e) => e.id === c.targetId)!.titleHtml)]);
    expect(out).toEqual([['Lås opp', 'Trappen'], ['Gå rundt', 'Hagen']]);
    expect(byTitle('Trappen').contentHtml).toContain('<pre><code>keys = keys - 1</code></pre>');
    const gotoConn = graph.connections.find((c) => c.sourceId === byTitle('Trappen').id)!;
    expect(text(graph.elements.find((e) => e.id === gotoConn.targetId)!.titleHtml)).toBe('Toppen');
    expect(warnings.some((w) => w.message.startsWith('Harlowe-støtte er delvis'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('(live:)'))).toBe(true);
    expect(byTitle('Toppen').contentHtml).toContain('(live: 2s)[Vinden uler.]');
  });

  it('convertTwineExpression', () => {
    expect(convertTwineExpression('$gold gte 10 and not $dead')).toBe('gold >= 10 and ! dead');
    expect(convertTwineExpression('$name is "Kari" or $x neq 3')).toBe('name == "Kari" or x != 3');
    expect(convertTwineExpression('$n to it + 1', 'n')).toBe('n = n + 1');
    expect(convertTwineExpression('$a === 1')).toBe('a == 1');
  });

  it('avviser ikke-twee', () => {
    expect(() => fromTwee('{"boards":{}}', opts())).toThrow(TweeImportError);
  });
});

describe('sniffImportFormat', () => {
  it('endelse først, ellers innhold', () => {
    expect(sniffImportFormat('x.json', '')).toBe('arcweave');
    expect(sniffImportFormat('x.twee', '')).toBe('twee');
    expect(sniffImportFormat('x.tw', '')).toBe('twee');
    expect(sniffImportFormat('x.ink', '')).toBe('ink');
    expect(sniffImportFormat('x.txt', ':: Start\nHei')).toBe('twee');
    expect(sniffImportFormat('x.txt', '=== start ===\nHei\n-> END')).toBe('ink');
    expect(sniffImportFormat('x.txt', 'VAR x = 1\n* [Valg]')).toBe('ink');
    expect(sniffImportFormat('x.txt', '{"name":"a","boards":{}}')).toBe('arcweave');
    expect(sniffImportFormat('x.txt', 'bare tekst')).toBeNull();
  });
});
