/**
 * @creatorhub/story-graph-runtime — pakke-inngang (bygges av
 * frontend/scripts/build-narrative-runtime-pkg.mjs til packages/story-graph-runtime/js/dist).
 *
 * Eksporterer den delte spillmotoren (Play Mode) + lastere for Story Graph-eksport
 * (Arcweave project.json) slik at et spill kan kjøre historien uten Arcweaves
 * plugins. Ren TS, ingen DOM.
 */
import { type PlaySession, type PlaySessionOptions } from '../narrative-runtime';
import type { RuntimeGraph } from '../narrative-runtime';
export * from '../narrative-runtime';
export { fromArcweaveProject, ArcweaveImportError } from '../narrative-format/import';
export { toRuntimeSubset } from '../narrative-format/standalone';
export { htmlToPlainText } from '../narrative-format/text';
export { SAMPLE_GRAPH } from './sample';
import type { ArcweaveProject } from '../narrative-format/arcweave-types';
/** Eksempelprosjektet som Arcweave project.json (deterministiske ider). */
export declare function sampleArcweaveProject(): ArcweaveProject;
/**
 * Last en Story Graph-/Arcweave-eksport (project.json) til runtime-grafen.
 * Idene fra project.json BEVARES (elementer, koblinger, variabler …) så spillkode
 * kan referere til dem — samme ider som Unity-/Godot-lasterne bruker.
 */
export declare function loadArcweaveProject(project: unknown): {
    graph: RuntimeGraph;
    warnings: string[];
};
/** Opprett en spillsesjon rett fra project.json. */
export declare function createSessionFromArcweave(project: unknown, options?: PlaySessionOptions): PlaySession;
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
export declare function playTranscript(graph: RuntimeGraph, options?: TranscriptOptions): string;
