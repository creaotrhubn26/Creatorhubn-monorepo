/**
 * _shared-ids.ts
 *
 * Felles ID-generering for entiteter i casting/role-room/showcase-clusters.
 *
 * Bakgrunn: Tidligere brukte handlere mønsteret `${prefix}-${Date.now()}`
 * for å generere IDs. Det er kollisjons-utrygt — to POST-er innenfor samme
 * millisekund (vanlig i automatiserte tester eller raske klient-mutasjoner)
 * får identisk ID. Resultatet er at den ene POST overskriver den andre i
 * Map+DB.
 *
 * `newEntityId(prefix?)` returnerer `${prefix}-${crypto.randomUUID()}`
 * (eller bare UUID hvis prefix utelates). Beholder prefix for søkbarhet
 * og debugging (eks. `manuscript-` foran UUID-en gjør det lett å
 * identifisere typen ved logg-skanning).
 *
 * Backward-compat: Eksisterende rows i compat-store har Date.now-IDs som
 * fortsetter å fungere som lookup-keys (vi validerer ikke ID-format).
 * Kun nye writes får UUID-baserte IDs.
 *
 * Bruker `crypto.randomUUID()` fra Node 16+ — allerede brukt 9+ steder i
 * backend.
 */

import { randomUUID } from "crypto";

/**
 * Genererer en ny entity-ID.
 *
 * @param prefix Optional prefix (uten trailing dash). Resultat: `${prefix}-<uuid>`.
 *               Hvis utelatt, returneres ren UUID v4.
 * @returns Unik streng. UUID v4 sikrer 2^122 unike kombinasjoner — ingen
 *          praktisk kollisjons-risiko.
 *
 * @example
 *   newEntityId("manuscript")  // "manuscript-7a1f8b2c-..."
 *   newEntityId("scene")       // "scene-b3d4..."
 *   newEntityId()              // "a1b2c3d4-..."
 */
export function newEntityId(prefix?: string): string {
  const uuid = randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * Sjekker om en ID ser ut som det gamle Date.now()-mønsteret. Brukes til
 * å spore migrasjons-fremgang (hvor mange entries har fortsatt legacy-IDs).
 *
 * Matchen er løs — kun ment for observability/debug, ikke for validering.
 */
export function isLegacyTimestampId(id: string): boolean {
  return /^[a-z][a-z0-9-]*-\d{13,}$/.test(id);
}
