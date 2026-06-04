/**
 * useDirectorLoop — autonomous Claude tool-use-loop som driver
 * Multi-Agent Creative Director.
 *
 * Trekkes ut av MultiAgentDirectorDialog så samme logikken kan
 * brukes både fra modal (App-shell) og embedded panel
 * (CreativeEditorView). Embedded varianten kan injisere ekstra
 * kontekst (current pick, story-state) som blir prependet til
 * brukerens goal før loopen starter.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  claudeProxyService,
  type ClaudeMessage,
  type ClaudeContentBlock,
} from "../services/claudeProxyService";
import {
  PHOTOSHOP_TOOLS,
  runAllPhotoshopTools,
  extractToolUses,
} from "../agents/photoshopTools";

export const MAX_ITERATIONS = 30;

export type StepKind = "thinking" | "tool" | "result" | "error";

export interface ProgressStep {
  id: string;
  kind: StepKind;
  label: string;
  detail?: string;
  timestamp: number;
  iterationId: number;
}

export interface IterationCard {
  id: number;
  steps: ProgressStep[];
  status: "working" | "done" | "error";
}

export type ContextProvider = () => string | null;

export interface UseDirectorLoopOptions {
  systemPrompt: string;
  /** Returnerer ekstra kontekst (current pick, story-state) som
   *  prependes til goalen idet loopen starter. Kalles én gang per
   *  Start-click så snapshot er stabilt for hele loopen. */
  contextProvider?: ContextProvider;
}

export interface DirectorLoopHandle {
  goal: string;
  setGoal: (v: string) => void;
  steps: ProgressStep[];
  iterations: IterationCard[];
  running: boolean;
  completed: boolean;
  error: string | null;
  /** Snapshot av kontekst som ble brukt for siste/nåværende run.
   *  Nyttig for UI å vise hva som faktisk ble sendt til Claude. */
  lastContextSnapshot: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function groupByIteration(
  steps: ProgressStep[],
  running: boolean,
): IterationCard[] {
  const byIter = new Map<number, ProgressStep[]>();
  for (const s of steps) {
    if (!byIter.has(s.iterationId)) byIter.set(s.iterationId, []);
    byIter.get(s.iterationId)!.push(s);
  }
  const cards: IterationCard[] = [];
  const sortedIds = [...byIter.keys()].sort((a, b) => a - b);
  const lastIterId = sortedIds[sortedIds.length - 1];
  for (const id of sortedIds) {
    const iterSteps = byIter.get(id)!;
    const hasError = iterSteps.some((s) => s.kind === "error");
    const isLastAndRunning = running && id === lastIterId;
    const status: IterationCard["status"] = hasError
      ? "error"
      : isLastAndRunning
      ? "working"
      : "done";
    cards.push({ id, steps: iterSteps, status });
  }
  return cards;
}

export function useDirectorLoop({
  systemPrompt,
  contextProvider,
}: UseDirectorLoopOptions): DirectorLoopHandle {
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastContextSnapshot, setLastContextSnapshot] = useState<string | null>(null);
  const stopRef = useRef(false);
  const currentIterationRef = useRef(0);
  // AbortController for inflight fetch — settes ved Start, brukes av Stop
  // og unmount-cleanup. Garantert kun én controller per run.
  const abortControllerRef = useRef<AbortController | null>(null);
  // Guard mot setState etter unmount — React advarer ellers og evt minne-lekkasje.
  const mountedRef = useRef(true);
  // Holder seneste goal stabilt for stable `start`-identitet.
  const goalRef = useRef(goal);
  useEffect(() => {
    goalRef.current = goal;
  }, [goal]);

  // Cleanup på unmount: aborter inflight fetch + setter mounted=false
  // så pågående loop-iterasjoner kan se at de skal stoppe.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Hold contextProvider stable via ref så hook-konsumenter ikke må
  // memo'isere callbacken sin (vil ofte ha state-deps).
  const contextProviderRef = useRef(contextProvider);
  useEffect(() => {
    contextProviderRef.current = contextProvider;
  }, [contextProvider]);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  const addStep = useCallback(
    (s: Omit<ProgressStep, "id" | "timestamp" | "iterationId">) => {
      if (!mountedRef.current) return;
      setSteps((prev) => [
        ...prev,
        {
          ...s,
          iterationId: currentIterationRef.current,
          id: `${Date.now()}-${prev.length}`,
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  const stop = useCallback(() => {
    stopRef.current = true;
    abortControllerRef.current?.abort();
    addStep({ kind: "result", label: "Stoppet av bruker" });
  }, [addStep]);

  const reset = useCallback(() => {
    setCompleted(false);
    setSteps([]);
    setError(null);
    setLastContextSnapshot(null);
    stopRef.current = false;
    currentIterationRef.current = 0;
  }, []);

  // Tracker running via ref så start kan no-op uten å avhenge av
  // running-state (som ville gjort start ustabil mellom renders).
  const runningRef = useRef(false);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const currentGoal = goalRef.current;
    if (!currentGoal.trim()) return;
    runningRef.current = true;
    safeSet(setRunning, true);
    safeSet(setCompleted, false);
    safeSet(setError, null);
    safeSet(setSteps, [] as ProgressStep[]);
    stopRef.current = false;

    // Snapshot context inni try-catch så en knust provider ikke
    // dreper hele runen — vi logger og fortsetter uten context.
    let ctx: string | null = null;
    try {
      ctx = contextProviderRef.current?.() ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addStep({ kind: "error", label: "contextProvider feilet", detail: msg });
      ctx = null;
    }
    safeSet(setLastContextSnapshot, ctx);
    const userContent = ctx ? `${ctx}\n\n---\n\n${currentGoal.trim()}` : currentGoal.trim();

    const messages: ClaudeMessage[] = [{ role: "user", content: userContent }];
    let iterations = 0;
    currentIterationRef.current = 0;

    // Fresh AbortController per Start. Abort tidligere først for
    // safety (skulle ikke skje siden start blokkeres ved running).
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      while (iterations < MAX_ITERATIONS) {
        if (stopRef.current || !mountedRef.current) break;
        iterations += 1;
        currentIterationRef.current = iterations;

        addStep({
          kind: "thinking",
          label: `Iterasjon ${iterations}: Claude planlegger…`,
        });

        const response = await claudeProxyService.sendRaw({
          systemPrompt,
          messages,
          tools: PHOTOSHOP_TOOLS as never,
          maxTokens: 2000,
          signal: controller.signal,
        });

        if (stopRef.current || !mountedRef.current) break;

        for (const block of response.content) {
          if (block.type === "text" && block.text.trim()) {
            addStep({ kind: "result", label: "Claude", detail: block.text.trim() });
          }
        }

        const tools = extractToolUses(response.content);
        if (tools.length === 0) break;

        for (const t of tools) {
          addStep({
            kind: "tool",
            label: t.name,
            detail: JSON.stringify(t.input).slice(0, 200),
          });
        }

        const results = await runAllPhotoshopTools(
          response.content as unknown as ClaudeContentBlock[],
        );

        if (stopRef.current || !mountedRef.current) break;

        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: results.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
            is_error: r.is_error,
          })),
        });

        if (response.stop_reason === "end_turn") break;
      }

      safeSet(setCompleted, true);
      if (iterations >= MAX_ITERATIONS) {
        addStep({
          kind: "error",
          label: `Stoppet ved iterasjons-grense (${MAX_ITERATIONS})`,
          detail: "Øk MAX_ITERATIONS eller bryt målet i mindre biter.",
        });
      }
    } catch (err) {
      // AbortError fra Stop er ikke en feil — bare rolig avbrudd.
      const isAbort =
        err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) {
        const msg = err instanceof Error ? err.message : String(err);
        safeSet(setError, msg);
        addStep({ kind: "error", label: "Feil", detail: msg });
      }
    } finally {
      // Rydder kun hvis denne specific controller fortsatt er den
      // aktive (kan ha blitt overskrevet av en re-start).
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      runningRef.current = false;
      safeSet(setRunning, false);
    }
  }, [systemPrompt, addStep, safeSet]);

  const iterations = groupByIteration(steps, running);

  return {
    goal,
    setGoal,
    steps,
    iterations,
    running,
    completed,
    error,
    lastContextSnapshot,
    start,
    stop,
    reset,
  };
}
