/**
 * AdminStates — konsistente laste-, tom- og feil-tilstander.
 *
 * Admin-panelene håndterer disse vilkårlig (noen CircularProgress, noen tekst,
 * noen ingenting). Disse gir ett konsistent, a11y-vennlig mønster.
 */
import * as React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { adminTokens } from "./adminTokens";
import { AdminButton } from "./AdminButton";

const wrap = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center" as const,
  gap: 1.5,
  px: 2,
  py: { xs: 4, sm: 6 },
};

export const AdminLoading: React.FC<{ label?: string }> = ({ label = "Laster …" }) => (
  <Box sx={wrap} role="status" aria-live="polite">
    <CircularProgress sx={{ color: adminTokens.color.brand }} />
    <Typography variant="body2" sx={{ color: adminTokens.color.textMuted }}>
      {label}
    </Typography>
  </Box>
);

export const AdminEmpty: React.FC<{
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title = "Ingenting her ennå", description, icon, action }) => (
  <Box sx={wrap}>
    {icon && <Box sx={{ color: adminTokens.color.textMuted, fontSize: 40, lineHeight: 1 }}>{icon}</Box>}
    <Typography variant="subtitle1" sx={{ color: adminTokens.color.text, fontWeight: 600 }}>
      {title}
    </Typography>
    {description && (
      <Typography variant="body2" sx={{ color: adminTokens.color.textMuted, maxWidth: 420 }}>
        {description}
      </Typography>
    )}
    {action && <Box sx={{ mt: 1 }}>{action}</Box>}
  </Box>
);

export const AdminError: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
}> = ({ title = "Noe gikk galt", message, onRetry }) => (
  <Box sx={wrap} role="alert">
    <Typography variant="subtitle1" sx={{ color: adminTokens.color.error, fontWeight: 600 }}>
      {title}
    </Typography>
    {message && (
      <Typography variant="body2" sx={{ color: adminTokens.color.textMuted, maxWidth: 420 }}>
        {message}
      </Typography>
    )}
    {onRetry && (
      <AdminButton tone="secondary" onClick={onRetry} sx={{ mt: 1 }}>
        Prøv igjen
      </AdminButton>
    )}
  </Box>
);
