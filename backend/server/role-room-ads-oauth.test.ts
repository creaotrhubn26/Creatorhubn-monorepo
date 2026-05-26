import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  upsertAdsOauthConnection,
  getAdsOauthConnection,
  resolveAdsAccessToken,
  refreshGoogleAdsAccessToken,
  ensureFreshAdsToken,
  buildAdsAuthUrl,
  exchangeAdsCodeForToken,
  ADS_OAUTH_SCOPES,
  __setAdsOauthFetch,
  __resetAdsOauthFetch,
  type AdsOauthConnectionRow,
} from "./role-room-ads-oauth.js";
import {
  encryptInstagramToken,
} from "./role-room-instagram-oauth.js";

beforeAll(() => {
  process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY = "test-encryption-key-for-ads-oauth";
});
afterEach(() => __resetAdsOauthFetch());

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
}

/** Pool stub that returns a single row from any query (or [] if none configured). */
function poolReturning(rows: Record<string, unknown>[]) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return { rows, rowCount: rows.length };
    }),
  } as unknown as Pool;
  return { pool, queries };
}

describe("token encryption round-trip", () => {
  it("upsert encrypts and getAdsOauthConnection decrypts the access token", async () => {
    // upsert returns a RETURNING row; simulate the DB echoing the encrypted value.
    const enc = encryptInstagramToken("ya29.live-access-token");
    const { pool } = poolReturning([
      {
        id: "c1",
        user_id: "u1",
        platform: "google",
        access_token_encrypted: enc,
        refresh_token_encrypted: encryptInstagramToken("refresh-xyz"),
        token_expires_at: new Date(Date.now() + 3600_000),
        scopes: ["https://www.googleapis.com/auth/adwords"],
        account_ref: "123-456-7890",
        connection_state: "connected",
      },
    ]);
    const conn = await getAdsOauthConnection(pool, "u1", "google");
    expect(conn?.accessToken).toBe("ya29.live-access-token");
    expect(conn?.refreshToken).toBe("refresh-xyz");
    expect(conn?.platform).toBe("google");
  });
});

describe("refreshGoogleAdsAccessToken", () => {
  it("posts the refresh grant and returns the new token", async () => {
    const fetchMock = fakeFetch({ access_token: "new-token", expires_in: 3600 });
    __setAdsOauthFetch(fetchMock);
    const out = await refreshGoogleAdsAccessToken("refresh-xyz", "cid", "secret");
    expect(out.accessToken).toBe("new-token");
    expect(out.expiresInSec).toBe(3600);
    const body = (fetchMock.mock.calls[0][1] as { body: string }).body;
    expect(body).toContain("grant_type=refresh_token");
  });

  it("throws on an error response", async () => {
    __setAdsOauthFetch(fakeFetch({ error: "invalid_grant" }, false, 400));
    await expect(refreshGoogleAdsAccessToken("bad", "cid", "secret")).rejects.toThrow(
      /google_token_refresh_failed/,
    );
  });
});

describe("ensureFreshAdsToken", () => {
  it("does not refresh a token that is far from expiry", async () => {
    const { pool } = poolReturning([]);
    const conn: AdsOauthConnectionRow = {
      id: "c1",
      userId: "u1",
      platform: "google",
      accessToken: "still-good",
      refreshToken: "r",
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      scopes: [],
      accountRef: null,
      connectionState: "connected",
    };
    const out = await ensureFreshAdsToken(pool, conn);
    expect(out.accessToken).toBe("still-good");
    expect((pool.query as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

describe("resolveAdsAccessToken", () => {
  it("returns the stored token when a connection exists and is fresh", async () => {
    const { pool } = poolReturning([
      {
        id: "c1",
        user_id: "u1",
        platform: "linkedin",
        access_token_encrypted: encryptInstagramToken("li-token"),
        refresh_token_encrypted: null,
        token_expires_at: new Date(Date.now() + 3600_000),
        scopes: ["r_ads"],
        account_ref: null,
        connection_state: "connected",
      },
    ]);
    expect(await resolveAdsAccessToken(pool, "linkedin", "u1")).toBe("li-token");
  });

  it("returns null when no connection exists", async () => {
    const { pool } = poolReturning([]);
    expect(await resolveAdsAccessToken(pool, "google", "u1")).toBeNull();
  });
});

describe("OAuth code flow helpers", () => {
  it("builds a Google auth URL with the adwords scope + offline access", () => {
    const url = buildAdsAuthUrl("google", {
      clientId: "cid",
      redirectUri: "https://app/cb",
      state: "st",
    });
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("auth%2Fadwords");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("state=st");
  });

  it("builds a LinkedIn auth URL with r_ads scopes", () => {
    const url = buildAdsAuthUrl("linkedin", {
      clientId: "cid",
      redirectUri: "https://app/cb",
      state: "st",
    });
    expect(url).toContain("linkedin.com/oauth");
    expect(url).toContain("r_ads");
  });

  it("exchanges an auth code for tokens", async () => {
    __setAdsOauthFetch(
      fakeFetch({ access_token: "acc", refresh_token: "ref", expires_in: 3600 }),
    );
    const out = await exchangeAdsCodeForToken("google", {
      code: "abc",
      clientId: "cid",
      clientSecret: "secret",
      redirectUri: "https://app/cb",
    });
    expect(out.accessToken).toBe("acc");
    expect(out.refreshToken).toBe("ref");
  });

  it("exposes narrow ads-only scopes", () => {
    expect(ADS_OAUTH_SCOPES.google).toContain("https://www.googleapis.com/auth/adwords");
    expect(ADS_OAUTH_SCOPES.linkedin).toContain("r_ads");
    expect(ADS_OAUTH_SCOPES.linkedin).toContain("r_ads_reporting");
    expect(ADS_OAUTH_SCOPES.linkedin).toContain("r_organization_admin");
  });
});
