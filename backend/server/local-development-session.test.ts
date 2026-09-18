import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEV_LOCAL_ADMIN_SESSION_TOKEN,
  canUseLocalDevelopmentAdminSession,
  isLoopbackAddress,
} from "./local-development-session.js";

describe("local development admin session boundary", () => {
  it("accepts the known token only for a development request fully on loopback", () => {
    expect(
      canUseLocalDevelopmentAdminSession({
        environment: "development",
        explicitlyEnabled: true,
        sessionToken: DEV_LOCAL_ADMIN_SESSION_TOKEN,
        remoteAddress: "::ffff:127.0.0.1",
        host: "localhost:5000",
        origin: "http://localhost:5001",
        fetchSite: "same-origin",
      }),
    ).toBe(true);
    expect(
      canUseLocalDevelopmentAdminSession({
        environment: "development",
        explicitlyEnabled: "true",
        sessionToken: DEV_LOCAL_ADMIN_SESSION_TOKEN,
        remoteAddress: "::1",
        host: "[::1]:5000",
      }),
    ).toBe(true);
  });

  it.each([
    {
      name: "test environment",
      environment: "test",
      explicitlyEnabled: true,
      remoteAddress: "127.0.0.1",
      host: "localhost:5000",
    },
    {
      name: "production environment",
      environment: "production",
      explicitlyEnabled: true,
      remoteAddress: "127.0.0.1",
      host: "localhost:5000",
    },
    {
      name: "remote peer",
      environment: "development",
      explicitlyEnabled: true,
      remoteAddress: "203.0.113.10",
      host: "localhost:5000",
    },
    {
      name: "public preview host behind a local proxy",
      environment: "development",
      explicitlyEnabled: true,
      remoteAddress: "127.0.0.1",
      host: "preview.example.test",
    },
    {
      name: "missing explicit opt-in",
      environment: "development",
      explicitlyEnabled: false,
      remoteAddress: "127.0.0.1",
      host: "localhost:5000",
    },
  ])(
    "rejects the token for $name",
    ({ environment, explicitlyEnabled, remoteAddress, host }) => {
      expect(
        canUseLocalDevelopmentAdminSession({
          environment,
          explicitlyEnabled,
          sessionToken: DEV_LOCAL_ADMIN_SESSION_TOKEN,
          remoteAddress,
          host,
        }),
      ).toBe(false);
    },
  );

  it("rejects a forged token and malformed loopback-looking addresses", () => {
    expect(
      canUseLocalDevelopmentAdminSession({
        environment: "development",
        explicitlyEnabled: true,
        sessionToken: "forged",
        remoteAddress: "127.0.0.1",
        host: "localhost",
      }),
    ).toBe(false);
    expect(isLoopbackAddress("127.attacker.example")).toBe(false);
    expect(isLoopbackAddress("127.999.0.1")).toBe(false);
  });

  it("rejects LAN, rebound, and cross-site browser provenance behind a loopback proxy", () => {
    for (const provenance of [
      { origin: "http://192.168.1.20:5001", fetchSite: "same-origin" },
      { origin: "http://attacker.example:5001", fetchSite: "same-origin" },
      { origin: "null", fetchSite: "cross-site" },
      { origin: "http://localhost:5001", fetchSite: "cross-site" },
    ]) {
      expect(
        canUseLocalDevelopmentAdminSession({
          environment: "development",
          explicitlyEnabled: true,
          sessionToken: DEV_LOCAL_ADMIN_SESSION_TOKEN,
          remoteAddress: "127.0.0.1",
          host: "localhost:3003",
          ...provenance,
        }),
      ).toBe(false);
    }
  });

  it("does not allow query-string session tokens on Academy mutations", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const helperStart = source.indexOf("async function requireAcademySession(");
    const helperEnd = source.indexOf(
      "async function upsertAdminAccountUser(",
      helperStart,
    );
    const helperSource = source.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(-1);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helperSource).toContain("getActiveSessionFromRequest(req)");
    expect(helperSource).not.toContain("req.query");
    expect(helperSource).not.toContain("activeSessions.get(");
  });
});
