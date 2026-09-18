/**
 * Minimal Admin Workspace backend for the dedicated Playwright suite.
 *
 * This entrypoint is intentionally separate from server/index.ts. It mounts
 * only the real Admin Workspace route modules and accepts the well-known local
 * developer token only when the process and the request are both explicitly
 * constrained to loopback E2E use.
 */

import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Server } from "node:http";
import express from "express";
import type { Request } from "express";
import { Pool } from "pg";
import type { AdminRoomRoutesDeps, AdminSession } from "./_shared";
import { setupAdminDocumentContextRoutes } from "./admin-document-context-routes";
import { setupAdminActivityRoutes } from "./admin-room-activity-routes";
import { setupAdminWorkspaceCalendarRoutes } from "./admin-workspace-calendar-routes";
import { setupAdminWorkspaceCasesRoutes } from "./admin-workspace-cases-routes";
import { setupAdminWorkspaceCvRoutes } from "./admin-workspace-cv-routes";
import { setupAdminWorkspaceDocumentsRoutes } from "./admin-workspace-documents-routes";
import { setupAdminWorkspaceFundingOpportunityRoutes } from "./admin-workspace-funding-opportunities-routes";
import { setupAdminWorkspaceProjectsRoutes } from "./admin-workspace-projects-routes";
import { setupAdminWorkspaceTasksRoutes } from "./admin-workspace-tasks-routes";
import { ensureAdminWorkspaceE2eSchema } from "./admin-workspace-e2e-schema";
import { canUseLocalDevelopmentAdminSession } from "./local-development-session";

const LOOPBACK_HOST = "127.0.0.1";
const OWNER_EMAIL = "admin@local.dev";
const LOCAL_BROWSER_USER_ID = "local-admin";
const ENABLE_FLAG = "CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS";
const E2E_DATABASE_NAME = "creatorhub_admin_workspace_e2e";
const DEFAULT_E2E_DATABASE_URL =
  "postgresql://127.0.0.1:5432/creatorhub_admin_workspace_e2e";
export const ADMIN_WORKSPACE_E2E_USER_ID =
  "00000000-0000-4000-8000-000000000317";

export interface AdminWorkspaceE2eHarnessConfig {
  environment: "development" | "test";
  explicitlyEnabled: true;
  host: typeof LOOPBACK_HOST;
  port: number;
  databaseUrl: string;
}

interface CreateHarnessAppOptions {
  pool: Pool;
  ownerUserId: string;
  config: Pick<
    AdminWorkspaceE2eHarnessConfig,
    "environment" | "explicitlyEnabled"
  >;
}

interface AuthorizedRequestInput {
  environment: string | undefined;
  explicitlyEnabled: string | boolean | undefined;
  authorization: string | undefined;
  remoteAddress: string | undefined;
  host: string | undefined;
  origin?: string | undefined;
  fetchSite?: string | undefined;
}

function enabled(value: string | boolean | undefined): boolean {
  return (
    value === true ||
    (typeof value === "string" && value.trim().toLowerCase() === "true")
  );
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? "3317");
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(
      "ADMIN_WORKSPACE_E2E_PORT må være et heltall mellom 1024 og 65535",
    );
  }
  return port;
}

function hostnameFromHostHeader(rawHost: string | undefined): string {
  const value = String(rawHost ?? "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  try {
    return new URL(`http://${value}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
}

function hasLoopbackHost(rawHost: string | undefined): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(
    hostnameFromHostHeader(rawHost),
  );
}

function readBearerToken(authorization: string | undefined): string | null {
  const match = String(authorization ?? "").match(/^Bearer ([^\s]+)$/u);
  return match?.[1] ?? null;
}

function validateE2eDatabaseUrl(rawValue: string): string {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(
      "ADMIN_WORKSPACE_E2E_DATABASE_URL må være en gyldig PostgreSQL-URL",
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "::1"].includes(hostname) ||
    databaseName !== E2E_DATABASE_NAME ||
    (url.port && url.port !== "5432") ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `ADMIN_WORKSPACE_E2E_DATABASE_URL må peke til lokal ${E2E_DATABASE_NAME} på PostgreSQL-port 5432`,
    );
  }
  return url.toString();
}

export function readAdminWorkspaceE2eHarnessConfig(
  env: NodeJS.ProcessEnv = process.env,
): AdminWorkspaceE2eHarnessConfig {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Admin Workspace E2E-harness kan aldri startes i production",
    );
  }
  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
    throw new Error(
      "Admin Workspace E2E-harness krever NODE_ENV=development eller NODE_ENV=test",
    );
  }
  if (!enabled(env[ENABLE_FLAG])) {
    throw new Error(`Admin Workspace E2E-harness krever ${ENABLE_FLAG}=true`);
  }
  const databaseUrl = validateE2eDatabaseUrl(
    String(
      env.ADMIN_WORKSPACE_E2E_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL,
    ).trim(),
  );
  return {
    environment: env.NODE_ENV,
    explicitlyEnabled: true,
    host: LOOPBACK_HOST,
    port: readPort(env.ADMIN_WORKSPACE_E2E_PORT),
    databaseUrl,
  };
}

export function canUseAdminWorkspaceE2eSession(
  input: AuthorizedRequestInput,
): boolean {
  if (
    (input.environment !== "development" && input.environment !== "test") ||
    !enabled(input.explicitlyEnabled)
  ) {
    return false;
  }

  // Reuse the production-adjacent loopback, Host, Origin and fetch-site
  // validation without broadening the normal development-token contract.
  // The separate harness boot gate above is what permits NODE_ENV=test.
  return canUseLocalDevelopmentAdminSession({
    environment: "development",
    explicitlyEnabled: true,
    sessionToken: readBearerToken(input.authorization),
    remoteAddress: input.remoteAddress,
    host: input.host,
    origin: input.origin,
    fetchSite: input.fetchSite,
  });
}

function requestIsAuthorized(
  req: Request,
  config: Pick<
    AdminWorkspaceE2eHarnessConfig,
    "environment" | "explicitlyEnabled"
  >,
): boolean {
  return canUseAdminWorkspaceE2eSession({
    environment: config.environment,
    explicitlyEnabled: config.explicitlyEnabled,
    authorization: req.headers.authorization,
    remoteAddress: req.socket.remoteAddress,
    host: req.headers.host,
    origin:
      typeof req.headers.origin === "string" ? req.headers.origin : undefined,
    fetchSite:
      typeof req.headers["sec-fetch-site"] === "string"
        ? req.headers["sec-fetch-site"]
        : undefined,
  });
}

export function createAdminWorkspaceE2eApp(
  options: CreateHarnessAppOptions,
): express.Application {
  const { pool, ownerUserId, config } = options;
  const app = express();
  app.disable("x-powered-by");

  // DNS rebinding should fail before health or application routes disclose
  // anything, even though the TCP listener itself is loopback-only.
  app.use((req, res, next) => {
    if (!hasLoopbackHost(req.headers.host)) {
      res.status(403).json({ error: "Loopback Host kreves" });
      return;
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));

  const session: AdminSession = { userId: ownerUserId, email: OWNER_EMAIL };
  const getActiveSessionFromRequest: AdminRoomRoutesDeps["getActiveSessionFromRequest"] =
    (req) => (requestIsAuthorized(req, config) ? session : null);
  const requireAdminRoomAccess: AdminRoomRoutesDeps["requireAdminRoomAccess"] =
    (req, res) => {
      const activeSession = getActiveSessionFromRequest(req);
      if (!activeSession) {
        res.status(401).json({ error: "E2E-innlogging kreves" });
        return null;
      }
      return activeSession;
    };
  // Audit writes are not under test here and would outlive fixture cleanup.
  // Keep the real activity read route, but make harness-only writes a no-op.
  const logAdminActivity: AdminRoomRoutesDeps["logAdminActivity"] = async () =>
    undefined;

  const routeDeps: AdminRoomRoutesDeps = {
    app,
    pool,
    getActiveSessionFromRequest,
    requireAdminRoomAccess,
    logAdminActivity,
  };

  app.get("/__admin-workspace-e2e/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, service: "admin-workspace-e2e" });
  });

  app.get("/api/auth/user", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!requestIsAuthorized(req, config)) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({
      authenticated: true,
      user: {
        // The frontend's local-development gate deliberately recognises only
        // this non-production identity. Database writes remain scoped to the
        // separate synthetic UUID in the server-side session above.
        id: LOCAL_BROWSER_USER_ID,
        email: OWNER_EMAIL,
        firstName: "Local",
        lastName: "Admin",
        name: "Local Admin",
        displayName: "Local Admin",
        role: "admin",
        roleLabel: "Admin",
        profession: "photographer",
        userType: "photographer",
        permissions: ["users:read", "users:write", "roles:write"],
        isAdmin: true,
        verified_email: true,
      },
    });
  });

  const sendAuthenticatedEmptyItems = (req: Request, res: express.Response) => {
    if (!requireAdminRoomAccess(req, res)) return;
    res.json({ items: [] });
  };
  // Link-option sources include the complete Role Room/Leadgrid CRM. Those
  // selectors are not under test in this suite, so keep them isolated.
  app.get(
    "/api/admin-room/workspace/projects/:id/link-options",
    sendAuthenticatedEmptyItems,
  );
  app.get(
    "/api/admin-room/workspace/documents/:id/link-options",
    sendAuthenticatedEmptyItems,
  );
  app.use("/api/admin-room/workspace/calendar", (req, _res, next) => {
    if (req.method === "GET" && !req.query.sources) {
      req.query.sources =
        "calendar_event,task,case,project,funding_app,funding_opportunity";
    }
    next();
  });

  setupAdminActivityRoutes(routeDeps);
  setupAdminWorkspaceCasesRoutes(routeDeps);
  setupAdminWorkspaceProjectsRoutes(routeDeps);
  setupAdminWorkspaceCvRoutes(routeDeps);
  setupAdminWorkspaceDocumentsRoutes(routeDeps);
  setupAdminDocumentContextRoutes(routeDeps);
  setupAdminWorkspaceTasksRoutes(routeDeps);
  setupAdminWorkspaceFundingOpportunityRoutes(routeDeps);
  setupAdminWorkspaceCalendarRoutes(routeDeps);

  // These shell feeds are outside the four isolated workflows. Empty,
  // authenticated responses avoid broad reads from Role Room/casting data.
  app.get(
    "/api/admin-room/workspace/today-agenda",
    sendAuthenticatedEmptyItems,
  );
  app.get(
    "/api/admin-room/workspace/upcoming-deadlines",
    sendAuthenticatedEmptyItems,
  );
  app.get("/api/notifications/inbox", sendAuthenticatedEmptyItems);

  app.use((_req, res) => {
    res.status(404).json({ error: "E2E-ruten finnes ikke" });
  });
  return app;
}

export async function startAdminWorkspaceE2eHarness(): Promise<{
  app: express.Application;
  pool: Pool;
  server: Server;
  stop: () => Promise<void>;
}> {
  const config = readAdminWorkspaceE2eHarnessConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });

  try {
    await pool.query("SELECT 1");
    await ensureAdminWorkspaceE2eSchema(pool);
    const ownerUserId = ADMIN_WORKSPACE_E2E_USER_ID;
    const app = createAdminWorkspaceE2eApp({ pool, ownerUserId, config });
    const server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(config.port, config.host, () =>
        resolve(listener),
      );
      listener.once("error", reject);
    });
    let stopped = false;
    const stop = async (): Promise<void> => {
      if (stopped) return;
      stopped = true;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await pool.end();
    };
    const shutdown = () => {
      void stop().catch((error) => {
        console.error("[admin-workspace-e2e] shutdown failed", error);
        process.exitCode = 1;
      });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    console.log(
      `[admin-workspace-e2e] ready at http://${config.host}:${config.port} (owner ${ownerUserId})`,
    );
    return { app, pool, server, stop };
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  void startAdminWorkspaceE2eHarness().catch((error) => {
    console.error("[admin-workspace-e2e] startup failed", error);
    process.exitCode = 1;
  });
}
