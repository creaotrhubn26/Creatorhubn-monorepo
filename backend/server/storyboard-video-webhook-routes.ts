import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import type { Pool } from "pg";
import {
  acceptStoryboardVideoHiggsfieldWebhook,
  StoryboardVideoError,
} from "./storyboard-ai-video-service.js";

const WEBHOOK_BODY_LIMIT = "256kb";
const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_MAX_REQUESTS = 120;
const DEFAULT_MAX_TRACKED_CLIENTS = 1_024;

interface WebhookRateBucket {
  count: number;
  resetAt: number;
}

export interface StoryboardVideoWebhookRouterOptions {
  now?: () => number;
  rateWindowMs?: number;
  rateMaxRequests?: number;
  maxTrackedClients?: number;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value as number)));
}

function bodyParserStatus(error: unknown): { status?: number; type?: string } {
  return error && typeof error === "object"
    ? error as { status?: number; type?: string }
    : {};
}

/**
 * Public provider callback router. It must be mounted before the application's
 * global 50 MB JSON parser so untrusted callback bodies are capped while they
 * are streamed, rather than after a large allocation has already happened.
 */
export function createStoryboardVideoWebhookRouter(
  pool: Pool,
  options: StoryboardVideoWebhookRouterOptions = {},
): ExpressRouter {
  const router = Router();
  const now = options.now ?? Date.now;
  const rateWindowMs = boundedInteger(
    options.rateWindowMs,
    DEFAULT_RATE_WINDOW_MS,
    1_000,
    60 * 60_000,
  );
  const rateMaxRequests = boundedInteger(
    options.rateMaxRequests,
    DEFAULT_RATE_MAX_REQUESTS,
    1,
    10_000,
  );
  const maxTrackedClients = boundedInteger(
    options.maxTrackedClients,
    DEFAULT_MAX_TRACKED_CLIENTS,
    16,
    16_384,
  );
  const buckets = new Map<string, WebhookRateBucket>();

  const rateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const currentTime = now();
    // Do not consume X-Forwarded-For without an explicit trusted-proxy
    // contract. The direct peer is the only non-spoofable key available here.
    const clientKey = String(req.socket.remoteAddress ?? "unknown").slice(0, 128);
    let bucket = buckets.get(clientKey);
    if (!bucket || bucket.resetAt <= currentTime) {
      if (!bucket && buckets.size >= maxTrackedClients) {
        for (const [key, candidate] of buckets) {
          if (candidate.resetAt <= currentTime) buckets.delete(key);
        }
        if (buckets.size >= maxTrackedClients) {
          const oldestKey = buckets.keys().next().value as string | undefined;
          if (oldestKey) buckets.delete(oldestKey);
        }
      }
      bucket = { count: 0, resetAt: currentTime + rateWindowMs };
      buckets.set(clientKey, bucket);
    }
    if (bucket.count >= rateMaxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - currentTime) / 1_000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    bucket.count += 1;
    next();
  };

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Higgsfield documents no callback signature. The high-entropy path token
  // identifies the local job, but the payload only wakes an authenticated
  // provider status GET; it never mutates terminal business state directly.
  router.post(
    "/higgsfield/:token",
    rateLimit,
    (req, res, next) => {
      if (!/^[0-9a-f]{64}$/.test(String(req.params.token ?? ""))) {
        res.status(404).json({ error: "webhook_not_found" });
        return;
      }
      next();
    },
    express.json({ limit: WEBHOOK_BODY_LIMIT, strict: true }),
    async (req, res) => {
      try {
        const accepted = await acceptStoryboardVideoHiggsfieldWebhook(pool, {
          token: String(req.params.token),
          body: req.body,
        });
        res.status(202).json({ success: true, data: accepted });
      } catch (error) {
        if (error instanceof StoryboardVideoError) {
          res.status(error.status).json({
            error: error.code,
            detail: error.safeDetail,
          });
          return;
        }
        res.status(503).json({
          error: "webhook_persist_failed",
          detail: "Webhooken kunne ikke lagres sikkert.",
        });
      }
    },
  );

  // This prefix is public and mounted before the application's large parsers.
  // Consume every non-contract method/path here so it can never fall through
  // and be allocated by the global 50 MB body parser.
  router.use((_req, res) => {
    res.status(404).json({ error: "webhook_not_found" });
  });

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    const parsed = bodyParserStatus(error);
    if (parsed.status === 413 || parsed.type === "entity.too.large") {
      res.status(413).json({ error: "webhook_payload_too_large" });
      return;
    }
    if (parsed.status === 400 || parsed.type === "entity.parse.failed") {
      res.status(400).json({ error: "invalid_webhook_json" });
      return;
    }
    next(error);
  });

  return router;
}
