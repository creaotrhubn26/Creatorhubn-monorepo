/**
 * Story Graph — AST for det arcscript-kompatible skriptspråket.
 */
export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '<' | '>' | '<=' | '>=' | '==' | '!=' | 'and' | 'or';
export type UnaryOperator = '!' | '-' | '+';
export type AssignOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%=';
export interface SourcePos {
    /** Offset i kodesegmentet. */
    start: number;
    end: number;
    segmentIndex: number;
}
export interface LiteralExpr {
    type: 'literal';
    value: number | string | boolean;
    pos: SourcePos;
}
export interface IdentifierExpr {
    type: 'identifier';
    name: string;
    pos: SourcePos;
}
export interface MentionExpr {
    type: 'mention';
    id: string;
    pos: SourcePos;
}
export interface UnaryExpr {
    type: 'unary';
    op: UnaryOperator;
    operand: Expr;
    pos: SourcePos;
}
export interface BinaryExpr {
    type: 'binary';
    op: BinaryOperator;
    left: Expr;
    right: Expr;
    pos: SourcePos;
}
export interface CallExpr {
    type: 'call';
    name: string;
    args: Expr[];
    pos: SourcePos;
}
export type Expr = LiteralExpr | IdentifierExpr | MentionExpr | UnaryExpr | BinaryExpr | CallExpr;
export interface AssignmentStmt {
    type: 'assignment';
    target: string;
    op: AssignOperator;
    value: Expr;
    pos: SourcePos;
}
export interface CallStmt {
    type: 'callStatement';
    call: CallExpr;
    pos: SourcePos;
}
export type Statement = AssignmentStmt | CallStmt;
export interface HtmlNode {
    type: 'html';
    html: string;
    segmentIndex: number;
}
export interface IfBranch {
    condition: Expr | null;
    body: ProgramNode[];
    pos: SourcePos;
}
export interface IfBlock {
    type: 'if';
    branches: IfBranch[];
    pos: SourcePos;
}
export type ProgramNode = HtmlNode | Statement | IfBlock;
export type Program = ProgramNode[];
/** Elementer som en enkelt kodeblokk kan inneholde før strukturpasset. */
export type CodeItem = {
    type: 'if';
    condition: Expr;
    pos: SourcePos;
} | {
    type: 'elseif';
    condition: Expr;
    pos: SourcePos;
} | {
    type: 'else';
    pos: SourcePos;
} | {
    type: 'endif';
    pos: SourcePos;
} | Statement;
export declare const BUILTIN_FUNCTIONS: readonly ["abs", "max", "min", "random", "roll", "round", "sqr", "sqrt", "visits", "show", "resetVisits", "reset", "resetAll"];
export type BuiltinFunction = (typeof BUILTIN_FUNCTIONS)[number];
export declare function isBuiltinFunction(name: string): name is BuiltinFunction;
