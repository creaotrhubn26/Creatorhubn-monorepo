import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReadThroughAnalysis, type AnalyzeInput, type ReadThroughAnalysis } from './useReadThroughAnalysis';

const sampleInput: AnalyzeInput = {
  projectId: '00000000-0000-0000-0000-000000000001',
  sceneId: 'scene-1',
  scene: { sceneNumber: 1, heading: 'INT. ROOM — DAY' },
  dialogueLines: [
    { id: 'line-1', characterName: 'ANNA', dialogueText: 'Hi.' },
  ],
  characters: [{ name: 'ANNA' }],
};

const sampleAnalysis: ReadThroughAnalysis = {
  sceneBrief: { logline: 'A greeting.', emotionalArc: 'neutral', conflict: 'none', beats: ['enter'] },
  lines: [
    { lineId: 'line-1', subtext: 'friendly', emphasis: 'normal', pauseBefore: 200, delivery: 'warm' },
  ],
  voiceCasting: [{ characterName: 'ANNA', suggestedVoice: 'nova', reasoning: 'warm female' }],
};

describe('useReadThroughAnalysis', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts idle with empty maps', () => {
    const { result } = renderHook(() => useReadThroughAnalysis());
    expect(result.current.status).toBe('idle');
    expect(result.current.analysis).toBeNull();
    expect(result.current.lineHintsById.size).toBe(0);
    expect(result.current.voiceCastingByCharacter.size).toBe(0);
  });

  it('transitions idle → loading → ready and populates lookup maps', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: sampleAnalysis }),
    });
    const { result } = renderHook(() => useReadThroughAnalysis());
    await act(async () => {
      await result.current.analyze(sampleInput);
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.analyzedSceneId).toBe('scene-1');
    expect(result.current.lineHintsById.get('line-1')?.delivery).toBe('warm');
    expect(result.current.voiceCastingByCharacter.get('ANNA')?.suggestedVoice).toBe('nova');
  });

  it('surfaces server error message', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Claude blew up' }),
    });
    const { result } = renderHook(() => useReadThroughAnalysis());
    await act(async () => {
      await result.current.analyze(sampleInput);
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Claude blew up');
  });

  it('reset clears state', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: sampleAnalysis }),
    });
    const { result } = renderHook(() => useReadThroughAnalysis());
    await act(async () => {
      await result.current.analyze(sampleInput);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.analysis).toBeNull();
    expect(result.current.analyzedSceneId).toBeNull();
  });
});
