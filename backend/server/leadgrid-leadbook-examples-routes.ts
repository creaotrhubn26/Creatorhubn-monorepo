/**
 * leadgrid-leadbook-examples-routes.ts
 *
 * Leadbook «Eksempler» — org-egne salgssamtale-caser (2026-07-17).
 * Erstatter mock-casene: organisasjonens egne vunnede/tapte samtaler,
 * kuratert av ledere, med tilbakemeldinger fra salgssjef/teamleder.
 *
 * Prefix: /api/leadgrid/leadbook/examples*
 *
 * Auth-modell:
 *   • Innlogging kreves overalt; org utledes av medlemskap (aldri fra body).
 *   • Lese: alle org-medlemmer ser `published`; ledere ser også `draft`.
 *   • Skrive (opprett/rediger/publiser/arkiver): admin|salgssjef|teamleder|kvalitet.
 *   • Tilbakemelding: admin|salgssjef|teamleder (Daniel 2026-07-17:
 *     «salgsleder og teamleder kan gi tilbakemelding på salgssamtalene»).
 *   • Entitlement: leadbookEksempler (feature-matrisen) på alle endepunkter.
 *
 * Forutsetter mig 0379 (leadbook_examples + leadbook_example_feedback).
 * Fylles også fra Kvalitet: verdikt-endepunktet oppretter draft ved
 * `flag_as_example` (se leadgrid-quality-routes.ts).
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled } from "./leadgrid-entitlement-guard.js";
import { sendAPNs } from "./lead-map-apns-client.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface LeadbookExamplesRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

const EXAMPLES_FEATURE_KEYS = ["leadbookEksempler"];
const WRITE_ROLES = new Set(["admin", "salgssjef", "teamleder", "kvalitet"]);
const FEEDBACK_ROLES = new Set(["admin", "salgssjef", "teamleder"]);
const VALID_STATUS = new Set(["draft", "published", "archived"]);
const VALID_OUTCOME = new Set(["won", "lost", "ongoing"]);
const VALID_DIMENSIONS = new Set([
  "autoritet", "klarhet", "troverdighet", "trygghet", "fremdrift",
]);

async function orgRole(
  pool: Pool, orgId: string, userId: string,
): Promise<string | null> {
  try {
    const r = await pool.query<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE organization_id = $1::uuid AND user_id = $2 LIMIT 1`,
      [orgId, userId],
    );
    return r.rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function jsonArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function registerLeadgridLeadbookExamplesRoutes(
  deps: LeadbookExamplesRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // Felles inngangsvakt: sesjon + org + entitlement. Returnerer null hvis
  // et svar alt er sendt.
  async function guard(
    req: Request, res: Response,
  ): Promise<{ session: SessionUser; orgId: string; role: string | null } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "ingen_organisasjon" });
      return null;
    }
    const ok = await assertAnyEntitled(pool, session.userId, EXAMPLES_FEATURE_KEYS, res);
    if (!ok) return null;
    const role = await orgRole(pool, orgId, session.userId);
    return { session, orgId, role };
  }

  // ── GET /api/leadgrid/leadbook/examples ───────────────────────────
  // Publiserte for alle medlemmer; ledere ser også drafts (kurerings-kø).
  // Tilbakemeldinger joines inn per eksempel.
  app.get("/api/leadgrid/leadbook/examples", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    const isLeder = g.role != null && WRITE_ROLES.has(g.role);
    try {
      const r = await pool.query(
        `SELECT * FROM leadbook_examples
          WHERE organization_id = $1 AND status <> 'archived'
            AND (status = 'published' OR $2)
          ORDER BY created_at DESC
          LIMIT 200`,
        [g.orgId, isLeder],
      );
      const ids = r.rows.map((row) => row.id);
      let feedback: Record<string, unknown[]> = {};
      if (ids.length > 0) {
        const fr = await pool.query(
          `SELECT * FROM leadbook_example_feedback
            WHERE example_id = ANY($1::uuid[])
            ORDER BY created_at ASC`,
          [ids],
        );
        // Svar-tråder (2026-07-17, dialog-utvidelsen) joines inn per
        // tilbakemelding.
        const fbIds = fr.rows.map((row) => row.id);
        let replies: Record<string, unknown[]> = {};
        if (fbIds.length > 0) {
          const rr = await pool.query(
            `SELECT * FROM leadbook_feedback_replies
              WHERE feedback_id = ANY($1::uuid[])
              ORDER BY created_at ASC`,
            [fbIds],
          );
          replies = rr.rows.reduce((acc: Record<string, unknown[]>, row) => {
            (acc[row.feedback_id] ??= []).push(row);
            return acc;
          }, {});
        }
        feedback = fr.rows.reduce((acc: Record<string, unknown[]>, row) => {
          (acc[row.example_id] ??= []).push({
            ...row,
            replies: replies[row.id] ?? [],
          });
          return acc;
        }, {});
      }
      // Visningstall (2026-07-17, distribusjon): kun for ledere — «så
      // ledere ser hva som faktisk brukes».
      let views: Record<string, { views_total: number; viewers: number }> = {};
      if (isLeder && ids.length > 0) {
        const vr = await pool.query<{
          example_id: string; views_total: number; viewers: number;
        }>(
          `SELECT example_id, SUM(view_count)::int AS views_total,
                  COUNT(*)::int AS viewers
             FROM leadbook_example_views
            WHERE example_id = ANY($1::uuid[])
            GROUP BY example_id`,
          [ids],
        );
        views = Object.fromEntries(vr.rows.map((row) => [
          row.example_id,
          { views_total: row.views_total, viewers: row.viewers },
        ]));
      }
      return res.json({
        examples: r.rows.map((row) => ({
          ...row,
          feedback: feedback[row.id] ?? [],
          views_total: views[row.id]?.views_total ?? null,
          viewers_count: views[row.id]?.viewers ?? null,
        })),
        canEdit: isLeder,
        canGiveFeedback: g.role != null && FEEDBACK_ROLES.has(g.role),
      });
    } catch (err) {
      console.warn("[leadbook-examples] list failed:", (err as Error).message);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/examples — opprett (leder) ────────
  app.post("/api/leadgrid/leadbook/examples", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const title = str(b.title).trim();
    if (!title) return res.status(400).json({ error: "mangler_tittel" });
    const status = VALID_STATUS.has(str(b.status)) ? str(b.status) : "draft";
    const outcome = VALID_OUTCOME.has(str(b.outcome)) ? str(b.outcome) : "won";
    const featured = VALID_DIMENSIONS.has(str(b.featured_dimension))
      ? str(b.featured_dimension) : null;
    try {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadbook_examples
           (id, organization_id, status, title, customer_label, industry,
            outcome, channel, duration_sec, seller_user_id, seller_name,
            happened_on, pondus_score, featured_dimension, dimension_scores,
            key_learnings, alternative_phrasings, transcript, key_moments,
            deal_value_nok, summary, created_by, created_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                 $15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21,$22,$23)`,
        [
          id, g.orgId, status, title,
          str(b.customer_label), str(b.industry), outcome,
          str(b.channel, "telephone"),
          intOrNull(b.duration_sec),
          str(b.seller_user_id) || null, str(b.seller_name),
          str(b.happened_on) || null,
          intOrNull(b.pondus_score), featured,
          JSON.stringify(b.dimension_scores ?? {}),
          JSON.stringify(jsonArr(b.key_learnings)),
          JSON.stringify(jsonArr(b.alternative_phrasings)),
          JSON.stringify(jsonArr(b.transcript)),
          JSON.stringify(jsonArr(b.key_moments)),
          intOrNull(b.deal_value_nok),
          str(b.summary),
          g.session.userId, g.session.name ?? "",
        ],
      );
      return res.status(201).json({ id });
    } catch (err) {
      console.warn("[leadbook-examples] create failed:", (err as Error).message);
      return res.status(500).json({ error: "create_failed" });
    }
  });

  // ── PATCH /api/leadgrid/leadbook/examples/:id — rediger/publiser ──
  app.patch("/api/leadgrid/leadbook/examples/:id", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (col: string, val: unknown) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (typeof b.title === "string" && b.title.trim()) push("title", b.title.trim());
    if (typeof b.status === "string" && VALID_STATUS.has(b.status)) push("status", b.status);
    if (typeof b.customer_label === "string") push("customer_label", b.customer_label);
    if (typeof b.industry === "string") push("industry", b.industry);
    if (typeof b.outcome === "string" && VALID_OUTCOME.has(b.outcome)) push("outcome", b.outcome);
    if (typeof b.channel === "string") push("channel", b.channel);
    if (b.duration_sec !== undefined) push("duration_sec", intOrNull(b.duration_sec));
    if (typeof b.seller_name === "string") push("seller_name", b.seller_name);
    if (b.pondus_score !== undefined) push("pondus_score", intOrNull(b.pondus_score));
    if (typeof b.featured_dimension === "string" && VALID_DIMENSIONS.has(b.featured_dimension)) {
      push("featured_dimension", b.featured_dimension);
    }
    if (b.dimension_scores !== undefined) push("dimension_scores", JSON.stringify(b.dimension_scores ?? {}));
    if (b.key_learnings !== undefined) push("key_learnings", JSON.stringify(jsonArr(b.key_learnings)));
    if (b.alternative_phrasings !== undefined) push("alternative_phrasings", JSON.stringify(jsonArr(b.alternative_phrasings)));
    if (b.transcript !== undefined) push("transcript", JSON.stringify(jsonArr(b.transcript)));
    if (b.key_moments !== undefined) push("key_moments", JSON.stringify(jsonArr(b.key_moments)));
    if (b.deal_value_nok !== undefined) push("deal_value_nok", intOrNull(b.deal_value_nok));
    if (typeof b.summary === "string") push("summary", b.summary);
    if (sets.length === 0) return res.status(400).json({ error: "ingenting_aa_oppdatere" });
    push("updated_at", new Date());
    vals.push(req.params.id, g.orgId);
    try {
      // Publiserings-deteksjon (2026-07-17, «Ukens samtale»): les gammel
      // status FØR update så vi kun varsler på draft→published-overgangen.
      const publishing = b.status === "published";
      let oldStatus: string | null = null;
      if (publishing) {
        const prev = await pool.query<{ status: string }>(
          `SELECT status FROM leadbook_examples
            WHERE id = $1::uuid AND organization_id = $2 LIMIT 1`,
          [req.params.id, g.orgId],
        );
        oldStatus = prev.rows[0]?.status ?? null;
      }

      const r = await pool.query(
        `UPDATE leadbook_examples SET ${sets.join(", ")}
          WHERE id = $${vals.length - 1}::uuid AND organization_id = $${vals.length}
          RETURNING id`,
        vals,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });

      // «Ukens samtale»-digest: nytt publisert eksempel → varsle hele
      // org-en (unntatt publisereren). Best effort — velter aldri patchen.
      if (publishing && oldStatus !== "published") {
        notifyOrgOfPublish(g.orgId, req.params.id, g.session.userId)
          .catch((e) => console.warn(
            "[leadbook-examples] publish-notify feilet:", (e as Error).message));
      }
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadbook-examples] patch failed:", (err as Error).message);
      return res.status(500).json({ error: "patch_failed" });
    }
  });

  /// Publiserings-varsel til alle org-medlemmer: «Ny vinnersamtale fra
  /// Marte — 340K, sterk på Trygghet». Kjøres asynkront etter patch-svaret.
  async function notifyOrgOfPublish(
    orgId: string, exampleId: string, publisherUserId: string,
  ): Promise<void> {
    const ex = await pool.query<{
      title: string; outcome: string; seller_name: string;
      deal_value_nok: string | number | null; featured_dimension: string | null;
    }>(
      `SELECT title, outcome, seller_name, deal_value_nok, featured_dimension
         FROM leadbook_examples
        WHERE id = $1::uuid AND organization_id = $2 LIMIT 1`,
      [exampleId, orgId],
    );
    const row = ex.rows[0];
    if (!row) return;

    const kind = row.outcome === "won" ? "vinnersamtale"
      : row.outcome === "lost" ? "læringssamtale" : "salgssamtale";
    const parts: string[] = [];
    const value = row.deal_value_nok != null ? Number(row.deal_value_nok) : null;
    if (value != null && Number.isFinite(value) && value > 0) {
      parts.push(value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1).replace(".", ",")} mill`
        : `${Math.round(value / 1000)}K`);
    }
    if (row.featured_dimension) {
      const label = row.featured_dimension.charAt(0).toUpperCase()
        + row.featured_dimension.slice(1);
      parts.push(`sterk på ${label}`);
    }
    const title = `Ny ${kind}${row.seller_name ? ` fra ${row.seller_name}` : ""}`;
    const body = parts.length > 0
      ? `«${row.title}» — ${parts.join(", ")}`
      : `«${row.title}»`;
    const deepLink = `leadgrid://leadbook/examples/${exampleId}`;

    const members = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM organization_members
        WHERE organization_id = $1::uuid AND user_id <> $2`,
      [orgId, publisherUserId],
    );
    for (const m of members.rows) {
      await notifyUser(
        m.user_id, orgId, publisherUserId,
        "leadbook_example_published", title, body, deepLink,
        { example_id: exampleId },
      );
    }
  }

  // ── POST /api/leadgrid/leadbook/examples/:id/view ─────────────────
  // Visnings-registrering (alle medlemmer): upsert m/ teller. Appen
  // kaller når detail-sheeten åpnes i ekte modus.
  app.post("/api/leadgrid/leadbook/examples/:id/view", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    try {
      const ex = await pool.query(
        `SELECT id FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 LIMIT 1`,
        [req.params.id, g.orgId],
      );
      if (ex.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      await pool.query(
        `INSERT INTO leadbook_example_views (example_id, organization_id, user_id)
         VALUES ($1::uuid, $2, $3)
         ON CONFLICT (example_id, user_id)
         DO UPDATE SET view_count = leadbook_example_views.view_count + 1,
                       last_viewed_at = now()`,
        [req.params.id, g.orgId, g.session.userId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadbook-examples] view failed:", (err as Error).message);
      return res.status(500).json({ error: "view_failed" });
    }
  });

  // ── DELETE — arkiver (soft) ───────────────────────────────────────
  app.delete("/api/leadgrid/leadbook/examples/:id", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const r = await pool.query(
        `UPDATE leadbook_examples SET status = 'archived', updated_at = now()
          WHERE id = $1::uuid AND organization_id = $2 RETURNING id`,
        [req.params.id, g.orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadbook-examples] delete failed:", (err as Error).message);
      return res.status(500).json({ error: "delete_failed" });
    }
  });

  // ── POST /:id/feedback — leder-tilbakemelding på samtalen ─────────
  app.post("/api/leadgrid/leadbook/examples/:id/feedback", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !FEEDBACK_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_salgssjef_eller_teamleder" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const body = str(b.body).trim();
    if (!body) return res.status(400).json({ error: "mangler_tekst" });
    const dimension = VALID_DIMENSIONS.has(str(b.dimension)) ? str(b.dimension) : null;
    // Valgfritt anker (2026-07-17): konkret replikk (indeks i transcript-
    // arrayen) og/eller tidspunkt i sekunder (fase 2-lyd).
    const transcriptIndex = intOrNull(b.transcript_index ?? b.transcriptIndex);
    const atSec = intOrNull(b.at_sec ?? b.atSec);
    try {
      // Eksempelet må finnes i samme org (IDOR-vakt) — og vi trenger
      // selger + tittel til varslingen.
      const ex = await pool.query<{
        id: string; title: string; seller_user_id: string | null;
      }>(
        `SELECT id, title, seller_user_id FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 LIMIT 1`,
        [req.params.id, g.orgId],
      );
      const example = ex.rows[0];
      if (!example) return res.status(404).json({ error: "ikke_funnet" });
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadbook_example_feedback
           (id, example_id, organization_id, author_user_id, author_name,
            author_role, dimension, body, transcript_index, at_sec)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id, req.params.id, g.orgId,
          g.session.userId, g.session.name ?? "",
          g.role, dimension, body, transcriptIndex, atSec,
        ],
      );

      // Varsle selgeren (2026-07-17, Daniel: «hvordan får brukerne
      // notifikasjon på at de har fått tilbakemelding?») — samme pipeline
      // som lead-tildeling: in-app-innboks (notification_events, driver
      // bjelle-badgen) + APNs-push. Best effort — varslingsfeil skal aldri
      // velte selve tilbakemeldingen. Hopp over selv-feedback.
      const sellerId = example.seller_user_id;
      if (sellerId && sellerId !== g.session.userId) {
        const title = `Tilbakemelding fra ${g.session.name || "leder"}`;
        const excerpt = body.length > 120 ? `${body.slice(0, 117)}…` : body;
        const notifBody = `«${example.title}»: ${excerpt}`;
        const deepLink = `leadgrid://leadbook/examples/${example.id}`;
        try {
          await pool.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, event_type, title, body,
                triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, 'leadbook_example_feedback', $3, $4, $5, $6, $7::jsonb, FALSE)`,
            [
              sellerId, g.orgId, title, notifBody,
              g.session.userId, deepLink,
              JSON.stringify({ example_id: example.id, dimension, at_sec: atSec }),
            ],
          );
        } catch (e) {
          console.warn("[leadbook-examples] notif in_app feilet:", (e as Error).message);
        }
        try {
          const tokRes = await pool.query<{ token: string }>(
            `SELECT token FROM notification_device_tokens
              WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`,
            [sellerId],
          );
          for (const t of tokRes.rows) {
            const r = await sendAPNs(t.token, title, notifBody, {
              customData: {
                event_type: "leadbook_example_feedback",
                deep_link: deepLink,
              },
            });
            if (r.sent) break;
            if (r.shouldDisableToken) {
              await pool.query(
                `UPDATE notification_device_tokens SET enabled = FALSE
                  WHERE token = $1 AND user_id = $2`,
                [t.token, sellerId],
              ).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("[leadbook-examples] notif apns feilet:", (e as Error).message);
        }
      }

      return res.status(201).json({ id });
    } catch (err) {
      console.warn("[leadbook-examples] feedback failed:", (err as Error).message);
      return res.status(500).json({ error: "feedback_failed" });
    }
  });

  // ═══ Dialog-utvidelsen (2026-07-17): lest-kvittering + svar-tråd +
  // «Mine tilbakemeldinger». Daniel: «Gjør tilbakemeldingen til en
  // dialog, ikke en megafon.» ═══

  /// Delt varslings-helper (in-app + APNs, best effort) — samme pipeline
  /// som lead-tildeling; feil velter aldri hovedoperasjonen.
  async function notifyUser(
    recipientUserId: string, orgId: string, triggeredBy: string,
    eventType: string, title: string, notifBody: string, deepLink: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO notification_events
           (recipient_user_id, organization_id, event_type, title, body,
            triggered_by_user_id, deep_link, meta, email_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, FALSE)`,
        [recipientUserId, orgId, eventType, title, notifBody,
         triggeredBy, deepLink, JSON.stringify(meta)],
      );
    } catch (e) {
      console.warn("[leadbook-examples] notif in_app feilet:", (e as Error).message);
    }
    try {
      const tokRes = await pool.query<{ token: string }>(
        `SELECT token FROM notification_device_tokens
          WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`,
        [recipientUserId],
      );
      for (const t of tokRes.rows) {
        const r = await sendAPNs(t.token, title, notifBody, {
          customData: { event_type: eventType, deep_link: deepLink },
        });
        if (r.sent) break;
        if (r.shouldDisableToken) {
          await pool.query(
            `UPDATE notification_device_tokens SET enabled = FALSE
              WHERE token = $1 AND user_id = $2`,
            [t.token, recipientUserId],
          ).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[leadbook-examples] notif apns feilet:", (e as Error).message);
    }
  }

  // ── GET /api/leadgrid/leadbook/feedback/mine ──────────────────────
  // Selgerens samleflate: all tilbakemelding på eksempler der DE er
  // selger, med eksempel-kontekst + svar-tråd + lest-status.
  app.get("/api/leadgrid/leadbook/feedback/mine", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    try {
      const r = await pool.query(
        `SELECT f.*, e.title AS example_title, e.outcome AS example_outcome,
                e.status AS example_status
           FROM leadbook_example_feedback f
           JOIN leadbook_examples e ON e.id = f.example_id
          WHERE f.organization_id = $1
            AND e.seller_user_id = $2
            AND e.status <> 'archived'
          ORDER BY f.created_at DESC
          LIMIT 200`,
        [g.orgId, g.session.userId],
      );
      const fbIds = r.rows.map((row) => row.id);
      let replies: Record<string, unknown[]> = {};
      if (fbIds.length > 0) {
        const rr = await pool.query(
          `SELECT * FROM leadbook_feedback_replies
            WHERE feedback_id = ANY($1::uuid[])
            ORDER BY created_at ASC`,
          [fbIds],
        );
        replies = rr.rows.reduce((acc: Record<string, unknown[]>, row) => {
          (acc[row.feedback_id] ??= []).push(row);
          return acc;
        }, {});
      }
      const unread = r.rows.filter((row) => row.read_at == null).length;
      return res.json({
        feedback: r.rows.map((row) => ({ ...row, replies: replies[row.id] ?? [] })),
        unread,
      });
    } catch (err) {
      console.warn("[leadbook-examples] mine failed:", (err as Error).message);
      return res.status(500).json({ error: "mine_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/feedback/:id/read ─────────────────
  // Lest-kvittering — KUN eksempelets selger kan markere som lest
  // (kvitteringen betyr «selgeren har sett den», ikke «noen åpnet den»).
  app.post("/api/leadgrid/leadbook/feedback/:id/read", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    try {
      const r = await pool.query(
        `UPDATE leadbook_example_feedback f
            SET read_at = COALESCE(f.read_at, now())
           FROM leadbook_examples e
          WHERE f.id = $1::uuid AND f.organization_id = $2
            AND e.id = f.example_id AND e.seller_user_id = $3
          RETURNING f.id`,
        [req.params.id, g.orgId, g.session.userId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadbook-examples] read failed:", (err as Error).message);
      return res.status(500).json({ error: "read_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/feedback/:id/replies ──────────────
  // Svar i tråden: eksempelets selger ELLER leder-roller. Motparten
  // varsles (selger svarer → forfatteren av tilbakemeldingen; leder
  // svarer → selgeren).
  app.post("/api/leadgrid/leadbook/feedback/:id/replies", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const body = str(b.body).trim();
    if (!body) return res.status(400).json({ error: "mangler_tekst" });
    try {
      const fb = await pool.query<{
        id: string; author_user_id: string; example_id: string;
        seller_user_id: string | null; example_title: string;
      }>(
        `SELECT f.id, f.author_user_id, f.example_id,
                e.seller_user_id, e.title AS example_title
           FROM leadbook_example_feedback f
           JOIN leadbook_examples e ON e.id = f.example_id
          WHERE f.id = $1::uuid AND f.organization_id = $2 LIMIT 1`,
        [req.params.id, g.orgId],
      );
      const row = fb.rows[0];
      if (!row) return res.status(404).json({ error: "ikke_funnet" });

      const isSeller = row.seller_user_id === g.session.userId;
      const isLeder = g.role != null && FEEDBACK_ROLES.has(g.role);
      if (!isSeller && !isLeder) {
        return res.status(403).json({ error: "kun_selger_eller_leder" });
      }

      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadbook_feedback_replies
           (id, feedback_id, organization_id, author_user_id, author_name,
            author_role, body)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, req.params.id, g.orgId, g.session.userId,
         g.session.name ?? "", isSeller ? "selger" : (g.role ?? ""), body],
      );

      // Selgerens svar teller som lest (de har åpenbart sett den).
      if (isSeller) {
        await pool.query(
          `UPDATE leadbook_example_feedback
              SET read_at = COALESCE(read_at, now())
            WHERE id = $1::uuid`,
          [req.params.id],
        ).catch(() => {});
      }

      const recipient = isSeller ? row.author_user_id : row.seller_user_id;
      if (recipient && recipient !== g.session.userId) {
        const excerpt = body.length > 120 ? `${body.slice(0, 117)}…` : body;
        await notifyUser(
          recipient, g.orgId, g.session.userId,
          "leadbook_feedback_reply",
          `Svar fra ${g.session.name || (isSeller ? "selger" : "leder")}`,
          `«${row.example_title}»: ${excerpt}`,
          `leadgrid://leadbook/examples/${row.example_id}`,
          { example_id: row.example_id, feedback_id: row.id },
        );
      }
      return res.status(201).json({ id });
    } catch (err) {
      console.warn("[leadbook-examples] reply failed:", (err as Error).message);
      return res.status(500).json({ error: "reply_failed" });
    }
  });
}
