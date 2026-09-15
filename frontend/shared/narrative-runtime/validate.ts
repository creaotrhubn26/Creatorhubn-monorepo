/**
 * Story Graph — skriptvalidering (det Arcweave mangler): parse-feil, ukjente
 * variabler og referanser i elementinnhold, forgreningsbetingelser og
 * koblingsetiketter. Ren TS — brukes av frontend (merknader-chip) og backend
 * (GET /validate, MCP).
 */

import {
  ParseError, hasScript, parseExpression, parseProgram, segmentContentHtml,
  type Expr, type Program, type ProgramNode,
} from '../narrative-script';
import { buildResolvers, buildScriptVariables } from './scope';
import type { GraphIssue, RuntimeGraph } from './types';

function walkExpr(expr: Expr, onIdentifier: (name: string, inElementRefPosition: boolean) => void, onMention: (id: string) => void): void {
  switch (expr.type) {
    case 'identifier': onIdentifier(expr.name, false); return;
    case 'mention': onMention(expr.id); return;
    case 'unary': walkExpr(expr.operand, onIdentifier, onMention); return;
    case 'binary':
      walkExpr(expr.left, onIdentifier, onMention);
      walkExpr(expr.right, onIdentifier, onMention);
      return;
    case 'call': {
      const elementRefFn = expr.name === 'visits' || expr.name === 'resetVisits';
      const varRefFn = expr.name === 'reset';
      for (const arg of expr.args) {
        if (arg.type === 'identifier' && (elementRefFn || varRefFn)) onIdentifier(arg.name, elementRefFn);
        else if (arg.type === 'mention') onMention(arg.id);
        else walkExpr(arg, onIdentifier, onMention);
      }
      return;
    }
    default:
      return;
  }
}

function walkProgram(program: Program, onIdentifier: (name: string, elementRef: boolean) => void, onMention: (id: string) => void): void {
  const visit = (node: ProgramNode): void => {
    switch (node.type) {
      case 'assignment':
        onIdentifier(node.target, false);
        walkExpr(node.value, onIdentifier, onMention);
        return;
      case 'callStatement':
        walkExpr(node.call, onIdentifier, onMention);
        return;
      case 'if':
        for (const b of node.branches) {
          if (b.condition) walkExpr(b.condition, onIdentifier, onMention);
          b.body.forEach(visit);
        }
        return;
      default:
        return;
    }
  };
  program.forEach(visit);
}

export function validateScripts(graph: RuntimeGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const variables = buildScriptVariables(graph);
  const resolvers = buildResolvers(graph, variables);
  const titleOf = (id: string): string => {
    const e = graph.elements.find((x) => x.id === id);
    const t = (e?.titleHtml ?? '').replace(/<[^>]+>/g, '').trim();
    return t || id;
  };

  const check = (program: Program | Expr, elementId: string, where: string, isProgram: boolean): void => {
    const seenUnknown = new Set<string>();
    const onIdentifier = (name: string, elementRef: boolean): void => {
      if (elementRef) {
        if (!resolvers.resolveElementRef(name)) {
          issues.push({ level: 'warning', elementId, message: `${where}: fant ikke element «${name}» i visits().` });
        }
        return;
      }
      if (!resolvers.variableNames.has(name) && !seenUnknown.has(name)) {
        seenUnknown.add(name);
        issues.push({ level: 'error', elementId, message: `${where}: ukjent variabel «${name}».` });
      }
    };
    const onMention = (id: string): void => {
      if (!resolvers.resolveMention(id)) {
        issues.push({ level: 'warning', elementId, message: `${where}: referansen peker på noe som ikke finnes lenger.` });
      }
    };
    if (isProgram) walkProgram(program as Program, onIdentifier, onMention);
    else walkExpr(program as Expr, onIdentifier, onMention);
  };

  for (const element of graph.elements) {
    const title = titleOf(element.id);
    if (element.kind === 'note') continue;

    if (hasScript(element.contentHtml)) {
      try {
        const program = parseProgram(segmentContentHtml(element.contentHtml));
        check(program, element.id, `«${title}»`, true);
      } catch (err) {
        const msg = err instanceof ParseError ? err.message : 'Ugyldig skript.';
        issues.push({ level: 'error', elementId: element.id, message: `«${title}»: skriptfeil — ${msg}` });
      }
    }

    if (element.kind === 'branch') {
      element.branchConditions.forEach((cond, i) => {
        if (cond.script === null || cond.script.trim() === '') return;
        try {
          const expr = parseExpression(cond.script);
          check(expr, element.id, `«${title}» betingelse ${i + 1}`, false);
        } catch (err) {
          const msg = err instanceof ParseError ? err.message : 'Ugyldig betingelse.';
          issues.push({ level: 'error', elementId: element.id, message: `«${title}» betingelse ${i + 1}: ${msg}` });
        }
      });
    }
  }

  for (const c of graph.connections) {
    if (!hasScript(c.labelHtml)) continue;
    try {
      const program = parseProgram(segmentContentHtml(c.labelHtml));
      check(program, c.sourceId, `Kobling fra «${titleOf(c.sourceId)}»`, true);
    } catch (err) {
      const msg = err instanceof ParseError ? err.message : 'Ugyldig skript.';
      issues.push({ level: 'error', elementId: c.sourceId, message: `Kobling fra «${titleOf(c.sourceId)}»: skriptfeil — ${msg}` });
    }
  }

  return issues;
}

/** Full graf-validering som også backend kan bruke (struktur + skript). */
export function validateStoryGraph(graph: RuntimeGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const incoming = new Map<string, number>();
  for (const c of graph.connections) incoming.set(c.targetId, (incoming.get(c.targetId) ?? 0) + 1);
  const start = graph.settings.startingElementId;
  if (!start && graph.elements.some((e) => e.kind === 'element')) {
    issues.push({ level: 'warning', elementId: null, message: 'Ingen startelement er satt.' });
  }
  for (const e of graph.elements) {
    if (e.kind === 'note') continue;
    if (e.kind === 'jumper' && (!e.jumperTargetId || !byId.has(e.jumperTargetId))) {
      issues.push({ level: 'error', elementId: e.id, message: 'Jumper mangler gyldig mål.' });
      continue;
    }
    if (e.kind === 'branch') {
      if (e.branchConditions.length === 0) issues.push({ level: 'error', elementId: e.id, message: 'Forgrening har ingen betingelser.' });
      const wired = new Set(graph.connections.filter((c) => c.sourceId === e.id).map((c) => c.sourceOutputKey));
      for (const cond of e.branchConditions) {
        if (!wired.has(cond.id)) issues.push({ level: 'warning', elementId: e.id, message: `Utgangen «${cond.label ?? cond.script ?? 'else'}» er ikke koblet.` });
      }
    }
    if (e.id !== start && !(incoming.get(e.id) ?? 0) && !graph.elements.some((j) => j.jumperTargetId === e.id)) {
      issues.push({ level: 'warning', elementId: e.id, message: 'Elementet kan ikke nås (ingen innganger).' });
    }
  }
  return issues.concat(validateScripts(graph));
}
