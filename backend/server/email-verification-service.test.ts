import { describe, expect, it, vi } from "vitest";
import { sendVerificationCode } from "./email-verification-service.js";

describe("email verification custom delivery", () => {
  it("stores only a hash and passes the one-time code only to the delivery adapter", async () => {
    const clientQuery = vi.fn().mockImplementation(async (statement: unknown) => {
      if (String(statement).includes("SELECT expires_at")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn().mockResolvedValue(client),
    };
    const deliver = vi.fn().mockResolvedValue({ sent: true });

    const result = await sendVerificationCode(
      pool as never,
      {
        email: " Tester@Example.com ",
        purpose: "prototype_tester_sign",
        ipAddress: "127.0.0.1",
      },
      deliver,
    );

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("devCode");
    expect(deliver).toHaveBeenCalledOnce();
    const deliveryInput = deliver.mock.calls[0][0];
    expect(deliveryInput.email).toBe("tester@example.com");
    expect(deliveryInput.code).toMatch(/^\d{6}$/);
    expect(deliveryInput.expiresMinutes).toBe(10);

    const insert = clientQuery.mock.calls.find(([statement]) =>
      String(statement).includes("INSERT INTO email_verification_codes"),
    );
    expect(insert).toBeTruthy();
    expect(insert?.[1]?.[0]).toBe("tester@example.com");
    expect(insert?.[1]?.[2]).not.toBe(deliveryInput.code);
    expect(String(insert?.[1]?.[2])).toMatch(/^\$2[aby]\$/);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
