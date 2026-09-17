/**
 * aerospot/screens/ProfileScreen.tsx — varsler, posisjon, personvern.
 */

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors, radius, spacing, typography } from "../theme";
import { Card, EmptyState, LoadingState, PrimaryButton, SectionHeader } from "../components/ui";
import { useAeroStore } from "../store";
import type { AlertKind, SpottingAlert } from "../types";

const ALERT_KINDS: { key: AlertKind; label: string; placeholder: string }[] = [
  { key: "aircraft_type", label: "Flytype", placeholder: "f.eks. A388" },
  { key: "registration", label: "Registrering", placeholder: "f.eks. LN-NIE" },
  { key: "airline", label: "Flyselskap", placeholder: "f.eks. SAS" },
  { key: "rare", label: "Sjeldne fly", placeholder: "min. sjeldenhet: rare" },
];

async function fetchAlerts(): Promise<SpottingAlert[]> {
  const res = await fetch("/api/aerospot/alerts", { credentials: "include" });
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as { alerts: SpottingAlert[] };
  return body.alerts;
}

export function ProfileScreen() {
  const locationPermission = useAeroStore((s) => s.locationPermission);
  const requestLocation = useAeroStore((s) => s.requestLocation);
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: ["aerospot", "alerts"], queryFn: fetchAlerts, retry: false });
  const [kind, setKind] = useState<AlertKind>("aircraft_type");
  const [value, setValue] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/aerospot/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value, airportIcao: "ENGM" }),
      });
      if (!res.ok) throw new Error("Kunne ikke lagre varsel");
    },
    onSuccess: () => {
      setValue("");
      void queryClient.invalidateQueries({ queryKey: ["aerospot", "alerts"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/aerospot/alerts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["aerospot", "alerts"] }),
  });

  return (
    <div style={{ padding: spacing.lg, paddingBottom: 96 }}>
      <h1 style={{ ...typography.hero, color: colors.textPrimary, marginTop: 0 }}>Profil</h1>

      {/* Posisjon */}
      <SectionHeader title="Posisjon" />
      <Card>
        <div style={{ ...typography.body, color: colors.textSecondary }}>
          {locationPermission === "granted"
            ? "Posisjon aktiv — brukes til avstand, retning og spottepunkt-ranking."
            : locationPermission === "denied"
              ? "Posisjon avslått. AeroSpot fungerer fortsatt, men uten avstand/retning."
              : "Skru på posisjon for avstander, objektiv-forslag og smartere anbefalinger."}
        </div>
        {locationPermission !== "granted" ? (
          <div style={{ marginTop: spacing.md }}>
            <PrimaryButton onClick={requestLocation}>Del posisjon</PrimaryButton>
          </div>
        ) : null}
      </Card>

      {/* Varsler */}
      <SectionHeader title="Varsler" />
      <Card>
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          {ALERT_KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              style={{
                ...typography.caption,
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radius.full,
                border: "none",
                cursor: "pointer",
                color: kind === k.key ? "#fff" : colors.textSecondary,
                background: kind === k.key ? colors.primary : colors.surfaceElevated,
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ALERT_KINDS.find((k) => k.key === kind)?.placeholder}
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
        <div style={{ marginTop: spacing.md }}>
          <PrimaryButton
            disabled={value.trim().length === 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            Opprett varsel for OSL
          </PrimaryButton>
        </div>
        {create.isError ? (
          <div style={{ ...typography.caption, color: colors.danger, marginTop: spacing.sm }}>
            Krever innlogging — logg inn for å lagre varsler.
          </div>
        ) : null}
      </Card>

      {alerts.isLoading ? (
        <LoadingState label="Henter varsler…" />
      ) : alerts.isError ? (
        <div style={{ ...typography.caption, color: colors.textTertiary, marginTop: spacing.md }}>
          Logg inn for å se lagrede varsler.
        </div>
      ) : (alerts.data ?? []).length === 0 ? (
        <EmptyState title="Ingen varsler" body="Opprett et varsel — f.eks. når en A380 nærmer seg OSL." />
      ) : (
        (alerts.data ?? []).map((a) => (
          <Card key={a.id} style={{ marginTop: spacing.sm, padding: spacing.md }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ ...typography.headline, color: colors.textPrimary }}>{a.value}</div>
                <div style={{ ...typography.caption, color: colors.textSecondary }}>
                  {ALERT_KINDS.find((k) => k.key === a.kind)?.label ?? a.kind}
                  {a.airportIcao ? ` · ${a.airportIcao}` : ""}
                </div>
              </div>
              <button
                onClick={() => remove.mutate(a.id)}
                aria-label="Slett varsel"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: colors.textTertiary,
                  fontSize: 15,
                }}
              >
                🗑
              </button>
            </div>
          </Card>
        ))
      )}

      {/* Personvern */}
      <SectionHeader title="Personvern" />
      <Card>
        <div style={{ ...typography.body, color: colors.textSecondary }}>
          Bilder og posisjon er dine data. Loggbok-oppføringer kan slettes enkeltvis i
          Loggbok-fanen, og posisjonstilgang styres i nettleseren/OS-et. Kontosletting og
          dataeksport håndteres via CreatorHub-kontoen din.
        </div>
      </Card>
    </div>
  );
}
