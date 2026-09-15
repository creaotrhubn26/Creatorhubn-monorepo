/**
 * Arcweave `project.json` → Story Graph (full `FormatGraph`).
 *
 * Tapsfri der modellene overlapper; alt som ikke kan representeres eller som
 * peker på noe som mangler, rapporteres som `warnings` (aldri kastet). Kaster
 * kun `ArcweaveImportError` når dokumentet ikke er et Arcweave-prosjekt.
 */
import { type IdFactory } from './ids';
import type { FormatGraph, FormatWarning } from './types';
export declare class ArcweaveImportError extends Error {
    constructor(message: string);
}
export interface FromArcweaveOptions {
    projectId: string;
    /** ISO-tidsstempel for created/updated (deterministisk i tester). */
    now?: string;
    idFactory?: IdFactory;
}
export interface FromArcweaveResult {
    graph: FormatGraph;
    warnings: FormatWarning[];
}
export declare function fromArcweaveProject(input: unknown, options: FromArcweaveOptions): FromArcweaveResult;
