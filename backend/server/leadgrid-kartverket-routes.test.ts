import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerLeadgridAdresseRoutes } from "./leadgrid-kartverket-routes.js";

function buildApp() {
  const app = express();
  registerLeadgridAdresseRoutes({
    app,
    requireUserSession: () => ({ userId: "seller-1" }),
  });
  return app;
}

function upstreamResponse(total = 720): Response {
  return new Response(JSON.stringify({
    metadata: {
      totaltAntallTreff: total,
      side: 0,
      treffPerSide: 350,
    },
    adresser: [
      {
        adressetekst: "Storgata 28B",
        postnummer: "0184",
        poststed: "OSLO",
        representasjonspunkt: { lat: 59.91393, lon: 10.75215 },
      },
      {
        adressetekst: "",
        postnummer: "0184",
        poststed: "OSLO",
        representasjonspunkt: { lat: null, lon: null },
      },
    ],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Leadgrid Kartverket address proxy", () => {
  it("reduserer upstream-payload og cacher samme side for URLSession", async () => {
    let upstreamUrl = "";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      upstreamUrl = String(input);
      return upstreamResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp();
    const path =
      "/api/leadgrid/kartverket/adresser/punkt" +
      "?lat=59.9139&lon=10.7522&radius=800&side=0&page_size=350";

    const first = await request(app).get(path);
    const second = await request(app).get(path);

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      total: 720,
      side: 0,
      page_size: 350,
      has_more: true,
      adresser: [{
        adressetekst: "Storgata 28B",
        postnummer: "0184",
        poststed: "OSLO",
        lat: 59.91393,
        lon: 10.75215,
      }],
    });
    expect(first.headers["x-leadgrid-cache"]).toBe("miss");
    expect(second.headers["x-leadgrid-cache"]).toBe("hit");
    expect(second.headers["cache-control"]).toContain("stale-while-revalidate");
    expect(second.headers.vary).toContain("Authorization");
    expect(fetchMock).toHaveBeenCalledOnce();

    const query = new URL(upstreamUrl).searchParams;
    expect(query.get("treffPerSide")).toBe("350");
    expect(query.get("koordsys")).toBe("4258");
    expect(query.get("utkoordsys")).toBe("4258");
    expect(query.get("asciiKompatibel")).toBe("false");
    expect(query.get("filtrer")).toContain("metadata.totaltAntallTreff");
    expect(query.get("filtrer")).toContain("adresser.representasjonspunkt");
  });

  it("slår sammen samtidige identiske Kartverket-kall", async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return upstreamResponse(100);
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = buildApp();
    const path =
      "/api/leadgrid/kartverket/adresser/punkt" +
      "?lat=59.9231&lon=10.7611&radius=500&side=0&page_size=350";

    const [first, second] = await Promise.all([
      request(app).get(path),
      request(app).get(path),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect([
      first.headers["x-leadgrid-cache"],
      second.headers["x-leadgrid-cache"],
    ].sort()).toEqual(["coalesced", "miss"]);
  });

  it("avviser ugyldige koordinater før upstream-kall", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(buildApp()).get(
      "/api/leadgrid/kartverket/adresser/punkt?lat=95&lon=10",
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("ugyldig_koordinat");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
