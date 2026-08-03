/**
 * DesignGallery — «Design-galleri» (§3): bla i ferdig-stylede design.
 *
 * Der OnboardingDialog velger STRUKTUR ut fra formål, lar galleriet
 * ikke-designeren velge et komplett UTTRYKK (mal × typografi × dekor × palett)
 * i ett klikk — med ekte, live-rendrede miniatyrer. Filtrer på tone; farg om
 * hele utvalget med én palett for å matche merkevaren.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { rasterizeMockup } from './mockupRaster';
import { useMockupStudio } from './mockupStudioStore';
import {
  DESIGN_PRESETS,
  MOCKUP_PALETTES,
  buildPreset,
  type DesignTone,
  type MockupDesignPreset,
} from './mockupStudioModel';

const C = {
  overlay: 'rgba(6,8,13,0.74)',
  card: '#12151f',
  soft: '#171b28',
  border: 'rgba(255,255,255,0.09)',
  ink: '#eef1f8',
  inkSoft: '#9aa0b4',
  accent: '#22d3ee',
  accentInk: '#04121a',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

type ToneFilter = 'alle' | DesignTone;
const TONE_TABS: { id: ToneFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'mork', label: 'Mørke' },
  { id: 'lys', label: 'Lyse' },
];

export function DesignGallery({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const setDocument = useMockupStudio((s) => s.setDocument);
  const [tone, setTone] = useState<ToneFilter>('alle');
  const [recolor, setRecolor] = useState<string | null>(null);

  const presets = useMemo(
    () => (tone === 'alle' ? DESIGN_PRESETS : DESIGN_PRESETS.filter((p) => p.tone === tone)),
    [tone],
  );

  const apply = (p: MockupDesignPreset) => {
    const doc = buildPreset(p.id);
    if (recolor) {
      const pal = MOCKUP_PALETTES.find((x) => x.id === recolor);
      if (pal) { doc.canvas.accent = pal.accent; doc.canvas.accent2 = pal.accent2; }
    }
    setDocument(doc);
    onDone?.();
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: C.font }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 1040, maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px 14px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Design-galleri</h2>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '4px 0 0' }}>Ferdig-stylede utgangspunkt — velg ett, tilpass alt etterpå.</p>
          </div>
          <button onClick={onClose} style={ghost}>Lukk</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '0 24px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {TONE_TABS.map((t) => (
              <button key={t.id} onClick={() => setTone(t.id)} style={{ ...chip, background: tone === t.id ? C.accent : C.soft, color: tone === t.id ? C.accentInk : C.ink }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 11.5, letterSpacing: 0.5, textTransform: 'uppercase', color: C.inkSoft, fontWeight: 700 }}>Farg om</span>
            <button onClick={() => setRecolor(null)} title="Behold presetens farger" style={{ ...swatch, border: `2px solid ${recolor === null ? C.accent : C.border}`, background: 'linear-gradient(135deg,#3a3f4d,#20242f)', fontSize: 10, color: C.inkSoft }}>Auto</button>
            {MOCKUP_PALETTES.map((pal) => (
              <button
                key={pal.id}
                onClick={() => setRecolor(pal.id === recolor ? null : pal.id)}
                title={pal.label}
                style={{ ...swatch, border: `2px solid ${recolor === pal.id ? C.accent : C.border}`, background: `linear-gradient(135deg, ${pal.accent}, ${pal.accent2})` }}
              />
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {presets.map((p) => (
              <PresetCard key={p.id} preset={p} recolor={recolor} onClick={() => apply(p)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PresetCard({ preset, recolor, onClick }: { preset: MockupDesignPreset; recolor: string | null; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let alive = true;
    const doc = buildPreset(preset.id);
    if (recolor) {
      const pal = MOCKUP_PALETTES.find((x) => x.id === recolor);
      if (pal) { doc.canvas.accent = pal.accent; doc.canvas.accent2 = pal.accent2; }
    }
    rasterizeMockup(doc, 260 / 1600).then((off) => {
      if (!alive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = off.width; cv.height = off.height;
      cv.getContext('2d')?.drawImage(off, 0, 0);
    }).catch(() => {});
    return () => { alive = false; };
  }, [preset.id, recolor]);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ textAlign: 'left', background: C.soft, border: `2px solid ${hover ? C.accent : C.border}`, borderRadius: 12, padding: 0, overflow: 'hidden', cursor: 'pointer', color: C.ink, fontFamily: C.font, transition: 'border-color 120ms' }}
    >
      <div style={{ aspectRatio: '16 / 10', background: '#0b0d13' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div style={{ padding: '11px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: `linear-gradient(135deg, ${preset.accent}, ${preset.accent2})`, flex: '0 0 auto' }} />
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{preset.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.inkSoft, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 6px' }}>{preset.tone === 'lys' ? 'Lys' : 'Mørk'}</span>
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5, lineHeight: 1.35 }}>{preset.blurb}</div>
      </div>
    </button>
  );
}

const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const chip: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 18, padding: '7px 15px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const swatch: React.CSSProperties = { width: 26, height: 26, borderRadius: 7, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.font };

export default DesignGallery;
