/**
 * admin-room-migrations-routes.ts
 *
 * Trigger ./migrate.sh async fra Admin Room — slik at Daniel kan kjøre
 * nye migrasjoner uten å re-deploye eller SSH-e inn på Render.
 *
 * Strategi:
 *   - Container booter med SKIP_BOOT_MIGRATE=1 (rask port-binding)
 *   - Når nye migrasjoner trengs, klikker admin "Kjør migrasjoner"
 *   - Backend spawn-er migrate.sh som child process, returnerer
 *     umiddelbart med status="running"
 *   - Frontend poller GET /status til status="completed" eller "failed"
 *
 * Endpoints:
 *   POST /api/admin-room/migrations/run    — trigger sync (returnerer raskt)
 *   GET  /api/admin-room/migrations/status — poll progress
 *
 * Lock: kun én migrate-run kan kjøre om gangen (kan ikke restartes mens
 * en allerede kjører). Lock i in-memory + DB-state for cross-instance safety.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AdminRoomRoutesDeps } from "./_shared";

interface MigrationState {
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  triggeredBy: string | null;
  lastLogLines: string[];
  exitCode: number | null;
  errorMessage: string | null;
  appliedThisRun: number;
  skippedThisRun: number;
  requestedFile: string | null;
}

const MAX_LOG_LINES = 200;
const PENDING_QUERY_TIMEOUT_MS = 4_000;
const MIGRATION_START_DELAY_MS = 250;
const MIGRATION_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/;

interface PendingMigrationsResult {
  pendingFiles: string[];
  pendingCheck: "ok" | "timeout" | "error";
  pendingError?:
    | "query_timeout"
    | "query_failed"
    | "migrations_directory_unavailable"
    | "requested_migration_unavailable";
}

class PendingMigrationsTimeoutError extends Error {
  constructor() {
    super("Pending migrations query timed out");
    this.name = "PendingMigrationsTimeoutError";
  }
}

let currentState: MigrationState = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  triggeredBy: null,
  lastLogLines: [],
  exitCode: null,
  errorMessage: null,
  appliedThisRun: 0,
  skippedThisRun: 0,
  requestedFile: null,
};

let runLock = false;

function pushLogLine(line: string): void {
  currentState.lastLogLines.push(line);
  if (currentState.lastLogLines.length > MAX_LOG_LINES) {
    currentState.lastLogLines.shift();
  }
  if (/✅\s+.+applied successfully/i.test(line))
    currentState.appliedThisRun += 1;
  if (/⏭️\s+Skipping/i.test(line)) currentState.skippedThisRun += 1;
}

export function setupAdminMigrationsRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;
  let appliedFilenamesQuery: Promise<Set<string>> | null = null;
  let lastKnownPendingFiles: string[] | null = null;

  function readAppliedFilenames(): Promise<Set<string>> {
    // Reuse one in-flight query. A temporary tracking-table lock must not let
    // repeated CI polls enqueue dozens of additional pool queries.
    if (!appliedFilenamesQuery) {
      appliedFilenamesQuery = pool
        .query("SELECT filename FROM _migrations_applied")
        .then(
          (result) =>
            new Set(
              result.rows.map((row: { filename: string }) => row.filename),
            ),
        )
        .finally(() => {
          appliedFilenamesQuery = null;
        });
    }
    return appliedFilenamesQuery!;
  }

  async function withPendingQueryTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new PendingMigrationsTimeoutError()),
            PENDING_QUERY_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function detectPendingMigrations(
    requestedFile: string | null = null,
  ): Promise<PendingMigrationsResult> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationsDir = path.resolve(__dirname, "..", "migrations");
    let allFiles: string[] = [];
    try {
      const entries = await fs.readdir(migrationsDir);
      const migrationFiles = entries.filter((f) => f.endsWith(".sql"));
      if (requestedFile && !migrationFiles.includes(requestedFile)) {
        return {
          pendingFiles: [requestedFile],
          pendingCheck: "error",
          pendingError: "requested_migration_unavailable",
        };
      }
      allFiles = requestedFile ? [requestedFile] : migrationFiles;
    } catch {
      return {
        pendingFiles: [],
        pendingCheck: "error",
        pendingError: "migrations_directory_unavailable",
      };
    }

    try {
      const appliedSet = await withPendingQueryTimeout(readAppliedFilenames());
      const pendingFiles = allFiles.filter((f) => !appliedSet.has(f)).sort();
      lastKnownPendingFiles = pendingFiles;
      return {
        pendingFiles,
        pendingCheck: "ok",
      };
    } catch (error) {
      const timedOut = error instanceof PendingMigrationsTimeoutError;
      console.warn(
        timedOut
          ? "[migrations/status] pending query timed out"
          : "[migrations/status] pending query failed",
      );
      // Fail closed. An unavailable tracking query is never equivalent to
      // zero pending migrations.
      return {
        pendingFiles: allFiles.sort(),
        pendingCheck: timedOut ? "timeout" : "error",
        pendingError: timedOut ? "query_timeout" : "query_failed",
      };
    }
  }

  function readPresentedMigrateToken(
    req: Parameters<typeof requireAdminRoomAccess>[0],
  ): string {
    // Use a dedicated HTTP auth scheme so CI traffic is not confused with
    // Admin Room's ordinary `Authorization: Bearer ...` sessions. Keep the
    // legacy custom header during rollout for backwards compatibility.
    const authorization = req.headers.authorization;
    if (typeof authorization === "string") {
      const match = authorization.match(/^Migrate\s+(.+)$/i);
      if (match) return match[1].trim();
    }

    // This is the established GitHub Actions -> Render transport used by the
    // repository's production cron jobs. It is kept separate from ordinary
    // Admin Room Bearer sessions.
    const cronHeader = req.headers["x-cron-trigger-token"];
    if (typeof cronHeader === "string" && cronHeader.trim()) {
      return cronHeader.trim();
    }

    const legacyHeader = req.headers["x-migrate-trigger-token"];
    return (typeof legacyHeader === "string" ? legacyHeader : "").trim();
  }

  // Gyldig MIGRATE_TRIGGER_TOKEN presentert via Authorization: Migrate eller
  // legacy-header? Lar CI polle status uten produkteier-sesjon.
  function hasValidMigrateToken(
    req: Parameters<typeof requireAdminRoomAccess>[0],
  ): boolean {
    const triggerToken = readPresentedMigrateToken(req);
    const expectedToken = (process.env.MIGRATE_TRIGGER_TOKEN ?? "").trim();
    if (
      !triggerToken ||
      !expectedToken ||
      triggerToken.length !== expectedToken.length
    )
      return false;
    return timingSafeEqual(
      Buffer.from(triggerToken),
      Buffer.from(expectedToken),
    );
  }

  // Database-free transport probe for CI. This distinguishes token delivery
  // problems from migration or database work without exposing secret data.
  app.get("/api/admin-room/migrations/auth-check", (req, res) => {
    if (!hasValidMigrateToken(req)) {
      res.status(401).json({ ok: false, error: "ugyldig_token" });
      return;
    }
    res.json({ ok: true, auth: "ci-migrate" });
  });

  app.get("/api/admin-room/migrations/status", async (req, res) => {
    // Token-path (CI) ELLER admin-sesjon (Admin Room-UI).
    if (!hasValidMigrateToken(req)) {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
    }
    const requestedFileRaw = req.query.migrationFile;
    const requestedFile =
      typeof requestedFileRaw === "string" ? requestedFileRaw.trim() : null;
    if (
      requestedFileRaw !== undefined &&
      (!requestedFile || !MIGRATION_FILENAME_PATTERN.test(requestedFile))
    ) {
      res.status(400).json({ error: "Ugyldig migreringsfil." });
      return;
    }
    try {
      // While migrate.sh is active, its child-process state is authoritative.
      // Do not contend with it on the tracking table merely to report running.
      if (currentState.status === "running") {
        const pendingFiles = lastKnownPendingFiles ?? [];
        res.json({
          ...currentState,
          lockHeld: runLock,
          pendingFiles,
          pendingCount: lastKnownPendingFiles
            ? lastKnownPendingFiles.length
            : 1,
          pendingCheck: "running",
        });
        return;
      }
      const pending = await detectPendingMigrations(requestedFile);
      res.json({
        ...currentState,
        lockHeld: runLock,
        ...pending,
        pendingCount: pending.pendingFiles.length,
      });
    } catch (err) {
      // Graceful + fail-closed: keep status available without claiming that
      // no migrations are pending.
      console.warn("[migrations/status] failed:", (err as Error).message);
      res.json({
        ...currentState,
        lockHeld: runLock,
        pendingFiles: [],
        pendingCount: 1,
        pendingCheck: "error",
        pendingError: "query_failed",
      });
    }
  });

  app.post("/api/admin-room/migrations/run", async (req, res) => {
    // To-veis auth: enten admin-session ELLER MIGRATE_TRIGGER_TOKEN presentert
    // via Authorization: Migrate (legacy custom header støttes under rollout).
    // Token-pathen lar GitHub Actions trigge migrate automatisk ved push
    // uten å være logget inn som produkteier.
    // Trim both sides: a stray trailing newline in the GitHub secret or the
    // Render env var would otherwise fail an exact string compare and surface
    // as a misleading "Innlogging kreves".
    const triggerToken = readPresentedMigrateToken(req);
    const expectedToken = (process.env.MIGRATE_TRIGGER_TOKEN ?? "").trim();

    let actorEmail = "system";
    let actorUserId = "ci";
    if (triggerToken) {
      // CI path: a trigger token was presented. Validate explicitly so a
      // mismatch gives a clear reason instead of falling through to the
      // session check (which returns the confusing "Innlogging kreves").
      if (!expectedToken) {
        res.status(503).json({
          error:
            "MIGRATE_TRIGGER_TOKEN er ikke konfigurert på backend. Sett env-variabelen på Render til samme verdi som GitHub-secret-en.",
        });
        return;
      }
      if (
        triggerToken.length !== expectedToken.length ||
        !timingSafeEqual(Buffer.from(triggerToken), Buffer.from(expectedToken))
      ) {
        res.status(401).json({
          error:
            "Ugyldig migrate-trigger-token: GitHub-secret MIGRATE_TRIGGER_TOKEN matcher ikke backend-env-variabelen.",
        });
        return;
      }
      actorEmail =
        typeof req.headers["x-migrate-trigger-source"] === "string"
          ? (req.headers["x-migrate-trigger-source"] as string)
          : "github-actions";
      actorUserId = "ci-migrate";
    } else {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      actorEmail = session.email;
      actorUserId = session.userId;
    }

    const requestedFileRaw = req.body?.migrationFile;
    const requestedFile =
      typeof requestedFileRaw === "string" ? requestedFileRaw.trim() : null;
    if (
      requestedFileRaw !== undefined &&
      (!requestedFile || !MIGRATION_FILENAME_PATTERN.test(requestedFile))
    ) {
      res.status(400).json({ error: "Ugyldig migreringsfil." });
      return;
    }
    if (triggerToken && !requestedFile) {
      res.status(400).json({
        error: "CI-migrering krever en eksplisitt migreringsfil.",
      });
      return;
    }
    if (requestedFile) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const requestedPath = path.resolve(
        __dirname,
        "..",
        "migrations",
        requestedFile,
      );
      try {
        await fs.access(requestedPath);
      } catch {
        res.status(400).json({ error: "Migreringsfilen finnes ikke." });
        return;
      }
    }

    if (runLock || currentState.status === "running") {
      res.status(409).json({
        error: "En migrate-run pågår allerede.",
        state: currentState,
      });
      return;
    }

    runLock = true;
    lastKnownPendingFiles = requestedFile ? [requestedFile] : null;
    currentState = {
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      triggeredBy: actorEmail,
      lastLogLines: [`▶ Trigget av ${actorEmail} ${new Date().toISOString()}`],
      exitCode: null,
      errorMessage: null,
      appliedThisRun: 0,
      skippedThisRun: 0,
      requestedFile,
    };

    // Flush 202 before process creation. Spawning from the large Render
    // process can be slow enough for CI to lose the trigger response.
    res.status(202).json({
      ok: true,
      state: currentState,
      message:
        "Migrate-run startet. Poll /api/admin-room/migrations/status for progress.",
    });

    const startTimer = setTimeout(() => {
      try {
        // Lokaliser migrate.sh fra denne fila — backend/server/ → backend/migrate.sh
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const migrateScript = path.resolve(__dirname, "..", "migrate.sh");

        // Spawn migrate.sh som asynkron child process.
        // Vi sender RUN_RENDER_BOOT_SEEDING=0 og RUN_RENDER_BOOT_INTEGRITY=0
        // for å skippe seeding/integrity-sjekker — migrate-only.
        const child = spawn("bash", [migrateScript], {
          env: {
            ...process.env,
            RUN_RENDER_BOOT_SEEDING: "0",
            RUN_RENDER_BOOT_INTEGRITY: "0",
            MIGRATION_ONLY_FILE: requestedFile ?? "",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on("data", (chunk: Buffer) => {
          for (const line of chunk.toString("utf-8").split(/\r?\n/)) {
            if (line.trim().length > 0) pushLogLine(line);
          }
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          for (const line of chunk.toString("utf-8").split(/\r?\n/)) {
            if (line.trim().length > 0) pushLogLine(`[stderr] ${line}`);
          }
        });

        child.on("close", async (code) => {
          currentState.exitCode = code ?? null;
          currentState.finishedAt = new Date().toISOString();
          currentState.status = code === 0 ? "completed" : "failed";
          if (code !== 0) {
            currentState.errorMessage = `migrate.sh exited with code ${code}`;
          }
          runLock = false;
          try {
            await logAdminActivity({
              userId: actorUserId,
              entityType: "migrations_run",
              action: code === 0 ? "completed" : "failed",
              summary: `${currentState.appliedThisRun} applied, ${currentState.skippedThisRun} skipped (exit ${code}, by ${actorEmail})`,
              details: {
                exitCode: code,
                appliedCount: currentState.appliedThisRun,
                skippedCount: currentState.skippedThisRun,
                actor: actorEmail,
              },
            });
          } catch {
            // logging-feil skal ikke krasje migrate-flowen
          }
        });

        child.on("error", (err) => {
          currentState.errorMessage = err.message;
          currentState.status = "failed";
          currentState.finishedAt = new Date().toISOString();
          runLock = false;
        });
      } catch (error) {
        currentState.errorMessage =
          error instanceof Error ? error.message : "spawn_failed";
        currentState.status = "failed";
        currentState.finishedAt = new Date().toISOString();
        runLock = false;
      }
    }, MIGRATION_START_DELAY_MS);
    startTimer.unref();
  });
}
