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
import { listStoryboards } from "./storyboard-service.js";
import { composeEmail } from "./email-design-system.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";

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

/**
 * Posisjon til kolonnen. Returnerer SQL NULL, ikke JSON null.
 *
 * 🔑 JSON.stringify(null) er strengen "null", som Postgres lagrer som JSON
 * null i en jsonb-kolonne. Fra JavaScript ser de to like ut — begge blir
 * `null` — men i SQL gjør de det ikke: `WHERE position IS NULL` finner
 * JSON null-radene IKKE. Verifisert mot ekte Postgres:
 * position IS NULL → false, position = 'null'::jsonb → true.
 */
/** Avsenderens adresse, kun til rate-limit. Lagres ikke. */
function klientAdresse(req: { headers: Record<string, unknown>; socket: { remoteAddress?: string } }): string {
  const videresendt = req.headers["x-forwarded-for"];
  const rå = (Array.isArray(videresendt) ? videresendt[0] : videresendt) || req.socket.remoteAddress || "ukjent";
  return String(rå).split(",")[0].trim().slice(0, 120);
}

const forsok = new Map<string, { antall: number; nullstillesVed: number }>();
/** Enkel tak-teller. Svar-ruten er åpen, så den må tåle at noen prøver seg. */
function forMange(nokkel: string, tak: number, vindu: number): boolean {
  const na = Date.now();
  const rad = forsok.get(nokkel);
  if (!rad || rad.nullstillesVed <= na) {
    forsok.set(nokkel, { antall: 1, nullstillesVed: na + vindu });
    return false;
  }
  rad.antall += 1;
  return rad.antall > tak;
}

function positionParam(value: unknown): string | null {
  const p = cleanPosition(value);
  return p ? JSON.stringify(p) : null;
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
                sort_order, token, revoked_at, contact_email, sent_at, opened_at,
                response, responded_at, response_note, created_at, updated_at
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
      // Lenken hører til personen og dagen, ikke til scenen. Er personen alt
      // satt opp denne dagen, skal det nye kortet ligge bak SAMME lenke —
      // ellers får hen én e-post per scene og må selv koble dem sammen.
      const sceneId = typeof body.scene_id === "string" ? body.scene_id : null;
      const dayId = typeof body.production_day_id === "string" ? body.production_day_id : null;
      const eksisterende = await pool.query(
        `SELECT token FROM scene_role_cards
          WHERE project_id = $1
            AND lower(person_name) = lower($2)
            AND revoked_at IS NULL
            AND ($3::text IS NOT NULL AND production_day_id = $3)
          LIMIT 1`,
        [projectId, personName, dayId],
      );
      const token = eksisterende.rows[0]?.token ?? newToken();

      const r = await pool.query(
        `INSERT INTO scene_role_cards
           (project_id, scene_id, production_day_id, person_name, person_kind, talent_id,
            action, cue, position, wardrobe, frame_image_url, call_time, sort_order,
            token, created_by, contact_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          projectId,
          sceneId,
          dayId,
          personName,
          kind,
          typeof body.talent_id === "string" ? body.talent_id : null,
          action,
          typeof body.cue === "string" ? body.cue.trim() || null : null,
          positionParam(body.position),
          typeof body.wardrobe === "string" ? body.wardrobe.trim() || null : null,
          typeof body.frame_image_url === "string" ? body.frame_image_url : null,
          typeof body.call_time === "string" ? body.call_time : null,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : null,
          token,
          userId,
          typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() || null : null,
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
    if (typeof body.contact_email === "string") sett("contact_email", body.contact_email.trim().toLowerCase() || null);
    if (body.position !== undefined) sett("position", positionParam(body.position));
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

  // ── POST /projects/:projectId/role-cards/send ───────────────────────
  //
  // Sender lenken til hver person som har en adresse. På et sett med tjue
  // statister er alternativet tjue manuelle kopieringer — og tjue
  // anledninger til å sende feil lenke til feil person.
  //
  // Tre regler:
  //
  //   Adressen hentes fra profilen når personen har en, ellers fra kortet.
  //   Én kilde, ikke to som kan sprike.
  //
  //   Allerede sendt hoppes over, med mindre kallet sier resend. «Send til
  //   alle» skal ikke spamme dem som fikk lenken i går.
  //
  //   Kort uten handling sendes ikke. Det er ingenting å si til personen
  //   ennå, og en tom lenke lærer folk at kortet ikke er til å stole på.
  app.post("/api/role-room/projects/:projectId/role-cards/send", async (req, res) => {
    const { projectId } = req.params;
    if (!(await requireProject(req, res, projectId))) return;

    const body = (req.body || {}) as Record<string, unknown>;
    const sceneId = typeof body.scene_id === "string" ? body.scene_id : null;
    const resend = body.resend === true;
    const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === "string") : null;

    try {
      const r = await pool.query(
        `SELECT c.id, c.person_name, c.action, c.cue, c.call_time, c.token, c.sent_at,
                COALESCE(t.email, c.contact_email) AS epost,
                s.title AS scene_title,
                p.name AS project_name
           FROM scene_role_cards c
           LEFT JOIN talents t ON t.id = c.talent_id
           LEFT JOIN casting_scenes s ON s.id = c.scene_id
           LEFT JOIN casting_projects p ON p.id = c.project_id
          WHERE c.project_id = $1
            AND c.revoked_at IS NULL
            AND ($2::text IS NULL OR c.scene_id = $2)
            AND ($3::text[] IS NULL OR c.id = ANY($3::uuid[]))
          ORDER BY c.call_time ASC NULLS LAST, c.sort_order ASC NULLS LAST, c.created_at ASC`,
        [projectId, sceneId, ids],
      );

      // Én e-post per LENKE, ikke per kort: er personen med i tre scener samme
      // dag, deler kortene token, og tre like e-poster ville bare skapt tvil om
      // hvilken som gjelder.
      const grupper = new Map<string, typeof r.rows>();
      for (const rad of r.rows) {
        const gruppe = grupper.get(rad.token);
        if (gruppe) gruppe.push(rad);
        else grupper.set(rad.token, [rad]);
      }

      const base = (process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com").replace(/\/+$/, "");
      const sendt: string[] = [];
      const hoppet: Array<{ id: string; grunn: string }> = [];
      // Kvitteringen teller PERSONER, ikke kort: «4 sendt» skal bety fire som
      // har fått beskjed, ikke fire kort fordelt på to personer.
      let lenkerSendt = 0;

      for (const kort of grupper.values()) {
        const forste = kort[0];
        const idene = kort.map((k) => k.id);
        if (!forste.epost) { hoppet.push({ id: forste.id, grunn: "mangler_epost" }); continue; }
        if (!kort.some((k) => k.action)) { hoppet.push({ id: forste.id, grunn: "mangler_handling" }); continue; }
        if (kort.some((k) => k.sent_at) && !resend) { hoppet.push({ id: forste.id, grunn: "alt_sendt" }); continue; }

        const lenke = `${base}/statist/${forste.token}`;
        const flere = kort.length > 1;
        const emne = flere
          ? `Dine oppgaver — ${kort.length} scener`
          : `Din oppgave${forste.scene_title ? ` — ${forste.scene_title}` : ""}`;
        const { html, text } = composeEmail({
          subject: emne,
          category: "general",
          brand: "roleroom",
          preheader: flere
            ? `Du er med i ${kort.length} scener denne dagen.`
            : `Din oppgave: ${String(forste.action).slice(0, 80)}`,
          headline: `Hei ${forste.person_name}`,
          subhead: flere
            ? `${forste.project_name ?? "Produksjonen"} — ${kort.length} scener denne dagen`
            : (forste.scene_title ? `${forste.project_name ?? "Produksjonen"} — ${forste.scene_title}` : (forste.project_name ?? "Produksjonen")),
          // Med flere scener hører hele oppgaven hjemme på kortet, ikke i
          // e-posten: da slipper personen å lese to steder som kan sprike.
          body: flere ? "Du er med i flere scener denne dagen. Kortet ditt viser dem i rekkefølge." : forste.action,
          table: flere
            ? kort.map((k) => ({
                label: k.scene_title ?? "Scene",
                value: k.call_time ? new Date(k.call_time).toLocaleString("nb-NO") : String(k.action).slice(0, 60),
              }))
            : [
                ...(forste.cue ? [{ label: "Signalet ditt", value: String(forste.cue) }] : []),
                ...(forste.call_time
                  ? [{ label: "Oppmøte", value: new Date(forste.call_time).toLocaleString("nb-NO") }]
                  : []),
              ],
          cta: { label: flere ? "Åpne kortet ditt" : "Åpne kortet ditt", href: lenke },
          footer: { reason: "Du får denne fordi du er satt opp på en innspilling." },
        });

        const svar = await sendTransactionalEmail({
          to: String(forste.epost),
          subject: emne,
          html,
          text,
        });

        if (svar.sent) {
          lenkerSendt += 1;
          sendt.push(...idene);
          await pool.query(`UPDATE scene_role_cards SET sent_at = now() WHERE id = ANY($1::uuid[])`, [idene]);
        } else {
          // Årsaken fra e-posttjenesten, ikke lenken: den er legitimasjon.
          hoppet.push({ id: forste.id, grunn: svar.reason ?? "sending_feilet" });
        }
      }

      return res.json({ sent: lenkerSendt, sentIds: sendt, skipped: hoppet });
    } catch (err) {
      console.error("[role-cards send] failed", err);
      return res.status(500).json({ error: "Klarte ikke å sende lenkene" });
    }
  });

  // ── GET /projects/:projectId/scenes/:sceneId/frames ─────────────────
  //
  // Storyboard-rammene for scenen, til å velge hvilken ramme en person er
  // med i. Gjenbruker listStoryboards — rammene finnes alt, de har bare
  // aldri vært knyttet til en PERSON.
  //
  // Bildene ligger som data-URL i image_data og kan være store. Listen gir
  // derfor bare id, tittel og om rammen har bilde; selve bildet hentes når
  // én ramme velges. Ellers ville en scene med tjue rammer sendt tjue
  // fullstørrelses bilder for å tegne en liste.
  app.get("/api/role-room/projects/:projectId/scenes/:sceneId/frames", async (req, res) => {
    const { projectId, sceneId } = req.params;
    if (!(await requireProject(req, res, projectId))) return;
    try {
      const rammer = await listStoryboards(pool, projectId, sceneId);
      return res.json({
        frames: rammer.map((f) => ({
          id: f.id,
          frameId: f.frameId,
          title: f.title,
          hasImage: Boolean(f.imageData),
          updatedAt: f.updatedAt,
        })),
      });
    } catch (err) {
      console.error("[scene frames GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente rammene" });
    }
  });

  // ── GET /projects/:projectId/frames/:frameId/image ──────────────────
  //
  // Selve bildet, etter at rammen er valgt. Prosjekt-scopet som alt annet.
  app.get("/api/role-room/projects/:projectId/frames/:frameId/image", async (req, res) => {
    const { projectId, frameId } = req.params;
    if (!(await requireProject(req, res, projectId))) return;
    try {
      const r = await pool.query(
        `SELECT image_data FROM casting_storyboards WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [frameId, projectId],
      );
      if (!r.rowCount || !r.rows[0].image_data) {
        return res.status(404).json({ error: "Rammen har ikke bilde" });
      }
      return res.json({ imageData: r.rows[0].image_data });
    } catch (err) {
      console.error("[frame image GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente bildet" });
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
                c.response, c.responded_at, c.response_note,
                s.title AS scene_title, s.setting AS scene_setting,
                s.time_of_day, s.int_ext,
                s.production_breakdown -> 'blocking' AS blocking,
                p.name AS project_name,
                d.date AS day_date,
                l.name AS location_name, l.address AS location_address,
                l.access_notes AS location_access
           FROM scene_role_cards c
           LEFT JOIN casting_scenes s ON s.id = c.scene_id
           LEFT JOIN casting_projects p ON p.id = c.project_id
           -- Dagen kortet hører til. Er den ikke satt på kortet, finner vi den
           -- dagen som har scenen i seg: stedet står på dagen, ikke på scenen.
           LEFT JOIN casting_production_days d
                  ON d.project_id = c.project_id
                 AND (d.id = c.production_day_id
                      OR (c.production_day_id IS NULL
                          AND c.scene_id IS NOT NULL
                          AND d.scene_ids @> to_jsonb(c.scene_id)))
           LEFT JOIN casting_locations l ON l.id = d.location_id
          WHERE c.token = $1
          ORDER BY c.call_time ASC NULLS LAST, c.sort_order ASC NULLS LAST, c.created_at ASC`,
        [token],
      );

      const rader = r.rows;
      const forste = rader[0];
      // Ukjent og tilbaketrukket svarer likt. Skiller vi dem, kan man prøve
      // seg fram til hvilke lenker som finnes.
      // Er ETT kort trukket tilbake, er hele lenken trukket tilbake: kortene bak
      // den er samme persons dag, og en halv dag er verre enn ingen.
      if (!forste || rader.some((rad) => rad.revoked_at)) {
        return res.status(404).json({ error: "Lenken gjelder ikke lenger" });
      }

      // Første åpning markeres, senere lar radene stå: spørsmålet er «har hen
      // sett kortet?», ikke hvor mange ganger. `opened_at IS NULL` gjør det til
      // et no-op etter første gang. Alle kortene bak lenken merkes samtidig —
      // personen åpnet lenken, ikke ett kort av gangen.
      // Feiler skrivingen, vises kortene likevel — kvitteringen er mindre viktig
      // enn at personen får se hva hen skal gjøre.
      pool
        .query(
          `UPDATE scene_role_cards SET opened_at = NOW()
            WHERE token = $1 AND opened_at IS NULL`,
          [token],
        )
        .catch((err) => console.error("[role-cards public] kunne ikke markere åpnet", err));

      // Bare det personen trenger for å utføre oppgaven. Ingen andre personers
      // kort, ingen kontaktliste, ingen budsjettall.
      return res.json({
        person: { name: forste.person_name, kind: forste.person_kind },
        // Én oppføring per scene personen er med i denne dagen, i rekkefølgen
        // dagen faktisk går.
        cards: rader.map((rad) => ({
          card: {
            person_name: rad.person_name,
            person_kind: rad.person_kind,
            action: rad.action,
            cue: rad.cue,
            position: rad.position,
            wardrobe: rad.wardrobe,
            frame_image_url: rad.frame_image_url,
            call_time: rad.call_time,
          },
          scene: {
            title: rad.scene_title,
            setting: rad.scene_setting,
            time_of_day: rad.time_of_day,
            int_ext: rad.int_ext,
            blocking: rad.blocking,
          },
        })),
        // Hvor og når. «Oppmøte 07:30» uten adresse er halve beskjeden — og
        // den halvdelen som gjør at folk står feil sted til rett tid.
        // Bare navn, adresse og hvordan man kommer inn; ingen kontaktinfo til
        // stedet, den hører produksjonen til.
        meeting: forste.location_name || forste.location_address
          ? {
              name: forste.location_name,
              address: forste.location_address,
              access_notes: forste.location_access,
              date: forste.day_date,
            }
          : null,
        // Personens eget svar, så kortet kan vise hva hen har sagt i stedet for
        // å spørre på nytt hver gang lenken åpnes.
        response: forste.response
          ? { svar: forste.response, tidspunkt: forste.responded_at, melding: forste.response_note }
          : null,
        project: { name: forste.project_name },
      });
    } catch (err) {
      // Token aldri i loggen: den er legitimasjonen.
      console.error("[role-cards public] failed");
      return res.status(500).json({ error: "Klarte ikke å hente kortet" });
    }
  });

  // ── POST /role-cards/r/:token/svar — «jeg kommer» / «jeg kan ikke» ───
  //
  // Åpen, som kortet selv: lenken ER legitimasjonen, og et krav om innlogging
  // ville gjort at ingen svarte. Svaret hører til personens dag, ikke til den
  // enkelte scenen — du kommer til dagen, ikke til scene 3.
  app.post("/api/role-room/role-cards/r/:token/svar", async (req, res) => {
    const { token } = req.params;
    // Åpen rute: en som gjetter på token skal ikke kunne prøve i det uendelige.
    if (forMange(`svar:${klientAdresse(req)}`, 30, 10 * 60_000)) {
      return res.status(429).json({ error: "For mange forsøk. Prøv igjen om en stund." });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const svar = body.svar === "kommer" || body.svar === "kan_ikke" ? body.svar : null;
    if (!svar) return res.status(400).json({ error: "Svaret må være «kommer» eller «kan_ikke»" });
    const melding = typeof body.melding === "string" ? body.melding.trim().slice(0, 500) || null : null;

    try {
      const r = await pool.query(
        `UPDATE scene_role_cards
            SET response = $2, responded_at = NOW(), response_note = $3
          WHERE token = $1 AND revoked_at IS NULL
          RETURNING id`,
        [token, svar, melding],
      );
      // Ukjent og tilbaketrukket svarer likt her også — ellers kan man prøve
      // seg fram til hvilke lenker som finnes.
      if (r.rowCount === 0) return res.status(404).json({ error: "Lenken gjelder ikke lenger" });

      return res.json({ svar, tidspunkt: new Date().toISOString(), melding });
    } catch (err) {
      console.error("[role-cards svar] failed");
      return res.status(500).json({ error: "Klarte ikke å lagre svaret" });
    }
  });
}
