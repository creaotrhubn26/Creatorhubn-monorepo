import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInviteFromApprovedRequest } from "./prototype-tester-invites-routes.js";

const { sendTransactionalEmailMock, emailConfiguredMock } = vi.hoisted(() => ({
  sendTransactionalEmailMock: vi.fn(),
  emailConfiguredMock: vi.fn(() => true),
}));

vi.mock("./transactional-email-service.ts", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
  isTransactionalEmailConfigured: emailConfiguredMock,
}));

describe("prototype tester invitation delivery", () => {
  beforeEach(() => {
    sendTransactionalEmailMock.mockReset();
    sendTransactionalEmailMock.mockResolvedValue({
      sent: true,
      provider: "resend",
      reason: null,
      messageId: "resend-message-id",
      accepted: ["tester@example.com"],
      errorMessage: null,
    });
  });

  it("sends approval invitations through the centralized provider and records the journey", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT id, token FROM prototype_tester_invites")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO prototype_tester_invites")) {
        return {
          rows: [{ id: "invite-id", token: "generated-token" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const pool = { query };

    const result = await createInviteFromApprovedRequest(
      pool,
      "11111111-1111-4111-8111-111111111111",
      "tester@example.com",
      "Test Tester",
      "daniel-admin",
      [],
      "https://creatorhubn.com",
      "tester_all_access",
      [],
      1,
      "photographer",
      "Testbedriften AS",
    );

    expect(result).toMatchObject({
      id: "invite-id",
      reused: false,
      emailDelivery: {
        sent: true,
        provider: "resend",
        messageId: "resend-message-id",
      },
    });
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tester@example.com",
        replyTo: "daniel@creatorhubn.com",
        fromLabel: "CreatorHub",
        kind: "prototype_tester_invite",
        projectId: "11111111-1111-4111-8111-111111111111",
        sentByUserId: "daniel-admin",
      }),
    );
    const emailOptions = sendTransactionalEmailMock.mock.calls[0][0];
    expect(emailOptions.html).toContain("/track/click/");
    expect(emailOptions.text).toContain("/prototype-tester/accept-invite?token=");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("user_journey_status = 'invite_sent'"))).toBe(true);
  });

  it("does not resend an already active invitation", async () => {
    const query = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("SELECT id, token FROM prototype_tester_invites")) {
        return {
          rows: [{ id: "existing-id", token: "existing-token" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const result = await createInviteFromApprovedRequest(
      { query },
      "11111111-1111-4111-8111-111111111111",
      "tester@example.com",
      "Test Tester",
      null,
      [],
      "https://creatorhubn.com",
    );

    expect(result).toMatchObject({
      id: "existing-id",
      reused: true,
      emailDelivery: null,
    });
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });
});
