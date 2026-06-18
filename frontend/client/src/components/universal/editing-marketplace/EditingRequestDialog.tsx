/**
 * EditingRequestDialog.tsx
 *
 * Fotografens forespørsel-/bestillingsdialog: velg tjenester fra vendorens
 * priskatalog, brief, maks revisjoner, betalingsmåte (Stripe/faktura) og
 * kalkyle-modell (fast honorar / prosentandel). Oppretter editing_job og
 * starter betaling (escrow — frigis ved godkjenning).
 */

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Stack,
  Typography,
  Divider,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
} from "@mui/material";
import { apiRequest } from "@/lib/queryClient";
import { t, type Locale } from "./editingMarketplaceStrings";

interface Service {
  id?: number;
  category: string;
  name: string | null;
  price: number | null;
  currency: string;
}
interface VendorProfile {
  vendorUserId: string;
  vendorName: string;
  services: Service[];
}

interface Props {
  vendorUserId: string | null;
  open: boolean;
  onClose: () => void;
  onCreated?: (jobId: string) => void;
  locale?: Locale;
}

export default function EditingRequestDialog({ vendorUserId, open, onClose, onCreated, locale = "no" }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [brief, setBrief] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [maxRevisions, setMaxRevisions] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "invoice">("stripe");
  const [costModel, setCostModel] = useState<"fixed_fee" | "revenue_share">("fixed_fee");
  const [sharePct, setSharePct] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery<VendorProfile>({
    queryKey: ["/api/editing/vendors", vendorUserId, "request"],
    queryFn: () => apiRequest(`/api/editing/vendors/${vendorUserId}`),
    enabled: open && !!vendorUserId,
  });
  const services = profileQuery.data?.services ?? [];

  const keyOf = (s: Service, i: number) => `${s.category}-${i}`;
  const total = useMemo(
    () =>
      services.reduce((sum, s, i) => (selected[keyOf(s, i)] && s.price ? sum + Number(s.price) : sum), 0),
    [services, selected],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const chosen = services
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => selected[keyOf(s, i)])
        .map(({ s }) => ({ category: s.category, name: s.name, price: s.price }));
      const job = (await apiRequest("/api/editing/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendorUserId,
          requestedServices: chosen,
          brief,
          projectTitle: projectTitle || null,
          amountCents: Math.round(total * 100),
          maxRevisions,
          costModel,
          revenueSharePct: costModel === "revenue_share" ? sharePct : undefined,
        }),
      })) as { jobId: string };
      // Start betaling (escrow). Stripe -> checkout-redirect; faktura -> held.
      const pay = (await apiRequest(`/api/editing/jobs/${job.jobId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      })) as { checkoutUrl?: string };
      return { jobId: job.jobId, checkoutUrl: pay.checkoutUrl };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["/api/editing/jobs"] });
      onCreated?.(r.jobId);
      onClose();
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
    },
    onError: () => setError("Error"),
  });

  function submit() {
    setError(null);
    const anySelected = services.some((s, i) => selected[keyOf(s, i)]);
    if (!anySelected) {
      setError(t("rq_select_at_least_one", locale));
      return;
    }
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("rq_title", locale)}
        {profileQuery.data ? ` – ${profileQuery.data.vendorName}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        {profileQuery.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t("rq_services", locale)}
              </Typography>
              <Stack>
                {services.map((s, i) => (
                  <FormControlLabel
                    key={keyOf(s, i)}
                    control={
                      <Checkbox
                        checked={!!selected[keyOf(s, i)]}
                        onChange={(e) => setSelected((c) => ({ ...c, [keyOf(s, i)]: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", justifyContent: "space-between", width: 360, maxWidth: "100%" }}>
                        <span>{s.name || s.category}</span>
                        <span>{s.price != null ? `${s.price} ${s.currency}` : "—"}</span>
                      </Box>
                    }
                  />
                ))}
                {services.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </Stack>
            </Box>

            <TextField
              label={t("rq_project", locale)}
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label={t("rq_brief", locale)}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label={t("rq_max_revisions", locale)}
              type="number"
              value={maxRevisions}
              onChange={(e) => setMaxRevisions(Math.max(0, Number(e.target.value)))}
              size="small"
              sx={{ width: 160 }}
            />

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t("rq_payment_method", locale)}
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={paymentMethod}
                onChange={(_, v) => v && setPaymentMethod(v)}
              >
                <ToggleButton value="stripe">{t("rq_pay_stripe", locale)}</ToggleButton>
                <ToggleButton value="invoice">{t("rq_pay_invoice", locale)}</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t("rq_cost_model", locale)}
              </Typography>
              <ToggleButtonGroup exclusive size="small" value={costModel} onChange={(_, v) => v && setCostModel(v)}>
                <ToggleButton value="fixed_fee">{t("rq_fixed_fee", locale)}</ToggleButton>
                <ToggleButton value="revenue_share">{t("rq_revenue_share", locale)}</ToggleButton>
              </ToggleButtonGroup>
              {costModel === "revenue_share" && (
                <TextField
                  label={t("rq_share_pct", locale)}
                  type="number"
                  value={sharePct}
                  onChange={(e) => setSharePct(Math.min(100, Math.max(0, Number(e.target.value))))}
                  size="small"
                  sx={{ width: 120, mt: 1, display: "block" }}
                />
              )}
            </Box>

            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t("rq_total", locale)}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {total.toFixed(0)} NOK
              </Typography>
            </Box>
            <Alert severity="info">{t("rq_escrow_note", locale)}</Alert>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{locale === "no" ? "Avbryt" : "Cancel"}</Button>
        <Button variant="contained" onClick={submit} disabled={createMutation.isPending}>
          {createMutation.isPending ? t("rq_sending", locale) : t("rq_send", locale)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
