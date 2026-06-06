/**
 * formationExport — utility for å eksportere en formasjons-state til fil.
 *
 * Tre formater:
 *   - PNG: snapshot av Fabric-canvas (via canvas.toDataURL i FormationView)
 *   - JSON: maskinlesbart dump av formations-arrayet (for re-import/diff)
 *   - PDF: stub (Phase 6 — krever jsPDF eller server-side render)
 *
 * Mønster: headeren dispatcher `dance:export-formation` CustomEvent. FormationView
 * lytter, henter fabric-ref + nåværende formations, og bruker download-helpers
 * herfra. Samme CustomEvent-bus-mønster som `dance:video-time` (FormationView
 * 185-200) og `dance:set-tab` (DanceWorkspace 278). Holder UI-laget løst koblet
 * fra canvas-implementasjonen.
 */
import type { Formation } from './formationTypes';

export type FormationExportFormat = 'png' | 'json' | 'pdf';

export interface FormationExportRequestDetail {
  format: FormationExportFormat;
  /** Valgfritt filnavn (uten extension). Default avledet fra formasjons-navn / dato. */
  filename?: string;
}

export const FORMATION_EXPORT_EVENT = 'dance:export-formation' as const;

/**
 * Headeren kaller denne. FormationView lytter på `dance:export-formation` og
 * gjør faktisk eksport via download-helpers under.
 */
export function requestFormationExport(
  format: FormationExportFormat,
  filename?: string,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<FormationExportRequestDetail>(FORMATION_EXPORT_EVENT, {
      detail: { format, filename },
    }),
  );
}

/**
 * Trigger en nettleser-nedlasting av en data-URL (PNG-snapshot fra
 * `canvas.toDataURL`).
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Trigger en nettleser-nedlasting av et JSON-objekt. Bruker Blob + objectURL
 * så vi ikke truncates på store payloads (data-URL har en størrelse-grense
 * som varierer per nettleser).
 */
export function downloadJson(obj: unknown, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Frigjør objectURL etter et øyeblikk (nedlastingen er allerede i gang).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Bygg et eksport-payload for JSON-eksport. Holder schema flatt og
 * eksplisitt — ikke bare `JSON.stringify(formations)` direkte, så vi kan
 * legge til metadata uten å bryte importere senere.
 */
export interface FormationExportPayload {
  /** Schema-versjon — bump ved breaking changes så importere kan refusere. */
  schema: 'role-room.dance.formations.v1';
  exportedAt: string;
  formationCount: number;
  formations: Formation[];
}

export function buildFormationExportPayload(
  formations: Formation[],
): FormationExportPayload {
  return {
    schema: 'role-room.dance.formations.v1',
    exportedAt: new Date().toISOString(),
    formationCount: formations.length,
    formations,
  };
}

/**
 * Default filename når headeren ikke spesifiserer en. Inkluderer dato og
 * antall formasjoner så filen er gjenkjennelig i Downloads-mappa.
 */
export function defaultExportFilename(
  format: FormationExportFormat,
  formations: Formation[],
): string {
  const date = new Date().toISOString().slice(0, 10);
  const first = formations[0]?.name?.replace(/[^a-z0-9æøå-]+/gi, '-').toLowerCase() ?? 'formasjon';
  const ext = format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'png';
  return `${date}-${first}-${formations.length}stk.${ext}`;
}
