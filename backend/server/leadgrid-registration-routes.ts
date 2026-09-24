/**
 * Manuell registrering og prøvetidsstatus.
 *
 * Registreringen er super-admin-only med vilje: den hopper over betaling,
 * e-postbekreftelse og selvbetjening. Den er ment for møtet der du sitter hos
 * kunden, ikke som en vei inn utenfra.
 */
import { timingSafeEqual } from "node:crypto";

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import {
  ManualRegistrationError,
  registerCompanyManually,
} from "./leadgrid-manual-registration.js";
import { trialStatus } from "./leadgrid-trial.js";
import {
  AgreementError,
  PROVIDER,
  SIGNATURE_STYLES,
  signAgreement,
  signedAgreements,
  type AgreementType,
  type SignatureStyle,
} from "./leadgrid-org-agreements.js";
import { sendAgreementReceipt } from "./leadgrid-agreement-receipt.js";
import { sendTrialReminders } from "./leadgrid-trial-reminders.js";
import {
  LEADGRID_PLANS,
  normalizeInterval,
  normalizePlanKey,
  resolvePlanPrice,
} from "./leadgrid-stripe-plans.js";
import { customerOverview } from "./leadgrid-customer-overview.js";
import {
  AGREEMENT_DOCUMENTS,
  agreementDocument,
} from "./leadgrid-agreement-documents.js";
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

  /**
   * «Mine avtaler» er kundens eget arkiv, ikke prosjektinnhold. En selger som
   * er med i prosjektet har ingen grunn til å se hvem i ledelsen som signerte
   * databehandleravtalen, eller hvilke fakturaopplysninger som ble bekreftet.
   * Derfor: bedriftens egen admin, eller oss.
   */
  async function erOrgAdmin(userId: string, organizationId: string): Promise<boolean> {
    const rad = await pool.query<{ role: string | null }>(
      `SELECT role FROM organization_members
        WHERE user_id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [userId, organizationId],
    );
    const rolle = rad.rows[0]?.role;
    return rolle === "admin" || rolle === "owner";
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

  // Avtalene som skal signeres, med teksten. Klienten sender teksten tilbake
  // ved signering, og serveren hasher den — da er beviset knyttet til det
  // kunden faktisk fikk se, ikke til det vi trodde vi viste.
  app.get("/api/leadgrid/avtaler/dokumenter", async (req, res) => {
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
    const signert = await signedAgreements(pool, project.organizationId);
    const signertVersjon = new Map(signert.map((a) => [a.agreement_type, a]));
    const org = await pool.query<{
      name: string; org_number: string | null; address_line: string | null;
      postal_code: string | null; city: string | null; billing_email: string | null;
    }>(
      `SELECT name, org_number, address_line, postal_code, city, billing_email
         FROM organizations WHERE id = $1::uuid`,
      [project.organizationId],
    );
    res.json({
      // Fakturaopplysningene som skal bekreftes, hentet fra Enhetsregisteret
      // ved registrering. Kunden retter dem her hvis noe er feil.
      billing: org.rows[0] ?? null,
      documents: Object.values(AGREEMENT_DOCUMENTS).map((doc) => {
        const alt = signertVersjon.get(doc.type);
        return {
          ...doc,
          // Signert på en eldre versjon teller ikke som signert: teksten er
          // endret, og da er det en annen avtale.
          signed: alt?.document_version === doc.version,
          signed_at: alt?.document_version === doc.version ? alt.signed_at : null,
          signed_by: alt?.document_version === doc.version ? alt.signer_name : null,
        };
      }),
    });
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
    if (!["dpa", "loi", "terms", "privacy"].includes(type)) {
      res.status(400).json({ error: "ugyldig_avtaletype" });
      return;
    }
    const stil = String(body.signature_style ?? "") as SignatureStyle;
    if (!SIGNATURE_STYLES.includes(stil)) {
      res.status(400).json({ error: "ugyldig_signaturstil" });
      return;
    }
    // Teksten som signeres må være den vi faktisk publiserer. Uten denne
    // sjekken kunne en klient sende hva som helst og få en gyldig signatur
    // på noe vi aldri har vist.
    const doc = agreementDocument(type);
    if (!doc) {
      res.status(400).json({ error: "ukjent_avtale" });
      return;
    }
    if (String(body.document_text ?? "") !== doc.body) {
      res.status(409).json({
        error: "dokumentet_er_endret",
        message: "Avtaleteksten er oppdatert. Last siden på nytt og les gjennom igjen.",
        current_version: doc.version,
      });
      return;
    }
    // Intensjonsavtalen er stedet kunden sier hva de faktisk kjøper. Uten
    // plan og betalingsmåte her, er avtalen en hensiktserklæring uten
    // innhold — og Stripe har ingenting å bygge et abonnement på.
    let bekreftetFaktura: Record<string, unknown> | null =
      body.confirmed_billing && typeof body.confirmed_billing === "object"
        ? { ...(body.confirmed_billing as Record<string, unknown>) }
        : null;
    if (type === "loi") {
      const planKey = normalizePlanKey(body.plan_key ?? bekreftetFaktura?.plan_key);
      const interval = normalizeInterval(body.billing_interval ?? bekreftetFaktura?.billing_interval);
      const betaling = String(body.payment_method ?? bekreftetFaktura?.payment_method ?? "").trim();
      if (!planKey) {
        res.status(400).json({
          error: "plan_påkrevd",
          message: "Velg hvilken plan avtalen gjelder.",
          valid: Object.keys(LEADGRID_PLANS),
        });
        return;
      }
      if (betaling !== "faktura" && betaling !== "kort") {
        res.status(400).json({
          error: "betalingsmåte_påkrevd",
          message: "Velg om dere vil betale med faktura eller kort.",
        });
        return;
      }
      const pris = resolvePlanPrice(planKey, interval);
      bekreftetFaktura = {
        ...(bekreftetFaktura ?? {}),
        plan_key: planKey,
        plan_label: LEADGRID_PLANS[planKey].label,
        billing_interval: interval,
        payment_method: betaling,
        // Pris-IDen lagres slik den var da de signerte. Endres prisen
        // etterpå, kan vi se hvilken de faktisk sa ja til.
        stripe_price_id: pris.priceId,
        stripe_price_source: pris.source,
      };
    }

    try {
      const kvittering = await signAgreement(pool, {
          organizationId: project.organizationId,
          agreementType: type,
          documentVersion: doc.version,
          documentText: doc.body,
          signerName: String(body.signer_name ?? ""),
          signerTitle: body.signer_title ? String(body.signer_title) : null,
          signerEmail: String(body.signer_email ?? ""),
          signedByUserId: session.userId,
          signerIp:
            (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
            req.socket.remoteAddress ??
            null,
          confirmedBilling: bekreftetFaktura,
          signatureText: String(body.signature_text ?? ""),
          signatureStyle: stil,
      });
      // Kvitteringen sendes etter at raden står. Signeringen er ferdig
      // uansett hva e-postleverandøren finner på.
      const org = await pool.query<{ name: string }>(
        `SELECT name FROM organizations WHERE id = $1::uuid`,
        [project.organizationId],
      );
      void sendAgreementReceipt(pool, {
        agreementId: kvittering.id,
        agreementType: type,
        documentTitle: doc.title,
        documentVersion: doc.version,
        documentSha256: kvittering.document_sha256,
        organizationName: org.rows[0]?.name ?? "Ukjent bedrift",
        organizationId: project.organizationId,
        signerName: String(body.signer_name ?? "").trim(),
        signerTitle: body.signer_title ? String(body.signer_title) : null,
        signerEmail: String(body.signer_email ?? "").trim().toLowerCase(),
        signatureText: kvittering.signature_text,
        signatureStyle: kvittering.signature_style,
        signedAt: kvittering.signed_at,
      });
      res.status(201).json(kvittering);
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
    if (
      !(await erOrgAdmin(session.userId, project.organizationId))
      && !(await erSuperAdmin(session.userId))
    ) {
      res.status(403).json({ error: "org_admin_required" });
      return;
    }
    res.json({
      provider: PROVIDER,
      agreements: await signedAgreements(pool, project.organizationId),
      // Teksten følger med så kunden kan lese avtalen igjen uten å be om den.
      documents: Object.fromEntries(
        Object.values(AGREEMENT_DOCUMENTS).map((d) => [d.type, { title: d.title, body: d.body, version: d.version }]),
      ),
    });
  });

  // Daglig cron: varsler to dager før, på siste dag, og når tiden er ute.
  // Samme token-mønster som de øvrige Leadgrid-cron-ene.
  app.post("/api/leadgrid/cron/provetid-varsler", async (req, res) => {
    const forventet = (process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "").trim();
    const gitt = String(req.headers["x-cron-trigger-token"] ?? "").trim();
    if (!forventet) {
      res.status(503).json({ error: "cron_token_not_configured" });
      return;
    }
    if (
      gitt.length !== forventet.length ||
      !timingSafeEqual(Buffer.from(gitt), Buffer.from(forventet))
    ) {
      res.status(401).json({ error: "ugyldig_token" });
      return;
    }
    try {
      res.json(await sendTrialReminders(pool));
    } catch (error) {
      console.warn("[provetid] cron feilet:", (error as Error).message);
      res.status(500).json({ error: "varsler_feilet" });
    }
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
