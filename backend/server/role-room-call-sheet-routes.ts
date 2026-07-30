/**
 * role-room-call-sheet-routes.ts
 *
 * Distribusjon av call-sheets til crew/cast på e-post. Frontend genererer
 * call-sheeten (auto-fylt fra produksjonsdagen) og sender den ferdige HTML-en
 * hit sammen med mottakerlista; vi sender én transaksjons-e-post per mottaker
 * via den eksisterende e-post-tjenesten og returnerer per-mottaker-resultat.
 */

import type express from "express";
import type { Pool } from "pg";
import { randomBytes } from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { aiRateLimit } from "./ai-rate-limiter.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import { viewerMeetsTabLevel } from "./role-room-tab-access.js";

export interface CallSheetRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Cap fan-out per request: a call sheet goes to a production's crew/cast, not a
// mailing list. Without this an authed user could POST an arbitrary recipient
// list + arbitrary HTML and blast spam/phishing from our sending domain.
const MAX_CALL_SHEET_RECIPIENTS = 100;
// Bounds repeated calls per user (bearer-keyed) so the cap above can't just be
// looped around — 5 sends/min is ample for legitimate crew distribution.
const callSheetSendLimit = aiRateLimit({
  windowMs: 60_000,
  max: 5,
  label: "Call sheet send",
});

/** Public base-URL brukt i bekreftelseslenken. */
export function publicBaseUrl(): string {
  return (
    process.env.ROLE_ROOM_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://www.theroleroom.com"
  ).replace(/\/+$/, "");
}

/**
 * Bekreftelsesblokken som legges nederst i e-posten. Bevisst en synlig knapp
 * og ikke en sporingspiksel: mottakeren skal vite at bekreftelsen registreres,
 * og produksjonen skal vite at et klikk betyr «jeg har sett innkallingstiden
 * min» — ikke bare at en e-postklient lastet et bilde.
 */
export function acknowledgeBlock(token: string): string {
  const url = `${publicBaseUrl()}/api/role-room/call-sheets/ack/${token}`;
  return `
    <hr style="margin:24px 0;border:none;border-top:1px solid #ddd">
    <p style="font-family:system-ui,sans-serif;font-size:14px">
      <a href="${url}"
         style="display:inline-block;background:#0369a1;color:#fff;text-decoration:none;
                padding:12px 20px;border-radius:6px;font-weight:600">
        Bekreft mottatt
      </a>
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:12px;color:#666">
      Produksjonen ser hvem som har bekreftet, slik at de slipper å ringe rundt.
    </p>`;
}

async function recordReceipt(
  pool: Pool,
  distributionId: string,
  projectId: string,
  recipient: { name: string; email: string },
  ackToken: string,
  sent: boolean,
  reason: string | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO role_room_call_sheet_receipts
         (distribution_id, project_id, recipient_email, recipient_name, ack_token, sent, send_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (distribution_id, recipient_email) DO NOTHING`,
      [distributionId, projectId, recipient.email, recipient.name || null, ackToken, sent, reason],
    );
  } catch (err) {
    // Kvitteringssporing skal aldri velte en utsending som allerede er gjort —
    // e-posten er sendt, og det er den viktige delen.
    console.error("[call-sheet] kunne ikke lagre kvittering:", err);
  }
}

export function setupRoleRoomCallSheetRoutes(deps: CallSheetRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  app.post("/api/role-room/call-sheets/send", callSheetSendLimit, async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};

      // Story Arc RBAC: en call-sheet-utsending fyrer e-post fra vårt domene til
      // en vilkårlig mottakerliste. Uten prosjekt-gate kunne enhver innlogget
      // bruker sende (spam/phishing) i et vilkårlig prosjekts navn. Krev derfor
      // eier/medlemskap + fane-nivå 'callsheet' = Administrere (skriving/utsending).
      const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
      if (!projectId) {
        return res.status(400).json({ error: "projectId er påkrevd.", sent: 0, total: 0, results: [] });
      }
      if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "ingen_tilgang", sent: 0, total: 0, results: [] });
      }
      if (!(await viewerMeetsTabLevel(pool, projectId, session.userId, "callsheet", "manage"))) {
        return res.status(403).json({ error: "ingen_tilgang", sent: 0, total: 0, results: [] });
      }
      const subject = typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim().slice(0, 200)
        : "Call Sheet";
      const html = typeof body.html === "string" ? body.html : "";
      const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
      if (rawRecipients.length > MAX_CALL_SHEET_RECIPIENTS) {
        return res.status(400).json({
          error: `For mange mottakere (maks ${MAX_CALL_SHEET_RECIPIENTS} per utsending).`,
          sent: 0,
          total: 0,
          results: [],
        });
      }

      // Dedup på e-post + valider format.
      const seen = new Set<string>();
      const recipients = rawRecipients
        .map((r) => {
          const rec = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
          return {
            name: typeof rec.name === "string" ? rec.name : "",
            email: typeof rec.email === "string" ? rec.email.trim().toLowerCase() : "",
          };
        })
        .filter((r) => {
          if (!EMAIL_RE.test(r.email) || seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        });

      if (recipients.length === 0) {
        return res.status(400).json({ error: "Ingen gyldige e-postmottakere.", sent: 0, total: 0, results: [] });
      }
      if (!html.trim()) {
        return res.status(400).json({ error: "Mangler call-sheet-innhold.", sent: 0, total: 0, results: [] });
      }

      // Én distribusjon per utsending — kvitteringene henger på den, slik at
      // «hvem har bekreftet dagens call-sheet» er ett oppslag.
      const distribution = await pool.query<{ id: string }>(
        `INSERT INTO role_room_call_sheet_distributions
           (project_id, production_day_ref, subject, sent_by_user_id, recipient_count)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [
          projectId,
          typeof body.productionDayRef === "string" ? body.productionDayRef.slice(0, 255) : null,
          subject,
          session.userId,
          recipients.length,
        ],
      );
      const distributionId = distribution.rows[0].id;

      const results: Array<{ email: string; sent: boolean; reason: string | null }> = [];
      for (const recipient of recipients) {
        // Ugjettbart token per mottaker — én lenke kan aldri bekrefte på
        // vegne av noen andre.
        const ackToken = randomBytes(24).toString("base64url");
        try {
          const personalizedHtml =
            (recipient.name ? `<p>Hei ${recipient.name},</p>${html}` : html) +
            acknowledgeBlock(ackToken);
          const out = await sendTransactionalEmail({
            to: recipient.email,
            subject,
            html: personalizedHtml,
            // Plain-text-fallback for mail-klienter som ikke renderer HTML
            text: personalizedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            fromLabel: "The Role Room",
          });
          results.push({ email: recipient.email, sent: out.sent, reason: out.reason });
          await recordReceipt(pool, distributionId, projectId, recipient, ackToken, out.sent, out.reason);
        } catch (sendError) {
          console.error("Call sheet send failed for", recipient.email, sendError);
          results.push({ email: recipient.email, sent: false, reason: "send_failed" });
          await recordReceipt(pool, distributionId, projectId, recipient, ackToken, false, "send_failed");
        }
      }

      const sent = results.filter((r) => r.sent).length;
      res.json({ sent, total: recipients.length, distributionId, results });
    } catch (error) {
      console.error("Error sending call sheet:", error);
      res.status(500).json({ error: "Kunne ikke sende call sheet." });
    }
  });

  // ── Bekreftelse (offentlig — tokenet ER autentiseringen) ─────────────────
  // Mottakeren er crew eller cast og har typisk ingen konto. Tokenet er
  // ugjettbart og gjelder kun én kvittering, så det er tilstrekkelig bevis
  // for «denne mottakeren bekreftet».
  app.get("/api/role-room/call-sheets/ack/:token", async (req, res) => {
    const token = typeof req.params.token === "string" ? req.params.token.trim() : "";
    const page = (title: string, body: string, status = 200) =>
      res.status(status).type("html").send(
        `<!doctype html><meta charset="utf-8">
         <meta name="viewport" content="width=device-width,initial-scale=1">
         <title>${title}</title>
         <div style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;text-align:center">
           <h1 style="font-size:1.25rem">${title}</h1>
           <p style="color:#555;line-height:1.5">${body}</p>
         </div>`,
      );

    if (!token) return page("Ugyldig lenke", "Bekreftelseslenken mangler.", 400);

    try {
      // Idempotent: gjentatte klikk beholder det FØRSTE bekreftelses-
      // tidspunktet framfor å flytte det.
      const r = await pool.query<{ recipient_name: string | null; acknowledged_at: string }>(
        `UPDATE role_room_call_sheet_receipts
            SET acknowledged_at = COALESCE(acknowledged_at, NOW())
          WHERE ack_token = $1
          RETURNING recipient_name, acknowledged_at`,
        [token],
      );
      if (r.rowCount === 0) {
        return page("Fant ikke innkallingen", "Lenken er ugyldig eller utgått.", 404);
      }
      const name = r.rows[0].recipient_name;
      return page(
        "Takk — bekreftet",
        `${name ? `${name}, produksjonen` : "Produksjonen"} har fått beskjed om at du har sett innkallingen.`,
      );
    } catch (err) {
      console.error("[call-sheet] ack feilet:", err);
      return page("Noe gikk galt", "Prøv igjen, eller gi produksjonen beskjed direkte.", 500);
    }
  });

  // ── Status: hvem har bekreftet? ──────────────────────────────────────────
  app.get("/api/role-room/call-sheets/distributions/:distributionId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const distributionId = String(req.params.distributionId || "");
      const dist = await pool.query<{ project_id: string; subject: string; created_at: string }>(
        `SELECT project_id, subject, created_at
           FROM role_room_call_sheet_distributions WHERE id = $1 LIMIT 1`,
        [distributionId],
      );
      if (dist.rowCount === 0) return res.status(404).json({ error: "Fant ikke utsendingen." });

      // Object-first: distribusjonen slås opp globalt på id — verifiser
      // tilgang til dens faktiske prosjekt før noe utleveres.
      if (!(await canAccessRoleRoomProject(pool, session.userId, dist.rows[0].project_id))) {
        return res.status(403).json({ error: "ingen_tilgang" });
      }

      const receipts = await pool.query(
        `SELECT recipient_email, recipient_name, sent, send_reason, acknowledged_at
           FROM role_room_call_sheet_receipts
          WHERE distribution_id = $1
          ORDER BY acknowledged_at NULLS FIRST, recipient_email`,
        [distributionId],
      );

      const rows = receipts.rows as Array<{ sent: boolean; acknowledged_at: string | null }>;
      res.json({
        distribution: { id: distributionId, ...dist.rows[0] },
        summary: {
          total: rows.length,
          sent: rows.filter((r) => r.sent).length,
          acknowledged: rows.filter((r) => r.acknowledged_at).length,
          // De som må ringes.
          awaiting: rows.filter((r) => r.sent && !r.acknowledged_at).length,
        },
        receipts: receipts.rows,
      });
    } catch (err) {
      console.error("[call-sheet] status feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente kvitteringsstatus." });
    }
  });
}
