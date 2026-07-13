/**
 * media-watch.ts — RSS-bransjevakt (norske medier)
 *
 * Leser åpent publiserte RSS-feeds og matcher overskrifter mot
 * vertikal-nøkkelord og aktive lead-selskaper → 'strategy_media'-
 * triggere i samme rør som GDELT.
 *
 * Kildevalg (verifisert 2026-07-13):
 *  - NRK toppsaker + kultur (allmennkringkaster, åpne feeds)
 *  - Kampanje (bransjefeed, 40+ saker)
 *  - E24 er BEVISST UTELATT: feed-vilkårene tillater kun «personal use
 *    and indexing» — restriktivt nok til at vi holder oss unna
 *    (samme regel som finn.no). Dokumentert i registeret.
 *
 * Feeds og nøkkelord er justeringsflater.
 */

import type { Pool } from "pg";
import { TRIGGER_KEYWORDS } from "./sales-trigger-sync.js";

const FETCH_TIMEOUT_MS = 12_000;

export const MEDIA_FEEDS: Array<{ key: string; url: string }> = [
  { key: "nrk-toppsaker", url: "https://www.nrk.no/toppsaker.rss" },
  { key: "nrk-kultur", url: "https://www.nrk.no/kultur/toppsaker.rss" },
  { key: "kampanje", url: "https://www.kampanje.com/rss" },
];

export interface RssItem {
  title: string;
  link: string;
  pubDate: string | null; // YYYY-MM-DD
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** Minimal RSS 2.0-parser (ren funksjon, enhetstestet) — ingen deps. */
export function parseRssItems(xml: string): RssItem[] {
  const out: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = stripCdata(/<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "");
    const link = stripCdata(/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "");
    if (!title || !link) continue;
    const pubRaw = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1]?.trim();
    let pubDate: string | null = null;
    if (pubRaw) {
      const d = new Date(pubRaw);
      if (!Number.isNaN(d.getTime())) pubDate = d.toISOString().slice(0, 10);
    }
    out.push({ title, link, pubDate });
  }
  return out;
}

/**
 * Ord-grense-match (gjenbruker GEO-ekstraksjonens prinsipp): «dans»
 * skal ikke treffe «danske». Case-insensitiv.
 */
export function titleMatches(title: string, needle: string): boolean {
  const lower = title.toLowerCase();
  const n = needle.toLowerCase();
  let from = 0;
  let idx = -1;
  while ((idx = lower.indexOf(n, from)) !== -1) {
    const before = idx === 0 ? " " : lower[idx - 1];
    const afterPos = idx + n.length;
    const after = afterPos >= lower.length ? " " : lower[afterPos];
    if (!/[a-zæøå0-9]/.test(before) && !/[a-zæøå0-9]/.test(after)) return true;
    from = idx + 1;
  }
  return false;
}

async function fetchFeed(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface MediaWatchResult {
  feedsRead: number;
  itemsScanned: number;
  eventsInserted: number;
  errors: string[];
}

export async function runMediaWatch(pool: Pool): Promise<MediaWatchResult> {
  const errors: string[] = [];

  const sets = await pool.query<{ organization_id: string; name: string }>(
    `SELECT DISTINCT organization_id::text, name FROM geo_prompt_sets
      WHERE status = 'approved' AND organization_id IS NOT NULL`,
  );
  const leads = await pool.query<{ organization_id: string; name: string }>(
    `SELECT DISTINCT ON (c.organization_id, c.name) c.organization_id::text, c.name
       FROM crm_customers c
      WHERE c.organization_id IS NOT NULL AND c.archived_at IS NULL
        AND COALESCE(c.pipeline_stage, '') NOT IN ('won','lost')
        AND length(c.name) >= 5
      ORDER BY c.organization_id, c.name, c.updated_at DESC
      LIMIT 25`,
  );

  let feedsRead = 0;
  let itemsScanned = 0;
  let inserted = 0;

  for (const feed of MEDIA_FEEDS) {
    const xml = await fetchFeed(feed.url);
    if (!xml) {
      errors.push(`${feed.key}: feed utilgjengelig`);
      continue;
    }
    feedsRead += 1;
    const items = parseRssItems(xml);
    itemsScanned += items.length;

    for (const item of items) {
      // Vertikal-treff
      for (const set of sets.rows) {
        const keywords = TRIGGER_KEYWORDS[set.name] ?? [];
        if (!keywords.some((k) => titleMatches(item.title, k))) continue;
        inserted += await insertMediaEvent(pool, set.organization_id, feed.key, item, set.name, errors);
        break; // én vertikal per sak holder
      }
      // Lead-treff (selskapets navn i overskriften)
      for (const lead of leads.rows) {
        if (!titleMatches(item.title, lead.name)) continue;
        inserted += await insertMediaEvent(pool, lead.organization_id, feed.key, item, lead.name, errors);
      }
    }
  }

  return { feedsRead, itemsScanned, eventsInserted: inserted, errors };
}

async function insertMediaEvent(
  pool: Pool,
  orgId: string,
  feedKey: string,
  item: RssItem,
  topic: string,
  errors: string[],
): Promise<number> {
  try {
    const r = await pool.query(
      `INSERT INTO trigger_events
         (organization_id, source, event_id, kind, title, url, published_at, matched_topic, raw)
       VALUES ($1::uuid, 'rss', $2, 'strategy_media', $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (organization_id, source, event_id) DO NOTHING`,
      [orgId, item.link, item.title.slice(0, 500), item.link, item.pubDate, topic, JSON.stringify({ feed: feedKey })],
    );
    return r.rowCount ?? 0;
  } catch (err) {
    errors.push(`${feedKey}: ${String(err).slice(0, 80)}`);
    return 0;
  }
}
