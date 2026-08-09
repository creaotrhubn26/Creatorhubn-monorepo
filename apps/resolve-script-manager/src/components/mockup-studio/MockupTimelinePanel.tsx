/**
 * MockupTimelinePanel — multi-spor animasjons-timeline (NLE-aktig): linjal +
 * spor med klipp-blokker + playhead. Klipp dras for å arrangeres i tid; klikk på
 * linjalen scrubber. Klippene utledes fra dokumentets animerbare elementer
 * (deriveTimeline). Per-klipp-timing inn i render-motoren er neste steg — nå
 * driver playheaden hele anim.t.
 */
import { useRef, useState, type CSSProperties } from 'react';
import { useMockupStudio } from './mockupStudioStore';
import { deriveTimeline, type TimelineClip, type MockupTimeline } from './mockupStudioModel';

const TRACK_H = 32;
const TRACK_LABELS = ['Enheter', 'Skriving', 'Tekst'];
const CLIP_COLORS: Record<TimelineClip['kind'], string> = { type: '#2563eb', reveal: '#7c3aed' };
// Responsiv skalering for NLE-tett timeline (litt tettere enn shell-chromet).
const TL_FS = 'clamp(10px, 0.72vw, 12.5px)';   // labels / klipp / knapper
const TL_FS_SM = 'clamp(8px, 0.58vw, 10px)';   // linjal-ticks
const tlZoomBtn: CSSProperties = { width: 'clamp(15px, 1.2vw, 20px)', height: 'clamp(13px, 1.05vw, 17px)', lineHeight: 1, padding: 0, borderRadius: 3, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', color: '#c7cdd8', cursor: 'pointer', fontSize: TL_FS };
const clipBtn: CSSProperties = { padding: '3px 9px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', color: '#d7dbe4', cursor: 'pointer', fontSize: TL_FS, fontWeight: 600 };

export function MockupTimelinePanel({ playT, onScrub, inT, outT, onSetIn, onSetOut }: { playT: number | null; onScrub: (t: number) => void; inT: number; outT: number; onSetIn: (v: number) => void; onSetOut: (v: number) => void }) {
  const doc = useMockupStudio((s) => s.doc);
  const setDocSilent = useMockupStudio((s) => s.setDocSilent);
  const pushHistory = useMockupStudio((s) => s.pushHistory);
  const tl: MockupTimeline = deriveTimeline(doc);
  const railRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);           // horisontal timeline-zoom (1×–8×)
  const [selClip, setSelClip] = useState<string | null>(null); // valgt klipp (for slett/ripple)
  const nTracks = Math.max(3, ...tl.clips.map((c) => c.track + 1));
  const sel = tl.clips.find((c) => c.id === selClip) ?? null;

  // Cmd/Ctrl + hjul over timelinen → zoom mot cursor (holder punktet under cursor fast).
  const onRailWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const sc = scrollRef.current; if (!sc) return;
    const rect = sc.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const frac = (sc.scrollLeft + cursorX) / (rect.width * zoom); // innholds-fraksjon under cursor
    const nz = Math.max(1, Math.min(8, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    setZoom(nz);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollLeft = frac * rect.width * nz - cursorX; });
  };

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

  // Dra inn/ut-merke.
  const beginMark = (which: 'in' | 'out', e: React.PointerEvent) => {
    e.stopPropagation();
    const r = railRef.current?.getBoundingClientRect();
    if (!r) return;
    const ac = new AbortController();
    const move = (ev: PointerEvent) => {
      const v = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      if (which === 'in') onSetIn(Math.min(v, outT - 0.02));
      else onSetOut(Math.max(v, inT + 0.02));
    };
    window.addEventListener('pointermove', move, { signal: ac.signal });
    window.addEventListener('pointerup', () => ac.abort(), { once: true });
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

  // Resize venstre kant → flytt start, hold slutt fast (trim inn).
  const beginClipTrimLeft = (clip: TimelineClip, e: React.PointerEvent) => {
    e.stopPropagation();
    const r = railRef.current?.getBoundingClientRect();
    if (!r) return;
    pushHistory();
    const sx = e.clientX, end = clip.start + clip.len, startSt = clip.start;
    const ac = new AbortController();
    const move = (ev: PointerEvent) => {
      const dSec = ((ev.clientX - sx) / r.width) * dur;
      const rawStart = Math.max(0, Math.min(end - 0.3, startSt + dSec));
      const st = Math.min(end - 0.3, snap(rawStart, clip.id));
      const start = Math.round(Math.max(0, st) * 100) / 100;
      writeClips(tl.clips.map((c) => (c.id === clip.id ? { ...c, start, len: Math.round((end - start) * 100) / 100 } : c)));
    };
    window.addEventListener('pointermove', move, { signal: ac.signal });
    window.addEventListener('pointerup', () => ac.abort(), { once: true });
  };

  // Slett valgt klipp (element animerer ikke lenger); ripple = skyv senere klipp på samme spor venstre.
  const deleteClip = (ripple: boolean) => {
    if (!sel) return;
    pushHistory();
    let clips = tl.clips.filter((c) => c.id !== sel.id);
    if (ripple) clips = clips.map((c) => (c.track === sel.track && c.start > sel.start ? { ...c, start: Math.round(Math.max(0, c.start - sel.len) * 100) / 100 } : c));
    writeClips(clips);
    setSelClip(null);
  };

  // Tid-ticks (hvert 0.5s).
  const ticks: number[] = [];
  for (let s = 0; s <= dur; s += 0.5) ticks.push(s);

  return (
    <div style={{ background: 'rgba(12,15,22,0.92)', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#c7cdd8', fontWeight: 600, fontSize: TL_FS, fontFamily: 'system-ui, sans-serif', userSelect: 'none' }}>
      {/* Klipp-handlinger (vises når et klipp er valgt) */}
      <div style={{ minHeight: 22, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: TL_FS, flexWrap: 'wrap', paddingTop: 2, paddingBottom: 2 }}>
        {sel ? (
          <>
            <span style={{ opacity: 0.75, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.label} · {sel.start.toFixed(1)}–{(sel.start + sel.len).toFixed(1)}s</span>
            <button onClick={() => deleteClip(false)} title="Fjern klippet (elementet animerer ikke lenger)" style={clipBtn}>Slett</button>
            <button onClick={() => deleteClip(true)} title="Fjern og skyv senere klipp på sporet til venstre" style={clipBtn}>Ripple-slett</button>
            <button onClick={() => setSelClip(null)} style={clipBtn}>Fjern valg</button>
          </>
        ) : (
          <span style={{ opacity: 0.4 }}>Velg et klipp for å trimme/slette · dra kant = trim · , / . = frame-steg</span>
        )}
      </div>
      <div style={{ display: 'flex' }}>
        {/* Spor-etiketter */}
        <div style={{ width: 66, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ height: 16, display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 4 }}>
            <button onClick={() => setZoom((z) => Math.max(1, z / 1.4))} title="Zoom ut (timeline)" style={tlZoomBtn}>−</button>
            <button onClick={() => setZoom((z) => Math.min(8, z * 1.4))} title="Zoom inn (timeline) · Cmd/Ctrl+hjul" style={tlZoomBtn}>+</button>
          </div>
          {Array.from({ length: nTracks }, (_, i) => (
            <div key={i} style={{ height: TRACK_H, display: 'flex', alignItems: 'center', paddingLeft: 8, color: '#c7cdd8', fontSize: TL_FS }}>{TRACK_LABELS[i] ?? `Spor ${i + 1}`}</div>
          ))}
        </div>
        {/* Rail: linjal + spor + klipp + playhead (zoombar + scrollbar horisontalt) */}
        <div ref={scrollRef} onWheel={onRailWheel} style={{ flex: 1, overflowX: zoom > 1.001 ? 'auto' : 'hidden', overflowY: 'hidden' }}>
        <div ref={railRef} style={{ position: 'relative', width: `${zoom * 100}%`, minWidth: '100%', cursor: 'text' }} onPointerDown={(e) => { e.stopPropagation(); scrubFromEvent(e.clientX); }}>
          {/* Linjal */}
          <div style={{ position: 'relative', height: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {ticks.map((s) => (
              <div key={s} style={{ position: 'absolute', left: `${(s / dur) * 100}%`, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 3, fontSize: TL_FS_SM, opacity: 0.6 }}>{s % 1 === 0 ? `${s}s` : ''}</div>
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
              onPointerDown={(e) => { setSelClip(c.id); beginClipDrag(c, e); }}
              title={`${c.label} · ${c.start.toFixed(1)}s–${(c.start + c.len).toFixed(1)}s`}
              style={{
                position: 'absolute', left: `${(c.start / dur) * 100}%`, width: `${(c.len / dur) * 100}%`,
                top: 16 + c.track * TRACK_H + 3, height: TRACK_H - 6,
                background: CLIP_COLORS[c.kind], borderRadius: 4,
                border: c.id === selClip ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden', whiteSpace: 'nowrap',
                color: '#fff', fontSize: TL_FS, cursor: 'grab', boxShadow: c.id === selClip ? '0 0 0 1px #2563eb, 0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.4)',
              }}
            >
              {c.label}
              <div
                onPointerDown={(e) => { setSelClip(c.id); beginClipTrimLeft(c, e); }}
                title="Dra for å trimme start"
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,0.25)' }}
              />
              <div
                onPointerDown={(e) => { setSelClip(c.id); beginClipResize(c, e); }}
                title="Dra for å endre varighet"
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,0.25)' }}
              />
            </div>
          ))}
          {/* Inn/ut-region: mørkne utenfor [inT, outT] */}
          {inT > 0 && <div style={{ position: 'absolute', left: 0, width: `${inT * 100}%`, top: 16, bottom: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />}
          {outT < 1 && <div style={{ position: 'absolute', left: `${outT * 100}%`, right: 0, top: 16, bottom: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />}
          {/* Inn/ut-merker (dra) */}
          <div onPointerDown={(e) => beginMark('in', e)} title="Inn-merke" style={{ position: 'absolute', left: `calc(${inT * 100}% - 4px)`, top: 0, width: 8, height: 16, background: '#22c55e', cursor: 'ew-resize', borderRadius: 2, zIndex: 3 }} />
          <div onPointerDown={(e) => beginMark('out', e)} title="Ut-merke" style={{ position: 'absolute', left: `calc(${outT * 100}% - 4px)`, top: 0, width: 8, height: 16, background: '#22c55e', cursor: 'ew-resize', borderRadius: 2, zIndex: 3 }} />
          {/* Playhead */}
          <div style={{ position: 'absolute', left: `${(playT ?? 0) * 100}%`, top: 0, bottom: 0, width: 1.5, background: '#f43f5e', pointerEvents: 'none', boxShadow: '0 0 6px rgba(244,63,94,0.8)' }}>
            <div style={{ position: 'absolute', top: -1, left: -4, width: 9, height: 7, background: '#f43f5e', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
