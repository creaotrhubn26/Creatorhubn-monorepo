/**
 * Story Graph (spillstudio-vertikalen) — public exports.
 *
 * Komponentene under denne mappa er opt-in og brukes kun når
 * `professionMode` er 'game_studio'. Film/foto-flyten importerer ingenting
 * herfra (dashboard-velgerne bruker React.lazy).
 */

export { NarrativeWorkspace, type NarrativeWorkspaceProps } from './NarrativeWorkspace';
export * from './narrativeTypes';
export * as narrativeService from './narrativeService';
export { useNarrativeGraph, type UseNarrativeGraphResult } from './state/useNarrativeGraph';
export * as narrativeGraphOps from './state/graphOps';
