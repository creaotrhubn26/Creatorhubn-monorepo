/**
 * aerospot/components/ui.tsx — gjenbrukbare byggeklosser.
 * Alle farger/spacing fra theme-tokens — ingen hardkoding i skjermer.
 */

import React from "react";
import { motion } from "framer-motion";
import { colors, durations, radius, rarityColors, shadows, spacing, typography } from "../theme";
import { rarityLabels } from "../services/RarityService";
import type { Rarity } from "../types";

export function Card({
  children,
  elevated,
  onClick,
  style,
}: {
  children: React.ReactNode;
  elevated?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: durations.fast }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{
        background: elevated ? colors.surfaceElevated : colors.surface,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        padding: spacing.lg,
        boxShadow: shadows.card,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        margin: `${spacing.xl}px 0 ${spacing.md}px`,
      }}
    >
      <h2 style={{ ...typography.headline, color: colors.textPrimary, margin: 0 }}>{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, textAlign: "center", padding: spacing.md }}>
      <div style={{ ...typography.title, color: colors.textPrimary }}>{value}</div>
      <div style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
        {label}
      </div>
    </Card>
  );
}

export function RareBadge({ rarity }: { rarity: Rarity }) {
  if (rarity === "common") return null;
  return (
    <span
      style={{
        ...typography.micro,
        color: colors.background,
        background: rarityColors[rarity],
        borderRadius: radius.sm,
        padding: `2px ${spacing.sm}px`,
      }}
    >
      {rarityLabels[rarity]}
    </span>
  );
}

export function RunwayBadge({ runway }: { runway: string }) {
  return (
    <span
      style={{
        ...typography.headline,
        color: colors.primaryBright,
        background: "rgba(38,140,255,0.14)",
        border: `1px solid rgba(38,140,255,0.35)`,
        borderRadius: radius.sm,
        padding: `2px ${spacing.sm}px`,
      }}
    >
      {runway}
    </span>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? colors.success : value >= 55 ? colors.warning : colors.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}>
      <span style={{ ...typography.caption, color: colors.textSecondary, width: 64 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: colors.surfaceElevated, borderRadius: radius.full }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: durations.slow }}
          style={{ height: 6, background: color, borderRadius: radius.full }}
        />
      </div>
      <span style={{ ...typography.caption, color: colors.textPrimary, width: 28, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

export function LoadingState({ label = "Laster…" }: { label?: string }) {
  return (
    <div style={{ padding: spacing.xxl, textAlign: "center" }}>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        style={{ ...typography.body, color: colors.textSecondary }}
      >
        {label}
      </motion.div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ padding: spacing.xxl, textAlign: "center" }}>
      <div style={{ ...typography.headline, color: colors.textPrimary }}>{title}</div>
      {body ? (
        <div style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
          {body}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ padding: spacing.xxl, textAlign: "center" }}>
      <div style={{ ...typography.body, color: colors.danger }}>{message}</div>
      {onRetry ? (
        <button
          onClick={onRetry}
          style={{
            marginTop: spacing.md,
            ...typography.caption,
            color: colors.primaryBright,
            background: "transparent",
            border: `1px solid ${colors.primary}`,
            borderRadius: radius.sm,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            cursor: "pointer",
          }}
        >
          Prøv igjen
        </button>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...typography.headline,
        color: "#fff",
        background: disabled ? colors.surfaceElevated : colors.primary,
        border: "none",
        borderRadius: radius.full,
        padding: `${spacing.md}px ${spacing.xl}px`,
        cursor: disabled ? "default" : "pointer",
        width: "100%",
      }}
    >
      {children}
    </motion.button>
  );
}

/** Nøkkel/verdi-rute brukt i kamera- og flydetalj-visninger */
export function ValueTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: colors.surfaceElevated,
        borderRadius: radius.md,
        padding: spacing.md,
        flex: 1,
        minWidth: 90,
      }}
    >
      <div style={{ ...typography.micro, color: colors.textSecondary, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ ...typography.headline, color: colors.textPrimary, marginTop: 2 }}>{value}</div>
    </div>
  );
}
