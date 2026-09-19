/**
 * Bindingen mellom et Leadgrid-prosjekt og en annonsekonto.
 *
 * Tre ting kan gå galt her på måter som ikke feiler synlig, og som derfor
 * er testet: scopene må matche appen Google allerede har verifisert,
 * refresh_token må overleve en fornyelse, og en OAuth-state må ikke kunne
 * brukes to ganger eller bære prosjekt-id-en i klartekst.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import {
  LEADGRID_GOOGLE_SCOPES,
  byggGoogleAuthUrl,
  forbrukState,
  startAutorisasjon,
} from "./leadgrid-ads-connections";

const modul = readFileSync(join(__dirname, "leadgrid-ads-connections.ts"), "utf8");
const migrasjon = readFileSync(
  join(__dirname, "../migrations/0654_leadgrid_ads_connections.sql"),
  "utf8",
);
const byraaOauth = readFileSync(join(__dirname, "role-room-ads-oauth.ts"), "utf8");

describe("scopene", () => {
  it("er nøyaktig de samme som appen allerede ber om", () => {
    // Ber Leadgrid-flyten om et scope appen ikke er verifisert for, avviser
    // Google HELE autorisasjonen — ikke bare det ene scopet. Og et nytt
    // client_id ville måttet gjennom verifisering på nytt, som tar uker.
    const fraByraa = (byraaOauth.match(/https:\/\/www\.googleapis\.com\/auth\/[a-z.]+/g) ?? [])
      .filter((s) => !s.includes("userinfo") && !s.includes("openid"));
    for (const scope of LEADGRID_GOOGLE_SCOPES) {
      expect(fraByraa).toContain(scope);
    }
  });

  it("dekker både å lage og å publisere GTM-tagger", () => {
    // Uten publish kan vi lage tagger som aldri går live.
    expect(LEADGRID_GOOGLE_SCOPES).toContain("https://www.googleapis.com/auth/tagmanager.edit.containers");
    expect(LEADGRID_GOOGLE_SCOPES).toContain("https://www.googleapis.com/auth/tagmanager.publish");
  });
});

describe("byggGoogleAuthUrl", () => {
  it("ber om offline-tilgang og nytt samtykke", () => {
    // Uten access_type=offline og prompt=consent sender Google aldri et
    // refresh_token. Koblingen ville virket i én time og så dødd stille.
    process.env.GOOGLE_ADS_OAUTH_CLIENT_ID = "test-client";
    process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET = "test-secret";
    const url = byggGoogleAuthUrl({ state: "abc", redirectUri: "https://leadgrid.no/cb" });
    expect(url).toBeTruthy();
    const p = new URL(url!).searchParams;
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("state")).toBe("abc");
    expect(p.get("scope")?.split(" ").sort()).toEqual([...LEADGRID_GOOGLE_SCOPES].sort());
  });

  it("gir null i stedet for en halv URL når appen ikke er konfigurert", () => {
    const id = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
    expect(byggGoogleAuthUrl({ state: "a", redirectUri: "https://x/cb" })).toBeNull();
    process.env.GOOGLE_ADS_OAUTH_CLIENT_ID = id;
  });
});

describe("OAuth-state", () => {
  it("lagrer prosjektet server-side, ikke i state-parameteren", async () => {
    process.env.GOOGLE_ADS_OAUTH_CLIENT_ID = "test-client";
    process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET = "test-secret";
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const r = await startAutorisasjon({ query } as never, {
      organizationId: "11111111-1111-4111-8111-111111111111",
      projectId: "kunde-as",
      platform: "google",
      userId: "bruker-1",
      redirectUri: "https://leadgrid.no/cb",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Lå prosjekt-id-en i parameteren, kunne den endres underveis og en
    // Google-konto koblet til et annet prosjekt.
    expect(r.state).not.toContain("kunde-as");
    expect(new URL(r.authUrl).searchParams.get("state")).toBe(r.state);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("INSERT INTO leadgrid_ads_oauth_states");
    expect(params).toContain("kunde-as");
  });

  it("kan bare brukes én gang, og bare før den utløper", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const r = await forbrukState({ query } as never, "brukt-opp");
    expect(r).toEqual({ ok: false, error: "ukjent_eller_utlopt_state" });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("consumed_at IS NULL");
    expect(sql).toContain("expires_at > NOW()");
    expect(sql).toContain("SET consumed_at = NOW()");
  });
});

describe("lagring av tokens", () => {
  it("mister ikke refresh_token ved fornyelse", () => {
    // Google sender bare refresh_token ved FØRSTE samtykke. Overskrev vi med
    // NULL ved hver refresh, ville koblingen dødd en time senere.
    expect(modul).toContain("COALESCE(\n         EXCLUDED.refresh_token_encrypted,");
  });

  it("skriver aldri et token i klartekst", () => {
    expect(modul).toContain("encryptGoogleToken(opts.accessToken)");
    expect(modul).toContain("encryptGoogleToken(opts.refreshToken)");
    expect(migrasjon).toContain("access_token_encrypted");
    expect(migrasjon).not.toMatch(/access_token\s+TEXT/);
  });
});

describe("migrasjon 0654", () => {
  const sqlOnly = migrasjon
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");

  it("er Leadgrids egen tabell, ikke en peker inn i Role Rooms", () => {
    expect(sqlOnly).not.toMatch(/role_room/);
    expect(sqlOnly).not.toMatch(/producer_user_id/);
  });

  it("scoper koblingen på prosjekt, ikke på en person", () => {
    // Slettes brukeren som koblet til, skal koblingen bestå.
    expect(sqlOnly).toContain("connected_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL");
    expect(sqlOnly).toContain("uq_leadgrid_ads_connections_active");
  });

  it("holder OAuth-states kortlevde", () => {
    expect(sqlOnly).toContain("INTERVAL '15 minutes'");
  });
});
