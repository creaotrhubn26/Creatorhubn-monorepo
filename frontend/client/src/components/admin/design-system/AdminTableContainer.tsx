/**
 * AdminTableContainer — responsiv, konsistent ramme rundt admin-tabeller.
 *
 * Mange admin-tabeller har faste bredder og renner over på mobil. Denne gir
 * horisontal scroll (med touch-momentum) + standard header-/rad-styling, så
 * tabeller blir brukbare på små skjermer uten å rive opp hver enkelt.
 *
 *   <AdminTableContainer>
 *     <Table>…</Table>
 *   </AdminTableContainer>
 *
 * `useIsMobile()` kan brukes for å bytte til kort-visning på de smaleste skjermene.
 */
import * as React from "react";
import { TableContainer, useMediaQuery, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { adminTokens } from "./adminTokens";

export interface AdminTableContainerProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  /** Tilgjengelig beskrivelse av tabellen (scroll-region får role + label). */
  ariaLabel?: string;
}

export const AdminTableContainer: React.FC<AdminTableContainerProps> = ({
  children,
  sx,
  ariaLabel,
}) => (
  <TableContainer
    role="region"
    aria-label={ariaLabel}
    tabIndex={0}
    sx={{
      width: "100%",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      "& .MuiTableCell-head": {
        color: adminTokens.color.text,
        fontWeight: 700,
        borderBottom: `1px solid ${adminTokens.color.border}`,
        whiteSpace: "nowrap",
      },
      "& .MuiTableCell-body": {
        color: adminTokens.color.textSecondary,
        borderBottom: `1px solid ${adminTokens.color.borderSubtle}`,
      },
      "& .MuiTableRow-root:hover .MuiTableCell-body": {
        backgroundColor: adminTokens.color.surfaceHover,
      },
      "&:focus-visible": {
        outline: `2px solid ${adminTokens.color.brand}`,
        outlineOffset: 2,
      },
      ...sx,
    }}
  >
    {children}
  </TableContainer>
);

/** True på mobil/små skjermer (< sm). Bruk for kort-vs-tabell-bytte. */
export function useIsMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}

export default AdminTableContainer;
