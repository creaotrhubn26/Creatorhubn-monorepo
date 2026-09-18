/**
 * Story Graph — variabel-skop og referanseoppslag delt av engine og validator.
 *
 * Globale variabler heter `name`. Typede attributter på komponenter og brett
 * eksponeres som skopede variabler `<eier>.<attributt>` (Arcweave 5.11), der
 * eier = custom-ID hvis satt, ellers en slug av navnet.
 */
import type { MentionTarget, ScriptVariable } from '../narrative-script';
import type { RuntimeGraph } from './types';
export declare function slugifyScopeName(name: string): string;
/** Bygg listen av skriptvariabler (globale + skopede attributter). */
export declare function buildScriptVariables(graph: RuntimeGraph): ScriptVariable[];
export interface ScopeResolvers {
    resolveMention: (id: string) => MentionTarget | null;
    resolveElementRef: (ref: string) => string | null;
    variableNames: Set<string>;
}
export declare function buildResolvers(graph: RuntimeGraph, variables: ScriptVariable[]): ScopeResolvers;
