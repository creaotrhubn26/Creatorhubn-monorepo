/**
 * Publiserte interaktive guider — gjør en selvstendig HTML-guide (fra Product
 * Demo Studio) om til en PERMANENT, delbar offentlig lenke.
 *
 * Endepunkter:
 *   POST /api/role-room/published-guides   (auth: RR_BEARER_TOKEN) → { id, url }
 *   GET  /g/:id                            (offentlig) → serverer guide-HTML
 *
 * HTML lastes til Role Room B2-bucketen under `published-guides/{id}.html` og
 * serveres server-side via /g/:id. Dermed trengs ikke offentlig bucket, og
 * lenken utløper ikke (i motsetning til presignerte URL-er).
 *
 * Auth + dep-mønster følger role-room-brand-assets-routes.
 */

import type { Express, Request, Response } from "express";
import express from "express";
import { randomBytes } from "node:crypto";
import { archiveToRoleRoomB2, getFromRoleRoomB2, slugifyForKey } from "./b2-archive-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  activeSessions: Map<string, SessionData>;
}

const MAX_HTML = 5_000_000; // 5 MB — rikelig for en selvstendig guide
const ID_RE = /^[a-z0-9][a-z0-9-]{2,80}$/;

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

function publicBase(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.ROLE_ROOM_PUBLIC_URL ||
    "https://theroleroom.com"
  ).replace(/\/+$/, "");
}

export function registerRoleRoomPublishedGuidesRoutes(
  app: Express,
  deps: Deps,
): void {
  const { activeSessions } = deps;

  // POST — publiser en guide (krever innlogging).
  app.post(
    "/api/role-room/published-guides",
    express.json({ limit: "8mb" }),
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" });
        return;
      }
      const html = String(req.body?.html ?? "");
      const name = String(req.body?.name ?? "guide").trim();
      if (!html || !/<html[\s>]/i.test(html)) {
        res.status(400).json({ error: "ugyldig_html" });
        return;
      }
      if (html.length > MAX_HTML) {
        res.status(413).json({ error: "for_stor", maxBytes: MAX_HTML });
        return;
      }

      const slug = slugifyForKey(name) || "guide";
      const id = `${slug}-${randomBytes(4).toString("hex")}`;
      const key = `published-guides/${id}.html`;

      const result = await archiveToRoleRoomB2(
        key,
        html,
        "text/html; charset=utf-8",
      );
      if (!result) {
        res.status(503).json({
          error: "b2_ikke_konfigurert",
          detail: "B2_ROLE_ROOM_* env-vars mangler på serveren.",
        });
        return;
      }

      res.json({ id, url: `${publicBase()}/g/${id}`, bytes: result.size });
    },
  );

  // GET — offentlig servering av en publisert guide.
  app.get("/g/:id", async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "");
    if (!ID_RE.test(id)) {
      res.status(400).send("Ugyldig guide-id");
      return;
    }
    const obj = await getFromRoleRoomB2(`published-guides/${id}.html`);
    if (!obj) {
      res.status(404).send("Guide ikke funnet (eller utløpt).");
      return;
    }
    res.setHeader("Content-Type", obj.contentType || "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(obj.body);
  });
}
