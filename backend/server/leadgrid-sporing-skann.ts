/**
 * leadgrid-sporing-skann.ts
 *
 * Finn ut hva som faktisk er satt opp av sporing på et nettsted, i stedet
 * for å be kunden skrive inn GTM-ID-en sin fra hukommelsen.
 *
 * Hvorfor dette er mer enn et regex-søk i HTML:
 *
 *   De fleste nettsteder laster pixlene INNE I GTM-containeren. Henter du
 *   bare sidekilden, ser du GTM-taggen og ingenting annet — og konkluderer
 *   feilaktig med at Meta-pixelen mangler. Derfor henter vi også selve
 *   containeren fra googletagmanager.com, som er offentlig, og leser hvilke
 *   tagger den er konfigurert med.
 *
 *   Det som fortsatt ikke kan ses: tagger som først utløses på en handling
 *   (skjema sendt, knapp trykket), og alt som lastes av annen JavaScript
 *   etter at siden har kjørt en stund. Skannet sier derfor hvor funnet kom
 *   fra — `sidekilde` eller `gtm_container` — så ingen tror fraværet av et
 *   funn er det samme som at sporingen mangler.
 *
 * All henting går gjennom ssrf-guard.ts. Et endepunkt som henter en URL
 * brukeren oppgir, er ellers en rett vei inn i interne tjenester.
 */

import { ssrfSafeFetch } from "./ssrf-guard.js";

export type SporingsType =
  | "gtm"
  | "ga4"
  | "meta_pixel"
  | "tiktok_pixel"
  | "google_ads"
  | "linkedin_insight"
  | "clarity";

export interface SporingsFunn {
  type: SporingsType;
  id: string;
  /** Hvor funnet ble gjort. Avgjør hvor mye vekt det skal ha. */
  funnet_i: "sidekilde" | "gtm_container";
  /**
   * `bekreftet` = funnet der skriptet faktisk lastes (fbq('init','...'),
   * gtm.js?id=..., clarity.ms/tag/...). Da VET vi at det er i bruk.
   *
   * `antatt` = funnet i en variabel som bærer ID-en videre. Dette er ikke en
   * kuriositet: consent-gatede og fler-merkevare-oppsett gjør det alltid slik,
   * og leadgrid.no er selv et av dem. Et skann som bare så etter literaler,
   * meldte at Meta-pixelen manglet — den var der hele tiden.
   */
  sikkerhet: "bekreftet" | "antatt";
  /**
   * Variabelnavnet ID-en sto i, når den ble funnet i en variabel.
   * Et fler-merkevare-oppsett legger alle merkenes ID-er i samme fil —
   * leadgrid.no har tre av hver. Navnet er det eneste i sidekilden som sier
   * hvilken som hører til hvilket domene, så importen kan foreslå riktig
   * i stedet for å be noen gjette.
   */
  kontekst?: string;
  /**
   * Sant når variabelnavnet peker på domenet vi skannet — «LEADGRID_...» på
   * leadgrid.no. Da slipper den som importerer å slå opp hvilken av tre
   * ID-er som er sin. Det er en anbefaling, ikke en konklusjon: står det
   * ingenting i navnet, blir feltet usant og valget må tas manuelt.
   */
  anbefalt?: boolean;
}

/**
 * Ord fra vertsnavnet som kan gjenkjennes i et variabelnavn.
 * leadgrid.no -> ["LEADGRID"]; min-butikk.no -> ["MINBUTIKK","MIN","BUTIKK"].
 */
export function domeneOrd(hostname: string): string[] {
  const bare = hostname.toLowerCase().replace(/^www\./, "").split(".")[0] ?? "";
  const deler = bare.split(/[-_]/).filter((d) => d.length >= 3);
  const ord = new Set<string>([bare.replace(/[-_]/g, ""), ...deler]);
  return [...ord].filter(Boolean).map((o) => o.toUpperCase());
}

/**
 * Mønstrene. Hver av dem er bundet til hvordan skriptet FAKTISK lastes, ikke
 * bare til at tallet finnes et sted på siden — en ID-lignende streng i en
 * artikkeltekst skal ikke bli til en pixel.
 */
const MØNSTRE: Array<{ type: SporingsType; re: RegExp; sikkerhet: SporingsFunn["sikkerhet"] }> = [
  // ── Bekreftet: ID-en står der skriptet faktisk lastes ──────────────────
  { type: "gtm", re: /googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]{4,10})/g, sikkerhet: "bekreftet" },
  { type: "ga4", re: /gtag\/js\?id=(G-[A-Z0-9]{8,12})/g, sikkerhet: "bekreftet" },
  { type: "ga4", re: /gtag\s*\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]{8,12})['"]/g, sikkerhet: "bekreftet" },
  { type: "google_ads", re: /gtag\s*\(\s*['"]config['"]\s*,\s*['"](AW-\d{9,12})['"]/g, sikkerhet: "bekreftet" },
  { type: "meta_pixel", re: /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{12,17})['"]/g, sikkerhet: "bekreftet" },
  { type: "tiktok_pixel", re: /ttq\s*\.\s*load\s*\(\s*['"]([A-Z0-9]{15,25})['"]/g, sikkerhet: "bekreftet" },
  { type: "linkedin_insight", re: /_linkedin_partner_id\s*=\s*['"]?(\d{4,12})['"]?/g, sikkerhet: "bekreftet" },
  { type: "clarity", re: /clarity\.ms\/tag\/([a-z0-9]{8,15})/g, sikkerhet: "bekreftet" },

  // ── Antatt: ID-en ligger i en variabel som bærer den videre ────────────
  // Uten disse melder skannet «ingen Meta-pixel» på ethvert consent-gatet
  // eller fler-merkevare-oppsett. leadgrid.no er selv et slikt: pixelen
  // settes som LEADGRID_META_PIXEL_ID og sendes til fbq() først ved samtykke.
  { type: "gtm", re: /[A-Z_]*(?:TAG_MANAGER|GTM)[A-Z_]*\s*[:=]\s*['"](GTM-[A-Z0-9]{4,10})['"]/g, sikkerhet: "antatt" },
  { type: "ga4", re: /[A-Z_]*(?:GA_MEASUREMENT|MEASUREMENT_ID)[A-Z_]*\s*[:=]\s*['"](G-[A-Z0-9]{8,12})['"]/g, sikkerhet: "antatt" },
  { type: "meta_pixel", re: /[A-Za-z_]*(?:META_PIXEL|FB_PIXEL|metaPixel|fbPixel)[A-Za-z_]*\s*[:=]\s*['"](\d{12,17})['"]/g, sikkerhet: "antatt" },
  { type: "tiktok_pixel", re: /[A-Za-z_]*TIKTOK_PIXEL[A-Za-z_]*\s*[:=]\s*['"]([A-Z0-9]{15,25})['"]/g, sikkerhet: "antatt" },
  { type: "clarity", re: /[A-Za-z_]*CLARITY[A-Za-z_]*\s*[:=]\s*['"]([a-z0-9]{8,15})['"]/g, sikkerhet: "antatt" },
  { type: "google_ads", re: /[A-Za-z_]*(?:ADS_CONVERSION|AW_ID)[A-Za-z_]*\s*[:=]\s*['"](AW-\d{9,12})['"]/g, sikkerhet: "antatt" },
];

function samle(tekst: string, funnet_i: SporingsFunn["funnet_i"]): SporingsFunn[] {
  const ut: SporingsFunn[] = [];
  for (const { type, re, sikkerhet } of MØNSTRE) {
    // Regexene er globale og bærer lastIndex mellom kall.
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tekst)) !== null) {
      const id = m[1] ?? m[0];
      const finnes = ut.find((f) => f.type === type && f.id === id);
      // Variabelnavnet står rett foran treffet. Hentes ut som den er, ikke
      // tolkes — den som leser vet best hva «LEADGRID_» betyr hos seg.
      const foran = tekst.slice(Math.max(0, m.index - 60), m.index);
      const kontekst =
        sikkerhet === "antatt"
          ? (foran.match(/([A-Za-z_][A-Za-z0-9_]{3,60})\s*[:=]\s*$/)?.[1] ??
             m[0].match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1])
          : undefined;
      // Et bekreftet funn slår et antatt om samme ID dukker opp begge steder.
      if (!finnes) ut.push({ type, id, funnet_i, sikkerhet, kontekst });
      else if (sikkerhet === "bekreftet") finnes.sikkerhet = "bekreftet";
    }
  }
  return ut;
}

/** Maks 2 MB. En side som er større enn det, skal ikke få lov til å spise
 *  minnet vårt fordi noen ba oss skanne den. */
const MAKS_BYTES = 2 * 1024 * 1024;

async function hentTekst(url: string, timeoutMs = 10_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await ssrfSafeFetch(url, {
      signal: ctrl.signal,
      headers: {
        // Noen nettsteder svarer med en tom skallside uten dette.
        "User-Agent": "Mozilla/5.0 (compatible; LeadgridSporingsskann/1.0; +https://leadgrid.no)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAKS_BYTES) {
      return new TextDecoder().decode(buf.slice(0, MAKS_BYTES));
    }
    return new TextDecoder().decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

export interface SkannResultat {
  url: string;
  funn: SporingsFunn[];
  /** Containere vi klarte å lese, og hvilke vi ikke fikk tak i. */
  gtm_containere_lest: string[];
  advarsler: string[];
}

export async function skannSporing(rawUrl: string): Promise<SkannResultat> {
  const advarsler: string[] = [];
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const ord = domeneOrd(new URL(url).hostname);

  const html = await hentTekst(url);
  const funn = samle(html, "sidekilde");

  // Pixlene ligger som regel inne i GTM-containeren, ikke i sidekilden.
  // Containeren er offentlig; å lese den er den eneste måten å se dem på
  // uten å kjøre siden i en nettleser.
  const gtmIder = funn.filter((f) => f.type === "gtm").map((f) => f.id);
  const lest: string[] = [];
  for (const id of gtmIder.slice(0, 3)) {
    try {
      const container = await hentTekst(
        `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`,
      );
      lest.push(id);
      for (const f of samle(container, "gtm_container")) {
        if (!funn.some((x) => x.type === f.type && x.id === f.id)) funn.push(f);
      }
    } catch (err) {
      advarsler.push(
        `Fikk ikke lest GTM-containeren ${id} (${(err as Error).message}). ` +
          `Tagger som bare ligger der, er ikke med i funnene.`,
      );
    }
  }

  if (funn.length === 0) {
    advarsler.push(
      "Fant ingen sporing i sidekilden. Enten er det ikke satt opp, eller så " +
        "lastes alt av JavaScript etter at siden har kjørt — det ser ikke et " +
        "statisk skann.",
    );
  }
  if (gtmIder.length > 0 && lest.length === 0) {
    advarsler.push(
      "GTM er i bruk, men containeren kunne ikke leses. Pixler som ligger " +
        "inne i den, er derfor ikke oppdaget.",
    );
  }
  // Knytt funnene til domenet der variabelnavnet sier hvem de tilhører.
  for (const f of funn) {
    if (!f.kontekst) continue;
    const navn = f.kontekst.toUpperCase();
    if (ord.some((o) => navn.startsWith(o) || navn.includes(`_${o}_`))) {
      f.anbefalt = true;
    }
  }

  // Flere ID-er av samme type betyr som regel at siden serverer flere
  // merkevarer fra samme kildefil, og velger én på vertsnavn ved kjøring.
  // Det kan ikke avgjøres statisk — si det, ikke gjett.
  for (const type of new Set(funn.map((f) => f.type))) {
    const avType = funn.filter((f) => f.type === type);
    if (avType.length > 1) {
      const anbefalt = avType.filter((f) => f.anbefalt);
      advarsler.push(
        `Fant ${avType.length} ${type}-ID-er: ${avType
          .map((f) => (f.kontekst ? `${f.id} (${f.kontekst})` : f.id))
          .join(", ")}. ` +
          (anbefalt.length === 1
            ? `Variabelnavnet peker på ${anbefalt[0].id} for dette domenet.`
            : `Siden velger sannsynligvis én på vertsnavn ved kjøring. Bekreft hvilken som gjelder før import.`),
      );
    }
  }

  // Fant vi GTM men ingen GA4? Det er nesten alltid feil, og verdt å si.
  if (gtmIder.length > 0 && !funn.some((f) => f.type === "ga4")) {
    advarsler.push(
      "GTM er satt opp, men ingen GA4-måle-id ble funnet. Sjekk om GA4-taggen " +
        "utløses på en hendelse i stedet for på alle sidevisninger.",
    );
  }

  return { url, funn, gtm_containere_lest: lest, advarsler };
}
