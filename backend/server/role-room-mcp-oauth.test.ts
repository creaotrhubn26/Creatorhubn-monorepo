import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyPkceS256, oauthScopesToV1, OAUTH_TOKEN_PREFIX } from "./role-room-mcp-oauth.js";

describe("verifyPkceS256", () => {
  it("godtar korrekt S256-verifier", () => {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });
  it("avviser feil verifier og tomme verdier", () => {
    const challenge = crypto.createHash("sha256").update("riktig").digest("base64url");
    expect(verifyPkceS256("feil", challenge)).toBe(false);
    expect(verifyPkceS256("", challenge)).toBe(false);
    expect(verifyPkceS256("x", "")).toBe(false);
  });
});

describe("oauthScopesToV1 (OAuth-scope → v1-scope)", () => {
  it("default/mcp:read → projects.read", () => {
    expect(oauthScopesToV1(undefined)).toEqual(["projects.read"]);
    expect(oauthScopesToV1("mcp:read")).toEqual(["projects.read"]);
    expect(oauthScopesToV1("mcp")).toEqual(["projects.read"]);
  });
  it("mcp:write → projects.read + projects.write", () => {
    expect(oauthScopesToV1("mcp:write").sort()).toEqual(["projects.read", "projects.write"]);
    expect(oauthScopesToV1("mcp:read mcp:write").sort()).toEqual(["projects.read", "projects.write"]);
  });
});

describe("token-prefiks", () => {
  it("OAuth-token bruker rmt_-prefiks (skiller fra rri_)", () => {
    expect(OAUTH_TOKEN_PREFIX).toBe("rmt_");
  });
});
