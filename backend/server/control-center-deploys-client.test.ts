import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAllDeploys,
  getDeployProviderStatus,
  normalizeNetlifyStatus,
} from "./control-center-deploys-client.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Netlify deploy normalization", () => {
  it.each([
    ["ready", false, "live"],
    ["building", false, "building"],
    ["pending_review", false, "building"],
    ["error", false, "failed"],
    ["rejected", false, "failed"],
    ["ready", true, "canceled"],
    ["future_state", false, "unknown"],
  ] as const)("maps %s (skipped=%s) to %s", (state, skipped, expected) => {
    expect(normalizeNetlifyStatus(state, skipped)).toBe(expected);
  });

  it("maps the public deploy feed to the shared Control Center contract", async () => {
    vi.stubEnv("RENDER_API_KEY", "");
    vi.stubEnv("RENDER_SERVICE_ID", "");
    vi.stubEnv("GITHUB_DEPLOY_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_REPO", "");

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toContain(
        "/api/v1/sites/creatorhub-frontend-mig.netlify.app/deploys?per_page=3",
      );
      return new Response(JSON.stringify([
        {
          id: "deploy-123",
          state: "ready",
          name: "creatorhub-frontend-mig",
          admin_url: "https://app.netlify.com/sites/creatorhub-frontend-mig",
          created_at: "2026-08-30T10:00:00.000Z",
          published_at: "2026-08-30T10:03:00.000Z",
          branch: "main",
          commit_ref: "0123456789abcdef",
          title: "Netlify-only hosting",
          context: "production",
        },
        {
          id: "deploy/unsafe",
          state: "error",
          admin_url: "javascript:alert(1)",
          review_url: "https://attacker.example/deploy",
          deploy_ssl_url: "data:text/html,unsafe",
          created_at: "2026-08-29T10:00:00.000Z",
        },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllDeploys(3);

    expect(result.providers).toEqual({ render: false, github: false, netlify: true });
    expect(result.deploys).toHaveLength(2);
    expect(result.deploys[0]).toEqual(expect.objectContaining({
      provider: "netlify",
      id: "deploy-123",
      status: "live",
      branch: "main",
      commit: "0123456",
      url: "https://app.netlify.com/sites/creatorhub-frontend-mig/deploys/deploy-123",
    }));
    expect(result.deploys[1]).toEqual(expect.objectContaining({
      id: "deploy/unsafe",
      status: "failed",
      url: null,
    }));
    expect(getDeployProviderStatus().netlify).toBe(true);
  });
});
