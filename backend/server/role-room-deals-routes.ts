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
    if (!requireUserSession(req, res)) return;
    const payload = req.body || {};
    const projectId =
      typeof payload.projectId === "string" ? payload.projectId : "";
    const candidateId =
      typeof payload.candidateId === "string" ? payload.candidateId : "";
    if (!projectId || !candidateId) {
      res.status(400).json({ error: "projectId and candidateId are required" });
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
    if (!requireUserSession(req, res)) return;
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
    if (!requireUserSession(req, res)) return;
    const payload = req.body || {};
    const projectId =
      typeof payload.projectId === "string" ? payload.projectId : "";
    const candidateId =
      typeof payload.candidateId === "string" ? payload.candidateId : "";
    if (!projectId || !candidateId) {
      res.status(400).json({ error: "projectId and candidateId are required" });
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
    if (!requireUserSession(req, res)) return;
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
    if (!requireUserSession(req, res)) return;
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
