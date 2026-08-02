/**
 * SimulatorStage — LIVE-flate for iOS-simulatoren i Guided Recorder.
 *
 * Erstatter «forhåndsvisning ikke tilgjengelig»-plassholderen for
 * captureKind === 'ios_simulator' med fire samarbeids-funksjoner:
 *   1. Live preview   — poller simctl-skjermbilder inn i en enhetsramme.
 *   2. Start app      — boot + launch valgt app (simctl, ingen ekstra avhengighet).
 *   3. Deep-link      — driv appen til en bestemt skjerm for en scene (simctl openurl).
 *   4. Autonom gjennomgang — Claude ser skjermen + accessibility-treet og driver
 *      appen selv → bygger et storyboard (replaceScenes).
 */
import { useEffect, useRef, useState } from 'react';
import {
  iosSimBoot, iosSimLaunch, iosSimOpenUrl, iosSimListApps, iosSimScreenshot,
  type SimApp,
} from '../../api';
import { useDemoStudio } from './demoStudioStore';
import { runIosWalkthrough } from './iosWalkthrough';
import type { DemoDevice } from './demoStudioModel';

interface Palette {
  panel: string; cream: string; line: string; lineStrong: string;
  ink: string; inkSoft: string; inkFaint: string; accent: string;
  green: string; red: string; deviceFrame: string; font: string;
}

export function SimulatorStage({ udid, device, C }: { udid: string; device: DemoDevice; C: Palette }) {
  const { project, replaceScenes } = useDemoStudio();
  const [apps, setApps] = useState<SimApp[]>([]);
  const [bundleId, setBundleId] = useState<string>('');
  const [shot, setShot] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState<'launch' | 'link' | 'walk' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState('');
  const [progress, setProgress] = useState<{ text: string; pct: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const pollTimer = useRef<number | null>(null);
  const landscape = device === 'ipad';

  // Hent app-lista (auto-velg om bare én, ellers prøv å matche demo-navnet).
  useEffect(() => {
    if (!udid) return;
    let alive = true;
    iosSimListApps(udid).then((list) => {
      if (!alive) return;
      setApps(list);
      if (list.length && !bundleId) {
        const guess = list.find((a) => project?.name && a.name.toLowerCase().includes(project.name.toLowerCase().slice(0, 4)))
          ?? list[0];
        setBundleId(guess.bundleId);
      }
    }).catch(() => setApps([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [udid]);

  // Live-preview-polling (stopper under en handling så vi ikke slåss om skjermbilder).
  useEffect(() => {
    if (pollTimer.current) { window.clearInterval(pollTimer.current); pollTimer.current = null; }
    if (!live || !udid || busy === 'walk') return;
    let inflight = false;
    const tick = async () => {
      if (inflight) return;
      inflight = true;
      try { const s = await iosSimScreenshot(udid); setShot(s); }
      catch { /* sim ikke booted ennå — la neste tick prøve */ }
      finally { inflight = false; }
    };
    void tick();
    pollTimer.current = window.setInterval(tick, 1600);
    return () => { if (pollTimer.current) window.clearInterval(pollTimer.current); pollTimer.current = null; };
  }, [live, udid, busy]);

  const startApp = async () => {
    if (!bundleId || busy) return;
    setBusy('launch'); setMsg(null);
    try {
      await iosSimBoot(udid);
      await iosSimLaunch(udid, bundleId);
      setMsg('Appen er startet i simulatoren.');
    } catch (e) {
      setMsg(`Kunne ikke starte appen: ${e instanceof Error ? e.message : e}`);
    } finally { setBusy(null); }
  };

  const openLink = async () => {
    if (!deepLink.trim() || busy) return;
    setBusy('link'); setMsg(null);
    try {
      await iosSimOpenUrl(udid, deepLink.trim());
      setMsg(`Åpnet ${deepLink.trim()}`);
    } catch (e) {
      setMsg(`Deep-link feilet: ${e instanceof Error ? e.message : e}`);
    } finally { setBusy(null); }
  };

  const runWalkthrough = async () => {
    if (!bundleId || busy) return;
    setBusy('walk'); setMsg(null); setWarnings([]); setProgress({ text: 'Starter…', pct: 0 });
    try {
      const res = await runIosWalkthrough(udid, bundleId, {
        device,
        goal: project?.goal || '',
        maxSteps: 8,
        onProgress: (text, pct) => setProgress({ text, pct }),
        onFrame: (dataUrl) => setShot(dataUrl),
        onScene: () => {},
      });
      replaceScenes(res.scenes);
      setWarnings(res.warnings);
      setMsg(`Storyboard bygget: ${res.scenes.length} scener fra appens ekte skjermer. Gå til Script Builder for å finpusse manus.`);
    } catch (e) {
      setMsg(`Autonom gjennomgang stoppet: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null); setProgress(null);
    }
  };

  const btn = (primary?: boolean, disabled?: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    border: `1px solid ${primary ? C.accent : C.lineStrong}`, background: primary ? C.accent : C.panel,
    color: primary ? '#fff' : C.ink, opacity: disabled ? 0.5 : 1, fontFamily: C.font, whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', width: '100%', maxWidth: 900, maxHeight: '92%', padding: '0 16px' }}>
      {/* Live enhets-preview */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: landscape ? '0 0 58%' : '0 0 34%', minWidth: 0,
      }}>
        <div style={{
          position: 'relative', background: C.deviceFrame, borderRadius: landscape ? 22 : 30,
          padding: landscape ? 10 : 12, boxShadow: '0 18px 44px rgba(31,27,23,0.22)',
          aspectRatio: landscape ? '1.36 / 1' : '0.735 / 1', width: '100%', maxHeight: '86%',
        }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: landscape ? 14 : 20, overflow: 'hidden', background: '#000' }}>
            {shot ? (
              <img src={shot} alt="Simulator" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#7b7b85', fontSize: 12.5, textAlign: 'center', padding: 20 }}>
                {live ? 'Venter på simulator… start appen for å se skjermen.' : 'Live-preview er av.'}
              </div>
            )}
            {busy === 'walk' && (
              <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(139,92,246,0.92)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 20, letterSpacing: '.02em' }}>
                AUTONOM · DRIVER APPEN
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kontroller */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'center', padding: '8px 0' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 2 }}>iOS-simulator</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Post Agent kan drive simulatoren direkte — starte appen, hoppe til skjermer og filme.</div>
        </div>

        {/* 1. App + start */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={bundleId} onChange={(e) => setBundleId(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.lineStrong}`, background: C.panel, color: C.ink, fontFamily: C.font, fontSize: 12.5 }}>
            {!apps.length && <option value="">Ingen apper funnet i simulatoren</option>}
            {apps.map((a) => <option key={a.bundleId} value={a.bundleId}>{a.name}</option>)}
          </select>
          <button style={btn(false, busy != null || !bundleId)} disabled={busy != null || !bundleId} onClick={startApp}>
            {busy === 'launch' ? 'Starter…' : 'Start app'}
          </button>
        </div>

        {/* 4. Autonom gjennomgang (hoved-handlingen) */}
        <button style={btn(true, busy != null || !bundleId)} disabled={busy != null || !bundleId} onClick={runWalkthrough}>
          {busy === 'walk' ? 'Utforsker appen…' : 'Kjør autonom gjennomgang → storyboard'}
        </button>
        <div style={{ fontSize: 11, color: C.inkFaint, marginTop: -6, lineHeight: 1.45 }}>
          Claude ser skjermen + les-treet, trykker seg gjennom appens viktigste flater og skriver manus for hver — ett ferdig storyboard.
        </div>

        {progress && (
          <div>
            <div style={{ height: 6, borderRadius: 4, background: C.line, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.pct}%`, background: C.accent, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 5 }}>{progress.text}</div>
          </div>
        )}

        {/* 3. Deep-link + 2. live-toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="Deep-link, f.eks. leadgrid://leads"
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.lineStrong}`, background: C.panel, color: C.ink, fontFamily: C.font, fontSize: 12.5 }} />
          <button style={btn(false, busy != null || !deepLink.trim())} disabled={busy != null || !deepLink.trim()} onClick={openLink}>
            {busy === 'link' ? 'Åpner…' : 'Åpne'}
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.inkSoft, cursor: 'pointer' }}>
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live-preview (poller skjermbilder)
        </label>

        {msg && <div style={{ fontSize: 12, color: msg.startsWith('Kunne') || msg.includes('feilet') || msg.includes('stoppet') ? C.red : C.green, lineHeight: 1.45 }}>{msg}</div>}
        {warnings.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.inkFaint, lineHeight: 1.5 }}>
            {warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SimulatorStage;
