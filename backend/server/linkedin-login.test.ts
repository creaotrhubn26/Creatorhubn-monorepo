import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  buildLinkedInAuthorizationUrl,
  exchangeLinkedInCodeForProfile,
  isLinkedInLoginState,
  createLinkedInLoginState,
  linkedInLoginEnabled,
  resolveOrCreateUserFromLinkedIn,
  splitDisplayName,
  type LinkedInLoginProfile,
} from "./linkedin-login";

vi.mock("bcrypt", () => ({ default: { hash: async () => "hashed-placeholder" } }));

type Handler = (params: unknown[]) => { rows: unknown[] } | Promise<{ rows: unknown[] }>;
type Route = [RegExp, Handler];

function fakePool(routes: Route[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, handler] of routes) {
      if (re.test(sql)) return handler(params);
    }
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) return { rows: [] };
    throw new Error(`Unhandled SQL in test: ${sql.slice(0, 80)}`);
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls, sqlOf: (re: RegExp) => calls.filter((c) => re.test(c.sql)) };
}

const profile = (over: Partial<LinkedInLoginProfile> = {}): LinkedInLoginProfile => ({
  sub: "li-sub-1",
  email: "kari@example.com",
  emailVerified: true,
  name: "Kari Nordmann",
  givenName: "Kari",
  familyName: "Nordmann",
  picture: "https://media.licdn.com/pic.jpg",
  locale: "nb_NO",
  raw: { sub: "li-sub-1" },
  ...over,
});

const userRow = (over: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "kari@example.com",
  role: "member",
  is_active: true,
  first_name: "Kari",
  last_name: "Nordmann",
  profile_image_url: null,
  ...over,
});

const noIdentity: Route = [/FROM user_auth_identities/, () => ({ rows: [] })];
const noConnection: Route = [/FROM role_room_linkedin_connections/, () => ({ rows: [] })];
const identityUpsert: Route = [/INSERT INTO user_auth_identities/, () => ({ rows: [] })];
const hasOrg: Route = [/FROM organization_members/, () => ({ rows: [{ id: "org-1" }] })];

describe("state + url helpers", () => {
  it("creates prefixed states that the forwarder recognises", () => {
    const state = createLinkedInLoginState();
    expect(isLinkedInLoginState(state)).toBe(true);
    expect(isLinkedInLoginState("chg_abc")).toBe(false);
    expect(isLinkedInLoginState(undefined)).toBe(false);
  });

  it("asks only for the OpenID login scopes", () => {
    const url = new URL(buildLinkedInAuthorizationUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "lgn_x" }));
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("is on unless the flag says off", () => {
    expect(linkedInLoginEnabled({})).toBe(true);
    expect(linkedInLoginEnabled({ LINKEDIN_LOGIN_ENABLED: "OFF" })).toBe(false);
  });

  it("splits display names", () => {
    expect(splitDisplayName("Kari Nordmann Hansen")).toEqual({ first: "Kari", last: "Nordmann Hansen" });
    expect(splitDisplayName(null)).toEqual({ first: null, last: null });
  });
});

describe("exchangeLinkedInCodeForProfile", () => {
  it("exchanges the code and maps userinfo claims", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 100 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "abc", email: "Kari@Example.com", email_verified: true, name: "Kari Nordmann",
          given_name: "Kari", family_name: "Nordmann", picture: "https://media/pic.jpg", locale: { country: "NO", language: "nb" },
        }),
      });
    const result = await exchangeLinkedInCodeForProfile(
      { code: "code-1", clientId: "cid", clientSecret: "sec", redirectUri: "https://x/cb" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toMatchObject({
      sub: "abc", email: "kari@example.com", emailVerified: true, givenName: "Kari", familyName: "Nordmann", locale: "nb",
    });
    const tokenCall = fetchImpl.mock.calls[0];
    expect(String(tokenCall[0])).toContain("/oauth/v2/accessToken");
    expect(String(tokenCall[1].body)).toContain("redirect_uri=https%3A%2F%2Fx%2Fcb");
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe("Bearer tok");
  });

  it("surfaces LinkedIn's error description when the exchange fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false, json: async () => ({ error: "invalid_grant", error_description: "Koden er brukt" }),
    });
    const result = await exchangeLinkedInCodeForProfile(
      { code: "x", clientId: "c", clientSecret: "s", redirectUri: "r" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ ok: false, reason: "token_exchange_failed", message: "Koden er brukt" });
  });
});

describe("resolveOrCreateUserFromLinkedIn", () => {
  it("prefers the stored identity over e-mail and only fills empty profile fields", async () => {
    const { pool, sqlOf } = fakePool([
      [/FROM user_auth_identities/, () => ({ rows: [{ user_id: "user-1" }] })],
      [/FROM users u WHERE u\.id/, () => ({ rows: [userRow({ first_name: "Karianne", last_name: "", email: "old@example.com" })] })],
      [/UPDATE users u/, (params) => ({
        rows: [userRow({ first_name: "Karianne", last_name: params[2] as string, email: "old@example.com" })],
      })],
      identityUpsert,
      hasOrg,
    ]);
    const result = await resolveOrCreateUserFromLinkedIn(pool, profile({ email: "new@example.com" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.matchedBy).toBe("identity");
    expect(result.user.email).toBe("old@example.com");
    expect(result.user.name).toBe("Karianne Nordmann");
    expect(sqlOf(/LOWER\(u\.email\)/)).toHaveLength(0);
    const update = sqlOf(/UPDATE users u/)[0];
    expect(update.sql).toContain("COALESCE(NULLIF(u.first_name, ''), $2)");
    expect(update.params).toEqual(["user-1", "Kari", "Nordmann"]);
    expect(sqlOf(/INSERT INTO user_auth_identities/)[0].params.slice(0, 5)).toEqual([
      "user-1", "linkedin", "li-sub-1", "new@example.com", true,
    ]);
  });

  it("falls back to an existing publishing connection before e-mail", async () => {
    const { pool } = fakePool([
      noIdentity,
      [/FROM role_room_linkedin_connections/, () => ({ rows: [{ user_id: "user-7" }] })],
      [/FROM users u WHERE u\.id/, () => ({ rows: [userRow({ id: "user-7" })] })],
      [/UPDATE users u/, () => ({ rows: [userRow({ id: "user-7" })] })],
      identityUpsert,
      hasOrg,
    ]);
    const result = await resolveOrCreateUserFromLinkedIn(pool, profile({ emailVerified: false }));
    expect(result.ok && result.user.matchedBy).toBe("connection");
  });

  it("matches on e-mail only when LinkedIn says it is verified", async () => {
    const routes: Route[] = [
      noIdentity,
      noConnection,
      [/LOWER\(u\.email\)/, () => ({ rows: [userRow()] })],
      [/UPDATE users u/, () => ({ rows: [userRow()] })],
      identityUpsert,
      hasOrg,
    ];
    const verified = await resolveOrCreateUserFromLinkedIn(fakePool(routes).pool, profile());
    expect(verified.ok && verified.user.matchedBy).toBe("email");

    const unverified = fakePool(routes);
    const rejected = await resolveOrCreateUserFromLinkedIn(unverified.pool, profile({ emailVerified: false }));
    expect(rejected).toMatchObject({ ok: false, reason: "email_not_verified" });
    expect(unverified.sqlOf(/LOWER\(u\.email\)/)).toHaveLength(0);
    expect(unverified.sqlOf(/^ROLLBACK$/)).toHaveLength(1);
  });

  it("rejects deactivated accounts", async () => {
    const { pool } = fakePool([
      noIdentity,
      noConnection,
      [/LOWER\(u\.email\)/, () => ({ rows: [userRow({ is_active: false })] })],
    ]);
    const result = await resolveOrCreateUserFromLinkedIn(pool, profile());
    expect(result).toMatchObject({ ok: false, reason: "account_inactive" });
  });

  it("creates a member with a solo organisation and imports the picture into R2", async () => {
    const { pool, sqlOf } = fakePool([
      noIdentity,
      noConnection,
      [/LOWER\(u\.email\)/, () => ({ rows: [] })],
      [/INSERT INTO users/, (params) => ({
        rows: [userRow({ id: params[0] as string, first_name: params[4], last_name: params[5] })],
      })],
      identityUpsert,
      [/FROM organization_members/, () => ({ rows: [] })],
      [/INSERT INTO organizations/, () => ({ rows: [{ id: "org-new" }] })],
      [/INSERT INTO organization_members/, () => ({ rows: [] })],
      [/UPDATE users SET profile_image_url/, (params) => ({ rows: [{ id: params[1] }] })],
    ]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) });
    const uploadImage = vi.fn(async (_buf: Buffer, _mime: string, key: string) => `https://cdn.example/${key}`);

    const result = await resolveOrCreateUserFromLinkedIn(pool, profile(), {
      uploadImage,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({ isNew: true, matchedBy: "created", role: "member", organizationId: "org-new" });

    const insert = sqlOf(/INSERT INTO users/)[0];
    expect(insert.params.slice(1, 4)).toEqual(["kari@example.com", "kari@example.com", "hashed-placeholder"]);
    expect(insert.params.slice(4)).toEqual(["Kari", "Nordmann"]);

    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(uploadImage.mock.calls[0][1]).toBe("image/jpeg");
    expect(uploadImage.mock.calls[0][2]).toMatch(new RegExp(`^leadgrid/profile-images/${result.user.userId}/[a-f0-9]{16}\\.jpg$`));
    expect(result.user.picture).toBe(`https://cdn.example/${uploadImage.mock.calls[0][2]}`);
    expect(sqlOf(/UPDATE users SET profile_image_url/)[0].sql).toContain("COALESCE(profile_image_url, '') = ''");
  });

  it("keeps an existing avatar and still logs in when the picture download fails", async () => {
    const withAvatar = fakePool([
      noIdentity, noConnection,
      [/LOWER\(u\.email\)/, () => ({ rows: [userRow({ profile_image_url: "https://cdn/own.jpg" })] })],
      [/UPDATE users u/, () => ({ rows: [userRow({ profile_image_url: "https://cdn/own.jpg" })] })],
      identityUpsert, hasOrg,
    ]);
    const uploadImage = vi.fn();
    const kept = await resolveOrCreateUserFromLinkedIn(withAvatar.pool, profile(), { uploadImage, fetchImpl: vi.fn() as unknown as typeof fetch });
    expect(kept.ok && kept.user.picture).toBe("https://cdn/own.jpg");
    expect(uploadImage).not.toHaveBeenCalled();

    const noAvatar = fakePool([
      noIdentity, noConnection,
      [/LOWER\(u\.email\)/, () => ({ rows: [userRow()] })],
      [/UPDATE users u/, () => ({ rows: [userRow()] })],
      identityUpsert, hasOrg,
    ]);
    const failingFetch = vi.fn().mockRejectedValue(new Error("network"));
    const result = await resolveOrCreateUserFromLinkedIn(noAvatar.pool, profile(), { uploadImage, fetchImpl: failingFetch as unknown as typeof fetch });
    expect(result.ok && result.user.picture).toBeNull();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(noAvatar.sqlOf(/UPDATE users SET profile_image_url/)).toHaveLength(0);
  });
});
