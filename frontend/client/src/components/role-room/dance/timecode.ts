/**
 * Frame-accurate timecode helpers — DanceAnnotate-paritet.
 *
 * `formatTimecode(seconds, fps)` → "HH:MM:SS:FF" (frames last).
 * `parseTimecode("00:01:30:15", fps)` → number of seconds (float).
 */

export const DEFAULT_FPS = 30;

export function formatTimecode(seconds: number, fps: number = DEFAULT_FPS): string {
  const safeSec = Math.max(0, seconds);
  const totalFrames = Math.round(safeSec * fps);
  const ff = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function parseTimecode(value: string, fps: number = DEFAULT_FPS): number | null {
  const m = /^(\d{1,2}):(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ff = m[4] !== undefined ? Number(m[4]) : 0;
  if (mm >= 60 || ss >= 60 || ff >= fps) return null;
  return hh * 3600 + mm * 60 + ss + ff / fps;
}
