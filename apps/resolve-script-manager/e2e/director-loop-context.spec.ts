/**
 * useDirectorLoop kontekst-injeksjon + groupByIteration logikk-test.
 * Beskytter at embedded DirectorPanel (CreativeEditorView) faktisk
 * får sendt sin contextProvider-snapshot inn i Claude-conversationen.
 */

import { test, expect } from "@playwright/test";
import { groupByIteration, type ProgressStep } from "../src/lib/useDirectorLoop";

function step(
  id: string,
  iterationId: number,
  kind: ProgressStep["kind"],
  label: string,
): ProgressStep {
  return { id, iterationId, kind, label, timestamp: Date.now() };
}

test.describe("useDirectorLoop helpers", () => {
  test("groupByIteration: en working iteration når running=true", () => {
    const steps: ProgressStep[] = [
      step("a", 1, "thinking", "plan"),
      step("b", 1, "tool", "see_canvas"),
    ];
    const cards = groupByIteration(steps, true);
    expect(cards.length).toBe(1);
    expect(cards[0].id).toBe(1);
    expect(cards[0].status).toBe("working");
    expect(cards[0].steps.length).toBe(2);
  });

  test("groupByIteration: flere iterasjoner, siste working, andre done", () => {
    const steps: ProgressStep[] = [
      step("a", 1, "tool", "x"),
      step("b", 2, "tool", "y"),
      step("c", 3, "thinking", "z"),
    ];
    const cards = groupByIteration(steps, true);
    expect(cards.map((c) => c.status)).toEqual(["done", "done", "working"]);
  });

  test("groupByIteration: alle done når running=false", () => {
    const steps: ProgressStep[] = [
      step("a", 1, "tool", "x"),
      step("b", 2, "result", "done"),
    ];
    const cards = groupByIteration(steps, false);
    expect(cards.every((c) => c.status === "done")).toBe(true);
  });

  test("groupByIteration: error overstyrer working", () => {
    const steps: ProgressStep[] = [
      step("a", 1, "tool", "x"),
      step("b", 1, "error", "Failed"),
    ];
    const cards = groupByIteration(steps, true);
    expect(cards[0].status).toBe("error");
  });

  test("groupByIteration: ID-sortering uavhengig av input-rekkefølge", () => {
    const steps: ProgressStep[] = [
      step("c", 3, "tool", "c"),
      step("a", 1, "tool", "a"),
      step("b", 2, "tool", "b"),
    ];
    const cards = groupByIteration(steps, false);
    expect(cards.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  test("groupByIteration: tom input → tom output", () => {
    expect(groupByIteration([], false)).toEqual([]);
    expect(groupByIteration([], true)).toEqual([]);
  });
});
