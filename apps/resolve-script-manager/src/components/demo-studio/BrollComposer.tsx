/**
 * BrollComposer — legg en AI-generert kinematisk scene inn i storyboardet.
 *
 * Den andre footage-typen i Demo Studio: syntetisk video (krok, kontekst,
 * overgang, outro) som et skjermopptak ikke kan gi. Genererer via Higgsfield
 * (Seedance 2.0) og lagrer klippet som scenens recordingPath — så den flyter
 * gjennom nøyaktig samme eksport som en fanget scene. Viser kreditt-estimat +
 * konto-status FØR generering (kreditter er en ekte kostnad — aldri på by default).
 */
import { useEffect, useState } from 'react';
import {
  generateBrollClip, higgsfieldAccountStatus, estimateBrollCredits, type BrollResolution,
} from '../../api';
import { useDemoStudio } from './demoStudioStore';
import { makeScene } from './demoStudioModel';

interface Palette {
  panel: string; cream: string; line: string; lineStrong: string;
  ink: string; inkSoft: string; inkFaint: string; accent: string; green: string; font: string;
}

type Position = 'intro' | 'outro' | 'after';

export function BrollComposer({ C, onClose }: { C: Palette; onClose: () => void }) {
  const { project, selectedSceneId, replaceScenes, updateScene, selectScene } = useDemoStudio();
  const [prompt, setPrompt] = useState('');
  const [narration, setNarration] = useState('');
  const [position, setPosition] = useState<Position>('intro');
  const [durationSec, setDurationSec] = useState(6);
  const [resolution, setResolution] = useState<BrollResolution>('1080p');
  const [noPeople, setNoPeople] = useState(false);
  const [anchor, setAnchor] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Smart standard-prompt fra produkt-konteksten (engelsk — Seedance forventer det).
  useEffect(() => {
    const name = project?.name && project.name !== 'Untitled Demo' ? project.name : 'the product';
    setPrompt(`Cinematic establishing shot introducing ${name}: warm, modern, aspirational mood, soft natural light, shallow depth of field, smooth slow camera move, premium product-film look`);
  }, [project?.name]);

  // Konto-/kreditt-status ved åpning.
  useEffect(() => {
    let alive = true;
    higgsfieldAccountStatus()
      .then((s) => { if (alive) setAccount(s || '(status utilgjengelig)'); })
      .catch((e) => { if (alive) setAccountErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const estCredits = estimateBrollCredits(resolution, durationSec);
  // «Forankre i ekte ramme»: en fanget produkt-skjerm Seedance animerer fra
  // (levende produkt-skjerm). Web-scan gir dataURL-er; fall tilbake til mobil-scan.
  const anchorFrame = project?.scanShots?.[0]?.dataUrl ?? project?.scanShotsMobile?.[0]?.dataUrl ?? null;

  const generate = async () => {
    if (!project || !prompt.trim() || busy) return;
    setBusy(true); setErr(null);

    // Bygg broll-scenen og sett den inn (status 'recording' = genereres nå).
    const device = project.devices[0] ?? 'macbook';
    const scene = makeScene(0, device);
    scene.source = 'broll';
    scene.brollPrompt = prompt.trim();
    scene.title = 'Kinematisk klipp';
    scene.narration = narration.trim();
    scene.requiredAction = 'AI-generert kinematisk klipp (Higgsfield Seedance)';
    scene.actionType = 'wait';
    scene.duration = durationSec;
    scene.status = 'recording';

    const scenes = [...project.scenes];
    const selIdx = scenes.findIndex((s) => s.id === selectedSceneId);
    const at = position === 'intro' ? 0 : position === 'outro' ? scenes.length : (selIdx >= 0 ? selIdx + 1 : scenes.length);
    scenes.splice(at, 0, scene);
    replaceScenes(scenes);
    selectScene(scene.id);

    try {
      const path = await generateBrollClip({
        projectId: project.id, sceneId: scene.id, prompt: prompt.trim(),
        startImage: anchor && anchorFrame ? anchorFrame : null, durationSec, resolution, noPeople,
      });
      updateScene(scene.id, { recordingPath: path, status: 'done' });
      onClose();
    } catch (e) {
      updateScene(scene.id, { status: 'retake' });
      setErr(`Generering feilet: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${C.lineStrong}`,
    background: C.panel, color: C.ink, fontFamily: C.font, fontSize: 12.5, boxSizing: 'border-box',
  };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.inkSoft, margin: '14px 0 6px', letterSpacing: '.01em' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,27,23,0.42)', display: 'grid', placeItems: 'center', zIndex: 80 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', background: C.panel,
        borderRadius: 16, padding: '20px 22px 24px', boxShadow: '0 24px 60px rgba(31,27,23,0.28)', fontFamily: C.font,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Kinematisk scene</div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: C.inkFaint, fontSize: 18, lineHeight: 1 }}>✕</div>
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
          AI-generert footage for kroken, konteksten eller outroen — det et skjermopptak ikke kan gi. Flyter inn i demoen som en vanlig scene.
        </div>

        <div style={label}>Prompt (engelsk)</div>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ ...field, resize: 'vertical', lineHeight: 1.4 }} />

        <div style={label}>Voiceover for scenen (valgfritt)</div>
        <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="La stå tom for ren b-roll uten tale" style={field} />

        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Plassering</div>
            <select value={position} onChange={(e) => setPosition(e.target.value as Position)} style={field}>
              <option value="intro">Intro (start)</option>
              <option value="after">Etter valgt scene</option>
              <option value="outro">Outro (slutt)</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={label}>Oppløsning</div>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as BrollResolution)} style={field}>
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </div>
        </div>

        <div style={label}>Varighet: {durationSec}s</div>
        <input type="range" min={4} max={15} value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} style={{ width: '100%' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.inkSoft, marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={noPeople} onChange={(e) => setNoPeople(e.target.checked)} />
          Ingen mennesker/ansikter (ren miljø-/produkt-b-roll)
        </label>

        {/* Forankre i ekte ramme (levende produkt-skjerm) */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: anchorFrame ? C.inkSoft : C.inkFaint, marginTop: 10, cursor: anchorFrame ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={anchor && !!anchorFrame} disabled={!anchorFrame} onChange={(e) => setAnchor(e.target.checked)} />
          Forankre i produkt-ramme <span style={{ color: C.inkFaint }}>(animér en ekte skjerm)</span>
          {anchorFrame && anchor && (
            <img src={anchorFrame} alt="anker" style={{ width: 40, height: 26, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.line}`, marginLeft: 'auto' }} />
          )}
          {!anchorFrame && <span style={{ marginLeft: 'auto', fontSize: 10.5 }}>(skann siden først)</span>}
        </label>

        {/* Kreditt-vokter + konto-status */}
        <div style={{ marginTop: 16, padding: '11px 13px', borderRadius: 10, background: C.cream, border: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 12.5, color: C.ink }}>
            Estimert kostnad: <strong>~{estCredits} kreditter</strong> <span style={{ color: C.inkFaint }}>({resolution}, {durationSec}s)</span>
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
            {accountErr ? `Konto: ${accountErr}` : account ? `Higgsfield: ${account}` : 'Sjekker konto…'}
          </div>
        </div>

        {err && <div style={{ marginTop: 12, fontSize: 12, color: '#d9534f', lineHeight: 1.45 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${C.lineStrong}`, background: C.panel, color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: busy ? 'default' : 'pointer', fontFamily: C.font }}>
            Avbryt
          </button>
          <button onClick={generate} disabled={busy || !prompt.trim() || !!accountErr} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.accent}`, background: C.accent, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: busy || !prompt.trim() || accountErr ? 'default' : 'pointer', opacity: busy || !prompt.trim() || accountErr ? 0.55 : 1, fontFamily: C.font }}>
            {busy ? 'Genererer — 1-3 min…' : `Generér (~${estCredits} kr)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BrollComposer;
