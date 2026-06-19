/**
 * AdminPartnerReviewModal.tsx
 *
 * Super-admin sin "deep dive" på én partner-søknad:
 *   - Full søknads-info (alle 30+ felt)
 *   - State-transition (med valid-transitions-graph)
 *   - Risk score-editor (5 sliders → risk_level auto)
 *   - Document review
 *   - History-timeline
 *   - Grant sandbox-knapp
 *   - Auto webhook test
 */

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Button, Chip, TextField, Alert, Slider, Divider, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Snackbar,
  FormControlLabel, Checkbox, Tooltip, IconButton,
} from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import GavelIcon from "@mui/icons-material/Gavel";
import SecurityIcon from "@mui/icons-material/Security";
import SendIcon from "@mui/icons-material/Send";
import HistoryIcon from "@mui/icons-material/History";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { apiFetch } from "@/lib/queryClient";

interface Props {
  applicationId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AdminPartnerReviewModal({ applicationId, onClose, onUpdated }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "risk" | "history" | "documents">("overview");
  const [sandboxKeyShown, setSandboxKeyShown] = useState<{ raw_key: string; warning: string } | null>(null);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/superadmin/partner-applications/${applicationId}/full`);
      if (r.ok) setData(await r.json());
    } catch (e) { setSnackbar({ msg: String(e), severity: "error" }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [applicationId]);

  if (loading || !data) {
    return (
      <Dialog open onClose={onClose} maxWidth="lg" fullWidth
              PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
        <DialogContent><Box sx={{ p: 6, textAlign: "center" }}>Laster…</Box></DialogContent>
      </Dialog>
    );
  }

  const app = data.application;

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">{app.org_name}</Typography>
            <Stack direction="row" spacing={1} mt={0.5} alignItems="center">
              <Chip size="small" label={app.status}
                    sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }} />
              <Chip size="small" label={app.partner_type}
                    sx={{ bgcolor: "rgba(255,184,107,0.20)", color: "#ffb86b" }} />
              {app.risk_level && (
                <Chip size="small" label={`Risk: ${app.risk_level}`}
                      sx={{ bgcolor: app.risk_level === "low" ? "#9be15d"
                            : app.risk_level === "medium" ? "#ffb86b" : "#ff6b6b",
                            color: "#0a0512", fontWeight: 700 }} />
              )}
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                Søker: {app.applicant_email}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ px: 3, borderBottom: "1px solid rgba(255,255,255,0.08)",
                  "& .MuiTab-root": { color: "rgba(255,255,255,0.7)", textTransform: "none" } }}>
        <Tab label="Oversikt" value="overview" />
        <Tab label="Risk scores" value="risk" icon={<SecurityIcon />} iconPosition="start" />
        <Tab label="History" value="history" icon={<HistoryIcon />} iconPosition="start" />
        <Tab label={`Dokumenter (${data.documents?.length ?? 0})`} value="documents" />
      </Tabs>

      <DialogContent sx={{ p: 3 }}>
        {tab === "overview" && <OverviewTab data={data} onSetState={async (toStatus, opts) => {
          const r = await apiFetch(`/api/superadmin/partner-applications/${applicationId}/transition`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toStatus, ...opts }),
          });
          if (r.ok) {
            setSnackbar({ msg: `State endret til ${toStatus}`, severity: "success" });
            load(); onUpdated();
          } else {
            const d = await r.json();
            setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
          }
        }} onGrantSandbox={async () => {
          const r = await apiFetch(`/api/superadmin/partner-applications/${applicationId}/grant-sandbox`, {
            method: "POST",
          });
          const d = await r.json();
          if (r.ok) {
            setSandboxKeyShown({ raw_key: d.raw_key, warning: d.warning });
            load();
          } else {
            setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
          }
        }} />}

        {tab === "risk" && <RiskTab data={data} applicationId={applicationId} onUpdated={() => { load(); onUpdated(); }} />}
        {tab === "history" && <HistoryTab history={data.history} />}
        {tab === "documents" && <DocumentsTab documents={data.documents} />}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>

      {sandboxKeyShown && (
        <Dialog open onClose={() => setSandboxKeyShown(null)} maxWidth="md" fullWidth
                PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
          <DialogTitle>Sandbox API-key opprettet</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>{sandboxKeyShown.warning}</Alert>
            <Box sx={{ p: 2, bgcolor: "rgba(155,225,93,0.10)", borderRadius: 2,
                        fontFamily: "monospace", wordBreak: "break-all" }}>
              {sandboxKeyShown.raw_key}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button startIcon={<ContentCopyIcon />}
                    onClick={() => navigator.clipboard.writeText(sandboxKeyShown.raw_key)}>Kopier</Button>
            <Button variant="contained" onClick={() => setSandboxKeyShown(null)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
                message={snackbar?.msg} />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn", "rejected"],
  under_review: ["needs_more_info", "business_verified", "rejected"],
  needs_more_info: ["under_review", "withdrawn"],
  business_verified: ["technical_review", "approved", "rejected"],
  technical_review: ["sandbox_approved", "needs_more_info", "rejected"],
  sandbox_approved: ["production_pending", "needs_more_info", "rejected"],
  production_pending: ["approved", "needs_more_info", "rejected"],
  approved: ["active", "restricted", "suspended"],
  active: ["restricted", "suspended", "expired"],
  restricted: ["active", "suspended", "expired"],
  suspended: ["active", "rejected", "expired"],
  pending: ["under_review", "rejected", "withdrawn"],
};

function OverviewTab({ data, onSetState, onGrantSandbox }: {
  data: any;
  onSetState: (to: string, opts: any) => Promise<void>;
  onGrantSandbox: () => Promise<void>;
}) {
  const app = data.application;
  const [transitionOpen, setTransitionOpen] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [visibleToApplicant, setVisibleToApplicant] = useState(false);
  const allowedTransitions = VALID_TRANSITIONS[app.status] ?? [];

  return (
    <Stack spacing={3}>
      {/* Quick stats */}
      <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>Bedrift</Typography>
          <Stack spacing={1} mt={1}>
            <Row label="Org-nummer" value={app.org_number} />
            <Row label="Land" value={app.country} />
            <Row label="Bransje" value={app.industry} />
            <Row label="Ansatte" value={app.employees_count} />
            <Row label="Telefon" value={app.contact_phone} />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>Bruk</Typography>
          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" rowGap={1}>
            {app.uses_api && <Chip size="small" label="API" sx={{ bgcolor: "rgba(167,139,250,0.20)", color: "#a78bfa" }} />}
            {app.uses_webhooks && <Chip size="small" label="Webhooks" sx={{ bgcolor: "rgba(167,139,250,0.20)", color: "#a78bfa" }} />}
            {app.wants_marketplace_listing && <Chip size="small" label="Marketplace" sx={{ bgcolor: "rgba(255,184,107,0.20)", color: "#ffb86b" }} />}
            {app.wants_reseller && <Chip size="small" label="Reseller" sx={{ bgcolor: "rgba(122,184,255,0.20)", color: "#7ab8ff" }} />}
          </Stack>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Use-case:</Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", mt: 0.5 }}>
              {app.use_case_description ?? "(ikke utfylt)"}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {app.uses_api && (
        <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
          <CardContent>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>Teknisk</Typography>
            <Stack spacing={1} mt={1}>
              <Row label="Tek-kontakt" value={`${app.technical_contact_name ?? ""} ${app.technical_contact_email ?? ""}`} />
              <Row label="Webhook URL" value={app.webhook_endpoint_url} />
              <Row label="Forventet volum" value={app.expected_volume ? `${app.expected_volume}/mnd` : null} />
              <Row label="Egen dev-docs" value={app.developer_docs_url} />
            </Stack>
            {app.requested_scopes && app.requested_scopes.length > 0 && (
              <Box mt={2}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Requested scopes:</Typography>
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" rowGap={0.5}>
                  {app.requested_scopes.map((s: string) => (
                    <Chip key={s} size="small" label={s}
                          sx={{ bgcolor: "rgba(155,225,93,0.10)", color: "#9be15d",
                                fontFamily: "monospace", fontSize: 11 }} />
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
        <CardContent>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>GDPR + sikkerhet</Typography>
          <Stack spacing={1} mt={1}>
            <Row label="Behandler persondata" value={app.processes_personal_data ? "Ja" : "Nei"} />
            <Row label="Datalagring" value={app.data_storage_location} />
            <Row label="Innenfor EU/EØS" value={app.data_within_eu_eea ? "Ja" : "Nei"} />
            <Row label="Encryption (transit/rest)" value={
              `${app.encrypts_in_transit ? "✓" : "✗"} transit, ${app.encrypts_at_rest ? "✓" : "✗"} rest`} />
            <Row label="Underleverandører" value={app.subprocessors_list ?? (app.uses_subprocessors ? "Ja" : "Nei")} />
            <Row label="Egen DPA" value={app.has_dpa ? "Ja" : "Nei"} />
            <Row label="Kan signere Leadgrid DPA" value={app.can_sign_leadgrid_dpa ? "Ja" : "Nei"} />
            <Row label="Data retention" value={app.data_retention_days ? `${app.data_retention_days}d` : null} />
          </Stack>
        </CardContent>
      </Card>

      {/* State transitions */}
      <Card sx={{ bgcolor: "rgba(167,139,250,0.08)", color: "#fff",
                   border: "1px solid rgba(167,139,250,0.30)" }}>
        <CardContent>
          <Typography variant="h6" mb={1}>Tilgjengelige overganger fra <code>{app.status}</code></Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
            {allowedTransitions.length === 0 ? (
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                Ingen overganger fra denne staten.
              </Typography>
            ) : (
              allowedTransitions.map((to) => (
                <Button key={to} size="small" variant="outlined"
                        onClick={() => { setTransitionOpen(to); setInternalNotes(""); setClientMessage(""); }}
                        sx={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.4)",
                              textTransform: "none" }}>
                  → {to}
                </Button>
              ))
            )}
          </Stack>

          {(app.status === "sandbox_approved" || app.status === "business_verified") && (
            <Box mt={3}>
              <Button variant="contained" startIcon={<VerifiedIcon />} onClick={onGrantSandbox}
                      sx={{ bgcolor: "#9be15d", color: "#0a0512", fontWeight: 700 }}>
                Opprett Sandbox-key (90d)
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!transitionOpen} onClose={() => setTransitionOpen(null)} maxWidth="sm" fullWidth
              PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
        <DialogTitle>Endre status til {transitionOpen}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField multiline rows={3} fullWidth label="Interne notater (kun for admin)"
                       value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                       sx={{ "& .MuiOutlinedInput-root": { color: "#fff" },
                              "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }} />
            <FormControlLabel control={<Checkbox checked={visibleToApplicant}
                              onChange={(e) => setVisibleToApplicant(e.target.checked)}
                              sx={{ color: "rgba(255,255,255,0.4)",
                                    "&.Mui-checked": { color: "#a78bfa" } }} />}
              label="Send melding til søker" />
            {visibleToApplicant && (
              <TextField multiline rows={3} fullWidth label="Melding til søker"
                         value={clientMessage} onChange={(e) => setClientMessage(e.target.value)}
                         sx={{ "& .MuiOutlinedInput-root": { color: "#fff" },
                                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransitionOpen(null)}>Avbryt</Button>
          <Button variant="contained" disabled={visibleToApplicant && !clientMessage}
                  onClick={async () => {
                    await onSetState(transitionOpen!, { internalNotes, clientMessage, visibleToApplicant });
                    setTransitionOpen(null);
                  }}
                  sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }}>
            Bekreft overgang
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Risk Tab
// ---------------------------------------------------------------------------

function RiskTab({ data, applicationId, onUpdated }: any) {
  const a = data.application;
  const [business, setBusiness] = useState(a.risk_business_fit ?? 50);
  const [technical, setTechnical] = useState(a.risk_technical_readiness ?? 50);
  const [security, setSecurity] = useState(a.risk_security_readiness ?? 50);
  const [gdpr, setGdpr] = useState(a.risk_gdpr_readiness ?? 50);
  const [customer, setCustomer] = useState(a.risk_customer_value ?? 50);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const r = await apiFetch(`/api/superadmin/partner-applications/${applicationId}/risk-scores`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business, technical, security, gdpr, customer }),
    });
    if (r.ok) { onUpdated(); }
    setSaving(false);
  };

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Risk_level beregnes automatisk: sikkerhet/GDPR &lt;40 → very_high.
        Snitt &lt;50 → high, &lt;70 → medium.
      </Alert>
      {[
        { label: "Business fit", value: business, set: setBusiness },
        { label: "Technical readiness", value: technical, set: setTechnical },
        { label: "Security readiness", value: security, set: setSecurity },
        { label: "GDPR readiness", value: gdpr, set: setGdpr },
        { label: "Customer value", value: customer, set: setCustomer },
      ].map((s) => (
        <Box key={s.label}>
          <Stack direction="row" justifyContent="space-between">
            <Typography>{s.label}</Typography>
            <Typography sx={{ color: "#a78bfa", fontWeight: 700 }}>{s.value}/100</Typography>
          </Stack>
          <Slider value={s.value} onChange={(_, v) => s.set(v as number)} min={0} max={100}
                  sx={{ color: s.value >= 70 ? "#9be15d" : s.value >= 50 ? "#ffb86b" : "#ff6b6b" }} />
        </Box>
      ))}
      <Button variant="contained" onClick={save} disabled={saving}
              sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }}>
        {saving ? "Lagrer…" : "Lagre risk scores"}
      </Button>
    </Stack>
  );
}

function HistoryTab({ history }: { history: any[] }) {
  if (!history || history.length === 0) {
    return <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>Ingen historikk ennå.</Typography>;
  }
  return (
    <Stack spacing={1.5}>
      {history.map((h: any) => (
        <Card key={h.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={h.from_status ?? "—"} sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }} />
                <Typography>→</Typography>
                <Chip size="small" label={h.to_status}
                      sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }} />
              </Stack>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                {new Date(h.transitioned_at).toLocaleString("no-NO")}
              </Typography>
            </Stack>
            {h.internal_notes && (
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", display: "block" }}>
                <strong>Notater:</strong> {h.internal_notes}
              </Typography>
            )}
            {h.client_message && (
              <Box mt={1} sx={{ p: 1, bgcolor: "rgba(155,225,93,0.05)", borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: "#9be15d" }}>
                  Sendt til søker: «{h.client_message}»
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function DocumentsTab({ documents }: { documents: any[] }) {
  if (!documents || documents.length === 0) {
    return (
      <Alert severity="info">
        Ingen dokumenter lastet opp. Søker kan sende dokumenter til support og
        de blir registrert her.
      </Alert>
    );
  }
  return (
    <Stack spacing={1}>
      {documents.map((d: any) => (
        <Card key={d.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Chip size="small" label={d.document_type}
                      sx={{ bgcolor: "#7ab8ff", color: "#0a0512", fontWeight: 600 }} />
                <Typography sx={{ mt: 1 }}>{d.filename}</Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  Lastet opp {new Date(d.uploaded_at).toLocaleString("no-NO")}
                </Typography>
              </Box>
              <Button size="small" href={d.storage_url} target="_blank" sx={{ color: "#a78bfa" }}>
                Åpne
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: "#fff" }}>{String(value ?? "—")}</Typography>
    </Stack>
  );
}
