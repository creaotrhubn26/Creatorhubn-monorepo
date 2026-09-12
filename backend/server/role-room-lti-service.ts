/**
 * role-room-lti-service.ts — LTI 1.3 Advantage krypto- og protokoll-kjerne.
 *
 * Rene, testbare funksjoner (ingen DB/HTTP her): tool-nøkkelpar + JWKS, signert
 * client_assertion (OAuth2 client_credentials mot plattformens token-endepunkt),
 * validering av innkommende id_token (LTI-launch) mot plattformens JWKS, og
 * bygging av AGS-payloads (LineItem/Score) for grade-passback til LMS-karakterbok.
 *
 * Node-innebygd crypto (RSA/JWK) + jsonwebtoken (RS256). Ingen ekstra deps.
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";

const ALG = "RS256";

export interface ToolKeypair { privatePem: string; publicJwk: Record<string, unknown>; kid: string; }

/** Genererer tool-nøkkelpar (RSA-2048) + public JWK m/ kid. Lagres én gang. */
export function generateToolKeypair(): ToolKeypair {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const kid = crypto.randomBytes(12).toString("hex");
  const publicJwk = { ...(publicKey.export({ format: "jwk" }) as Record<string, unknown>), kid, use: "sig", alg: ALG };
  return { privatePem, publicJwk, kid };
}

/** Vår offentlige JWKS (det plattformen bruker for å verifisere våre signaturer). */
export function toolJwks(publicJwk: Record<string, unknown>): { keys: Record<string, unknown>[] } {
  return { keys: [publicJwk] };
}

/**
 * Signert client_assertion — brukes i OAuth2 client_credentials-forespørselen
 * for å hente et access_token mot plattformens token-endepunkt (AGS).
 */
export function signClientAssertion(input: {
  clientId: string; tokenUrl: string; privatePem: string; kid: string; now?: number;
}): string {
  const iat = Math.floor((input.now ?? Date.now()) / 1000);
  return jwt.sign(
    {
      iss: input.clientId, sub: input.clientId, aud: input.tokenUrl,
      iat, exp: iat + 300, jti: crypto.randomBytes(16).toString("hex"),
    },
    input.privatePem,
    { algorithm: ALG, keyid: input.kid },
  );
}

/**
 * Signert LTI Deep Linking Response (message_type LtiDeepLinkingResponse) —
 * det verktøyet sender TILBAKE til plattformen når læreren har valgt/opprettet
 * innhold (f.eks. en produksjonsoppgave). Signeres med tool-nøkkelen (RS256);
 * aud = plattformens issuer. `data` ekkoes fra deep_linking_settings.
 */
export function signDeepLinkingResponse(input: {
  clientId: string; issuer: string; deploymentId?: string | null; privatePem: string; kid: string;
  data?: string | null; contentItems: Record<string, unknown>[]; now?: number;
}): string {
  const iat = Math.floor((input.now ?? Date.now()) / 1000);
  const payload: Record<string, unknown> = {
    iss: input.clientId,
    aud: input.issuer,
    iat, exp: iat + 600, nonce: crypto.randomBytes(16).toString("hex"),
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
    "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": input.contentItems,
  };
  if (input.deploymentId) payload["https://purl.imsglobal.org/spec/lti/claim/deployment_id"] = input.deploymentId;
  if (input.data) payload["https://purl.imsglobal.org/spec/lti-dl/claim/data"] = input.data;
  return jwt.sign(payload, input.privatePem, { algorithm: ALG, keyid: input.kid });
}

export interface PlatformJwk { kid?: string; kty: string; n?: string; e?: string; [k: string]: unknown; }

/**
 * Validerer et innkommende LTI id_token (launch) mot plattformens JWKS.
 * Sjekker signatur (RS256), issuer, audience (=client_id), exp, og nonce.
 * Returnerer dekodede claims eller kaster.
 */
export function verifyIdToken(idToken: string, opts: {
  jwks: PlatformJwk[]; clientId: string; issuer: string; nonce?: string;
}): Record<string, unknown> {
  const decodedHeader = jwt.decode(idToken, { complete: true });
  if (!decodedHeader || typeof decodedHeader === "string") throw new Error("invalid_token");
  const kid = (decodedHeader.header as { kid?: string }).kid;
  if (!kid) throw new Error("no_kid_in_header");
  const jwk = opts.jwks.find((k) => k.kid === kid);
  if (!jwk) throw new Error("no_matching_key");
  const pem = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" })
    .export({ type: "spki", format: "pem" }).toString();
  const claims = jwt.verify(idToken, pem, {
    algorithms: [ALG], audience: opts.clientId, issuer: opts.issuer,
  }) as Record<string, unknown>;
  if (opts.nonce && claims.nonce !== opts.nonce) throw new Error("nonce_mismatch");
  return claims;
}

/** AGS-claim fra et validert launch-token → endepunkt-URLer for grade-passback. */
export interface AgsEndpoint { lineitems?: string; lineitem?: string; scope: string[]; }
export function extractAgs(claims: Record<string, unknown>): AgsEndpoint | null {
  const ags = claims["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"] as
    { lineitems?: string; lineitem?: string; scope?: string[] } | undefined;
  if (!ags) return null;
  return { lineitems: ags.lineitems, lineitem: ags.lineitem, scope: ags.scope ?? [] };
}

/**
 * NRPS-claim (Names and Role Provisioning Services) fra et validert launch-
 * token → context-memberships-endepunktet (klasse-roster i LMS-en).
 */
export function extractNrps(claims: Record<string, unknown>): { url: string; serviceVersions: string[] } | null {
  const nrps = claims["https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice"] as
    { context_memberships_url?: string; service_versions?: string[] } | undefined;
  if (!nrps?.context_memberships_url) return null;
  return { url: nrps.context_memberships_url, serviceVersions: nrps.service_versions ?? [] };
}

/** Ett medlem i LMS-klasse-rosteret (NRPS membership container). `sections` =
 * Canvas-seksjoner medlemmet tilhører (FS lager én seksjon per kull) — tomt om
 * plattformen ikke leverer seksjonsdata. */
export interface RosterMember { sub: string; name: string | null; email: string | null; roles: string[]; status: string; sections: string[]; }

const LIS_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/lis";
const CUSTOM_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/custom";
// Custom-felt Canvas KAN fylle per medlem (rlid-scopet NRPS) med seksjonsdata.
const SECTION_CUSTOM_KEYS = ["section_names", "section_ids", "canvas_section_names", "canvas_section_ids", "section_sourcedids"];

/** Normaliserer en verdi som kan være streng, komma-separert streng eller array →
 * distinkte ikke-tomme strenger. Uløste LMS-variabler (f.eks. Canvas sender
 * «$Canvas.course.sectionSourcedIds» ordrett når substitusjonen ikke er
 * tilgjengelig) filtreres bort — de er ikke ekte seksjoner. */
function toStringList(v: unknown): string[] {
  const clean = (s: string) => s.trim();
  const keep = (s: string) => Boolean(s) && !s.startsWith("$");
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").map(clean).filter(keep);
  if (typeof v === "string") return v.split(",").map(clean).filter(keep);
  return [];
}

/**
 * Trekker ut hvilke Canvas-seksjoner (≈ FS-kull) et NRPS-medlem tilhører.
 * Sjekker flere kjente steder (defensivt, siden dette er Canvas-spesifikt og
 * kun tilstede når NRPS hentes rlid-scopet): member.message[].lis.course_section_sourcedid,
 * member.message[].custom.section_*, og top-level member.lis.course_section_sourcedid.
 */
export function extractMemberSections(mm: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const collectFromLis = (lis: unknown) => {
    const l = lis as { course_section_sourcedid?: unknown } | null;
    if (l && l.course_section_sourcedid != null) toStringList(l.course_section_sourcedid).forEach((s) => out.add(s));
  };
  collectFromLis(mm[LIS_CLAIM] ?? (mm as { lis?: unknown }).lis);
  const messages = Array.isArray(mm.message) ? (mm.message as unknown[]) : [];
  for (const msg of messages) {
    const m = (msg ?? {}) as Record<string, unknown>;
    collectFromLis(m[LIS_CLAIM]);
    const custom = (m[CUSTOM_CLAIM] ?? {}) as Record<string, unknown>;
    for (const k of SECTION_CUSTOM_KEYS) toStringList(custom[k]).forEach((s) => out.add(s));
  }
  return [...out];
}

/** Parser en NRPS membership-container → normaliserte medlemmer (LMS-sub + navn/e-post/roller + seksjoner). */
export function parseRosterMembers(container: unknown): RosterMember[] {
  const c = container as { members?: unknown[] } | null;
  const members = Array.isArray(c?.members) ? (c as { members: unknown[] }).members : [];
  return members
    .map((m): RosterMember => {
      const mm = (m ?? {}) as Record<string, unknown>;
      const name =
        typeof mm.name === "string" && mm.name.trim()
          ? mm.name.trim()
          : [mm.given_name, mm.family_name]
              .filter((p): p is string => typeof p === "string" && !!p.trim())
              .join(" ")
              .trim() || null;
      const roles = Array.isArray(mm.roles) ? (mm.roles as unknown[]).filter((r): r is string => typeof r === "string") : [];
      return {
        sub: String(mm.user_id ?? ""),
        name,
        email: typeof mm.email === "string" && mm.email.trim() ? mm.email.trim().toLowerCase() : null,
        roles,
        status: typeof mm.status === "string" ? mm.status : "Active",
        sections: extractMemberSections(mm),
      };
    })
    .filter((m) => Boolean(m.sub));
}

/** True hvis en NRPS-rolleliste indikerer en student (Learner/Student, eller ingen rolle oppgitt). */
export function isStudentRole(roles: string[]): boolean {
  return roles.length === 0 || roles.some((r) => /learner|student/i.test(r));
}

/**
 * Grupperer roster-medlemmer etter Canvas-seksjon (≈ FS-kull). Kun studenter tas
 * med. Medlemmer i flere seksjoner telles i hver. Returnerer seksjoner (sortert,
 * med medlemmer) + medlemmer uten seksjonsdata (`unsectioned`).
 */
export function groupStudentsBySection(members: RosterMember[]): {
  sections: { section: string; members: RosterMember[] }[];
  unsectioned: RosterMember[];
} {
  const students = members.filter((m) => isStudentRole(m.roles));
  const bySection = new Map<string, RosterMember[]>();
  const unsectioned: RosterMember[] = [];
  for (const m of students) {
    if (m.sections.length === 0) { unsectioned.push(m); continue; }
    for (const s of m.sections) {
      const list = bySection.get(s) ?? [];
      list.push(m);
      bySection.set(s, list);
    }
  }
  const sections = [...bySection.entries()]
    .map(([section, mem]) => ({ section, members: mem }))
    .sort((a, b) => a.section.localeCompare(b.section, "nb"));
  return { sections, unsectioned };
}

/** AGS LineItem (karakterbok-kolonne). */
export function buildLineItem(input: { label: string; scoreMaximum: number; resourceLinkId?: string; tag?: string }): Record<string, unknown> {
  return {
    scoreMaximum: input.scoreMaximum,
    label: input.label,
    ...(input.resourceLinkId ? { resourceLinkId: input.resourceLinkId } : {}),
    ...(input.tag ? { tag: input.tag } : {}),
  };
}

/** AGS Score (karakter som pushes inn i karakterboka for én bruker). */
export function buildScore(input: {
  userId: string; scoreGiven: number; scoreMaximum: number; now?: Date; comment?: string;
  activityProgress?: string; gradingProgress?: string;
}): Record<string, unknown> {
  return {
    userId: input.userId,
    scoreGiven: input.scoreGiven,
    scoreMaximum: input.scoreMaximum,
    activityProgress: input.activityProgress ?? "Completed",
    gradingProgress: input.gradingProgress ?? "FullyGraded",
    timestamp: (input.now ?? new Date()).toISOString(),
    ...(input.comment ? { comment: input.comment } : {}),
  };
}

export const NRPS_SCOPE = "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

export const AGS_SCOPES = [
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  "https://purl.imsglobal.org/spec/lti-ags/scope/score",
  "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
];
