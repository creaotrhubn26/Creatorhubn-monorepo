/**
 * Story Graph — lexer for skriptspråket. Tokens bærer offset så feil kan pekes på.
 */
export type TokenType = 'number' | 'string' | 'boolean' | 'identifier' | 'keyword' | 'mention' | 'op' | 'lparen' | 'rparen' | 'comma' | 'dot' | 'newline' | 'eof';
export interface Token {
    type: TokenType;
    value: string;
    start: number;
    end: number;
}
export declare class LexError extends Error {
    readonly offset: number;
    constructor(message: string, offset: number);
}
export declare function tokenize(source: string): Token[];
