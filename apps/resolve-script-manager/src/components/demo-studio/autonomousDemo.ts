/**
 * runAutonomousDemo — «Generér ferdig demo»: URL/scener → narrert video, ett kjør.
 *
 *   1. TTS per scene (macOS say) → varighet styrer dvel-tiden.
 *   2. Autonomt Playwright-script driver nettleseren gjennom scenene og tar opp
 *      video (.webm), og logger tids-markører (MARK_T0 / MARK i).
 *   3. Mux: hver narration legges på sin markør-offset over videoen → ferdig .mp4.
 *
 * Ingen menneskelig opptak. Krever Playwright satt opp + ffmpeg + macOS `say`.
 */
import { synthesizeTts, ttsFromAudio, runPlaywrightDemo, onScriptEvent, muxDemoVideo, playwrightStatus, setupPlaywright, playwrightCaptureShots, extractFrame, type DemoFinalizeOpts } from '../../api';
import { ttsProxy } from '../../services/claudeProxyService';
import { buildAutonomousScript } from './demoStudioExports';
import { gradeSceneFrame, gradeScriptFramework, type SceneGrade, type ScriptGrade } from './demoStudioAI';
import type { DemoProject } from './demoStudioModel';

export interface AutonomousProgress { (msg: string, pct: number): void }

export async function runAutonomousDemo(
  project: DemoProject,
  opts: {
    voice?: string;
    onProgress?: AutonomousProgress;
    /** Kalt når Playwright begynner å ta opp en ny scene (visuell fremdrift). */
    onScene?: (index: number, total: number) => void;
    /** Kalt med scan-screenshots (miniatyrer) når siden er skannet. */
    onShots?: (shots: Array<{ scrollPct: number; dataUrl: string }>) => void;
    /** Branding: ramme + intro/outro (PNG-er rendret i frontend). */
    finalize?: DemoFinalizeOpts;
    /** ElevenLabs (valgfritt): bedre stemme. Faller tilbake til say uten/ved feil. */
    elevenKey?: string;
    elevenVoiceId?: string;
  } = {},
): Promise<{ path: string; qa: Array<SceneGrade | null>; scriptQa: ScriptGrade | null }> {
  const { voice, onProgress = () => {}, onScene, onShots, finalize, elevenKey, elevenVoiceId } = opts;
  const scenes = project.scenes;
  if (!scenes.length) throw new Error('Ingen scener — generér demoen først.');

  // NARRATIV QA (port 0): følger manuset markedsførings-rammeverket (PAS/AIDA/…)
  // for demo-typen? Kjøres FØR opptak så et svakt manus fanges tidlig.
  onProgress('Sjekker at manuset følger rammeverket…', 3);
  const scriptQa = await gradeScriptFramework({ scenes, demoType: project.demoType, goal: project.goal }).catch(() => null);

  // 0) Sørg for at Playwright-runtime finnes — sett opp automatisk hvis ikke
  //    (engangs; hopper over Chromium-nedlasting hvis system-Chrome finnes).
  onProgress('Sjekker Playwright…', 2);
  const status = await playwrightStatus().catch(() => null);
  if (status && !status.nodeOk) {
    throw new Error('Node.js mangler i PATH. Installer Node (f.eks. via Homebrew: brew install node) og prøv igjen.');
  }
  if (!status || !status.playwrightInstalled) {
    onProgress('Setter opp Playwright (engangs — kan ta et par minutter)…', 3);
    await setupPlaywright();
    const after = await playwrightStatus().catch(() => null);
    if (!after?.playwrightInstalled) {
      throw new Error('Klarte ikke å sette opp Playwright automatisk. Åpne Export → «Sett opp Playwright» og prøv igjen.');
    }
  }

  // 0b) Skann nettsiden FØRST → miniatyrer (visuell kontekst + element-binding).
  if (onShots && !(project.scanShots && project.scanShots.length)) {
    onProgress('Skanner nettsiden…', 4);
    const r = await playwrightCaptureShots(project.url).catch(() => null);
    if (r?.shots?.length) onShots(r.shots);
  }

  // 1) Voiceover per scene
  onProgress('Lager voiceover…', 5);
  const audio: Array<{ path: string; durationSec: number } | null> = [];
  for (let i = 0; i < scenes.length; i++) {
    const text = (scenes[i].narration || '').trim();
    if (!text) { audio.push(null); continue; }
    onProgress(`Voiceover ${i + 1}/${scenes.length}…`, 5 + Math.round((i / scenes.length) * 35));
    // Stemme-prioritet: lokal ElevenLabs-nøkkel → sentral proxy (ElevenLabs på
    // server) → on-device «Nora». Faller alltid trygt nedover ved feil.
    let a: { path: string; durationSec: number } | null = null;
    if (elevenKey) {
      a = await synthesizeTts(project.id, scenes[i].id, text, voice, elevenKey, elevenVoiceId).catch(() => null);
    } else {
      const mp3 = await ttsProxy(text, elevenVoiceId).catch(() => null);
      if (mp3) a = await ttsFromAudio(project.id, scenes[i].id, mp3).catch(() => null);
    }
    if (!a) a = await synthesizeTts(project.id, scenes[i].id, text, voice).catch(() => null);
    audio.push(a);
  }
  // Dvel-tid per scene = narration-lengde (+ litt pust), min 1,5 s
  const dwellsMs = scenes.map((s, i) =>
    Math.max(1500, Math.round((audio[i]?.durationSec ?? Math.max(2, s.duration || 3)) * 1000) + 600));

  // 2)+3) Ett opptak: bygg script, kjør Playwright, samle markører + video-sti.
  const recordOnce = async (): Promise<{ videoPath: string; marks: Record<string, number>; t0: number | null }> => {
    const script = buildAutonomousScript(project, dwellsMs);
    const marks: Record<string, number> = {};
    let t0: number | null = null;
    let videoPath: string | null = null;
    const unlisten = await onScriptEvent((ev: { type?: string; message?: string; path?: string; videoPath?: string }) => {
      if (ev?.type === 'log' && typeof ev.message === 'string') {
        const m = ev.message.trim();
        if (m.startsWith('MARK_T0 ')) t0 = Number(m.slice(8));
        else if (m.startsWith('MARK ')) { const parts = m.split(/\s+/); const idx = Number(parts[1]); marks[parts[1]] = Number(parts[2]); onScene?.(idx, scenes.length); }
      }
      if (ev?.type === 'video' && ev.path) videoPath = ev.path;
      if (ev?.type === 'finished' && ev.videoPath) videoPath = ev.videoPath;
    });
    try { await runPlaywrightDemo(script); } finally { unlisten(); }
    if (!videoPath) throw new Error('Fant ikke opptaks-video. Er Playwright satt opp? (Export → Sett opp Playwright)');
    return { videoPath, marks, t0 };
  };

  // 3b) SELV-VERIFISERENDE QA-SLØYFE: ta opp → AI ser hver scene i videoen →
  //     prøv på nytt hvis noe ikke er bra nok. Leverer kun bestått (eller siste
  //     forsøk + rapport over hva som ikke kunne verifiseres).
  const MAX_ATTEMPTS = 2;
  let videoPath = '';
  let marks: Record<string, number> = {};
  let t0: number | null = null;
  let qa: Array<SceneGrade | null> = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress(attempt === 1 ? 'Tar opp demoen i nettleser…' : `Forbedrer svake scener (forsøk ${attempt})…`, 45);
    const rec = await recordOnce();
    videoPath = rec.videoPath; marks = rec.marks; t0 = rec.t0;
    onProgress('Kvalitetssjekker videoen…', 70);
    qa = [];
    for (let i = 0; i < scenes.length; i++) {
      const mk = marks[String(i)];
      if (t0 == null || mk == null || !scenes[i].narration?.trim()) { qa.push(null); continue; }
      const off = Math.max(0, (mk - t0) / 1000 + 1.6); // litt inne i scenen (etter handling)
      const frame = await extractFrame(videoPath, off).catch(() => null);
      if (!frame) { qa.push(null); continue; }
      qa.push(await gradeSceneFrame({ screenshot: frame, narration: scenes[i].narration, action: scenes[i].requiredAction, title: scenes[i].title }).catch(() => null));
    }
    const failed = qa.filter((g) => g && !g.ok).length;
    if (failed === 0) break;
    if (attempt < MAX_ATTEMPTS) onProgress(`${failed} scene(r) ikke bra nok — tar opp på nytt…`, 72);
  }

  // 4) Synk voiceover til videoen + mux
  onProgress('Setter sammen video + voiceover…', 88);
  const segments: Array<{ audioPath: string; offsetMs: number }> = [];
  if (t0 != null) {
    scenes.forEach((_s, i) => {
      const a = audio[i];
      const mk = marks[String(i)];
      if (a && mk != null) segments.push({ audioPath: a.path, offsetMs: Math.max(0, mk - (t0 as number)) });
    });
  }
  const out = await muxDemoVideo(project.id, videoPath, segments, project.name || 'demo', finalize);
  onProgress('Ferdig!', 100);
  return { path: out, qa, scriptQa };
}
