import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupAdminConfigCheckRoutes } from "./admin-config-check-routes.js";
import { registerMarketplaceAppConfigRoutes } from "./marketplace-app-config-routes.js";

const persistedAdmin = {
  userId: "daniel-admin",
  email: "daniel@creatorhubn.com",
  name: "Daniel",
  role: "super_admin",
  loginAt: new Date().toISOString(),
};

describe("persisted admin-session route guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("awaits an asynchronously resolved session for the config status card", async () => {
    const app = express();
    const requireAdminSession = vi.fn().mockResolvedValue(persistedAdmin);
    const query = vi.fn().mockResolvedValue({ rows: [{ exists: true }] });
    setupAdminConfigCheckRoutes({ app, pool: { query }, requireAdminSession });

    const response = await request(app).get("/api/admin/config-check");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: expect.stringMatching(/^(ready|partial|broken)$/),
      checkedAt: expect.any(String),
    }));
    expect(requireAdminSession).toHaveBeenCalledOnce();
  });

  it("awaits an asynchronously resolved session for the Stripe status card", async () => {
    vi.stubEnv("CREATORHUB_STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_API_KEY", "");
    const app = express();
    const requireAdminSession = vi.fn().mockResolvedValue(persistedAdmin);
    registerMarketplaceAppConfigRoutes(app, { query: vi.fn() } as any, requireAdminSession);

    const response = await request(app).get("/api/admin/stripe/payment-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ configured: false }));
    expect(requireAdminSession).toHaveBeenCalledOnce();
  });
});
