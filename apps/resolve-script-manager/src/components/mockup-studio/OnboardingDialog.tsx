/**
 * OnboardingDialog — «Velg utgangspunkt» (§3 skjerm 2).
 *
 * Hjelper ikke-designeren velge riktig STRUKTUR ut fra formål, ikke estetikk:
 * velg hva materialet skal hjelpe med → systemet anbefaler relevante maler
 * (ekte forhåndsvisninger, ikke grå bokser). Ingen «tomt lerret».
 */

import { useEffect, useRef, useState } from 'react';
import { rasterizeMockup } from './mockupRaster';
import { useMockupStudio } from './mockupStudioStore';
import {
  MOCKUP_TEMPLATES,
  PURPOSE_CATEGORIES,
  CATEGORY_LABELS,
  type MockupTemplate,
} from './mockupStudioModel';

const C = {
  overlay: 'rgba(6,8,13,0.72)',
  card: '#12151f',
  soft: '#171b28',
  border: 'rgba(255,255,255,0.09)',
  ink: '#eef1f8',
  inkSoft: '#9aa0b4',
  accent: '#22d3ee',
  accentInk: '#04121a',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

export function OnboardingDialog({ onClose }: { onClose: () => void }) {
  const newFromTemplate = useMockupStudio((s) => s.newFromTemplate);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const cats = purpose ? PURPOSE_CATEGORIES.find((p) => p.id === purpose)?.categories ?? [] : [];
  const templates = purpose ? MOCKUP_TEMPLATES.filter((t) => cats.includes(t.category)) : MOCKUP_TEMPLATES;

  const use = () => { if (selected) { newFromTemplate(selected); onClose(); } };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: C.font }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 780, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>Hva skal du lage?</h2>
          <button onClick={onClose} style={ghost}>Lukk</button>
        </div>
        <p style={{ fontSize: 13.5, color: C.inkSoft, margin: '0 0 16px' }}>Velg formål, så anbefaler vi maler som passer.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {PURPOSE_CATEGORIES.map((p) => (
            <button key={p.id} onClick={() => { setPurpose(p.id === purpose ? null : p.id); setSelected(null); }} style={{ ...chip, background: purpose === p.id ? C.accent : C.soft, color: purpose === p.id ? C.accentInk : C.ink }}>{p.label}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 12, fontWeight: 700 }}>
          {purpose ? 'Anbefalt for deg' : 'Alle maler'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} active={selected === t.id} onClick={() => setSelected(t.id)} onDouble={() => { setSelected(t.id); newFromTemplate(t.id); onClose(); }} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={use} disabled={!selected} style={{ ...primary, opacity: selected ? 1 : 0.5 }}>Bruk denne malen</button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, active, onClick, onDouble }: { template: MockupTemplate; active: boolean; onClick: () => void; onDouble: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const doc = template.build();
    rasterizeMockup(doc, 200 / 1600).then((off) => {
      if (!alive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = off.width; cv.height = off.height;
      cv.getContext('2d')?.drawImage(off, 0, 0);
    }).catch(() => {});
    return () => { alive = false; };
  }, [template]);

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDouble}
      style={{ textAlign: 'left', background: C.soft, border: `2px solid ${active ? C.accent : C.border}`, borderRadius: 12, padding: 0, overflow: 'hidden', cursor: 'pointer', color: C.ink, fontFamily: C.font }}
    >
      <div style={{ aspectRatio: '16 / 10', background: '#0b0d13' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{template.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <Badge>{CATEGORY_LABELS[template.category]}</Badge>
          <Badge>{template.variant === 'light' ? 'Lys' : 'Mørk'}</Badge>
          <Badge>{template.devices} enhet{template.devices > 1 ? 'er' : ''}</Badge>
        </div>
      </div>
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10.5, color: C.inkSoft, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 6px' }}>{children}</span>;
}

const primary: React.CSSProperties = { background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: C.font };
const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const chip: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 20, padding: '8px 16px', fontSize: 13.5, cursor: 'pointer', fontFamily: C.font };

export default OnboardingDialog;
