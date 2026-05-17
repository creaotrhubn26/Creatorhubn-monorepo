/**
 * useResearchProgress — frontend EventSource wrapper for the backend's
 * /producer-bootstrap-stream SSE endpoint. Item #2 (live progress with
 * "tikker av" per stage).
 *
 * Usage:
 *   const { start, stages, status, result, error, reset } = useResearchProgress();
 *   start({ projectId, websiteUrl, ... });
 *   // -> stages: [{ key: 'brreg', status: 'done', ms: 423 }, ...]
 *   // -> status: 'streaming' | 'done' | 'error' | 'idle'
 *
 * Uses fetch with body, not EventSource (which is GET-only). The endpoint
 * is POST so we stream the response body and parse SSE frames manually.
 */

import { useCallback, useRef, useState } from 'react';
import roleRoomAgentService, { roleRoomAgentDefaultHeaders } from '../services/roleRoomAgentService';
import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

export type ResearchStageKey =
  | 'brreg'
  | 'website'
  | 'googlePlacesBusiness'
  | 'googlePlacesCompetitors'
  | 'googlePlacesLocal'
  | 'competitorAnalysis'
  | 'localPresence'
  | 'merchSuppliers'
  | 'metaPagesEnrichment'
  | 'colorExtraction'
  | 'claudeSynthesis'
  | 'openaiSynthesis';

export interface ResearchStage {
  key: ResearchStageKey;
  status: 'running' | 'done' | 'error';
  ms?: number;
  fallback?: string;
  error?: string;
}

export type ResearchProgressStatus = 'idle' | 'streaming' | 'done' | 'error';

interface UseResearchProgressReturn {
  start: (input: ResearchProgressInput) => void;
  reset: () => void;
  stages: ResearchStage[];
  status: ResearchProgressStatus;
  result: RoleRoomAgentProducerBootstrapResult | null;
  error: string | null;
}

export interface ResearchProgressInput {
  projectId: string;
  projectName?: string;
  websiteUrl?: string;
  organizationNumber?: string;
  companyName?: string;
  extraContext?: string;
}

/** Parse an SSE frame "event: x\ndata: {...}\n\n" into { event, data }.
 *  Returns null if the buffer doesn't contain a complete frame yet. */
function parseSseFrame(buffer: string): { event: string; data: string; rest: string } | null {
  const sep = buffer.indexOf('\n\n');
  if (sep < 0) return null;
  const frame = buffer.slice(0, sep);
  const rest = buffer.slice(sep + 2);
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join('\n'), rest };
}

export function useResearchProgress(): UseResearchProgressReturn {
  const [stages, setStages] = useState<ResearchStage[]>([]);
  const [status, setStatus] = useState<ResearchProgressStatus>('idle');
  const [result, setResult] = useState<RoleRoomAgentProducerBootstrapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStages([]);
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const start = useCallback((input: ResearchProgressInput) => {
    reset();
    setStatus('streaming');
    const controller = new AbortController();
    abortRef.current = controller;

    const handleStageEvent = (data: unknown): void => {
      if (!data || typeof data !== 'object') return;
      const evt = data as { type?: string; stage?: ResearchStageKey; ms?: number; fallback?: string; error?: string };
      const stageKey = evt.stage;
      if (!stageKey) return;
      setStages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.key === stageKey);
        if (evt.type === 'stage_start') {
          if (idx >= 0) next[idx] = { ...next[idx], status: 'running' };
          else next.push({ key: stageKey, status: 'running' });
        } else if (evt.type === 'stage_done') {
          const entry: ResearchStage = {
            key: stageKey,
            status: 'done',
            ms: evt.ms,
            fallback: evt.fallback,
          };
          if (idx >= 0) next[idx] = entry;
          else next.push(entry);
        } else if (evt.type === 'stage_error') {
          const entry: ResearchStage = {
            key: stageKey,
            status: 'error',
            ms: evt.ms,
            error: evt.error,
          };
          if (idx >= 0) next[idx] = entry;
          else next.push(entry);
        }
        return next;
      });
    };

    (async () => {
      try {
        const response = await fetch('/api/role-room/agent/producer-bootstrap-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...roleRoomAgentDefaultHeaders(),
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => '');
          throw new Error(`SSE handshake failed: ${response.status} ${text.slice(0, 200)}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          for (;;) {
            const frame = parseSseFrame(buffer);
            if (!frame) break;
            buffer = frame.rest;
            let parsed: unknown = null;
            try {
              parsed = frame.data ? JSON.parse(frame.data) : null;
            } catch {
              parsed = null;
            }
            if (frame.event === 'stage') {
              handleStageEvent(parsed);
            } else if (frame.event === 'done') {
              const payload = parsed as { success?: boolean; result?: RoleRoomAgentProducerBootstrapResult };
              if (payload?.success && payload.result) {
                setResult(payload.result);
                setStatus('done');
              } else {
                setStatus('error');
                setError('Bootstrap returnerte uten resultat');
              }
            } else if (frame.event === 'error') {
              const payload = parsed as { error?: string };
              setError(payload?.error || 'Ukjent feil under bootstrap');
              setStatus('error');
            }
          }
        }
        if (status !== 'done' && status !== 'error') {
          // Stream closed without explicit done event
          setStatus((curr) => (curr === 'streaming' ? 'error' : curr));
        }
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
        // SSE failed (proxy buffered, network, server 500). Fall back to
        // the regular non-streaming endpoint so the user still gets a
        // research result — they just won't see per-stage ticks. The
        // overlay will open as if everything went normally.
        console.warn('[useResearchProgress] SSE failed, falling back to non-streaming bootstrap:', err);
        try {
          const fallbackResult = await roleRoomAgentService.generateProducerBootstrap({
            projectId: input.projectId,
            projectName: input.projectName,
            websiteUrl: input.websiteUrl,
            organizationNumber: input.organizationNumber,
            companyName: input.companyName,
            extraContext: input.extraContext,
          });
          if (controller.signal.aborted) return;
          setResult(fallbackResult);
          setStatus('done');
          // Surface the SSE failure as a soft warning so devs/admins
          // know the proxy/server isn't streaming. UI doesn't show this
          // by default; visible in console + setError-aware components.
          setError(`Live progress utilgjengelig (fallback brukt): ${err instanceof Error ? err.message : String(err)}`);
        } catch (fallbackErr) {
          if (controller.signal.aborted) return;
          setError(fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
          setStatus('error');
        }
      }
    })();
  }, [reset, status]);

  return { start, reset, stages, status, result, error };
}
