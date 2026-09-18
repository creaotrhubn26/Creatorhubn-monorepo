import { useEffect, useMemo, useRef, useState } from 'react';
import { rasterizeMockup } from './mockupRaster';
import { exportAndSaveSequence, motionExportAvailable } from './mockupMotionExport';
import { MOTION_PRESETS, type MotionConfig } from './mockupMotion';
import { listProjects, MOCKUP_TEMPLATES, type MockupDoc } from './mockupStudioModel';
import { loadCachedMockupProjects } from './mockupProjectRepository';
import { useMockupStudio } from './mockupStudioStore';

const C = {
  overlay: 'rgba(6,8,13,0.72)', card: '#12151f', soft: '#171b28',
  border: 'rgba(255,255,255,0.09)', ink: '#eef1f8', inkSoft: '#9aa0b4',
  accent: '#22d3ee', accentInk: '#04121a', font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

export function CampaignCompareDialog({ category, onClose, onDone }: { category: string; onClose: () => void; onDone?: () => void }) {
  const active = useMockupStudio((state) => state.doc);
  const setDocument = useMockupStudio((state) => state.setDocument);
  const fallback = useMemo(() => MOCKUP_TEMPLATES.filter((template) => template.category === category).map((template) => template.build()), [category]);
  const [saved, setSaved] = useState<MockupDoc[]>(() => {
    const all = listProjects();
    return active.campaignId ? all.filter((doc) => doc.campaignId === active.campaignId) : [];
  });
  const [cfgId, setCfgId] = useState(MOTION_PRESETS[0].id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadCachedMockupProjects().then((cached) => {
      const map = new Map([...listProjects(), ...cached].map((doc) => [doc.id, doc]));
      const all = [...map.values()];
      setSaved(active.campaignId ? all.filter((doc) => doc.campaignId === active.campaignId) : []);
    }).catch(() => {});
  }, [active.campaignId]);
  const docs = saved.length > 0 ? saved : fallback;
  const usingSaved = saved.length > 0;
  const openInEditor = (doc: MockupDoc) => { setDocument(doc); onDone?.(); onClose(); };

  const exportAll = async () => {
    if (busy) return;
    setBusy(true); setMsg('Starter…');
    try {
      const config: MotionConfig = MOTION_PRESETS.find((preset) => preset.id === cfgId)?.cfg ?? MOTION_PRESETS[0].cfg;
      const savedPath = await exportAndSaveSequence(docs, config, 0.75, 'kampanje-sammenligning', (label, fraction) => setMsg(`🎬 ${label} ${Math.round(fraction * 100)}%`));
      setMsg(savedPath ? '✓ Lagret' : null);
    } catch (error) {
      setMsg(`Feilet: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: C.font }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ width: 1040, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>{active.campaignName || 'Sammenlign kampanje'}</h2>
          <button onClick={onClose} style={ghost}>Lukk</button>
        </div>
        <p style={{ fontSize: 13.5, color: C.inkSoft, margin: '0 0 16px' }}>
          {usingSaved
            ? `${docs.length} faktiske, redigerbare varianter side ved side. Klikk en for å åpne akkurat den versjonen.`
            : 'Ingen lagrede kampanjevarianter funnet. Viser malene som utgangspunkt.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          {docs.map((doc) => <CampaignCard key={doc.id} doc={doc} onClick={() => openInEditor(doc)} />)}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Eksporter variantene som én sekvens:</span>
          <select value={cfgId} onChange={(event) => setCfgId(event.target.value)} style={select}>
            {MOTION_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
          <button onClick={() => void exportAll()} disabled={busy || !motionExportAvailable()} style={{ ...primary, opacity: busy || !motionExportAvailable() ? 0.5 : 1 }}>
            {busy ? 'Eksporterer…' : '🎬 Eksporter sekvens'}
          </button>
          {msg && <span style={{ fontSize: 12.5, color: C.inkSoft }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}
function CampaignCard({ doc, onClick }: { doc: MockupDoc; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    rasterizeMockup(doc, 320 / Math.max(doc.canvas.w, 1)).then((offscreen) => {
      if (!alive) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width; canvas.height = offscreen.height;
      canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
    }).catch(() => {});
    return () => { alive = false; };
  }, [doc]);
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: C.soft, border: `2px solid ${C.border}`, borderRadius: 12, padding: 0, overflow: 'hidden', cursor: 'pointer', color: C.ink, fontFamily: C.font }}>
      <div style={{ aspectRatio: '1 / 1', background: '#0b0d13' }}><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} /></div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.variantLabel || doc.name}</div>
        <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>{doc.name}</div>
      </div>
    </button>
  );
}
const primary: React.CSSProperties = { background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: C.font };
const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const select: React.CSSProperties = { background: C.soft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: C.font };
