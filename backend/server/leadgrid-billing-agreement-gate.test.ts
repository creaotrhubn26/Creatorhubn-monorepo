/**
 * Fakturering forutsetter en signert avtale.
 *
 * Dette er en pengevei og en etterlevelsesvei på én gang: uten
 * databehandleravtale har vi ikke lov til å behandle kundens data, og uten
 * intensjonsavtale har fakturaen intet grunnlag. At det gikk an å opprette
 * et abonnement uten en eneste signatur er feilen disse testene vokter.
 */
import { describe, expect, it, vi } from "vitest";

import { AGREEMENT_DOCUMENTS } from "./leadgrid-agreement-documents.js";
import { REQUIRED_AGREEMENT_TYPES } from "./leadgrid-org-agreements.js";
import { provisionLeadgridInvoiceSubscription } from "./leadgrid-billing-service.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

function orgRad() {
  return {
    organization_id: ORG_ID,
    name: "Neras Direkte AS",
    contact_email: "faktura@nerasdirekte.no",
    org_number: "986330682",
    address_line: "Bragernes Torg 2A",
    postal_code: "3017",
    city: "Drammen",
    org_customer_id: null,
    org_subscription_id: null,
    provider_customer_id: null,
    provider_subscription_id: null,
    subscription_status: "inactive",
    plan_key: null,
    billing_revision: 1,
    storage_addon_quantity: 0,
    storage_addon_item_id: null,
    pending_checkout_session_id: null,
    pending_checkout_url: null,
    pending_checkout_expires_at: null,
  };
}

/** Avtalerader slik DISTINCT ON-spørringen ville returnert dem. */
function signerteAvtaler(typer: readonly string[]) {
  return typer.map((type) => ({
    agreement_type: type,
    document_version: AGREEMENT_DOCUMENTS[type as "dpa"].version,
    document_sha256: "a".repeat(64),
    signed_at: new Date("2026-09-24T08:00:00.000Z"),
    signer_name: "Jon Christian Hillestad",
  }));
}

function lagPool(avtaler: readonly string[]) {
  const sekvens: string[] = [];
  const query = vi.fn(async (sql: unknown) => {
    const tekst = String(sql);
    sekvens.push(tekst.trim().split("\n")[0].trim());
    if (tekst.includes("FROM leadgrid_org_agreements")) {
      return { rows: signerteAvtaler(avtaler), rowCount: avtaler.length };
    }
    if (tekst.includes("FROM leadgrid_org_billing billing")) {
      return { rows: [orgRad()], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const client = { query, release: vi.fn() };
  return {
    pool: { connect: vi.fn(async () => client), query } as never,
    sekvens,
    query,
  };
}

function lagStripe() {
  const customersCreate = vi.fn(async () => ({ id: "cus_1" }));
  const createTaxId = vi.fn(async () => ({ id: "txi_1" }));
  const subscriptionsCreate = vi.fn(async () => ({ id: "sub_1", status: "active" }));
  return {
    stripe: {
      customers: { create: customersCreate, createTaxId },
      subscriptions: { create: subscriptionsCreate },
    } as never,
    customersCreate,
    createTaxId,
    subscriptionsCreate,
  };
}

const grunnlag = {
  organizationId: ORG_ID,
  planKey: "solo_pro",
  interval: "month" as const,
  planPriceId: "price_solo_m",
  includeAI: false,
  daysUntilDue: 14,
  billingEmail: "faktura@nerasdirekte.no",
};

describe("provisionLeadgridInvoiceSubscription", () => {
  it("nekter å fakturere når ingen avtaler er signert", async () => {
    const { pool } = lagPool([]);
    const { stripe, subscriptionsCreate } = lagStripe();

    await expect(
      provisionLeadgridInvoiceSubscription({ pool, stripe, ...grunnlag }),
    ).rejects.toMatchObject({ code: "avtaler_mangler", status: 409 });

    // Ingen kunde og intet abonnement skal ha rukket å bli opprettet.
    expect(subscriptionsCreate).not.toHaveBeenCalled();
  });

  it("navngir hvilke avtaler som mangler, ikke bare at noe mangler", async () => {
    const { pool } = lagPool(["dpa"]);
    const { stripe } = lagStripe();

    await expect(
      provisionLeadgridInvoiceSubscription({ pool, stripe, ...grunnlag }),
    ).rejects.toMatchObject({
      details: { missing: ["Personvernerklæring", "Intensjonsavtale"] },
    });
  });

  it("godtar ikke en signatur på en eldre versjon av teksten", async () => {
    const { pool, query } = lagPool(REQUIRED_AGREEMENT_TYPES);
    query.mockImplementationOnce(async () => ({ rows: [], rowCount: 0 }));
    const { stripe } = lagStripe();
    // Alle tre er signert, men på en tekst vi siden har endret.
    const utdatert = vi.fn(async (sql: unknown) => {
      const tekst = String(sql);
      if (tekst.includes("FROM leadgrid_org_agreements")) {
        return {
          rows: REQUIRED_AGREEMENT_TYPES.map((type) => ({
            agreement_type: type,
            document_version: "2020-01-01",
            document_sha256: "a".repeat(64),
            signed_at: new Date(),
            signer_name: "Jon Christian Hillestad",
          })),
          rowCount: 3,
        };
      }
      if (tekst.includes("FROM leadgrid_org_billing billing")) {
        return { rows: [orgRad()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const klient = { query: utdatert, release: vi.fn() };
    const utdatertPool = { connect: vi.fn(async () => klient), query: utdatert } as never;

    await expect(
      provisionLeadgridInvoiceSubscription({ pool: utdatertPool, stripe, ...grunnlag }),
    ).rejects.toMatchObject({ code: "avtaler_mangler" });
    void pool;
  });

  it("fakturerer når alt er signert, og setter org.nr og avtalebevis i Stripe", async () => {
    const { pool } = lagPool(REQUIRED_AGREEMENT_TYPES);
    const { stripe, customersCreate, createTaxId, subscriptionsCreate } = lagStripe();

    const ut = await provisionLeadgridInvoiceSubscription({ pool, stripe, ...grunnlag });

    expect(ut).toEqual({ customerId: "cus_1", subscriptionId: "sub_1" });

    // Adressen må med, ellers kan ikke Stripe regne mva.
    const kunde = customersCreate.mock.calls[0][0] as Record<string, any>;
    expect(kunde.address).toMatchObject({ postal_code: "3017", country: "NO" });
    expect(kunde.metadata.org_number).toBe("986330682");
    // Metadata havner ikke på fakturaen — tax_id gjør det.
    expect(createTaxId).toHaveBeenCalledWith("cus_1", {
      type: "no_vat",
      value: "986330682MVA",
    });

    const abonnement = subscriptionsCreate.mock.calls[0][0] as Record<string, any>;
    expect(abonnement.collection_method).toBe("send_invoice");
    expect(abonnement.metadata.provider_legal_name).toBe("Creatorhub AS");
    expect(abonnement.metadata.provider_org_number).toBe("937518684");
    // «Hva har denne kunden signert?» skal kunne besvares i Stripe-dashbordet.
    expect(abonnement.metadata.agreement_dpa).toContain("Jon Christian Hillestad");
    expect(abonnement.metadata.agreement_loi).toContain("2026-09-24");
  });

  it("lar superadmin fakturere uten avtaler når det er et uttrykt valg", async () => {
    const { pool } = lagPool([]);
    const { stripe, subscriptionsCreate } = lagStripe();

    await provisionLeadgridInvoiceSubscription({
      pool, stripe, ...grunnlag, allowMissingAgreements: true,
    });

    expect(subscriptionsCreate).toHaveBeenCalled();
  });
});
