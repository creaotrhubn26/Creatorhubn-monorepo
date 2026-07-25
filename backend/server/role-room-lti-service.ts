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
  const jwk = opts.jwks.find((k) => (kid ? k.kid === kid : true));
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

export const AGS_SCOPES = [
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  "https://purl.imsglobal.org/spec/lti-ags/scope/score",
  "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
];
