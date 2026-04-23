import { useCallback, useRef, useState } from 'react';
import type { TTSVoice } from '../services/ttsService';

export interface ReadThroughAnalysis {
  sceneBrief: {
    logline: string;
    emotionalArc: string;
    conflict: string;
    beats: string[];
  };
  lines: Array<{
    lineId: string;
    subtext: string;
    emphasis: 'low' | 'normal' | 'high';
    pauseBefore: number;
    delivery: string;
  }>;
  voiceCasting: Array<{
    characterName: string;
    suggestedVoice: TTSVoice;
    reasoning: string;
  }>;
}

export interface AnalyzeInput {
  projectId: string;
  sceneId: string;
  scene: {
    sceneNumber?: string | number;
    heading?: string;
    locationName?: string;
    intExt?: string;
    timeOfDay?: string;
    description?: string;
    characters?: string[];
  };
  dialogueLines: Array<{
    id: string;
    characterName: string;
    dialogueText: string;
    parenthetical?: string;
    emotionTag?: string;
  }>;
  characters: Array<{ name: string; description?: string; ageRange?: string }>;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface UseReadThroughAnalysisResult {
  status: Status;
  analysis: ReadThroughAnalysis | null;
  error: string | null;
  analyzedSceneId: string | null;
  analyze: (input: AnalyzeInput) => Promise<void>;
  reset: () => void;
  /** Lookup map keyed by dialogue line id for O(1) access in the render loop. */
  lineHintsById: Map<string, ReadThroughAnalysis['lines'][number]>;
  voiceCastingByCharacter: Map<string, ReadThroughAnalysis['voiceCasting'][number]>;
}

export function useReadThroughAnalysis(): UseReadThroughAnalysisResult {
  const [status, setStatus] = useState<Status>('idle');
  const [analysis, setAnalysis] = useState<ReadThroughAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzedSceneId, setAnalyzedSceneId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (input: AnalyzeInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/ai/read-through/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(body.message || body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { success: boolean; data: ReadThroughAnalysis };
      setAnalysis(body.data);
      setAnalyzedSceneId(input.sceneId);
      setStatus('ready');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setAnalysis(null);
    setError(null);
    setAnalyzedSceneId(null);
  }, []);

  const lineHintsById = new Map<string, ReadThroughAnalysis['lines'][number]>();
  if (analysis) for (const l of analysis.lines) lineHintsById.set(l.lineId, l);

  const voiceCastingByCharacter = new Map<string, ReadThroughAnalysis['voiceCasting'][number]>();
  if (analysis) for (const v of analysis.voiceCasting) voiceCastingByCharacter.set(v.characterName, v);

  return { status, analysis, error, analyzedSceneId, analyze, reset, lineHintsById, voiceCastingByCharacter };
}
