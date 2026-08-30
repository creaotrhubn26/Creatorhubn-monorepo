import { describe, expect, it } from "vitest";

import {
  isTrustedNetlifyProductionOrigin,
  safeAppBaseUrl,
} from "./web-origin-allowlist.js";

const baseUrlFor = (origin: string): string =>
  safeAppBaseUrl({ headers: { origin } });

describe("safeAppBaseUrl Netlify origins", () => {
  it.each([
    "https://creatorhub-frontend-mig.netlify.app",
    "https://leadgrid-no.netlify.app",
    "https://theroleroom.netlify.app",
  ])("accepts a stable first-party Netlify production alias: %s", (origin) => {
    expect(baseUrlFor(origin)).toBe(origin);
    expect(isTrustedNetlifyProductionOrigin(origin)).toBe(true);
  });

  it.each([
    "https://attacker.netlify.app",
    "https://creatorhub-frontend-mig.netlify.app.attacker.example",
    "https://deploy-preview-42--creatorhub-frontend-mig.netlify.app",
    "https://feature-participants--creatorhub-frontend-mig.netlify.app",
    "https://feature--theroleroom.netlify.app",
    "https://legacy-creatorhubcom.vercel.app",
  ])("rejects unrelated, deceptive, and legacy hosting origins: %s", (origin) => {
    expect(baseUrlFor(origin)).toBe("https://creatorhubn.com");
    expect(isTrustedNetlifyProductionOrigin(origin)).toBe(false);
  });
});
