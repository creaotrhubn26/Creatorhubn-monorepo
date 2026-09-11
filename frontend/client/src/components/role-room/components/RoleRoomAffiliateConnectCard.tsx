import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { AccountBalanceOutlined as AccountBalanceOutlinedIcon } from "@mui/icons-material";
import { apiFetch } from "@/lib/queryClient";

interface AffiliateStatus {
  partner: {
    referralCode: string;
    minimumPayoutMinor: number;
    payoutCurrency: string;
  };
  connect: {
    onboardingStatus: "not_started" | "pending" | "restricted" | "complete";
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    transfersStatus: string | null;
  };
  balance: {
    currency: string;
    accruedMinor: number;
    adjustmentMinor: number;
    reservedOrTransferredMinor: number;
    availableMinor: number;
    nextMaturityAt: string | null;
  };
}

interface RoleRoomAffiliateConnectCardProps {
  organizationId: string;
}

export function isStripeConnectOnboardingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "connect.stripe.com";
  } catch {
    return false;
  }
}

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export const RoleRoomAffiliateConnectCard: React.FC<
  RoleRoomAffiliateConnectCardProps
> = ({ organizationId }) => {
  const [status, setStatus] = useState<AffiliateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingOnboarding, setStartingOnboarding] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/role-room/storage/affiliate/connect/status?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "GET", credentials: "include" },
      );
      if (response.status === 403 || response.status === 404) {
        setHidden(true);
        setStatus(null);
        return;
      }
      if (!response.ok) throw new Error("status_failed");
      setStatus((await response.json()) as AffiliateStatus);
      setHidden(false);
    } catch {
      setError("Kunne ikke hente affiliate-utbetalingsstatus akkurat nå.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const startOnboarding = async () => {
    setStartingOnboarding(true);
    setError(null);
    try {
      const response = await apiFetch(
        "/api/role-room/storage/affiliate/connect/onboarding",
        {
          method: "POST",
          credentials: "include",
          body: { organizationId },
        },
      );
      if (!response.ok) throw new Error("onboarding_failed");
      const payload = (await response.json()) as { onboardingUrl?: unknown };
      const onboardingUrl =
        typeof payload.onboardingUrl === "string" ? payload.onboardingUrl : "";
      if (!isStripeConnectOnboardingUrl(onboardingUrl)) {
        throw new Error("invalid_onboarding_url");
      }
      window.location.assign(onboardingUrl);
    } catch {
      setError("Kunne ikke starte sikker onboarding hos Stripe. Prøv igjen.");
      setStartingOnboarding(false);
    }
  };

  if (hidden) return null;

  return (
    <Box
      data-testid="role-room-affiliate-connect-card"
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 2,
        border: "1px solid rgba(196,181,253,0.24)",
        bgcolor: "rgba(76,29,149,0.16)",
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <AccountBalanceOutlinedIcon sx={{ color: "#c4b5fd" }} />
            <Typography variant="subtitle2" fontWeight={800}>
              Affiliate-utbetalinger
            </Typography>
          </Stack>
          {status ? (
            <Chip
              size="small"
              color={
                status.connect.onboardingStatus === "complete"
                  ? "success"
                  : "warning"
              }
              label={
                status.connect.onboardingStatus === "complete"
                  ? "KYC fullført"
                  : "KYC gjenstår"
              }
            />
          ) : null}
        </Stack>

        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Henter Stripe-status …
            </Typography>
          </Stack>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        {status ? (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(245,243,255,0.66)" }}
                >
                  Tilgjengelig etter 30 dagers sikkerhetsperiode
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {formatMoney(
                    status.balance.availableMinor,
                    status.balance.currency,
                  )}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(245,243,255,0.66)" }}
                >
                  Minste utbetaling
                </Typography>
                <Typography variant="body1" fontWeight={700}>
                  {formatMoney(
                    status.partner.minimumPayoutMinor,
                    status.partner.payoutCurrency,
                  )}
                </Typography>
              </Box>
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: "rgba(245,243,255,0.66)" }}
            >
              Månedlig utbetaling til organisasjonens Stripe-konto. Refusjoner
              og chargebacks trekkes fra neste oppgjør.
            </Typography>
            <Button
              variant="contained"
              startIcon={
                startingOnboarding ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
              disabled={startingOnboarding}
              onClick={() => {
                void startOnboarding();
              }}
              sx={{
                alignSelf: "flex-start",
                textTransform: "none",
                fontWeight: 700,
              }}
            >
              {status.connect.onboardingStatus === "complete"
                ? "Oppdater Stripe-opplysninger"
                : "Fullfør sikker Stripe-onboarding"}
            </Button>
          </>
        ) : null}
      </Stack>
    </Box>
  );
};

export default RoleRoomAffiliateConnectCard;
