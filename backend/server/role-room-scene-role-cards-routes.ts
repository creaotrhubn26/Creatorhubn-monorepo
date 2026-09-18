/**
 * role-room-scene-role-cards-routes.ts — rollekort for settet.
 *
 * To lesere, to visninger av samme data:
 *
 *   produksjonen  ser alle kortene i en scene, og redigerer dem
 *   personen      åpner sin egen lenke og ser BARE sitt eget kort
 *
 * Den andre er grunnen til at dette finnes. En statist som får hele
 * scene-oppsettet må lete etter seg selv i det; en statist som får ett kort
 * vet hva hen skal gjøre. Derfor returnerer /r/:token aldri de andre
 * kortene, og aldri mer av scenen enn det som trengs for å utføre oppgaven.
 *
 * Token ER legitimasjonen. Den behandles som en bearer-verdi: aldri logget,
 * aldri i en feilmelding, og et ukjent token svarer likt som et tilbaketrukket
 * — ellers kan man prøve seg fram til hvilke som finnes.
 *
 * Skjema: migrasjon 0628 (scene_role_cards).
 */

import crypto from "node:crypto";
import type express from "express";
import type { Pool } from "pg";

import { userCanAccessCastingProject } from "./casting-project-ownership.js";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomSceneRoleCardsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const PERSON_KINDS = new Set(["extra", "actor", "crew"]);

/** Lenken er legitimasjon, så den skal ikke kunne gjettes. */
function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function cleanPosition(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { x?: unknown; y?: unknown };
  const x = Number(v.x);
  const y = Number(v.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // Normalisert 0–1: plantegningen kan byttes uten at prikkene flytter seg.
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

export function setupRoleRoomSceneRoleCardsRoutes(
  deps: RoleRoomSceneRoleCardsRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  /** Prosjekt-tilgang, eller null. Samme vakt som resten av casting-ressursene. */
  async function requireProject(
    req: express.Request,
    res: express.Response,
    projectId: string,
  ): Promise<string | null> {
    const session = getActiveSession(req);
    if (!session?.userId) {
      res.status(401).json({ error: "Innlogging kreves" });
      return null;
    }
    const ok = await userCanAccessCastingProject(pool, projectId, session.userId);
    if (!ok) {
      // 404, ikke 403: et prosjekt du ikke har tilgang til skal ikke kunne
      // bekreftes ved å prøve id-er.
      res.status(404).json({ error: "Prosjekt ikke funnet" });
      return null;
    }
    return session.userId;
  }

  // ── GET /projects/:projectId/role-cards ─────────────────────────────
  app.get("/api/role-room/projects/:projectId/role-cards", async (req, res) => {
    const { projectId } = req.params;
    if (!(await requireProject(req, res, projectId))) return;
    try {
      const sceneId = typeof req.query.sceneId === "string" ? req.query.sceneId : null;
      const r = await pool.query(
        `SELECT id, project_id, scene_id, production_day_id, person_name, person_kind,
                talent_id, action, cue, position, wardrobe, frame_image_url, call_time,
                sort_order, token, revoked_at, created_at, updated_at
           FROM scene_role_cards
          WHERE project_id = $1
            AND ($2::text IS NULL OR scene_id = $2)
          ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
        [projectId, sceneId],
      );
      return res.json({ cards: r.rows });
    } catch (err) {
      console.error("[role-cards GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente rollekortene" });
    }
  });

  // ── POST /projects/:projectId/role-cards ────────────────────────────
  app.post("/api/role-room/projects/:projectId/role-cards", async (req, res) => {
    const { projectId } = req.params;
    const userId = await requireProject(req, res, projectId);
    if (!userId) return;

    const body = (req.body || {}) as Record<string, unknown>;
    const personName = typeof body.person_name === "string" ? body.person_name.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!personName) return res.status(400).json({ error: "Navn må fylles ut" });
    // Et kort uten handling er en callsheet. Da er vi tilbake til det som
    // ikke virker, og kortet er verdiløst for den som får det.
    if (!action) return res.status(400).json({ error: "Kortet må si hva personen skal gjøre" });

    const kind = typeof body.person_kind === "string" && PERSON_KINDS.has(body.person_kind)
      ? body.person_kind
      : "extra";

    try {
      const r = await pool.query(
        `INSERT INTO scene_role_cards
           (project_id, scene_id, production_day_id, person_name, person_kind, talent_id,
            action, cue, position, wardrobe, frame_image_url, call_time, sort_order,
            token, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          projectId,
          typeof body.scene_id === "string" ? body.scene_id : null,
          typeof body.production_day_id === "string" ? body.production_day_id : null,
          personName,
          kind,
          typeof body.talent_id === "string" ? body.talent_id : null,
          action,
          typeof body.cue === "string" ? body.cue.trim() || null : null,
          JSON.stringify(cleanPosition(body.position)),
          typeof body.wardrobe === "string" ? body.wardrobe.trim() || null : null,
          typeof body.frame_image_url === "string" ? body.frame_image_url : null,
          typeof body.call_time === "string" ? body.call_time : null,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : null,
          newToken(),
          userId,
        ],
      );
      return res.status(201).json({ card: r.rows[0] });
    } catch (err) {
      console.error("[role-cards POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre rollekortet" });
    }
  });

  // ── PATCH /projects/:projectId/role-cards/:id ───────────────────────
  app.patch("/api/role-room/projects/:projectId/role-cards/:id", async (req, res) => {
    const { projectId, id } = req.params;
    if (!(await requireProject(req, res, projectId))) return;

    const body = (req.body || {}) as Record<string, unknown>;
    const felt: string[] = [];
    const verdier: unknown[] = [id, projectId];

    const sett = (kolonne: string, verdi: unknown) => {
      verdier.push(verdi);
      felt.push(`${kolonne} = $${verdier.length}`);
    };

    if (typeof body.person_name === "string" && body.person_name.trim()) sett("person_name", body.person_name.trim());
    if (typeof body.action === "string" && body.action.trim()) sett("action", body.action.trim());
    if (typeof body.cue === "string") sett("cue", body.cue.trim() || null);
    if (typeof body.wardrobe === "string") sett("wardrobe", body.wardrobe.trim() || null);
    if (typeof body.frame_image_url === "string") sett("frame_image_url", body.frame_image_url || null);
    if (typeof body.scene_id === "string") sett("scene_id", body.scene_id || null);
    if (typeof body.person_kind === "string" && PERSON_KINDS.has(body.person_kind)) sett("person_kind", body.person_kind);
    if (body.position !== undefined) sett("position", JSON.stringify(cleanPosition(body.position)));
    if (Number.isFinite(Number(body.sort_order))) sett("sort_order", Number(body.sort_order));
    if (body.revoked === true) sett("revoked_at", new Date().toISOString());
    if (body.revoked === false) sett("revoked_at", null);

    if (!felt.length) return res.status(400).json({ error: "Ingenting å endre" });

    try {
      // project_id i WHERE gjør dette til en eierskapssjekk: en gjettet
      // kort-id fra et annet prosjekt treffer ingen rad.
      const r = await pool.query(
        `UPDATE scene_role_cards SET ${felt.join(", ")}
          WHERE id = $1 AND project_id = $2
          RETURNING *`,
        verdier,
      );
      if (!r.rowCount) return res.status(404).json({ error: "Rollekort ikke funnet" });
      return res.json({ card: r.rows[0] });
    } catch (err) {
      console.error("[role-cards PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere rollekortet" });
    }
  });

  // ── DELETE /projects/:projectId/role-cards/:id ──────────────────────
  app.delete("/api/role-room/projects/:projectId/role-cards/:id", async (req, res) => {
    const { projectId, id } = req.params;
    if (!(await requireProject(req, res, projectId))) return;
    try {
      const r = await pool.query(
        `DELETE FROM scene_role_cards WHERE id = $1 AND project_id = $2`,
        [id, projectId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Rollekort ikke funnet" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[role-cards DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å slette rollekortet" });
    }
  });

  // ── PUT /projects/:projectId/scenes/:sceneId/blocking ───────────────
  //
  // Plantegningen og kameraet for scenen. Lagres i casting_scenes.
  // production_breakdown -> 'blocking', ikke i en egen tabell: det er ett
  // objekt per scene, og JSONB-kolonnen finnes allerede.
  //
  // jsonb_set med create_missing=true, så scener uten breakdown fra før får
  // nøkkelen i stedet for å feile stille.
  app.put("/api/role-room/projects/:projectId/scenes/:sceneId/blocking", async (req, res) => {
    const { projectId, sceneId } = req.params;
    if (!(await requireProject(req, res, projectId))) return;

    const body = (req.body || {}) as Record<string, unknown>;
    const planUrl = typeof body.planUrl === "string" ? body.planUrl.trim() : "";
    const camera = cleanPosition(body.camera);

    if (planUrl && !/^https?:\/\//i.test(planUrl)) {
      return res.status(400).json({ error: "Plantegningen må være en http(s)-adresse" });
    }

    try {
      const blocking = {
        planUrl: planUrl || null,
        camera,
        updatedAt: new Date().toISOString(),
      };
      // scene_id OG project_id i WHERE: en scene-id fra et annet prosjekt
      // skal ikke kunne skrives til ved å gjette.
      const r = await pool.query(
        `UPDATE casting_scenes
            SET production_breakdown = jsonb_set(
                  COALESCE(production_breakdown, '{}'::jsonb), '{blocking}', $3::jsonb, true),
                updated_at = now()
          WHERE id = $1 AND project_id = $2
          RETURNING id, production_breakdown -> 'blocking' AS blocking`,
        [sceneId, projectId, JSON.stringify(blocking)],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Scene ikke funnet" });
      return res.json({ blocking: r.rows[0].blocking });
    } catch (err) {
      console.error("[scene blocking PUT] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre plantegningen" });
    }
  });

  // ── GET /projects/:projectId/scenes/:sceneId/blocking ───────────────
  app.get("/api/role-room/projects/:projectId/scenes/:sceneId/blocking", async (req, res) => {
    const { projectId, sceneId } = req.params;
    if (!(await requireProject(req, res, projectId))) return;
    try {
      const r = await pool.query(
        `SELECT production_breakdown -> 'blocking' AS blocking
           FROM casting_scenes WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [sceneId, projectId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Scene ikke funnet" });
      return res.json({ blocking: r.rows[0].blocking ?? null });
    } catch (err) {
      console.error("[scene blocking GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente plantegningen" });
    }
  });

  // ── GET /role-cards/r/:token — det statisten åpner ──────────────────
  //
  // Offentlig, uten innlogging: en statist har sjelden konto, og et krav om
  // innlogging på settet er et krav ingen rekker å oppfylle.
  app.get("/api/role-room/role-cards/r/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const r = await pool.query(
        `SELECT c.id, c.person_name, c.person_kind, c.action, c.cue, c.position,
                c.wardrobe, c.frame_image_url, c.call_time, c.revoked_at,
                s.title AS scene_title, s.setting AS scene_setting,
                s.time_of_day, s.int_ext,
                s.production_breakdown -> 'blocking' AS blocking,
                p.name AS project_name
           FROM scene_role_cards c
           LEFT JOIN casting_scenes s ON s.id = c.scene_id
           LEFT JOIN casting_projects p ON p.id = c.project_id
          WHERE c.token = $1
          LIMIT 1`,
        [token],
      );

      const card = r.rows[0];
      // Ukjent og tilbaketrukket svarer likt. Skiller vi dem, kan man prøve
      // seg fram til hvilke lenker som finnes.
      if (!card || card.revoked_at) {
        return res.status(404).json({ error: "Lenken gjelder ikke lenger" });
      }

      // Bare det personen trenger for å utføre oppgaven. Ingen andre kort,
      // ingen kontaktliste, ingen budsjettall.
      return res.json({
        card: {
          person_name: card.person_name,
          person_kind: card.person_kind,
          action: card.action,
          cue: card.cue,
          position: card.position,
          wardrobe: card.wardrobe,
          frame_image_url: card.frame_image_url,
          call_time: card.call_time,
        },
        scene: {
          title: card.scene_title,
          setting: card.scene_setting,
          time_of_day: card.time_of_day,
          int_ext: card.int_ext,
          blocking: card.blocking,
        },
        project: { name: card.project_name },
      });
    } catch (err) {
      // Token aldri i loggen: den er legitimasjonen.
      console.error("[role-cards public] failed");
      return res.status(500).json({ error: "Klarte ikke å hente kortet" });
    }
  });
}
