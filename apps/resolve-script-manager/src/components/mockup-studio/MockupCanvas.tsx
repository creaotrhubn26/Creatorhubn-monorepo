/**
 * MockupCanvas — live preview av MockupDoc.
 *
 * Tegner via SAMME rasterisator som eksporten (rasterizeMockup) inn i et
 * <canvas>, så preview er piksel-identisk med PNG-en. Oppå ligger gjennomsiktige
 * klikkflater per enhet/tekst for utvalg (DOM-hit-testing) med markering av det
 * valgte elementet. Preview rasteriseres på en lav-oppløsnings-skala for fart;
 * eksporten kjører full oppløsning.
 */

import { useEffect, useRef, useState } from 'react';
import { rasterizeMockup, measureTextHeight } from './mockupRaster';
import { deviceHeight } from './mockupStudioModel';
import { useMockupStudio, type Selection } from './mockupStudioStore';

/** Preview-oppløsning (bredde i px). Lavere = raskere re-render ved skriving. */
const PREVIEW_W = 1200;

export function MockupCanvas({ safeArea }: { safeArea?: boolean } = {}) {
  const doc = useMockupStudio((s) => s.doc);
  const selection = useMockupStudio((s) => s.selection);
  const select = useMockupStudio((s) => s.select);
  const patchText = useMockupStudio((s) => s.patchText);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Re-rasteriser når dokumentet endres. Token hindrer race når raske endringer
  // (skriving) starter flere async-tegninger — bare den siste får male.
  useEffect(() => {
    let alive = true;
    const scale = PREVIEW_W / doc.canvas.w;
    rasterizeMockup(doc, scale).then((off) => {
      if (!alive) return;
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = off.width;
      cv.height = off.height;
      const ctx = cv.getContext('2d');
      if (ctx) ctx.drawImage(off, 0, 0);
    }).catch(() => { /* preview-tegning feilet — behold forrige frame */ });
    return () => { alive = false; };
  }, [doc]);

  const selId = (s: Selection): string | null => (s.kind === 'device' || s.kind === 'text' ? s.id : null);
  const selectedId = selId(selection);

  const pct = (v: number, base: number) => `${(v / base) * 100}%`;
  const W = doc.canvas.w;
  const H = doc.canvas.h;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${W} / ${H}`,
        maxHeight: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        // Klikk på tom lerret-flate → velg canvas.
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) select({ kind: 'canvas' }); }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
      {/* Klikkflater for enheter */}
      {doc.devices.map((dev) => {
        const h = deviceHeight(dev);
        const active = selectedId === dev.id;
        return (
          <button
            key={dev.id}
            onMouseDown={(e) => { e.stopPropagation(); select({ kind: 'device', id: dev.id }); }}
            title={`Enhet: ${dev.variant}`}
            style={{
              position: 'absolute',
              left: pct(dev.x, W), top: pct(dev.y, H),
              width: pct(dev.w, W), height: pct(h, H),
              transform: `rotate(${dev.rotation}deg)`,
              transformOrigin: 'center',
              background: 'transparent',
              border: active ? '2px solid #22d3ee' : '2px solid transparent',
              borderRadius: 8,
              padding: 0,
              cursor: 'pointer',
              outline: 'none',
            }}
          />
        );
      })}
      {/* Klikkflater for tekst — dobbeltklikk = rediger inline */}
      {doc.texts.map((t) => {
        const active = selectedId === t.id;
        const th = measureTextHeight(t);
        const box = { position: 'absolute' as const, left: pct(t.x, W), top: pct(t.y, H), width: pct(t.w, W), height: pct(th, H) };
        if (editingId === t.id) {
          return (
            <textarea
              key={t.id}
              autoFocus
              value={t.text}
              onChange={(e) => patchText(t.id, { text: e.target.value })}
              onBlur={() => setEditingId(null)}
              onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ ...box, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '2px solid #22d3ee', borderRadius: 6, padding: 4, font: '600 14px system-ui', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          );
        }
        return (
          <button
            key={t.id}
            onMouseDown={(e) => { e.stopPropagation(); select({ kind: 'text', id: t.id }); }}
            onDoubleClick={(e) => { e.stopPropagation(); select({ kind: 'text', id: t.id }); setEditingId(t.id); }}
            title="Klikk = velg · dobbeltklikk = rediger tekst"
            style={{ ...box, background: active ? 'rgba(34,211,238,0.08)' : 'transparent', border: active ? '2px solid #22d3ee' : '2px dashed transparent', borderRadius: 6, padding: 0, cursor: 'text', outline: 'none' }}
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
