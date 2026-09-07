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

interface ProjectListItem {
  id: string;
  name: string;
}

interface ReportSub {
  id: string;
  project_id: string | null;
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
  scope: "org" | "team" | "individual";
  target_team_leader_id: string | null;
  target_user_id: string | null;
  auto_send_to_target: boolean;
}

const DAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function authHeaders(): HeadersInit {
  const token = typeof window === "undefined"
    ? null
    : localStorage.getItem("rr_bearer");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function activeOrganizationId(): string | null {
  return typeof window === "undefined"
    ? null
    : localStorage.getItem("rr_lead_map_active_org");
}

function formatNextSend(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("no-NO", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ScheduledReportsPanel() {
  const [items, setItems] = useState<ReportSub[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectId, setProjectId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("rr_lead_map_active_project") ?? "",
  );
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReportSub | null>(null);
  const [creating, setCreating] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const visibleItems = selectedProject
    ? items.filter((item) => item.project_id === selectedProject.id)
    : [];
  const unscopedCount = items.filter((item) => !item.project_id).length;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    const organizationId = activeOrganizationId();
    if (organizationId) params.set("organization_id", organizationId);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    fetch(`/api/leadgrid/scheduled-reports${suffix}`, {
      credentials: "include",
      headers: authHeaders(),
    })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectError(null);
      try {
        const params = new URLSearchParams();
        const organizationId = activeOrganizationId();
        if (organizationId) params.set("organization_id", organizationId);
        const suffix = params.size > 0 ? `?${params.toString()}` : "";
        const response = await fetch(
          `/api/admin-room/lead-map/projects${suffix}`,
          {
            credentials: "include",
            headers: authHeaders(),
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error ?? "Kunne ikke hente kundeprosjekter");
        }
        const nextProjects = Array.isArray(body.projects) ? body.projects : [];
        setProjects(nextProjects);
        setProjectId((current) => {
          if (nextProjects.some((project: ProjectListItem) => project.id === current)) {
            return current;
          }
          return nextProjects.length === 1 ? nextProjects[0].id : "";
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setProjects([]);
          setProjectError(
            error instanceof Error ? error.message : "Kunne ikke hente kundeprosjekter",
          );
        }
      } finally {
        if (!controller.signal.aborted) setProjectsLoading(false);
      }
    };
    void loadProjects();
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (projectId) localStorage.setItem("rr_lead_map_active_project", projectId);
    else localStorage.removeItem("rr_lead_map_active_project");
  }, [projectId]);

  const del = async (id: string) => {
    if (!confirm("Slett dette abonnementet?")) return;
    const r = await fetch(`/api/leadgrid/scheduled-reports/${id}`, {
      method: "DELETE", credentials: "include", headers: authHeaders(),
    });
    if (r.ok) { setSnack({ kind: "ok", msg: "Slettet" }); load(); }
  };

  const sendNow = async (id: string) => {
    const r = await fetch(`/api/leadgrid/scheduled-reports/${id}/send-now`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ organization_id: activeOrganizationId() }),
    });
    if (r.ok) {
      setSnack({ kind: "ok", msg: "Rapporten sendes innen 1 time" });
      load();
    }
  };

  const toggle = async (sub: ReportSub) => {
    const r = await fetch(`/api/leadgrid/scheduled-reports/${sub.id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        is_active: !sub.is_active,
        organization_id: activeOrganizationId(),
      }),
    });
    if (r.ok) { setSnack({ kind: "ok", msg: sub.is_active ? "Pauset" : "Aktivert" }); load(); }
  };

  const bulkAutoCreate = async () => {
    if (!selectedProject) {
      setSnack({ kind: "err", msg: "Velg kundeprosjekt først" });
      return;
    }
    if (!confirm(`Opprett rapport-abonnement for hver selger og teamleder i ${selectedProject.name}? Eksisterende abonnement hoppes over.`)) return;
    const r = await fetch("/api/leadgrid/scheduled-reports/auto-create-for-team", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        organization_id: activeOrganizationId(),
        project_id: selectedProject.id,
        frequency: "weekly", day_of_week: 1, time_of_day: "08:00",
        period_days: 7, report_type: "summary",
        include_reps: true, include_team_leaders: true,
      }),
    });
    if (r.ok) {
      const j = await r.json();
      setSnack({ kind: "ok", msg: `${j.created} opprettet, ${j.skipped} fantes fra før.` });
      load();
    } else {
      setSnack({ kind: "err", msg: "Bulk-opprett feilet" });
    }
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
              Rapporter er alltid avgrenset til valgt kundeprosjekt
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              select
              size="small"
              label="Kundeprosjekt"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={projectsLoading}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="" disabled>Velg kundeprosjekt</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={bulkAutoCreate}
              disabled={!selectedProject}
            >
              Auto-aktiver per person
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />}
                    disabled={!selectedProject}
                    onClick={() => setCreating(true)}>
              Nytt abonnement
            </Button>
          </Stack>
        </Stack>

        {projectError ? (
          <Alert severity="error">{projectError}</Alert>
        ) : !selectedProject ? (
          <Alert severity="info">Velg et Leadgrid-kundeprosjekt for å se rapportene.</Alert>
        ) : visibleItems.length === 0 && !loading ? (
          <Typography variant="body2" color="text.secondary"
                      sx={{ textAlign: "center", py: 3 }}>
            Ingen schedulerte rapporter for {selectedProject.name} ennå.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {visibleItems.map((sub) => (
              <Box key={sub.id} sx={{
                p: 2, borderRadius: 1,
                bgcolor: sub.is_active ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.10)",
                border: `1px solid ${sub.is_active ? "rgba(167,139,250,0.30)"
                                                    : "rgba(255,255,255,0.08)"}`,
                opacity: sub.is_active ? 1 : 0.6,
              }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1} flexWrap="wrap" rowGap={0.5}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {sub.name}
                      </Typography>
                      <Chip size="small"
                            label={sub.scope === "individual" ? "Personlig"
                                  : sub.scope === "team" ? "Team" : "Prosjekt"}
                            sx={{ fontSize: 10, height: 18, fontWeight: 700,
                                  bgcolor: sub.scope === "individual" ? "rgba(155,225,93,0.20)"
                                         : sub.scope === "team" ? "rgba(255,184,107,0.20)"
                                         : "rgba(167,139,250,0.20)",
                                  color: sub.scope === "individual" ? "#9be15d"
                                       : sub.scope === "team" ? "#ffb86b"
                                       : "#a78bfa" }} />
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

        {unscopedCount > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {unscopedCount} eldre abonnement mangler kundeprosjekt og blir ikke sendt.
          </Alert>
        )}

        {(editing || creating) && selectedProject && (
          <SubscriptionDialog sub={editing}
                              projectId={selectedProject.id}
                              projectName={selectedProject.name}
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

function SubscriptionDialog({ sub, projectId, projectName, onClose, onSaved }: {
  sub: ReportSub | null;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    project_id: sub?.project_id ?? projectId,
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
    scope: (sub?.scope ?? "org") as "org" | "team" | "individual",
    target_team_leader_id: sub?.target_team_leader_id ?? null as string | null,
    target_user_id: sub?.target_user_id ?? null as string | null,
    auto_send_to_target: sub?.auto_send_to_target ?? true,
  });
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch(
      `/api/leadgrid/assignable-users?role=all&projectId=${encodeURIComponent(projectId)}`,
      { credentials: "include" },
    )
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((d) => setAssignableUsers(d.users ?? []));
  }, [projectId]);

  const save = async () => {
    setSaving(true);
    try {
      const url = sub
        ? `/api/leadgrid/scheduled-reports/${sub.id}`
        : `/api/leadgrid/scheduled-reports`;
      const r = await fetch(url, {
        method: sub ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...form,
          project_id: projectId,
          organization_id: activeOrganizationId(),
        }),
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
          <Alert severity="info">Kundeprosjekt: {projectName}</Alert>
          <TextField label="Navn" value={form.name}
                     onChange={(e) => upd("name", e.target.value)}
                     fullWidth size="small" />

          {/* Scope: hvilke leads inkluderes */}
          <Box sx={{ p: 1.5, border: "1px dashed",
                      borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: "block" }}>
              Hvilke leads inkluderes?
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField select label="Scope" value={form.scope}
                         onChange={(e) => upd("scope", e.target.value)}
                         size="small" sx={{ flex: 1 }}>
                <MenuItem value="org">Hele prosjektet (alle leads i kundeprosjektet)</MenuItem>
                <MenuItem value="team">Ett team (én teamleder)</MenuItem>
                <MenuItem value="individual">Én person (én selger)</MenuItem>
              </TextField>
              {form.scope === "team" && (
                <Autocomplete
                  options={assignableUsers.filter((u) => u.role === "teamleder")}
                  getOptionLabel={(o) => o.full_name || o.email}
                  value={assignableUsers.find((u) => u.user_id === form.target_team_leader_id) ?? null}
                  onChange={(_, v) => upd("target_team_leader_id", v?.user_id ?? null)}
                  renderInput={(p) => <TextField {...p} label="Velg teamleder" size="small" />}
                  sx={{ flex: 1 }} />
              )}
              {form.scope === "individual" && (
                <Autocomplete options={assignableUsers}
                  getOptionLabel={(o) => o.full_name || o.email}
                  value={assignableUsers.find((u) => u.user_id === form.target_user_id) ?? null}
                  onChange={(_, v) => upd("target_user_id", v?.user_id ?? null)}
                  renderInput={(p) => <TextField {...p} label="Velg person" size="small" />}
                  sx={{ flex: 1 }} />
              )}
            </Stack>
            {form.scope !== "org" && (
              <FormControlLabel sx={{ mt: 1 }}
                control={<Switch checked={form.auto_send_to_target}
                                  onChange={(e) => upd("auto_send_to_target", e.target.checked)} />}
                label={`Send automatisk til ${form.scope === "team" ? "teamlederen" : "personen"}`} />
            )}
          </Box>

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
