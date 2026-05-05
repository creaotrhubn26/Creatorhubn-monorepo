/**
 * Plakat-/social-format-composer.
 *
 * Bygger flerbruksplakater (print + IG-feed + IG-stories + FB-ad + 2:3 print +
 * A4) fra én PosterContent-struktur. Satori-rendering av flex-baserte JSX-
 * lignende vnodes → SVG → PNG via @resvg/resvg-js. Alle layouts er respons-
 * basert på `format` (portrait | square | landscape) slik at samme content
 * holder seg innenfor ratio uten klipping.
 *
 * 9-lags-modellen:
 *   1. Produktbilder (cutouts, PNG med alpha)
 *   2. Logo
 *   3. Brand-palett (primary/secondary/accent/background/text)
 *   4. Brand-fonter (display/body/script)
 *   5. Tekstur-overlay (papir, korn, splatter — valgfri)
 *   6. Kampanje-konsept (headline + connector + secondary + subhead + burst + cta)
 *   7. Produktnavn + pris (pricing tiles + product labels)
 *   8. CTA-rad (ikon + tekst, fra poster_cta_icons-tabellen)
 *   9. Footer (telefon, sosial-handler, URL)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
// wawoff2 har ingen .d.ts; deklareres som any-modul nedenfor
import wawoff2 from "wawoff2";

const require_ = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────
// Format + dimensjoner
// ─────────────────────────────────────────────────────────────────────────

export type PosterFormat =
  // ── Social (digital, ingen bleed) ──
  | "1x1"          // Instagram feed square
  | "4x5"          // Instagram portrait (anbefalt feed)
  | "9x16"         // Stories / TikTok / Reels
  | "1.91x1"       // Facebook ad / OpenGraph link-preview
  | "2x3"          // Klassisk plakat-ratio (også brukt på print uten bleed)
  // ── Print signage (med bleed) ──
  | "a4"           // A4 (210×297mm @ 300 DPI)
  | "a3"           // A3 (297×420mm @ 300 DPI)
  | "a2"           // A2 (420×594mm @ 200 DPI for håndterbar render-størrelse)
  | "a1"           // A1 (594×841mm @ 150 DPI)
  | "rollup"       // Roll-up banner (850×2000mm @ 100 DPI)
  | "aframe"       // A-frame / sandwich-board (600×900mm @ 150 DPI)
  | "bus-shelter"  // Adshel bus shelter (1200×1800mm @ 100 DPI)
  // ── Digital signage (skjermer, ingen bleed) ──
  | "menuboard-16x9"   // Menyskjerm 16:9 4K (3840×2160)
  | "menuboard-9x16";  // Vertikal menyskjerm 4K (2160×3840)

export interface FormatDims {
  /** Render-canvas-bredde inkludert bleed (i piksler). */
  w: number;
  /** Render-canvas-høyde inkludert bleed (i piksler). */
  h: number;
  /** Layout-shape — styrer template-grenen. */
  shape: "portrait" | "square" | "landscape";
  /** Type — påvirker bleed/safety-zone og eksport-default. */
  kind: "digital" | "print";
  /** Effective DPI for print-formater (informativt, brukes i UI). */
  dpi?: number;
  /** Bleed i piksler — content rendres innenfor (w - 2*bleed) × (h - 2*bleed). */
  bleed?: number;
  /** Safety-zone i piksler innenfor bleed-rammen — viktige tekstelementer
   *  skal ikke krysse denne marginen. Brukes til UI-overlay-guides. */
  safeZone?: number;
  /** Fysisk størrelse i mm (informativt, brukes i UI). */
  physicalMm?: { w: number; h: number };
}

// Helper: konverter mm → piksler ved gitt DPI (1 inch = 25.4 mm)
const mmToPx = (mm: number, dpi: number): number => Math.round((mm / 25.4) * dpi);

export const FORMAT_DIMENSIONS: Record<PosterFormat, FormatDims> = {
  // ── Social (digital) ──
  "1x1": { w: 1080, h: 1080, shape: "square", kind: "digital" },
  "4x5": { w: 1080, h: 1350, shape: "portrait", kind: "digital" },
  "9x16": { w: 1080, h: 1920, shape: "portrait", kind: "digital" },
  "1.91x1": { w: 1200, h: 628, shape: "landscape", kind: "digital" },
  "2x3": { w: 1024, h: 1536, shape: "portrait", kind: "digital" },
  // ── Print signage (med bleed) ──
  a4: {
    w: mmToPx(210 + 6, 300),
    h: mmToPx(297 + 6, 300),
    shape: "portrait",
    kind: "print",
    dpi: 300,
    bleed: mmToPx(3, 300),
    safeZone: mmToPx(8, 300),
    physicalMm: { w: 210, h: 297 },
  },
  a3: {
    w: mmToPx(297 + 6, 300),
    h: mmToPx(420 + 6, 300),
    shape: "portrait",
    kind: "print",
    dpi: 300,
    bleed: mmToPx(3, 300),
    safeZone: mmToPx(8, 300),
    physicalMm: { w: 297, h: 420 },
  },
  a2: {
    w: mmToPx(420 + 6, 200),
    h: mmToPx(594 + 6, 200),
    shape: "portrait",
    kind: "print",
    dpi: 200,
    bleed: mmToPx(3, 200),
    safeZone: mmToPx(10, 200),
    physicalMm: { w: 420, h: 594 },
  },
  a1: {
    w: mmToPx(594 + 6, 150),
    h: mmToPx(841 + 6, 150),
    shape: "portrait",
    kind: "print",
    dpi: 150,
    bleed: mmToPx(3, 150),
    safeZone: mmToPx(15, 150),
    physicalMm: { w: 594, h: 841 },
  },
  rollup: {
    w: mmToPx(850 + 10, 100), // større bleed for roll-up (5mm/side typisk)
    h: mmToPx(2000 + 10, 100),
    shape: "portrait",
    kind: "print",
    dpi: 100,
    bleed: mmToPx(5, 100),
    safeZone: mmToPx(50, 100), // 5cm topp/bunn, viktig for roll-up-mekanikk
    physicalMm: { w: 850, h: 2000 },
  },
  aframe: {
    w: mmToPx(600 + 6, 150),
    h: mmToPx(900 + 6, 150),
    shape: "portrait",
    kind: "print",
    dpi: 150,
    bleed: mmToPx(3, 150),
    safeZone: mmToPx(20, 150),
    physicalMm: { w: 600, h: 900 },
  },
  "bus-shelter": {
    w: mmToPx(1200 + 6, 100),
    h: mmToPx(1800 + 6, 100),
    shape: "portrait",
    kind: "print",
    dpi: 100,
    bleed: mmToPx(3, 100),
    safeZone: mmToPx(50, 100),
    physicalMm: { w: 1200, h: 1800 },
  },
  // ── Digital signage (skjermer) ──
  "menuboard-16x9": { w: 3840, h: 2160, shape: "landscape", kind: "digital" },
  "menuboard-9x16": { w: 2160, h: 3840, shape: "portrait", kind: "digital" },
};

// ─────────────────────────────────────────────────────────────────────────
// Content-modell
// ─────────────────────────────────────────────────────────────────────────

export interface BrandIdentity {
  businessName: string;
  logoUrl: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  fonts: {
    display: string;
    body: string;
    script?: string;
  };
}

export interface ProductCard {
  /** PNG-cutout (helst transparent bakgrunn). URL eller base64 data: URI. */
  imageUrl: string;
  /** Etikett under produktet ("PEPPERONI"). */
  name: string;
}

export interface PricingTier {
  label: string; // "VALGFRI STOR PIZZA"
  price: string; // "169,-"
}

export interface CtaItem {
  /** SVG-path-data fra poster_cta_icons.svg_path. */
  iconSvgPath: string;
  text: string;
}

/**
 * Frittflytende layer brukeren plasserer på toppen av template-output.
 * Posisjon i piksel-koordinater relativt til render-canvas (inkl. bleed).
 * Brukes av Fase 3-redaktøren der bruker drar tekstbokser/bilder/former
 * inn på lerretet og snap-justerer presist.
 */
export type CustomLayer =
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      rotation?: number;
      text: string;
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: 400 | 700;
      color?: string;
      align?: "left" | "center" | "right";
      backgroundColor?: string;
      padding?: number;
      letterSpacing?: string;
      lineHeight?: number;
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      rotation?: number;
      imageUrl: string;
      opacity?: number;
      borderRadius?: number;
      objectFit?: "contain" | "cover";
    }
  | {
      id: string;
      type: "shape";
      x: number;
      y: number;
      w: number;
      h: number;
      rotation?: number;
      shape: "rect" | "circle";
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      borderRadius?: number;
      opacity?: number;
    };

export interface PosterContent {
  templateId: "monday-special" | "weekly-special" | "new-launch" | "season-promo";
  brand: BrandIdentity;
  campaign: {
    /** Hovedtittel del 1, hvit/lys ("BLUE MONDAY"). */
    headlinePrimary: string;
    /** Tilkobling mellom delene ("OM TIL"). */
    connector?: string;
    /** Hovedtittel del 2, brand-primary ("HOLY MONDAY"). */
    headlineSecondary: string;
    /** Liten linje under begge titlene. */
    subhead?: string;
    /** Skrå callout-bobble ("VI REDDER MANDAGEN DIN!"). */
    burst?: string;
    /** Bunn-CTA ("START UKA RIKTIG. BESTILL NÅ!"). */
    cta: string;
  };
  pricing: PricingTier[];
  products: ProductCard[];
  ctaActions: CtaItem[];
  footer?: {
    phone?: string;
    socialLine?: string;
  };
  /** Frittflytende lag bruker har plassert via composer-editoren. Renderes
   *  på toppen av template-output i pikselkoordinater relativt til canvas. */
  customLayers?: CustomLayer[];
}

// ─────────────────────────────────────────────────────────────────────────
// Font-loading
// ─────────────────────────────────────────────────────────────────────────

interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

const FONT_CACHE = new Map<string, ArrayBuffer>();

/**
 * Map fra brand-side font-family-navn til @fontsource-pakkens slug.
 * @fontsource leverer woff2-filer; vi dekomprimerer til TTF runtime
 * (Satori 0.26 godtar kun TTF/OTF, ikke woff/woff2 direkte).
 */
const FONTSOURCE_SLUGS: Record<string, string> = {
  "Bebas Neue": "bebas-neue",
  Anton: "anton",
  Oswald: "oswald",
  "Bowlby One": "bowlby-one",
  Inter: "inter",
  Manrope: "manrope",
  Caveat: "caveat",
  "Permanent Marker": "permanent-marker",
};

/**
 * Loader font fra lokal @fontsource-pakke. Slår opp riktig woff2-fil basert
 * på family + weight, dekomprimerer til TTF, cacher i minne.
 *
 * Tilgjengelige weights varierer per font (Bebas Neue har bare 400, Inter har
 * 100-900). Vi prøver requested weight først, faller tilbake til 400 hvis
 * den ikke finnes.
 */
async function loadLocalFont(family: string, weight: 400 | 700): Promise<ArrayBuffer> {
  const cacheKey = `${family}:${weight}`;
  const cached = FONT_CACHE.get(cacheKey);
  if (cached) return cached;

  const slug = FONTSOURCE_SLUGS[family];
  if (!slug) {
    throw new Error(`Ingen @fontsource-mapping for "${family}" — legg til i FONTSOURCE_SLUGS`);
  }
  const pkgDir = require_.resolve(`@fontsource/${slug}/package.json`).replace(/\/package\.json$/, "");

  const tryPaths = [
    join(pkgDir, "files", `${slug}-latin-${weight}-normal.woff2`),
    join(pkgDir, "files", `${slug}-latin-400-normal.woff2`), // fallback til 400
  ];
  let woff2Buf: Buffer | null = null;
  for (const p of tryPaths) {
    try {
      woff2Buf = readFileSync(p);
      break;
    } catch {
      continue;
    }
  }
  if (!woff2Buf) {
    throw new Error(`Fant ikke woff2 for ${family}@${weight} i @fontsource/${slug}`);
  }
  const ttfUint8 = await wawoff2.decompress(woff2Buf);
  const ttf = ttfUint8.buffer.slice(ttfUint8.byteOffset, ttfUint8.byteOffset + ttfUint8.byteLength) as ArrayBuffer;
  FONT_CACHE.set(cacheKey, ttf);
  return ttf;
}

// Bevar Google Fonts-loader som bakdør for fonter som ikke har @fontsource-pakke.
async function fetchGoogleFont(family: string, weight: 400 | 700): Promise<ArrayBuffer> {
  const cacheKey = `${family}:${weight}`;
  const cached = FONT_CACHE.get(cacheKey);
  if (cached) return cached;

  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // Forsøk 1: med eksplisitt weight. Forsøk 2: uten weight (mange display-fonter
  // som Bebas Neue, Anton, Bowlby One har bare én vekt og 400-respons hvis
  // wght-param brukes).
  const tryUrls = [
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`,
  ];
  let css: string | null = null;
  for (const url of tryUrls) {
    const resp = await fetch(url, { headers: { "User-Agent": ua } });
    if (resp.ok) {
      css = await resp.text();
      break;
    }
  }
  if (!css) {
    throw new Error(`Google Fonts CSS fetch failed for ${family} (weight ${weight})`);
  }
  // Google Fonts returnerer ulike formater basert på User-Agent. Med moderne
  // Chrome-UA får vi woff2 (som Satori 0.10+ støtter). Fallback: ttf.
  const fontMatches = [...css.matchAll(/url\((https:\/\/[^)]+\.(?:ttf|woff2?))\)/g)];
  if (fontMatches.length === 0) {
    throw new Error(`Fant ikke font-URL (ttf/woff/woff2) i Google Fonts CSS for ${family}`);
  }
  // Foretrekk ttf > woff2 > woff
  const sorted = fontMatches
    .map((m) => m[1])
    .sort((a, b) => {
      const score = (u: string) =>
        u.endsWith(".ttf") ? 0 : u.endsWith(".woff2") ? 1 : 2;
      return score(a) - score(b);
    });
  const fontUrl = sorted[0];
  const fontResp = await fetch(fontUrl);
  if (!fontResp.ok) {
    throw new Error(`Font-fetch feilet for ${family}: ${fontResp.status}`);
  }
  const buf = await fontResp.arrayBuffer();
  FONT_CACHE.set(cacheKey, buf);
  return buf;
}

export async function loadBrandFontsForExport(brand: BrandIdentity): Promise<LoadedFont[]> {
  return loadBrandFonts(brand);
}

async function loadBrandFonts(brand: BrandIdentity): Promise<LoadedFont[]> {
  const wanted: Array<{ family: string; weight: 400 | 700 }> = [
    { family: brand.fonts.display, weight: 400 },
    { family: brand.fonts.display, weight: 700 },
    { family: brand.fonts.body, weight: 400 },
    { family: brand.fonts.body, weight: 700 },
  ];
  if (brand.fonts.script) {
    wanted.push({ family: brand.fonts.script, weight: 400 });
  }
  const loaded: LoadedFont[] = [];
  for (const { family, weight } of wanted) {
    try {
      // Forsøk lokal @fontsource først, fall tilbake til Google Fonts.
      let data: ArrayBuffer;
      if (FONTSOURCE_SLUGS[family]) {
        data = await loadLocalFont(family, weight);
      } else {
        data = await fetchGoogleFont(family, weight);
      }
      loaded.push({ name: family, data, weight, style: "normal" });
    } catch (err) {
      // Tolerer mangel på enkelt-vekt — display/body 400 er det viktigste
      console.warn(`[poster-composer] kunne ikke laste ${family}@${weight}:`, err instanceof Error ? err.message : err);
    }
  }
  if (loaded.length === 0) {
    throw new Error("Ingen fonter kunne lastes — kan ikke rendre");
  }
  return loaded;
}

// ─────────────────────────────────────────────────────────────────────────
// JSX-helper (Satori-vnode-struktur)
// ─────────────────────────────────────────────────────────────────────────

type Style = Record<string, unknown>;
type VChild = VNode | string | number;
type VNode = {
  type: string;
  props: { style?: Style; children?: VChild | VChild[]; [k: string]: unknown };
};

function el(type: string, props: Record<string, unknown>, ...children: Array<VNode | string | number | null | undefined>): VNode {
  const filtered = children.filter((c) => c !== null && c !== undefined) as Array<VNode | string | number>;
  return { type, props: { ...props, children: filtered.length === 1 ? filtered[0] : filtered } };
}

// ─────────────────────────────────────────────────────────────────────────
// Template: monday-special
// ─────────────────────────────────────────────────────────────────────────

function mondaySpecialTree(content: PosterContent, dims: FormatDims): VNode {
  const { brand, campaign, pricing, products, ctaActions, footer } = content;
  const c = brand.colors;
  const isPortrait = dims.shape === "portrait";
  const isLandscape = dims.shape === "landscape";

  // Bleed-håndtering: hele canvas er (dims.w, dims.h) inkl. bleed, men
  // INNHOLD layouts innenfor trim-arealet (dims.w - 2*bleed) × (dims.h - 2*bleed).
  // Bakgrunnen strekker seg ut i bleed-området slik at trykkeriet kan kutte
  // uten hvit kant. Safe-zone er en ekstra indre margin for kritisk tekst.
  const bleed = dims.bleed ?? 0;
  const safeZone = dims.safeZone ?? 0;
  const trimW = dims.w - 2 * bleed;
  const trimH = dims.h - 2 * bleed;
  const contentInset = bleed + safeZone;
  const contentW = dims.w - 2 * contentInset;
  const contentH = dims.h - 2 * contentInset;

  // Skaler-funksjoner basert på TRIM-arealet (ikke total canvas) så layout
  // ser likt ut på tvers av formater med ulik bleed.
  const px = (frac: number) => Math.round(trimW * frac);
  const py = (frac: number) => Math.round(trimH * frac);

  // Bakgrunn: blå venstre, rød høyre, dekker hele canvas inkl. bleed.
  const bg: Style = {
    position: "absolute",
    top: 0,
    left: 0,
    width: dims.w,
    height: dims.h,
    background: `linear-gradient(90deg, ${c.secondary} 0%, ${c.secondary} 45%, ${c.primary} 55%, ${c.primary} 100%)`,
    display: "flex",
  };

  // Hovedinnhold-container — sitter innenfor safe-zone (= bleed + safeZone).
  const containerStyle: Style = {
    position: "absolute",
    top: contentInset,
    left: contentInset,
    width: contentW,
    height: contentH,
    display: "flex",
    flexDirection: isLandscape ? "row" : "column",
    color: c.text ?? "#FFFFFF",
    fontFamily: brand.fonts.body,
  };

  const leftStyle: Style = isLandscape
    ? { display: "flex", flexDirection: "column", flex: 1.2, paddingRight: px(0.02) }
    : { display: "flex", flexDirection: "column", width: "100%" };

  const rightStyle: Style = isLandscape
    ? { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }
    : { display: "flex", flexDirection: "column", width: "100%" };

  // ── Logo + tagline-corner (lag 2) ──
  const headerSection = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        marginBottom: py(0.02),
      },
    },
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          fontFamily: brand.fonts.display,
          fontSize: Math.round(trimW * 0.025),
          letterSpacing: "0.05em",
          color: c.text ?? "#FFFFFF",
          opacity: 0.9,
          maxWidth: "30%",
        },
      },
      "LA DIN",
      el("span", { style: { color: c.secondary === "#1B2D5C" ? "#7AB8FF" : "#FFFFFF", fontSize: Math.round(trimW * 0.04), fontWeight: 700 } }, campaign.headlinePrimary.toUpperCase()),
      "BLI DIN",
      el("span", { style: { color: c.primary, fontSize: Math.round(trimW * 0.04), fontWeight: 700 } }, `${campaign.headlineSecondary.toUpperCase()}!`),
    ),
    el("img", {
      src: brand.logoUrl,
      style: {
        width: Math.round(trimW * 0.22),
        height: Math.round(trimW * 0.22),
        objectFit: "contain",
      },
    }),
    campaign.burst
      ? el(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              fontFamily: brand.fonts.display,
              color: c.text ?? "#FFFFFF",
              fontSize: Math.round(trimW * 0.022),
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: "30%",
              textAlign: "right",
              transform: "rotate(-3deg)",
            },
          },
          "VI REDDER",
          "MANDAGEN",
          el("span", { style: { color: c.primary, fontSize: Math.round(trimW * 0.045) } }, "DIN!"),
        )
      : null,
  );

  // ── Hovedheadlines (lag 6) — kjernen av plakaten ──
  const heroBlock = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        marginTop: py(0.02),
        marginBottom: py(0.02),
      },
    },
    // Headline primary — hvit-på-blå-stripe
    el(
      "div",
      {
        style: {
          fontFamily: brand.fonts.display,
          fontSize: Math.round(trimW * 0.12),
          fontWeight: 700,
          color: c.text ?? "#FFFFFF",
          letterSpacing: "0.01em",
          lineHeight: 0.95,
          textAlign: "center",
          padding: `${py(0.01)}px ${px(0.03)}px`,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        },
      },
      campaign.headlinePrimary.toUpperCase(),
    ),
    // Connector
    campaign.connector
      ? el(
          "div",
          {
            style: {
              backgroundColor: c.text ?? "#FFFFFF",
              color: c.secondary,
              fontFamily: brand.fonts.display,
              fontSize: Math.round(trimW * 0.05),
              padding: `${py(0.005)}px ${px(0.04)}px`,
              fontWeight: 700,
              letterSpacing: "0.05em",
              marginTop: py(0.005),
              marginBottom: py(0.005),
            },
          },
          campaign.connector.toUpperCase(),
        )
      : null,
    // Headline secondary — rød-på-hvit-tape
    el(
      "div",
      {
        style: {
          backgroundColor: c.text ?? "#FFFFFF",
          color: c.primary,
          fontFamily: brand.fonts.display,
          fontSize: Math.round(trimW * 0.13),
          fontWeight: 700,
          letterSpacing: "0.01em",
          lineHeight: 0.95,
          textAlign: "center",
          padding: `${py(0.012)}px ${px(0.04)}px`,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        },
      },
      campaign.headlineSecondary.toUpperCase(),
    ),
    // Subhead
    campaign.subhead
      ? el(
          "div",
          {
            style: {
              fontFamily: brand.fonts.display,
              color: c.text ?? "#FFFFFF",
              fontSize: Math.round(trimW * 0.025),
              letterSpacing: "0.1em",
              marginTop: py(0.012),
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
            },
          },
          `★ ${campaign.subhead.toUpperCase()} ★`,
        )
      : null,
  );

  // ── Pricing tiles (lag 7) ──
  const pricingBlock = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        gap: py(0.012),
        marginTop: py(0.015),
        marginBottom: py(0.015),
      },
    },
    ...pricing.map((tier) =>
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#0E0E0E",
            color: c.text ?? "#FFFFFF",
            padding: `${py(0.012)}px ${px(0.025)}px`,
            gap: px(0.02),
          },
        },
        el(
          "div",
          {
            style: {
              backgroundColor: c.text ?? "#FFFFFF",
              color: "#0E0E0E",
              fontFamily: brand.fonts.display,
              fontSize: Math.round(trimW * 0.035),
              fontWeight: 700,
              padding: `${py(0.008)}px ${px(0.02)}px`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: px(0.28),
            },
          },
          el("span", { style: { color: c.primary, fontSize: Math.round(trimW * 0.022), letterSpacing: "0.1em" } }, "VALGFRI"),
          tier.label.toUpperCase().replace("VALGFRI", "").trim(),
        ),
        el(
          "div",
          {
            style: {
              fontFamily: brand.fonts.display,
              fontSize: Math.round(trimW * 0.07),
              fontWeight: 700,
              color: c.text ?? "#FFFFFF",
              minWidth: px(0.18),
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
            },
          },
          tier.price,
        ),
      ),
    ),
  );

  // ── Produktbilder med etikett (lag 1 + lag 7-label) ──
  // I landscape er høyre kolonne ~50% av bredden delt på N produkter,
  // så bildet må klampes mot kolonne-bredde ikke total-bredde.
  const productImgSize = isLandscape
    ? Math.round(Math.min(trimH * 0.45, (trimW * 0.45) / Math.max(products.length, 1)))
    : Math.round(trimW * 0.28);
  const productsBlock = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "flex-end",
        width: "100%",
        marginTop: py(0.01),
      },
    },
    ...products.slice(0, 4).map((p) =>
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: `${Math.floor(100 / Math.min(products.length, 4))}%`,
          },
        },
        el("img", {
          src: p.imageUrl,
          style: {
            width: productImgSize,
            height: productImgSize,
            objectFit: "contain",
          },
        }),
        el(
          "div",
          {
            style: {
              backgroundColor: c.primary,
              color: c.text ?? "#FFFFFF",
              fontFamily: brand.fonts.display,
              fontSize: Math.round(trimW * 0.025),
              fontWeight: 700,
              padding: `${py(0.005)}px ${px(0.018)}px`,
              marginTop: -py(0.015),
              letterSpacing: "0.05em",
              display: "flex",
            },
          },
          p.name.toUpperCase(),
        ),
      ),
    ),
  );

  // ── CTA-rad med ikoner (lag 8) ──
  const ctaSize = Math.round(trimW * 0.025);
  const ctaRow = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        marginTop: py(0.015),
      },
    },
    el(
      "div",
      {
        style: {
          fontFamily: brand.fonts.display,
          fontSize: Math.round(trimW * 0.04),
          fontWeight: 700,
          color: c.text ?? "#FFFFFF",
          marginBottom: py(0.01),
          display: "flex",
        },
      },
      campaign.cta.toUpperCase(),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          gap: px(0.03),
          alignItems: "center",
        },
      },
      ...ctaActions.map((a, idx) =>
        el(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: px(0.01),
              fontSize: ctaSize,
              fontFamily: brand.fonts.body,
              color: c.text ?? "#FFFFFF",
              fontWeight: 700,
              letterSpacing: "0.05em",
              borderRight: idx < ctaActions.length - 1 ? `2px solid ${c.text ?? "#FFFFFF"}` : "none",
              paddingRight: idx < ctaActions.length - 1 ? px(0.015) : 0,
            },
          },
          // SVG-ikon som inline element
          el(
            "svg",
            {
              width: ctaSize * 1.4,
              height: ctaSize * 1.4,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: c.text ?? "#FFFFFF",
              strokeWidth: 2,
            },
            el("path", { d: a.iconSvgPath }),
          ),
          a.text.toUpperCase(),
        ),
      ),
    ),
  );

  // ── Footer (lag 9) ──
  const footerBlock = footer
    ? el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            marginTop: py(0.02),
            backgroundColor: c.text ?? "#FFFFFF",
            padding: `${py(0.015)}px ${px(0.03)}px`,
          },
        },
        footer.phone
          ? el(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: px(0.012),
                  color: c.primary,
                  fontFamily: brand.fonts.display,
                  fontSize: Math.round(trimW * 0.035),
                  fontWeight: 700,
                },
              },
              el("span", { style: { color: "#0E0E0E", fontSize: Math.round(trimW * 0.022) } }, "RING OG BESTILL:"),
              footer.phone,
            )
          : null,
        footer.socialLine
          ? el(
              "div",
              {
                style: {
                  color: "#0E0E0E",
                  fontFamily: brand.fonts.body,
                  fontSize: Math.round(trimW * 0.022),
                  fontWeight: 600,
                  display: "flex",
                },
              },
              `FØLG OSS! ${footer.socialLine}`,
            )
          : null,
      )
    : null;

  // Sett sammen i riktig rekkefølge basert på shape.
  // Landscape (FB-ad/OG) har lite vertikalt rom — drop pricing-tiles + ctaRow
  // og legg fokus på headlines + produkt-rad.
  const portraitOrder = [headerSection, heroBlock, pricingBlock, productsBlock, ctaRow, footerBlock];
  const squareOrder = [headerSection, heroBlock, pricingBlock, productsBlock, ctaRow, footerBlock];
  const landscapeLeft = [headerSection, heroBlock, footerBlock];
  const landscapeRight = [productsBlock, pricingBlock];

  // Free-form custom layers (Fase 3-editor) — renderes på toppen i absolutt posisjon
  const customLayerNodes = (content.customLayers ?? []).map((layer) => renderCustomLayer(layer));

  if (isLandscape) {
    return el(
      "div",
      { style: { ...bg, position: "relative", overflow: "hidden" } },
      el(
        "div",
        { style: containerStyle },
        el("div", { style: leftStyle }, ...landscapeLeft.filter((x): x is VNode => Boolean(x))),
        el("div", { style: rightStyle }, ...landscapeRight.filter((x): x is VNode => Boolean(x))),
      ),
      ...customLayerNodes,
    );
  }

  const order = isPortrait ? portraitOrder : squareOrder;
  return el(
    "div",
    { style: { ...bg, position: "relative", overflow: "hidden" } },
    el("div", { style: containerStyle }, ...order.filter((x): x is VNode => Boolean(x))),
    ...customLayerNodes,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Custom-layer-renderer (Fase 3 editor-output)
// ─────────────────────────────────────────────────────────────────────────

function renderCustomLayer(layer: CustomLayer): VNode {
  const baseStyle: Style = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.w,
    height: layer.h,
    display: "flex",
  };
  if (layer.rotation) {
    baseStyle.transform = `rotate(${layer.rotation}deg)`;
    baseStyle.transformOrigin = "center";
  }

  if (layer.type === "text") {
    return el(
      "div",
      {
        style: {
          ...baseStyle,
          fontFamily: layer.fontFamily ?? "Inter",
          fontSize: layer.fontSize ?? 32,
          fontWeight: layer.fontWeight ?? 400,
          color: layer.color ?? "#000000",
          textAlign: layer.align ?? "left",
          backgroundColor: layer.backgroundColor ?? "transparent",
          padding: layer.padding ?? 0,
          letterSpacing: layer.letterSpacing ?? "normal",
          lineHeight: layer.lineHeight ?? 1.2,
          alignItems:
            layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start",
          justifyContent: "center",
          flexDirection: "column",
        },
      },
      layer.text,
    );
  }

  if (layer.type === "image") {
    return el(
      "div",
      { style: baseStyle },
      el("img", {
        src: layer.imageUrl,
        style: {
          width: "100%",
          height: "100%",
          objectFit: layer.objectFit ?? "contain",
          opacity: layer.opacity ?? 1,
          borderRadius: layer.borderRadius ?? 0,
        },
      }),
    );
  }

  // shape
  const isCircle = layer.shape === "circle";
  return el("div", {
    style: {
      ...baseStyle,
      backgroundColor: layer.fill ?? "#000000",
      border: layer.strokeWidth && layer.stroke ? `${layer.strokeWidth}px solid ${layer.stroke}` : "none",
      borderRadius: isCircle ? "50%" : layer.borderRadius ?? 0,
      opacity: layer.opacity ?? 1,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Template-registry
// ─────────────────────────────────────────────────────────────────────────

const TEMPLATE_BUILDERS: Record<PosterContent["templateId"], (c: PosterContent, d: FormatDims) => VNode> = {
  "monday-special": mondaySpecialTree,
  "weekly-special": mondaySpecialTree, // alias inntil Fase 4 leverer egen
  "new-launch": mondaySpecialTree,
  "season-promo": mondaySpecialTree,
};

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rendrer en plakat fra strukturert content til PNG-buffer.
 * Bruker valgt format-dimensjoner og laster brand-fonter fra Google Fonts
 * (cachet i minne mellom kall).
 */
export async function renderPoster(content: PosterContent, format: PosterFormat): Promise<Buffer> {
  const dims = FORMAT_DIMENSIONS[format];
  const builder = TEMPLATE_BUILDERS[content.templateId];
  if (!builder) {
    throw new Error(`Ukjent template-id: ${content.templateId}`);
  }
  const fonts = await loadBrandFonts(content.brand);
  const tree = builder(content, dims);

  // Satori forventer en JSX-lignende struktur. Vi sender vnode-objektet direkte —
  // satori @0.10+ aksepterer både JSX og plain object-tre.
  const svg = await satori(tree as never, {
    width: dims.w,
    height: dims.h,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: dims.w },
    background: "rgba(0, 0, 0, 0)",
  })
    .render()
    .asPng();

  return png;
}

/** Eksportert for bruk i CLI/tests slik at man kan inspisere SVG før PNG-render. */
export async function renderPosterToSvg(content: PosterContent, format: PosterFormat): Promise<string> {
  const dims = FORMAT_DIMENSIONS[format];
  const builder = TEMPLATE_BUILDERS[content.templateId];
  if (!builder) throw new Error(`Ukjent template-id: ${content.templateId}`);
  const fonts = await loadBrandFonts(content.brand);
  const tree = builder(content, dims);
  return await satori(tree as never, {
    width: dims.w,
    height: dims.h,
    fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
  });
}
