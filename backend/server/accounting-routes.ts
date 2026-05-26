import express from "express";
import type { Pool } from "pg";
import { readString, readBoolean } from "./_shared";

export interface AccountingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: any, res: any) => any;
  compatResolveUserId: (req: any) => string;
  resolveAdminUserView: (...args: any[]) => any;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  isTripletexConfigured: () => boolean;
  TripletexApiClient: any;
  buildCompatAccountingIntegrationStatusResponse: (...args: any[]) => any;
  buildDefaultCompatAccountingIntegrationStatus: () => any;
  readCompatAccountingIntegrationStatus: (
    userId: string,
  ) => Promise<any>;
  writeCompatAccountingIntegrationStatus: (
    userId: string,
    status: any,
  ) => Promise<void>;
  readCompatSkattemeldingStatus: (userId: string) => Promise<any>;
  writeCompatSkattemeldingStatus: (
    userId: string,
    status: any,
  ) => Promise<void>;
}

export function setupAccountingRoutes(deps: AccountingRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminSession,
    compatResolveUserId,
    resolveAdminUserView,
    isRecord,
    isTripletexConfigured,
    TripletexApiClient,
    buildCompatAccountingIntegrationStatusResponse,
    buildDefaultCompatAccountingIntegrationStatus,
    readCompatAccountingIntegrationStatus,
    writeCompatAccountingIntegrationStatus,
    readCompatSkattemeldingStatus,
    writeCompatSkattemeldingStatus,
  } = deps;

  app.get("/api/accounting/integration/status", async (req, res) => {
    try {
      const requestedUserId = readString(req.query.userId);
      const sessionUserId = compatResolveUserId(req);
      const userId = requestedUserId || sessionUserId;
      if (!userId || userId === "guest") {
        return res.status(401).json({ error: "Innlogging kreves for å hente regnskapsstatus" });
      }
      if (requestedUserId && requestedUserId !== sessionUserId && !requireAdminSession(req, res)) {
        return;
      }

      res.json(await buildCompatAccountingIntegrationStatusResponse(userId));
    } catch (error) {
      console.error("Error fetching accounting integration status:", error);
      res.status(500).json({ error: "Kunne ikke hente status for regnskapsintegrasjon" });
    }
  });

  app.get("/api/admin/users/:id/accounting-integration", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const userView = await resolveAdminUserView(req.params.id);
      if (!userView) {
        return res.status(404).json({ error: "Fant ikke brukeren" });
      }
      const userViewId = readString(userView.id);
      if (!userViewId) {
        return res.status(404).json({ error: "Fant ikke bruker-ID for brukeren" });
      }

      res.json(await buildCompatAccountingIntegrationStatusResponse(userViewId));
    } catch (error) {
      console.error("Error fetching admin accounting integration status:", error);
      res.status(500).json({ error: "Kunne ikke hente regnskapsstatus for brukeren" });
    }
  });

  app.put("/api/admin/users/:id/accounting-integration", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      const userView = await resolveAdminUserView(req.params.id);
      if (!userView) {
        return res.status(404).json({ error: "Fant ikke brukeren" });
      }
      const userViewId = readString(userView.id);
      if (!userViewId) {
        return res.status(404).json({ error: "Fant ikke bruker-ID for brukeren" });
      }

      const body = isRecord(req.body) ? req.body : {};
      const existing =
        (await readCompatAccountingIntegrationStatus(userViewId)) ||
        buildDefaultCompatAccountingIntegrationStatus();
      const activationEnabled = readBoolean(body.activationEnabled) ?? false;
      const now = new Date().toISOString();

      const nextStatus: any = {
        ...existing,
        configured: isTripletexConfigured(),
        provider: "tripletex",
        environment: "test",
        activationEnabled,
        activatedAt: activationEnabled ? existing.activatedAt || now : null,
        activatedByUserId: activationEnabled ? adminSession.userId : null,
        activatedByName: activationEnabled ? adminSession.name : null,
        activationNotes: readString(body.activationNotes) || existing.activationNotes,
        status: activationEnabled ? existing.status : "disconnected",
        lastError: activationEnabled ? existing.lastError : null,
        organizationNumber:
          readString(body.organizationNumber) ||
          readString(userView.organizationNumber) ||
          existing.organizationNumber,
        businessName:
          readString(body.businessName) ||
          readString(userView.businessName) ||
          readString(userView.companyName) ||
          existing.businessName,
        contactName:
          readString(body.contactName) ||
          [readString(userView.firstName), readString(userView.lastName)].filter(Boolean).join(" ") ||
          existing.contactName,
        contactEmail:
          readString(body.contactEmail) ||
          readString(userView.email) ||
          existing.contactEmail,
        contactPhone:
          readString(body.contactPhone) || existing.contactPhone,
        addressLine1:
          readString(body.addressLine1) || existing.addressLine1,
        postalCode:
          readString(body.postalCode) || existing.postalCode,
        city: readString(body.city) || existing.city,
      };

      await writeCompatAccountingIntegrationStatus(userViewId, nextStatus);
      res.json(await buildCompatAccountingIntegrationStatusResponse(userViewId));
    } catch (error) {
      console.error("Error updating admin accounting integration status:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere regnskapsløsningen for brukeren" });
    }
  });

  app.post("/api/accounting/integration/tripletex/test/connect", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }
    const body = isRecord(req.body) ? req.body : {};
    const requestedUserId = readString(body.userId) || readString(body.targetUserId);
    const sessionUserId = compatResolveUserId(req);
    const userId = requestedUserId || sessionUserId;
    if (!userId || userId === "guest") {
      return res.status(401).json({ error: "Innlogging kreves for å koble til Tripletex" });
    }
    if (requestedUserId && requestedUserId !== sessionUserId && !requireAdminSession(req, res)) {
      return;
    }

    const existing =
      (await readCompatAccountingIntegrationStatus(userId)) ||
      buildDefaultCompatAccountingIntegrationStatus();
    if (!existing.activationEnabled) {
      return res.status(403).json({
        error: "Regnskapsløsningen er ikke aktivert for denne brukeren ennå",
      });
    }
    const client = new TripletexApiClient();

    try {
      const connection = await client.getConnectionSummary();
      const now = new Date().toISOString();
      const nextStatus: any = {
        ...existing,
        configured: true,
        provider: "tripletex",
        environment: "test",
        status: "connected",
        connectedAt: existing.connectedAt || now,
        lastVerifiedAt: now,
        lastError: null,
        organizationNumber:
          readString(body.organizationNumber) ||
          connection.organizationNumber ||
          existing.organizationNumber,
        businessName:
          readString(body.businessName) ||
          connection.companyName ||
          existing.businessName,
        contactName:
          readString(body.contactName) ||
          connection.employeeName ||
          existing.contactName,
        contactEmail:
          readString(body.contactEmail) ||
          connection.employeeEmail ||
          existing.contactEmail,
        contactPhone: readString(body.contactPhone) || existing.contactPhone,
        addressLine1: readString(body.addressLine1) || existing.addressLine1,
        postalCode: readString(body.postalCode) || existing.postalCode,
        city: readString(body.city) || existing.city,
        companyId: connection.companyId,
        companyName: connection.companyName,
        employeeId: connection.employeeId,
        employeeName: connection.employeeName,
        employeeEmail: connection.employeeEmail,
      };

      await writeCompatAccountingIntegrationStatus(userId, nextStatus);
      res.json(await buildCompatAccountingIntegrationStatusResponse(userId));
    } catch (error) {
      const nextStatus: any = {
        ...existing,
        configured: isTripletexConfigured(),
        provider: "tripletex",
        environment: "test",
        status: "error",
        lastVerifiedAt: new Date().toISOString(),
        lastError:
          error instanceof Error ? error.message : "Tripletex-tilkoblingen feilet",
      };
      await writeCompatAccountingIntegrationStatus(userId, nextStatus);

      const err = error as any;
      if (err?.name === "TripletexApiError" && typeof err.status === "number") {
        return res.status(err.status).json({ error: err.message, details: err.details });
      }

      console.error("Tripletex connect error:", error);
      return res.status(500).json({ error: "Kunne ikke koble til Tripletex testmiljø" });
    }
  });

  app.post("/api/accounting/integration/tripletex/test/disconnect", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const body = isRecord(req.body) ? req.body : {};
      const requestedUserId = readString(body.userId) || readString(body.targetUserId);
      const sessionUserId = compatResolveUserId(req);
      const userId = requestedUserId || sessionUserId;
      if (!userId || userId === "guest") {
        return res.status(401).json({ error: "Innlogging kreves for å koble fra Tripletex" });
      }
      if (requestedUserId && requestedUserId !== sessionUserId && !requireAdminSession(req, res)) {
        return;
      }

      const existing =
        (await readCompatAccountingIntegrationStatus(userId)) ||
        buildDefaultCompatAccountingIntegrationStatus();
      const nextStatus: any = {
        ...existing,
        configured: isTripletexConfigured(),
        provider: "tripletex",
        environment: "test",
        status: "disconnected",
        lastVerifiedAt: new Date().toISOString(),
        lastError: null,
      };
      await writeCompatAccountingIntegrationStatus(userId, nextStatus);
      res.json(await buildCompatAccountingIntegrationStatusResponse(userId));
    } catch (error) {
      console.error("Tripletex disconnect error:", error);
      res.status(500).json({ error: "Kunne ikke koble fra Tripletex" });
    }
  });

  app.get("/api/accounting/skattemelding/status", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || compatResolveUserId(req);
      const status = await readCompatSkattemeldingStatus(userId || "guest");
      res.json(status);
    } catch (error) {
      console.error("Error fetching skattemelding status:", error);
      res.status(500).json({ error: "Could not fetch skattemelding status" });
    }
  });

  app.post("/api/accounting/skattemelding/prepare", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      const current = await readCompatSkattemeldingStatus(userId);
      const nextStatus: any = {
        ...current,
        prepared: true,
        updatedAt: new Date().toISOString(),
        preparedAt: new Date().toISOString(),
      };
      await writeCompatSkattemeldingStatus(userId, nextStatus);
      res.status(201).json(nextStatus);
    } catch (error) {
      console.error("Error preparing skattemelding:", error);
      res.status(500).json({ error: "Could not prepare skattemelding" });
    }
  });

  app.post("/api/accounting/skattemelding/send", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      const current = await readCompatSkattemeldingStatus(userId);
      const nextStatus: any = {
        ...current,
        prepared: true,
        submitted: true,
        updatedAt: new Date().toISOString(),
        preparedAt: current.preparedAt || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      };
      await writeCompatSkattemeldingStatus(userId, nextStatus);
      res.status(201).json(nextStatus);
    } catch (error) {
      console.error("Error sending skattemelding:", error);
      res.status(500).json({ error: "Could not send skattemelding" });
    }
  });
}
