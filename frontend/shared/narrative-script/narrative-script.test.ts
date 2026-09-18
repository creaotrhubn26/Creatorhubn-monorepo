import { describe, expect, it } from 'vitest';

import {
  createInterpreter, decodeEntities, hasScript, parseExpression, parseProgram, segmentContentHtml,
  type ScriptVariable,
} from './index';

const VARS: ScriptVariable[] = [
  { name: 'gold', type: 'int', defaultValue: 50 },
  { name: 'wanda_health', type: 'int', defaultValue: 20 },
  { name: 'sword_locked', type: 'bool', defaultValue: true },
  { name: 'have_potion', type: 'bool', defaultValue: false },
  { name: 'name', type: 'string', defaultValue: 'Fremmed' },
  { name: 'ratio', type: 'float', defaultValue: 0.5 },
  { name: 'wanda.mood', type: 'string', defaultValue: 'nøytral' },
];

function interp(over: Partial<Parameters<typeof createInterpreter>[0]> = {}) {
  return createInterpreter({
    variables: VARS,
    visits: { el_potion: 2 },
    currentElementId: 'el_start',
    rng: () => 0.5,
    resolveMention: (id) => (id === 'm_potion' ? { kind: 'element', elementId: 'el_potion' } : id === 'm_gold' ? { kind: 'variable', name: 'gold' } : null),
    resolveElementRef: (ref) => (ref === 'get_potion' ? 'el_potion' : null),
    ...over,
  });
}

const code = (s: string) => `<pre><code>${s}</code></pre>`;

describe('html-laget', () => {
  it('deler innhold i html- og kodesegmenter og dekoder entiteter kun i kode', () => {
    const segs = segmentContentHtml('<p>Hei &amp; hopp</p><pre><code>gold &gt;= 10 &amp;&amp; true</code></pre><p>Slutt</p>');
    expect(segs.map((s) => s.kind)).toEqual(['html', 'code', 'html']);
    expect(segs[0]).toMatchObject({ html: '<p>Hei &amp; hopp</p>' });
    expect(segs[1]).toMatchObject({ code: 'gold >= 10 && true' });
    expect(decodeEntities('a &lt; b &#39;c&#39; &#x27;d&#x27;')).toBe("a < b 'c' 'd'");
  });

  it('gjør mention-spans i kode om til @[id]', () => {
    const segs = segmentContentHtml('<pre><code>not visits(<span class="mention-element mention" data-id="d852">get_potion</span>)</code></pre>');
    expect(segs[0]).toMatchObject({ kind: 'code', code: 'not visits(@[d852])' });
    expect((segs[0] as { mentions: unknown[] }).mentions).toEqual([{ id: 'd852', kind: 'element', label: 'get_potion' }]);
  });

  it('hasScript', () => {
    expect(hasScript('<p>x</p>')).toBe(false);
    expect(hasScript('<pre><code>a = 1</code></pre>')).toBe(true);
    expect(hasScript(null)).toBe(false);
  });
});

describe('parser', () => {
  it('respekterer presedens', () => {
    const e = parseExpression('1 + 2 * 3 == 7 and not false or 0');
    expect(e.type).toBe('binary');
    expect((e as { op: string }).op).toBe('or');
  });

  it('bygger if/elseif/else/endif på tvers av kodeblokker', () => {
    const program = parseProgram(segmentContentHtml(
      `${code('if wanda_health < 40')}<p>Hjelp meg</p>${code('elseif wanda_health < 80')}<p>Takk</p>${code('else')}<p>Frisk</p>${code('endif')}<p>Etter</p>`,
    ));
    expect(program).toHaveLength(2);
    expect(program[0].type).toBe('if');
    expect((program[0] as { branches: unknown[] }).branches).toHaveLength(3);
    expect(program[1]).toMatchObject({ type: 'html', html: '<p>Etter</p>' });
  });

  it('gir parse-feil med posisjon', () => {
    expect(() => parseExpression('gold >= ')).toThrow(/Uventet slutt/);
    expect(() => parseProgram(segmentContentHtml(code('if gold > 1')))).toThrow(/mangler «endif»/);
    expect(() => parseProgram(segmentContentHtml(code('endif')))).toThrow(/uten «if»/);
    expect(() => parseExpression('foo(1)')).toThrow(/Ukjent funksjon/);
    try {
      parseExpression('gold >= 10 +');
    } catch (err) {
      expect((err as { offset: number }).offset).toBe(12);
    }
  });

  it('godtar flere setninger skilt av linjeskift og semikolon', () => {
    const program = parseProgram(segmentContentHtml(code('gold -= 50\nsword_locked = false; have_potion = true')));
    expect(program.map((n) => n.type)).toEqual(['assignment', 'assignment', 'assignment']);
  });
});

describe('tolk — Arcweave-korpus', () => {
  it('tilordning og betinget seksjon (wanda_health)', () => {
    const i = interp();
    const r1 = i.runScript(code('wanda_health += 50'));
    expect(r1.errors).toEqual([]);
    expect(r1.changes).toEqual({ wanda_health: 70 });
    const r2 = i.runScript(`${code('if wanda_health < 40')}<p>Help me, Stranger...</p>${code('else')}<p>Thank you for saving my life!</p>${code('endif')}`);
    expect(r2.html).toBe('<p>Thank you for saving my life!</p>');
    expect(r2.errors).toEqual([]);
  });

  it('elseif med negasjon og nøkkelordformer', () => {
    const i = interp();
    const r = i.runScript(`${code('if sword_locked')}<p>Lås</p>${code('elseif !sword_locked')}<p>Åpen</p>${code('endif')}`);
    expect(r.html).toBe('<p>Lås</p>');
    expect(i.evaluateCondition('sword_locked is not false').value).toBe(true);
    expect(i.evaluateCondition('gold >= 50 and have_potion is false').value).toBe(true);
    expect(i.evaluateCondition('gold > 100 || have_potion').value).toBe(false);
  });

  it('visits() med mention, identifikator og uten argument', () => {
    const i = interp();
    expect(i.evaluateCondition('not visits(@[m_potion])').value).toBe(false);
    expect(i.evaluateCondition('visits(get_potion) == 2').value).toBe(true);
    expect(i.evaluateCondition('visits() == 0').value).toBe(true);
    i.incrementVisit('el_start');
    expect(i.evaluateCondition('visits() == 1').value).toBe(true);
    i.runScript(code('resetVisits(@[m_potion])'));
    expect(i.getVisits()).toEqual({ el_start: 1 });
  });

  it('show() legger tekst inn der kallet står', () => {
    const i = interp();
    const r = i.runScript(`<p>Du har</p>${code('show(gold, " gull, ", name)')}<p>Bra.</p>`);
    expect(r.html).toBe('<p>Du har</p><p class="narrative-show">50 gull, Fremmed</p><p>Bra.</p>');
    expect(r.output).toBe('50 gull, Fremmed');
  });

  it('typer koerseres ved tilordning; reset/resetAll', () => {
    const i = interp();
    i.runScript(code('gold = 7.9\nratio = 2\nname = 42\nhave_potion = 1'));
    expect(i.getVariables()).toMatchObject({ gold: 7, ratio: 2, name: '42', have_potion: true });
    i.runScript(code('reset(gold, name)'));
    expect(i.getVariables()).toMatchObject({ gold: 50, name: 'Fremmed', have_potion: true });
    const r = i.runScript(code('resetAll()'));
    expect(r.changes).toMatchObject({ ratio: 0.5, have_potion: false });
  });

  it('random/roll med injisert RNG, matematikk og punktnotasjon', () => {
    const i = interp({ rng: () => 0.99 });
    expect(i.evaluateCondition('roll(6) == 6').value).toBe(true);
    expect(i.evaluateCondition('roll(6, 2) == 12').value).toBe(true);
    expect(i.evaluateCondition('random(1, 10) == 10').value).toBe(true);
    expect(i.evaluateCondition('abs(-3) + max(1, 9) + min(4, 2) + round(2.6) + sqr(3) + sqrt(16) == 30').value).toBe(true);
    expect(i.evaluateCondition('wanda.mood == "nøytral"').value).toBe(true);
    const r = i.runScript(code('wanda.mood = "glad"'));
    expect(r.changes).toEqual({ 'wanda.mood': 'glad' });
  });

  it('feil samles i errors og stopper aldri rendringen', () => {
    const i = interp();
    const r = i.runScript(`<p>A</p>${code('ukjent += 1')}<p>B</p>${code('gold = gold / 0')}<p>C</p>`);
    expect(r.html).toBe('<p>A</p><p>B</p><p>C</p>');
    expect(r.errors.map((e) => e.kind)).toEqual(['runtime', 'runtime']);
    expect(r.errors[0].message).toMatch(/Ukjent variabel «ukjent»/);
    expect(r.errors[1].message).toMatch(/Deling på null/);
    expect(r.errors[0].segmentIndex).toBe(1);
    const bad = i.runScript(`<p>A</p>${code('if gold >')}<p>B</p>`);
    expect(bad.errors[0].kind).toBe('parse');
    expect(bad.html).toBe('<p>A</p><p>B</p>');
    expect(i.evaluateCondition('gold >').value).toBe(false);
    expect(i.evaluateCondition('').value).toBe(true);
  });

  it('strenger med begge anførselstegn, + som konkatenering, == på tvers av typer', () => {
    const i = interp();
    expect(i.evaluateCondition(`name + '!' == "Fremmed!"`).value).toBe(true);
    expect(i.evaluateCondition('gold == "50"').value).toBe(true);
    expect(i.evaluateCondition('have_potion == 0').value).toBe(true);
    expect(i.evaluateCondition('"b" > "a"').value).toBe(true);
  });

  it('nodebudsjett stopper løpske uttrykk', () => {
    const i = interp({ maxNodes: 20 });
    const r = i.evaluateCondition('1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1 > 0');
    expect(r.value).toBe(false);
    expect(r.errors[0].message).toMatch(/nodebudsjett/);
  });
});
