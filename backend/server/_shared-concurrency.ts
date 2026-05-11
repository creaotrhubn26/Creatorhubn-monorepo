/**
 * _shared-concurrency.ts
 *
 * Optimistic concurrency control (OCC) for REST-endpoints.
 *
 * **Bakgrunn (pain points adressert):**
 * Screenplay-/casting-software-markedet rapporterer "lost updates" som
 * en av de største bug-source-ene — to klienter redigerer samme entity
 * samtidig, og den siste-skrivende overskriver den første. OCC løser
 * dette ved å versjons-spore entities og avvise skrives som ikke matcher
 * forventet versjon (HTTP 412 Precondition Failed).
 *
 * **API-mønster (RFC 7232 / Microsoft Azure REST Guidelines):**
 *   - GET-respons inkluderer `ETag: W/"<version>"` header
 *   - PUT/PATCH/DELETE-request inkluderer optional `If-Match: W/"<version>"`
 *   - Server validerer versjon; 412 hvis mismatch
 *   - Hvis klient IKKE sender If-Match → aksepter (backwards-compat)
 *
 * **Rollout-strategi (3-trinns):**
 *   1. _foundation_ (denne commit): version-felt persisteres på alle
 *      writes, ETag-header returneres på reads. **Ingen 412 ennå.**
 *   2. _log-only_: log mismatch-varslinger (env-flag).
 *   3. _enforce_: returner 412 på mismatch (etter klient-tilpasning).
 *
 * Modulen eksponerer 5 pure helpers + 1 send-helper.
 */

import type express from "express";

/**
 * Returnerer neste versjons-nummer. Versjon=1 for nye entities.
 * Brukes på hver write (POST/PUT/PATCH).
 */
export function bumpVersion(existing: { version?: unknown } | null | undefined): number {
  const current =
    existing && typeof existing.version === "number" && Number.isFinite(existing.version)
      ? existing.version
      : 0;
  return current + 1;
}

/**
 * Bygger en weak ETag-streng for gitt versjons-nummer.
 * Weak (`W/`-prefix) signaliserer at to representasjoner kan være semantisk
 * like uten å være byte-identiske (vi serialiserer datoer som ISO-strenger,
 * Map-iterasjons-rekkefølge er ikke garantert, osv.) — strong ETag krever
 * byte-eksakt match.
 *
 * @example etagFor(5)  // → 'W/"5"'
 */
export function etagFor(version: number): string {
  return `W/"${version}"`;
}

/**
 * Parser If-Match-header til versjons-nummer. Returnerer null hvis header
 * mangler eller ikke har et gjenkjennelig format.
 *
 * Aksepterer både weak (`W/"5"`) og strong (`"5"`) ETag-format. Også
 * blank `"*"` (any version) returneres som NaN-marker som kallere kan
 * sjekke separat.
 *
 * @example parseIfMatchVersion('W/"5"')  // → 5
 * @example parseIfMatchVersion('"5"')    // → 5
 * @example parseIfMatchVersion('*')      // → null (caller kan tolke som "any")
 * @example parseIfMatchVersion(undefined) // → null
 */
export function parseIfMatchVersion(header: string | undefined): number | null {
  if (typeof header !== "string") return null;
  const trimmed = header.trim();
  if (!trimmed || trimmed === "*") return null;
  // Match W/"<digits>" eller "<digits>"
  const match = trimmed.match(/^(?:W\/)?"(\d+)"$/);
  if (!match) return null;
  const version = Number.parseInt(match[1], 10);
  return Number.isFinite(version) ? version : null;
}

export interface IfMatchCheckResult {
  /** True hvis klient ikke sendte If-Match (backwards-compat aksepter). */
  noHeader: boolean;
  /** True hvis If-Match-versjon matcher current entity-versjon. */
  matches: boolean;
  /** Parset versjon fra If-Match-header. Null hvis manglet eller malformed. */
  expected: number | null;
  /** Current entity-versjon (kan være undefined for nye/legacy entities). */
  current: number | undefined;
}

/**
 * Sjekker If-Match-header mot current entity-versjon. Returnerer struktur
 * som kalleren kan bruke til å bestemme respons.
 *
 * Husk: `matches: true` returneres OGSÅ når noHeader=true (ingen header
 * = aksepter — backwards-compat). Kalleren må sjekke `noHeader` separat
 * for å skille "ingen check" fra "match".
 */
export function checkIfMatch(
  req: express.Request,
  currentVersion: number | undefined,
): IfMatchCheckResult {
  const header = req.headers["if-match"];
  const headerString = Array.isArray(header) ? header[0] : header;
  if (typeof headerString !== "string" || !headerString.trim()) {
    return {
      noHeader: true,
      matches: true,
      expected: null,
      current: currentVersion,
    };
  }
  if (headerString.trim() === "*") {
    // Wildcard: match alt unntatt "entity finnes ikke".
    return {
      noHeader: false,
      matches: currentVersion !== undefined,
      expected: null,
      current: currentVersion,
    };
  }
  const expected = parseIfMatchVersion(headerString);
  return {
    noHeader: false,
    matches: expected !== null && expected === currentVersion,
    expected,
    current: currentVersion,
  };
}

/**
 * Sender 412 Precondition Failed-respons med korrekt ETag-header for
 * current versjon. Brukes når If-Match-check feiler i enforce-modus.
 */
export function sendPreconditionFailed(
  res: express.Response,
  currentVersion: number | undefined,
): void {
  if (currentVersion !== undefined) {
    res.setHeader("ETag", etagFor(currentVersion));
  }
  res.status(412).json({
    error: "If-Match-header matcher ikke gjeldende versjon. Hent ressursen på nytt og prøv igjen.",
    currentVersion: currentVersion ?? null,
  });
}

/**
 * Setter ETag-header på respons hvis entity har versjons-felt. Trygt å
 * kalle med vilkårlig data — gjør ingenting hvis entity mangler version.
 */
export function setEtagHeader(
  res: express.Response,
  entity: { version?: unknown } | null | undefined,
): void {
  if (entity && typeof (entity as { version?: unknown }).version === "number") {
    res.setHeader(
      "ETag",
      etagFor((entity as { version: number }).version),
    );
  }
}
