/** storyOps — rene hjelpere for Historie-fanen (Fase 7c). */
import type { NarrativeEpisode, NarrativeOpenQuestion, NarrativeSceneEra, NarrativeSceneSummary } from '../narrativeTypes';

export interface EpisodeGroup { episode: NarrativeEpisode | null; scenes: NarrativeSceneSummary[] }

/** Scener gruppert per episode i episoderekkefølge; scener uten episode sist. */
export function groupScenesByEpisode(episodes: readonly NarrativeEpisode[], scenes: readonly NarrativeSceneSummary[]): EpisodeGroup[] {
  const byEpisode = new Map<string, NarrativeSceneSummary[]>();
  const loose: NarrativeSceneSummary[] = [];
  for (const s of scenes) {
    if (s.episodeId && episodes.some((e) => e.id === s.episodeId)) { const list = byEpisode.get(s.episodeId) ?? []; list.push(s); byEpisode.set(s.episodeId, list); }
    else loose.push(s);
  }
  const groups: EpisodeGroup[] = episodes.map((episode) => ({ episode, scenes: byEpisode.get(episode.id) ?? [] }));
  if (loose.length) groups.push({ episode: null, scenes: loose });
  return groups;
}

export interface TimelineRow { era: NarrativeSceneEra; scenes: number; decisions: NarrativeOpenQuestion[] }
const ERA_ORDER: NarrativeSceneEra[] = ['pre', '1797', '1802', '1817', 'other'];

/** Tidslinje: scener per epoke + låste beslutninger (spørsmål med status done som nevner epoken). */
export function timelineRows(scenes: readonly Pick<NarrativeSceneSummary, 'era'>[], questions: readonly NarrativeOpenQuestion[]): TimelineRow[] {
  const decided = questions.filter((q) => q.kind === 'question' && q.status === 'done' && q.decision);
  return ERA_ORDER.map((era) => ({
    era,
    scenes: scenes.filter((s) => s.era === era).length,
    decisions: era === 'other' || era === 'pre' ? decided.filter((q) => era === 'pre' ? /før 1797|leteplass|kult/i.test(`${q.question} ${q.decision}`) : false) : decided.filter((q) => `${q.question} ${q.decision}`.includes(era)),
  })).filter((r) => r.scenes > 0 || r.decisions.length > 0);
}

export function nextQuestionCode(questions: readonly Pick<NarrativeOpenQuestion, 'code' | 'kind'>[], kind: NarrativeOpenQuestion['kind']): string {
  const prefix = kind === 'check' ? 'C' : 'Q';
  let max = 0;
  for (const q of questions) { const m = new RegExp(`^${prefix}(\\d+)$`, 'i').exec(q.code); if (m) max = Math.max(max, Number(m[1])); }
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

export function nextEpisodeCode(episodes: readonly Pick<NarrativeEpisode, 'code'>[]): string {
  let max = 0;
  for (const e of episodes) { const m = /^E(\d+)$/i.exec(e.code); if (m) max = Math.max(max, Number(m[1])); }
  return `E${String(max + 1).padStart(2, '0')}`;
}
