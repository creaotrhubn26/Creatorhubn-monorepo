/**
 * MockupCanvas — live preview av MockupDoc + direktemanipulasjon.
 *
 * Tegner via SAMME rasterisator som eksporten (rasterizeMockup) inn i et
 * <canvas>, så preview er piksel-identisk med PNG-en. Oppå ligger gjennomsiktige
 * klikkflater per enhet/tekst for utvalg + DRA (mus) og TASTATUR (piltaster
 * nudger, Shift = store steg, Delete/Backspace fjerner, Cmd/Ctrl+D dupliserer,
 * Esc avvelger). ZOOM (hjul / +/−/0-knapper) + PAN (dra på tomt lerret) med
 * justerings-/snap-linjer mens du drar. Preview rasteriseres på lav-oppløsning
 * for fart; eksporten kjører full oppløsning.
 */

import { useEffect, useRef, useState } from 'react';
import { rasterizeMockup, measureTextHeight } from './mockupRaster';
import { parseMermaidMindmap } from './mockupMindmap';
import { deviceHeight, type MockupDoc, type MockupDeviceSlot, type MockupTextSlot } from './mockupStudioModel';
import { useMockupStudio, type Selection } from './mockupStudioStore';
import { snapPosition, type Box } from './mockupArrange';

/** Preview-oppløsning (bredde i px). Lavere = raskere re-render ved skriving. */
const PREVIEW_W = 1200;
const NUDGE = 6;        // piltast-steg (base-px)
const NUDGE_BIG = 48;   // med Shift
const SNAP = 8;         // snap-terskel i base-px
const MIN_ZOOM = 0.25, MAX_ZOOM = 4;

export function MockupCanvas({ safeArea }: { safeArea?: boolean } = {}) {
  const doc = useMockupStudio((s) => s.doc);
  const selection = useMockupStudio((s) => s.selection);
  const select = useMockupStudio((s) => s.select);
  const patchText = useMockupStudio((s) => s.patchText);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);     // stage (transformert)
  const viewportRef = useRef<HTMLDivElement>(null); // ytre klippboks
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ kind: 'device' | 'text'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; rot?: { rx: number; ry: number } } | null>(null);
  const dragAbort = useRef<AbortController | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // ── Visning (zoom/pan) ───────────────────────────────────────────────────
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const panRef = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const panAbort = useRef<AbortController | null>(null);

  // ── Snap-linjer (kun mens man drar) ──────────────────────────────────────
  const [guides, setGuides] = useState<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] });

  useEffect(() => {
    let alive = true;
    const scale = PREVIEW_W / doc.canvas.w;
    // Mind map-modus: valider kilden så en tom/ugyldig Mermaid ikke bare «gjør ingenting».
    if (doc.mindmap != null) {
      const tree = parseMermaidMindmap(doc.mindmap);
      setRenderError(!tree || tree.children.length === 0
        ? 'Mind map-kilden er tom eller ugyldig — sjekk Mermaid-syntaksen (rot-node + innrykkede grener).'
        : null);
    }
    rasterizeMockup(doc, scale).then((off) => {
      if (!alive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = off.width; cv.height = off.height;
      const ctx = cv.getContext('2d');
      if (ctx) ctx.drawImage(off, 0, 0);
      if (doc.mindmap == null) setRenderError(null); // vellykket vanlig render
    }).catch((e) => {
      // IKKE lenger stille: behold forrige frame MEN vis at noe feilet.
      if (!alive) return;
      console.error('[mockup-studio] preview-render', e);
      setRenderError('Kunne ikke tegne forhåndsvisningen — sjekk innholdet/kilden.');
    });
    return () => { alive = false; };
  }, [doc]);

  const selId = (s: Selection): string | null => (s.kind === 'device' || s.kind === 'text' ? s.id : null);
  const selectedId = selId(selection);
  const W = doc.canvas.w, H = doc.canvas.h;
  const pct = (v: number, base: number) => `${(v / base) * 100}%`;

  const boxOf = (kind: 'device' | 'text', el: MockupDeviceSlot | MockupTextSlot): Box =>
    kind === 'device'
      ? { x: el.x, y: el.y, w: (el as MockupDeviceSlot).w, h: deviceHeight(el as MockupDeviceSlot) }
      : { x: el.x, y: el.y, w: (el as MockupTextSlot).w, h: measureTextHeight(el as MockupTextSlot) };

  // ── Flytt utvalgt element (delt av dra + tastatur) ───────────────────────
  const moveTo = (base: MockupDoc, kind: 'device' | 'text', id: string, nx: number, ny: number): MockupDoc =>
    kind === 'device'
      ? { ...base, devices: base.devices.map((d) => (d.id === id ? { ...d, x: nx, y: ny } : d)) }
      : { ...base, texts: base.texts.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)) };

  // 3D-orbit: oppdater device.threeD.rotX/rotY (beholder rotZ/light).
  const rotateTo = (base: MockupDoc, id: string, rotX: number, rotY: number): MockupDoc =>
    ({ ...base, devices: base.devices.map((d) => (d.id === id && d.threeD ? { ...d, threeD: { ...d.threeD, rotX, rotY } } : d)) });

  // Snap `nx,ny` (topp-venstre) til andre elementers kanter/senter + lerret-senter/kanter.
  const applySnap = (id: string, box: Box, nx: number, ny: number) => {
    const st = useMockupStudio.getState().doc;
    const others: Box[] = [
      ...st.devices.filter((d) => d.id !== id).map((d) => boxOf('device', d)),
      ...st.texts.filter((t) => t.id !== id).map((t) => boxOf('text', t)),
    ];
    return snapPosition(box, nx, ny, others, W, H, SNAP);
  };

  // ── Dra (pointer) ────────────────────────────────────────────────────────
  const beginDrag = (kind: 'device' | 'text', id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    select({ kind, id });
    const st = useMockupStudio.getState();
    const el = kind === 'device' ? st.doc.devices.find((d) => d.id === id) : st.doc.texts.find((t) => t.id === id);
    if (!el) return;
    // 3D-enhet: dra = orbit (roter). Flytt via numerisk/piltaster.
    const dev3d = kind === 'device' ? (el as MockupDoc['devices'][number]).threeD : undefined;
    dragRef.current = { kind, id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, moved: false, rot: dev3d ? { rx: dev3d.rotX, ry: dev3d.rotY } : undefined };
    dragAbort.current?.abort();
    const ac = new AbortController();
    dragAbort.current = ac;
    window.addEventListener('pointermove', onDragMove, { signal: ac.signal });
    window.addEventListener('pointerup', onDragEnd, { signal: ac.signal, once: true });
  };

  const onDragMove = (e: PointerEvent) => {
    const d = dragRef.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    // rect er skalert (post-transform), så W/rect.width kompenserer for zoom automatisk.
    const dx = (e.clientX - d.sx) * (W / rect.width);
    const dy = (e.clientY - d.sy) * (H / rect.height);
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return; // liten terskel = klikk, ikke dra
    if (!d.moved) { d.moved = true; setDragging(true); useMockupStudio.getState().pushHistory(); }
    const st = useMockupStudio.getState();
    const el = d.kind === 'device' ? st.doc.devices.find((x) => x.id === d.id) : st.doc.texts.find((x) => x.id === d.id);
    if (!el) return;
    // 3D-orbit: horisontal dra → snu (rotY), vertikal → vipp (rotX).
    if (d.rot) {
      const SENS = 0.18;
      const ry = Math.max(-70, Math.min(70, Math.round(d.rot.ry + dx * SENS)));
      const rx = Math.max(-55, Math.min(55, Math.round(d.rot.rx - dy * SENS)));
      st.setDocSilent(rotateTo(st.doc, d.id, rx, ry));
      return;
    }
    const rawX = Math.round(d.ox + dx), rawY = Math.round(d.oy + dy);
    const snapped = e.altKey ? { x: rawX, y: rawY, vx: [], hy: [] } : applySnap(d.id, boxOf(d.kind, el), rawX, rawY); // Alt = fri (ingen snap)
    setGuides({ vx: snapped.vx, hy: snapped.hy });
    st.setDocSilent(moveTo(st.doc, d.kind, d.id, snapped.x, snapped.y));
  };

  const onDragEnd = () => {
    dragAbort.current?.abort();
    dragAbort.current = null;
    dragRef.current = null;
    setDragging(false);
    setGuides({ vx: [], hy: [] });
  };

  // Unmount midt i dra/pan: fjern window-listeners (self-healer ellers på neste pointerup)
  useEffect(() => () => { dragAbort.current?.abort(); panAbort.current?.abort(); }, []);

  // ── Pan (dra på tomt lerret) ─────────────────────────────────────────────
  const beginPan = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return; // kun tomt lerret
    panRef.current = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
    let moved = false;
    panAbort.current?.abort();
    const ac = new AbortController();
    panAbort.current = ac;
    const onMove = (ev: PointerEvent) => {
      const p = panRef.current;
      if (!p) return;
      if (!moved && Math.hypot(ev.clientX - p.sx, ev.clientY - p.sy) < 3) return;
      moved = true;
      setView((v) => ({ ...v, tx: p.tx + (ev.clientX - p.sx), ty: p.ty + (ev.clientY - p.sy) }));
    };
    const onUp = () => {
      panAbort.current?.abort(); panAbort.current = null; panRef.current = null;
      if (!moved) select({ kind: 'canvas' }); // klikk uten bevegelse = avvelg
    };
    window.addEventListener('pointermove', onMove, { signal: ac.signal });
    window.addEventListener('pointerup', onUp, { signal: ac.signal, once: true });
  };

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const clampZoom = (s: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));
  const zoomAround = (factor: number, cx: number, cy: number) => {
    // cx,cy = punkt i viewport-koordinater; hold det fast under zoom.
    setView((v) => {
      const ns = clampZoom(v.scale * factor);
      const k = ns / v.scale;
      return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  };
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const vp = viewportRef.current?.getBoundingClientRect();
      const cx = vp ? e.clientX - vp.left : 0, cy = vp ? e.clientY - vp.top : 0;
      zoomAround(e.deltaY < 0 ? 1.1 : 1 / 1.1, cx, cy);
    }
  };
  const zoomBtn = (factor: number) => {
    const vp = viewportRef.current?.getBoundingClientRect();
    zoomAround(factor, vp ? vp.width / 2 : 0, vp ? vp.height / 2 : 0);
  };
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 });

  // ── Tastatur: nudge / slett / dupliser / zoom / avvelg ────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
      const st = useMockupStudio.getState();

      // Zoom-hurtigtaster (uavhengig av utvalg)
      if ((e.key === '0') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); resetView(); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBtn(1.1); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBtn(1 / 1.1); return; }

      const sel = st.selection;
      if (sel.kind !== 'device' && sel.kind !== 'text') return;

      if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); st.duplicateSelected(); return; }
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
      ref={viewportRef}
      onWheel={onWheel}
      style={{
        position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, maxHeight: '100%',
        borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#05070c',
      }}
    >
      <div
        ref={wrapRef}
        onPointerDown={beginPan}
        style={{
          position: 'absolute', inset: 0,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0',
        }}
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
              onFocus={() => select({ kind: 'device', id: dev.id })}
              aria-label={`Enhet: ${dev.variant}${active ? ' (valgt)' : ''} — ${dev.threeD ? 'dra for å rotere (3D)' : 'dra for å flytte'}, piltaster nudger, Delete fjerner`}
              aria-pressed={active}
              title={dev.threeD ? 'Dra for å ROTERE (3D) · flytt med piltaster/numerisk · Delete fjerner' : 'Dra for å flytte · piltaster nudger · Cmd/Ctrl+D dupliserer · Delete fjerner'}
              style={{
                position: 'absolute', left: pct(dev.x, W), top: pct(dev.y, H), width: pct(dev.w, W), height: pct(h, H),
                transform: `rotate(${dev.rotation}deg)`, transformOrigin: 'center',
                background: 'transparent', border: active ? '2px solid #22d3ee' : '2px solid transparent',
                borderRadius: 8, padding: 0, cursor: overlayCursor, touchAction: 'none',
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
              onFocus={() => select({ kind: 'text', id: t.id })}
              onDoubleClick={(e) => { e.stopPropagation(); select({ kind: 'text', id: t.id }); setEditingId(t.id); }}
              aria-label={`Tekst: ${t.text.slice(0, 40)}${active ? ' (valgt)' : ''} — dra for å flytte, dobbeltklikk for å redigere`}
              aria-pressed={active}
              title="Dra for å flytte · dobbeltklikk = rediger · piltaster nudger"
              style={{ ...box, background: active ? 'rgba(34,211,238,0.08)' : 'transparent', border: active ? '2px solid #22d3ee' : '2px dashed transparent', borderRadius: 6, padding: 0, cursor: overlayCursor, touchAction: 'none' }}
            />
          );
        })}

        {/* Snap-/justeringslinjer (kun mens man drar) */}
        {guides.vx.map((x, i) => (
          <div key={`v${i}`} style={{ position: 'absolute', left: pct(x, W), top: 0, bottom: 0, width: 1, background: '#f472b6', pointerEvents: 'none', boxShadow: '0 0 0 0.5px #f472b6' }} />
        ))}
        {guides.hy.map((y, i) => (
          <div key={`h${i}`} style={{ position: 'absolute', top: pct(y, H), left: 0, right: 0, height: 1, background: '#f472b6', pointerEvents: 'none', boxShadow: '0 0 0 0.5px #f472b6' }} />
        ))}

        {safeArea && (
          <div style={{ position: 'absolute', inset: '3%', border: '1px dashed rgba(255,255,255,0.4)', borderRadius: 8, pointerEvents: 'none' }} />
        )}
      </div>

      {/* Feil-banner: gjør en mislykket/ugyldig render synlig i stedet for stille «ingenting skjedde». */}
      {renderError && (
        <div role="alert" style={{
          position: 'absolute', left: 12, right: 12, top: 12, zIndex: 5,
          background: 'rgba(120,20,20,0.92)', color: '#fff', borderRadius: 8,
          padding: '8px 12px', fontSize: 13, lineHeight: 1.4, pointerEvents: 'none',
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}>
          ⚠️ {renderError}
        </div>
      )}

      {/* Zoom-kontroll (nede til høyre) */}
      <div style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 6, display: 'flex', gap: 4, alignItems: 'center', background: 'rgba(10,13,20,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 4 }}>
        <button onClick={() => zoomBtn(1 / 1.1)} aria-label="Zoom ut" title="Zoom ut (−)" style={zoomBtnStyle}>−</button>
        <button onClick={resetView} aria-label="Tilpass (100%)" title="Tilpass til lerret (Cmd/Ctrl+0)" style={{ ...zoomBtnStyle, width: 'auto', padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}>{Math.round(view.scale * 100)}%</button>
        <button onClick={() => zoomBtn(1.1)} aria-label="Zoom inn" title="Zoom inn (+)" style={zoomBtnStyle}>+</button>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 26, height: 26, display: 'grid', placeItems: 'center', background: 'transparent',
  color: '#e6e8ee', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15, lineHeight: 1,
};

export default MockupCanvas;
