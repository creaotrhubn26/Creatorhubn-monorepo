import { describe, expect, it, vi } from "vitest";

import { recordAiUsage, sumUsage } from "./ai-usage.js";

const ORG = "11111111-2222-3333-4444-555555555555";

function poolWith(query: ReturnType<typeof vi.fn>) {
  return { query } as unknown as import("pg").Pool;
}

describe("sumUsage", () => {
  it("summerer og klipper negative verdier til 0", () => {
    expect(
      sumUsage([
        { inputTokens: 100, outputTokens: 50 },
        { inputTokens: 200, outputTokens: -5 },
      ]),
    ).toEqual({ inputTokens: 300, outputTokens: 50 });
  });

  it("tom liste gir null-forbruk", () => {
    expect(sumUsage([])).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe("recordAiUsage (kaster aldri)", () => {
  const event = {
    organizationId: ORG,
    provider: "anthropic",
    operation: "geo-probe",
    calls: 25,
    inputTokens: 12_000,
    outputTokens: 9_000,
  };

  it("skriver UPSERT-inkrement med riktige parametre", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    expect(await recordAiUsage(poolWith(query), event)).toBe(true);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT (organization_id, day, provider, operation)");
    expect(params).toEqual([ORG, "anthropic", "geo-probe", 25, 12_000, 9_000]);
  });

  it("DB-feil velter aldri kalleren — returnerer false", async () => {
    const query = vi.fn(async () => {
      throw new Error("connection reset");
    });
    expect(await recordAiUsage(poolWith(query), event)).toBe(false);
  });

  it("avviser ugyldig org-id og null kall uten DB-runde", async () => {
    const query = vi.fn();
    expect(await recordAiUsage(poolWith(query), { ...event, organizationId: "solo-user" })).toBe(false);
    expect(await recordAiUsage(poolWith(query), { ...event, calls: 0 })).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
