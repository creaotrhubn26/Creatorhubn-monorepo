/**
 * indexnow.ts — F6 «submit_indexnow» (doc 14, del 2)
 *
 * IndexNow er den eneste søke-innmeldingen som kan automatiseres HELT uten
 * klient-OAuth: en selvhostet nøkkelfil (https://<host>/<key>.txt med
 * nøkkelen som innhold) beviser eierskap, og URL-er meldes inn med POST til
 * api.indexnow.org. Bing (= ChatGPT-søkeindeksen) konsumerer IndexNow.
 *
 * Nøkkelen er IKKE en hemmelighet — den ER offentlig hostet by design, og
 * kan trygt ligge i repoet. Samme nøkkelfil servert på flere av våre
 * domener er gyldig for alle (verifiseringen er per host-rot).
 *
 * Ren buildIndexNowPayload (enhetstestet) + tynn submit med injiserbar
 * fetcher. Innsending har ekstern effekt → alltid bak eksplisitt
 * brukerhandling (knapp/confirm), aldri automatisk fra agenten.
 */

import { callExternalApi } from "../external-api.js";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_MAX_URLS = 100;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export function buildIndexNowPayload(input: {
  host: string;
  key: string;
  urls: string[];
}): { ok: true; payload: IndexNowPayload } | { ok: false; error: string } {
  const host = input.host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    return { ok: false, error: "ugyldig_host" };
  }
  if (!/^[a-f0-9]{16,64}$/i.test(input.key.trim())) {
    return { ok: false, error: "ugyldig_nokkel" };
  }
  const key = input.key.trim();

  const urlList: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { ok: false, error: `ugyldig_url: ${trimmed.slice(0, 80)}` };
    }
    if (url.protocol !== "https:") return { ok: false, error: `kun_https: ${trimmed.slice(0, 80)}` };
    // IndexNow krever at alle URL-er tilhører hosten nøkkelen beviser
    // eierskap for — feil host avvises av API-et, så vi stopper det her.
    if (url.hostname.toLowerCase() !== host && url.hostname.toLowerCase() !== `www.${host}`) {
      return { ok: false, error: `feil_host: ${url.hostname}` };
    }
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urlList.push(normalized);
  }
  if (urlList.length === 0) return { ok: false, error: "ingen_urler" };
  if (urlList.length > INDEXNOW_MAX_URLS) {
    return { ok: false, error: `maks_${INDEXNOW_MAX_URLS}_urler` };
  }

  return {
    ok: true,
    payload: { host, key, keyLocation: `https://${host}/${key}.txt`, urlList },
  };
}

export interface IndexNowSubmitResult {
  ok: boolean;
  status: number | null;
  detail: string;
}

/** 200 = mottatt, 202 = mottatt (nøkkel valideres async). Alt annet = feil. */
export async function submitIndexNow(
  payload: IndexNowPayload,
  poster: (url: string, body: string) => Promise<{ ok: boolean; status: number | null; error?: string }> = defaultPoster,
): Promise<IndexNowSubmitResult> {
  const result = await poster(INDEXNOW_ENDPOINT, JSON.stringify(payload));
  if (result.ok || result.status === 202) {
    return {
      ok: true,
      status: result.status,
      detail:
        result.status === 202
          ? "Mottatt (202) — nøkkelfilen valideres asynkront; sjekk at den er live på keyLocation."
          : "Mottatt (200).",
    };
  }
  const known: Record<number, string> = {
    400: "Ugyldig format i innsendingen.",
    403: "Nøkkelfilen ble ikke funnet/validert på keyLocation — sjekk at den er deployet og svarer 200.",
    422: "URL-ene tilhører ikke hosten, eller nøkkelen stemmer ikke med filen.",
    429: "For mange innsendinger — vent og prøv igjen.",
  };
  return {
    ok: false,
    status: result.status,
    detail: known[result.status ?? 0] ?? result.error ?? `Uventet svar (HTTP ${result.status ?? "—"}).`,
  };
}

async function defaultPoster(
  url: string,
  body: string,
): Promise<{ ok: boolean; status: number | null; error?: string }> {
  const r = await callExternalApi<unknown>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body,
    timeoutMs: 15_000,
    label: "indexnow-submit",
  });
  return r.ok
    ? { ok: true, status: r.status }
    : { ok: false, status: r.status, error: r.error };
}
