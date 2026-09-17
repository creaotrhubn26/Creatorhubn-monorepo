/**
 * aerospot/screens/LiveMapScreen.tsx — live-kart med fly, rullebaner,
 * spottepunkter og flight-detail bottom sheet.
 *
 * Ytelse: markers memoiseres per fly-id + posisjon; kartet rerendres
 * ikke når uvedkommende state endres.
 */

import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AnimatePresence, motion } from "framer-motion";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { useFlights, useSpottingIntelligence } from "../hooks";
import { useAeroStore } from "../store";
import { OSL, OSL_SPOTTING_LOCATIONS } from "../data/osl";
import { bearingDeg, compassLabel, distanceKm } from "../services/geo";
import { estimateFocalLengthMm } from "../services/CameraRecommendationService";
import { RareBadge, ValueTile } from "../components/ui";
import type { LiveFlight } from "../types";

function aircraftIcon(headingDeg: number, selected: boolean): L.DivIcon {
  const color = selected ? colors.primaryBright : "#F5C518";
  return L.divIcon({
    className: "aerospot-aircraft",
    html: `<div style="transform: rotate(${headingDeg}deg); font-size: 22px; line-height: 1; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); color: ${color};">✈</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const spotIcon = L.divIcon({
  className: "aerospot-spot",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:${colors.success};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const FlightMarkers = React.memo(function FlightMarkers({
  flights,
  selectedId,
  onSelect,
}: {
  flights: LiveFlight[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {flights.map((f) => (
        <Marker
          key={f.id}
          position={[f.latitude, f.longitude]}
          icon={aircraftIcon(f.headingDeg, f.id === selectedId)}
          eventHandlers={{ click: () => onSelect(f.id) }}
        />
      ))}
    </>
  );
});

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 11), { duration: 0.6 });
  }, [target, map]);
  return null;
}

function FlightSheet({ flight, onClose }: { flight: LiveFlight; onClose: () => void }) {
  const userPosition = useAeroStore((s) => s.userPosition);
  const followed = useAeroStore((s) => s.followedFlightIds.includes(flight.id));
  const toggleFollow = useAeroStore((s) => s.toggleFollow);
  const pos = { lat: flight.latitude, lng: flight.longitude };
  const dist = userPosition ? distanceKm(userPosition, pos) : null;
  const brg = userPosition ? bearingDeg(userPosition, pos) : null;
  const lens = dist !== null ? estimateFocalLengthMm(Math.max(0.5, dist)) : null;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: colors.surface,
        borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
        boxShadow: shadows.sheet,
        padding: spacing.lg,
        paddingBottom: spacing.xl,
        maxHeight: "70%",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
            <span style={{ ...typography.title, color: colors.textPrimary }}>{flight.callsign}</span>
            <RareBadge rarity={flight.rarity} />
          </div>
          <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
            {[flight.airline, flight.aircraftType, flight.registration].filter(Boolean).join(" · ")}
          </div>
          {flight.origin ? (
            <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xs }}>
              {flight.origin} → {flight.destination ?? "?"}
            </div>
          ) : null}
        </div>
        <button
          onClick={onClose}
          aria-label="Lukk"
          style={{
            background: colors.surfaceElevated,
            color: colors.textSecondary,
            border: "none",
            borderRadius: radius.full,
            width: 32,
            height: 32,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" }}>
        <ValueTile label="Høyde" value={`${flight.altitudeFt.toLocaleString("nb-NO")} ft`} />
        <ValueTile label="Fart" value={`${flight.groundSpeedKt} kt`} />
        <ValueTile label="Heading" value={`${flight.headingDeg}° ${compassLabel(flight.headingDeg)}`} />
      </div>
      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
        <ValueTile
          label="V/S"
          value={`${flight.verticalSpeedFpm > 0 ? "↑" : flight.verticalSpeedFpm < 0 ? "↓" : ""} ${Math.abs(flight.verticalSpeedFpm)} fpm`}
        />
        <ValueTile
          label="ETA"
          value={
            flight.etaIso
              ? new Date(flight.etaIso).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
              : "–"
          }
        />
        <ValueTile label="Avstand" value={dist !== null ? `${dist.toFixed(1)} km` : "GPS av"} />
      </div>

      {/* Fotograf-info */}
      <div
        style={{
          marginTop: spacing.lg,
          background: colors.surfaceElevated,
          borderRadius: radius.md,
          padding: spacing.md,
        }}
      >
        <div style={{ ...typography.micro, color: colors.primaryBright, textTransform: "uppercase" }}>
          For fotografen
        </div>
        <div style={{ ...typography.body, color: colors.textPrimary, marginTop: spacing.xs }}>
          {dist !== null && brg !== null && lens !== null
            ? `Ca. ${lens} mm på fullformat herfra. Flyet ligger ${compassLabel(brg)} for deg (${Math.round(brg)}°).`
            : "Skru på posisjon for avstand, retning og objektiv-forslag."}
        </div>
      </div>

      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.lg }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => toggleFollow(flight.id)}
          style={{
            flex: 1,
            ...typography.headline,
            color: followed ? colors.background : colors.primaryBright,
            background: followed ? colors.primaryBright : "rgba(38,140,255,0.14)",
            border: "none",
            borderRadius: radius.full,
            padding: spacing.md,
            cursor: "pointer",
          }}
        >
          {followed ? "Følger ✓" : "Følg"}
        </motion.button>
      </div>
    </motion.div>
  );
}

export function LiveMapScreen() {
  const flights = useFlights();
  const intel = useSpottingIntelligence();
  const selectedFlightId = useAeroStore((s) => s.selectedFlightId);
  const selectFlight = useAeroStore((s) => s.selectFlight);
  const userPosition = useAeroStore((s) => s.userPosition);

  const selected = useMemo(
    () => (flights.data ?? []).find((f) => f.id === selectedFlightId) ?? null,
    [flights.data, selectedFlightId],
  );

  const runwayLines = useMemo(
    () =>
      OSL.runways.map((r) => ({
        id: r.id,
        positions: [
          [r.thresholdA.lat, r.thresholdA.lng],
          [r.thresholdB.lat, r.thresholdB.lng],
        ] as [number, number][],
        active: intel.runway
          ? r.id === intel.runway.runway || r.reciprocal === intel.runway.runway
          : false,
      })),
    [intel.runway],
  );

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <MapContainer
        center={[OSL.position.lat, OSL.position.lng]}
        zoom={10}
        style={{ height: "100%", width: "100%", background: colors.background }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        {runwayLines.map((r) => (
          <Polyline
            key={r.id}
            positions={r.positions}
            pathOptions={{
              color: r.active ? colors.primaryBright : colors.textTertiary,
              weight: r.active ? 5 : 3,
              opacity: 0.9,
            }}
          />
        ))}
        {OSL_SPOTTING_LOCATIONS.map((s) => (
          <Marker key={s.id} position={[s.position.lat, s.position.lng]} icon={spotIcon} />
        ))}
        {userPosition ? (
          <CircleMarker
            center={[userPosition.lat, userPosition.lng]}
            radius={7}
            pathOptions={{ color: "#fff", fillColor: colors.primary, fillOpacity: 1, weight: 2 }}
          />
        ) : null}
        <FlightMarkers
          flights={flights.data ?? []}
          selectedId={selectedFlightId}
          onSelect={selectFlight}
        />
        <FlyTo target={selected ? [selected.latitude, selected.longitude] : null} />
      </MapContainer>

      {/* Vind/rullebane-chip */}
      <div
        style={{
          position: "absolute",
          top: spacing.md,
          left: spacing.md,
          zIndex: 1000,
          background: colors.surface,
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          padding: `${spacing.sm}px ${spacing.md}px`,
          ...typography.caption,
          color: colors.textPrimary,
          boxShadow: shadows.card,
        }}
      >
        {intel.runway ? `Bane ${intel.runway.runway} (estimert)` : "Beregner bane…"}
      </div>

      <AnimatePresence>
        {selected ? <FlightSheet flight={selected} onClose={() => selectFlight(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}
