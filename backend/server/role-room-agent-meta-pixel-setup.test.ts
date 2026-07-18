import { describe, expect, it } from "vitest";

import { pickAdAccount, runMetaPixelSetup, type MetaFetcher } from "./role-room-agent-meta-pixel-setup.js";

function fakeFetcher(routes: Array<[RegExp, string, { status: number; json?: unknown }]>): { fetcher: MetaFetcher; calls: Array<{ url: string; method: string; body?: string }> } {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetcher: MetaFetcher = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    for (const [pattern, method, res] of routes) {
      if (method === init.method && pattern.test(url)) return { status: res.status, json: res.json ?? {} };
    }
    return { status: 404, json: {} };
  };
  return { fetcher, calls };
}

describe("pickAdAccount", () => {
  it("aktiv konto foretrekkes; tom liste gir null", () => {
    expect(pickAdAccount([
      { id: "act_1", account_status: 2 },
      { id: "act_2", account_status: 1 },
    ])?.id).toBe("act_2");
    expect(pickAdAccount([])).toBeNull();
  });
});

describe("runMetaPixelSetup", () => {
  it("oppretter navngitt pixel når kontoen ikke har noen", async () => {
    const { fetcher, calls } = fakeFetcher([
      [/me\/adaccounts/, "GET", { status: 200, json: { data: [{ id: "act_9", name: "Medside Ads", account_status: 1 }] } }],
      [/act_9\/adspixels\?fields/, "GET", { status: 200, json: { data: [] } }],
      [/act_9\/adspixels$/, "POST", { status: 200, json: { id: "111222333" } }],
    ]);
    const outcome = await runMetaPixelSetup({ accessToken: "t", domain: "https://www.medside.no/", fetcher });
    expect(outcome).toMatchObject({ ok: true, result: { pixelId: "111222333", pixelCreated: true, adAccountId: "act_9" } });
    expect(calls.find((c) => c.method === "POST")!.body).toContain("medside.no+pixel");
  });

  it("gjenbruker eksisterende pixel — med verifiserings-advarsel ved navne-mismatch", async () => {
    const { fetcher } = fakeFetcher([
      [/me\/adaccounts/, "GET", { status: 200, json: { data: [{ id: "act_9", account_status: 1 }] } }],
      [/adspixels\?fields/, "GET", { status: 200, json: { data: [{ id: "555", name: "Gammel pixel" }] } }],
    ]);
    const outcome = await runMetaPixelSetup({ accessToken: "t", domain: "medside.no", fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.pixelCreated).toBe(false);
    expect(outcome.result.pixelId).toBe("555");
    expect(outcome.result.warnings.some((w) => w.includes("verifiser"))).toBe(true);
  });

  it("utløpt token (code 190) → needsReauth; ingen annonsekonto → ærlig feil", async () => {
    const expired = fakeFetcher([[/me\/adaccounts/, "GET", { status: 400, json: { error: { code: 190, message: "Token expired" } } }]]);
    expect(await runMetaPixelSetup({ accessToken: "t", domain: "medside.no", fetcher: expired.fetcher })).toMatchObject({ ok: false, needsReauth: true });

    const empty = fakeFetcher([[/me\/adaccounts/, "GET", { status: 200, json: { data: [] } }]]);
    const outcome = await runMetaPixelSetup({ accessToken: "t", domain: "medside.no", fetcher: empty.fetcher });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain("Business Manager");
  });

  it("inaktiv konto gir advarsel, men pixelen settes opp", async () => {
    const { fetcher } = fakeFetcher([
      [/me\/adaccounts/, "GET", { status: 200, json: { data: [{ id: "act_9", name: "X", account_status: 2 }] } }],
      [/adspixels\?fields/, "GET", { status: 200, json: { data: [] } }],
      [/adspixels$/, "POST", { status: 200, json: { id: "777" } }],
    ]);
    const outcome = await runMetaPixelSetup({ accessToken: "t", domain: "medside.no", fetcher });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.warnings.some((w) => w.includes("ikke aktiv"))).toBe(true);
  });
});
