/**
 * AnnotationExportOverlay — Export-flate for DanceAnnotate-annotations.
 *
 * To eksport-modi (matcher StagePlotPrintOverlay-mønsteret):
 *   - PDF: print-overlay via window.print() (browseren tilbyr 'Save as PDF')
 *   - CSV: blob-download av alle annotations som regneark-vennlig CSV
 *
 * PDF-flate inneholder:
 *   - Tittel + clip-navn + generert-dato
 *   - Sammendrag-tabell (count per kategori)
 *   - Full annotation-tabell sortert etter start-tid:
 *     # / Start / Slutt / Varighet / Kategori / Label / Dancer / Notes
 *
 * @media print skjuler resten av appen + page-break per 25 annotations
 * for lesbarhet.
 */
import { danceFlowColors } from './danceFlowTheme';
import React from 'react';

import type { VideoAnnotation } from './danceVideoService';
import { categoryById, DANCE_MOVEMENT_CATEGORIES } from './danceMovementCategories';
import { formatTimecode } from './timecode';

export interface AnnotationExportOverlayProps {
  open: boolean;
  annotations: readonly VideoAnnotation[];
  /** Clip-tittel til topp-header. */
  clipTitle?: string;
  /** Project-navn til topp-header. */
  projectName?: string;
  dancerOptions: Array<{ id: string; label: string }>;
  onClose: () => void;
}

function buildCsv(
  annotations: readonly VideoAnnotation[],
  dancerOptions: Array<{ id: string; label: string }>,
): string {
  const dancerLabel = (id: string): string =>
    dancerOptions.find((d) => d.id === id)?.label ?? id;
  const escape = (v: string | number): string => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows: string[] = [
    [
      '#', 'Start (HH:MM:SS:FF)', 'End', 'Duration (sec)',
      'Category', 'Label', 'Dancer(s)', 'Confidence', 'Notes',
    ].map(escape).join(','),
  ];
  const sorted = [...annotations].sort((a, b) => a.timestampSec - b.timestampSec);
  sorted.forEach((a, idx) => {
    const cat = a.category ? categoryById(a.category)?.label ?? a.category : '';
    const duration = a.endSec != null ? (a.endSec - a.timestampSec).toFixed(2) : '';
    rows.push([
      idx + 1,
      formatTimecode(a.timestampSec),
      a.endSec != null ? formatTimecode(a.endSec) : '',
      duration,
      cat,
      a.body,
      a.targetDancerIds.map(dancerLabel).join('; '),
      a.confidence != null ? a.confidence.toFixed(2) : '',
      a.body,
    ].map(escape).join(','));
  });
  return rows.join('\n');
}

function downloadCsv(csv: string, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AnnotationExportOverlay({
  open,
  annotations,
  clipTitle = 'Untitled clip',
  projectName = 'DanceAnnotate',
  dancerOptions,
  onClose,
}: AnnotationExportOverlayProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const afterPrint = (): void => {
      // Bevarer overlayen åpen etter print-dialog — bruker lukker manuelt.
    };
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [open]);

  // 🚨 React rules-of-hooks: useMemo MÅ deklareres FØR early-return på `!open`.
  // Tidligere lå den etter — render 1 (closed): 1 hook → return null,
  // render 2 (open): 1 hook + 1 useMemo → "Rendered more hooks". Flyttet opp.
  const sorted = React.useMemo(
    () => [...annotations].sort((a, b) => a.timestampSec - b.timestampSec),
    [annotations],
  );

  if (!open) return null;

  const dancerLabel = (id: string): string =>
    dancerOptions.find((d) => d.id === id)?.label ?? id;

  const now = new Date();
  const totalDuration = sorted.reduce(
    (sum, a) => sum + (a.endSec != null ? a.endSec - a.timestampSec : 0),
    0,
  );

  const handleDownloadCsv = (): void => {
    const csv = buildCsv(annotations, dancerOptions);
    const date = now.toISOString().slice(0, 10);
    const safeClip = clipTitle.replace(/[^a-z0-9æøå-]+/gi, '-').toLowerCase();
    downloadCsv(csv, `${date}-${safeClip}-annotations.csv`);
  };

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#annotation-export-root) { display: none !important; }
          #annotation-export-root { position: static !important; background: white !important; }
          .annotation-export-page { page-break-after: always; }
          .annotation-export-no-print { display: none !important; }
          .annotation-export-row { page-break-inside: avoid; }
        }
        @page { size: A4 landscape; margin: 10mm; }
      `}</style>
      <div
        id="annotation-export-root"
        data-testid="annotation-export-overlay"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          background: 'white', overflow: 'auto',
          zIndex: 9999, color: danceFlowColors.graySteel,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Top toolbar — skjules i print */}
        <div
          className="annotation-export-no-print"
          style={{
            position: 'sticky', top: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 16px',
            background: danceFlowColors.grayPaper,
            borderBottom: '1px solid #d1d5db',
            zIndex: 10,
          }}
        >
          <strong style={{ fontSize: 13 }}>
            Export annotations — {annotations.length} totalt
          </strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => window.print()}
              data-testid="annotation-export-print"
              style={{
                background: danceFlowColors.lavender, color: 'white', border: 'none',
                borderRadius: 4, padding: '6px 14px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              data-testid="annotation-export-csv"
              style={{
                background: 'white', color: danceFlowColors.graySteel,
                border: '1px solid #d1d5db',
                borderRadius: 4, padding: '6px 14px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              data-testid="annotation-export-close"
              style={{
                background: 'transparent', color: danceFlowColors.textDisabled,
                border: '1px solid #d1d5db',
                borderRadius: 4, padding: '6px 14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Lukk
            </button>
          </div>
        </div>

        {/* Innhold */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 4px 0' }}>{projectName}</h1>
          <p style={{ fontSize: 13, color: danceFlowColors.textDisabled, margin: '0 0 16px 0' }}>
            {clipTitle} · Generert {now.toLocaleString('nb-NO')} · {annotations.length} annotations ·{' '}
            Total annotert tid: {totalDuration > 0 ? formatTimecode(totalDuration) : '—'}
          </p>

          {/* Sammendrag per kategori */}
          <h2 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>
            Sammendrag per kategori
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: danceFlowColors.grayPaper, textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Kategori</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', textAlign: 'right' }}>Antall</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', textAlign: 'right' }}>Total varighet</th>
              </tr>
            </thead>
            <tbody>
              {DANCE_MOVEMENT_CATEGORIES.map((c) => {
                const inCat = sorted.filter((a) => a.category === c.id);
                const dur = inCat.reduce(
                  (s, a) => s + (a.endSec != null ? a.endSec - a.timestampSec : 0),
                  0,
                );
                return (
                  <tr key={c.id}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: 5,
                        background: c.color, marginRight: 6, verticalAlign: 'middle',
                      }} />
                      {c.label}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {inCat.length}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {dur > 0 ? formatTimecode(dur) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                  {annotations.length}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                  {totalDuration > 0 ? formatTimecode(totalDuration) : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Full annotation-tabell */}
          <h2 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>
            Alle annotations ({annotations.length})
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: danceFlowColors.grayPaper, textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', width: 28 }}>#</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Start</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Slutt</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Varighet</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Kategori</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Label</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Dancer(s)</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '12px 8px', textAlign: 'center', color: danceFlowColors.textMuted }}>
                    Ingen annotations.
                  </td>
                </tr>
              ) : sorted.map((a, idx) => {
                const cat = a.category ? categoryById(a.category) : null;
                const duration = a.endSec != null ? a.endSec - a.timestampSec : null;
                return (
                  <tr
                    key={a.id}
                    className="annotation-export-row"
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  >
                    <td style={{ padding: '4px 8px', color: danceFlowColors.textDisabled }}>{idx + 1}</td>
                    <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                      {formatTimecode(a.timestampSec)}
                    </td>
                    <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                      {a.endSec != null ? formatTimecode(a.endSec) : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                      {duration != null ? duration.toFixed(2) + 's' : '—'}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      {cat ? (
                        <span style={{
                          display: 'inline-block',
                          fontSize: 10, fontWeight: 700,
                          background: `${cat.color}22`,
                          color: cat.color,
                          padding: '2px 6px',
                          borderRadius: 3,
                          border: `1px solid ${cat.color}55`,
                        }}>
                          {cat.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', fontWeight: 600 }}>{a.body || '—'}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {a.targetDancerIds.length > 0
                        ? a.targetDancerIds.map(dancerLabel).join(', ')
                        : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', color: danceFlowColors.grayMid, maxWidth: 240 }}>
                      {a.body || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
