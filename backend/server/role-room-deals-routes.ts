import express from "express";
import type { Pool } from "pg";

export interface RoleRoomDealsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  createProjectAgreementRecord: (...args: any[]) => any;
  dbLegacyContractsKey: (...args: any[]) => string;
  dbLegacyOffersKey: (...args: any[]) => string;
  dbLegacyProjectAgreementsKey: (...args: any[]) => string;
  findByIdInDbProjectArrays: (...args: any[]) => Promise<any>;
  findByIdInProjectMap: (...args: any[]) => any;
  getProjectItems: (...args: any[]) => any[];
  setProjectItems: (...args: any[]) => void;
  legacyOffersByProject: Map<string, any[]>;
  legacyContractsByProject: Map<string, any[]>;
  legacyProjectAgreementsByProject: Map<string, any[]>;
}

/**
 * Owner-or-active-member gate for a casting/role-room project. Mirrors the
 * canonical copy in role-room-broll-routes.ts / role-room-brand-assets-routes.ts.
 * requireUserSession only proves login — without this every offer/contract/
 * agreement endpoint here is a cross-tenant BOLA (inject into, or mutate,
 * another tenant's project by caller-supplied projectId or global-by-id lookup).
 */
async function viewerCanAccessProject(
  pool: Pool,
  projectId: string,
  viewerId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects
               WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2
                 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

export function setupRoleRoomDealsRoutes(
  deps: RoleRoomDealsRoutesDeps,
): void {
  const {
    app,
    pool,
    requireUserSession,
    compatStoreSet,
    createProjectAgreementRecord,
    dbLegacyContractsKey,
    dbLegacyOffersKey,
    dbLegacyProjectAgreementsKey,
    findByIdInDbProjectArrays,
    findByIdInProjectMap,
    getProjectItems,
    setProjectItems,
    legacyOffersByProject,
    legacyContractsByProject,
    legacyProjectAgreementsByProject,
  } = deps;

  app.post("/api/role-room/offers", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const payload = req.body || {};
    const projectId =
      typeof payload.projectId === "string" ? payload.projectId : "";
    const candidateId =
      typeof payload.candidateId === "string" ? payload.candidateId : "";
    if (!projectId || !candidateId) {
      res.status(400).json({ error: "projectId and candidateId are required" });
      return;
    }
    // BOLA-gate: only inject offers into a project the caller owns / is a member of.
    if (!(await viewerCanAccessProject(pool, projectId, session.userId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return;
    }
    const offerId = `offer-${Date.now()}`;
    const offer = {
      id: offerId,
      project_id: projectId,
      candidate_id: candidateId,
      role_id: payload.roleId || null,
      offer_date: new Date().toISOString(),
      response_deadline: payload.responseDeadline || null,
      status: "pending",
      compensation: payload.compensation || null,
      terms: payload.terms || null,
      notes: payload.notes || null,
    };
    const current = getProjectItems(legacyOffersByProject, projectId);
    const next = [...current, offer];
    setProjectItems(legacyOffersByProject, projectId, next);
    await compatStoreSet(dbLegacyOffersKey(projectId), next);
    res.status(201).json({ offerId });
  });

  app.put("/api/role-room/offers/:offerId/respond", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    let location = findByIdInProjectMap(
      legacyOffersByProject,
      req.params.offerId,
    );
    if (!location) {
      const dbLocation = await findByIdInDbProjectArrays(
        "casting:offers:",
        req.params.offerId,
      );
      if (dbLocation) {
        setProjectItems(
          legacyOffersByProject,
          dbLocation.projectId,
          dbLocation.items,
        );
        location = { projectId: dbLocation.projectId, index: dbLocation.index };
      }
    }
    if (!location) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    // BOLA-gate (object-first): findByIdInProjectMap/DbProjectArrays resolve the
    // offer GLOBALLY across every tenant — verify the caller can access the
    // project it actually belongs to before flipping its accept/decline status.
    if (!(await viewerCanAccessProject(pool, location.projectId, session.userId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return;
    }
    const current = getProjectItems(legacyOffersByProject, location.projectId);
    const status = req.body?.status === "declined" ? "declined" : "accepted";
    current[location.index] = {
      ...current[location.index],
      status,
      response_date: new Date().toISOString(),
    };
    setProjectItems(legacyOffersByProject, location.projectId, current);
    await compatStoreSet(dbLegacyOffersKey(location.projectId), current);
    res.json({ ok: true });
  });

  app.post("/api/role-room/contracts", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const payload = req.body || {};
    const projectId =
      typeof payload.projectId === "string" ? payload.projectId : "";
    const candidateId =
      typeof payload.candidateId === "string" ? payload.candidateId : "";
    if (!projectId || !candidateId) {
      res.status(400).json({ error: "projectId and candidateId are required" });
      return;
    }
    // BOLA-gate: only create contracts under a project the caller owns / is a member of.
    if (!(await viewerCanAccessProject(pool, projectId, session.userId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return;
    }
    const contractId = `contract-${Date.now()}`;
    const contract = {
      id: contractId,
      project_id: projectId,
      candidate_id: candidateId,
      offer_id: payload.offerId || null,
      role_id: payload.roleId || null,
      contract_type: payload.contractType || null,
      start_date: payload.startDate || null,
      end_date: payload.endDate || null,
      compensation: payload.compensation || null,
      terms: payload.terms || null,
      status: "draft",
      signed_date: null,
    };
    const current = getProjectItems(legacyContractsByProject, projectId);
    const next = [...current, contract];
    setProjectItems(legacyContractsByProject, projectId, next);
    await compatStoreSet(dbLegacyContractsKey(projectId), next);
    res.status(201).json({ contractId });
  });

  app.put("/api/role-room/contracts/:contractId/sign", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    let location = findByIdInProjectMap(
      legacyContractsByProject,
      req.params.contractId,
    );
    if (!location) {
      const dbLocation = await findByIdInDbProjectArrays(
        "casting:contracts:",
        req.params.contractId,
      );
      if (dbLocation) {
        setProjectItems(
          legacyContractsByProject,
          dbLocation.projectId,
          dbLocation.items,
        );
        location = { projectId: dbLocation.projectId, index: dbLocation.index };
      }
    }
    if (!location) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    // BOLA-gate (object-first): the contract is resolved globally by id — verify
    // caller access to its actual project before marking it legally signed.
    if (!(await viewerCanAccessProject(pool, location.projectId, session.userId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return;
    }
    const current = getProjectItems(legacyContractsByProject, location.projectId);
    current[location.index] = {
      ...current[location.index],
      status: "signed",
      signed_date: new Date().toISOString(),
    };
    setProjectItems(legacyContractsByProject, location.projectId, current);
    await compatStoreSet(dbLegacyContractsKey(location.projectId), current);
    res.json({ ok: true });
  });

  app.post("/api/role-room/project-agreements", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const agreement = createProjectAgreementRecord(req.body || {});
    if (!agreement) {
      res
        .status(400)
        .json({
          error:
            "projectId, title, counterpartyType and counterpartyName are required",
        });
      return;
    }
    // BOLA-gate: only create agreements/NDAs under a project the caller can access.
    if (!(await viewerCanAccessProject(pool, agreement.project_id, session.userId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return;
    }
    const current = getProjectItems(
      legacyProjectAgreementsByProject,
      agreement.project_id,
    );
    const next = [...current, agreement];
    setProjectItems(legacyProjectAgreementsByProject, agreement.project_id, next);
    await compatStoreSet(
      dbLegacyProjectAgreementsKey(agreement.project_id),
      next,
    );
    res.status(201).json({ agreementId: agreement.id });
  });
}
