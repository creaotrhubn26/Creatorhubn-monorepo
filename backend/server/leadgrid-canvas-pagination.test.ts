import { describe, expect, it } from "vitest";
import {
  decodeCanvasCursor,
  encodeCanvasCursor,
  parseCanvasPageRequest,
  selectCanvasPagePrefix,
} from "./leadgrid-canvas-pagination.js";

const SECRET = "canvas-pagination-test-secret-that-is-long-enough";
const NOTE_ID = "11111111-1111-4111-8111-111111111111";

describe("Canvas signed cursor pagination", () => {
  it("keeps requests without pagination parameters on the legacy contract", () => {
    expect(parseCanvasPageRequest({
      limitValue: undefined,
      cursorValue: undefined,
      kind: "notes",
      scope: "org-user-scope",
      defaultLimit: 50,
      maxLimit: 50,
      secret: "",
    })).toEqual({ enabled: false, limit: 50, cursor: null });
  });

  it("round-trips a signed tenant-scoped cursor", () => {
    const value = encodeCanvasCursor({
      kind: "notes",
      scope: "tenant-a:user-a",
      timestamp: "2026-08-29T10:00:00.000Z",
      id: NOTE_ID,
      secret: SECRET,
    });
    expect(decodeCanvasCursor({
      value,
      kind: "notes",
      scope: "tenant-a:user-a",
      secret: SECRET,
    })).toEqual({
      timestamp: "2026-08-29T10:00:00.000Z",
      id: NOTE_ID,
    });
  });

  it("rejects tampering, cross-tenant reuse and wrong endpoint kinds", () => {
    const value = encodeCanvasCursor({
      kind: "notes",
      scope: "tenant-a:user-a",
      timestamp: "2026-08-29T10:00:00.000Z",
      id: NOTE_ID,
      secret: SECRET,
    });
    const tampered = `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
    for (const input of [
      { value: tampered, kind: "notes" as const, scope: "tenant-a:user-a" },
      { value, kind: "notes" as const, scope: "tenant-b:user-a" },
      { value, kind: "history" as const, scope: "tenant-a:user-a" },
    ]) {
      expect(() => decodeCanvasCursor({ ...input, secret: SECRET }))
        .toThrowError(expect.objectContaining({
          status: 400,
          code: "invalid_canvas_cursor",
        }));
    }
  });

  it("enforces the hard page-size cap", () => {
    expect(() => parseCanvasPageRequest({
      limitValue: "51",
      cursorValue: undefined,
      kind: "notes",
      scope: "scope",
      defaultLimit: 50,
      maxLimit: 50,
      secret: SECRET,
    })).toThrowError(expect.objectContaining({
      status: 400,
      code: "invalid_canvas_page_limit",
      details: { maxLimit: 50 },
    }));
  });

  it("returns a non-empty byte-safe prefix and advertises remaining rows", () => {
    expect(selectCanvasPagePrefix([
      { id: "a", response_bytes: 7 },
      { id: "b", response_bytes: 7 },
      { id: "c", response_bytes: 1 },
    ], 3, 10)).toEqual({
      rows: [{ id: "a", response_bytes: 7 }],
      hasMore: true,
    });
    expect(selectCanvasPagePrefix([
      { id: "large", response_bytes: 50 },
      { id: "next", response_bytes: 1 },
    ], 2, 10)).toEqual({
      rows: [{ id: "large", response_bytes: 50 }],
      hasMore: true,
    });
  });
});
