import { describe, expect, it } from 'vitest';
import {
  ArcweaveImportError, buildStandaloneHtml, createExportIdMapper, createSequentialIdFactory, fromArcweaveProject,
  htmlToPlainText, plainTextToHtml, toArcweaveProject, toMarkdown, toRuntimeSubset,
  type ArcweaveBoard, type ArcweaveFolder, type ArcweaveProject, type ExportGraph,
} from './index';

/** Fixture: to brett (ett i mappe), element m/ skript, forgrening m/ else, jumper, notat, komponent, variabel, ressurs. */
function fixture(): ExportGraph {
  return {
    settings: { title: 'Demo-spill', startingElementId: 'nel_start', coverAssetId: 'nas_cover' },
    boards: [
      { id: 'nbd_b1', name: 'Landsbyen', customId: 'village', folderPath: '', sortOrder: 0 },
      { id: 'nbd_b2', name: 'Markedet', customId: null, folderPath: 'Akt 1', sortOrder: 1 },
    ],
    elements: [
      { id: 'nel_start', boardId: 'nbd_b1', kind: 'element', titleHtml: '<p>Landsbyen</p>', contentHtml: '<p>Du finner en pung.</p><pre><code>gold += 10</code></pre>', x: 40, y: 80, width: 260, height: 120, theme: 'green', coverAssetId: null, customId: 'start', jumperTargetId: null, branchConditions: [], sortOrder: 0 },
      { id: 'nel_choice', boardId: 'nbd_b1', kind: 'branch', titleHtml: '', contentHtml: '', x: 400, y: 80, width: 200, height: 80, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c_yes', script: 'gold >= 10', label: 'Ja' }, { id: 'c_no', script: null, label: 'Ellers' }], sortOrder: 1 },
      { id: 'nel_rich', boardId: 'nbd_b2', kind: 'element', titleHtml: '<p>Rik</p>', contentHtml: '<p>Du har <span class="mention mention-variable" data-id="nvr_gold" data-kind="variable">gold</span> gull.</p>', x: 700, y: 20, width: 260, height: 120, theme: 'amber', coverAssetId: 'nas_cover', customId: null, jumperTargetId: null, branchConditions: [], sortOrder: 2 },
      { id: 'nel_poor', boardId: 'nbd_b2', kind: 'element', titleHtml: '<p>Fattig</p>', contentHtml: '<p>Tomme lommer.</p>', x: 700, y: 200, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], sortOrder: 3 },
      { id: 'nel_jump', boardId: 'nbd_b2', kind: 'jumper', titleHtml: '', contentHtml: '', x: 1000, y: 200, width: 160, height: 60, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: 'nel_start', branchConditions: [], sortOrder: 4 },
      { id: 'nel_note', boardId: 'nbd_b1', kind: 'note', titleHtml: '', contentHtml: '<p>Husk: gull styrer alt.</p>', x: 40, y: 300, width: 200, height: 100, theme: 'gray', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], sortOrder: 5 },
    ],
    connections: [
      { id: 'ncn_k1', boardId: 'nbd_b1', sourceId: 'nel_start', targetId: 'nel_choice', sourceOutputKey: 'default', labelHtml: '<p>Gå til markedet</p>', sortOrder: 0 },
      { id: 'ncn_k2', boardId: 'nbd_b1', sourceId: 'nel_choice', targetId: 'nel_rich', sourceOutputKey: 'c_yes', labelHtml: '', sortOrder: 1 },
      { id: 'ncn_k3', boardId: 'nbd_b1', sourceId: 'nel_choice', targetId: 'nel_poor', sourceOutputKey: 'c_no', labelHtml: '', sortOrder: 2 },
      { id: 'ncn_k4', boardId: 'nbd_b2', sourceId: 'nel_poor', targetId: 'nel_jump', sourceOutputKey: 'default', labelHtml: '<p>Prøv igjen</p>', sortOrder: 3 },
    ],
    components: [
      { id: 'ncp_m1', name: 'Kjøpmannen', folderPath: 'Karakterer', coverAssetId: null, customId: 'merchant', sortOrder: 0 },
    ],
    elementComponents: [{ elementId: 'nel_rich', componentId: 'ncp_m1', sortOrder: 0 }],
    attributes: [
      { id: 'nat_a1', ownerKind: 'component', ownerId: 'ncp_m1', name: 'mood', type: 'string', value: 'grådig', sortOrder: 0 },
      { id: 'nat_a2', ownerKind: 'component', ownerId: 'ncp_m1', name: 'health', type: 'int', value: 80, sortOrder: 1 },
      { id: 'nat_a3', ownerKind: 'element', ownerId: 'nel_rich', name: 'notat', type: 'rich_text', value: '<p>Belønning</p>', sortOrder: 2 },
      { id: 'nat_a4', ownerKind: 'component', ownerId: 'ncp_m1', name: 'venner', type: 'component_list', value: ['ncp_m1'], sortOrder: 3 },
    ],
    variables: [{ id: 'nvr_gold', name: 'gold', type: 'int', defaultValue: 0, sortOrder: 0 }],
    assets: [{ id: 'nas_cover', kind: 'image', name: 'cover.png', externalUrl: 'https://cdn.example.com/cover.png', folderPath: 'Bilder' }],
  };
}

function isFolder(v: unknown): v is ArcweaveFolder {
  return !!v && Array.isArray((v as ArcweaveFolder).children);
}

/** Id-fri signatur av et Arcweave-prosjekt (til rundtur-sammenligning). */
function signature(p: ArcweaveProject) {
  const title = (id: string) => {
    if (p.elements[id]) return `E:${p.elements[id].title}`;
    if (p.branches[id]) return 'B';
    if (p.jumpers[id]) return `J→${p.jumpers[id].elementId ? title(p.jumpers[id].elementId!) : '∅'}`;
    return '?';
  };
  const conn = (id: string | null) => (id && p.connections[id] ? `${p.connections[id].label ?? ''}→${title(p.connections[id].targetid)}` : '∅');
  const elements = Object.values(p.elements).map((e) => ({
    title: e.title, content: e.content, theme: e.theme, outputs: e.outputs.map(conn),
    components: e.components.map((c) => (p.components[c] as { name: string }).name),
    attributes: e.attributes.map((a) => [p.attributes[a].name, p.attributes[a].value.type, p.attributes[a].value.data]),
    cover: !!e.assets.cover,
  })).sort((a, b) => a.title.localeCompare(b.title));
  const branches = Object.values(p.branches).map((b) => ({
    if: [p.conditions[b.conditions.ifCondition].script, conn(p.conditions[b.conditions.ifCondition].output)],
    elseif: (b.conditions.elseIfConditions ?? []).map((c) => [p.conditions[c].script, conn(p.conditions[c].output)]),
    else: b.conditions.elseCondition ? ['else' in p.conditions[b.conditions.elseCondition] ? 'x' : p.conditions[b.conditions.elseCondition].script ?? null, conn(p.conditions[b.conditions.elseCondition].output)] : null,
  }));
  const folderOf = (col: Record<string, unknown>, id: string): string => {
    for (const [fid, f] of Object.entries(col)) if (isFolder(f) && f.children.includes(id)) return f.root ? '' : `${folderOf(col, fid)}/${f.name}`;
    return '';
  };
  const boards = Object.entries(p.boards).filter(([, b]) => !isFolder(b)).map(([id, b]) => ({ name: (b as ArcweaveBoard).name, folder: folderOf(p.boards, id), counts: [(b as ArcweaveBoard).elements.length, (b as ArcweaveBoard).branches.length, (b as ArcweaveBoard).jumpers.length, (b as ArcweaveBoard).notes.length, (b as ArcweaveBoard).connections.length] })).sort((a, b) => a.name.localeCompare(b.name));
  const components = Object.entries(p.components).filter(([, c]) => !isFolder(c)).map(([id, c]) => ({ name: (c as { name: string }).name, folder: folderOf(p.components, id), attrs: (c as { attributes: string[] }).attributes.map((a) => [p.attributes[a].name, p.attributes[a].value.type]) }));
  const variables = Object.values(p.variables).filter((v) => !isFolder(v)).map((v) => [(v as { name: string }).name, (v as { type: string }).type, (v as { value: unknown }).value]);
  const notes = Object.values(p.notes).map((n) => n.content).sort();
  return { name: p.name, start: p.startingElement ? title(p.startingElement) : null, cover: !!p.cover, elements, branches, boards, components, variables, notes };
}

describe('narrative-format — eksport til Arcweave project.json', () => {
  it('produserer alle topp-nivå-samlinger med strippede ider og riktig struktur', () => {
    const p = toArcweaveProject(fixture());
    expect(Object.keys(p).sort()).toEqual(['assets', 'attributes', 'boards', 'branches', 'components', 'conditions', 'connections', 'cover', 'elements', 'jumpers', 'name', 'notes', 'startingElement', 'variables'].sort());
    expect(p.name).toBe('Demo-spill');
    expect(p.startingElement).toBe('start');
    expect(p.cover).toEqual({ id: 'cover' });
    expect(p.elements.start).toMatchObject({ title: '<p>Landsbyen</p>', theme: 'green', outputs: ['k1'], customId: 'start', components: [], assets: {} });
    expect(p.elements.rich.components).toEqual(['m1']);
    expect(p.elements.rich.assets).toEqual({ cover: { id: 'cover' } });
    expect(p.connections.k1).toEqual({ type: 'Straight', theme: 'default', sourceid: 'start', targetid: 'choice', sourceType: 'elements', targetType: 'branches', label: '<p>Gå til markedet</p>' });
    expect(p.jumpers.jump).toEqual({ x: 1000, y: 200, elementId: 'start' });
    expect(p.notes.note).toMatchObject({ content: '<p>Husk: gull styrer alt.</p>', theme: 'gray' });
    expect(p.connections.k4).toMatchObject({ sourceid: 'poor', targetid: 'jump', targetType: 'jumpers' });
  });

  it('forgrening → branches + conditions; else uten script; koblinger fra conditions', () => {
    const p = toArcweaveProject(fixture());
    expect(p.branches.choice.conditions).toEqual({ ifCondition: 'c_yes', elseIfConditions: [], elseCondition: 'c_no' });
    expect(p.conditions.c_yes).toEqual({ script: 'gold >= 10', output: 'k2' });
    expect(p.conditions.c_no).toEqual({ output: 'k3' });
    expect(p.connections.k2).toMatchObject({ sourceid: 'c_yes', sourceType: 'conditions', targetid: 'rich', targetType: 'elements', label: null });
  });

  it('brett-, komponent- og ressursmapper blir mappetrær med rot', () => {
    const p = toArcweaveProject(fixture());
    const roots = Object.values(p.boards).filter((b) => isFolder(b) && b.root);
    expect(roots).toHaveLength(1);
    const root = roots[0] as ArcweaveFolder;
    expect(root.children).toContain('b1');
    const akt1 = Object.values(p.boards).find((b) => isFolder(b) && b.name === 'Akt 1') as ArcweaveFolder;
    expect(akt1.children).toEqual(['b2']);
    expect(p.boards.b1).toMatchObject({ name: 'Landsbyen', customId: 'village', elements: ['start'], branches: ['choice'], notes: ['note'], jumpers: [], connections: ['k1', 'k2', 'k3'] });
    expect(p.boards.b2).toMatchObject({ elements: ['rich', 'poor'], jumpers: ['jump'], connections: ['k4'] });
    const karakterer = Object.values(p.components).find((c) => isFolder(c) && c.name === 'Karakterer') as ArcweaveFolder;
    expect(karakterer.children).toEqual(['m1']);
    const bilder = Object.values(p.assets).find((a) => isFolder(a) && a.name === 'Bilder') as ArcweaveFolder;
    expect(bilder.children).toEqual(['cover']);
    expect(p.assets.cover).toEqual({ name: 'cover.png', type: 'image', url: 'https://cdn.example.com/cover.png' });
  });

  it('attributter og variabler får Arcweaves typenavn', () => {
    const p = toArcweaveProject(fixture());
    expect(p.attributes.a1).toEqual({ cId: 'm1', cType: 'components', name: 'mood', value: { data: 'grådig', type: 'string', plain: true } });
    expect(p.attributes.a2.value).toEqual({ data: 80, type: 'integer', plain: true });
    expect(p.attributes.a3).toMatchObject({ cId: 'rich', cType: 'elements', value: { type: 'string', plain: false } });
    expect(p.attributes.a4.value).toEqual({ data: ['m1'], type: 'component-list', plain: true });
    expect(p.variables.gold).toEqual({ name: 'gold', type: 'integer', cType: 'global', value: 0 });
    const varRoot = Object.values(p.variables).find((v) => isFolder(v)) as ArcweaveFolder;
    expect(varRoot).toMatchObject({ root: true, children: ['gold'] });
  });

  it('id-mapper: prefiks strippes, kollisjon på tvers av samlinger beholder originalen', () => {
    const m = createExportIdMapper();
    expect(m.map('nel_1')).toBe('1');
    expect(m.map('ncn_1')).toBe('ncn_1');
    expect(m.map('nel_1')).toBe('1');
    expect(m.map('nel_9d3c')).toBe('9d3c');
    expect(m.map('rå-id')).toBe('rå-id');
  });
});

describe('narrative-format — import fra Arcweave', () => {
  it('rundtur eksport → import → eksport er lik modulo ider', () => {
    const first = toArcweaveProject(fixture());
    const { graph, warnings } = fromArcweaveProject(first, { projectId: 'p1', now: '2026-09-15T00:00:00.000Z', idFactory: createSequentialIdFactory() });
    expect(warnings).toEqual([]);
    expect(graph.elements).toHaveLength(6);
    expect(graph.connections).toHaveLength(4);
    expect(graph.elements.every((e) => e.projectId === 'p1' && e.version === 1)).toBe(true);
    const second = toArcweaveProject(graph);
    expect(signature(second)).toEqual(signature(first));
  });

  it('leser Arcweave-form (mapper, else-betingelse, jumper, attributter, variabler i rot-mappe)', () => {
    const arc: ArcweaveProject = {
      name: 'Unity-eksempel',
      cover: null,
      startingElement: 'e1',
      boards: {
        root: { name: 'Root', root: true, children: ['f1', 'b1'] },
        f1: { name: 'Kapittel 2', children: ['b2'] },
        b1: { name: 'Start', customId: null, notes: ['n1'], jumpers: [], branches: ['br1'], elements: ['e1'], connections: ['c1', 'c2', 'c3'] },
        b2: { name: 'Slutt', customId: 'end', notes: [], jumpers: ['j1'], branches: [], elements: ['e2', 'e3'], connections: [] },
      },
      notes: { n1: { x: 1, y: 2, theme: 'default', content: '<p>merk</p>' } },
      elements: {
        e1: { x: 0, y: 0, width: 300, height: 100, theme: 'orange', title: '<p>Inngang</p>', content: '<p>Hei <span class="mention-element mention" data-id="e2">Slutt</span></p><pre><code>wanda_health += 50</code></pre>', outputs: ['c1'], components: ['comp1'], attributes: ['a1'], assets: { cover: null } },
        e2: { x: 500, y: 0, theme: 'default', title: '<p>God slutt</p>', content: '', outputs: [], components: [], attributes: [], assets: {} },
        e3: { x: 500, y: 300, theme: 'default', title: '<p>Dårlig slutt</p>', content: '', outputs: [], components: [], attributes: [], assets: {} },
      },
      jumpers: { j1: { x: 9, y: 9, elementId: 'e1' }, j2: { x: 0, y: 0, elementId: 'finnes-ikke' } },
      connections: {
        c1: { type: 'Straight', theme: 'default', sourceid: 'e1', targetid: 'br1', sourceType: 'elements', targetType: 'branches', label: null },
        c2: { type: 'Straight', theme: 'default', sourceid: cond('if'), targetid: 'e2', sourceType: 'conditions', targetType: 'elements', label: null },
        c3: { type: 'Straight', theme: 'default', sourceid: cond('else'), targetid: 'e3', sourceType: 'conditions', targetType: 'elements', label: null },
        c9: { type: 'Straight', theme: 'default', sourceid: 'ukjent', targetid: 'e2', sourceType: 'elements', targetType: 'elements', label: null },
      },
      branches: { br1: { x: 250, y: 0, theme: 'default', conditions: { ifCondition: cond('if'), elseIfConditions: [], elseCondition: cond('else') } } },
      components: {
        croot: { name: 'Root', root: true, children: ['cf', 'comp1'] },
        cf: { name: 'NPC', children: ['comp2'] },
        comp1: { name: 'Wanda', customId: null, attributes: ['a2', 'a3'], assets: {} },
        comp2: { name: 'Vakt', customId: 'guard', attributes: [], assets: {} },
      },
      attributes: {
        a1: { cId: 'e1', cType: 'elements', name: 'Notes', value: { data: '<p>x</p>', type: 'string', plain: false } },
        a2: { cId: 'comp1', cType: 'components', name: 'health', value: { data: 60, type: 'integer', plain: true } },
        a3: { cId: 'comp1', cType: 'components', name: 'allies', value: { data: ['comp2'], type: 'component-list', plain: true } },
      },
      assets: { aroot: { name: 'Root', root: true, children: [] } },
      variables: {
        vroot: { name: 'Root', root: true, children: ['v1', 'v2'] },
        v1: { name: 'wanda_health', type: 'integer', cType: 'global', value: 50 },
        v2: { name: 'har gull?', type: 'boolean', cType: 'global', value: false },
      },
      conditions: { [cond('if')]: { script: 'wanda_health >= 40', output: 'c2' }, [cond('else')]: { output: 'c3' } },
    };
    function cond(k: string) { return `cond-${k}`; }

    const { graph, warnings } = fromArcweaveProject(arc, { projectId: 'p2', now: '2026-09-15T00:00:00.000Z', idFactory: createSequentialIdFactory() });
    expect(graph.settings).toMatchObject({ title: 'Unity-eksempel', startingElementId: 'nel_0001' });
    expect(graph.boards.map((b) => [b.name, b.folderPath, b.customId])).toEqual([['Start', '', null], ['Slutt', 'Kapittel 2', 'end']]);
    const byKind = (k: string) => graph.elements.filter((e) => e.kind === k);
    expect(byKind('element')).toHaveLength(3);
    expect(byKind('branch')).toHaveLength(1);
    expect(byKind('jumper')).toHaveLength(2);
    expect(byKind('note')).toHaveLength(1);
    const e1 = graph.elements.find((e) => e.titleHtml === '<p>Inngang</p>')!;
    expect(e1).toMatchObject({ theme: 'amber', width: 300, boardId: graph.boards[0].id });
    expect(e1.contentHtml).toContain('wanda_health += 50');
    const branch = byKind('branch')[0];
    expect(branch.branchConditions.map((c) => c.script)).toEqual(['wanda_health >= 40', null]);
    const [ifId, elseId] = branch.branchConditions.map((c) => c.id);
    expect(graph.connections.map((c) => [c.sourceId, c.sourceOutputKey, c.targetId])).toEqual([
      [e1.id, 'default', branch.id],
      [branch.id, ifId, graph.elements.find((e) => e.titleHtml === '<p>God slutt</p>')!.id],
      [branch.id, elseId, graph.elements.find((e) => e.titleHtml === '<p>Dårlig slutt</p>')!.id],
    ]);
    const jumpers = byKind('jumper');
    expect(jumpers[0].jumperTargetId).toBe(e1.id);
    expect(jumpers[1].jumperTargetId).toBeNull();
    expect(graph.components.map((c) => [c.name, c.folderPath, c.customId])).toEqual([['Wanda', '', null], ['Vakt', 'NPC', 'guard']]);
    expect(graph.elementComponents).toEqual([{ elementId: e1.id, componentId: graph.components[0].id, sortOrder: 0 }]);
    expect(graph.attributes.map((a) => [a.ownerKind, a.name, a.type, a.value])).toEqual([
      ['element', 'Notes', 'rich_text', '<p>x</p>'],
      ['component', 'health', 'int', 60],
      ['component', 'allies', 'component_list', [graph.components[1].id]],
    ]);
    expect(graph.variables.map((v) => [v.name, v.type, v.defaultValue])).toEqual([['wanda_health', 'int', 50], ['har_gull', 'bool', false]]);
    const messages = warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes('Jumperen peker på et element som ikke finnes'))).toBe(true);
    expect(messages.some((m) => m.includes('Koblingen peker på noe som ikke finnes'))).toBe(true);
    expect(messages.some((m) => m.includes('«har gull?» fikk navnet «har_gull»'))).toBe(true);
    expect(messages.some((m) => m.includes('lå ikke på noe brett'))).toBe(true); // j2
  });

  it('avviser dokumenter som ikke er Arcweave-prosjekter', () => {
    expect(() => fromArcweaveProject({ foo: 1 }, { projectId: 'p' })).toThrow(ArcweaveImportError);
    expect(() => fromArcweaveProject(null, { projectId: 'p' })).toThrow(ArcweaveImportError);
  });
});

describe('narrative-format — Markdown', () => {
  it('skriver brett, elementer, valg, forgreninger, jumpere, notater, variabler og komponenter', () => {
    const md = toMarkdown(fixture());
    expect(md).toContain('# Demo-spill');
    expect(md).toContain('Startelement: **Landsbyen**');
    expect(md).toContain('## Landsbyen');
    expect(md).toContain('## Markedet (Akt 1)');
    expect(md).toContain('### Landsbyen `start` ▶');
    expect(md).toContain('Du finner en pung.');
    expect(md).toContain('```arcscript\ngold += 10\n```');
    expect(md).toContain('- «Gå til markedet» → Forgrening');
    expect(md).toContain('- if `gold >= 10` → Rik');
    expect(md).toContain('- ellers → Fattig');
    expect(md).toContain('Jumper → Landsbyen');
    expect(md).toContain('> Husk: gull styrer alt.');
    expect(md).toContain('| gold | int | 0 |');
    expect(md).toContain('- **Kjøpmannen** (Karakterer) `merchant`');
    expect(md).toContain('  - mood: "grådig"');
    expect(md).toContain('_Komponenter: Kjøpmannen_');
  });
});

describe('narrative-format — standalone HTML og tekst', () => {
  it('inliner spiller + graf, escaper </script> i data, dropper notater og element-attributter', () => {
    const g = fixture();
    g.elements[0].contentHtml = '<p>Farlig</p><script>alert(1)</script><p></script></p>';
    const html = buildStandaloneHtml({ title: 'Demo <spill>', graph: g, playerJs: 'window.StoryGraphPlayer={mount(){}};/*</script>*/' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Demo &lt;spill&gt;</title>');
    expect(html).toContain('StoryGraphPlayer.mount(');
    // Data-JSON må ikke kunne lukke script-taggen.
    const dataLine = html.split('\n').find((l) => l.startsWith('<script>window.__STORY_GRAPH__='))!;
    expect(dataLine.slice(0, -'</script>'.length)).not.toContain('</script>');
    expect(dataLine).toContain('\\u003c/script');
    // Spiller-JS med </script> i kommentar/streng blir <\/script.
    expect(html).toContain('/*<\\/script>*/');
    const runtime = toRuntimeSubset(g);
    expect(runtime.elements.some((e) => e.kind === 'note')).toBe(false);
    expect(runtime.attributes.every((a) => a.ownerKind !== 'element')).toBe(true);
    expect(runtime.attributes.map((a) => a.name)).toEqual(['mood', 'health']);
    expect(runtime.settings.startingElementId).toBe('nel_start');
  });

  it('htmlToPlainText/plainTextToHtml', () => {
    expect(htmlToPlainText('<p>Hei &amp; h&aring;</p><p>Linje 2<br>Linje 3</p>')).toBe('Hei & hå\nLinje 2\nLinje 3');
    expect(plainTextToHtml('Første <avsnitt>\n\nAndre\nlinje')).toBe('<p>Første &lt;avsnitt&gt;</p><p>Andre<br>linje</p>');
  });
});
