/**
 * MockupTimelinePanel — multi-spor animasjons-timeline (NLE-aktig): linjal +
 * spor med klipp-blokker + playhead. Klipp dras for å arrangeres i tid; klikk på
 * linjalen scrubber. Klippene utledes fra dokumentets animerbare elementer
 * (deriveTimeline). Per-klipp-timing inn i render-motoren er neste steg — nå
 * driver playheaden hele anim.t.
 */
import { useRef } from 'react';
import { useMockupStudio } from './mockupStudioStore';
import { deriveTimeline, type TimelineClip, type MockupTimeline } from './mockupStudioModel';

const TRACK_H = 26;
const TRACK_LABELS = ['Enheter', 'Skriving', 'Tekst'];
const CLIP_COLORS: Record<TimelineClip['kind'], string> = { type: '#2563eb', reveal: '#7c3aed' };

export function MockupTimelinePanel({ playT, onScrub }: { playT: number | null; onScrub: (t: number) => void }) {
  const doc = useMockupStudio((s) => s.doc);
  const setDocSilent = useMockupStudio((s) => s.setDocSilent);
  const pushHistory = useMockupStudio((s) => s.pushHistory);
  const tl: MockupTimeline = deriveTimeline(doc);
  const railRef = useRef<HTMLDivElement>(null);
  const nTracks = Math.max(3, ...tl.clips.map((c) => c.track + 1));

  const dur = tl.duration;

  // Persister timeline-endring (dra klipp).
  const writeClips = (clips: TimelineClip[]) => setDocSilent({ ...doc, timeline: { duration: dur, clips } });

  // Snapping: klipp-kanter fester til andre klipp-kanter, playhead og heltalls-sek.
  const snap = (sec: number, selfId: string): number => {
    const targets = [0, dur, (playT ?? 0) * dur];
    for (let s = 0; s <= dur; s++) targets.push(s);
    tl.clips.forEach((c) => { if (c.id !== selfId) { targets.push(c.start); targets.push(c.start + c.len); } });
    const thr = dur * 0.012; // snap-terskel
    let best = sec, bd = thr;
    for (const tg of targets) { const d = Math.abs(sec - tg); if (d < bd) { bd = d; best = tg; } }
    return best;
  };

  const scrubFromEvent = (clientX: number) => {
    const r = railRef.current?.getBoundingClientRect();
    if (!r) return;
    onScrub(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };

  const beginClipDrag = (clip: TimelineClip, e: React.PointerEvent) => {
    e.stopPropagation();
    const r = railRef.current?.getBoundingClientRect();
    if (!r) return;
    pushHistory();
    const sx = e.clientX, startSec = clip.start;
    const ac = new AbortController();
    const move = (ev: PointerEvent) => {
      const dSec = ((ev.clientX - sx) / r.width) * dur;
      const raw = Math.max(0, Math.min(dur - clip.len, startSec + dSec));
      const snapStart = snap(raw, clip.id);                    // venstre kant
      const snapEnd = snap(raw + clip.len, clip.id) - clip.len; // høyre kant
      const ns = Math.abs(snapEnd - raw) < Math.abs(snapStart - raw) ? snapEnd : snapStart;
      const clamped = Math.max(0, Math.min(dur - clip.len, ns));
      writeClips(tl.clips.map((c) => (c.id === clip.id ? { ...c, start: Math.round(clamped * 100) / 100 } : c)));
    };
    window.addEventListener('pointermove', move, { signal: ac.signal });
    window.addEventListener('pointerup', () => ac.abort(), { once: true });
  };

  // Resize høyre kant → endre varighet (med snapping).
  const beginClipResize = (clip: TimelineClip, e: React.PointerEvent) => {
    e.stopPropagation();
    const r = railRef.current?.getBoundingClientRect();
    if (!r) return;
    pushHistory();
    const sx = e.clientX, startLen = clip.len;
    const ac = new AbortController();
    const move = (ev: PointerEvent) => {
      const dSec = ((ev.clientX - sx) / r.width) * dur;
      const rawEnd = clip.start + Math.max(0.3, startLen + dSec);
      const end = Math.min(dur, snap(rawEnd, clip.id));
      const len = Math.round(Math.max(0.3, end - clip.start) * 100) / 100;
      writeClips(tl.clips.map((c) => (c.id === clip.id ? { ...c, len } : c)));
    };
    window.addEventListener('pointermove', move, { signal: ac.signal });
    window.addEventListener('pointerup', () => ac.abort(), { once: true });
  };

  // Tid-ticks (hvert 0.5s).
  const ticks: number[] = [];
  for (let s = 0; s <= dur; s += 0.5) ticks.push(s);

  return (
    <div style={{ background: 'rgba(12,15,22,0.92)', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#c7cdd8', font: '600 10px system-ui, sans-serif', userSelect: 'none' }}>
      <div style={{ display: 'flex' }}>
        {/* Spor-etiketter */}
        <div style={{ width: 66, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ height: 16 }} />
          {Array.from({ length: nTracks }, (_, i) => (
            <div key={i} style={{ height: TRACK_H, display: 'flex', alignItems: 'center', paddingLeft: 8, opacity: 0.7, fontSize: 10 }}>{TRACK_LABELS[i] ?? `Spor ${i + 1}`}</div>
          ))}
        </div>
        {/* Rail: linjal + spor + klipp + playhead */}
        <div ref={railRef} style={{ position: 'relative', flex: 1, cursor: 'text' }} onPointerDown={(e) => { e.stopPropagation(); scrubFromEvent(e.clientX); }}>
          {/* Linjal */}
          <div style={{ position: 'relative', height: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {ticks.map((s) => (
              <div key={s} style={{ position: 'absolute', left: `${(s / dur) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 3, fontSize: 8, opacity: 0.6 }}>{s % 1 === 0 ? `${s}s` : ''}</div>
            ))}
          </div>
          {/* Spor-rader */}
          {Array.from({ length: nTracks }, (_, i) => (
            <div key={i} style={{ position: 'relative', height: TRACK_H, borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }} />
          ))}
          {/* Klipp */}
          {tl.clips.map((c) => (
            <div
              key={c.id}
              onPointerDown={(e) => beginClipDrag(c, e)}
              title={`${c.label} · ${c.start.toFixed(1)}s–${(c.start + c.len).toFixed(1)}s`}
              style={{
                position: 'absolute', left: `${(c.start / dur) * 100}%`, width: `${(c.len / dur) * 100}%`,
                top: 16 + c.track * TRACK_H + 3, height: TRACK_H - 6,
                background: CLIP_COLORS[c.kind], borderRadius: 4, border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', paddingLeft: 5, overflow: 'hidden', whiteSpace: 'nowrap',
                color: '#fff', fontSize: 9, cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            >
              {c.label}
              <div
                onPointerDown={(e) => beginClipResize(c, e)}
                title="Dra for å endre varighet"
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,0.25)' }}
              />
            </div>
          ))}
          {/* Playhead */}
          <div style={{ position: 'absolute', left: `${(playT ?? 0) * 100}%`, top: 0, bottom: 0, width: 1.5, background: '#f43f5e', pointerEvents: 'none', boxShadow: '0 0 6px rgba(244,63,94,0.8)' }}>
            <div style={{ position: 'absolute', top: -1, left: -4, width: 9, height: 7, background: '#f43f5e', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
