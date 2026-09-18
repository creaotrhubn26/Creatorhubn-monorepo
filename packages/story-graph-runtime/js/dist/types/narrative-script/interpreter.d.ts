/**
 * Story Graph — tolk. Speiler Arcweaves TS-tolk i form:
 *   createInterpreter({ variables, visits, currentElementId }) →
 *     runScript(html)          → { html, output, changes, errors }
 *     evaluateCondition(script)→ { value, errors }
 * Kaster aldri til kalleren — alle feil samles i `errors`.
 */
import { type MentionTarget, type ScriptValue, type ScriptVariableType, type VariableSlot } from './evaluator';
export interface ScriptVariable {
    name: string;
    type: ScriptVariableType;
    defaultValue: ScriptValue | null | undefined;
    value?: ScriptValue | null;
}
export interface ScriptError {
    kind: 'parse' | 'runtime';
    message: string;
    segmentIndex: number | null;
    offset: number | null;
}
export interface RunResult {
    /** Rendret HTML: html-segmenter der betingede seksjoner er filtrert, kodeblokker fjernet, show()-utskrift lagt inn. */
    html: string;
    /** Kun show()-tekst (ren tekst, uten HTML), i rekkefølge. */
    output: string;
    changes: Record<string, ScriptValue>;
    errors: ScriptError[];
}
export interface ConditionResult {
    value: boolean;
    errors: ScriptError[];
}
export interface InterpreterOptions {
    variables: ScriptVariable[];
    visits?: Record<string, number>;
    currentElementId?: string | null;
    rng?: () => number;
    resolveMention?: (id: string) => MentionTarget | null;
    resolveElementRef?: (ref: string) => string | null;
    maxNodes?: number;
}
export interface Interpreter {
    runScript: (html: string) => RunResult;
    evaluateCondition: (script: string) => ConditionResult;
    getVariables: () => Record<string, ScriptValue>;
    setVariable: (name: string, value: ScriptValue) => void;
    resetVariables: () => void;
    getVisits: () => Record<string, number>;
    incrementVisit: (elementId: string) => number;
    setCurrentElement: (elementId: string | null) => void;
}
export declare function buildVariableSlots(variables: ScriptVariable[]): Map<string, VariableSlot>;
export declare function createInterpreter(options: InterpreterOptions): Interpreter;
