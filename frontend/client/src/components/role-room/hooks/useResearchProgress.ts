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
import {
  roleRoomAgentDefaultHeaders,
  roleRoomAgentService,
} from '../services/roleRoomAgentService';
import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

export type ResearchStageKey =
  | 'brreg'
  | 'website'
  | 'googlePlacesBusiness'
  | 'googlePlacesCompetitors'
  | 'webCompetitors'
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

export interface ResearchMockupDraft {
  id: string;
  projectId: string;
  researchId: string;
  platform: "instagram" | "tiktok" | "linkedin";
  ordinal: number;
  feedPostId: string;
  mediaType: "image" | "carousel" | "reel";
  status: "building" | "ready" | "failed";
  stage: string | null;
  progress: number;
  title: string;
  caption: string;
  previewDataUrl: string | null;
  mockupProjectId: string | null;
  variantId: string | null;
  qualityStatus?: "ready" | "limited" | "failed";
  skillRuns?: Array<{
    id: string;
    version: string;
    status: "ready" | "limited" | "failed";
    executionKey: string;
    evidence: string[];
    limitations: string[];
  }>;
}

interface UseResearchProgressReturn {
  start: (input: ResearchProgressInput) => void;
  reset: () => void;
  stages: ResearchStage[];
  status: ResearchProgressStatus;
  result: RoleRoomAgentProducerBootstrapResult | null;
  error: string | null;
  mockups: ResearchMockupDraft[];
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
  const [mockups, setMockups] = useState<ResearchMockupDraft[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStages([]);
    setStatus('idle');
    setResult(null);
    setError(null);
    setMockups([]);
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
          throw new Error(`SSE handshake failed: ${response.status} ${text.slice(0, 200)}`,
            );
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let sawTerminalEvent = false;
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
              if (frame.event === "stage") {
                handleStageEvent(parsed);
              } else if (frame.event === "mockups") {
                const payload = parsed as { drafts?: ResearchMockupDraft[] };
                if (Array.isArray(payload?.drafts)) setMockups(payload.drafts);
              } else if (frame.event === "done") {
                sawTerminalEvent = true;
                const payload = parsed as {
                  success?: boolean;
                  result?: RoleRoomAgentProducerBootstrapResult;
                  researchMockups?: ResearchMockupDraft[];
                };
                if (payload?.success && payload.result) {
                  // Match the non-stream bootstrap contract before exposing
                  // done. Without this PUT the version history exists, but the
                  // project loses the result (including merch) after a reload.
                  await roleRoomAgentService.saveSnapshot(
                    input.projectId,
                    payload.result,
                  );
                  setResult(payload.result);
                  if (Array.isArray(payload.researchMockups))
                    setMockups(payload.researchMockups);
                  setStatus("done");
                } else {
                  setStatus("error");
                  setError("Bootstrap returnerte uten resultat");
                }
              } else if (frame.event === "error") {
                sawTerminalEvent = true;
                const payload = parsed as { error?: string };
                setError(payload?.error || "Ukjent feil under bootstrap");
                setStatus("error");
              }
            }
          }
          if (!sawTerminalEvent) {
            // Stream closed without explicit done event
            setStatus((curr) => (curr === "streaming" ? "error" : curr));
          }
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
          // Never replay the full bootstrap automatically. A proxy can return
          // 504 after the backend has already persisted the research version;
          // retrying through the non-stream endpoint created duplicate versions
          // for one click. The user may retry explicitly after the visible error.
          console.warn(
            "[useResearchProgress] SSE request failed without automatic replay:",
            err,
          );
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      })();
    },
    [reset],
  );

  return { start, reset, stages, status, result, error, mockups };
}
