/**
 * leadgrid-bulk-url.test.ts
 *
 * Unit-tester for bulk-URL-research-pipelinen (mig 0351):
 *   - URL-validering + dedup
 *   - Batch-processor m/ mock-runner: progress-tracking, has_pin,
 *     location_confidence, cancel-håndtering
 *   - finalizeBatch-status (completed / partial / failed)
 *
 * Vi mocker pool m/ en in-memory implementasjon — null faktisk DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";

import {
  normalizeAndValidateUrls,
  processUrlResearchBatch,
  readBatchProgress,
  BULK_URL_CONCURRENCY,
  __test,
} from "./leadgrid-url-batch-processor.js";

// ---------------------------------------------------------------------
// In-memory mock-pool
// ---------------------------------------------------------------------

interface BatchRow {
  id: string;
  organization_id: string | null;
  created_by: string;
  total_urls: number;
  completed_urls: number;
  failed_urls: number;
  pinned_leads: number;
  status: string;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

interface ItemRow {
  id: string;
  batch_id: string;
  url: string;
  order_index: number;
  status: string;
  draft_lead_id: string | null;
  final_lead_id: string | null;
  has_pin: boolean;
  location_confidence: string | null;
  error_message: string | null;
  research_result: Record<string, unknown> | null;
  started_at: Date | null;
  finished_at: Date | null;
}

interface DraftRow {
  id: string;
  name: string;
  draft_status: string;
  latitude: number | null;
  longitude: number | null;
  location_confidence: string | null;
  import_raw_data: Record<string, unknown> | null;
}

function buildMockPool(seed: {
  batch: BatchRow;
  items: ItemRow[];
  drafts: DraftRow[];
}): Pool {
  const batches: BatchRow[] = [seed.batch];
  const items: ItemRow[] = [...seed.items];
  const drafts: DraftRow[] = [...seed.drafts];

  // Veldig løs SQL-parser — vi matcher kun de SQL-strings prosessoren faktisk bruker.
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const text = sql.replace(/\s+/g, " ").trim();
    // --- batch reads ---
    if (
      text.startsWith("SELECT status FROM leadgrid_url_research_batches")
    ) {
      const id = String(params?.[0]);
      const b = batches.find((x) => x.id === id);
      return { rows: b ? [{ status: b.status }] : [] };
    }
    if (
      text.startsWith(
        "SELECT organization_id::text, created_by::text FROM leadgrid_url_research_batches",
      )
    ) {
      const id = String(params?.[0]);
      const b = batches.find((x) => x.id === id);
      return {
        rows: b
          ? [
              {
                organization_id: b.organization_id,
                created_by: b.created_by,
              },
            ]
          : [],
      };
    }
    if (
      text.startsWith(
        "SELECT id::text, status, total_urls, completed_urls, failed_urls, pinned_leads, started_at, finished_at",
      )
    ) {
      const id = String(params?.[0]);
      const b = batches.find((x) => x.id === id);
      return {
        rows: b
          ? [
              {
                id: b.id,
                status: b.status,
                total_urls: b.total_urls,
                completed_urls: b.completed_urls,
                failed_urls: b.failed_urls,
                pinned_leads: b.pinned_leads,
                started_at: b.started_at,
                finished_at: b.finished_at,
              },
            ]
          : [],
      };
    }
    if (
      text.startsWith(
        "SELECT total_urls, completed_urls, failed_urls, status FROM leadgrid_url_research_batches",
      )
    ) {
      const id = String(params?.[0]);
      const b = batches.find((x) => x.id === id);
      return {
        rows: b
          ? [
              {
                total_urls: b.total_urls,
                completed_urls: b.completed_urls,
                failed_urls: b.failed_urls,
                status: b.status,
              },
            ]
          : [],
      };
    }
    if (
      text.startsWith(
        "SELECT completed_urls, failed_urls, pinned_leads, total_urls FROM leadgrid_url_research_batches",
      )
    ) {
      const id = String(params?.[0]);
      const b = batches.find((x) => x.id === id);
      return {
        rows: b
          ? [
              {
                completed_urls: b.completed_urls,
                failed_urls: b.failed_urls,
                pinned_leads: b.pinned_leads,
                total_urls: b.total_urls,
              },
            ]
          : [],
      };
    }
    // --- batch updates ---
    if (
      text.includes(
        "UPDATE leadgrid_url_research_batches SET status = 'running'",
      )
    ) {
      const id = String(params?.[0]);
      const b = batches.find((x) => x.id === id);
      if (b && b.status === "pending") {
        b.status = "running";
        b.started_at = b.started_at ?? new Date();
      }
      return { rows: [] };
    }
    if (
      text.startsWith(
        "UPDATE leadgrid_url_research_batches SET completed_urls = completed_urls + 1",
      )
    ) {
      const itemId = String(params?.[0]);
      const hasPin = Boolean(params?.[1]);
      const item = items.find((x) => x.id === itemId);
      if (item) {
        const b = batches.find((x) => x.id === item.batch_id);
        if (b) {
          b.completed_urls += 1;
          if (hasPin) b.pinned_leads += 1;
        }
      }
      return { rows: [] };
    }
    if (
      text.startsWith(
        "UPDATE leadgrid_url_research_batches SET failed_urls = failed_urls + 1",
      )
    ) {
      const itemId = String(params?.[0]);
      const item = items.find((x) => x.id === itemId);
      if (item) {
        const b = batches.find((x) => x.id === item.batch_id);
        if (b) b.failed_urls += 1;
      }
      return { rows: [] };
    }
    if (text.startsWith("UPDATE leadgrid_url_research_batches SET status = $2")) {
      const id = String(params?.[0]);
      const next = String(params?.[1]);
      const b = batches.find((x) => x.id === id);
      if (b) {
        b.status = next;
        b.finished_at = new Date();
      }
      return { rows: [] };
    }
    // --- item reads ---
    if (
      text.startsWith(
        "SELECT id::text, url, draft_lead_id::text, status FROM leadgrid_url_research_items",
      )
    ) {
      const batchId = String(params?.[0]);
      return {
        rows: items
          .filter((x) => x.batch_id === batchId && x.status === "pending")
          .sort((a, b) => a.order_index - b.order_index)
          .map((x) => ({
            id: x.id,
            url: x.url,
            draft_lead_id: x.draft_lead_id,
            status: x.status,
          })),
      };
    }
    // --- item updates ---
    if (
      text.startsWith(
        "UPDATE leadgrid_url_research_items SET status = 'running'",
      )
    ) {
      const id = String(params?.[0]);
      const item = items.find((x) => x.id === id);
      if (item) {
        item.status = "running";
        item.started_at = new Date();
      }
      return { rows: [] };
    }
    if (
      text.startsWith(
        "UPDATE leadgrid_url_research_items SET status = 'completed'",
      )
    ) {
      const id = String(params?.[0]);
      const hasPin = Boolean(params?.[1]);
      const confidence = String(params?.[2] ?? "");
      const item = items.find((x) => x.id === id);
      if (item) {
        item.status = "completed";
        item.has_pin = hasPin;
        item.location_confidence = confidence;
        item.finished_at = new Date();
      }
      return { rows: [] };
    }
    if (
      text.startsWith(
        "UPDATE leadgrid_url_research_items SET status = 'failed'",
      )
    ) {
      const id = String(params?.[0]);
      const msg = String(params?.[1] ?? "");
      const item = items.find((x) => x.id === id);
      if (item) {
        item.status = "failed";
        item.error_message = msg;
        item.finished_at = new Date();
      }
      return { rows: [] };
    }
    if (
      text.startsWith(
        "UPDATE leadgrid_url_research_items SET status = 'skipped'",
      )
    ) {
      const batchId = String(params?.[0]);
      for (const it of items) {
        if (
          it.batch_id === batchId &&
          (it.status === "pending" || it.status === "running")
        ) {
          it.status = "skipped";
          it.finished_at = new Date();
        }
      }
      return { rows: [] };
    }
    // --- draft update (applyResearchToDraftLite) ---
    if (text.startsWith("UPDATE crm_customers SET name")) {
      const id = String(params?.[0]);
      const lat = params?.[10] as number | null;
      const lng = params?.[11] as number | null;
      const confidence = String(params?.[12] ?? "");
      const raw = params?.[17] as string | undefined;
      const d = drafts.find((x) => x.id === id);
      if (d) {
        d.latitude = lat;
        d.longitude = lng;
        d.location_confidence = confidence;
        d.draft_status = "researched";
        if (raw) {
          try {
            d.import_raw_data = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            /* noop */
          }
        }
      }
      return { rows: [] };
    }
    if (text.startsWith("UPDATE crm_customers SET facebook_url")) {
      return { rows: [] };
    }
    throw new Error("unhandled mock SQL: " + text.slice(0, 100));
  });

  return { query, _store: { batches, items, drafts } } as unknown as Pool;
}

// ---------------------------------------------------------------------
// Mock runner — emuler runUrlResearch
// ---------------------------------------------------------------------

type RunnerOpts = { websiteUrl: string; draftId: string };

function makeRunner(behavior: Record<string, "exact" | "geocoded" | "approximate" | "unknown" | "fail" | "null">) {
  return vi.fn(async (opts: RunnerOpts) => {
    const b = behavior[opts.websiteUrl];
    if (!b || b === "fail") throw new Error("mock_fail: " + opts.websiteUrl);
    if (b === "null") return null;
    const hasPin = b !== "unknown";
    return {
      companyProfile: {
        name: "Mock " + opts.websiteUrl,
        company: "Mock " + opts.websiteUrl,
        email: null,
        phone: null,
        website: opts.websiteUrl,
        industry: null,
        organizationNumber: null,
        summary: null,
        logoUrl: null,
        socials: { instagram: null, linkedin: null, facebook: null },
        estimatedValueOere: null,
        aiOpportunityScore: null,
      },
      location: {
        latitude: hasPin ? 59.913 : null,
        longitude: hasPin ? 10.752 : null,
        confidence: b,
        source: "mock",
        address: null,
        postalCode: null,
        city: "Oslo",
        country: "NO",
      },
      bootstrapPayload: { mock: true },
    };
  });
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe("normalizeAndValidateUrls", () => {
  it("auto-prefixer https://", () => {
    const r = normalizeAndValidateUrls(["acme.no", "https://example.com"]);
    expect(r.valid).toEqual(["https://acme.no", "https://example.com"]);
    expect(r.invalid).toEqual([]);
  });

  it("dedupe på hostname+pathname", () => {
    const r = normalizeAndValidateUrls([
      "acme.no",
      "https://acme.no/",
      "https://acme.no",
      "https://acme.no/about",
    ]);
    expect(r.valid.length).toBe(2);
  });

  it("hopper over ugyldige URLer", () => {
    const r = normalizeAndValidateUrls([
      "ikke en url med space",
      "https://valid.com",
      "",
      "  ",
      "https:// space.com",
    ]);
    // https:// space.com becomes invalid
    expect(r.valid).toContain("https://valid.com");
  });

  it("returnerer tom liste for ikke-array", () => {
    expect(normalizeAndValidateUrls(null).valid).toEqual([]);
    expect(normalizeAndValidateUrls("foo").valid).toEqual([]);
    expect(normalizeAndValidateUrls(123).valid).toEqual([]);
  });

  it("hopper over ikke-string-elementer", () => {
    const r = normalizeAndValidateUrls(["https://ok.com", 42, null, undefined]);
    expect(r.valid).toEqual(["https://ok.com"]);
  });
});

describe("BULK_URL_CONCURRENCY", () => {
  it("default er 3 og innenfor [1, 10]", () => {
    expect(BULK_URL_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(BULK_URL_CONCURRENCY).toBeLessThanOrEqual(10);
  });
});

describe("processUrlResearchBatch", () => {
  let batchId: string;
  let userId: string;

  beforeEach(() => {
    batchId = "batch-1";
    userId = "user-1";
  });

  it("processer alle items + setter completed=total + status='completed'", async () => {
    const items: ItemRow[] = [
      {
        id: "i1",
        batch_id: batchId,
        url: "https://a.no",
        order_index: 0,
        status: "pending",
        draft_lead_id: "d1",
        final_lead_id: null,
        has_pin: false,
        location_confidence: null,
        error_message: null,
        research_result: null,
        started_at: null,
        finished_at: null,
      },
      {
        id: "i2",
        batch_id: batchId,
        url: "https://b.no",
        order_index: 1,
        status: "pending",
        draft_lead_id: "d2",
        final_lead_id: null,
        has_pin: false,
        location_confidence: null,
        error_message: null,
        research_result: null,
        started_at: null,
        finished_at: null,
      },
    ];
    const drafts: DraftRow[] = [
      { id: "d1", name: "x", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
      { id: "d2", name: "y", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
    ];
    const pool = buildMockPool({
      batch: {
        id: batchId,
        organization_id: "org-1",
        created_by: userId,
        total_urls: 2,
        completed_urls: 0,
        failed_urls: 0,
        pinned_leads: 0,
        status: "pending",
        started_at: null,
        finished_at: null,
        created_at: new Date(),
      },
      items,
      drafts,
    });
    const runner = makeRunner({
      "https://a.no": "exact",
      "https://b.no": "geocoded",
    });

    await processUrlResearchBatch(pool, batchId, { runner: runner as never, concurrency: 1 });

    const progress = await readBatchProgress(pool, batchId);
    expect(progress?.status).toBe("completed");
    expect(progress?.completed).toBe(2);
    expect(progress?.failed).toBe(0);
    expect(progress?.pinned).toBe(2);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(items[0].status).toBe("completed");
    expect(items[0].has_pin).toBe(true);
    expect(items[0].location_confidence).toBe("exact");
  });

  it("setter has_pin=false når confidence=unknown", async () => {
    const items: ItemRow[] = [
      {
        id: "i1",
        batch_id: batchId,
        url: "https://noplace.no",
        order_index: 0,
        status: "pending",
        draft_lead_id: "d1",
        final_lead_id: null,
        has_pin: false,
        location_confidence: null,
        error_message: null,
        research_result: null,
        started_at: null,
        finished_at: null,
      },
    ];
    const pool = buildMockPool({
      batch: {
        id: batchId,
        organization_id: null,
        created_by: userId,
        total_urls: 1,
        completed_urls: 0,
        failed_urls: 0,
        pinned_leads: 0,
        status: "pending",
        started_at: null,
        finished_at: null,
        created_at: new Date(),
      },
      items,
      drafts: [
        { id: "d1", name: "x", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
      ],
    });
    const runner = makeRunner({ "https://noplace.no": "unknown" });
    await processUrlResearchBatch(pool, batchId, { runner: runner as never, concurrency: 1 });

    const progress = await readBatchProgress(pool, batchId);
    expect(progress?.completed).toBe(1);
    expect(progress?.pinned).toBe(0); // ingen pin
    expect(items[0].has_pin).toBe(false);
    expect(items[0].location_confidence).toBe("unknown");
  });

  it("setter failed_urls + status='partial' når noen feiler", async () => {
    const items: ItemRow[] = [
      {
        id: "i1", batch_id: batchId, url: "https://ok.no", order_index: 0, status: "pending",
        draft_lead_id: "d1", final_lead_id: null, has_pin: false, location_confidence: null,
        error_message: null, research_result: null, started_at: null, finished_at: null,
      },
      {
        id: "i2", batch_id: batchId, url: "https://broken.no", order_index: 1, status: "pending",
        draft_lead_id: "d2", final_lead_id: null, has_pin: false, location_confidence: null,
        error_message: null, research_result: null, started_at: null, finished_at: null,
      },
    ];
    const pool = buildMockPool({
      batch: {
        id: batchId, organization_id: null, created_by: userId,
        total_urls: 2, completed_urls: 0, failed_urls: 0, pinned_leads: 0,
        status: "pending", started_at: null, finished_at: null, created_at: new Date(),
      },
      items,
      drafts: [
        { id: "d1", name: "x", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
        { id: "d2", name: "y", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
      ],
    });
    const runner = makeRunner({
      "https://ok.no": "geocoded",
      "https://broken.no": "fail",
    });
    await processUrlResearchBatch(pool, batchId, { runner: runner as never, concurrency: 1 });

    const progress = await readBatchProgress(pool, batchId);
    expect(progress?.status).toBe("partial");
    expect(progress?.completed).toBe(1);
    expect(progress?.failed).toBe(1);
    expect(progress?.pinned).toBe(1);
    expect(items[1].status).toBe("failed");
    expect(items[1].error_message).toContain("mock_fail");
  });

  it("setter status='failed' når alle feiler", async () => {
    const items: ItemRow[] = [
      {
        id: "i1", batch_id: batchId, url: "https://x.no", order_index: 0, status: "pending",
        draft_lead_id: "d1", final_lead_id: null, has_pin: false, location_confidence: null,
        error_message: null, research_result: null, started_at: null, finished_at: null,
      },
    ];
    const pool = buildMockPool({
      batch: {
        id: batchId, organization_id: null, created_by: userId,
        total_urls: 1, completed_urls: 0, failed_urls: 0, pinned_leads: 0,
        status: "pending", started_at: null, finished_at: null, created_at: new Date(),
      },
      items,
      drafts: [
        { id: "d1", name: "x", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
      ],
    });
    const runner = makeRunner({ "https://x.no": "fail" });
    await processUrlResearchBatch(pool, batchId, { runner: runner as never, concurrency: 1 });

    const progress = await readBatchProgress(pool, batchId);
    expect(progress?.status).toBe("failed");
    expect(progress?.failed).toBe(1);
  });

  it("respekter concurrency: max N parallelle samtidig", async () => {
    const items: ItemRow[] = Array.from({ length: 6 }, (_, i) => ({
      id: `i${i}`, batch_id: batchId, url: `https://${i}.no`, order_index: i,
      status: "pending", draft_lead_id: `d${i}`, final_lead_id: null,
      has_pin: false, location_confidence: null, error_message: null,
      research_result: null, started_at: null, finished_at: null,
    }));
    const drafts: DraftRow[] = items.map((it) => ({
      id: it.draft_lead_id!, name: "x", draft_status: "draft",
      latitude: null, longitude: null, location_confidence: null, import_raw_data: null,
    }));
    const pool = buildMockPool({
      batch: {
        id: batchId, organization_id: null, created_by: userId,
        total_urls: 6, completed_urls: 0, failed_urls: 0, pinned_leads: 0,
        status: "pending", started_at: null, finished_at: null, created_at: new Date(),
      },
      items, drafts,
    });

    let currentInFlight = 0;
    let maxInFlight = 0;
    const runner = vi.fn(async (opts: RunnerOpts) => {
      currentInFlight++;
      if (currentInFlight > maxInFlight) maxInFlight = currentInFlight;
      await new Promise((r) => setTimeout(r, 10));
      currentInFlight--;
      return {
        companyProfile: {
          name: opts.websiteUrl, company: opts.websiteUrl, email: null, phone: null,
          website: opts.websiteUrl, industry: null, organizationNumber: null,
          summary: null, logoUrl: null, socials: { instagram: null, linkedin: null, facebook: null },
          estimatedValueOere: null, aiOpportunityScore: null,
        },
        location: {
          latitude: 59.9, longitude: 10.7, confidence: "exact" as const,
          source: "mock", address: null, postalCode: null, city: null, country: null,
        },
        bootstrapPayload: {},
      };
    });

    await processUrlResearchBatch(pool, batchId, { runner: runner as never, concurrency: 3 });

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // bekreft at vi faktisk hadde parallelitet
    const progress = await readBatchProgress(pool, batchId);
    expect(progress?.completed).toBe(6);
  });

  it("returner-null fra runner = orchestrator_unavailable", async () => {
    const items: ItemRow[] = [
      {
        id: "i1", batch_id: batchId, url: "https://nullify.no", order_index: 0,
        status: "pending", draft_lead_id: "d1", final_lead_id: null,
        has_pin: false, location_confidence: null, error_message: null,
        research_result: null, started_at: null, finished_at: null,
      },
    ];
    const pool = buildMockPool({
      batch: {
        id: batchId, organization_id: null, created_by: userId,
        total_urls: 1, completed_urls: 0, failed_urls: 0, pinned_leads: 0,
        status: "pending", started_at: null, finished_at: null, created_at: new Date(),
      },
      items,
      drafts: [
        { id: "d1", name: "x", draft_status: "draft", latitude: null, longitude: null, location_confidence: null, import_raw_data: null },
      ],
    });
    const runner = makeRunner({ "https://nullify.no": "null" });
    await processUrlResearchBatch(pool, batchId, { runner: runner as never, concurrency: 1 });

    expect(items[0].status).toBe("failed");
    expect(items[0].error_message).toBe("orchestrator_unavailable");
  });
});

describe("__test utilities", () => {
  it("eksporterer interne helpers for granulær testing", () => {
    expect(typeof __test.applyResearchToDraftLite).toBe("function");
    expect(typeof __test.readBatchProgress).toBe("function");
  });
});
