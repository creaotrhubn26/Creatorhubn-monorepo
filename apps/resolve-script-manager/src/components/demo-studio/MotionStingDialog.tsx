/**
 * MotionStingDialog — «Motion»: samme scene-data → en animert data-sting.
 *
 * Tar den valgte scenens felt-verdier (samme data-objekt som lager still-
 * plakaten), utleder en StingData og spiller stingen i en iframe. Format-
 * bytte (16:9 / 9:16 / 1:1), replay og nedlasting av selvstendig HTML.
 * «Send til Resolve» er markert som neste steg (frame-capture → ProRes).
 */
import { useMemo, useRef, useState } from 'react';

import { buildMotionStingHtml, stingFromValues, buildStingCaptureSpec, type StingFormat } from './motionSting.js';

const C = { bg: '#0b1120', panel: '#0f1524', panel2: '#141b2b', line: '#202a40', ink: '#e8eefc', soft: '#8a98b5' };

export default function MotionStingDialog(
  { values, order, brandName = 'Merkevare', accent = '#8b5cf6', mark, caption, eyebrow, onClose }:
  {
    values: Record<string, string>;
    order?: string[];
    brandName?: string;
    accent?: string;
    mark?: string;
    caption?: string;
    eyebrow?: string;
    onClose?: () => void;
  },
) {
  const [format, setFormat] = useState<StingFormat>('16:9');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const data = useMemo(
    () => stingFromValues(values, { brandName, accent, mark, caption, eyebrow, order }),
    [values, brandName, accent, mark, caption, eyebrow, order],
  );
  const numericCount = data.metrics.length + (data.hero.value ? 1 : 0);
  const html = useMemo(() => buildMotionStingHtml({ ...data, format }), [data, format]);
  const spec = useMemo(() => buildStingCaptureSpec({ ...data, format }, { fps: 30 }), [data, format]);

  const seek = (t: number) => {
    try {
      const w = iframeRef.current?.contentWindow as unknown as { __stingSeek?: (t: number) => void } | null;
      w?.__stingSeek?.(t);
    } catch { /* srcDoc = samme opphav */ }
  };
  const replay = () => {
    try {
      const w = iframeRef.current?.contentWindow as unknown as { __stingPlay?: () => void } | null;
      w?.__stingPlay?.();
    } catch { /* cross-origin-safe: srcDoc er samme opphav */ }
  };
  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-sting-${format.replace(':', 'x')}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const btn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.line}`, color: '#c4d0e4', background: C.panel2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const fmtBtn = (f: StingFormat): React.CSSProperties => ({ ...btn, borderColor: format === f ? accent : C.line, color: format === f ? accent : '#c4d0e4', background: format === f ? `${accent}1e` : C.panel2 });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>▶ Motion — data-sting</h1>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: `${accent}22`, color: accent }}>{numericCount} tall · {data.metrics.length} i funnel</span>
        {onClose && <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: C.soft, fontSize: 20 }}>×</span>}
      </div>
      <div style={{ color: C.soft, fontSize: 12.5, marginBottom: 14 }}>Samme data som still-plakaten → en keyframet sting: mark inn, funnel-wipe, hero teller opp, caption avsløres.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* venstre: kontroller */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.soft, marginBottom: 8 }}>Format</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['16:9', '9:16', '1:1'] as StingFormat[]).map((f) => (
                <span key={f} onClick={() => setFormat(f)} style={fmtBtn(f)}>{f}</span>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.soft, marginBottom: 8 }}>Fra denne scenen</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: '#c4d0e4' }}>
              <div><span style={{ color: C.soft }}>Hero:</span> <b>{new Intl.NumberFormat('nb-NO').format(data.hero.value)}{data.hero.suffix ? ` ${data.hero.suffix}` : ''}</b> <span style={{ color: C.soft }}>· {data.hero.label}</span></div>
              {data.metrics.map((m, i) => (
                <div key={i}><span style={{ color: C.soft }}>Funnel:</span> {m.display || new Intl.NumberFormat('nb-NO').format(m.value)} <span style={{ color: C.soft }}>· {m.label}</span></div>
              ))}
              {data.caption && <div style={{ marginTop: 4 }}><span style={{ color: C.soft }}>Caption:</span> {data.caption}</div>}
            </div>
            {numericCount === 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#f0b429', lineHeight: 1.5 }}>Legg til minst ett tall i scene-feltene (f.eks. «312 000 kr») for å bygge en sting.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <span onClick={replay} style={{ ...btn, background: accent, borderColor: accent, color: '#04121a' }}>▶ Spill av</span>
            <span onClick={download} style={btn}>⬇ Last ned HTML</span>
          </div>
          <div style={{ fontSize: 11, color: C.soft, lineHeight: 1.5, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            <b style={{ color: '#c4d0e4' }}>Neste steg — Send til Resolve:</b> fang HTML-en bilde-for-bilde → transparent ProRes 4444 → drop i filmen.
            <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: accent }}>{spec.width}×{spec.height} · {spec.fps} fps · {(spec.total / 1000).toFixed(1)}s · {spec.frames.length} bilder</div>
          </div>
        </div>

        {/* høyre: live sting + scrubber */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.line}`, background: '#07040f', display: 'grid', placeItems: 'center', padding: 20 }}>
            <iframe ref={iframeRef} title="motion-sting" srcDoc={html} key={format}
              style={{ width: format === '9:16' ? '46%' : '100%', height: format === '9:16' ? '100%' : 'auto', aspectRatio: format === '9:16' ? '9 / 16' : format === '1:1' ? '1 / 1' : '16 / 9', maxHeight: '100%', maxWidth: '100%', border: 0, background: 'transparent' }} />
          </div>
          {/* Scrubber: seeker stingen deterministisk (samme sti render-pipelinen bruker) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span onClick={replay} title="Spill av" style={{ ...btn, padding: '6px 11px' }}>▶</span>
            <input type="range" min={0} max={spec.total} step={16} defaultValue={0}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ flex: 1, accentColor: accent, cursor: 'pointer' }} />
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: C.soft, minWidth: 42, textAlign: 'right' }}>{(spec.total / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
