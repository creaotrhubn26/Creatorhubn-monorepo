import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

export const LEADGRID_DEFAULT_JSON_LIMIT = "2mb";
export const LEADGRID_PUBLIC_AUTH_JSON_LIMIT = "16kb";
export const LEADGRID_FORM_LIMIT = "32kb";
export const LEADGRID_CANVAS_JSON_LIMIT = "36mb";
export const LEADGRID_AUDIO_JSON_LIMIT = "46mb";
export const LEADGRID_MAX_CONCURRENT_LARGE_BODIES = 2;

type LeadgridBodyClass = "default" | "publicAuth" | "canvas" | "audio";

type SessionResolver = (request: Request) => Promise<unknown | null>;

export type LeadgridBodyParserBoundaryOptions = {
  resolveSession: SessionResolver;
  maxConcurrentLargeBodies?: number;
  parsers?: Partial<Record<LeadgridBodyClass | "form", RequestHandler>>;
};

// Express' JSON/urlencoded parsers do not limit themselves to write verbs. A
// hostile GET/HEAD carrying a body would therefore still reach the legacy
// 50 MB parser unless these methods pass through the same early envelope.
const BODY_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const JSON_TYPES = ["application/json", "application/*+json"];

function requestPath(request: Request): string {
  try {
    return new URL(
      request.originalUrl || request.url || "/",
      "http://leadgrid.local",
    ).pathname.replace(/\/{2,}/gu, "/");
  } catch {
    return request.path;
  }
}

export function classifyLeadgridJsonBody(
  method: string,
  pathname: string,
): LeadgridBodyClass {
  const normalizedMethod = method.trim().toUpperCase();
  if (
    normalizedMethod === "POST" &&
    (
      pathname === "/api/leadgrid/self-onboard" ||
      pathname === "/api/leadgrid/self-onboard/consume-magic" ||
      pathname === "/api/ipad-tokens/exchange"
    )
  ) {
    return "publicAuth";
  }
  if (
    (normalizedMethod === "POST" && pathname === "/api/leadgrid/canvas") ||
    (normalizedMethod === "PUT" &&
      /^\/api\/leadgrid\/canvas\/[^/]+$/.test(pathname)) ||
    (normalizedMethod === "POST" &&
      /^\/api\/leadgrid\/canvas\/[^/]+\/dokumenter$/.test(pathname))
  ) {
    return "canvas";
  }

  // The sole documented large JSON route in the native LeadMap namespace is
  // a base64 pitch-deck mockup (6 MB decoded). It is mounted behind the
  // authoritative pre-body guard and uses the bounded Canvas-sized parser.
  if (
    normalizedMethod === "POST" &&
    /^\/api\/admin-room\/lead-map\/pitch-deck\/slides\/[^/]+\/mockup$/.test(
      pathname,
    )
  ) {
    return "canvas";
  }

  if (
    normalizedMethod === "POST" &&
    /^\/api\/leadgrid\/leads\/[^/]+\/meeting-notes\/upload-audio$/.test(
      pathname,
    )
  ) {
    return "audio";
  }

  return "default";
}

function isJsonRequest(request: Request): boolean {
  return Boolean(request.is(JSON_TYPES));
}

function isFormRequest(request: Request): boolean {
  return Boolean(request.is("application/x-www-form-urlencoded"));
}

function sendBodyParserError(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  const bodyError = error as { status?: unknown; type?: unknown };
  if (bodyError.status === 413 || bodyError.type === "entity.too.large") {
    response.status(413).json({ error: "request_body_too_large" });
    return;
  }
  if (bodyError.status === 400 || bodyError.type === "entity.parse.failed") {
    response.status(400).json({ error: "invalid_request_body" });
    return;
  }
  next(error);
}

/**
 * Parses every Leadgrid JSON/form body before the repository-wide 50 MB
 * parser. Ordinary and unknown Leadgrid routes are capped at 2 MB, including
 * chunked requests. The few documented large JSON routes require a real
 * session before any body bytes are buffered and share a small process-wide
 * parsing concurrency budget.
 */
export function createLeadgridBodyParserBoundary(
  options: LeadgridBodyParserBoundaryOptions,
): RequestHandler {
  const parsers = {
    default:
      options.parsers?.default ??
      express.json({
        limit: LEADGRID_DEFAULT_JSON_LIMIT,
        strict: true,
        type: JSON_TYPES,
      }),
    publicAuth:
      options.parsers?.publicAuth ??
      express.json({
        limit: LEADGRID_PUBLIC_AUTH_JSON_LIMIT,
        strict: true,
        type: JSON_TYPES,
      }),
    canvas:
      options.parsers?.canvas ??
      express.json({
        limit: LEADGRID_CANVAS_JSON_LIMIT,
        strict: true,
        type: JSON_TYPES,
      }),
    audio:
      options.parsers?.audio ??
      express.json({
        limit: LEADGRID_AUDIO_JSON_LIMIT,
        strict: true,
        type: JSON_TYPES,
      }),
    form:
      options.parsers?.form ??
      express.urlencoded({
        limit: LEADGRID_FORM_LIMIT,
        extended: false,
        type: "application/x-www-form-urlencoded",
      }),
  };
  const maxConcurrentLargeBodies = Math.max(
    1,
    options.maxConcurrentLargeBodies ?? LEADGRID_MAX_CONCURRENT_LARGE_BODIES,
  );
  let activeLargeBodyParsers = 0;

  const runParser = (
    parser: RequestHandler,
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    parser(request, response, (error?: unknown) => {
      if (error) {
        sendBodyParserError(error, request, response, next);
        return;
      }
      next();
    });
  };

  return async (request, response, next) => {
    if (!BODY_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const pathname = requestPath(request);
    const bodyClass = classifyLeadgridJsonBody(request.method, pathname);
    if (bodyClass === "publicAuth" && !isJsonRequest(request)) {
      response
        .status(415)
        .setHeader("Referrer-Policy", "no-referrer")
        .json({ error: "content_type_must_be_json" });
      return;
    }

    if (isFormRequest(request)) {
      runParser(parsers.form, request, response, next);
      return;
    }
    if (!isJsonRequest(request)) {
      next();
      return;
    }

    if (bodyClass === "default" || bodyClass === "publicAuth") {
      runParser(parsers[bodyClass], request, response, next);
      return;
    }

    if (activeLargeBodyParsers >= maxConcurrentLargeBodies) {
      response
        .status(503)
        .setHeader("Retry-After", "1")
        .json({ error: "large_body_capacity_reached" });
      return;
    }

    // Reserve synchronously before the session lookup. Otherwise two requests
    // can both observe spare capacity, await authentication, and then start
    // parsing even when the configured limit is one.
    activeLargeBodyParsers += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeLargeBodyParsers = Math.max(0, activeLargeBodyParsers - 1);
      request.off("aborted", release);
      response.off("close", release);
    };
    request.once("aborted", release);
    response.once("close", release);

    try {
      const session = await options.resolveSession(request);
      if (!session) {
        release();
        response.status(401).json({ error: "authentication_required" });
        return;
      }
    } catch {
      release();
      response.status(503).json({ error: "session_store_unavailable" });
      return;
    }

    if (request.aborted || response.destroyed || response.writableEnded) {
      release();
      return;
    }

    const parser = parsers[bodyClass];
    parser(request, response, (error?: unknown) => {
      release();
      if (error) {
        sendBodyParserError(error, request, response, next);
        return;
      }
      next();
    });
  };
}
