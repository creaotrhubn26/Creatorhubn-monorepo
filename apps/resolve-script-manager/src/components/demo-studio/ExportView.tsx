/**
 * ExportView — Export-modulen (spec §2.6). Koblet til den ekte render-
 * pipelinen (mockup_render_video → scripts/mockup-polish-pro.mts).
 *
 * Brukeren velger format/oppløsning/fps + include-toggles, og trykker
 * "Eksporter". Vi bygger en MockupConfig fra valgene + samler scenenes
 * opptaks-klipp (recordingPath), kaller broen, og streamer fremdrift via
 * onScriptEvent. Når ferdig: vis sti + "Åpne".
 *
 * Ærlig håndtering: hvis ingen scener har opptak ennå, forklarer vi at man
 * må ta opp i Guided Recorder først (eksport trenger klipp å montere).
 */

import { useEffect, useRef, useState } from 'react';
import { mockupRenderVideo, onScriptEvent, cancelScript, demoWriteText, demoWriteBinary, demoPrintHtml } from '../../api';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { openPath } from '@tauri-apps/plugin-opener';
import { open as openFileDialog, save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { useDemoStudio } from './demoStudioStore';
import { totalDuration } from './demoStudioModel';
import { buildSrt, buildScriptHtml, renderThumbnail } from './demoStudioExports';

const C = {
  navBg: '#1c1a18', bg: '#f6f3ee', panel: '#ffffff', cream: '#faf7f2', line: '#eae5dd',
  lineStrong: '#ddd6cc', ink: '#1d1b19', inkSoft: '#6b6358', inkFaint: '#9a9186',
  accent: '#ef8a5d', dark: '#2f2a26', green: '#4a9d6b', red: '#d9534f',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

const FORMATS = [
  { id: '16:9', label: '16:9', sub: 'YouTube / web' },
  { id: '9:16', label: '9:16', sub: 'Reels / Shorts' },
  { id: '1:1', label: '1:1', sub: 'Instagram' },
  { id: '4:5', label: '4:5', sub: 'Social feed' },
] as const;
const RESOLUTIONS = ['1080p', '1440p', '4K'] as const;
const FPS = [24, 30, 60] as const;

// Mål-sideforhold (b/h) per format → pipelinen cropper/padder til dette.
const ASPECT: Record<typeof FORMATS[number]['id'], number> = {
  '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5,
};
// Target-høyde (px) per oppløsning for det valgte sideforholdet.
const TARGET_H: Record<typeof RESOLUTIONS[number], number> = { '1080p': 1080, '1440p': 1440, '4K': 2160 };

interface ToggleDef { key: string; label: string; def: boolean; }
// Kun toggles som FAKTISK gjør noe i pipelinen.
const TOGGLES: ToggleDef[] = [
  { key: 'voiceover', label: 'Inkluder voiceover', def: true },
  { key: 'music', label: 'Bakgrunnsmusikk', def: false },
];
// Funksjoner som ennå ikke er koblet — vises som «(kommer)», ikke som aktive brytere.
const COMING_SOON = ['Vis cursor i video', 'Overlays / callouts i video'];

export function ExportView() {
  const { project } = useDemoStudio();
  const [format, setFormat] = useState<typeof FORMATS[number]['id']>('16:9');
  const [resolution, setResolution] = useState<typeof RESOLUTIONS[number]>('1080p');
  const [fps, setFps] = useState<typeof FPS[number]>(30);
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.def])),
  );
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0); // 0–100
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [musicPath, setMusicPath] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const runIdRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null); // unngå stale closure i finally

  useEffect(() => () => { unlistenRef.current?.(); }, []);

  const pickMusic = async () => {
    const sel = await openFileDialog({ multiple: false, filters: [{ name: 'Lyd', extensions: ['mp3', 'm4a', 'wav', 'aac'] }] });
    if (typeof sel === 'string') { setMusicPath(sel); setToggles((s) => ({ ...s, music: true })); }
  };

  const cancelExport = async () => {
    const id = runIdRef.current;
    if (id) { try { await cancelScript(id); } catch { /* ignore */ } }
    setStatusLabel('Avbryter…');
  };

  const safeName = () => (project?.name || 'demo').replace(/[^\w-]+/g, '_');

  const exportSrt = async () => {
    if (!project) return;
    setFileMsg(null);
    const path = await saveFileDialog({ defaultPath: `${safeName()}.srt`, filters: [{ name: 'SubRip', extensions: ['srt'] }] });
    if (typeof path !== 'string') return;
    try { const p = await demoWriteText(path, buildSrt(project.scenes)); setFileMsg(`✓ Undertekster lagret: ${p}`); void openPath(p).catch(() => {}); }
    catch (e) { setFileMsg('Feil ved lagring av .srt: ' + String(e)); }
  };

  const exportScriptPdf = async () => {
    if (!project) return;
    setFileMsg(null);
    try { await demoPrintHtml(buildScriptHtml(project)); setFileMsg('Manus åpnet i eget vindu — velg «Lagre som PDF» i utskriftsdialogen.'); }
    catch (e) { setFileMsg('Feil ved manus-PDF: ' + String(e)); }
  };

  const exportThumbnail = async () => {
    if (!project) return;
    setFileMsg(null);
    const dataUrl = renderThumbnail(project, format);
    if (!dataUrl) { setFileMsg('Kunne ikke tegne thumbnail.'); return; }
    const path = await saveFileDialog({ defaultPath: `${safeName()}-thumbnail.png`, filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (typeof path !== 'string') return;
    try { const p = await demoWriteBinary(path, dataUrl); setFileMsg(`✓ Thumbnail lagret: ${p}`); void openPath(p).catch(() => {}); }
    catch (e) { setFileMsg('Feil ved thumbnail: ' + String(e)); }
  };

  if (!project) return <div style={{ padding: 40, fontFamily: C.font, color: C.inkSoft }}>Opprett en demo først.</div>;

  const scenes = project.scenes;
  const recorded = scenes.filter((s) => s.recordingPath);
  const canExport = recorded.length > 0;

  const startExport = async () => {
    setError(null); setResultPath(null); resultRef.current = null; runIdRef.current = null;
    setPct(0); setStatusLabel('Starter…'); setBusy(true);
    // Lytt på fremdrift fra pipelinen. percent er 0–100; result-eventet legger
    // outputPath TOP-LEVEL (ikke i .value).
    unlistenRef.current = await onScriptEvent((ev) => {
      if (ev.runId && !runIdRef.current) runIdRef.current = ev.runId;
      if (ev.type === 'progress') { if (typeof ev.percent === 'number') setPct(ev.percent); if (ev.label) setStatusLabel(ev.label); }
      else if (ev.type === 'result') { if (ev.outputPath) { resultRef.current = ev.outputPath; setResultPath(ev.outputPath); } }
      else if (ev.type === 'error') setError(ev.message ?? 'Ukjent feil');
    });
    const config = {
      visual: { device: scenes[0]?.device ?? 'macbook', orientation: scenes[0]?.orientation ?? 'portrait',
        fit: 'cover', background: 'transparent',
        shadow: true, statusBarCrop: 0.045, fadeSeconds: 0.5, autoZoom: true },
      audio: { enabled: toggles.voiceover, noiseGate: true, polish: true, loudnessNormalize: true, loudnessTarget: -14 },
      music: { enabled: toggles.music && !!musicPath, source: musicPath, volume: 0.5, ducking: true, duckDb: -12 },
      export: {
        format: format === '9:16' ? 'prores4444' : 'mp4',
        pixelRatio: resolution === '4K' ? 7 : resolution === '1440p' ? 6 : 5,
        frameRate: fps,
        // Mål-sideforhold + høyde → pipelinen cropper/padder til nøyaktig dette.
        aspect: ASPECT[format], targetHeight: TARGET_H[resolution],
      },
    };
    const clips = recorded.map((s) => s.recordingPath!).filter(Boolean);
    const outName = `${project.name.replace(/[^\w-]+/g, '_')}-demo.${format === '9:16' ? 'mov' : 'mp4'}`;
    try {
      const summary = await mockupRenderVideo(config as Record<string, unknown>, clips, outName, toggles.music ? musicPath : null);
      if (!summary.succeeded && !resultRef.current) setError('Render fullførte ikke');
      else { setPct(100); setStatusLabel('Ferdig'); }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      runIdRef.current = null;
      unlistenRef.current?.(); unlistenRef.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: C.font, fontSize: 13, color: C.ink, background: C.bg }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Eksporter</h2>
        <p style={{ color: C.inkSoft, fontSize: 13, margin: '0 0 24px' }}>
          {scenes.length} scener · {fmtDur(totalDuration(scenes))} · {recorded.length} med opptak
        </p>

        {/* Format */}
        <Section label="Videoformat">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {FORMATS.map((f) => (
              <div key={f.id} onClick={() => setFormat(f.id)}
                style={{ ...card, borderColor: format === f.id ? C.accent : C.line, background: format === f.id ? C.cream : '#fff' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: C.inkFaint }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Oppløsning + FPS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Section label="Oppløsning">
            <div style={{ display: 'flex', gap: 8 }}>
              {RESOLUTIONS.map((r) => (
                <div key={r} onClick={() => setResolution(r)} style={{ ...pill, ...(resolution === r ? pillActive : {}) }}>{r}</div>
              ))}
            </div>
          </Section>
          <Section label="FPS">
            <div style={{ display: 'flex', gap: 8 }}>
              {FPS.map((f) => (
                <div key={f} onClick={() => setFps(f)} style={{ ...pill, ...(fps === f ? pillActive : {}) }}>{f}</div>
              ))}
            </div>
          </Section>
        </div>

        {/* Include-toggles — kun de som faktisk virker */}
        <Section label="Inkluder">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
            {TOGGLES.map((t) => (
              <div key={t.key} onClick={() => setToggles((s) => ({ ...s, [t.key]: !s[t.key] }))}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13 }}>
                {t.label}
                <span style={{ width: 36, height: 20, borderRadius: 10, background: toggles[t.key] ? C.accent : '#d8d2c8', position: 'relative', transition: 'background .15s' }}>
                  <span style={{ position: 'absolute', top: 2, left: toggles[t.key] ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </span>
              </div>
            ))}
          </div>
          {/* Musikk-fil (kreves når Bakgrunnsmusikk er på) */}
          {toggles.music && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <button style={{ ...outlineBtn, padding: '6px 12px' }} onClick={() => void pickMusic()}>Velg musikkfil…</button>
              <span style={{ color: musicPath ? C.ink : C.red, wordBreak: 'break-all' }}>
                {musicPath ? musicPath.split('/').pop() : 'Ingen fil valgt — musikk legges ikke på'}
              </span>
            </div>
          )}
          {/* Ærlig om hva som ikke er koblet ennå */}
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.inkFaint }}>
            Kommer: {COMING_SOON.join(' · ')}. Device-mockup legges alltid på.
          </div>
        </Section>

        {/* Leveranser (tekst & bilde) — utenom video-renderen */}
        <Section label="Leveranser (tekst & bilde)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button style={{ ...outlineBtn }} onClick={() => void exportSrt()}>Undertekster (.srt)</button>
            <button style={{ ...outlineBtn }} onClick={() => void exportScriptPdf()}>Manus (PDF)</button>
            <button style={{ ...outlineBtn }} onClick={() => void exportThumbnail()}>Thumbnail (PNG)</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.inkFaint }}>
            .srt fra manus + varigheter · Manus åpnes i print-vindu (lagre som PDF) · Thumbnail i valgt format.
          </div>
          {fileMsg && <div style={{ marginTop: 8, fontSize: 12, color: fileMsg.startsWith('Feil') ? C.red : C.green, wordBreak: 'break-all' }}>{fileMsg}</div>}
        </Section>

        {/* Eksport-knapp + progress */}
        <div style={{ marginTop: 28, borderTop: `1px solid ${C.line}`, paddingTop: 20 }}>
          {!canExport && (
            <div style={{ background: '#fdf3e7', border: `1px solid #f0d9b8`, borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#8a6515', marginBottom: 16 }}>
              Ingen scener har opptak ennå. Ta opp scener i <strong>Guided Recorder</strong> først — eksport monterer opptakene til én produktvideo.
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button disabled={busy || !canExport} onClick={() => void startExport()}
              style={{ ...primaryBtn, opacity: busy || !canExport ? 0.5 : 1 }}>
              {busy ? `Eksporterer… ${Math.round(pct)}%` : `Eksporter ${format} ${resolution}`}
            </button>
            {busy && (
              <button onClick={() => void cancelExport()} style={{ ...outlineBtn }}>Avbryt</button>
            )}
          </div>

          {busy && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 6, background: '#eee4d8', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: C.accent, borderRadius: 3, transition: 'width .2s' }} />
              </div>
              {statusLabel && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>{statusLabel}</div>}
            </div>
          )}

          {resultPath && !busy && (
            <div style={{ marginTop: 16, background: '#eef7f0', border: `1px solid #bfe0c9`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.green, marginBottom: 4 }}>✓ Eksport ferdig</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10, wordBreak: 'break-all' }}>{resultPath}</div>
              <button style={{ ...outlineBtn }} onClick={() => void openPath(resultPath).catch(() => {})}>Åpne video</button>
            </div>
          )}
          {error && <div style={{ marginTop: 14, fontSize: 12.5, color: C.red }}>Feil: {error}</div>}
        </div>
      </div>

      {/* Høyre: eksport-presets (AI Export Assistant, spec §5.4) */}
      <div style={{ width: 300, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.line}`, padding: 18, overflowY: 'auto' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>✦ Flere versjoner</h3>
        <p style={{ fontSize: 11.5, color: C.inkFaint, margin: '0 0 14px' }}>AI kan lage tilpassede klipp etter eksport (kommer).</p>
        {[
          ['Full product demo', '16:9 · komplett'],
          ['30-sek LinkedIn-cut', '1:1 · kort'],
          ['15-sek teaser', '9:16 · vertikal'],
          ['Tutorial-versjon', '16:9 · m/ steg'],
        ].map(([t, s]) => (
          <div key={t} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, opacity: 0.7 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div>
            <div style={{ fontSize: 11, color: C.inkFaint }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.inkSoft, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const card: React.CSSProperties = { border: `2px solid ${C.line}`, borderRadius: 10, padding: '12px 10px', cursor: 'pointer', textAlign: 'center' };
const pill: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, background: '#fff' };
const pillActive: React.CSSProperties = { borderColor: C.accent, background: C.cream, fontWeight: 600 };
const primaryBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #ef8a5d, #d96a3a)', border: 0, color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 22px', borderRadius: 9, cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { background: '#fff', border: `1px solid ${C.lineStrong}`, color: C.ink, fontSize: 13, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' };

export default ExportView;
