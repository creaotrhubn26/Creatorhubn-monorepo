/**
 * AdminCard — kanonisk kort/seksjon-container for admin-paneler.
 *
 * Erstatter de mange varierende `<Paper sx={{ backgroundColor: 'rgba(255,255,255,0.0x)', … }}>`-
 * blokkene med én konsistent overflate, kantlinje, radius og RESPONSIV padding
 * (mindre på mobil). Valgfri tittel/undertittel/handling i en header.
 */
import * as React from "react";
import { Box, Paper, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { adminTokens } from "./adminTokens";

export interface AdminCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Handling(er) til høyre i headeren (knapper, filtre …). */
  action?: React.ReactNode;
  /** Slå av indre padding (f.eks. når kortet kun inneholder en tabell). */
  disablePadding?: boolean;
  children?: React.ReactNode;
  sx?: SxProps<Theme>;
  component?: React.ElementType;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  title,
  subtitle,
  action,
  disablePadding = false,
  children,
  sx,
  component = "section",
}) => {
  const hasHeader = Boolean(title || action);
  return (
    <Paper
      component={component}
      elevation={0}
      sx={{
        backgroundColor: adminTokens.color.surface,
        border: `1px solid ${adminTokens.color.border}`,
        borderRadius: `${adminTokens.radius.md}px`,
        overflow: "hidden",
        ...sx,
      }}
    >
      {hasHeader && (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 1.5,
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
            borderBottom: children ? `1px solid ${adminTokens.color.borderSubtle}` : "none",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography
                variant="h6"
                sx={{ color: adminTokens.color.text, fontWeight: 700, lineHeight: 1.3 }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" sx={{ color: adminTokens.color.textMuted, mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && (
            <Box sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>{action}</Box>
          )}
        </Box>
      )}
      {children != null && (
        <Box sx={disablePadding ? undefined : { p: { xs: 2, sm: 3 } }}>{children}</Box>
      )}
    </Paper>
  );
};

export default AdminCard;
