import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupLinkedInOAuthRoutes } from "./linkedin-oauth-routes.js";

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupLinkedInOAuthRoutes({
    app,
    pool: { query } as never,
    getActiveSession: () => ({
      userId: "admin-1",
      email: "admin@theroleroom.com",
    }),
    isAdminEmail: () => true,
  });
  return app;
}

beforeEach(() => {
  vi.stubEnv("LINKEDIN_CLIENT_ID", "client-id");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "client-secret");
  vi.stubEnv("ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY", "test-encryption-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Cockpit LinkedIn OAuth", () => {
  it("starts only through POST and requests all publishing scopes", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const app = createApp(query);

    const getResponse = await request(app)
      .get("/api/admin-room/cockpit/linkedin/oauth-start");
    expect(getResponse.status).toBe(404);

    const response = await request(app)
      .post("/api/admin-room/cockpit/linkedin/oauth-start")
      .send({});
    expect(response.status).toBe(200);

    const authorizationUrl = new URL(response.body.redirect_url);
    expect(authorizationUrl.origin).toBe("https://www.linkedin.com");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "https://theroleroom.com/api/admin-room/cockpit/linkedin/oauth-callback",
    );
    expect(
      new Set((authorizationUrl.searchParams.get("scope") ?? "").split(" ")),
    ).toEqual(new Set([
      "openid",
      "profile",
      "email",
      "w_member_social",
      "r_organization_admin",
      "w_organization_social",
    ]));
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("consumes state even when the member rejects consent", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ user_id: "admin-1" }],
      rowCount: 1,
    });
    const response = await request(createApp(query))
      .get("/api/admin-room/cockpit/linkedin/oauth-callback")
      .query({ state: "one-time-state", error: "user_cancelled_authorize" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain(
      "linkedin=error&reason=user_cancelled_authorize",
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "DELETE FROM linkedin_oauth_states",
    );
  });

  it("never exposes the stored access token in status", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: "config-1",
        organization_urn: "urn:li:organization:42",
        vanity_name: "the-role-room",
        display_name: "The Role Room",
        org_type: "company",
        parent_display_name: null,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        is_default: true,
        last_publish_at: null,
        last_error: null,
        last_error_at: null,
        scopes: ["r_organization_admin", "w_organization_social"],
        access_token: "must-not-leak",
      }],
      rowCount: 1,
    });

    const response = await request(createApp(query))
      .get("/api/admin-room/cockpit/linkedin/status");

    expect(response.status).toBe(200);
    expect(response.body.connections[0]).toMatchObject({
      organization_urn: "urn:li:organization:42",
      publish_ready: true,
      reconnect_required: false,
    });
    expect(JSON.stringify(response.body)).not.toContain("must-not-leak");
    expect(response.body.connections[0].access_token).toBeUndefined();
  });
});
