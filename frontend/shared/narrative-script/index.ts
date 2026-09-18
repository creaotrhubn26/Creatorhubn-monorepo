/**
 * Story Graph — arcscript-kompatibelt skriptspråk (ren TS, ingen DOM).
 *
 * Delt mellom frontend (Play Mode, editor-validering) og backend (validering,
 * eksport). Se docs/evidence/2026-09-narrative-script-language.yaml.
 */

export * from './ast';
export { tokenize, LexError, type Token, type TokenType } from './lexer';
export { ParseError, parseCodeItems, parseExpression, parseProgram } from './parser';
export {
  RuntimeError, coerceToType, defaultForType, evaluate, execute, formatValue, truthy,
  type EvalContext, type MentionTarget, type ScriptValue, type ScriptVariableType, type VariableSlot,
} from './evaluator';
export {
  decodeEntities, escapeHtml, hasScript, prepareCode, segmentContentHtml, stripCodeBlocks,
  type CodeSegment, type ContentSegment, type HtmlSegment, type MentionRef,
} from './html';
export {
  buildVariableSlots, createInterpreter,
  type ConditionResult, type Interpreter, type InterpreterOptions, type RunResult, type ScriptError, type ScriptVariable,
} from './interpreter';
