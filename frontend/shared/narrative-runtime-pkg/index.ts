/**
 * @creatorhub/story-graph-runtime — pakke-inngang (bygges av
 * frontend/scripts/build-narrative-runtime-pkg.mjs til packages/story-graph-runtime/js/dist).
 *
 * Eksporterer den delte spillmotoren (Play Mode) + lastere for Story Graph-eksport
 * (Arcweave project.json) slik at et spill kan kjøre historien uten Arcweaves
 * plugins. Ren TS, ingen DOM.
 */

import { createPlaySession, type PlaySession, type PlaySessionOptions } from '../narrative-runtime';
import type { RuntimeGraph } from '../narrative-runtime';
import { fromArcweaveProject } from '../narrative-format/import';
import { toRuntimeSubset } from '../narrative-format/standalone';
import { htmlToPlainText } from '../narrative-format/text';

export * from '../narrative-runtime';
export { fromArcweaveProject, ArcweaveImportError } from '../narrative-format/import';
export { toRuntimeSubset } from '../narrative-format/standalone';
export { htmlToPlainText } from '../narrative-format/text';
export { SAMPLE_GRAPH } from './sample';
import { SAMPLE_GRAPH } from './sample';
import { toArcweaveProject } from '../narrative-format/export';
import type { ArcweaveProject } from '../narrative-format/arcweave-types';

/** Eksempelprosjektet som Arcweave project.json (deterministiske ider). */
export function sampleArcweaveProject(): ArcweaveProject {
  return toArcweaveProject(SAMPLE_GRAPH);
}

/**
 * Last en Story Graph-/Arcweave-eksport (project.json) til runtime-grafen.
 * Idene fra project.json BEVARES (elementer, koblinger, variabler …) så spillkode
 * kan referere til dem — samme ider som Unity-/Godot-lasterne bruker.
 */
export function loadArcweaveProject(project: unknown): { graph: RuntimeGraph; warnings: string[] } {
  let seq = 0;
  const { graph, warnings } = fromArcweaveProject(project, {
    projectId: 'pkg', now: '1970-01-01T00:00:00.000Z',
    idFactory: (kind, sourceId) => sourceId ?? `${kind}_${++seq}`,
  });
  return { graph: toRuntimeSubset(graph), warnings: warnings.map((w) => w.message) };
}

/** Opprett en spillsesjon rett fra project.json. */
export function createSessionFromArcweave(project: unknown, options: PlaySessionOptions = {}): PlaySession {
  return createPlaySession(loadArcweaveProject(project).graph, options);
}

export interface TranscriptOptions {
  /** Maks antall valg (standard 12). */
  maxSteps?: number;
  /** Hvilket valg som tas (0-basert). Standard: alltid det første. */
  pick?: (optionCount: number, step: number) => number;
}

/**
 * Deterministisk gjennomspilling som tekst — samme format i C#- og GDScript-
 * lasterne, så paritet kan sjekkes med diff (se packages/story-graph-runtime/CHECKLIST.md).
 */
export function playTranscript(graph: RuntimeGraph, options: TranscriptOptions = {}): string {
  const maxSteps = options.maxSteps ?? 12;
  const pick = options.pick ?? (() => 0);
  const session = createPlaySession(graph, { rng: () => 0.5 });
  const lines: string[] = [];
  // Kun globale variabler (ikke komponent-attributter) — det er det lasterne implementerer.
  const globalNames = [...graph.variables.map((v) => v.name)].sort();
  const vars = () => {
    const v = session.getState().variables;
    return globalNames.map((k) => `${k}=${formatValue(v[k])}`).join(' ');
  };
  const dump = (view: ReturnType<PlaySession['start']>) => {
    if (!view) { lines.push('(no view)'); return; }
    lines.push(`@ ${view.element.customId?.trim() || view.elementId} | ${htmlToPlainText(view.element.titleHtml).trim()}`);
    const text = htmlToPlainText(view.html).trim();
    if (text) lines.push(`  ${text.split(/\s*\n+\s*/).filter(Boolean).join(' / ')}`);
    view.options.forEach((o, i) => lines.push(`  ${i + 1}) ${htmlToPlainText(o.labelHtml).trim()}`));
    if (view.deadEnd) lines.push('  (end)');
    lines.push(`  vars: ${vars()}`);
  };
  let view = session.start();
  dump(view);
  for (let step = 0; step < maxSteps && view && !view.deadEnd && view.options.length > 0; step++) {
    const idx = Math.min(Math.max(pick(view.options.length, step), 0), view.options.length - 1);
    lines.push(`> choose ${idx + 1}`);
    view = session.choose(view.options[idx].connectionId);
    dump(view);
  }
  return `${lines.join('\n')}\n`;
}

function formatValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  return JSON.stringify(v ?? null);
}
