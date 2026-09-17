/**
 * aerospot/AeroSpotApp.tsx — app-shell: bottom navigation + skjermer +
 * spottepunkt-detalj-sheet. Mobile-first (maks 520px bredde sentrert).
 */

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { colors, radius, shadows, spacing, typography, durations } from "./theme";
import { useAeroStore, type AeroTab } from "./store";
import { HomeScreen } from "./screens/HomeScreen";
import { LiveMapScreen } from "./screens/LiveMapScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { LogbookScreen } from "./screens/LogbookScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OSL_SPOTTING_LOCATIONS } from "./data/osl";
import { useSpottingIntelligence, useSun } from "./hooks";
import { lightQualityForDirection } from "./services/SunService";
import { ScoreBar, ValueTile } from "./components/ui";

const queryClient = new QueryClient();

const TABS: { key: AeroTab; label: string; icon: string }[] = [
  { key: "home", label: "Hjem", icon: "⌂" },
  { key: "live", label: "Live", icon: "◎" },
  { key: "camera", label: "Kamera", icon: "▣" },
  { key: "logbook", label: "Loggbok", icon: "▤" },
  { key: "profile", label: "Profil", icon: "◉" },
];

function LocationSheet() {
  const selectedLocationId = useAeroStore((s) => s.selectedLocationId);
  const selectLocation = useAeroStore((s) => s.selectLocation);
  const intel = useSpottingIntelligence();
  const sun = useSun();
  const location = OSL_SPOTTING_LOCATIONS.find((l) => l.id === selectedLocationId);
  if (!location) return null;

  const rec = intel.ranked.find((r) => r.location.id === location.id);
  const light = lightQualityForDirection(sun.azimuthDeg, sun.elevationDeg, location.shootingDirectionDeg);

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
        zIndex: 1200,
        background: colors.surface,
        borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
        boxShadow: shadows.sheet,
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
        maxHeight: "80%",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ ...typography.title, color: colors.textPrimary }}>
            {location.name}{" "}
            <span style={{ ...typography.caption, color: colors.warning }}>
              ★ {location.rating.toFixed(1)}
            </span>
          </div>
          <div style={{ ...typography.caption, color: colors.textSecondary }}>
            {location.bestFor.join(" · ")}
          </div>
        </div>
        <button
          onClick={() => selectLocation(null)}
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

      <p style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md }}>
        {location.description}
      </p>

      {rec ? (
        <div style={{ marginTop: spacing.md }}>
          <div style={{ ...typography.micro, color: colors.primaryBright, textTransform: "uppercase", marginBottom: spacing.sm }}>
            Spotting score · {rec.score.total}/100
          </div>
          <ScoreBar label="Lys" value={rec.score.light} />
          <ScoreBar label="Vind" value={rec.score.wind} />
          <ScoreBar label="Sikt" value={rec.score.visibility} />
          <ScoreBar label="Trafikk" value={rec.score.traffic} />
          <ScoreBar label="Posisjon" value={rec.score.position} />
        </div>
      ) : null}

      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
        <ValueTile label="Lys nå" value={light.label} />
        <ValueTile label="Solvinkel" value={`${Math.round(sun.azimuthDeg)}°`} />
        <ValueTile label="Objektiv" value={`${location.recommendedFocalLengthMm[0]}–${location.recommendedFocalLengthMm[1]} mm`} />
      </div>

      <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md }}>
        <div>☀ {location.sunNotes}</div>
        <div style={{ marginTop: spacing.xs }}>🅿 {location.parking} · {location.walkMinutes} min å gå</div>
        {location.restrictions ? (
          <div style={{ marginTop: spacing.xs, color: colors.warning }}>⚠ {location.restrictions}</div>
        ) : null}
      </div>
    </motion.div>
  );
}

function Shell() {
  const tab = useAeroStore((s) => s.tab);
  const setTab = useAeroStore((s) => s.setTab);
  const requestLocation = useAeroStore((s) => s.requestLocation);
  const locationPermission = useAeroStore((s) => s.locationPermission);

  // Be om posisjon først når brukeren går til Live-kartet (god permission-UX)
  useEffect(() => {
    if (tab === "live" && locationPermission === "unknown") requestLocation();
  }, [tab, locationPermission, requestLocation]);

  return (
    <div
      style={{
        fontFamily: typography.fontFamily,
        background: colors.background,
        height: "100dvh",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, overflowY: tab === "live" ? "hidden" : "auto" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.base }}
              style={{ height: "100%" }}
            >
              {tab === "home" ? <HomeScreen /> : null}
              {tab === "live" ? <LiveMapScreen /> : null}
              {tab === "camera" ? <CameraScreen /> : null}
              {tab === "logbook" ? <LogbookScreen /> : null}
              {tab === "profile" ? <ProfileScreen /> : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom nav */}
        <nav
          aria-label="Hovednavigasjon"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            display: "flex",
            background: "rgba(11,21,34,0.92)",
            backdropFilter: "blur(16px)",
            borderTop: `1px solid ${colors.border}`,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-label={t.label}
              aria-current={tab === t.key ? "page" : undefined}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: `${spacing.sm}px 0 ${spacing.md}px`,
                color: tab === t.key ? colors.primaryBright : colors.textTertiary,
                minHeight: 52,
              }}
            >
              <div style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</div>
              <div style={{ ...typography.micro, marginTop: 2 }}>{t.label}</div>
            </button>
          ))}
        </nav>

        <AnimatePresence>
          <LocationSheet key="location-sheet" />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AeroSpotApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
