/**
 * meta-graph-version.ts
 *
 * ÉN Graph API-versjon for hele kodebasen.
 *
 * Før denne filen lå versjonen tre steder samtidig:
 *   v21.0  Instagram, Pages, ads, innsikt — 27 filer, de fleste hardkodet
 *   v22.0  WhatsApp Cloud API — fem filer, hver med sin egen lokale konstant
 *   v18.0  meta-conversions-api.ts, altså CAPI-en som er LIVE for
 *          creatorhubn.com og theroleroom.com
 *
 * v18.0 er fra 2023. Meta holder en versjon i om lag to år, så det kallet
 * hadde passert vinduet sitt. Det er den typen ting som ikke feiler høylytt:
 * Meta svarer fortsatt, bare på en versjon ingen lenger har testet mot.
 *
 * Gjeldende versjon er verifisert mot
 * https://developers.facebook.com/docs/marketing-api/overview/versioning
 * (hentet via context7 2026-09-18), som viser v25.0.
 *
 * META_GRAPH_API_VERSION kan overstyres med env-var. Det er ikke konfigurasjon
 * for konfigurasjonens skyld: viser en oppgradering seg å brekke noe i
 * produksjon, er rullebakken én env-var i stedet for en ny deploy.
 */

const DEFAULT_VERSION = "v25.0";

function resolveVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim();
  // En feilskrevet env-var skal ikke gi «https://graph.facebook.com//me».
  if (raw && /^v\d+\.\d+$/.test(raw)) return raw;
  if (raw) {
    console.warn(
      `[meta-graph-version] META_GRAPH_API_VERSION="${raw}" er ikke på formen vN.N. Bruker ${DEFAULT_VERSION}.`,
    );
  }
  return DEFAULT_VERSION;
}

export const META_GRAPH_API_VERSION = resolveVersion();

/** `https://graph.facebook.com/vN.N` — for Graph-kall. */
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

/** `https://www.facebook.com/vN.N` — for OAuth-dialogen, annen vert. */
export const META_WWW_BASE = `https://www.facebook.com/${META_GRAPH_API_VERSION}`;
