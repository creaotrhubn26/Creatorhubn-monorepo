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
import { synthesizeTts, runPlaywrightDemo, onScriptEvent, muxDemoVideo } from '../../api';
import { buildAutonomousScript } from './demoStudioExports';
import type { DemoProject } from './demoStudioModel';

export interface AutonomousProgress { (msg: string, pct: number): void }

export async function runAutonomousDemo(
  project: DemoProject,
  opts: { voice?: string; onProgress?: AutonomousProgress } = {},
): Promise<string> {
  const { voice, onProgress = () => {} } = opts;
  const scenes = project.scenes;
  if (!scenes.length) throw new Error('Ingen scener — generér demoen først.');

  // 1) Voiceover per scene
  onProgress('Lager voiceover…', 5);
  const audio: Array<{ path: string; durationSec: number } | null> = [];
  for (let i = 0; i < scenes.length; i++) {
    const text = (scenes[i].narration || '').trim();
    if (!text) { audio.push(null); continue; }
    onProgress(`Voiceover ${i + 1}/${scenes.length}…`, 5 + Math.round((i / scenes.length) * 35));
    audio.push(await synthesizeTts(project.id, scenes[i].id, text, voice).catch(() => null));
  }
  // Dvel-tid per scene = narration-lengde (+ litt pust), min 1,5 s
  const dwellsMs = scenes.map((s, i) =>
    Math.max(1500, Math.round((audio[i]?.durationSec ?? Math.max(2, s.duration || 3)) * 1000) + 600));

  // 2)+3) Bygg script og kjør Playwright — samle markører + video-sti fra event-strømmen
  onProgress('Tar opp demoen i nettleser…', 45);
  const script = buildAutonomousScript(project, dwellsMs);
  const marks: Record<string, number> = {};
  let t0: number | null = null;
  let videoPath: string | null = null;
  const unlisten = await onScriptEvent((ev: { type?: string; message?: string; path?: string; videoPath?: string }) => {
    if (ev?.type === 'log' && typeof ev.message === 'string') {
      const m = ev.message.trim();
      if (m.startsWith('MARK_T0 ')) t0 = Number(m.slice(8));
      else if (m.startsWith('MARK ')) { const parts = m.split(/\s+/); marks[parts[1]] = Number(parts[2]); }
    }
    if (ev?.type === 'video' && ev.path) videoPath = ev.path;
    if (ev?.type === 'finished' && ev.videoPath) videoPath = ev.videoPath;
  });
  try {
    await runPlaywrightDemo(script);
  } finally {
    unlisten();
  }
  if (!videoPath) throw new Error('Fant ikke opptaks-video. Er Playwright satt opp? (Export → Sett opp Playwright)');

  // 4) Synk voiceover til videoen + mux
  onProgress('Setter sammen video + voiceover…', 85);
  const segments: Array<{ audioPath: string; offsetMs: number }> = [];
  if (t0 != null) {
    scenes.forEach((_s, i) => {
      const a = audio[i];
      const mk = marks[String(i)];
      if (a && mk != null) segments.push({ audioPath: a.path, offsetMs: Math.max(0, mk - (t0 as number)) });
    });
  }
  const out = await muxDemoVideo(project.id, videoPath, segments);
  onProgress('Ferdig!', 100);
  return out;
}
