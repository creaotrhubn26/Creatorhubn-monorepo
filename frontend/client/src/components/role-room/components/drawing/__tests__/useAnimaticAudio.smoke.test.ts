// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimaticAudio } from '../useAnimaticAudio';

/**
 * En enkel mock som speiler HTMLAudioElement-interfacet vi bruker.
 * Vi vil ikke gjøre faktisk lyd-avspilling i tester.
 */
function makeAudioStub(initialCurrentTime = 0) {
  return {
    currentTime: initialCurrentTime,
    playbackRate: 1,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    // Spore om play()/pause() har blitt kalt for å verifisere effekter.
  };
}

describe('Sprint A.7 — useAnimaticAudio play/pause-sync', () => {
  it('når isPlaying blir true: play() kalles', () => {
    const audio = makeAudioStub();
    const { rerender } = renderHook(
      ({ isPlaying }) => useAnimaticAudio({
        audioElement: audio,
        isPlaying,
        currentTime: 0,
      }),
      { initialProps: { isPlaying: false } },
    );
    rerender({ isPlaying: true });
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('når isPlaying blir false: pause() kalles', () => {
    const audio = makeAudioStub();
    const { rerender } = renderHook(
      ({ isPlaying }) => useAnimaticAudio({
        audioElement: audio,
        isPlaying,
        currentTime: 0,
      }),
      { initialProps: { isPlaying: true } },
    );
    // Initial render kaller play en gang (transition false→true via wasPlayingRef=false→isPlaying=true).
    audio.play.mockClear();
    rerender({ isPlaying: false });
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it('ingen audio-element: ingen kall', () => {
    renderHook(() => useAnimaticAudio({
      audioElement: null,
      isPlaying: true,
      currentTime: 0,
    }));
    // Skal bare ikke kaste.
    expect(true).toBe(true);
  });
});

describe('Sprint A.7 — useAnimaticAudio drift-korreksjon', () => {
  it('stor drift mellom controller og audio: audio.currentTime settes', () => {
    const audio = makeAudioStub(0);
    const { rerender } = renderHook(
      ({ currentTime }) => useAnimaticAudio({
        audioElement: audio,
        isPlaying: false,
        currentTime,
      }),
      { initialProps: { currentTime: 0 } },
    );
    rerender({ currentTime: 5 });
    expect(audio.currentTime).toBe(5);
  });

  it('liten drift (under tolerance): audio.currentTime ikke endret', () => {
    const audio = makeAudioStub(0);
    const { rerender } = renderHook(
      ({ currentTime }) => useAnimaticAudio({
        audioElement: audio,
        isPlaying: false,
        currentTime,
        driftTolerance: 0.5,
      }),
      { initialProps: { currentTime: 0 } },
    );
    rerender({ currentTime: 0.1 });
    // Innenfor tolerance — ikke endret.
    expect(audio.currentTime).toBe(0);
  });
});

describe('Sprint A.7 — useAnimaticAudio hastighet', () => {
  it('playbackSpeed propageres til audio.playbackRate', () => {
    const audio = makeAudioStub();
    const { rerender } = renderHook(
      ({ speed }) => useAnimaticAudio({
        audioElement: audio,
        isPlaying: false,
        currentTime: 0,
        playbackSpeed: speed,
      }),
      { initialProps: { speed: 1 } },
    );
    expect(audio.playbackRate).toBe(1);
    rerender({ speed: 2 });
    expect(audio.playbackRate).toBe(2);
    rerender({ speed: 0.5 });
    expect(audio.playbackRate).toBe(0.5);
  });
});

describe('Sprint A.7 — useAnimaticAudio cleanup', () => {
  it('unmount pauser audio', () => {
    const audio = makeAudioStub();
    const { unmount } = renderHook(() => useAnimaticAudio({
      audioElement: audio,
      isPlaying: true,
      currentTime: 0,
    }));
    audio.pause.mockClear();
    unmount();
    expect(audio.pause).toHaveBeenCalled();
  });
});
