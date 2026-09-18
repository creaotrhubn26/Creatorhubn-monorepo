/**
 * leadgrid-inbound-forms.ts
 *
 * Henvendelser fra kundens egen nettside, rett inn i Leadgrid.
 *
 * Hvorfor dette ikke kunne gjøres med det vi hadde: POST /api/v1/leads
 * krever en leadgrid_api_keys-nøkkel (mig 325). Den er en hemmelighet som
 * også gir LESETILGANG til alle leads i organisasjonen. Legger du den i et
 * skjema på en offentlig nettside, har du gitt bort kundelista.
 *
 * Her er nøkkelen publiserbar med vilje (mig 0637). Den er en adresse, ikke
 * et passord, og gir bare én ting: retten til å sende inn ett skjema.
 * Sikkerheten ligger et annet sted:
 *   - allowed_origins: bare nettstedene kunden har oppgitt
 *   - ratebegrensning per IP per time, lagret i databasen så den overlever
 *     omstart og flere instanser
 *   - honeypot-felt og minste utfyllingstid, som fanger de enkle botene
 *   - 64 kB kropp, ikke 50 MB som resten av appen
 *
 * Ruta monteres FØR den globale cors()-middlewaren, fordi den må svare med
 * sine egne CORS-headere per skjema. Den har derfor sin egen body-parser.
 */

import express from "express";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { createHash } from "crypto";

type SessionData = { userId: string; role?: string; email?: string };

interface PublicDeps {
  app: Express;
  pool: Pool;
}

interface AdminDeps extends PublicDeps {
  activeSessions: Map<string, SessionData>;
}

interface FormEndpointRow {
  id: string;
  organization_id: string;
  project_id: string;
  allowed_origins: string[];
  rate_limit_per_hour: number;
  redirect_url: string | null;
  lead_source: string;
}

/** Feltlengder. Et kontaktskjema trenger ikke en roman. */
const MAX = {
  name: 200,
  email: 320,
  phone: 40,
  company: 200,
  message: 4000,
  url: 2000,
  utm: 200,
} as const;

/**
 * IP-en lagres aldri i klartekst. Peppern gjør at loggen ikke kan brukes til
 * å slå opp om en bestemt IP har vært innom; uten den ville en sha256 av en
 * IPv4-adresse vært trivielt å knekke ved uttømmende søk.
 */
export function hashIp(ip: string): string {
  const pepper = process.env.LEADGRID_IP_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Origin sammenlignes eksakt mot lista. Ikke «slutter på» — da ville
 * `evil-kundensdomene.no` sluppet inn på `kundensdomene.no`.
 */
export function originAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  if (!origin) return false;
  return allowed.some((a) => a.trim().toLowerCase() === origin.toLowerCase());
}

/**
 * Den offentlige innsendingen. Monteres FØR den globale cors()-middlewaren,
 * som ikke kjenner kundenes domener og ville svart uten CORS-header.
 */
export function registerLeadgridPublicFormSubmission(deps: PublicDeps): void {
  const { app, pool } = deps;
  const publicJson = express.json({ limit: "64kb" });
  const publicForm = express.urlencoded({ limit: "64kb", extended: false });

  const loadEndpoint = async (key: string): Promise<FormEndpointRow | null> => {
    if (!/^lgf_[A-Za-z0-9_-]{16,40}$/.test(key)) return null;
    const r = await pool.query<FormEndpointRow>(
      `SELECT id::text, organization_id::text, project_id, allowed_origins,
              rate_limit_per_hour, redirect_url, lead_source
         FROM leadgrid_form_endpoints
        WHERE public_key = $1 AND active AND revoked_at IS NULL
        LIMIT 1`,
      [key],
    );
    return r.rows[0] ?? null;
  };

  // ── Preflight ──────────────────────────────────────────────────────────
  // Må ligge her, ikke i den globale cors()-en: den kjenner ikke kundens
  // domener og ville svart uten CORS-header, slik at nettleseren blokkerte.
  app.options(
    "/api/leadgrid/public/forms/:publicKey/submit",
    async (req: Request, res: Response): Promise<void> => {
      const endpoint = await loadEndpoint(req.params.publicKey).catch(() => null);
      const origin = req.headers.origin;
      if (!endpoint || !originAllowed(origin, endpoint.allowed_origins)) {
        res.status(204).end();
        return;
      }
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
      res.status(204).end();
    },
  );

  // ── Innsending ─────────────────────────────────────────────────────────
  app.post(
    "/api/leadgrid/public/forms/:publicKey/submit",
    publicJson,
    publicForm,
    async (req: Request, res: Response): Promise<void> => {
      const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      let endpoint: FormEndpointRow | null = null;
      try {
        endpoint = await loadEndpoint(req.params.publicKey);
      } catch (err) {
        console.error("[inbound-forms] oppslag feilet:", err);
        res.status(500).json({ error: "internal_error" });
        return;
      }
      if (!endpoint) {
        res.status(404).json({ error: "ukjent_skjema" });
        return;
      }
      if (!originAllowed(origin, endpoint.allowed_origins)) {
        // Sier hvilket domene som ble avvist — dette er utvikleren på
        // kundens nettsted som skal feilsøke, ikke en angriper som lærer noe.
        res.status(403).json({ error: "origin_ikke_tillatt", origin: origin ?? null });
        return;
      }
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const ipHash = hashIp(clientIp(req));
      const attribution = {
        utm_source: str(body.utm_source, MAX.utm),
        utm_medium: str(body.utm_medium, MAX.utm),
        utm_campaign: str(body.utm_campaign, MAX.utm),
        utm_term: str(body.utm_term, MAX.utm),
        utm_content: str(body.utm_content, MAX.utm),
        gclid: str(body.gclid, 255),
        referrer_url: str(body.referrer_url ?? req.headers.referer, MAX.url),
        landing_page_url: str(body.landing_page_url, MAX.url),
      };

      const log = async (
        status: "accepted" | "duplicate" | "spam" | "rate_limited" | "invalid",
        leadId: string | null,
      ): Promise<void> => {
        try {
          await pool.query(
            `INSERT INTO leadgrid_form_submissions
               (form_endpoint_id, organization_id, project_id, status, lead_id,
                ip_hash, user_agent, origin, utm_source, utm_medium, utm_campaign,
                utm_term, utm_content, gclid, referrer_url, landing_page_url, payload)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7, $8,
                     $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)`,
            [
              endpoint!.id, endpoint!.organization_id, endpoint!.project_id,
              status, leadId, ipHash,
              str(req.headers["user-agent"], 500), origin ?? null,
              attribution.utm_source, attribution.utm_medium, attribution.utm_campaign,
              attribution.utm_term, attribution.utm_content, attribution.gclid,
              attribution.referrer_url, attribution.landing_page_url,
              JSON.stringify(body).slice(0, 20000),
            ],
          );
        } catch (err) {
          console.warn("[inbound-forms] logging feilet:", err);
        }
      };

      // Svaret er det samme enten det gikk gjennom eller ble stoppet som spam.
      // En bot som får vite at den ble avslørt, prøver bare på nytt.
      const ok = (status: "accepted" | "duplicate" | "spam"): void => {
        if (endpoint!.redirect_url) {
          res.redirect(303, endpoint!.redirect_url);
          return;
        }
        res.status(202).json({ ok: true, received: true });
        void status;
      };

      // Honeypot: et felt som er skjult for mennesker. Er det fylt ut, er
      // avsenderen en bot som fyller alt den finner.
      if (str(body._hp, 100) || str(body.website_url_confirm, 100)) {
        await log("spam", null);
        ok("spam");
        return;
      }

      // Minste utfyllingstid. Skjemaet sender med når det ble vist; under to
      // sekunder er ingen som har lest og skrevet.
      const renderedAt = Number(body._t);
      if (Number.isFinite(renderedAt) && renderedAt > 0) {
        const elapsedMs = Date.now() - renderedAt;
        if (elapsedMs >= 0 && elapsedMs < 2000) {
          await log("spam", null);
          ok("spam");
          return;
        }
      }

      const name = str(body.name, MAX.name);
      const email = str(body.email, MAX.email)?.toLowerCase() ?? null;
      const phone = str(body.phone, MAX.phone);
      const company = str(body.company, MAX.company);
      const message = str(body.message, MAX.message);

      if (!name && !email && !company) {
        await log("invalid", null);
        res.status(400).json({ error: "navn_epost_eller_bedrift_kreves" });
        return;
      }
      if (email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
        await log("invalid", null);
        res.status(400).json({ error: "epost_ugyldig" });
        return;
      }

      try {
        const rate = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n
             FROM leadgrid_form_submissions
            WHERE form_endpoint_id = $1::uuid
              AND ip_hash = $2
              AND created_at > NOW() - INTERVAL '1 hour'`,
          [endpoint.id, ipHash],
        );
        if (Number(rate.rows[0]?.n ?? 0) >= endpoint.rate_limit_per_hour) {
          await log("rate_limited", null);
          res.status(429).json({ error: "for_mange_innsendinger" });
          return;
        }

        // Samme e-post på samme skjema kort tid etter er et dobbelttrykk,
        // ikke en ny kunde. Uten dette blir pipelinen full av duplikater.
        if (email) {
          const dupe = await pool.query(
            `SELECT 1
               FROM leadgrid_form_submissions
              WHERE form_endpoint_id = $1::uuid
                AND status = 'accepted'
                AND payload->>'email' = $2
                AND created_at > NOW() - INTERVAL '10 minutes'
              LIMIT 1`,
            [endpoint.id, email],
          );
          if (dupe.rowCount) {
            await log("duplicate", null);
            ok("duplicate");
            return;
          }
        }

        const owner = await pool.query<{ user_id: string }>(
          `SELECT user_id::text
             FROM leadgrid_project_members
            WHERE organization_id = $1::uuid AND project_id = $2
            ORDER BY CASE role
                       WHEN 'owner' THEN 1
                       WHEN 'admin' THEN 2
                       WHEN 'salgssjef' THEN 3
                       ELSE 4
                     END
            LIMIT 1`,
          [endpoint.organization_id, endpoint.project_id],
        );
        const ownerUserId = owner.rows[0]?.user_id ?? null;

        const inserted = await pool.query<{ id: string }>(
          `INSERT INTO crm_customers
             (organization_id, project_id, name, company, email, phone,
              lead_source, lead_status, owner_user_id, notes,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content,
              gclid, referrer_url, landing_page_url, created_at, updated_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'unvisited', $8, $9,
                   $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
           RETURNING id::text`,
          [
            endpoint.organization_id, endpoint.project_id,
            name ?? company ?? email ?? "Ukjent henvendelse",
            company, email, phone, endpoint.lead_source, ownerUserId, message,
            attribution.utm_source, attribution.utm_medium, attribution.utm_campaign,
            attribution.utm_term, attribution.utm_content, attribution.gclid,
            attribution.referrer_url, attribution.landing_page_url,
          ],
        );
        const leadId = inserted.rows[0]?.id ?? null;
        await log("accepted", leadId);

        // Workflows skal kunne reagere på en innkommet henvendelse med én
        // gang — det er hele poenget med å få den inn automatisk.
        try {
          const engine = await import("./leadgrid-workflow-engine.js");
          void engine.publishEvent({
            pool,
            organizationId: endpoint.organization_id,
            projectId: endpoint.project_id,
            type: "lead.created",
            leadId,
            actorUserId: null,
            data: {
              project_id: endpoint.project_id,
              source: "inbound_form",
              utm_campaign: attribution.utm_campaign,
              gclid: attribution.gclid,
            },
          });
        } catch (err) {
          console.warn("[inbound-forms] workflow-publisering hoppet over:", err);
        }

        ok("accepted");
      } catch (err) {
        console.error("[inbound-forms] innsending feilet:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

}

/**
 * Administrasjon av skjemaene. Monteres på vanlig plass, fordi den trenger
 * activeSessions — som ikke finnes ennå der den offentlige ruta monteres.
 */
export function registerLeadgridFormAdminRoutes(deps: AdminDeps): void {
  const { app, pool, activeSessions } = deps;
  const publicJson = express.json({ limit: "64kb" });

  const session = (req: Request): SessionData | null => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7)) ?? null;
    return null;
  };

  app.get(
    "/api/leadgrid/forms",
    publicJson,
    async (req: Request, res: Response): Promise<void> => {
      const s = session(req);
      if (!s) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const { loadAccessibleLeadgridProject } = await import("./leadgrid-project-access.js");
        const project = await loadAccessibleLeadgridProject(pool, projectId, s.userId);
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const r = await pool.query(
          `SELECT f.id::text, f.name, f.public_key, f.allowed_origins,
                  f.rate_limit_per_hour, f.redirect_url, f.lead_source,
                  f.active, f.created_at,
                  (SELECT COUNT(*) FROM leadgrid_form_submissions s
                    WHERE s.form_endpoint_id = f.id
                      AND s.status = 'accepted'
                      AND s.created_at > NOW() - INTERVAL '30 days')::int
                    AS leads_siste_30_dager
             FROM leadgrid_form_endpoints f
            WHERE f.organization_id = $1::uuid AND f.project_id = $2
              AND f.revoked_at IS NULL
            ORDER BY f.created_at DESC`,
          [project.organizationId, project.id],
        );
        res.json({ forms: r.rows });
      } catch (err) {
        console.error("[inbound-forms] liste feilet:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  app.post(
    "/api/leadgrid/forms",
    publicJson,
    async (req: Request, res: Response): Promise<void> => {
      const s = session(req);
      if (!s) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectId = str(body.project_id ?? body.projectId, 255);
      const name = str(body.name, 120);
      if (!projectId || !name) {
        res.status(400).json({ error: "project_id_og_name_kreves" });
        return;
      }
      const origins = Array.isArray(body.allowed_origins)
        ? body.allowed_origins
            .map((o) => str(o, 300))
            .filter((o): o is string => Boolean(o))
        : [];
      // Origin er alltid skjema + vert, aldri en sti. En oppføring med sti
      // ville aldri matchet, og kunden hadde trodd skjemaet var låst.
      for (const o of origins) {
        let parsed: URL;
        try {
          parsed = new URL(o);
        } catch {
          res.status(400).json({ error: "origin_ugyldig", origin: o });
          return;
        }
        if (parsed.origin !== o) {
          res.status(400).json({ error: "origin_maa_vaere_skjema_og_vert", origin: o, forventet: parsed.origin });
          return;
        }
      }
      const rateLimit = Number(body.rate_limit_per_hour ?? 20);
      if (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 1000) {
        res.status(400).json({ error: "rate_limit_per_hour_ugyldig" });
        return;
      }
      try {
        const { loadAccessibleLeadgridProject } = await import("./leadgrid-project-access.js");
        const project = await loadAccessibleLeadgridProject(pool, projectId, s.userId);
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const { randomBytes } = await import("crypto");
        const publicKey = `lgf_${randomBytes(18).toString("base64url")}`;
        const r = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_form_endpoints
             (organization_id, project_id, name, public_key, allowed_origins,
              rate_limit_per_hour, redirect_url, lead_source, created_by_user_id)
           VALUES ($1::uuid, $2, $3, $4, $5::text[], $6, $7,
                   COALESCE($8, 'nettskjema'), $9)
           RETURNING id::text`,
          [
            project.organizationId, project.id, name, publicKey, origins,
            rateLimit, str(body.redirect_url, MAX.url), str(body.lead_source, 80),
            s.userId,
          ],
        );
        res.status(201).json({ id: r.rows[0]?.id, public_key: publicKey });
      } catch (err) {
        console.error("[inbound-forms] opprettelse feilet:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  app.delete(
    "/api/leadgrid/forms/:id",
    publicJson,
    async (req: Request, res: Response): Promise<void> => {
      const s = session(req);
      if (!s) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const { loadAccessibleLeadgridProject } = await import("./leadgrid-project-access.js");
        const project = await loadAccessibleLeadgridProject(pool, projectId, s.userId);
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        // Tilbakekalles, ikke slettes: innsendingsloggen skal fortsatt kunne
        // forklare hvor gamle leads kom fra.
        const r = await pool.query(
          `UPDATE leadgrid_form_endpoints
              SET active = FALSE, revoked_at = NOW(), updated_at = NOW()
            WHERE id = $1::uuid AND organization_id = $2::uuid AND project_id = $3
              AND revoked_at IS NULL`,
          [req.params.id, project.organizationId, project.id],
        );
        if (!r.rowCount) {
          res.status(404).json({ error: "skjema_ikke_funnet" });
          return;
        }
        res.json({ ok: true });
      } catch (err) {
        console.error("[inbound-forms] tilbakekalling feilet:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );
}
