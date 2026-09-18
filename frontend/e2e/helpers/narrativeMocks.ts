/**
 * narrativeMocks — page.route()-installer for /api/role-room/narrative/*.
 *
 * Holder en in-memory graf per page slik at POST/PATCH/DELETE reflekteres i
 * neste GET /graph. Alle svar bruker { success: true, data } — kontrakten
 * narrativeService forventer.
 */
import type { Page, Route } from '@playwright/test';

// ─── Fase 4d: /api/game/billing (plan-gating) ──────────────────────────
// Fixture speiler seeden i 0621_game_billing.sql; standardplan i specs er
// `studio` (alt åpent) så eksisterende specs er upåvirket.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const gamePlansFixture = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'game', 'plans.json'), 'utf8')) as unknown;
// Fase 7a-2: det ekte prosjektet («What Follows Us») som strukturert fixture — delt med backend-seederen.
import type { StoryGraphFixture } from '../../shared/narrative-fixtures/types';
const WFU_FIXTURE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'narrative-fixtures', 'what-follows-us.json');
export function loadWhatFollowsUsFixture(): StoryGraphFixture {
  return JSON.parse(fs.readFileSync(WFU_FIXTURE_PATH, 'utf8')) as StoryGraphFixture;
}
export type NarrativeMockSeed = 'default' | 'what-follows-us';

export async function installGameBillingMocks(page: Page, plan: MockGamePlanSlug): Promise<void> {
  const plans = gamePlansFixture as Array<Record<string, unknown> & { slug: string }>;
  const current = plans.find((p) => p.slug === plan) ?? plans[0];
  const subscription = plan === 'solo' ? null : {
    userId: 'u-e2e', planSlug: plan, billingPeriod: 'monthly', status: 'active', stripeCustomerId: 'cus_e2e', stripeSubscriptionId: 'sub_e2e',
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000).toISOString(), trialEndAt: null, cancelAtPeriodEnd: false,
    testerInviteToken: null, compGrantedByUserId: null, compExpiresAt: null, notes: null, createdAt: now(), updatedAt: now(),
  };
  const invites: Rec[] = [];
  const settings: Rec[] = [{ key: 'beta_mode', value: { enabled: true, label: 'BETA' }, description: 'Beta-merke', updatedByUserId: null, updatedAt: now() }];
  await page.route('**/api/game/billing/**', async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/game\/billing/, '');
    const method = req.method();
    const body = (method === 'POST' || method === 'PATCH' || method === 'PUT') ? (req.postDataJSON() as Rec | null) ?? {} : {};
    if (path === '/plans' && method === 'GET') return route.fulfill(ok(plans));
    if (path === '/admin/plans' && method === 'GET') return route.fulfill(ok(plans));
    if (path === '/admin/plans' && method === 'POST') { const p = { ...body, createdAt: now(), updatedAt: now() }; plans.push(p as typeof plans[number]); return route.fulfill(ok(p, 201)); }
    if (path.startsWith('/admin/plans/') && method === 'PATCH') { const slug = decodeURIComponent(path.split('/')[3]); const p = plans.find((x) => x.slug === slug); if (!p) return route.fulfill({ status: 404, body: '{"error":"not_found"}' }); Object.assign(p, body); return route.fulfill(ok(p)); }
    if (path === '/subscription' && method === 'GET') return route.fulfill(ok(subscription));
    if (path === '/me' && method === 'GET') return route.fulfill(ok({ subscription, plan: current, active: subscription !== null }));
    if (path === '/checkout-session' && method === 'POST') return route.fulfill(ok({ sessionUrl: 'https://checkout.stripe.com/mock-session' }));
    if (path === '/customer-portal' && method === 'POST') return route.fulfill(ok({ portalUrl: 'https://billing.stripe.com/mock-portal' }));
    if (path === '/admin/tester-invites' && method === 'GET') return route.fulfill(ok(invites));
    if (path === '/admin/tester-invites' && method === 'POST') { const inv = { token: `tok_${invites.length + 1}`, invitedByUserId: 'u-e2e', usedCount: 0, acceptedAt: null, acceptedUserId: null, validUntil: null, invitedEmail: null, invitedName: null, notes: null, trialDays: 90, maxUses: 1, ...body, createdAt: now(), updatedAt: now() }; invites.unshift(inv); return route.fulfill(ok(inv, 201)); }
    if (path === '/admin/settings' && method === 'GET') return route.fulfill(ok(settings));
    if (path.startsWith('/admin/settings/') && method === 'PUT') { const key = decodeURIComponent(path.split('/')[3]); const s = settings.find((x) => x.key === key) ?? (settings.push({ key }) && settings[settings.length - 1]); Object.assign(s, body, { updatedAt: now() }); return route.fulfill(ok(s)); }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', path, method }) });
  });

}

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
const SCENES = new WeakMap<Page, Rec[]>();
let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;
const now = () => new Date().toISOString();

export function seedGraph(projectId: string): MockGraph {
  return {
    settings: { projectId, title: 'Demo-spill', startingElementId: 'nel_start', coverAssetId: null, schemaVersion: 1, updatedAt: now(), locales: ['nb', 'en'], i18n: {} },
    boards: [{ id: 'nbd_1', projectId, name: 'Akt 1', customId: null, folderPath: '', sortOrder: 0, viewport: {}, createdAt: now(), updatedAt: now() }],
    elements: [
      { id: 'nel_start', projectId, boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Landsbyen</p>', contentHtml: '<p>Du våkner i en stille landsby.</p>', x: 40, y: 80, width: 260, height: 120, theme: 'green', coverAssetId: null, customId: 'start', jumperTargetId: null, branchConditions: [], version: 1, sortOrder: 0, createdAt: now(), updatedAt: now(), i18n: {} },
      { id: 'nel_choice', projectId, boardId: 'nbd_1', kind: 'branch', titleHtml: '<p>Har du gull?</p>', contentHtml: '', x: 400, y: 80, width: 260, height: 120, theme: 'default', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: 'c_yes', script: 'gold >= 10', label: 'Ja' }, { id: 'c_no', script: null, label: 'Ellers' }], version: 1, sortOrder: 1, createdAt: now(), updatedAt: now(), i18n: {} },
    ],
    connections: [
      { id: 'ncn_1', projectId, boardId: 'nbd_1', sourceId: 'nel_start', targetId: 'nel_choice', sourceOutputKey: 'default', labelHtml: '<p>Gå til markedet</p>', sortOrder: 0, createdAt: now(), updatedAt: now(), i18n: {} },
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

export type MockGamePlanSlug = 'solo' | 'pro' | 'studio';

export async function installNarrativeMocks(page: Page, opts: { projectId?: string; empty?: boolean; gamePlan?: MockGamePlanSlug; seed?: NarrativeMockSeed } = {}): Promise<void> {
  const projectId = opts.projectId ?? 'proj-game-2026';
  const gamePlan = opts.gamePlan ?? 'studio';
  await installGameBillingMocks(page, gamePlan);
  const g: MockGraph = opts.empty
    ? { settings: { projectId, title: null, startingElementId: null, coverAssetId: null, schemaVersion: 1, updatedAt: null }, boards: [], elements: [], connections: [], components: [], elementComponents: [], attributes: [], variables: [], assets: [] }
    : seedGraph(projectId);
  STATE.set(page, g);
  // Fase 3: delingslenker (per page) + faste offentlige tokens for /story-specs.
  const shareLinks: Rec[] = [];
  const tokens = new Map<string, Rec>();
  const publicFixed: Record<string, string> = { sgs_e2e_public: 'play_only', sgs_e2e_debug: 'view_play' };
  // Fase 6: scener, rammer, lenker, oppgaver, review-runder (in-memory) + medlemmer.
  const scenes: Rec[] = [];
  SCENES.set(page, scenes);
  const frames: Rec[] = [];
  const links: Rec[] = [];
  const tasks: Rec[] = [];
  const reviews: Rec[] = [];
  const members = [
    { userId: 'u-e2e', displayName: 'Meg Selv', profileImageUrl: null, isOwner: true },
    { userId: 'u-kari', displayName: 'Kari Nordmann', profileImageUrl: null, isOwner: false },
  ];
  // ── Fase 7: produksjons-OS (in-memory) ──
  const gates: Rec[] = [];
  const lines: Rec[] = [];
  const episodes: Rec[] = [];
  const openQuestions: Rec[] = [];
  const sources: Rec[] = [];
  const milestones: Rec[] = [];
  const platformTargets: Rec[] = [];
  const inbox: Rec[] = [
    { id: 'ntf_1', eventType: 'narrative_scene_review_requested', title: 'Review: P01 – Skoleveien', message: 'Kari ba om review av runde 1.', linkedEntityType: 'narrative_scene', linkedEntityId: null, createdByUserId: 'u-kari', createdAt: now(), updatedAt: now(), readAt: null },
    { id: 'ntf_2', eventType: 'narrative_scene_review_decided', title: 'Godkjent: S1', message: null, linkedEntityType: 'narrative_scene', linkedEntityId: null, createdByUserId: 'u-kari', createdAt: now(), updatedAt: now(), readAt: now() },
  ];
  const reviewShareLinks: Rec[] = [];
  const reviewerSessions: Rec[] = [];
  const GATE_KEYS = ['script_coverage', 'greybox', 'characters_animation', 'playthrough', 'picture', 'audio'];
  const gatesFor = (sceneId: string) => GATE_KEYS.map((k) => gates.find((x) => x.sceneId === sceneId && x.gateKey === k) ?? { sceneId, projectId, gateKey: k, status: 'not_started', evidence: '', evidenceRefs: [], checkedBy: null, checkedAt: null, updatedAt: null });
  if (opts.seed === 'what-follows-us') {
    const fx = loadWhatFollowsUsFixture();
    for (const src of fx.sources) sources.push({ id: nextId('nso'), projectId, code: src.code, label: src.label, kind: src.kind, sha256: src.sha256 ?? null, pathHint: src.pathHint ?? '', notes: src.notes ?? '', verifiedAt: null, verifiedBy: null, sortOrder: sources.length, createdAt: now(), updatedAt: now() });
    const episodeIdByCode = new Map<string, string>();
    for (const e of fx.episodes) { const id = nextId('nep'); episodeIdByCode.set(e.code.toUpperCase(), id); episodes.push({ id, projectId, code: e.code, title: e.title, summary: e.summary ?? '', playersLearn: e.playersLearn ?? '', sourceNote: e.sourceNote ?? '', status: e.status ?? 'draft', sortOrder: episodes.length, createdAt: now(), updatedAt: now() }); }
    const componentIdByCustomId = new Map<string, string>();
    for (const c of fx.components) {
      const id = nextId('ncp'); componentIdByCustomId.set(c.customId, id);
      g.components.push({ id, projectId, name: c.name, folderPath: c.folderPath ?? '', coverAssetId: null, customId: c.customId, sortOrder: g.components.length, kind: c.kind, profile: c.profile as Rec, createdAt: now(), updatedAt: now() } as unknown as MockGraph['components'][number]);
      for (const a of c.attributes ?? []) g.attributes.push({ id: nextId('nat'), projectId, ownerKind: 'component', ownerId: id, name: a.name, type: a.type, value: a.value, customId: null, sortOrder: 0, createdAt: now(), updatedAt: now() } as unknown as MockGraph['attributes'][number]);
    }
    for (const sc of fx.scenes) {
      const id = `nsc_${sc.code.toLowerCase()}`; // deterministisk så specs kan bruke ?scene=nsc_p01
      scenes.push({
        id, projectId, code: sc.code.toUpperCase(), workingId: sc.workingId ?? null, title: sc.title, subtitle: sc.subtitle ?? '', location: sc.location ?? '', challenge: sc.challenge ?? '', gameplayMechanic: sc.gameplayMechanic ?? '', environment: sc.environment ?? '',
        status: sc.status ?? 'idea', assigneeUserId: null, dueAt: null, startAt: null, heroAssetId: null, sortOrder: scenes.length, createdBy: 'u-seed', createdAt: now(), updatedAt: now(),
        beforeState: sc.beforeState ?? '', action: sc.action ?? '', control: sc.control ?? '', afterState: sc.afterState ?? '', audio: sc.audio ?? '', changeNote: sc.changeNote ?? '', bridge: sc.bridge ?? '', timeNote: sc.timeNote ?? '',
        knowledge: sc.knowledge ?? {}, era: sc.era, episodeId: sc.episode ? episodeIdByCode.get(sc.episode.toUpperCase()) ?? null : null, sourceRefs: sc.sourceRefs,
      });
      for (const cid of sc.components ?? []) { const oid = componentIdByCustomId.get(cid); if (oid) links.push({ sceneId: id, ownerKind: 'component', ownerId: oid, sortOrder: links.length }); }
      for (const l of sc.lines ?? []) lines.push({ id: nextId('nsl'), sceneId: id, projectId, cueId: l.cueId.toUpperCase(), speakerComponentId: l.speaker ? componentIdByCustomId.get(l.speaker) ?? null : null, speakerLabel: l.speakerLabel, perspective: l.perspective ?? '', textEn: l.textEn, textNb: l.textNb ?? '', sourceType: l.sourceType, recordingStatus: l.recordingStatus ?? 'none', note: l.note ?? '', sortOrder: lines.filter((x) => x.sceneId === id).length, createdBy: 'u-seed', createdAt: now(), updatedAt: now() });
      for (const gt of sc.gates ?? []) gates.push({ sceneId: id, projectId, gateKey: gt.key, status: gt.status, evidence: gt.evidence ?? '', evidenceRefs: gt.evidenceRefs ?? [], checkedBy: 'u-seed', checkedAt: now(), updatedAt: now() });
      for (const t of sc.tasks ?? []) tasks.push({ id: nextId('nst'), sceneId: id, projectId, title: t.title, status: t.status ?? 'todo', assigneeUserId: null, dueAt: null, completedAt: null, sortOrder: tasks.length, createdBy: 'u-seed', createdAt: now(), updatedAt: now() });
    }
    for (const q of fx.openQuestions) openQuestions.push({ id: nextId('noq'), projectId, code: q.code, kind: q.kind, question: q.question, context: q.context ?? '', status: q.status ?? 'open', decision: q.decision ?? '', decidedBy: null, decidedAt: null, sourceRefs: q.sourceRefs ?? [], sortOrder: openQuestions.length, createdAt: now(), updatedAt: now() });
    for (const m of fx.milestones) milestones.push({ id: nextId('nms'), projectId, title: m.title, lane: m.lane, status: m.status ?? 'planned', startAt: m.startAt ?? null, dueAt: m.dueAt ?? null, ownerUserId: null, description: m.description ?? '', acceptance: m.acceptance ?? '', evidence: m.evidence ?? '', sortOrder: milestones.length, sceneIds: (m.scenes ?? []).map((c) => scenes.find((x) => x.code === c.toUpperCase())?.id).filter(Boolean), createdAt: now(), updatedAt: now() });
    for (const t of fx.platformTargets) platformTargets.push({ id: nextId('npt'), projectId, name: t.name, platform: t.platform, isPrimary: t.isPrimary ?? false, engine: t.engine ?? '', osMin: t.osMin ?? '', deviceMin: t.deviceMin ?? '', inputModel: t.inputModel ?? '', budgets: t.budgets ?? {}, requirements: t.requirements ?? [], visualDirection: t.visualDirection ?? {}, notes: t.notes ?? '', sortOrder: platformTargets.length, createdAt: now(), updatedAt: now() });
    g.settings.title = fx.meta.title;
  }
  const sceneSnapshotHash = (sceneId: string): string => {
    const sc = scenes.find((x) => x.id === sceneId);
    const snap = JSON.stringify({
      code: sc?.code, title: sc?.title, subtitle: sc?.subtitle, location: sc?.location, challenge: sc?.challenge, gameplayMechanic: sc?.gameplayMechanic, environment: sc?.environment, heroAssetId: sc?.heroAssetId,
      frames: frames.filter((f) => f.sceneId === sceneId).map((f) => [f.assetId, f.externalUrl, f.caption]),
      links: links.filter((l) => l.sceneId === sceneId).map((l) => [l.ownerKind, l.ownerId]),
    });
    let h = 5381;
    for (let i = 0; i < snap.length; i += 1) h = ((h * 33) ^ snap.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0').repeat(8);
  };
  const sceneSummary = (sc: Rec) => {
    const latest = reviews.filter((r) => r.sceneId === sc.id).sort((a, b) => (b.round as number) - (a.round as number))[0];
    const t = tasks.filter((x) => x.sceneId === sc.id);
    return { ...sc, latestReview: latest ? { id: latest.id, round: latest.round, status: latest.status, requestedAt: latest.requestedAt, decidedAt: latest.decidedAt } : null, taskCounts: { total: t.length, done: t.filter((x) => x.status === 'done').length } };
  };
  const nextSceneCode = () => { let max = 0; for (const sc of scenes) { const mm = /^S(\d+)$/.exec(String(sc.code)); if (mm) max = Math.max(max, Number(mm[1])); } return `S${max + 1}`; };
  const comments: Rec[] = [];
  await page.route('**/api/role-room/editor-comments**', async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    if (method === 'GET') {
      const pid = url.searchParams.get('projectId');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: comments.filter((c) => c.projectId === pid), serverTime: now() }) });
    }
    if (method === 'POST') {
      const b = (req.postDataJSON() as Rec | null) ?? {};
      const c = { id: nextId('cmt'), projectId: b.projectId, anchorType: b.anchorType, anchorRef: b.anchorRef ?? null, timestampSec: null, commentText: b.commentText, parentId: b.parentId ?? null, status: 'open', priority: b.priority ?? 'normal', authorDisplayName: b.authorDisplayName ?? 'Meg Selv', authorId: 'u-e2e', createdAt: now(), updatedAt: now(), replyCount: 0 };
      comments.push(c);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: c.id, createdAt: c.createdAt }) });
    }
    if (method === 'PATCH') {
      const id = url.pathname.split('/').pop();
      const c = comments.find((x) => x.id === id);
      if (c) Object.assign(c, (req.postDataJSON() as Rec | null) ?? {}, { updatedAt: now() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
  });

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
    if (m(/\/projects\/[^/]+\/export\.pdf$/) && method === 'GET') {
      if (gamePlan === 'solo') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'export_pdf', planSlug: 'solo' }) });
      const locale = url.searchParams.get('locale');
      return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'content-disposition': `attachment; filename="demo-spill${locale ? `-${locale}` : ''}.pdf"` }, body: Buffer.from('%PDF-1.4\n%mock\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') });
    }

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
      const c = { id: nextId('ncp'), projectId, name: body.name, folderPath: body.folderPath ?? '', coverAssetId: null, customId: body.customId ?? null, sortOrder: 0, kind: body.kind ?? 'other', profile: body.profile ?? {}, createdAt: now(), updatedAt: now() };
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
    // ── Fase 4b: oversettelser ─────────────────────────────────────────
    if (m(/\/projects\/[^/]+\/translations$/) && method === 'PUT') {
      const locale = String(body.locale);
      let saved = 0;
      for (const entry of (body.entries as Array<Rec>) ?? []) {
        const rows = entry.ownerKind === 'element' ? g.elements : entry.ownerKind === 'connection' ? g.connections : null;
        if (rows) {
          const row = rows.find((r) => r.id === entry.id);
          if (!row) continue;
          const i18n = (row.i18n as Record<string, Rec>) ?? {};
          i18n[locale] = { ...(i18n[locale] ?? {}), [String(entry.field)]: entry.html };
          row.i18n = i18n;
          saved += 1;
        } else if (entry.ownerKind === 'settings') {
          const i18n = (g.settings.i18n as Record<string, Rec>) ?? {};
          i18n[locale] = { ...(i18n[locale] ?? {}), title: entry.html };
          g.settings.i18n = i18n;
          saved += 1;
        }
      }
      return route.fulfill(ok({ saved }));
    }
    if (m(/\/projects\/[^/]+\/translate$/) && method === 'POST') {
      const segments = (body.segments as Array<{ key: string; text: string }>) ?? [];
      return route.fulfill(ok({ translations: segments.map((s) => ({ key: s.key, text: `[${body.targetLocale}] ${s.text}` })), missing: [], model: 'mock' }));
    }

    if (m(/\/projects\/[^/]+\/share-links$/) && method === 'GET') return route.fulfill(ok(reviewShareLinks));
    if (m(/\/projects\/[^/]+\/share-links$/) && method === 'POST') {
      const link = {
        id: nextId('nsl'), projectId, mode: body.mode ?? 'play_only',
        expiresAt: typeof body.expiresInDays === 'number' ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString() : null,
        revokedAt: null, viewCount: 0, createdBy: 'u1', createdAt: now(),
      };
      reviewShareLinks.unshift(link);
      const token = `sgs_e2e_${link.id}`;
      tokens.set(token, link);
      return route.fulfill(ok({ link, token, path: `/story/${token}` }, 201));
    }
    mm = m(/\/projects\/[^/]+\/share-links\/([^/]+)\/revoke$/);
    if (mm && method === 'POST') {
      const link = reviewShareLinks.find((l) => l.id === mm![1]);
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

    // ── Fase 6: scener & gameplay + review ─────────────────────────────
    if (m(/\/projects\/[^/]+\/members-lite$/) && method === 'GET') return route.fulfill(ok(members));
    if (m(/\/projects\/[^/]+\/scenes$/) && method === 'GET') return route.fulfill(ok({ scenes: scenes.map(sceneSummary), nextCode: nextSceneCode() }));
    if (m(/\/projects\/[^/]+\/scenes$/) && method === 'POST') {
      const code = typeof body.code === 'string' && body.code.trim() ? body.code.trim().toUpperCase() : nextSceneCode();
      if (scenes.some((sc) => sc.code === code)) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate_code', code }) });
      const sc = {
        id: nextId('nsc'), projectId, code, title: body.title ?? '', subtitle: body.subtitle ?? '', location: body.location ?? '', challenge: body.challenge ?? '', gameplayMechanic: body.gameplayMechanic ?? '', environment: body.environment ?? '', status: body.status ?? 'idea', assigneeUserId: body.assigneeUserId ?? null, dueAt: body.dueAt ?? null, heroAssetId: body.heroAssetId ?? null, sortOrder: scenes.length, createdBy: 'u-e2e', createdAt: now(), updatedAt: now(),
        beforeState: body.beforeState ?? '', action: body.action ?? '', control: body.control ?? '', afterState: body.afterState ?? '', audio: body.audio ?? '', changeNote: body.changeNote ?? '', bridge: body.bridge ?? '', timeNote: body.timeNote ?? '',
        knowledge: body.knowledge ?? {}, era: body.era ?? 'other', episodeId: body.episodeId ?? null, startAt: body.startAt ?? null, sourceRefs: body.sourceRefs ?? [], workingId: body.workingId ?? null,
      };
      scenes.push(sc);
      return route.fulfill(ok(sc, 201));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)$/);
    if (mm) {
      const sc = scenes.find((x) => x.id === mm![1]);
      if (!sc) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      if (method === 'GET') {
        return route.fulfill(ok({
          scene: sc,
          links: links.filter((l) => l.sceneId === sc.id),
          frames: frames.filter((f) => f.sceneId === sc.id).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number)),
          tasks: tasks.filter((t) => t.sceneId === sc.id),
          reviews: reviews.filter((r) => r.sceneId === sc.id).sort((a, b) => (b.round as number) - (a.round as number)),
          gates: gatesFor(sc.id),
          lines: lines.filter((l) => l.sceneId === sc.id).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number)),
          currentSnapshotHash: sceneSnapshotHash(sc.id),
        }));
      }
      if (method === 'PATCH') {
        if (typeof body.code === 'string' && body.code && scenes.some((x) => x.id !== sc.id && x.code === String(body.code).toUpperCase())) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate_code', code: body.code }) });
        Object.assign(sc, body, typeof body.code === 'string' && body.code ? { code: String(body.code).toUpperCase() } : {}, { updatedAt: now() });
        return route.fulfill(ok(sc));
      }
      if (method === 'DELETE') {
        scenes.splice(scenes.indexOf(sc), 1);
        return route.fulfill(ok(null));
      }
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/links$/);
    if (mm && method === 'PUT') {
      const sid = mm[1];
      for (let i = links.length - 1; i >= 0; i -= 1) if (links[i].sceneId === sid) links.splice(i, 1);
      const out = ((body.links as Rec[]) ?? []).filter((l) => (l.ownerKind === 'element' ? g.elements : g.boards).some((x) => x.id === l.ownerId)).map((l, sortOrder) => ({ sceneId: sid, ownerKind: l.ownerKind, ownerId: l.ownerId, sortOrder }));
      links.push(...out);
      return route.fulfill(ok(out));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/frames$/);
    if (mm && method === 'POST') {
      const f = { id: nextId('nsf'), sceneId: mm[1], projectId, assetId: body.assetId ?? null, externalUrl: body.assetId ? null : body.externalUrl ?? null, caption: body.caption ?? '', sortOrder: frames.filter((x) => x.sceneId === mm![1]).length, createdAt: now(), updatedAt: now() };
      frames.push(f);
      return route.fulfill(ok(f, 201));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/frames\/order$/);
    if (mm && method === 'PUT') {
      ((body.orderedIds as string[]) ?? []).forEach((id, i) => { const f = frames.find((x) => x.id === id); if (f) f.sortOrder = i; });
      return route.fulfill(ok(null));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/frames\/([^/]+)$/);
    if (mm && method === 'PATCH') { const f = frames.find((x) => x.id === mm![2]); if (!f) return route.fulfill({ status: 404, body: '{"error":"not_found"}' }); Object.assign(f, body, { updatedAt: now() }); return route.fulfill(ok(f)); }
    if (mm && method === 'DELETE') { const i = frames.findIndex((x) => x.id === mm![2]); if (i >= 0) frames.splice(i, 1); return route.fulfill(ok(null)); }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/tasks$/);
    if (mm && method === 'POST') {
      const t = { id: nextId('nst'), sceneId: mm[1], projectId, title: body.title, status: body.status ?? 'todo', assigneeUserId: body.assigneeUserId ?? null, dueAt: body.dueAt ?? null, completedAt: null, sortOrder: tasks.length, createdBy: 'u-e2e', createdAt: now(), updatedAt: now() };
      tasks.push(t);
      return route.fulfill(ok(t, 201));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/tasks\/([^/]+)$/);
    if (mm && method === 'PATCH') {
      const t = tasks.find((x) => x.id === mm![2]);
      if (!t) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      Object.assign(t, body, { updatedAt: now() });
      if (body.status === 'done') t.completedAt = t.completedAt ?? now(); else if (body.status) t.completedAt = null;
      return route.fulfill(ok(t));
    }
    if (mm && method === 'DELETE') { const i = tasks.findIndex((x) => x.id === mm![2]); if (i >= 0) tasks.splice(i, 1); return route.fulfill(ok(null)); }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/reviews$/);
    if (mm && method === 'GET') return route.fulfill(ok(reviews.filter((r) => r.sceneId === mm![1])));
    if (mm && method === 'POST') {
      if (gamePlan === 'solo') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'scene_review', planSlug: 'solo' }) });
      const sc = scenes.find((x) => x.id === mm![1]);
      if (!sc) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      for (const r of reviews) if (r.sceneId === sc.id && r.status === 'in_review') r.status = 'superseded';
      const round = reviews.filter((r) => r.sceneId === sc.id).length + 1;
      const r = { id: nextId('nsr'), sceneId: sc.id, projectId, round, status: 'in_review', requestedBy: 'u-e2e', requestedAt: now(), requestNote: body.note ?? null, decidedByUserId: null, decidedByLabel: null, decidedAt: null, decisionNote: null, snapshotHash: sceneSnapshotHash(sc.id) };
      reviews.push(r);
      sc.status = 'in_review';
      return route.fulfill(ok(r, 201));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/reviews\/([^/]+)\/decision$/);
    if (mm && method === 'POST') {
      if (gamePlan === 'solo') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'scene_review', planSlug: 'solo' }) });
      const r = reviews.find((x) => x.id === mm![2]);
      const sc = scenes.find((x) => x.id === mm![1]);
      if (!r || !sc) return route.fulfill({ status: 404, body: '{"error":"not_found"}' });
      if (r.status !== 'in_review') return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'review_closed', status: r.status }) });
      const current = sceneSnapshotHash(sc.id);
      if (current !== r.snapshotHash || (body.expectedSnapshotHash && body.expectedSnapshotHash !== r.snapshotHash)) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'snapshot_stale', message: 'Scenen er endret siden runden ble sendt — send ny runde.', currentHash: current, reviewHash: r.snapshotHash }) });
      }
      Object.assign(r, { status: body.decision, decidedByUserId: 'u-e2e', decidedByLabel: 'Meg Selv', decidedAt: now(), decisionNote: body.note ?? null });
      sc.status = body.decision === 'approved' ? 'approved' : 'changes_requested';
      return route.fulfill(ok(r));
    }

    // ── Fase 7: produksjons-OS ─────────────────────────────────────────
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/gates$/);
    if (mm && method === 'GET') return route.fulfill(ok(gatesFor(mm[1])));
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/gates\/([^/]+)$/);
    if (mm && method === 'PUT') {
      if (!GATE_KEYS.includes(mm[2])) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_request"}' });
      if (body.status === 'passed' && !String(body.evidence ?? '').trim()) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'gate_evidence_required', message: 'En gate kan ikke settes «bestått» uten bevis.' }) });
      const existing = gates.find((x) => x.sceneId === mm![1] && x.gateKey === mm![2]);
      const row = { sceneId: mm[1], projectId, gateKey: mm[2], status: body.status, evidence: String(body.evidence ?? '').trim(), evidenceRefs: body.evidenceRefs ?? [], checkedBy: 'u-e2e', checkedAt: now(), updatedAt: now() };
      if (existing) Object.assign(existing, row); else gates.push(row);
      return route.fulfill(ok(row));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/lines$/);
    if (mm && method === 'GET') return route.fulfill(ok(lines.filter((l) => l.sceneId === mm![1]).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))));
    if (mm && method === 'POST') {
      const cueId = String(body.cueId ?? '').trim().toUpperCase();
      if (!/^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?(\.[0-9]{1,3})?$/.test(cueId)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_request"}' });
      if (lines.some((l) => l.sceneId === mm![1] && l.cueId === cueId)) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate_cue', cueId }) });
      const l = { id: nextId('nsl'), sceneId: mm[1], projectId, cueId, speakerComponentId: body.speakerComponentId ?? null, speakerLabel: body.speakerLabel ?? '', perspective: body.perspective ?? '', textEn: body.textEn ?? '', textNb: body.textNb ?? '', sourceType: body.sourceType ?? 'T', recordingStatus: body.recordingStatus ?? 'none', note: body.note ?? '', sortOrder: lines.filter((x) => x.sceneId === mm![1]).length, createdBy: 'u-e2e', createdAt: now(), updatedAt: now() };
      lines.push(l);
      return route.fulfill(ok(l, 201));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/lines\/order$/);
    if (mm && method === 'PUT') { (body.orderedIds as string[]).forEach((id, i) => { const l = lines.find((x) => x.id === id); if (l) l.sortOrder = i; }); return route.fulfill(ok(lines.filter((l) => l.sceneId === mm![1]).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number)))); }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/lines\/([^/]+)$/);
    if (mm) {
      const l = lines.find((x) => x.id === mm![2] && x.sceneId === mm![1]);
      if (!l) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      if (method === 'PATCH') { if (typeof body.cueId === 'string') body.cueId = body.cueId.toUpperCase(); Object.assign(l, body, { updatedAt: now() }); return route.fulfill(ok(l)); }
      if (method === 'DELETE') { lines.splice(lines.indexOf(l), 1); return route.fulfill(ok(undefined)); }
    }
    if (m(/\/projects\/[^/]+\/lines$/) && method === 'GET') {
      const speaker = url.searchParams.get('speakerComponentId');
      return route.fulfill(ok(lines.filter((l) => l.speakerComponentId === speaker).map((l) => { const sc = scenes.find((x) => x.id === l.sceneId); return { ...l, sceneCode: sc?.code ?? '', sceneTitle: sc?.title ?? '' }; })));
    }
    mm = m(/\/projects\/[^/]+\/components\/([^/]+)\/scenes$/);
    if (mm && method === 'GET') return route.fulfill(ok(links.filter((l) => l.ownerKind === 'component' && l.ownerId === mm![1]).map((l) => scenes.find((x) => x.id === l.sceneId)).filter(Boolean).map((sc) => ({ id: sc!.id, code: sc!.code, title: sc!.title, status: sc!.status }))));
    // Generisk CRUD for episoder / spørsmål / kilder / milepæler / plattformmål.
    const collections: Array<{ head: string; rows: Rec[]; prefix: string; codeKey?: string; gated?: boolean; defaults: (b: Rec) => Rec }> = [
      { head: 'episodes', rows: episodes, prefix: 'nep', codeKey: 'code', defaults: (b) => ({ code: String(b.code ?? '').toUpperCase(), title: b.title ?? '', summary: b.summary ?? '', playersLearn: b.playersLearn ?? '', sourceNote: b.sourceNote ?? '', status: b.status ?? 'draft', sortOrder: b.sortOrder ?? episodes.length }) },
      { head: 'open-questions', rows: openQuestions, prefix: 'noq', codeKey: 'code', defaults: (b) => ({ code: String(b.code ?? '').toUpperCase(), kind: b.kind ?? 'question', question: b.question ?? '', context: b.context ?? '', status: b.status ?? 'open', decision: b.decision ?? '', decidedBy: null, decidedAt: null, sourceRefs: b.sourceRefs ?? [], sortOrder: b.sortOrder ?? openQuestions.length }) },
      { head: 'sources', rows: sources, prefix: 'nso', codeKey: 'code', defaults: (b) => ({ code: String(b.code ?? '').toUpperCase(), label: b.label ?? '', kind: b.kind ?? 'other', sha256: b.sha256 ?? null, pathHint: b.pathHint ?? '', notes: b.notes ?? '', verifiedAt: null, verifiedBy: null, sortOrder: b.sortOrder ?? sources.length }) },
      { head: 'milestones', rows: milestones, prefix: 'nms', gated: true, defaults: (b) => ({ title: b.title ?? '', lane: b.lane ?? 'other', status: b.status ?? 'planned', startAt: b.startAt ?? null, dueAt: b.dueAt ?? null, ownerUserId: b.ownerUserId ?? null, description: b.description ?? '', acceptance: b.acceptance ?? '', evidence: b.evidence ?? '', sortOrder: b.sortOrder ?? milestones.length, sceneIds: [] }) },
      { head: 'platform-targets', rows: platformTargets, prefix: 'npt', defaults: (b) => ({ name: b.name ?? '', platform: b.platform ?? 'other', isPrimary: b.isPrimary ?? false, engine: b.engine ?? '', osMin: b.osMin ?? '', deviceMin: b.deviceMin ?? '', inputModel: b.inputModel ?? '', budgets: b.budgets ?? {}, requirements: b.requirements ?? [], visualDirection: b.visualDirection ?? {}, notes: b.notes ?? '', sortOrder: b.sortOrder ?? platformTargets.length }) },
    ];
    for (const c of collections) {
      if (m(new RegExp(`/projects/[^/]+/${c.head}$`))) {
        if (method === 'GET') return route.fulfill(ok([...c.rows].sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))));
        if (method === 'POST') {
          if (c.gated && gamePlan === 'solo') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'production_plan', plan: 'solo' }) });
          const row = { id: nextId(c.prefix), projectId, ...c.defaults(body), createdAt: now(), updatedAt: now() };
          if (c.codeKey && c.rows.some((x) => x[c.codeKey!] === row[c.codeKey!])) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate_code', value: row[c.codeKey!] }) });
          c.rows.push(row);
          return route.fulfill(ok(row, 201));
        }
      }
      const mmScenes = m(new RegExp(`/projects/[^/]+/${c.head}/([^/]+)/scenes$`));
      if (mmScenes && method === 'PUT' && c.head === 'milestones') {
        if (gamePlan === 'solo') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'production_plan', plan: 'solo' }) });
        const row = c.rows.find((x) => x.id === mmScenes[1]);
        if (!row) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
        row.sceneIds = (body.sceneIds as string[]).filter((id) => scenes.some((sc) => sc.id === id));
        return route.fulfill(ok({ sceneIds: row.sceneIds }));
      }
      const mmOne = m(new RegExp(`/projects/[^/]+/${c.head}/([^/]+)$`));
      if (mmOne) {
        const row = c.rows.find((x) => x.id === mmOne[1]);
        if (!row) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
        if (c.gated && gamePlan === 'solo' && method !== 'GET') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'production_plan', plan: 'solo' }) });
        if (method === 'PATCH') {
          if (c.head === 'sources' && body.verified === true) { row.verifiedAt = now(); row.verifiedBy = 'u-e2e'; delete body.verified; }
          if (c.head === 'open-questions' && body.status === 'done') { row.decidedAt = now(); row.decidedBy = 'u-e2e'; }
          if (c.head === 'platform-targets' && body.isPrimary === true) for (const t of platformTargets) t.isPrimary = false;
          if (typeof body.code === 'string') body.code = body.code.toUpperCase();
          Object.assign(row, body, { updatedAt: now() });
          return route.fulfill(ok(row));
        }
        if (method === 'DELETE') { c.rows.splice(c.rows.indexOf(row), 1); return route.fulfill(ok(undefined)); }
      }
    }
    // ── Fase 7e-2: gjestelenker per runde (Studio) ──
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/reviews\/([^/]+)\/share-links$/);
    if (mm && method === 'GET') return route.fulfill(ok(reviewShareLinks.filter((l) => l.reviewId === mm![2])));
    if (mm && method === 'POST') {
      if (gamePlan !== 'studio') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'plan_required', feature: 'guest_reviewers', plan: gamePlan }) });
      const r = reviews.find((x) => x.id === mm![2]);
      if (!r) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
      const token = `nrl_e2e_${body.accessMode ?? 'comment'}_${reviewShareLinks.length + 1}`;
      const link = { id: nextId('nrl'), projectId, sceneId: mm[1], reviewId: mm[2], accessMode: body.accessMode ?? 'comment', requireIdentity: body.requireIdentity ?? true, expiresAt: body.expiresAt ?? null, revokedAt: null, viewCount: 0, createdBy: 'u-e2e', createdAt: now(), token };
      reviewShareLinks.push(link);
      return route.fulfill(ok({ link, token, path: `/story-review/${token}` }, 201));
    }
    mm = m(/\/projects\/[^/]+\/scenes\/([^/]+)\/reviews\/([^/]+)\/share-links\/([^/]+)$/);
    if (mm && method === 'DELETE') { const l = reviewShareLinks.find((x) => x.id === mm![3]); if (!l) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }); l.revokedAt = now(); return route.fulfill(ok(undefined)); }
    if (m(/\/projects\/[^/]+\/overview$/) && method === 'GET') {
      const byStatus: Record<string, number> = { idea: 0, in_progress: 0, in_review: 0, changes_requested: 0, approved: 0, implemented: 0 };
      const byEra: Record<string, number> = {};
      for (const sc of scenes) { byStatus[String(sc.status)] = (byStatus[String(sc.status)] ?? 0) + 1; byEra[String(sc.era ?? 'other')] = (byEra[String(sc.era ?? 'other')] ?? 0) + 1; }
      const startedScenes = scenes.filter((sc) => sc.status !== 'idea').length; // speiler getProjectOverview: idé-scener gates ikke
      const byKey = Object.fromEntries(GATE_KEYS.map((k) => [k, { passed: gates.filter((x) => x.gateKey === k && x.status === 'passed').length, total: startedScenes }]));
      const nowMs = Date.now();
      const openTasks = tasks.filter((t) => t.status !== 'done');
      const primary = platformTargets.find((t) => t.isPrimary) ?? platformTargets[0];
      const reqs = (primary?.requirements as Rec[] | undefined) ?? [];
      const activity = [...scenes.map((sc) => ({ kind: 'scene', id: sc.id, title: `${sc.code} – ${sc.title}`, detail: 'Scene oppdatert', at: sc.updatedAt, sceneId: sc.id })), ...milestones.map((ms) => ({ kind: 'milestone', id: ms.id, title: ms.title, detail: `Milepæl: ${ms.status}`, at: ms.updatedAt, sceneId: null }))].slice(0, 20);
      return route.fulfill(ok({
        scenes: { total: scenes.length, byStatus, byEra, withoutDates: scenes.filter((sc) => !sc.startAt && !sc.dueAt).length },
        gates: { total: startedScenes * GATE_KEYS.length, passed: gates.filter((x) => x.status === 'passed').length, failed: gates.filter((x) => x.status === 'failed').length, byKey },
        tasks: { open: openTasks.length, overdue: openTasks.filter((t) => t.dueAt && new Date(String(t.dueAt)).getTime() < nowMs).length, done: tasks.filter((t) => t.status === 'done').length },
        reviews: { open: reviews.filter((r) => r.status === 'in_review').length },
        lines: { total: lines.length, approved: lines.filter((l) => l.recordingStatus === 'approved').length },
        questions: { open: openQuestions.filter((q) => q.kind === 'question' && q.status === 'open').length, checksOpen: openQuestions.filter((q) => q.kind === 'check' && q.status === 'open').length },
        platform: { requirements: reqs.length, verified: reqs.filter((r) => r.status === 'verified').length, primaryName: primary ? primary.name : null },
        milestones: [...milestones].sort((a, b) => String(a.dueAt ?? '9').localeCompare(String(b.dueAt ?? '9'))),
        episodes: episodes.map((e) => ({ id: e.id, code: e.code, title: e.title, sceneCount: scenes.filter((sc) => sc.episodeId === e.id).length, approvedCount: scenes.filter((sc) => sc.episodeId === e.id && (sc.status === 'approved' || sc.status === 'implemented')).length })),
        activity,
        unreadInbox: inbox.filter((n) => !n.readAt).length,
      }));
    }
    if (m(/\/projects\/[^/]+\/inbox$/) && method === 'GET') return route.fulfill(ok(inbox));
    if (m(/\/projects\/[^/]+\/inbox\/read-all$/) && method === 'POST') { let n = 0; for (const it of inbox) if (!it.readAt) { it.readAt = now(); n += 1; } return route.fulfill(ok({ marked: n })); }
    mm = m(/\/projects\/[^/]+\/inbox\/([^/]+)\/read$/);
    if (mm && method === 'POST') { const it = inbox.find((x) => x.id === mm![1]); if (!it) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }); it.readAt = now(); return route.fulfill(ok(undefined)); }

    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', path, method }) });
  });

  // ── Fase 7e-2: offentlig gjeste-review (/api/role-room/narrative/review/:token) ──
  // Faste tokens for specs: nrl_e2e_approve (beslutte), nrl_e2e_view (bare se), nrl_e2e_comment.
  // Binder til første scene (WFU: P01) og sørger for en åpen runde.
  const fixedBinding = new Map<string, string>(); // token → reviewId (så avgjorte runder forblir bundet)
  const ensureGuestRound = (token: string): { sc: Rec; r: Rec } | null => {
    const boundId = fixedBinding.get(token);
    if (boundId) { const r0 = reviews.find((x) => x.id === boundId); const sc0 = r0 ? scenes.find((x) => x.id === r0.sceneId) : null; if (r0 && sc0) return { sc: sc0, r: r0 }; }
    const sc = scenes.find((x) => x.code === 'P01') ?? scenes[0];
    if (!sc) return null;
    let r = reviews.find((x) => x.sceneId === sc.id && x.status === 'in_review');
    if (!r) {
      r = { id: nextId('nsr'), sceneId: sc.id, projectId, round: reviews.filter((x) => x.sceneId === sc.id).length + 1, status: 'in_review', requestedBy: 'u-e2e', requestedAt: now(), requestNote: 'Vennligst se på manusfeltene og replikkene.', decidedByUserId: null, decidedByLabel: null, decidedAt: null, decisionNote: null, snapshotHash: sceneSnapshotHash(sc.id) };
      reviews.push(r); sc.status = 'in_review';
    }
    fixedBinding.set(token, String(r.id));
    return { sc, r };
  };
  const guestSnapshot = (sc: Rec) => ({
    v: 2, code: sc.code, title: sc.title, subtitle: sc.subtitle, location: sc.location, challenge: sc.challenge, gameplayMechanic: sc.gameplayMechanic, environment: sc.environment, heroAssetId: sc.heroAssetId,
    frames: frames.filter((f) => f.sceneId === sc.id).map((f) => ({ assetId: f.assetId, externalUrl: f.externalUrl, caption: f.caption })),
    links: links.filter((l) => l.sceneId === sc.id).map((l) => ({ ownerKind: l.ownerKind, ownerId: l.ownerId, title: '' })),
    script: { beforeState: sc.beforeState, action: sc.action, control: sc.control, afterState: sc.afterState, audio: sc.audio, changeNote: sc.changeNote, bridge: sc.bridge, timeNote: sc.timeNote, knowledge: sc.knowledge },
    era: sc.era, sourceRefs: sc.sourceRefs,
    lines: lines.filter((l) => l.sceneId === sc.id).map((l) => ({ cueId: l.cueId, speakerLabel: l.speakerLabel, textEn: l.textEn, textNb: l.textNb, sourceType: l.sourceType, perspective: l.perspective })),
  });
  await page.route('**/api/role-room/narrative/review/**', async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const rest = url.pathname.replace(/^.*\/api\/role-room\/narrative\/review\//, '');
    const [token, ...segs] = rest.split('/');
    const sub = '/' + segs.join('/');
    const body = (method === 'POST' || method === 'PATCH') ? (req.postDataJSON() as Rec | null) ?? {} : {};
    const known = reviewShareLinks.find((l) => l.token === token && !l.revokedAt);
    const fixed = /^nrl_e2e_(approve|view|comment)$/.exec(token);
    if (!known && !fixed) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
    const accessMode = known ? String(known.accessMode) : fixed![1];
    const bound = ensureGuestRound(token);
    if (!bound) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
    const { sc, r } = known ? { sc: scenes.find((x) => x.id === known.sceneId) ?? bound.sc, r: reviews.find((x) => x.id === known.reviewId) ?? bound.r } : bound;
    const reviewerToken = req.headers()['x-narrative-reviewer'];
    const reviewer = reviewerToken ? reviewerSessions.find((s) => s.token === reviewerToken) ?? null : null;
    const roundMeta = { id: r.id, round: r.round, status: r.status, requestedAt: r.requestedAt, requestNote: r.requestNote, decidedAt: r.decidedAt, decidedByLabel: r.decidedByLabel, decisionNote: r.decisionNote, snapshotHash: r.snapshotHash };
    const share = { accessMode, requireIdentity: true, expiresAt: null };
    if (sub === '/' && method === 'GET') {
      if (!reviewer) return route.fulfill(ok({ requiresIdentity: true, scene: { code: sc.code, title: sc.title }, round: roundMeta, share, reviewer: null }));
      return route.fulfill(ok({ requiresIdentity: false, scene: { id: sc.id, code: sc.code, title: sc.title, status: sc.status }, round: roundMeta, snapshot: guestSnapshot(sc), share, reviewer: { id: reviewer.id, displayName: reviewer.displayName, email: reviewer.email } }));
    }
    if (sub === '/sessions' && method === 'POST') {
      if (String(body.displayName ?? '').trim().length < 2) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_request"}' });
      const s = { id: nextId('nrs'), token: `rt_${reviewerSessions.length + 1}`, displayName: body.displayName, email: body.email ?? null };
      reviewerSessions.push(s);
      return route.fulfill(ok({ reviewerToken: s.token, reviewer: { id: s.id, displayName: s.displayName, email: s.email } }, 201));
    }
    if (sub === '/editor-comments' && method === 'GET') {
      if (!reviewer) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"reviewer_identity_required"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: comments.filter((c) => c.anchorRef === sc.id).map((c) => ({ ...c, canEdit: c.authorId === `reviewer:${reviewer.id}` })), serverTime: now() }) });
    }
    if (sub === '/editor-comments' && method === 'POST') {
      if (accessMode === 'view') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"comments_not_allowed"}' });
      if (!reviewer) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"reviewer_identity_required"}' });
      const c = { id: nextId('cmt'), projectId, anchorType: 'narrative_scene', anchorRef: sc.id, timestampSec: null, commentText: body.commentText, parentId: body.parentId ?? null, status: 'open', priority: body.priority ?? 'normal', authorDisplayName: reviewer.displayName, authorId: `reviewer:${reviewer.id}`, createdAt: now(), updatedAt: now(), replyCount: 0 };
      comments.push(c);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: c.id, createdAt: c.createdAt }) });
    }
    if (sub === '/decision' && method === 'POST') {
      if (accessMode !== 'approve') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"decision_not_allowed"}' });
      if (!reviewer) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"reviewer_identity_required"}' });
      if (r.status !== 'in_review') return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'review_closed', status: r.status }) });
      if (sceneSnapshotHash(sc.id) !== r.snapshotHash) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'snapshot_stale', currentHash: sceneSnapshotHash(sc.id), reviewHash: r.snapshotHash }) });
      Object.assign(r, { status: body.decision, decidedByUserId: `reviewer:${reviewer.id}`, decidedByLabel: reviewer.displayName, decidedAt: now(), decisionNote: body.note ?? null });
      sc.status = body.decision === 'approved' ? 'approved' : 'changes_requested';
      inbox.unshift({ id: nextId('ntf'), eventType: 'narrative_scene_review_decided', title: `${body.decision === 'approved' ? 'Godkjent' : 'Endringer ønsket'}: ${sc.code} – ${sc.title}`, message: `Av ${reviewer.displayName} (gjest)`, linkedEntityType: 'narrative_scene', linkedEntityId: sc.id, createdByUserId: `reviewer:${reviewer.id}`, createdAt: now(), updatedAt: now(), readAt: null });
      return route.fulfill(ok(r));
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
  });
}

/** Fase 6: direkte tilgang til mock-scenene (for «endre bak ryggen»-tester). */
export function getMockScenes(page: Page): Rec[] | undefined { return SCENES.get(page); }

/**
 * Fase 4c: falsk /ws-server for Story Graph-rommet. Svarer med
 * connection_established + presence_snapshot, og lar testen sende
 * meldinger «fra serveren» (andre brukere) via returnert kontroll.
 */
export interface FakeWsPeer { clientId: string; userId: string; name: string; color: string; boardId: string | null }

export async function installNarrativeWsMock(page: Page, opts: { peers?: FakeWsPeer[] } = {}) {
  const peers = opts.peers ?? [];
  let current: { send: (data: string) => void } | null = null;
  const received: Array<Record<string, unknown>> = [];
  await page.routeWebSocket(/\/ws(\?|$)/, (ws) => {
    current = ws;
    ws.onMessage((data) => {
      try { received.push(JSON.parse(String(data)) as Record<string, unknown>); } catch { /* ignore */ }
    });
    const now = new Date().toISOString();
    ws.send(JSON.stringify({ type: 'connection_established', payload: { clientId: 'me', userId: 'u-e2e', authenticated: true, connectedClients: 1 + peers.length }, timestamp: now }));
    ws.send(JSON.stringify({ type: 'narrative:presence_snapshot', payload: { peers: peers.map((p) => ({ clientId: p.clientId, userId: p.userId, presence: { name: p.name, color: p.color, boardId: p.boardId } })) }, timestamp: now }));
  });
  return {
    /** Send en melding som om den kom fra serveren (relay fra en annen bruker). */
    serverSend: (msg: Record<string, unknown>) => { current?.send(JSON.stringify({ timestamp: new Date().toISOString(), ...msg })); },
    received,
  };
}
