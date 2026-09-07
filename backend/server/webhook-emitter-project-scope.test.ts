import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitWebhook } from "./webhook-emitter.js";

const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const subscriptionId = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  vi.unstubAllGlobals();
});

function makePool() {
  const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
    if (sql.includes("FROM webhook_event_types")) {
      return { rows: [{ event_key: "lead.scored" }], rowCount: 1 };
    }
    if (sql.includes("FROM leadgrid_webhook_subscriptions")) {
      return {
        rows: [{
          id: subscriptionId,
          url: "https://hooks.example.test/leadgrid",
          signing_secret: "secret",
          events: ["lead.scored"],
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE leadgrid_webhook_subscriptions")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO webhook_delivery_queue")) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`unexpected SQL: ${sql} ${JSON.stringify(params)}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("Leadgrid webhook project scope", () => {
  it("overwrites spoofed payload scope and persists retry scope", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { pool, query } = makePool();

    await emitWebhook(
      pool,
      "lead.scored",
      {
        lead_id: "11111111-1111-4111-8111-111111111111",
        organization_id: "spoofed-org",
        project_id: "spoofed-project",
      },
      organizationId,
      projectId,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const envelope = JSON.parse(String(request.body));
    expect(envelope.data).toMatchObject({
      organization_id: organizationId,
      project_id: projectId,
    });

    const retryCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO webhook_delivery_queue"),
    );
    expect(String(retryCall?.[0])).toContain(
      "subscription_id, organization_id, project_id, event_key",
    );
    expect(retryCall?.[1]?.slice(0, 4)).toEqual([
      subscriptionId,
      organizationId,
      projectId,
      "lead.scored",
    ]);
    expect(JSON.parse(String(retryCall?.[1]?.[4]))).toMatchObject({
      organization_id: organizationId,
      project_id: projectId,
    });
  });

  it("marks an explicitly workspace-wide delivery with null project scope", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { pool } = makePool();

    await emitWebhook(
      pool,
      "lead.scored",
      { project_id: "spoofed-project" },
      organizationId,
      null,
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const envelope = JSON.parse(String(request.body));
    expect(envelope.data).toMatchObject({
      organization_id: organizationId,
      project_id: null,
    });
  });
});
