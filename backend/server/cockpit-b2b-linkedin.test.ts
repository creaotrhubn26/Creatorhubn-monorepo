import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveLinkedInOrg: vi.fn(),
  listLinkedInCompanies: vi.fn(),
  publishLinkedInPostWithAccessToken: vi.fn(),
}));

vi.mock("./linkedin-oauth-routes.js", () => ({
  resolveLinkedInOrg: mocks.resolveLinkedInOrg,
}));

vi.mock("./social-publisher-linkedin.js", () => ({
  listLinkedInCompanies: mocks.listLinkedInCompanies,
  publishLinkedInPostWithAccessToken: mocks.publishLinkedInPostWithAccessToken,
}));

import { setupCockpitB2BRoutes } from "./cockpit-b2b-routes.js";

const linkedInDraft = {
  id: "42",
  caption: "Nyhet fra The Role Room",
  hashtags: ["rekruttering", "#hr"],
  cta_text: "Les saken",
  cta_link: "https://theroleroom.com/innsikt",
  platform: "linkedin",
  status: "publishing",
};

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupCockpitB2BRoutes({
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
  vi.clearAllMocks();
  mocks.resolveLinkedInOrg.mockResolvedValue({
    accessToken: "server-side-secret",
    organizationUrn: "urn:li:organization:42",
    configId: "7f73068f-a8f1-4526-9ca6-270913303209",
    scopes: ["r_organization_admin", "w_organization_social"],
  });
  mocks.listLinkedInCompanies.mockResolvedValue([
    {
      urn: "urn:li:organization:42",
      id: "42",
      name: "The Role Room",
      role: "ADMINISTRATOR",
    },
  ]);
  mocks.publishLinkedInPostWithAccessToken.mockResolvedValue({
    ok: true,
    status: "published",
    externalPostId: "urn:li:share:123",
    permalink: "https://www.linkedin.com/feed/update/urn:li:share:123",
  });
});

describe("Cockpit LinkedIn publishing", () => {
  it("rejects an organization that is not an exact stored connection", async () => {
    mocks.resolveLinkedInOrg.mockResolvedValue(null);
    const query = vi.fn();
    const response = await request(createApp(query))
      .post("/api/admin-room/cockpit/linkedin/publish/42")
      .send({ organization_urn: "urn:li:organization:999" });

    expect(response.status).toBe(503);
    expect(mocks.resolveLinkedInOrg).toHaveBeenCalledWith(
      expect.anything(),
      "urn:li:organization:999",
    );
    expect(mocks.publishLinkedInPostWithAccessToken).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("claims once, publishes with the modern provider, and persists the result", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SET status = 'publishing'")) {
        return { rows: [linkedInDraft], rowCount: 1 };
      }
      if (sql.includes("SET status = 'published'")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await request(createApp(query))
      .post("/api/admin-room/cockpit/linkedin/publish/42")
      .send({
        organization_urn: "urn:li:organization:42",
        visibility: "PUBLIC",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      external_post_id: "urn:li:share:123",
    });
    expect(mocks.publishLinkedInPostWithAccessToken).toHaveBeenCalledWith({
      accessToken: "server-side-secret",
      authorUrn: "urn:li:organization:42",
      mediaKind: "link",
      caption: expect.stringContaining("#rekruttering #hr"),
      extras: {
        link: "https://theroleroom.com/innsikt",
        linkTitle: "Les saken",
      },
    });

    const claim = query.mock.calls.find(([sql]) =>
      String(sql).includes("SET status = 'publishing'"));
    expect(String(claim?.[0])).toContain("$1::bigint");
    expect(claim?.[1]).toEqual(["42"]);

    const persisted = query.mock.calls.find(([sql]) =>
      String(sql).includes("SET status = 'published'"));
    expect(persisted?.[1]).toEqual([
      "urn:li:share:123",
      "urn:li:share:123",
      "urn:li:organization:42",
      expect.any(String),
      "42",
    ]);
  });

  it("keeps the claim locked when a network failure makes the outcome uncertain", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SET status = 'publishing'")) {
        return { rows: [linkedInDraft], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    mocks.publishLinkedInPostWithAccessToken.mockResolvedValue({
      ok: false,
      status: "failed",
      reason: "network_error",
      error: "fetch failed",
    });

    const response = await request(createApp(query))
      .post("/api/admin-room/cockpit/linkedin/publish/42")
      .send({});

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      ok: false,
      status: "uncertain",
      reason: "network_error",
    });
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("SET status = 'failed'")),
    ).toBe(false);
  });

  it("does not dispatch when another request already owns the draft", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SET status = 'publishing'")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT platform, status")) {
        return {
          rows: [{ platform: "linkedin", status: "publishing" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query))
      .post("/api/admin-room/cockpit/linkedin/publish/42")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.status).toBe("publishing");
    expect(mocks.publishLinkedInPostWithAccessToken).not.toHaveBeenCalled();
  });
});
