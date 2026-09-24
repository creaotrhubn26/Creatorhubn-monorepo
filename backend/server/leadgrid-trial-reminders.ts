/**
 * Påminnelser før prøvetiden går ut.
 *
 * Ingen skal oppdage at prøvetiden er over ved at knappen slutter å virke.
 * De får beskjed to dager før, på siste dag, og den dagen det faktisk skjer.
 *
 * Tre varsler og ikke flere: prøvetiden er sju dager, og en e-post om dagen
 * fra dag én er mas, ikke hjelp. De to første kommer mens det fortsatt er
 * noe å gjøre med det; det siste forklarer hva som nettopp skjedde.
 *
 * Klokka går fra første Discovery-kjøring (leadgrid-trial.ts), så «to dager
 * igjen» betyr to dager igjen av reell bruk.
 */
import type { Pool } from "pg";

import { notifyAdmins } from "./admin-notify.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { evaluateTrial, type TrialStatus } from "./leadgrid-trial.js";
import { PROVIDER } from "./leadgrid-org-agreements.js";

// Leadgrid-e-post skal peke på leadgrid.no, ikke på CreatorHub. Resten av
// Leadgrid-koden leser LEADGRID_PUBLIC_URL, så den gjelder også her.
const APP_URL = (
  process.env.LEADGRID_PUBLIC_URL ??
  process.env.PUBLIC_APP_URL ??
  "https://leadgrid.no"
).replace(/\/+$/, "");

export interface TrialOrgRow {
  id: string;
  name: string;
  plan: string | null;
  stripe_subscription_id: string | null;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  trial_hard_expires_at: Date | null;
  trial_reminder_stage: number | null;
}

export interface TrialReminder {
  stage: 2 | 1 | 0;
  subject: string;
  heading: string;
  body: string;
  status: TrialStatus;
}

/**
 * Avgjør om denne organisasjonen skal ha et varsel nå, og hvilket.
 *
 * Ren funksjon med vilje: dette er det eneste som er verdt å teste, og det
 * eneste som kan sende en e-post til feil person på feil dag.
 */
export function planTrialReminder(
  rad: TrialOrgRow,
  now = new Date(),
): TrialReminder | null {
  const status = evaluateTrial(rad, now);
  if (status.state === "paid" || status.state === "not_started") return null;

  const stage: 2 | 1 | 0 | null =
    status.state === "expired"
      ? 0
      : status.days_left === 2
        ? 2
        : status.days_left === 1 || status.days_left === 0
          ? 1
          : null;
  if (stage === null) return null;

  // Tallet kan bare gå nedover. Har vi allerede sendt for 1 dag igjen, skal
  // det ikke gå et nytt varsel for 2 — og heller ikke to for samme trinn.
  const sendt = rad.trial_reminder_stage;
  if (sendt !== null && sendt !== undefined && sendt <= stage) return null;

  const tekster: Record<2 | 1 | 0, { subject: string; heading: string; body: string }> = {
    2: {
      subject: `To dager igjen av prøveperioden — ${rad.name}`,
      heading: "To dager igjen",
      body:
        "Prøveperioden deres i Leadgrid går ut om to dager. Etter det beholder " +
        "dere alle leadene dere har funnet, men kan ikke søke fram nye før " +
        "dere har valgt en avtale.",
    },
    1: {
      subject: `Siste dag av prøveperioden — ${rad.name}`,
      heading: "Siste dag",
      body:
        "I dag er siste dag av prøveperioden. Velger dere en avtale før " +
        "midnatt, merker dere ingen forskjell i morgen.",
    },
    0: {
      subject: `Prøveperioden er over — ${rad.name}`,
      heading: "Prøveperioden er over",
      body:
        "Prøveperioden er over. Leadene deres ligger der de lå, og dere kan " +
        "fortsatt jobbe med dem — men nye søk er stengt til dere har valgt en " +
        "avtale. Ingenting slettes.",
    },
  };

  return { stage, status, ...tekster[stage] };
}

function html(r: TrialReminder, orgNavn: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1a1a1a">
  <h2 style="margin:0 0 12px">${r.heading}</h2>
  <p style="margin:0 0 20px;line-height:1.55">${r.body}</p>
  <p style="margin:0 0 24px">
    <a href="${APP_URL}/leadgrid/priser"
       style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;
              padding:12px 22px;border-radius:8px;font-weight:600">Velg avtale</a>
  </p>
  <p style="margin:0;font-size:13px;color:#555">
    ${orgNavn} · avtale med ${PROVIDER.legalName}, org.nr ${PROVIDER.orgNumber}.
    Vil dere heller faktureres, svar på denne e-posten.
  </p>
</div>`;
}

/** Org-admins er de som kan gjøre noe med det. Selgerne kan ikke kjøpe noe. */
async function adminEpost(pool: Pool, organizationId: string): Promise<string[]> {
  const rader = await pool.query<{ email: string | null }>(
    `SELECT u.email
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = $1::uuid
        AND m.role IN ('admin', 'owner')
        AND u.email IS NOT NULL`,
    [organizationId],
  );
  return [...new Set(rader.rows.map((r) => r.email!.trim().toLowerCase()).filter(Boolean))];
}

export interface TrialReminderResult {
  checked: number;
  sent: number;
  skipped_no_admin: number;
  failed: number;
}

export async function sendTrialReminders(
  pool: Pool,
  now = new Date(),
): Promise<TrialReminderResult> {
  const rader = await pool.query<TrialOrgRow>(
    `SELECT id::text, name, plan, stripe_subscription_id,
            trial_started_at, trial_ends_at, trial_hard_expires_at,
            trial_reminder_stage
       FROM organizations
      WHERE stripe_subscription_id IS NULL
        AND (trial_ends_at IS NOT NULL OR trial_hard_expires_at IS NOT NULL)`,
  );

  const ut: TrialReminderResult = { checked: rader.rows.length, sent: 0, skipped_no_admin: 0, failed: 0 };

  for (const rad of rader.rows) {
    const varsel = planTrialReminder(rad, now);
    if (!varsel) continue;

    const mottakere = await adminEpost(pool, rad.id);
    if (mottakere.length === 0) {
      // Ingen å varsle. Merk likevel trinnet: uten det prøver cron-en igjen
      // hver dag i all evighet på en organisasjon uten admin.
      ut.skipped_no_admin += 1;
      await markerSendt(pool, rad.id, varsel.stage);
      continue;
    }

    let noenFikkDen = false;
    for (const epost of mottakere) {
      try {
        const svar = await sendTransactionalEmail({
          to: epost,
          subject: varsel.subject,
          html: html(varsel, rad.name),
          text: `${varsel.heading}\n\n${varsel.body}\n\nVelg avtale: ${APP_URL}/leadgrid/priser`,
          fromLabel: PROVIDER.legalName,
          kind: "leadgrid_trial_reminder",
          pool,
        });
        if (svar.sent) noenFikkDen = true;
      } catch (error) {
        console.warn("[provetid] varsel feilet:", (error as Error).message);
      }
    }

    if (noenFikkDen) {
      ut.sent += 1;
      await markerSendt(pool, rad.id, varsel.stage);
    } else {
      // Ikke merk trinnet: da prøver morgendagens kjøring på nytt, som er
      // riktig når det var leverandøren som sviktet og ikke mottakeren.
      ut.failed += 1;
    }

    // Du skal se at en kunde nærmer seg valget før de gjør det, ikke etterpå.
    await notifyAdmins(pool, {
      type: "leadgrid_trial_reminder",
      source: "Leadgrid · prøvetid",
      title: `${varsel.heading}: ${rad.name}`,
      summary:
        `${mottakere.length ? mottakere.join(", ") : "ingen org-admin å varsle"}` +
        `${noenFikkDen ? "" : " · E-POST IKKE SENDT"}`,
      link: `/superadmin?org=${rad.id}`,
    }).catch(() => undefined);
  }

  return ut;
}

async function markerSendt(pool: Pool, organizationId: string, stage: number): Promise<void> {
  await pool.query(
    `UPDATE organizations SET trial_reminder_stage = $2 WHERE id = $1::uuid`,
    [organizationId, stage],
  );
}
