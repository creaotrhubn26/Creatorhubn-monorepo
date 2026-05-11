import { describe, expect, it } from "vitest";

import {
  bumpVersion,
  checkIfMatch,
  etagFor,
  parseIfMatchVersion,
} from "./_shared-concurrency.js";

describe("bumpVersion", () => {
  it("returnerer 1 for ny entity (null/undefined)", () => {
    expect(bumpVersion(null)).toBe(1);
    expect(bumpVersion(undefined)).toBe(1);
    expect(bumpVersion({})).toBe(1);
  });

  it("inkrementerer existing version", () => {
    expect(bumpVersion({ version: 1 })).toBe(2);
    expect(bumpVersion({ version: 42 })).toBe(43);
  });

  it("håndterer korrupt version-felt", () => {
    expect(bumpVersion({ version: "5" })).toBe(1); // non-number
    expect(bumpVersion({ version: NaN })).toBe(1);
    expect(bumpVersion({ version: Infinity })).toBe(1);
  });
});

describe("etagFor", () => {
  it("formaterer weak ETag", () => {
    expect(etagFor(1)).toBe('W/"1"');
    expect(etagFor(42)).toBe('W/"42"');
  });
});

describe("parseIfMatchVersion", () => {
  it("parser weak og strong ETag-format", () => {
    expect(parseIfMatchVersion('W/"5"')).toBe(5);
    expect(parseIfMatchVersion('"5"')).toBe(5);
    expect(parseIfMatchVersion('W/"42"')).toBe(42);
  });

  it("returnerer null for malformed/manglende headers", () => {
    expect(parseIfMatchVersion(undefined)).toBeNull();
    expect(parseIfMatchVersion("")).toBeNull();
    expect(parseIfMatchVersion("garbage")).toBeNull();
    expect(parseIfMatchVersion("5")).toBeNull(); // ingen ""
    expect(parseIfMatchVersion('"abc"')).toBeNull();
  });

  it("returnerer null for wildcard (caller tolker separat)", () => {
    expect(parseIfMatchVersion("*")).toBeNull();
  });
});

describe("checkIfMatch", () => {
  const mkReq = (header?: string) =>
    ({ headers: header !== undefined ? { "if-match": header } : {} }) as any;

  it("noHeader=true når If-Match mangler (backwards-compat)", () => {
    const result = checkIfMatch(mkReq(), 5);
    expect(result.noHeader).toBe(true);
    expect(result.matches).toBe(true); // ingen check = aksepter
    expect(result.expected).toBeNull();
    expect(result.current).toBe(5);
  });

  it("matches=true når header matcher current version", () => {
    const result = checkIfMatch(mkReq('W/"5"'), 5);
    expect(result.noHeader).toBe(false);
    expect(result.matches).toBe(true);
    expect(result.expected).toBe(5);
  });

  it("matches=false når header peker på feil version", () => {
    const result = checkIfMatch(mkReq('W/"3"'), 5);
    expect(result.matches).toBe(false);
    expect(result.expected).toBe(3);
    expect(result.current).toBe(5);
  });

  it("wildcard * matcher når entity finnes", () => {
    expect(checkIfMatch(mkReq("*"), 5).matches).toBe(true);
    expect(checkIfMatch(mkReq("*"), 1).matches).toBe(true);
  });

  it("wildcard * matcher IKKE når entity ikke finnes", () => {
    expect(checkIfMatch(mkReq("*"), undefined).matches).toBe(false);
  });

  it("malformed If-Match → matches=false", () => {
    const result = checkIfMatch(mkReq("garbage"), 5);
    expect(result.noHeader).toBe(false);
    expect(result.matches).toBe(false);
    expect(result.expected).toBeNull();
  });
});
