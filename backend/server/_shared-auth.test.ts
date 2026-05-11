import { describe, expect, it, vi } from "vitest";

import {
  parseAuthMode,
  requireScopedAccess,
} from "./_shared-auth.js";

describe("parseAuthMode", () => {
  it("returnerer log/enforce hvis gitt", () => {
    expect(parseAuthMode("log")).toBe("log");
    expect(parseAuthMode("enforce")).toBe("enforce");
  });

  it("default open ved ukjent eller missing", () => {
    expect(parseAuthMode(undefined)).toBe("open");
    expect(parseAuthMode("")).toBe("open");
    expect(parseAuthMode("garbage")).toBe("open");
  });
});

describe("requireScopedAccess — open mode", () => {
  const mkReq = () => ({ headers: {}, method: "POST", path: "/x" }) as any;
  const mkRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }) as any;

  it("proceed=true selv uten session", () => {
    const res = mkRes();
    const result = requireScopedAccess(mkReq(), res, {
      authMode: "open",
      getActiveSessionFromRequest: () => null,
      scope: "casting",
    });
    expect(result.proceed).toBe(true);
    expect(result.session).toBeNull();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("proceed=true med session", () => {
    const session = { userId: "u1", email: "x@y.com" };
    const result = requireScopedAccess(mkReq(), mkRes(), {
      authMode: "open",
      getActiveSessionFromRequest: () => session,
      scope: "casting",
    });
    expect(result.proceed).toBe(true);
    expect(result.session).toBe(session);
  });
});

describe("requireScopedAccess — log mode", () => {
  const mkReq = () => ({ headers: { "user-agent": "test" }, method: "POST", path: "/x", ip: "1.2.3.4" }) as any;
  const mkRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }) as any;

  it("proceed=true selv uten session, men logger", () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = requireScopedAccess(mkReq(), mkRes(), {
      authMode: "log",
      getActiveSessionFromRequest: () => null,
      scope: "casting",
    });
    expect(result.proceed).toBe(true);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("session-bærere logger IKKE (kun unauth)", () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = requireScopedAccess(mkReq(), mkRes(), {
      authMode: "log",
      getActiveSessionFromRequest: () => ({ userId: "u" }),
      scope: "casting",
    });
    expect(result.proceed).toBe(true);
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe("requireScopedAccess — enforce mode", () => {
  const mkReq = () => ({ headers: {}, method: "POST", path: "/x" }) as any;
  const mkRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }) as any;

  it("proceed=false + 401 hvis ingen session", () => {
    const res = mkRes();
    const result = requireScopedAccess(mkReq(), res, {
      authMode: "enforce",
      getActiveSessionFromRequest: () => null,
      scope: "casting",
    });
    expect(result.proceed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("proceed=true med session i enforce", () => {
    const result = requireScopedAccess(mkReq(), mkRes(), {
      authMode: "enforce",
      getActiveSessionFromRequest: () => ({ userId: "u" }),
      scope: "casting",
    });
    expect(result.proceed).toBe(true);
  });
});
