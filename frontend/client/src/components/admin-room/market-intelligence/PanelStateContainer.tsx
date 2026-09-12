/**
 * PanelStateContainer.tsx
 *
 * Standardisert loading/empty/error-innpakning for Market Intelligence-
 * paneler (CTO-audit P1, punkt 5). Matcher widget-kontrakten i
 * @shared/dashboard-widget-schema (loadingState/emptyState/errorState) så
 * dagens håndrullede paneler kan bevege seg inkrementelt mot samme kontrakt
 * som den kommende WidgetRenderer-en — uten big-bang-omskriving.
 *
 * Semantikk (samme rekkefølge som widget-kontrakten):
 *   state='loading'            → sentrert spinner
 *   state='error'  + error     → warning-Alert (partial failure — resten av
 *                                 dashboardet lever videre) + valgfri Retry
 *   state='loaded' + isEmpty   → info-Alert med empty-melding
 *   ellers                     → children
 *
 * 'idle' behandles som loading (panelet har ikke begynt å hente ennå).
 */

import React from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import type {
  WidgetEmptyState,
  WidgetErrorState,
  WidgetLoadingState,
} from "@shared/dashboard-widget-schema";

interface Props {
  state: WidgetLoadingState;
  /** Vises når state='error'. Streng aksepteres som snarvei. */
  error?: WidgetErrorState | string | null;
  /** Vises når state='loaded' og isEmpty=true. */
  empty?: WidgetEmptyState | string | null;
  isEmpty?: boolean;
  /** Rendres error.retryable !== false og callback er satt. */
  onRetry?: () => void;
  children: React.ReactNode;
}

function normalizeError(error: Props["error"]): WidgetErrorState | null {
  if (!error) return null;
  return typeof error === "string" ? { message: error, retryable: true } : error;
}

function normalizeEmpty(empty: Props["empty"]): WidgetEmptyState {
  if (!empty) return { message: "Ingen data ennå." };
  return typeof empty === "string" ? { message: empty } : empty;
}

export default function PanelStateContainer({
  state,
  error,
  empty,
  isEmpty = false,
  onRetry,
  children,
}: Props) {
  if (state === "idle" || state === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (state === "error") {
    const err = normalizeError(error) ?? { message: "Noe gikk galt ved henting av data.", retryable: true };
    return (
      <Alert
        severity="warning"
        action={
          err.retryable !== false && onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Prøv igjen
            </Button>
          ) : undefined
        }
      >
        {err.message}
      </Alert>
    );
  }

  if (isEmpty) {
    return <Alert severity="info">{normalizeEmpty(empty).message}</Alert>;
  }

  return <>{children}</>;
}

/**
 * Hjelper for paneler som fortsatt holder state som { loading, error }-par:
 * mapper til widget-kontraktens loadingState.
 */
export function toLoadingState(args: {
  loading: boolean;
  error?: string | null;
}): WidgetLoadingState {
  if (args.loading) return "loading";
  if (args.error) return "error";
  return "loaded";
}
