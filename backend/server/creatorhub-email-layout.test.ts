import { describe, expect, it } from "vitest";
import { buildCreatorHubEmailLayout } from "./creatorhub-email-layout.js";

const html = buildCreatorHubEmailLayout({
  theme: {
    canvasBackground: "#06070b",
    cardBackground: "#11141b",
    cardBorder: "#2a2f39",
    headerBackground: "#0c0f15",
    headerText: "#f6efe4",
    brandLabelColor: "#ffba6c",
    bodyText: "#e7dece",
    mutedText: "#b8aa93",
    buttonBackground: "#ffba6c",
    buttonText: "#16120d",
    footerText: "#918573",
  },
  appName: "CreatorHub Norge",
  tagline: "Business OS for creators",
  domain: "creatorhubn.com",
  categoryLabel: "CreatorHub Tilgang",
  title: "Vil du bli prototype-tester?",
  bodyHtml: "<p>Hei Test Tester,</p>",
  detailHtml: "<table role=\"presentation\"><tr><td>Rolle</td></tr></table>",
  ctaLabel: "Les vilkår og signer",
  ctaUrl: "https://creatorhubn.com/invite",
  footerText: "CreatorHub Norge · creatorhubn.com",
  logo: {
    url: "https://creatorhubn.com/creatorhub-wordmark-light.png",
    width: 176,
    height: 52,
    style: "display:block;width:176px;height:auto",
  },
});

describe("CreatorHub e-mail layout", () => {
  it.each(["Gmail", "Outlook", "Apple Mail", "mobile clients"])(
    "keeps the compatibility contract for %s",
    () => {
      expect(html).toContain('<table role="presentation"');
      expect(html).toContain("<!--[if mso]>");
      expect(html).toContain("@media only screen and (max-width:620px)");
      expect(html).toContain('name="x-apple-disable-message-reformatting"');
      expect(html).not.toContain("display:flex");
    },
  );

  it("uses the landing-page wordmark and safe escaped links", () => {
    expect(html).toContain(
      'src="https://creatorhubn.com/creatorhub-wordmark-light.png"',
    );
    expect(html).toContain('href="https://creatorhubn.com/invite"');
    expect(html).toContain("Vil du bli prototype-tester?");
  });
});
