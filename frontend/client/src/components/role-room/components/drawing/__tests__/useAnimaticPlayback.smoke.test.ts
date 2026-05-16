// @ts-nocheck
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimaticPlayback } from '../useAnimaticPlayback';

/**
 * Manuell RAF-mock: vi styrer timestamp og når frames "tikker".
 * Hver gang vi vil pulse frem N ms, kaller vi `advance(ms)`.
 */
function installRafMock() {
  const callbacks: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let nextId = 1;
  let currentTime = 0;

  global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.push({ id, cb });
    return id;
  }) as typeof requestAnimationFrame;

  global.cancelAnimationFrame = ((id: number) => {
    const idx = callbacks.findIndex((entry) => entry.id === id);
    if (idx !== -1) callbacks.splice(idx, 1);
  }) as typeof cancelAnimationFrame;

  return {
    advance(ms: number) {
      currentTime += ms;
      // Kopier og tøm — kalls inni kan registrere nye RAFs som vi vil
      // håndtere på neste advance.
      const pending = callbacks.splice(0, callbacks.length);
      pending.forEach((entry) => entry.cb(currentTime));
    },
    reset() {
      callbacks.length = 0;
      currentTime = 0;
      nextId = 1;
    },
  };
}

let raf: ReturnType<typeof installRafMock>;

beforeEach(() => {
  raf = installRafMock();
});

afterEach(() => {
  raf.reset();
});

describe('Sprint A.7 — useAnimaticPlayback basisstate', () => {
  it('starter pauset med currentTime=0', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }],
    }));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.totalDuration).toBe(5);
    expect(result.current.activeFrameIndex).toBe(0);
  });

  it('tom frame-sekvens gir totalDuration=0', () => {
    const { result } = renderHook(() => useAnimaticPlayback({ frames: [] }));
    expect(result.current.totalDuration).toBe(0);
    expect(result.current.activeFrameIndex).toBe(-1);
  });

  it('seek oppdaterer currentTime', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }],
    }));
    act(() => result.current.seek(3.5));
    expect(result.current.currentTime).toBe(3.5);
    expect(result.current.activeFrameIndex).toBe(1);
  });

  it('seek klampes til [0, totalDuration]', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }],
    }));
    act(() => result.current.seek(99));
    expect(result.current.currentTime).toBe(3);
    act(() => result.current.seek(-5));
    expect(result.current.currentTime).toBe(0);
  });

  it('seekToFrame hopper til frame-start', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [
        { id: 'a', duration: 3 },
        { id: 'b', duration: 2 },
        { id: 'c', duration: 4 },
      ],
    }));
    act(() => result.current.seekToFrame(2));
    expect(result.current.currentTime).toBe(5);
    expect(result.current.activeFrameIndex).toBe(2);
  });
});

describe('Sprint A.7 — useAnimaticPlayback play/pause/RAF', () => {
  it('play setter isPlaying=true', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }],
    }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
  });

  it('pause setter isPlaying=false', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }],
    }));
    act(() => result.current.play());
    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);
  });

  it('toggle veksler mellom play og pause', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }],
    }));
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it('play på tom timeline gjør ingenting', () => {
    const { result } = renderHook(() => useAnimaticPlayback({ frames: [] }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(false);
  });

  it('RAF-loop øker currentTime over tid', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }, { id: 'b', duration: 2 }],
    }));
    act(() => result.current.play());
    // Pulse: første RAF setter referansetidspunktet (dt=0).
    act(() => raf.advance(16));
    // Andre RAF: vi har gått 1000 ms.
    act(() => raf.advance(1000));
    expect(result.current.currentTime).toBeGreaterThan(0.9);
    expect(result.current.currentTime).toBeLessThan(1.2);
    expect(result.current.activeFrameIndex).toBe(0);
  });

  it('aktiv frame skifter når currentTime krysser segment-grense', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 1 }, { id: 'b', duration: 1 }],
    }));
    act(() => result.current.play());
    act(() => raf.advance(16));
    act(() => raf.advance(1100));
    expect(result.current.activeFrameIndex).toBe(1);
  });

  it('når slutt nås uten loop: pauser og setter currentTime=total', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 1 }],
    }));
    act(() => result.current.play());
    act(() => raf.advance(16));
    act(() => raf.advance(2000));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(1);
  });

  it('med loop=true: wrapper rundt til 0', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 1 }],
      loop: true,
    }));
    act(() => result.current.play());
    act(() => raf.advance(16));
    act(() => raf.advance(1500));
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentTime).toBeLessThan(1);
    expect(result.current.currentTime).toBeGreaterThan(0);
  });

  it('play etter at vi har spilt til slutt: starter på nytt fra 0', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 1 }],
    }));
    act(() => result.current.play());
    act(() => raf.advance(16));
    act(() => raf.advance(2000));
    expect(result.current.currentTime).toBe(1);
    act(() => result.current.play());
    expect(result.current.currentTime).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it('playbackSpeed=2 spiller dobbelt så fort', () => {
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 4 }],
      playbackSpeed: 2,
    }));
    act(() => result.current.play());
    act(() => raf.advance(16));
    act(() => raf.advance(1000));
    // 1s wallclock * 2x = ~2s frame-tid.
    expect(result.current.currentTime).toBeGreaterThan(1.8);
    expect(result.current.currentTime).toBeLessThan(2.2);
  });
});

describe('Sprint A.7 — useAnimaticPlayback onActiveFrameChange', () => {
  it('kalles én gang når aktiv frame skifter', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 1 }, { id: 'b', duration: 1 }],
      onActiveFrameChange: onChange,
    }));
    // Initial mount: callback kalles for frame 0.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].frameId).toBe('a');

    act(() => result.current.seek(1.2));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0].frameId).toBe('b');
  });

  it('seek innen samme segment kaller ikke callbacken igjen', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAnimaticPlayback({
      frames: [{ id: 'a', duration: 3 }],
      onActiveFrameChange: onChange,
    }));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => result.current.seek(1.5));
    act(() => result.current.seek(2.5));
    expect(onChange).toHaveBeenCalledTimes(1); // fortsatt samme frame
  });
});
