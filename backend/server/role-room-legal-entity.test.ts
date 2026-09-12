import { afterEach, describe, expect, it, vi } from "vitest";
import { findCustomerLegalEntityCandidates } from "./role-room-legal-entity.js";

describe("findCustomerLegalEntityCandidates", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches Brreg with website legalName instead of the consumer brand", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url === "https://medside.no") {
        return new Response(`
          <script type="application/ld+json">
            {"@type":"Organization","legalName":"MedInnova AS","name":"MedInnova AS"}
          </script>
        `, { status: 200 });
      }
      return Response.json({
        _embedded: {
          enheter: [{
            organisasjonsnummer: "936564046",
            navn: "MEDINNOVA AS",
            hjemmeside: "https://medside.no",
            forretningsadresse: {
              adresse: ["Olasrudveien 23"],
              postnummer: "1284",
              poststed: "OSLO",
              kommune: "OSLO",
              kommunenummer: "0301"
            },
            naeringskode1: { kode: "62.100", beskrivelse: "Dataprogrammeringstjenester" }
          }]
        }
      });
    }));

    const candidates = await findCustomerLegalEntityCandidates({
      brandName: "MedSide",
      websiteUrl: "https://medside.no",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: "MEDINNOVA AS",
      organizationNumber: "936564046",
      websiteHostMatch: true,
    });
    expect(requestedUrls.some((url) => url.includes("navn=MedInnova+AS"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("navn=MedSide"))).toBe(false);
  });
});
