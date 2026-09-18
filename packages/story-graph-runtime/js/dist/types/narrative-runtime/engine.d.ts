/**
 * Story Graph — spillmotor (Play Mode). Ren TS, ingen React/DOM.
 *
 * Regler (som Arcweave):
 *  - Ankomst til element: visits++ først, deretter kjøres innholdets skript.
 *  - Jumper følges automatisk (sløyfevakt).
 *  - Forgrening rutes automatisk til første sanne betingelse (script null = else)
 *    via koblingen med sourceOutputKey = betingelsens id. Ingen treff → blindvei.
 *  - Utgående koblinger fra et element er spillerens valg. Etikett-skript kjøres
 *    når valget tas (tilordninger), ikke ved visning.
 */
import { type ScriptError, type ScriptValue } from '../narrative-script';
import type { RuntimeElement, RuntimeGraph } from './types';
export interface PlayOption {
    connectionId: string;
    targetId: string;
    /** Etikett-HTML uten kodeblokker (til visning). */
    labelHtml: string;
    hasScript: boolean;
}
export interface PlayView {
    elementId: string;
    boardId: string;
    element: RuntimeElement;
    /** Rendret innhold (betingede seksjoner filtrert, show() lagt inn, kodeblokker fjernet). */
    html: string;
    options: PlayOption[];
    /** Ingen utganger (element uten koblinger, eller forgrening uten treff). */
    deadEnd: boolean;
    /** Navn på første festede komponent (taler for TTS). */
    speakerName: string | null;
    componentNames: string[];
}
export interface PlayLogEntry {
    step: number;
    kind: 'enter' | 'choose' | 'branch' | 'jumper' | 'restart' | 'set';
    elementId: string | null;
    message: string;
    changes: Record<string, ScriptValue>;
    errors: ScriptError[];
}
export interface PlayState {
    variables: Record<string, ScriptValue>;
    visits: Record<string, number>;
    historyDepth: number;
    log: PlayLogEntry[];
}
export interface PlaySession {
    start: () => PlayView | null;
    current: () => PlayView | null;
    choose: (connectionId: string) => PlayView | null;
    back: () => PlayView | null;
    canBack: () => boolean;
    restart: () => PlayView | null;
    setVariable: (name: string, value: ScriptValue) => void;
    getState: () => PlayState;
    /** Deklarerte variabler med type (til debugger). */
    getVariableDefs: () => Array<{
        name: string;
        type: string;
    }>;
}
/**
 * Fase 8e: hendelser fra spilløkta (til spilltest-telemetri). Samme hendelser som loggen
 * (enter/choose/branch/jumper/restart/set) pluss `back`, som ikke logges. Kalleren
 * (spill, standalone-spiller, iPad-runtime) velger selv hva som sendes videre.
 */
export interface PlayEvent {
    kind: PlayLogEntry['kind'] | 'back';
    elementId: string | null;
    /** Valgt kobling (kun `choose`). */
    connectionId?: string;
    /** Mål-element (kun `choose`/`jumper`/`branch` når kjent). */
    targetId?: string;
    step: number;
    changes: Record<string, ScriptValue>;
    errorCount: number;
    message: string;
}
export interface PlaySessionOptions {
    rng?: () => number;
    startElementId?: string | null;
    maxJumps?: number;
    maxLog?: number;
    /** Fase 8e: kalles etter hver loggført hendelse + `back`. Feil i callbacken svelges (motoren skal aldri stoppe spillet). */
    onEvent?: (event: PlayEvent) => void;
}
export declare function createPlaySession(graph: RuntimeGraph, options?: PlaySessionOptions): PlaySession;
