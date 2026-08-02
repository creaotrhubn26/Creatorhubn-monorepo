import { describe, expect, it } from "vitest";

import { pickExistingProperty, runGa4Setup, type Ga4Fetcher } from "./role-room-agent-ga4-setup.js";

function fakeFetcher(routes: Array<[RegExp, string, { status: number; json?: unknown }]>): { fetcher: Ga4Fetcher; calls: Array<{ url: string; method: string; body?: string }> } {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetcher: Ga4Fetcher = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    for (const [pattern, method, res] of routes) {
      if (method === init.method && pattern.test(url)) return { status: res.status, json: res.json ?? {} };
    }
    return { status: 404, json: {} };
  };
  return { fetcher, calls };
}

describe("pickExistingProperty", () => {
  it("matcher displayName mot normalisert domene (www/https ignoreres)", () => {
    const summaries = [
      { account: "accounts/1", propertySummaries: [{ property: "properties/9", displayName: "www.Medside.no" }] },
    ];
    expect(pickExistingProperty(summaries, "https://medside.no/")).toEqual({ account: "accounts/1", property: "properties/9" });
    expect(pickExistingProperty(summaries, "annen.no")).toBeNull();
  });
});

describe("runGa4Setup", () => {
  it("full opprettelses-sti: property → strøm → retention → key events", async () => {
    const { fetcher, calls } = fakeFetcher([
      [/accountSummaries/, "GET", { status: 200, json: { accountSummaries: [{ account: "accounts/1", displayName: "Medinnova" }] } }],
      [/\/properties$/, "POST", { status: 200, json: { name: "properties/42" } }],
      [/properties\/42\/dataStreams$/, "GET", { status: 200, json: { dataStreams: [] } }],
      [/properties\/42\/dataStreams$/, "POST", { status: 200, json: { webStreamData: { measurementId: "G-NYID123" } } }],
      [/dataRetentionSettings/, "PATCH", { status: 200 }],
      [/keyEvents$/, "POST", { status: 200 }],
    ]);
    const outcome = await runGa4Setup({ accessToken: "t", domain: "medside.no", goals: ["lead", "booking"], fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result).toMatchObject({
      propertyId: "properties/42",
      propertyCreated: true,
      measurementId: "G-NYID123",
      streamCreated: true,
      retentionSet: true,
    });
    // lead_submitted + book_demo_submitted er key events; book_demo_clicked er ikke
    expect(outcome.result.keyEvents.map((k) => k.eventName).sort()).toEqual(["book_demo_submitted", "lead_submitted"]);
    // Property opprettes med Oslo/NOK
    const createBody = calls.find((c) => /\/properties$/.test(c.url) && c.method === "POST")!.body!;
    expect(createBody).toContain("Europe/Oslo");
    expect(createBody).toContain("NOK");
  });

  it("gjenbruks-sti er idempotent: eksisterende property/strøm, 409 på key event = already_exists", async () => {
    const { fetcher } = fakeFetcher([
      [/accountSummaries/, "GET", { status: 200, json: { accountSummaries: [
        { account: "accounts/1", propertySummaries: [{ property: "properties/9", displayName: "medside.no" }] },
      ] } }],
      [/properties\/9\/dataStreams$/, "GET", { status: 200, json: { dataStreams: [
        { name: "properties/9/dataStreams/1", type: "WEB_DATA_STREAM", webStreamData: { measurementId: "G-EKSIST1", defaultUri: "https://medside.no" } },
      ] } }],
      [/dataRetentionSettings/, "PATCH", { status: 200 }],
      [/keyEvents$/, "POST", { status: 409 }],
    ]);
    const outcome = await runGa4Setup({ accessToken: "t", domain: "medside.no", goals: ["lead"], fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.propertyCreated).toBe(false);
    expect(outcome.result.streamCreated).toBe(false);
    expect(outcome.result.measurementId).toBe("G-EKSIST1");
    expect(outcome.result.keyEvents[0]).toEqual({ eventName: "lead_submitted", status: "already_exists" });
  });

  it("403 → needsReauth (scope-utvidelsen krever ny innlogging)", async () => {
    const { fetcher } = fakeFetcher([[/accountSummaries/, "GET", { status: 403 }]]);
    const outcome = await runGa4Setup({ accessToken: "t", domain: "medside.no", goals: [], fetcher });
    expect(outcome).toMatchObject({ ok: false, needsReauth: true });
  });

  it("ingen GA4-konto → ærlig feil med henvisning til manuell konto-opprettelse", async () => {
    const { fetcher } = fakeFetcher([[/accountSummaries/, "GET", { status: 200, json: { accountSummaries: [] } }]]);
    const outcome = await runGa4Setup({ accessToken: "t", domain: "medside.no", goals: [], fetcher });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain("kan ikke opprettes via API");
  });

  it("retention-feil velter ikke oppsettet — blir advarsel", async () => {
    const { fetcher } = fakeFetcher([
      [/accountSummaries/, "GET", { status: 200, json: { accountSummaries: [
        { account: "accounts/1", propertySummaries: [{ property: "properties/9", displayName: "medside.no" }] },
      ] } }],
      [/dataStreams$/, "GET", { status: 200, json: { dataStreams: [
        { name: "s", type: "WEB_DATA_STREAM", webStreamData: { measurementId: "G-X", defaultUri: "https://medside.no" } },
      ] } }],
      [/dataRetentionSettings/, "PATCH", { status: 403 }],
    ]);
    const outcome = await runGa4Setup({ accessToken: "t", domain: "medside.no", goals: [], fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.retentionSet).toBe(false);
    expect(outcome.result.warnings.some((w) => w.includes("14 mnd"))).toBe(true);
  });
});
