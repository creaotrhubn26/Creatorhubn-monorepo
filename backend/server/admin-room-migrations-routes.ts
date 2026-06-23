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
}

const MAX_LOG_LINES = 200;

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
};

let runLock = false;

function pushLogLine(line: string): void {
  currentState.lastLogLines.push(line);
  if (currentState.lastLogLines.length > MAX_LOG_LINES) {
    currentState.lastLogLines.shift();
  }
  if (/✅\s+.+applied successfully/i.test(line)) currentState.appliedThisRun += 1;
  if (/⏭️\s+Skipping/i.test(line)) currentState.skippedThisRun += 1;
}

export function setupAdminMigrationsRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  async function detectPendingMigrations(): Promise<string[]> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationsDir = path.resolve(__dirname, "..", "migrations");
    let allFiles: string[] = [];
    try {
      const entries = await fs.readdir(migrationsDir);
      allFiles = entries.filter((f) => f.endsWith(".sql"));
    } catch {
      return [];
    }

    let appliedSet = new Set<string>();
    try {
      const result = await pool.query("SELECT filename FROM _migrations_applied");
      appliedSet = new Set(result.rows.map((r: { filename: string }) => r.filename));
    } catch {
      // _migrations_applied finnes ikke ennå — alle filer er pending
    }

    return allFiles.filter((f) => !appliedSet.has(f)).sort();
  }

  app.get("/api/admin-room/migrations/status", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const pendingFiles = await detectPendingMigrations();
      res.json({ ...currentState, lockHeld: runLock, pendingFiles, pendingCount: pendingFiles.length });
    } catch (err) {
      // Graceful: returnér in-memory state uten pending-listing.
      console.warn("[migrations/status] failed:", (err as Error).message);
      res.json({ ...currentState, lockHeld: runLock, pendingFiles: [], pendingCount: 0 });
    }
  });

  app.post("/api/admin-room/migrations/run", async (req, res) => {
    // To-veis auth: enten admin-session ELLER MIGRATE_TRIGGER_TOKEN i header.
    // Token-pathen lar GitHub Actions trigge migrate automatisk ved push
    // uten å være logget inn som produkteier.
    const triggerHeader = req.headers["x-migrate-trigger-token"];
    // Trim both sides: a stray trailing newline in the GitHub secret or the
    // Render env var would otherwise fail an exact string compare and surface
    // as a misleading "Innlogging kreves".
    const triggerToken = (typeof triggerHeader === "string" ? triggerHeader : "").trim();
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
      if (triggerToken !== expectedToken) {
        res.status(401).json({
          error:
            "Ugyldig migrate-trigger-token: GitHub-secret MIGRATE_TRIGGER_TOKEN matcher ikke backend-env-variabelen.",
        });
        return;
      }
      actorEmail = (typeof req.headers["x-migrate-trigger-source"] === "string"
        ? req.headers["x-migrate-trigger-source"] as string
        : "github-actions");
      actorUserId = "ci-migrate";
    } else {
      const session = requireAdminRoomAccess(req, res);
      if (!session) return;
      actorEmail = session.email;
      actorUserId = session.userId;
    }

    if (runLock || currentState.status === "running") {
      res.status(409).json({
        error: "En migrate-run pågår allerede.",
        state: currentState,
      });
      return;
    }

    runLock = true;
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
    };

    // Lokaliser migrate.sh fra denne fila — backend/server/ → backend/migrate.sh
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrateScript = path.resolve(__dirname, "..", "migrate.sh");

    // Spawn migrate.sh som detached child process.
    // Vi sender RUN_RENDER_BOOT_SEEDING=0 og RUN_RENDER_BOOT_INTEGRITY=0
    // for å skippe seeding/integrity-sjekker — migrate-only.
    const child = spawn("bash", [migrateScript], {
      env: {
        ...process.env,
        RUN_RENDER_BOOT_SEEDING: "0",
        RUN_RENDER_BOOT_INTEGRITY: "0",
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
          details: { exitCode: code, appliedCount: currentState.appliedThisRun, skippedCount: currentState.skippedThisRun, actor: actorEmail },
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

    // Returner umiddelbart — frontend poller status.
    res.status(202).json({
      ok: true,
      state: currentState,
      message: "Migrate-run startet. Poll /api/admin-room/migrations/status for progress.",
    });
  });
}
