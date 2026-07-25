import crypto from "crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import {
  generateToolKeypair, toolJwks, signClientAssertion, verifyIdToken,
  extractAgs, buildLineItem, buildScore, AGS_SCOPES,
} from "./role-room-lti-service.js";

describe("LTI tool keypair + JWKS", () => {
  it("genererer nøkkelpar + public JWK m/ kid/use/alg", () => {
    const kp = generateToolKeypair();
    expect(kp.privatePem).toContain("BEGIN PRIVATE KEY");
    expect(kp.publicJwk).toMatchObject({ kty: "RSA", use: "sig", alg: "RS256", kid: kp.kid });
    expect(toolJwks(kp.publicJwk).keys[0]).toBe(kp.publicJwk);
  });
});

describe("signClientAssertion", () => {
  it("signerer et gyldig client_assertion (verifiserbart med tool public key)", () => {
    const kp = generateToolKeypair();
    const assertion = signClientAssertion({ clientId: "cid", tokenUrl: "https://lms/token", privatePem: kp.privatePem, kid: kp.kid, now: Date.now() });
    const pem = crypto.createPublicKey({ key: kp.publicJwk as any, format: "jwk" }).export({ type: "spki", format: "pem" }).toString();
    const claims = jwt.verify(assertion, pem, { algorithms: ["RS256"], audience: "https://lms/token" }) as any;
    expect(claims).toMatchObject({ iss: "cid", sub: "cid", aud: "https://lms/token" });
    expect(claims.exp - claims.iat).toBe(300);
  });
});

describe("verifyIdToken (LTI-launch mot plattform-JWKS)", () => {
  // Simuler plattformen (Canvas) med et eget nøkkelpar.
  function platform() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const kid = crypto.randomBytes(6).toString("hex");
    const jwk = { ...(publicKey.export({ format: "jwk" }) as any), kid, use: "sig", alg: "RS256" };
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    return { jwk, privatePem, kid };
  }
  const ISS = "https://canvas.instructure.com";
  const AUD = "client-123";

  function mkToken(p: ReturnType<typeof platform>, over: Record<string, unknown> = {}) {
    const iat = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iss: ISS, aud: AUD, iat, exp: iat + 3600, nonce: "n-1", sub: "user-9", ...over },
      p.privatePem, { algorithm: "RS256", keyid: p.kid },
    );
  }

  it("gyldig token → claims", () => {
    const p = platform();
    const claims = verifyIdToken(mkToken(p), { jwks: [p.jwk], clientId: AUD, issuer: ISS, nonce: "n-1" });
    expect(claims).toMatchObject({ iss: ISS, aud: AUD, sub: "user-9", nonce: "n-1" });
  });
  it("feil audience → kaster", () => {
    const p = platform();
    expect(() => verifyIdToken(mkToken(p), { jwks: [p.jwk], clientId: "annen", issuer: ISS })).toThrow();
  });
  it("nonce-mismatch → kaster", () => {
    const p = platform();
    expect(() => verifyIdToken(mkToken(p), { jwks: [p.jwk], clientId: AUD, issuer: ISS, nonce: "feil" })).toThrow(/nonce/);
  });
  it("ingen matchende kid → kaster", () => {
    const p = platform();
    const other = platform();
    expect(() => verifyIdToken(mkToken(p), { jwks: [other.jwk], clientId: AUD, issuer: ISS })).toThrow(/no_matching_key/);
  });
});

describe("AGS payloads", () => {
  it("extractAgs plukker endepunkt-claim", () => {
    const ags = extractAgs({ "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint": { lineitems: "https://lms/li", scope: AGS_SCOPES } });
    expect(ags).toMatchObject({ lineitems: "https://lms/li" });
    expect(extractAgs({})).toBeNull();
  });
  it("buildLineItem + buildScore", () => {
    const li = buildLineItem({ label: "The Role Room — Kortfilm", scoreMaximum: 100, resourceLinkId: "rl-1" });
    expect(li).toMatchObject({ label: "The Role Room — Kortfilm", scoreMaximum: 100, resourceLinkId: "rl-1" });
    const score = buildScore({ userId: "user-9", scoreGiven: 85, scoreMaximum: 100, now: new Date(0), comment: "Bra" });
    expect(score).toMatchObject({ userId: "user-9", scoreGiven: 85, scoreMaximum: 100, activityProgress: "Completed", gradingProgress: "FullyGraded", comment: "Bra" });
  });
});
