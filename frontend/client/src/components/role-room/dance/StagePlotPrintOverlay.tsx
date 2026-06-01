/**
 * StagePlotPrintOverlay — print-flate for "stage plot" PDF-eksport.
 *
 * Workflow-audit v1 G21 (mest etterspurte hos koreografer): én PDF med alle
 * formasjoner kronologisk, dancer-tabell + notes + transitions. Skal
 * print-til-PDF via browser-print-dialog (kan også save-as-PDF i Mac).
 *
 * Strategi: render et overlay som fyller hele viewporten med en print-
 * friendly side per formasjon. Bruk @media print til å skjule resten av
 * appen + autopaginate.
 *
 * Stage-thumbnails rendres som SVG (ikke Fabric.js) fordi Fabric krever
 * canvas-element som er treigt å lage 1 per side. SVG er crisp i print.
 *
 * Trigger-mønster: FormationView lytter på `dance:export-formation`
 * { format: 'pdf' } og setter print-state. Komponenten mountes, kjører
 * window.print(), og fjernes igjen ved 'afterprint'-event eller close-knapp.
 */
import React from 'react';
import type { Dancer, Formation } from './formationTypes';
import { formatTimecode } from './timecode';

export interface StagePlotPrintOverlayProps {
  formations: readonly Formation[];
  dancers: readonly Dancer[];
  /** Prosjekt-navn til topp-headeren. Fallback: 'DanceFlow'. */
  title?: string;
  /** BPM for count-display. Default 120. */
  bpm?: number;
  /** Lukk-handler. Kalles ved afterprint-event eller manuell lukk. */
  onClose: () => void;
}

const STAGE_W = 480;
const STAGE_H = 320;
const STAGE_PADDING = 16;
const PUCK_R = 18;

function countsAt(sec: number | null | undefined, bpm: number): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const count = Math.floor((sec * bpm) / 60) + 1;
  return `Count ${count}`;
}

function durationLabel(start: number | null | undefined, end: number | null | undefined): string {
  if (start == null || end == null || end <= start) return '—';
  return `${formatTimecode(end - start)}`;
}

const STAGE_SVG_BG = '#f6f7fb';
const STAGE_SVG_BORDER = '#1e2536';

const StageSvg: React.FC<{
  formation: Formation;
  dancers: readonly Dancer[];
}> = ({ formation, dancers }) => {
  const dancersById = React.useMemo(
    () => new Map(dancers.map((d) => [d.id, d])),
    [dancers],
  );
  const innerW = STAGE_W - 2 * STAGE_PADDING;
  const innerH = STAGE_H - 2 * STAGE_PADDING;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      style={{ background: STAGE_SVG_BG, border: `1px solid ${STAGE_SVG_BORDER}`, borderRadius: 4 }}
      aria-label={`Stage plot for ${formation.name}`}
    >
      {/* Stage-area-ramme */}
      <rect
        x={STAGE_PADDING}
        y={STAGE_PADDING}
        width={innerW}
        height={innerH}
        fill="white"
        stroke="#9ca3af"
        strokeDasharray="4 3"
      />
      {/* Upstage/Downstage-labels */}
      <text x={STAGE_W / 2} y={12} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={700}>
        UPSTAGE
      </text>
      <text x={STAGE_W / 2} y={STAGE_H - 4} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={700}>
        DOWNSTAGE (audience)
      </text>
      <text x={6} y={STAGE_H / 2} fontSize={8} fill="#6b7280" fontWeight={600} transform={`rotate(-90 6 ${STAGE_H / 2})`}>
        LEFT
      </text>
      <text x={STAGE_W - 6} y={STAGE_H / 2} fontSize={8} fill="#6b7280" fontWeight={600} transform={`rotate(90 ${STAGE_W - 6} ${STAGE_H / 2})`}>
        RIGHT
      </text>

      {/* Pucks */}
      {formation.positions.map((pos, idx) => {
        const d = dancersById.get(pos.dancerId);
        if (!d) return null;
        const cx = STAGE_PADDING + pos.x * innerW;
        const cy = STAGE_PADDING + pos.y * innerH;
        return (
          <g key={pos.dancerId}>
            <circle
              cx={cx}
              cy={cy}
              r={PUCK_R}
              fill={d.color ?? '#a78bfa'}
              stroke="#1e2536"
              strokeWidth={1.5}
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="white"
            >
              D{idx + 1}
            </text>
            <text
              x={cx}
              y={cy + PUCK_R + 12}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill="#1f2937"
            >
              {d.initials || d.name.slice(0, 8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default function StagePlotPrintOverlay({
  formations,
  dancers,
  title = 'DanceFlow stage plot',
  bpm = 120,
  onClose,
}: StagePlotPrintOverlayProps): React.ReactElement | null {
  // Trigger print-dialog ved mount + lukk ved afterprint.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const afterPrint = (): void => onClose();
    window.addEventListener('afterprint', afterPrint);
    // Liten delay slik at React rekker å rendre overlayen før dialogen åpnes.
    const t = setTimeout(() => {
      try { window.print(); } catch { /* user kan ha blokkert popup */ }
    }, 120);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [onClose]);

  // Sorter etter startSec hvis satt, ellers display-order (array-index).
  const ordered = React.useMemo(() => {
    return [...formations].sort((a, b) => {
      const aT = a.startSec ?? Number.POSITIVE_INFINITY;
      const bT = b.startSec ?? Number.POSITIVE_INFINITY;
      if (aT !== bT) return aT - bT;
      return 0;
    });
  }, [formations]);

  const now = new Date();
  const totalDuration = ordered.reduce(
    (max, f) => Math.max(max, f.endSec ?? 0),
    0,
  );

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#stage-plot-print-root) { display: none !important; }
          #stage-plot-print-root { position: static !important; background: white !important; }
          .stage-plot-page { page-break-after: always; }
          .stage-plot-no-print { display: none !important; }
        }
        @page { size: A4; margin: 14mm; }
      `}</style>
      <div
        id="stage-plot-print-root"
        data-testid="stage-plot-print-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'white',
          overflow: 'auto',
          zIndex: 9999,
          color: '#1f2937',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Close + manual-print-knapp — skjules i print */}
        <div
          className="stage-plot-no-print"
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px',
            background: '#f3f4f6',
            borderBottom: '1px solid #d1d5db',
            zIndex: 10,
          }}
        >
          <strong style={{ fontSize: 13 }}>Forhåndsvisning — print eller lagre som PDF</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => window.print()}
              data-testid="stage-plot-print-trigger"
              style={{
                background: '#a78bfa', color: 'white', border: 'none',
                borderRadius: 4, padding: '6px 14px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              data-testid="stage-plot-print-close"
              style={{
                background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db',
                borderRadius: 4, padding: '6px 14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Lukk
            </button>
          </div>
        </div>

        {/* Hovedinnhold */}
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px' }}>
          {/* Side 1: Sammendrag */}
          <div className="stage-plot-page" style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, margin: '0 0 4px 0' }}>{title}</h1>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 16px 0' }}>
              Generert {now.toLocaleString('nb-NO')} · {ordered.length} formasjoner ·{' '}
              Total varighet: {totalDuration > 0 ? formatTimecode(totalDuration) : '—'} · BPM {bpm}
            </p>

            {/* Dancer-roster */}
            <h2 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>Dansere ({dancers.length})</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>ID</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Navn</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Init.</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Rolle</th>
                </tr>
              </thead>
              <tbody>
                {dancers.map((d, i) => (
                  <tr key={d.id}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{
                        display: 'inline-block', width: 12, height: 12, borderRadius: 6,
                        background: d.color ?? '#a78bfa', marginRight: 6, verticalAlign: 'middle',
                      }} />
                      D{i + 1}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>{d.name}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>{d.initials}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>{d.role ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Formasjons-oversikt */}
            <h2 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Formasjonsrekkefølge</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>#</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Navn</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Start</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Slutt</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Varighet</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((f, idx) => (
                  <tr key={f.id}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>{f.name}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      {f.startSec != null ? formatTimecode(f.startSec) : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      {f.endSec != null ? formatTimecode(f.endSec) : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      {durationLabel(f.startSec, f.endSec)}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      {countsAt(f.startSec, bpm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Én side per formasjon */}
          {ordered.map((formation, idx) => (
            <div
              key={formation.id}
              className="stage-plot-page"
              data-testid={`stage-plot-page-${formation.id}`}
              style={{ marginBottom: 32 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={{ fontSize: 18, margin: '0 0 4px 0' }}>
                  {idx + 1}. {formation.name}
                </h2>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {formation.startSec != null ? formatTimecode(formation.startSec) : '—'} —{' '}
                  {formation.endSec != null ? formatTimecode(formation.endSec) : '—'}
                  {' · '}
                  {countsAt(formation.startSec, bpm)}
                </span>
              </div>

              <div style={{ margin: '12px 0' }}>
                <StageSvg formation={formation} dancers={dancers} />
              </div>

              {formation.notes ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2 }}>NOTES</div>
                  <div style={{ fontSize: 11, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                    {formation.notes}
                  </div>
                </div>
              ) : null}

              {formation.tags && formation.tags.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2 }}>TAGS</div>
                  <div>
                    {formation.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          display: 'inline-block', fontSize: 10, fontWeight: 600,
                          background: '#f3f4f6', color: '#374151', padding: '2px 6px',
                          marginRight: 4, borderRadius: 3,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {formation.transitionNote ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2 }}>TRANSITION</div>
                  <div style={{ fontSize: 11, color: '#1f2937' }}>{formation.transitionNote}</div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
