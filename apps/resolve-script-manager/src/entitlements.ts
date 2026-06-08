/**
 * entitlements.ts
 *
 * Per-modul tilgangskontroll for Post Agent. Speiler auth-mønsteret
 * (modul-cache + 'trrpa:*'-event) slik at hvilken som helst komponent kan
 * lese hvilke moduler brukeren har kjøpt uten prop-drilling.
 *
 * Backend: GET /api/post-agent/modules/entitlements (krever Bearer).
 * Modulene selges à la carte i Marketplace; appen låser opp runtime.
 */

import { loadSettings } from "./components/SettingsModal";

export type PostAgentModule = "demo_studio" | "marketing" | "capture" | "resolve";

export const MODULE_LABELS: Record<PostAgentModule, string> = {
  demo_studio: "Demo Studio",
  marketing: "Marketing",
  capture: "Capture & iPad",
  resolve: "Resolve-bro",
};

export const MODULE_PRICE_NOK: Record<PostAgentModule, number> = {
  demo_studio: 199,
  marketing: 199,
  capture: 399,
  resolve: 149,
};

const ENTITLEMENTS_CHANGED_EVENT = "trrpa:entitlements-changed";

let cachedModules: PostAgentModule[] = [];
let lastFetchedAt = 0;

function baseUrl(): string {
  const s = loadSettings();
  return (s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent").replace(/\/$/, "");
}

function marketplaceOrigin(): string {
  // Strip /api/post-agent → naken origin for marketplace-lenke.
  return baseUrl().replace(/\/api\/post-agent\/?$/, "");
}

/** Synkron lesing av cachede moduler (oppdateres av refreshEntitlements). */
export function getEntitledModules(): PostAgentModule[] {
  return cachedModules;
}

export function hasModule(module: PostAgentModule): boolean {
  return cachedModules.includes(module);
}

/** Har brukeren minst én modul? (Brukes til nedlasting-gate.) */
export function hasAnyModule(): boolean {
  return cachedModules.length > 0;
}

export function lastEntitlementFetch(): number {
  return lastFetchedAt;
}

/**
 * Hent entitlements fra backend. Tom token → tøm cache. Nettverksfeil →
 * behold forrige cache (ikke lås ut brukeren ved et blip). Fyrer
 * 'trrpa:entitlements-changed' så abonnenter re-rendrer.
 */
export async function refreshEntitlements(): Promise<PostAgentModule[]> {
  const s = loadSettings();
  const token = s.RR_BEARER_TOKEN?.trim();
  if (!token) {
    cachedModules = [];
    lastFetchedAt = Date.now();
    emitChanged();
    return cachedModules;
  }
  try {
    const res = await fetch(`${baseUrl()}/modules/entitlements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { modules?: string[] };
      const valid = (data.modules ?? []).filter(
        (m): m is PostAgentModule => m in MODULE_LABELS,
      );
      cachedModules = valid;
      lastFetchedAt = Date.now();
      emitChanged();
    } else if (res.status === 401 || res.status === 403) {
      // Token ugyldig → ingen moduler.
      cachedModules = [];
      lastFetchedAt = Date.now();
      emitChanged();
    }
    // Andre statuser: behold forrige cache.
  } catch {
    // Nettverksfeil — behold forrige cache (ikke degrader tilgang på blip).
  }
  return cachedModules;
}

function emitChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(ENTITLEMENTS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Abonner på endringer. Returnerer unsubscribe. */
export function onEntitlementsChanged(handler: () => void): () => void {
  window.addEventListener(ENTITLEMENTS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(ENTITLEMENTS_CHANGED_EVENT, handler);
}

/** Åpne Marketplace-siden for å kjøpe en modul (i nettleser). */
export async function openModulePurchase(module?: PostAgentModule): Promise<void> {
  const url = `${marketplaceOrigin()}/marketplace/post-agent${module ? `?module=${module}` : ""}`;
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    try {
      window.open(url, "_blank");
    } catch {
      /* ignore */
    }
  }
}
