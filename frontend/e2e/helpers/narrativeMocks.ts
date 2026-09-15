/**
 * narrativeMocks — page.route()-installer for /api/role-room/narrative/*.
 *
 * Holder en in-memory graf per page slik at POST/PATCH/DELETE reflekteres i
 * neste GET /graph. Alle svar bruker { success: true, data } — kontrakten
 * narrativeService forventer.
 */
import type { Page, Route } from '@playwright/test';

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

export async function installNarrativeMocks(page: Page, opts: { projectId?: string; empty?: boolean } = {}): Promise<void> {
  const projectId = opts.projectId ?? 'proj-game-2026';
  const g: MockGraph = opts.empty
    ? { settings: { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null }, boards: [], elements: [], connections: [], components: [], elementComponents: [], attributes: [], variables: [], assets: [] }
    : seedGraph(projectId);
  STATE.set(page, g);

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

    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', path, method }) });
  });
}
