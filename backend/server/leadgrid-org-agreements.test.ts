import { describe, expect, it, vi } from "vitest";

import {
  AgreementError,
  documentHash,
  signAgreement,
} from "./leadgrid-org-agreements.js";

const pool = () => {
  const query = vi.fn(async () => ({
    rows: [{ id: "a1", signed_at: new Date("2026-09-24T10:00:00Z") }],
    rowCount: 1,
  }));
  return { pool: { query } as never, query };
};

const basis = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  agreementType: "dpa" as const,
  documentVersion: "2026-09",
  documentText: "Databehandleravtale mellom partene …",
  signerName: "Jon Christian Hillestad",
  signerEmail: "Jon@nerasdirekte.no",
  signatureText: "Jon Christian Hillestad",
  signatureStyle: "flyt" as const,
};

describe("documentHash", () => {
  it("gir samme hash for samme tekst", () => {
    expect(documentHash("abc")).toBe(documentHash("abc"));
  });

  it("endrer seg når ett tegn endres", () => {
    // Det er nettopp dette som gjør signaturen verdt noe: endrer vi teksten,
    // matcher ikke hashen, og ingen kan påstå at de signerte den nye.
    expect(documentHash("Avtale A")).not.toBe(documentHash("Avtale B"));
  });
});

describe("signAgreement", () => {
  it("lagrer hash av teksten, ikke teksten", async () => {
    const { pool: p, query } = pool();
    const ut = await signAgreement(p, basis);
    expect(ut.document_sha256).toBe(documentHash(basis.documentText));
    const params = query.mock.calls[0][1] as unknown[];
    expect(params).not.toContain(basis.documentText);
  });

  it("normaliserer e-posten", async () => {
    const { pool: p, query } = pool();
    await signAgreement(p, basis);
    expect((query.mock.calls[0][1] as string[])[7]).toBe("jon@nerasdirekte.no");
  });

  it("krever navn — kontoen sier hvem som var innlogget, ikke hvem som forpliktet seg", async () => {
    const { pool: p } = pool();
    await expect(
      signAgreement(p, { ...basis, signerName: "  " }),
    ).rejects.toThrow(AgreementError);
  });

  it("nekter å signere et tomt dokument", async () => {
    const { pool: p } = pool();
    await expect(
      signAgreement(p, { ...basis, documentText: "" }),
    ).rejects.toThrow(/hashes og utgjør beviset/);
  });

  it("oppdaterer i stedet for å duplisere ved ny signering av samme versjon", async () => {
    const { pool: p, query } = pool();
    await signAgreement(p, basis);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("ON CONFLICT (organization_id, agreement_type, document_version)");
    expect(sql).toContain("DO UPDATE");
  });

  it("tar vare på bekreftede fakturaopplysninger", async () => {
    const { pool: p, query } = pool();
    await signAgreement(p, {
      ...basis,
      confirmedBilling: { org_number: "986330682", billing_email: "faktura@neras.no" },
    });
    const params = query.mock.calls[0][1] as string[];
    expect(params[9]).toContain("986330682");
  });
});

describe("avtaledokumentene", () => {
  it("navngir Creatorhub AS med organisasjonsnummer i alle påkrevde avtaler", async () => {
    // «Leadgrid» er et produktnavn. En databehandleravtale må navngi et
    // rettssubjekt, ellers vet ikke kunden hvem de har avtale med.
    const { AGREEMENT_DOCUMENTS } = await import("./leadgrid-agreement-documents.js");
    for (const doc of Object.values(AGREEMENT_DOCUMENTS)) {
      if (!doc.required) continue;
      expect(doc.body, doc.type).toContain("Creatorhub AS");
      expect(doc.body, doc.type).toContain("937518684");
    }
  });

  it("dekker punktene artikkel 28 nr. 3 krever", async () => {
    const { AGREEMENT_DOCUMENTS } = await import("./leadgrid-agreement-documents.js");
    // Linjeskift i avtaleteksten skal ikke avgjøre om et krav er dekket.
    const dpa = AGREEMENT_DOCUMENTS.dpa.body.toLowerCase().replace(/\s+/g, " ");
    for (const krav of [
      "dokumenterte instrukser",
      "taushetsplikt",
      "underdatabehandler",
      "revisjon",
      "sletter",
      "brudd på personopplysningssikkerheten",
    ]) {
      expect(dpa, krav).toContain(krav);
    }
  });

  it("skiller personvernerklæringen fra databehandleravtalen", async () => {
    // De regulerer ulike ting: DPA kundens data, personvern brukerens egne.
    const { AGREEMENT_DOCUMENTS } = await import("./leadgrid-agreement-documents.js");
    expect(AGREEMENT_DOCUMENTS.privacy.body).toContain("gjelder opplysninger om DEG");
  });

  it("sier i intensjonsavtalen at klokka starter ved første søk", async () => {
    const { AGREEMENT_DOCUMENTS } = await import("./leadgrid-agreement-documents.js");
    expect(AGREEMENT_DOCUMENTS.loi.body).toContain("første søk");
    expect(AGREEMENT_DOCUMENTS.loi.body).toContain("ikke ved registrering");
  });

  it("endrer hash når en avtaletekst endres", async () => {
    const { AGREEMENT_DOCUMENTS } = await import("./leadgrid-agreement-documents.js");
    const original = documentHash(AGREEMENT_DOCUMENTS.dpa.body);
    const endret = documentHash(AGREEMENT_DOCUMENTS.dpa.body + " ");
    expect(endret).not.toBe(original);
  });
});

describe("underskrift", () => {
  it("avviser signering uten underskrift", async () => {
    const { pool: p } = pool();
    await expect(
      signAgreement(p, { ...basis, signatureText: "   " }),
    ).rejects.toMatchObject({ code: "missing_signature" });
  });

  it("avviser underskrift som ikke er samme navn som signataren", async () => {
    const { pool: p } = pool();
    await expect(
      signAgreement(p, { ...basis, signatureText: "Kari Nordmann" }),
    ).rejects.toMatchObject({ code: "signature_mismatch" });
  });

  it("godtar samme navn med annen bruk av mellomrom og store bokstaver", async () => {
    const { pool: p, query } = pool();
    await signAgreement(p, { ...basis, signatureText: "  jon christian   hillestad " });
    // Underskriften lagres slik den ble skrevet, bare trimmet i endene.
    expect(query.mock.calls[0][1]).toContain("jon christian   hillestad");
  });

  it("avviser en signaturstil vi ikke kjenner", async () => {
    const { pool: p } = pool();
    await expect(
      signAgreement(p, { ...basis, signatureStyle: "krusedull" as never }),
    ).rejects.toMatchObject({ code: "invalid_signature_style" });
  });

  it("returnerer underskriften slik den skal gjengis i kvitteringen", async () => {
    const { pool: p } = pool();
    const ut = await signAgreement(p, basis);
    expect(ut.signature_text).toBe("Jon Christian Hillestad");
    expect(ut.signature_style).toBe("flyt");
  });
});
