/**
 * MockupKeyframeGraph — keyframe-kurve-editor (Resolve-aktig) for device-properties
 * (rotY/rotX/rotZ/zoom) over timelinen. x = tid (0..1), y = verdi. Smoothstep-kurve
 * gjennom keyframes; dra punkter, klikk tomt for å legge til, dobbeltklikk for å
 * fjerne. Verdiene sampler render-motoren ved playhead (sampleKf) → enheten
 * animerer (roterer/zoomer) over tid.
 */
import { useRef, useState, type CSSProperties } from 'react';
import { sampleKf } from './mockupStudioModel';

type KfMap = Record<string, { t: number; v: number }[]>;
const PROPS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'rotY', label: 'Snu (rotY)', min: -60, max: 60 },
  { id: 'rotX', label: 'Vipp (rotX)', min: -55, max: 55 },
  { id: 'rotZ', label: 'Rull (rotZ)', min: -45, max: 45 },
  { id: 'zoom', label: '3D-størrelse', min: 0.6, max: 1.8 },
];
const W = 260, H = 120, PAD = 8;

export function MockupKeyframeGraph({ value, playT, onChange }: { value: KfMap | undefined; playT: number | null; onChange: (kf: KfMap | undefined) => void }) {
  const [prop, setProp] = useState('rotY');
  const svgRef = useRef<SVGSVGElement>(null);
  const spec = PROPS.find((p) => p.id === prop)!;
  const kfs = (value?.[prop] ?? []).slice().sort((a, b) => a.t - b.t);

  const gx = (t: number) => PAD + t * (W - PAD * 2);
  const gy = (v: number) => H - PAD - ((v - spec.min) / (spec.max - spec.min)) * (H - PAD * 2);
  const fromXY = (px: number, py: number) => ({
    t: Math.max(0, Math.min(1, (px - PAD) / (W - PAD * 2))),
    v: Math.max(spec.min, Math.min(spec.max, spec.min + (1 - (py - PAD) / (H - PAD * 2)) * (spec.max - spec.min))),
  });

  const write = (list: { t: number; v: number }[]) => {
    const next: KfMap = { ...(value ?? {}) };
    if (list.length) next[prop] = list; else delete next[prop];
    onChange(Object.keys(next).length ? next : undefined);
  };

  const evtXY = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { px: ((e.clientX - r.left) / r.width) * W, py: ((e.clientY - r.top) / r.height) * H };
  };

  const dragKf = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    const ac = new AbortController();
    const move = (ev: PointerEvent) => {
      const { px, py } = evtXY(ev);
      const { t, v } = fromXY(px, py);
      write(kfs.map((k, i) => (i === idx ? { t, v } : k)));
    };
    window.addEventListener('pointermove', move, { signal: ac.signal });
    window.addEventListener('pointerup', () => ac.abort(), { once: true });
  };

  const addKf = (e: React.PointerEvent) => {
    const { px, py } = evtXY(e);
    const { t, v } = fromXY(px, py);
    write([...kfs, { t, v }].sort((a, b) => a.t - b.t));
  };

  // Kurve-punkter (samplet smoothstep).
  const curve = kfs.length >= 2
    ? Array.from({ length: 40 }, (_, i) => { const t = i / 39; return `${gx(t)},${gy(sampleKf(kfs, t) ?? spec.min)}`; }).join(' ')
    : '';

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <select value={prop} onChange={(e) => setProp(e.target.value)} style={selStyle}>
          {PROPS.map((p) => <option key={p.id} value={p.id}>{p.label}{value?.[p.id]?.length ? ' •' : ''}</option>)}
        </select>
        {kfs.length > 0 && <button onClick={() => write([])} style={clrStyle} title="Fjern keyframes for denne">Nullstill</button>}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerDown={addKf}
        style={{ width: '100%', height: 120, background: 'rgba(10,13,20,0.9)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', cursor: 'crosshair', touchAction: 'none' }}>
        {/* rutenett */}
        {[0, 0.5, 1].map((v) => <line key={`h${v}`} x1={PAD} x2={W - PAD} y1={gy(spec.min + v * (spec.max - spec.min))} y2={gy(spec.min + v * (spec.max - spec.min))} stroke="rgba(255,255,255,0.08)" />)}
        {/* midt-verdi-referanse */}
        <line x1={PAD} x2={W - PAD} y1={gy((spec.min + spec.max) / 2)} y2={gy((spec.min + spec.max) / 2)} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
        {/* kurve */}
        {curve && <polyline points={curve} fill="none" stroke="#2563eb" strokeWidth="2" />}
        {kfs.length === 1 && <line x1={PAD} x2={W - PAD} y1={gy(kfs[0].v)} y2={gy(kfs[0].v)} stroke="#2563eb" strokeWidth="2" />}
        {/* playhead */}
        {playT != null && <line x1={gx(playT)} x2={gx(playT)} y1={0} y2={H} stroke="#f43f5e" strokeWidth="1.2" />}
        {/* keyframe-punkter */}
        {kfs.map((k, i) => (
          <circle key={i} cx={gx(k.t)} cy={gy(k.v)} r="5" fill="#eef1f6" stroke="#2563eb" strokeWidth="2"
            style={{ cursor: 'grab' }} onPointerDown={(e) => dragKf(i, e)} onDoubleClick={(e) => { e.stopPropagation(); write(kfs.filter((_, j) => j !== i)); }} />
        ))}
      </svg>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Klikk = legg til keyframe · dra = flytt · dobbeltklikk = fjern</div>
    </div>
  );
}

const selStyle: CSSProperties = { flex: 1, background: 'rgba(255,255,255,0.06)', color: '#e6e9ef', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: '4px 6px', fontSize: 12 };
const clrStyle: CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#c7cdd8', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' };
