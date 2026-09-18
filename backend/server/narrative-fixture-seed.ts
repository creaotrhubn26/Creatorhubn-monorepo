/**
 * Seeder for Story Graph-fixturer (Fase 7a-2): legger et helt prosjekt
 * («What Follows Us») inn i narrative_*-tabellene via service-funksjonene,
 * slik at CHECK-er, hash og validering gjelder. Idempotent på scenekode,
 * episodekode, komponent-customId, (scene, cue_id), gate-PK, spørsmålskode,
 * kildekode, milepæltittel og plattformnavn: andre kjøring oppdaterer i
 * stedet for å duplisere.
 */
import type { StoryGraphFixture, FixtureComponent } from '../../frontend/shared/narrative-fixtures/types.ts';
import * as svc from './role-room-narrative-service.ts';

type Db = svc.Queryable;

export interface SeedCounts { inserted: number; updated: number; skipped: number }
export interface SeedReport {
  sources: SeedCounts; episodes: SeedCounts; components: SeedCounts; scenes: SeedCounts; lines: SeedCounts;
  gates: SeedCounts; tasks: SeedCounts; links: SeedCounts; openQuestions: SeedCounts; milestones: SeedCounts; platformTargets: SeedCounts;
  warnings: string[];
}

const zero = (): SeedCounts => ({ inserted: 0, updated: 0, skipped: 0 });

function profileOf(c: FixtureComponent): Record<string, unknown> {
  return { ...(c.profile as Record<string, unknown>) };
}

export async function seedStoryGraphFixture(db: Db, projectId: string, userId: string, fixture: StoryGraphFixture): Promise<SeedReport> {
  const report: SeedReport = {
    sources: zero(), episodes: zero(), components: zero(), scenes: zero(), lines: zero(), gates: zero(), tasks: zero(), links: zero(),
    openQuestions: zero(), milestones: zero(), platformTargets: zero(), warnings: [],
  };

  // ── Kilder ──
  const existingSources = new Map((await svc.listSources(db, projectId)).map((s) => [s.code, s]));
  for (const [i, s] of fixture.sources.entries()) {
    const found = existingSources.get(s.code.toUpperCase());
    const input = { code: s.code, label: s.label, kind: s.kind, sha256: s.sha256 ?? null, pathHint: s.pathHint ?? '', notes: s.notes ?? '', sortOrder: i };
    if (found) { await svc.patchSource(db, projectId, found.id, userId, input); report.sources.updated += 1; }
    else { await svc.createSource(db, projectId, userId, input); report.sources.inserted += 1; }
  }

  // ── Episoder ──
  const episodeIdByCode = new Map<string, string>();
  const existingEpisodes = new Map((await svc.listEpisodes(db, projectId)).map((e) => [e.code, e]));
  for (const [i, e] of fixture.episodes.entries()) {
    const code = e.code.toUpperCase();
    const found = existingEpisodes.get(code);
    const input = { code: e.code, title: e.title, summary: e.summary ?? '', playersLearn: e.playersLearn ?? '', sourceNote: e.sourceNote ?? '', status: e.status ?? 'draft', sortOrder: i };
    if (found) { await svc.patchEpisode(db, projectId, found.id, input); episodeIdByCode.set(code, found.id); report.episodes.updated += 1; }
    else { const created = await svc.createEpisode(db, projectId, userId, input); episodeIdByCode.set(code, created.id); report.episodes.inserted += 1; }
  }

  // ── Komponenter (karakterer, lokasjoner, gjenstander, fraksjoner) ──
  const componentIdByCustomId = new Map<string, string>();
  const graph = await svc.getGraph(db, projectId);
  const existingComponents = new Map(graph.components.filter((c) => c.customId).map((c) => [String(c.customId), c]));
  for (const [i, c] of fixture.components.entries()) {
    const found = existingComponents.get(c.customId);
    const input = { name: c.name, folderPath: c.folderPath ?? '', customId: c.customId, sortOrder: i, kind: c.kind, profile: profileOf(c) };
    let id: string;
    if (found) { await svc.patchComponent(db, projectId, found.id, input); id = found.id; report.components.updated += 1; }
    else { id = (await svc.createComponent(db, projectId, userId, input)).id; report.components.inserted += 1; }
    componentIdByCustomId.set(c.customId, id);
    if (c.attributes?.length) {
      const existingAttrs = graph.attributes.filter((a) => a.ownerKind === 'component' && a.ownerId === id);
      for (const [j, a] of c.attributes.entries()) {
        const hit = existingAttrs.find((x) => x.name === a.name);
        if (hit) await svc.patchAttribute(db, projectId, hit.id, { type: a.type, value: a.value, sortOrder: j });
        else await svc.createAttribute(db, projectId, { ownerKind: 'component', ownerId: id, name: a.name, type: a.type, value: a.value, sortOrder: j });
      }
    }
  }

  // ── Scener + replikker + gater + oppgaver + lenker ──
  const existingScenes = new Map((await svc.listScenes(db, projectId)).map((s) => [s.code, s]));
  for (const [i, sc] of fixture.scenes.entries()) {
    const code = sc.code.toUpperCase();
    const episodeId = sc.episode ? episodeIdByCode.get(sc.episode.toUpperCase()) ?? null : null;
    if (sc.episode && !episodeId) report.warnings.push(`Scene ${code}: episode «${sc.episode}» finnes ikke i fixturen.`);
    const input: svc.SceneInput = {
      code, title: sc.title, subtitle: sc.subtitle ?? '', location: sc.location ?? '', challenge: sc.challenge ?? '',
      gameplayMechanic: sc.gameplayMechanic ?? '', environment: sc.environment ?? '', status: sc.status ?? 'idea', sortOrder: i,
      beforeState: sc.beforeState ?? '', action: sc.action ?? '', control: sc.control ?? '', afterState: sc.afterState ?? '', audio: sc.audio ?? '',
      changeNote: sc.changeNote ?? '', bridge: sc.bridge ?? '', timeNote: sc.timeNote ?? '', knowledge: sc.knowledge ?? {}, era: sc.era,
      episodeId, sourceRefs: sc.sourceRefs, workingId: sc.workingId ?? null,
    };
    const found = existingScenes.get(code);
    let sceneId: string;
    if (found) { await svc.patchScene(db, projectId, found.id, input); sceneId = found.id; report.scenes.updated += 1; }
    else { sceneId = (await svc.createScene(db, projectId, userId, input)).id; report.scenes.inserted += 1; }

    // Lenker scene ⇄ komponent (settes idempotent som hele settet).
    const links = (sc.components ?? []).map((cid) => {
      const id = componentIdByCustomId.get(cid);
      if (!id) report.warnings.push(`Scene ${code}: komponent «${cid}» finnes ikke i fixturen.`);
      return id ? { ownerKind: 'component' as const, ownerId: id } : null;
    }).filter((l): l is { ownerKind: 'component'; ownerId: string } => !!l);
    if (links.length) { await svc.setSceneLinks(db, projectId, sceneId, links); report.links.updated += links.length; }

    // Replikker: idempotent på (scene, cue_id).
    const existingLines = new Map((await svc.listSceneLines(db, projectId, sceneId)).map((l) => [l.cueId, l]));
    for (const [j, line] of (sc.lines ?? []).entries()) {
      const cue = line.cueId.toUpperCase();
      const speakerComponentId = line.speaker ? componentIdByCustomId.get(line.speaker) ?? null : null;
      if (line.speaker && !speakerComponentId) report.warnings.push(`Scene ${code} ${cue}: taler «${line.speaker}» finnes ikke i fixturen.`);
      const li = {
        cueId: cue, speakerComponentId, speakerLabel: line.speakerLabel, perspective: line.perspective ?? '', textEn: line.textEn, textNb: line.textNb ?? '',
        sourceType: line.sourceType, recordingStatus: line.recordingStatus ?? 'none', note: line.note ?? '', sortOrder: j,
      };
      const hit = existingLines.get(cue);
      if (hit) { await svc.patchSceneLine(db, projectId, sceneId, hit.id, li); report.lines.updated += 1; }
      else { await svc.createSceneLine(db, projectId, sceneId, userId, li); report.lines.inserted += 1; }
    }

    // Gater: upsert (PK scene+gate). «passed» uten bevis avvises av service → warning i stedet for crash.
    const existingGates = new Map((await svc.listSceneGates(db, projectId, sceneId)).map((g) => [g.gateKey, g]));
    for (const g of sc.gates ?? []) {
      const prev = existingGates.get(g.key);
      try {
        await svc.setSceneGate(db, projectId, sceneId, g.key, userId, { status: g.status, evidence: g.evidence ?? '', evidenceRefs: g.evidenceRefs ?? [] });
        if (prev && prev.checkedAt) report.gates.updated += 1; else report.gates.inserted += 1;
      } catch (err) {
        if (err instanceof svc.GateEvidenceRequiredError) { report.warnings.push(`Scene ${code} gate ${g.key}: «passed» uten bevis — hoppet over.`); report.gates.skipped += 1; }
        else throw err;
      }
    }

    // Oppgaver: idempotent på tittel.
    if (sc.tasks?.length) {
      const detail = await svc.getSceneDetail(db, projectId, sceneId);
      const existingTasks = new Map((detail?.tasks ?? []).map((t) => [t.title, t]));
      for (const [j, t] of sc.tasks.entries()) {
        const hit = existingTasks.get(t.title);
        if (hit) { await svc.patchSceneTask(db, projectId, sceneId, hit.id, { status: t.status ?? hit.status, sortOrder: j }); report.tasks.updated += 1; }
        else { await svc.createSceneTask(db, projectId, sceneId, userId, { title: t.title, status: t.status ?? 'todo', sortOrder: j }); report.tasks.inserted += 1; }
      }
    }
  }

  // ── Åpne spørsmål / sjekklister / låste beslutninger ──
  const existingQuestions = new Map((await svc.listOpenQuestions(db, projectId)).map((q) => [q.code, q]));
  for (const [i, q] of fixture.openQuestions.entries()) {
    const found = existingQuestions.get(q.code.toUpperCase());
    const input = { code: q.code, kind: q.kind, question: q.question, context: q.context ?? '', status: q.status ?? 'open', decision: q.decision ?? '', sourceRefs: q.sourceRefs ?? [], sortOrder: i };
    if (found) { await svc.patchOpenQuestion(db, projectId, found.id, userId, input); report.openQuestions.updated += 1; }
    else { await svc.createOpenQuestion(db, projectId, userId, input); report.openQuestions.inserted += 1; }
  }

  // ── Milepæler (idempotent på tittel) + scenekobling ──
  const sceneIdByCode = new Map((await svc.listScenes(db, projectId)).map((s) => [s.code, s.id]));
  const existingMilestones = new Map((await svc.listMilestones(db, projectId)).map((m) => [m.title, m]));
  for (const [i, m] of fixture.milestones.entries()) {
    const input = {
      title: m.title, lane: m.lane, status: m.status ?? 'planned', description: m.description ?? '', acceptance: m.acceptance ?? '', evidence: m.evidence ?? '',
      startAt: m.startAt ?? null, dueAt: m.dueAt ?? null, sortOrder: i,
    };
    const found = existingMilestones.get(m.title);
    let id: string;
    if (found) { await svc.patchMilestone(db, projectId, found.id, input); id = found.id; report.milestones.updated += 1; }
    else { id = (await svc.createMilestone(db, projectId, userId, input)).id; report.milestones.inserted += 1; }
    const ids = (m.scenes ?? []).map((c) => {
      const sid = sceneIdByCode.get(c.toUpperCase());
      if (!sid) report.warnings.push(`Milepæl «${m.title}»: scene «${c}» finnes ikke.`);
      return sid;
    }).filter((x): x is string => !!x);
    if (ids.length) await svc.setMilestoneScenes(db, projectId, id, ids);
  }

  // ── Plattformmål (idempotent på navn) ──
  const existingTargets = new Map((await svc.listPlatformTargets(db, projectId)).map((t) => [t.name, t]));
  for (const [i, t] of fixture.platformTargets.entries()) {
    const input = {
      name: t.name, platform: t.platform, isPrimary: t.isPrimary ?? false, engine: t.engine ?? '', osMin: t.osMin ?? '', deviceMin: t.deviceMin ?? '',
      inputModel: t.inputModel ?? '', budgets: t.budgets ?? {}, requirements: t.requirements ?? [], visualDirection: t.visualDirection ?? {}, notes: t.notes ?? '', sortOrder: i,
    };
    const found = existingTargets.get(t.name);
    if (found) { await svc.patchPlatformTarget(db, projectId, found.id, input); report.platformTargets.updated += 1; }
    else { await svc.createPlatformTarget(db, projectId, userId, input); report.platformTargets.inserted += 1; }
  }

  return report;
}

export function summarizeSeedReport(r: SeedReport): string {
  const row = (k: keyof Omit<SeedReport, 'warnings'>) => `${k.padEnd(16)} +${r[k].inserted} ~${r[k].updated} ⊘${r[k].skipped}`;
  const keys: Array<keyof Omit<SeedReport, 'warnings'>> = ['sources', 'episodes', 'components', 'scenes', 'lines', 'gates', 'tasks', 'links', 'openQuestions', 'milestones', 'platformTargets'];
  return [...keys.map(row), ...(r.warnings.length ? ['', 'Advarsler:', ...r.warnings.map((w) => `  - ${w}`)] : [])].join('\n');
}
