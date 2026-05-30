/**
 * Frontend-helper for å generere unike entity-IDs som matcher backend-
 * mønsteret fra _shared-ids.ts.
 *
 * Bakgrunn: Tidligere brukte mange handlere `${prefix}-${Date.now()}`. Det
 * er kollisjons-utrygt — to klikk innenfor samme millisekund (vanlig i
 * Manuscript-/CastingPlanner-flowen hvor brukeren legger til flere roller
 * eller dialoger raskt) får identisk ID. Resultatet er at den ene
 * overskriver den andre i state-mapping.
 *
 * `clientEntityId(prefix?)` returnerer `${prefix}-${randomUUID()}` (eller
 * ren UUID hvis prefix utelates). Beholder prefix for debugging.
 *
 * `crypto.randomUUID()` er tilgjengelig fra Chrome 92+, Firefox 95+,
 * Safari 15.4+, iPad Safari 15.4+ — som dekker alle moderne devices.
 * Fallback til Math.random-basert UUID hvis API mangler (eldre browsere
 * eller test-env).
 */

function fallbackUuid(): string {
  // RFC 4122 v4-formatert UUID via Math.random. Brukes kun hvis
  // crypto.randomUUID ikke finnes (sjeldent — typisk eldre test-env).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clientEntityId(prefix?: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : fallbackUuid();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
