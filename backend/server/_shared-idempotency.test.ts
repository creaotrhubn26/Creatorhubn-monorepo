import { describe, expect, it } from "vitest";

import { hashRequest, readIdempotencyKey } from "./_shared-idempotency.js";

describe("readIdempotencyKey", () => {
  const mkReq = (headers: Record<string, string | undefined>) =>
    ({ headers, body: null, method: "POST", path: "/x" }) as any;

  it("aksepterer Idempotency-Key", () => {
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "abc" }))).toBe("abc");
  });

  it("aksepterer X-Idempotency-Key (legacy)", () => {
    expect(readIdempotencyKey(mkReq({ "x-idempotency-key": "xyz" }))).toBe(
      "xyz",
    );
  });

  it("foretrekker Idempotency-Key over X-Idempotency-Key", () => {
    const req = mkReq({
      "idempotency-key": "primary",
      "x-idempotency-key": "fallback",
    });
    expect(readIdempotencyKey(req)).toBe("primary");
  });

  it("returnerer null når header mangler", () => {
    expect(readIdempotencyKey(mkReq({}))).toBeNull();
  });

  it("returnerer null for tom string", () => {
    expect(readIdempotencyKey(mkReq({ "idempotency-key": "   " }))).toBeNull();
  });

  it("returnerer null for over 255 tegn", () => {
    expect(
      readIdempotencyKey(mkReq({ "idempotency-key": "x".repeat(256) })),
    ).toBeNull();
  });
});

describe("hashRequest (stabil JSON)", () => {
  const mkReq = (body: unknown, path = "/api/x") =>
    ({ body, method: "POST", path }) as any;

  it("samme body → samme hash", () => {
    const a = hashRequest(mkReq({ name: "Alice", age: 30 }));
    const b = hashRequest(mkReq({ name: "Alice", age: 30 }));
    expect(a).toBe(b);
  });

  it("key-rekkefølge påvirker IKKE hash (stabil sortering)", () => {
    const a = hashRequest(mkReq({ a: 1, b: 2, c: 3 }));
    const b = hashRequest(mkReq({ c: 3, b: 2, a: 1 }));
    const c = hashRequest(mkReq({ b: 2, a: 1, c: 3 }));
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("ulik body → ulik hash", () => {
    const a = hashRequest(mkReq({ name: "Alice" }));
    const b = hashRequest(mkReq({ name: "Bob" }));
    expect(a).not.toBe(b);
  });

  it("ulik method → ulik hash", () => {
    const post = { body: { x: 1 }, method: "POST", path: "/x" } as any;
    const put = { body: { x: 1 }, method: "PUT", path: "/x" } as any;
    expect(hashRequest(post)).not.toBe(hashRequest(put));
  });

  it("ulik path → ulik hash", () => {
    expect(hashRequest(mkReq({}, "/a"))).not.toBe(hashRequest(mkReq({}, "/b")));
  });

  it("nested objects sortert rekursivt", () => {
    const a = hashRequest(mkReq({ outer: { a: 1, b: 2 } }));
    const b = hashRequest(mkReq({ outer: { b: 2, a: 1 } }));
    expect(a).toBe(b);
  });

  it("arrays beholder rekkefølge", () => {
    const a = hashRequest(mkReq({ items: [1, 2, 3] }));
    const b = hashRequest(mkReq({ items: [3, 2, 1] }));
    expect(a).not.toBe(b);
  });

  it("null/undefined body håndteres", () => {
    const a = hashRequest(mkReq(null));
    const b = hashRequest(mkReq(undefined));
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
    expect(a).toBe(b);
  });
});
