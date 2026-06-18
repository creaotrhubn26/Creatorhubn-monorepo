/**
 * PartnersTab.tsx
 *
 * Superadmin-UI for partnere:
 *   - Aktive partnere (vises på landing) — toggle/edit/revoke
 *   - Søknads-innboks — godkjenn/avslå
 *   - "Inviter org som partner" — fra eksisterende org
 *   - Send intensjonsavtale fra template
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Stack, Typography, Button, IconButton, Tooltip, Chip, Avatar,
  Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Alert, Divider,
  Snackbar, CircularProgress, Tabs, Tab, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import GavelIcon from "@mui/icons-material/Gavel";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import StorefrontIcon from "@mui/icons-material/Storefront";
import BusinessIcon from "@mui/icons-material/Business";
import HubIcon from "@mui/icons-material/Hub";
import StarIcon from "@mui/icons-material/Star";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { apiFetch } from "@/lib/queryClient";
import AdminPartnerReviewModal from "./AdminPartnerReviewModal";

interface Partner {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  tagline: string | null;
  partner_type: string;
  organization_id: string | null;
  org_name: string | null;
  is_active: boolean;
  show_on_landing: boolean;
  status: string;
  display_order: number;
  approved_at: string | null;
  created_at: string;
}

interface Application {
  id: string;
  organization_id: string;
  org_name: string;
  org_type: string;
  plan: string;
  org_logo_url: string | null;
  org_website: string | null;
  partner_type: string;
  proposed_logo_url: string | null;
  proposed_tagline: string | null;
  reason: string | null;
  status: string;
  origin: string;
  applicant_email: string | null;
  terms_version: string | null;
  consent_at: string | null;
  created_at: string;
}

interface Intent {
  id: string;
  title: string;
  status: string;
  sent_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  partner_type: string | null;
  signer_email: string;
  signer_name: string | null;
  org_name: string;
  commission_pct: number | null;
  discount_pct: number | null;
}

export default function PartnersTab() {
  const [subtab, setSubtab] = useState<"active" | "applications" | "intents">("active");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sendIntentOpen, setSendIntentOpen] = useState(false);
  const [sendIntentTarget, setSendIntentTarget] = useState<{
    organizationId: string; orgName: string; partnerType?: string; partnerId?: string;
    applicationId?: string;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, i] = await Promise.all([
        apiFetch("/api/superadmin/partners"),
        apiFetch("/api/superadmin/partner-applications?status=pending"),
        apiFetch("/api/superadmin/partner-intents"),
      ]);
      if (p.ok) setPartners((await p.json()).partners ?? []);
      if (a.ok) setApplications((await a.json()).applications ?? []);
      if (i.ok) setIntents((await i.json()).intents ?? []);
    } catch (e) { setSnackbar({ msg: String(e), severity: "error" }); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approveApp = async (id: string, notes: string) => {
    const r = await apiFetch(`/api/superadmin/partner-applications/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const d = await r.json();
    if (r.ok) {
      setSnackbar({
        msg: `Godkjent! ${d.plan_upgraded ? "Plan oppgradert. " : ""}${d.api_access_granted ? "API-tilgang gitt." : ""}`,
        severity: "success",
      });
      load();
    } else {
      setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
    }
  };

  const rejectApp = async (id: string, reason: string) => {
    const r = await apiFetch(`/api/superadmin/partner-applications/${id}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (r.ok) { setSnackbar({ msg: "Avslått", severity: "success" }); load(); }
  };

  const togglePartnerLanding = async (p: Partner) => {
    const r = await apiFetch(`/api/superadmin/partners/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_on_landing: !p.show_on_landing }),
    });
    if (r.ok) { load(); }
  };

  const revokePartner = async (p: Partner) => {
    if (!window.confirm(`Tilbakekall ${p.name} som partner?`)) return;
    const r = await apiFetch(`/api/superadmin/partners/${p.id}/revoke`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Tilbakekalt av superadmin" }),
    });
    if (r.ok) { setSnackbar({ msg: "Partnerskap tilbakekalt", severity: "success" }); load(); }
  };

  return (
    <Box>
      {/* Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        {[
          { label: "Aktive partnere", value: partners.filter((p) => p.is_active && p.status === "approved").length, color: "#9be15d" },
          { label: "Synlige på landing", value: partners.filter((p) => p.show_on_landing && p.is_active).length, color: "#a78bfa" },
          { label: "Pending søknader", value: applications.length, color: "#ffb86b" },
          { label: "Intent-avtaler ute", value: intents.filter((i) => i.status === "sent" || i.status === "viewed").length, color: "#7ab8ff" },
          { label: "Signerte intent", value: intents.filter((i) => i.status === "signed").length, color: "#f472b6" },
        ].map((k) => (
          <Card key={k.label} sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{k.label}</Typography>
              <Typography variant="h5" sx={{ color: k.color, fontWeight: 700 }}>{k.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Tabs value={subtab} onChange={(_, v) => setSubtab(v)}
              sx={{ "& .MuiTab-root": { color: "rgba(255,255,255,0.7)", textTransform: "none" } }}>
          <Tab label={`Aktive (${partners.filter((p) => p.is_active).length})`} value="active" />
          <Tab label={`Søknader (${applications.length})`} value="applications" />
          <Tab label={`Avtaler (${intents.length})`} value="intents" />
        </Tabs>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}
                sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}>
          Inviter org
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : subtab === "active" ? (
        <ActivePartnersList partners={partners}
                            onToggleLanding={togglePartnerLanding}
                            onRevoke={revokePartner}
                            onSendIntent={(p) => {
                              setSendIntentTarget({
                                organizationId: p.organization_id!,
                                orgName: p.name,
                                partnerType: p.partner_type,
                                partnerId: p.id,
                              });
                              setSendIntentOpen(true);
                            }} />
      ) : subtab === "applications" ? (
        <ApplicationsList applications={applications}
                          onApprove={approveApp}
                          onReject={rejectApp}
                          onSendIntent={(a) => {
                            setSendIntentTarget({
                              organizationId: a.organization_id,
                              orgName: a.org_name,
                              partnerType: a.partner_type,
                              applicationId: a.id,
                            });
                            setSendIntentOpen(true);
                          }} />
      ) : (
        <IntentsList intents={intents} />
      )}

      <InviteOrgDialog
        open={inviteOpen} onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); load(); setSnackbar({ msg: "Invitasjon sendt", severity: "success" }); }}
        onError={(msg) => setSnackbar({ msg, severity: "error" })}
      />

      {sendIntentTarget && (
        <SendIntentDialog
          open={sendIntentOpen} onClose={() => setSendIntentOpen(false)}
          target={sendIntentTarget}
          onSent={() => { setSendIntentOpen(false); load(); setSnackbar({ msg: "Intent-avtale sendt", severity: "success" }); }}
          onError={(msg) => setSnackbar({ msg, severity: "error" })}
        />
      )}

      <Snackbar
        open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
      />
    </Box>
  );
}

function partnerTypeBadge(type: string) {
  switch (type) {
    case "customer":    return { icon: <BusinessIcon fontSize="small" />, color: "#ffb86b", label: "Customer" };
    case "reseller":    return { icon: <StorefrontIcon fontSize="small" />, color: "#7ab8ff", label: "Reseller" };
    case "integration": return { icon: <HubIcon fontSize="small" />, color: "#9be15d", label: "Integration" };
    case "strategic":   return { icon: <StarIcon fontSize="small" />, color: "#a78bfa", label: "Strategic" };
    default:            return { icon: <BusinessIcon fontSize="small" />, color: "#888", label: type };
  }
}

// ---------------------------------------------------------------------------
// Active partners
// ---------------------------------------------------------------------------

function ActivePartnersList({
  partners, onToggleLanding, onRevoke, onSendIntent,
}: {
  partners: Partner[];
  onToggleLanding: (p: Partner) => void;
  onRevoke: (p: Partner) => void;
  onSendIntent: (p: Partner) => void;
}) {
  if (partners.length === 0) {
    return (
      <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="h6" color="rgba(255,255,255,0.7)">Ingen partnere ennå</Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.4)" mt={1}>
            Klikk "Inviter org" eller godkjenn en pending søknad.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Stack spacing={1.5}>
      {partners.map((p) => {
        const badge = partnerTypeBadge(p.partner_type);
        return (
          <Card key={p.id} sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                {p.logo_url ? (
                  <Box component="img" src={p.logo_url} alt={p.name}
                       sx={{ width: 48, height: 48, borderRadius: 1, objectFit: "contain", bgcolor: "#fff", p: 0.5 }} />
                ) : (
                  <Avatar sx={{ bgcolor: badge.color, color: "#0a0e1a", fontWeight: 700 }}>
                    {p.name.substring(0, 2).toUpperCase()}
                  </Avatar>
                )}
                <Box flex={1}>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography variant="h6">{p.name}</Typography>
                    <Chip size="small" icon={badge.icon} label={badge.label}
                          sx={{ bgcolor: badge.color, color: "#0a0e1a", fontWeight: 600 }} />
                    <Chip size="small" label={p.status}
                          sx={{
                            bgcolor: p.status === "approved" ? "#9be15d" : "rgba(255,107,107,0.2)",
                            color: p.status === "approved" ? "#0a0e1a" : "#ff6b6b",
                            fontWeight: 600,
                          }} />
                    {!p.show_on_landing && <Chip size="small" label="skjult" icon={<VisibilityOffIcon fontSize="small" />}
                          sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }} />}
                  </Stack>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                    {p.tagline ? p.tagline + " · " : ""}{p.website ? p.website + " · " : ""}{p.org_name ?? "(ingen org-knytting)"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title={p.show_on_landing ? "Skjul fra landing" : "Vis på landing"}>
                    <IconButton onClick={() => onToggleLanding(p)} sx={{ color: p.show_on_landing ? "#9be15d" : "rgba(255,255,255,0.5)" }}>
                      {p.show_on_landing ? <VisibilityIcon /> : <VisibilityOffIcon />}
                    </IconButton>
                  </Tooltip>
                  {p.organization_id && (
                    <Tooltip title="Send intensjonsavtale">
                      <IconButton onClick={() => onSendIntent(p)} sx={{ color: "#a78bfa" }}>
                        <GavelIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Tilbakekall partnerskap">
                    <IconButton onClick={() => onRevoke(p)} sx={{ color: "rgba(255,107,107,0.7)" }}>
                      <RemoveCircleOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

function ApplicationsList({
  applications, onApprove, onReject, onSendIntent,
}: {
  applications: Application[];
  onApprove: (id: string, notes: string) => void;
  onReject: (id: string, reason: string) => void;
  onSendIntent: (a: Application) => void;
}) {
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [deepReviewId, setDeepReviewId] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");

  if (applications.length === 0) {
    return (
      <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="h6" color="rgba(255,255,255,0.7)">Innboksen er tom</Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.4)" mt={1}>
            Pending partner-søknader vil dukke opp her.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <Stack spacing={1.5}>
        {applications.map((a) => {
          const badge = partnerTypeBadge(a.partner_type);
          return (
            <Card key={a.id} sx={{ bgcolor: "rgba(255,255,255,0.05)", color: "#fff", borderLeft: `4px solid ${badge.color}` }}>
              <CardContent>
                <Stack direction="row" spacing={2}>
                  <Box flex={1}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" mb={1}>
                      <Typography variant="h6">{a.org_name}</Typography>
                      <Chip size="small" icon={badge.icon} label={badge.label}
                            sx={{ bgcolor: badge.color, color: "#0a0e1a", fontWeight: 600 }} />
                      <Chip size="small" label={a.origin}
                            sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }} />
                      {a.consent_at && (
                        <Chip size="small" icon={<CheckIcon fontSize="small" />} label={`vilkår signert ${new Date(a.consent_at).toLocaleDateString("no-NO")}`}
                              sx={{ bgcolor: "rgba(155,225,93,0.15)", color: "#9be15d" }} />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block", mb: 1 }}>
                      {a.applicant_email} · {a.org_type} · {a.plan} · søknad fra {new Date(a.created_at).toLocaleDateString("no-NO")}
                    </Typography>
                    {a.proposed_tagline && (
                      <Typography variant="body2" sx={{ mb: 1, fontStyle: "italic" }}>«{a.proposed_tagline}»</Typography>
                    )}
                    {a.reason && (
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)" }}>
                        {a.reason}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="column" spacing={1}>
                    <Button size="small" variant="contained"
                            onClick={() => setDeepReviewId(a.id)}
                            sx={{ bgcolor: "#a78bfa", color: "#0a0e1a", "&:hover": { bgcolor: "#9171e6" } }}>
                      Deep review
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<CheckIcon />}
                            onClick={() => { setReviewing(a); setAction("approve"); setNotes(""); }}
                            sx={{ color: "#9be15d", borderColor: "rgba(155,225,93,0.4)" }}>
                      Quick godkjenn
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<GavelIcon />}
                            onClick={() => onSendIntent(a)}
                            sx={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.4)" }}>
                      Send intent
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<CloseIcon />}
                            onClick={() => { setReviewing(a); setAction("reject"); setNotes(""); }}
                            sx={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.4)" }}>
                      Avslå
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} maxWidth="sm" fullWidth
              PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
        <DialogTitle>
          {action === "approve" ? "Godkjenn" : "Avslå"} {reviewing?.org_name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {action === "approve" && (
              <Alert severity="success">
                Ved godkjenning:
                <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                  <li>Org får automatisk plan-oppgradering basert på partner-type</li>
                  <li>Logo vises på theroleroom.com/leadgrid</li>
                  <li>Bekreftelses-mail sendes til org-eier</li>
                </ul>
              </Alert>
            )}
            <TextField fullWidth multiline rows={3}
                       label={action === "approve" ? "Interne notater (valgfritt)" : "Begrunnelse (kreves)"}
                       value={notes} onChange={(e) => setNotes(e.target.value)}
                       sx={{
                         "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
                         "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                       }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)}>Avbryt</Button>
          <Button variant="contained"
                  disabled={action === "reject" && !notes}
                  onClick={() => {
                    if (action === "approve") onApprove(reviewing!.id, notes);
                    else onReject(reviewing!.id, notes);
                    setReviewing(null);
                  }}
                  sx={{
                    bgcolor: action === "approve" ? "#9be15d" : "#ff6b6b",
                    color: "#0a0e1a", fontWeight: 700,
                  }}>
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      {deepReviewId && (
        <AdminPartnerReviewModal
          applicationId={deepReviewId}
          onClose={() => setDeepReviewId(null)}
          onUpdated={() => { /* PartnersTab re-loader på neste interaksjon */ }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

function IntentsList({ intents }: { intents: Intent[] }) {
  if (intents.length === 0) {
    return (
      <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="h6" color="rgba(255,255,255,0.7)">Ingen avtaler ennå</Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Stack spacing={1}>
      {intents.map((i) => {
        const statusColor = i.status === "signed" ? "#9be15d"
                         : i.status === "viewed" ? "#7ab8ff"
                         : i.status === "rejected" ? "#ff6b6b"
                         : i.status === "expired" || i.status === "revoked" ? "rgba(255,255,255,0.4)"
                         : "#ffb86b";
        return (
          <Card key={i.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box flex={1}>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography variant="subtitle1">{i.title}</Typography>
                    <Chip size="small" label={i.status}
                          sx={{ bgcolor: statusColor, color: "#0a0e1a", fontWeight: 600 }} />
                    {i.commission_pct != null && (
                      <Chip size="small" label={`${i.commission_pct}% kom`} variant="outlined"
                            sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }} />
                    )}
                  </Stack>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                    {i.org_name} → {i.signer_email}
                    {i.sent_at && ` · sendt ${new Date(i.sent_at).toLocaleDateString("no-NO")}`}
                    {i.signed_at && ` · signert ${new Date(i.signed_at).toLocaleDateString("no-NO")}`}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Invite Org Dialog (fra eksisterende org-liste)
// ---------------------------------------------------------------------------

function InviteOrgDialog({
  open, onClose, onInvited, onError,
}: {
  open: boolean; onClose: () => void; onInvited: () => void; onError: (msg: string) => void;
}) {
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; org_type: string; plan: string }>>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [partnerType, setPartnerType] = useState("customer");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch("/api/superadmin/organizations").then((r) => r.ok ? r.json() : { organizations: [] })
      .then((d) => setOrgs(d.organizations ?? []));
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/superadmin/partner-applications/invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, partnerType, message: message || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error ?? "Feil"); setSubmitting(false); return; }
      setOrganizationId(""); setMessage("");
      onInvited();
    } catch (e: any) { onError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Inviter org til partnerskap</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Organisasjon</InputLabel>
            <Select value={organizationId} label="Organisasjon"
                    onChange={(e) => setOrganizationId(e.target.value)}
                    sx={{ color: "#fff" }}>
              {orgs.map((o) => (
                <MenuItem key={o.id} value={o.id}>{o.name} ({o.org_type} · {o.plan})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth required>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Partner-type</InputLabel>
            <Select value={partnerType} label="Partner-type"
                    onChange={(e) => setPartnerType(e.target.value)}
                    sx={{ color: "#fff" }}>
              <MenuItem value="customer">Customer — Solo Pro + 2x kvoter</MenuItem>
              <MenuItem value="reseller">Reseller — Agency + 10% kom + 20% rabatt</MenuItem>
              <MenuItem value="integration">Integration — API-tilgang</MenuItem>
              <MenuItem value="strategic">Strategic — Enterprise + API</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth multiline rows={3} label="Personlig melding (valgfritt)"
                     value={message} onChange={(e) => setMessage(e.target.value)}
                     sx={{
                       "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
                       "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
                     }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" disabled={!organizationId || submitting} onClick={submit}
                sx={{ bgcolor: "#9be15d", color: "#0a0e1a", fontWeight: 700 }}>
          {submitting ? "Sender…" : "Send invitasjon"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Send Intent Dialog (velger template + preview + send)
// ---------------------------------------------------------------------------

function SendIntentDialog({
  open, onClose, target, onSent, onError,
}: {
  open: boolean; onClose: () => void;
  target: { organizationId: string; orgName: string; partnerType?: string; partnerId?: string; applicationId?: string };
  onSent: () => void; onError: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerName, setSignerName] = useState("");
  const [commissionPct, setCommissionPct] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState<number | null>(null);
  const [noticeDays, setNoticeDays] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ title: string; body_md: string; org: { contact_email: string | null } } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch("/api/superadmin/partner-intent-templates").then((r) => r.ok ? r.json() : { templates: [] })
      .then((d) => {
        const filtered = target.partnerType
          ? d.templates.filter((t: any) => t.partner_type === target.partnerType)
          : d.templates;
        setTemplates(filtered);
        if (filtered.length > 0 && !selectedKey) {
          setSelectedKey(filtered[0].template_key);
          setCommissionPct(filtered[0].default_commission_pct);
          setDiscountPct(filtered[0].default_discount_pct);
          setNoticeDays(filtered[0].default_notice_days);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target.partnerType]);

  const loadPreview = async () => {
    const r = await apiFetch("/api/superadmin/partner-intent-templates/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: selectedKey,
        organizationId: target.organizationId,
        overrides: { commission_pct: commissionPct, discount_pct: discountPct, notice_days: noticeDays },
      }),
    });
    if (r.ok) {
      const d = await r.json();
      setPreview(d);
      if (!signerEmail && d.org?.contact_email) setSignerEmail(d.org.contact_email);
    }
  };

  useEffect(() => {
    if (open && selectedKey) loadPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedKey, commissionPct, discountPct, noticeDays]);

  const submit = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/superadmin/partner-intents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: target.organizationId,
          partnerId: target.partnerId,
          partnerApplicationId: target.applicationId,
          title: preview.title,
          body_md: preview.body_md,
          partnerType: target.partnerType,
          signerEmail, signerName: signerName || undefined,
          commissionPct, discountPct, noticeDays,
          templateVersion: selectedKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error ?? "Feil"); setSubmitting(false); return; }
      onSent();
    } catch (e: any) { onError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  const inputSx = {
    "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Send intensjonsavtale til {target.orgName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {templates.length === 0 ? (
            <Alert severity="warning">
              Ingen aktive avtale-maler funnet for partner-type "{target.partnerType ?? "?"}".
              Gå til Avtaler-tab for å opprette en.
            </Alert>
          ) : (
            <>
              <FormControl fullWidth>
                <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Avtale-mal</InputLabel>
                <Select value={selectedKey} label="Avtale-mal"
                        onChange={(e) => {
                          setSelectedKey(e.target.value);
                          const t = templates.find((t) => t.template_key === e.target.value);
                          if (t) {
                            setCommissionPct(t.default_commission_pct);
                            setDiscountPct(t.default_discount_pct);
                            setNoticeDays(t.default_notice_days);
                          }
                        }}
                        sx={{ color: "#fff" }}>
                  {templates.map((t) => (
                    <MenuItem key={t.template_key} value={t.template_key}>
                      {t.title} ({t.template_key})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction="row" spacing={2}>
                <TextField label="Signer e-post" type="email" value={signerEmail}
                           onChange={(e) => setSignerEmail(e.target.value)} sx={{ flex: 1, ...inputSx }} />
                <TextField label="Signer navn (valgfritt)" value={signerName}
                           onChange={(e) => setSignerName(e.target.value)} sx={{ flex: 1, ...inputSx }} />
              </Stack>

              <Stack direction="row" spacing={2}>
                <TextField label="Kommisjon %" type="number" size="small"
                           value={commissionPct ?? ""}
                           onChange={(e) => setCommissionPct(e.target.value === "" ? null : Number(e.target.value))}
                           sx={{ flex: 1, ...inputSx }} />
                <TextField label="Rabatt %" type="number" size="small"
                           value={discountPct ?? ""}
                           onChange={(e) => setDiscountPct(e.target.value === "" ? null : Number(e.target.value))}
                           sx={{ flex: 1, ...inputSx }} />
                <TextField label="Oppsigelses-dager" type="number" size="small"
                           value={noticeDays ?? ""}
                           onChange={(e) => setNoticeDays(e.target.value === "" ? null : Number(e.target.value))}
                           sx={{ flex: 1, ...inputSx }} />
              </Stack>

              <Button variant="outlined" onClick={() => setShowPreview(!showPreview)}
                      sx={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.4)" }}>
                {showPreview ? "Skjul forhåndsvisning" : "Vis forhåndsvisning"}
              </Button>

              {showPreview && preview && (
                <Box sx={{ p: 3, bgcolor: "#06030c", borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)",
                           maxHeight: 400, overflow: "auto" }}>
                  <Typography variant="h6" mb={1}>{preview.title}</Typography>
                  <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.1)" }} />
                  <Box sx={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.6 }}>
                    {preview.body_md}
                  </Box>
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" disabled={!preview || !signerEmail || submitting} onClick={submit}
                startIcon={<SendIcon />}
                sx={{ bgcolor: "#a78bfa", color: "#0a0e1a", fontWeight: 700 }}>
          {submitting ? "Sender…" : "Send via e-post"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
