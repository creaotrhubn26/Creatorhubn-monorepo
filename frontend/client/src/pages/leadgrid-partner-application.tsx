/**
 * leadgrid-partner-application.tsx
 *
 * Org-side partnerskaps-flate på /leadgrid/innstillinger/partnerskap.
 *
 * Status-flyt:
 *   1. Ingen søknad → vis informasjon + "Søk om partnerskap"-CTA
 *   2. Pending → "Søknaden er til vurdering" + trekk tilbake-knapp
 *   3. Approved → "Du er Leadgrid-partner ✓" + fordeler + lenke til landing
 *   4. Rejected → vis begrunnelse + mulighet til ny søknad
 */

import React, { useEffect, useState } from "react";
import {
  Box, Container, Stack, Typography, Button, Card, CardContent, Chip,
  Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Checkbox,
  FormControlLabel, Snackbar, Divider,
} from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import HandshakeIcon from "@mui/icons-material/Handshake";
import PendingIcon from "@mui/icons-material/Pending";
import CancelIcon from "@mui/icons-material/Cancel";
import BusinessIcon from "@mui/icons-material/Business";
import StorefrontIcon from "@mui/icons-material/Storefront";
import HubIcon from "@mui/icons-material/Hub";
import StarIcon from "@mui/icons-material/Star";

interface Application {
  id: string;
  status: string;
  partner_type: string;
  proposed_tagline: string | null;
  reason: string | null;
  terms_version: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  origin: string;
  partner_id: string | null;
  partner_active: boolean | null;
  show_on_landing: boolean | null;
}

const PARTNER_TYPES = [
  {
    key: "customer", icon: <BusinessIcon />, color: "#ffb86b",
    label: "Kunde-partner",
    summary: "Vi bruker logo + navn i markedsføring. Du får Solo Pro gratis + 2× kvoter.",
  },
  {
    key: "reseller", icon: <StorefrontIcon />, color: "#7ab8ff",
    label: "Reseller",
    summary: "Du selger Leadgrid videre. 10% kommisjon + 20% kunderabatt.",
  },
  {
    key: "integration", icon: <HubIcon />, color: "#9be15d",
    label: "Integration",
    summary: "3rd-party-system m/ API-tilgang. For tekniske partnere.",
  },
  {
    key: "strategic", icon: <StarIcon />, color: "#a78bfa",
    label: "Strategic",
    summary: "Større partnerskap. Enterprise + API + co-marketing.",
  },
];

export default function LeadgridPartnerApplicationPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  useEffect(() => {
    // Hent active org-id fra user-context (forenklet: forvent at den ligger i URL eller fetches)
    fetch("/api/users/me/organizations")
      .then((r) => r.ok ? r.json() : { organizations: [] })
      .then((d) => {
        const adminOrg = (d.organizations ?? []).find((o: any) => o.role === "admin");
        if (adminOrg) {
          setOrgId(adminOrg.id);
          loadApplication(adminOrg.id);
        } else {
          setError("Du må være org-admin for å søke om partnerskap");
          setLoading(false);
        }
      })
      .catch(() => { setError("Kunne ikke laste organisasjon"); setLoading(false); });
  }, []);

  async function loadApplication(orgIdArg: string) {
    try {
      const r = await fetch(`/api/leadgrid/partner-applications/my?orgId=${orgIdArg}`);
      if (r.ok) {
        const d = await r.json();
        setApplication((d.applications ?? [])[0] ?? null);
      }
    } catch { /* swallow */ }
    setLoading(false);
  }

  async function submitApplication(payload: any) {
    try {
      const r = await fetch("/api/leadgrid/partner-applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, ...payload }),
      });
      const d = await r.json();
      if (r.ok) {
        setSnackbar({ msg: "Søknad sendt — vi tar kontakt!", severity: "success" });
        setApplyOpen(false);
        loadApplication(orgId);
      } else {
        setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
      }
    } catch (e: any) {
      setSnackbar({ msg: String(e?.message ?? e), severity: "error" });
    }
  }

  async function withdraw() {
    if (!application || !window.confirm("Trekke tilbake søknaden?")) return;
    try {
      const r = await fetch(`/api/leadgrid/partner-applications/${application.id}/withdraw`, { method: "POST" });
      if (r.ok) {
        setSnackbar({ msg: "Søknad trukket tilbake", severity: "success" });
        loadApplication(orgId);
      }
    } catch { /* swallow */ }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#0a0512",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#a78bfa" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0a0512", color: "#fff" }}>
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack alignItems="center" spacing={2} mb={6}>
          <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(167,139,250,0.10)" }}>
            <HandshakeIcon sx={{ fontSize: 48, color: "#a78bfa" }} />
          </Box>
          <Typography variant="overline" sx={{ color: "#a78bfa", letterSpacing: 2 }}>
            Leadgrid Partnerskap
          </Typography>
          <Typography variant="h3" fontWeight={800} textAlign="center">
            Bli en av våre partnere
          </Typography>
          <Typography variant="body1" textAlign="center" sx={{ color: "rgba(255,255,255,0.7)", maxWidth: 560 }}>
            Som Leadgrid-partner får du fordeler avhengig av rollen — fra
            gratis Solo Pro til API-tilgang og kommisjon.
          </Typography>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Status-card */}
        {application ? (
          <StatusCard
            application={application}
            onWithdraw={withdraw}
            onNewApplication={() => setApplyOpen(true)}
          />
        ) : (
          <>
            <Stack spacing={2} mb={4}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>
                Velg partner-type
              </Typography>
              <Stack spacing={2}>
                {PARTNER_TYPES.map((t) => (
                  <Card key={t.key} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff",
                          border: "1px solid rgba(255,255,255,0.08)",
                          transition: "border-color 0.2s",
                          "&:hover": { borderColor: t.color } }}>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${t.color}20`, color: t.color }}>
                          {t.icon}
                        </Box>
                        <Box flex={1}>
                          <Typography variant="h6">{t.label}</Typography>
                          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                            {t.summary}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Stack>

            <Button
              variant="contained" size="large" fullWidth
              onClick={() => setApplyOpen(true)}
              sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700, py: 1.5,
                     "&:hover": { bgcolor: "#9171e6" } }}
            >
              Søk om partnerskap
            </Button>
          </>
        )}
      </Container>

      <ApplicationDialog
        open={applyOpen} onClose={() => setApplyOpen(false)}
        onSubmit={submitApplication}
      />

      <Snackbar
        open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
      />
    </Box>
  );
}

function StatusCard({
  application, onWithdraw, onNewApplication,
}: {
  application: Application;
  onWithdraw: () => void;
  onNewApplication: () => void;
}) {
  const s = application.status;
  const cfg = s === "approved" ? { icon: <VerifiedIcon />, color: "#9be15d", title: "Du er Leadgrid-partner!" }
            : s === "pending"  ? { icon: <PendingIcon />,  color: "#ffb86b", title: "Søknad til vurdering" }
            : s === "rejected" ? { icon: <CancelIcon />,   color: "#ff6b6b", title: "Søknad ikke godkjent" }
            : s === "withdrawn" ? { icon: <CancelIcon />,   color: "rgba(255,255,255,0.5)", title: "Søknad trukket" }
            : { icon: <PendingIcon />, color: "rgba(255,255,255,0.5)", title: s };
  const type = PARTNER_TYPES.find((t) => t.key === application.partner_type);

  return (
    <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff",
                 border: `1px solid ${cfg.color}40` }}>
      <CardContent sx={{ p: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${cfg.color}20`, color: cfg.color }}>
            {cfg.icon}
          </Box>
          <Box flex={1}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{cfg.title}</Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              <Chip size="small" label={type?.label ?? application.partner_type}
                    sx={{ bgcolor: type?.color ?? cfg.color, color: "#0a0512", fontWeight: 600 }} />
              <Chip size="small" label={`søkt ${new Date(application.created_at).toLocaleDateString("no-NO")}`}
                    variant="outlined" sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)" }} />
              {application.origin === "invitation" && (
                <Chip size="small" label="invitert"
                      sx={{ bgcolor: "rgba(167,139,250,0.20)", color: "#a78bfa" }} />
              )}
            </Stack>
          </Box>
        </Stack>

        {s === "approved" && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Som godkjent partner får du fordelene knyttet til {type?.label ?? application.partner_type}.
            Logoen din vises nå på <a href="/leadgrid" style={{ color: "#9be15d" }}>theroleroom.com/leadgrid</a>.
          </Alert>
        )}

        {s === "pending" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Vi gjennomgår søknaden og kommer tilbake innen 5 virkedager.
            Du får e-post når den blir behandlet.
          </Alert>
        )}

        {s === "rejected" && application.review_notes && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Begrunnelse:</strong> {application.review_notes}
          </Alert>
        )}

        {application.proposed_tagline && (
          <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>Tagline</Typography>
            <Typography variant="body2" fontStyle="italic">«{application.proposed_tagline}»</Typography>
          </Box>
        )}

        <Stack direction="row" spacing={2}>
          {s === "pending" && (
            <Button variant="outlined" onClick={onWithdraw}
                    sx={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.4)" }}>
              Trekk tilbake søknad
            </Button>
          )}
          {s === "rejected" && (
            <Button variant="contained" onClick={onNewApplication}
                    sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }}>
              Send ny søknad
            </Button>
          )}
          {s === "withdrawn" && (
            <Button variant="contained" onClick={onNewApplication}
                    sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }}>
              Søk på nytt
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ApplicationDialog({
  open, onClose, onSubmit,
}: {
  open: boolean; onClose: () => void; onSubmit: (data: any) => void;
}) {
  const [partnerType, setPartnerType] = useState("customer");
  const [proposedTagline, setProposedTagline] = useState("");
  const [reason, setReason] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [terms, setTerms] = useState<{ version: string; body_md: string } | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/leadgrid/partner-terms")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setTerms(d));
    }
  }, [open]);

  const inputSx = {
    "& .MuiOutlinedInput-root": { color: "#fff",
      "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Søk om Leadgrid-partnerskap</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Partner-type</InputLabel>
            <Select value={partnerType} label="Partner-type"
                    onChange={(e) => setPartnerType(e.target.value)}
                    sx={{ color: "#fff" }}>
              {PARTNER_TYPES.map((t) => (
                <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField fullWidth label="Tagline (vises på landing)"
                     value={proposedTagline} onChange={(e) => setProposedTagline(e.target.value)}
                     placeholder="F.eks. 'Vi sparer 5 timer i uka m/ Leadgrid'"
                     sx={inputSx} inputProps={{ maxLength: 100 }} />
          <TextField fullWidth multiline rows={3}
                     label="Hvorfor vil dere være partner? (valgfritt)"
                     value={reason} onChange={(e) => setReason(e.target.value)}
                     sx={inputSx} />

          {terms && (
            <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2,
                        maxHeight: 200, overflow: "auto" }}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", display: "block", mb: 1 }}>
                Vilkår {terms.version}
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)",
                          whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>
                {terms.body_md.substring(0, 800)}
                {terms.body_md.length > 800 && "…"}
              </Typography>
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                        sx={{ color: "rgba(255,255,255,0.4)", "&.Mui-checked": { color: "#a78bfa" } }} />
            }
            label={
              <Typography variant="body2">
                Jeg har lest og godtar partnerskaps-vilkårene
              </Typography>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" disabled={!agreedToTerms}
                onClick={() => onSubmit({
                  partnerType, proposedTagline, reason,
                  termsVersion: terms?.version, agreedToTerms,
                })}
                sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }}>
          Send søknad
        </Button>
      </DialogActions>
    </Dialog>
  );
}
