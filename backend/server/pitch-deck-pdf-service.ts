/**
 * pitch-deck-pdf-service.ts
 *
 * PDF-eksport av pitch-decks + tracking av hvem som åpner dem.
 *
 * Vi har bevisst delt eksport-stien i to:
 *   1. POST /pitch-deck/exports    — gated på pitch_deck.export. Rendrer
 *                                    HTML→PDF, laster opp til B2, lager
 *                                    view_token og returnerer signed
 *                                    URL + delbar lenke.
 *   2. GET  /p/:view_token         — PUBLIC lenke kunden klikker på.
 *                                    Logger åpning, varsler selgeren
 *                                    første gang, redirector til
 *                                    signed B2-URL.
 *   3. GET  /p/:view_token.pix     — PUBLIC 1×1 tracking-pixel (i
 *                                    tilfelle kunden åpner i et
 *                                    e-postklientvindu før PDF lastes).
 *
 * Hvorfor inline HTML + ikke puppeteer/chrome: Render.com-noden er
 * 512MB minimum, Chrome trekker 200MB+ ved cold-start. Vi rendrer
 * print-CSS HTML og bruker `@react-pdf/renderer` for å produsere PDF
 * server-side uten browser. (En dust senere kan vi bytte til
 * puppeteer hvis vi trenger ekte browser-engine for komplekse
 * layouts.)
 *
 * For å unngå å introdusere @react-pdf-avhengighet i denne first-cut
 * MVP'en, lagrer vi inntil videre en HTML-pakket "pitch.html" til B2 og
 * returnerer den. iPad-UI eksporterer ved å hente den HTML'en og
 * dele via UIActivityViewController (som lar brukeren printe til PDF
 * via iOS' innebygde PDF-print). Backend-route'n er klar til å bytte
 * inn ekte PDF når vi har bestemt motor.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  /** Valgfri B2-uploader. Hvis fraværende lagres pakken kun i tabell
   *  og iPad henter inline. */
  uploadToB2?: (key: string, body: Buffer, contentType: string) => Promise<void>;
  /** Valgfri signed-URL-bygger for B2. Hvis fraværende returnerer vi
   *  en public proxy-URL via /p/:token. */
  buildSignedUrl?: (key: string, expiresInSec: number) => Promise<string>;
  /** Valgfri push-varsel-callback ved første åpning. */
  notifyOnFirstOpen?: (args: {
    userId: string;
    deckId: string;
    leadId: string | null;
  }) => Promise<void>;
}

interface SlidePayload {
  position: number;
  slide_type: string;
  title_md: string;
  body_md: string;
}

// ─────────────────────────────────────────────────────────────────
// HTML-render (print-ready)
// ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lett markdown → HTML for tittel/brødtekst. Støtter **bold**,
 *  *italic*, linjeskift. Ingen lenker eller bilder per design — vi
 *  vil ikke at en eksportert PDF skal kunne route'e til ekstern
 *  innhold som kan trekkes ned. */
function renderInlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

function renderSlideHtml(slide: SlidePayload, idx: number, total: number): string {
  return `
    <section class="slide slide--${escapeHtml(slide.slide_type)}">
      <header>
        <span class="slide__kind">${escapeHtml(slide.slide_type)}</span>
        <span class="slide__page">${idx + 1} / ${total}</span>
      </header>
      <h1>${renderInlineMarkdown(slide.title_md)}</h1>
      <div class="slide__body">${renderInlineMarkdown(slide.body_md)}</div>
    </section>
  `;
}

function renderDeckHtml(args: {
  deckName: string;
  orgName: string;
  slides: SlidePayload[];
  viewToken: string;
}): string {
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(args.deckName)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0b0b0b; color: #f5f4f1;
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; }
  .slide { width: 297mm; height: 210mm; padding: 48px 64px;
    display: flex; flex-direction: column; justify-content: flex-start;
    page-break-after: always; position: relative; background: #0b0b0b; }
  .slide header { display: flex; justify-content: space-between;
    font-size: 11pt; opacity: 0.45; text-transform: uppercase;
    letter-spacing: 1.4px; margin-bottom: 32px; }
  .slide__kind { color: #d4a373; }
  .slide h1 { font-size: 44pt; line-height: 1.08; margin: 0 0 28px;
    max-width: 22ch; font-weight: 600; }
  .slide__body { font-size: 16pt; line-height: 1.5; max-width: 60ch;
    color: rgba(245, 244, 241, 0.85); }
  .slide__body strong { color: #d4a373; }
  .slide:last-child { page-break-after: auto; }
  .cover { justify-content: center; align-items: flex-start; }
  .cover h1 { font-size: 64pt; max-width: 18ch; }
  .cover .org { font-size: 18pt; opacity: 0.6; margin-bottom: 12px;
    text-transform: uppercase; letter-spacing: 2px; }
  .pix { position: fixed; bottom: 8px; right: 8px;
    width: 1px; height: 1px; opacity: 0.01; }
  @media print { .slide { border: none; } }
</style>
</head>
<body>
  <section class="slide cover">
    <header><span class="slide__kind">Pitch</span></header>
    <div class="org">${escapeHtml(args.orgName)}</div>
    <h1>${escapeHtml(args.deckName)}</h1>
  </section>
  ${args.slides
    .map((s, i) => renderSlideHtml(s, i, args.slides.length))
    .join("\n")}
  <!-- Tracking-pixel: hits /p/:token.pix når PDF/HTML åpnes -->
  <img class="pix" src="/api/admin-room/lead-map/pitch-deck/p/${args.viewToken}.pix" alt="" />
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// Public tracking + share-routes (ikke gated)
// ─────────────────────────────────────────────────────────────────

function makeViewToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

// ─────────────────────────────────────────────────────────────────
// Registrering
// ─────────────────────────────────────────────────────────────────

export function registerPitchDeckPdfRoutes({
  app, pool, activeSessions, uploadToB2, buildSignedUrl, notifyOnFirstOpen,
}: Deps): void {
  const ROOT = "/api/admin-room/lead-map/pitch-deck";

  // ─── POST /exports ─────────────────────────────────────────────
  // Gated på pitch_deck.export — egen permission slik at en presenta-
  // tør kan ha access (åpne+presentere) uten å kunne dele PDF'en
  // utenfor organisasjonen.
  app.post(
    `${ROOT}/exports`,
    requireLeadMapPermission("pitch_deck.export", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const deckId = typeof req.body?.deck_id === "string" ? req.body.deck_id : null;
      if (!deckId) return res.status(400).json({ error: "deck_id påkrevd" });
      const leadId = typeof req.body?.lead_id === "string" ? req.body.lead_id : null;

      try {
        const deckRes = await pool.query<{
          id: string; org_id: string; name: string; status: string;
        }>(
          `SELECT id::text, org_id::text, name, status FROM pitch_decks WHERE id = $1`,
          [deckId],
        );
        if (deckRes.rows.length === 0) return res.status(404).json({ error: "deck_not_found" });
        const deck = deckRes.rows[0];
        if (deck.status !== "ready") {
          return res.status(409).json({ error: "deck_not_ready", status: deck.status });
        }

        const orgRes = await pool.query<{ name: string }>(
          `SELECT name FROM organizations WHERE id = $1`,
          [deck.org_id],
        );
        const orgName = orgRes.rows[0]?.name ?? "";

        const slideRes = await pool.query<SlidePayload>(
          `SELECT position, slide_type, title_md, body_md
             FROM pitch_slides WHERE deck_id = $1 ORDER BY position ASC`,
          [deckId],
        );

        const viewToken = makeViewToken();
        const html = renderDeckHtml({
          deckName: deck.name,
          orgName,
          slides: slideRes.rows,
          viewToken,
        });

        // B2-nøkkel — eller fallback til inline-lagring via separate
        // tabell hvis B2-uploader ikke er konfigurert i denne instansen.
        const b2Key = `pitch-decks/${deck.org_id}/${deckId}/${viewToken}.html`;
        if (uploadToB2) {
          try {
            await uploadToB2(b2Key, Buffer.from(html, "utf8"), "text/html; charset=utf-8");
          } catch (err) {
            return res.status(502).json({ error: "b2_upload_failed", detail: String(err) });
          }
        }

        await pool.query(
          `INSERT INTO pitch_deck_exports
             (deck_id, user_id, lead_id, b2_key, view_token)
           VALUES ($1, $2, $3, $4, $5)`,
          [deckId, session.userId, leadId, b2Key, viewToken],
        );

        // Signed URL ved direkte nedlasting (gjenbrukes av selger).
        // Public share-URL gjennom view_token (kunde-side).
        const signedUrl = buildSignedUrl
          ? await buildSignedUrl(b2Key, 3600).catch(() => null)
          : null;
        const shareUrl = `${ROOT}/p/${viewToken}`;

        return res.status(201).json({
          export: {
            view_token: viewToken,
            share_url: shareUrl,
            signed_url: signedUrl,
            // 1x1 pixel kan inkluderes i e-post for åpnings-tracking
            // selv før kunden klikker share_url:
            tracking_pixel: `${shareUrl}.pix`,
          },
        });
      } catch (err) {
        return res.status(500).json({ error: "export_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /p/:view_token (PUBLIC) ───────────────────────────────
  // Kunden klikker lenken → vi logger åpningen, varsler selgeren
  // første gang, og redirector til signed B2-URL (eller serverer
  // inline HTML hvis B2 ikke er konfigurert).
  app.get(
    `${ROOT}/p/:view_token`,
    async (req: Request, res: Response) => {
      const token = req.params.view_token;
      try {
        const r = await pool.query<{
          id: string; deck_id: string; user_id: string;
          lead_id: string | null; b2_key: string;
          first_opened_at: string | null;
          notified_on_open: boolean;
          expires_at: string;
        }>(
          `SELECT id::text, deck_id::text, user_id, lead_id, b2_key,
                  first_opened_at::text, notified_on_open,
                  expires_at::text
             FROM pitch_deck_exports WHERE view_token = $1`,
          [token],
        );
        if (r.rows.length === 0) return res.status(404).send("Ikke funnet");
        const row = r.rows[0];
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return res.status(410).send("Lenken er utløpt");
        }

        // Logg åpning
        const wasFirst = !row.first_opened_at;
        await pool.query(
          `UPDATE pitch_deck_exports
              SET first_opened_at = COALESCE(first_opened_at, now()),
                  last_opened_at  = now(),
                  view_count      = view_count + 1,
                  notified_on_open = CASE
                    WHEN first_opened_at IS NULL THEN true
                    ELSE notified_on_open END
            WHERE id = $1`,
          [row.id],
        );
        if (wasFirst && !row.notified_on_open && notifyOnFirstOpen) {
          notifyOnFirstOpen({
            userId: row.user_id,
            deckId: row.deck_id,
            leadId: row.lead_id,
          }).catch(() => { /* logget i caller */ });
        }

        // Lever HTML'en. Hvis B2-URL er tilgjengelig: redirect så
        // kunden får CDN-ytelse. Ellers: re-rendrer fra DB inline.
        if (buildSignedUrl) {
          const signedUrl = await buildSignedUrl(row.b2_key, 600).catch(() => null);
          if (signedUrl) return res.redirect(302, signedUrl);
        }
        // Fallback: re-rendrer HTML fra DB (uten å treffe B2)
        const deckRes = await pool.query<{ org_id: string; name: string }>(
          `SELECT org_id::text, name FROM pitch_decks WHERE id = $1`,
          [row.deck_id],
        );
        const orgRes = await pool.query<{ name: string }>(
          `SELECT name FROM organizations WHERE id = $1`,
          [deckRes.rows[0]?.org_id],
        );
        const slideRes = await pool.query<SlidePayload>(
          `SELECT position, slide_type, title_md, body_md
             FROM pitch_slides WHERE deck_id = $1 ORDER BY position ASC`,
          [row.deck_id],
        );
        const html = renderDeckHtml({
          deckName: deckRes.rows[0]?.name ?? "",
          orgName: orgRes.rows[0]?.name ?? "",
          slides: slideRes.rows,
          viewToken: token,
        });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      } catch (err) {
        return res.status(500).send(`Feil: ${String(err)}`);
      }
    },
  );

  // ─── GET /p/:view_token.pix (PUBLIC 1×1) ───────────────────────
  app.get(
    `${ROOT}/p/:view_token.pix`,
    async (req: Request, res: Response) => {
      const token = req.params.view_token;
      try {
        await pool.query(
          `UPDATE pitch_deck_exports
              SET first_opened_at = COALESCE(first_opened_at, now()),
                  last_opened_at  = now(),
                  view_count      = view_count + 1
            WHERE view_token = $1`,
          [token],
        );
      } catch { /* swallow — tracking er best-effort */ }
      // 1×1 transparent GIF
      const pix = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      );
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Cache-Control", "no-store");
      res.send(pix);
    },
  );
}
