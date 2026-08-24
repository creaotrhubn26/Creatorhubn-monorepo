/**
 * aerospot/screens/HomeScreen.tsx — intelligence-dashboard.
 * WHAT (interessante fly) + WHERE (beste spot) + kontekst (vær/sol/rullebane).
 */

import React from "react";
import { colors, spacing, typography } from "../theme";
import { Card, EmptyState, ErrorState, LoadingState, PrimaryButton, RareBadge, RunwayBadge, ScoreBar, SectionHeader, ValueTile } from "../components/ui";
import { useFlights, useSpottingIntelligence, useSun, useWeather } from "../hooks";
import { useAeroStore } from "../store";
import { OSL } from "../data/osl";
import { compassLabel, distanceKm } from "../services/geo";
import { rarityLabels } from "../services/RarityService";
import type { LiveFlight } from "../types";

function fmtTime(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "–"
    : d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

function FlightRow({ flight }: { flight: LiveFlight }) {
  const selectFlight = useAeroStore((s) => s.selectFlight);
  const setTab = useAeroStore((s) => s.setTab);
  return (
    <Card
      onClick={() => {
        selectFlight(flight.id);
        setTab("live");
      }}
      style={{ marginBottom: spacing.sm, padding: spacing.md }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
            {flight.etaIso ? (
              <span style={{ ...typography.caption, color: colors.textSecondary }}>
                {fmtTime(flight.etaIso)}
              </span>
            ) : null}
            <span style={{ ...typography.headline, color: colors.textPrimary }}>
              {flight.aircraftType ?? flight.callsign}
            </span>
            <RareBadge rarity={flight.rarity} />
          </div>
          <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
            {[
              flight.registration,
              flight.origin ? `${flight.origin} → ${flight.destination ?? "Oslo"}` : null,
              `${flight.altitudeFt.toLocaleString("nb-NO")} ft · ${flight.groundSpeedKt} kt`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <span style={{ ...typography.caption, color: colors.primaryBright }}>
          {flight.aircraftIcao ?? ""}
        </span>
      </div>
    </Card>
  );
}

export function HomeScreen() {
  const flights = useFlights();
  const weather = useWeather();
  const sun = useSun();
  const intel = useSpottingIntelligence();
  const selectLocation = useAeroStore((s) => s.selectLocation);
  const userPosition = useAeroStore((s) => s.userPosition);

  const best = intel.ranked[0];
  const interesting = (flights.data ?? [])
    .filter((f) => !f.onGround)
    .sort((a, b) => {
      const order = ["legendary", "very_rare", "rare", "uncommon", "common"];
      const diff = order.indexOf(a.rarity) - order.indexOf(b.rarity);
      return diff !== 0 ? diff : (a.etaIso ?? "").localeCompare(b.etaIso ?? "");
    })
    .slice(0, 8);

  return (
    <div style={{ padding: spacing.lg, paddingBottom: 96 }}>
      <div style={{ ...typography.caption, color: colors.textSecondary }}>
        {OSL.iata} · {OSL.name.replace("Oslo ", "")}
      </div>
      <h1 style={{ ...typography.hero, color: colors.textPrimary, margin: `${spacing.xs}px 0` }}>
        {flights.isLoading ? "…" : `${flights.data?.length ?? 0} fly i området`}
      </h1>

      {/* Hero: beste spotting nå */}
      {intel.isLoading ? (
        <LoadingState label="Beregner beste spottepunkt…" />
      ) : intel.isError ? (
        <ErrorState message="Fikk ikke hentet vær-/trafikkdata." />
      ) : best ? (
        <Card elevated style={{ marginTop: spacing.md }}>
          <div style={{ ...typography.micro, color: colors.primaryBright, textTransform: "uppercase" }}>
            Beste spotting akkurat nå
          </div>
          <div style={{ ...typography.title, color: colors.textPrimary, margin: `${spacing.sm}px 0` }}>
            {best.location.name}
          </div>
          <div style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md }}>
            {best.explanation}
          </div>
          <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", marginBottom: spacing.md }}>
            {intel.runway ? <RunwayBadge runway={intel.runway.runway} /> : null}
            <span style={{ ...typography.caption, color: colors.textSecondary }}>
              Estimert aktiv bane · ikke ATC-bekreftet
            </span>
          </div>
          <ScoreBar label="Score" value={best.score.total} />
          <div style={{ marginTop: spacing.md }}>
            <PrimaryButton onClick={() => selectLocation(best.location.id)}>
              Se spottepunkt
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {/* Vær / golden hour / rullebane */}
      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" }}>
        <ValueTile
          label="Vær nå"
          value={weather.data ? `${Math.round(weather.data.temperatureC)}°C` : "–"}
        />
        <ValueTile
          label="Vind"
          value={
            weather.data
              ? `${compassLabel(weather.data.windDirectionDeg)} ${weather.data.windSpeedKt} kt`
              : "–"
          }
        />
        <ValueTile label="Sikt" value={weather.data ? `${weather.data.visibilityKm} km` : "–"} />
      </div>
      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
        <ValueTile label="Golden hour" value={fmtTime(sun.goldenHourStartIso)} />
        <ValueTile label="Solnedgang" value={fmtTime(sun.sunsetIso)} />
        <ValueTile label="Blue hour" value={fmtTime(sun.blueHourStartIso)} />
      </div>

      {/* Interessante fly */}
      <SectionHeader title="Interessante fly kommer" />
      {flights.isLoading ? (
        <LoadingState label="Henter flytrafikk…" />
      ) : flights.isError ? (
        <ErrorState message="Flydata utilgjengelig." onRetry={() => void flights.refetch()} />
      ) : interesting.length === 0 ? (
        <EmptyState title="Stille i lufta" body="Ingen fly i området akkurat nå." />
      ) : (
        interesting.map((f) => <FlightRow key={f.id} flight={f} />)
      )}

      {/* Spottepunkter */}
      <SectionHeader title="Spottepunkter" />
      {intel.ranked.map((rec) => (
        <Card
          key={rec.location.id}
          onClick={() => selectLocation(rec.location.id)}
          style={{ marginBottom: spacing.sm, padding: spacing.md }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ ...typography.headline, color: colors.textPrimary }}>
                {rec.location.name}{" "}
                <span style={{ ...typography.caption, color: colors.warning }}>
                  ★ {rec.location.rating.toFixed(1)}
                </span>
              </div>
              <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                {rec.location.bestFor.join(" · ")}
                {userPosition
                  ? ` · ${distanceKm(userPosition, rec.location.position).toFixed(0)} km unna`
                  : ""}
              </div>
            </div>
            <div style={{ ...typography.title, color: rec.score.total >= 80 ? colors.success : colors.textSecondary }}>
              {rec.score.total}
            </div>
          </div>
        </Card>
      ))}

      {/* Rarity-forklaring */}
      <div style={{ ...typography.caption, color: colors.textTertiary, marginTop: spacing.lg }}>
        Sjeldenhet: {Object.values(rarityLabels).join(" → ")}
      </div>
    </div>
  );
}
