/**
 * Filename token rendering for export presets.
 *
 * Tokens are wrapped in curly braces: {original_name}, {sequence},
 * {sequence:04}, {date:YYYY-MM-DD}, {time}, {project_name}, {client},
 * {camera}, {custom_text}.
 *
 * Design rules:
 *   - Unknown tokens render as empty string, never the raw literal. This
 *     prevents `{foo}` leaking into a delivered filename if a preset was
 *     authored against a newer token vocabulary.
 *   - Filesystem-unsafe characters in rendered values are replaced with
 *     "_" (mirrors Evoto's silent strip). We do NOT strip them from the
 *     template literal itself — the author may want a "-" separator.
 *   - The extension is NEVER part of the template. The caller supplies it
 *     separately so we can guarantee exactly one extension and no
 *     user-controlled path traversal via ".." tokens.
 */

import type { FilenameContext } from './types';

const UNSAFE_CHAR_RE = /[\u0000-\u001f<>:"/\\|?*\u007f]/g;
const TRAILING_DOTS_RE = /[.\s]+$/;
const LEADING_DOTS_RE = /^[.\s]+/;
const MAX_FILENAME_LEN = 180;

export type TokenName =
  | 'original_name'
  | 'sequence'
  | 'date'
  | 'time'
  | 'project_name'
  | 'client'
  | 'camera'
  | 'custom_text';

export interface TokenRenderOptions {
  extension: string;
  now?: Date;
}

export function renderFilename(
  template: string,
  context: FilenameContext,
  options: TokenRenderOptions,
): string {
  const now = options.now ?? new Date();
  const shotDate = context.shotAt != null ? new Date(context.shotAt) : now;

  const replaced = template.replace(/\{([a-z_]+)(?::([^}]+))?\}/g, (_, rawName: string, rawArg?: string) => {
    const name = rawName as TokenName;
    switch (name) {
      case 'original_name':
        return stripExtension(context.originalName ?? '');
      case 'sequence':
        return renderSequence(context.sequence, rawArg);
      case 'date':
        return formatDate(shotDate, rawArg ?? 'YYYY-MM-DD');
      case 'time':
        return formatDate(shotDate, rawArg ?? 'HHmmss');
      case 'project_name':
        return context.projectName ?? '';
      case 'client':
        return context.clientName ?? '';
      case 'camera':
        return context.camera ?? '';
      case 'custom_text':
        return context.customText ?? '';
      default:
        return '';
    }
  });

  const ext = normalizeExtension(options.extension);
  const base = sanitizeBase(replaced);
  const trimmed = base.slice(0, Math.max(1, MAX_FILENAME_LEN - ext.length));
  return trimmed + ext;
}

function renderSequence(seq: number, arg: string | undefined): string {
  const n = Math.max(0, Math.floor(seq));
  if (!arg) return String(n);
  const parsed = Number.parseInt(arg, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return String(n);
  return String(n).padStart(parsed, '0');
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function sanitizeBase(value: string): string {
  const safe = value.replace(UNSAFE_CHAR_RE, '_');
  const trimmed = safe.replace(LEADING_DOTS_RE, '').replace(TRAILING_DOTS_RE, '');
  return trimmed.length > 0 ? trimmed : 'image';
}

function normalizeExtension(ext: string): string {
  if (!ext) return '';
  const lower = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return lower.length > 0 ? `.${lower}` : '';
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

/**
 * Subset of the Moment-style format grammar that's actually useful here.
 * Deliberately minimal — adding more tokens is cheap but each new token
 * shape is a testable contract.
 */
export function formatDate(date: Date, pattern: string): string {
  const map: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: pad(date.getMonth() + 1, 2),
    DD: pad(date.getDate(), 2),
    HH: pad(date.getHours(), 2),
    mm: pad(date.getMinutes(), 2),
    ss: pad(date.getSeconds(), 2),
  };
  return pattern.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (tok) => map[tok] ?? tok);
}

/** Resolve filename collisions within a batch by appending " (n)". Pure. */
export function dedupeFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const lower = raw.toLowerCase();
    const count = seen.get(lower) ?? 0;
    seen.set(lower, count + 1);
    if (count === 0) return raw;
    const dot = raw.lastIndexOf('.');
    const base = dot > 0 ? raw.slice(0, dot) : raw;
    const ext = dot > 0 ? raw.slice(dot) : '';
    let attempt = count;
    while (seen.has(`${base} (${attempt})${ext}`.toLowerCase())) attempt += 1;
    const candidate = `${base} (${attempt})${ext}`;
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}
