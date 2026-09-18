/**
 * leadgrid-vunnet-konvertering.ts
 *
 * Den siste lenken i sløyfa: når en avtale vinnes, får Meta vite det.
 *
 * Alt annet var på plass — sendServerSideConversion sender med
 * action_source "system_generated", pixelen for leadgrid.no finnes, og
 * klikk-ID-en lagres på leadet (mig 0637). Det som manglet var at INGEN
 * kalte den. Uten dette lærer Meta bare hvilke skjemaer som ble fylt ut, og
 * fortsetter å optimalisere mot billige utfyllinger i stedet for mot
 * avtaler som faktisk lukkes.
 *
 * GRENSEN SOM MÅ HOLDES: dette gjelder BARE leads som kom inn på
 * leadgrid.no. Leadgrid brukes av andre bedrifter, og deres vunne avtaler
 * skal aldri havne i vår pixel. Derfor kreves det at leadet har en
 * landingsside på en leadgrid-vert OG en fbclid. Er du i tvil, send ingenting.
 *
 * For Leadgrid-KUNDENES egne annonsekontoer trengs per-prosjekt-koblinger
 * som Leadgrid eier selv. Det er en egen sak; se
 * docs/evidence/2026-09-tiktok-meta-leadgrid-attribusjon.yaml.
 */

import type { Pool } from "pg";
import { sendServerSideConversion, LEADGRID_HOSTS } from "./meta-conversions-api.js";

interface LeadRad {
  email: string | null;
  phone: string | null;
  name: string | null;
  fbclid: string | null;
  landing_page_url: string | null;
  /** Beløpet fra primærsalget (mig 0635), med kunde-raden som reserve. */
  belop: string | null;
  valuta: string | null;
}

/** Hører landingssiden til leadgrid.no? Ukjent eller uparsbar = nei. */
export function erLeadgridLanding(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return LEADGRID_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface VunnetResultat {
  status: "sendt" | "hoppet_over";
  grunn?: string;
}

/**
 * Kalles når et salg går til 'won'. Feiler aldri oppover: en annonseplattform
 * som er nede skal ikke velte registreringen av at avtalen er vunnet.
 */
export async function meldVunnetAvtaleTilMeta(
  pool: Pool,
  opts: {
    leadId: string;
    dealId: string | null;
    organizationId: string;
    projectId: string;
    belop: number | null;
    valuta?: string | null;
  },
): Promise<VunnetResultat> {
  try {
    const r = await pool.query<LeadRad>(
      // Beløpet slås opp her i stedet for å komme med eventet. Da slipper
      // hver enkelt publiserer å huske å sende det med — og de gjør ikke
      // det i dag: PATCH-endepunktet sender bare from/to.
      `SELECT c.email, c.phone, c.name, c.fbclid, c.landing_page_url,
              COALESCE(d.deal_amount, c.deal_amount)::text AS belop,
              COALESCE(d.currency, 'NOK') AS valuta
         FROM crm_customers c
         LEFT JOIN leadgrid_deals d
           ON d.customer_id = c.id AND d.is_primary AND d.archived_at IS NULL
        WHERE c.id = $1::uuid
          AND c.organization_id = $2::uuid
          AND c.project_id = $3
        LIMIT 1`,
      [opts.leadId, opts.organizationId, opts.projectId],
    );
    const lead = r.rows[0];
    if (!lead) return { status: "hoppet_over", grunn: "lead_ikke_funnet" };

    // Begge kreves. Uten fbclid kan Meta uansett ikke koble avtalen til et
    // klikk, og uten leadgrid-landingsside vet vi ikke at leadet er vårt.
    if (!lead.fbclid) return { status: "hoppet_over", grunn: "ingen_fbclid" };
    if (!erLeadgridLanding(lead.landing_page_url)) {
      return { status: "hoppet_over", grunn: "ikke_leadgrid_landingsside" };
    }
    if (!lead.email && !lead.phone) {
      // Meta krever minst én identifikator for å matche.
      return { status: "hoppet_over", grunn: "ingen_identifikator" };
    }

    // Beløpet fra kallet vinner når det er gitt; ellers det vi fant.
    const belop =
      opts.belop ?? (lead.belop != null ? Number(lead.belop) : null);
    const valuta = opts.valuta ?? lead.valuta ?? "NOK";

    const navn = (lead.name ?? "").trim().split(/\s+/);
    const res = await sendServerSideConversion({
      eventName: "Purchase",
      // Meta deduplikerer på event_id. Vinnes den samme avtalen igjen etter
      // en runde om 'lost', teller den fortsatt én gang.
      eventId: `leadgrid-deal-${opts.dealId ?? opts.leadId}`,
      userData: {
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        firstName: navn[0] || undefined,
        lastName: navn.length > 1 ? navn[navn.length - 1] : undefined,
        externalId: opts.leadId,
      },
      customData:
        belop != null && Number.isFinite(belop)
          ? { value: belop, currency: valuta.toUpperCase() }
          : undefined,
      eventSourceUrl: lead.landing_page_url ?? undefined,
      siteKey: "leadgrid",
    });
    return res.sent
      ? { status: "sendt" }
      : { status: "hoppet_over", grunn: `meta_avviste:${String(res.error ?? "").slice(0, 80)}` };
  } catch (err) {
    // Aldri kast. En vunnet avtale er registrert uansett hva Meta mener.
    console.warn("[vunnet-konvertering] feilet:", (err as Error)?.message);
    return { status: "hoppet_over", grunn: "unntak" };
  }
}
