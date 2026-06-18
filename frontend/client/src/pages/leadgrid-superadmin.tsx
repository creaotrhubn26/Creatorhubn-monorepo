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
import { apiFetch } from "@/lib/queryClient";

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  org_type: "developer" | "agency" | "customer";
  plan: string;
  owner_user_id: string | null;
  org_number: string | null;
  website: string | null;
  industry: string | null;
  logo_url: string | null;
  member_count: number;
  customer_count: number;
  owner_email: string | null;
  created_at: string;
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
  const [tab, setTab] = useState<"orgs" | "audit">("orgs");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [templates, setTemplates] = useState<SetupTemplate[]>([]);
  const [impersonation, setImpersonation] = useState<ActiveImpersonation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Load org list
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsR, tmplR, impR, auditR] = await Promise.all([
        apiFetch("/api/superadmin/organizations"),
        apiFetch("/api/superadmin/setup-templates"),
        apiFetch("/api/superadmin/active-impersonation"),
        apiFetch("/api/superadmin/audit-log?limit=50"),
      ]);
      if (orgsR.status === 403) { setAccessDenied(true); setLoading(false); return; }
      const orgsData = await orgsR.json();
      const tmplData = await tmplR.json();
      const impData = await impR.json();
      const auditData = await auditR.json();
      setOrgs(orgsData.organizations ?? []);
      setTemplates(tmplData.templates ?? []);
      setImpersonation(impData.active ?? null);
      setAudit(auditData.entries ?? []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);
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
                <OrgCard key={o.id} org={o} onSwitch={async (reason) => {
                  await apiFetch("/api/superadmin/switch-context", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orgId: o.id, reason }),
                  });
                  load();
                }} />
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

function OrgCard({ org, onSwitch }: { org: Organization; onSwitch: (reason: string) => Promise<void> }) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [switching, setSwitching] = useState(false);

  const typeBadge = org.org_type === "developer"
    ? { color: "#9be15d", icon: <RocketLaunchIcon fontSize="small" />, label: "Developer" }
    : org.org_type === "agency"
      ? { color: "#7ab8ff", icon: <StorefrontIcon fontSize="small" />, label: "Byrå" }
      : { color: "#ffb86b", icon: <BusinessIcon fontSize="small" />, label: "Kunde" };

  return (
    <>
      <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
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
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6">{org.name}</Typography>
                <Chip
                  size="small" icon={typeBadge.icon} label={typeBadge.label}
                  sx={{ bgcolor: typeBadge.color, color: "#0a0e1a", fontWeight: 600 }}
                />
                <Chip size="small" label={org.plan} variant="outlined" sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }} />
              </Stack>
              <Typography variant="caption" color="rgba(255,255,255,0.6)">
                {org.member_count} medlem(mer) · {org.customer_count} kunde(r)
                {org.owner_email && ` · ${org.owner_email}`}
                {org.org_number && ` · org ${org.org_number}`}
              </Typography>
            </Box>
            <Tooltip title="Lån org-kontekst (audit-logget)">
              <Button
                size="small" variant="outlined" startIcon={<SwapHorizIcon />}
                onClick={() => setSwitchOpen(true)}
                sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
              >
                Lån
              </Button>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

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
