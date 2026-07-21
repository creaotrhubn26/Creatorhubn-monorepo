/**
 * MotionStingDialog — «Motion»: samme scene-data → en animert data-sting.
 *
 * Du VELGER hva du vil lage (arketype): Sting/funnel, Stat, Sitat eller
 * Sammenlign — hver har sin egen native reveal-koreografi (ikke én tvunget
 * funnel). Smart forslag som default, men fritt overstyrbart. Alle er
 * deterministisk seekbare (scrubber) og frame-capture-bare mot Resolve.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildMotionStingHtml, stingFromValues, buildStingCaptureSpec, type StingFormat } from './motionSting.js';
import {
  buildMotionHtml, statLayout, quoteLayout, compareLayout,
  statFrom, quoteFrom, compareFrom, pickArchetype, type Archetype,
} from './motionReveal.js';

const C = { bg: '#0b1120', panel: '#0f1524', panel2: '#141b2b', line: '#202a40', ink: '#e8eefc', soft: '#8a98b5' };

const ARCS: { id: Archetype; label: string; hint: string }[] = [
  { id: 'sting', label: 'Sting', hint: 'Hero + funnel som teller' },
  { id: 'stat', label: 'Stat', hint: 'Ett stort tall + delta' },
  { id: 'quote', label: 'Sitat', hint: 'Sitat + kilde' },
  { id: 'compare', label: 'Sammenlign', hint: 'Barer som racer' },
];

const fmtNb = (n: number) => new Intl.NumberFormat('nb-NO').format(n);

export default function MotionStingDialog(
  { values, fields, order, templateId = '', brandName = 'Merkevare', accent = '#8b5cf6', mark, caption, eyebrow, onValueChange, onClose }:
  {
    values: Record<string, string>;
    /** Redigerbare felt (nøkkel + etikett) — samme felt som selve malen. */
    fields?: { key: string; label: string }[];
    order?: string[];
    templateId?: string;
    brandName?: string;
    accent?: string;
    mark?: string;
    caption?: string;
    eyebrow?: string;
    /** Skriver endringen TILBAKE til scenen → still + motion holdes i synk. */
    onValueChange?: (key: string, value: string) => void;
    onClose?: () => void;
  },
) {
  const [format, setFormat] = useState<StingFormat>('16:9');
  // Lokal, redigerbar kopi (seedet fra scenen). Live preview + skriv-tilbake.
  const [edit, setEdit] = useState<Record<string, string>>(() => ({ ...values }));
  const setField = (k: string, v: string) => { setEdit((e) => ({ ...e, [k]: v })); onValueChange?.(k, v); };
  // Debouncet kopi som mater preview-en → animasjonen replayer først når du
  // stopper å skrive (input er umiddelbar, forhåndsvisningen roer seg).
  const [liveEdit, setLiveEdit] = useState<Record<string, string>>(edit);
  useEffect(() => { const h = setTimeout(() => setLiveEdit(edit), 280); return () => clearTimeout(h); }, [edit]);
  const editOrder = fields && fields.length ? fields.map((f) => f.key) : order;
  const editFields = fields && fields.length
    ? fields
    : (editOrder || Object.keys(edit)).map((k) => ({ key: k, label: k }));
  const [arch, setArch] = useState<Archetype>(() => pickArchetype(templateId, values));
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Bygg HTML + total + readout for valgt arketype.
  const built = useMemo(() => {
    if (arch === 'sting') {
      const d = stingFromValues(liveEdit, { brandName, accent, mark, caption, eyebrow, order: editOrder });
      const spec = buildStingCaptureSpec({ ...d, format });
      const readout = [
        { k: 'Hero', v: `${fmtNb(d.hero.value)}${d.hero.suffix ? ` ${d.hero.suffix}` : ''}`, s: d.hero.label },
        ...d.metrics.map((m) => ({ k: 'Funnel', v: m.display || fmtNb(m.value), s: m.label })),
        ...(d.caption ? [{ k: 'Caption', v: d.caption, s: '' }] : []),
      ];
      return { html: buildMotionStingHtml({ ...d, format }), total: spec.total, readout, dataCount: d.metrics.length + (d.hero.value ? 1 : 0) };
    }
    if (arch === 'stat') {
      const d = statFrom(liveEdit, editOrder);
      const lay = statLayout(d);
      const readout = [
        { k: 'Tall', v: `${d.prefix || ''}${fmtNb(d.value)}${d.suffix ? ` ${d.suffix}` : ''}`, s: d.label },
        ...(d.delta ? [{ k: 'Delta', v: d.delta, s: '' }] : []),
        ...(d.sub ? [{ k: 'Under', v: d.sub, s: '' }] : []),
      ];
      return { html: buildMotionHtml(lay, { accent, format }), total: lay.total, readout, dataCount: d.value ? 1 : 0 };
    }
    if (arch === 'quote') {
      const d = quoteFrom(liveEdit, editOrder);
      const lay = quoteLayout(d);
      const readout = [
        { k: 'Sitat', v: d.quote || '—', s: '' },
        ...(d.author ? [{ k: 'Kilde', v: d.author + (d.role ? ` · ${d.role}` : ''), s: '' }] : []),
      ];
      return { html: buildMotionHtml(lay, { accent, format }), total: lay.total, readout, dataCount: d.quote ? 1 : 0 };
    }
    const d = compareFrom(liveEdit, editOrder);
    const lay = compareLayout(d);
    const readout = [
      ...(d.title ? [{ k: 'Tittel', v: d.title, s: '' }] : []),
      ...d.items.map((it) => ({ k: 'Rad', v: it.display || fmtNb(it.value), s: it.label })),
    ];
    return { html: buildMotionHtml(lay, { accent, format }), total: lay.total, readout, dataCount: d.items.length };
  }, [arch, liveEdit, editOrder, brandName, accent, mark, caption, eyebrow, format]);

  const [w, h] = format === '9:16' ? [1080, 1920] : format === '1:1' ? [1080, 1080] : [1920, 1080];
  const frames = Math.max(1, Math.round((built.total / 1000) * 30) + 1);

  const seek = (t: number) => {
    const win = iframeRef.current?.contentWindow as unknown as { __motionSeek?: (t: number) => void; __stingSeek?: (t: number) => void } | null;
    (win?.__motionSeek || win?.__stingSeek)?.(t);
  };
  const replay = () => {
    const win = iframeRef.current?.contentWindow as unknown as { __motionPlay?: () => void; __stingPlay?: () => void } | null;
    (win?.__motionPlay || win?.__stingPlay)?.();
  };
  const download = () => {
    const blob = new Blob([built.html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-${arch}-${format.replace(':', 'x')}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const btn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: `1px solid ${C.line}`, color: '#c4d0e4', background: C.panel2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const chip = (on: boolean): React.CSSProperties => ({ ...btn, borderColor: on ? accent : C.line, color: on ? accent : '#c4d0e4', background: on ? `${accent}1e` : C.panel2 });
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.soft, marginBottom: 8 };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>▶ Motion</h1>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: `${accent}22`, color: accent }}>{ARCS.find((a) => a.id === arch)?.label} · {built.dataCount} felt</span>
        {onClose && <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: C.soft, fontSize: 20 }}>×</span>}
      </div>
      <div style={{ color: C.soft, fontSize: 12.5, marginBottom: 14 }}>Samme scene-data → en animert reveal. Velg hva du vil lage — hver form har sin egen koreografi.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* venstre: valg + kontroller */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflowY: 'auto' }}>
          <div>
            <div style={lbl}>Hva vil du lage?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ARCS.map((a) => (
                <div key={a.id} onClick={() => setArch(a.id)} style={{ ...chip(arch === a.id), flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 11px' }}>
                  <span style={{ fontWeight: 700 }}>{a.label}</span>
                  <span style={{ fontSize: 10.5, color: arch === a.id ? accent : C.soft, fontWeight: 500 }}>{a.hint}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={lbl}>Format</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['16:9', '9:16', '1:1'] as StingFormat[]).map((f) => (
                <span key={f} onClick={() => setFormat(f)} style={chip(format === f)}>{f}</span>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            <div style={lbl}>Rediger data <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: C.soft }}>· oppdaterer scenen live</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editFields.map((f) => (
                <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: C.soft }}>{f.label}</span>
                  <input value={edit[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: '7px 9px', color: C.ink, fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }} />
                </label>
              ))}
              {editFields.length === 0 && <div style={{ fontSize: 12, color: C.soft }}>Scenen har ingen felt å redigere.</div>}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: C.soft, lineHeight: 1.65 }}>
              <span style={{ fontWeight: 600, color: '#c4d0e4' }}>Tolkes som:</span>{' '}
              {built.readout.map((r, i) => (
                <span key={i}>{i > 0 ? ' · ' : ''}<span style={{ color: C.soft }}>{r.k}</span> {r.v.length > 24 ? r.v.slice(0, 24) + '…' : r.v}</span>
              ))}
            </div>
            {built.dataCount === 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#f0b429', lineHeight: 1.5 }}>Denne arketypen fant ingen egnede felt — prøv en annen, eller fyll inn tall/tekst over.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <span onClick={replay} style={{ ...btn, background: accent, borderColor: accent, color: '#04121a' }}>▶ Spill av</span>
            <span onClick={download} style={btn}>⬇ Last ned HTML</span>
          </div>
          <div style={{ fontSize: 11, color: C.soft, lineHeight: 1.5, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            <b style={{ color: '#c4d0e4' }}>Neste steg — Send til Resolve:</b> fang HTML-en bilde-for-bilde → transparent ProRes 4444 → drop i filmen.
            <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: accent }}>{w}×{h} · 30 fps · {(built.total / 1000).toFixed(1)}s · {frames} bilder</div>
          </div>
        </div>

        {/* høyre: live reveal + scrubber */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.line}`, background: '#07040f', display: 'grid', placeItems: 'center', padding: 20 }}>
            <iframe ref={iframeRef} title="motion-preview" srcDoc={built.html} key={arch + format}
              style={{ width: format === '9:16' ? '46%' : '100%', height: format === '9:16' ? '100%' : 'auto', aspectRatio: format === '9:16' ? '9 / 16' : format === '1:1' ? '1 / 1' : '16 / 9', maxHeight: '100%', maxWidth: '100%', border: 0, background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span onClick={replay} title="Spill av" style={{ ...btn, padding: '6px 11px' }}>▶</span>
            <input type="range" min={0} max={built.total} step={16} defaultValue={0} key={arch + format}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ flex: 1, accentColor: accent, cursor: 'pointer' }} />
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: C.soft, minWidth: 42, textAlign: 'right' }}>{(built.total / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
