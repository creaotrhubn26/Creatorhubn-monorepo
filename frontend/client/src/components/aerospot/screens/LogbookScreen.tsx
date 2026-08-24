/**
 * aerospot/screens/LogbookScreen.tsx — personlig spotting-database.
 * Legg til bilde → EXIF leses automatisk → foreslått fly-match →
 * lagres med ett trykk (zero-friction logbook).
 */

import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius, spacing, typography } from "../theme";
import { Card, EmptyState, LoadingState, PrimaryButton, RareBadge, SectionHeader, StatCard } from "../components/ui";
import {
  computeCollection,
  computeStats,
  createLogbookEntry,
  deleteLogbookEntry,
  fetchLogbook,
  readExif,
  updateLogbookEntry,
} from "../services/LogbookService";
import { matchPhotoToFlight } from "../services/FlightPhotoMatchingService";
import { classifyRarity } from "../services/RarityService";
import { useFlights } from "../hooks";
import { useAeroStore } from "../store";
import { OSL } from "../data/osl";
import type { LogbookEntry } from "../types";
import type { FlightMatch } from "../services/FlightPhotoMatchingService";
import type { ExifSummary } from "../services/LogbookService";

function useLogbook() {
  return useQuery({ queryKey: ["aerospot", "logbook"], queryFn: fetchLogbook, staleTime: 60_000 });
}

interface Draft {
  exif: ExifSummary;
  matches: FlightMatch[];
  chosen: FlightMatch | null;
}

export function LogbookScreen() {
  const logbook = useLogbook();
  const flights = useFlights();
  const userPosition = useAeroStore((s) => s.userPosition);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<"entries" | "collection">("entries");

  const save = useMutation({
    mutationFn: (entry: Omit<LogbookEntry, "id">) => createLogbookEntry(entry),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["aerospot", "logbook"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLogbookEntry(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["aerospot", "logbook"] }),
  });

  const toggleFavorite = useMutation({
    mutationFn: (entry: LogbookEntry) => updateLogbookEntry(entry.id, { favorite: !entry.favorite }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["aerospot", "logbook"] }),
  });

  async function onFileChosen(file: File) {
    const exif = await readExif(file);
    const location = exif.latitude && exif.longitude
      ? { lat: exif.latitude, lng: exif.longitude }
      : userPosition ?? OSL.position;
    const matches = matchPhotoToFlight({
      capture: { timestampIso: exif.dateIso ?? new Date().toISOString(), settings: {} },
      candidates: flights.data ?? [],
      userLocation: location,
    });
    setDraft({ exif, matches, chosen: matches[0] ?? null });
  }

  function saveDraft() {
    if (!draft) return;
    const f = draft.chosen?.flight;
    save.mutate({
      dateIso: draft.exif.dateIso ?? new Date().toISOString(),
      airportIcao: OSL.icao,
      location: OSL.name,
      flightNumber: f?.flightNumber,
      callsign: f?.callsign,
      registration: f?.registration,
      aircraftType: f?.aircraftType,
      airline: f?.airline,
      latitude: draft.exif.latitude ?? userPosition?.lat,
      longitude: draft.exif.longitude ?? userPosition?.lng,
      focalLengthMm: draft.exif.focalLengthMm,
      shutterSpeed: draft.exif.shutterSpeed,
      aperture: draft.exif.aperture,
      iso: draft.exif.iso,
      cameraModel: draft.exif.cameraModel,
      lensModel: draft.exif.lensModel,
      favorite: false,
      rarity: f ? classifyRarity({ aircraftIcao: f.aircraftIcao, callsign: f.callsign }) : undefined,
    });
  }

  const entries = logbook.data ?? [];
  const stats = computeStats(entries);
  const collection = computeCollection(entries);

  return (
    <div style={{ padding: spacing.lg, paddingBottom: 96 }}>
      <h1 style={{ ...typography.hero, color: colors.textPrimary, marginTop: 0 }}>Loggbok</h1>

      {/* Statistikk */}
      <div style={{ display: "flex", gap: spacing.sm }}>
        <StatCard value={String(stats.totalAircraft)} label="fly fotografert" />
        <StatCard value={String(stats.airports)} label="flyplasser" />
        <StatCard value={String(stats.rareAircraft)} label="sjeldne fly" />
      </div>
      {stats.mostPhotographedType ? (
        <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm }}>
          Mest fotografert: {stats.mostPhotographedType}
          {stats.mostPhotographedAirline ? ` · ${stats.mostPhotographedAirline}` : ""}
        </div>
      ) : null}

      {/* Ny entry */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFileChosen(file);
          e.target.value = "";
        }}
      />
      <div style={{ marginTop: spacing.lg }}>
        <PrimaryButton onClick={() => fileRef.current?.click()}>+ Legg til bilde</PrimaryButton>
      </div>

      {/* Draft: EXIF + fly-match */}
      {draft ? (
        <Card elevated style={{ marginTop: spacing.md }}>
          <div style={{ ...typography.micro, color: colors.primaryBright, textTransform: "uppercase" }}>
            Nytt bilde
          </div>
          <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xs }}>
            {[
              draft.exif.cameraModel,
              draft.exif.lensModel,
              draft.exif.focalLengthMm ? `${draft.exif.focalLengthMm} mm` : null,
              draft.exif.shutterSpeed,
              draft.exif.aperture,
              draft.exif.iso ? `ISO ${draft.exif.iso}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Ingen EXIF funnet"}
          </div>

          {draft.matches.length > 0 ? (
            <>
              <div style={{ ...typography.headline, color: colors.textPrimary, marginTop: spacing.md }}>
                Vi tror du fotograferte
              </div>
              {draft.matches.map((m) => (
                <div
                  key={m.flight.id}
                  onClick={() => setDraft({ ...draft, chosen: m })}
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    cursor: "pointer",
                    background:
                      draft.chosen?.flight.id === m.flight.id
                        ? "rgba(38,140,255,0.14)"
                        : colors.surfaceElevated,
                    border:
                      draft.chosen?.flight.id === m.flight.id
                        ? `1px solid ${colors.primary}`
                        : `1px solid transparent`,
                  }}
                >
                  <div style={{ ...typography.headline, color: colors.textPrimary }}>
                    {m.flight.callsign}{" "}
                    <span style={{ ...typography.caption, color: colors.success }}>
                      {Math.round(m.confidence * 100)}%
                    </span>
                  </div>
                  <div style={{ ...typography.caption, color: colors.textSecondary }}>
                    {[m.flight.aircraftType, m.flight.registration, `${m.distanceKm} km`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.md }}>
              Ingen fly-match i live-data — lagres uten flyinfo.
            </div>
          )}

          <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md }}>
            <PrimaryButton onClick={saveDraft} disabled={save.isPending}>
              {save.isPending ? "Lagrer…" : "Lagre"}
            </PrimaryButton>
            <button
              onClick={() => setDraft(null)}
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                background: "transparent",
                border: `1px solid ${colors.border}`,
                borderRadius: radius.full,
                padding: `0 ${spacing.lg}px`,
                cursor: "pointer",
              }}
            >
              Avbryt
            </button>
          </div>
        </Card>
      ) : null}

      {/* Visning-toggle */}
      <SectionHeader
        title={view === "entries" ? "Fotografert" : "Samling"}
        action={
          <button
            onClick={() => setView(view === "entries" ? "collection" : "entries")}
            style={{
              ...typography.caption,
              color: colors.primaryBright,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {view === "entries" ? "Vis samling" : "Vis liste"}
          </button>
        }
      />

      {logbook.isLoading ? (
        <LoadingState label="Henter loggbok…" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Tom loggbok"
          body="Legg til ditt første bilde — EXIF og fly-match fylles ut automatisk."
        />
      ) : view === "collection" ? (
        [...collection.entries()].map(([maker, models]) => (
          <Card key={maker} style={{ marginBottom: spacing.sm }}>
            <div style={{ ...typography.micro, color: colors.textSecondary, textTransform: "uppercase" }}>
              {maker}
            </div>
            {[...models.entries()].map(([model, count]) => (
              <div
                key={model}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: spacing.sm,
                }}
              >
                <span style={{ ...typography.body, color: colors.textPrimary }}>{model}</span>
                <span style={{ ...typography.body, color: colors.textSecondary }}>{count}</span>
              </div>
            ))}
          </Card>
        ))
      ) : (
        entries.map((e) => (
          <Card key={e.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                  <span style={{ ...typography.headline, color: colors.textPrimary }}>
                    {e.aircraftType ?? e.callsign ?? "Ukjent fly"}
                  </span>
                  {e.rarity ? <RareBadge rarity={e.rarity} /> : null}
                </div>
                <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                  {[
                    e.registration,
                    e.airportIcao,
                    new Date(e.dateIso).toLocaleDateString("nb-NO"),
                    e.focalLengthMm ? `${e.focalLengthMm} mm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: spacing.sm }}>
                <button
                  onClick={() => toggleFavorite.mutate(e)}
                  aria-label={e.favorite ? "Fjern favoritt" : "Favoritt"}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    color: e.favorite ? colors.gold : colors.textTertiary,
                  }}
                >
                  ★
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Slette denne loggbok-oppføringen?")) remove.mutate(e.id);
                  }}
                  aria-label="Slett"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 15,
                    color: colors.textTertiary,
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
