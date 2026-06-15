/**
 * installFrontendErrorReporter.ts
 *
 * Fanger frontend JS-errors (window.onerror, unhandledrejection) og sender
 * dem til backend /api/admin-room/errors. Vises i Admin Room
 * Observability-tab.
 *
 * Sentry-erstatning på frontend-side. Bruker eksisterende auth-token hvis
 * tilgjengelig så vi vet hvem som opplevde feilen.
 *
 * Inkluderer Clarity-session-ID som lenke til skjerm-replay (når Clarity
 * er lastet).
 */

declare global {
  interface Window {
    clarity?: { (action: string, ...args: unknown[]): void };
  }
}

const ENDPOINT = "/api/admin-room/errors";
const RATE_LIMIT_MS = 5_000;
const lastSent = new Map<string, number>();
const MAX_QUEUE = 20;
let installed = false;

function getClaritySessionId(): string | undefined {
  try {
    if (typeof window === "undefined" || typeof window.clarity !== "function") {
      return undefined;
    }
    // Clarity har ikke et offentlig getSessionId() API, men sessionId kan
    // hentes fra cookies _clck/_clsk
    const cookies = document.cookie.split(";").reduce<Record<string, string>>((acc, c) => {
      const [k, v] = c.trim().split("=");
      acc[k] = v;
      return acc;
    }, {});
    return cookies._clsk?.split("|")[0] ?? cookies._clck?.split("|")[0] ?? undefined;
  } catch {
    return undefined;
  }
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem("creatorhub_auth_token");
  } catch {
    return null;
  }
}

function fingerprint(message: string, stack?: string): string {
  return `${message}|${stack?.split("\n")[0] ?? ""}`.slice(0, 200);
}

async function reportError(payload: {
  message: string;
  stack?: string;
  errorName?: string;
  url?: string;
  level?: "error" | "warning";
  meta?: Record<string, unknown>;
}): Promise<void> {
  const fp = fingerprint(payload.message, payload.stack);
  const last = lastSent.get(fp) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) return;
  lastSent.set(fp, Date.now());

  if (lastSent.size > MAX_QUEUE) {
    // Trim eldste entries så Map ikke vokser endeløs
    const oldest = Array.from(lastSent.entries()).sort((a, b) => a[1] - b[1])[0];
    if (oldest) lastSent.delete(oldest[0]);
  }

  try {
    const token = getAuthToken();
    const claritySessionId = getClaritySessionId();
    await fetch(ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: payload.message,
        stack: payload.stack,
        errorName: payload.errorName,
        url: payload.url ?? window.location.href,
        claritySessionId,
        level: payload.level ?? "error",
        meta: {
          ...payload.meta,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      }),
      // Bruke keepalive for at requesten fortsetter selv om brukeren
      // navigerer bort (vanlig ved unhandled errors).
      keepalive: true,
    });
  } catch {
    // never throw — vi vil ikke skape feedback-loop
  }
}

/**
 * Installer global error-handlers. Idempotent.
 */
export function installFrontendErrorReporter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 1) Synkron exceptions
  window.addEventListener("error", (event) => {
    if (!event.error && !event.message) return;
    const err = event.error as Error | undefined;
    void reportError({
      message: err?.message ?? event.message ?? "Unknown error",
      stack: err?.stack,
      errorName: err?.name,
      meta: {
        kind: "window.error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // 2) Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : null;
    void reportError({
      message: err?.message ?? String(reason) ?? "Unhandled promise rejection",
      stack: err?.stack,
      errorName: err?.name ?? "UnhandledRejection",
      meta: { kind: "unhandledrejection" },
    });
  });

  // 3) Console.error capture (valgfritt — fanger React-warnings og lignende)
  // Vi gjør dette ikke som standard for å unngå overflod.
}

/** Manuell rapport — for å logge handled errors fra try/catch i komponenter. */
export function reportHandledError(
  error: Error,
  context?: { component?: string; action?: string; extra?: Record<string, unknown> },
): void {
  void reportError({
    message: error.message,
    stack: error.stack,
    errorName: error.name,
    level: "error",
    meta: { kind: "handled", ...context },
  });
}
