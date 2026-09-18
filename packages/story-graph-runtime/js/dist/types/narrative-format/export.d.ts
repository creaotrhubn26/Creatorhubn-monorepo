/**
 * Story Graph → Arcweave `project.json`.
 *
 * Målet er at eksporten kan lastes rett inn i Arcweaves MIT-lisensierte
 * Unity/Godot/Unreal-plugins (som leser `startingElement`, `boards`,
 * `elements`, `connections`, `branches`, `conditions`, `jumpers`,
 * `components`, `attributes`, `variables`, `assets`). Ren TS, ingen DOM.
 */
import type { ArcweaveProject } from './arcweave-types';
import { type IdMapper } from './ids';
import type { ExportGraph } from './types';
export interface ToArcweaveOptions {
    idMapper?: IdMapper;
    /** Eksporter på et annet språk enn kilden (overrides + kildens kode). */
    locale?: string | null;
}
export declare function toArcweaveProject(input: ExportGraph, options?: ToArcweaveOptions): ArcweaveProject;
