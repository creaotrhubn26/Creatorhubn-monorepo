/**
 * Story Graph — evaluator for uttrykk og setninger.
 *
 * Verdier er `number | string | boolean`. Variabler har deklarert type
 * (bool/int/float/string) og koerseres ved tilordning. Fail-closed: dybde-
 * og nodebudsjett, deling på null og ukjente navn gir RuntimeError.
 */
import type { Expr, SourcePos, Statement } from './ast';
export type ScriptValue = number | string | boolean;
export type ScriptVariableType = 'bool' | 'int' | 'float' | 'string';
export interface VariableSlot {
    name: string;
    type: ScriptVariableType;
    value: ScriptValue;
    defaultValue: ScriptValue;
}
export type MentionTarget = {
    kind: 'element';
    elementId: string;
} | {
    kind: 'variable';
    name: string;
};
export interface EvalContext {
    variables: Map<string, VariableSlot>;
    visits: Map<string, number>;
    currentElementId: string | null;
    rng: () => number;
    resolveMention: (id: string) => MentionTarget | null;
    /** Løs et element-navn/custom-id (fra identifikator eller streng) til element-id. */
    resolveElementRef: (ref: string) => string | null;
    /** show()-utskrift for gjeldende setning. */
    output: string[];
    changes: Map<string, ScriptValue>;
    budget: {
        nodes: number;
        maxNodes: number;
    };
}
export declare class RuntimeError extends Error {
    readonly pos: SourcePos | null;
    constructor(message: string, pos: SourcePos | null);
}
export declare function coerceToType(type: ScriptVariableType, value: ScriptValue, pos?: SourcePos | null): ScriptValue;
export declare function defaultForType(type: ScriptVariableType): ScriptValue;
export declare function formatValue(value: ScriptValue): string;
export declare function writeVariable(ctx: EvalContext, name: string, value: ScriptValue, pos: SourcePos | null): void;
export declare function evaluate(expr: Expr, ctx: EvalContext, depth?: number): ScriptValue;
export declare function execute(stmt: Statement, ctx: EvalContext): void;
export declare function truthy(value: ScriptValue): boolean;
