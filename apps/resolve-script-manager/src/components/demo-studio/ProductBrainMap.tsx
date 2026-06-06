/**
 * ProductBrainMap — Fase 2 av Product Brain: samme verifiserte tankekart-data
 * rendret som et dra-bart node-kart. Produktet i sentrum, noder rundt gruppert
 * etter type, kanter ut fra sentrum, farget etter verifiseringsstatus.
 * Ren visning av ProductBrain (ingen AI-kall).
 */
import { useEffect, useRef, useState } from 'react';
import {
  BRAIN_KIND_LABELS, VERIFICATION_META,
  type ProductBrain, type BrainNode, type BrainNodeKind, type VerificationStatus,
} from './demoStudioModel';

const C = {
  panel: '#ffffff', cream: '#faf7f2', line: '#ece7df', lineStrong: '#ddd6cc',
  ink: '#1d1b19', inkSoft: '#6b6358', inkFaint: '#9a9186', accent: '#ef8a5d', dark: '#3a2f2a',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

const W = 760, H = 440, CX = W / 2, CY = H / 2;

interface Placed { id: string; node: BrainNode | null; x: number; y: number }

/** Deterministisk radial layout: sentrum = produkt, noder klynget pr. type. */
function layout(brain: ProductBrain): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = { __product: { x: CX, y: CY } };
  // Sorter etter type så samme-type-noder havner ved siden av hverandre.
  const order = Object.keys(BRAIN_KIND_LABELS) as BrainNodeKind[];
  const sorted = [...brain.nodes].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const T = Math.max(1, sorted.length);
  sorted.forEach((_, i) => {
    const angle = (i / T) * Math.PI * 2 - Math.PI / 2;
    const ring = 150 + (i % 3) * 52;
    pos[`n${i}`] = { x: CX + Math.cos(angle) * ring * 1.18, y: CY + Math.sin(angle) * ring * 0.78 };
  });
  return pos;
}

export function ProductBrainMap({ brain }: { brain: ProductBrain }) {
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(() => layout(brain));
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setPos(layout(brain)); }, [brain]);

  const order = Object.keys(BRAIN_KIND_LABELS) as BrainNodeKind[];
  const sorted = [...brain.nodes].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const placed: Placed[] = [
    { id: '__product', node: null, x: pos.__product?.x ?? CX, y: pos.__product?.y ?? CY },
    ...sorted.map((node, i) => ({ id: `n${i}`, node, x: pos[`n${i}`]?.x ?? CX, y: pos[`n${i}`]?.y ?? CY })),
  ];

  const onDown = (id: string, e: React.PointerEvent) => {
    const p = pos[id]; if (!p) return;
    const r = wrap.current?.getBoundingClientRect();
    const ox = r ? e.clientX - r.left : e.clientX;
    const oy = r ? e.clientY - r.top : e.clientY;
    drag.current = { id, dx: ox - p.x, dy: oy - p.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const r = wrap.current?.getBoundingClientRect();
    const x = (r ? e.clientX - r.left : e.clientX) - drag.current.dx;
    const y = (r ? e.clientY - r.top : e.clientY) - drag.current.dy;
    setPos((cur) => ({ ...cur, [drag.current!.id]: { x, y } }));
  };
  const onUp = () => { drag.current = null; };

  const color = (s: VerificationStatus) => VERIFICATION_META[s].color;

  return (
    <div>
      <div ref={wrap} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ position: 'relative', width: '100%', maxWidth: W, height: H, overflow: 'hidden', border: `1px solid ${C.line}`, borderRadius: 12, background: `radial-gradient(${C.cream} 1px, transparent 1px) 0 0 / 22px 22px, ${C.panel}`, touchAction: 'none', userSelect: 'none' }}>
        {/* Kanter fra produkt til hver node */}
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {placed.filter((p) => p.node).map((p) => (
            <line key={`e-${p.id}`} x1={pos.__product?.x ?? CX} y1={pos.__product?.y ?? CY} x2={p.x} y2={p.y}
              stroke={color(p.node!.status)} strokeOpacity={0.35} strokeWidth={1.5} />
          ))}
        </svg>
        {/* Noder */}
        {placed.map((p) => {
          if (!p.node) {
            return (
              <div key={p.id} onPointerDown={(e) => onDown(p.id, e)}
                style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', cursor: 'grab', background: C.dark, color: '#fff', borderRadius: 12, padding: '10px 14px', maxWidth: 200, fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 18px rgba(0,0,0,.18)', textAlign: 'center' }}>
                {brain.summary ? brain.summary.slice(0, 60) : 'Produkt'}
              </div>
            );
          }
          const m = VERIFICATION_META[p.node.status];
          return (
            <div key={p.id} onPointerDown={(e) => onDown(p.id, e)}
              title={`${BRAIN_KIND_LABELS[p.node.kind]} · ${m.label}${p.node.matchedOn ? ` · ${p.node.matchedOn}` : ''}`}
              style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', cursor: 'grab', background: '#fff', border: `1.5px solid ${m.color}`, borderLeft: `4px solid ${m.color}`, borderRadius: 9, padding: '6px 9px', maxWidth: 158, fontSize: 11, color: C.ink, boxShadow: '0 3px 10px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: m.color, fontWeight: 700, flexShrink: 0 }}>{m.icon}</span>
                <span style={{ fontSize: 9, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.3 }}>{BRAIN_KIND_LABELS[p.node.kind].slice(0, 8)}</span>
              </div>
              <div style={{ marginTop: 2, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.node.text}</div>
            </div>
          );
        })}
      </div>
      {/* Tegnforklaring */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: C.inkSoft, flexWrap: 'wrap' }}>
        {(['verified', 'unverified', 'extra'] as VerificationStatus[]).map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: VERIFICATION_META[s].color, display: 'inline-block' }} />
            {VERIFICATION_META[s].label}
          </span>
        ))}
        <span style={{ color: C.inkFaint }}>· dra nodene for å organisere</span>
      </div>
    </div>
  );
}
