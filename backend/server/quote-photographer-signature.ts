/**
 * Quote-signature normalization — pure helper extracted from the
 * ``normalizeQuoteCreationPayload`` function in index.ts so we can
 * unit-test the iPad CreatorHub One Pencil-signature pass-through
 * without standing up the rest of the quote pipeline.
 *
 * The iPad Tilbud tab sends a native PencilKit capture as
 * ``photographerSignature`` on the quote POST:
 *   {
 *     pngBase64: string,
 *     width: number,
 *     height: number,
 *     signedAt?: string ISO-8601,
 *     source?: string,
 *   }
 *
 * This helper:
 *   - Validates the shape — anything missing pngBase64 is dropped.
 *   - Normalizes numeric width/height (falls back to 0 for junk).
 *   - Stamps ``signedAt`` when the client omitted it (so offline
 *     iPad sends that lost their clock still persist a timestamp).
 *   - Tags the entry with ``kind: "photographer"`` so the existing
 *     JSONB ``approvers`` array can hold it alongside client-side
 *     approvers later.
 *
 * Returning ``null`` instead of an empty object is deliberate: call
 * sites use the null check to decide whether to flip
 * ``signatureStatus`` to ``"photographer_signed"``. Returning ``{}``
 * would flip it spuriously for desktop submissions.
 */

export interface NormalizedPhotographerSignature {
  kind: "photographer";
  pngBase64: string;
  width: number;
  height: number;
  signedAt: string;
  source: string;
}

export function normalizePhotographerSignature(
  raw: unknown,
  now: () => Date = () => new Date(),
): NormalizedPhotographerSignature | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const pngBase64 = record.pngBase64;
  if (typeof pngBase64 !== "string" || pngBase64.length === 0) return null;

  const width = toFiniteNumber(record.width);
  const height = toFiniteNumber(record.height);

  const signedAt = (() => {
    const raw = record.signedAt;
    if (typeof raw === "string" && raw.length > 0) return raw;
    return now().toISOString();
  })();

  const source = (() => {
    const raw = record.source;
    if (typeof raw === "string" && raw.length > 0) return raw;
    return "ipad-pencil";
  })();

  return {
    kind: "photographer",
    pngBase64,
    width,
    height,
    signedAt,
    source,
  };
}

function toFiniteNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
