// =============================================================================
// Lag 2a — runtime-oppslag av GODKJENTE lærte overrides (F9-loopen).
//
// Ren resolver: den async bootstrappen laster status='approved'-rader fra
// role_room_agent_learned_overrides én gang og bygger en map; denne modulen
// slår opp den effektive verdien uten I/O, så den kan brukes både i
// grounding-passet (som er bevisst rent) og i marketing-motoren.
//
// Kun 'approved'-overrides skal legges i mappen (human-in-the-loop) — denne
// modulen håndhever ikke status, den er ren matching.
// =============================================================================

export interface NaceBusinessModelOverride {
  /** NACE-prefiks (SN2007), f.eks. "70.10" eller "56". */
  nacePrefix: string;
  /** Godkjent forretningsmodell for dette prefikset. */
  businessModel: string;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Slå opp godkjent businessModel-override for en NACE-kode. Velger det MEST
 * SPESIFIKKE prefikset som matcher (samme semantikk som classifyByNace), så en
 * lært regel for "70.100" vinner over en bredere "70". Returnerer null når
 * ingen override matcher.
 */
export function resolveNaceBusinessModelOverride(
  code: string | null | undefined,
  overrides: readonly NaceBusinessModelOverride[] | null | undefined,
): string | null {
  if (!hasText(code) || !overrides || overrides.length === 0) return null;
  const normalized = code.replace(/[^\d.]/g, "");
  if (normalized.length < 2) return null;

  let best: NaceBusinessModelOverride | null = null;
  for (const entry of overrides) {
    if (!hasText(entry.nacePrefix) || !hasText(entry.businessModel)) continue;
    if (
      normalized.startsWith(entry.nacePrefix) &&
      (best === null || entry.nacePrefix.length > best.nacePrefix.length)
    ) {
      best = entry;
    }
  }
  return best ? best.businessModel : null;
}
