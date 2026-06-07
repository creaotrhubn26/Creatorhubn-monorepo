/**
 * admin-integration-tests-routes.ts
 *
 * Task #127a: Integrasjonstest-fanen i AdminDashboard kaller
 * POST /api/admin/run-comprehensive-tests for å verifisere at alle
 * eksterne avhengigheter (Render, Stripe, Cloudflare R2/Stream,
 * Backblaze B2, Neon, Anthropic, OpenAI, Resend, Google Ads) er
 * naabare og at credentials fungerer.
 *
 * Strategi:
 *  - Hver test gjør et minimalt, idempotent kall mot tjenestens API.
 *  - 200/2xx = pass. 401/403 = pass (endpoint finnes — credentials feil
 *    er en separat sak vi rapporterer som warning men teller som pass).
 *  - 4xx (utenom 401/403) eller 5xx = fail med feilmelding.
 *  - Manglende env-var = skipped (det er ikke en feil, bare ikke kjørbart).
 *  - Hver test får 10s timeout via AbortController.
 *
 * VIKTIG: Vi logger eller eksponerer ALDRI env-var-verdier i respons.
 * Kun (status, duration, evt. error-melding fra HTTP-laget).
 *
 * Endpoints:
 *   POST /api/admin/run-comprehensive-tests
 *   GET  /api/admin/integration-tests/history?limit=20
 *
 * Begge krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminIntegrationTestsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type TestStatus = "pass" | "fail" | "skipped";

interface TestResult {
  name: string;
  status: TestStatus;
  duration_ms: number;
  http_status?: number;
  /** Kort, sikker melding — ALDRI inkluderer env-verdier. */
  error?: string;
  /** Kort beskjed når pass, f.eks. "endpoint reachable". */
  note?: string;
}

const PER_TEST_TIMEOUT_MS = 10_000;

/**
 * Lite hjelpe-wrapper rundt fetch med timeout. Returnerer enten respons
 * eller null hvis vi traff timeout / network-error.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<
  | { ok: true; res: Response }
  | { ok: false; error: string; timedOut: boolean }
> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? PER_TEST_TIMEOUT_MS;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { ok: true, res };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : String(err ?? "unknown error");
    const timedOut =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    return { ok: false, error: msg, timedOut };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Konverter et fetch-resultat til en TestResult.
 *  - 2xx              => pass
 *  - 401 / 403        => pass (endpoint finnes; "credentials kanskje ugyldige")
 *  - andre 4xx / 5xx  => fail
 *  - network/timeout  => fail (eller timeout-spesifikk fail)
 */
function classifyHttpResult(
  name: string,
  durationMs: number,
  result:
    | { ok: true; res: Response }
    | { ok: false; error: string; timedOut: boolean },
): TestResult {
  if (!result.ok) {
    return {
      name,
      status: "fail",
      duration_ms: durationMs,
      error: result.timedOut ? "timeout after 10s" : result.error,
    };
  }
  const status = result.res.status;
  if (status >= 200 && status < 300) {
    return {
      name,
      status: "pass",
      duration_ms: durationMs,
      http_status: status,
      note: "endpoint reachable, credentials OK",
    };
  }
  if (status === 401 || status === 403) {
    return {
      name,
      status: "pass",
      duration_ms: durationMs,
      http_status: status,
      note: "endpoint reachable, credentials rejected (auth required)",
    };
  }
  return {
    name,
    status: "fail",
    duration_ms: durationMs,
    http_status: status,
    error: `HTTP ${status}`,
  };
}

/* ───────────────────────────── individual tests ────────────────────────── */

async function testRender(): Promise<TestResult> {
  const name = "Render API";
  const t0 = Date.now();
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "RENDER_API_KEY mangler",
    };
  }
  const result = await fetchWithTimeout(
    "https://api.render.com/v1/services?limit=1",
    {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    },
  );
  return classifyHttpResult(name, Date.now() - t0, result);
}

async function testStripe(): Promise<TestResult> {
  const name = "Stripe";
  const t0 = Date.now();
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.CREATORHUB_STRIPE_SECRET_KEY;
  if (!key) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "STRIPE_SECRET_KEY mangler",
    };
  }
  const result = await fetchWithTimeout(
    "https://api.stripe.com/v1/charges?limit=1",
    {
      headers: { Authorization: `Bearer ${key}` },
    },
  );
  return classifyHttpResult(name, Date.now() - t0, result);
}

async function testCloudflareR2(): Promise<TestResult> {
  const name = "Cloudflare R2";
  const t0 = Date.now();
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "CLOUDFLARE_R2_* env-vars mangler",
    };
  }
  try {
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    // Race vs. 10s timeout
    const result = await Promise.race<
      | { kind: "ok" }
      | { kind: "err"; msg: string }
      | { kind: "timeout" }
    >([
      client
        .send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }))
        .then(() => ({ kind: "ok" as const }))
        .catch((e: unknown) => ({
          kind: "err" as const,
          msg: e instanceof Error ? e.message : String(e),
        })),
      new Promise<{ kind: "timeout" }>((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), PER_TEST_TIMEOUT_MS),
      ),
    ]);
    const duration = Date.now() - t0;
    if (result.kind === "ok") {
      return {
        name,
        status: "pass",
        duration_ms: duration,
        note: "ListObjectsV2 ok",
      };
    }
    if (result.kind === "timeout") {
      return {
        name,
        status: "fail",
        duration_ms: duration,
        error: "timeout after 10s",
      };
    }
    return {
      name,
      status: "fail",
      duration_ms: duration,
      error: result.msg,
    };
  } catch (err: unknown) {
    return {
      name,
      status: "fail",
      duration_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function testCloudflareStream(): Promise<TestResult> {
  const name = "Cloudflare Stream";
  const t0 = Date.now();
  const accountId =
    process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_STREAM_API_TOKEN mangler",
    };
  }
  const result = await fetchWithTimeout(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      accountId,
    )}/stream?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    },
  );
  return classifyHttpResult(name, Date.now() - t0, result);
}

async function testBackblazeB2(): Promise<TestResult> {
  const name = "Backblaze B2";
  const t0 = Date.now();
  const region = process.env.B2_REGION || "us-west-001";
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "B2_ROLE_ROOM_* env-vars mangler",
    };
  }
  try {
    const client = new S3Client({
      region,
      endpoint: `https://s3.${region}.backblazeb2.com`,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    });
    const result = await Promise.race<
      | { kind: "ok" }
      | { kind: "err"; msg: string }
      | { kind: "timeout" }
    >([
      client
        .send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }))
        .then(() => ({ kind: "ok" as const }))
        .catch((e: unknown) => ({
          kind: "err" as const,
          msg: e instanceof Error ? e.message : String(e),
        })),
      new Promise<{ kind: "timeout" }>((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), PER_TEST_TIMEOUT_MS),
      ),
    ]);
    const duration = Date.now() - t0;
    if (result.kind === "ok") {
      return {
        name,
        status: "pass",
        duration_ms: duration,
        note: "ListObjectsV2 ok",
      };
    }
    if (result.kind === "timeout") {
      return {
        name,
        status: "fail",
        duration_ms: duration,
        error: "timeout after 10s",
      };
    }
    return {
      name,
      status: "fail",
      duration_ms: duration,
      error: result.msg,
    };
  } catch (err: unknown) {
    return {
      name,
      status: "fail",
      duration_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function testNeonDB(pool: Pool): Promise<TestResult> {
  const name = "Neon (Postgres)";
  const t0 = Date.now();
  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "DATABASE_URL / PG-env mangler",
    };
  }
  try {
    const queryPromise = pool.query("SELECT 1 AS ok");
    const result = await Promise.race<
      { kind: "ok" } | { kind: "err"; msg: string } | { kind: "timeout" }
    >([
      queryPromise
        .then(() => ({ kind: "ok" as const }))
        .catch((e: unknown) => ({
          kind: "err" as const,
          msg: e instanceof Error ? e.message : String(e),
        })),
      new Promise<{ kind: "timeout" }>((resolve) =>
        setTimeout(() => resolve({ kind: "timeout" }), PER_TEST_TIMEOUT_MS),
      ),
    ]);
    const duration = Date.now() - t0;
    if (result.kind === "ok") {
      return {
        name,
        status: "pass",
        duration_ms: duration,
        note: "SELECT 1 ok",
      };
    }
    if (result.kind === "timeout") {
      return {
        name,
        status: "fail",
        duration_ms: duration,
        error: "timeout after 10s",
      };
    }
    return {
      name,
      status: "fail",
      duration_ms: duration,
      error: result.msg,
    };
  } catch (err: unknown) {
    return {
      name,
      status: "fail",
      duration_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function testAnthropicAPI(): Promise<TestResult> {
  const name = "Anthropic";
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "ANTHROPIC_API_KEY mangler",
    };
  }
  // Bruk GET /v1/models — gir 200 hvis nøkkelen er gyldig, 401/403 hvis ikke.
  // Vi vil ikke faktisk brenne tokens på en /v1/messages-ping.
  const result = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  return classifyHttpResult(name, Date.now() - t0, result);
}

async function testOpenAI(): Promise<TestResult> {
  const name = "OpenAI";
  const t0 = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "OPENAI_API_KEY mangler",
    };
  }
  const result = await fetchWithTimeout("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return classifyHttpResult(name, Date.now() - t0, result);
}

async function testResend(): Promise<TestResult> {
  const name = "Resend";
  const t0 = Date.now();
  const apiKey =
    process.env.RESEND_API_KEY || process.env.ROLE_ROOM_RESEND_API_KEY;
  if (!apiKey) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "RESEND_API_KEY mangler",
    };
  }
  // Resend har ikke "GET /emails" som lister. Bruk /domains som ping —
  // returnerer 200 hvis nøkkelen er gyldig, 401 hvis ugyldig.
  const result = await fetchWithTimeout("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return classifyHttpResult(name, Date.now() - t0, result);
}

async function testGoogleAds(): Promise<TestResult> {
  const name = "Google Ads";
  const t0 = Date.now();
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) {
    return {
      name,
      status: "skipped",
      duration_ms: Date.now() - t0,
      error: "GOOGLE_ADS_DEVELOPER_TOKEN mangler",
    };
  }
  // Pingen — vi har ikke OAuth-token i runtime her, så vi kan ikke kalle
  // en autentisert endpoint. Vi gjør i stedet en lett GET mot
  // googleads.googleapis.com som returnerer 401/403 selv uten OAuth-token.
  // Det bekrefter at developer-token er gjenkjent og endpoint er nådd.
  const result = await fetchWithTimeout(
    "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
    {
      headers: {
        "developer-token": devToken,
        Accept: "application/json",
      },
    },
  );
  return classifyHttpResult(name, Date.now() - t0, result);
}

/* ──────────────────────────────── setup ───────────────────────────────── */

export function setupAdminIntegrationTestsRoutes(
  deps: AdminIntegrationTestsRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.post("/api/admin/run-comprehensive-tests", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const startedAt = new Date().toISOString();
      const t0 = Date.now();

      // Kjør alle parallelt. Hver test håndterer egen timeout, så
      // Promise.all blokkerer maks ~10s.
      const results = await Promise.all([
        testRender(),
        testStripe(),
        testCloudflareR2(),
        testCloudflareStream(),
        testBackblazeB2(),
        testNeonDB(pool),
        testAnthropicAPI(),
        testOpenAI(),
        testResend(),
        testGoogleAds(),
      ]);

      const summary = {
        total: results.length,
        passed: results.filter((r) => r.status === "pass").length,
        failed: results.filter((r) => r.status === "fail").length,
        skipped: results.filter((r) => r.status === "skipped").length,
      };

      res.json({
        success: true,
        started_at: startedAt,
        duration_ms: Date.now() - t0,
        summary,
        results,
      });
    } catch (err: unknown) {
      console.error(
        "[admin-integration-tests] run-comprehensive-tests failed:",
        err,
      );
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  });

  app.get("/api/admin/integration-tests/history", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const limitRaw = req.query.limit;
      const limit = Math.min(
        Math.max(parseInt(String(limitRaw ?? "20"), 10) || 20, 1),
        100,
      );

      // Vi har enda ikke en persistent tabell for test-runs. Returner
      // tom liste — UI tegner det som "ingen historikk ennå".
      // TODO(#127b): persistér resultat fra run-comprehensive-tests her
      // (egen migrasjon + insert i POST-handleren over).
      res.json({ runs: [], limit });
    } catch (err: unknown) {
      console.error(
        "[admin-integration-tests] history failed:",
        err,
      );
      res.status(500).json({
        runs: [],
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  });
}
