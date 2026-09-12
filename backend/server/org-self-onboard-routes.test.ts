import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkoutCreateMock,
  customerCreateMock,
  sendTransactionalEmailMock,
} = vi.hoisted(() => ({
  checkoutCreateMock: vi.fn(),
  customerCreateMock: vi.fn(),
  sendTransactionalEmailMock: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    customers = { create: customerCreateMock };
    checkout = { sessions: { create: checkoutCreateMock } };
  },
}));

vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("./admin-notify.js", () => ({
  notifyAdmins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lead-brreg-service.js", () => ({
  lookupCompanyForNewLead: vi.fn(),
}));

import { registerOrgSelfOnboardRoutes } from "./org-self-onboard-routes.js";

describe("Leadgrid self-onboard", () => {
  beforeEach(() => {
    vi.stubEnv("CREATORHUB_STRIPE_SECRET_KEY", "sk_test_self_onboard");
    checkoutCreateMock.mockReset();
    customerCreateMock.mockReset().mockResolvedValue({ id: "cus_leadgrid" });
    sendTransactionalEmailMock.mockReset().mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the organization Stripe customer but never Checkout for Solo Free", async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM organization_setup_templates")) {
        return { rows: [{ template_key: "solo", default_plan: "free" }] };
      }
      if (sql.includes("FROM users u")) return { rows: [] };
      if (sql.includes("INSERT INTO organizations")) return { rows: [{ id: "org-free" }] };
      return { rows: [] };
    });
    const poolQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM plan_limits")) {
        return { rows: [{ stripe_price_id_monthly: null }] };
      }
      return { rows: [] };
    });
    const app = express();
    app.use(express.json());
    registerOrgSelfOnboardRoutes({
      app,
      pool: {
        connect: vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() }),
        query: poolQuery,
      } as never,
    });

    const response = await request(app)
      .post("/api/leadgrid/self-onboard")
      .send({ email: "new@example.test", orgName: "New Org", templateKey: "solo" });

    expect(response.status).toBe(201);
    expect(response.body.checkout_url).toBeNull();
    expect(customerCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ organization_id: "org-free" }),
    }));
    expect(checkoutCreateMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "new@example.test",
      html: expect.stringContaining("https://leadgrid.no/reset-passord/"),
    }));
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO password_reset_tokens"),
      expect.arrayContaining(["new@example.test"]),
    );
  });
});
