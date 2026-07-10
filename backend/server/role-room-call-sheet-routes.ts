/**
 * role-room-call-sheet-routes.ts
 *
 * Distribusjon av call-sheets til crew/cast på e-post. Frontend genererer
 * call-sheeten (auto-fylt fra produksjonsdagen) og sender den ferdige HTML-en
 * hit sammen med mottakerlista; vi sender én transaksjons-e-post per mottaker
 * via den eksisterende e-post-tjenesten og returnerer per-mottaker-resultat.
 */

import type express from "express";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { aiRateLimit } from "./ai-rate-limiter.js";

export interface CallSheetRoutesDeps {
  app: express.Application;
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

export function setupRoleRoomCallSheetRoutes(deps: CallSheetRoutesDeps): void {
  const { app, requireUserSession } = deps;

  app.post("/api/role-room/call-sheets/send", callSheetSendLimit, async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
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

      const results: Array<{ email: string; sent: boolean; reason: string | null }> = [];
      for (const recipient of recipients) {
        try {
          const personalizedHtml = recipient.name
            ? `<p>Hei ${recipient.name},</p>${html}`
            : html;
          const out = await sendTransactionalEmail({
            to: recipient.email,
            subject,
            html: personalizedHtml,
            // Plain-text-fallback for mail-klienter som ikke renderer HTML
            text: personalizedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            fromLabel: "The Role Room",
          });
          results.push({ email: recipient.email, sent: out.sent, reason: out.reason });
        } catch (sendError) {
          console.error("Call sheet send failed for", recipient.email, sendError);
          results.push({ email: recipient.email, sent: false, reason: "send_failed" });
        }
      }

      const sent = results.filter((r) => r.sent).length;
      res.json({ sent, total: recipients.length, results });
    } catch (error) {
      console.error("Error sending call sheet:", error);
      res.status(500).json({ error: "Kunne ikke sende call sheet." });
    }
  });
}
