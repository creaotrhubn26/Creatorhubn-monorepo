import { describe, expect, it, vi } from "vitest";
import { drainSalesManagementOutbox } from "./leadgrid-sales-management-outbox.js";

describe("Leadgrid sales-management outbox", () => {
  it("reclaims stale processing events and marks them delivered", async () => {
    const event = {
      id: "00000000-0000-0000-0000-000000000001",
      organization_id: "00000000-0000-0000-0000-000000000002",
      event_type: "sales_prize_awarded",
      payload: { title: "Premie", body: "Registrert" },
    };
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [event] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    expect(await drainSalesManagementOutbox(pool as never)).toBe(1);
    expect(String(client.query.mock.calls[1][0])).toContain("status = 'processing'");
    expect(String(client.query.mock.calls[1][0])).toContain("INTERVAL '5 minutes'");
    expect(String(pool.query.mock.calls[0][0])).toContain("status = 'delivered'");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("uses source_event_id to make notification delivery replay-safe", async () => {
    const event = {
      id: "00000000-0000-0000-0000-000000000001",
      organization_id: "00000000-0000-0000-0000-000000000002",
      event_type: "sales_approval_decided",
      payload: {
        recipientUserId: "seller-1",
        actorUserId: "manager-1",
        title: "Godkjent",
        body: "Avtalen er godkjent",
      },
    };
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [event] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await drainSalesManagementOutbox(pool as never);
    const notificationSql = String(pool.query.mock.calls[0][0]);
    expect(notificationSql).toContain("source_event_id");
    expect(notificationSql).toContain("ON CONFLICT (source_event_id) DO NOTHING");
    expect(pool.query.mock.calls[0][1]?.at(-1)).toBe(event.id);
  });
});
