/**
 * casting-pools-routes.ts
 *
 * Setup-funksjon for /api/casting/candidate-pool/* og /api/casting/role-pool/*
 * — gjenbrukbare pools av kandidater og roller som kan importeres inn i
 * casting-prosjekter.
 *
 * 11 endpoints:
 *   GET    /candidate-pool                          — list
 *   POST   /candidate-pool                          — upsert
 *   DELETE /candidate-pool/:candidateId             — slett
 *   POST   /candidate-pool/import-to-project        — import én til prosjekt
 *   POST   /candidates/copy-to-project              — kopiér uten å lagre i pool
 *   POST   /candidates/save-to-pool                 — opprett pool-entry fra prosjekt-kandidat
 *   GET    /role-pool                               — list
 *   POST   /role-pool                               — upsert
 *   DELETE /role-pool/:roleId                       — slett
 *   POST   /role-pool/import-to-project             — import én til prosjekt
 *   POST   /roles/save-to-pool                      — opprett pool-entry fra prosjekt-rolle
 *
 * Tilgang: ÅPEN (ingen auth — matcher eksisterende oppførsel).
 *
 * State: Eier 2 in-memory Maps (legacyCandidatePool, legacyRolePool) og 2
 * key-generator-funksjoner internt. Maps speilet til compatStore med
 * prefiksene "casting:candidate-pool:*" og "casting:role-pool:*". Maps
 * brukes IKKE av andre endpoints (verifisert via grep), så trygt å lukke
 * inn i routes-modulen uten egen service-fil.
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupCastingPoolsRoutes } from "./casting-pools-routes";
 *
 *   setupCastingPoolsRoutes({
 *     app,
 *     compatStoreGet,
 *     compatStoreSet,
 *     compatStoreDelete,
 *     compatStoreListByPrefix,
 *   });
 */

import type express from "express";

export interface CastingPoolsRoutesDeps {
  app: express.Application;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
  compatStoreDelete: (storeKey: string) => Promise<void>;
  compatStoreListByPrefix: <T>(
    prefix: string,
  ) => Promise<Array<{ key: string; value: T }>>;
}

export function setupCastingPoolsRoutes(deps: CastingPoolsRoutesDeps): void {
  const {
    app,
    compatStoreGet,
    compatStoreSet,
    compatStoreDelete,
    compatStoreListByPrefix,
  } = deps;

  const legacyCandidatePool = new Map<string, any>();
  const legacyRolePool = new Map<string, any>();

  function dbLegacyCandidatePoolKey(candidateId: string): string {
    return `casting:candidate-pool:${candidateId}`;
  }

  function dbLegacyRolePoolKey(roleId: string): string {
    return `casting:role-pool:${roleId}`;
  }

  // ── Candidate pool ─────────────────────────────────────────────────

  app.get("/api/casting/candidate-pool", async (_req, res) => {
    const dbRows = await compatStoreListByPrefix<any>("casting:candidate-pool:");
    if (dbRows.length > 0) {
      const candidates = dbRows
        .map((row) => row.value)
        .filter((candidate) => candidate && typeof candidate === "object");
      legacyCandidatePool.clear();
      for (const candidate of candidates) {
        const candidateId = typeof candidate.id === "string" ? candidate.id : "";
        if (!candidateId) continue;
        legacyCandidatePool.set(candidateId, candidate);
      }
      res.json({ success: true, candidates });
      return;
    }
    res.json({
      success: true,
      candidates: Array.from(legacyCandidatePool.values()),
    });
  });

  app.post("/api/casting/candidate-pool", async (req, res) => {
    const payload = req.body || {};
    const candidateId =
      typeof payload.id === "string" && payload.id.trim()
        ? payload.id
        : `pool-candidate-${Date.now()}`;
    const now = new Date().toISOString();
    const current = legacyCandidatePool.get(candidateId) || {};
    const candidate = {
      ...current,
      ...payload,
      id: candidateId,
      createdAt: current.createdAt || now,
      updatedAt: now,
    };
    legacyCandidatePool.set(candidateId, candidate);
    await compatStoreSet(dbLegacyCandidatePoolKey(candidateId), candidate);
    res.status(201).json({ success: true, candidateId, candidate });
  });

  app.delete("/api/casting/candidate-pool/:candidateId", async (req, res) => {
    const candidateId = req.params.candidateId;
    legacyCandidatePool.delete(candidateId);
    await compatStoreDelete(dbLegacyCandidatePoolKey(candidateId));
    res.json({ success: true });
  });

  app.post("/api/casting/candidate-pool/import-to-project", async (req, res) => {
    const poolCandidateId =
      typeof req.body?.poolCandidateId === "string"
        ? req.body.poolCandidateId
        : "";
    const targetProjectId =
      typeof req.body?.targetProjectId === "string"
        ? req.body.targetProjectId
        : "";
    const poolCandidate =
      legacyCandidatePool.get(poolCandidateId) ||
      (await compatStoreGet<any>(dbLegacyCandidatePoolKey(poolCandidateId)));
    if (!poolCandidate || !targetProjectId) {
      res
        .status(400)
        .json({ success: false, error: "Invalid candidate or target project" });
      return;
    }
    legacyCandidatePool.set(poolCandidateId, poolCandidate);
    const candidateId = `candidate-${Date.now()}`;
    res.status(201).json({ success: true, candidateId });
  });

  app.post("/api/casting/candidates/copy-to-project", (req, res) => {
    const candidateId =
      typeof req.body?.candidateId === "string" ? req.body.candidateId : "";
    const targetProjectId =
      typeof req.body?.targetProjectId === "string"
        ? req.body.targetProjectId
        : "";
    if (!candidateId || !targetProjectId) {
      res
        .status(400)
        .json({
          success: false,
          error: "candidateId and targetProjectId are required",
        });
      return;
    }
    res
      .status(201)
      .json({ success: true, candidateId: `candidate-copy-${Date.now()}` });
  });

  app.post("/api/casting/candidates/save-to-pool", async (req, res) => {
    const candidateId =
      typeof req.body?.candidateId === "string" ? req.body.candidateId : "";
    if (!candidateId) {
      res.status(400).json({ success: false, error: "candidateId is required" });
      return;
    }
    const poolCandidateId = `pool-candidate-${Date.now()}`;
    const now = new Date().toISOString();
    legacyCandidatePool.set(poolCandidateId, {
      id: poolCandidateId,
      name: `Candidate ${candidateId}`,
      tags: ["imported"],
      photos: [],
      videos: [],
      createdAt: now,
      updatedAt: now,
    });
    await compatStoreSet(
      dbLegacyCandidatePoolKey(poolCandidateId),
      legacyCandidatePool.get(poolCandidateId),
    );
    res.status(201).json({ success: true, poolCandidateId });
  });

  // ── Role pool ──────────────────────────────────────────────────────

  app.get("/api/casting/role-pool", async (_req, res) => {
    const dbRows = await compatStoreListByPrefix<any>("casting:role-pool:");
    if (dbRows.length > 0) {
      const roles = dbRows
        .map((row) => row.value)
        .filter((role) => role && typeof role === "object");
      legacyRolePool.clear();
      for (const role of roles) {
        const roleId = typeof role.id === "string" ? role.id : "";
        if (!roleId) continue;
        legacyRolePool.set(roleId, role);
      }
      res.json({ success: true, roles });
      return;
    }
    res.json({ success: true, roles: Array.from(legacyRolePool.values()) });
  });

  app.post("/api/casting/role-pool", async (req, res) => {
    const payload = req.body || {};
    const roleId =
      typeof payload.id === "string" && payload.id.trim()
        ? payload.id
        : `pool-role-${Date.now()}`;
    const now = new Date().toISOString();
    const current = legacyRolePool.get(roleId) || {};
    const role = {
      ...current,
      ...payload,
      id: roleId,
      createdAt: current.createdAt || now,
      updatedAt: now,
    };
    legacyRolePool.set(roleId, role);
    await compatStoreSet(dbLegacyRolePoolKey(roleId), role);
    res.status(201).json({ success: true, roleId, role });
  });

  app.delete("/api/casting/role-pool/:roleId", async (req, res) => {
    const roleId = req.params.roleId;
    legacyRolePool.delete(roleId);
    await compatStoreDelete(dbLegacyRolePoolKey(roleId));
    res.json({ success: true });
  });

  app.post("/api/casting/role-pool/import-to-project", async (req, res) => {
    const poolRoleId =
      typeof req.body?.poolRoleId === "string" ? req.body.poolRoleId : "";
    const targetProjectId =
      typeof req.body?.targetProjectId === "string"
        ? req.body.targetProjectId
        : "";
    const poolRole =
      legacyRolePool.get(poolRoleId) ||
      (await compatStoreGet<any>(dbLegacyRolePoolKey(poolRoleId)));
    if (!poolRole || !targetProjectId) {
      res
        .status(400)
        .json({ success: false, error: "Invalid role or target project" });
      return;
    }
    legacyRolePool.set(poolRoleId, poolRole);
    res.status(201).json({ success: true, roleId: `role-${Date.now()}` });
  });

  app.post("/api/casting/roles/save-to-pool", async (req, res) => {
    const roleId = typeof req.body?.roleId === "string" ? req.body.roleId : "";
    if (!roleId) {
      res.status(400).json({ success: false, error: "roleId is required" });
      return;
    }
    const poolRoleId = `pool-role-${Date.now()}`;
    const now = new Date().toISOString();
    legacyRolePool.set(poolRoleId, {
      id: poolRoleId,
      name: `Role ${roleId}`,
      requirements: {},
      tags: ["imported"],
      createdAt: now,
      updatedAt: now,
    });
    await compatStoreSet(
      dbLegacyRolePoolKey(poolRoleId),
      legacyRolePool.get(poolRoleId),
    );
    res.status(201).json({ success: true, poolRoleId });
  });
}
