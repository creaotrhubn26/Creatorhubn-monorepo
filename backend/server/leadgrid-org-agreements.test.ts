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
