/**
 * FramedDevice — live <iframe> plassert i skjerm-hullet av en ekte device-
 * ramme-PNG (samme rammer som eksporten bruker). Bredden styres av `width`;
 * høyden følger frame-PNG-ens forhold. Skjerm-rektangelet og hjørne-radius
 * kommer fra DEVICE_FRAMES (relativt 0..1).
 *
 * Innholdet rendres med enhetens LOGISKE viewport-bredde og skaleres opp for
 * å fylle skjermen, slik at nettsiden viser sitt optimaliserte format for
 * akkurat den enheten. scrolling="no" + overflow:hidden = ingen skrollbar.
 *
 * Delt mellom Guided Recorder og Flow Builder / Device Preview (shell).
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { DEVICE_FRAMES, type FrameVariant } from './deviceFrames';

/** Logisk viewport-bredde (CSS-px) per enhet, så nettsiden rendrer riktig
 *  responsiv layout (mobil/tablet/desktop) — ikke desktop-layout overalt. */
export const VIEWPORT_W: Record<FrameVariant, number> = {
  iphone: 390, ipad: 834, ipad_landscape: 1194, macbook: 1440,
};

export function FramedDevice({ variant, url, width, shadow, iframeRef, overlay, onScreenClick, onScreenDraw, focusZoom, screenshot }: {
  variant: FrameVariant; url: string; width: string | number;
  shadow?: string; iframeRef?: React.Ref<HTMLIFrameElement>;
  /** Fase 1b: vis et scan-screenshot i stedet for live-iframe (presis + funker
   *  på sider iframe ikke kan vise). Når satt brukes ikke url/iframe. */
  screenshot?: string;
  /** Innhold rendret OVER skjermen (hotspot/cursor/touch-overlay). */
  overlay?: React.ReactNode;
  /** Klikk på skjermflaten → koordinater i viewport-prosent (0–1). Når satt,
   *  fanges klikk (for å plassere hotspot) i stedet for å gå til iframe-en. */
  onScreenClick?: (xPct: number, yPct: number) => void;
  /** Tegn hotspot ved å dra et rektangel → bounds i viewport-prosent (0–1).
   *  Et kort drag (≈klikk) faller tilbake til onScreenClick. */
  onScreenDraw?: (rect: { x: number; y: number; w: number; h: number }) => void;
  /** Push-in mot et punkt (auto-zoom): senter cx,cy i 0–1, skala ≥ 1. Zoomer
   *  iframe + overlay sammen, så hotspot holder seg justert. Myk overgang. */
  focusZoom?: { cx: number; cy: number; scale: number };
}) {
  const f = DEVICE_FRAMES[variant];
  const s = f.screen;
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  // Tegne-hotspot: rubber-band-rektangel mens man drar (viewport-prosent 0–1).
  const [draw, setDraw] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const vw = VIEWPORT_W[variant];
  // Skjerm-rektangelets piksel-forhold (b/h) = sw/sh; logisk høyde gir samme forhold.
  const screenPxAspect = (s.w / s.h) * f.aspect;
  const vh = vw / screenPxAspect;

  useLayoutEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / vw);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vw]);

  return (
    <div style={{ position: 'relative', width, aspectRatio: String(f.aspect), filter: shadow ? `drop-shadow(${shadow})` : 'drop-shadow(0 8px 22px rgba(0,0,0,0.12))' }}>
      {/* Ekte ramme nederst (transparent surround). Skjermen i PNG-en er opak
          svart, så iframe-en MÅ ligge OVER rammen og klippes til skjerm-hullet
          — ellers dekker den svarte PNG-skjermen innholdet. */}
      <img src={f.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      {/* Live innhold over rammen, klippet til skjerm-rektangelet */}
      <div ref={screenRef} style={{ position: 'absolute', left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%`, background: '#000', borderRadius: `${f.radius * 100}%`, overflow: 'hidden' }}>
        {/* Zoom-lag: iframe + overlay skaleres sammen mot fokuspunktet (auto-zoom). */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: focusZoom && focusZoom.scale > 1 ? `scale(${focusZoom.scale})` : undefined,
          transformOrigin: focusZoom ? `${focusZoom.cx * 100}% ${focusZoom.cy * 100}%` : '50% 50%',
          transition: 'transform 700ms cubic-bezier(.2,.7,.3,1)',
        }}>
        {screenshot ? (
          // Fase 1b: vis ekte scan-screenshot (riktig scroll-bånd) i stedet for
          // live-iframe. Bilde + hotspot kommer fra samme scan → perfekt align,
          // og funker for sider iframe ikke kan vise (auth/lagrings-tunge SPA-er).
          <img src={screenshot} alt="" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        ) : (
          <iframe ref={iframeRef} title={variant} src={url} scrolling="no"
            style={{
              width: vw, height: vh, border: 0, display: 'block',
              transform: `scale(${scale || 0.001})`, transformOrigin: '0 0',
              opacity: scale > 0 ? 1 : 0,
            }} />
        )}
        {/* Overlay (hotspot/cursor/touch) over skjermen */}
        {overlay}
        </div>
        {/* Klikk/tegne-fanger for hotspot (kun når onScreenClick/onScreenDraw er satt).
            Dra = tegn rektangel (eksakt markering); kort drag/klikk = standard-boks. */}
        {(onScreenClick || onScreenDraw) && (
          <div
            onMouseDown={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
              const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
              setDraw({ x0: x, y0: y, x1: x, y1: y });
            }}
            onMouseMove={(e) => {
              if (!draw) return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
              const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
              setDraw((d) => (d ? { ...d, x1: x, y1: y } : d));
            }}
            onMouseUp={() => {
              if (!draw) return;
              const w = Math.abs(draw.x1 - draw.x0), h = Math.abs(draw.y1 - draw.y0);
              const cx = (draw.x0 + draw.x1) / 2, cy = (draw.y0 + draw.y1) / 2;
              setDraw(null);
              // Ekte drag (begge sider ≥ ~1.5%) → tegnet rektangel; ellers klikk-fallback.
              if (onScreenDraw && w > 0.015 && h > 0.015) {
                onScreenDraw({ x: Math.min(draw.x0, draw.x1), y: Math.min(draw.y0, draw.y1), w, h });
              } else if (onScreenClick) {
                onScreenClick(cx, cy);
              }
            }}
            onMouseLeave={() => setDraw(null)}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 3 }}
          >
            {draw && (() => {
              const w = Math.abs(draw.x1 - draw.x0), h = Math.abs(draw.y1 - draw.y0);
              return (
                <div style={{
                  position: 'absolute', pointerEvents: 'none',
                  left: `${Math.min(draw.x0, draw.x1) * 100}%`, top: `${Math.min(draw.y0, draw.y1) * 100}%`,
                  width: `${w * 100}%`, height: `${h * 100}%`,
                  border: '2px solid #c4622d', background: 'rgba(196,98,45,0.16)', borderRadius: 6,
                }} />
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default FramedDevice;
