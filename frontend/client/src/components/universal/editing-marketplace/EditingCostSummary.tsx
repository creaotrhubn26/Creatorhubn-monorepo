/**
 * EditingCostSummary.tsx
 *
 * Viser eksterne redigeringskostnader (cost_model='fixed_fee') for et prosjekt
 * som kostnadslinjer «av-toppen» i split-sheet/økonomi — trekkes fra inntekten
 * før prosent-fordeling. Revenue-share-vendors vises i stedet som bidragsyter i
 * selve split-sheeten (egen rad), så de er ikke med her.
 *
 * Self-contained: rendres kun hvis prosjektet har fixed_fee-oppdrag.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, Typography, Box, Divider, Stack } from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { apiRequest } from "@/lib/queryClient";
import { t, type Locale } from "./editingMarketplaceStrings";

interface EditingJob {
  id: string;
  vendor_name: string | null;
  amount_cents: number;
  currency: string;
  cost_model: string | null;
  project_id: string | null;
  status: string;
}

interface Props {
  projectId: string;
  locale?: Locale;
}

export default function EditingCostSummary({ projectId, locale = "no" }: Props) {
  const jobsQuery = useQuery<{ jobs: EditingJob[] }>({
    queryKey: ["/api/editing/jobs"],
    queryFn: () => apiRequest("/api/editing/jobs"),
  });

  const costs = (jobsQuery.data?.jobs ?? []).filter(
    (j) =>
      j.project_id === projectId &&
      (j.cost_model ?? "fixed_fee") === "fixed_fee" &&
      !["cancelled", "declined", "draft"].includes(j.status) &&
      (j.amount_cents || 0) > 0,
  );
  if (costs.length === 0) return null;

  const total = costs.reduce((sum, j) => sum + (j.amount_cents || 0), 0);
  const currency = costs[0]?.currency || "NOK";

  return (
    <Card variant="outlined" sx={{ mb: 2, borderColor: "#ff8c0055" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <ReceiptLongIcon sx={{ color: "#ff8c00" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("cost_title", locale)}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t("cost_note", locale)}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {costs.map((j) => (
            <Box key={j.id} sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2">{j.vendor_name || "—"}</Typography>
              <Typography variant="body2" color="text.secondary">
                −{(j.amount_cents / 100).toFixed(0)} {j.currency}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {t("cost_total", locale)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            −{(total / 100).toFixed(0)} {currency}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
