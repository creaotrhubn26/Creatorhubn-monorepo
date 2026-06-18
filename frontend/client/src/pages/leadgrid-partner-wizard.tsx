/**
 * leadgrid-partner-wizard.tsx
 *
 * 7-stegs multi-step partner-søknads-wizard på /leadgrid/innstillinger/partnerskap.
 *
 * Auto-saver draft etter hver step. Submitter ferdig form til /submit.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Container, Card, CardContent, Stack, Typography, Button, Stepper,
  Step, StepLabel, TextField, FormControl, InputLabel, Select, MenuItem,
  Checkbox, FormControlLabel, Radio, RadioGroup, FormLabel, Chip, Alert,
  CircularProgress, LinearProgress, Snackbar, Divider,
} from "@mui/material";
import HandshakeIcon from "@mui/icons-material/Handshake";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";

const STEPS = [
  "Bedrift",
  "Partnerrolle",
  "Bruk av Leadgrid",
  "Teknisk tilgang",
  "GDPR & sikkerhet",
  "Dokumenter",
  "Bekreftelse",
];

const PARTNER_TYPES = [
  { value: "listed",                label: "Listed Partner", desc: "Vises i partnerkatalog, ingen API" },
  { value: "certified",             label: "Certified Partner", desc: "Leverer tjenester til kunder" },
  { value: "integration",           label: "Integration Partner", desc: "Bygger integrasjon via API/webhooks" },
  { value: "verified_integration",  label: "Verified Integration Partner", desc: "Production API m/ sikkerhets-godkjenning" },
  { value: "strategic",             label: "Strategic Partner", desc: "Co-selling, marketplace, dyp integrasjon" },
  { value: "agency",                label: "Agency Partner", desc: "Bruker Leadgrid for kunder" },
  { value: "data",                  label: "Data Partner", desc: "Leverer eller beriker lead-data" },
  { value: "implementation",        label: "Implementation Partner", desc: "Hjelper kunder med oppsett" },
];

const AVAILABLE_SCOPES = [
  "customers.read", "customers.write", "needs.read", "signals.read",
  "deliverables.read", "organizations.read", "webhooks.read",
  "leads:read", "leads:write", "leads:update_status",
  "activities:read", "activities:write",
  "notes:read", "notes:write",
  "webhooks:manage", "reports:read", "users:read",
];

interface FormData {
  // Step 1 — bedrift
  org_number?: string;
  country?: string;
  industry?: string;
  employees_count?: string;
  contact_phone?: string;
  // Step 2 — partnerrolle
  partner_type?: string;
  requested_tier?: string;
  service_description?: string;
  customer_segments?: string;
  why_leadgrid?: string;
  // Step 3 — bruk
  use_case_description?: string;
  uses_api?: boolean;
  uses_webhooks?: boolean;
  wants_marketplace_listing?: boolean;
  wants_reseller?: boolean;
  // Step 4 — teknisk
  requested_scopes?: string[];
  data_flow_description?: string;
  webhook_endpoint_url?: string;
  expected_volume?: number;
  has_developer_docs?: boolean;
  developer_docs_url?: string;
  technical_contact_email?: string;
  technical_contact_name?: string;
  // Step 5 — GDPR
  processes_personal_data?: boolean;
  personal_data_types?: string;
  data_storage_location?: string;
  data_within_eu_eea?: boolean;
  uses_subprocessors?: boolean;
  subprocessors_list?: string;
  has_dpa?: boolean;
  can_sign_leadgrid_dpa?: boolean;
  data_deletion_routine?: string;
  access_request_routine?: string;
  incident_response_contact?: string;
  data_retention_days?: number;
  encrypts_in_transit?: boolean;
  encrypts_at_rest?: boolean;
  has_internal_access_control?: boolean;
}

const PALETTE = {
  bg: "#0a0512", accent: "#a78bfa", text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.72)", textFaint: "rgba(244,240,255,0.45)",
};

const inputSx = {
  "& .MuiOutlinedInput-root": { color: "#fff",
    "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  "& .MuiSelect-icon": { color: "rgba(255,255,255,0.6)" },
};

export default function LeadgridPartnerWizardPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ country: "Norge" });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  // Last eksisterende draft
  useEffect(() => {
    document.title = "Leadgrid Partner-søknad";
    fetch("/api/leadgrid/partner-application/my", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { application: null })
      .then((d) => {
        if (d.application) {
          setApplicationId(d.application.id);
          setActiveStep(Math.max(0, (d.application.current_step ?? 1) - 1));
          // Map alle felter
          const a = d.application;
          setFormData({
            org_number: a.org_number, country: a.country ?? "Norge",
            industry: a.industry, employees_count: a.employees_count,
            contact_phone: a.contact_phone,
            partner_type: a.partner_type, requested_tier: a.requested_tier,
            service_description: a.service_description,
            customer_segments: a.customer_segments, why_leadgrid: a.why_leadgrid,
            use_case_description: a.use_case_description,
            uses_api: a.uses_api, uses_webhooks: a.uses_webhooks,
            wants_marketplace_listing: a.wants_marketplace_listing,
            wants_reseller: a.wants_reseller,
            requested_scopes: a.requested_scopes ?? [],
            data_flow_description: a.data_flow_description,
            webhook_endpoint_url: a.webhook_endpoint_url,
            expected_volume: a.expected_volume,
            has_developer_docs: a.has_developer_docs,
            developer_docs_url: a.developer_docs_url,
            technical_contact_email: a.technical_contact_email,
            technical_contact_name: a.technical_contact_name,
            processes_personal_data: a.processes_personal_data,
            personal_data_types: a.personal_data_types,
            data_storage_location: a.data_storage_location,
            data_within_eu_eea: a.data_within_eu_eea,
            uses_subprocessors: a.uses_subprocessors,
            subprocessors_list: a.subprocessors_list,
            has_dpa: a.has_dpa, can_sign_leadgrid_dpa: a.can_sign_leadgrid_dpa,
            data_deletion_routine: a.data_deletion_routine,
            access_request_routine: a.access_request_routine,
            incident_response_contact: a.incident_response_contact,
            data_retention_days: a.data_retention_days,
            encrypts_in_transit: a.encrypts_in_transit,
            encrypts_at_rest: a.encrypts_at_rest,
            has_internal_access_control: a.has_internal_access_control,
          });
          if (a.status !== "draft" && a.status !== "pending") setSubmitted(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = (patch: Partial<FormData>) => setFormData((p) => ({ ...p, ...patch }));

  const saveStep = useCallback(async (stepNum: number) => {
    setSaving(true);
    try {
      const r = await fetch("/api/leadgrid/partner-application/save-step", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId, stepNumber: stepNum, data: formData,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        if (d.application_id) setApplicationId(d.application_id);
        setSnackbar({ msg: "Lagret", severity: "success" });
      } else {
        setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
      }
    } catch (e: any) { setSnackbar({ msg: String(e), severity: "error" }); }
    setSaving(false);
  }, [applicationId, formData]);

  const next = async () => {
    await saveStep(activeStep + 1);
    setActiveStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const back = () => setActiveStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!agreedToTerms) {
      setSnackbar({ msg: "Du må godta vilkårene", severity: "error" });
      return;
    }
    if (!applicationId) { setSnackbar({ msg: "Mangler søknad-ID", severity: "error" }); return; }
    setSubmitting(true);
    await saveStep(7);
    try {
      const r = await fetch("/api/leadgrid/partner-application/submit", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const d = await r.json();
      if (r.ok) {
        setSubmitted(true);
      } else {
        setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
      }
    } catch (e: any) { setSnackbar({ msg: String(e), severity: "error" }); }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Box sx={{ bgcolor: PALETTE.bg, minHeight: "100vh", display: "flex",
                  alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: PALETTE.accent }} />
      </Box>
    );
  }

  if (submitted) {
    return (
      <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh",
                  display: "flex", alignItems: "center", py: 8 }}>
        <Container maxWidth="sm">
          <Card sx={{ bgcolor: "rgba(155,225,93,0.10)", border: "1px solid rgba(155,225,93,0.30)" }}>
            <CardContent sx={{ p: 5, textAlign: "center" }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: "#9be15d", mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Søknad submitted
              </Typography>
              <Typography sx={{ color: PALETTE.textMuted, mb: 3 }}>
                Vi går gjennom dokumentene dine og kommer tilbake innen 3 virkedager.
                Du får e-post når status endres.
              </Typography>
              <Button variant="contained" href="/leadgrid/partner-dashboard"
                      sx={{ bgcolor: PALETTE.accent, color: "#0a0512", fontWeight: 700 }}>
                Åpne partner-dashboard
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", py: 6,
                fontFamily: '-apple-system, "SF Pro Display", "Inter", sans-serif' }}>
      <Container maxWidth="md">
        <Stack alignItems="center" spacing={2} mb={4}>
          <HandshakeIcon sx={{ fontSize: 40, color: PALETTE.accent }} />
          <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>
            Leadgrid Partnerskap
          </Typography>
          <Typography variant="h3" fontWeight={800} textAlign="center">
            Søknad
          </Typography>
        </Stack>

        <Stepper activeStep={activeStep} alternativeLabel
                 sx={{ mb: 4, "& .MuiStepLabel-label": { color: "rgba(255,255,255,0.5)" },
                       "& .MuiStepLabel-label.Mui-active": { color: PALETTE.accent },
                       "& .MuiStepIcon-root": { color: "rgba(255,255,255,0.15)" },
                       "& .MuiStepIcon-root.Mui-active": { color: PALETTE.accent },
                       "& .MuiStepIcon-root.Mui-completed": { color: "#9be15d" } }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        <LinearProgress variant="determinate" value={(activeStep + 1) / STEPS.length * 100}
                        sx={{ mb: 3, height: 4, borderRadius: 2,
                              bgcolor: "rgba(255,255,255,0.06)",
                              "& .MuiLinearProgress-bar": { bgcolor: PALETTE.accent } }} />

        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff",
                     border: "1px solid rgba(255,255,255,0.06)" }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            {activeStep === 0 && <Step1Bedrift formData={formData} update={update} />}
            {activeStep === 1 && <Step2PartnerType formData={formData} update={update} />}
            {activeStep === 2 && <Step3Usage formData={formData} update={update} />}
            {activeStep === 3 && <Step4Technical formData={formData} update={update} />}
            {activeStep === 4 && <Step5GDPR formData={formData} update={update} />}
            {activeStep === 5 && <Step6Documents applicationId={applicationId} />}
            {activeStep === 6 && (
              <Step7Confirm formData={formData} agreedToTerms={agreedToTerms}
                            setAgreedToTerms={setAgreedToTerms} />
            )}
          </CardContent>
        </Card>

        <Stack direction="row" justifyContent="space-between" mt={3}>
          <Button startIcon={<ArrowBackIcon />} onClick={back} disabled={activeStep === 0}
                  sx={{ color: PALETTE.text }}>
            Tilbake
          </Button>
          <Button onClick={() => saveStep(activeStep + 1)} startIcon={<SaveIcon />}
                  disabled={saving} sx={{ color: PALETTE.textMuted }}>
            {saving ? "Lagrer…" : "Lagre utkast"}
          </Button>
          {activeStep < STEPS.length - 1 ? (
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={next}
                    sx={{ bgcolor: PALETTE.accent, color: "#0a0512", fontWeight: 700 }}>
              Neste
            </Button>
          ) : (
            <Button variant="contained" disabled={!agreedToTerms || submitting} onClick={submit}
                    sx={{ bgcolor: "#9be15d", color: "#0a0512", fontWeight: 700 }}>
              {submitting ? "Submitter…" : "Submit søknad"}
            </Button>
          )}
        </Stack>

        <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}
                  message={snackbar?.msg} />
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function Step1Bedrift({ formData, update }: any) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Bedrift</Typography>
      <Typography sx={{ color: PALETTE.textMuted }}>
        Vi henter org-info fra BRREG hvis tilgjengelig.
      </Typography>
      <TextField label="Organisasjonsnummer" value={formData.org_number ?? ""}
                 onChange={(e) => update({ org_number: e.target.value })}
                 placeholder="9 siffer" sx={inputSx} />
      <FormControl fullWidth>
        <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Land</InputLabel>
        <Select value={formData.country ?? "Norge"} label="Land"
                onChange={(e) => update({ country: e.target.value })} sx={{ color: "#fff" }}>
          <MenuItem value="Norge">Norge</MenuItem>
          <MenuItem value="Sverige">Sverige</MenuItem>
          <MenuItem value="Danmark">Danmark</MenuItem>
          <MenuItem value="Andre EU/EØS">Andre EU/EØS</MenuItem>
          <MenuItem value="Utenfor EU/EØS">Utenfor EU/EØS</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Bransje" value={formData.industry ?? ""}
                 onChange={(e) => update({ industry: e.target.value })} sx={inputSx} />
      <FormControl fullWidth>
        <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Antall ansatte</InputLabel>
        <Select value={formData.employees_count ?? ""} label="Antall ansatte"
                onChange={(e) => update({ employees_count: e.target.value })} sx={{ color: "#fff" }}>
          <MenuItem value="1">1 (solo)</MenuItem>
          <MenuItem value="2-10">2-10</MenuItem>
          <MenuItem value="11-50">11-50</MenuItem>
          <MenuItem value="51-200">51-200</MenuItem>
          <MenuItem value="201+">201+</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Telefon" value={formData.contact_phone ?? ""}
                 onChange={(e) => update({ contact_phone: e.target.value })} sx={inputSx} />
    </Stack>
  );
}

function Step2PartnerType({ formData, update }: any) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Partnerrolle</Typography>
      <FormControl>
        <FormLabel sx={{ color: PALETTE.textMuted, mb: 1 }}>Partnerkategori</FormLabel>
        <RadioGroup value={formData.partner_type ?? ""}
                    onChange={(e) => update({ partner_type: e.target.value })}>
          {PARTNER_TYPES.map((t) => (
            <FormControlLabel key={t.value} value={t.value}
              control={<Radio sx={{ color: "rgba(255,255,255,0.3)",
                                     "&.Mui-checked": { color: PALETTE.accent } }} />}
              label={
                <Box>
                  <Typography sx={{ color: "#fff" }}>{t.label}</Typography>
                  <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>{t.desc}</Typography>
                </Box>
              } />
          ))}
        </RadioGroup>
      </FormControl>
      <TextField multiline rows={3} label="Beskriv tjenesten deres"
                 value={formData.service_description ?? ""}
                 onChange={(e) => update({ service_description: e.target.value })} sx={inputSx} />
      <TextField multiline rows={2} label="Hvem er kundene deres?"
                 value={formData.customer_segments ?? ""}
                 onChange={(e) => update({ customer_segments: e.target.value })} sx={inputSx} />
      <TextField multiline rows={3} label="Hvorfor passer dere inn i Leadgrid?"
                 value={formData.why_leadgrid ?? ""}
                 onChange={(e) => update({ why_leadgrid: e.target.value })} sx={inputSx} />
    </Stack>
  );
}

function Step3Usage({ formData, update }: any) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Bruk av Leadgrid</Typography>
      <TextField multiline rows={4} required label="Hvordan skal dere bruke Leadgrid?"
                 value={formData.use_case_description ?? ""}
                 onChange={(e) => update({ use_case_description: e.target.value })}
                 placeholder="Konkret beskrivelse — minst 50 tegn" sx={inputSx} />
      <Box>
        <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>Tilgang</Typography>
        <Stack mt={1}>
          {[
            { key: "uses_api",                  label: "Skal bruke API" },
            { key: "uses_webhooks",             label: "Skal bruke webhooks" },
            { key: "wants_marketplace_listing", label: "Vises i partnerkatalogen" },
            { key: "wants_reseller",            label: "Selge Leadgrid videre" },
          ].map((o) => (
            <FormControlLabel key={o.key}
              control={<Checkbox checked={formData[o.key] ?? false}
                                  onChange={(e) => update({ [o.key]: e.target.checked })}
                                  sx={{ color: "rgba(255,255,255,0.3)",
                                        "&.Mui-checked": { color: PALETTE.accent } }} />}
              label={o.label} />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function Step4Technical({ formData, update }: any) {
  const toggleScope = (s: string) => {
    const cur = formData.requested_scopes ?? [];
    update({ requested_scopes: cur.includes(s) ? cur.filter((x: string) => x !== s) : [...cur, s] });
  };
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Teknisk tilgang</Typography>
      <Stack direction="row" spacing={2}>
        <TextField fullWidth label="Teknisk kontaktnavn"
                   value={formData.technical_contact_name ?? ""}
                   onChange={(e) => update({ technical_contact_name: e.target.value })} sx={inputSx} />
        <TextField fullWidth label="Teknisk kontakt e-post" type="email"
                   value={formData.technical_contact_email ?? ""}
                   onChange={(e) => update({ technical_contact_email: e.target.value })} sx={inputSx} />
      </Stack>
      <Box>
        <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>API-scopes</Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} mt={1}>
          {AVAILABLE_SCOPES.map((s) => (
            <Chip key={s} label={s} size="small" onClick={() => toggleScope(s)}
                  sx={{
                    bgcolor: (formData.requested_scopes ?? []).includes(s)
                      ? "rgba(155,225,93,0.20)" : "rgba(255,255,255,0.06)",
                    color: (formData.requested_scopes ?? []).includes(s) ? "#9be15d" : "rgba(255,255,255,0.6)",
                    cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                  }} />
          ))}
        </Stack>
      </Box>
      <TextField multiline rows={3} label="Beskriv dataflyten"
                 value={formData.data_flow_description ?? ""}
                 onChange={(e) => update({ data_flow_description: e.target.value })} sx={inputSx} />
      <TextField label="Webhook endpoint URL (hvis aktuelt)"
                 value={formData.webhook_endpoint_url ?? ""}
                 onChange={(e) => update({ webhook_endpoint_url: e.target.value })}
                 placeholder="https://..." sx={inputSx} />
      <TextField type="number" label="Forventet volum (calls/mnd)"
                 value={formData.expected_volume ?? ""}
                 onChange={(e) => update({ expected_volume: Number(e.target.value) || null })} sx={inputSx} />
      <FormControlLabel control={<Checkbox checked={formData.has_developer_docs ?? false}
                       onChange={(e) => update({ has_developer_docs: e.target.checked })}
                       sx={{ color: "rgba(255,255,255,0.3)",
                             "&.Mui-checked": { color: PALETTE.accent } }} />}
        label="Vi har egen utviklerdokumentasjon" />
      {formData.has_developer_docs && (
        <TextField label="Lenke til dev-docs" value={formData.developer_docs_url ?? ""}
                   onChange={(e) => update({ developer_docs_url: e.target.value })} sx={inputSx} />
      )}
    </Stack>
  );
}

function Step5GDPR({ formData, update }: any) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>GDPR & sikkerhet</Typography>
      <Alert severity="info">
        Disse spørsmålene er obligatoriske for partnere som behandler persondata
        eller får API-tilgang. Vi bruker svarene til å vurdere risk-nivå.
      </Alert>

      <FormControlLabel control={<Checkbox checked={formData.processes_personal_data ?? false}
                       onChange={(e) => update({ processes_personal_data: e.target.checked })}
                       sx={{ color: "rgba(255,255,255,0.3)",
                             "&.Mui-checked": { color: PALETTE.accent } }} />}
        label="Vi behandler persondata" />

      {formData.processes_personal_data && (
        <>
          <TextField multiline rows={2} label="Hvilke typer persondata?"
                     value={formData.personal_data_types ?? ""}
                     onChange={(e) => update({ personal_data_types: e.target.value })} sx={inputSx} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Hvor lagres data?</InputLabel>
            <Select value={formData.data_storage_location ?? ""} label="Hvor lagres data?"
                    onChange={(e) => update({ data_storage_location: e.target.value })} sx={{ color: "#fff" }}>
              <MenuItem value="EU/EØS">EU/EØS</MenuItem>
              <MenuItem value="USA">USA</MenuItem>
              <MenuItem value="UK">UK</MenuItem>
              <MenuItem value="Andre">Andre</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel control={<Checkbox checked={formData.data_within_eu_eea ?? false}
                           onChange={(e) => update({ data_within_eu_eea: e.target.checked })}
                           sx={{ color: "rgba(255,255,255,0.3)",
                                 "&.Mui-checked": { color: PALETTE.accent } }} />}
            label="All data forblir innenfor EU/EØS" />
        </>
      )}

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>Sikkerhet</Typography>
      <Stack direction="row" spacing={2}>
        <FormControlLabel control={<Checkbox checked={formData.encrypts_in_transit ?? false}
                         onChange={(e) => update({ encrypts_in_transit: e.target.checked })}
                         sx={{ color: "rgba(255,255,255,0.3)",
                               "&.Mui-checked": { color: PALETTE.accent } }} />}
          label="Encryption in transit (TLS)" />
        <FormControlLabel control={<Checkbox checked={formData.encrypts_at_rest ?? false}
                         onChange={(e) => update({ encrypts_at_rest: e.target.checked })}
                         sx={{ color: "rgba(255,255,255,0.3)",
                               "&.Mui-checked": { color: PALETTE.accent } }} />}
          label="Encryption at rest" />
        <FormControlLabel control={<Checkbox checked={formData.has_internal_access_control ?? false}
                         onChange={(e) => update({ has_internal_access_control: e.target.checked })}
                         sx={{ color: "rgba(255,255,255,0.3)",
                               "&.Mui-checked": { color: PALETTE.accent } }} />}
          label="Intern tilgangsstyring" />
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>Underleverandører + DPA</Typography>
      <FormControlLabel control={<Checkbox checked={formData.uses_subprocessors ?? false}
                       onChange={(e) => update({ uses_subprocessors: e.target.checked })}
                       sx={{ color: "rgba(255,255,255,0.3)",
                             "&.Mui-checked": { color: PALETTE.accent } }} />}
        label="Vi bruker underleverandører" />
      {formData.uses_subprocessors && (
        <TextField multiline rows={2} label="Liste over underleverandører"
                   value={formData.subprocessors_list ?? ""}
                   onChange={(e) => update({ subprocessors_list: e.target.value })}
                   placeholder="F.eks. AWS, Stripe, Cloudflare" sx={inputSx} />
      )}
      <Stack direction="row" spacing={2}>
        <FormControlLabel control={<Checkbox checked={formData.has_dpa ?? false}
                         onChange={(e) => update({ has_dpa: e.target.checked })}
                         sx={{ color: "rgba(255,255,255,0.3)",
                               "&.Mui-checked": { color: PALETTE.accent } }} />}
          label="Vi har egen DPA" />
        <FormControlLabel control={<Checkbox checked={formData.can_sign_leadgrid_dpa ?? false}
                         onChange={(e) => update({ can_sign_leadgrid_dpa: e.target.checked })}
                         sx={{ color: "rgba(255,255,255,0.3)",
                               "&.Mui-checked": { color: PALETTE.accent } }} />}
          label="Vi kan signere Leadgrids DPA" />
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <TextField multiline rows={2} label="Hvordan håndterer dere sletting av data?"
                 value={formData.data_deletion_routine ?? ""}
                 onChange={(e) => update({ data_deletion_routine: e.target.value })} sx={inputSx} />
      <TextField multiline rows={2} label="Hvordan håndterer dere innsynsbegjæringer?"
                 value={formData.access_request_routine ?? ""}
                 onChange={(e) => update({ access_request_routine: e.target.value })} sx={inputSx} />
      <TextField type="number" label="Hvor lenge lagres data (dager)?"
                 value={formData.data_retention_days ?? ""}
                 onChange={(e) => update({ data_retention_days: Number(e.target.value) || null })} sx={inputSx} />
      <TextField label="Incident response kontakt (e-post)"
                 type="email" value={formData.incident_response_contact ?? ""}
                 onChange={(e) => update({ incident_response_contact: e.target.value })} sx={inputSx} />
    </Stack>
  );
}

function Step6Documents({ applicationId }: { applicationId: string | null }) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Dokumenter</Typography>
      <Alert severity="info">
        Dokument-upload kommer i neste versjon. Pr nå kan dere sende dokumenter
        på e-post til <a href="mailto:daniel@creatorhubn.com" style={{ color: PALETTE.accent }}>
        daniel@creatorhubn.com</a> med søknads-ID som referanse.
      </Alert>
      {applicationId && (
        <Box sx={{ p: 2, bgcolor: "rgba(167,139,250,0.06)", borderRadius: 2 }}>
          <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>Søknads-ID</Typography>
          <Typography sx={{ fontFamily: "monospace", color: "#fff" }}>{applicationId}</Typography>
        </Box>
      )}
      <Typography variant="overline" sx={{ color: PALETTE.textMuted }}>Anbefalt opplastning</Typography>
      <Stack spacing={1}>
        {["Personvernerklæring", "Databehandleravtale (DPA)",
          "Sikkerhetsdokumentasjon", "Case-studier / portefølje", "Referanser"].map((d) => (
          <Box key={d} sx={{ p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
            <Typography variant="body2">{d}</Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function Step7Confirm({ formData, agreedToTerms, setAgreedToTerms }: {
  formData: FormData; agreedToTerms: boolean; setAgreedToTerms: (v: boolean) => void;
}) {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Bekreftelse</Typography>
      <Alert severity="info">
        Vurdér dette nøye. Ved å submitte aksepterer du Leadgrid Partner Terms
        og bekrefter at informasjonen er korrekt.
      </Alert>
      <Box sx={{ p: 3, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
        <Typography variant="overline" sx={{ color: PALETTE.textFaint }}>Oppsummering</Typography>
        <Stack mt={1} spacing={1}>
          <Row label="Partner-type" value={formData.partner_type} />
          <Row label="Bruker API" value={formData.uses_api ? "Ja" : "Nei"} />
          <Row label="Bruker webhooks" value={formData.uses_webhooks ? "Ja" : "Nei"} />
          <Row label="Behandler persondata" value={formData.processes_personal_data ? "Ja" : "Nei"} />
          <Row label="Innenfor EU/EØS" value={formData.data_within_eu_eea ? "Ja" : "Nei"} />
          <Row label="Krypterer (in transit + at rest)" value={
            (formData.encrypts_in_transit && formData.encrypts_at_rest) ? "Ja" : "Delvis/Nei"
          } />
        </Stack>
      </Box>
      <FormControlLabel control={<Checkbox checked={agreedToTerms}
                       onChange={(e) => setAgreedToTerms(e.target.checked)}
                       sx={{ color: "rgba(255,255,255,0.3)",
                             "&.Mui-checked": { color: PALETTE.accent } }} />}
        label={<Typography variant="body2">
          Jeg bekrefter at informasjonen er korrekt og aksepterer Leadgrid Partner Terms
        </Typography>} />
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" sx={{ color: PALETTE.textMuted }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: "#fff" }}>{String(value ?? "—")}</Typography>
    </Stack>
  );
}
