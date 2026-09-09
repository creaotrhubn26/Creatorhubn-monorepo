import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoFile = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../${path}`, import.meta.url)),
    "utf8",
  );

const requiredHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
} as const;
const participantDocumentCsp =
  "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://creatorhub-backend-rtbl.onrender.com; media-src 'self' blob:; worker-src 'self' blob:; manifest-src 'self'";
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const headerBlockFor = (config: string, route: string): string =>
  config
    .split(/\n(?=\[\[(?:headers|redirects)\]\])/)
    .find((block) => block.includes(`for = "${route}"`)) ?? "";

describe("Workspace participant document deployment boundaries", () => {
  it("sets private-route response headers in Netlify", () => {
    const config = repoFile("netlify.toml");
    const participantHeaders = headerBlockFor(config, "/participant-document/*");
    expect(participantHeaders).not.toBe("");
    for (const [name, expected] of Object.entries(requiredHeaders)) {
      expect(participantHeaders).toMatch(
        new RegExp(
          `${escapeRegExp(name)}\\s*=\\s*"[^"]*${escapeRegExp(expected)}`,
        ),
      );
    }
    expect(participantHeaders).toContain("connect-src 'self'");
    const netlifyCsp = participantHeaders.match(
      /Content-Security-Policy = "([^"]+)"/,
    )?.[1];
    expect(netlifyCsp).toBe(participantDocumentCsp);
  });

  it("keeps bearer-token prototype invitations private in Netlify", () => {
    const config = repoFile("netlify.toml");
    const inviteHeaders = headerBlockFor(
      config,
      "/prototype-tester/accept-invite",
    );
    expect(inviteHeaders).not.toBe("");
    for (const [name, expected] of Object.entries({
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    })) {
      expect(inviteHeaders).toMatch(
        new RegExp(
          `${escapeRegExp(name)}\\s*=\\s*"[^"]*${escapeRegExp(expected)}`,
        ),
      );
    }
  });

  it("avoids fixed proxy-hop trust and keeps isolated CreatorHub mail config", () => {
    for (const path of [
      "backend/.env.example",
      "render.yaml",
      "backend/render.yaml",
    ]) {
      expect(repoFile(path)).not.toContain(
        "WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS",
      );
    }
    for (const path of ["render.yaml", "backend/render.yaml"]) {
      const manifest = repoFile(path);
      for (const key of [
        "WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_SECRET",
        "CREATORHUB_RESEND_API_KEY",
        "CREATORHUB_RESEND_FROM_EMAIL",
        "CREATORHUB_GMAIL_USER",
        "CREATORHUB_GMAIL_APP_PASSWORD",
      ]) {
        expect(manifest).toMatch(new RegExp(`key: ${key}\\s+sync: false`));
      }
    }
    expect(repoFile("backend/.env.example")).toContain(
      "WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_SECRET",
    );
  });
});
