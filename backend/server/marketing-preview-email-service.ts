/**
 * Email-notify for video-preview-flyten.
 *
 * Bjarne laster opp en preview → klient får e-post med magic-link til
 * portalen. Klient kommenterer → Bjarne får e-post som kobler til
 * Post Agent's CollaborationSidebar (eller bare en oppsummering).
 *
 * Begge sendinger er "best-effort" — feilet e-post skal aldri blokkere
 * den underliggende handlingen (preview lagres uansett, kommentaren
 * postes uansett). Vi logger og returnerer ok=false.
 */

import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";

function getClientPortalBaseUrl(): string {
  const raw = process.env.ROLE_ROOM_PUBLIC_URL?.trim()
    || process.env.CREATORHUB_PUBLIC_URL?.trim()
    || "https://creatorhubn.com";
  return raw.replace(/\/$/, "");
}

interface SendArgs {
  pool: Pool;
  projectId: string;
  postId: string;
}

/**
 * Send "ny preview tilgjengelig"-e-post til alle aktive klient-portal-
 * sesjoner for prosjektet. Vi sender til hver klient som har en aktiv
 * magic-link — det dekker også prosjekter med flere parallelle klienter.
 */
export async function notifyClientsOfNewPreview(args: SendArgs): Promise<{
  ok: boolean; sent: number; total: number;
}> {
  const { pool, projectId, postId } = args;
  try {
    const { rows: sessionRows } = await pool.query<{
      sessionToken: string; clientEmail: string; clientName: string | null;
    }>(
      `SELECT session_token AS "sessionToken",
              client_email   AS "clientEmail",
              client_name    AS "clientName"
         FROM client_portal_sessions
        WHERE project_id = $1
          AND status = 'active'
          AND expires_at > now()`,
      [projectId],
    );
    if (sessionRows.length === 0) {
      return { ok: true, sent: 0, total: 0 };
    }

    // Hent post + project-tittel for personlig email
    const { rows: postRows } = await pool.query<{
      hook: string; projectTitle: string | null;
    }>(
      `SELECT p.hook,
              prj.name AS "projectTitle"
         FROM role_room_marketing_plan_posts p
         JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
         LEFT JOIN projects prj ON prj.id = mp.project_id
        WHERE p.id = $1`,
      [postId],
    );
    const post = postRows[0];
    const hook = post?.hook ?? "din planlagte post";
    const projectTitle = post?.projectTitle ?? "ditt prosjekt";

    const base = getClientPortalBaseUrl();
    let sent = 0;
    for (const s of sessionRows) {
      const link = `${base}/client/portal/${encodeURIComponent(s.sessionToken)}`;
      const greeting = s.clientName ? `Hei ${s.clientName}` : "Hei";
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.6;color:#1a0f2e">
          <h2 style="color:#6e3fc7;margin:0 0 16px">Ny preview klar for review</h2>
          <p>${greeting},</p>
          <p>Det er lastet opp en video-preview til posten <strong>"${escapeHtml(hook)}"</strong> i ${escapeHtml(projectTitle)}.</p>
          <p>Du kan se videoen, godkjenne, kommentere eller be om endring direkte i portalen:</p>
          <p>
            <a href="${link}"
               style="display:inline-block;background:linear-gradient(135deg,#6e3fc7,#a030c0);color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Åpne portal og se preview
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px;margin-top:24px">
            Denne lenken er personlig — ikke videresend den.
          </p>
        </div>
      `;
      const text =
        `${greeting},\n\n` +
        `En ny video-preview er klar for review på posten "${hook}" i ${projectTitle}.\n\n` +
        `Åpne portalen: ${link}\n\n` +
        `Denne lenken er personlig.`;

      const result = await sendTransactionalEmail({
        to: s.clientEmail,
        subject: `Ny preview klar i ${projectTitle}`,
        html, text,
        kind: "marketing_preview_uploaded",
        projectId, pool,
        fromLabel: "The Role Room",
      });
      if (result.sent) sent++;
    }
    return { ok: true, sent, total: sessionRows.length };
  } catch (e) {
    console.error("[marketing-preview-email] notifyClientsOfNewPreview feilet", e);
    return { ok: false, sent: 0, total: 0 };
  }
}

/**
 * Send "klient kommenterte"-e-post til Bjarne (prosjekteier + alle
 * aktive team-medlemmer). Trigges fra editor-comments-POST for
 * marketing_plan_post-anchors.
 */
export async function notifyProducerOfClientComment(args: SendArgs & {
  commentText: string;
  clientName: string | null;
  reviewStatus?: 'approved' | 'changes_requested' | null;
}): Promise<{ ok: boolean; sent: number }> {
  const { pool, projectId, postId, commentText, clientName, reviewStatus } = args;
  try {
    // Hent prosjekt-eier + team-medlemmer
    const { rows: producerRows } = await pool.query<{ email: string }>(
      `SELECT DISTINCT u.email
         FROM users u
         WHERE u.id IN (
           SELECT created_by FROM casting_projects WHERE id = $1
           UNION
           SELECT user_id FROM casting_user_roles
            WHERE project_id = $1 AND deactivated_at IS NULL
         )
         AND u.email IS NOT NULL`,
      [projectId],
    );
    if (producerRows.length === 0) {
      return { ok: true, sent: 0 };
    }

    const { rows: postRows } = await pool.query<{
      hook: string; projectTitle: string | null;
    }>(
      `SELECT p.hook, prj.name AS "projectTitle"
         FROM role_room_marketing_plan_posts p
         JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
         LEFT JOIN projects prj ON prj.id = mp.project_id
        WHERE p.id = $1`,
      [postId],
    );
    const hook = postRows[0]?.hook ?? "din post";
    const projectTitle = postRows[0]?.projectTitle ?? "prosjektet";
    const clientLabel = clientName ?? "Klienten";

    const statusBadge = reviewStatus === "approved"
      ? '<span style="background:#4ad48a;color:#0a1a14;padding:2px 8px;border-radius:3px;font-weight:700">GODKJENT</span>'
      : reviewStatus === "changes_requested"
        ? '<span style="background:#f0a500;color:#1a0f00;padding:2px 8px;border-radius:3px;font-weight:700">BE OM ENDRING</span>'
        : '';

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.6;color:#1a0f2e">
        <h2 style="color:#6e3fc7;margin:0 0 16px">Ny klient-tilbakemelding</h2>
        ${statusBadge ? `<p>${statusBadge}</p>` : ""}
        <p><strong>${escapeHtml(clientLabel)}</strong> har gitt tilbakemelding på posten <strong>"${escapeHtml(hook)}"</strong> i ${escapeHtml(projectTitle)}:</p>
        <blockquote style="border-left:3px solid #a030c0;margin:12px 0;padding:8px 12px;background:#f5f0fa;color:#3a2050">
          ${escapeHtml(commentText)}
        </blockquote>
        <p style="color:#6b7280;font-size:13px;margin-top:24px">
          Du ser hele tråden i Post Agent's CollaborationSidebar.
        </p>
      </div>
    `;
    const text =
      `${clientLabel} har gitt tilbakemelding på "${hook}" i ${projectTitle}.\n\n` +
      (reviewStatus ? `Status: ${reviewStatus}\n\n` : "") +
      `"${commentText}"\n\n` +
      `Se hele tråden i Post Agent.`;

    let sent = 0;
    for (const p of producerRows) {
      const result = await sendTransactionalEmail({
        to: p.email,
        subject: `[${projectTitle}] ${reviewStatus === "approved" ? "Godkjent" : reviewStatus === "changes_requested" ? "Be om endring" : "Ny kommentar"}: ${hook.slice(0, 40)}`,
        html, text,
        kind: "marketing_client_comment",
        projectId, pool,
        fromLabel: "The Role Room",
      });
      if (result.sent) sent++;
    }
    return { ok: true, sent };
  } catch (e) {
    console.error("[marketing-preview-email] notifyProducerOfClientComment feilet", e);
    return { ok: false, sent: 0 };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
