/**
 * control-center-release-monitor.ts
 *
 * Release-vakt — PROAKTIV leverandør-overvåkning i Control Center
 * (Documentation Intelligence release-monitor, mekanisk lag). En ukentlig cron
 * (GitHub Actions) henter siste release/versjon for leverandør-flatene som
 * historisk har gitt drift-overraskelser (Resolve, Xcode/SDK, Moodle, Blender,
 * Stripe SDK), sammenligner mot sist observerte versjon, og varsler super_admin
 * KUN ved versjons-transisjon. Impact-vurderingen (hva betyr releasen for oss)
 * gjøres etterpå med skill-pakken i `.claude/skills/documentation-intelligence/`
 * — cronen er bare deteksjonslaget.
 *
 * Kilde-disiplin (hallusinasjonsvakt fra skill-pakken): kun verifiserbare
 * offentlige kilder — GitHub REST API (releases/tags), Apples offisielle
 * release-RSS, og regex over Blackmagics support-side. Feilet henting/
 * ekstraksjon = status `error` (ærlig-inkonklusiv): synlig i status, men
 * varsler ALDRI og rører ikke versjons-tilstanden (unngår alarm-spam).
 *
 * Første kjøring per vakt etablerer baseline uten varsel.
 */

import type { Pool } from "pg";
import { notifyAdmins, type AdminInboundEvent } from "./admin-notify.js";

export type ReleaseStatus = "ok" | "updated" | "error";

export interface ReleaseCheckResult {
  key: string;
  label: string;
  status: ReleaseStatus;
  version: string | null;
  url: string | null;
  message: string;
}

const TIMEOUT_MS = 10_000;
const UA = "creatorhub-control-center-release-monitor";

async function timedFetch(fetchImpl: typeof fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "application/json, application/xml, text/html, */*" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export interface ReleaseWatchDef {
  key: string;
  label: string;
  /** Henter siste versjon fra kilden. Kaster/returnerer null-versjon = error. */
  run(fetchImpl: typeof fetch): Promise<{ version: string; url: string | null }>;
}

// ─── Hentestrategier ────────────────────────────────────────────────────────

function githubLatestRelease(repo: string): ReleaseWatchDef["run"] {
  return async (fetchImpl) => {
    const res = await timedFetch(fetchImpl, `https://api.github.com/repos/${repo}/releases/latest`);
    if (res.status !== 200) throw new Error(`GitHub releases HTTP ${res.status}`);
    const body = (await res.json()) as { tag_name?: string; html_url?: string };
    if (!body.tag_name) throw new Error("tag_name mangler i respons");
    return { version: body.tag_name, url: body.html_url ?? `https://github.com/${repo}/releases` };
  };
}

function githubLatestTag(repo: string, pattern: RegExp): ReleaseWatchDef["run"] {
  return async (fetchImpl) => {
    const res = await timedFetch(fetchImpl, `https://api.github.com/repos/${repo}/tags?per_page=30`);
    if (res.status !== 200) throw new Error(`GitHub tags HTTP ${res.status}`);
    const body = (await res.json()) as Array<{ name?: string }>;
    // ponytail: tags-endepunktet er «nyeste commits først», ikke semver-sortert —
    // første mønster-treff er godt nok for ukentlig deteksjon; sorter semver hvis det glipper.
    const hit = body.find((t) => t.name && pattern.test(t.name));
    if (!hit?.name) throw new Error("ingen tag matchet mønsteret");
    return { version: hit.name, url: `https://github.com/${repo}/tags` };
  };
}

function rssTitle(feedUrl: string, filter: RegExp): ReleaseWatchDef["run"] {
  return async (fetchImpl) => {
    const res = await timedFetch(fetchImpl, feedUrl);
    if (res.status !== 200) throw new Error(`RSS HTTP ${res.status}`);
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([^<\]]+)/g)].map((m) => m[1].trim());
    const hit = titles.find((t) => filter.test(t));
    if (!hit) throw new Error("ingen RSS-tittel matchet filteret");
    return { version: hit, url: feedUrl };
  };
}

function pageRegex(pageUrl: string, pattern: RegExp, prefix: string): ReleaseWatchDef["run"] {
  return async (fetchImpl) => {
    const res = await timedFetch(fetchImpl, pageUrl);
    if (res.status !== 200) throw new Error(`Side HTTP ${res.status}`);
    const html = await res.text();
    const m = pattern.exec(html);
    if (!m?.[1]) throw new Error("versjonsmønster ikke funnet på siden (mulig JS-rendret/endret layout)");
    return { version: `${prefix}${m[1]}`, url: pageUrl };
  };
}

// ─── Vaktene (jf. sources/vendors.yaml drift_watch i skill-pakken) ──────────

const WATCHES: ReleaseWatchDef[] = [
  {
    key: "resolve",
    label: "DaVinci Resolve",
    run: pageRegex(
      "https://www.blackmagicdesign.com/support/family/davinci-resolve-and-fusion",
      /DaVinci Resolve (\d+\.\d+(?:\.\d+)?)/,
      "",
    ),
  },
  {
    key: "xcode",
    label: "Xcode / Apple SDK",
    run: rssTitle("https://developer.apple.com/news/releases/rss/releases.rss", /Xcode \d/),
  },
  {
    key: "moodle",
    label: "Moodle LMS",
    run: githubLatestTag("moodle/moodle", /^v\d+\.\d+(\.\d+)?$/),
  },
  {
    key: "blender",
    label: "Blender",
    run: githubLatestTag("blender/blender", /^v\d+\.\d+(\.\d+)?$/),
  },
  {
    key: "stripe-node",
    label: "Stripe Node-SDK",
    run: githubLatestRelease("stripe/stripe-node"),
  },
];

// ─── Transisjonslogikk ──────────────────────────────────────────────────────

export type ReleaseTransition = "baseline" | "notify" | "none";

/**
 * prevVersion = sist lagrede versjon (null = aldri sett → baseline uten varsel).
 * Varsle kun når ny versjon avviker fra sist VARSLEDE (idempotent ved
 * notify-feil: last_notified oppdateres kun etter vellykket varsel-forsøk).
 */
export function releaseTransition(
  prevVersion: string | null,
  lastNotified: string | null,
  nowVersion: string,
): ReleaseTransition {
  if (prevVersion == null) return "baseline";
  if (nowVersion === prevVersion && nowVersion === (lastNotified ?? prevVersion)) return "none";
  if (nowVersion !== (lastNotified ?? prevVersion)) return "notify";
  return "none";
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

export interface ReleaseMonitorDeps {
  fetchImpl?: typeof fetch;
  notifyFn?: (pool: Pool, event: AdminInboundEvent) => Promise<void>;
  watches?: ReleaseWatchDef[];
}

export interface ReleaseMonitorSummary {
  ran: number;
  ok: number;
  updated: number;
  errors: number;
  results: ReleaseCheckResult[];
}

export async function runReleaseMonitor(pool: Pool, deps: ReleaseMonitorDeps = {}): Promise<ReleaseMonitorSummary> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const notifyFn = deps.notifyFn ?? notifyAdmins;
  const watches = deps.watches ?? WATCHES;

  const results: ReleaseCheckResult[] = [];
  let okCount = 0;
  let updated = 0;
  let errors = 0;

  for (const w of watches) {
    const prev = await prevFor(pool, w.key);
    let fetched: { version: string; url: string | null };
    try {
      fetched = await w.run(fetchImpl);
    } catch (err) {
      errors++;
      const message = `Henting feilet: ${(err as Error).message}`;
      results.push({ key: w.key, label: w.label, status: "error", version: prev.version, url: prev.url, message });
      // Inkonklusivt: oppdater kun checked_at/status/message — rør ikke versjonene.
      await upsert(pool, w.key, w.label, "error", prev.version, prev.url, message, prev.lastNotified);
      continue;
    }

    const action = releaseTransition(prev.version, prev.lastNotified, fetched.version);
    const status: ReleaseStatus = action === "notify" ? "updated" : "ok";
    const message =
      action === "baseline"
        ? `Baseline etablert: ${fetched.version}`
        : action === "notify"
          ? `Ny versjon: ${prev.version} → ${fetched.version}`
          : `Uendret (${fetched.version})`;
    results.push({ key: w.key, label: w.label, status, version: fetched.version, url: fetched.url, message });
    if (status === "ok") okCount++;

    let lastNotified = prev.lastNotified ?? (action === "baseline" ? fetched.version : null);
    if (action === "notify") {
      updated++;
      try {
        await notifyFn(pool, {
          type: "release_monitor",
          source: "Control Center · Release-vakt",
          title: `📦 Ny release: ${w.label} ${fetched.version}`,
          summary: `${message}. Kjør impact-vurdering med documentation-intelligence-skillen før oppgradering berører ${w.label}-flaten.`,
          link: fetched.url ?? "/admin?panel=control-center",
          relatedId: w.key,
        });
        lastNotified = fetched.version;
      } catch (err) {
        console.warn("[release-monitor] notify failed:", (err as Error).message);
        // lastNotified beholdes → nytt forsøk neste kjøring.
      }
    }

    await upsert(pool, w.key, w.label, status, fetched.version, fetched.url, message, lastNotified);
  }

  return { ran: results.length, ok: okCount, updated, errors, results };
}

async function prevFor(
  pool: Pool,
  key: string,
): Promise<{ version: string | null; url: string | null; lastNotified: string | null }> {
  try {
    const r = await pool.query(
      `SELECT version, url, last_notified_version FROM control_center_release_status WHERE watch_key = $1`,
      [key],
    );
    if (r.rows.length === 0) return { version: null, url: null, lastNotified: null };
    return {
      version: (r.rows[0].version as string | null) ?? null,
      url: (r.rows[0].url as string | null) ?? null,
      lastNotified: (r.rows[0].last_notified_version as string | null) ?? null,
    };
  } catch (err) {
    if (isMissingTable(err)) return { version: null, url: null, lastNotified: null };
    throw err;
  }
}

async function upsert(
  pool: Pool,
  key: string,
  label: string,
  status: ReleaseStatus,
  version: string | null,
  url: string | null,
  message: string,
  lastNotified: string | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO control_center_release_status
         (watch_key, label, status, version, url, message, checked_at, last_notified_version)
       VALUES ($1,$2,$3,$4,$5,$6, now(), $7)
       ON CONFLICT (watch_key) DO UPDATE SET
         label = EXCLUDED.label,
         status = EXCLUDED.status,
         version = EXCLUDED.version,
         url = EXCLUDED.url,
         message = EXCLUDED.message,
         checked_at = now(),
         last_notified_version = EXCLUDED.last_notified_version`,
      [key, label, status, version, url, message, lastNotified],
    );
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[release-monitor] upsert failed:", (err as Error).message);
  }
}

// ─── Status-visning ─────────────────────────────────────────────────────────

export interface ReleaseStatusView {
  key: string;
  label: string;
  status: ReleaseStatus | "unknown";
  version: string | null;
  url: string | null;
  message: string | null;
  checkedAt: string | null;
}

export interface ReleasesView {
  releases: ReleaseStatusView[];
  generatedAt: string;
}

export async function getReleaseStatus(pool: Pool): Promise<ReleasesView> {
  const generatedAt = new Date().toISOString();
  let rows = new Map<string, Record<string, unknown>>();
  try {
    const q = await pool.query(
      `SELECT watch_key, status, version, url, message, checked_at FROM control_center_release_status`,
    );
    rows = new Map(q.rows.map((r) => [r.watch_key as string, r]));
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[release-monitor] status query failed:", (err as Error).message);
  }
  const releases: ReleaseStatusView[] = WATCHES.map((w) => {
    const row = rows.get(w.key);
    return {
      key: w.key,
      label: w.label,
      status: row ? (row.status as ReleaseStatus) : "unknown",
      version: row ? ((row.version as string) ?? null) : null,
      url: row ? ((row.url as string) ?? null) : null,
      message: row ? ((row.message as string) ?? null) : null,
      checkedAt: row ? new Date(row.checked_at as string).toISOString() : null,
    };
  });
  return { releases, generatedAt };
}
