/**
 * leadgrid-superadmin.tsx
 *
 * Egen route /superadmin for users.role='super_admin'. Gir Daniel:
 *   - Liste av alle organisasjoner med org_type-badge + medlemmer + plan
 *   - "+ Ny organisasjon" — BRREG-oppslag + mal-velger + invite
 *   - "Lån org-kontekst" — switch som superadmin (audit-logget)
 *   - Audit-log over hva superadmins har gjort
 *
 * Designet matched mot Leadgrid-stemmen (mørkt premium, Backdrop som
 * hero). Bruker eksisterende /api/superadmin/* endepunkter.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Container, Typography, Button, Stack, Chip, IconButton,
  TextField, Card, CardContent, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Table, TableHead, TableBody, TableRow,
  TableCell, Tabs, Tab, Tooltip, Switch, FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import BusinessIcon from "@mui/icons-material/Business";
import StorefrontIcon from "@mui/icons-material/Storefront";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import PaymentIcon from "@mui/icons-material/Payment";
import BoltIcon from "@mui/icons-material/Bolt";
import GavelIcon from "@mui/icons-material/Gavel";
import SuperadminTemplatesEditor from "@/components/leadgrid/SuperadminTemplatesEditor";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import BlockIcon from "@mui/icons-material/Block";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { apiFetch } from "@/lib/queryClient";

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  org_type: "developer" | "agency" | "customer";
  plan: string;
  status?: "active" | "paused" | "read_only" | "suspended" | "closed";
  owner_user_id: string | null;
  org_number: string | null;
  website: string | null;
  industry: string | null;
  logo_url: string | null;
  member_count: number;
  customer_count: number;
  owner_email: string | null;
  created_at: string;
  pause_reason?: string | null;
  paused_at?: string | null;
}

interface PaymentsOverview {
  mrr_nok_total: number;
  arr_nok_estimate: number;
  lifetime_nok: number;
  total_paid_invoices: number;
  churn_orgs_30d: number;
  by_plan: { plan: string; active_orgs: number; mrr_nok: number }[];
  recent_invoices: {
    id: string; invoice_number: string | null;
    amount_paid_oere: number; currency: string; status: string;
    created_at: string; hosted_invoice_url: string | null;
    plan_key: string; org_name: string; org_type: string;
  }[];
}

interface TokenUsage {
  period_days: number;
  total: {
    calls: string; input_tokens: string; output_tokens: string;
    cache_read_tokens: string; cache_write_tokens: string; cost_usd: string;
  };
  by_org: {
    organization_id: string | null; org_name: string | null;
    org_type: string | null; plan: string | null;
    calls: string; input_tokens: string; output_tokens: string;
    cache_read_tokens: string; cache_write_tokens: string;
    cost_usd: string; last_call_at: string | null;
  }[];
}

interface SetupTemplate {
  id: string;
  template_key: string;
  label: string;
  description: string;
  allowed_roles: string[];
  default_plan: string;
  self_onboard_allowed: boolean;
}

interface AuditEntry {
  id: string;
  super_admin_id: string;
  super_admin_email: string | null;
  action: string;
  target_org_id: string | null;
  target_user_id: string | null;
  org_name: string | null;
  details: any;
  created_at: string;
}

interface ActiveImpersonation {
  active_org_id: string;
  org_name: string;
  org_type: string;
  started_at: string;
  expires_at: string;
}

export default function LeadgridSuperadminPage() {
  const [tab, setTab] = useState<"orgs" | "payments" | "tokens" | "templates" | "audit">("orgs");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [templates, setTemplates] = useState<SetupTemplate[]>([]);
  const [impersonation, setImpersonation] = useState<ActiveImpersonation | null>(null);
  const [payments, setPayments] = useState<PaymentsOverview | null>(null);
  const [tokens, setTokens] = useState<TokenUsage | null>(null);
  const [tokenPeriod, setTokenPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Load org list
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsR, tmplR, impR, auditR, paymentsR, tokensR] = await Promise.all([
        apiFetch("/api/superadmin/organizations"),
        apiFetch("/api/superadmin/setup-templates"),
        apiFetch("/api/superadmin/active-impersonation"),
        apiFetch("/api/superadmin/audit-log?limit=50"),
        apiFetch("/api/superadmin/payments-overview"),
        apiFetch(`/api/superadmin/org-token-usage?period=${tokenPeriod}`),
      ]);
      if (orgsR.status === 403) { setAccessDenied(true); setLoading(false); return; }
      const orgsData = await orgsR.json();
      const tmplData = await tmplR.json();
      const impData = await impR.json();
      const auditData = await auditR.json();
      const paymentsData = paymentsR.ok ? await paymentsR.json() : null;
      const tokensData = tokensR.ok ? await tokensR.json() : null;
      setOrgs(orgsData.organizations ?? []);
      setTemplates(tmplData.templates ?? []);
      setImpersonation(impData.active ?? null);
      setAudit(auditData.entries ?? []);
      setPayments(paymentsData);
      setTokens(tokensData);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [tokenPeriod]);
  useEffect(() => { load(); }, [load]);

  if (accessDenied) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#0a0e1a", color: "#fff", p: 6 }}>
        <Container maxWidth="sm">
          <Alert severity="error">Du må være super-admin for å se denne siden.</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0a0e1a", color: "#fff" }}>
      {/* Hero */}
      <Box sx={{
        position: "relative",
        background:
          "linear-gradient(180deg, rgba(10,14,26,0.6) 0%, rgba(10,14,26,0.95) 60%, #0a0e1a 100%), url('/leadgrid/backdrop2.jpg') center/cover",
        py: 6, mb: 4,
      }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={2} mb={1}>
            <VerifiedUserIcon sx={{ color: "#9be15d" }} />
            <Typography variant="overline" sx={{ color: "#9be15d", letterSpacing: 2 }}>
              Super-admin
            </Typography>
          </Stack>
          <Typography variant="h3" fontWeight={800}>
            Leadgrid Governance
          </Typography>
          <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.7)", mt: 1 }}>
            Alle organisasjoner på gridden. Du ser hva andre ikke ser.
          </Typography>
          {impersonation && (
            <Alert
              severity="warning"
              sx={{ mt: 3 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<LogoutIcon />}
                  onClick={async () => {
                    await apiFetch("/api/superadmin/end-impersonation", { method: "POST" });
                    load();
                  }}
                >
                  Avslutt
                </Button>
              }
            >
              Du ser nå <strong>{impersonation.org_name}</strong> som superadmin.
              Utløper {new Date(impersonation.expires_at).toLocaleTimeString("no-NO")}.
              Alle handlinger logges.
            </Alert>
          )}
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 3, "& .MuiTab-root": { color: "rgba(255,255,255,0.7)" } }}
        >
          <Tab label={`Organisasjoner (${orgs.length})`} value="orgs" />
          <Tab
            label={`Betaling${payments ? ` (${payments.mrr_nok_total.toLocaleString("no-NO")} kr MRR)` : ""}`}
            value="payments" icon={<PaymentIcon />} iconPosition="start"
          />
          <Tab
            label={`Tokens${tokens ? ` ($${parseFloat(tokens.total.cost_usd).toFixed(2)})` : ""}`}
            value="tokens" icon={<BoltIcon />} iconPosition="start"
          />
          <Tab label="Avtaler" value="templates" icon={<GavelIcon />} iconPosition="start" />
          <Tab label={`Audit-log (${audit.length})`} value="audit" icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : tab === "orgs" ? (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Alle organisasjoner</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}
              >
                Ny organisasjon
              </Button>
            </Stack>
            <Stack spacing={2}>
              {orgs.map((o) => (
                <OrgCard
                  key={o.id} org={o}
                  mrrForPlan={(payments?.by_plan ?? []).find((p) => p.plan === o.plan)?.mrr_nok ?? null}
                  onSwitch={async (reason) => {
                    await apiFetch("/api/superadmin/switch-context", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orgId: o.id, reason }),
                    });
                    load();
                  }}
                  onSetStatus={async (status, reason) => {
                    await apiFetch(`/api/superadmin/organizations/${o.id}/set-status`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status, reason }),
                    });
                    load();
                  }}
                />
              ))}
              {orgs.length === 0 && (
                <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
                  <CardContent>
                    <Typography color="rgba(255,255,255,0.6)">
                      Ingen organisasjoner ennå. Trykk "Ny organisasjon" for å starte.
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </>
        ) : tab === "payments" ? (
          <PaymentsTab data={payments} />
        ) : tab === "tokens" ? (
          <TokensTab
            data={tokens}
            period={tokenPeriod}
            onPeriodChange={setTokenPeriod}
          />
        ) : tab === "templates" ? (
          <SuperadminTemplatesEditor />
        ) : (
          <AuditTab entries={audit} />
        )}
      </Container>

      <CreateOrgDialog
        open={createOpen}
        templates={templates}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// OrgCard
// ---------------------------------------------------------------------------

function OrgCard({
  org, mrrForPlan, onSwitch, onSetStatus,
}: {
  org: Organization;
  mrrForPlan: number | null;
  onSwitch: (reason: string) => Promise<void>;
  onSetStatus: (status: string, reason: string) => Promise<void>;
}) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<"paused" | "read_only" | "suspended" | "active">("paused");
  const [reason, setReason] = useState("");
  const [switching, setSwitching] = useState(false);

  const typeBadge = org.org_type === "developer"
    ? { color: "#9be15d", icon: <RocketLaunchIcon fontSize="small" />, label: "Developer" }
    : org.org_type === "agency"
      ? { color: "#7ab8ff", icon: <StorefrontIcon fontSize="small" />, label: "Byrå" }
      : { color: "#ffb86b", icon: <BusinessIcon fontSize="small" />, label: "Kunde" };

  const status = org.status ?? "active";
  const statusBadge = status === "active"
    ? null
    : status === "paused"
      ? { color: "#ffb86b", label: "På pause" }
      : status === "read_only"
        ? { color: "#7ab8ff", label: "Read-only" }
        : status === "suspended"
          ? { color: "#ff6b6b", label: "Suspendert" }
          : { color: "#888", label: "Lukket" };

  return (
    <>
      <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff",
                   border: statusBadge ? `1px solid ${statusBadge.color}40` : "none" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            {org.logo_url ? (
              <Box component="img" src={org.logo_url} alt={org.name}
                   sx={{ width: 48, height: 48, borderRadius: 1, objectFit: "contain", bgcolor: "#fff", p: 0.5 }} />
            ) : (
              <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: typeBadge.color,
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography fontWeight={800} color="#0a0e1a">
                  {org.name.substring(0, 2).toUpperCase()}
                </Typography>
              </Box>
            )}
            <Box flex={1}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="h6">{org.name}</Typography>
                <Chip
                  size="small" icon={typeBadge.icon} label={typeBadge.label}
                  sx={{ bgcolor: typeBadge.color, color: "#0a0e1a", fontWeight: 600 }}
                />
                <Chip size="small" label={org.plan} variant="outlined"
                      sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }} />
                {statusBadge && (
                  <Chip size="small" label={statusBadge.label}
                        sx={{ bgcolor: statusBadge.color, color: "#0a0e1a", fontWeight: 600 }} />
                )}
                {mrrForPlan != null && mrrForPlan > 0 && (
                  <Chip size="small" label={`${mrrForPlan} kr/mnd`} variant="outlined"
                        sx={{ color: "#9be15d", borderColor: "#9be15d" }} />
                )}
              </Stack>
              <Typography variant="caption" color="rgba(255,255,255,0.6)">
                {org.member_count} medlem(mer) · {org.customer_count} kunde(r)
                {org.owner_email && ` · ${org.owner_email}`}
                {org.org_number && ` · org ${org.org_number}`}
                {org.pause_reason && ` · ${org.pause_reason}`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Lån org-kontekst (audit-logget)">
                <Button
                  size="small" variant="outlined" startIcon={<SwapHorizIcon />}
                  onClick={() => setSwitchOpen(true)}
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
                >
                  Lån
                </Button>
              </Tooltip>
              {status === "active" ? (
                <>
                  <Tooltip title="Sett på pause">
                    <IconButton size="small"
                      onClick={() => { setStatusAction("paused"); setReason(""); setStatusOpen(true); }}
                      sx={{ color: "#ffb86b" }}>
                      <PauseCircleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Read-only (vedlikehold)">
                    <IconButton size="small"
                      onClick={() => { setStatusAction("read_only"); setReason(""); setStatusOpen(true); }}
                      sx={{ color: "#7ab8ff" }}>
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Suspend (ToS-brudd)">
                    <IconButton size="small"
                      onClick={() => { setStatusAction("suspended"); setReason(""); setStatusOpen(true); }}
                      sx={{ color: "#ff6b6b" }}>
                      <BlockIcon />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <Tooltip title="Reaktiver organisasjon">
                  <Button
                    size="small" variant="contained" startIcon={<PlayCircleIcon />}
                    onClick={() => { setStatusAction("active"); setReason("reactivated by superadmin"); setStatusOpen(true); }}
                    sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}
                  >
                    Reaktiver
                  </Button>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {statusAction === "active"  && `Reaktiver ${org.name}`}
          {statusAction === "paused"  && `Sett ${org.name} på pause`}
          {statusAction === "read_only" && `Sett ${org.name} til read-only`}
          {statusAction === "suspended" && `Suspender ${org.name}`}
        </DialogTitle>
        <DialogContent>
          {statusAction === "paused" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Pause: Org-medlemmer kan lese, men ikke endre. Stripe-collection pauses
              automatisk (keep_as_draft). Brukes typisk ved betalingsproblem.
            </Alert>
          )}
          {statusAction === "read_only" && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Read-only: For vedlikehold eller datamigrering. Medlemmer kan lese, ikke endre.
            </Alert>
          )}
          {statusAction === "suspended" && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Suspend: Ingen tilgang. 403 på alle endepunkter. Brukes ved ToS-brudd
              eller sikkerhetsincident. Reversibelt.
            </Alert>
          )}
          {statusAction !== "active" && (
            <TextField
              fullWidth multiline rows={3} autoFocus required
              label="Grunn (kreves for audit)"
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Hvorfor settes denne org'en i denne tilstanden?"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={statusAction !== "active" && !reason.trim()}
            color={statusAction === "suspended" ? "error" : "primary"}
            onClick={async () => {
              await onSetStatus(statusAction, reason);
              setStatusOpen(false);
            }}
          >
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={switchOpen} onClose={() => setSwitchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Lån {org.name}-konteksten</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Du vil se denne org'ens data som superadmin. Alle handlinger logges
            i superadmin_audit_log.
          </Alert>
          <TextField
            fullWidth multiline rows={3}
            label="Hvorfor låner du? (kreves for sporbarhet)"
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="F.eks. 'Kundens markedsfører har bedt om hjelp til Meta Pixel-feilsøking'"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwitchOpen(false)}>Avbryt</Button>
          <Button
            variant="contained" disabled={!reason.trim() || switching}
            onClick={async () => {
              setSwitching(true);
              await onSwitch(reason);
              setSwitching(false);
              setSwitchOpen(false);
            }}
          >
            {switching ? "Bytter …" : "Bytt kontekst"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Create Org Dialog
// ---------------------------------------------------------------------------

function CreateOrgDialog({
  open, templates, onClose, onCreated,
}: { open: boolean; templates: SetupTemplate[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [orgType, setOrgType] = useState<"agency" | "customer">("agency");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [templateKey, setTemplateKey] = useState("agency_small");
  const [website, setWebsite] = useState("");
  const [brregLoading, setBrregLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrreg = async () => {
    if (!orgNumber.trim()) return;
    setBrregLoading(true);
    try {
      const r = await apiFetch(`/api/superadmin/brreg/${orgNumber.replace(/\D/g, "")}`);
      if (r.ok) {
        const d = await r.json();
        setName(d.name ?? name);
        if (d.industry) { /* industri-felt finnes ikke i form, men kan brukes */ }
      } else {
        setError("BRREG fant ikke org-nummeret");
      }
    } catch { /* ignorer */ }
    setBrregLoading(false);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch("/api/superadmin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, orgNumber: orgNumber || undefined,
          orgType, adminEmail, adminName: adminName || undefined,
          templateKey, website: website || undefined,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        setError(e.error ?? "Kunne ikke opprette");
        setSubmitting(false);
        return;
      }
      onCreated();
      setName(""); setOrgNumber(""); setAdminEmail(""); setAdminName(""); setWebsite("");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Opprett ny organisasjon</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth label="Org-nummer (valgfritt)"
              value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)}
              placeholder="9 siffer fra BRREG"
            />
            <Button onClick={handleBrreg} disabled={brregLoading || !orgNumber}>
              {brregLoading ? <CircularProgress size={18} /> : "BRREG-oppslag"}
            </Button>
          </Stack>

          <TextField
            fullWidth required label="Navn på organisasjon"
            value={name} onChange={(e) => setName(e.target.value)}
          />

          <FormControl fullWidth required>
            <InputLabel>Org-type</InputLabel>
            <Select value={orgType} label="Org-type" onChange={(e) => setOrgType(e.target.value as any)}>
              <MenuItem value="agency">Byrå (kjører Leadgrid mot egne kunder)</MenuItem>
              <MenuItem value="customer">Sluttkunde (egen org, ingen videresalg)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Setup-mal</InputLabel>
            <Select value={templateKey} label="Setup-mal" onChange={(e) => setTemplateKey(e.target.value)}>
              {templates.map((t) => (
                <MenuItem key={t.template_key} value={t.template_key}>
                  <Box>
                    <Typography>{t.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="overline" color="text.secondary">Admin-bruker (eier av denne org'en)</Typography>
          <TextField
            fullWidth required label="Admin e-post"
            type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@bedrift.no"
          />
          <TextField
            fullWidth label="Admin navn (valgfritt)"
            value={adminName} onChange={(e) => setAdminName(e.target.value)}
          />
          <TextField
            fullWidth label="Website (valgfritt)"
            value={website} onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://bedrift.no"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained" disabled={submitting || !name || !adminEmail}
          onClick={submit}
        >
          {submitting ? "Oppretter …" : "Opprett + send invite"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Audit tab
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Payments tab
// ---------------------------------------------------------------------------

function PaymentsTab({ data }: { data: PaymentsOverview | null }) {
  if (!data) {
    return <Alert severity="info">Ingen betalingsdata ennå.</Alert>;
  }
  return (
    <Stack spacing={3}>
      {/* KPI-kort */}
      <Stack direction="row" spacing={2}>
        {[
          { label: "MRR", value: `${data.mrr_nok_total.toLocaleString("no-NO")} kr/mnd`, color: "#9be15d" },
          { label: "ARR-estimat", value: `${data.arr_nok_estimate.toLocaleString("no-NO")} kr`, color: "#7ab8ff" },
          { label: "Lifetime", value: `${Math.round(data.lifetime_nok).toLocaleString("no-NO")} kr`, color: "#ffb86b" },
          { label: "Churn (30d)", value: `${data.churn_orgs_30d} orgs`, color: data.churn_orgs_30d > 0 ? "#ff6b6b" : "rgba(255,255,255,0.4)" },
        ].map((k) => (
          <Card key={k.label} sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)" }}>{k.label}</Typography>
              <Typography variant="h5" sx={{ color: k.color, fontWeight: 700 }}>{k.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Per-plan-breakdown */}
      <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
        <CardContent>
          <Typography variant="h6" mb={2}>MRR per plan</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Plan</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Aktive orgs</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }} align="right">MRR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.by_plan.map((p) => (
                <TableRow key={p.plan}>
                  <TableCell sx={{ color: "#fff" }}>{p.plan ?? "—"}</TableCell>
                  <TableCell sx={{ color: "#fff" }}>{p.active_orgs}</TableCell>
                  <TableCell sx={{ color: "#9be15d", fontWeight: 600 }} align="right">
                    {Number(p.mrr_nok).toLocaleString("no-NO")} kr
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Siste fakturaer</Typography>
          {data.recent_invoices.length === 0 ? (
            <Typography color="rgba(255,255,255,0.5)">Ingen fakturaer ennå.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Når</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Org</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Plan</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Status</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }} align="right">Beløp</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recent_invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell sx={{ color: "#fff" }}>
                      {new Date(i.created_at).toLocaleDateString("no-NO")}
                    </TableCell>
                    <TableCell sx={{ color: "#fff" }}>{i.org_name}</TableCell>
                    <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>{i.plan_key}</TableCell>
                    <TableCell>
                      <Chip size="small" label={i.status}
                            sx={{ bgcolor: i.status === "paid" ? "#9be15d" : "#ffb86b", color: "#0a0e1a" }} />
                    </TableCell>
                    <TableCell sx={{ color: "#9be15d", fontWeight: 600 }} align="right">
                      {(i.amount_paid_oere / 100).toLocaleString("no-NO")} {i.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {i.hosted_invoice_url && (
                        <Button size="small" href={i.hosted_invoice_url} target="_blank"
                                sx={{ color: "#9be15d" }}>
                          Åpne
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Tokens tab
// ---------------------------------------------------------------------------

function TokensTab({
  data, period, onPeriodChange,
}: { data: TokenUsage | null; period: number; onPeriodChange: (p: number) => void }) {
  if (!data) return <Alert severity="info">Ingen token-data ennå.</Alert>;
  const totalCostUsd = parseFloat(data.total.cost_usd);
  const totalInputTokens = parseInt(data.total.input_tokens);
  const totalOutputTokens = parseInt(data.total.output_tokens);

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Claude-token-forbruk</Typography>
        <FormControl size="small">
          <InputLabel>Periode</InputLabel>
          <Select value={period} label="Periode" onChange={(e) => onPeriodChange(Number(e.target.value))}>
            <MenuItem value={7}>Siste 7 dager</MenuItem>
            <MenuItem value={30}>Siste 30 dager</MenuItem>
            <MenuItem value={90}>Siste 90 dager</MenuItem>
            <MenuItem value={365}>Siste år</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* KPI-kort */}
      <Stack direction="row" spacing={2}>
        {[
          { label: "Total cost", value: `$${totalCostUsd.toFixed(2)}`, color: "#9be15d" },
          { label: "Input-tokens", value: totalInputTokens.toLocaleString("no-NO"), color: "#7ab8ff" },
          { label: "Output-tokens", value: totalOutputTokens.toLocaleString("no-NO"), color: "#ffb86b" },
          { label: "Calls", value: data.total.calls, color: "rgba(255,255,255,0.7)" },
        ].map((k) => (
          <Card key={k.label} sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)" }}>{k.label}</Typography>
              <Typography variant="h5" sx={{ color: k.color, fontWeight: 700 }}>{k.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Per-org-tabell */}
      <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Per organisasjon</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Organisasjon</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Plan</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }} align="right">Calls</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }} align="right">Input</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }} align="right">Output</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)" }} align="right">Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.by_org.map((o) => (
                <TableRow key={o.organization_id ?? "unknown"}>
                  <TableCell sx={{ color: "#fff" }}>{o.org_name ?? "— ukjent —"}</TableCell>
                  <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>{o.plan ?? "—"}</TableCell>
                  <TableCell sx={{ color: "#fff" }} align="right">
                    {parseInt(o.calls).toLocaleString("no-NO")}
                  </TableCell>
                  <TableCell sx={{ color: "#fff" }} align="right">
                    {parseInt(o.input_tokens).toLocaleString("no-NO")}
                  </TableCell>
                  <TableCell sx={{ color: "#fff" }} align="right">
                    {parseInt(o.output_tokens).toLocaleString("no-NO")}
                  </TableCell>
                  <TableCell sx={{ color: "#9be15d", fontWeight: 600 }} align="right">
                    ${parseFloat(o.cost_usd).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {data.by_org.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: "rgba(255,255,255,0.5)" }} align="center">
                    Ingen Claude-calls i perioden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}

function AuditTab({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
      <CardContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Tidspunkt</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Super-admin</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Handling</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Mål-org</TableCell>
              <TableCell sx={{ color: "rgba(255,255,255,0.7)" }}>Detaljer</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell sx={{ color: "#fff" }}>
                  {new Date(e.created_at).toLocaleString("no-NO")}
                </TableCell>
                <TableCell sx={{ color: "#fff" }}>{e.super_admin_email ?? "—"}</TableCell>
                <TableCell sx={{ color: "#fff" }}>
                  <Chip size="small" label={e.action} sx={{ bgcolor: "#9be15d", color: "#0a0e1a" }} />
                </TableCell>
                <TableCell sx={{ color: "#fff" }}>{e.org_name ?? "—"}</TableCell>
                <TableCell sx={{ color: "rgba(255,255,255,0.7)", maxWidth: 300, wordBreak: "break-word" }}>
                  <code style={{ fontSize: 11 }}>{JSON.stringify(e.details)}</code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
