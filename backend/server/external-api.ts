/**
 * external-api.ts
 *
 * Delt wrapper for eksterne HTTP-kall (Google Ads, Search Console, GA4,
 * GTM, site-verification, …) — CTO-audit P1 (06-security-and-secrets-
 * report.md): Places-integrasjonen hadde allerede timeout+catch+null-
 * mønsteret, men Ads/Search Console-kallene manglet timeout, så en hengende
 * request kunne blokkere en route-handler på ubestemt tid.
 *
 * To nivåer:
 *
 *   externalFetch(url, init) — drop-in for fetch() som alltid har en
 *     timeout (default 12s, samme som Places-malen). Kaster som fetch
 *     (TimeoutError ved timeout), så eksisterende try/catch-håndtering på
 *     kall-stedene fungerer uendret — forskjellen er at "henger evig" blir
 *     "feiler etter 12s". Respekterer caller-supplied `signal`.
 *
 *   callExternalApi(url, opts) — for nye kall-steder: kaster ALDRI.
 *     Typed success/failure-resultat, JSON-parsing, valgfri retry med
 *     backoff på 429/5xx/nettverksfeil. Bruk denne når svaret skal
 *     behandles som "best effort / partial failure" i UI-et.
 */

export const DEFAULT_EXTERNAL_TIMEOUT_MS = 12_000;

interface ExternalFetchInit extends RequestInit {
  /** Overstyr default-timeouten (12s). Ignoreres hvis `signal` er satt. */
  timeoutMs?: number;
}

/**
 * fetch() med garantert timeout. Kaster som fetch — bruk der eksisterende
 * feilhåndtering allerede finnes rundt kallet.
 */
export function externalFetch(
  url: string | URL,
  init: ExternalFetchInit = {},
): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init;
  return fetch(url, {
    ...rest,
    signal: signal ?? AbortSignal.timeout(timeoutMs ?? DEFAULT_EXTERNAL_TIMEOUT_MS),
  });
}

export type ExternalApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; error: string; timedOut: boolean };

export interface CallExternalApiOptions extends ExternalFetchInit {
  /** Antall retries på 429/5xx/nettverksfeil (default 0 — som Places). */
  retries?: number;
  /** Base-delay for eksponentiell backoff (default 500ms). */
  retryDelayMs?: number;
  /** Merkelapp for logglinjer, f.eks. "google-ads". */
  label?: string;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Kast-fritt eksternt API-kall med JSON-parsing og valgfri retry/backoff.
 * Feil logges (status/label, aldri tokens eller payload) og returneres som
 * typed failure — kall-stedet bestemmer om det er en partial failure eller
 * en hard stopp.
 */
export async function callExternalApi<T = unknown>(
  url: string | URL,
  options: CallExternalApiOptions = {},
): Promise<ExternalApiResult<T>> {
  const { retries = 0, retryDelayMs = 500, label = "external-api", ...init } = options;

  let lastError = "unknown_error";
  let lastStatus: number | null = null;
  let timedOut = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs * 2 ** (attempt - 1));

    try {
      const response = await externalFetch(url, init);
      lastStatus = response.status;

      if (response.ok) {
        const data = (await response.json().catch(() => null)) as T | null;
        if (data === null) {
          lastError = "invalid_json";
          break; // Ikke-retryable — 2xx med ubrukelig body
        }
        return { ok: true, status: response.status, data };
      }

      lastError = `http_${response.status}`;
      // Les bort body så connection frigjøres; innholdet logges ikke.
      await response.arrayBuffer().catch(() => undefined);
      if (!isRetryableStatus(response.status)) break;
    } catch (err) {
      timedOut = err instanceof Error && err.name === "TimeoutError";
      lastError = timedOut ? "timeout" : "network_error";
      lastStatus = null;
    }
  }

  console.warn(`[${label}] external call failed: ${lastError} status=${lastStatus ?? "-"} url=${new URL(url).pathname}`);
  return { ok: false, status: lastStatus, error: lastError, timedOut };
}
