/**
 * linkedin-leadsync-service.ts
 *
 * LinkedIn Lead Sync API — poller /v2/leadFormResponses for hver
 * linkedin_lead_forms-rad og mapper inn i agency_leads.
 *
 * Inntil LinkedIn godkjenner søknaden vår: pollene logger en error i
 * last_poll_status så vi kan se status i Cockpit. Så snart godkjent
 * fyller agency_leads opp automatisk uten kode-endring.
 */

import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { composeEmail } from "./email-design-system.js";
import { resolveDefaultLinkedInOrg } from "./linkedin-oauth-routes.js";
import { fireAgencyLeadConversion } from "./linkedin-conversions-service.js";

interface LeadFormResponseField {
  questionId?: string;
  questionText?: string;
  answer?: string | { text?: string };
}

interface LeadFormResponse {
  id?: string;
  leadGenForm?: string;
  submittedAt?: number;                  // unix ms
  member?: string;                       // urn:li:person:...
  formResponse?: {
    answers?: LeadFormResponseField[];
  };
}

const PUBLIC_URL = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

export async function pollLeadFormsDue(pool: Pool): Promise<{
  formsPolled: number;
  responsesFetched: number;
  leadsCreated: number;
}> {
  // Plukk forms som er due til polling
  const due = await pool.query(
    `SELECT id::text, form_urn, form_name, field_mapping,
            last_response_id, poll_interval_seconds
       FROM linkedin_lead_forms
      WHERE active = TRUE
        AND (last_polled_at IS NULL
             OR last_polled_at < now() - (poll_interval_seconds || ' seconds')::interval)
      ORDER BY last_polled_at NULLS FIRST
      LIMIT 20`,
  );

  let responsesFetched = 0;
  let leadsCreated = 0;

  const resolved = await resolveDefaultLinkedInOrg(pool);
  if (!resolved) {
    // LinkedIn ikke koblet — bump last_polled_at uten å feile
    for (const form of due.rows) {
      await pool.query(
        `UPDATE linkedin_lead_forms
            SET last_polled_at = now(),
                last_poll_status = 'error',
                last_poll_error = 'LinkedIn-org ikke koblet'
          WHERE id = $1::uuid`,
        [form.id],
      );
    }
    return { formsPolled: due.rowCount ?? 0, responsesFetched: 0, leadsCreated: 0 };
  }

  for (const form of due.rows) {
    try {
      // Hent responses (LinkedIn Marketing API endepunkt)
      // Bruk start-token = last_response_id hvis vi har en (paginering)
      const params = new URLSearchParams({
        q: "owner",
        leadGenForm: form.form_urn,
      });
      // LM-4: 8s timeout — leadsync er cron-driven, ikke kritisk å henge
      const resp = await fetch(
        `https://api.linkedin.com/rest/leadFormResponses?${params}`,
        {
          headers: {
            Authorization: `Bearer ${resolved.accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": "202410",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        await pool.query(
          `UPDATE linkedin_lead_forms
              SET last_polled_at = now(),
                  last_poll_status = 'error',
                  last_poll_error = $1
            WHERE id = $2::uuid`,
          [`${resp.status} ${errText.slice(0, 400)}`, form.id],
        );
        continue;
      }

      const data = await resp.json() as { elements?: LeadFormResponse[] };
      const elements = data.elements ?? [];

      let newCount = 0;
      // LM-6: per-form counter — den globale `leadsCreated` ble brukt
      // som UPDATE-param og inflaterte stats for hver påfølgende form
      // i samme batch ($3 = leadsCreated, men $2 = newCount per-form).
      let formLeadsCreated = 0;
      let maxId = form.last_response_id ?? "";

      for (const r of elements) {
        if (!r.id) continue;
        if (form.last_response_id && r.id <= form.last_response_id) continue;
        responsesFetched++;
        newCount++;
        if (r.id > maxId) maxId = r.id;

        // Lagre raw + opprett agency_lead
        try {
          const lead = await mapResponseToAgencyLead(pool, form, r);
          await pool.query(
            `INSERT INTO linkedin_lead_responses (
               form_id, response_id, raw_payload,
               agency_lead_id, mapped_at, submitted_at
             ) VALUES ($1::uuid, $2, $3::jsonb, $4::uuid, now(), $5::timestamptz)
             ON CONFLICT (form_id, response_id) DO NOTHING`,
            [
              form.id,
              r.id,
              JSON.stringify(r),
              lead.id,
              r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
            ],
          );
          if (lead.created) {
            leadsCreated++;       // global batch-total (returneres)
            formLeadsCreated++;   // per-form (UPDATE)
          }
        } catch (mapErr) {
          await pool.query(
            `INSERT INTO linkedin_lead_responses (
               form_id, response_id, raw_payload, mapping_error, submitted_at
             ) VALUES ($1::uuid, $2, $3::jsonb, $4, $5::timestamptz)
             ON CONFLICT (form_id, response_id) DO UPDATE SET mapping_error = EXCLUDED.mapping_error`,
            [
              form.id,
              r.id,
              JSON.stringify(r),
              String(mapErr).slice(0, 400),
              r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
            ],
          );
        }
      }

      // Oppdater poll-state
      await pool.query(
        `UPDATE linkedin_lead_forms
            SET last_polled_at = now(),
                last_poll_status = 'ok',
                last_poll_error = NULL,
                last_response_id = COALESCE(NULLIF($1, ''), last_response_id),
                total_responses_fetched = total_responses_fetched + $2,
                total_leads_created = total_leads_created + $3
          WHERE id = $4::uuid`,
        [maxId, newCount, formLeadsCreated, form.id],
      );
    } catch (err) {
      await pool.query(
        `UPDATE linkedin_lead_forms
            SET last_polled_at = now(),
                last_poll_status = 'error',
                last_poll_error = $1
          WHERE id = $2::uuid`,
        [String(err).slice(0, 400), form.id],
      );
    }
  }

  return {
    formsPolled: due.rowCount ?? 0,
    responsesFetched,
    leadsCreated,
  };
}

/**
 * Map LinkedIn Lead Form-response til agency_leads-rad. Bruker
 * field_mapping fra linkedin_lead_forms (JSONB) til å peke
 * LinkedIn-felter til våre kolonner.
 */
async function mapResponseToAgencyLead(
  pool: Pool,
  form: {
    id: string;
    form_urn: string;
    form_name: string | null;
    field_mapping: Record<string, string>;
  },
  resp: LeadFormResponse,
): Promise<{ id: string; created: boolean }> {
  // Bygg map av answer-tekst per questionText
  const answers = new Map<string, string>();
  for (const a of resp.formResponse?.answers ?? []) {
    const q = a.questionText ?? a.questionId ?? "";
    const val = typeof a.answer === "string" ? a.answer : a.answer?.text ?? "";
    if (q && val) answers.set(q.toLowerCase().trim(), val.trim());
  }

  // Hent felter via mapping
  const fields: Record<string, string | null> = {
    agency_name: null,
    contact_name: null,
    email: null,
    phone: null,
    roster_size: null,
    message: null,
  };
  for (const [linkedinKey, ourCol] of Object.entries(form.field_mapping)) {
    const v = answers.get(linkedinKey.toLowerCase());
    if (v && ourCol in fields) fields[ourCol] = v;
  }

  // Fallbacks: prøv vanlige LinkedIn-felter
  if (!fields.email) {
    fields.email = answers.get("email") ?? answers.get("e-post") ?? null;
  }
  if (!fields.agency_name) {
    fields.agency_name = answers.get("company") ?? answers.get("byrå") ?? "Ukjent byrå";
  }
  if (!fields.contact_name) {
    const first = answers.get("first name") ?? answers.get("fornavn") ?? "";
    const last = answers.get("last name") ?? answers.get("etternavn") ?? "";
    fields.contact_name = `${first} ${last}`.trim() || "Ukjent";
  }
  if (!fields.phone) {
    fields.phone = answers.get("phone") ?? answers.get("telefon") ?? null;
  }

  if (!fields.email) {
    throw new Error("Mangler email i Lead Form-respons");
  }

  const upserted = await pool.query(
    `INSERT INTO agency_leads (
       agency_name, contact_name, email, phone, roster_size,
       segment, message, source, utm_source, utm_medium, utm_campaign,
       request_context
     ) VALUES ($1, $2, $3, $4, $5,
               'skuespillerbyrå', $6, 'linkedin_lead_sync', 'linkedin', 'paid', $7,
               $8::jsonb)
     ON CONFLICT (email, segment) DO UPDATE SET
       agency_name = EXCLUDED.agency_name,
       contact_name = EXCLUDED.contact_name,
       phone = COALESCE(EXCLUDED.phone, agency_leads.phone),
       roster_size = COALESCE(EXCLUDED.roster_size, agency_leads.roster_size),
       updated_at = now()
     RETURNING id::text, (xmax = 0) AS created`,
    [
      fields.agency_name,
      fields.contact_name,
      fields.email.toLowerCase(),
      fields.phone,
      fields.roster_size,
      fields.message,
      form.form_name ?? "linkedin_lead_form",
      JSON.stringify({
        linkedin_form_urn: form.form_urn,
        linkedin_response_id: resp.id,
        submitted_at: resp.submittedAt,
      }),
    ],
  );

  const lead = upserted.rows[0];
  const isCreated = lead.created;

  // Trigge samme nurture + conversion event som andre channels
  if (isCreated && fields.email) {
    // Fire conversion event (Lead — fires regardless if LinkedIn approved CAPI yet)
    try {
      await fireAgencyLeadConversion(pool, {
        leadId: lead.id,
        email: fields.email,
        firstName: fields.contact_name?.split(" ")[0],
        lastName: fields.contact_name?.split(" ").slice(1).join(" "),
        agencyName: fields.agency_name ?? "",
      });
    } catch (err) {
      console.warn("[lead-sync] CAPI queue failed", err);
    }

    // Send bekreftelse til lead (samme stil som /for-byraer-flowen)
    void (async () => {
      try {
        const composed = composeEmail({
          category: "lead_ack",
          subject: "Vi har mottatt forespørselen din — The Role Room",
          preheader: `Daniel kommer tilbake innen 24 timer med demo-tider for ${fields.agency_name}.`,
          headline: "Takk! Vi tar kontakt innen 24 timer",
          subhead: `Hei ${fields.contact_name?.split(" ")[0]} — vi har mottatt forespørselen fra ${fields.agency_name} via LinkedIn og kommer tilbake med 3 demo-tider du kan velge mellom.`,
          cta: { label: "Se hva The Role Room er", href: `${PUBLIC_URL}/pitch` },
          footer: { reason: "Du fylte ut en LinkedIn Lead Gen Form for The Role Room." },
        });
        await sendTransactionalEmail({
          to: fields.email!,
          subject: "Vi har mottatt forespørselen din — The Role Room",
          fromLabel: "The Role Room",
          kind: "linkedin_lead_ack",
          html: composed.html,
          text: composed.text,
          pool,
        });
      } catch { /* best-effort */ }
    })();
  }

  return { id: lead.id, created: isCreated };
}
