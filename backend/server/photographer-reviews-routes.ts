/**
 * photographer-reviews-routes.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Klient-innsendte omtaler/anmeldelser. Fotografens KUNDER legger igjen omtaler
 * (navn + rating + tekst) som vises i «Det kunder sier» på showcaset. Fotografen
 * modererer (publiser/skjul) — men skriver ikke omtaler selv.
 *
 * Offentlige endepunkter (ingen auth):
 *   GET  /api/showcase/reviews?photographerId=ID   → publiserte omtaler
 *   POST /api/showcase/reviews                      → send inn omtale (status 'pending')
 *
 * Eier-endepunkter (requireUserSession):
 *   GET   /api/photographer/reviews                 → alle (inkl. pending) for moderering
 *   PATCH /api/photographer/reviews/:id             → sett status (published | hidden)
 */

import type express from "express";

type AnyPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export interface PhotographerReviewsDeps {
  app: express.Application;
  pool: AnyPool;
  requireUserSession: (req: any, res: any) => { userId: string; email?: string | null } | null;
}

const isMissingTable = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";

const clip = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

export function setupPhotographerReviewsRoutes(deps: PhotographerReviewsDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── Offentlig: list publiserte omtaler ─────────────────────────────────────
  app.get("/api/showcase/reviews", async (req, res) => {
    const photographerId = clip(req.query.photographerId, 200);
    if (!photographerId) return res.status(400).json({ error: "photographerId_required" });
    try {
      const result = await pool.query(
        `SELECT id, author, role, review_text, rating, aspect_ratings, verified, photographer_reply, created_at
           FROM photographer_reviews
          WHERE photographer_id = $1 AND status = 'published'
          ORDER BY created_at DESC
          LIMIT 50`,
        [photographerId],
      );
      const reviews = result.rows.map((r) => ({
        id: r.id,
        author: r.author,
        role: r.role,
        text: r.review_text,
        rating: r.rating,
        aspectRatings: r.aspect_ratings || {},
        verified: Boolean(r.verified),
        reply: r.photographer_reply || null,
        createdAt: r.created_at,
      }));
      // Aggregert score for visning øverst (#3).
      const count = reviews.length;
      const average = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
      return res.json({
        reviews,
        summary: { count, average: Math.round(average * 10) / 10 },
      });
    } catch (err) {
      if (isMissingTable(err)) return res.json({ reviews: [] });
      console.error("[photographer-reviews] list failed:", err);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // ── Offentlig: send inn omtale (havner som 'pending' for moderering) ────────
  app.post("/api/showcase/reviews", async (req, res) => {
    const photographerId = clip(req.body?.photographerId, 200);
    const author = clip(req.body?.author, 120);
    const text = clip(req.body?.text ?? req.body?.review_text, 2000);
    const role = clip(req.body?.role, 160) || null;
    const clientEmail = clip(req.body?.clientEmail, 200) || null;
    const accessToken = clip(req.body?.accessToken, 200);

    // Per-aspekt stjerner: { "Kommunikasjon": 5, ... }. Når aspekter finnes
    // settes total-rating til snittet; ellers brukes innsendt `rating`.
    const rawAspects = req.body?.aspectRatings;
    const aspectRatings: Record<string, number> = {};
    if (rawAspects && typeof rawAspects === "object") {
      for (const [k, v] of Object.entries(rawAspects)) {
        const key = clip(k, 80);
        const num = Math.min(5, Math.max(1, Math.round(Number(v))));
        if (key && Number.isFinite(num)) aspectRatings[key] = num;
      }
    }
    const aspectVals = Object.values(aspectRatings);
    let rating = aspectVals.length
      ? Math.round(aspectVals.reduce((a, b) => a + b, 0) / aspectVals.length)
      : Number(req.body?.rating);
    if (!Number.isFinite(rating)) rating = 5;
    rating = Math.min(5, Math.max(1, Math.round(rating)));

    if (!photographerId) return res.status(400).json({ error: "photographerId_required" });
    if (!author) return res.status(400).json({ error: "author_required" });
    if (!text) return res.status(400).json({ error: "text_required" });

    // Honeypot (#7): et skjult felt mennesker ikke ser. Utfylt = bot → dropp
    // stille (svar OK så boten ikke prøver på nytt), ingen rad lagres.
    if (clip(req.body?.website, 200)) {
      return res.status(201).json({ ok: true, status: "pending" });
    }

    try {
      // Verifisert kunde: gyldig galleri-token for denne fotografen.
      let verified = false;
      if (accessToken) {
        try {
          const g = await pool.query(
            `SELECT 1 FROM photographer_client_galleries
              WHERE access_token = $1 AND photographer_id = $2 LIMIT 1`,
            [accessToken, photographerId],
          );
          verified = g.rowCount > 0;
        } catch { /* tabell mangler / token ugyldig → ikke verifisert */ }
      }

      const result = await pool.query(
        `INSERT INTO photographer_reviews
           (photographer_id, author, role, review_text, rating, aspect_ratings, verified, status, client_email)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'pending', $8)
         RETURNING id`,
        [photographerId, author, role, text, rating, JSON.stringify(aspectRatings), verified, clientEmail],
      );
      const reviewId = result.rows[0]?.id;

      // Best-effort CRM-kobling: logg omtalen som aktivitet på matchende kunde
      // (matcher på e-post). Feiler stille — skal aldri blokkere innsending.
      if (clientEmail) {
        try {
          const cust = await pool.query(
            `SELECT id FROM crm_customers
              WHERE owner_user_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL
              LIMIT 1`,
            [photographerId, clientEmail],
          );
          const customerId = cust.rows[0]?.id;
          if (customerId) {
            await pool.query(
              `INSERT INTO crm_activities
                 (id, customer_id, type, subject, description, direction, channel, owner_user_id, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, 'review', $2, $3, 'inbound', 'showcase', $4, NOW(), NOW())`,
              [customerId, `Ny omtale (${rating}★)`, text, photographerId],
            );
          }
        } catch (crmErr) {
          console.warn("[photographer-reviews] CRM activity link skipped:", (crmErr as Error)?.message);
        }
      }

      return res.status(201).json({ ok: true, id: reviewId, status: "pending", verified });
    } catch (err) {
      if (isMissingTable(err)) {
        return res.status(503).json({ error: "migration_pending" });
      }
      console.error("[photographer-reviews] submit failed:", err);
      return res.status(500).json({ error: "submit_failed" });
    }
  });

  // ── Eier: alle omtaler (for moderering) ─────────────────────────────────────
  app.get("/api/photographer/reviews", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id, author, role, review_text, rating, status, verified, photographer_reply, created_at
           FROM photographer_reviews
          WHERE photographer_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [session.userId],
      );
      return res.json({
        reviews: result.rows.map((r) => ({
          id: r.id,
          author: r.author,
          role: r.role,
          text: r.review_text,
          rating: r.rating,
          status: r.status,
          verified: Boolean(r.verified),
          reply: r.photographer_reply || null,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      if (isMissingTable(err)) return res.json({ reviews: [] });
      console.error("[photographer-reviews] owner list failed:", err);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // ── Eier: moderer (publiser / skjul) ────────────────────────────────────────
  app.patch("/api/photographer/reviews/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = clip(req.params.id, 64);
    const hasStatus = typeof req.body?.status === "string";
    const status = clip(req.body?.status, 20);
    const hasReply = typeof req.body?.reply === "string";
    const reply = clip(req.body?.reply, 2000) || null;
    if (hasStatus && !["published", "hidden", "pending"].includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    if (!hasStatus && !hasReply) {
      return res.status(400).json({ error: "nothing_to_update" });
    }
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [id, session.userId];
      if (hasStatus) { params.push(status); sets.push(`status = $${params.length}`); }
      if (hasReply) { params.push(reply); sets.push(`photographer_reply = $${params.length}`); }
      const result = await pool.query(
        `UPDATE photographer_reviews
            SET ${sets.join(", ")}
          WHERE id = $1::uuid AND photographer_id = $2
          RETURNING id`,
        params,
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, id, ...(hasStatus ? { status } : {}) });
    } catch (err) {
      if (isMissingTable(err)) return res.status(503).json({ error: "migration_pending" });
      console.error("[photographer-reviews] moderate failed:", err);
      return res.status(500).json({ error: "moderate_failed" });
    }
  });
}
