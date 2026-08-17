/**
 * CampaignCompareDialog — side-ved-side sammenligning av alle «kampanje»-mal-varianter
 * (f.eks. de 6 PreVisit-annonsene), pluss mulighet til å eksportere dem etter hverandre
 * som ÉN video («alle kampanjer i samme tidslinje» — hardkutt mellom hver, ingen crossfade).
 *
 * Rendrer rett fra MOCKUP_TEMPLATES (samme mønster som OnboardingDialog sin TemplateCard),
 * ikke fra lagrede dokumenter — Mockup Studio har kun ÉN aktiv lagret kampanje om gangen.
 */

import { useEffect, useRef, useState } from 'react';
import { rasterizeMockup } from './mockupRaster';
import { exportAndSaveSequence } from './mockupMotionExport';
import { motionExportAvailable } from './mockupMotionExport';
import { MOTION_PRESETS, type MotionConfig } from './mockupMotion';
import { MOCKUP_TEMPLATES, type MockupTemplate } from './mockupStudioModel';
import { useMockupStudio } from './mockupStudioStore';

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

export function CampaignCompareDialog({ category, onClose, onDone }: { category: string; onClose: () => void; onDone?: () => void }) {
  const newFromTemplate = useMockupStudio((s) => s.newFromTemplate);
  const templates = MOCKUP_TEMPLATES.filter((t) => t.category === category);
  const [cfgId, setCfgId] = useState(MOTION_PRESETS[0].id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const openInEditor = (id: string) => { newFromTemplate(id); onDone?.(); onClose(); };

  const exportAll = async () => {
    if (busy) return;
    setBusy(true);
    setMsg('Starter…');
    try {
      const cfg: MotionConfig = MOTION_PRESETS.find((p) => p.id === cfgId)?.cfg ?? MOTION_PRESETS[0].cfg;
      const docs = templates.map((t) => t.build());
      const saved = await exportAndSaveSequence(docs, cfg, 0.75, `kampanje-sammenligning`, (l, f) => setMsg(`🎬 ${l} ${Math.round(f * 100)}%`));
      setMsg(saved ? '✓ Lagret' : null);
    } catch (e) {
      setMsg(`Feilet: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: C.font }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 1040, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>Sammenlign kampanjer</h2>
          <button onClick={onClose} style={ghost}>Lukk</button>
        </div>
        <p style={{ fontSize: 13.5, color: C.inkSoft, margin: '0 0 16px' }}>
          Alle {templates.length} variantene side ved side. Klikk en for å åpne den i editoren.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          {templates.map((t) => (
            <CampaignCard key={t.id} template={t} onClick={() => openInEditor(t.id)} />
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Eksporter alle som én video (tidslinje):</span>
          <select value={cfgId} onChange={(e) => setCfgId(e.target.value)} style={select}>
            {MOTION_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button
            onClick={() => void exportAll()}
            disabled={busy || !motionExportAvailable()}
            style={{ ...primary, opacity: busy || !motionExportAvailable() ? 0.5 : 1 }}
            title={motionExportAvailable() ? 'Hver kampanje spilles etter hverandre i én WebM-video' : 'Video-opptak støttes ikke i denne webviewen'}
          >
            {busy ? 'Eksporterer…' : '🎬 Eksporter sekvens'}
          </button>
          {msg && <span style={{ fontSize: 12.5, color: C.inkSoft }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ template, onClick }: { template: MockupTemplate; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const doc = template.build();
    rasterizeMockup(doc, 320 / doc.canvas.w).then((off) => {
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
      style={{ textAlign: 'left', background: C.soft, border: `2px solid ${C.border}`, borderRadius: 12, padding: 0, overflow: 'hidden', cursor: 'pointer', color: C.ink, fontFamily: C.font }}
    >
      <div style={{ aspectRatio: '1 / 1', background: '#0b0d13' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div style={{ padding: '8px 10px', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</div>
    </button>
  );
}

const primary: React.CSSProperties = { background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: C.font };
const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const select: React.CSSProperties = { background: C.soft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: C.font };
