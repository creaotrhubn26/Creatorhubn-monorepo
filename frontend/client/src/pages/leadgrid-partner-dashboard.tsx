/**
 * leadgrid-partner-dashboard.tsx — Partner-dashboard
 *
 * Vises etter at en partner har submittet søknad.
 *   - Application-status m/ progress-checklist
 *   - State-historikk
 *   - Sandbox-creds (hvis godkjent)
 *   - Re-verification date
 */

import React, { useEffect, useState } from "react";
import {
  Box, Container, Stack, Typography, Card, CardContent, Chip, Alert,
  CircularProgress, Button, LinearProgress, Divider,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import HistoryIcon from "@mui/icons-material/History";

const PALETTE = {
  bg: "#0a0512", accent: "#a78bfa", text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.72)", textFaint: "rgba(244,240,255,0.45)",
};

const STATUS_FLOW = [
  { key: "draft",               label: "Utkast" },
  { key: "submitted",           label: "Submittet" },
  { key: "under_review",        label: "Under vurdering" },
  { key: "business_verified",   label: "Forretning verifisert" },
  { key: "technical_review",    label: "Teknisk vurdering" },
  { key: "sandbox_approved",    label: "Sandbox tilgjengelig" },
  { key: "production_pending",  label: "Production-godkjenning" },
  { key: "approved",            label: "Godkjent" },
  { key: "active",              label: "Aktiv" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "rgba(255,255,255,0.5)",
  submitted: "#7ab8ff",
  under_review: "#7ab8ff",
  needs_more_info: "#ffb86b",
  business_verified: "#a78bfa",
  technical_review: "#a78bfa",
  sandbox_approved: "#9be15d",
  production_pending: "#a78bfa",
  approved: "#9be15d",
  active: "#9be15d",
  restricted: "#ffb86b",
  suspended: "#ff6b6b",
  rejected: "#ff6b6b",
  expired: "rgba(255,255,255,0.4)",
  withdrawn: "rgba(255,255,255,0.4)",
  pending: "#7ab8ff",
};

export default function LeadgridPartnerDashboardPage() {
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Leadgrid Partner Dashboard";
    fetch("/api/leadgrid/partner-application/my", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { application: null })
      .then((d) => { setApplication(d.application); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ bgcolor: PALETTE.bg, minHeight: "100vh", display: "flex",
                  alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: PALETTE.accent }} />
      </Box>
    );
  }

  if (!application) {
    return (
      <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", py: 8 }}>
        <Container maxWidth="md">
          <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", textAlign: "center" }}>
            <CardContent sx={{ p: 5 }}>
              <Typography variant="h5" mb={2}>Ingen aktiv partner-søknad</Typography>
              <Button variant="contained" href="/leadgrid/innstillinger/partnerskap"
                      sx={{ bgcolor: PALETTE.accent, color: "#0a0512", fontWeight: 700 }}>
                Start ny søknad
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  const currentStatusIndex = STATUS_FLOW.findIndex((s) => s.key === application.status);
  const progressPct = currentStatusIndex >= 0
    ? ((currentStatusIndex + 1) / STATUS_FLOW.length) * 100
    : 0;

  const stepsCompleted = (application.steps_completed ?? []) as number[];
  const totalSteps = 7;

  const requiredDocs = [
    { type: "privacy_policy", label: "Personvernerklæring", required: application.processes_personal_data },
    { type: "dpa", label: "Databehandleravtale (DPA)", required: application.processes_personal_data && !application.can_sign_leadgrid_dpa },
    { type: "security_doc", label: "Sikkerhetsdokumentasjon", required: application.uses_api },
    { type: "portfolio", label: "Portefølje / case-studier", required: false },
    { type: "reference", label: "Referanser", required: false },
  ];

  return (
    <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", py: 6,
                fontFamily: '-apple-system, sans-serif' }}>
      <Container maxWidth="lg">
        <Stack mb={4}>
          <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>
            Partner Dashboard
          </Typography>
          <Typography variant="h3" fontWeight={800}>Søknad-status</Typography>
          <Stack direction="row" alignItems="center" spacing={2} mt={1}>
            <Chip label={application.status}
                  sx={{ bgcolor: STATUS_COLORS[application.status] ?? "#888",
                        color: "#0a0512", fontWeight: 700 }} />
            <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>
              Sist oppdatert {new Date(application.updated_at).toLocaleString("no-NO")}
            </Typography>
          </Stack>
        </Stack>

        {/* Progress bar */}
        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff", mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="overline" sx={{ color: PALETTE.textFaint }}>Verifiserings-progresjon</Typography>
              <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>
                {currentStatusIndex + 1} / {STATUS_FLOW.length}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progressPct}
                            sx={{ height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.06)",
                                  "& .MuiLinearProgress-bar": { bgcolor: "#9be15d" } }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
              {STATUS_FLOW.map((s, i) => (
                <Chip key={s.key} size="small" label={s.label}
                      sx={{
                        bgcolor: i <= currentStatusIndex ? "#9be15d" : "rgba(255,255,255,0.06)",
                        color: i <= currentStatusIndex ? "#0a0512" : "rgba(255,255,255,0.5)",
                        fontWeight: i === currentStatusIndex ? 700 : 400,
                      }} />
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Card sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" mb={2}>Søknad checklist</Typography>
              <Stack spacing={1}>
                {[1, 2, 3, 4, 5, 6, 7].map((step) => {
                  const stepLabels = ["Bedrift", "Partnerrolle", "Bruk", "Teknisk",
                                       "GDPR", "Dokumenter", "Bekreftelse"];
                  const done = stepsCompleted.includes(step);
                  return (
                    <Stack key={step} direction="row" alignItems="center" spacing={1.5}>
                      {done
                        ? <CheckCircleIcon sx={{ color: "#9be15d", fontSize: 20 }} />
                        : <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 20 }} />}
                      <Typography sx={{ color: done ? "#fff" : "rgba(255,255,255,0.5)" }}>
                        Step {step}: {stepLabels[step - 1]}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
              {application.status === "draft" && (
                <Button variant="outlined" sx={{ mt: 3, color: PALETTE.accent,
                                                  borderColor: "rgba(167,139,250,0.4)" }}
                        href="/leadgrid/innstillinger/partnerskap">
                  Fortsett søknad
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Risk scores (vises etter business_verified) */}
          {application.risk_level && (
            <Card sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" mb={2}>Risk-vurdering</Typography>
                <Chip label={`Risk: ${application.risk_level}`} size="small"
                      sx={{
                        bgcolor: application.risk_level === "low" ? "#9be15d"
                          : application.risk_level === "medium" ? "#ffb86b"
                          : "#ff6b6b",
                        color: "#0a0512", fontWeight: 700, mb: 2,
                      }} />
                <Stack spacing={1.5}>
                  {[
                    { label: "Business fit", value: application.risk_business_fit },
                    { label: "Technical readiness", value: application.risk_technical_readiness },
                    { label: "Security readiness", value: application.risk_security_readiness },
                    { label: "GDPR readiness", value: application.risk_gdpr_readiness },
                    { label: "Customer value", value: application.risk_customer_value },
                  ].map((s) => (
                    <Box key={s.label}>
                      <Stack direction="row" justifyContent="space-between" mb={0.3}>
                        <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>{s.label}</Typography>
                        <Typography variant="caption" sx={{ color: "#fff", fontWeight: 600 }}>{s.value ?? "—"}/100</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={s.value ?? 0}
                                      sx={{ height: 4, borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)",
                                            "& .MuiLinearProgress-bar": {
                                              bgcolor: (s.value ?? 0) >= 70 ? "#9be15d"
                                                : (s.value ?? 0) >= 50 ? "#ffb86b" : "#ff6b6b",
                                            } }} />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>

        {/* Documents */}
        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff", mt: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" mb={2}>Dokumenter</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Dokument-upload kommer snart. Send på e-post med søknads-ID til
              daniel@creatorhubn.com.
            </Alert>
            <Stack spacing={1}>
              {requiredDocs.map((d) => (
                <Stack key={d.type} direction="row" alignItems="center" justifyContent="space-between"
                       sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
                    <Typography variant="body2">{d.label}</Typography>
                  </Stack>
                  {d.required && <Chip size="small" label="Påkrevd"
                                       sx={{ bgcolor: "rgba(255,107,107,0.10)", color: "#ff6b6b", height: 18, fontSize: 10 }} />}
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Søknads-ID */}
        <Card sx={{ bgcolor: "rgba(167,139,250,0.05)", color: "#fff", mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>Søknads-ID (referér i e-post)</Typography>
            <Typography sx={{ fontFamily: "monospace", color: "#fff", mt: 0.5 }}>{application.id}</Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
