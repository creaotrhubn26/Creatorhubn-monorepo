// Admin test-case generator routes.
//
// Driver AutomatedTestCaseGenerator.tsx — Claude-genererte test-cases for
// admin-rommet. Tre endepunkter:
//   GET  /api/admin/test-cases?suiteId=...&profession=...&limit=50
//   GET  /api/admin/test-suites
//   POST /api/admin/generate-test-cases
//        body: { prompt | profession, suiteId?, count? }
//
// Persistens: `test_suites` + `test_cases` (migrasjon 243).
//
// Claude-flow:
//   1. Validér prompt (eller bygg prompt fra profession-alias).
//   2. Krev ANTHROPIC_API_KEY — uten den: 503 claude_not_configured.
//   3. Kall https://api.anthropic.com/v1/messages med strukturert spec.
//   4. Parse JSON-array fra responsen (tåler markdown-wrapping).
//   5. INSERT pr. test-case med generated_by='claude' + source_prompt.
//   6. Returnér { success, generatedCount, testCaseIds, testCases }.
//
// Frontend (AutomatedTestCaseGenerator.tsx) sender { profession }. Vi støtter
// både `prompt` (canonical) og `profession` (alias som blir til prompt).
//
// Tomme tabeller / manglende migrasjon: 200 med tom liste + tableMissing=true
// så frontend kan rendre "ingen data" uten å vise feilmelding.

import type express from "express";
import type { Pool } from "pg";

export interface AdminTestCaseGeneratorRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────

const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const VALID_CATEGORIES = new Set([
  "happy-path",
  "edge-case",
  "error-handling",
  "integration",
]);

function clampString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max) : value;
}

function normalizePriority(value: unknown): string {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  return VALID_PRIORITIES.has(s) ? s : "medium";
}

function normalizeCategory(value: unknown): string {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  return VALID_CATEGORIES.has(s) ? s : "happy-path";
}

function normalizeSteps(value: unknown): Array<{ action: string; expected: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => {
      if (!step || typeof step !== "object") return null;
      const s = step as Record<string, unknown>;
      const action = typeof s.action === "string" ? s.action : "";
      const expected = typeof s.expected === "string" ? s.expected : "";
      if (!action && !expected) return null;
      return { action, expected };
    })
    .filter((s): s is { action: string; expected: string } => s !== null);
}

function buildPromptFromProfession(profession: string): string {
  return (
    `Profesjon/persona: ${profession}\n\n` +
    `Generer test-cases som dekker hovedflyten en ${profession} ` +
    `går gjennom i CreatorHub-plattformen. Inkluder login, onboarding, ` +
    `core workflow og typiske feilsituasjoner.`
  );
}

export function setupAdminTestCaseGeneratorRoutes(
  deps: AdminTestCaseGeneratorRoutesDeps,
) {
  const { app, pool, requireAdminSession } = deps;

  // GET /api/admin/test-cases
  app.get("/api/admin/test-cases", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const limitRaw = parseInt(String(req.query.limit || "50"), 10);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 200)
        : 50;
      const suiteId = req.query.suiteId ? String(req.query.suiteId) : null;
      const where: string[] = [];
      const params: any[] = [];
      let i = 1;
      if (suiteId) {
        where.push(`suite_id = $${i++}`);
        params.push(suiteId);
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT id, suite_id, title, description, steps, expected_result,
                priority, category, generated_by, status, created_at
           FROM test_cases
           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
           ORDER BY created_at DESC
           LIMIT $${i}`,
        params,
      );
      res.json({ testCases: result.rows, total: result.rows.length });
    } catch (e: any) {
      if (e?.code === "42P01") {
        return res.json({ testCases: [], total: 0, tableMissing: true });
      }
      console.error("[test-cases] list failed:", e);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // GET /api/admin/test-suites
  app.get("/api/admin/test-suites", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const result = await pool.query(
        `SELECT s.id, s.name, s.description, s.target_component, s.created_at,
                (SELECT COUNT(*) FROM test_cases tc WHERE tc.suite_id = s.id) AS case_count
           FROM test_suites s
           ORDER BY s.created_at DESC`,
      );
      res.json({ suites: result.rows, total: result.rows.length });
    } catch (e: any) {
      if (e?.code === "42P01") {
        return res.json({ suites: [], total: 0, tableMissing: true });
      }
      console.error("[test-suites] list failed:", e);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // POST /api/admin/generate-test-cases
  app.post("/api/admin/generate-test-cases", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const profession =
        typeof body.profession === "string" ? body.profession.trim() : "";
      const explicitPrompt =
        typeof body.prompt === "string" ? body.prompt.trim() : "";
      const prompt = explicitPrompt
        ? explicitPrompt
        : profession
          ? buildPromptFromProfession(profession)
          : "";

      if (!prompt || prompt.length < 10) {
        return res.status(400).json({ error: "prompt_required" });
      }

      const countRaw = typeof body.count === "number" ? body.count : 5;
      const count = Math.max(1, Math.min(20, Math.trunc(countRaw) || 5));
      const suiteId =
        typeof body.suiteId === "string" && body.suiteId.length > 0
          ? body.suiteId
          : null;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "claude_not_configured",
          message:
            "ANTHROPIC_API_KEY mangler. Sett env-var for å aktivere generering.",
        });
      }

      const claudeResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content:
                  `Du er en QA-engineer. Generer ${count} test-cases for følgende komponent/feature:\n\n` +
                  `${prompt}\n\n` +
                  `Returner ren JSON-array med disse feltene per test case:\n` +
                  `[\n` +
                  `  {\n` +
                  `    "title": "kort tittel",\n` +
                  `    "description": "hva testen verifiserer",\n` +
                  `    "steps": [{"action": "gjør X", "expected": "Y skal skje"}],\n` +
                  `    "expectedResult": "samlet forventet resultat",\n` +
                  `    "priority": "low|medium|high|critical",\n` +
                  `    "category": "happy-path|edge-case|error-handling|integration"\n` +
                  `  }\n` +
                  `]\n\n` +
                  `Inkluder en blanding av happy-path, edge-cases og error-handling. Ingen markdown, kun JSON.`,
              },
            ],
          }),
        },
      );

      if (!claudeResponse.ok) {
        const errBody = await claudeResponse.text();
        console.error(
          "[test-case-generator] Claude API failed:",
          claudeResponse.status,
          errBody.slice(0, 500),
        );
        return res.status(502).json({
          error: "claude_api_failed",
          status: claudeResponse.status,
        });
      }

      const claudeData: any = await claudeResponse.json();
      const responseText: string =
        (claudeData?.content?.[0]?.text as string | undefined) || "";

      // Parse JSON-array fra Claude-svaret. Tåler markdown-wrapping
      // og ekstra prosa rundt JSON-en.
      let testCases: any[];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(
          jsonMatch ? jsonMatch[0] : responseText,
        );
        if (!Array.isArray(parsed)) throw new Error("not_array");
        testCases = parsed;
      } catch (parseErr) {
        console.error(
          "[test-case-generator] Claude response unparseable:",
          responseText.slice(0, 500),
        );
        return res.status(500).json({
          error: "claude_response_unparseable",
          rawResponse: responseText.slice(0, 1000),
        });
      }

      // Persist
      const insertedIds: string[] = [];
      const sourcePrompt = clampString(prompt, 2000);
      for (const tc of testCases) {
        const tcObj = (tc || {}) as Record<string, unknown>;
        const r = await pool.query(
          `INSERT INTO test_cases (
             suite_id, title, description, steps, expected_result,
             priority, category, generated_by, source_prompt
           )
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'claude', $8)
           RETURNING id`,
          [
            suiteId,
            clampString(tcObj.title, 500) || "Untitled",
            clampString(tcObj.description, 2000),
            JSON.stringify(normalizeSteps(tcObj.steps)),
            clampString(
              (tcObj as any).expectedResult ?? (tcObj as any).expected_result,
              2000,
            ),
            normalizePriority(tcObj.priority),
            normalizeCategory(tcObj.category),
            sourcePrompt,
          ],
        );
        insertedIds.push(r.rows[0].id);
      }

      res.json({
        success: true,
        generatedCount: testCases.length,
        testCaseIds: insertedIds,
        testCases,
      });
    } catch (e: any) {
      console.error("[test-case-generator] generate failed:", e);
      res.status(500).json({
        error: "generation_failed",
        message: String(e?.message ?? e).slice(0, 200),
      });
    }
  });
}
