import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const netlifyConfig = readFileSync(
  fileURLToPath(new URL("../../netlify.toml", import.meta.url)),
  "utf8",
);

const headerBlockFor = (route: string): string =>
  netlifyConfig
    .split(/\n(?=\[\[(?:headers|redirects)\]\])/)
    .find((block) => block.includes(`for = "${route}"`)) ?? "";

describe("Netlify release metadata cache contract", () => {
  it("keeps build-info fresh in both browsers and Netlify's edge cache", () => {
    const buildInfoHeaders = headerBlockFor("/build-info.json");

    expect(buildInfoHeaders).not.toBe("");
    expect(buildInfoHeaders).toMatch(
      /Cache-Control\s*=\s*"[^"]*no-store[^"]*max-age=0/,
    );
    expect(buildInfoHeaders).toMatch(
      /Netlify-CDN-Cache-Control\s*=\s*"[^"]*private[^"]*no-store[^"]*max-age=0/,
    );
  });
});
