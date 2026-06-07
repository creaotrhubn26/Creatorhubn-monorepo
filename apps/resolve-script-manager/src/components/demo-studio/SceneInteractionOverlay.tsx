/**
 * SceneInteractionOverlay — tegner scenens interaktive mål (hotspot) over en
 * device-preview: spotlight-highlight på elementet, syntetisk muspeker (desktop)
 * eller tap-ring (mobil/tablet), og safe-area-guide. Alt styres av prosjektets
 * render-toggles (Show Cursor / Show Touch Points / Highlight Interactions /
 * Safe Area). Dette er den visuelle broa mellom en scenes required action og det
 * ekte elementet på siden — slik Guided Recorder-mockupen viser.
 *
 * Video-bølge: muspekeren GLIR inn mot hotspot, klikk gir en RIPPLE-ring, og
 * highlight-rammen PULSERER — så bevegelsen ser levende ut i opptak (Resolve-fri).
 *
 * hotspot er i viewport-prosent (0–1), så overlayet er device-uavhengig og
 * legges rett oppå FramedDevice sin skjermflate.
 */

import type { DemoActionType, DemoDevice, DemoRenderOptions } from './demoStudioModel';

const ACCENT = '#ef8a5d';

/** Keyframes for animert cursor/ripple/puls. */
const ANIM_CSS = `
@keyframes trrCursorIn { from { transform: translate(26px, 30px) scale(1.25); opacity: 0; } to { transform: translate(-2px, -2px) scale(1); opacity: 1; } }
@keyframes trrRipple { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.55; } 100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } }
@keyframes trrPulse { 0%,100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.30), 0 0 0 0 rgba(239,138,93,0.55); } 50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.30), 0 0 0 7px rgba(239,138,93,0); } }
`;

/** Safe-area-innrykk (prosent) per enhet — grovt, for visuell guide. */
function safeInset(device: DemoDevice): { top: number; bottom: number; side: number } {
  if (device === 'iphone') return { top: 0.055, bottom: 0.03, side: 0.0 };
  if (device === 'ipad') return { top: 0.025, bottom: 0.02, side: 0.0 };
  return { top: 0, bottom: 0, side: 0 };
}

function CursorArrow({ left, top, animate }: { left: string; top: string; animate: boolean }) {
  // Enkel pilpeker; spissen sitter i (left, top). Glir inn når animate=true.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden
      style={{ position: 'absolute', left, top, transform: 'translate(-2px, -2px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.45))', pointerEvents: 'none', animation: animate ? 'trrCursorIn 600ms cubic-bezier(.2,.7,.3,1) both' : undefined }}>
      <path d="M2 2 L2 16 L6 12 L9 18 L11.5 17 L8.5 11 L14 11 Z" fill="#fff" stroke="#1d1b19" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function SceneInteractionOverlay({ hotspot, render, device, actionType, animate = true }: {
  hotspot?: { x: number; y: number; w: number; h: number };
  render: DemoRenderOptions;
  device: DemoDevice;
  /** Handlingstype — klikk/tap gir ripple. */
  actionType?: DemoActionType;
  /** Slå av animasjon (f.eks. ved hotspot-plassering). */
  animate?: boolean;
}) {
  const isTouch = device !== 'macbook';
  const inset = safeInset(device);
  const cx = hotspot ? (hotspot.x + hotspot.w / 2) * 100 : 50;
  const cy = hotspot ? (hotspot.y + hotspot.h / 2) * 100 : 50;
  // Ripple på klikk/tap (default klikk når actionType mangler).
  const isClickish = !actionType || actionType === 'click' || actionType === 'hover';
  const showRipple = animate && !!hotspot && (render.showCursor || render.showTouchPoints) && (isClickish || isTouch);
  // Re-mount-nøkkel så animasjonen spilles på nytt når hotspot/handling endres.
  const animKey = `${cx.toFixed(1)}-${cy.toFixed(1)}-${actionType ?? ''}`;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, overflow: 'hidden' }}>
      <style>{ANIM_CSS}</style>
      {/* Safe-area-guide */}
      {render.safeArea && (inset.top > 0 || inset.bottom > 0) && (
        <div style={{
          position: 'absolute',
          left: `${inset.side * 100}%`, right: `${inset.side * 100}%`,
          top: `${inset.top * 100}%`, bottom: `${inset.bottom * 100}%`,
          border: '1px dashed rgba(255,255,255,0.45)', borderRadius: 10,
        }} />
      )}

      {hotspot && (
        <div key={animKey} style={{ position: 'absolute', inset: 0 }}>
          {/* Spotlight: dimm alt unntatt elementet (pulser når animasjon på) */}
          {render.highlightInteractions && (
            <div style={{
              position: 'absolute',
              left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`,
              width: `${hotspot.w * 100}%`, height: `${hotspot.h * 100}%`,
              border: `2px solid ${ACCENT}`, borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.30)',
              animation: animate ? 'trrPulse 1.8s ease-in-out infinite' : undefined,
            }} />
          )}
          {/* Ripple-ring på klikk/tap */}
          {showRipple && (
            <span style={{
              position: 'absolute', left: `${cx}%`, top: `${cy}%`,
              width: 40, height: 40, borderRadius: '50%', border: `2.5px solid ${ACCENT}`,
              animation: 'trrRipple 1.4s ease-out infinite',
            }} />
          )}
          {/* Tap-ring (mobil/tablet) */}
          {render.showTouchPoints && isTouch && (
            <div style={{
              position: 'absolute', left: `${cx}%`, top: `${cy}%`,
              width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: '50%',
              background: 'rgba(239,138,93,0.30)', border: `2px solid ${ACCENT}`,
            }} />
          )}
          {/* Syntetisk muspeker (desktop) — glir inn mot hotspot */}
          {render.showCursor && !isTouch && (
            <CursorArrow left={`${cx}%`} top={`${cy}%`} animate={animate} />
          )}
        </div>
      )}
    </div>
  );
}

export default SceneInteractionOverlay;
