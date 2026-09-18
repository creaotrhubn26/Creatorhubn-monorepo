/**
 * Gjenkjenn importformat fra filnavn og innhold (Arcweave JSON, Twee 3, Ink).
 */

export type ImportFormat = 'arcweave' | 'twee' | 'ink';

export function sniffImportFormat(fileName: string | null | undefined, text: string): ImportFormat | null {
  const ext = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ext === 'json') return 'arcweave';
  if (ext === 'twee' || ext === 'tw') return 'twee';
  if (ext === 'ink') return 'ink';
  const head = text.slice(0, 20_000);
  if (/^\s*\{/.test(head) && /"boards"\s*:/.test(head)) return 'arcweave';
  if (/^::\s*\S/m.test(head)) return 'twee';
  if (/^\s*={2,}\s*[A-Za-z_][\w.]*\s*(?:\(.*?\))?\s*=*\s*$/m.test(head) || /^\s*->\s*\S/m.test(head) || /^\s*VAR\s+\w+\s*=/m.test(head) || /^\s*[*+]\s*(\{.*?\}\s*)?\[/m.test(head)) return 'ink';
  return null;
}

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  arcweave: 'Arcweave (project.json)',
  twee: 'Twine (Twee 3)',
  ink: 'Ink',
};
