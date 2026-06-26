/**
 * AdminButton — kanonisk knapp for admin-flaten.
 *
 * Samler de divergerende `#ff8c00`/`#ff9800`-knappene + ad-hoc hover/disabled
 * til faste varianter. Sikrer a11y: touch-mål ≥ 44px høyde, synlig fokus-ring,
 * og `aria-busy` + spinner ved `loading`.
 *
 *   <AdminButton tone="primary">Lagre</AdminButton>
 *   <AdminButton tone="danger" loading>Slett</AdminButton>
 *   <AdminButton tone="ghost" startIcon={<Icon/>}>Avbryt</AdminButton>
 */
import * as React from "react";
import { Button, CircularProgress } from "@mui/material";
import type { ButtonProps } from "@mui/material";
import { adminTokens } from "./adminTokens";

export type AdminButtonTone = "primary" | "danger" | "secondary" | "ghost";

export interface AdminButtonProps extends Omit<ButtonProps, "color" | "variant"> {
  tone?: AdminButtonTone;
  loading?: boolean;
}

const toneSx = (tone: AdminButtonTone) => {
  const c = adminTokens.color;
  switch (tone) {
    case "primary":
      return {
        backgroundColor: c.brand,
        color: "#1a1a1a",
        "&:hover": { backgroundColor: c.brandHover },
      };
    case "danger":
      return {
        backgroundColor: c.danger,
        color: "#ffffff",
        "&:hover": { backgroundColor: c.dangerHover },
      };
    case "secondary":
      return {
        backgroundColor: c.surfaceElevated,
        color: c.text,
        border: `1px solid ${adminTokens.color.borderStrong}`,
        "&:hover": { backgroundColor: c.surfaceHover },
      };
    case "ghost":
    default:
      return {
        backgroundColor: "transparent",
        color: c.textSecondary,
        "&:hover": { backgroundColor: c.surfaceHover, color: c.text },
      };
  }
};

export const AdminButton: React.FC<AdminButtonProps> = ({
  tone = "primary",
  loading = false,
  disabled,
  children,
  startIcon,
  sx,
  ...rest
}) => (
  <Button
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    startIcon={loading ? undefined : startIcon}
    disableElevation
    sx={{
      textTransform: "none",
      fontWeight: 600,
      borderRadius: `${adminTokens.radius.sm}px`,
      minHeight: 44,
      px: 2,
      "&.Mui-disabled": { opacity: 0.5 },
      "&:focus-visible": {
        outline: `2px solid ${adminTokens.color.brand}`,
        outlineOffset: 2,
      },
      ...toneSx(tone),
      ...sx,
    }}
  >
    {loading ? <CircularProgress size={20} sx={{ color: "inherit" }} /> : children}
  </Button>
);

export default AdminButton;
