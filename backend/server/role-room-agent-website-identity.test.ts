import { describe, expect, it } from "vitest";
import {
  extractWebsiteLegalIdentityFromHtml,
  isValidNorwegianOrganizationNumber,
} from "./role-room-agent-website-identity.js";

describe("extractWebsiteLegalIdentityFromHtml", () => {
  it("prefers Organization legalName over the customer-facing brand", () => {
    const identity = extractWebsiteLegalIdentityFromHtml(`
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "MedInnova AS",
          "legalName": "MedInnova AS",
          "brand": { "@type": "Brand", "name": "MedSide" },
          "url": "https://medside.no"
        }
      </script>
    `);

    expect(identity).toEqual({ organizationNumber: null, legalName: "MedInnova AS" });
  });

  it("finds nested publisher organizations in JSON-LD graphs", () => {
    const identity = extractWebsiteLegalIdentityFromHtml(`
      <script type="application/ld+json">
        {"@graph":[{"@type":"WebSite","publisher":{"@type":"Organization","name":"Nordlys Drift AS"}}]}
      </script>
    `);

    expect(identity.legalName).toBe("Nordlys Drift AS");
  });

  it("uses conservative ownership copy and a mod-11-valid orgnr as fallback", () => {
    const identity = extractWebsiteLegalIdentityFromHtml(`
      <footer>© 2026 Macks Invest AS · Org.nr. 933 469 395 MVA</footer>
    `);

    expect(identity).toEqual({ organizationNumber: "933469395", legalName: "Macks Invest AS" });
  });

  it("rejects random nine-digit values with an invalid checksum", () => {
    expect(isValidNorwegianOrganizationNumber("936564046")).toBe(true);
    expect(extractWebsiteLegalIdentityFromHtml("<footer>Org.nr. 123 456 789</footer>").organizationNumber).toBeNull();
  });
});
