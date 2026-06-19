/**
 * ScheduledReportsPanel.tsx
 *
 * Markedssjef setter opp ukentlige/månedlige rapport-abonnement
 * som sendes som PDF på e-post til valgte mottakere.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Switch, FormControlLabel, Snackbar, Alert, Tooltip, Divider, Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EmailIcon from "@mui/icons-material/Email";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

interface ReportSub {
  id: string;
  name: string;
  report_type: "summary" | "leads_list" | "both";
  period_days: number;
  status_filter: string;
  recipient_user_ids: string[];
  recipient_emails: string[];
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  is_active: boolean;
  last_sent_at: string | null;
  last_send_status: string | null;
  last_send_error: string | null;
  next_send_at: string;
}

const DAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function formatNextSend(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("no-NO", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ScheduledReportsPanel() {
  const [items, setItems] = useState<ReportSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReportSub | null>(null);
  const [creating, setCreating] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/leadgrid/scheduled-reports", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const del = async (id: string) => {
    if (!confirm("Slett dette abonnementet?")) return;
    const r = await fetch(`/api/leadgrid/scheduled-reports/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (r.ok) { setSnack({ kind: "ok", msg: "Slettet" }); load(); }
  };

  const sendNow = async (id: string) => {
    const r = await fetch(`/api/leadgrid/scheduled-reports/${id}/send-now`, {
      method: "POST", credentials: "include",
    });
    if (r.ok) {
      setSnack({ kind: "ok", msg: "Rapporten sendes innen 1 time" });
      load();
    }
  };

  const toggle = async (sub: ReportSub) => {
    const r = await fetch(`/api/leadgrid/scheduled-reports/${sub.id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !sub.is_active }),
    });
    if (r.ok) { setSnack({ kind: "ok", msg: sub.is_active ? "Pauset" : "Aktivert" }); load(); }
  };

  return (
    <Card sx={{ bgcolor: "rgba(167,139,250,0.04)",
                 border: "1px solid rgba(167,139,250,0.20)" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" mb={2}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleIcon sx={{ color: "#a78bfa" }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Schedulerte rapporter
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Ukentlig / månedlig PDF på e-post til markedssjefer
            </Typography>
          </Box>
          <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => setCreating(true)}>
            Nytt abonnement
          </Button>
        </Stack>

        {items.length === 0 && !loading ? (
          <Typography variant="body2" color="text.secondary"
                      sx={{ textAlign: "center", py: 3 }}>
            Ingen schedulerte rapporter ennå. Klikk "Nytt abonnement" for å starte.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {items.map((sub) => (
              <Box key={sub.id} sx={{
                p: 2, borderRadius: 1,
                bgcolor: sub.is_active ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.10)",
                border: `1px solid ${sub.is_active ? "rgba(167,139,250,0.30)"
                                                    : "rgba(255,255,255,0.08)"}`,
                opacity: sub.is_active ? 1 : 0.6,
              }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {sub.name}
                      </Typography>
                      <Chip size="small" label={sub.frequency === "weekly" ? "Ukentlig"
                                             : sub.frequency === "monthly" ? "Månedlig"
                                             : "Daglig"}
                            sx={{ fontSize: 10, height: 18 }} />
                      <Chip size="small"
                            label={sub.report_type === "summary" ? "KPI-rapport"
                                  : sub.report_type === "leads_list" ? "Lead-liste (CSV)"
                                  : "KPI + Lead-liste"}
                            color="primary" sx={{ fontSize: 10, height: 18 }} />
                      {sub.last_send_status === "success" && (
                        <Chip size="small" color="success" icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                              label="Sist OK" sx={{ fontSize: 10, height: 18 }} />
                      )}
                      {sub.last_send_status === "failed" && (
                        <Tooltip title={sub.last_send_error ?? ""}>
                          <Chip size="small" color="error" icon={<ErrorIcon sx={{ fontSize: 12 }} />}
                                label="Sist feilet" sx={{ fontSize: 10, height: 18 }} />
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {sub.frequency === "weekly" && sub.day_of_week !== null
                        ? `Hver ${DAYS[sub.day_of_week]} kl ${sub.time_of_day}`
                        : sub.frequency === "monthly" && sub.day_of_month
                        ? `Den ${sub.day_of_month}. i måneden kl ${sub.time_of_day}`
                        : `Daglig kl ${sub.time_of_day}`}
                      {" · "}Siste {sub.period_days} dager
                    </Typography>
                    <Stack direction="row" spacing={2} mt={1}>
                      <Typography variant="caption" sx={{ display: "inline-flex",
                                                            alignItems: "center", gap: 0.5,
                                                            color: "rgba(255,255,255,0.7)" }}>
                        <EmailIcon sx={{ fontSize: 12 }} />
                        {sub.recipient_emails.length + sub.recipient_user_ids.length} mottakere
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Neste: {formatNextSend(sub.next_send_at)}
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Send nå">
                      <IconButton size="small" onClick={() => sendNow(sub.id)}>
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={sub.is_active ? "Paus" : "Aktiver"}>
                      <Switch size="small" checked={sub.is_active}
                              onChange={() => toggle(sub)} />
                    </Tooltip>
                    <Tooltip title="Rediger">
                      <IconButton size="small" onClick={() => setEditing(sub)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Slett">
                      <IconButton size="small" color="error" onClick={() => del(sub.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        {(editing || creating) && (
          <SubscriptionDialog sub={editing}
                              onClose={() => { setEditing(null); setCreating(false); }}
                              onSaved={() => { setEditing(null); setCreating(false); load();
                                                setSnack({ kind: "ok", msg: "Lagret" }); }} />
        )}

        <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}>
          <Alert severity={snack?.kind === "ok" ? "success" : "error"}
                 onClose={() => setSnack(null)}>{snack?.msg}</Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
}

function SubscriptionDialog({ sub, onClose, onSaved }: {
  sub: ReportSub | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: sub?.name ?? "Ukentlig salgs-rapport",
    report_type: sub?.report_type ?? "summary",
    period_days: sub?.period_days ?? 7,
    status_filter: sub?.status_filter ?? "all",
    recipient_emails: sub?.recipient_emails ?? [],
    recipient_user_ids: sub?.recipient_user_ids ?? [],
    frequency: sub?.frequency ?? "weekly",
    day_of_week: sub?.day_of_week ?? 1,
    day_of_month: sub?.day_of_month ?? 1,
    time_of_day: sub?.time_of_day ?? "08:00",
    is_active: sub?.is_active ?? true,
  });
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/leadgrid/assignable-users?role=all", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((d) => setAssignableUsers(d.users ?? []));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const url = sub
        ? `/api/leadgrid/scheduled-reports/${sub.id}`
        : `/api/leadgrid/scheduled-reports`;
      const r = await fetch(url, {
        method: sub ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) onSaved();
    } finally { setSaving(false); }
  };

  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const addEmail = () => {
    if (emailInput && /.+@.+/.test(emailInput)) {
      upd("recipient_emails", [...form.recipient_emails, emailInput]);
      setEmailInput("");
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{sub ? "Rediger abonnement" : "Nytt schedulert rapport-abonnement"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Navn" value={form.name}
                     onChange={(e) => upd("name", e.target.value)}
                     fullWidth size="small" />

          <Stack direction="row" spacing={2}>
            <TextField select label="Type" value={form.report_type}
                       onChange={(e) => upd("report_type", e.target.value)}
                       size="small" sx={{ flex: 1 }}>
              <MenuItem value="summary">KPI-sammendrag (PDF)</MenuItem>
              <MenuItem value="leads_list">Lead-liste (CSV)</MenuItem>
              <MenuItem value="both">Begge — sammendrag + lead-liste</MenuItem>
            </TextField>
            <TextField select label="Periode" value={form.period_days}
                       onChange={(e) => upd("period_days", Number(e.target.value))}
                       size="small" sx={{ flex: 1 }}>
              <MenuItem value={7}>Siste 7 dager</MenuItem>
              <MenuItem value={30}>Siste 30 dager</MenuItem>
              <MenuItem value={90}>Siste 90 dager</MenuItem>
            </TextField>
          </Stack>

          <Divider />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Frekvens</Typography>
          <Stack direction="row" spacing={2}>
            <TextField select label="Hvor ofte" value={form.frequency}
                       onChange={(e) => upd("frequency", e.target.value)}
                       size="small" sx={{ flex: 1 }}>
              <MenuItem value="daily">Daglig</MenuItem>
              <MenuItem value="weekly">Ukentlig</MenuItem>
              <MenuItem value="monthly">Månedlig</MenuItem>
            </TextField>
            {form.frequency === "weekly" && (
              <TextField select label="Ukedag" value={form.day_of_week}
                         onChange={(e) => upd("day_of_week", Number(e.target.value))}
                         size="small" sx={{ flex: 1 }}>
                <MenuItem value={1}>Mandag</MenuItem>
                <MenuItem value={2}>Tirsdag</MenuItem>
                <MenuItem value={3}>Onsdag</MenuItem>
                <MenuItem value={4}>Torsdag</MenuItem>
                <MenuItem value={5}>Fredag</MenuItem>
                <MenuItem value={6}>Lørdag</MenuItem>
                <MenuItem value={0}>Søndag</MenuItem>
              </TextField>
            )}
            {form.frequency === "monthly" && (
              <TextField label="Dag i mnd." type="number" value={form.day_of_month}
                         onChange={(e) => upd("day_of_month", Number(e.target.value))}
                         size="small" sx={{ flex: 1 }}
                         inputProps={{ min: 1, max: 28 }} />
            )}
            <TextField label="Tid" type="time" value={form.time_of_day}
                       onChange={(e) => upd("time_of_day", e.target.value)}
                       size="small" sx={{ flex: 1 }}
                       InputLabelProps={{ shrink: true }} />
          </Stack>

          <Divider />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Mottakere</Typography>

          <Autocomplete multiple options={assignableUsers}
            getOptionLabel={(o) => o.full_name || o.email}
            value={assignableUsers.filter((u) => form.recipient_user_ids.includes(u.user_id))}
            onChange={(_, v) => upd("recipient_user_ids", v.map((u) => u.user_id))}
            renderInput={(p) => <TextField {...p} label="Interne brukere" size="small" />} />

          <Box>
            <Stack direction="row" spacing={1}>
              <TextField size="small" fullWidth label="Ekstra e-postadresse"
                         value={emailInput}
                         onChange={(e) => setEmailInput(e.target.value)}
                         onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())} />
              <Button variant="outlined" onClick={addEmail}>Legg til</Button>
            </Stack>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={1} rowGap={0.5}>
              {form.recipient_emails.map((e, i) => (
                <Chip key={i} label={e} size="small"
                      onDelete={() => upd("recipient_emails",
                        form.recipient_emails.filter((_, j) => j !== i))} />
              ))}
            </Stack>
          </Box>

          <FormControlLabel
            control={<Switch checked={form.is_active}
                              onChange={(e) => upd("is_active", e.target.checked)} />}
            label="Aktivt abonnement" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={save} disabled={!form.name || saving}>
          {saving ? "Lagrer…" : "Lagre"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
