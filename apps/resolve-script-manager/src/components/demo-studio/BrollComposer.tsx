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
  generateBrollClip, generateBrollClipFal, generatePresenterClip, higgsfieldAccountStatus,
  estimateBrollCredits, estimateFalCostUsd, type BrollResolution, type BrollProvider,
} from '../../api';
import { generateImage } from '../../services/aiImageService';
import { ttsProxy } from '../../services/claudeProxyService';
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
  const [provider, setProvider] = useState<BrollProvider>('higgsfield');
  const [mode, setMode] = useState<'broll' | 'presenter'>('broll');
  const [presenterDesc, setPresenterDesc] = useState('professional Scandinavian presenter, friendly, warm smile, neutral studio background, facing camera, photorealistic');
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
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
    if (!project || busy) return;
    const isPresenter = mode === 'presenter';
    if (isPresenter ? !narration.trim() : !prompt.trim()) return;
    setBusy(true); setErr(null); setBusyMsg(null);

    // Bygg scenen og sett den inn (status 'recording' = genereres nå).
    const device = project.devices[0] ?? 'macbook';
    const scene = makeScene(0, device);
    scene.source = 'broll';
    scene.brollPrompt = isPresenter ? presenterDesc.trim() : prompt.trim();
    scene.title = isPresenter ? 'Presentør' : 'Kinematisk klipp';
    scene.narration = narration.trim();
    scene.requiredAction = isPresenter ? 'AI-presentør, leppesynket til voiceover' : 'AI-generert kinematisk klipp (Higgsfield Seedance)';
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
      let path: string;
      if (isPresenter) {
        // Presentør-pipeline: ansikt (fal flux) → voiceover (TTS) → leppesynket klipp (Seedance).
        setBusyMsg('Lager presentør-ansikt…');
        const face = await generateImage({ prompt: `${presenterDesc.trim()}, head and shoulders portrait, looking at camera`, image_size: 'portrait_16_9' });
        setBusyMsg('Lager voiceover…');
        const b64 = await ttsProxy(narration.trim());
        if (!b64) throw new Error('kunne ikke lage voiceover (TTS) — sjekk innlogging.');
        setBusyMsg('Genererer leppesynket klipp… (1–3 min)');
        path = await generatePresenterClip({
          projectId: project.id, sceneId: scene.id,
          prompt: `${presenterDesc.trim()}, speaking naturally to camera`,
          presenterImage: face.image_path,
          audioDataUrl: `data:audio/mpeg;base64,${b64}`,
          resolution: (resolution === '4k' ? '1080p' : resolution),
        });
      } else if (provider === 'fal') {
        // fal Seedance er image-to-video → forankrings-rammen kreves.
        if (!anchorFrame) throw new Error('fal krever en produkt-ramme — skann siden først.');
        path = await generateBrollClipFal({
          projectId: project.id, sceneId: scene.id, prompt: prompt.trim(),
          imageDataUrl: anchorFrame, durationSec,
          resolution: (resolution === '4k' ? '1080p' : resolution) as '480p' | '720p' | '1080p',
        });
      } else {
        path = await generateBrollClip({
          projectId: project.id, sceneId: scene.id, prompt: prompt.trim(),
          startImage: anchor && anchorFrame ? anchorFrame : null, durationSec, resolution, noPeople,
        });
      }
      updateScene(scene.id, { recordingPath: path, status: 'done' });
      onClose();
    } catch (e) {
      updateScene(scene.id, { status: 'retake' });
      setErr(`Generering feilet: ${e instanceof Error ? e.message : e}`);
      setBusy(false); setBusyMsg(null);
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

        {/* Type: kinematisk klipp vs syntetisk presentør */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, background: C.cream, padding: 4, borderRadius: 10, border: `1px solid ${C.line}` }}>
          {(['broll', 'presenter'] as const).map((m) => (
            <div key={m} onClick={() => setMode(m)} style={{
              flex: 1, textAlign: 'center', padding: '7px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: mode === m ? C.panel : 'transparent', color: mode === m ? C.ink : C.inkSoft,
              boxShadow: mode === m ? '0 1px 3px rgba(31,27,23,0.1)' : 'none',
            }}>
              {m === 'broll' ? 'Kinematisk klipp' : 'Presentør (leppesynk)'}
            </div>
          ))}
        </div>

        {mode === 'broll' ? (
          <>
            <div style={label}>Leverandør</div>
            <select value={provider} onChange={(e) => setProvider(e.target.value as BrollProvider)} style={field}>
              <option value="higgsfield">Higgsfield (lokal · dine kreditter)</option>
              <option value="fal">fal Seedance (serverside · ingen lokalt oppsett)</option>
            </select>
            {provider === 'fal' && (
              <div style={{ fontSize: 11, color: anchorFrame ? C.inkFaint : '#d9534f', marginTop: 5, lineHeight: 1.4 }}>
                {anchorFrame
                  ? 'Serverside — animerer den fangede produkt-rammen (image-to-video). Ingen lokal CLI eller Higgsfield-kreditter.'
                  : 'fal krever en produkt-ramme — skann siden først (image-to-video).'}
              </div>
            )}
            <div style={label}>Prompt (engelsk)</div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ ...field, resize: 'vertical', lineHeight: 1.4 }} />
            <div style={label}>Voiceover for scenen (valgfritt)</div>
            <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="La stå tom for ren b-roll uten tale" style={field} />
          </>
        ) : (
          <>
            <div style={label}>Presentør-beskrivelse (engelsk)</div>
            <textarea value={presenterDesc} onChange={(e) => setPresenterDesc(e.target.value)} rows={3} style={{ ...field, resize: 'vertical', lineHeight: 1.4 }} />
            <div style={label}>Voiceover (leses opp + leppesynkes)</div>
            <textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={3} placeholder="Det presentøren skal si …" style={{ ...field, resize: 'vertical', lineHeight: 1.4 }} />
            <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 6, lineHeight: 1.4 }}>
              Lager et ansikt (AI-bilde) → voiceover (TTS) → leppesynket talehode (Seedance). Varigheten følger voiceoveren.
            </div>
          </>
        )}

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

        {mode === 'broll' ? (
          <>
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
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 12, lineHeight: 1.45 }}>
            Varigheten settes automatisk fra voiceoveren. Presentør bruker Higgsfield Seedance (dine kreditter).
          </div>
        )}

        {/* Kostnads-vokter + konto-status */}
        <div style={{ marginTop: 16, padding: '11px 13px', borderRadius: 10, background: C.cream, border: `1px solid ${C.line}` }}>
          {mode === 'broll' && provider === 'fal' ? (
            <>
              <div style={{ fontSize: 12.5, color: C.ink }}>
                Estimert kostnad: <strong>~${estimateFalCostUsd(durationSec)}</strong> <span style={{ color: C.inkFaint }}>({resolution === '4k' ? '1080p' : resolution}, {durationSec}s)</span>
              </div>
              <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>fal serverside — belastes via Role Room (FAL_KEY på serveren). Ingen lokal konto.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: C.ink }}>
                Estimert kostnad: <strong>~{estCredits} kreditter</strong> <span style={{ color: C.inkFaint }}>({resolution}, {durationSec}s)</span>
              </div>
              <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
                {accountErr ? `Konto: ${accountErr}` : account ? `Higgsfield: ${account}` : 'Sjekker konto…'}
              </div>
            </>
          )}
        </div>

        {err && <div style={{ marginTop: 12, fontSize: 12, color: '#d9534f', lineHeight: 1.45 }}>{err}</div>}

        {(() => {
          const isPresenter = mode === 'presenter';
          const falBlocked = !isPresenter && provider === 'fal' && !anchorFrame;
          const emptyRequired = isPresenter ? !narration.trim() : !prompt.trim();
          const usesHiggsfield = isPresenter || provider === 'higgsfield';
          const disabled = busy || emptyRequired || falBlocked || (usesHiggsfield && !!accountErr);
          const label = busy ? (busyMsg ?? 'Genererer…') : isPresenter ? 'Generér presentør' : provider === 'fal' ? `Generér (~$${estimateFalCostUsd(durationSec)})` : `Generér (~${estCredits} kr)`;
          return (
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={busy} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${C.lineStrong}`, background: C.panel, color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: busy ? 'default' : 'pointer', fontFamily: C.font }}>
                Avbryt
              </button>
              <button onClick={generate} disabled={disabled} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.accent}`, background: C.accent, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, fontFamily: C.font }}>
                {label}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default BrollComposer;
