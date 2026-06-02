/**
 * role-room-partnerships-emails.ts
 *
 * E-postvarsler for partnership-flyten. Matcher samme dark-purple-stil som
 * agency-talent-proposals + bruker transactional-email-service (Resend).
 *
 * Fire varsler:
 *   1. partnership_proposed → mottaker (motparten av proposer)
 *   2. partnership_accepted → proposer (de som foreslo)
 *   3. project_invitation_sent → byrå-admin
 *   4. project_invitation_accepted → produksjon
 *
 * Alle bruker `kind`-tag i transactional_email_log for senere debug.
 * Hvis e-post-config mangler logges resultatet men errorer ikke ut —
 * partnership-aksjonen skal aldri stoppe pga e-post-feil.
 */

import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appBaseUrl(): string {
  return process.env.ROLE_ROOM_BASE_URL?.trim() || "https://theroleroom.com";
}

/** Felles header-stil for alle partnership-e-poster. */
function shellHtml(eyebrow: string, body: string): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 20px; background: #0a0118; color: #f5f3ff;">
  <div style="background: #150b2e; border: 1px solid rgba(168,85,247,0.18); border-radius: 16px; padding: 32px;">
    <div style="color: #c084fc; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 12px;">
      ${escapeHtml(eyebrow)}
    </div>
    ${body}
    <p style="color: #8b7ec4; font-size: 12px; margin-top: 32px;">
      The Role Room · Creatorhub AS · <a href="https://theroleroom.com/privacy" style="color: #c084fc;">Personvern</a>
    </p>
  </div>
</body></html>`;
}

const PRIMARY_BTN = `display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #a855f7 0%, #d946ef 100%); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; margin: 12px 0;`;

// ── 1. partnership_proposed ────────────────────────────────────────
export async function sendPartnershipProposed(
  pool: Pool,
  args: {
    partnershipId: string;
    proposedBy: "agency" | "production";
    agencyName: string;
    agencyLogoUrl: string | null;
    productionName: string;
    proposerName: string;
    message: string | null;
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  const isAgencyInitiated = args.proposedBy === "agency";
  const eyebrow = isAgencyInitiated
    ? "Forslag fra et casting-byrå"
    : "Forslag fra et produksjonsteam";
  const headline = isAgencyInitiated
    ? `${args.agencyName} vil samarbeide`
    : `${args.productionName} vil samarbeide`;
  const intro = isAgencyInitiated
    ? `Bryået ${args.agencyName} har foreslått et partnership med produksjonsteamet ditt. Hvis dere godkjenner, kan dere invitere dem til spesifikke casting-prosjekter.`
    : `Produksjonsteamet ${args.productionName} har foreslått et partnership med byrået ditt. Hvis dere godkjenner, kan de invitere dere til spesifikke casting-prosjekter med valgte roller.`;
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;

  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <p style="color: #c4b5fd; line-height: 1.6;">${escapeHtml(intro)}</p>
    ${
      args.message
        ? `<div style="margin: 20px 0; padding: 14px 18px; background: #1a0f3a; border-left: 3px solid #a855f7; border-radius: 0 8px 8px 0;">
        <div style="color: #8b7ec4; font-size: 12px; margin-bottom: 4px;">Personlig melding fra ${escapeHtml(args.proposerName)}:</div>
        <div style="color: #c4b5fd; font-style: italic; font-size: 15px;">"${escapeHtml(args.message)}"</div>
      </div>`
        : ""
    }
    <div style="margin: 24px 0; padding: 18px; background: rgba(168,85,247,0.10); border: 1px solid rgba(168,85,247,0.32); border-radius: 12px;">
      <div style="color: #f5f3ff; font-weight: 700; margin-bottom: 6px;">Du eier dette valget</div>
      <div style="color: #c4b5fd; font-size: 14px;">Hvis du aksepterer, kan dere samarbeide om casting-prosjekter framover. Du kan pause eller avslutte når som helst.</div>
    </div>
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Åpne forslaget
    </a>
  `;
  const subject = isAgencyInitiated
    ? `${args.agencyName} vil samarbeide med dere`
    : `${args.productionName} vil samarbeide med dere`;
  const text = `${headline}\n\n${intro}\n\n${args.message ? `Melding: ${args.message}\n\n` : ""}Åpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: isAgencyInitiated ? `${args.agencyName} via The Role Room` : "The Role Room",
    kind: `partnership_proposed_${args.proposedBy}`,
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}

// ── 2. partnership_accepted ────────────────────────────────────────
export async function sendPartnershipAccepted(
  pool: Pool,
  args: {
    partnershipId: string;
    agencyName: string;
    productionName: string;
    accepterRole: "agency" | "production";
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  // Den som mottar mailen er proposeren (motsatt av accepter)
  const accepterLabel = args.accepterRole === "agency" ? args.agencyName : args.productionName;
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;
  const eyebrow = "Partnership akseptert";
  const headline = `${accepterLabel} har godkjent samarbeidet`;
  const intro = args.accepterRole === "agency"
    ? `Bryået ${args.agencyName} har akseptert partnership-forslaget. Du kan nå invitere dem til spesifikke casting-prosjekter med valgte roller.`
    : `Produksjonsteamet ${args.productionName} har akseptert partnership-forslaget. De kan nå invitere dere til casting-prosjekter, og dere kan foreslå talenter til prosjekt-rollene.`;
  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <p style="color: #c4b5fd; line-height: 1.6;">${escapeHtml(intro)}</p>
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Åpne partnerships
    </a>
  `;
  const subject = `${accepterLabel} godkjente partnership`;
  const text = `${headline}\n\n${intro}\n\nÅpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: "The Role Room",
    kind: "partnership_accepted",
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}

// ── 3. project_invitation_sent (produksjon → byrå) ─────────────────
export async function sendProjectInvitationSent(
  pool: Pool,
  args: {
    invitationId: string;
    partnershipId: string;
    agencyName: string;
    productionName: string;
    projectName: string;
    projectType: string | null;
    startDate: string | null;
    endDate: string | null;
    roleCount: number | null;
    notes: string | null;
    expiresAt: string | null;
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;
  const eyebrow = "Ny prosjekt-invitasjon";
  const headline = `${args.productionName} inviterer dere til ${args.projectName}`;
  const dateLine = [args.startDate, args.endDate].filter(Boolean).join(" → ") || "Datoer ikke satt";
  const roleLine = args.roleCount
    ? `${args.roleCount} valgte roller å foreslå talenter til`
    : "Alle roller i prosjektet er åpne for forslag";
  const expLine = args.expiresAt
    ? `Utløper ${new Date(args.expiresAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" })}`
    : null;

  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <div style="margin: 16px 0; padding: 14px 16px; background: #1a0f3a; border-radius: 8px;">
      <div style="color: #8b7ec4; font-size: 12px; margin-bottom: 6px;">Prosjektdetaljer</div>
      <div style="color: #f5f3ff; font-size: 14px; line-height: 1.7;">
        <strong>${escapeHtml(args.projectName)}</strong>${args.projectType ? ` · ${escapeHtml(args.projectType)}` : ""}<br/>
        ${escapeHtml(dateLine)}<br/>
        ${escapeHtml(roleLine)}
        ${expLine ? `<br/><span style="color:#fbbf24;">${escapeHtml(expLine)}</span>` : ""}
      </div>
    </div>
    ${
      args.notes
        ? `<div style="margin: 16px 0; padding: 14px 18px; background: #1a0f3a; border-left: 3px solid #a855f7; border-radius: 0 8px 8px 0;">
        <div style="color: #8b7ec4; font-size: 12px; margin-bottom: 4px;">Beskjed fra ${escapeHtml(args.productionName)}:</div>
        <div style="color: #c4b5fd; font-style: italic; font-size: 15px;">"${escapeHtml(args.notes)}"</div>
      </div>`
        : ""
    }
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Se invitasjonen
    </a>
  `;
  const subject = `${args.productionName} inviterer dere til ${args.projectName}`;
  const text = `${headline}\n\nProsjekt: ${args.projectName}${args.projectType ? ` (${args.projectType})` : ""}\nDatoer: ${dateLine}\n${roleLine}\n${args.notes ? `\nBeskjed: ${args.notes}\n` : ""}\nÅpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: `${args.productionName} via The Role Room`,
    kind: "partnership_project_invitation_sent",
    projectId: null,
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}

// ── 4. project_invitation_accepted (byrå → produksjon) ─────────────
export async function sendProjectInvitationAccepted(
  pool: Pool,
  args: {
    invitationId: string;
    agencyName: string;
    projectName: string;
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;
  const eyebrow = "Invitasjon akseptert";
  const headline = `${args.agencyName} er med på ${args.projectName}`;
  const intro = `Bryået har akseptert prosjekt-invitasjonen. De kan nå se rollene dere har lagt inn og begynner å foreslå talenter.`;
  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <p style="color: #c4b5fd; line-height: 1.6;">${escapeHtml(intro)}</p>
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Åpne partnerships
    </a>
  `;
  const subject = `${args.agencyName} godtok invitasjonen til ${args.projectName}`;
  const text = `${headline}\n\n${intro}\n\nÅpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: "The Role Room",
    kind: "partnership_project_invitation_accepted",
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}

// ── 5. talent_proposed_by_agency → produksjon ──────────────────────
export async function sendTalentProposedByAgency(
  pool: Pool,
  args: {
    proposalId: string;
    talentDisplayName: string;
    agencyName: string;
    projectName: string;
    roleName: string | null;
    agencyNotes: string | null;
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;
  const eyebrow = "Nytt talent-forslag";
  const headline = `${args.agencyName} foreslår ${args.talentDisplayName}`;
  const roleLine = args.roleName ? `Rolle: ${args.roleName}` : "Ingen spesifikk rolle valgt";
  const intro = `Bryået har foreslått ${args.talentDisplayName} til ${args.projectName}. ${roleLine}.`;
  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <p style="color: #c4b5fd; line-height: 1.6;">${escapeHtml(intro)}</p>
    ${
      args.agencyNotes
        ? `<div style="margin: 16px 0; padding: 14px 18px; background: #1a0f3a; border-left: 3px solid #a855f7; border-radius: 0 8px 8px 0;">
        <div style="color: #8b7ec4; font-size: 12px; margin-bottom: 4px;">Bryåets kommentar:</div>
        <div style="color: #c4b5fd; font-style: italic; font-size: 15px;">"${escapeHtml(args.agencyNotes)}"</div>
      </div>`
        : ""
    }
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Se forslaget
    </a>
  `;
  const subject = `${args.agencyName} foreslår ${args.talentDisplayName} til ${args.projectName}`;
  const text = `${headline}\n\n${intro}\n${args.agencyNotes ? `\nKommentar: ${args.agencyNotes}\n` : ""}\nÅpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: `${args.agencyName} via The Role Room`,
    kind: "partnership_talent_proposed",
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}

// ── 6. talent_proposal_responded → byrå ────────────────────────────
export async function sendTalentProposalResponded(
  pool: Pool,
  args: {
    proposalId: string;
    accepted: boolean;
    talentDisplayName: string;
    projectName: string;
    productionName: string;
    productionNotes: string | null;
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;
  const eyebrow = args.accepted ? "Forslag akseptert" : "Forslag avslått";
  const headline = args.accepted
    ? `${args.productionName} aksepterte ${args.talentDisplayName}`
    : `${args.productionName} valgte å ikke gå videre med ${args.talentDisplayName}`;
  const intro = args.accepted
    ? `Produksjonsteamet har tatt ${args.talentDisplayName} videre i prosessen for ${args.projectName}. Følg opp med talenten i prosjektromsfanen.`
    : `Produksjonsteamet valgte å ikke gå videre med ${args.talentDisplayName} for ${args.projectName} denne gangen.`;
  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <p style="color: #c4b5fd; line-height: 1.6;">${escapeHtml(intro)}</p>
    ${
      args.productionNotes
        ? `<div style="margin: 16px 0; padding: 14px 18px; background: #1a0f3a; border-left: 3px solid #a855f7; border-radius: 0 8px 8px 0;">
        <div style="color: #8b7ec4; font-size: 12px; margin-bottom: 4px;">Tilbakemelding fra ${escapeHtml(args.productionName)}:</div>
        <div style="color: #c4b5fd; font-style: italic; font-size: 15px;">"${escapeHtml(args.productionNotes)}"</div>
      </div>`
        : ""
    }
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Åpne partnerships
    </a>
  `;
  const subject = args.accepted
    ? `${args.talentDisplayName} akseptert til ${args.projectName}`
    : `${args.talentDisplayName} ikke valgt for ${args.projectName}`;
  const text = `${headline}\n\n${intro}\n${args.productionNotes ? `\nTilbakemelding: ${args.productionNotes}\n` : ""}\nÅpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: "The Role Room",
    kind: args.accepted
      ? "partnership_talent_proposal_accepted"
      : "partnership_talent_proposal_declined",
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}

// ── 7. candidate_status_update → byrå ──────────────────────────────
export async function sendCandidateStatusUpdate(
  pool: Pool,
  args: {
    candidateId: string;
    proposalId: string;
    talentDisplayName: string;
    projectName: string;
    productionName: string;
    previousStatus: string;
    newStatus: string;
    productionNotes: string | null;
    recipientEmail: string;
    sentByUserId: string;
  },
): Promise<{ sent: boolean; reason: string | null }> {
  const statusLabels: Record<string, string> = {
    pending: "Avventer", screening: "Screening",
    callback: "Callback", callbacks: "Callback",
    final: "Final selection", cast: "Castet", selected: "Valgt",
    declined: "Ikke valgt", withdrawn: "Trukket",
    hold: "På hold", passed: "Passet på",
  };
  const newLabel = statusLabels[args.newStatus] ?? args.newStatus;
  const prevLabel = statusLabels[args.previousStatus] ?? args.previousStatus;

  const positive = ["callback", "callbacks", "final", "cast", "selected"].includes(args.newStatus);
  const ctaUrl = `${appBaseUrl()}/talents/partnerships`;
  const eyebrow = positive ? "Talent flyttet videre" : "Status-oppdatering";
  const headline = `${args.talentDisplayName}: ${prevLabel} → ${newLabel}`;
  const intro = positive
    ? `${args.productionName} har tatt ${args.talentDisplayName} videre til ${newLabel} for ${args.projectName}.`
    : `Status for ${args.talentDisplayName} i ${args.projectName} ble endret til ${newLabel}.`;
  const body = `
    <h1 style="color: #f5f3ff; font-size: 22px; font-weight: 800; margin: 0 0 16px;">
      ${escapeHtml(headline)}
    </h1>
    <p style="color: #c4b5fd; line-height: 1.6;">${escapeHtml(intro)}</p>
    ${
      args.productionNotes
        ? `<div style="margin: 16px 0; padding: 14px 18px; background: #1a0f3a; border-left: 3px solid #a855f7; border-radius: 0 8px 8px 0;">
        <div style="color: #8b7ec4; font-size: 12px; margin-bottom: 4px;">Notat fra ${escapeHtml(args.productionName)}:</div>
        <div style="color: #c4b5fd; font-style: italic; font-size: 15px;">"${escapeHtml(args.productionNotes)}"</div>
      </div>`
        : ""
    }
    <a href="${escapeHtml(ctaUrl)}" style="${PRIMARY_BTN}">
      Åpne partnerships
    </a>
  `;
  const subject = positive
    ? `${args.talentDisplayName} videre til ${newLabel}`
    : `${args.talentDisplayName}: status er ${newLabel}`;
  const text = `${headline}\n\n${intro}\n${args.productionNotes ? `\nNotat: ${args.productionNotes}\n` : ""}\nÅpne: ${ctaUrl}`;

  const r = await sendTransactionalEmail({
    to: args.recipientEmail,
    subject,
    html: shellHtml(eyebrow, body),
    text,
    fromLabel: "The Role Room",
    kind: `partnership_candidate_status_${args.newStatus}`,
    sentByUserId: args.sentByUserId,
    pool,
  });
  return { sent: r.sent, reason: r.reason ?? null };
}
