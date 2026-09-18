/**
 * Fixture-test for «What Follows Us» (Fase 7a-2): fixturen valideres mot zod
 * (koder, cue-ID-format, kildemerker som finnes i registeret, taler-referanser),
 * og seederen kjøres to ganger mot en fake-pool — andre kjøring setter inn 0.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { StoryGraphFixture } from '../../frontend/shared/narrative-fixtures/types.ts';
import { NARRATIVE_CUE_ID_RE, NARRATIVE_SCENE_CODE_RE } from './role-room-narrative-service.ts';
import { seedStoryGraphFixture } from './narrative-fixture-seed.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '..', '..', 'frontend', 'shared', 'narrative-fixtures', 'what-follows-us.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as StoryGraphFixture;

const sourceRef = z.object({ tag: z.enum(['W', 'K', 'U', 'A', 'E', 'T']), ref: z.string().min(1), field: z.string().optional(), note: z.string().optional() });
const shortCode = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/);
const schema = z.object({
  meta: z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1), version: z.string(), extractedAt: z.string(), documents: z.array(z.string()).min(1), notes: z.string().optional() }),
  sources: z.array(z.object({
    code: shortCode, label: z.string().min(1), kind: z.enum(['docx', 'pdf', 'md', 'txt', 'other']),
    sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(), pathHint: z.string().optional(), notes: z.string().optional(),
  })).min(1),
  episodes: z.array(z.object({ code: shortCode, title: z.string().min(1), summary: z.string().optional(), playersLearn: z.string().optional(), sourceNote: z.string().optional(), status: z.enum(['draft', 'locked']).optional() })),
  components: z.array(z.object({
    customId: z.string().regex(/^(char|loc|item|fac|misc)_[a-z0-9_]+$/), name: z.string().min(1), kind: z.enum(['character', 'location', 'item', 'faction', 'other']),
    folderPath: z.string().optional(), profile: z.record(z.unknown()),
    attributes: z.array(z.object({ name: z.string().min(1), type: z.enum(['string', 'rich_text', 'bool', 'int', 'float']), value: z.unknown() })).optional(),
  })),
  scenes: z.array(z.object({
    code: z.string().regex(NARRATIVE_SCENE_CODE_RE), workingId: z.string().optional(), episode: z.string().optional(), title: z.string().min(1), subtitle: z.string().optional(),
    era: z.enum(['pre', '1797', '1802', '1817', 'other']), status: z.enum(['idea', 'in_progress', 'in_review', 'changes_requested', 'approved', 'implemented']).optional(),
    location: z.string().optional(), challenge: z.string().optional(), gameplayMechanic: z.string().optional(), environment: z.string().optional(),
    beforeState: z.string().optional(), action: z.string().optional(), control: z.string().optional(), afterState: z.string().optional(), audio: z.string().optional(),
    changeNote: z.string().optional(), bridge: z.string().optional(), timeNote: z.string().optional(),
    knowledge: z.object({ actualPast: z.string().optional(), recollection: z.string().optional(), ownerPerspective: z.string().optional(), othersObserve: z.string().optional(), audienceKnows: z.string().optional(), saidAloud: z.string().optional() }).optional(),
    sourceRefs: z.array(sourceRef),
    components: z.array(z.string()).optional(),
    lines: z.array(z.object({
      cueId: z.string().regex(NARRATIVE_CUE_ID_RE), speaker: z.string().nullable(), speakerLabel: z.string(), perspective: z.string().optional(),
      textEn: z.string(), textNb: z.string().optional(), sourceType: z.enum(['E', 'T', 'E+T', 'U', 'A']),
      recordingStatus: z.enum(['none', 'needs_take', 'recorded', 'approved']).optional(), note: z.string().optional(),
    })).optional(),
    gates: z.array(z.object({
      key: z.enum(['script_coverage', 'greybox', 'characters_animation', 'playthrough', 'picture', 'audio']), status: z.enum(['not_started', 'in_progress', 'passed', 'failed']),
      evidence: z.string().optional(), evidenceRefs: z.array(z.string()).optional(),
    }).refine((g) => g.status !== 'passed' || !!g.evidence?.trim(), { message: 'passed krever evidence' })).optional(),
    tasks: z.array(z.object({ title: z.string().min(1), status: z.enum(['todo', 'doing', 'done']).optional() })).optional(),
  })).min(1),
  openQuestions: z.array(z.object({
    code: shortCode, kind: z.enum(['question', 'check']), question: z.string().min(1), context: z.string().optional(),
    status: z.enum(['open', 'done', 'dropped']).optional(), decision: z.string().optional(), sourceRefs: z.array(sourceRef).optional(),
  })),
  milestones: z.array(z.object({
    title: z.string().min(1), lane: z.enum(['story', 'greybox', 'characters', 'playtest', 'picture_audio', 'engineering', 'other']),
    status: z.enum(['planned', 'in_progress', 'done', 'blocked']).optional(), description: z.string().optional(), acceptance: z.string().optional(), evidence: z.string().optional(),
    startAt: z.string().nullable().optional(), dueAt: z.string().nullable().optional(), scenes: z.array(z.string()).optional(),
  })),
  platformTargets: z.array(z.object({
    name: z.string().min(1), platform: z.enum(['ipad', 'iphone', 'mac', 'pc', 'console', 'web', 'other']), isPrimary: z.boolean().optional(),
    engine: z.string().optional(), osMin: z.string().optional(), deviceMin: z.string().optional(), inputModel: z.string().optional(),
    budgets: z.record(z.unknown()).optional(),
    requirements: z.array(z.object({ code: z.string().min(1), text: z.string(), status: z.enum(['unverified', 'verified', 'failed']), evidence: z.string().optional(), source: z.string().optional() })).optional(),
    visualDirection: z.record(z.unknown()).optional(), notes: z.string().optional(),
  })).min(1),
});

describe('what-follows-us fixture', () => {
  it('validerer mot skjemaet', () => {
    const r = schema.safeParse(fixture);
    if (!r.success) console.error(JSON.stringify(r.error.format(), null, 1).slice(0, 4000));
    expect(r.success).toBe(true);
  });

  it('koder er unike (scener, episoder, komponenter, spørsmål, kilder, milepæler, cue-ID per scene)', () => {
    const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    expect(dupes(fixture.scenes.map((s) => s.code.toUpperCase()))).toEqual([]);
    expect(dupes(fixture.episodes.map((e) => e.code.toUpperCase()))).toEqual([]);
    expect(dupes(fixture.components.map((c) => c.customId))).toEqual([]);
    expect(dupes(fixture.openQuestions.map((q) => q.code.toUpperCase()))).toEqual([]);
    expect(dupes(fixture.sources.map((s) => s.code.toUpperCase()))).toEqual([]);
    expect(dupes(fixture.milestones.map((m) => m.title))).toEqual([]);
    for (const s of fixture.scenes) expect(dupes((s.lines ?? []).map((l) => l.cueId.toUpperCase())), `scene ${s.code}`).toEqual([]);
  });

  it('referanser peker på noe som finnes (kilder, episoder, komponenter, talere, milepæl-scener)', () => {
    const sourceCodes = new Set(fixture.sources.map((s) => s.code.toUpperCase()));
    const episodeCodes = new Set(fixture.episodes.map((e) => e.code.toUpperCase()));
    const componentIds = new Set(fixture.components.map((c) => c.customId));
    const sceneCodes = new Set(fixture.scenes.map((s) => s.code.toUpperCase()));
    const missing: string[] = [];
    for (const s of fixture.scenes) {
      for (const r of s.sourceRefs) if (!sourceCodes.has(r.ref.toUpperCase())) missing.push(`${s.code} sourceRef ${r.tag}:${r.ref}`);
      if (s.episode && !episodeCodes.has(s.episode.toUpperCase())) missing.push(`${s.code} episode ${s.episode}`);
      for (const c of s.components ?? []) if (!componentIds.has(c)) missing.push(`${s.code} component ${c}`);
      for (const l of s.lines ?? []) if (l.speaker && !componentIds.has(l.speaker)) missing.push(`${s.code} ${l.cueId} speaker ${l.speaker}`);
    }
    for (const q of fixture.openQuestions) for (const r of q.sourceRefs ?? []) if (!sourceCodes.has(r.ref.toUpperCase())) missing.push(`${q.code} sourceRef ${r.ref}`);
    for (const m of fixture.milestones) for (const c of m.scenes ?? []) if (!sceneCodes.has(c.toUpperCase())) missing.push(`milestone «${m.title}» scene ${c}`);
    expect(missing).toEqual([]);
  });

  it('innholdet dekker det ekte prosjektet: kilderegister med DOCX/PDF-sjekksum, E01–E12, P01–P12, G03A, W01.01, gater P01 med bevis, plattform iPad', () => {
    const src = Object.fromEntries(fixture.sources.map((s) => [s.code.toUpperCase(), s]));
    expect(src.W?.sha256).toBe('553a5e2f0ea0a8302e6981f4a219c4ef8329b1226803c7259885aa26e6201633');
    expect(src.K?.sha256).toBe('aef8dde76b8db133548da056bd0547bdfbbc3823c67de333e700c9168d0988c7');
    const eps = fixture.episodes.map((e) => e.code.toUpperCase());
    for (let i = 1; i <= 12; i += 1) expect(eps).toContain(`E${String(i).padStart(2, '0')}`);
    const codes = fixture.scenes.map((s) => s.code.toUpperCase());
    for (let i = 1; i <= 12; i += 1) expect(codes).toContain(`P${String(i).padStart(2, '0')}`);
    expect(codes).toContain('G03A');
    const p01 = fixture.scenes.find((s) => s.code.toUpperCase() === 'P01')!;
    expect(p01.lines?.map((l) => l.cueId)).toContain('W01.01');
    expect(p01.lines?.find((l) => l.cueId === 'W01.01')).toMatchObject({ textEn: 'Must you read all the way home?', sourceType: 'E' });
    expect(p01.gates?.some((g) => g.status === 'passed' && (g.evidence ?? '').length > 10)).toBe(true);
    // Ingen gate er bestått uten bevis, i hele fixturen.
    for (const s of fixture.scenes) for (const g of s.gates ?? []) if (g.status === 'passed') expect(g.evidence?.trim(), `${s.code}/${g.key}`).toBeTruthy();
    expect(fixture.platformTargets.find((t) => t.isPrimary)?.platform).toBe('ipad');
    expect(fixture.components.filter((c) => c.kind === 'character').map((c) => c.customId)).toEqual(expect.arrayContaining(['char_elise', 'char_nora', 'char_oskar', 'char_marcus', 'char_jamie', 'char_sage']));
    expect(fixture.components.some((c) => c.kind === 'location' && c.customId === 'loc_swing')).toBe(true);
  });
});

/** Minimal in-memory «database» som svarer på seederens SQL-mønstre. */
function makeMemoryPool() {
  const tables = {
    sources: [] as Record<string, unknown>[], episodes: [] as Record<string, unknown>[], components: [] as Record<string, unknown>[],
    attributes: [] as Record<string, unknown>[], scenes: [] as Record<string, unknown>[], lines: [] as Record<string, unknown>[],
    gates: [] as Record<string, unknown>[], tasks: [] as Record<string, unknown>[], links: [] as Record<string, unknown>[],
    questions: [] as Record<string, unknown>[], milestones: [] as Record<string, unknown>[], milestoneScenes: [] as Record<string, unknown>[],
    targets: [] as Record<string, unknown>[],
  };
  let seq = 0;
  const ts = new Date('2026-09-17T12:00:00Z');
  const query = vi.fn(async (sql: string, p: unknown[] = []) => {
    const rows = (r: unknown[]) => ({ rows: r, rowCount: r.length });
    const ins = (t: Record<string, unknown>[], row: Record<string, unknown>) => { t.push(row); return rows([row]); };
    const s = sql.replace(/\s+/g, ' ');
    // ── lister ──
    if (/FROM narrative_sources WHERE project_id/.test(s)) return rows(tables.sources);
    if (/FROM narrative_episodes WHERE project_id/.test(s) && !/JOIN/.test(s)) return rows(tables.episodes);
    if (/FROM narrative_components WHERE project_id = \$1 ORDER BY/.test(s)) return rows(tables.components);
    if (/FROM narrative_components WHERE project_id = \$1 AND id = ANY/.test(s)) return rows(tables.components.filter((c) => (p[1] as string[]).includes(String(c.id))));
    if (/FROM narrative_attributes WHERE project_id/.test(s)) return rows(tables.attributes);
    if (/FROM narrative_scenes WHERE project_id = \$1 ORDER BY/.test(s)) return rows(tables.scenes);
    if (/SELECT code FROM narrative_scenes/.test(s)) return rows(tables.scenes.map((x) => ({ code: x.code })));
    if (/FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/.test(s)) return rows(tables.scenes.filter((x) => x.id === p[0]));
    if (/FROM narrative_scene_lines WHERE scene_id = \$1/.test(s) && !/MAX/.test(s)) return rows(tables.lines.filter((x) => x.scene_id === p[0]));
    if (/MAX\(sort_order\), -1\) \+ 1 AS next FROM narrative_scene_lines/.test(s)) return rows([{ next: tables.lines.filter((x) => x.scene_id === p[0]).length }]);
    if (/FROM narrative_scene_gates WHERE scene_id = \$1/.test(s)) return rows(tables.gates.filter((x) => x.scene_id === p[0]));
    if (/FROM narrative_scene_tasks WHERE scene_id = \$1/.test(s)) return rows(tables.tasks.filter((x) => x.scene_id === p[0]));
    if (/FROM narrative_scene_links WHERE scene_id = \$1/.test(s)) return rows(tables.links.filter((x) => x.scene_id === p[0]));
    if (/FROM narrative_scene_frames WHERE scene_id/.test(s) || /FROM narrative_scene_reviews WHERE scene_id/.test(s)) return rows([]);
    if (/FROM narrative_open_questions WHERE project_id/.test(s)) return rows(tables.questions);
    if (/SELECT id FROM narrative_milestones WHERE id = \$1 AND project_id/.test(s)) return rows(tables.milestones.filter((x) => x.id === p[0]));
    if (/FROM narrative_milestones WHERE project_id/.test(s) || /FROM narrative_milestones m/.test(s)) return rows(tables.milestones);
    if (/SELECT id FROM narrative_scenes WHERE project_id = \$1 AND id = ANY/.test(s)) return rows(tables.scenes.filter((x) => (p[1] as string[]).includes(String(x.id))));
    if (/SELECT scene_id FROM narrative_milestone_scenes WHERE milestone_id/.test(s)) return rows(tables.milestoneScenes.filter((x) => x.milestone_id === p[0]));
    if (/FROM narrative_milestone_scenes/.test(s) && /SELECT/.test(s)) return rows(tables.milestoneScenes);
    if (/FROM narrative_platform_targets WHERE project_id/.test(s)) return rows(tables.targets);
    if (/DISTINCT ON \(scene_id\)/.test(s) || /FILTER \(WHERE status = 'done'\)/.test(s)) return rows([]);
    if (/FROM narrative_(settings|boards|elements|connections|element_components|variables|assets)\b/.test(s)) return rows([]);
    // ── innsettinger ──
    seq += 1;
    if (/INSERT INTO narrative_sources/.test(s)) return ins(tables.sources, { id: p[0], project_id: p[1], code: p[2], label: p[3], kind: p[4], sha256: p[5], path_hint: p[6], notes: p[7], sort_order: p[8], created_by: p[9], verified_at: null, verified_by: null, created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_episodes/.test(s)) return ins(tables.episodes, { id: p[0], project_id: p[1], code: p[2], title: p[3], summary: p[4], players_learn: p[5], source_note: p[6], status: p[7], sort_order: p[8], created_by: p[9], created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_components/.test(s)) return ins(tables.components, { id: p[0], project_id: p[1], name: p[2], folder_path: p[3], cover_asset_id: p[4], custom_id: p[5], sort_order: p[6], created_by: p[7], kind: p[8], profile: JSON.parse(String(p[9])), created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_attributes/.test(s)) return ins(tables.attributes, { id: p[0], project_id: p[1], owner_kind: p[2], owner_id: p[3], name: p[4], type: p[5], value: JSON.parse(String(p[6])), custom_id: p[7], sort_order: p[8], created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_scenes/.test(s)) return ins(tables.scenes, { id: p[0], project_id: p[1], code: p[2], title: p[3], subtitle: p[4], location: p[5], challenge: p[6], gameplay_mechanic: p[7], environment: p[8], status: p[9], assignee_user_id: p[10], due_at: p[11], hero_asset_id: p[12], sort_order: p[13], created_by: p[14], before_state: p[15], action: p[16], control: p[17], after_state: p[18], audio: p[19], change_note: p[20], bridge: p[21], time_note: p[22], knowledge: JSON.parse(String(p[23])), era: p[24], episode_id: p[25], start_at: p[26], source_refs: JSON.parse(String(p[27])), working_id: p[28], created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_scene_links/.test(s)) return ins(tables.links, { scene_id: p[0], project_id: p[1], owner_kind: p[2], owner_id: p[3], sort_order: p[4] });
    if (/DELETE FROM narrative_scene_links WHERE scene_id = \$1/.test(s)) { tables.links = tables.links.filter((x) => x.scene_id !== p[0]); return rows([]); }
    if (/INSERT INTO narrative_scene_lines/.test(s)) return ins(tables.lines, { id: p[0], scene_id: p[1], project_id: p[2], cue_id: p[3], speaker_component_id: p[4], speaker_label: p[5], perspective: p[6], text_en: p[7], text_nb: p[8], source_type: p[9], recording_status: p[10], note: p[11], sort_order: p[12], created_by: p[13], created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_scene_gates/.test(s)) {
      const row = { scene_id: p[0], project_id: p[1], gate_key: p[2], status: p[3], evidence: p[4], evidence_refs: JSON.parse(String(p[5])), checked_by: p[6], checked_at: ts, updated_at: ts };
      const i = tables.gates.findIndex((g) => g.scene_id === p[0] && g.gate_key === p[2]);
      if (i >= 0) tables.gates[i] = row; else tables.gates.push(row);
      return rows([row]);
    }
    if (/INSERT INTO narrative_scene_tasks/.test(s)) return ins(tables.tasks, { id: p[0], scene_id: p[1], project_id: p[2], title: p[3], status: p[4], assignee_user_id: p[5], due_at: p[6], completed_at: null, sort_order: p[7] ?? 0, created_by: 'seed', created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_open_questions/.test(s)) return ins(tables.questions, { id: p[0], project_id: p[1], code: p[2], kind: p[3], question: p[4], context: p[5], status: p[6], decision: p[7], source_refs: JSON.parse(String(p[8])), sort_order: p[9], decided_by: null, decided_at: null, created_by: 'seed', created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_milestones/.test(s)) return ins(tables.milestones, { id: p[0], project_id: p[1], title: p[2], lane: p[3], start_at: p[4], due_at: p[5], status: p[6], owner_user_id: p[7], description: p[8], acceptance: p[9], evidence: p[10], sort_order: p[11], created_by: p[12], created_at: ts, updated_at: ts });
    if (/INSERT INTO narrative_milestone_scenes/.test(s)) return ins(tables.milestoneScenes, { milestone_id: p[0], scene_id: p[1] });
    if (/DELETE FROM narrative_milestone_scenes/.test(s)) { tables.milestoneScenes = tables.milestoneScenes.filter((x) => x.milestone_id !== p[0]); return rows([]); }
    if (/INSERT INTO narrative_platform_targets/.test(s)) return ins(tables.targets, { id: p[0], project_id: p[1], name: p[2], platform: p[3], is_primary: p[4], engine: p[5], os_min: p[6], device_min: p[7], input_model: p[8], budgets: JSON.parse(String(p[9])), requirements: JSON.parse(String(p[10])), visual_direction: JSON.parse(String(p[11])), notes: p[12], sort_order: p[13], created_by: p[14], created_at: ts, updated_at: ts });
    // ── oppdateringer: returner første rad med matchende id ──
    if (/^UPDATE narrative_(\w+) SET/.test(s)) {
      const table = /^UPDATE narrative_(\w+) SET/.exec(s)![1];
      const t = ({ sources: tables.sources, episodes: tables.episodes, components: tables.components, attributes: tables.attributes, scenes: tables.scenes, scene_lines: tables.lines, scene_tasks: tables.tasks, open_questions: tables.questions, milestones: tables.milestones, platform_targets: tables.targets } as Record<string, Record<string, unknown>[]>)[table] ?? [];
      const hit = t.find((x) => x.id === p[0]);
      return rows(hit ? [hit] : []);
    }
    return rows([]);
  });
  return { pool: { query } as unknown as Pool, tables };
}

describe('seedStoryGraphFixture', () => {
  it('første kjøring setter inn alt; andre kjøring setter inn 0 og oppdaterer i stedet', async () => {
    const { pool, tables } = makeMemoryPool();
    const first = await seedStoryGraphFixture(pool, 'proj-wfu', 'u-seed', fixture);
    expect(first.warnings).toEqual([]);
    expect(first.scenes.inserted).toBe(fixture.scenes.length);
    expect(first.episodes.inserted).toBe(fixture.episodes.length);
    expect(first.components.inserted).toBe(fixture.components.length);
    expect(first.lines.inserted).toBe(fixture.scenes.reduce((n, s) => n + (s.lines?.length ?? 0), 0));
    expect(first.gates.skipped).toBe(0);
    expect(tables.links.length).toBeGreaterThan(0);
    const second = await seedStoryGraphFixture(pool, 'proj-wfu', 'u-seed', fixture);
    expect(second.scenes.inserted).toBe(0);
    expect(second.episodes.inserted).toBe(0);
    expect(second.components.inserted).toBe(0);
    expect(second.lines.inserted).toBe(0);
    expect(second.openQuestions.inserted).toBe(0);
    expect(second.milestones.inserted).toBe(0);
    expect(second.platformTargets.inserted).toBe(0);
    expect(second.scenes.updated).toBe(fixture.scenes.length);
    expect(tables.scenes.length).toBe(fixture.scenes.length);
    expect(tables.lines.length).toBe(first.lines.inserted);
  });
});
