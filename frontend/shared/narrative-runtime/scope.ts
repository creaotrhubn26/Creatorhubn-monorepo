/**
 * Story Graph — variabel-skop og referanseoppslag delt av engine og validator.
 *
 * Globale variabler heter `name`. Typede attributter på komponenter og brett
 * eksponeres som skopede variabler `<eier>.<attributt>` (Arcweave 5.11), der
 * eier = custom-ID hvis satt, ellers en slug av navnet.
 */

import type { MentionTarget, ScriptValue, ScriptVariable, ScriptVariableType } from '../narrative-script';
import type { RuntimeGraph } from './types';

const TYPED: ReadonlySet<string> = new Set(['bool', 'int', 'float', 'string']);

export function slugifyScopeName(name: string): string {
  const slug = name
    .replace(/[æÆ]/g, (m) => (m === 'æ' ? 'ae' : 'Ae'))
    .replace(/[øØ]/g, (m) => (m === 'ø' ? 'o' : 'O'))
    .replace(/[åÅ]/g, (m) => (m === 'å' ? 'a' : 'A'))
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[A-Za-z_$]/.test(slug) ? slug : `_${slug}`;
}

function toScriptValue(type: ScriptVariableType, value: unknown): ScriptValue | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (type === 'string') return JSON.stringify(value);
  return null;
}

/** Bygg listen av skriptvariabler (globale + skopede attributter). */
export function buildScriptVariables(graph: RuntimeGraph): ScriptVariable[] {
  const out: ScriptVariable[] = [];
  const seen = new Set<string>();
  for (const v of graph.variables) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    out.push({ name: v.name, type: v.type, defaultValue: toScriptValue(v.type, v.defaultValue) });
  }
  const ownerScope = new Map<string, string>();
  for (const c of graph.components) ownerScope.set(c.id, c.customId?.trim() || slugifyScopeName(c.name));
  for (const b of graph.boards) ownerScope.set(b.id, b.customId?.trim() || slugifyScopeName(b.name));
  for (const a of graph.attributes) {
    if (a.ownerKind === 'element' || !TYPED.has(a.type)) continue;
    const scope = ownerScope.get(a.ownerId);
    if (!scope) continue;
    const name = `${scope}.${a.name}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const type = a.type as ScriptVariableType;
    out.push({ name, type, defaultValue: toScriptValue(type, a.value) });
  }
  return out;
}

export interface ScopeResolvers {
  resolveMention: (id: string) => MentionTarget | null;
  resolveElementRef: (ref: string) => string | null;
  variableNames: Set<string>;
}

export function buildResolvers(graph: RuntimeGraph, variables: ScriptVariable[]): ScopeResolvers {
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const elementByCustomId = new Map<string, string>();
  for (const e of graph.elements) if (e.customId?.trim()) elementByCustomId.set(e.customId.trim(), e.id);
  const variableNameById = new Map<string, string>();
  for (const v of graph.variables) if (v.id) variableNameById.set(v.id, v.name);
  const variableNames = new Set(variables.map((v) => v.name));

  return {
    variableNames,
    resolveMention: (id) => {
      if (elementById.has(id)) return { kind: 'element', elementId: id };
      const byCustom = elementByCustomId.get(id);
      if (byCustom) return { kind: 'element', elementId: byCustom };
      const varName = variableNameById.get(id);
      if (varName) return { kind: 'variable', name: varName };
      if (variableNames.has(id)) return { kind: 'variable', name: id };
      return null;
    },
    resolveElementRef: (ref) => {
      if (elementById.has(ref)) return ref;
      return elementByCustomId.get(ref) ?? null;
    },
  };
}
