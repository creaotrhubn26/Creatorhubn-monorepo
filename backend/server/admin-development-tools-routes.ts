/**
 * admin-development-tools-routes.ts — Slice 9X.126
 *
 * Admin development-tools: skanner kodebasen for placeholder-tekst
 * (TODO, FIXME, PLACEHOLDER, "Coming soon", "Lorem ipsum", "Hardcoded",
 * XXX, stubbed, TBD) via en grep-pipeline. Resultatet cacher i memory
 * og serveres tilbake via GET /api/development/placeholder-scan.
 *
 * POST /api/development/trigger-scan
 *   → kjører grep-pipelinen, parser "file:line:content", lager
 *     per-pattern aggregert statistikk og populerer cachen.
 *
 * GET /api/development/placeholder-scan
 *   → returnerer siste cachede resultat, eller en tom payload med
 *     hint om å trigge skan.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AdminDevelopmentToolsDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
}

interface ScanRow {
  file: string;
  line: number;
  content: string;
}

interface CachedScan {
  results: ScanRow[];
  scannedAt: string;
  totalMatches: number;
  byPattern?: Record<string, number>;
}

export function setupAdminDevelopmentToolsRoutes(
  deps: AdminDevelopmentToolsDeps,
): void {
  const { app, requireAdminSession } = deps;

  // Cache resultater i memory
  let cached: CachedScan | null = null;

  app.get("/api/development/placeholder-scan", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    if (cached) {
      return res.json(cached);
    }
    res.json({
      results: [],
      scannedAt: null,
      totalMatches: 0,
      message:
        "Ingen skan kjørt ennå. Bruk POST /api/development/trigger-scan.",
    });
  });

  app.post("/api/development/trigger-scan", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const repoRoot = path.resolve(__dirname, "../..");
      // Patterns we look for
      const patterns = [
        "TODO",
        "FIXME",
        "PLACEHOLDER",
        "Coming soon",
        "Lorem ipsum",
        "Hardcoded",
        "XXX",
        "stubbed",
        "TBD",
      ];
      const grepCmd = `grep -rn -E "${patterns.join("|")}" frontend/client/src backend/server --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | head -200`;
      const output = execSync(grepCmd, {
        cwd: repoRoot,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      const lines = output.split("\n").filter((l) => l.trim());

      // Parse "file:line:content"
      const results: ScanRow[] = lines
        .map((line): ScanRow | null => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (!match) return null;
          const [, file, lineNum, content] = match;
          return {
            file: file.replace(/^.*?(frontend|backend)/, "$1"),
            line: parseInt(lineNum, 10),
            content: content.trim().slice(0, 200),
          };
        })
        .filter((r): r is ScanRow => r !== null);

      // Byte-pattern statistikk
      const byPattern: Record<string, number> = {};
      for (const r of results) {
        for (const p of patterns) {
          if (r.content.toUpperCase().includes(p.toUpperCase())) {
            byPattern[p] = (byPattern[p] || 0) + 1;
          }
        }
      }

      cached = {
        results: results.slice(0, 100),
        scannedAt: new Date().toISOString(),
        totalMatches: results.length,
        byPattern,
      };
      res.json(cached);
    } catch (err: any) {
      console.error("[admin-dev-tools] scan failed:", err);
      res.status(500).json({
        error: "scan_failed",
        message: String(err?.message ?? err).slice(0, 200),
      });
    }
  });
}
