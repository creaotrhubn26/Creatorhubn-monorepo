/**
 * SceneInteractionOverlay — tegner scenens interaktive mål (hotspot) over en
 * device-preview: spotlight-highlight på elementet, syntetisk muspeker (desktop)
 * eller tap-ring (mobil/tablet), og safe-area-guide. Alt styres av prosjektets
 * render-toggles (Show Cursor / Show Touch Points / Highlight Interactions /
 * Safe Area). Dette er den visuelle broa mellom en scenes required action og det
 * ekte elementet på siden — slik Guided Recorder-mockupen viser.
 *
 * hotspot er i viewport-prosent (0–1), så overlayet er device-uavhengig og
 * legges rett oppå FramedDevice sin skjermflate.
 */

import type { DemoDevice, DemoRenderOptions } from './demoStudioModel';

const ACCENT = '#ef8a5d';

/** Safe-area-innrykk (prosent) per enhet — grovt, for visuell guide. */
function safeInset(device: DemoDevice): { top: number; bottom: number; side: number } {
  if (device === 'iphone') return { top: 0.055, bottom: 0.03, side: 0.0 };
  if (device === 'ipad') return { top: 0.025, bottom: 0.02, side: 0.0 };
  return { top: 0, bottom: 0, side: 0 };
}

function CursorArrow({ left, top }: { left: string; top: string }) {
  // Enkel pilpeker; spissen sitter i (left, top).
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden
      style={{ position: 'absolute', left, top, transform: 'translate(-2px, -2px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.45))', pointerEvents: 'none' }}>
      <path d="M2 2 L2 16 L6 12 L9 18 L11.5 17 L8.5 11 L14 11 Z" fill="#fff" stroke="#1d1b19" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function SceneInteractionOverlay({ hotspot, render, device }: {
  hotspot?: { x: number; y: number; w: number; h: number };
  render: DemoRenderOptions;
  device: DemoDevice;
}) {
  const isTouch = device !== 'macbook';
  const inset = safeInset(device);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, overflow: 'hidden' }}>
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
        <>
          {/* Spotlight: dimm alt unntatt elementet */}
          {render.highlightInteractions && (
            <div style={{
              position: 'absolute',
              left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%`,
              width: `${hotspot.w * 100}%`, height: `${hotspot.h * 100}%`,
              border: `2px solid ${ACCENT}`, borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.30)',
            }} />
          )}
          {/* Tap-ring (mobil/tablet) */}
          {render.showTouchPoints && isTouch && (
            <div style={{
              position: 'absolute',
              left: `${(hotspot.x + hotspot.w / 2) * 100}%`, top: `${(hotspot.y + hotspot.h / 2) * 100}%`,
              width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: '50%',
              background: 'rgba(239,138,93,0.30)', border: `2px solid ${ACCENT}`,
            }} />
          )}
          {/* Syntetisk muspeker (desktop) */}
          {render.showCursor && !isTouch && (
            <CursorArrow
              left={`${(hotspot.x + hotspot.w / 2) * 100}%`}
              top={`${(hotspot.y + hotspot.h / 2) * 100}%`}
            />
          )}
        </>
      )}
    </div>
  );
}

export default SceneInteractionOverlay;
