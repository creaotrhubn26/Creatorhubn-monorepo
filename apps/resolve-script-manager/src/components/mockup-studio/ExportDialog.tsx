/**
 * ExportDialog — flerstegs eksport-flyt (§7 / skjerm 7).
 *
 * Kvalitetssjekk (preflight) → velg format → format-innstillinger → status.
 * Gjør eksport forståelig for ikke-designere, men støtter proff-behov (PNG
 * 1×/2×/4×, PDF, selvstendig PSD og redigerbar PSD via Photoshop-broen).
 * Fullførte eksporter lagres i historikk.
 */

import { useEffect, useState } from 'react';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { demoWriteBinary } from '../../api';
import { rasterizeToPngDataUrl } from './mockupRaster';
import { buildPdfBase64 } from './mockupExport';
import { buildPsdBase64 } from './mockupPsd';
import { buildEditablePsdViaBridge, isBridgeConnected } from './mockupPhotoshop';
import { runPreflight, preflightSummary, SEVERITY_LABEL, type PreflightIssue, type PreflightSeverity } from './mockupPreflight';
import { useMockupStudio } from './mockupStudioStore';
import { safeDocName, addExport, setProjectStatus } from './mockupStudioModel';

const C = {
  overlay: 'rgba(6,8,13,0.72)',
  card: '#12151f',
  soft: '#171b28',
  border: 'rgba(255,255,255,0.09)',
  ink: '#eef1f8',
  inkSoft: '#9aa0b4',
  accent: '#22d3ee',
  accentInk: '#04121a',
  must: '#f0a0a0',
  should: '#e0b060',
  info: '#8fb8e0',
  ok: '#4ade80',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

type ExportFormat = 'png' | 'pdf' | 'psd' | 'psd_bridge';
type Step = 'preflight' | 'format' | 'settings' | 'running' | 'done';

const SEV_COLOR: Record<PreflightSeverity, string> = { must: C.must, should: C.should, info: C.info };

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const doc = useMockupStudio((s) => s.doc);
  const select = useMockupStudio((s) => s.select);

  const [step, setStep] = useState<Step>('preflight');
  const [issues, setIssues] = useState<PreflightIssue[] | null>(null);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState<1 | 2 | 4>(2);
  const [status, setStatus] = useState('');
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    runPreflight(doc, scale).then((r) => { if (alive) setIssues(r); });
    return () => { alive = false; };
    // kjør på nytt når skala endres (påvirker oppløsnings-sjekk)
  }, [doc, scale]);

  const sum = issues ? preflightSummary(issues) : null;

  const jump = (i: PreflightIssue) => {
    if (i.deviceId) select({ kind: 'device', id: i.deviceId });
    else if (i.textId) select({ kind: 'text', id: i.textId });
    onClose();
  };

  const formatLabel = (): string =>
    format === 'png' ? `PNG ${scale}×` : format === 'pdf' ? 'PDF' : format === 'psd' ? 'PSD' : 'PSD ✎';

  const runExport = async () => {
    setStep('running');
    setErr(null);
    try {
      if (format === 'psd_bridge') {
        setStatus('Kobler til Photoshop-broen…');
        if (!(await isBridgeConnected())) {
          setErr('Photoshop-broen er ikke tilkoblet. Åpne Photoshop-fanen og last UXP-pluginen.');
          setStep('settings');
          return;
        }
        const path = await saveFileDialog({ defaultPath: `${safeDocName(doc.name)}.psd`, filters: [{ name: 'PSD', extensions: ['psd'] }] });
        if (typeof path !== 'string') { setStep('settings'); return; }
        setStatus('Bygger redigerbar PSD i Photoshop…');
        const res = await buildEditablePsdViaBridge(doc, path);
        finish(res.output_path);
        return;
      }
      const ext = format;
      setStatus('Tegner materialet…');
      const data =
        format === 'png' ? await rasterizeToPngDataUrl(doc, scale)
        : format === 'pdf' ? await buildPdfBase64(doc)
        : await buildPsdBase64(doc);
      const path = await saveFileDialog({ defaultPath: `${safeDocName(doc.name)}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (typeof path !== 'string') { setStep('settings'); return; }
      setStatus('Lagrer fil…');
      const saved = await demoWriteBinary(path, data);
      finish(saved);
    } catch (e) {
      setErr('Eksport feilet: ' + String(e));
      setStep('settings');
    }
  };

  const finish = (path: string) => {
    addExport(doc.name, formatLabel(), path);
    setProjectStatus(doc.id, 'exported');
    setResultPath(path);
    setStatus('');
    setStep('done');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: C.font }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 560, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, flex: 1 }}>Eksporter materiell</h2>
          <button onClick={onClose} style={ghost}>Lukk</button>
        </div>

        {/* Steg 1: Kvalitetssjekk */}
        {step === 'preflight' && (
          <div>
            <StepLabel>Kvalitetssjekk</StepLabel>
            {!issues && <div style={{ color: C.inkSoft, fontSize: 14 }}>Analyserer…</div>}
            {issues && issues.length === 0 && <div style={{ color: C.ok, fontSize: 14 }}>✓ Alt ser bra ut — ingen problemer funnet.</div>}
            {issues && issues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {issues.map((i, idx) => (
                  <button key={idx} onClick={() => jump(i)} style={{ ...issueRow, borderLeft: `3px solid ${SEV_COLOR[i.severity]}` }} title={(i.deviceId || i.textId) ? 'Gå til elementet' : undefined}>
                    <div style={{ fontSize: 11, color: SEV_COLOR[i.severity], textTransform: 'uppercase', letterSpacing: 0.5 }}>{SEVERITY_LABEL[i.severity]}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{i.title}</div>
                    {i.detail && <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{i.detail}</div>}
                  </button>
                ))}
              </div>
            )}
            {sum && !sum.ok && <div style={{ fontSize: 12.5, color: C.must, marginTop: 12 }}>{sum.must} kritisk(e) problem — vurdér å løse før eksport.</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setStep('format')} style={primary} disabled={!issues}>Fortsett til eksport</button>
            </div>
          </div>
        )}

        {/* Steg 2: Velg format */}
        {step === 'format' && (
          <div>
            <StepLabel>Velg format</StepLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormatCard active={format === 'png'} onClick={() => setFormat('png')} title="PNG" desc="Best for nettsider, e-post og sosiale medier." />
              <FormatCard active={format === 'pdf'} onClick={() => setFormat('pdf')} title="PDF" desc="Best for deling, presentasjon og utskrift." />
              <FormatCard active={format === 'psd'} onClick={() => setFormat('psd')} title="PSD (selvstendig)" desc="Lagdelt Photoshop-fil. Fungerer uten Photoshop åpent." />
              <FormatCard active={format === 'psd_bridge'} onClick={() => setFormat('psd_bridge')} title="PSD ✎ (redigerbar)" desc="Smart Objects + redigerbare tekstlag. Krever tilkoblet Photoshop-bro." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep('preflight')} style={ghost}>← Tilbake</button>
              <button onClick={() => setStep('settings')} style={primary}>Neste</button>
            </div>
          </div>
        )}

        {/* Steg 3: Innstillinger */}
        {step === 'settings' && (
          <div>
            <StepLabel>Innstillinger — {formatLabel()}</StepLabel>
            {format === 'png' && (
              <div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 6 }}>Oppløsning</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([1, 2, 4] as const).map((s) => (
                    <button key={s} onClick={() => setScale(s)} style={{ ...chip, background: scale === s ? C.accent : C.soft, color: scale === s ? C.accentInk : C.ink }}>{s}×</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>Eksporterer {doc.canvas.w * scale}×{doc.canvas.h * scale} px.</div>
              </div>
            )}
            {format === 'pdf' && <div style={{ fontSize: 13, color: C.inkSoft }}>Énsides PDF (RGB) i full oppløsning, klar for deling og utskrift.</div>}
            {format === 'psd' && <div style={{ fontSize: 13, color: C.inkSoft }}>Lagdelt PSD: bakgrunn, ett lag per enhet, ett per tekst + logo.</div>}
            {format === 'psd_bridge' && <div style={{ fontSize: 13, color: C.inkSoft }}>Bygges i Photoshop via broen: enheter som Smart Objects, tekst som redigerbare tekstlag.</div>}
            {err && <div style={{ fontSize: 13, color: C.must, marginTop: 12 }}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep('format')} style={ghost}>← Tilbake</button>
              <button onClick={() => void runExport()} style={primary}>Eksporter materiell</button>
            </div>
          </div>
        )}

        {/* Steg 4: Kjører */}
        {step === 'running' && (
          <div style={{ padding: '20px 0' }}>
            <StepLabel>{formatLabel()} bygges</StepLabel>
            <div style={{ fontSize: 14, color: C.inkSoft }}>{status || 'Arbeider…'}</div>
          </div>
        )}

        {/* Ferdig */}
        {step === 'done' && (
          <div>
            <StepLabel>Ferdig</StepLabel>
            <div style={{ fontSize: 14, color: C.ok, marginBottom: 6 }}>✓ {formatLabel()} eksportert.</div>
            {resultPath && <div style={{ fontSize: 12.5, color: C.inkSoft, wordBreak: 'break-all', marginBottom: 16 }}>{resultPath}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {resultPath && <button onClick={() => void openPath(resultPath).catch(() => {})} style={ghost}>Åpne fil</button>}
              <button onClick={() => setStep('format')} style={ghost}>Eksporter på nytt</button>
              <button onClick={onClose} style={primary}>Ferdig</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 12, fontWeight: 700 }}>{children}</div>;
}

function FormatCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: active ? 'rgba(34,211,238,0.10)' : C.soft, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', color: C.ink, fontFamily: C.font }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{desc}</div>
    </button>
  );
}

const primary: React.CSSProperties = { background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: C.font };
const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const chip: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: C.font };
const issueRow: React.CSSProperties = { textAlign: 'left', background: C.soft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', cursor: 'pointer', color: C.ink, fontFamily: C.font };

export default ExportDialog;
