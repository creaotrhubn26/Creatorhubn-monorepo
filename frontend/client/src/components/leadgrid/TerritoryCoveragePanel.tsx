/**
 * TerritoryCoveragePanel.tsx
 *
 * Manager-oversikt over territorie-dekning: hvor mange leads dekkes av grids,
 * hvor mange er foreldreløse (ingen grid), overlapp, og leads per grid. Viser
 * stat-kort + et kart med foreldreløse leads (rødt) og grid-omrissene.
 *
 * Data: GET /api/leadgrid/territories/coverage + /api/leadgrid/territories.
 * Kart-oppsett speiler LeadMapPanel.tsx (CARTO dark + react-leaflet).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, Card, CardContent, CircularProgress, Chip, LinearProgress,
} from "@mui/material";
import { MapContainer, TileLayer, Polygon, Circle, CircleMarker, Tooltip as LTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const DARK_TILE_ATTR =
  '&copy; <a href="https://carto.com/attributions">CARTO</a> · <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

interface Coverage {
  total: number; covered: number; orphans: number; overlapping: number; coveragePct: number;
  perTerritory: Array<{ territoryId: string; name: string; assignedUserId: string | null; leadCount: number }>;
  orphanLeads: Array<{ id: string; name: string | null; latitude: number | null; longitude: number | null }>;
}
interface Territory {
  id: string; name: string; geometry: any | null;
  center_lat: number | null; center_lng: number | null; radius_m: number | null;
}

function statCard(label: string, value: string, color: string) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

function ringLatLng(geometry: any): [number, number][] {
  // GeoJSON [lng,lat] → leaflet [lat,lng]. Tar ytre ring av Polygon/MultiPolygon.
  const g = geometry?.type === "Feature" ? geometry.geometry : geometry;
  let ring: number[][] | undefined;
  if (g?.type === "Polygon") ring = g.coordinates?.[0];
  else if (g?.type === "MultiPolygon") ring = g.coordinates?.[0]?.[0];
  return (ring ?? []).map((c: number[]) => [c[1], c[0]] as [number, number]);
}

export function TerritoryCoveragePanel({ organizationId }: { organizationId?: string }) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
    Promise.all([
      fetch(`/api/leadgrid/territories/coverage${q}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/leadgrid/territories${q}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([cov, terr]) => {
      setCoverage(cov?.coverage ?? null);
      setTerritories(terr?.territories ?? []);
    }).finally(() => setLoading(false));
  }, [organizationId]);

  const center = useMemo<[number, number]>(() => {
    const o = coverage?.orphanLeads?.find((l) => l.latitude != null && l.longitude != null);
    if (o?.latitude != null && o?.longitude != null) return [o.latitude, o.longitude];
    return [59.9139, 10.7522];
  }, [coverage]);

  if (loading) return <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>;
  if (!coverage) return <Typography variant="body2" color="text.secondary">Ingen dekningsdata.</Typography>;

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Territorie-dekning</Typography>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {statCard("Leads totalt", String(coverage.total), "#fff")}
        {statCard("Dekket av grid", String(coverage.covered), "#9be15d")}
        {statCard("Foreldreløse", String(coverage.orphans), coverage.orphans > 0 ? "#ff6b6b" : "#9be15d")}
        {statCard("I flere grids", String(coverage.overlapping), coverage.overlapping > 0 ? "#ffb86b" : "#9be15d")}
      </Stack>

      <Box>
        <Stack direction="row" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" color="text.secondary">Dekningsgrad</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{coverage.coveragePct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={coverage.coveragePct}
          sx={{ height: 8, borderRadius: 4 }}
          color={coverage.coveragePct >= 80 ? "success" : coverage.coveragePct >= 50 ? "warning" : "error"} />
      </Box>

      <Box sx={{ height: 380, borderRadius: 1, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
        <MapContainer center={center} zoom={9} style={{ height: "100%", width: "100%" }}>
          <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
          {territories.map((t) => {
            const ring = ringLatLng(t.geometry);
            return (
              <React.Fragment key={t.id}>
                {ring.length >= 3 && (
                  <Polygon positions={ring} pathOptions={{ color: "#60a5fa", fillOpacity: 0.08, weight: 2 }}>
                    <LTooltip>{t.name}</LTooltip>
                  </Polygon>
                )}
                {t.center_lat != null && t.center_lng != null && t.radius_m != null && (
                  <Circle center={[t.center_lat, t.center_lng]} radius={t.radius_m}
                    pathOptions={{ color: "#60a5fa", fillOpacity: 0.08, weight: 2 }}>
                    <LTooltip>{t.name}</LTooltip>
                  </Circle>
                )}
              </React.Fragment>
            );
          })}
          {coverage.orphanLeads
            .filter((l) => l.latitude != null && l.longitude != null)
            .map((l) => (
              <CircleMarker key={l.id} center={[l.latitude as number, l.longitude as number]}
                radius={6} pathOptions={{ color: "#ff6b6b", fillColor: "#ff6b6b", fillOpacity: 0.8, weight: 1 }}>
                <LTooltip>{l.name ?? "Lead uten sone"}</LTooltip>
              </CircleMarker>
            ))}
        </MapContainer>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Røde prikker = leads uten noen grid. Blå omriss = grids. {coverage.orphanLeads.length} foreldreløse vist.
      </Typography>

      {coverage.perTerritory.length > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Leads per grid</Typography>
          {coverage.perTerritory.map((t) => (
            <Stack key={t.territoryId} direction="row" justifyContent="space-between"
              sx={{ fontSize: 13, px: 1, py: 0.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span>{t.name}</span>
              <Chip size="small" label={`${t.leadCount} leads`} />
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
