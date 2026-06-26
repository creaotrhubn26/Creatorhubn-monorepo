/**
 * StatusChip — kanonisk status-/rolle-merke for admin-flaten.
 *
 * Samler de mange ad-hoc `<Chip color=… />`-bruksmønstrene til ett sted med
 * konsistent fargekode. A11y: farge er ALDRI eneste signal — teksten bærer
 * betydningen, og chip-en får `aria-label`.
 *
 *   <StatusChip tone="success" label="Aktiv" />
 *   <StatusChip role="super_admin" />            // → rød "Super Admin"
 *   <StatusChip status="pending" />              // → kjent status-mapping
 */
import * as React from "react";
import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import { adminTokens } from "./adminTokens";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "brand";

const TONE_COLOR: Record<StatusTone, string> = {
  success: adminTokens.color.success,
  warning: adminTokens.color.warning,
  error: adminTokens.color.error,
  info: adminTokens.color.info,
  brand: adminTokens.color.brand,
  neutral: adminTokens.color.textMuted,
};

const STATUS_MAP: Record<string, { tone: StatusTone; label: string }> = {
  active: { tone: "success", label: "Aktiv" },
  approved: { tone: "success", label: "Godkjent" },
  live: { tone: "success", label: "Live" },
  pending: { tone: "warning", label: "Venter" },
  reviewing: { tone: "warning", label: "Til vurdering" },
  inactive: { tone: "neutral", label: "Inaktiv" },
  rejected: { tone: "error", label: "Avvist" },
  failed: { tone: "error", label: "Feilet" },
  converted: { tone: "info", label: "Konvertert" },
};

const ROLE_MAP: Record<string, { color: string; label: string }> = {
  super_admin: { color: adminTokens.role.super_admin, label: "Super Admin" },
  admin: { color: adminTokens.role.admin, label: "Admin" },
  user: { color: adminTokens.role.user, label: "Bruker" },
};

export interface StatusChipProps extends Omit<ChipProps, "color" | "label"> {
  tone?: StatusTone;
  status?: string;
  role?: string;
  label?: React.ReactNode;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  tone,
  status,
  role,
  label,
  size = "small",
  sx,
  ...rest
}) => {
  let color = adminTokens.color.textMuted;
  let text: React.ReactNode = label;

  if (role) {
    const r = ROLE_MAP[String(role).toLowerCase()] ?? { color: adminTokens.color.textMuted, label: role };
    color = r.color;
    text = text ?? r.label;
  } else if (status && STATUS_MAP[String(status).toLowerCase()]) {
    const s = STATUS_MAP[String(status).toLowerCase()];
    color = TONE_COLOR[s.tone];
    text = text ?? s.label;
  } else if (tone) {
    color = TONE_COLOR[tone];
  }
  text = text ?? status ?? "—";

  return (
    <Chip
      {...rest}
      size={size}
      label={text}
      aria-label={typeof text === "string" ? text : undefined}
      sx={{
        color,
        backgroundColor: "transparent",
        border: `1px solid ${color}`,
        fontWeight: 600,
        ...sx,
      }}
    />
  );
};

export default StatusChip;
