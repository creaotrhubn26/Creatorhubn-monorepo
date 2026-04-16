/**
 * useRoleRoomViewportMode
 *
 * Returns the current Role Room viewport mode plus a touch-capability guard.
 * Fase 1 foundation for the mobile/iPad UX backlog (items 002, 003, 007, 008).
 *
 * Modes:
 *   - mobile:          width ≤ 599px (phone)
 *   - tabletPortrait:  600–1199px, portrait orientation
 *   - tabletLandscape: 600–1199px, landscape orientation
 *   - desktop:         ≥ 1200px
 *
 * Breakpoints align with the MUI theme and academy-responsive.css (600 / 1200).
 * iPad tokens are kept separate from phone tokens per backlog item 008 so
 * tablets never collapse into phone-compressed UI.
 */

import { useEffect, useState } from 'react';

export type RoleRoomViewportMode =
  | 'mobile'
  | 'tabletPortrait'
  | 'tabletLandscape'
  | 'desktop';

export interface RoleRoomViewport {
  mode: RoleRoomViewportMode;
  isTouchMode: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const MOBILE_MAX_WIDTH = 599;
const TABLET_MAX_WIDTH = 1199;

const SSR_DEFAULT: RoleRoomViewport = {
  mode: 'desktop',
  isTouchMode: false,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};

function readViewport(): RoleRoomViewport {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return SSR_DEFAULT;
  }

  const width = window.innerWidth;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;

  let mode: RoleRoomViewportMode;
  if (width <= MOBILE_MAX_WIDTH) {
    mode = 'mobile';
  } else if (width <= TABLET_MAX_WIDTH) {
    mode = isPortrait ? 'tabletPortrait' : 'tabletLandscape';
  } else {
    mode = 'desktop';
  }

  return {
    mode,
    isTouchMode: coarsePointer && noHover,
    isMobile: mode === 'mobile',
    isTablet: mode === 'tabletPortrait' || mode === 'tabletLandscape',
    isDesktop: mode === 'desktop',
  };
}

export function useRoleRoomViewportMode(): RoleRoomViewport {
  const [viewport, setViewport] = useState<RoleRoomViewport>(() => readViewport());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setViewport(readViewport());

    // Debounce orientation/resize so iPad doesn't thrash layout mid-rotation (item 022).
    let frame: number | null = null;
    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        update();
      });
    };

    const orientation = window.matchMedia('(orientation: portrait)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const hover = window.matchMedia('(hover: none)');

    window.addEventListener('resize', scheduleUpdate);
    orientation.addEventListener('change', update);
    coarse.addEventListener('change', update);
    hover.addEventListener('change', update);

    // Re-sync once mounted in case initial read() hit the SSR fallback.
    update();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      orientation.removeEventListener('change', update);
      coarse.removeEventListener('change', update);
      hover.removeEventListener('change', update);
    };
  }, []);

  return viewport;
}
