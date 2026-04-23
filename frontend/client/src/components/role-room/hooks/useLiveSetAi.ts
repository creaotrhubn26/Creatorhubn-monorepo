import { useCallback, useState } from 'react';

export type LiveSetAiAction =
  | 'coverage-check'
  | 'replan-day'
  | 'continuity-check'
  | 'end-of-day';

export interface CoverageCheckResult {
  status: 'complete' | 'gaps' | 'critical';
  missingCoverage: Array<{
    type: string;
    reason: string;
    severity: 'critical' | 'recommended' | 'nice-to-have';
  }>;
  summary: string;
}

export interface ReplanDayResult {
  recommendation: {
    keep: string[];
    combine: Array<{ shotIds: string[]; note: string }>;
    push: Array<{ shotId: string; suggestedPickupNote: string }>;
    drop: Array<{ shotId: string; reasoning: string }>;
  };
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ContinuityCheckResult {
  status: 'clean' | 'warnings' | 'conflicts';
  conflicts: Array<{
    type: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    referenceShotIds: string[];
  }>;
}

export interface EndOfDayBrief {
  summary: {
    shotsCompleted: number;
    shotsMissing: number;
    highlights: string[];
    concerns: string[];
  };
  tomorrowBrief: { priority: string[]; editorNeeds: string[] };
  crewMessageDraft: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface CallState<T> {
  status: Status;
  data: T | null;
  error: string | null;
}

const INITIAL: CallState<unknown> = { status: 'idle', data: null, error: null };

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
    message?: string;
  };
  if (!res.ok || !parsed.success || parsed.data === undefined) {
    throw new Error(parsed.message || parsed.error || `HTTP ${res.status}`);
  }
  return parsed.data;
}

export interface UseLiveSetAiResult {
  coverageCheck: CallState<CoverageCheckResult>;
  replanDay: CallState<ReplanDayResult>;
  continuityCheck: CallState<ContinuityCheckResult>;
  endOfDay: CallState<EndOfDayBrief>;
  runCoverageCheck: (body: unknown) => Promise<void>;
  runReplanDay: (body: unknown) => Promise<void>;
  runContinuityCheck: (body: unknown) => Promise<void>;
  runEndOfDay: (body: unknown) => Promise<void>;
  reset: (action: LiveSetAiAction) => void;
}

export function useLiveSetAi(): UseLiveSetAiResult {
  const [coverageCheck, setCoverageCheck] = useState<CallState<CoverageCheckResult>>(
    INITIAL as CallState<CoverageCheckResult>,
  );
  const [replanDay, setReplanDay] = useState<CallState<ReplanDayResult>>(
    INITIAL as CallState<ReplanDayResult>,
  );
  const [continuityCheck, setContinuityCheck] = useState<CallState<ContinuityCheckResult>>(
    INITIAL as CallState<ContinuityCheckResult>,
  );
  const [endOfDay, setEndOfDay] = useState<CallState<EndOfDayBrief>>(
    INITIAL as CallState<EndOfDayBrief>,
  );

  const makeRunner = <T,>(
    path: string,
    setState: React.Dispatch<React.SetStateAction<CallState<T>>>,
  ) =>
    async (body: unknown): Promise<void> => {
      setState({ status: 'loading', data: null, error: null });
      try {
        const data = await postJson<T>(path, body);
        setState({ status: 'ready', data, error: null });
      } catch (err) {
        setState({ status: 'error', data: null, error: (err as Error).message });
      }
    };

  const runCoverageCheck = useCallback(
    makeRunner<CoverageCheckResult>('/api/live-set/ai/coverage-check', setCoverageCheck),
    [],
  );
  const runReplanDay = useCallback(
    makeRunner<ReplanDayResult>('/api/live-set/ai/replan-day', setReplanDay),
    [],
  );
  const runContinuityCheck = useCallback(
    makeRunner<ContinuityCheckResult>('/api/live-set/ai/continuity-check', setContinuityCheck),
    [],
  );
  const runEndOfDay = useCallback(
    makeRunner<EndOfDayBrief>('/api/live-set/ai/end-of-day', setEndOfDay),
    [],
  );

  const reset = useCallback((action: LiveSetAiAction) => {
    if (action === 'coverage-check') setCoverageCheck(INITIAL as CallState<CoverageCheckResult>);
    else if (action === 'replan-day') setReplanDay(INITIAL as CallState<ReplanDayResult>);
    else if (action === 'continuity-check')
      setContinuityCheck(INITIAL as CallState<ContinuityCheckResult>);
    else if (action === 'end-of-day') setEndOfDay(INITIAL as CallState<EndOfDayBrief>);
  }, []);

  return {
    coverageCheck,
    replanDay,
    continuityCheck,
    endOfDay,
    runCoverageCheck,
    runReplanDay,
    runContinuityCheck,
    runEndOfDay,
    reset,
  };
}
