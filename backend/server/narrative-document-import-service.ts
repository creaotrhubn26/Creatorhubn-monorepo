/**
 * Story Graph Fase 8b — manusimport, DB-siden.
 *
 * `listExistingScenesForImport` gir diff-motoren prosjektets scener + replikker i én
 * spørring per tabell; `applyDocumentImport` skriver en brukergodkjent diff i én
 * transaksjon gjennom service-funksjonene (CHECKs, cue-unikhet og hash-regler gjelder).
 * Ingenting slettes: det som mangler i dokumentet kommer inn som åpne spørsmål
 * (kind = check) som brukeren har valgt å opprette.
 */
import type { Pool } from 'pg';

import * as svc from './role-room-narrative-service.js';
import type { ImportDiff, ExistingScene, ParsedLine } from './narrative-document-import.js';

type Row = Record<string, unknown>;

export async function listExistingScenesForImport(db: svc.Queryable, projectId: string): Promise<ExistingScene[]> {
  const [scenes, lines] = await Promise.all([
    db.query(
      `SELECT id, code, working_id, title, subtitle, era, before_state, action, control, after_state, audio
         FROM narrative_scenes WHERE project_id = $1 ORDER BY sort_order, code`,
      [projectId],
    ),
    db.query(
      `SELECT id, scene_id, cue_id, speaker_label, text_en, source_type
         FROM narrative_scene_lines WHERE project_id = $1 ORDER BY scene_id, sort_order, cue_id`,
      [projectId],
    ),
  ]);
  const linesBy = new Map<string, ExistingScene['lines']>();
  for (const r of lines.rows as Row[]) {
    const arr = linesBy.get(String(r.scene_id)) ?? [];
    arr.push({ id: String(r.id), cueId: String(r.cue_id), speakerLabel: String(r.speaker_label ?? ''), textEn: String(r.text_en ?? ''), sourceType: r.source_type == null ? null : String(r.source_type) });
    linesBy.set(String(r.scene_id), arr);
  }
  return (scenes.rows as Row[]).map((r) => ({
    id: String(r.id), code: String(r.code), workingId: r.working_id == null ? null : String(r.working_id),
    title: String(r.title ?? ''), subtitle: String(r.subtitle ?? ''), era: String(r.era ?? 'other'),
    beforeState: String(r.before_state ?? ''), action: String(r.action ?? ''), control: String(r.control ?? ''),
    afterState: String(r.after_state ?? ''), audio: String(r.audio ?? ''),
    lines: linesBy.get(String(r.id)) ?? [],
  }));
}

export interface DocumentImportApplyInput {
  sourceSha256: string;
  /** Kilderegister-kode (W, K, OPENING-V2 …); brukes som `ref` i kildemerker. */
  sourceCode: string;
  sourceLabel: string;
  sourceKind: svc.NarrativeSourceKind;
  fileName?: string;
  create: ImportDiff['create'];
  update: ImportDiff['update'];
  /** Brukervalgte åpne spørsmål for det som mangler i dokumentet (aldri sletting). */
  openQuestions: Array<{ question: string; context?: string; sceneCode?: string }>;
}

export interface DocumentImportApplyResult {
  source: svc.NarrativeSource;
  createdSceneIds: string[];
  updatedSceneIds: string[];
  linesCreated: number;
  linesUpdated: number;
  openQuestionsCreated: number;
}

const VALID_TAGS = new Set<svc.NarrativeSourceTag>(['W', 'K', 'U', 'A', 'E', 'T']);
function tagFor(sourceCode: string): svc.NarrativeSourceTag {
  const c = sourceCode.trim().toUpperCase();
  return VALID_TAGS.has(c as svc.NarrativeSourceTag) ? (c as svc.NarrativeSourceTag) : 'W';
}

/** «NORA», «NORA, 12», «Minnet av Nora» → komponent-id når navnet matcher en karakter. */
function speakerMatcher(characters: svc.NarrativeComponent[]): (label: string) => string | null {
  const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c.id]));
  return (label) => {
    const base = label.split(',')[0].trim().toLowerCase();
    return byName.get(base) ?? null;
  };
}

function cueSortKey(cueId: string): number {
  const m = /\.(\d+)$/.exec(cueId);
  return m ? Number(m[1]) : 0;
}

export async function applyDocumentImport(pool: Pool, projectId: string, userId: string, input: DocumentImportApplyInput): Promise<DocumentImportApplyResult> {
  const connect = (pool as Partial<Pool>).connect;
  const client: svc.Queryable & { release?: () => void } = typeof connect === 'function' ? await pool.connect() : pool;
  const tx = typeof connect === 'function';
  try {
    if (tx) await client.query('BEGIN');

    // 1) Kilderegister: opprett eller oppdater (sha256 + verifisert nå).
    const sourceCode = input.sourceCode.trim().toUpperCase();
    const sources = await svc.listSources(client, projectId);
    let source = sources.find((s) => s.code.toUpperCase() === sourceCode) ?? null;
    const importNote = `Manusimport ${new Date().toISOString().slice(0, 10)}${input.fileName ? ` (${input.fileName})` : ''}: ${input.create.length} nye, ${input.update.length} endrede scener.`;
    if (!source) {
      source = await svc.createSource(client, projectId, userId, { code: sourceCode, label: input.sourceLabel, kind: input.sourceKind, sha256: input.sourceSha256, notes: importNote });
      source = (await svc.patchSource(client, projectId, source.id, userId, { verified: true })) ?? source;
    } else {
      const notes = source.notes ? `${source.notes}\n${importNote}` : importNote;
      source = (await svc.patchSource(client, projectId, source.id, userId, { sha256: input.sourceSha256, kind: input.sourceKind, notes, verified: true })) ?? source;
    }
    const tag = tagFor(sourceCode);
    const ref = sourceCode;
    const speakerFor = speakerMatcher(await svc.listComponentsByKind(client, projectId, 'character'));

    const lineInput = (l: ParsedLine, sortOrder: number): svc.SceneLineInput => ({
      cueId: l.cueId, speakerLabel: l.speakerLabel, speakerComponentId: speakerFor(l.speakerLabel), textEn: l.textEn,
      sourceType: l.sourceType ?? undefined, note: l.note ?? '', sortOrder,
    });

    // 2) Nye scener med replikker.
    const createdSceneIds: string[] = [];
    let linesCreated = 0; let linesUpdated = 0;
    for (const c of input.create) {
      const f = c.scene.fields;
      const sourceRefs: svc.NarrativeSourceRef[] = (['beforeState', 'action', 'control', 'afterState', 'audio'] as const)
        .filter((k) => f[k].trim())
        .map((k) => ({ tag, ref, field: k, note: `${c.workingId} (manusimport)` }));
      const scene = await svc.createScene(client, projectId, userId, {
        code: c.code, workingId: c.workingId, title: c.scene.title, subtitle: c.scene.subtitle, era: c.scene.era,
        beforeState: f.beforeState, action: f.action, control: f.control, afterState: f.afterState, audio: f.audio,
        status: 'idea', sourceRefs,
      });
      createdSceneIds.push(scene.id);
      const sorted = [...c.scene.lines].sort((a, b) => cueSortKey(a.cueId) - cueSortKey(b.cueId));
      for (let i = 0; i < sorted.length; i++) {
        if (await svc.createSceneLine(client, projectId, scene.id, userId, lineInput(sorted[i], i))) linesCreated += 1;
      }
    }

    // 3) Endrede scener: felt-patch, nye replikker, endrede replikker.
    const updatedSceneIds: string[] = [];
    for (const u of input.update) {
      const patch: svc.ScenePatch = {};
      for (const [key, change] of Object.entries(u.changes)) {
        if (!change) continue;
        if (key === 'era') patch.era = change.to as svc.NarrativeSceneEra;
        else (patch as Record<string, string>)[key] = change.to;
      }
      if (Object.keys(patch).length) {
        const existing = await svc.getScene(client, projectId, u.sceneId);
        if (!existing) continue;
        const changedFields = Object.keys(u.changes).filter((k) => !['title', 'subtitle', 'era'].includes(k));
        const keep = (existing.sourceRefs ?? []).filter((r) => !(r.ref === ref && r.field && changedFields.includes(r.field)));
        patch.sourceRefs = [...keep, ...changedFields.map((k) => ({ tag, ref, field: k, note: `${u.workingId} (manusimport)` }))];
        await svc.patchScene(client, projectId, u.sceneId, patch);
      }
      const existingLines = await svc.listSceneLines(client, projectId, u.sceneId);
      let nextSort = existingLines.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;
      for (const l of [...u.lines.create].sort((a, b) => cueSortKey(a.cueId) - cueSortKey(b.cueId))) {
        if (await svc.createSceneLine(client, projectId, u.sceneId, userId, lineInput(l, nextSort++))) linesCreated += 1;
      }
      for (const lc of u.lines.update) {
        const linePatch: svc.SceneLinePatch = {};
        if (lc.changes.speakerLabel) { linePatch.speakerLabel = lc.changes.speakerLabel.to; linePatch.speakerComponentId = speakerFor(lc.changes.speakerLabel.to); }
        if (lc.changes.textEn) linePatch.textEn = lc.changes.textEn.to;
        if (lc.changes.sourceType) linePatch.sourceType = lc.changes.sourceType.to as svc.NarrativeLineSourceType;
        if (Object.keys(linePatch).length && await svc.patchSceneLine(client, projectId, u.sceneId, lc.lineId, linePatch)) linesUpdated += 1;
      }
      updatedSceneIds.push(u.sceneId);
    }

    // 4) Åpne spørsmål for det som mangler i dokumentet (brukervalgt, aldri sletting).
    let openQuestionsCreated = 0;
    const stem = `IMP-${input.sourceSha256.slice(0, 6).toUpperCase()}`;
    const existingQ = new Set((await svc.listOpenQuestions(client, projectId)).map((q) => q.code.toUpperCase()));
    let n = 1;
    for (const q of input.openQuestions) {
      let code = `${stem}-${String(n++).padStart(2, '0')}`;
      while (existingQ.has(code)) code = `${stem}-${String(n++).padStart(2, '0')}`;
      existingQ.add(code);
      await svc.createOpenQuestion(client, projectId, userId, {
        code, kind: 'check', question: q.question, context: q.context ?? '',
        sourceRefs: [{ tag, ref, note: q.sceneCode ? `${q.sceneCode} (manusimport)` : 'manusimport' }],
      });
      openQuestionsCreated += 1;
    }

    if (tx) await client.query('COMMIT');
    return { source, createdSceneIds, updatedSceneIds, linesCreated, linesUpdated, openQuestionsCreated };
  } catch (err) {
    if (tx) { try { await client.query('ROLLBACK'); } catch { /* ignore */ } }
    throw err;
  } finally {
    client.release?.();
  }
}
