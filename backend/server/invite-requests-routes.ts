import express from "express";
import type { Pool } from "pg";
import { notifyAdmins } from "./admin-notify";
import { safeAppBaseUrl } from "./web-origin-allowlist";
import {
  sendTransactionalEmail,
  isTransactionalEmailConfigured,
} from "./transactional-email-service";
import {
  renderPresetToHtml,
  type EmailPreset,
} from "../../frontend/shared/email-render.js";

const _inviteRateBuckets = new Map<string, number[]>();
function _inviteRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (_inviteRateBuckets.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  arr.push(now);
  _inviteRateBuckets.set(ip, arr);
  return arr.length > 5;
}
const _inviteClientIp = (req: express.Request): string =>
  (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "?";

const INVITE_REQUEST_APPROVER_ROLES = new Set([
  "admin",
  "super_admin",
  "academy_admin",
  "instructor",
]);

type InviteRequestApproverSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
};

type InviteRequestBrregAddressSnapshot = {
  adresse: string;
  postnummer: string;
  poststed: string;
};

export interface InviteRequestsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => InviteRequestApproverSession | null;
  isValidNorwegianOrgNumber: (value: string) => boolean;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  hasTable: (tableName: string) => Promise<boolean>;
  toAdminString: (value: unknown) => string | null;
  lookupInviteRequestBrregCompany: (
    organizationNumber: string,
  ) => Promise<any>;
  buildInviteRequestProffAnalysis: (input: any) => any;
  upsertInviteRequestProffScreening: (
    inviteRequestId: string,
    organizationNumber: string,
    analysis: any,
  ) => Promise<void>;
  ensureInviteRequestAccessProvisioning: (
    request: any,
    options?: any,
  ) => Promise<any>;
  ensureCommunityAccessForApprovedInvite: (
    request: any,
    userId: string,
  ) => Promise<any>;
  createInviteFromApprovedRequest: (
    pool: Pool,
    requestId: string,
    email: string,
    fullName: string,
    plan: any,
    features: any[],
    baseUrl: string,
    grantedPlan: string,
    grantedFeatures: any[],
    teamSize: number,
    memberProfession?: string | null,
    memberCompany?: string | null,
  ) => Promise<any>;
}

export function setupInviteRequestsRoutes(
  deps: InviteRequestsRoutesDeps,
): void {
  const {
    app,
    pool,
    getActiveSessionFromRequest,
    isValidNorwegianOrgNumber,
    getTableColumns,
    hasTable,
    toAdminString,
    lookupInviteRequestBrregCompany,
    buildInviteRequestProffAnalysis,
    upsertInviteRequestProffScreening,
    ensureInviteRequestAccessProvisioning,
    ensureCommunityAccessForApprovedInvite,
    createInviteFromApprovedRequest,
  } = deps;

  function requireInviteRequestApproverSession(
    req: express.Request,
    res: express.Response,
  ): InviteRequestApproverSession | null {
    const session = getActiveSessionFromRequest(req);
    if (!session) {
      res
        .status(401)
        .json({ error: "Innlogging kreves for å behandle forespørsler" });
      return null;
    }

    const normalizedRole = String(session.role || "").trim().toLowerCase();
    if (!INVITE_REQUEST_APPROVER_ROLES.has(normalizedRole)) {
      res.status(403).json({
        error: "Kun instruktører eller administratorer kan godkjenne tilgang",
      });
      return null;
    }

    return session;
  }

  function formatInviteRequestBrregAddress(
    address?: InviteRequestBrregAddressSnapshot | null,
  ) {
    if (!address) return "";
    return [
      address.adresse,
      `${address.postnummer} ${address.poststed}`.trim(),
    ]
      .filter(Boolean)
      .join(", ")
      .trim();
  }

  function parseInviteRequestProffAnalysis(row: any): any {
    const rawPayload = row?.raw_payload;
    if (!rawPayload) return null;
    try {
      if (typeof rawPayload === "string") {
        return JSON.parse(rawPayload);
      }
      return rawPayload;
    } catch {
      return null;
    }
  }

  async function getInviteRequestProffScreeningMap(
    inviteRequestIds: string[],
  ): Promise<Map<string, any>> {
    if (inviteRequestIds.length === 0) {
      return new Map<string, any>();
    }
    if (!(await hasTable("invite_request_screenings"))) {
      return new Map<string, any>();
    }

    const result = await pool.query(
      `SELECT *
       FROM invite_request_screenings
       WHERE invite_request_id = ANY($1::text[])`,
      [inviteRequestIds],
    );

    return new Map(
      result.rows.map((row: any) => [
        String(row.invite_request_id),
        parseInviteRequestProffAnalysis(row),
      ]),
    );
  }

  async function getInviteRequestProffScreening(
    inviteRequestId: string,
  ): Promise<any> {
    const screeningMap = await getInviteRequestProffScreeningMap([
      inviteRequestId,
    ]);
    return screeningMap.get(inviteRequestId) || null;
  }

  function mapInviteRow(r: any, proffAnalysis?: any) {
    return {
      id: r.id,
      profession: r.profession,
      firstName: r.first_name || "",
      lastName: r.last_name || "",
      email: r.email,
      phone: r.phone_number || "",
      business: r.company_name || "",
      organizationNumber: r.organization_number || "",
      businessAddress: r.business_address || "",
      website: r.website || "",
      message: r.message || "",
      status: r.status,
      requestDate: r.created_at,
      processedDate: r.processed_at || null,
      processedBy: r.processed_by || null,
      selectedPlan: r.selected_plan || null,
      planName: r.plan_name || null,
      role: r.role || "user",
      planPrice: r.plan_price ? parseFloat(r.plan_price) : null,
      paymentCompleted: r.payment_completed || false,
      paymentTransactionId: r.payment_transaction_id || null,
      paymentAmount: r.payment_amount ? parseFloat(r.payment_amount) : null,
      paymentTimestamp: r.payment_timestamp || null,
      adminNotes: r.admin_notes || null,
      userJourneyStatus: r.user_journey_status || null,
      source: r.source || null,
      proffAnalysisStatus: proffAnalysis?.screeningStatus || null,
      proffRecommendation: proffAnalysis?.approvalRecommendation || null,
      proffRiskLevel: proffAnalysis?.riskLevel || null,
      proffRiskScore:
        typeof proffAnalysis?.riskScore === "number"
          ? proffAnalysis.riskScore
          : null,
      proffSummary: proffAnalysis?.summary || null,
      proffLastScreenedAt: proffAnalysis?.scannedAt || null,
      proffScreeningSource: proffAnalysis?.screeningSource || null,
      proffBrregVerified: proffAnalysis?.brregVerified || false,
      proffAnalysis: proffAnalysis || null,
    };
  }

  app.post("/api/invite-requests", async (req, res) => {
    if (_inviteRateLimited(_inviteClientIp(req))) return res.status(429).json({ error: "too_many_requests" });
    try {
      const {
        email,
        firstName,
        lastName,
        profession,
        companyName,
        organizationNumber,
        businessAddress,
        phoneNumber,
        website,
        message,
        selectedPlan,
        planName,
        planPrice,
        enterpriseTeamSize,
        enterprisePricing,
        source,
      } = req.body;
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedOrganizationNumber = String(
        organizationNumber || "",
      ).replace(/\D/g, "");
      const trimmedCompanyName = String(companyName || "").trim();

      if (
        !normalizedEmail ||
        !firstName ||
        !lastName ||
        !profession ||
        !trimmedCompanyName ||
        !normalizedOrganizationNumber
      ) {
        return res
          .status(400)
          .json({ error: "Alle obligatoriske felt må fylles ut" });
      }

      if (!isValidNorwegianOrgNumber(normalizedOrganizationNumber)) {
        return res.status(400).json({
          error:
            "Organisasjonsnummer må være et gyldig norsk organisasjonsnummer.",
        });
      }

      const brregLookup = await lookupInviteRequestBrregCompany(
        normalizedOrganizationNumber,
      );
      if (brregLookup.lookupStatus === "not_found") {
        return res.status(400).json({
          error:
            "Organisasjonsnummeret ble ikke funnet i Brønnøysundregistrene.",
        });
      }

      const persistedCompanyName =
        brregLookup.company?.name?.trim() || trimmedCompanyName;
      const persistedBusinessAddress =
        formatInviteRequestBrregAddress(
          brregLookup.company?.businessAddress,
        ) ||
        String(businessAddress || "").trim() ||
        null;
      const proffAnalysis = await buildInviteRequestProffAnalysis({
        organizationNumber: normalizedOrganizationNumber,
        companyName: persistedCompanyName,
        brregLookup,
      });

      const inviteColumns = await getTableColumns("invite_requests");
      const insertColumns: string[] = [];
      const placeholders: string[] = [];
      const values: unknown[] = [];
      const pushInsert = (column: string, value: unknown) => {
        if (!inviteColumns.has(column)) return;
        insertColumns.push(column);
        values.push(value);
        placeholders.push(`$${values.length}`);
      };

      pushInsert("email", normalizedEmail);
      pushInsert("first_name", firstName);
      pushInsert("last_name", lastName);
      pushInsert("profession", profession);
      pushInsert("company_name", persistedCompanyName);
      pushInsert("organization_number", normalizedOrganizationNumber);
      pushInsert("business_address", persistedBusinessAddress);
      pushInsert("phone_number", phoneNumber || null);
      pushInsert("website", website || null);
      pushInsert("message", message || null);
      pushInsert("status", "pending");
      pushInsert("selected_plan", selectedPlan || null);
      pushInsert("plan_name", planName || null);
      pushInsert("plan_price", planPrice || null);
      pushInsert("user_journey_status", "request_submitted");
      pushInsert("source", source || "landing");
      pushInsert("enterprise_team_size", enterpriseTeamSize || null);
      pushInsert("enterprise_pricing", enterprisePricing || null);
      if (inviteColumns.has("created_at")) {
        pushInsert("created_at", new Date());
      }
      if (inviteColumns.has("updated_at")) {
        pushInsert("updated_at", new Date());
      }

      const result = await pool.query(
        `INSERT INTO invite_requests (${insertColumns.join(", ")})
         VALUES (${placeholders.join(", ")})
         RETURNING id, email, ${
           inviteColumns.has("status") ? "status" : "NULL::text AS status"
         }`,
        values,
      );

      await upsertInviteRequestProffScreening(
        String(result.rows[0].id),
        normalizedOrganizationNumber,
        proffAnalysis,
      );

      console.log(
        `📨 New invite request from ${normalizedEmail} (${profession}) [${proffAnalysis.approvalRecommendation}/${proffAnalysis.riskLevel}]`,
      );
      void notifyAdmins(pool, {
        type: "invite_request",
        source: "creatorhubn.com · invite-request (landing)",
        title: `Ny tilgangsforespørsel: ${firstName} ${lastName} (${persistedCompanyName})`,
        summary: `${profession} · ${normalizedEmail}${planName ? ` · Plan: ${planName}` : ""} · Proff: ${proffAnalysis.approvalRecommendation}/${proffAnalysis.riskLevel}`,
        link: "/admin",
        cta: (req.body && req.body.cta) || null,
        page: req.get("referer") || (req.body && req.body.page) || null,
        utm: (req.body && req.body.utm) || null,
        relatedId: result.rows[0].id,
      });
      res.status(201).json({
        success: true,
        requestId: result.rows[0].id,
        status: "pending",
        message:
          "Forespørselen din er mottatt. Admin vil gjennomgå søknaden.",
        proffAnalysis: {
          recommendation: proffAnalysis.approvalRecommendation,
          riskLevel: proffAnalysis.riskLevel,
          riskScore: proffAnalysis.riskScore,
          screeningSource: proffAnalysis.screeningSource,
          summary: proffAnalysis.summary,
        },
      });
    } catch (error: any) {
      if (error.constraint === "invite_requests_email_unique") {
        return res
          .status(409)
          .json({
            error: "En forespørsel med denne e-posten finnes allerede.",
          });
      }
      console.error("Error creating invite request:", error);
      res.status(500).json({ error: "Kunne ikke opprette forespørsel" });
    }
  });

  app.get("/api/invite-requests", async (req, res) => {
    try {
      if (!requireInviteRequestApproverSession(req, res)) return;
      if (!(await hasTable("invite_requests"))) {
        return res.json([]);
      }

      const inviteColumns = await getTableColumns("invite_requests");
      const source =
        typeof req.query.source === "string" ? req.query.source : null;
      const status =
        typeof req.query.status === "string" ? req.query.status : null;
      const params: string[] = [];
      const clauses: string[] = [];

      if (source && inviteColumns.has("source")) {
        params.push(source);
        clauses.push(`source = $${params.length}`);
      }
      if (status) {
        params.push(status);
        clauses.push(`status = $${params.length}`);
      }

      const selectColumns =
        inviteColumns.size > 0 ? Array.from(inviteColumns).join(", ") : "*";
      let query = `SELECT ${selectColumns} FROM invite_requests`;
      if (clauses.length > 0) {
        query += ` WHERE ${clauses.join(" AND ")}`;
      }
      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      const screeningMap = await getInviteRequestProffScreeningMap(
        result.rows.map((row: any) => String(row.id)),
      );
      res.json(
        result.rows.map((row: any) =>
          mapInviteRow(row, screeningMap.get(String(row.id)) || null),
        ),
      );
    } catch (error) {
      console.error("Error fetching invite requests:", error);
      res.status(500).json({ error: "Kunne ikke hente forespørsler" });
    }
  });

  app.get("/api/invite-requests/:id", async (req, res) => {
    try {
      if (!requireInviteRequestApproverSession(req, res)) return;
      const result = await pool.query(
        "SELECT * FROM invite_requests WHERE id = $1",
        [req.params.id],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Forespørsel ikke funnet" });
      }
      const screening = await getInviteRequestProffScreening(
        String(req.params.id),
      );
      res.json(mapInviteRow(result.rows[0], screening));
    } catch (error) {
      console.error("Error fetching invite request:", error);
      res.status(500).json({ error: "Kunne ikke hente forespørsel" });
    }
  });

  app.get("/api/invite-requests/:id/proff-analysis", async (req, res) => {
    try {
      if (!requireInviteRequestApproverSession(req, res)) return;
      const result = await pool.query(
        "SELECT * FROM invite_requests WHERE id = $1",
        [req.params.id],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Forespørsel ikke funnet" });
      }

      const inviteRequest = result.rows[0];
      let screening = await getInviteRequestProffScreening(
        String(req.params.id),
      );
      if (!screening && inviteRequest.organization_number) {
        const brregLookup = await lookupInviteRequestBrregCompany(
          String(inviteRequest.organization_number),
        );
        screening = await buildInviteRequestProffAnalysis({
          organizationNumber: String(inviteRequest.organization_number),
          companyName: toAdminString(inviteRequest.company_name) || "",
          brregLookup,
        });
        await upsertInviteRequestProffScreening(
          String(req.params.id),
          String(inviteRequest.organization_number),
          screening,
        );
      }

      if (!screening) {
        return res.status(404).json({ error: "Ingen screening funnet" });
      }

      res.json({ success: true, data: screening });
    } catch (error) {
      console.error("Error fetching invite request Proff analysis:", error);
      res.status(500).json({ error: "Kunne ikke hente Proff-analyse" });
    }
  });

  app.get(
    "/api/external-data/proff/company/:organizationNumber",
    async (req, res) => {
      try {
        const organizationNumber = String(
          req.params.organizationNumber || "",
        ).replace(/\D/g, "");
        if (!isValidNorwegianOrgNumber(organizationNumber)) {
          return res
            .status(400)
            .json({ success: false, error: "Ugyldig organisasjonsnummer" });
        }

        const brregLookup = await lookupInviteRequestBrregCompany(
          organizationNumber,
        );
        if (brregLookup.lookupStatus === "not_found") {
          return res
            .status(404)
            .json({ success: false, error: "Fant ikke foretaket i BRREG" });
        }

        const analysis = await buildInviteRequestProffAnalysis({
          organizationNumber,
          companyName:
            brregLookup.company?.name || `Foretak ${organizationNumber}`,
          brregLookup,
        });
        res.json({
          success: true,
          data: analysis,
        });
      } catch (error) {
        console.error("Error fetching Proff company data:", error);
        res
          .status(500)
          .json({ success: false, error: "Kunne ikke hente Proff-data" });
      }
    },
  );

  app.get(
    "/api/admin/proff/company/:organizationNumber",
    async (req, res) => {
      try {
        const organizationNumber = String(
          req.params.organizationNumber || "",
        ).replace(/\D/g, "");
        if (!isValidNorwegianOrgNumber(organizationNumber)) {
          return res
            .status(400)
            .json({ success: false, error: "Ugyldig organisasjonsnummer" });
        }

        const brregLookup = await lookupInviteRequestBrregCompany(
          organizationNumber,
        );
        if (brregLookup.lookupStatus === "not_found") {
          return res
            .status(404)
            .json({ success: false, error: "Fant ikke foretaket i BRREG" });
        }

        const analysis = await buildInviteRequestProffAnalysis({
          organizationNumber,
          companyName:
            brregLookup.company?.name || `Foretak ${organizationNumber}`,
          brregLookup,
        });
        res.json({
          success: true,
          data: analysis,
        });
      } catch (error) {
        console.error("Error fetching admin Proff analysis:", error);
        res
          .status(500)
          .json({ success: false, error: "Kunne ikke hente Proff-analyse" });
      }
    },
  );

  app.post("/api/invite-requests/:id/process", async (req, res) => {
    try {
      const approverSession = requireInviteRequestApproverSession(req, res);
      if (!approverSession) {
        return;
      }
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status || !["approved", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ error: 'Status må være "approved" eller "rejected"' });
      }

      const inviteColumns = await getTableColumns("invite_requests");
      const hasProcessedByColumn = inviteColumns.has("processed_by");
      const values = hasProcessedByColumn
        ? [
            status,
            notes || null,
            approverSession.userId,
            status === "approved" ? "approved" : "rejected",
            id,
          ]
        : [
            status,
            notes || null,
            status === "approved" ? "approved" : "rejected",
            id,
          ];

      const result = await pool.query(
        `UPDATE invite_requests
         SET status = $1, admin_notes = $2, processed_at = NOW(),
             ${hasProcessedByColumn ? "processed_by = $3," : ""}
             user_journey_status = $${hasProcessedByColumn ? 4 : 3}, updated_at = NOW()
         WHERE id = $${hasProcessedByColumn ? 5 : 4}
         RETURNING *`,
        values,
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Forespørsel ikke funnet" });
      }

      let request = result.rows[0];
      let screening = await getInviteRequestProffScreening(String(id));
      if (!screening && request.organization_number) {
        const brregLookup = await lookupInviteRequestBrregCompany(
          String(request.organization_number),
        );
        const analysis = await buildInviteRequestProffAnalysis({
          organizationNumber: String(request.organization_number),
          companyName: toAdminString(request.company_name) || "",
          brregLookup,
        });
        await upsertInviteRequestProffScreening(
          String(id),
          String(request.organization_number),
          analysis,
        );
        screening = analysis;
      }
      let provisioning: any = null;
      let communityProvisioning: any = null;

      if (status === "approved") {
        provisioning = await ensureInviteRequestAccessProvisioning(request);
        const refreshed = await pool.query(
          "SELECT * FROM invite_requests WHERE id = $1",
          [id],
        );
        if ((refreshed.rowCount ?? 0) > 0) {
          request = refreshed.rows[0];
        }
        communityProvisioning = await ensureCommunityAccessForApprovedInvite(
          request,
          String(provisioning?.userId || ""),
        );

        // Prototype-tester master/team-invite — SAMME bro som /status-flaten,
        // slik at godkjenning via DENNE flaten (Academy / admin-invite-system)
        // også oppretter master-inviten. Uten dette ble team-master aldri laget
        // ved godkjenning her. Try/catch: skal aldri blokkere godkjenningen.
        const isPrototypeTester =
          request.selected_plan === "prototype_tester" ||
          request.plan_name === "Prototype Tester" ||
          request.source === "prototype_tester_pricing";
        if (isPrototypeTester) {
          try {
            const baseUrl = safeAppBaseUrl(req);
            const fullName =
              [request.first_name, request.last_name].filter(Boolean).join(" ") ||
              request.email;
            const grantedPlan =
              typeof req.body?.grantedPlan === "string"
                ? req.body.grantedPlan
                : "tester_all_access";
            const grantedFeatures = Array.isArray(req.body?.grantedFeatures)
              ? req.body.grantedFeatures
              : [];
            let teamSize = 1;
            if (typeof request.message === "string") {
              const m = request.message.match(/\[Team:\s*(\d+)\s*medlemmer?\]/i);
              if (m) {
                const n = parseInt(m[1], 10);
                if (Number.isFinite(n)) teamSize = Math.min(5, Math.max(1, n));
              }
            }
            if (Number.isFinite(req.body?.teamSize)) {
              teamSize = Math.min(5, Math.max(1, Number(req.body.teamSize)));
            }
            await createInviteFromApprovedRequest(
              pool,
              String(request.id),
              request.email,
              fullName,
              null,
              [],
              String(baseUrl),
              grantedPlan,
              grantedFeatures,
              teamSize,
              // Bær profesjon + firma fra søknaden → forhåndsutfylt tester-profil.
              request.profession || null,
              request.company_name || null,
            );
          } catch (bridgeErr) {
            console.error("[invite-requests/process] prototype master-bridge failed", bridgeErr);
          }
        }
      }

      console.log(`✅ Invite request ${id} ${status} (${request.email})`);

      res.json({
        success: true,
        status,
        request: mapInviteRow(request, screening),
        provisioning,
        communityProvisioning,
        processedBy: {
          id: approverSession.userId,
          name: approverSession.name,
          email: approverSession.email,
          role: approverSession.role,
        },
        message:
          status === "approved"
            ? `${request.first_name} ${request.last_name} er godkjent og tilgang er aktivert.`
            : `Forespørsel fra ${request.email} er avvist.`,
      });
    } catch (error) {
      console.error("Error processing invite request:", error);
      res.status(500).json({ error: "Kunne ikke behandle forespørsel" });
    }
  });

  app.get("/api/invites/admin/requests", async (req, res) => {
    try {
      if (!requireInviteRequestApproverSession(req, res)) return;
      const result = await pool.query(
        "SELECT * FROM invite_requests ORDER BY created_at DESC",
      );
      const screeningMap = await getInviteRequestProffScreeningMap(
        result.rows.map((row: any) => String(row.id)),
      );
      const invitations = result.rows.map((row: any) =>
        mapInviteRow(row, screeningMap.get(String(row.id)) || null),
      );
      const pending = invitations.filter(
        (r: any) => r.status === "pending",
      ).length;
      const approved = invitations.filter(
        (r: any) => r.status === "approved",
      ).length;
      const rejected = invitations.filter(
        (r: any) => r.status === "rejected",
      ).length;
      res.json({
        invitations,
        stats: { total: invitations.length, pending, approved, rejected },
      });
    } catch (error) {
      console.error("Error fetching invite requests:", error);
      res.status(500).json({ error: "Kunne ikke hente forespørsler" });
    }
  });

  app.put(
    "/api/invites/admin/requests/:inviteId/status",
    async (req, res) => {
      try {
        if (!requireInviteRequestApproverSession(req, res)) return;
        const { inviteId } = req.params;
        const { status, adminNotes } = req.body;

        const result = await pool.query(
          `UPDATE invite_requests
           SET status = $1, admin_notes = $2, processed_at = NOW(), updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [status, adminNotes || null, inviteId],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Invite request not found" });
        }

        const row = result.rows[0];
        // Opprett brukerkonto for godkjent søker (master). Denne flaten gjorde
        // det ikke før — kun /process gjorde — så master fikk invite men ingen
        // konto å logge inn med. Try/catch: skal ikke blokkere godkjenningen.
        if (status === "approved") {
          try {
            await ensureInviteRequestAccessProvisioning(row);
          } catch (provErr) {
            console.error("[invites/status] account provisioning failed", provErr);
          }
        }
        let testerInvite: any = null;
        const isPrototypeTester =
          status === "approved" &&
          (row.selected_plan === "prototype_tester" ||
            row.plan_name === "Prototype Tester" ||
            row.source === "prototype_tester_pricing");
        if (isPrototypeTester) {
          const baseUrl = safeAppBaseUrl(req);
          const fullName =
            [row.first_name, row.last_name].filter(Boolean).join(" ") ||
            row.email;
          const grantedPlan =
            typeof req.body?.grantedPlan === "string"
              ? req.body.grantedPlan
              : "tester_all_access";
          const grantedFeatures = Array.isArray(req.body?.grantedFeatures)
            ? req.body.grantedFeatures
            : [];
          let teamSize = 1;
          if (typeof row.message === "string") {
            const m = row.message.match(/\[Team:\s*(\d+)\s*medlemmer?\]/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (Number.isFinite(n))
                teamSize = Math.min(5, Math.max(1, n));
            }
          }
          if (Number.isFinite(req.body?.teamSize)) {
            teamSize = Math.min(
              5,
              Math.max(1, Number(req.body.teamSize)),
            );
          }
          testerInvite = await createInviteFromApprovedRequest(
            pool,
            String(row.id),
            row.email,
            fullName,
            null,
            [],
            String(baseUrl),
            grantedPlan,
            grantedFeatures,
            teamSize,
            // Bær profesjon + firma fra søknaden → forhåndsutfylt tester-profil.
            row.profession || null,
            row.company_name || null,
          );
        }

        const screening = await getInviteRequestProffScreening(
          String(inviteId),
        );
        res.json({
          success: true,
          request: mapInviteRow(result.rows[0], screening),
          testerInvite: testerInvite || null,
        });
      } catch (error) {
        console.error("Error updating invite status:", error);
        res.status(500).json({ error: "Could not update invite status" });
      }
    },
  );

  app.post(
    "/api/invites/admin/requests/:inviteId/send-invite",
    async (req, res) => {
      try {
        const session = requireInviteRequestApproverSession(req, res);
        if (!session) return;
        const { inviteId } = req.params;
        const rowR = await pool.query(
          `SELECT * FROM invite_requests WHERE id = $1 LIMIT 1`,
          [inviteId],
        );
        if (rowR.rowCount === 0) {
          return res.status(404).json({ error: "Invite request not found" });
        }
        const row = rowR.rows[0];
        if (!isTransactionalEmailConfigured()) {
          return res.status(503).json({
            error:
              "E-post er ikke konfigurert (Resend/Gmail). Invitasjonen ble IKKE sendt.",
          });
        }

        const { templateId, personalMessage } = req.body || {};

        // Tracket lenke + åpnings-pixel: token = invite_requests.id (uuid) —
        // track-endepunktene i prototype-tester-invites-routes faller tilbake
        // til den når tokenet ikke finnes i prototype_tester_invites.
        const baseUrl = safeAppBaseUrl(req);
        const t = encodeURIComponent(String(row.id));
        const clickUrl = `${baseUrl}/api/prototype-tester-invites/track/click/${t}`;
        const openPixelUrl = `${baseUrl}/api/prototype-tester-invites/track/open/${t}`;
        const loginUrl = `${baseUrl}/login`;
        const dashboardUrl = `${baseUrl}/admin`;
        const name =
          [row.first_name, row.last_name].filter(Boolean).join(" ") ||
          String(row.email);

        let html: string;
        let subject: string;
        let textBody: string;

        if (templateId) {
          const presetMap: Record<string, EmailPreset> = {};
          try {
            const mod = await import("../../frontend/shared/email-presets.js");
            for (const p of mod.ADMIN_EMAIL_DESIGNER_PRESETS) {
              presetMap[p.id] = p;
            }
          } catch { /* fall through */ }

          const preset = presetMap[templateId];
          if (preset) {
            const variables: Record<string, string | number | undefined> = {
              firstName: row.first_name || "",
              companyName: row.company_name || "",
              profession: row.profession || "",
              loginUrl,
              dashboardUrl,
              clickUrl,
              personalMessage: personalMessage || "",
              planName: row.plan_name || "Basic",
              platformFee: "20 %",
              portalUrl: dashboardUrl,
              guideUrl: `${baseUrl}/guides`,
              prototypeUntil: "",
            };
            const rendered = renderPresetToHtml(preset.template, variables);
            html = rendered.html;
            subject = rendered.subject;
            textBody = rendered.text;
          } else {
            html = buildHardcodedInviteHtml(name, clickUrl, loginUrl);
            subject = "Du er godkjent i Creatorhubn — kom i gang";
            textBody = `Hei ${name},\n\nSøknaden din om tilgang til Creatorhubn er godkjent. Logg inn her: ${loginUrl}\n\nHilsen Creatorhubn`;
          }
        } else {
          html = buildHardcodedInviteHtml(name, clickUrl, loginUrl);
          subject = "Du er godkjent i Creatorhubn — kom i gang";
          textBody = `Hei ${name},\n\nSøknaden din om tilgang til Creatorhubn er godkjent. Logg inn her: ${loginUrl}\n\nHilsen Creatorhubn`;
        }

        const emailResult = await sendTransactionalEmail({
          pool,
          to: String(row.email),
          subject,
          fromLabel: "Creatorhubn",
          kind: "invite_request_invite",
          sentByUserId: session.userId,
          text: textBody,
          html,
        });

        if (!emailResult.sent) {
          return res.status(502).json({
            error: `E-post kunne ikke sendes (${emailResult.reason || "ukjent feil"}). invite_sent_at er IKKE stemplet.`,
          });
        }

        const result = await pool.query(
          `UPDATE invite_requests SET invite_sent_at = NOW(), invite_sent_count = COALESCE(invite_sent_count, 0) + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
          [inviteId],
        );
        console.log(
          `📧 Invite email sent to ${row.email} via ${emailResult.provider}`,
        );
        res.json({
          success: true,
          message: "Invite email sent",
          provider: emailResult.provider,
          request: mapInviteRow(result.rows[0]),
        });
      } catch (error) {
        console.error("Error sending invite:", error);
        res.status(500).json({ error: "Could not send invite" });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // POST /api/invites/admin/create-and-send
  // Admin creates an invite and sends it in one step (no pending state).
  // ──────────────────────────────────────────────────────────────────────
  app.post(
    "/api/invites/admin/create-and-send",
    async (req, res) => {
      try {
        const session = requireInviteRequestApproverSession(req, res);
        if (!session) return;

        if (!isTransactionalEmailConfigured()) {
          return res.status(503).json({
            error: "E-post er ikke konfigurert (Resend/Gmail).",
          });
        }

        const {
          email,
          firstName,
          lastName,
          profession,
          companyName,
          organizationNumber,
          businessAddress,
          phoneNumber,
          website,
          selectedPlan,
          planName,
          roleId,
          templateId,
          personalMessage,
          adminNotes,
        } = req.body;

        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedOrgNr = String(organizationNumber || "").replace(/\D/g, "");
        const trimmedName = String(companyName || "").trim();

        if (!normalizedEmail || !firstName || !lastName || !profession || !trimmedName || !normalizedOrgNr) {
          return res.status(400).json({ error: "Alle obligatoriske felt må fylles ut." });
        }

        if (!isValidNorwegianOrgNumber(normalizedOrgNr)) {
          return res.status(400).json({ error: "Organisasjonsnummer må være et gyldig norsk organisasjonsnummer." });
        }

        const brregLookup = await lookupInviteRequestBrregCompany(normalizedOrgNr);
        if (brregLookup.lookupStatus === "not_found") {
          return res.status(400).json({ error: "Organisasjonsnummeret ble ikke funnet i Brønnøysundregistrene." });
        }

        const persistedCompanyName = brregLookup.company?.name?.trim() || trimmedName;
        const persistedAddress = formatInviteRequestBrregAddress(brregLookup.company?.businessAddress) || String(businessAddress || "").trim() || null;

        const inviteColumns = await getTableColumns("invite_requests");
        const insertCols: string[] = [];
        const insertVals: unknown[] = [];
        const placeholders: string[] = [];

        const push = (col: string, val: unknown) => {
          if (!inviteColumns.has(col)) return;
          insertCols.push(col);
          insertVals.push(val);
          placeholders.push(`$${insertVals.length}`);
        };

        push("email", normalizedEmail);
        push("first_name", firstName);
        push("last_name", lastName);
        push("profession", profession);
        push("company_name", persistedCompanyName);
        push("organization_number", normalizedOrgNr);
        push("business_address", persistedAddress);
        push("phone_number", phoneNumber || null);
        push("website", website || null);
        push("status", "approved");
        push("selected_plan", selectedPlan || null);
        push("plan_name", planName || null);
        push("role", roleId || "user");
        push("user_journey_status", "invite_sent");
        push("source", "admin_direct");
        push("admin_notes", adminNotes || null);
        push("processed_by", session.userId);
        push("processed_at", new Date());
        if (inviteColumns.has("created_at")) push("created_at", new Date());
        if (inviteColumns.has("updated_at")) push("updated_at", new Date());

        const result = await pool.query(
          `INSERT INTO invite_requests (${insertCols.join(", ")})
           VALUES (${placeholders.join(", ")})
           RETURNING *`,
          insertVals,
        );

        const newRow = result.rows[0];

        const baseUrl = safeAppBaseUrl(req);
        const t = encodeURIComponent(String(newRow.id));
        const clickUrl = `${baseUrl}/api/prototype-tester-invites/track/click/${t}`;
        const openPixelUrl = `${baseUrl}/api/prototype-tester-invites/track/open/${t}`;
        const loginUrl = `${baseUrl}/login`;
        const dashboardUrl = `${baseUrl}/admin`;
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail;

        const variables: Record<string, string | number | undefined> = {
          firstName,
          companyName: persistedCompanyName,
          profession,
          loginUrl,
          dashboardUrl,
          clickUrl,
          personalMessage: personalMessage || "",
          planName: planName || "Basic",
          platformFee: "20 %",
          portalUrl: dashboardUrl,
          guideUrl: `${baseUrl}/guides`,
          prototypeUntil: "",
        };

        let html: string;
        let subject: string;
        let textBody: string;

        if (templateId) {
          const presetMap: Record<string, EmailPreset> = {};
          try {
            const mod = await import("../../frontend/shared/email-presets.js");
            for (const p of mod.ADMIN_EMAIL_DESIGNER_PRESETS) {
              presetMap[p.id] = p;
            }
          } catch {
            // presets not available — fall through to hardcoded
          }

          const preset = presetMap[templateId];
          if (preset) {
            const rendered = renderPresetToHtml(preset.template, variables);
            html = rendered.html;
            subject = rendered.subject;
            textBody = rendered.text;
          } else {
            html = buildHardcodedInviteHtml(fullName, clickUrl, loginUrl);
            subject = "Du er godkjent i Creatorhubn — kom i gang";
            textBody = `Hei ${fullName},\n\nSøknaden din om tilgang til Creatorhubn er godkjent. Logg inn her: ${loginUrl}\n\nHilsen Creatorhubn`;
          }
        } else {
          html = buildHardcodedInviteHtml(fullName, clickUrl, loginUrl);
          subject = "Du er godkjent i Creatorhubn — kom i gang";
          textBody = `Hei ${fullName},\n\nSøknaden din om tilgang til Creatorhubn er godkjent. Logg inn her: ${loginUrl}\n\nHilsen Creatorhubn`;
        }

        const emailResult = await sendTransactionalEmail({
          pool,
          to: normalizedEmail,
          subject,
          fromLabel: "Creatorhubn",
          kind: "invite_request_invite",
          sentByUserId: session.userId,
          text: textBody,
          html,
        });

        if (!emailResult.sent) {
          return res.status(502).json({
            error: `E-post kunne ikke sendes (${emailResult.reason || "ukjent feil"}).`,
            requestId: newRow.id,
          });
        }

        await pool.query(
          `UPDATE invite_requests SET invite_sent_at = NOW(), invite_sent_count = 1, updated_at = NOW() WHERE id = $1`,
          [newRow.id],
        );

        const proffAnalysis = await buildInviteRequestProffAnalysis({
          organizationNumber: normalizedOrgNr,
          companyName: persistedCompanyName,
          brregLookup,
        });
        await upsertInviteRequestProffScreening(newRow.id, normalizedOrgNr, proffAnalysis);

        res.status(201).json({
          success: true,
          message: "Invitasjon opprettet og sendt",
          requestId: newRow.id,
          provider: emailResult.provider,
          request: mapInviteRow({ ...newRow, invite_sent_at: new Date(), invite_sent_count: 1 }, proffAnalysis),
        });
      } catch (error) {
        console.error("Error creating and sending invite:", error);
        res.status(500).json({ error: "Kunne ikke opprette og sende invitasjon" });
      }
    },
  );
}

function buildHardcodedInviteHtml(name: string, clickUrl: string, loginUrl: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h2 style="margin:0 0 16px;">Hei ${esc(name)},</h2>
      <p style="font-size:15px;line-height:1.6;">
        Søknaden din om tilgang til Creatorhubn er <b>godkjent</b>! Kontoen din er klar.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${clickUrl}" style="display:inline-block;background:#ffba6c;color:#150d05;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;">Logg inn og kom i gang</a>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.5;">
        Hvis knappen ikke fungerer:<br>
        <a href="${clickUrl}" style="color:#1976d2;word-break:break-all;">${esc(loginUrl)}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
      <p style="font-size:12px;color:#999;">
        Du får denne fordi du søkte om tilgang via creatorhubn.com.
        Hvis dette er en feil, kan du ignorere e-posten.
      </p>
    </div>`;
}
