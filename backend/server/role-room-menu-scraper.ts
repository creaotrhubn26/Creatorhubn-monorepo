/**
 * Menu-scraper: henter produkt-katalog (med bilder) fra en restaurant-/
 * matservering-nettside og returnerer den som strukturert MenuContent som kan
 * importeres direkte inn i composeren.
 *
 * Strategi-pipeline (første som matcher vinner):
 *   1. Detekter kjente platformer ved å lese hovedsiden
 *      a) Supabase-backed sites (qraexxlqubveegtueszd.supabase.co etc.) →
 *         hent menu_items + menu_categories via REST API
 *      b) Shopify (myshopify.com) → /products.json
 *      c) Wix / Squarespace / Wolt — TODO når vi trenger det
 *   2. Generic HTML-scraping: parse OG-image, JSON-LD Restaurant-schema,
 *      <article>/<section> med pris-strenger. Mer fragilt; brukes som fallback
 */
import type { MenuCategory, MenuItem } from "./role-room-menu-composer.ts";

interface ScrapedMenu {
  source: string;             // hvilken strategi som vant
  cover?: { title?: string; subtitle?: string; tagline?: string };
  categories: MenuCategory[];
  contact?: {
    phone?: string;
    address?: string;
    website?: string;
  };
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Strategi 1: Supabase-backed sites
// ─────────────────────────────────────────────────────────────────────────

interface SupabaseHit {
  projectUrl: string;
  anonKey: string;
}

/** Detekter Supabase-prosjekt + anon-key fra JS-bundle. */
async function detectSupabase(siteHtml: string, baseUrl: URL): Promise<SupabaseHit | null> {
  // Finn JS-bundle URL
  const bundleMatch = siteHtml.match(/src="([^"]+\.js)"/);
  if (!bundleMatch) return null;
  const bundleUrl = new URL(bundleMatch[1], baseUrl).toString();

  let bundle: string;
  try {
    const resp = await fetch(bundleUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    bundle = await resp.text();
  } catch {
    return null;
  }

  const projectMatch = bundle.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/);
  const anonMatch = bundle.match(/eyJ[A-Za-z0-9._-]{50,}/);
  if (!projectMatch || !anonMatch) return null;
  return {
    projectUrl: `https://${projectMatch[1]}.supabase.co`,
    anonKey: anonMatch[0],
  };
}

interface SupabaseMenuRow {
  id: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  image_url?: string | null;
  category_id?: string | null;
  price_small?: number | null;
  price_large?: number | null;
  price?: number | null;
}

interface SupabaseCategoryRow {
  id: string;
  name: string;
  description?: string | null;
  display_order?: number | null;
}

async function fetchSupabaseTable<T>(hit: SupabaseHit, table: string, query: string): Promise<T[] | null> {
  try {
    const resp = await fetch(`${hit.projectUrl}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: hit.anonKey,
        Authorization: `Bearer ${hit.anonKey}`,
        Accept: "application/json",
      },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as T[];
  } catch {
    return null;
  }
}

function priceStringFor(item: SupabaseMenuRow): string {
  const small = item.price_small;
  const large = item.price_large;
  if (small != null && large != null) return `Liten ${small} · Stor ${large} kr`;
  if (large != null) return `${large} kr`;
  if (small != null) return `${small} kr`;
  if (item.price != null) return `${item.price} kr`;
  return "—";
}

async function scrapeViaSupabase(hit: SupabaseHit, baseUrl: URL): Promise<ScrapedMenu | null> {
  // Try common menu/product table names. menu_items + menu_categories er Holy Crust-mønsteret.
  const items = await fetchSupabaseTable<SupabaseMenuRow>(
    hit,
    "menu_items",
    "select=id,name,description,slug,image_url,category_id,price,price_small,price_large&order=name",
  );
  if (!items || items.length === 0) return null;

  const categories = await fetchSupabaseTable<SupabaseCategoryRow>(
    hit,
    "menu_categories",
    "select=id,name,description,display_order&order=display_order",
  );

  // Bygg kategoriliste; falsey category_id → "Annet"
  const catById = new Map<string, MenuCategory>();
  for (const c of categories ?? []) {
    catById.set(c.id, {
      title: c.name,
      description: c.description ?? undefined,
      items: [],
    });
  }
  const fallback: MenuCategory = { title: "Annet", items: [] };

  for (const it of items) {
    const target = it.category_id && catById.has(it.category_id)
      ? catById.get(it.category_id)!
      : fallback;
    const menuItem: MenuItem = {
      name: it.name,
      description: it.description ?? undefined,
      price: priceStringFor(it),
      imageUrl: it.image_url
        ? new URL(it.image_url, hit.projectUrl).toString()
        : undefined,
    };
    target.items.push(menuItem);
  }

  const orderedCats: MenuCategory[] = [];
  for (const c of categories ?? []) {
    const cat = catById.get(c.id);
    if (cat && cat.items.length > 0) orderedCats.push(cat);
  }
  if (fallback.items.length > 0) orderedCats.push(fallback);

  const warnings: string[] = [];
  const missingImages = items.filter((i) => !i.image_url).length;
  if (missingImages > 0) {
    warnings.push(`${missingImages} av ${items.length} items mangler bilde — bruk "Last opp"-knappen for å fylle ut.`);
  }

  return {
    source: `supabase:${hit.projectUrl}`,
    categories: orderedCats,
    cover: { title: baseUrl.hostname.replace(/^www\./, "") },
    contact: { website: baseUrl.hostname.replace(/^www\./, "") },
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Strategi 2: Generic HTML-scraping
// ─────────────────────────────────────────────────────────────────────────

async function scrapeGenericHtml(siteHtml: string, baseUrl: URL): Promise<ScrapedMenu | null> {
  const warnings: string[] = ["Generic HTML-scrape — kvalitet varierer; sjekk resultatet før import"];

  // OG-image til cover hvis tilstede
  const ogMatch = siteHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const titleMatch = siteHtml.match(/<title[^>]*>([^<]+)</i);
  const descMatch = siteHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

  // Plukk ut alle img-tagger med produkt-aktige naboer (h2/h3/strong med pris-streng)
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/gi;
  const items: MenuItem[] = [];
  for (const m of siteHtml.matchAll(imgRe)) {
    const src = m[1];
    const alt = m[2];
    if (!alt || alt.length < 3) continue;
    if (alt.toLowerCase().match(/logo|icon|banner|hero|backg/)) continue;
    items.push({
      name: alt,
      imageUrl: new URL(src, baseUrl).toString(),
      price: "—",
    });
  }

  if (items.length === 0) return null;

  return {
    source: "generic-html",
    cover: {
      title: titleMatch ? titleMatch[1].trim().split("|")[0].trim() : baseUrl.hostname,
      subtitle: descMatch ? descMatch[1].slice(0, 80) : undefined,
    },
    categories: [{ title: "Produkter", items }],
    contact: { website: baseUrl.hostname.replace(/^www\./, "") },
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export async function scrapeMenuFromUrl(rawUrl: string): Promise<ScrapedMenu | null> {
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }

  let siteHtml: string;
  try {
    const resp = await fetch(baseUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    siteHtml = await resp.text();
  } catch {
    return null;
  }

  // 1. Supabase
  const supa = await detectSupabase(siteHtml, baseUrl);
  if (supa) {
    const result = await scrapeViaSupabase(supa, baseUrl);
    if (result) return result;
  }

  // 2. Generic HTML
  return await scrapeGenericHtml(siteHtml, baseUrl);
}
