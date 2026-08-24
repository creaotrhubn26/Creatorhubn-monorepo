/**
 * aerospot/screens/CameraScreen.tsx — Kameraassistent.
 * Modi: Anbefalt (freeze) / Panning / Propeller / Natt.
 * Med Canon tilkoblet: live-state + differ mot anbefaling.
 * Settings-write er IKKE støttet av CCAPI-proxyen ennå → ingen
 * Apply-knapp vises (capability-ærlig).
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { colors, radius, spacing, typography } from "../theme";
import { Card, PrimaryButton, SectionHeader, ValueTile } from "../components/ui";
import { recommendCameraSettings } from "../services/CameraRecommendationService";
import { cameraSync, parseLensRange } from "../services/CameraSyncService";
import { useFlights, useSun, useWeather } from "../hooks";
import { useAeroStore } from "../store";
import { distanceKm } from "../services/geo";
import type { ConnectedCameraState, PhotographyMode } from "../types";

const MODES: { key: PhotographyMode; label: string }[] = [
  { key: "freeze", label: "Anbefalt" },
  { key: "panning", label: "Panning" },
  { key: "propeller", label: "Propell" },
  { key: "night", label: "Natt" },
];

const TIPS = [
  "Flyet kommer fra siden? La det være mer luft foran flyet enn bak.",
  "Bruk tredjedelsregelen — plasser flyet i øvre eller nedre tredjedel.",
  "Pass på highlights i skyene — trekk eksponeringen ned 1/3 ved behov.",
  "Varm dag? Heat haze ødelegger telebilder — kom nærmere eller vent.",
  "Panning: fortsett bevegelsen etter eksponeringen, som en golfsving.",
];

function useCameraState(): ConnectedCameraState {
  const [state, setState] = useState<ConnectedCameraState>(cameraSync.getState());
  useEffect(() => cameraSync.onStateChange(setState), []);
  return state;
}

function CameraConnectionCard({ camera }: { camera: ConnectedCameraState }) {
  const cameraIp = useAeroStore((s) => s.cameraIp);
  const setCameraIp = useAeroStore((s) => s.setCameraIp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (camera.connected) {
    return (
      <Card elevated>
        <div style={{ ...typography.micro, color: colors.success, textTransform: "uppercase" }}>
          ● Tilkoblet kamera
        </div>
        <div style={{ ...typography.title, color: colors.textPrimary, marginTop: spacing.xs }}>
          {camera.model ?? "Canon"}
        </div>
        {camera.lensName ? (
          <div style={{ ...typography.body, color: colors.textSecondary }}>{camera.lensName}</div>
        ) : null}
        <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
          <ValueTile label="Lukker" value={camera.settings.shutterSpeed ?? "–"} />
          <ValueTile label="Blender" value={camera.settings.aperture ?? "–"} />
          <ValueTile label="ISO" value={String(camera.settings.iso ?? "–")} />
        </div>
        <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
          <ValueTile
            label="Batteri"
            value={camera.batteryPercent !== undefined ? `${camera.batteryPercent}%` : "–"}
          />
          <ValueTile
            label="Lagring"
            value={camera.storageFreeGb !== undefined ? `${camera.storageFreeGb} GB ledig` : "–"}
          />
        </div>
        <div style={{ marginTop: spacing.md }}>
          <button
            onClick={() => void cameraSync.disconnect()}
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              background: "transparent",
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              padding: `${spacing.sm}px ${spacing.md}px`,
              cursor: "pointer",
            }}
          >
            Koble fra
          </button>
        </div>
      </Card>
    );
  }

  if (camera.reconnecting) {
    return (
      <Card elevated>
        <div style={{ ...typography.headline, color: colors.warning }}>Kamera frakoblet</div>
        <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xs }}>
          Prøver å koble til igjen…
        </div>
      </Card>
    );
  }

  return (
    <Card elevated>
      <div style={{ ...typography.headline, color: colors.textPrimary }}>Koble til Canon-kamera</div>
      <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xs }}>
        Få live kamerainnstillinger og smartere AeroSpot-anbefalinger via CCAPI.
      </div>
      <input
        value={cameraIp}
        onChange={(e) => setCameraIp(e.target.value)}
        placeholder="Kameraets IP-adresse (f.eks. 192.168.1.2)"
        inputMode="decimal"
        style={{
          width: "100%",
          marginTop: spacing.md,
          padding: spacing.md,
          background: colors.surfaceElevated,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          color: colors.textPrimary,
          ...typography.body,
          boxSizing: "border-box",
        }}
      />
      {error ? (
        <div style={{ ...typography.caption, color: colors.danger, marginTop: spacing.sm }}>{error}</div>
      ) : null}
      <div style={{ marginTop: spacing.md }}>
        <PrimaryButton
          disabled={busy || !/^\d{1,3}(\.\d{1,3}){3}$/.test(cameraIp)}
          onClick={() => {
            setBusy(true);
            setError(null);
            cameraSync
              .connect(cameraIp)
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Tilkobling feilet"))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Kobler til…" : "Koble til"}
        </PrimaryButton>
      </div>
    </Card>
  );
}

export function CameraScreen() {
  const mode = useAeroStore((s) => s.photographyMode);
  const setMode = useAeroStore((s) => s.setPhotographyMode);
  const userPosition = useAeroStore((s) => s.userPosition);
  const camera = useCameraState();
  const flights = useFlights();
  const weather = useWeather();
  const sun = useSun();
  const [tipIndex, setTipIndex] = useState(0);

  // Nærmeste fly i lufta = anbefalings-target
  const nearest = useMemo(() => {
    const list = (flights.data ?? []).filter((f) => !f.onGround);
    if (!userPosition || list.length === 0) return list[0] ?? null;
    return [...list].sort(
      (a, b) =>
        distanceKm(userPosition, { lat: a.latitude, lng: a.longitude }) -
        distanceKm(userPosition, { lat: b.latitude, lng: b.longitude }),
    )[0];
  }, [flights.data, userPosition]);

  const lensRange = parseLensRange(camera.lensName);

  const result = useMemo(
    () =>
      recommendCameraSettings({
        photographyMode: mode,
        aircraft: nearest
          ? {
              type: nearest.aircraftType,
              speedKt: nearest.groundSpeedKt,
              altitudeFt: nearest.altitudeFt,
              distanceKm: userPosition
                ? distanceKm(userPosition, { lat: nearest.latitude, lng: nearest.longitude })
                : undefined,
            }
          : undefined,
        environment: { sunElevationDeg: sun.elevationDeg, weather: weather.data },
        camera: camera.connected
          ? { model: camera.model, currentSettings: camera.settings }
          : undefined,
        lens: lensRange
          ? { model: camera.lensName, minFocalLengthMm: lensRange[0], maxFocalLengthMm: lensRange[1] }
          : undefined,
      }),
    [mode, nearest, sun.elevationDeg, weather.data, camera, userPosition, lensRange],
  );

  const rec = result.recommendation;

  return (
    <div style={{ padding: spacing.lg, paddingBottom: 96 }}>
      <h1 style={{ ...typography.hero, color: colors.textPrimary, marginTop: 0 }}>Kameraassistent</h1>

      {/* Mode-velger */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg }}>
        {MODES.map((m) => (
          <motion.button
            key={m.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMode(m.key)}
            style={{
              ...typography.caption,
              flex: 1,
              padding: `${spacing.sm}px 0`,
              borderRadius: radius.full,
              border: "none",
              cursor: "pointer",
              color: mode === m.key ? "#fff" : colors.textSecondary,
              background: mode === m.key ? colors.primary : colors.surfaceElevated,
            }}
          >
            {m.label}
          </motion.button>
        ))}
      </div>

      {/* Anbefaling */}
      <Card elevated>
        <div style={{ ...typography.micro, color: colors.primaryBright, textTransform: "uppercase" }}>
          Anbefalt{nearest ? ` · ${nearest.aircraftType ?? nearest.callsign}` : ""}
        </div>
        <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
          <ValueTile label="Lukker" value={rec.shutterSpeed} />
          <ValueTile label="Blender" value={rec.aperture} />
          <ValueTile label="ISO" value={String(rec.iso)} />
          <ValueTile label="Objektiv" value={`${rec.focalLengthMm[0]}–${rec.focalLengthMm[1]} mm`} />
        </div>
        <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md }}>
          {result.explanation}
        </div>
      </Card>

      {/* Differ mot kameraet */}
      {camera.connected && result.differences.length > 0 ? (
        <Card style={{ marginTop: spacing.md, borderColor: "rgba(255,184,77,0.4)" }}>
          <div style={{ ...typography.micro, color: colors.warning, textTransform: "uppercase" }}>
            Avvik fra kameraet ditt
          </div>
          {result.differences.map((d) => (
            <div key={d.setting} style={{ marginTop: spacing.sm }}>
              <div style={{ ...typography.body, color: colors.textPrimary }}>{d.message}</div>
              <div style={{ ...typography.caption, color: colors.textSecondary }}>
                Anbefalt {d.recommended} · Nå {d.current}
              </div>
            </div>
          ))}
        </Card>
      ) : null}
      {camera.connected && result.differences.length === 0 ? (
        <div style={{ ...typography.caption, color: colors.success, marginTop: spacing.md }}>
          ✓ Kameraet matcher anbefalingen
        </div>
      ) : null}

      {/* Connected camera */}
      <SectionHeader title="Kamera" />
      <CameraConnectionCard camera={camera} />

      {/* Fototips */}
      <SectionHeader title="Dagens fototips" />
      <Card onClick={() => setTipIndex((tipIndex + 1) % TIPS.length)}>
        <div style={{ ...typography.body, color: colors.textPrimary }}>{TIPS[tipIndex]}</div>
        <div style={{ ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm }}>
          Trykk for neste tips · {tipIndex + 1}/{TIPS.length}
        </div>
      </Card>
    </div>
  );
}
