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

  // Hold contextProvider stable via ref så hook-konsumenter ikke må
  // memo'isere callbacken sin (vil ofte ha state-deps).
  const contextProviderRef = useRef(contextProvider);
  useEffect(() => {
    contextProviderRef.current = contextProvider;
  }, [contextProvider]);

  const addStep = useCallback(
    (s: Omit<ProgressStep, "id" | "timestamp" | "iterationId">) => {
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

  const start = useCallback(async () => {
    if (!goal.trim()) return;
    setRunning(true);
    setCompleted(false);
    setError(null);
    setSteps([]);
    stopRef.current = false;

    const ctx = contextProviderRef.current?.() ?? null;
    setLastContextSnapshot(ctx);
    const userContent = ctx ? `${ctx}\n\n---\n\n${goal.trim()}` : goal.trim();

    const messages: ClaudeMessage[] = [{ role: "user", content: userContent }];
    let iterations = 0;
    currentIterationRef.current = 0;

    try {
      while (iterations < MAX_ITERATIONS) {
        if (stopRef.current) break;
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
        });

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

      setCompleted(true);
      if (iterations >= MAX_ITERATIONS) {
        addStep({
          kind: "error",
          label: `Stoppet ved iterasjons-grense (${MAX_ITERATIONS})`,
          detail: "Øk MAX_ITERATIONS eller bryt målet i mindre biter.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addStep({ kind: "error", label: "Feil", detail: msg });
    } finally {
      setRunning(false);
    }
  }, [goal, systemPrompt, addStep]);

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
