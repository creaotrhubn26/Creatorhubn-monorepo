/**
 * Manuell registrering og prøvetidsstatus.
 *
 * Registreringen er super-admin-only med vilje: den hopper over betaling,
 * e-postbekreftelse og selvbetjening. Den er ment for møtet der du sitter hos
 * kunden, ikke som en vei inn utenfra.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import {
  ManualRegistrationError,
  registerCompanyManually,
} from "./leadgrid-manual-registration.js";
import { trialStatus } from "./leadgrid-trial.js";
import {
  AgreementError,
  signAgreement,
  signedAgreements,
  type AgreementType,
} from "./leadgrid-org-agreements.js";
import { customerOverview } from "./leadgrid-customer-overview.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";

export function registerLeadgridRegistrationRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}): void {
  const { app, pool, requireUserSession } = deps;

  async function erSuperAdmin(userId: string): Promise<boolean> {
    const rad = await pool.query<{ role: string | null }>(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return rad.rows[0]?.role === "super_admin";
  }

  app.post("/api/leadgrid/registrering/manuell", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!(await erSuperAdmin(session.userId))) {
      res.status(403).json({ error: "super_admin_required" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      res.status(201).json(
        await registerCompanyManually(pool, {
          organizationNumber: String(body.organization_number ?? ""),
          adminEmail: String(body.admin_email ?? ""),
          organizationName: body.organization_name
            ? String(body.organization_name)
            : undefined,
          projectName: body.project_name ? String(body.project_name) : undefined,
          createdByUserId: session.userId,
        }),
      );
    } catch (error) {
      if (error instanceof ManualRegistrationError) {
        // Feilene her er ment for mennesket som står foran kunden: de sier
        // hva som er galt med inndataene, ikke hva som skjedde i koden.
        res.status(400).json({ error: error.code, message: error.message });
        return;
      }
      console.warn("[registrering] feilet:", (error as Error).message);
      res.status(500).json({ error: "registration_failed" });
    }
  });

  // Kundeoversikt: registrert, signert, i gang — én rad per bedrift.
  app.get("/api/leadgrid/kundeoversikt", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!(await erSuperAdmin(session.userId))) {
      res.status(403).json({ error: "super_admin_required" });
      return;
    }
    const orgId = String(req.query.organization_id ?? "").trim();
    try {
      res.json({
        customers: await customerOverview(pool, {
          organizationId: orgId || undefined,
          limit: Number(req.query.limit) || undefined,
        }),
      });
    } catch (error) {
      console.warn("[kundeoversikt] feilet:", (error as Error).message);
      res.status(500).json({ error: "overview_failed" });
    }
  });

  // Signering. Dokumentteksten sendes med og hashes — uten den kan ingen i
  // ettertid vise HVA som ble signert, og da er signaturen verdiløs.
  app.post("/api/leadgrid/avtaler/signer", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectId = String(body.project_id ?? "").trim();
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    const type = String(body.agreement_type ?? "") as AgreementType;
    if (!["dpa", "loi", "terms"].includes(type)) {
      res.status(400).json({ error: "ugyldig_avtaletype" });
      return;
    }
    try {
      res.status(201).json(
        await signAgreement(pool, {
          organizationId: project.organizationId,
          agreementType: type,
          documentVersion: String(body.document_version ?? "").trim() || "1",
          documentText: String(body.document_text ?? ""),
          signerName: String(body.signer_name ?? ""),
          signerTitle: body.signer_title ? String(body.signer_title) : null,
          signerEmail: String(body.signer_email ?? ""),
          signedByUserId: session.userId,
          signerIp:
            (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
            req.socket.remoteAddress ??
            null,
          confirmedBilling:
            body.confirmed_billing && typeof body.confirmed_billing === "object"
              ? (body.confirmed_billing as Record<string, unknown>)
              : null,
        }),
      );
    } catch (error) {
      if (error instanceof AgreementError) {
        res.status(400).json({ error: error.code, message: error.message });
        return;
      }
      console.warn("[avtaler] signering feilet:", (error as Error).message);
      res.status(500).json({ error: "signering_feilet" });
    }
  });

  app.get("/api/leadgrid/avtaler", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = String(req.query.project_id ?? "").trim();
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    res.json({ agreements: await signedAgreements(pool, project.organizationId) });
  });

  // Prøvetidsstatus for prosjektets organisasjon. Appen bruker den til å vise
  // hvor lenge det er igjen, og til å skrivebeskytte når tiden er ute.
  app.get("/api/leadgrid/provetid", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = String(req.query.project_id ?? "").trim();
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    const status = await trialStatus(pool, project.organizationId);
    if (!status) {
      res.status(404).json({ error: "organization_not_found" });
      return;
    }
    res.json(status);
  });
}
