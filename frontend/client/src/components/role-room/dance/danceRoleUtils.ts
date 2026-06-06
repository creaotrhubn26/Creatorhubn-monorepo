/**
 * Audit H1: read-only-detektor for dance-flaten.
 *
 * Roller som FÅR redigere formasjoner:
 *   - 'owner', 'admin', 'super_admin' — eier-tilgang
 *   - 'producer', 'content_producer' — produksjonsteam
 *   - 'choreographer' — eksplisitt koreografi-rolle
 *   - 'vendor' — frilanser med skrive-tilgang
 *   - undefined / null — backward-compat (default writable hvis ikke spesifisert)
 *
 * Roller som er READ-ONLY:
 *   - 'viewer', 'guest', 'dancer', 'client_reviewer', 'couple'
 *
 * Konvensjon: ukjente roller defaultes til read-only (fail-safe).
 */

const READ_ONLY_ROLES = new Set<string>([
  'viewer', 'guest', 'dancer',
  'client_reviewer', 'couple',
]);

const WRITABLE_ROLES = new Set<string>([
  'owner', 'admin', 'super_admin',
  'producer', 'content_producer',
  'choreographer', 'vendor',
]);

export function isDanceReadOnlyRole(role?: string | null): boolean {
  if (role == null || role === '') return false; // backward-compat: default writable
  if (READ_ONLY_ROLES.has(role)) return true;
  if (WRITABLE_ROLES.has(role)) return false;
  // Ukjent rolle → fail-safe read-only
  return true;
}
