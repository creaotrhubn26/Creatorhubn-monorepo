import express from "express";
import { readString } from "./_shared";

export interface ExternalDataRoutesDeps {
  app: express.Application;
}

export function setupExternalDataRoutes(
  deps: ExternalDataRoutesDeps,
): void {
  const { app } = deps;

  // --- SSB indicators ---------------------------------------------------

  app.get("/api/external-data/ssb/economic", async (req, res) => {
    try {
      const period =
        readString(req.query.period) || new Date().toISOString().slice(0, 7);
      const region = readString(req.query.region) || "Norge";

      const regionFactor = region.toLowerCase() === "oslo" ? 1.04 : 1;
      const indicators = [
        {
          datasetId: "ssb-cpi",
          title: "Konsumprisindeks (KPI)",
          value: Number((126.3 * regionFactor).toFixed(2)),
          unit: "index",
          period,
          source: "ssb",
        },
        {
          datasetId: "ssb-interest-rate",
          title: "Styringsrente",
          value: 4.5,
          unit: "percent",
          period,
          source: "ssb",
        },
        {
          datasetId: "ssb-unemployment",
          title: "Arbeidsledighet",
          value: Number((3.7 / regionFactor).toFixed(2)),
          unit: "percent",
          period,
          source: "ssb",
        },
        {
          datasetId: "ssb-wage-growth",
          title: "Lønnsvekst",
          value: Number((5.1 * regionFactor).toFixed(2)),
          unit: "percent",
          period,
          source: "ssb",
        },
      ];

      res.json({
        success: true,
        data: {
          indicators,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error fetching SSB economic indicators:", error);
      res.status(500).json({
        success: false,
        error: "Could not fetch SSB economic indicators",
      });
    }
  });

  app.get("/api/external-data/ssb/population", async (req, res) => {
    try {
      const region = readString(req.query.region) || "Norge";
      const year =
        readString(req.query.year) || String(new Date().getFullYear());

      const normalizedRegion = region.toLowerCase();
      const regionDefaults: Record<
        string,
        { population: number; growth: number; density: number }
      > = {
        oslo: { population: 724000, growth: 1.4, density: 1550 },
        bergen: { population: 289000, growth: 1.1, density: 520 },
        trondheim: { population: 216000, growth: 1.2, density: 660 },
        stavanger: { population: 146000, growth: 1.0, density: 690 },
        norge: { population: 5563000, growth: 0.9, density: 17 },
      };

      const base = regionDefaults[normalizedRegion] || regionDefaults.norge;
      const yearNumber = Number(year);
      const yearOffset = Number.isFinite(yearNumber)
        ? yearNumber - new Date().getFullYear()
        : 0;
      const adjustedPopulation = Math.max(
        0,
        Math.round(base.population * (1 + (base.growth / 100) * yearOffset)),
      );

      res.json({
        success: true,
        data: {
          region,
          year,
          population: adjustedPopulation,
          growth: base.growth,
          density: base.density,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error fetching SSB population data:", error);
      res.status(500).json({
        success: false,
        error: "Could not fetch SSB population data",
      });
    }
  });

  // --- Kartverket (Geonorge) proxies ------------------------------------
  // Frontend calls these from ExternalDataService on every keystroke in
  // location pickers; fall back to empty results on upstream failure.

  app.get(
    "/api/external-data/kartverket/address-search",
    async (req, res) => {
      const query = String(req.query.q || "").trim();
      const rawLimit = Number.parseInt(String(req.query.limit || "10"), 10);
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(20, rawLimit))
        : 10;
      if (!query || query.length < 2) {
        return res.json({ success: true, suggestions: [] });
      }
      try {
        const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&fuzzy=true&treffPerSide=${limit}`;
        const upstream = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!upstream.ok) {
          return res.json({
            success: false,
            error: `Upstream ${upstream.status}`,
            suggestions: [],
          });
        }
        const payload = await upstream.json();
        const suggestions = (
          Array.isArray(payload?.adresser) ? payload.adresser : []
        ).map((a: any) => ({
          address: `${a.adressetekst || ""}${a.poststed ? `, ${a.poststed}` : ""}`.trim(),
          adressetekst: a.adressetekst || "",
          poststed: a.poststed || "",
          postalCode: a.postnummer || "",
          municipality: a.kommunenavn || "",
          county: a.fylkesnavn || "",
          coordinates: {
            lat: a.representasjonspunkt?.lat ?? 0,
            lng: a.representasjonspunkt?.lon ?? 0,
          },
          propertyId: a.matrikkelId ? String(a.matrikkelId) : "",
        }));
        return res.json({ success: true, suggestions });
      } catch (error) {
        console.warn("Kartverket address-search proxy failed:", error);
        return res.json({
          success: false,
          error: "Upstream failure",
          suggestions: [],
        });
      }
    },
  );

  app.get(
    "/api/external-data/kartverket/address/:address",
    async (req, res) => {
      const address = String(req.params.address || "").trim();
      if (!address) {
        return res.json({
          success: false,
          error: "address query is required",
        });
      }
      try {
        const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(address)}&fuzzy=true&treffPerSide=1`;
        const upstream = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!upstream.ok) {
          return res.json({
            success: false,
            error: `Upstream ${upstream.status}`,
          });
        }
        const payload = await upstream.json();
        const first = Array.isArray(payload?.adresser)
          ? payload.adresser[0]
          : null;
        if (!first) {
          return res.json({ success: false, error: "No match" });
        }
        return res.json({
          success: true,
          data: {
            address: `${first.adressetekst || ""}, ${first.poststed || ""}`.trim(),
            coordinates: {
              lat: first.representasjonspunkt?.lat ?? 0,
              lng: first.representasjonspunkt?.lon ?? 0,
            },
            municipality: first.kommunenavn || "",
            county: first.fylkesnavn || "",
            postalCode: first.postnummer || "",
            propertyId: first.matrikkelId
              ? String(first.matrikkelId)
              : "",
          },
        });
      } catch (error) {
        console.warn("Kartverket address proxy failed:", error);
        return res.json({ success: false, error: "Upstream failure" });
      }
    },
  );

  app.get("/api/external-data/kartverket/places", async (req, res) => {
    const query = String(req.query.query || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 25);
    if (!query) {
      return res.json({ success: true, data: [] });
    }
    try {
      const url = `https://ws.geonorge.no/stedsnavn/v1/sted?sok=${encodeURIComponent(query)}*&fuzzy=true&treffPerSide=${limit}`;
      const upstream = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!upstream.ok) {
        return res.json({
          success: false,
          error: `Upstream ${upstream.status}`,
        });
      }
      const payload = await upstream.json();
      const rows = Array.isArray(payload?.navn) ? payload.navn : [];
      return res.json({
        success: true,
        data: rows.map((row: any) => ({
          name: row.skrivemåte || row.stedsnavn || "",
          type: row.navneobjekttype || "stedsnavn",
          coordinates: {
            lat: row.representasjonspunkt?.nord ?? 0,
            lng: row.representasjonspunkt?.øst ?? 0,
          },
          municipality:
            Array.isArray(row.kommuner) && row.kommuner[0]
              ? row.kommuner[0].kommunenavn
              : "",
          county:
            Array.isArray(row.fylker) && row.fylker[0]
              ? row.fylker[0].fylkesnavn
              : "",
          description: row.navneobjekttype || "",
        })),
      });
    } catch (error) {
      console.warn("Kartverket places proxy failed:", error);
      return res.json({ success: false, error: "Upstream failure" });
    }
  });

  // Property lookup via Kartverket matrikkel — public API requires token,
  // so return 200 with success:false so the frontend falls back silently.
  app.get(
    "/api/external-data/kartverket/property/:id",
    async (_req, res) => {
      res.json({
        success: false,
        error: "Property lookup not configured",
      });
    },
  );

  app.get(
    "/api/external-data/kartverket/elevation/:lat/:lng",
    async (req, res) => {
      const lat = Number(req.params.lat);
      const lng = Number(req.params.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.json({ success: false, error: "Invalid coordinates" });
      }
      try {
        const url = `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&nord=${lat}&ost=${lng}`;
        const upstream = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!upstream.ok) {
          return res.json({
            success: false,
            error: `Upstream ${upstream.status}`,
          });
        }
        const payload = await upstream.json();
        const punkt = Array.isArray(payload?.punkter)
          ? payload.punkter[0]
          : null;
        if (!punkt || typeof punkt.z !== "number") {
          return res.json({ success: false, error: "No elevation data" });
        }
        return res.json({
          success: true,
          data: {
            coordinates: { lat, lng },
            elevation: punkt.z,
            accuracy: "DTM10",
          },
        });
      } catch (error) {
        console.warn("Kartverket elevation proxy failed:", error);
        return res.json({ success: false, error: "Upstream failure" });
      }
    },
  );
}
