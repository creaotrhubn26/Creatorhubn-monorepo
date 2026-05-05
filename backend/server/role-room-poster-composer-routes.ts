/**
 * HTTP-routes for plakat-/menu-composeren.
 *
 * Mountes inn i role-room-routes.ts via registerPosterComposerRoutes(router, pool).
 * Preview-endepunktene returnerer binær (PNG/PDF) med riktig content-type slik at
 * frontend kan vise dem direkte i en <img>-tag eller via Object URL.
 */
import type { Pool } from "pg";
import type { Request, Response, Router } from "express";
import multer from "multer";
import {
  FORMAT_DIMENSIONS,
  renderPoster,
  type PosterContent,
  type PosterFormat,
} from "./role-room-poster-composer.ts";
import {
  MENU_FORMAT_DIMENSIONS,
  renderMenuPdf,
  type MenuContent,
  type MenuFormat,
} from "./role-room-menu-composer.ts";
import { generateCampaignConcept } from "./role-room-poster-claude.ts";
import { signAssetReadUrlForDelivery, uploadCaptureObject } from "./capture-upload-service.js";

const posterImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB / bilde
});

export function registerPosterComposerRoutes(router: Router, pool: Pool): void {
  // ── POST /poster/preview — render plakat til PNG ──
  router.post("/poster/preview", async (req: Request, res: Response) => {
    try {
      const body = req.body as { content?: PosterContent; format?: PosterFormat };
      if (!body?.content || !body?.format) {
        return res.status(400).json({ error: "content + format required" });
      }
      if (!FORMAT_DIMENSIONS[body.format]) {
        return res.status(400).json({
          error: `unknown format ${body.format}`,
          known: Object.keys(FORMAT_DIMENSIONS),
        });
      }
      const png = await renderPoster(body.content, body.format);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.send(png);
    } catch (err) {
      console.error("[poster/preview] render failed:", err);
      return res.status(500).json({
        error: "render failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── POST /poster/menu-preview — render meny til PDF ──
  router.post("/poster/menu-preview", async (req: Request, res: Response) => {
    try {
      const body = req.body as { content?: MenuContent; format?: MenuFormat };
      if (!body?.content) {
        return res.status(400).json({ error: "content required" });
      }
      const fmt = body.format ?? "menu-a4";
      if (!MENU_FORMAT_DIMENSIONS[fmt]) {
        return res.status(400).json({
          error: `unknown menu format ${fmt}`,
          known: Object.keys(MENU_FORMAT_DIMENSIONS),
        });
      }
      const pdf = await renderMenuPdf(body.content, fmt);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "no-store");
      return res.send(pdf);
    } catch (err) {
      console.error("[poster/menu-preview] render failed:", err);
      return res.status(500).json({
        error: "menu render failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── GET /poster/formats — liste alle støttede formater (UI-format-picker) ──
  router.get("/poster/formats", async (_req: Request, res: Response) => {
    const isMenuboard = (key: string) => key.startsWith("menuboard-");
    const social = Object.entries(FORMAT_DIMENSIONS)
      .filter(([key, d]) => d.kind === "digital" && !isMenuboard(key))
      .map(([key, d]) => ({ key, ...d }));
    const print = Object.entries(FORMAT_DIMENSIONS)
      .filter(([, d]) => d.kind === "print")
      .map(([key, d]) => ({ key, ...d }));
    const digital_signage = Object.entries(FORMAT_DIMENSIONS)
      .filter(([key]) => isMenuboard(key))
      .map(([key, d]) => ({ key, ...d }));
    const menu = Object.entries(MENU_FORMAT_DIMENSIONS).map(([key, d]) => ({ key, ...d }));
    return res.json({ social, print, digital_signage, menu });
  });

  // ── GET /poster/templates — liste templates ──
  router.get("/poster/templates", async (_req: Request, res: Response) => {
    return res.json({
      poster: [
        {
          id: "monday-special",
          name: "Mandags-tilbud",
          description: "Blue Monday → Holy Monday-stil. Split-bg, headlines, 2 pris-tier, 3 produkter.",
          contentShape: "PosterContent",
        },
        { id: "weekly-special", name: "Ukens tilbud", description: "(samme layout som monday-special inntil Fase 4)", contentShape: "PosterContent" },
        { id: "new-launch", name: "Nytt produkt", description: "(samme layout inntil Fase 4)", contentShape: "PosterContent" },
        { id: "season-promo", name: "Sesong-kampanje", description: "(samme layout inntil Fase 4)", contentShape: "PosterContent" },
      ],
      menu: [
        {
          id: "menu-premium",
          name: "Premium meny",
          description: "Flersides A4 med cover + én kategori per side. PDF-output.",
          contentShape: "MenuContent",
        },
        {
          id: "menu-trifold",
          name: "Takeaway-trifold",
          description: "A4 landscape, 3-panel front + back. PDF-output. (Kommer i Fase 5b.)",
          contentShape: "MenuContent",
        },
      ],
    });
  });

  // ── GET /poster/drafts — list user's drafts ──
  router.get("/poster/drafts", async (req: Request, res: Response) => {
    const userId = (req.headers["x-user-id"] as string | undefined)?.trim();
    if (!userId) {
      return res.status(401).json({ error: "x-user-id header required" });
    }
    try {
      const { rows } = await pool.query(
        `SELECT id, brand_id, template_id, name, format, status, rendered_url, rendered_at, updated_at
         FROM poster_drafts
         WHERE user_id = $1 AND status != 'archived'
         ORDER BY updated_at DESC
         LIMIT 100`,
        [userId],
      );
      return res.json({ drafts: rows });
    } catch (err) {
      console.error("[poster/drafts] list failed:", err);
      return res.status(500).json({ error: "list failed" });
    }
  });

  // ── GET /poster/drafts/:draftId — load full content ──
  router.get("/poster/drafts/:draftId", async (req: Request, res: Response) => {
    const userId = (req.headers["x-user-id"] as string | undefined)?.trim();
    if (!userId) return res.status(401).json({ error: "x-user-id header required" });
    try {
      const { rows } = await pool.query(
        `SELECT id, user_id, brand_id, template_id, name, format, content, status, rendered_url, rendered_at, created_at, updated_at
         FROM poster_drafts
         WHERE id = $1 AND user_id = $2`,
        [req.params.draftId, userId],
      );
      if (rows.length === 0) return res.status(404).json({ error: "not found" });
      return res.json({ draft: rows[0] });
    } catch (err) {
      console.error("[poster/drafts/:id] load failed:", err);
      return res.status(500).json({ error: "load failed" });
    }
  });

  // ── POST /poster/claude/campaign — generer kampanje-tekst via Claude ──
  router.post("/poster/claude/campaign", async (req: Request, res: Response) => {
    const body = req.body as {
      brand?: PosterContent["brand"];
      templateId?: string;
      intent?: string;
      voice?: string;
      referenceCampaign?: PosterContent["campaign"];
    };
    if (!body?.brand || !body?.templateId || !body?.intent) {
      return res.status(400).json({ error: "brand, templateId, intent required" });
    }
    const concept = await generateCampaignConcept({
      brand: body.brand,
      templateId: body.templateId,
      intent: body.intent,
      voice: body.voice,
      referenceCampaign: body.referenceCampaign,
    });
    if (!concept) {
      return res
        .status(502)
        .json({ error: "Claude-generering feilet — sjekk ANTHROPIC_API_KEY og credit." });
    }
    return res.json({ campaign: concept });
  });

  // ── POST /poster/upload — last opp brand-bilde til R2 ──
  router.post("/poster/upload", posterImageUpload.single("file"), async (req: Request, res: Response) => {
    const userId = (req.headers["x-user-id"] as string | undefined)?.trim();
    if (!userId) return res.status(401).json({ error: "x-user-id header required" });
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ error: "file (multipart) required" });
    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "file må være bilde (image/*)" });
    }
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 80);
    const key = `poster-uploads/${userId}/${Date.now()}-${safeName}`;
    const uploadedKey = await uploadCaptureObject({
      key,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
    if (!uploadedKey) {
      return res.status(500).json({ error: "R2-upload feilet — sjekk capture-bucket-config" });
    }
    const signedUrl = await signAssetReadUrlForDelivery(uploadedKey);
    return res.status(201).json({ key: uploadedKey, url: signedUrl });
  });

  // ── POST /poster/drafts — save (insert or update via id) ──
  router.post("/poster/drafts", async (req: Request, res: Response) => {
    const userId = (req.headers["x-user-id"] as string | undefined)?.trim();
    if (!userId) return res.status(401).json({ error: "x-user-id header required" });
    const body = req.body as {
      id?: string;
      brandId?: string | null;
      templateId: string;
      name: string;
      format: string;
      content: PosterContent | MenuContent;
      status?: "draft" | "published" | "archived";
    };
    if (!body?.templateId || !body?.name || !body?.format || !body?.content) {
      return res.status(400).json({ error: "templateId, name, format, content required" });
    }
    try {
      if (body.id) {
        const { rows } = await pool.query(
          `UPDATE poster_drafts
           SET template_id = $1, name = $2, format = $3, content = $4, status = COALESCE($5, status), updated_at = now()
           WHERE id = $6 AND user_id = $7
           RETURNING id, updated_at`,
          [body.templateId, body.name, body.format, body.content, body.status ?? null, body.id, userId],
        );
        if (rows.length === 0) return res.status(404).json({ error: "draft not found or not yours" });
        return res.json({ draft: rows[0] });
      }
      const { rows } = await pool.query(
        `INSERT INTO poster_drafts (user_id, brand_id, template_id, name, format, content, status)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'draft'))
         RETURNING id, created_at, updated_at`,
        [userId, body.brandId ?? null, body.templateId, body.name, body.format, body.content, body.status ?? null],
      );
      return res.status(201).json({ draft: rows[0] });
    } catch (err) {
      console.error("[poster/drafts] save failed:", err);
      return res.status(500).json({
        error: "save failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
