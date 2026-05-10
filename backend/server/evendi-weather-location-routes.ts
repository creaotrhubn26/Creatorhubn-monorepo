/**
 * evendi-weather-location-routes.ts
 *
 * Setup-funksjon for /api/evendi/weather-location/* endpoints — bridger
 * Kartverket (adresse-søk), YR.no (vær-prognose) og reise-kostnad-
 * beregning mellom CreatorHub-fotograf og Evendi-brudepar.
 *
 * 6 endpoints:
 *   - GET  /weather-location/:coupleId                              (full vær + sted + reise-info for venue)
 *   - POST /weather-location/:coupleId/venue                        (oppdater venue-koordinater + frisk vær)
 *   - GET  /weather-location/:coupleId/travel                       (reise fra origin til venue + vær begge steder)
 *   - GET  /weather-location/:coupleId/event-weather                (vær per schedule-event)
 *   - POST /weather-location/sync-from-project/:projectId           (CreatorHub-prosjekt → Evendi)
 *   - GET  /weather-location/search                                 (Kartverket adresse-søk)
 *
 * Inkluderer 4 module-scope helpers som bare brukes her — flyttet med:
 *   - YR_BRIDGE_CACHE (Map med 1-time TTL)
 *   - fetchYrWeatherBridge (YR.no locationforecast)
 *   - searchKartverketAddress (Geonorge adresse-søk)
 *   - calculateTravelInfo (great-circle + norske vei-faktorer)
 *
 * Auth: åpen — coupleId valideres via resolveCoupleId mot couple_profiles.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiWeatherLocationRoutes } from "./evendi-weather-location-routes";
 *
 *   setupEvendiWeatherLocationRoutes({ app, pool, resolveCoupleId });
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";

const YR_BRIDGE_CACHE: Map<string, { data: any; expires: Date }> = new Map();

async function fetchYrWeatherBridge(lat: number, lon: number): Promise<any> {
  const cacheKey = `yr_${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const cached = YR_BRIDGE_CACHE.get(cacheKey);
  if (cached && cached.expires > new Date()) return cached.data;

  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "CreatorHub-Evendi-Bridge/1.0 github.com/creatorhub",
    },
  });
  if (!response.ok) throw new Error(`YR API error: ${response.status}`);
  const data = await response.json();
  const expiresHeader = response.headers.get("Expires");
  const expires = expiresHeader
    ? new Date(expiresHeader)
    : new Date(Date.now() + 3600000);
  YR_BRIDGE_CACHE.set(cacheKey, { data, expires });
  return data;
}

// Kartverket address search (Geonorge SOSI)
async function searchKartverketAddress(query: string): Promise<any> {
  try {
    const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&fuzzy=true&treffPerSide=5`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return { addresses: [], source: "error" };
    const data = await resp.json();
    return {
      addresses: (data.adresser || []).map((a: any) => ({
        address: `${a.adressetekst || ""}, ${a.poststed || ""}`,
        coordinates: {
          lat: a.representasjonspunkt?.lat || 0,
          lng: a.representasjonspunkt?.lon || 0,
        },
        municipality: a.kommunenavn || "",
        county: a.fylkesnavn || "",
        postalCode: a.postnummer || "",
        postalPlace: a.poststed || "",
      })),
      source: "kartverket",
    };
  } catch {
    return { addresses: [], source: "error" };
  }
}

// Calculate travel distance/time using a simple great-circle approximation
function calculateTravelInfo(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const R = 6371; // km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  const roadDistance = straightLine * 1.35; // approximate road factor for Norway
  const drivingMinutes = Math.round((roadDistance / 70) * 60); // ~70 km/h average Norwegian roads
  return {
    straightLineKm: Math.round(straightLine * 10) / 10,
    roadDistanceKm: Math.round(roadDistance * 10) / 10,
    drivingMinutes,
    drivingFormatted:
      drivingMinutes >= 60
        ? `${Math.floor(drivingMinutes / 60)}t ${drivingMinutes % 60}min`
        : `${drivingMinutes} min`,
    fuelCostNok: Math.round(roadDistance * 1.8 * 10) / 10, // ~1.8 NOK/km avg
    tollEstimateNok: roadDistance > 50 ? Math.round(roadDistance * 0.5) : 0,
  };
}

export interface EvendiWeatherLocationRoutesDeps {
  app: express.Application;
  pool: Pool;
  resolveCoupleId: (coupleIdParam: string) => Promise<string | null>;
}

export function setupEvendiWeatherLocationRoutes(
  deps: EvendiWeatherLocationRoutesDeps,
): void {
  const { app, pool, resolveCoupleId } = deps;

  // GET /api/evendi/weather-location/:coupleId — Full weather + location intelligence for couple's wedding venue
  app.get("/api/evendi/weather-location/:coupleId", async (req, res) => {
    try {
      const coupleId =
        (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;

      // Get couple profile with venue/wedding date
      const cpResult = await pool.query(
        `SELECT cp.id, cp.email, cp.display_name, cp.wedding_date, cp.wedding_venue,
                cp.partner_email, cp.partner_name
         FROM couple_profiles cp WHERE cp.id = $1`,
        [coupleId],
      );
      if (cpResult.rowCount === 0)
        return res.status(404).json({ error: "Brudepar ikke funnet" });
      const couple = cpResult.rows[0];

      // Try to get venue coordinates from couple's wedding_venue or timeline
      let venueCoords: { lat: number; lng: number } | null = null;
      let venueName = couple.wedding_venue || "";

      // Check if timeline has venue info
      const tlResult = await pool.query(
        `SELECT venue, timeline_data FROM wedding_timelines
         WHERE project_id IN (SELECT id FROM legacy.projects WHERE client_email = $1) LIMIT 1`,
        [couple.email],
      );
      if (tlResult.rowCount && tlResult.rows[0].venue) {
        venueName = venueName || tlResult.rows[0].venue;
      }
      const timelineData = tlResult.rowCount
        ? tlResult.rows[0].timeline_data || {}
        : {};

      // If stored coords in timeline_data
      if (timelineData.venueCoordinates) {
        venueCoords = timelineData.venueCoordinates;
      }

      // If no coords yet, try Kartverket lookup
      if (!venueCoords && venueName) {
        const kartResult = await searchKartverketAddress(venueName);
        if (kartResult.addresses.length > 0) {
          const addr = kartResult.addresses[0];
          venueCoords = addr.coordinates;
          venueName = addr.address;
          // Store coords for future use
          if (tlResult.rowCount) {
            await pool
              .query(
                `UPDATE wedding_timelines SET timeline_data = COALESCE(timeline_data, '{}')::jsonb || $1::jsonb, updated_at = NOW()
               WHERE id = $2`,
                [
                  JSON.stringify({
                    venueCoordinates: venueCoords,
                    venueMunicipality: addr.municipality,
                    venueCounty: addr.county,
                  }),
                  tlResult.rows[0]?.id || "",
                ],
              )
              .catch(() => {});
          }
        }
      }

      // Default fallback to Oslo if no venue info
      if (!venueCoords) {
        venueCoords = { lat: 59.9139, lng: 10.7522 };
        venueName = venueName || "Oslo (standard)";
      }

      // Fetch weather for venue
      let weather = null;
      try {
        const yrData = await fetchYrWeatherBridge(
          venueCoords.lat,
          venueCoords.lng,
        );
        const timeseries = yrData.properties?.timeseries || [];
        const now = timeseries[0];
        weather = {
          current: now
            ? {
                temperature: now.data?.instant?.details?.air_temperature,
                windSpeed: now.data?.instant?.details?.wind_speed,
                humidity: now.data?.instant?.details?.relative_humidity,
                pressure: now.data?.instant?.details?.air_pressure_at_sea_level,
                cloudCover: now.data?.instant?.details?.cloud_area_fraction,
                symbol:
                  now.data?.next_1_hours?.summary?.symbol_code ||
                  now.data?.next_6_hours?.summary?.symbol_code,
                precipitation:
                  now.data?.next_1_hours?.details?.precipitation_amount || 0,
                time: now.time,
              }
            : null,
          hourly: timeseries.slice(0, 24).map((t: any) => ({
            time: t.time,
            temperature: t.data?.instant?.details?.air_temperature,
            windSpeed: t.data?.instant?.details?.wind_speed,
            humidity: t.data?.instant?.details?.relative_humidity,
            symbol:
              t.data?.next_1_hours?.summary?.symbol_code ||
              t.data?.next_6_hours?.summary?.symbol_code,
            precipitation:
              t.data?.next_1_hours?.details?.precipitation_amount || 0,
          })),
          daily: timeseries
            .filter((_: any, i: number) => i % 6 === 0)
            .slice(0, 7)
            .map((t: any) => ({
              time: t.time,
              temperature: t.data?.instant?.details?.air_temperature,
              windSpeed: t.data?.instant?.details?.wind_speed,
              symbol: t.data?.next_6_hours?.summary?.symbol_code,
              precipitationMax:
                t.data?.next_6_hours?.details?.precipitation_amount || 0,
            })),
          weddingDayForecast: null as any,
        };

        // If wedding date is within the forecast range, extract that day's forecast
        if (couple.wedding_date) {
          const weddingDateStr = new Date(couple.wedding_date)
            .toISOString()
            .split("T")[0];
          const weddingDayEntries = timeseries.filter((t: any) =>
            t.time?.startsWith(weddingDateStr),
          );
          if (weddingDayEntries.length > 0) {
            weather.weddingDayForecast = {
              date: weddingDateStr,
              entries: weddingDayEntries.map((t: any) => ({
                time: t.time,
                temperature: t.data?.instant?.details?.air_temperature,
                windSpeed: t.data?.instant?.details?.wind_speed,
                humidity: t.data?.instant?.details?.relative_humidity,
                symbol:
                  t.data?.next_1_hours?.summary?.symbol_code ||
                  t.data?.next_6_hours?.summary?.symbol_code,
                precipitation:
                  t.data?.next_1_hours?.details?.precipitation_amount || 0,
              })),
              avgTemperature:
                Math.round(
                  (weddingDayEntries.reduce(
                    (s: number, t: any) =>
                      s + (t.data?.instant?.details?.air_temperature || 0),
                    0,
                  ) /
                    weddingDayEntries.length) *
                    10,
                ) / 10,
              maxPrecipitation: Math.max(
                ...weddingDayEntries.map(
                  (t: any) =>
                    t.data?.next_1_hours?.details?.precipitation_amount || 0,
                ),
              ),
              tips: [] as string[],
            };

            // Generate wedding day tips
            const avgTemp = weather.weddingDayForecast.avgTemperature;
            const maxPrecip = weather.weddingDayForecast.maxPrecipitation;
            const tips = weather.weddingDayForecast.tips;
            if (maxPrecip > 2)
              tips.push(
                "☂️ Regn forventet — ha paraply og Plan B for uteseremoni",
              );
            if (maxPrecip > 0 && maxPrecip <= 2)
              tips.push("🌦️ Noe nedbør mulig — vurder regntelt");
            if (avgTemp < 5)
              tips.push("🧥 Kaldt — sørg for varme sjal/kåper til gjestene");
            if (avgTemp > 25)
              tips.push(
                "☀️ Varmt — server kalde drikker og ha skygge tilgjengelig",
              );
            if (avgTemp >= 15 && avgTemp <= 25 && maxPrecip < 1)
              tips.push("✨ Perfekt vær for utendørs bryllup!");
          }
        }
      } catch (err) {
        console.warn("Weather fetch failed for bridge:", err);
      }

      // Get schedule events to provide weather-per-event data
      const schedEvents = await pool.query(
        "SELECT id, time, title, icon FROM schedule_events WHERE couple_id = $1 ORDER BY time",
        [coupleId],
      );

      // Add weather to each schedule event if wedding is today/tomorrow
      const eventsWithWeather = schedEvents.rows.map((evt: any) => {
        if (!weather?.hourly?.length || !evt.time)
          return { ...evt, weather: null };
        // Match event time to closest forecast entry
        const eventHour = parseInt(evt.time.split(":")[0]);
        const closest = weather.hourly.reduce((best: any, h: any) => {
          const hHour = new Date(h.time).getHours();
          return Math.abs(hHour - eventHour) <
            Math.abs(new Date(best.time).getHours() - eventHour)
            ? h
            : best;
        }, weather.hourly[0]);
        return { ...evt, weather: closest };
      });

      // Build Norwegian city references for travel calculations
      const norwegianCities = [
        { name: "Oslo", lat: 59.9139, lng: 10.7522 },
        { name: "Bergen", lat: 60.3913, lng: 5.3221 },
        { name: "Trondheim", lat: 63.4305, lng: 10.3951 },
        { name: "Stavanger", lat: 58.97, lng: 5.7331 },
        { name: "Kristiansand", lat: 58.1599, lng: 8.0182 },
        { name: "Tromsø", lat: 69.6496, lng: 18.956 },
        { name: "Drammen", lat: 59.7439, lng: 10.2045 },
        { name: "Fredrikstad", lat: 59.2181, lng: 10.9298 },
      ];

      const travelFromCities = norwegianCities.map((city) => ({
        ...city,
        ...calculateTravelInfo({ lat: city.lat, lng: city.lng }, venueCoords!),
      }));

      res.json({
        couple: {
          id: couple.id,
          email: couple.email,
          displayName: couple.display_name,
          weddingDate: couple.wedding_date,
        },
        venue: {
          name: venueName,
          coordinates: venueCoords,
          municipality: timelineData.venueMunicipality || null,
          county: timelineData.venueCounty || null,
        },
        weather,
        eventsWithWeather,
        travelFromCities,
        source: "creatorhub-evendi-bridge",
      });
    } catch (error) {
      console.error("Weather-location bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente vær/sted-data" });
    }
  });

  // POST /api/evendi/weather-location/:coupleId/venue — Update venue coordinates and trigger weather fetch
  app.post("/api/evendi/weather-location/:coupleId/venue", async (req, res) => {
    try {
      const coupleId =
        (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
      const { venueName, lat, lng, address } = req.body;

      if (!lat || !lng) {
        // Try Kartverket lookup
        const query = venueName || address || "";
        if (!query)
          return res
            .status(400)
            .json({ error: "Oppgi stedsnavn, adresse, eller koordinater" });

        const kartResult = await searchKartverketAddress(query);
        if (kartResult.addresses.length === 0) {
          return res
            .status(404)
            .json({ error: "Fant ingen adresser for søket", query });
        }
        return res.json({
          results: kartResult.addresses,
          message: `Fant ${kartResult.addresses.length} adresser — velg en for å lagre`,
        });
      }

      // Store venue coordinates on couple_profile and timeline
      await pool.query(
        "UPDATE couple_profiles SET wedding_venue = $1, updated_at = NOW() WHERE id = $2",
        [venueName || address || `${lat},${lng}`, coupleId],
      );

      // Update timeline with venue coordinates
      const tl = await pool.query(
        `SELECT id FROM wedding_timelines
         WHERE project_id IN (SELECT id FROM legacy.projects WHERE client_email = (SELECT email FROM couple_profiles WHERE id = $1)) LIMIT 1`,
        [coupleId],
      );
      if (tl.rowCount) {
        await pool.query(
          `UPDATE wedding_timelines SET
            venue = $1,
            timeline_data = COALESCE(timeline_data, '{}')::jsonb || $2::jsonb,
            updated_at = NOW()
           WHERE id = $3`,
          [
            venueName || address,
            JSON.stringify({
              venueCoordinates: { lat, lng },
              venueUpdatedAt: new Date().toISOString(),
            }),
            tl.rows[0].id,
          ],
        );
      }

      // Fetch fresh weather
      const yrData = await fetchYrWeatherBridge(lat, lng);
      const timeseries = yrData.properties?.timeseries || [];
      const now = timeseries[0];

      res.json({
        saved: true,
        venue: { name: venueName || address, coordinates: { lat, lng } },
        currentWeather: now
          ? {
              temperature: now.data?.instant?.details?.air_temperature,
              windSpeed: now.data?.instant?.details?.wind_speed,
              symbol:
                now.data?.next_1_hours?.summary?.symbol_code ||
                now.data?.next_6_hours?.summary?.symbol_code,
            }
          : null,
      });
    } catch (error) {
      console.error("Venue update error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere bryllupssted" });
    }
  });

  // GET /api/evendi/weather-location/:coupleId/travel — Calculate travel info from origin to wedding venue
  app.get("/api/evendi/weather-location/:coupleId/travel", async (req, res) => {
    try {
      const coupleId =
        (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
      const fromLat = parseFloat(req.query.fromLat as string);
      const fromLng = parseFloat(req.query.fromLng as string);
      const fromCity = req.query.fromCity as string;

      // Get venue coordinates
      const cp = await pool.query(
        "SELECT wedding_venue FROM couple_profiles WHERE id = $1",
        [coupleId],
      );
      const tl = await pool.query(
        `SELECT timeline_data FROM wedding_timelines
         WHERE project_id IN (SELECT id FROM legacy.projects WHERE client_email = (SELECT email FROM couple_profiles WHERE id = $1)) LIMIT 1`,
        [coupleId],
      );

      const timelineData = tl.rowCount ? tl.rows[0].timeline_data || {} : {};
      const venueCoords = timelineData.venueCoordinates || {
        lat: 59.9139,
        lng: 10.7522,
      };

      let origin = { lat: fromLat, lng: fromLng };

      // If city name given instead of coords, resolve it
      if (isNaN(fromLat) || isNaN(fromLng)) {
        if (fromCity) {
          const kartResult = await searchKartverketAddress(fromCity);
          if (kartResult.addresses.length > 0) {
            origin = kartResult.addresses[0].coordinates;
          } else {
            return res.status(404).json({ error: `Fant ikke byen: ${fromCity}` });
          }
        } else {
          return res
            .status(400)
            .json({ error: "Oppgi fromLat/fromLng eller fromCity" });
        }
      }

      const travelInfo = calculateTravelInfo(origin, venueCoords);

      // Fetch weather at both origin and destination
      let originWeather = null;
      let venueWeather = null;
      try {
        const [origYr, venueYr] = await Promise.all([
          fetchYrWeatherBridge(origin.lat, origin.lng),
          fetchYrWeatherBridge(venueCoords.lat, venueCoords.lng),
        ]);
        const origNow = origYr.properties?.timeseries?.[0];
        const venueNow = venueYr.properties?.timeseries?.[0];
        originWeather = origNow
          ? {
              temperature: origNow.data?.instant?.details?.air_temperature,
              symbol: origNow.data?.next_1_hours?.summary?.symbol_code,
            }
          : null;
        venueWeather = venueNow
          ? {
              temperature: venueNow.data?.instant?.details?.air_temperature,
              symbol: venueNow.data?.next_1_hours?.summary?.symbol_code,
            }
          : null;
      } catch {}

      res.json({
        travel: travelInfo,
        origin: { coordinates: origin, weather: originWeather },
        venue: {
          name: cp.rows[0]?.wedding_venue || "Bryllupssted",
          coordinates: venueCoords,
          weather: venueWeather,
        },
      });
    } catch (error) {
      console.error("Travel calculation error:", error);
      res.status(500).json({ error: "Kunne ikke beregne reiseinformasjon" });
    }
  });

  // GET /api/evendi/weather-location/:coupleId/event-weather — Weather for each timeline event time
  app.get(
    "/api/evendi/weather-location/:coupleId/event-weather",
    async (req, res) => {
      try {
        const coupleId =
          (await resolveCoupleId(req.params.coupleId)) || req.params.coupleId;
        const date = req.query.date as string; // YYYY-MM-DD format

        // Get venue coordinates
        const tl = await pool.query(
          `SELECT timeline_data FROM wedding_timelines
         WHERE project_id IN (SELECT id FROM legacy.projects WHERE client_email = (SELECT email FROM couple_profiles WHERE id = $1)) LIMIT 1`,
          [coupleId],
        );
        const timelineData = tl.rowCount ? tl.rows[0].timeline_data || {} : {};
        const venueCoords = timelineData.venueCoordinates || {
          lat: 59.9139,
          lng: 10.7522,
        };

        // Get schedule events
        const events = await pool.query(
          "SELECT id, time, title, icon FROM schedule_events WHERE couple_id = $1 ORDER BY time",
          [coupleId],
        );

        // Get weather forecast
        const yrData = await fetchYrWeatherBridge(
          venueCoords.lat,
          venueCoords.lng,
        );
        const timeseries = yrData.properties?.timeseries || [];

        // If a specific date is given, filter forecast to that date
        const targetDate = date || new Date().toISOString().split("T")[0];
        const dayEntries = timeseries.filter((t: any) =>
          t.time?.startsWith(targetDate),
        );

        // Match each event to its closest weather entry
        const eventsWithWeather = events.rows.map((evt: any) => {
          if (!evt.time || dayEntries.length === 0)
            return { ...evt, weather: null };
          const [eventH, eventM] = evt.time.split(":").map(Number);
          const eventMinutes = eventH * 60 + (eventM || 0);

          const closest = dayEntries.reduce((best: any, entry: any) => {
            const entryDate = new Date(entry.time);
            const entryMinutes =
              entryDate.getUTCHours() * 60 + entryDate.getUTCMinutes();
            const bestDate = new Date(best.time);
            const bestMinutes =
              bestDate.getUTCHours() * 60 + bestDate.getUTCMinutes();
            return Math.abs(entryMinutes - eventMinutes) <
              Math.abs(bestMinutes - eventMinutes)
              ? entry
              : best;
          }, dayEntries[0]);

          return {
            ...evt,
            weather: {
              temperature: closest.data?.instant?.details?.air_temperature,
              windSpeed: closest.data?.instant?.details?.wind_speed,
              humidity: closest.data?.instant?.details?.relative_humidity,
              symbol:
                closest.data?.next_1_hours?.summary?.symbol_code ||
                closest.data?.next_6_hours?.summary?.symbol_code,
              precipitation:
                closest.data?.next_1_hours?.details?.precipitation_amount || 0,
            },
            weatherTip: (() => {
              const temp = closest.data?.instant?.details?.air_temperature || 0;
              const precip =
                closest.data?.next_1_hours?.details?.precipitation_amount || 0;
              const wind = closest.data?.instant?.details?.wind_speed || 0;
              if (precip > 2)
                return "☂️ Regn — flytt innendørs eller ha regntelt klart";
              if (wind > 10)
                return "💨 Sterk vind — sikre dekorasjoner og løse gjenstander";
              if (temp < 5)
                return "🧥 Kaldt — ha varmedrikker og pledd tilgjengelig";
              if (temp > 28)
                return "☀️ Veldig varmt — server kalde drikker og ha skygge";
              return "✅ Bra vær for denne hendelsen";
            })(),
          };
        });

        res.json({
          date: targetDate,
          venue: { coordinates: venueCoords },
          events: eventsWithWeather,
          dailySummary:
            dayEntries.length > 0
              ? {
                  avgTemperature:
                    Math.round(
                      (dayEntries.reduce(
                        (s: number, t: any) =>
                          s + (t.data?.instant?.details?.air_temperature || 0),
                        0,
                      ) /
                        dayEntries.length) *
                        10,
                    ) / 10,
                  maxPrecipitation: Math.max(
                    0,
                    ...dayEntries.map(
                      (t: any) =>
                        t.data?.next_1_hours?.details?.precipitation_amount || 0,
                    ),
                  ),
                  maxWind: Math.max(
                    0,
                    ...dayEntries.map(
                      (t: any) => t.data?.instant?.details?.wind_speed || 0,
                    ),
                  ),
                }
              : null,
        });
      } catch (error) {
        console.error("Event weather error:", error);
        res.status(500).json({ error: "Kunne ikke hente vær per hendelse" });
      }
    },
  );

  // POST /api/evendi/weather-location/sync-from-project/:projectId — Sync location data from CreatorHub project → Evendi
  app.post(
    "/api/evendi/weather-location/sync-from-project/:projectId",
    async (req, res) => {
      try {
        const { projectId } = req.params;
        const { venueCoordinates, venueName, locationAnalysis, travelData } =
          req.body;

        // Find the associated couple
        const proj = await pool.query(
          "SELECT client_email FROM legacy.projects WHERE id = $1",
          [projectId],
        );
        if (proj.rowCount === 0)
          return res.status(404).json({ error: "Prosjekt ikke funnet" });

        const cp = await pool.query(
          "SELECT id FROM couple_profiles WHERE email = $1",
          [proj.rows[0].client_email],
        );
        if (cp.rowCount === 0)
          return res
            .status(404)
            .json({ error: "Ingen brudepar koblet til prosjektet" });

        const coupleId = cp.rows[0].id;

        // Update couple profile venue
        if (venueName) {
          await pool.query(
            "UPDATE couple_profiles SET wedding_venue = $1, updated_at = NOW() WHERE id = $2",
            [venueName, coupleId],
          );
        }

        // Update timeline with location intelligence
        const tl = await pool.query(
          "SELECT id FROM wedding_timelines WHERE project_id = $1 LIMIT 1",
          [projectId],
        );
        if (tl.rowCount) {
          const bridgeData: any = {
            locationBridgeSyncedAt: new Date().toISOString(),
            locationSource: "creatorhub-project",
          };
          if (venueCoordinates) bridgeData.venueCoordinates = venueCoordinates;
          if (locationAnalysis) bridgeData.locationAnalysis = locationAnalysis;
          if (travelData) bridgeData.travelData = travelData;

          await pool.query(
            `UPDATE wedding_timelines SET
            venue = COALESCE($1, venue),
            timeline_data = COALESCE(timeline_data, '{}')::jsonb || $2::jsonb,
            updated_at = NOW()
           WHERE id = $3`,
            [venueName || null, JSON.stringify(bridgeData), tl.rows[0].id],
          );
        }

        console.log(
          `📍 Location bridge: synced project ${projectId.substring(0, 8)} → couple ${coupleId.substring(0, 8)}`,
        );
        res.json({ synced: true, coupleId, projectId });
      } catch (error) {
        console.error("Location sync-from-project error:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke synkronisere stedsinformasjon" });
      }
    },
  );

  // GET /api/evendi/weather-location/search — Kartverket address search (used by both apps)
  app.get("/api/evendi/weather-location/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2)
        return res.status(400).json({ error: "Søk må være minst 2 tegn" });
      const results = await searchKartverketAddress(query);
      res.json(results);
    } catch (error) {
      console.error("Kartverket search error:", error);
      res.status(500).json({ error: "Adressesøk feilet" });
    }
  });
}
