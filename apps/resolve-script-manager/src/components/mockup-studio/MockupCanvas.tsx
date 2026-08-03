/**
 * MockupCanvas — live preview av MockupDoc + direktemanipulasjon.
 *
 * Tegner via SAMME rasterisator som eksporten (rasterizeMockup) inn i et
 * <canvas>, så preview er piksel-identisk med PNG-en. Oppå ligger gjennomsiktige
 * klikkflater per enhet/tekst for utvalg + DRA (mus) og TASTATUR (piltaster
 * nudger, Shift = store steg, Delete/Backspace fjerner, Esc avvelger). Preview
 * rasteriseres på lav-oppløsning for fart; eksporten kjører full oppløsning.
 */

import { useEffect, useRef, useState } from 'react';
import { rasterizeMockup, measureTextHeight } from './mockupRaster';
import { deviceHeight, type MockupDoc } from './mockupStudioModel';
import { useMockupStudio, type Selection } from './mockupStudioStore';

/** Preview-oppløsning (bredde i px). Lavere = raskere re-render ved skriving. */
const PREVIEW_W = 1200;
const NUDGE = 6;        // piltast-steg (base-px)
const NUDGE_BIG = 48;   // med Shift

export function MockupCanvas({ safeArea }: { safeArea?: boolean } = {}) {
  const doc = useMockupStudio((s) => s.doc);
  const selection = useMockupStudio((s) => s.selection);
  const select = useMockupStudio((s) => s.select);
  const patchText = useMockupStudio((s) => s.patchText);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ kind: 'device' | 'text'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const scale = PREVIEW_W / doc.canvas.w;
    rasterizeMockup(doc, scale).then((off) => {
      if (!alive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = off.width; cv.height = off.height;
      const ctx = cv.getContext('2d');
      if (ctx) ctx.drawImage(off, 0, 0);
    }).catch(() => { /* behold forrige frame */ });
    return () => { alive = false; };
  }, [doc]);

  const selId = (s: Selection): string | null => (s.kind === 'device' || s.kind === 'text' ? s.id : null);
  const selectedId = selId(selection);
  const W = doc.canvas.w, H = doc.canvas.h;
  const pct = (v: number, base: number) => `${(v / base) * 100}%`;

  // ── Flytt utvalgt element (delt av dra + tastatur) ───────────────────────
  const moveTo = (base: MockupDoc, kind: 'device' | 'text', id: string, nx: number, ny: number): MockupDoc =>
    kind === 'device'
      ? { ...base, devices: base.devices.map((d) => (d.id === id ? { ...d, x: nx, y: ny } : d)) }
      : { ...base, texts: base.texts.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)) };

  // ── Dra (pointer) ────────────────────────────────────────────────────────
  const beginDrag = (kind: 'device' | 'text', id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    select({ kind, id });
    const st = useMockupStudio.getState();
    const el = kind === 'device' ? st.doc.devices.find((d) => d.id === id) : st.doc.texts.find((t) => t.id === id);
    if (!el) return;
    dragRef.current = { kind, id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, moved: false };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd, { once: true });
  };

  const onDragMove = (e: PointerEvent) => {
    const d = dragRef.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.sx) * (W / rect.width);
    const dy = (e.clientY - d.sy) * (H / rect.height);
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return; // liten terskel = klikk, ikke dra
    if (!d.moved) { d.moved = true; setDragging(true); useMockupStudio.getState().pushHistory(); }
    const st = useMockupStudio.getState();
    st.setDocSilent(moveTo(st.doc, d.kind, d.id, Math.round(d.ox + dx), Math.round(d.oy + dy)));
  };

  const onDragEnd = () => {
    window.removeEventListener('pointermove', onDragMove);
    dragRef.current = null;
    setDragging(false);
  };

  // ── Tastatur: nudge / slett / avvelg ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
      const sel = useMockupStudio.getState().selection;
      if (sel.kind !== 'device' && sel.kind !== 'text') return;
      const st = useMockupStudio.getState();

      if (e.key === 'Escape') { select({ kind: 'canvas' }); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (sel.kind === 'device') st.removeDevice(sel.id); else st.removeText(sel.id);
        return;
      }
      const step = e.shiftKey ? NUDGE_BIG : NUDGE;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      const el = sel.kind === 'device' ? st.doc.devices.find((d) => d.id === sel.id) : st.doc.texts.find((t) => t.id === sel.id);
      if (!el) return;
      st.pushHistory();
      st.setDocSilent(moveTo(st.doc, sel.kind, sel.id, el.x + dx, el.y + dy));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const overlayCursor = dragging ? 'grabbing' : 'grab';

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, maxHeight: '100%',
        borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) select({ kind: 'canvas' }); }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />

      {/* Enheter — dra for å flytte */}
      {doc.devices.map((dev) => {
        const h = deviceHeight(dev);
        const active = selectedId === dev.id;
        return (
          <button
            key={dev.id}
            onPointerDown={(e) => beginDrag('device', dev.id, e)}
            title="Dra for å flytte · piltaster nudger · Delete fjerner"
            style={{
              position: 'absolute', left: pct(dev.x, W), top: pct(dev.y, H), width: pct(dev.w, W), height: pct(h, H),
              transform: `rotate(${dev.rotation}deg)`, transformOrigin: 'center',
              background: 'transparent', border: active ? '2px solid #22d3ee' : '2px solid transparent',
              borderRadius: 8, padding: 0, cursor: overlayCursor, outline: 'none', touchAction: 'none',
            }}
          />
        );
      })}

      {/* Tekst — dra for å flytte · dobbeltklikk = rediger inline */}
      {doc.texts.map((t) => {
        const active = selectedId === t.id;
        const th = measureTextHeight(t);
        const box = { position: 'absolute' as const, left: pct(t.x, W), top: pct(t.y, H), width: pct(t.w, W), height: pct(th, H) };
        if (editingId === t.id) {
          return (
            <textarea
              key={t.id} autoFocus value={t.text}
              onChange={(e) => patchText(t.id, { text: e.target.value })}
              onBlur={() => setEditingId(null)}
              onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...box, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '2px solid #22d3ee', borderRadius: 6, padding: 4, font: '600 14px system-ui', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          );
        }
        return (
          <button
            key={t.id}
            onPointerDown={(e) => beginDrag('text', t.id, e)}
            onDoubleClick={(e) => { e.stopPropagation(); select({ kind: 'text', id: t.id }); setEditingId(t.id); }}
            title="Dra for å flytte · dobbeltklikk = rediger · piltaster nudger"
            style={{ ...box, background: active ? 'rgba(34,211,238,0.08)' : 'transparent', border: active ? '2px solid #22d3ee' : '2px dashed transparent', borderRadius: 6, padding: 0, cursor: overlayCursor, outline: 'none', touchAction: 'none' }}
          />
        );
      })}

      {safeArea && (
        <div style={{ position: 'absolute', inset: '3%', border: '1px dashed rgba(255,255,255,0.4)', borderRadius: 8, pointerEvents: 'none' }} />
      )}
    </div>
  );
}

export default MockupCanvas;
