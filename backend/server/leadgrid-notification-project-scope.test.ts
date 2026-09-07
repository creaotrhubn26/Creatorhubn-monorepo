import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const delivery = vi.hoisted(() => ({
  email: vi.fn(async () => ({ sent: false })),
  apns: vi.fn(async () => ({ sent: false, shouldDisableToken: false })),
}));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: delivery.email,
}));
vi.mock("./lead-map-apns-client.js", () => ({ sendAPNs: delivery.apns }));

import {
  leadgridLeadDeepLink,
  notifyApproachingLead,
} from "./lead-map-notification-service.js";
import { notifyAssignment } from "./lead-assignment-notification-service.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const userId = "seller-1";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LEADGRID_PUBLIC_URL = "https://leadgrid.no";
});

describe("Leadgrid notification project scope", () => {
  it("builds a Leadgrid-only deep link carrying both project and lead", () => {
    const url = new URL(leadgridLeadDeepLink("Dentum vest", leadId));
    expect(url.origin).toBe("https://leadgrid.no");
    expect(url.pathname).toBe("/admin-room");
    expect(url.searchParams.get("projectId")).toBe("Dentum vest");
    expect(url.searchParams.get("lead")).toBe(leadId);
    expect(url.href).not.toContain("theroleroom.com");
  });

  it("distinguishes an existing lead assigned to another user without dispatch", async () => {
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      expect(sql).toContain("project.organization_id = c.organization_id");
      expect(params).toEqual([leadId]);
      return {
        rows: [{
          name: "Dentum klinikk",
          address: "Oslo",
          assigned_user_id: "another-user",
          organization_id: organizationId,
          project_id: projectId,
        }],
        rowCount: 1,
      };
    });

    const result = await notifyApproachingLead(
      { query } as unknown as Pool,
      { leadId, userId, distanceMeters: 100 },
    );

    expect(result).toEqual({
      sent: false,
      suppressed: false,
      reason: "not_assigned_to_user",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("throttles and persists approaching notifications in the exact tuple", async () => {
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes("FROM crm_customers c")) {
        return {
          rows: [{
            name: "Dentum klinikk",
            address: "Oslo",
            assigned_user_id: userId,
            organization_id: organizationId,
            project_id: projectId,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("SELECT COUNT(*)::int AS n")) {
        expect(sql).toContain("organization_id = $2::uuid");
        expect(sql).toContain("project_id = $3");
        expect(params).toEqual([userId, organizationId, projectId, leadId]);
        return { rows: [{ n: 0 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO notification_events")) {
        return {
          rows: [{ id: "44444444-4444-4444-8444-444444444444" }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM notification_preferences")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM notification_device_tokens")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT email, name FROM users")) {
        return { rows: [{ email: null, name: null }], rowCount: 1 };
      }
      if (sql.includes("UPDATE notification_events")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;

    const result = await notifyApproachingLead(pool, {
      leadId,
      userId,
      distanceMeters: 125,
    });

    expect(result).toEqual({ sent: true, suppressed: false });
    const insertCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO notification_events"),
    );
    expect(String(insertCall?.[0])).toContain(
      "recipient_user_id, organization_id, project_id, event_type",
    );
    expect(insertCall?.[1]?.slice(0, 4)).toEqual([
      userId,
      organizationId,
      projectId,
      "approaching_lead",
    ]);
    const deepLink = String(insertCall?.[1]?.[9]);
    expect(deepLink).toContain("https://leadgrid.no/admin-room?");
    expect(deepLink).toContain(`projectId=${projectId}`);
    expect(deepLink).not.toContain("theroleroom.com");
    const deliveryUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes("SET email_sent = $2"),
    );
    expect(String(deliveryUpdate?.[0])).toContain("project_id = $6");
    expect(deliveryUpdate?.[1]?.slice(-2)).toEqual([organizationId, projectId]);
  });

  it("derives assignment scope from the customer and ignores a Role Room link", async () => {
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes("SELECT customer.project_id::text")) {
        expect(sql).toContain("customer.organization_id = $2::uuid");
        expect(sql).toContain("project.organization_id = customer.organization_id");
        expect(params).toEqual([leadId, organizationId]);
        return { rows: [{ project_id: projectId }], rowCount: 1 };
      }
      if (sql.includes("FROM users user_row")) {
        expect(sql).toContain("member.organization_id = $2::uuid");
        return {
          rows: [{
            first_name: "Ada",
            last_name: "Selger",
            email: null,
            phone: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM user_lead_notification_prefs")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO notification_events")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM notification_device_tokens")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;

    const result = await notifyAssignment(pool, {
      recipientUserId: userId,
      organizationId,
      eventType: "lead_assigned_as_rep",
      customerId: leadId,
      customerName: "Dentum klinikk",
      triggeredByUserId: "manager-1",
      deepLink: "https://theroleroom.com/admin-room?lead=wrong",
    });

    expect(result).toEqual({ in_app: true, email: false, whatsapp: false });
    const insertCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO notification_events"),
    );
    expect(String(insertCall?.[0])).toContain(
      "recipient_user_id, organization_id, project_id, event_type",
    );
    expect(insertCall?.[1]?.slice(0, 4)).toEqual([
      userId,
      organizationId,
      projectId,
      "lead_assigned_as_rep",
    ]);
    const deepLink = String(insertCall?.[1]?.[8]);
    expect(deepLink).toContain(`projectId=${projectId}`);
    expect(deepLink).not.toContain("theroleroom.com");
    expect(JSON.parse(String(insertCall?.[1]?.[9]))).toMatchObject({
      project_id: projectId,
    });
  });

  it("does not notify when customer and caller organization do not resolve", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));

    const result = await notifyAssignment(
      { query } as unknown as Pool,
      {
        recipientUserId: userId,
        organizationId,
        eventType: "lead_assigned_as_rep",
        customerId: leadId,
        customerName: "Dentum klinikk",
        triggeredByUserId: "manager-1",
      },
    );

    expect(result).toEqual({ in_app: false, email: false, whatsapp: false });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
