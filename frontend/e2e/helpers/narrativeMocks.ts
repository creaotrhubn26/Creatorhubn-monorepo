/**
 * narrativeMocks — page.route()-installer for /api/role-room/narrative/*.
 *
 * Holder en in-memory graf per page slik at POST/PATCH/DELETE reflekteres i
 * neste GET /graph. Alle svar bruker { success: true, data } — kontrakten
 * narrativeService forventer.
 */
import type { Page, Route } from '@playwright/test';

/**
 * Minimal Arcweave→graf-konvertering for mocken (elementer, jumpere,
 * koblinger, brett). Playwrights spec-loader tåler ikke import av
 * `shared/narrative-format` her, så mocken speiler serverens oppførsel
 * i forenklet form; den fulle konverteringen testes i vitest.
 */
function mockImportArcweave(project: Rec, projectId: string): { graph: MockGraph; warnings: Array<{ message: string; ref?: string }> } {
  const warnings: Array<{ message: string; ref?: string }> = [];
  const idMap = new Map<string, string>();
  const nid = (prefix: string, arcId: string) => { const e = idMap.get(arcId); if (e) return e; const n = nextId(prefix); idMap.set(arcId, n); return n; };
  const boardsIn = (project.boards ?? {}) as Record<string, Rec>;
  const elementsIn = (project.elements ?? {}) as Record<string, Rec>;
  const jumpersIn = (project.jumpers ?? {}) as Record<string, Rec>;
  const connectionsIn = (project.connections ?? {}) as Record<string, Rec>;
  for (const id of Object.keys(elementsIn)) nid('nel', id);
  for (const id of Object.keys(jumpersIn)) nid('nel', id);
  const boards: Rec[] = [];
  const boardOf = new Map<string, string>();
  for (const [arcId, b] of Object.entries(boardsIn)) {
    if (Array.isArray(b.children)) continue;
    const id = nid('nbd', arcId);
    boards.push({ id, projectId, name: b.name, customId: b.customId ?? null, folderPath: '', sortOrder: boards.length, viewport: {}, createdAt: now(), updatedAt: now() });
    for (const list of [b.elements, b.branches, b.jumpers, b.notes]) for (const c of (Array.isArray(list) ? list : []) as string[]) boardOf.set(c, id);
  }
  const fallback = boards[0]?.id ?? nextId('nbd');
  const elements: Rec[] = [];
  for (const [arcId, e] of Object.entries(elementsIn)) {
    elements.push({ id: nid('nel', arcId), projectId, boardId: boardOf.get(arcId) ?? fallback, kind: 'element', titleHtml: e.title ?? '', contentHtml: e.content ?? '', x: e.x ?? 0, y: e.y ?? 0, width: 260, height: 120, theme: e.theme ?? 'default', coverAssetId: null, customId: e.customId ?? null, jumperTargetId: null, branchConditions: [], version: 1, sortOrder: elements.length, createdAt: now(), updatedAt: now() });
  }
  for (const [arcId, j] of Object.entries(jumpersIn)) {
    const target = typeof j.elementId === 'string' ? idMap.get(j.elementId) ?? null : null;
    if (j.elementId && !target) warnings.push({ message: 'Jumperen peker på et element som ikke finnes.', ref: arcId });
    if (!boardOf.get(arcId)) warnings.push({ message: `Jumperen lå ikke på noe brett — lagt på «${boards[0]?.name ?? 'Brett 1'}».`, ref: arcId });
    elements.push({ id: nid('nel', arcId), projectId, boardId: boardOf.get(arcId) ?? fallback, kind: 'jumper', titleHtml: '', contentHtml: '', x: j.x ?? 0, y: j.y ?? 0, width: 160, height: 60, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: target, branchConditions: [], version: 1, sortOrder: elements.length, createdAt: now(), updatedAt: now() });
  }
  const connections: Rec[] = [];
  for (const [arcId, c] of Object.entries(connectionsIn)) {
    const sourceId = idMap.get(String(c.sourceid));
    const targetId = idMap.get(String(c.targetid));
    if (!sourceId || !targetId) { warnings.push({ message: 'Koblingen peker på noe som ikke finnes og ble droppet.', ref: arcId }); continue; }
    const source = elements.find((e) => e.id === sourceId)!;
    connections.push({ id: nid('ncn', arcId), projectId, boardId: source.boardId, sourceId, targetId, sourceOutputKey: 'default', labelHtml: c.label ?? '', sortOrder: connections.length, createdAt: now(), updatedAt: now() });
  }
  const startingElementId = typeof project.startingElement === 'string' ? idMap.get(project.startingElement) ?? null : null;
  return {
    graph: {
      settings: { projectId, title: (project.name as string) || null, startingElementId, coverAssetId: null, schemaVersion: 1, updatedAt: now() },
      boards, elements, connections, components: [], elementComponents: [], attributes: [], variables: [], assets: [],
    },
    warnings,
  };
}

type Rec = Record<string, unknown>;

interface MockGraph {
  settings: Rec;
  boards: Rec[];
  elements: Rec[];
  connections: Rec[];
  components: Rec[];
  elementComponents: Rec[];
  attributes: Rec[];
  variables: Rec[];
  assets: Rec[];
}

const STATE = new WeakMap<Page, MockGraph>();
let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;
const now = () => new Date().toISOString();

export function seedGraph(projectId: string): MockGraph {
  return {
    settings: { projectId, title: 'Demo-spill', startingElementId: 'nel_start', coverAssetId: null, schemaVersion: 1, updatedAt: now() },
    boards: [{ id: 'nbd_1', projectId, name: 'Akt 1', customId: null, folderPath: '', sortOrder: 0, viewport: {}, createdAt: now(), updatedAt: now() }],
    elements: [
      { id: 'nel_start', projectId, boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Landsbyen</p>', contentHtml: '<p>Du våkner i en stille landsby.</p>', x: 40, y: 80, width: 260, height: 120, theme: 'green', coverAssetId: null, customId: 'start', jumperTargetId: null, branchConditions: [], version: 1, sortOrder: 0, createdAt: now(), updatedAt: now() },
      { id: 'nel_choice', projectId, boardId: 'nbd_1', kind: 'branch', titleHtml: '<p>Har du gull?</p>', contentHtml: '', x: 400, y: 80, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c_yes', script: 'gold >= 10', label: 'Ja' }, { id: 'c_no', script: null, label: 'Ellers' }], version: 1, sortOrder: 1, createdAt: now(), updatedAt: now() },
    ],
    connections: [
      { id: 'ncn_1', projectId, boardId: 'nbd_1', sourceId: 'nel_start', targetId: 'nel_choice', sourceOutputKey: 'default', labelHtml: '<p>Gå til markedet</p>', sortOrder: 0, createdAt: now(), updatedAt: now() },
    ],
    components: [{ id: 'ncp_1', projectId, name: 'Kjøpmannen', folderPath: 'Karakterer', coverAssetId: null, customId: null, sortOrder: 0, createdAt: now(), updatedAt: now() }],
    elementComponents: [],
    attributes: [],
    variables: [{ id: 'nvr_1', projectId, name: 'gold', type: 'int', defaultValue: 0, sortOrder: 0, createdAt: now(), updatedAt: now() }],
    assets: [],
  };
}

function ok(data: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) };
}

export function getMockGraph(page: Page): MockGraph | undefined {
  return STATE.get(page);
}

/**
 * Utvid standard-seed med et spillbart scenario (Play Mode-specs):
 *  start (gold += 10) → «Gå til markedet» → forgrening (gold >= 10) → rik / fattig.
 * Standard-seed endres ikke for andre specs (narrative-board.spec teller 1 kant).
 */
export function seedPlayScenario(g: MockGraph): void {
  const projectId = String(g.settings.projectId);
  const start = g.elements.find((e) => e.id === 'nel_start');
  if (start) start.contentHtml = '<p>Du finner en pung på veien.</p><pre><code>gold += 10</code></pre>';
  g.elements.push(
    { id: 'nel_rich', projectId, boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Rik</p>', contentHtml: '<p>Kjøpmannen smiler. </p><pre><code>show("Du har ", gold, " gull.")</code></pre>', x: 760, y: 20, width: 260, height: 120, theme: 'green', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], version: 1, sortOrder: 2, createdAt: now(), updatedAt: now() },
    { id: 'nel_poor', projectId, boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Fattig</p>', contentHtml: '<p>Kjøpmannen snur ryggen til.</p>', x: 760, y: 200, width: 260, height: 120, theme: 'red', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], version: 1, sortOrder: 3, createdAt: now(), updatedAt: now() },
  );
  g.connections.push(
    { id: 'ncn_yes', projectId, boardId: 'nbd_1', sourceId: 'nel_choice', targetId: 'nel_rich', sourceOutputKey: 'c_yes', labelHtml: '', sortOrder: 0, createdAt: now(), updatedAt: now() },
    { id: 'ncn_no', projectId, boardId: 'nbd_1', sourceId: 'nel_choice', targetId: 'nel_poor', sourceOutputKey: 'c_no', labelHtml: '', sortOrder: 1, createdAt: now(), updatedAt: now() },
  );
  g.elementComponents.push({ elementId: 'nel_rich', componentId: 'ncp_1', sortOrder: 0 });
}

/**
 * Minimal Twee/Ink-konvertering for mocken (passasjer/knots → elementer,
 * [[lenker]]/valg → koblinger). Den fulle konverteringen testes i vitest.
 */
function mockImportText(format: 'twee' | 'ink', source: string, projectId: string, title: string | null): { graph: MockGraph; warnings: Array<{ message: string; ref?: string }> } {
  const warnings: Array<{ message: string; ref?: string }> = [];
  const boardId = nextId('nbd');
  const elements: Rec[] = [];
  const connections: Rec[] = [];
  const byName = new Map<string, string>();
  const addEl = (name: string, content: string) => {
    const id = nextId('nel');
    elements.push({ id, projectId, boardId, kind: 'element', titleHtml: `<p>${name}</p>`, contentHtml: content ? `<p>${content}</p>` : '', x: 40 + elements.length * 320, y: 40, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], version: 1, sortOrder: elements.length, createdAt: now(), updatedAt: now() });
    byName.set(name, id);
    return id;
  };
  const pending: Array<[string, string, string]> = [];
  if (format === 'twee') {
    const chunks = source.split(/^::\s*/m).slice(1);
    for (const chunk of chunks) {
      const [header, ...rest] = chunk.split('\n');
      const name = header.replace(/\s*[\[{].*$/, '').trim();
      if (name === 'StoryTitle' || name === 'StoryData') continue;
      const body = rest.join('\n');
      const id = addEl(name, body.replace(/\[\[[^\]]*\]\]/g, '').replace(/<<[^>]*>>/g, '').trim());
      for (const lm of body.matchAll(/\[\[([^\]]*)\]\]/g)) {
        const inner = lm[1];
        const arrow = inner.indexOf('->'); const pipe = inner.indexOf('|');
        const [text, target] = arrow >= 0 ? [inner.slice(0, arrow), inner.slice(arrow + 2)] : pipe >= 0 ? [inner.slice(0, pipe), inner.slice(pipe + 1)] : [inner, inner];
        pending.push([id, text.trim(), target.trim()]);
      }
    }
  } else {
    const parts = source.split(/^={2,}\s*([A-Za-z_]\w*)\s*=*\s*$/m);
    const top = parts[0].trim();
    if (top) addEl('Start', top.replace(/->.*$/gm, '').trim());
    for (let i = 1; i < parts.length; i += 2) addEl(parts[i], parts[i + 1].replace(/^[*+-].*$|->.*$|~.*$/gm, '').trim());
    for (const dm of source.matchAll(/->\s*([A-Za-z_]\w*)/g)) {
      if (dm[1] === 'END' || dm[1] === 'DONE') continue;
      const src = elements[0]?.id as string | undefined;
      if (src && byName.has(dm[1]) && !pending.some((p) => p[2] === dm[1])) pending.push([src, '', dm[1]]);
    }
  }
  for (const [src, label, target] of pending) {
    const targetId = byName.get(target);
    if (!targetId) { warnings.push({ message: `Lenken «${label || target}» peker på «${target}» som ikke finnes.`, ref: target }); continue; }
    connections.push({ id: nextId('ncn'), projectId, boardId, sourceId: src, targetId, sourceOutputKey: 'default', labelHtml: label ? `<p>${label}</p>` : '', sortOrder: connections.length, createdAt: now(), updatedAt: now() });
  }
  return {
    graph: {
      settings: { projectId, title: title ?? (format === 'twee' ? 'Twee' : 'Ink'), startingElementId: elements[0]?.id ?? null, coverAssetId: null, schemaVersion: 1, updatedAt: now() },
      boards: [{ id: boardId, projectId, name: title ?? format, customId: null, folderPath: '', sortOrder: 0, viewport: {}, createdAt: now(), updatedAt: now() }],
      elements, connections, components: [], elementComponents: [], attributes: [], variables: [], assets: [],
    },
    warnings,
  };
}

export async function installNarrativeMocks(page: Page, opts: { projectId?: string; empty?: boolean } = {}): Promise<void> {
  const projectId = opts.projectId ?? 'proj-game-2026';
  const g: MockGraph = opts.empty
    ? { settings: { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null }, boards: [], elements: [], connections: [], components: [], elementComponents: [], attributes: [], variables: [], assets: [] }
    : seedGraph(projectId);
  STATE.set(page, g);
  // Fase 3: delingslenker (per page) + faste offentlige tokens for /story-specs.
  const shareLinks: Rec[] = [];
  const tokens = new Map<string, Rec>();
  const publicFixed: Record<string, string> = { sgs_e2e_public: 'play_only', sgs_e2e_debug: 'view_play' };

  await page.route('**/api/casting/projects', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ projects: [{ id: projectId, name: 'Demo-spill' }] }),
  }));

  await page.route('**/api/role-room/narrative/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname.replace(/^.*\/api\/role-room\/narrative/, '');
    const body = (method === 'POST' || method === 'PATCH' || method === 'PUT') ? (req.postDataJSON() as Rec | null) ?? {} : {};

    const m = (re: RegExp) => path.match(re);

    if (m(/\/projects\/[^/]+\/graph$/) && method === 'GET') return route.fulfill(ok(g));

    if (m(/\/projects\/[^/]+\/settings$/) && method === 'PUT') {
      g.settings = { ...g.settings, ...body, updatedAt: now() };
      return route.fulfill(ok(g.settings));
    }

    if (m(/\/projects\/[^/]+\/boards$/) && method === 'POST') {
      const board = { id: nextId('nbd'), projectId, name: body.name, customId: null, folderPath: body.folderPath ?? '', sortOrder: 0, viewport: {}, createdAt: now(), updatedAt: now() };
      g.boards.push(board);
      return route.fulfill(ok(board, 201));
    }
    let mm = m(/\/projects\/[^/]+\/boards\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const b = g.boards.find((x) => x.id === mm![1]);
      if (!b) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      Object.assign(b, body, { updatedAt: now() });
      return route.fulfill(ok(b));
    }
    if (mm && method === 'DELETE') {
      g.boards = g.boards.filter((x) => x.id !== mm![1]);
      g.elements = g.elements.filter((x) => x.boardId !== mm![1]);
      g.connections = g.connections.filter((x) => x.boardId !== mm![1]);
      return route.fulfill(ok(null));
    }

    if (m(/\/projects\/[^/]+\/elements$/) && method === 'POST') {
      const element = {
        id: nextId('nel'), projectId, boardId: body.boardId, kind: body.kind ?? 'element',
        titleHtml: body.titleHtml ?? '', contentHtml: body.contentHtml ?? '', x: body.x ?? 0, y: body.y ?? 0,
        width: body.width ?? 260, height: body.height ?? 120, theme: body.theme ?? 'default', coverAssetId: null,
        customId: body.customId ?? null, jumperTargetId: body.jumperTargetId ?? null,
        branchConditions: Array.isArray(body.branchConditions) ? (body.branchConditions as Rec[]).map((c, i) => ({ id: (c.id as string) ?? `cond_${i}`, script: c.script ?? null, label: c.label ?? null })) : [],
        version: 1, sortOrder: g.elements.length, createdAt: now(), updatedAt: now(),
      };
      g.elements.push(element);
      return route.fulfill(ok(element, 201));
    }
    if (m(/\/projects\/[^/]+\/elements\/moves$/) && method === 'POST') {
      const moves = (body.moves as Rec[]) ?? [];
      const out: Rec[] = [];
      for (const mv of moves) {
        const e = g.elements.find((x) => x.id === mv.id);
        if (e) { Object.assign(e, { x: mv.x, y: mv.y, version: (e.version as number) + 1 }); out.push(e); }
      }
      return route.fulfill(ok(out));
    }
    mm = m(/\/projects\/[^/]+\/elements\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const e = g.elements.find((x) => x.id === mm![1]);
      if (!e) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      const ifMatch = req.headers()['if-match'];
      if (ifMatch && Number(ifMatch) !== e.version) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'conflict', data: e }) });
      }
      Object.assign(e, body, { version: (e.version as number) + 1, updatedAt: now() });
      return route.fulfill(ok(e));
    }
    if (mm && method === 'DELETE') {
      g.elements = g.elements.filter((x) => x.id !== mm![1]);
      g.connections = g.connections.filter((x) => x.sourceId !== mm![1] && x.targetId !== mm![1]);
      return route.fulfill(ok(null));
    }
    mm = m(/\/projects\/[^/]+\/elements\/([^/]+)\/components$/);
    if (mm && method === 'PUT') {
      const ids = (body.componentIds as string[]) ?? [];
      g.elementComponents = g.elementComponents.filter((x) => x.elementId !== mm![1]);
      const out = ids.map((componentId, sortOrder) => ({ elementId: mm![1], componentId, sortOrder }));
      g.elementComponents.push(...out);
      return route.fulfill(ok(out));
    }

    if (m(/\/projects\/[^/]+\/connections$/) && method === 'POST') {
      const c = { id: nextId('ncn'), projectId, boardId: body.boardId, sourceId: body.sourceId, targetId: body.targetId, sourceOutputKey: body.sourceOutputKey ?? 'default', labelHtml: body.labelHtml ?? '', sortOrder: 0, createdAt: now(), updatedAt: now() };
      g.connections.push(c);
      return route.fulfill(ok(c, 201));
    }
    mm = m(/\/projects\/[^/]+\/connections\/([^/]+)$/);
    if (mm && method === 'DELETE') {
      g.connections = g.connections.filter((x) => x.id !== mm![1]);
      return route.fulfill(ok(null));
    }

    if (m(/\/projects\/[^/]+\/components$/) && method === 'POST') {
      const c = { id: nextId('ncp'), projectId, name: body.name, folderPath: body.folderPath ?? '', coverAssetId: null, customId: null, sortOrder: 0, createdAt: now(), updatedAt: now() };
      g.components.push(c);
      return route.fulfill(ok(c, 201));
    }
    mm = m(/\/projects\/[^/]+\/components\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const c = g.components.find((x) => x.id === mm![1]);
      if (!c) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      Object.assign(c, body, { updatedAt: now() });
      return route.fulfill(ok(c));
    }
    if (mm && method === 'DELETE') {
      g.components = g.components.filter((x) => x.id !== mm![1]);
      return route.fulfill(ok(null));
    }

    if (m(/\/projects\/[^/]+\/attributes$/) && method === 'POST') {
      const a = { id: nextId('nat'), projectId, ownerKind: body.ownerKind, ownerId: body.ownerId, name: body.name, type: body.type ?? 'string', value: body.value ?? null, customId: null, sortOrder: 0, createdAt: now(), updatedAt: now() };
      g.attributes.push(a);
      return route.fulfill(ok(a, 201));
    }
    mm = m(/\/projects\/[^/]+\/attributes\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const a = g.attributes.find((x) => x.id === mm![1]);
      if (!a) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      Object.assign(a, body, { updatedAt: now() });
      return route.fulfill(ok(a));
    }
    if (mm && method === 'DELETE') {
      g.attributes = g.attributes.filter((x) => x.id !== mm![1]);
      return route.fulfill(ok(null));
    }

    if (m(/\/projects\/[^/]+\/variables$/) && method === 'POST') {
      if (g.variables.some((v) => v.name === body.name)) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate_name', message: 'En variabel med dette navnet finnes allerede.' }) });
      }
      const v = { id: nextId('nvr'), projectId, name: body.name, type: body.type ?? 'bool', defaultValue: body.defaultValue ?? false, sortOrder: g.variables.length, createdAt: now(), updatedAt: now() };
      g.variables.push(v);
      return route.fulfill(ok(v, 201));
    }
    mm = m(/\/projects\/[^/]+\/variables\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const v = g.variables.find((x) => x.id === mm![1]);
      if (!v) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      Object.assign(v, body, { updatedAt: now() });
      return route.fulfill(ok(v));
    }
    if (mm && method === 'DELETE') {
      g.variables = g.variables.filter((x) => x.id !== mm![1]);
      return route.fulfill(ok(null));
    }

    if (m(/\/projects\/[^/]+\/assets$/) && method === 'POST') {
      const a = { id: nextId('nas'), projectId, kind: body.kind ?? 'image', name: body.name, storageKey: null, externalUrl: body.externalUrl ?? null, mime: null, sizeBytes: null, folderPath: '', createdAt: now(), updatedAt: now() };
      g.assets.push(a);
      return route.fulfill(ok(a, 201));
    }
    mm = m(/\/projects\/[^/]+\/assets\/([^/]+)$/);
    if (mm && method === 'DELETE') {
      g.assets = g.assets.filter((x) => x.id !== mm![1]);
      return route.fulfill(ok(null));
    }

    if (m(/\/projects\/[^/]+\/revisions$/) && method === 'GET') {
      return route.fulfill(ok([{ id: 'nrv_1', projectId, label: 'Første utkast', createdBy: 'u1', createdAt: now(), counts: { boards: 1, elements: 2, connections: 1, components: 1 } }]));
    }
    if (m(/\/projects\/[^/]+\/revisions$/) && method === 'POST') {
      return route.fulfill(ok({ id: nextId('nrv'), projectId, label: body.label ?? null, createdBy: 'u1', createdAt: now(), counts: { boards: g.boards.length, elements: g.elements.length, connections: g.connections.length, components: g.components.length } }, 201));
    }
    if (m(/\/projects\/[^/]+\/revisions\/[^/]+\/restore$/) && method === 'POST') {
      return route.fulfill(ok({ backup: { id: nextId('nrv'), projectId, label: 'Før gjenoppretting', createdBy: 'u1', createdAt: now(), counts: { boards: 1, elements: 2, connections: 1, components: 1 } }, graph: g }));
    }

    // ── Fase 3: import, delingslenker, offentlig spill ─────────────────
    if (m(/\/projects\/[^/]+\/import$/) && method === 'POST') {
      const format = (body.format as string | undefined) ?? 'arcweave';
      let imported: { graph: MockGraph; warnings: Array<{ message: string; ref?: string }> };
      if (format === 'twee' || format === 'ink') {
        if (typeof body.source !== 'string' || !body.source.trim()) {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_project', message: 'Tom kilde.' }) });
        }
        imported = mockImportText(format, body.source, projectId, (body.title as string | null) ?? null);
      } else {
        const project = body.project;
        if (!project || typeof project !== 'object' || !(project as Rec).boards) {
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_project', message: 'Ikke et Arcweave-prosjekt.' }) });
        }
        imported = mockImportArcweave(project as Rec, projectId);
      }
      Object.assign(g, imported.graph);
      const backup = { id: nextId('nrv'), projectId, label: 'Før import', createdBy: 'u1', createdAt: now(), counts: { boards: 1, elements: 2, connections: 1, components: 1 } };
      const stats = { elements: g.elements.length, connections: g.connections.length, variables: g.variables.length, unsupported: imported.warnings.length };
      return route.fulfill(ok({ graph: g, warnings: imported.warnings, backup, format, stats }));
    }
    if (m(/\/projects\/[^/]+\/share-links$/) && method === 'GET') return route.fulfill(ok(shareLinks));
    if (m(/\/projects\/[^/]+\/share-links$/) && method === 'POST') {
      const link = {
        id: nextId('nsl'), projectId, mode: body.mode ?? 'play_only',
        expiresAt: typeof body.expiresInDays === 'number' ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString() : null,
        revokedAt: null, viewCount: 0, createdBy: 'u1', createdAt: now(),
      };
      shareLinks.unshift(link);
      const token = `sgs_e2e_${link.id}`;
      tokens.set(token, link);
      return route.fulfill(ok({ link, token, path: `/story/${token}` }, 201));
    }
    mm = m(/\/projects\/[^/]+\/share-links\/([^/]+)\/revoke$/);
    if (mm && method === 'POST') {
      const link = shareLinks.find((l) => l.id === mm![1]);
      if (!link) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      link.revokedAt = now();
      return route.fulfill(ok(link));
    }
    mm = m(/\/public\/([^/]+)$/);
    if (mm && method === 'GET') {
      const token = decodeURIComponent(mm[1]);
      const link = tokens.get(token);
      const mode = link && !link.revokedAt ? (link.mode as string) : publicFixed[token];
      if (!mode) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      const graph = { ...g, elements: g.elements.filter((e) => e.kind !== 'note') };
      return route.fulfill(ok({ title: g.settings.title ?? 'Story Graph', mode, graph }));
    }

    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', path, method }) });
  });
}
