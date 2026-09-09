import { describe, expect, it } from "vitest";
import {
  buildPrototypeTesterAgreementBundle,
  canonicalJsonStringify,
  CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS,
} from "../../frontend/shared/prototype-tester-agreements.js";

describe("prototype tester agreement bundle", () => {
  const documents = buildPrototypeTesterAgreementBundle({
    testerName: "Ada Lovelace",
    testerEmail: "ada@example.com",
    testerCompany: "Analytical Engines AS",
  });

  it("contains four distinct, versioned documents for the represented party", () => {
    expect(documents.map((document) => document.key)).toEqual([
      "program_terms",
      "nda",
      "dpa",
      "letter_of_intent",
    ]);
    expect(documents.map((document) => document.version)).toEqual([
      CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS.program_terms,
      CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS.nda,
      CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS.dpa,
      CURRENT_PROTOTYPE_TESTER_AGREEMENT_VERSIONS.letter_of_intent,
    ]);
    expect(
      documents.every(
        (document) =>
          document.content.includes("Ada Lovelace") ||
          document.key === "program_terms",
      ),
    ).toBe(true);
  });

  it("covers the GDPR article 28 processor-contract subjects", () => {
    const dpa = documents.find((document) => document.key === "dpa");
    expect(dpa?.version).toBe("1.1");
    expect(dpa?.content).toContain("Behandlingsansvarlig");
    expect(dpa?.content).toContain("Databehandler");
    expect(dpa?.content).toContain("UNDERDATABEHANDLERE");
    expect(dpa?.content).toContain("14 kalenderdager");
    expect(dpa?.content).toContain("fullt ansvar overfor Kunden");
    expect(dpa?.content).toContain("REGISTRERTES RETTIGHETER");
    expect(dpa?.content).toContain("artikkel 32–36");
    expect(dpa?.content).toContain("SLETTING, RETUR OG BEKREFTELSE");
    expect(dpa?.content).toContain("skriftlig bekrefte gjennomført sletting");
    expect(dpa?.content).toContain("DOKUMENTASJON, REVISJON OG TILSYN");
    expect(dpa?.content).toContain("VEDLEGG B — MINIMUMSTILTAK FOR SIKKERHET");
    expect(dpa?.content).toContain("VEDLEGG C — GODKJENTE UNDERDATABEHANDLERE");
    expect(dpa?.content.toLowerCase()).toContain("enkel elektronisk signatur");
    expect(dpa?.content).toContain("artikkel 28");
  });

  it("keeps the accepted DPA 1.0 text stable for existing invitations", () => {
    const legacyDpa = buildPrototypeTesterAgreementBundle(
      {
        testerName: "Ada Lovelace",
        testerEmail: "ada@example.com",
        testerCompany: "Analytical Engines AS",
      },
      { dpa: "1.0" },
    ).find((document) => document.key === "dpa");

    expect(legacyDpa?.version).toBe("1.0");
    expect(legacyDpa?.content).toContain("SLETTING, RETUR OG REVISJON");
    expect(legacyDpa?.content).not.toContain("VEDLEGG C — GODKJENTE UNDERDATABEHANDLERE");
  });

  it("makes the letter of intent explicitly non-binding", () => {
    const intent = documents.find(
      (document) => document.key === "letter_of_intent",
    );
    expect(intent?.bindingNature).toBe("non_binding");
    expect(intent?.content).toContain("IKKE-BINDENDE KARAKTER");
    expect(intent?.content).toContain("er ikke i seg selv rettslig bindende");
  });

  it("serializes object keys deterministically for JSONB-safe evidence hashes", () => {
    const beforeStorage = {
      signer: { name: "Ada", email: "ada@example.com" },
      documents: [1, 2],
    };
    const afterJsonbStorage = {
      documents: [1, 2],
      signer: { email: "ada@example.com", name: "Ada" },
    };

    expect(canonicalJsonStringify(beforeStorage)).toBe(
      canonicalJsonStringify(afterJsonbStorage),
    );
  });
});
