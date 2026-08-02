/**
 * creatorhub-stripe-org-link.ts
 *
 * Kobler en CreatorHub PLATTFORM-checkout (planene basic/professional/premium/
 * enterprise) til `organizations.stripe_customer_id`. I dag skriver ikke
 * plattform-checkout denne koblingen — Stripe-kunde-id-en lever kun i KV-cachen
 * (CreatorHubStripeCheckoutSessionRecord.stripeCustomerId). Fase C (metered
 * AI-overage-fakturering) trenger `organizations.stripe_customer_id`, så denne
 * modulen persisterer den:
 *   1) fremover: kalles fra Stripe-webhooken ved checkout.session.completed
 *   2) tilbake i tid: backfill fra eksisterende KV-checkout-records
 *
 * Idempotent og IKKE-destruktiv: skriver KUN når org-en mangler
 * stripe_customer_id fra før. Overskriver ALDRI en eksisterende kobling (f.eks.
 * en Leadgrid-org-kunde) — da lar vi den stå og rapporterer 'conflict'.
 *
 * Ingen Stripe-skriv skjer her; kun én kolonne i organizations settes.
 */

import type { Pool } from "pg";

/**
 * Gjenkjenn SYNTETISKE QA-/seed-checkout-records (ikke ekte kunder). Disse ble
 * seedet for demo/QA og har `userId="guest"` (ingen `users`-rad) + oppdiktede
 * `cus_creatorhub_*`/`cs_creatorhub_*`-id-er (ekte Stripe-kunde-id-er inneholder
 * aldri "creatorhub"). Uten dette klassifiseres de som `no_org` og forurenser
 * «mangler Stripe-kobling»-tellingen selv om det ikke finnes noen ekte kunde å
 * fakturere. Vi hopper over dem eksplisitt.
 */
export function isSyntheticStripeIdentity(
  userId: string | null | undefined,
  stripeCustomerId: string | null | undefined,
): boolean {
  const uid = (userId ?? "").trim().toLowerCase();
  const cust = (stripeCustomerId ?? "").trim().toLowerCase();
  if (!uid || uid === "guest" || uid === "anonymous") return true;
  if (cust.includes("creatorhub") || cust.includes("_qa") || cust.includes("test")) return true;
  return false;
}

export type OrgStripeLinkReason =
  | "linked"        // vi satte stripe_customer_id på org-en
  | "already_set"   // org-en hadde allerede SAMME kunde-id
  | "conflict"      // org-en har en ANNEN kunde-id — rører den ikke
  | "no_org"        // fant ingen org for brukeren
  | "no_customer"   // mangler stripeCustomerId
  | "no_user"       // mangler userId
  | "synthetic"     // syntetisk QA-/seed-record — ekte kunde finnes ikke
  | "error";

export interface OrgStripeLinkResult {
  linked: boolean;
  organizationId: string | null;
  reason: OrgStripeLinkReason;
}

/**
 * Finn org-en som en plattform-checkout-bruker tilhører, og persister
 * Stripe-kunde-id-en på den. Org-oppløsning: eier først (organizations
 * .owner_user_id = bruker), ellers tidligste medlemskap (organization_members).
 */
export async function linkOrgStripeCustomer(
  pool: Pool,
  args: { userId: string | null | undefined; stripeCustomerId: string | null | undefined },
): Promise<OrgStripeLinkResult> {
  const userId = (args.userId ?? "").trim();
  const stripeCustomerId = (args.stripeCustomerId ?? "").trim();
  if (!userId) return { linked: false, organizationId: null, reason: "no_user" };
  if (!stripeCustomerId) return { linked: false, organizationId: null, reason: "no_customer" };
  // Syntetiske QA-/seed-records: aldri en ekte org/kunde å koble.
  if (isSyntheticStripeIdentity(userId, stripeCustomerId)) {
    return { linked: false, organizationId: null, reason: "synthetic" };
  }

  try {
    const orgRes = await pool.query<{ org_id: string | null }>(
      `SELECT COALESCE(
         (SELECT id::text FROM organizations WHERE owner_user_id = $1 LIMIT 1),
         (SELECT organization_id::text FROM organization_members
            WHERE user_id = $1 ORDER BY joined_at ASC NULLS LAST LIMIT 1)
       ) AS org_id`,
      [userId],
    );
    const orgId = orgRes.rows[0]?.org_id ?? null;
    if (!orgId) return { linked: false, organizationId: null, reason: "no_org" };

    // Skriv KUN hvis feltet er tomt. Returner nåværende verdi for å skille
    // already_set (samme id) fra conflict (annen id).
    const upd = await pool.query<{ stripe_customer_id: string | null }>(
      `UPDATE organizations
          SET stripe_customer_id = $2
        WHERE id = $1
          AND (stripe_customer_id IS NULL OR stripe_customer_id = '')
        RETURNING stripe_customer_id`,
      [orgId, stripeCustomerId],
    );
    if (upd.rowCount && upd.rowCount > 0) {
      return { linked: true, organizationId: orgId, reason: "linked" };
    }

    // Ingen rad oppdatert → org-en hadde allerede en verdi. Sjekk hvilken.
    const cur = await pool.query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM organizations WHERE id = $1`,
      [orgId],
    );
    const existing = (cur.rows[0]?.stripe_customer_id ?? "").trim();
    return {
      linked: false,
      organizationId: orgId,
      reason: existing === stripeCustomerId ? "already_set" : "conflict",
    };
  } catch (err) {
    console.warn("[creatorhub-stripe-org-link] linkOrgStripeCustomer failed:", (err as Error).message);
    return { linked: false, organizationId: null, reason: "error" };
  }
}

export interface OrgStripeBackfillSummary {
  processed: number;
  linked: number;
  alreadySet: number;
  conflict: number;
  noOrg: number;
  /** Syntetiske QA-/seed-records som ble hoppet over (ingen ekte kunde). */
  synthetic: number;
  skipped: number;
  errors: number;
  /** Konflikt-detaljer for manuell oppfølging (org hadde en annen kunde-id). */
  conflicts: Array<{ userId: string; organizationId: string; stripeCustomerId: string }>;
}

/**
 * Backfill `organizations.stripe_customer_id` fra en liste KV-checkout-records.
 * Kalleren (index.ts) henter records via compatStoreListByPrefix og sender inn
 * {userId, stripeCustomerId, paymentCompleted}. Kun betalte records med kunde-id
 * behandles. Idempotent — trygg å kjøre flere ganger.
 */
export async function backfillOrgStripeCustomers(
  pool: Pool,
  records: Array<{
    userId?: string | null;
    stripeCustomerId?: string | null;
    paymentCompleted?: boolean | null;
  }>,
): Promise<OrgStripeBackfillSummary> {
  const summary: OrgStripeBackfillSummary = {
    processed: 0, linked: 0, alreadySet: 0, conflict: 0,
    noOrg: 0, synthetic: 0, skipped: 0, errors: 0, conflicts: [],
  };

  for (const rec of records) {
    const userId = (rec.userId ?? "").trim();
    const stripeCustomerId = (rec.stripeCustomerId ?? "").trim();
    if (!rec.paymentCompleted || !userId || !stripeCustomerId) {
      summary.skipped += 1;
      continue;
    }
    // Syntetiske QA-/seed-records teller for seg selv, ikke som ekte kunder.
    if (isSyntheticStripeIdentity(userId, stripeCustomerId)) {
      summary.synthetic += 1;
      continue;
    }
    summary.processed += 1;
    const r = await linkOrgStripeCustomer(pool, { userId, stripeCustomerId });
    switch (r.reason) {
      case "linked": summary.linked += 1; break;
      case "already_set": summary.alreadySet += 1; break;
      case "conflict":
        summary.conflict += 1;
        if (r.organizationId) {
          summary.conflicts.push({ userId, organizationId: r.organizationId, stripeCustomerId });
        }
        break;
      case "no_org": summary.noOrg += 1; break;
      case "synthetic": summary.synthetic += 1; break;
      case "error": summary.errors += 1; break;
      default: summary.skipped += 1; break;
    }
  }

  return summary;
}
