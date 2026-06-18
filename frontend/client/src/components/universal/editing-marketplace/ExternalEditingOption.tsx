/**
 * ExternalEditingOption.tsx
 *
 * Selvstendig valg for prosjektopprettelse: «La et eksternt firma redigere».
 * Toggle + valg av godkjent redigeringsbedrift (eller «velg senere») + knapp som
 * oppretter et editing_job knyttet til prosjektet. Helt self-contained — slippes
 * inn med kun projectId + projectTitle.
 */

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Stack,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import { apiRequest } from "@/lib/queryClient";
import { t, type Locale } from "./editingMarketplaceStrings";

interface EditingVendor {
  vendorUserId: string;
  vendorName: string;
  turnaroundDays: number | null;
}

interface Props {
  projectId: string;
  projectTitle?: string;
  locale?: Locale;
}

export default function ExternalEditingOption({ projectId, projectTitle, locale = "no" }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [vendorId, setVendorId] = useState<string>("");
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const vendorsQuery = useQuery<{ vendors: EditingVendor[] }>({
    queryKey: ["/api/editing/vendors"],
    queryFn: () => apiRequest("/api/editing/vendors"),
    enabled,
  });
  const vendors = vendorsQuery.data?.vendors ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/editing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectTitle: projectTitle || null,
          vendorId: vendorId || null,
        }),
      }) as Promise<{ jobId: string }>,
    onSuccess: (r) => setCreatedJobId(r.jobId),
  });

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GroupsIcon sx={{ color: "#ff8c00" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t("ext_title", locale)}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("ext_desc", locale)}
        </Typography>

        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
          label={t("ext_enable", locale)}
        />

        {enabled && !createdJobId && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t("ext_pick_vendor", locale)}
            </Typography>
            <Select size="small" value={vendorId} displayEmpty onChange={(e) => setVendorId(String(e.target.value))}>
              <MenuItem value="">
                <em>{t("ext_pick_later", locale)}</em>
              </MenuItem>
              {vendors.map((v) => (
                <MenuItem key={v.vendorUserId} value={v.vendorUserId}>
                  {v.vendorName}
                  {v.turnaroundDays ? ` · ${v.turnaroundDays} ${t("turnaround_days", locale)}` : ""}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant="contained"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              sx={{ alignSelf: "flex-start", bgcolor: "#ff8c00", "&:hover": { bgcolor: "#e67e00" } }}
            >
              {t("create_request", locale)}
            </Button>
          </Stack>
        )}

        {createdJobId && (
          <Alert severity="success" sx={{ mt: 1 }}>
            {t("create_request", locale)} ✓
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
