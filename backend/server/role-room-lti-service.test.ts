import crypto from "crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import {
  generateToolKeypair, toolJwks, signClientAssertion, verifyIdToken,
  extractAgs, buildLineItem, buildScore, AGS_SCOPES,
  extractNrps, parseRosterMembers, signDeepLinkingResponse,
  extractMemberSections, groupStudentsBySection, isStudentRole,
} from "./role-room-lti-service.js";

const NRPS_CLAIM = "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice";
const DL = "https://purl.imsglobal.org/spec/lti-dl/claim";
const LTI = "https://purl.imsglobal.org/spec/lti/claim";

describe("signDeepLinkingResponse (Deep Linking-røyktest — plattformen validerer denne)", () => {
  // Reproduserer NØYAKTIG det ruten (/lti/launches/:id/deep-link-response) sender:
  // en ltiResourceLink som launcher produksjonen med custom.production_id.
  const key = generateToolKeypair();
  const clientId = "saltire.lti.app";
  const issuer = "https://saltire.lti.app/platform";
  const deploymentId = "cLWwj9cbmkSrCNsckEFBmA";
  const returnData = "opaque-return-data-from-canvas";
  const contentItems = [{
    type: "ltiResourceLink",
    title: "Kortfilm — vår 2026",
    url: "https://www.theroleroom.com/api/role-room/lti/launch",
    custom: { production_id: "proj-abc-123" },
  }];

  const token = signDeepLinkingResponse({
    clientId, issuer, deploymentId, privatePem: key.privatePem, kid: key.kid,
    data: returnData, contentItems,
  });

  it("signeres med tool-nøkkelen og verifiseres med vår public JWK (aud=plattformens issuer)", () => {
    const pem = crypto.createPublicKey({ key: key.publicJwk as crypto.JsonWebKey, format: "jwk" })
      .export({ type: "spki", format: "pem" }).toString();
    const claims = jwt.verify(token, pem, { algorithms: ["RS256"], audience: issuer, issuer: clientId }) as Record<string, unknown>;
    expect(claims.iss).toBe(clientId);
    expect(claims.aud).toBe(issuer);
    // kid i header matcher vår JWKS → plattformen finner riktig nøkkel.
    const header = (jwt.decode(token, { complete: true }) as { header: { kid?: string; alg?: string } }).header;
    expect(header.kid).toBe(key.kid);
    expect(header.alg).toBe("RS256");
  });

  it("bærer alle påkrevde LTI DL-claims (message_type/version/content_items/deployment/data)", () => {
    const c = jwt.decode(token) as Record<string, unknown>;
    expect(c[`${LTI}/message_type`]).toBe("LtiDeepLinkingResponse");
    expect(c[`${LTI}/version`]).toBe("1.3.0");
    expect(c[`${LTI}/deployment_id`]).toBe(deploymentId);
    expect(c[`${DL}/data`]).toBe(returnData); // ekkoet fra deep_linking_settings
    expect(typeof c.nonce).toBe("string");
    expect((c.exp as number) > (c.iat as number)).toBe(true);
  });

  it("content_item er en ltiResourceLink som re-launcher produksjonen (custom.production_id)", () => {
    const c = jwt.decode(token) as Record<string, unknown>;
    const items = c[`${DL}/content_items`] as Record<string, unknown>[];
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].type).toBe("ltiResourceLink");
    expect(items[0].url).toContain("/lti/launch");
    expect((items[0].custom as Record<string, unknown>).production_id).toBe("proj-abc-123");
  });

  it("uten data (ikke-deep-link) utelates data-claimet", () => {
    const t2 = signDeepLinkingResponse({ clientId, issuer, privatePem: key.privatePem, kid: key.kid, contentItems });
    const c2 = jwt.decode(t2) as Record<string, unknown>;
    expect(c2[`${DL}/data`]).toBeUndefined();
    expect(c2[`${LTI}/deployment_id`]).toBeUndefined();
  });
});

describe("extractNrps (NRPS-claim → memberships-endepunkt)", () => {
  it("henter context_memberships_url + service_versions", () => {
    const out = extractNrps({ [NRPS_CLAIM]: { context_memberships_url: "https://lms/ctx/1/members", service_versions: ["2.0"] } });
    expect(out).toEqual({ url: "https://lms/ctx/1/members", serviceVersions: ["2.0"] });
  });
  it("mangler NRPS-claim → null", () => {
    expect(extractNrps({})).toBeNull();
    expect(extractNrps({ [NRPS_CLAIM]: {} })).toBeNull();
  });
});

describe("parseRosterMembers (NRPS membership container → medlemmer)", () => {
  it("normaliserer user_id→sub, navn, e-post (lowercased), roller", () => {
    const members = parseRosterMembers({
      members: [
        { user_id: "u1", name: "Kari Nordmann", email: "Kari@Skole.No", roles: ["...#Learner"], status: "Active" },
        { user_id: "u2", given_name: "Ola", family_name: "Hansen", email: "ola@skole.no", roles: ["...#Instructor"] },
      ],
    });
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ sub: "u1", name: "Kari Nordmann", email: "kari@skole.no", status: "Active" });
    expect(members[1]).toMatchObject({ sub: "u2", name: "Ola Hansen", email: "ola@skole.no" });
  });
  it("dropper medlemmer uten user_id; tåler tom/ugyldig container", () => {
    expect(parseRosterMembers({ members: [{ name: "Ingen ID" }] })).toEqual([]);
    expect(parseRosterMembers({})).toEqual([]);
    expect(parseRosterMembers(null)).toEqual([]);
  });
  it("uten seksjonsdata → sections = []", () => {
    const m = parseRosterMembers({ members: [{ user_id: "u1", roles: ["...#Learner"] }] });
    expect(m[0].sections).toEqual([]);
  });
});

const LIS = "https://purl.imsglobal.org/spec/lti/claim/lis";
const CUSTOM = "https://purl.imsglobal.org/spec/lti/claim/custom";

describe("extractMemberSections (Canvas-seksjon per medlem via NRPS message/lis)", () => {
  it("leser lis.course_section_sourcedid fra member.message[] (rlid-scopet NRPS)", () => {
    const sections = extractMemberSections({
      user_id: "u1",
      message: [{ [LIS]: { course_section_sourcedid: "BA-Film-3D" } }],
    });
    expect(sections).toEqual(["BA-Film-3D"]);
  });
  it("leser custom.section_sourcedids (komma-separert) + dedup mot lis", () => {
    const sections = extractMemberSections({
      [LIS]: { course_section_sourcedid: "KULL-2024" },
      message: [{ [CUSTOM]: { section_sourcedids: "KULL-2024, KULL-2024B" } }],
    });
    expect(sections.sort()).toEqual(["KULL-2024", "KULL-2024B"]);
  });
  it("tåler array-form og manglende seksjonsdata", () => {
    expect(extractMemberSections({ message: [{ [LIS]: { course_section_sourcedid: ["A", "B"] } }] }).sort()).toEqual(["A", "B"]);
    expect(extractMemberSections({ user_id: "u1" })).toEqual([]);
  });
});

describe("groupStudentsBySection (kull ← Canvas-seksjon; kun studenter)", () => {
  const roster = parseRosterMembers({
    members: [
      { user_id: "s1", name: "Kari", email: "kari@s.no", roles: ["...#Learner"], message: [{ [LIS]: { course_section_sourcedid: "3D" } }] },
      { user_id: "s2", name: "Ola", email: "ola@s.no", roles: ["...#Learner"], message: [{ [LIS]: { course_section_sourcedid: "3D" } }] },
      { user_id: "s3", name: "Nils", email: "nils@s.no", roles: ["...#Learner"], message: [{ [LIS]: { course_section_sourcedid: "3F" } }] },
      { user_id: "s4", name: "Uten seksjon", email: "u@s.no", roles: ["...#Learner"] },
      { user_id: "t1", name: "Faglærer", email: "f@s.no", roles: ["...#Instructor"], message: [{ [LIS]: { course_section_sourcedid: "3D" } }] },
    ],
  });
  it("grupperer studenter per seksjon, sorterer, og ekskluderer faglærer", () => {
    const { sections, unsectioned } = groupStudentsBySection(roster);
    expect(sections.map((s) => s.section)).toEqual(["3D", "3F"]);
    expect(sections[0].members.map((m) => m.sub)).toEqual(["s1", "s2"]); // ikke t1 (Instructor)
    expect(sections[1].members.map((m) => m.sub)).toEqual(["s3"]);
    expect(unsectioned.map((m) => m.sub)).toEqual(["s4"]);
  });
  it("isStudentRole: Learner/tom → true, Instructor → false", () => {
    expect(isStudentRole(["...#Learner"])).toBe(true);
    expect(isStudentRole([])).toBe(true);
    expect(isStudentRole(["...#Instructor"])).toBe(false);
  });
});

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
