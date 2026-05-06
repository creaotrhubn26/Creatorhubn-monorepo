import { describe, expect, it, vi } from "vitest";
import {
  listUnbilledSmsGroups,
  markGroupBilled,
  runSmsInvoiceSweep,
  type ProjectCustomerResolver,
  type UnbilledSmsGroup,
} from "./casting-sms-invoice-runner.js";

function makePoolStub(opts: {
  unbilledRows?: Array<{
    project_id: string;
    billing_period: string;
    row_ids: string[];
    sms_count: string | number;
    total_ex_vat: string | number;
    total_incl_vat: string | number;
    vat_rate: string | number;
  }>;
  ownerEmailRow?: { email: string | null };
}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes("array_agg")) {
        return { rows: opts.unbilledRows ?? [], rowCount: opts.unbilledRows?.length ?? 0 };
      }
      if (sql.includes("FROM casting_projects")) {
        return {
          rows: opts.ownerEmailRow ? [opts.ownerEmailRow] : [],
          rowCount: opts.ownerEmailRow ? 1 : 0,
        };
      }
      if (sql.startsWith("UPDATE casting_sms_usage")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as Parameters<typeof runSmsInvoiceSweep>[1]["pool"];
  return { pool, queries };
}

function makeStripeStub(
  opts: {
    failOn?: string;
    /**
     * Map customerId → customer-stub som customers.retrieve returnerer.
     * Default: alle har gyldig norsk adresse (country=NO, postal_code=0150),
     * så validateCustomerAddress returnerer { ok: true }.
     */
    customers?: Record<string, { address?: { country?: string; postal_code?: string } | null; deleted?: boolean }>;
  } = {},
) {
  const created: Array<Record<string, unknown>> = [];
  const stripe = {
    invoiceItems: {
      create: vi.fn(async (input: Record<string, unknown>) => {
        if (opts.failOn && String(input.customer) === opts.failOn) {
          throw new Error("stripe_test_failure");
        }
        const id = `ii_test_${created.length + 1}`;
        created.push({ id, ...input });
        return { id };
      }),
    },
    customers: {
      retrieve: vi.fn(async (customerId: string) => {
        const stub = opts.customers?.[customerId];
        if (stub) {
          return {
            id: customerId,
            address: stub.address ?? null,
            deleted: stub.deleted ?? false,
          };
        }
        // Default: gyldig norsk adresse.
        return {
          id: customerId,
          address: { country: "NO", postal_code: "0150" },
          deleted: false,
        };
      }),
    },
  } as unknown as Parameters<typeof runSmsInvoiceSweep>[1]["stripe"];
  return { stripe, created };
}

describe("listUnbilledSmsGroups", () => {
  it("aggregates unbilled rows by project + period", async () => {
    const { pool, queries } = makePoolStub({
      unbilledRows: [
        {
          project_id: "p1",
          billing_period: "2026-03",
          row_ids: ["r1", "r2"],
          sms_count: 2,
          total_ex_vat: 4,
          total_incl_vat: 5,
          vat_rate: 0.25,
        },
      ],
    });
    const groups = await listUnbilledSmsGroups(pool, "2026-04");
    expect(groups).toHaveLength(1);
    expect(groups[0].projectId).toBe("p1");
    expect(groups[0].smsCount).toBe(2);
    expect(groups[0].totalNokExVat).toBe(4);
    expect(queries[0].params).toEqual(["2026-04"]);
  });
});

describe("markGroupBilled", () => {
  it("updates rows with invoice item id", async () => {
    const { pool, queries } = makePoolStub({});
    await markGroupBilled(pool, ["r1", "r2"], "ii_abc");
    expect(queries[0].params[0]).toBe("ii_abc");
    expect(queries[0].params[1]).toEqual(["r1", "r2"]);
  });

  it("noops when rowIds is empty", async () => {
    const { pool, queries } = makePoolStub({});
    await markGroupBilled(pool, [], "ii_abc");
    expect(queries).toHaveLength(0);
  });
});

describe("runSmsInvoiceSweep", () => {
  const baseGroup: UnbilledSmsGroup = {
    projectId: "proj-1",
    billingPeriod: "2026-03",
    rowIds: ["r1", "r2", "r3"],
    smsCount: 3,
    totalNokExVat: 6.0,
    totalNokInclVat: 7.5,
    vatRate: 0.25,
  };

  function asRow(group: UnbilledSmsGroup) {
    return {
      project_id: group.projectId,
      billing_period: group.billingPeriod,
      row_ids: group.rowIds,
      sms_count: group.smsCount,
      total_ex_vat: group.totalNokExVat,
      total_incl_vat: group.totalNokInclVat,
      vat_rate: group.vatRate,
    };
  }

  it("creates one invoice item per group with amount in øre", async () => {
    const { pool } = makePoolStub({ unbilledRows: [asRow(baseGroup)] });
    const { stripe, created } = makeStripeStub();
    const resolver: ProjectCustomerResolver = async () => ({ stripeCustomerId: "cus_test" });

    const summary = await runSmsInvoiceSweep("manual", {
      pool,
      stripe,
      resolveCustomer: resolver,
      now: new Date("2026-04-15T12:00:00Z"),
    });

    expect(summary.groupsScanned).toBe(1);
    expect(summary.invoiceItemsCreated).toBe(1);
    expect(summary.rowsBilled).toBe(3);
    expect(summary.failures).toBe(0);
    expect(created).toHaveLength(1);
    expect(created[0].customer).toBe("cus_test");
    expect(created[0].amount).toBe(600);
    expect(created[0].currency).toBe("nok");
    expect(String(created[0].description)).toContain("3 stk");
    expect(String(created[0].description)).toContain("2026-03");
    // Norway-MVA-compliance: tax_behavior + tax_code må være satt så
    // Stripe Tax kan beregne 25% MVA automatisk.
    expect(created[0].tax_behavior).toBe("exclusive");
    expect(created[0].tax_code).toBe("txcd_30060000");
    expect(
      (created[0].metadata as Record<string, string>).tax_code,
    ).toBe("txcd_30060000");
  });

  it("skips group when customer has no address (Stripe Tax cannot compute MVA)", async () => {
    const { pool } = makePoolStub({ unbilledRows: [asRow(baseGroup)] });
    const { stripe, created } = makeStripeStub({
      customers: { cus_no_addr: { address: null } },
    });
    const resolver: ProjectCustomerResolver = async () => ({
      stripeCustomerId: "cus_no_addr",
    });

    const summary = await runSmsInvoiceSweep("manual", {
      pool,
      stripe,
      resolveCustomer: resolver,
      now: new Date("2026-04-15T12:00:00Z"),
    });

    expect(summary.skipped).toBe(1);
    expect(summary.invoiceItemsCreated).toBe(0);
    expect(created).toHaveLength(0);
    expect(
      summary.notes.some((n) => n.includes("invalid_customer_address")),
    ).toBe(true);
  });

  it("skips group when customer cannot be resolved", async () => {
    const { pool } = makePoolStub({ unbilledRows: [asRow(baseGroup)] });
    const { stripe, created } = makeStripeStub();
    const resolver: ProjectCustomerResolver = async () => ({ stripeCustomerId: null });

    const summary = await runSmsInvoiceSweep("manual", {
      pool,
      stripe,
      resolveCustomer: resolver,
      now: new Date("2026-04-15T12:00:00Z"),
    });

    expect(summary.skipped).toBe(1);
    expect(summary.invoiceItemsCreated).toBe(0);
    expect(created).toHaveLength(0);
    expect(summary.notes.some((n) => n.includes("no_customer"))).toBe(true);
  });

  it("counts failure when Stripe call throws but continues to next group", async () => {
    const goodGroup = { ...baseGroup, projectId: "proj-2", rowIds: ["r4"] };
    const { pool } = makePoolStub({
      unbilledRows: [asRow(baseGroup), asRow(goodGroup)],
    });
    const { stripe } = makeStripeStub({ failOn: "cus_bad" });
    let n = 0;
    const resolver: ProjectCustomerResolver = async () => ({
      stripeCustomerId: n++ === 0 ? "cus_bad" : "cus_ok",
    });

    const summary = await runSmsInvoiceSweep("manual", {
      pool,
      stripe,
      resolveCustomer: resolver,
      now: new Date("2026-04-15T12:00:00Z"),
    });

    expect(summary.groupsScanned).toBe(2);
    expect(summary.failures).toBe(1);
    expect(summary.invoiceItemsCreated).toBe(1);
  });

  it("skips zero-amount groups defensively", async () => {
    const zeroGroup = { ...baseGroup, totalNokExVat: 0, totalNokInclVat: 0 };
    const { pool } = makePoolStub({ unbilledRows: [asRow(zeroGroup)] });
    const { stripe, created } = makeStripeStub();
    const resolver: ProjectCustomerResolver = async () => ({ stripeCustomerId: "cus_test" });

    const summary = await runSmsInvoiceSweep("manual", {
      pool,
      stripe,
      resolveCustomer: resolver,
      now: new Date("2026-04-15T12:00:00Z"),
    });

    expect(summary.skipped).toBe(1);
    expect(created).toHaveLength(0);
  });
});
