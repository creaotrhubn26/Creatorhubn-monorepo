/**
 * casting-agreements-routes.ts
 *
 * Setup-funksjon for /api/casting/{offers,contracts,project-agreements}/*
 * og deres prosjekt-skopede GET-endpoints. 9 endpoints totalt:
 *
 *   GET    /api/casting/projects/:projectId/offers             — list
 *   GET    /api/casting/projects/:projectId/contracts          — list
 *   GET    /api/casting/projects/:projectId/project-agreements — list
 *   POST   /api/casting/offers                                 — opprett
 *   PUT    /api/casting/offers/:offerId/respond                — accept/decline
 *   POST   /api/casting/contracts                              — opprett (draft)
 *   PUT    /api/casting/contracts/:contractId/sign             — markér signert
 *   POST   /api/casting/project-agreements                     — opprett
 *   PUT    /api/casting/project-agreements/:agreementId/status — endre status
 *
 * Tilgang: ÅPEN (matcher eksisterende oppførsel).
 *
 * Delt state med /api/role-room (KRITISK):
 *   legacyOffersByProject, legacyContractsByProject,
 *   legacyProjectAgreementsByProject Maps brukes også av
 *   /api/role-room/projects/:projectId/{offers,contracts,project-agreements}
 *   GET-endpoints (i ./role-room-projects-routes.ts) og av flere POST/PUT
 *   /api/role-room/{offers,contracts,project-agreements}/*-endpoints som
 *   fortsatt er i index.ts. Maps må DERFOR fortsette å være eid av
 *   index.ts og passes via deps som referanser — mutering fra denne
 *   modulen ER synlig i alle andre clusters som bruker samme referanse.
 *
 * createProjectAgreementRecord + normalizeProjectAgreementStatus
 * passes også via deps fordi de brukes av role-room/project-agreements-
 * endpoints (linje 19054, 19106 i index.ts ved skriving). findByIdIn-
 * DbProjectArrays passes via deps fordi den lukker over
 * compatStoreListByPrefix.
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupCastingAgreementsRoutes } from "./casting-agreements-routes";
 *
 *   setupCastingAgreementsRoutes({
 *     app,
 *     compatStoreGet,
 *     compatStoreSet,
 *     legacyOffersByProject,
 *     legacyContractsByProject,
 *     legacyProjectAgreementsByProject,
 *     dbLegacyOffersKey,
 *     dbLegacyContractsKey,
 *     dbLegacyProjectAgreementsKey,
 *     findByIdInDbProjectArrays,
 *     createProjectAgreementRecord,
 *     normalizeProjectAgreementStatus,
 *   });
 */

import type express from "express";

import {
  findByIdInProjectMap,
  getProjectItems,
  setProjectItems,
} from "./_shared";
import { newEntityId } from "./_shared-ids.js";

export interface CastingAgreementsRoutesDeps {
  app: express.Application;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
  legacyOffersByProject: Map<string, any[]>;
  legacyContractsByProject: Map<string, any[]>;
  legacyProjectAgreementsByProject: Map<string, any[]>;
  dbLegacyOffersKey: (projectId: string) => string;
  dbLegacyContractsKey: (projectId: string) => string;
  dbLegacyProjectAgreementsKey: (projectId: string) => string;
  findByIdInDbProjectArrays: (
    prefix: string,
    id: string,
  ) => Promise<{ projectId: string; index: number; items: any[] } | null>;
  createProjectAgreementRecord: (
    payload: Record<string, any>,
  ) => Record<string, any> | null;
  normalizeProjectAgreementStatus: (
    value: unknown,
  ) => "draft" | "sent" | "signed";
}

export function setupCastingAgreementsRoutes(
  deps: CastingAgreementsRoutesDeps,
): void {
  const {
    app,
    compatStoreGet,
    compatStoreSet,
    legacyOffersByProject,
    legacyContractsByProject,
    legacyProjectAgreementsByProject,
    dbLegacyOffersKey,
    dbLegacyContractsKey,
    dbLegacyProjectAgreementsKey,
    findByIdInDbProjectArrays,
    createProjectAgreementRecord,
    normalizeProjectAgreementStatus,
  } = deps;

  // ── GET-list endpoints (project-skopede) ──────────────────────────

  app.get("/api/casting/projects/:projectId/offers", async (req, res) => {
    const projectId = req.params.projectId;
    const dbOffers = await compatStoreGet<any[]>(dbLegacyOffersKey(projectId));
    if (Array.isArray(dbOffers)) {
      setProjectItems(legacyOffersByProject, projectId, dbOffers);
      res.json({ offers: dbOffers });
      return;
    }
    res.json({ offers: getProjectItems(legacyOffersByProject, projectId) });
  });

  app.get("/api/casting/projects/:projectId/contracts", async (req, res) => {
    const projectId = req.params.projectId;
    const dbContracts = await compatStoreGet<any[]>(
      dbLegacyContractsKey(projectId),
    );
    if (Array.isArray(dbContracts)) {
      setProjectItems(legacyContractsByProject, projectId, dbContracts);
      res.json({ contracts: dbContracts });
      return;
    }
    res.json({ contracts: getProjectItems(legacyContractsByProject, projectId) });
  });

  app.get(
    "/api/casting/projects/:projectId/project-agreements",
    async (req, res) => {
      const projectId = req.params.projectId;
      const dbAgreements = await compatStoreGet<any[]>(
        dbLegacyProjectAgreementsKey(projectId),
      );
      if (Array.isArray(dbAgreements)) {
        setProjectItems(
          legacyProjectAgreementsByProject,
          projectId,
          dbAgreements,
        );
        res.json({ agreements: dbAgreements });
        return;
      }
      res.json({
        agreements: getProjectItems(legacyProjectAgreementsByProject, projectId),
      });
    },
  );

  // ── Offers ─────────────────────────────────────────────────────────

  app.post("/api/casting/offers", async (req, res) => {
    const payload = req.body || {};
    const projectId =
      typeof payload.projectId === "string" ? payload.projectId : "";
    const candidateId =
      typeof payload.candidateId === "string" ? payload.candidateId : "";
    if (!projectId || !candidateId) {
      res.status(400).json({ error: "projectId and candidateId are required" });
      return;
    }
    const offerId = newEntityId("offer");
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

  app.put("/api/casting/offers/:offerId/respond", async (req, res) => {
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

  // ── Contracts ──────────────────────────────────────────────────────

  app.post("/api/casting/contracts", async (req, res) => {
    const payload = req.body || {};
    const projectId =
      typeof payload.projectId === "string" ? payload.projectId : "";
    const candidateId =
      typeof payload.candidateId === "string" ? payload.candidateId : "";
    if (!projectId || !candidateId) {
      res.status(400).json({ error: "projectId and candidateId are required" });
      return;
    }
    const contractId = newEntityId("contract");
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

  app.put("/api/casting/contracts/:contractId/sign", async (req, res) => {
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

  // ── Project-agreements ─────────────────────────────────────────────

  app.post("/api/casting/project-agreements", async (req, res) => {
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

  app.put(
    "/api/casting/project-agreements/:agreementId/status",
    async (req, res) => {
      let location = findByIdInProjectMap(
        legacyProjectAgreementsByProject,
        req.params.agreementId,
      );
      if (!location) {
        const dbLocation = await findByIdInDbProjectArrays(
          "casting:project-agreements:",
          req.params.agreementId,
        );
        if (dbLocation) {
          setProjectItems(
            legacyProjectAgreementsByProject,
            dbLocation.projectId,
            dbLocation.items,
          );
          location = { projectId: dbLocation.projectId, index: dbLocation.index };
        }
      }
      if (!location) {
        res.status(404).json({ error: "Agreement not found" });
        return;
      }
      const current = getProjectItems(
        legacyProjectAgreementsByProject,
        location.projectId,
      );
      const nextStatus = normalizeProjectAgreementStatus(req.body?.status);
      current[location.index] = {
        ...current[location.index],
        status: nextStatus,
        signed_date:
          nextStatus === "signed"
            ? new Date().toISOString()
            : (current[location.index]?.signed_date ?? null),
        updated_at: new Date().toISOString(),
      };
      setProjectItems(
        legacyProjectAgreementsByProject,
        location.projectId,
        current,
      );
      await compatStoreSet(
        dbLegacyProjectAgreementsKey(location.projectId),
        current,
      );
      res.json({ ok: true });
    },
  );
}
