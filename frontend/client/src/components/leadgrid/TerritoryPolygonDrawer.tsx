/**
 * TerritoryPolygonDrawer.tsx
 *
 * Lett polygon-tegner for grids. Ingen draw-plugin er installert, så vi
 * håndruller vertex-klikking: hvert klikk på kartet legger til et hjørne.
 * Når brukeren er ferdig konverteres hjørnene til en lukket GeoJSON Polygon
 * (koordinater [lng, lat]) og sendes ut via onPolygon().
 *
 * Kart-oppsettet (CARTO dark + react-leaflet) speiler
 * pages/admin-room/LeadMapPanel.tsx.
 */

import React, { useState } from "react";
import { Box, Stack, Button, Typography } from "@mui/material";
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const DARK_TILE_ATTR =
  '&copy; <a href="https://carto.com/attributions">CARTO</a> · <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

// Liten prikk-markør for hvert hjørne (unngår Leaflets default-ikon-asset-problem).
const vertexIcon = L.divIcon({
  className: "",
  html: '<div style="width:10px;height:10px;border-radius:50%;background:#ff6b6b;border:2px solid #fff;"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

type LatLng = [number, number];

interface Props {
  /** Kalt med en GeoJSON Polygon-geometri (lukket ring, [lng,lat]). */
  onPolygon: (geojson: { type: "Polygon"; coordinates: number[][][] }) => void;
  /** Startsenter for kartet (default: Oslo). */
  center?: LatLng;
}

function ClickCollector({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export function TerritoryPolygonDrawer({ onPolygon, center = [59.9139, 10.7522] }: Props) {
  const [vertices, setVertices] = useState<LatLng[]>([]);

  const undo = () => setVertices((v) => v.slice(0, -1));
  const clear = () => setVertices([]);

  const apply = () => {
    if (vertices.length < 3) return;
    // GeoJSON: [lng, lat], lukket ring (siste = første).
    const ring = vertices.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]);
    onPolygon({ type: "Polygon", coordinates: [ring] });
  };

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Klikk på kartet for å sette hjørner ({vertices.length} satt). Minst 3 hjørner kreves.
      </Typography>
      <Box sx={{ height: 360, borderRadius: 1, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
        <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }} keyboard>
          <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
          <ClickCollector onAdd={(p) => setVertices((v) => [...v, p])} />
          {vertices.length >= 3 && (
            <Polygon
              positions={vertices}
              pathOptions={{ color: "#ff6b6b", fillColor: "#ff6b6b", fillOpacity: 0.15, weight: 2 }}
            />
          )}
          {vertices.map((p, i) => (
            <Marker key={i} position={p} icon={vertexIcon} />
          ))}
        </MapContainer>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={undo} disabled={vertices.length === 0}>Angre punkt</Button>
        <Button size="small" onClick={clear} disabled={vertices.length === 0}>Tøm</Button>
        <Button size="small" variant="contained" onClick={apply} disabled={vertices.length < 3}>
          Bruk polygon
        </Button>
      </Stack>
    </Stack>
  );
}
