import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoleRoomTurnstileService } from "./role-room-turnstile-service.js";

const SECRET_ENV_NAME = "ROLE_ROOM_TURNSTILE_SECRET_KEY";

function createService(options: {
  fetchImpl: typeof fetch;
  verificationTimeoutMs?: number;
}) {
  return createRoleRoomTurnstileService({
    normalizeMailConfigValue: (value) =>
      typeof value === "string" ? value.trim() : "",
    getDefaultRoleRoomPublicOrigin: () => "https://theroleroom.com",
    fetchImpl: options.fetchImpl,
    verificationTimeoutMs: options.verificationTimeoutMs,
  });
}

function verify(service: ReturnType<typeof createService>) {
  return service.verifyRoleRoomTurnstileToken({
    token: "turnstile-token",
    ipAddress: "203.0.113.10",
    expectedAction: "leadgrid_self_onboard",
    expectedHostnames: new Set(["theroleroom.com"]),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Role Room Turnstile siteverify timeout", () => {
  it("treats Cloudflare's always-pass test secret as unconfigured in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(SECRET_ENV_NAME, "1x0000000000000000000000000000000AA");
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const service = createService({ fetchImpl });

    expect(service.getRoleRoomTurnstileSecretKey()).toBe("");
    await expect(verify(service)).resolves.toMatchObject({
      configured: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("aborts a hanging siteverify request and fails closed", async () => {
    vi.useFakeTimers();
    vi.stubEnv(SECRET_ENV_NAME, "production-secret");

    let receivedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        receivedSignal = init?.signal ?? undefined;
        return await new Promise<Response>((_resolve, reject) => {
          receivedSignal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        });
      },
    ) as unknown as typeof fetch;
    const service = createService({ fetchImpl, verificationTimeoutMs: 25 });

    const resultPromise = verify(service);
    const rejection = expect(resultPromise).rejects.toThrow(
      "turnstile_siteverify_timeout",
    );
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(receivedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline after a successful verification", async () => {
    vi.useFakeTimers();
    vi.stubEnv(SECRET_ENV_NAME, "production-secret");

    let receivedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        receivedSignal = init?.signal ?? undefined;
        return {
          ok: true,
          json: async () => ({
            success: true,
            hostname: "theroleroom.com",
            action: "leadgrid_self_onboard",
          }),
        } as Response;
      },
    ) as unknown as typeof fetch;
    const service = createService({ fetchImpl, verificationTimeoutMs: 25 });

    await expect(verify(service)).resolves.toMatchObject({
      configured: true,
      success: true,
    });
    expect(receivedSignal?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(25);
    expect(receivedSignal?.aborted).toBe(false);
  });

  it("keeps the deadline active while reading the siteverify response", async () => {
    vi.useFakeTimers();
    vi.stubEnv(SECRET_ENV_NAME, "production-secret");

    let receivedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        receivedSignal = init?.signal ?? undefined;
        return {
          ok: true,
          json: async () =>
            await new Promise((_resolve, reject) => {
              receivedSignal?.addEventListener("abort", () => {
                reject(
                  new DOMException("The operation was aborted", "AbortError"),
                );
              });
            }),
        } as Response;
      },
    ) as unknown as typeof fetch;
    const service = createService({ fetchImpl, verificationTimeoutMs: 25 });

    const resultPromise = verify(service);
    const rejection = expect(resultPromise).rejects.toThrow(
      "turnstile_siteverify_timeout",
    );
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(receivedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails closed when siteverify is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubEnv(SECRET_ENV_NAME, "production-secret");

    const fetchImpl = vi.fn(async () => {
      throw new Error("network unavailable");
    }) as unknown as typeof fetch;
    const service = createService({ fetchImpl, verificationTimeoutMs: 25 });

    await expect(verify(service)).rejects.toThrow(
      "turnstile_siteverify_unavailable",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
