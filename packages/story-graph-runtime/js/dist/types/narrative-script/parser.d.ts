/**
 * Story Graph — parser (rekursiv nedstigning med presedensklatring).
 *
 * Presedens (lavest → høyest):
 *   or / ||   →   and / &&   →   is / is not   →   == !=   →   < > <= >=
 *   →   + -   →   * / %   →   unær (! not + -)   →   primær
 */
import type { CodeItem, Expr, Program } from './ast';
import type { ContentSegment } from './html';
export declare class ParseError extends Error {
    readonly offset: number;
    readonly segmentIndex: number;
    constructor(message: string, offset: number, segmentIndex: number);
}
/** Parse innholdet i én kodeblokk til en liste av items (if/elseif/else/endif/setninger). */
export declare function parseCodeItems(code: string, segmentIndex: number): CodeItem[];
/** Parse et enkelt uttrykk (forgreningsbetingelse). Kaster ParseError. */
export declare function parseExpression(source: string, segmentIndex?: number): Expr;
/**
 * Strukturpass: bygg et Program av segmenter der if/elseif/else/endif kan
 * ligge i forskjellige kodeblokker med html imellom.
 */
export declare function parseProgram(segments: ContentSegment[]): Program;
