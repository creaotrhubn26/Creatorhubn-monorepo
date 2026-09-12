import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const emailMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: emailMocks.send,
}));

import { notifyClient } from "./client-notification-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

beforeEach(() => {
  vi.clearAllMocks();
  emailMocks.send.mockResolvedValue({
    sent: true,
    reason: null,
    provider: "resend",
    messageId: "message-1",
    accepted: ["kunde@dentum.no"],
    errorMessage: null,
  });
});

describe("Leadgrid client notification project scope", () => {
  it("scopes recipient and branding lookup and logs email with the project", async () => {
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM client_notification_prefs prefs")) {
        expect(sql).toContain("customer.organization_id::text = $2");
        expect(sql).toContain("customer.project_id = $3");
        expect(params).toEqual([customerId, organizationId, projectId]);
        return {
          rows: [{
            contact_name: "Dentum",
            contact_email: "kunde@dentum.no",
            contact_phone: null,
            notify_email: true,
            notify_sms: false,
            notify_whatsapp: false,
            notify_deliverable_completed: true,
            notify_focus_request_received: true,
            notify_score_changed: false,
            notify_new_finding: true,
            notify_monthly_report: true,
            unsubscribed_at: null,
          }],
        };
      }
      if (sql.includes("LEFT JOIN leadgrid_email_branding_config")) {
        expect(sql).toContain("c.organization_id::text = $2");
        expect(sql).toContain("c.project_id = $3");
        expect(sql).not.toContain("casting_projects");
        expect(params).toEqual([customerId, organizationId, projectId]);
        return {
          rows: [{
            from_name: "Dentum rådgiver",
            from_email: "hei@leadgrid.no",
            reply_to_email: "radgiver@leadgrid.no",
            sender_full_name: "Rådgiver",
            sender_title: null,
            sender_phone: null,
            sender_email: null,
            brand_name: "Dentum rådgiver",
            brand_logo_url: null,
            brand_primary_color: "#a78bfa",
            brand_accent_color: "#9be15d",
            footer_html: null,
            footer_address: null,
            custom_variables: {},
          }],
        };
      }
      if (sql.includes("INSERT INTO client_notification_log")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const pool = { query } as unknown as Pool;

    const result = await notifyClient(pool, {
      customerId,
      organizationId,
      projectId,
      event: "deliverable_completed",
      deliverableTitle: "Lokal SEO",
      portalToken: "secret/token",
    });

    expect(result).toEqual({
      attempted: 1,
      sent: 1,
      channels: ["email"],
    });
    expect(emailMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialScope: "creatorhub",
        kind: "leadgrid_client_notification",
        projectId,
        pool,
        fromAddress: "hei@leadgrid.no",
      }),
    );
    const email = emailMocks.send.mock.calls[0][0];
    expect(email.html).toContain("https://leadgrid.no/c/secret%2Ftoken");
    expect(email.html).not.toContain("theroleroom.com");
  });

  it("rejects half-scoped internal calls", async () => {
    await expect(
      notifyClient({ query: vi.fn() } as unknown as Pool, {
        customerId,
        organizationId,
        event: "new_finding",
      }),
    ).rejects.toThrow("organizationId og projectId må oppgis sammen");
  });
});
