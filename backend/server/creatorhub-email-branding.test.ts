import { describe, expect, it } from "vitest";
import {
  CREATORHUB_LANDING_WORDMARK_URL,
  creatorHubEmailLogoDimensions,
  normalizeCreatorHubEmailLogoUrl,
} from "./creatorhub-email-branding.js";

describe("CreatorHub email branding", () => {
  it("uses the exact landing-page wordmark for defaults and the legacy square mark", () => {
    expect(normalizeCreatorHubEmailLogoUrl(null)).toBe(
      CREATORHUB_LANDING_WORDMARK_URL,
    );
    expect(
      normalizeCreatorHubEmailLogoUrl(
        "https://creatorhubn.com/creatorhub-logo-amber.svg",
      ),
    ).toBe(CREATORHUB_LANDING_WORDMARK_URL);
    expect(
      normalizeCreatorHubEmailLogoUrl("/creatorhub-wordmark-light.png"),
    ).toBe(CREATORHUB_LANDING_WORDMARK_URL);
    expect(
      creatorHubEmailLogoDimensions(CREATORHUB_LANDING_WORDMARK_URL),
    ).toEqual(expect.objectContaining({ width: 176, height: 52 }));
  });

  it("preserves a deliberately configured custom logo", () => {
    const customLogo = "https://cdn.example.com/company-logo.png";
    expect(normalizeCreatorHubEmailLogoUrl(customLogo)).toBe(customLogo);
    expect(creatorHubEmailLogoDimensions(customLogo)).toEqual(
      expect.objectContaining({ width: 42, height: 42 }),
    );
  });

  it("makes same-origin relative assets email-safe and rejects unsafe schemes", () => {
    expect(normalizeCreatorHubEmailLogoUrl("/custom/email-logo.png")).toBe(
      "https://creatorhubn.com/custom/email-logo.png",
    );
    expect(normalizeCreatorHubEmailLogoUrl("javascript:alert(1)")).toBe(
      CREATORHUB_LANDING_WORDMARK_URL,
    );
    expect(normalizeCreatorHubEmailLogoUrl("data:image/svg+xml,<svg />")).toBe(
      CREATORHUB_LANDING_WORDMARK_URL,
    );
    expect(normalizeCreatorHubEmailLogoUrl("http://example.com/logo.png")).toBe(
      CREATORHUB_LANDING_WORDMARK_URL,
    );
    expect(
      normalizeCreatorHubEmailLogoUrl("https://user:secret@example.com/logo.png"),
    ).toBe(CREATORHUB_LANDING_WORDMARK_URL);
    expect(normalizeCreatorHubEmailLogoUrl("//attacker.example/logo.png")).toBe(
      CREATORHUB_LANDING_WORDMARK_URL,
    );
  });
});
