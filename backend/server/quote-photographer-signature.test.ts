import { describe, expect, it } from "vitest";
import { normalizePhotographerSignature } from "./quote-photographer-signature";

/**
 * Normalizer sits on the backend side of the iPad CreatorHub One
 * Tilbud-tab Pencil-signature bridge. The iPad sends ``{ pngBase64,
 * width, height, signedAt }`` as part of the quote POST; this helper
 * validates it before we push the entry onto the JSONB ``approvers``
 * array. Coverage:
 *   - Drop empty/missing base64 so desktop submissions don't acquire
 *     a bogus approver entry.
 *   - Normalize bad numbers to 0 instead of NaN (JSONB serializer
 *     would refuse NaN).
 *   - Stamp ``signedAt`` when the client omitted it (offline iPad
 *     with a lost clock still persists a record).
 *   - Preserve ``source`` for future provenance.
 */
describe("normalizePhotographerSignature", () => {
  const fixedNow = () => new Date("2026-04-18T10:00:00Z");

  it("returns null for null/undefined input", () => {
    expect(normalizePhotographerSignature(null)).toBeNull();
    expect(normalizePhotographerSignature(undefined)).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(normalizePhotographerSignature("blob")).toBeNull();
    expect(normalizePhotographerSignature(42)).toBeNull();
    expect(normalizePhotographerSignature(true)).toBeNull();
  });

  it("returns null when pngBase64 is missing", () => {
    expect(
      normalizePhotographerSignature({ width: 300, height: 100 }),
    ).toBeNull();
  });

  it("returns null when pngBase64 is empty string", () => {
    expect(
      normalizePhotographerSignature({
        pngBase64: "",
        width: 100,
        height: 40,
      }),
    ).toBeNull();
  });

  it("returns null when pngBase64 is non-string", () => {
    expect(
      normalizePhotographerSignature({
        pngBase64: 12345,
        width: 100,
        height: 40,
      }),
    ).toBeNull();
  });

  it("normalizes a valid payload with all fields", () => {
    const out = normalizePhotographerSignature(
      {
        pngBase64: "AAAA",
        width: 480,
        height: 160,
        signedAt: "2026-04-15T08:15:00Z",
        source: "ipad-pencil",
      },
      fixedNow,
    );
    expect(out).toEqual({
      kind: "photographer",
      pngBase64: "AAAA",
      width: 480,
      height: 160,
      signedAt: "2026-04-15T08:15:00Z",
      source: "ipad-pencil",
    });
  });

  it("stamps signedAt when missing", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "ZZZ", width: 100, height: 40 },
      fixedNow,
    );
    expect(out?.signedAt).toBe("2026-04-18T10:00:00.000Z");
  });

  it("defaults source to ipad-pencil when missing", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "ZZZ", width: 100, height: 40 },
      fixedNow,
    );
    expect(out?.source).toBe("ipad-pencil");
  });

  it("coerces numeric width/height from strings", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "x", width: "480", height: "160" },
      fixedNow,
    );
    expect(out?.width).toBe(480);
    expect(out?.height).toBe(160);
  });

  it("falls back to 0 for non-numeric width/height", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "x", width: "bad", height: {} },
      fixedNow,
    );
    expect(out?.width).toBe(0);
    expect(out?.height).toBe(0);
  });

  it("falls back to 0 for NaN width/height (JSONB can't serialise NaN)", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "x", width: NaN, height: Infinity },
      fixedNow,
    );
    expect(out?.width).toBe(0);
    expect(out?.height).toBe(0);
  });

  it("preserves a custom source", () => {
    const out = normalizePhotographerSignature(
      {
        pngBase64: "x",
        width: 100,
        height: 40,
        source: "ipad-finger-fallback",
      },
      fixedNow,
    );
    expect(out?.source).toBe("ipad-finger-fallback");
  });

  it("ignores empty string signedAt and stamps now()", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "x", width: 1, height: 1, signedAt: "" },
      fixedNow,
    );
    expect(out?.signedAt).toBe("2026-04-18T10:00:00.000Z");
  });

  it("tags kind as photographer (matches approvers contract)", () => {
    const out = normalizePhotographerSignature(
      { pngBase64: "x", width: 1, height: 1 },
      fixedNow,
    );
    expect(out?.kind).toBe("photographer");
  });
});
