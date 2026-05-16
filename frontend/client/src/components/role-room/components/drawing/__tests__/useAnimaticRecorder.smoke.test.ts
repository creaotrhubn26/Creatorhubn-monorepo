// @ts-nocheck
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimaticRecorder } from '../useAnimaticRecorder';

/**
 * Bygg en MediaRecorder-mock som lar oss styre lifecycle.
 */
class MockMediaRecorder {
  static isTypeSupported = vi.fn((mime: string) => mime.startsWith('video/webm'));
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  mimeType: string;
  constructor(_stream: MediaStream, options?: any) {
    this.mimeType = options?.mimeType ?? 'video/webm';
    instances.push(this);
  }
  start(_timeslice?: number) {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    // Send et chunk og fire onstop.
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['chunk'], { type: this.mimeType }) });
    }
    if (this.onstop) this.onstop();
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
}

const instances: MockMediaRecorder[] = [];

function makeCanvas() {
  return {
    width: 1280,
    height: 720,
    captureStream: vi.fn(() => ({
      getVideoTracks: () => [{ stop: vi.fn() } as MediaStreamTrack],
      getAudioTracks: () => [],
      getTracks: () => [{ stop: vi.fn() }],
    })),
  };
}

function makeAudio(withCapture = true) {
  const tracks = [{ stop: vi.fn() }];
  return {
    captureStream: withCapture
      ? vi.fn(() => ({
          getAudioTracks: () => tracks,
          getTracks: () => tracks,
        }))
      : undefined,
    currentTime: 0,
    play: vi.fn(),
    pause: vi.fn(),
  };
}

beforeEach(() => {
  instances.length = 0;
  global.MediaRecorder = MockMediaRecorder as any;
  // MediaStream-konstruktør som tar en array av tracks.
  global.MediaStream = class MockMediaStream {
    private trackList: any[];
    constructor(tracks: any[] = []) { this.trackList = tracks; }
    getTracks() { return this.trackList; }
    getVideoTracks() { return this.trackList.filter((t) => t.kind === 'video' || !t.kind); }
    getAudioTracks() { return this.trackList.filter((t) => t.kind === 'audio'); }
  } as any;
});

afterEach(() => {
  delete (global as any).MediaRecorder;
  delete (global as any).MediaStream;
});

describe('Sprint A.7 — useAnimaticRecorder støtte-deteksjon', () => {
  it('rapporterer isSupported=true når MediaRecorder + mime støttes', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    expect(result.current.isSupported).toBe(true);
  });

  it('uten MediaRecorder: isSupported=false', () => {
    delete (global as any).MediaRecorder;
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    expect(result.current.isSupported).toBe(false);
  });
});

describe('Sprint A.7 — useAnimaticRecorder lifecycle', () => {
  it('starter i idle uten blob og uten error', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    expect(result.current.state).toBe('idle');
    expect(result.current.lastBlob).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('start() går til recording', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    act(() => {
      const ok = result.current.start();
      expect(ok).toBe(true);
    });
    expect(result.current.state).toBe('recording');
  });

  it('start() uten canvas: feiler med error', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: null }));
    let ok = true;
    act(() => { ok = result.current.start(); });
    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/canvas/i);
  });

  it('stop() etter start: ender tilbake i idle med lastBlob satt', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('idle');
    expect(result.current.lastBlob).toBeInstanceOf(Blob);
  });

  it('lastBlob har riktig mime', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.lastBlob?.type).toBe('video/webm;codecs=vp9,opus');
  });

  it('start mens recording: ignoreres (returnerer false)', () => {
    const { result } = renderHook(() => useAnimaticRecorder({ canvas: makeCanvas() as any }));
    act(() => { result.current.start(); });
    let secondOk = true;
    act(() => { secondOk = result.current.start(); });
    expect(secondOk).toBe(false);
    expect(result.current.state).toBe('recording');
  });
});

describe('Sprint A.7 — useAnimaticRecorder audio-integrasjon', () => {
  it('med audio som har captureStream: audio inkluderes', () => {
    const audio = makeAudio(true);
    const canvas = makeCanvas();
    const { result } = renderHook(() => useAnimaticRecorder({
      canvas: canvas as any,
      audioElement: audio as any,
    }));
    act(() => { result.current.start(); });
    expect(audio.captureStream).toHaveBeenCalled();
  });

  it('audio uten captureStream: opptaket starter fortsatt (video-only)', () => {
    const audio = makeAudio(false);
    const canvas = makeCanvas();
    const { result } = renderHook(() => useAnimaticRecorder({
      canvas: canvas as any,
      audioElement: audio as any,
    }));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
  });
});
