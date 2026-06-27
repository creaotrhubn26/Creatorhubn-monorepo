/**
 * EditingPartnersAdminPanel.tsx
 *
 * Admin-panel for redigeringspartnere. Admin godkjenner søknader og bestemmer om
 * søkeren er PROTOTYPE-TESTER (0 % i en periode — prototype-incentivet) eller
 * VANLIG KUNDE (partner-fee). Kan endre type/fee/varighet senere. Filtrerbar på type.
 */

import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Stack, Tabs, Tab, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, RadioGroup, FormControlLabel,
  Radio, TextField, MenuItem, Alert, CircularProgress, Tooltip, Snackbar,
  ThemeProvider, Switch,
} from "@mui/material";
import { adminDarkTheme } from "./adminDarkTheme";
import ScienceIcon from "@mui/icons-material/Science";
import StorefrontIcon from "@mui/icons-material/Storefront";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { apiRequest } from "@/lib/queryClient";
import PrototypeTeamsOverview from "./PrototypeTeamsOverview";
import { AdminCard, AdminButton, StatusChip, adminTokens } from "./design-system";

interface PartnerApp {
  id: string; company_name: string; contact_name: string; contact_email: string;
  country: string | null; is_foreign: boolean; services: string[] | null;
  pricing_model: string | null; currency: string | null; price_range: string | null;
  portfolio_url: string | null; website: string | null; status: string; created_at: string;
}
interface Vendor {
  user_id: string; vendor_name: string; email: string | null; country: string | null;
  is_foreign: boolean; approval_status: string; partner_type: string | null;
  prototype_until: string | null; platform_fee_bps: number | null;
  rating: number | null; review_count: number | null; quality_flagged: boolean; approved_at: string | null;
}

// Avledet visnings-type for en vendor (prototype aktiv? utløpt? standard? uavklart?)
function vendorTypeLabel(v: Vendor): { label: string; tone: "info" | "success" | "warning" | "neutral"; icon?: React.ReactNode } {
  if (v.partner_type === "prototype") {
    const active = !v.prototype_until || new Date(v.prototype_until) > new Date();
    return active
      ? { label: v.prototype_until ? `Prototype t.o.m. ${new Date(v.prototype_until).toLocaleDateString("nb-NO")}` : "Prototype (ubegrenset)", tone: "info", icon: <ScienceIcon sx={{ fontSize: 15 }} /> }
      : { label: "Prototype utløpt → fee aktiv", tone: "warning", icon: <ScienceIcon sx={{ fontSize: 15 }} /> };
  }
  if (v.partner_type === "standard") return { label: `Vanlig kunde · ${((v.platform_fee_bps ?? 1500) / 100).toFixed(0)}% fee`, tone: "success", icon: <StorefrontIcon sx={{ fontSize: 15 }} /> };
  return { label: "Uavklart", tone: "neutral" };
}

type DecisionTarget = { kind: "app"; app: PartnerApp } | { kind: "vendor"; vendor: Vendor };

// E-postrapport om prototype-testernes fremdrift — konfigurerbar mottaker + på/av
// + «Send nå». Vises i Prototype-testere-fanen.
function PrototypeReportSettings() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [snack, setSnack] = useState("");
  const settings = useQuery<{ recipientEmail: string; enabled: boolean }>({
    queryKey: ["/api/superadmin/prototype-report/settings"],
    queryFn: () => apiRequest("/api/superadmin/prototype-report/settings"),
  });
  useEffect(() => {
    if (settings.data) {
      setEmail(settings.data.recipientEmail);
      setEnabled(settings.data.enabled);
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      apiRequest("/api/superadmin/prototype-report/settings", {
        method: "PUT",
        body: { recipientEmail: email, enabled },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/superadmin/prototype-report/settings"] });
      setSnack("Lagret.");
    },
    onError: () => setSnack("Kunne ikke lagre."),
  });
  const sendNow = useMutation({
    mutationFn: () => apiRequest("/api/superadmin/prototype-report/send-now", { method: "POST" }),
    onSuccess: (r: any) =>
      setSnack(r?.sent ? `Rapport sendt til ${r.recipient} (${r.testerCount} testere).` : "Rapporten er avskrudd."),
    onError: () => setSnack("Kunne ikke sende."),
  });
  return (
    <AdminCard
      title="📧 Fremdriftsrapport på e-post"
      subtitle="Oppsummering av prototype-testernes aktivitet (innlogging, hendelser, feedback, oppdrag) på e-post. Endre mottaker eller skru av når som helst. «Send nå» sender en med en gang."
      sx={{ bgcolor: adminTokens.color.brandSubtle }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <TextField
          size="small"
          label="Mottaker-e-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ flex: 1, minWidth: 240 }}
        />
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
          label="På"
        />
        <AdminButton tone="primary" size="small" loading={save.isPending} onClick={() => save.mutate()}>
          Lagre
        </AdminButton>
        <AdminButton tone="secondary" size="small" loading={sendNow.isPending} onClick={() => sendNow.mutate()}>
          Send nå
        </AdminButton>
      </Stack>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")} message={snack} />
    </AdminCard>
  );
}

export default function EditingPartnersAdminPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState(0); // 0 søknader, 1 prototype, 2 vanlige, 3 alle
  const [target, setTarget] = useState<DecisionTarget | null>(null);

  const apps = useQuery<{ applications: PartnerApp[] }>({
    queryKey: ["/api/superadmin/editing-partner-applications"],
    queryFn: () => apiRequest("/api/superadmin/editing-partner-applications"),
  });
  const vendors = useQuery<{ vendors: Vendor[] }>({
    queryKey: ["/api/superadmin/editing/vendors"],
    queryFn: () => apiRequest("/api/superadmin/editing/vendors"),
  });

  // Prototype-tester-ansvar: hvem har (ikke) gitt tilbakemelding nylig.
  type ProtoFeedback = {
    userId: string; lastFeedbackAt: string | null; daysSince: number | null;
    everGiven: boolean; escalation: "ok" | "due" | "warning"; feedbackCount: number;
    activity?: { lastActiveAt: string | null; events7d: number; errors7d: number; surfaces: string[] } | null;
  };
  const protoFeedback = useQuery<{ vendors: ProtoFeedback[]; overdueCount: number; thresholds: { overdueDays: number; warnDays: number } }>({
    queryKey: ["/api/superadmin/editing/prototype-feedback"],
    queryFn: () => apiRequest("/api/superadmin/editing/prototype-feedback"),
  });
  const feedbackByUser = new Map<string, ProtoFeedback>(
    (Array.isArray(protoFeedback.data?.vendors) ? protoFeedback.data.vendors : []).map((f) => [f.userId, f]),
  );

  const applicationsList = Array.isArray(apps.data?.applications) ? apps.data.applications : [];
  const pending = applicationsList.filter((a) => a.status === "pending" || a.status === "reviewing");
  const leads = applicationsList.filter((a) => a.status === "lead");
  const allVendors = Array.isArray(vendors.data?.vendors) ? vendors.data.vendors : [];
  const prototypeVendors = allVendors.filter((v) => v.partner_type === "prototype");
  const standardVendors = allVendors.filter((v) => v.partner_type === "standard");

  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [snack, setSnack] = useState("");

  const reject = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/superadmin/editing-partner-applications/${id}/reject`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/superadmin/editing-partner-applications"] }),
  });
  const invite = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/superadmin/editing-partner-applications/${id}/invite`, { method: "POST" }),
    onSuccess: () => setSnack("Invitasjon sendt — prospektet søker selv."),
    onError: () => setSnack("Kunne ikke sende invitasjon."),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/superadmin/editing-partner-applications"] });
    qc.invalidateQueries({ queryKey: ["/api/superadmin/editing/vendors"] });
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Redigeringspartnere</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 620 }}>
            Legg inn prospekter som leads og inviter dem til å søke selv (de bestemmer + samtykker). Godkjenn søknader som prototype-tester (0 % i en periode) eller vanlig kunde (fee). Endre type/varighet/fee når som helst.
          </Typography>
        </Box>
        <AdminButton tone="secondary" size="small" onClick={() => setAddLeadOpen(true)}>+ Legg til lead</AdminButton>
      </Stack>

      <Tabs value={filter} onChange={(_, v) => setFilter(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab label={`Søknader (${pending.length})`} />
        <Tab label={`Leads (${leads.length})`} />
        <Tab label={`Prototype-testere (${prototypeVendors.length})`} />
        <Tab label={`Vanlige kunder (${standardVendors.length})`} />
        <Tab label={`Alle vendors (${allVendors.length})`} />
      </Tabs>

      {(apps.isLoading || vendors.isLoading) && <CircularProgress size={22} />}

      {/* Søknader */}
      {filter === 0 && (
        <Stack spacing={1.5}>
          {pending.length === 0 && <Typography color="text.secondary">Ingen nye søknader.</Typography>}
          {pending.map((a) => (
            <AdminCard key={a.id}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{a.company_name} {a.is_foreign && <StatusChip tone="neutral" label={a.country || "Utland"} sx={{ ml: 1 }} />}</Typography>
                  <Typography variant="body2" color="text.secondary">{a.contact_name} · {a.contact_email}</Typography>
                  {a.services?.length ? <Typography variant="caption" color="text.secondary">Tjenester: {a.services.join(", ")}</Typography> : null}
                  {a.price_range && <Typography variant="caption" display="block" color="text.secondary">Pris: {a.price_range} {a.currency}</Typography>}
                  {a.portfolio_url && <Typography variant="caption" display="block"><a href={a.portfolio_url} target="_blank" rel="noopener">Portfolio</a>{a.website && <> · <a href={a.website} target="_blank" rel="noopener">Nettside</a></>}</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <AdminButton tone="primary" size="small" onClick={() => setTarget({ kind: "app", app: a })}>Godkjenn…</AdminButton>
                  <AdminButton tone="danger" size="small" loading={reject.isPending} onClick={() => { if (confirm(`Avvis søknaden fra ${a.company_name}?`)) reject.mutate(a.id); }}>Avvis</AdminButton>
                </Stack>
              </Stack>
            </AdminCard>
          ))}
        </Stack>
      )}

      {/* Leads — inviter til å søke selv */}
      {filter === 1 && (
        <Stack spacing={1.5}>
          {leads.length === 0 && <Typography color="text.secondary">Ingen leads. Bruk «+ Legg til lead» for å registrere et prospekt.</Typography>}
          {leads.map((a) => (
            <AdminCard key={a.id}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{a.company_name} {a.is_foreign && <StatusChip tone="neutral" label={a.country || "Utland"} sx={{ ml: 1 }} />}</Typography>
                  <Typography variant="body2" color="text.secondary">{a.contact_email}</Typography>
                  <StatusChip tone="info" label="Lead — har ikke søkt selv ennå" sx={{ mt: 0.6 }} />
                </Box>
                <Stack direction="row" spacing={1}>
                  <AdminButton tone="primary" size="small" loading={invite.isPending} onClick={() => invite.mutate(a.id)}>Inviter til å søke</AdminButton>
                  <AdminButton tone="secondary" size="small" onClick={() => setTarget({ kind: "app", app: a })}>Godkjenn likevel…</AdminButton>
                </Stack>
              </Stack>
            </AdminCard>
          ))}
        </Stack>
      )}

      {/* Vendor-lister */}
      {filter > 1 && (
        <Stack spacing={1.5}>
          {filter === 2 && <PrototypeReportSettings />}
          {filter === 2 && <PrototypeTeamsOverview />}
          {filter === 2 && (protoFeedback.data?.overdueCount ?? 0) > 0 && (
            <Alert severity="warning">
              {protoFeedback.data?.overdueCount} prototype-tester(e) har ikke gitt tilbakemelding på en stund
              (terskel {protoFeedback.data?.thresholds?.overdueDays ?? 30} dager). Prototype-avtalen (0 % gebyr)
              forutsetter jevnlig tilbakemelding — de får påminnelse i dashbordet + på e-post; vurder å trekke
              prototype-statusen via «Endre type» ved vedvarende stillhet.
            </Alert>
          )}
          {(filter === 2 ? prototypeVendors : filter === 3 ? standardVendors : allVendors).map((v) => {
            const tl = vendorTypeLabel(v);
            const fb = feedbackByUser.get(v.user_id);
            return (
              <AdminCard key={v.user_id}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {v.vendor_name}
                      {v.quality_flagged && <Tooltip title="Kvalitetsflagget (klager)"><WarningAmberIcon sx={{ fontSize: 17, color: "warning.main", ml: 1, verticalAlign: "middle" }} /></Tooltip>}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{v.email} · {v.country || "—"}{v.is_foreign ? " (utland)" : ""}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.6 }} alignItems="center">
                      <StatusChip tone={tl.tone} icon={tl.icon as React.ReactElement | undefined} label={tl.label} />
                      {v.partner_type === "prototype" && fb ? (
                        <StatusChip
                          tone={fb.escalation === "warning" ? "error" : fb.escalation === "due" ? "warning" : "success"}
                          label={fb.everGiven ? `Tilbakemelding: ${fb.daysSince}d siden` : "Ingen tilbakemelding"}
                        />
                      ) : null}
                      {v.partner_type === "prototype" && fb?.activity ? (
                        <StatusChip
                          tone={fb.activity.errors7d > 0 ? "warning" : "neutral"}
                          label={
                            fb.activity.lastActiveAt
                              ? `Aktiv: ${Math.max(0, Math.floor((Date.now() - new Date(fb.activity.lastActiveAt).getTime()) / 86400000))}d siden · ${fb.activity.events7d} hendelser/7d${fb.activity.errors7d ? ` · ${fb.activity.errors7d} feil` : ""}`
                              : "Ikke aktiv ennå"
                          }
                        />
                      ) : null}
                      {v.review_count ? <Typography variant="caption" color="text.secondary">★ {Number(v.rating).toFixed(1)} ({v.review_count})</Typography> : null}
                    </Stack>
                  </Box>
                  <AdminButton tone="secondary" size="small" onClick={() => setTarget({ kind: "vendor", vendor: v })}>Endre type</AdminButton>
                </Stack>
              </AdminCard>
            );
          })}
          {(filter === 2 ? prototypeVendors : filter === 3 ? standardVendors : allVendors).length === 0 && <Typography color="text.secondary">Ingen i denne kategorien.</Typography>}
        </Stack>
      )}

      {target && <DecisionDialog target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); refresh(); }} />}
      {addLeadOpen && <AddLeadDialog onClose={() => setAddLeadOpen(false)} onDone={() => { setAddLeadOpen(false); refresh(); setSnack("Lead lagt til."); }} />}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")} message={snack} />
    </Box>
    </ThemeProvider>
  );
}

// ── Legg til en lead (prospekt) ──
function AddLeadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("NO");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const save = useMutation({
    mutationFn: () => {
      if (!companyName.trim() || !email.includes("@")) throw new Error("req");
      return apiRequest("/api/superadmin/editing-partner-applications/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, email, country, notes }),
      });
    },
    onSuccess: onDone,
    onError: (e: unknown) => setErr((e as Error)?.message === "req" ? "Fyll ut firma + e-post." : "Noe gikk galt."),
  });
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Legg til lead</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">Registrer et prospekt (uten samtykke). Inviter dem deretter til å søke selv.</Typography>
          <TextField label="Firmanavn" value={companyName} onChange={(e) => setCompanyName(e.target.value)} fullWidth />
          <TextField label="E-post" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField label="Land (ISO-2)" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} sx={{ maxWidth: 160 }} />
          <TextField label="Notat (valgfritt)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={onClose}>Avbryt</AdminButton>
        <AdminButton tone="primary" onClick={() => save.mutate()} loading={save.isPending}>Legg til</AdminButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Beslutnings-dialog: prototype-tester vs. vanlig kunde + varighet/fee ──
function DecisionDialog({ target, onClose, onDone }: { target: DecisionTarget; onClose: () => void; onDone: () => void }) {
  const existing = target.kind === "vendor" ? target.vendor : null;
  const [partnerType, setPartnerType] = useState<"prototype" | "standard">(existing?.partner_type === "standard" ? "standard" : "prototype");
  const [prototypeMonths, setPrototypeMonths] = useState<string>("6");
  const [customUntil, setCustomUntil] = useState<string>("");
  const [feePct, setFeePct] = useState<string>(existing?.platform_fee_bps != null ? String(existing.platform_fee_bps / 100) : "15");
  const [err, setErr] = useState("");

  const companyName = target.kind === "app" ? target.app.company_name : target.vendor.vendor_name;

  const body = useMemo(() => {
    const b: Record<string, unknown> = { partnerType, platformFeeBps: Math.max(0, Math.round(Number(feePct) * 100)) };
    if (partnerType === "prototype") {
      if (customUntil) b.prototypeUntil = customUntil;
      else if (prototypeMonths !== "0") b.prototypeMonths = Number(prototypeMonths);
    }
    return b;
  }, [partnerType, feePct, customUntil, prototypeMonths]);

  const submit = useMutation({
    mutationFn: () => target.kind === "app"
      ? apiRequest(`/api/superadmin/editing-partner-applications/${target.app.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : apiRequest(`/api/superadmin/editing/vendors/${target.vendor.user_id}/partner-type`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: onDone,
    onError: () => setErr("Noe gikk galt. Prøv igjen."),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{target.kind === "app" ? `Godkjenn ${companyName}` : `Endre type — ${companyName}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <RadioGroup value={partnerType} onChange={(e) => setPartnerType(e.target.value as "prototype" | "standard")}>
            <FormControlLabel value="prototype" control={<Radio />} label={
              <Box><Typography sx={{ fontWeight: 600 }}>Prototype-tester — 0 % i en periode</Typography>
              <Typography variant="caption" color="text.secondary">Gratis i prototype-perioden; faller tilbake til fee etter utløp.</Typography></Box>
            } />
            <FormControlLabel value="standard" control={<Radio />} label={
              <Box><Typography sx={{ fontWeight: 600 }}>Vanlig kunde — partner-fee</Typography>
              <Typography variant="caption" color="text.secondary">Plattform-gebyr fra første oppdrag.</Typography></Box>
            } />
          </RadioGroup>
          <Divider />
          {partnerType === "prototype" && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select label="Varighet" value={customUntil ? "custom" : prototypeMonths} onChange={(e) => { if (e.target.value === "custom") { setCustomUntil(new Date().toISOString().slice(0, 10)); } else { setCustomUntil(""); setPrototypeMonths(e.target.value); } }} sx={{ flex: 1 }}>
                <MenuItem value="3">3 måneder</MenuItem>
                <MenuItem value="6">6 måneder</MenuItem>
                <MenuItem value="12">12 måneder</MenuItem>
                <MenuItem value="0">Ubegrenset</MenuItem>
                <MenuItem value="custom">Egen dato…</MenuItem>
              </TextField>
              {customUntil && <TextField type="date" label="T.o.m." value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />}
            </Stack>
          )}
          <TextField type="number" label={partnerType === "prototype" ? "Fee etter prototype (%)" : "Partner-fee (%)"} value={feePct} onChange={(e) => setFeePct(e.target.value)} inputProps={{ min: 0, max: 100, step: 0.5 }} sx={{ maxWidth: 240 }} />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={onClose}>Avbryt</AdminButton>
        <AdminButton tone="primary" onClick={() => submit.mutate()} loading={submit.isPending}>
          {target.kind === "app" ? "Godkjenn + send lenke" : "Lagre"}
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
}
