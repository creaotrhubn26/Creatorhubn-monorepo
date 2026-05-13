/**
 * admin-room-decks-routes.ts
 *
 * Setup-funksjon for /api/admin-room/decks endpoints — pitch-decks for
 * investor-pipeline. 7 endpoints: list, create (med pre-fill fra
 * forretningsplan), get, patch deck-meta, patch slide, delete, samt
 * AI-generate per slide via Claude.
 *
 * Avhengigheter (dynamiske imports — beholdt fra original):
 *   - ./role-room-investor-deck-db.js
 *   - ./role-room-investor-deck-claude.js
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminDecksRoutes } from "./admin-room-decks-routes";
 *
 *   setupAdminDecksRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Mode-noter: ingen Role Room-modes påvirker disse endpoints. Admin Room-
 * funksjonalitet låst til produkteier.
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

export function setupAdminDecksRoutes(deps: AdminRoomRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminRoomAccess,
    logAdminActivity,
  } = deps;

  app.get("/api/admin-room/decks", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const { listDecksForUser } = await import("./role-room-investor-deck-db.js");
      const decks = await listDecksForUser(pool, session.userId);
      res.json({ items: decks });
    } catch (err) {
      console.error("admin-room decks list error", err);
      res.status(500).json({ error: "Kunne ikke hente decks" });
    }
  });

  app.post("/api/admin-room/decks", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!asString(body.title)) {
      res.status(400).json({ error: "title er påkrevd" });
      return;
    }
    try {
      const { createInvestorDeck, listSlidesForDeck, updateSlideContent } = await import(
        "./role-room-investor-deck-db.js"
      );
      const result = await createInvestorDeck(pool, {
        userId: session.userId,
        title: asString(body.title) as string,
        description: asString(body.description),
      });

      // Pre-fill slides fra forretningsplan hvis den finnes (krev ikke
      // — bare en bekvemmelighet for å sparke deck'en i gang).
      try {
        const planResult = await pool.query(
          `SELECT * FROM admin_business_plan WHERE user_id = $1`,
          [session.userId],
        );
        const plan = planResult.rows[0];
        if (plan) {
          const slides = await listSlidesForDeck(pool, result.deck.id);
          const sectionToPlan: Record<string, string | null> = {
            cover: plan.exec_summary,
            problem: plan.intro_industry,
            solution: plan.intro_overview,
            market: plan.external_porter,
            business_model: plan.intro_financials,
            competition: plan.external_competitors,
            traction: null,
            team: null,
            funding: plan.intro_financials,
            cta: null,
          };
          for (const slide of slides) {
            const planText = sectionToPlan[slide.section];
            if (planText && typeof planText === "string" && planText.trim()) {
              await updateSlideContent(pool, slide.id, {
                ...slide.content,
                body: planText.trim(),
              });
            }
          }
        }
      } catch (prefillErr) {
        console.warn("admin-room decks prefill skipped:", prefillErr);
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "deck",
        entityId: result.deck.id,
        action: "created",
        summary: result.deck.title,
      });
      res.status(201).json({ deck: result.deck, slides: result.slides });
    } catch (err) {
      console.error("admin-room decks create error", err);
      res.status(500).json({ error: "Kunne ikke opprette deck" });
    }
  });

  app.get("/api/admin-room/decks/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const { getDeckById, listSlidesForDeck } = await import("./role-room-investor-deck-db.js");
      const deck = await getDeckById(pool, req.params.id, session.userId);
      if (!deck) {
        res.status(404).json({ error: "Deck ikke funnet" });
        return;
      }
      const slides = await listSlidesForDeck(pool, deck.id);
      res.json({ deck, slides });
    } catch (err) {
      console.error("admin-room decks get error", err);
      res.status(500).json({ error: "Kunne ikke hente deck" });
    }
  });

  app.patch("/api/admin-room/decks/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const { updateDeckMeta } = await import("./role-room-investor-deck-db.js");
      const deck = await updateDeckMeta(pool, req.params.id, session.userId, {
        title: typeof body.title === "string" ? body.title : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        status: (body.status === "draft" || body.status === "published" || body.status === "archived")
          ? body.status
          : undefined,
      });
      if (!deck) {
        res.status(404).json({ error: "Deck ikke funnet" });
        return;
      }
      res.json({ deck });
    } catch (err) {
      console.error("admin-room decks patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere deck" });
    }
  });

  app.patch("/api/admin-room/decks/:id/slides/:slideId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const { getDeckById, updateSlideContent } = await import("./role-room-investor-deck-db.js");
      // Verify deck-ownership først
      const deck = await getDeckById(pool, req.params.id, session.userId);
      if (!deck) {
        res.status(404).json({ error: "Deck ikke funnet" });
        return;
      }
      const content = body.content && typeof body.content === "object"
        ? body.content as Record<string, unknown>
        : {};
      const notes = typeof body.notes === "string" ? body.notes : undefined;
      const slide = await updateSlideContent(pool, req.params.slideId, content, notes);
      if (!slide) {
        res.status(404).json({ error: "Slide ikke funnet" });
        return;
      }
      res.json({ slide });
    } catch (err) {
      console.error("admin-room decks slide patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere slide" });
    }
  });

  app.delete("/api/admin-room/decks/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const { deleteDeck } = await import("./role-room-investor-deck-db.js");
      const ok = await deleteDeck(pool, req.params.id, session.userId);
      if (!ok) {
        res.status(404).json({ error: "Deck ikke funnet" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("admin-room decks delete error", err);
      res.status(500).json({ error: "Kunne ikke slette deck" });
    }
  });

  // AI-generate slide-content via Claude
  app.post("/api/admin-room/decks/:id/slides/:slideId/generate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const { getDeckById, listSlidesForDeck, updateSlideContent } = await import(
        "./role-room-investor-deck-db.js"
      );
      const { generateInvestorSection } = await import("./role-room-investor-deck-claude.js");

      const deck = await getDeckById(pool, req.params.id, session.userId);
      if (!deck) {
        res.status(404).json({ error: "Deck ikke funnet" });
        return;
      }
      const slides = await listSlidesForDeck(pool, deck.id);
      const slide = slides.find((s) => s.id === req.params.slideId);
      if (!slide) {
        res.status(404).json({ error: "Slide ikke funnet" });
        return;
      }

      // Bruk forretningsplan som forretningskontekst hvis tilgjengelig
      const planResult = await pool.query(
        `SELECT * FROM admin_business_plan WHERE user_id = $1`,
        [session.userId],
      );
      const plan = planResult.rows[0] ?? null;

      const generation = await generateInvestorSection(slide.section, {
        brandName: typeof body.brandName === "string" && body.brandName.trim()
          ? body.brandName.trim()
          : "The Role Room",
        industry: typeof body.industry === "string" ? body.industry : (plan?.intro_industry ?? null),
        description: typeof body.description === "string"
          ? body.description
          : (plan?.exec_summary ?? plan?.intro_overview ?? null),
        monthlyRevenueNok: typeof body.monthlyRevenueNok === "number" ? body.monthlyRevenueNok : null,
        growthPhase: typeof body.growthPhase === "string" ? body.growthPhase : null,
        customNote: typeof body.customNote === "string" ? body.customNote : null,
      });

      const updated = await updateSlideContent(pool, slide.id, {
        ...slide.content,
        body: generation.body,
      });
      if (!updated) {
        res.status(500).json({ error: "Kunne ikke lagre generert tekst" });
        return;
      }
      res.json({
        slide: updated,
        tokens: { input: generation.inputTokens, output: generation.outputTokens },
      });
    } catch (err) {
      console.error("admin-room decks generate error", err);
      res.status(500).json({
        error: "Kunne ikke generere via Claude",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });
}
