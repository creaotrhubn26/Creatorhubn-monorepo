import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  normalizeUserEventsClientMetadata,
  readUserEventsAuthMetrics,
  recordUserEventsAuthConnection,
} from "./realtime-user-event-auth-metrics";

describe("realtime user-event auth observability", () => {
  it("accepts only fixed client kinds and short non-sensitive versions", () => {
    expect(
      normalizeUserEventsClientMetadata("capture-ios", "0.1.0+123"),
    ).toEqual({ clientKind: "capture-ios", clientVersion: "0.1.0+123" });
    expect(
      normalizeUserEventsClientMetadata("spoofed", "value with spaces"),
    ).toEqual({ clientKind: "unknown", clientVersion: null });
    expect(normalizeUserEventsClientMetadata("web", "x".repeat(65))).toEqual({
      clientKind: "web",
      clientVersion: null,
    });
  });

  it("records only method, fixed client kind and version", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const database = {
      query: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });
        return { rows: [] };
      },
    };

    await recordUserEventsAuthConnection(
      database as unknown as Pool,
      "ticket",
      { clientKind: "web", clientVersion: "abcdef1" },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].parameters).toEqual(["ticket", "web", "abcdef1"]);
    expect(calls[0].sql).not.toMatch(/user_id|ticket_hash|token/i);
  });

  it("aggregates a bounded observation window across backend instances", async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            auth_method: "ticket",
            client_kind: "web",
            connection_count: "12",
            last_seen_at: "2026-08-27T09:30:00.000Z",
            last_client_version: "abcdef1",
          },
          {
            auth_method: "ticket",
            client_kind: "capture-ios",
            connection_count: 3,
            last_seen_at: "2026-08-27T09:45:00.000Z",
            last_client_version: "0.1.0+123",
          },
          {
            auth_method: "legacy",
            client_kind: "unknown",
            connection_count: "1",
            last_seen_at: "2026-08-27T08:00:00.000Z",
            last_client_version: null,
          },
        ],
      }),
    };

    const report = await readUserEventsAuthMetrics(
      database as unknown as Pool,
      10_000,
      Date.parse("2026-08-27T10:00:00.000Z"),
    );

    expect(report.windowHours).toBe(720);
    expect(report.totals).toEqual({ ticket: 15, legacy: 1 });
    expect(report.clients).toHaveLength(3);
    expect(report.generatedAt).toBe("2026-08-27T10:00:00.000Z");
  });
});
