/**
 * Klient-API for plakat-/menu-composeren.
 *
 * Backend-endepunkter:
 *   POST /api/role-room/poster/preview        → PNG (Buffer)
 *   POST /api/role-room/poster/menu-preview   → PDF (Buffer)
 *   GET  /api/role-room/poster/formats        → liste over formater
 *   GET  /api/role-room/poster/templates      → liste over templates
 *   GET  /api/role-room/poster/drafts         → user's drafts
 *   POST /api/role-room/poster/drafts         → save/update draft
 */

const API_BASE = "/api/role-room";

// ─────────────────────────────────────────────────────────────────────────
// Types — speiler backend-typene fra role-room-poster-composer.ts
// ─────────────────────────────────────────────────────────────────────────

export type PosterFormat =
  | "1x1" | "4x5" | "9x16" | "1.91x1" | "2x3"
  | "a4" | "a3" | "a2" | "a1" | "rollup" | "aframe" | "bus-shelter"
  | "menuboard-16x9" | "menuboard-9x16";

export type MenuFormat = "menu-a4" | "menu-trifold-a4";

export interface FormatInfo {
  key: string;
  w: number;
  h: number;
  shape: "portrait" | "square" | "landscape";
  kind: "digital" | "print";
  dpi?: number;
  bleed?: number;
  safeZone?: number;
  physicalMm?: { w: number; h: number };
}

export interface FormatGroups {
  social: FormatInfo[];
  print: FormatInfo[];
  digital_signage: FormatInfo[];
  menu: FormatInfo[];
}

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
  imageUrl: string;
  name: string;
}

export interface PricingTier {
  label: string;
  price: string;
}

export interface CtaItem {
  iconSvgPath: string;
  text: string;
}

/**
 * Free-form layer plassert via Fase 3-editoren. Posisjon i pikselkoordinater
 * relativt til render-canvas (inkl. bleed). Speiler backend CustomLayer-typen.
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
    headlinePrimary: string;
    connector?: string;
    headlineSecondary: string;
    subhead?: string;
    burst?: string;
    cta: string;
  };
  pricing: PricingTier[];
  products: ProductCard[];
  ctaActions: CtaItem[];
  footer?: {
    phone?: string;
    socialLine?: string;
  };
  customLayers?: CustomLayer[];
}

export interface MenuItem {
  imageUrl?: string;
  name: string;
  description?: string;
  price: string;
}

export interface MenuCategory {
  title: string;
  description?: string;
  items: MenuItem[];
}

export interface MenuContent {
  templateId: "menu-premium" | "menu-trifold";
  brand: BrandIdentity;
  cover: { title: string; subtitle?: string; tagline?: string };
  categories: MenuCategory[];
  contact: {
    phone?: string;
    address?: string;
    website?: string;
    hours?: Array<{ day: string; time: string }>;
  };
  deals?: Array<{ title: string; description?: string; price: string }>;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  contentShape: "PosterContent" | "MenuContent";
}

export interface TemplateGroups {
  poster: TemplateInfo[];
  menu: TemplateInfo[];
}

export interface PosterDraftSummary {
  id: string;
  brand_id: string;
  template_id: string;
  name: string;
  format: string;
  status: "draft" | "published" | "archived";
  rendered_url: string | null;
  rendered_at: string | null;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// API-klient
// ─────────────────────────────────────────────────────────────────────────

/**
 * Auth-headers samkjørt med roleRoomService-mønsteret:
 *   - Authorization: Bearer <token>  (in-app session, fra creatorhub_auth_token)
 *   - x-api-key: <key>               (eksterne klienter, fra roleRoomApiKey)
 * Backend's apiKeyAuth-middleware godtar enten — vi sender begge når
 * tilgjengelig så endepunktene fungerer både for innloggede brukere og
 * API-nøkkel-baserte integrasjoner.
 */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = localStorage.getItem("roleRoomApiKey") ?? "";
  const authToken =
    localStorage.getItem("creatorhub_auth_token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";
  if (apiKey) headers["x-api-key"] = apiKey;
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return headers;
}

export async function fetchFormats(): Promise<FormatGroups> {
  const resp = await fetch(`${API_BASE}/poster/formats`);
  if (!resp.ok) throw new Error(`fetchFormats failed: ${resp.status}`);
  return resp.json();
}

export async function fetchTemplates(): Promise<TemplateGroups> {
  const resp = await fetch(`${API_BASE}/poster/templates`);
  if (!resp.ok) throw new Error(`fetchTemplates failed: ${resp.status}`);
  return resp.json();
}

/**
 * Render plakat til PNG. Returnerer en blob URL som kan brukes direkte i
 * <img src={url} />. Husk å URL.revokeObjectURL(url) når man er ferdig.
 */
export async function renderPosterPreview(
  content: PosterContent,
  format: PosterFormat,
): Promise<string> {
  const resp = await fetch(`${API_BASE}/poster/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content, format }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`renderPosterPreview ${resp.status}: ${text.slice(0, 200)}`);
  }
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

export async function renderMenuPreview(
  content: MenuContent,
  format: MenuFormat = "menu-a4",
): Promise<string> {
  const resp = await fetch(`${API_BASE}/poster/menu-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content, format }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`renderMenuPreview ${resp.status}: ${text.slice(0, 200)}`);
  }
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

export async function listDrafts(): Promise<PosterDraftSummary[]> {
  const resp = await fetch(`${API_BASE}/poster/drafts`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`listDrafts failed: ${resp.status}`);
  const json = await resp.json();
  return json.drafts ?? [];
}

export async function loadDraft(draftId: string): Promise<{
  id: string;
  brand_id: string;
  template_id: string;
  name: string;
  format: string;
  content: PosterContent | MenuContent;
  status: string;
}> {
  const resp = await fetch(`${API_BASE}/poster/drafts/${draftId}`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`loadDraft failed: ${resp.status}`);
  const json = await resp.json();
  return json.draft;
}

/**
 * Genererer kampanje-tekst via Claude. Returnerer ny campaign-objekt eller
 * null hvis Anthropic-credit eller key mangler.
 */
export async function generateCampaignConcept(payload: {
  brand: BrandIdentity;
  templateId: string;
  intent: string;
  voice?: string;
  referenceCampaign?: PosterContent["campaign"];
}): Promise<PosterContent["campaign"] | null> {
  const resp = await fetch(`${API_BASE}/poster/claude/campaign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude-generering feilet (${resp.status}): ${text.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json.campaign ?? null;
}

/**
 * Auto-scrape meny fra restaurant-nettside. Returnerer strukturert
 * fragment som kan importeres direkte inn i composer-content.
 * Strategier (i prioritetsrekkefølge): Supabase REST hvis prosjektet er
 * Supabase-backed, ellers generic HTML-scrape (alt-text + img-tags).
 */
export interface ScrapedMenuResult {
  source: string;
  cover?: { title?: string; subtitle?: string; tagline?: string };
  categories: MenuCategory[];
  contact?: { phone?: string; address?: string; website?: string };
  warnings: string[];
}

export async function scrapeMenuFromUrl(url: string): Promise<ScrapedMenuResult> {
  const resp = await fetch(`${API_BASE}/poster/scrape-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Scrape feilet (${resp.status}): ${text.slice(0, 200)}`);
  }
  return resp.json();
}

/**
 * Hent månedens forbruk + tier-kvote for innlogget bruker.
 * Brukes av usage-pill i Pressroom-toolbar.
 */
export interface UsageSummary {
  period: string;
  tier: "pilot" | "standard" | "pro" | "custom";
  included: { claude_calls: number; renders: number; r2_gb: number; brands: number };
  consumed: { claude_calls: number; renders: number; r2_gb: number };
  cost_nok_ex_vat: number;
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  const resp = await fetch(`${API_BASE}/poster/usage/summary`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`fetchUsageSummary failed: ${resp.status}`);
  return resp.json();
}

/**
 * Last opp brand-/produktbilde til R2. Returnerer signed URL som kan brukes
 * direkte i CustomLayer.imageUrl eller PosterContent.products[].imageUrl.
 */
export async function uploadPosterImage(file: File): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const resp = await fetch(`${API_BASE}/poster/upload`, {
    method: "POST",
    headers: authHeaders(), // Content-Type settes automatisk for FormData
    body: fd,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Image upload failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  return resp.json();
}

export async function saveDraft(payload: {
  id?: string;
  brandId?: string | null;
  templateId: string;
  name: string;
  format: string;
  content: PosterContent | MenuContent;
  status?: "draft" | "published" | "archived";
}): Promise<{ id: string; updated_at: string }> {
  const resp = await fetch(`${API_BASE}/poster/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`saveDraft ${resp.status}: ${text.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json.draft;
}
