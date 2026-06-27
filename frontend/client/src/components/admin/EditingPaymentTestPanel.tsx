/**
 * EditingPaymentTestPanel.tsx
 *
 * Admin-test for redigerings-betalingsflyten (Betalingstest-fanen):
 *  - PayPal-helse (OAuth) + valgfri test-payout til sandbox-e-post
 *  - Escrow-simulering: marker et oppdrag som betalt ('held') uten faktisk betaling,
 *    så hele løkka (levering → godkjenning → payout) kan testes gratis.
 * Super-admin-only (backend gater).
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Stack, TextField, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, Box, Divider, ThemeProvider,
} from "@mui/material";
import { adminDarkTheme } from './adminDarkTheme';
import { AdminCard, AdminButton, StatusChip, AdminTableContainer, AdminLoading, AdminEmpty } from './design-system';
import PaymentsIcon from "@mui/icons-material/Payments";
import ScienceIcon from "@mui/icons-material/Science";
import { apiRequest } from "@/lib/queryClient";

interface TestJob {
  id: string; project_title: string | null; vendor_name: string | null;
  amount_cents: number; currency: string; status: string;
  payment_method: string | null; payment_status: string | null;
  payout_method: string | null; payout_status: string | null; payout_reference: string | null;
}

function statusChip(label: string | null, kind: "pay" | "payout") {
  if (!label) return <StatusChip tone="neutral" label="—" />;
  const ok = (kind === "pay" && label === "held") || (kind === "payout" && label === "paid");
  const warn = label === "released" || label === "unclaimed" || label === "pending";
  return <StatusChip tone={ok ? "success" : warn ? "warning" : label === "failed" ? "error" : "neutral"} label={label} />;
}

export default function EditingPaymentTestPanel() {
  const qc = useQueryClient();
  const [ppEmail, setPpEmail] = useState("");
  const [ppMsg, setPpMsg] = useState<{ sev: "success" | "error" | "info"; text: string } | null>(null);

  const jobs = useQuery<{ jobs: TestJob[] }>({
    queryKey: ["/api/superadmin/editing/test/jobs"],
    queryFn: () => apiRequest("/api/superadmin/editing/test/jobs"),
  });

  const paypalPing = useMutation({
    mutationFn: (withPayout: boolean) => apiRequest("/api/superadmin/editing/test/paypal-ping", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withPayout ? { email: ppEmail, amountCents: 100 } : {}),
    }) as Promise<{ health: { ok: boolean; env: string; configured: boolean; error?: string }; payout: { ok: boolean; batchId?: string; error?: string } | null }>,
    onSuccess: (r) => {
      const h = r.health;
      let text = h.ok ? `✓ PayPal OK (${h.env})` : `✗ PayPal: ${h.error || "feil"} (${h.env})`;
      if (r.payout) text += r.payout.ok ? ` · test-payout sendt (batch ${r.payout.batchId})` : ` · payout-feil: ${r.payout.error}`;
      setPpMsg({ sev: h.ok ? "success" : "error", text });
    },
    onError: () => setPpMsg({ sev: "error", text: "Kunne ikke teste PayPal." }),
  });

  const simulatePaid = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/superadmin/editing/test/jobs/${id}/simulate-paid`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/superadmin/editing/test/jobs"] }),
  });

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      {/* PayPal-helse */}
      <AdminCard
        sx={{ mb: 2 }}
        title={<Stack direction="row" spacing={1} alignItems="center"><PaymentsIcon color="primary" aria-hidden="true" /><span>PayPal-tilkobling</span></Stack>}
        subtitle="Tester OAuth mot PayPal (creds + miljø fra Render). Valgfritt: send en ekte test-payout ($1) til en sandbox-personal-e-post."
      >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <AdminButton tone="secondary" onClick={() => paypalPing.mutate(false)} loading={paypalPing.isPending} disabled={paypalPing.isPending}>Test tilkobling</AdminButton>
            <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", sm: "block" } }} />
            <TextField size="small" label="Sandbox-personal-e-post (mottaker)" value={ppEmail} onChange={(e) => setPpEmail(e.target.value)} sx={{ flex: 1, minWidth: 240 }} />
            <AdminButton tone="primary" onClick={() => paypalPing.mutate(true)} loading={paypalPing.isPending} disabled={paypalPing.isPending || !ppEmail}>Send test-payout ($1)</AdminButton>
          </Stack>
          {ppMsg && <Alert severity={ppMsg.sev} sx={{ mt: 2 }}>{ppMsg.text}</Alert>}
      </AdminCard>

      {/* Escrow-simulering */}
      <AdminCard
        title={<Stack direction="row" spacing={1} alignItems="center"><ScienceIcon color="primary" aria-hidden="true" /><span>Escrow-test (redigeringsoppdrag)</span></Stack>}
        subtitle={<>«Simuler betalt» setter escrow til <b>held</b> uten faktisk betaling — så hele løkka (levering → godkjenning → payout) kan testes gratis.</>}
      >
          {jobs.isLoading ? <AdminLoading /> : (jobs.data?.jobs?.length ? (
            <AdminTableContainer ariaLabel="Redigeringsoppdrag escrow-test">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Oppdrag</TableCell><TableCell>Vendor</TableCell><TableCell>Beløp</TableCell>
                  <TableCell>Status</TableCell><TableCell>Betaling</TableCell><TableCell>Payout</TableCell><TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.data.jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>{j.project_title || j.id.slice(0, 8)}</TableCell>
                    <TableCell>{j.vendor_name || "—"}</TableCell>
                    <TableCell>{(j.amount_cents / 100).toLocaleString("nb-NO")} {j.currency}</TableCell>
                    <TableCell>{j.status}</TableCell>
                    <TableCell>{statusChip(j.payment_status, "pay")}</TableCell>
                    <TableCell>{statusChip(j.payout_status, "payout")}{j.payout_reference ? <Typography variant="caption" display="block" color="text.secondary">{j.payout_reference}</Typography> : null}</TableCell>
                    <TableCell>
                      {j.payment_status !== "held" && j.payment_status !== "released" && (
                        <AdminButton tone="secondary" size="small" loading={simulatePaid.isPending} disabled={simulatePaid.isPending} onClick={() => simulatePaid.mutate(j.id)}>Simuler betalt</AdminButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </AdminTableContainer>
          ) : <AdminEmpty title="Ingen redigeringsoppdrag ennå." />)}
      </AdminCard>
    </Box>
    </ThemeProvider>
  );
}
