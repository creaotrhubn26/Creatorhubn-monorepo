/**
 * Story Graph — skriptvalidering (det Arcweave mangler): parse-feil, ukjente
 * variabler og referanser i elementinnhold, forgreningsbetingelser og
 * koblingsetiketter. Ren TS — brukes av frontend (merknader-chip) og backend
 * (GET /validate, MCP).
 */
import type { GraphIssue, RuntimeGraph } from './types';
export declare function validateScripts(graph: RuntimeGraph): GraphIssue[];
/** Full graf-validering som også backend kan bruke (struktur + skript). */
export declare function validateStoryGraph(graph: RuntimeGraph): GraphIssue[];
