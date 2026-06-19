/**
 * EditingVendorWorkspace.tsx
 *
 * Redigeringsvendorens arbeidsområde med egne faner: Oppdrag, Compliance,
 * Priskatalog, Kommunikasjon. FULLSTENDIG TOSPRÅKLIG — for utenlandske vendors
 * (is_foreign / land≠NO) settes locale='en' og hele arbeidsområdet vises på engelsk.
 *
 * Sikker filflyt: opplasting via presignert PUT til Creatorhub staging-B2;
 * server-side overføring til fotografens B2 skjer ved «marker som levert».
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Tabs,
  Tab,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Alert,
  Snackbar,
  LinearProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SendIcon from "@mui/icons-material/Send";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { apiRequest } from "@/lib/queryClient";
import VendorProductManager from "../../vendor/VendorProductManager";
import EditingJobChat from "./EditingJobChat";
import PartnerProgramDashboard from "./PartnerProgramDashboard";
import {
  t,
  pillarLabel,
  localeForVendor,
  type Locale,
} from "./editingMarketplaceStrings";

interface MeResponse {
  hasProfile: boolean;
  isEditingVendor: boolean;
  vendorName: string | null;
  approvalStatus: string;
  country: string;
  isForeign: boolean;
  compliance: {
    isForeign: boolean;
    isEea: boolean;
    requiresExtraGdpr: boolean;
    cleared: boolean;
    pillars: Record<string, { status: string }>;
    badges: string[];
    missing: string[];
  };
}

interface EditingJob {
  id: string;
  project_title: string | null;
  status: string;
  brief: string | null;
  amount_cents: number;
  currency: string;
}

interface Props {
  userId: string;
}

function requiredFor(isForeign: boolean, requiresExtraGdpr: boolean): string[] {
  const base = ["standard", "quality", "storage", "gdpr", "delivery", "payment", "dpa", "nda", "no_subcontractors", "no_portfolio_use"];
  if (isForeign && requiresExtraGdpr) base.push("scc", "tia");
  return base;
}

export default function EditingVendorWorkspace({ userId }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<{ msg: string; sev: "success" | "error" } | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [uploadingJob, setUploadingJob] = useState<string | null>(null);
  const [commJobId, setCommJobId] = useState<string | null>(null);

  const meQuery = useQuery<MeResponse>({
    queryKey: ["/api/editing/vendor/me"],
    queryFn: () => apiRequest("/api/editing/vendor/me"),
  });
  const me = meQuery.data;
  const locale: Locale = me ? localeForVendor({ isForeign: me.isForeign, country: me.country }) : "no";

  const jobsQuery = useQuery<{ jobs: EditingJob[] }>({
    queryKey: ["/api/editing/vendor/jobs"],
    queryFn: () => apiRequest("/api/editing/vendor/jobs"),
  });
  const jobs = jobsQuery.data?.jobs ?? [];

  const acceptMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/editing/jobs/${jobId}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      setSnack({ msg: t("ws_accept", locale), sev: "success" });
    },
    onError: () => setSnack({ msg: "Error", sev: "error" }),
  });

  const declineMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/editing/jobs/${jobId}/decline`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] }),
  });

  const deliverMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/editing/jobs/${jobId}/deliver`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      setSnack({ msg: t("ws_mark_delivered", locale), sev: "success" });
    },
    onError: () => setSnack({ msg: "Error", sev: "error" }),
  });

  const complianceMutation = useMutation({
    mutationFn: (payload: { country: string; isForeign: boolean; acceptedRequirements: string[] }) =>
      apiRequest("/api/editing/vendor/compliance/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/me"] });
      setSnack({ msg: t("comp_cleared", locale), sev: "success" });
    },
    onError: () => setSnack({ msg: t("comp_must_accept", locale), sev: "error" }),
  });

  async function uploadFiles(jobId: string, files: FileList) {
    setUploadingJob(jobId);
    try {
      for (const file of Array.from(files)) {
        const resp = (await apiRequest(`/api/editing/jobs/${jobId}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }),
        })) as { uploadUrl: string; key: string };
        await fetch(resp.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
      }
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      setSnack({ msg: t("ws_upload_files", locale), sev: "success" });
    } catch {
      setSnack({ msg: "Error", sev: "error" });
    } finally {
      setUploadingJob(null);
    }
  }

  if (meQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Self-gating: vis kun for redigeringsvendors (vendor_type='editing')
  if (me && !me.isEditingVendor) return null;

  const compliance = me?.compliance;
  const required = requiredFor(compliance?.isForeign ?? false, compliance?.requiresExtraGdpr ?? false);
  const allChecked = required.every((r) => checked[r]);

  const statusChip = (status: string) => (
    <Chip
      size="small"
      label={t(`jobstatus.${status}`, locale)}
      color={status === "approved" || status === "delivered_to_client" ? "success" : status === "delivered" ? "info" : "default"}
    />
  );

  return (
    <Box>
      {/* Partnerprogram-/verifiserings-dashboard — alltid øverst */}
      <PartnerProgramDashboard me={me} locale={locale} onStartVerification={() => setTab(1)} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t("ws_title", locale)}
      </Typography>

      {compliance && !compliance.cleared && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("comp_intro", locale)}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
        <Tab label={t("ws_tab_jobs", locale)} />
        <Tab label={t("ws_tab_compliance", locale)} />
        <Tab label={t("ws_tab_catalog", locale)} />
        <Tab label={t("ws_tab_communication", locale)} />
      </Tabs>

      {/* ── Oppdrag ── */}
      {tab === 0 && (
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            <VerifiedUserIcon sx={{ fontSize: 14, verticalAlign: "middle", mr: 0.5 }} />
            {t("ws_upload_hint", locale)}
          </Typography>
          {jobsQuery.isLoading ? (
            <CircularProgress size={24} />
          ) : jobs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("ws_no_jobs", locale)}
            </Typography>
          ) : (
            jobs.map((j) => (
              <Card key={j.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{j.project_title || "—"}</Typography>
                    {statusChip(j.status)}
                  </Box>
                  {j.brief && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t("ws_brief", locale)}: {j.brief}
                    </Typography>
                  )}
                  {j.amount_cents > 0 && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {t("ws_amount", locale)}: {(j.amount_cents / 100).toFixed(0)} {j.currency}
                    </Typography>
                  )}
                  {uploadingJob === j.id && <LinearProgress sx={{ mt: 1 }} />}
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
                    {j.status === "requested" && (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!compliance?.cleared || acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(j.id)}
                        >
                          {t("ws_accept", locale)}
                        </Button>
                        <Button size="small" color="inherit" onClick={() => declineMutation.mutate(j.id)}>
                          {t("ws_decline", locale)}
                        </Button>
                      </>
                    )}
                    {j.status === "in_progress" && (
                      <>
                        <Button size="small" variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={uploadingJob === j.id}>
                          {uploadingJob === j.id ? t("ws_uploading", locale) : t("ws_upload_files", locale)}
                          <input
                            type="file"
                            hidden
                            multiple
                            onChange={(e) => e.target.files && uploadFiles(j.id, e.target.files)}
                          />
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<SendIcon />}
                          disabled={deliverMutation.isPending}
                          onClick={() => deliverMutation.mutate(j.id)}
                        >
                          {deliverMutation.isPending ? t("ws_transferring", locale) : t("ws_mark_delivered", locale)}
                        </Button>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* ── Compliance ── */}
      {tab === 1 && compliance && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            {t("comp_title", locale)}
          </Typography>
          {/* Pilar-status */}
          <Stack spacing={1} sx={{ mb: 2 }}>
            {Object.entries(compliance.pillars).map(([key, p]) => (
              <Box key={key} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">{pillarLabel(key, locale)}</Typography>
                <Chip
                  size="small"
                  color={p.status === "approved" || p.status === "automatic" || p.status === "not_allowed" ? "success" : "default"}
                  label={
                    p.status === "approved"
                      ? t("status_approved", locale)
                      : p.status === "automatic"
                        ? t("status_deletion_auto", locale)
                        : p.status === "not_allowed"
                          ? t("status_subcontractors_no", locale)
                          : t("status_pending", locale)
                  }
                />
              </Box>
            ))}
          </Stack>

          {compliance.cleared ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              {t("comp_cleared", locale)}
            </Alert>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {t("comp_intro", locale)}
                </Typography>
                {compliance.requiresExtraGdpr && (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    {t("comp_non_eea_notice", locale)}
                  </Alert>
                )}
                <Divider sx={{ my: 1 }} />
                <Stack>
                  {required.map((r) => (
                    <FormControlLabel
                      key={r}
                      control={
                        <Checkbox
                          checked={!!checked[r]}
                          onChange={(e) => setChecked((c) => ({ ...c, [r]: e.target.checked }))}
                        />
                      }
                      label={<Typography variant="body2">{t(`req.${r}`, locale)}</Typography>}
                    />
                  ))}
                </Stack>
                <Button
                  variant="contained"
                  sx={{ mt: 1 }}
                  disabled={!allChecked || complianceMutation.isPending}
                  onClick={() =>
                    complianceMutation.mutate({
                      country: me?.country || "NO",
                      isForeign: !!me?.isForeign,
                      acceptedRequirements: required,
                    })
                  }
                >
                  {t("comp_accept_all", locale)}
                </Button>
                {!allChecked && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {t("comp_must_accept", locale)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* ── Priskatalog ── */}
      {tab === 2 && (
        <Box>
          <VendorProductManager userId={userId} vendorType="editing" />
        </Box>
      )}

      {/* ── Kommunikasjon ── */}
      {tab === 3 && (() => {
        const commJobs = jobs.filter((j) =>
          ["in_progress", "delivered", "approved", "delivered_to_client"].includes(j.status),
        );
        if (commJobs.length === 0) {
          return <Alert severity="info">{t("comm_placeholder", locale)}</Alert>;
        }
        const active = commJobId || commJobs[0].id;
        return (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
              {commJobs.map((j) => (
                <Chip
                  key={j.id}
                  label={j.project_title || j.id.slice(0, 6)}
                  color={active === j.id ? "primary" : "default"}
                  onClick={() => setCommJobId(j.id)}
                />
              ))}
            </Stack>
            <Card variant="outlined">
              <CardContent>
                <EditingJobChat jobId={active} selfRole="vendor" locale={locale} />
              </CardContent>
            </Card>
          </Box>
        );
      })()}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}>
        {snack ? (
          <Alert severity={snack.sev} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
