/**
 * tender-board.ts — anbuds-arbeidsflaten (triage-tavle + frist-liste + radar)
 *
 * Ren, deterministisk bygging av tavle-data fra trigger_events:
 *   - dedup: samme kilde = tittel-Jaccard (korrigenda/dobbeltpublisering);
 *     på tvers av kilder = samme oppdragsgiver + publisert ≤ 14 dager fra
 *     hverandre (TED-titler er engelske, Doffin norske — tittelmatch på
 *     tvers av språk ville vært gjetting). Sammenslåtte kort beholder alle
 *     kildelenker så vurderingen kan verifiseres.
 *   - fit: krav × leverandørprofil via computeDeliveryFit (har/mangler/
 *     ubesvart — aldri gjettet).
 *   - radar: tildelte rammeavtaler → forventet re-utlysning ~2 år frem.
 *     ESTIMAT, samme antakelse som retender-radar-detektoren.
 */

import { computeDeliveryFit, type DeliveryFit } from "./supplier-profile.js";

export type BidStatus = "new" | "interested" | "bid" | "won" | "lost" | "dropped";

export const BID_STATUSES: BidStatus[] = ["new", "interested", "bid", "won", "lost", "dropped"];

export interface BoardTenderRow {
  source: string;
  event_id: string;
  kind: string;
  title: string;
  url: string | null;
  published_at: string | null;
  matched_topic: string;
  raw: {
    deadline?: string | null;
    valueNok?: number | null;
    buyerName?: string | null;
    requirements?: string[];
    isRfi?: boolean;
    bidStatus?: string;
    bidReason?: string | null;
    winnerName?: string | null;
    receivedTenders?: number | null;
  } | null;
}

export interface BoardTender {
  source: string;
  eventId: string;
  title: string;
  url: string | null;
  publishedAt: string | null;
  topic: string;
  deadline: string | null;
  valueNok: number | null;
  buyerName: string | null;
  isRfi: boolean;
  requirements: string[];
  fit: DeliveryFit | null;
  bidStatus: BidStatus;
  bidReason: string | null;
  /** Øvrige kunngjøringer slått sammen i dette kortet (verifiserbar dedup). */
  altSources: Array<{ source: string; eventId: string; url: string | null }>;
}

export interface RetenderWindow {
  title: string;
  buyerName: string | null;
  winnerName: string | null;
  valueNok: number | null;
  receivedTenders: number | null;
  awardedAt: string;
  url: string | null;
  topic: string;
  /** ESTIMAT: tildeling + 2 år (bransjenorm) — faktisk varighet står i grunnlaget. */
  expectedRetender: string; // YYYY-MM
}

// ─────────────────────────────────────────────────────────────────────
// Dedup (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-zæøå0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let both = 0;
  for (const t of a) if (b.has(t)) both += 1;
  return both / (a.size + b.size - both);
}

function normBuyer(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/\s+(as|asa|sa|ans|kf|iks|hf)$/i, "").trim();
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime());
  return ms / 86_400_000;
}

/** Hører de to kunngjøringene til samme anbud? Deterministiske regler. */
export function isSameTender(a: BoardTenderRow, b: BoardTenderRow): boolean {
  if (a.source === b.source) {
    // Samme kilde: korrigenda/dobbeltpublisering har nesten lik tittel.
    return jaccard(tokenize(a.title), tokenize(b.title)) >= 0.7;
  }
  // På tvers av kilder: språkene er ulike — krev samme oppdragsgiver og
  // publisering innen 14 dager. Uten oppdragsgiver: ingen match (heller
  // to kort enn ett galt sammenslått).
  const buyerA = normBuyer(a.raw?.buyerName);
  const buyerB = normBuyer(b.raw?.buyerName);
  if (!buyerA || !buyerB || buyerA !== buyerB) return false;
  const gap = daysBetween(a.published_at, b.published_at);
  return gap !== null && gap <= 14;
}

/** Grupperer rader som er samme anbud (grådig transitiv gruppering). */
export function dedupeTenders(rows: BoardTenderRow[]): BoardTenderRow[][] {
  const groups: BoardTenderRow[][] = [];
  for (const row of rows) {
    const home = groups.find((g) => g.some((member) => isSameTender(member, row)));
    if (home) home.push(row);
    else groups.push([row]);
  }
  return groups;
}

/** Doffin foran TED (norsk tekst, flere felt), deretter nyeste. */
function pickPrimary(group: BoardTenderRow[]): BoardTenderRow {
  return [...group].sort((a, b) => {
    if (a.source !== b.source) return a.source === "doffin" ? -1 : b.source === "doffin" ? 1 : 0;
    return (b.published_at ?? "").localeCompare(a.published_at ?? "");
  })[0];
}

function toBidStatus(raw: string | undefined): BidStatus {
  return BID_STATUSES.includes(raw as BidStatus) ? (raw as BidStatus) : "new";
}

// ─────────────────────────────────────────────────────────────────────
// Tavle-bygging
// ─────────────────────────────────────────────────────────────────────

export function buildTenderBoard(
  tenderRows: BoardTenderRow[],
  capabilities: Record<string, boolean> | null,
): BoardTender[] {
  return dedupeTenders(tenderRows).map((group) => {
    const p = pickPrimary(group);
    // Felt kan mangle på primæren men finnes på et sammenslått duplikat
    // (TED har frist, Doffin verdi, osv.) — ta første ikke-tomme.
    const first = <T>(get: (r: BoardTenderRow) => T | null | undefined): T | null => {
      for (const r of [p, ...group.filter((g) => g !== p)]) {
        const v = get(r);
        if (v !== null && v !== undefined && v !== "") return v;
      }
      return null;
    };
    const requirements = [...new Set(group.flatMap((r) => r.raw?.requirements ?? []))];
    // Triage-status kan være satt på hvilken som helst av de sammenslåtte
    // radene (kortet fantes kanskje før dedup) — ikke-new vinner.
    const statusRow = group.find((r) => toBidStatus(r.raw?.bidStatus) !== "new");
    return {
      source: p.source,
      eventId: p.event_id,
      title: p.title,
      url: p.url,
      publishedAt: p.published_at,
      topic: p.matched_topic,
      deadline: first((r) => r.raw?.deadline) as string | null,
      valueNok: first((r) => r.raw?.valueNok) as number | null,
      buyerName: first((r) => r.raw?.buyerName) as string | null,
      isRfi: group.some((r) => r.raw?.isRfi === true),
      requirements,
      fit: requirements.length > 0 ? computeDeliveryFit(requirements, capabilities) : null,
      bidStatus: toBidStatus(statusRow?.raw?.bidStatus),
      bidReason: statusRow?.raw?.bidReason ?? null,
      altSources: group
        .filter((r) => r !== p)
        .map((r) => ({ source: r.source, eventId: r.event_id, url: r.url })),
    };
  });
}

export function buildRetenderWindows(awardRows: BoardTenderRow[]): RetenderWindow[] {
  return awardRows
    .filter((r) => r.published_at)
    .map((r) => {
      const awarded = new Date(`${r.published_at}T00:00:00Z`);
      const expected = new Date(awarded);
      expected.setUTCFullYear(expected.getUTCFullYear() + 2);
      return {
        title: r.title,
        buyerName: r.raw?.buyerName ?? null,
        winnerName: r.raw?.winnerName ?? null,
        valueNok: r.raw?.valueNok ?? null,
        receivedTenders: r.raw?.receivedTenders ?? null,
        awardedAt: r.published_at as string,
        url: r.url,
        topic: r.matched_topic,
        expectedRetender: expected.toISOString().slice(0, 7),
      };
    })
    .sort(
      (a, b) =>
        a.expectedRetender.localeCompare(b.expectedRetender) ||
        a.awardedAt.localeCompare(b.awardedAt),
    );
}
