import { describe, expect, it, vi } from "vitest";
import {
  respondWithError,
  respondServiceUnavailable,
  respondValidationError,
} from "../api-error";

// Mock response object
function makeResMock() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

describe("Sprint B.3 — respondWithError", () => {
  it("returnerer 503 + retryable for ECONNREFUSED", () => {
    const res = makeResMock();
    respondWithError(res as never, { code: "ECONNREFUSED", message: "Connection refused" });
    expect(res.statusCode).toBe(503);
    expect(res.headers["Retry-After"]).toBe("30");
    expect(res.body).toMatchObject({
      error: "database_unavailable",
      retryable: true,
      retryAfterSeconds: 30,
    });
  });

  it("returnerer 503 for postgres restart-koder (57P01)", () => {
    const res = makeResMock();
    respondWithError(res as never, { code: "57P01", message: "admin shutdown" });
    expect(res.statusCode).toBe(503);
    expect((res.body as { retryAfterSeconds: number }).retryAfterSeconds).toBe(10);
  });

  it("returnerer 503 for too_many_connections (53300)", () => {
    const res = makeResMock();
    respondWithError(res as never, { code: "53300", message: "too many connections" });
    expect(res.statusCode).toBe(503);
    expect((res.body as { retryAfterSeconds: number }).retryAfterSeconds).toBe(5);
  });

  it("returnerer 409 for integrity-violations (23xxx)", () => {
    const res = makeResMock();
    respondWithError(res as never, { code: "23505", message: "duplicate key" });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      error: "conflict",
      retryable: false,
    });
  });

  it("returnerer 502 for upstream fetch failures", () => {
    const res = makeResMock();
    respondWithError(res as never, new Error("fetch failed"));
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      error: "upstream_unavailable",
      retryable: true,
    });
  });

  it("returnerer 500 for ukjente feil (ikke retryable)", () => {
    const res = makeResMock();
    respondWithError(res as never, new Error("something bizarre"));
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: "internal_error",
      retryable: false,
    });
    expect(res.headers["Retry-After"]).toBeUndefined();
  });

  it("respekterer override-status fra options", () => {
    const res = makeResMock();
    respondWithError(res as never, new Error("x"), { status: 418 });
    expect(res.statusCode).toBe(418);
  });

  it("respekterer override-message fra options", () => {
    const res = makeResMock();
    respondWithError(res as never, new Error("real msg"), { message: "Custom melding" });
    expect((res.body as { message: string }).message).toBe("Custom melding");
  });

  it("logger til console.error med endpoint + context", () => {
    const res = makeResMock();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    respondWithError(res as never, new Error("test"), {
      endpoint: "GET /api/test",
      context: { userId: "u1" },
    });
    expect(spy).toHaveBeenCalled();
    const logCall = (spy.mock.calls[0][1] as string);
    expect(logCall).toContain("GET /api/test");
    expect(logCall).toContain("u1");
    spy.mockRestore();
  });
});

describe("Sprint B.3 — respondServiceUnavailable", () => {
  it("setter Retry-After-header og 503-status", () => {
    const res = makeResMock();
    respondServiceUnavailable(res as never, "Backend nede", 60);
    expect(res.statusCode).toBe(503);
    expect(res.headers["Retry-After"]).toBe("60");
    expect((res.body as { message: string }).message).toBe("Backend nede");
  });

  it("bruker default 30s retry-after hvis ikke angitt", () => {
    const res = makeResMock();
    respondServiceUnavailable(res as never, "Test");
    expect(res.headers["Retry-After"]).toBe("30");
  });
});

describe("Sprint B.3 — respondValidationError", () => {
  it("returnerer 400 + validation_failed", () => {
    const res = makeResMock();
    respondValidationError(res as never, "Email mangler");
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe("validation_failed");
    expect((res.body as { retryable: boolean }).retryable).toBe(false);
  });

  it("inkluderer field-level errors hvis gitt", () => {
    const res = makeResMock();
    respondValidationError(res as never, "Skjema-feil", { email: "Ugyldig", name: "Mangler" });
    expect((res.body as { fields: Record<string, string> }).fields).toEqual({
      email: "Ugyldig",
      name: "Mangler",
    });
  });
});
