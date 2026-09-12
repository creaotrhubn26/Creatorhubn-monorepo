/**
 * leadbook-recording-consent-routes.ts
 *
 * Leadbook lydopptak fase 2 — samtykke, sletting, org-compliance.
 * Se docs/leadgrid-gdpr-lydopptak.md. Ingen rå lyd persisteres noe sted
 * (transkripsjon skjer on-device i appen, kun teksten sendes videre som
 * et vanlig leadbook_examples-utkast via POST /leadbook/examples).
 *
 * Prefix: /api/leadgrid/leadbook/* + /api/leadgrid/admin/leadbook/* +
 *         /api/leadgrid/org/leadbook-lydopptak-compliance
 *
 * Mønster speilet fra wedding-assistant-gdpr-routes.ts (samtykke/
 * request-deletion/anonymize/deletion-queue — samme fire-endepunkt-form).
 *
 * Endepunkter (6):
 *   POST /leadbook/recording-consent
 *   POST /leadbook/examples/:id/request-deletion
 *   POST /admin/leadbook/examples/:id/approve-deletion
 *   GET  /admin/leadbook/deletion-queue
 *   POST /org/leadbook-lydopptak-compliance   (§7/§8 — åpner entitlementet)
 *   GET  /org/leadbook-lydopptak-compliance   (status for onboarding-skjermen)
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import {
  assertAnyEntitledForOrganization,
  LEADBOOK_LYDOPPTAK_FEATURE_KEY,
} from "./leadgrid-entitlement-guard.js";
import {
  loadAccessibleLeadgridProject,
  loadAccessibleLeadgridProjectForCompliance,
} from "./leadgrid-project-access.js";
import { anonymizeText, anonymizeTranscript } from "./leadgrid-leadbook-examples-routes.js";

type SessionUser = { userId: string; email: string; name: string; role: string };
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
const LEADER_ROLES = new Set(["owner", "admin", "salgssjef", "teamleder"]);
const EXAMPLES_FEATURE_KEYS = ["leadbookEksempler"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LeadbookRecordingConsentRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function leadbookExampleDeepLink(
  exampleId: string,
  projectId: string,
  organizationId: string,
): string {
  return `leadgrid://leadbook/examples/${encodeURIComponent(exampleId)}`
    + `?projectId=${encodeURIComponent(projectId)}`
    + `&organizationId=${encodeURIComponent(organizationId)}`;
}

async function orgRole(pool: Pool, orgId: string, userId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ role: string }>(
      `SELECT role FROM organization_members WHERE organization_id = $1::uuid AND user_id = $2 LIMIT 1`,
      [orgId, userId],
    );
    return r.rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

/** Fail-CLOSED (motsatt av standard entitlement-guard): manglende/locked
 *  rad = nektet. Samme mønster som leadbookAIStrukturering-sjekken. */
async function assertLydopptakEnabled(
  pool: Pool, orgId: string, res: Response,
): Promise<boolean> {
  try {
    const r = await pool.query<{ state: string }>(
      `SELECT state FROM leadgrid_org_entitlements
        WHERE organization_id = $1 AND feature_key = $2 LIMIT 1`,
      [orgId, LEADBOOK_LYDOPPTAK_FEATURE_KEY],
    );
    const state = r.rows[0]?.state ?? null;
    if (state == null || state === "locked") {
      res.status(403).json({ error: "entitlement_locked", features: [LEADBOOK_LYDOPPTAK_FEATURE_KEY] });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[leadbook-recording] entitlement check failed (fail-closed):", e);
    res.status(403).json({ error: "entitlement_locked", features: [LEADBOOK_LYDOPPTAK_FEATURE_KEY] });
    return false;
  }
}

export function registerLeadbookRecordingConsentRoutes(
  deps: LeadbookRecordingConsentRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  async function resolveProjectScope(
    req: Request,
    res: Response,
    allowInactiveForCompliance: boolean,
  ): Promise<{
    session: SessionUser;
    organizationId: string;
    projectId: string;
    role: string | null;
  } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = str(
      req.body?.projectId ?? req.body?.project_id
        ?? req.query.projectId ?? req.query.project_id,
    ).trim();
    if (!projectId || projectId.length > 255 || /[\u0000-\u001f\u007f]/.test(projectId)) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    try {
      const project = allowInactiveForCompliance
        ? await loadAccessibleLeadgridProjectForCompliance(
          pool, projectId, session.userId,
        )
        : await loadAccessibleLeadgridProject(pool, projectId, session.userId);
      if (!project) {
        res.status(404).json({ error: "project_not_found" });
        return null;
      }
      const claimedOrganizationId = str(
        req.body?.organizationId ?? req.body?.organization_id
          ?? req.query.organizationId ?? req.query.organization_id,
      ).trim();
      if (claimedOrganizationId
          && claimedOrganizationId.toLowerCase() !== project.organizationId.toLowerCase()) {
        res.status(409).json({ error: "organization_project_mismatch" });
        return null;
      }
      return {
        session,
        organizationId: project.organizationId,
        projectId: project.id,
        role: project.memberRole || null,
      };
    } catch (error) {
      console.error("[leadbook-recording] project scope failed:", error);
      res.status(500).json({ error: "project_scope_failed" });
      return null;
    }
  }

  function projectScope(req: Request, res: Response) {
    return resolveProjectScope(req, res, false);
  }

  function deletionProjectScope(req: Request, res: Response) {
    return resolveProjectScope(req, res, true);
  }

  // ── POST /leadbook/recording-consent ─────────────────────────────
  // Selger logger at kunden muntlig bekreftet samtykke, FØR mikrofonen
  // startes (§4). Returnerer id — appen sender denne som source_consent_id
  // når/hvis transkriptet lagres som et Eksempler-utkast.
  app.post("/api/leadgrid/leadbook/recording-consent", async (req, res) => {
    const scope = await projectScope(req, res);
    if (!scope) return;
    if (!(await assertAnyEntitledForOrganization(
      pool, scope.organizationId, EXAMPLES_FEATURE_KEYS, res,
    ))) return;
    if (!(await assertLydopptakEnabled(pool, scope.organizationId, res))) return;

    const b = (req.body ?? {}) as Record<string, unknown>;
    const consentVersion = str(b.consent_version).trim();
    if (!consentVersion) return res.status(400).json({ error: "mangler_consent_version" });
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

    try {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadbook_recording_consents
           (id, organization_id, project_id, user_id, consent_version,
            customer_label, consented_at, ip)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [id, scope.organizationId, scope.projectId, scope.session.userId,
         consentVersion, str(b.customer_label), ip],
      );
      res.status(201).json({
        id, consentedAt: new Date().toISOString(), projectId: scope.projectId,
      });
    } catch (err) {
      console.error("[leadbook-recording] consent failed:", err);
      res.status(500).json({ error: "consent_failed" });
    }
  });

  // ── POST /leadbook/examples/:id/request-deletion ─────────────────
  // Eier (selger) eller leder ber om sletting. Kladd (aldri delt) slettes
  // umiddelbart. Publisert (delt med teamet) flagges + varsler ledere —
  // §4.4: forblir hvis alt anonymisert, ellers anonymiseres+arkiveres av
  // leder via approve-deletion.
  app.post("/api/leadgrid/leadbook/examples/:id/request-deletion", async (req, res) => {
    const exampleId = str(req.params.id).trim();
    if (!UUID_RE.test(exampleId)) {
      return res.status(400).json({ error: "ugyldig_example_id" });
    }
    const scope = await deletionProjectScope(req, res);
    if (!scope) return;
    const isLeader = scope.role != null && LEADER_ROLES.has(scope.role);

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const deleted = await client.query(
          `DELETE FROM leadbook_examples
            WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
              AND status = 'draft'
              AND ($4::boolean OR seller_user_id = $5)
            RETURNING id`,
          [exampleId, scope.organizationId, scope.projectId,
           isLeader, scope.session.userId],
        );
        if ((deleted.rowCount ?? 0) > 0) {
          await client.query("COMMIT");
          return res.json({ deleted: true, projectId: scope.projectId });
        }

        const transitioned = await client.query(
          `UPDATE leadbook_examples
              SET delete_requested_at = NOW(), updated_at = NOW()
            WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
              AND status IN ('published', 'archived')
              AND anonymized_at IS NULL
              AND delete_requested_at IS NULL
              AND ($4::boolean OR seller_user_id = $5)
            RETURNING id`,
          [exampleId, scope.organizationId, scope.projectId,
           isLeader, scope.session.userId],
        );

        if ((transitioned.rowCount ?? 0) === 0) {
          const current = await client.query<{
            status: string;
            seller_user_id: string | null;
            delete_requested_at: Date | string | null;
            anonymized_at: Date | string | null;
          }>(
            `SELECT status, seller_user_id, delete_requested_at, anonymized_at
               FROM leadbook_examples
              WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
              LIMIT 1`,
            [exampleId, scope.organizationId, scope.projectId],
          );
          await client.query("ROLLBACK");
          const example = current.rows[0];
          if (!example) return res.status(404).json({ error: "ikke_funnet" });
          if (!isLeader && example.seller_user_id !== scope.session.userId) {
            return res.status(403).json({ error: "ikke_eier" });
          }
          if (example.status === "archived" && example.anonymized_at != null) {
            return res.json({
              requested: false, alreadyCompleted: true, projectId: scope.projectId,
            });
          }
          if (example.delete_requested_at != null) {
            return res.json({
              requested: true, alreadyRequested: true, projectId: scope.projectId,
            });
          }
          return res.status(409).json({ error: "example_state_changed" });
        }

        const leaders = await client.query<{ user_id: string }>(
          `SELECT DISTINCT member.user_id
             FROM leadgrid_projects project
             JOIN organization_members member
               ON member.organization_id = project.organization_id
             LEFT JOIN leadgrid_project_members direct_member
               ON direct_member.organization_id = project.organization_id
              AND direct_member.project_id = project.id
              AND direct_member.user_id = member.user_id
            WHERE project.organization_id = $1::uuid
              AND project.id = $2
              AND COALESCE(
                    direct_member.role,
                    CASE WHEN project.created_by = member.user_id THEN 'owner' END,
                    member.role
                  ) = ANY($3::text[])
              AND member.user_id <> $4
              AND (
                project.created_by = member.user_id
                OR direct_member.user_id IS NOT NULL
                OR (
                  NOT EXISTS (
                    SELECT 1 FROM leadgrid_user_permission_overrides denied
                     WHERE denied.organization_id = project.organization_id
                       AND denied.user_id = member.user_id
                       AND denied.permission_key = 'projects.view_all'
                       AND denied.effect = 'revoke'
                  )
                  AND (
                    member.role = 'admin'
                    OR EXISTS (
                      SELECT 1 FROM role_permissions defaults
                       WHERE defaults.role = member.role
                         AND defaults.permission_key = 'projects.view_all'
                    )
                    OR EXISTS (
                      SELECT 1 FROM leadgrid_user_permission_overrides granted
                       WHERE granted.organization_id = project.organization_id
                         AND granted.user_id = member.user_id
                         AND granted.permission_key = 'projects.view_all'
                         AND granted.effect = 'grant'
                    )
                  )
                )
              )`,
          [scope.organizationId, scope.projectId, Array.from(LEADER_ROLES),
           scope.session.userId],
        );
        const deepLink = leadbookExampleDeepLink(
          exampleId, scope.projectId, scope.organizationId,
        );
        for (const leader of leaders.rows) {
          await client.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, project_id, event_type, title,
                body, triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, $3, 'leadbook_deletion_requested',
                     'Sletteforespørsel — Leadbook',
                     'En selger har bedt om at et publisert eksempel fjernes.',
                     $4, $5, $6::jsonb, FALSE)`,
            [leader.user_id, scope.organizationId, scope.projectId,
             scope.session.userId, deepLink,
             JSON.stringify({
               example_id: exampleId,
               project_id: scope.projectId,
               organization_id: scope.organizationId,
             })],
          );
        }
        await client.query("COMMIT");
        return res.json({
          requested: true,
          projectId: scope.projectId,
          note: "Forespørsel registrert. Leder anonymiserer/arkiverer innen 30 dager.",
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("[leadbook-recording] request-deletion failed:", err);
      return res.status(500).json({ error: "request_deletion_failed" });
    }
  });

  // ── POST /admin/leadbook/examples/:id/approve-deletion ────────────
  // Leder/admin behandler en sletteforespørsel: anonymiser (hvis ikke
  // alt gjort) + arkiver. Rader slettes ALDRI hardt her (anonymisert
  // struktur består for revisjon/leder-kontinuitet, jf. wedding-mønsteret).
  app.post("/api/leadgrid/admin/leadbook/examples/:id/approve-deletion", async (req, res) => {
    const exampleId = str(req.params.id).trim();
    if (!UUID_RE.test(exampleId)) {
      return res.status(400).json({ error: "ugyldig_example_id" });
    }
    const scope = await deletionProjectScope(req, res);
    if (!scope) return;
    if (scope.role == null || !LEADER_ROLES.has(scope.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const found = await client.query<{
          transcript: unknown;
          customer_label: string;
          status: string;
          delete_requested_at: Date | string | null;
          anonymized_at: Date | string | null;
        }>(
          `SELECT transcript, customer_label, status, delete_requested_at, anonymized_at
             FROM leadbook_examples
            WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
            LIMIT 1 FOR UPDATE`,
          [exampleId, scope.organizationId, scope.projectId],
        );
        const example = found.rows[0];
        if (!example) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "ikke_funnet" });
        }
        if (example.status === "archived" && example.anonymized_at != null) {
          await client.query("COMMIT");
          return res.json({
            anonymized: true,
            archived: true,
            alreadyCompleted: true,
            projectId: scope.projectId,
          });
        }
        if (!["published", "archived"].includes(example.status)
            || example.delete_requested_at == null) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "deletion_not_requested" });
        }
        const updated = await client.query(
          `UPDATE leadbook_examples
              SET status = 'archived', transcript = $1::jsonb,
                  customer_label = $2,
                  anonymized_at = COALESCE(anonymized_at, NOW()),
                  delete_requested_at = NULL, updated_at = NOW()
            WHERE id = $3::uuid AND organization_id = $4 AND project_id = $5
              AND status IN ('published', 'archived')
              AND delete_requested_at IS NOT NULL
            RETURNING id`,
          [JSON.stringify(anonymizeTranscript(example.transcript)),
           anonymizeText(example.customer_label ?? ""), exampleId,
           scope.organizationId, scope.projectId],
        );
        if ((updated.rowCount ?? 0) !== 1) {
          throw new Error("deletion approval lost locked Leadbook row");
        }
        await client.query("COMMIT");
        return res.json({ anonymized: true, archived: true, projectId: scope.projectId });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("[leadbook-recording] approve-deletion failed:", err);
      return res.status(500).json({ error: "approve_deletion_failed" });
    }
  });

  // ── GET /admin/leadbook/deletion-queue ─────────────────────────────
  app.get("/api/leadgrid/admin/leadbook/deletion-queue", async (req, res) => {
    const scope = await deletionProjectScope(req, res);
    if (!scope) return;
    if (scope.role == null || !LEADER_ROLES.has(scope.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const r = await pool.query(
        `SELECT id, title, seller_name, delete_requested_at, anonymized_at
           FROM leadbook_examples
          WHERE organization_id = $1 AND project_id = $2
            AND delete_requested_at IS NOT NULL AND anonymized_at IS NULL
          ORDER BY delete_requested_at ASC`,
        [scope.organizationId, scope.projectId],
      );
      res.json({ projectId: scope.projectId, pendingDeletions: r.rows });
    } catch (err) {
      console.error("[leadbook-recording] deletion-queue failed:", err);
      res.status(500).json({ error: "deletion_queue_failed" });
    }
  });

  // ── GET/POST /org/leadbook-lydopptak-compliance ────────────────────
  // §7/§8: org-admin bekrefter compliance-sjekklisten. Bekreftelsen ER
  // det som åpner leadbookLydopptak-entitlementet — ingen egen «skru på»-
  // knapp et annet sted, for å hindre at nøkkelen åpnes uten at §7 er
  // gjennomgått.
  app.get("/api/leadgrid/org/leadbook-lydopptak-compliance", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    try {
      const r = await pool.query(
        `SELECT acknowledged_by_name, acknowledged_at, checklist
           FROM leadbook_recording_compliance_ack WHERE organization_id = $1`,
        [orgId],
      );
      res.json({ acknowledged: r.rowCount! > 0, ack: r.rows[0] ?? null });
    } catch (err) {
      console.error("[leadbook-recording] compliance GET failed:", err);
      res.status(500).json({ error: "compliance_check_failed" });
    }
  });

  app.post("/api/leadgrid/org/leadbook-lydopptak-compliance", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    const role = await orgRole(pool, orgId, session.userId);
    if (!ADMIN_ROLES.has(session.role) && !(role != null && LEADER_ROLES.has(role))) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const checklist = (b.checklist && typeof b.checklist === "object") ? b.checklist : {};
    // Alle 4 §7-punktene må være bekreftet — ellers avvist, ikke lagret
    // delvis (delvis bekreftelse ville åpnet nøkkelen på falskt grunnlag).
    const required = ["drofting", "rutine", "infoskriv", "innsyn"];
    const c = checklist as Record<string, unknown>;
    if (!required.every((k) => c[k] === true)) {
      return res.status(400).json({ error: "sjekkliste_ikke_fullfoert", required });
    }
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO leadbook_recording_compliance_ack
             (organization_id, acknowledged_by, acknowledged_by_name,
              acknowledged_at, checklist)
           VALUES ($1, $2, $3, NOW(), $4::jsonb)
           ON CONFLICT (organization_id) DO UPDATE
             SET acknowledged_by = EXCLUDED.acknowledged_by,
                 acknowledged_by_name = EXCLUDED.acknowledged_by_name,
                 acknowledged_at = NOW(),
                 checklist = EXCLUDED.checklist`,
          [orgId, session.userId, session.name ?? "", JSON.stringify(checklist)],
        );
        await client.query(
          `INSERT INTO leadgrid_org_entitlements
             (organization_id, feature_key, state, updated_by, updated_at)
           VALUES ($1::uuid, $2, 'included', $3, NOW())
           ON CONFLICT (organization_id, feature_key) DO UPDATE
             SET state = 'included', updated_by = EXCLUDED.updated_by,
                 updated_at = NOW()`,
          [orgId, LEADBOOK_LYDOPPTAK_FEATURE_KEY, session.userId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return res.json({ acknowledged: true, entitlementOpened: true });
    } catch (err) {
      console.error("[leadbook-recording] compliance POST failed:", err);
      res.status(500).json({ error: "compliance_ack_failed" });
    }
  });
}
