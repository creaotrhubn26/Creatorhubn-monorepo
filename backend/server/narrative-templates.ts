/**
 * Story Graph Fase 8g — prosjektmaler. Skrives gjennom `seedStoryGraphFixture` (samme vei som
 * seed-skriptet) så CHECK-er, hash og revisjoner gjelder. Idempotent på koder (kjør to ganger = 0 nye).
 *
 *   blank          — ingenting (skallet er nok)
 *   demo-adventure — «Lykten i Dalen»: 1 episode, 6 scener, 4 karakterer, 2 lokasjoner, uten IP
 *   wfu-sample     — tre scener (P01–P03) fra What Follows Us-fixturen UTEN replikker/gater/oppgaver
 *                    (IP-vern: bare scenekort-strukturen vises)
 */
import type { Pool } from 'pg';
import type { FixtureScene, StoryGraphFixture } from '../../frontend/shared/narrative-fixtures/types.js';
import demoAdventure from '../../frontend/shared/narrative-fixtures/demo-adventure.json' with { type: 'json' };
import whatFollowsUs from '../../frontend/shared/narrative-fixtures/what-follows-us.json' with { type: 'json' };
import * as svc from './role-room-narrative-service.js';
import { seedStoryGraphFixture, type SeedReport } from './narrative-fixture-seed.js';

export const PROJECT_TEMPLATES = ['blank', 'demo-adventure', 'wfu-sample'] as const;
export type ProjectTemplate = (typeof PROJECT_TEMPLATES)[number];
export const WFU_SAMPLE_SCENES = ['P01', 'P02', 'P03'];

/** Utdrag av WFU-fixturen: tre scener uten replikker/gater/oppgaver, med bare komponenter/episode/kilder de refererer. */
export function buildWfuSampleFixture(full: StoryGraphFixture = whatFollowsUs as unknown as StoryGraphFixture): StoryGraphFixture {
  const scenes: FixtureScene[] = full.scenes
    .filter((s) => WFU_SAMPLE_SCENES.includes(s.code))
    .map((s) => ({ ...s, lines: undefined, gates: undefined, tasks: undefined, status: 'idea' as const }));
  const componentIds = new Set(scenes.flatMap((s) => s.components ?? []));
  const episodeCodes = new Set(scenes.map((s) => s.episode).filter((c): c is string => !!c));
  const sourceCodes = new Set(scenes.flatMap((s) => s.sourceRefs.map((r) => r.ref)));
  const components = full.components.filter((c) => componentIds.has(c.customId)).map((c) => {
    // Forfatterfasit og minnespor er IP — strippes fra utdraget.
    const { authorTruth: _a, memoryTrack: _m, powers: _p, ...profile } = c.profile as Record<string, unknown>;
    return { ...c, profile };
  });
  return {
    meta: { slug: 'wfu-sample', title: `${full.meta.title} — utdrag`, version: full.meta.version, extractedAt: full.meta.extractedAt, documents: ['(utdrag av What Follows Us-fixturen, uten replikker)'], notes: 'Tre scenekort som eksempel på struktur. Ingen replikker, gater, oppgaver, spørsmål eller milepæler.' },
    sources: full.sources.filter((s) => sourceCodes.has(s.code)),
    episodes: full.episodes.filter((e) => episodeCodes.has(e.code)),
    components,
    scenes,
    openQuestions: [],
    milestones: [],
    platformTargets: full.platformTargets.slice(0, 1),
  };
}

export function templateFixture(template: ProjectTemplate): StoryGraphFixture | null {
  if (template === 'blank') return null;
  if (template === 'demo-adventure') return demoAdventure as unknown as StoryGraphFixture;
  return buildWfuSampleFixture();
}

export interface ApplyTemplateResult { template: ProjectTemplate; revisionId: string | null; report: SeedReport | null }

/** Revisjon «Før mal» først (ikke-destruktivt), så seed gjennom service-funksjonene. */
export async function applyProjectTemplate(pool: Pool, projectId: string, userId: string, template: ProjectTemplate): Promise<ApplyTemplateResult> {
  const fixture = templateFixture(template);
  if (!fixture) return { template, revisionId: null, report: null };
  const revision = await svc.createRevision(pool, projectId, userId, `Før mal «${template}» ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  const report = await seedStoryGraphFixture(pool, projectId, userId, fixture);
  return { template, revisionId: revision.id, report };
}
