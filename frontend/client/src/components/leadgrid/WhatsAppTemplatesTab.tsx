/**
 * WhatsAppTemplatesTab.tsx
 *
 * Super-admin UI for å administrere WhatsApp Cloud API-templates.
 *
 * Hovedseksjoner:
 *  1. Analytics-card: sendt / levert / feil siste 30d
 *  2. Toolbar: org-velger, refresh, sync-from-meta, sync-leadgrid, ny-template
 *  3. Tabell: alle templates m/ status, kategori, språk, sist sjekket
 *  4. Send-test-modal: live-send til vilkårlig nummer
 *  5. Create-modal: form for ny template m/ HEADER/BODY/BUTTON-felter
 *  6. Telefon-preview-panel
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Chip, Button, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Snackbar,
  Alert, CircularProgress, Select, FormControlLabel, Switch, Tabs, Tab,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SyncIcon from "@mui/icons-material/Sync";
import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ErrorIcon from "@mui/icons-material/Error";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { WaTemplatePhonePreview } from "./WaTemplatePhonePreview";
import { WaOrgConfigSection } from "./WaOrgConfigSection";

interface Tpl {
  id: string;
  meta_template_id: string | null;
  org_key: string | null;
  name: string;
  language: string;
  category: string;
  header_format: string | null;
  header_text: string | null;
  body_text: string;
  body_param_count: number;
  body_param_examples: any;
  footer_text: string | null;
  buttons: any;
  status: string;
  rejected_reason: string | null;
  quality_score: string | null;
  last_status_sync_at: string | null;
  created_at: string;
  notes: string | null;
}

interface Analytics {
  sent_30d: string; delivered_30d: string; failed_30d: string;
  sent_7d: string;
  wa_sent_30d: string; wa_delivered_30d: string; wa_failed_30d: string;
  per_template: Array<{
    template_name: string; template_language: string;
    sent: string; delivered: string; failed: string; last_sent_at: string;
  }>;
}

const STATUS_CHIP: Record<string, { color: any; icon: React.ReactNode; label: string }> = {
  APPROVED: { color: "success", icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, label: "APPROVED" },
  PENDING:  { color: "warning", icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} />, label: "PENDING" },
  REJECTED: { color: "error",   icon: <ErrorIcon sx={{ fontSize: 14 }} />, label: "REJECTED" },
  PAUSED:   { color: "default", icon: <ErrorIcon sx={{ fontSize: 14 }} />, label: "PAUSED" },
  DISABLED: { color: "default", icon: <ErrorIcon sx={{ fontSize: 14 }} />, label: "DISABLED" },
  DRAFT:    { color: "default", icon: <ErrorIcon sx={{ fontSize: 14 }} />, label: "DRAFT" },
};

export function WhatsAppTemplatesTab() {
  const [view, setView] = useState<"templates" | "configs">("templates");
  const [orgKey, setOrgKey] = useState<string>("__global__");
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [testTpl, setTestTpl] = useState<Tpl | null>(null);
  const [previewTpl, setPreviewTpl] = useState<Tpl | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTpls = async () => {
    setLoading(true);
    try {
      const orgQ = orgKey === "__global__" ? "" : `?org_key=${encodeURIComponent(orgKey)}`;
      const r = await fetch(`/api/superadmin/wa-templates${orgQ}`, { credentials: "include" });
      if (r.ok) setTpls((await r.json()).templates ?? []);
    } finally { setLoading(false); }
  };

  const fetchAnalytics = async () => {
    const r = await fetch(`/api/superadmin/wa-templates/analytics`, { credentials: "include" });
    if (r.ok) setAnalytics(await r.json());
  };

  useEffect(() => { fetchTpls(); /* eslint-disable-line */ }, [orgKey]);
  useEffect(() => { fetchAnalytics(); }, []);

  const syncFromMeta = async () => {
    setSyncing(true);
    try {
      const orgBody = orgKey === "__global__" ? {} : { org_key: orgKey };
      const r = await fetch(`/api/superadmin/wa-templates/sync-from-meta`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgBody),
      });
      const j = await r.json();
      if (r.ok) {
        setSnack({ kind: "ok", msg: `Synced ${j.synced}/${j.total} fra Meta` });
        await fetchTpls();
      } else {
        setSnack({ kind: "err", msg: `Sync feilet: ${JSON.stringify(j).slice(0, 100)}` });
      }
    } finally { setSyncing(false); }
  };

  const syncLeadgrid = async () => {
    setSyncing(true);
    try {
      const orgBody = orgKey === "__global__" ? {} : { org_key: orgKey };
      const r = await fetch(`/api/superadmin/wa-templates/sync-leadgrid`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgBody),
      });
      const j = await r.json();
      if (r.ok) {
        const created = j.results.filter((x: any) => x.action === "created").length;
        const skipped = j.results.filter((x: any) => x.action === "skip").length;
        setSnack({ kind: "ok", msg: `Leadgrid sync: ${created} opprettet, ${skipped} allerede oppe` });
        await fetchTpls();
      } else {
        setSnack({ kind: "err", msg: "Leadgrid-sync feilet" });
      }
    } finally { setSyncing(false); }
  };

  const deleteTpl = async (t: Tpl) => {
    if (!confirm(`Slett template "${t.name}" fra både Meta og DB?`)) return;
    const orgQ = t.org_key ? `?org_key=${encodeURIComponent(t.org_key)}` : "";
    const r = await fetch(`/api/superadmin/wa-templates/${encodeURIComponent(t.name)}${orgQ}`, {
      method: "DELETE", credentials: "include",
    });
    if (r.ok) {
      setSnack({ kind: "ok", msg: `Slettet ${t.name}` });
      await fetchTpls();
    } else {
      setSnack({ kind: "err", msg: "Sletting feilet" });
    }
  };

  const counts = useMemo(() => ({
    total: tpls.length,
    approved: tpls.filter((t) => t.status === "APPROVED").length,
    pending: tpls.filter((t) => t.status === "PENDING").length,
    rejected: tpls.filter((t) => t.status === "REJECTED").length,
  }), [tpls]);

  return (
    <Box>
      <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ mb: 2 }}>
        <Tab label="Templates" value="templates" />
        <Tab label="WABA-config (multi-tenant)" value="configs" />
      </Tabs>

      {view === "configs" ? (
        <WaOrgConfigSection onSnack={setSnack} />
      ) : (
        <>
          {/* Analytics-card */}
          {analytics && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Klient-varsler & test-sendinger siste 30d
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={1}>
                  <Stat label="Klient-WA sendt" value={analytics.wa_sent_30d} color="#a78bfa" />
                  <Stat label="Klient-WA levert" value={analytics.wa_delivered_30d} color="#9be15d" />
                  <Stat label="Klient-WA feil" value={analytics.wa_failed_30d} color="#f87171" />
                  <Box sx={{ borderLeft: "1px solid rgba(0,0,0,0.1)", height: 40, mx: 1 }} />
                  <Stat label="Admin-tester sendt" value={analytics.sent_30d} />
                  <Stat label="Admin-tester ok" value={analytics.delivered_30d} color="#9be15d" />
                  <Stat label="Admin-tester feil" value={analytics.failed_30d} color="#f87171" />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Toolbar */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Typography variant="body2">Org:</Typography>
                <Select size="small" value={orgKey} onChange={(e) => setOrgKey(e.target.value)}
                        sx={{ minWidth: 200 }}>
                  <MenuItem value="__global__">Global (Leadgrid)</MenuItem>
                  {/* Pop fra org-configs senere — placeholder for nå */}
                </Select>
                <Box sx={{ flex: 1 }} />
                <Chip size="small" label={`Totalt ${counts.total}`} />
                <Chip size="small" label={`${counts.approved} ✓`} color="success" />
                <Chip size="small" label={`${counts.pending} …`} color="warning" />
                {counts.rejected > 0 && (
                  <Chip size="small" label={`${counts.rejected} ✗`} color="error" />
                )}
                <Tooltip title="Hent status fra Meta + lagre i DB">
                  <span>
                    <Button size="small" variant="outlined"
                            startIcon={syncing ? <CircularProgress size={14}/> : <RefreshIcon />}
                            onClick={syncFromMeta} disabled={syncing}>
                      Sync fra Meta
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Re-poster manglende Leadgrid-templates (deliverable_completed, etc)">
                  <span>
                    <Button size="small" variant="outlined"
                            startIcon={<SyncIcon />} onClick={syncLeadgrid} disabled={syncing}>
                      Sync Leadgrid
                    </Button>
                  </span>
                </Tooltip>
                <Button size="small" variant="contained" startIcon={<AddIcon />}
                        onClick={() => setCreateOpen(true)}>
                  Ny template
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Tabell */}
          <Card>
            <CardContent>
              {loading ? (
                <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Navn</TableCell>
                      <TableCell>Språk</TableCell>
                      <TableCell>Kategori</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Body preview</TableCell>
                      <TableCell align="right">Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tpls.map((t) => {
                      const sc = STATUS_CHIP[t.status] ?? STATUS_CHIP.DRAFT;
                      return (
                        <TableRow key={t.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                              {t.name}
                            </Typography>
                            {t.notes && (
                              <Typography variant="caption" color="text.secondary">{t.notes}</Typography>
                            )}
                          </TableCell>
                          <TableCell>{t.language}</TableCell>
                          <TableCell>
                            <Chip size="small" label={t.category}
                                  sx={{ fontSize: 10, height: 18 }} />
                          </TableCell>
                          <TableCell>
                            <Chip size="small" color={sc.color} icon={sc.icon as any} label={sc.label}
                                  sx={{ fontSize: 10 }} />
                            {t.rejected_reason && t.status === "REJECTED" && (
                              <Tooltip title={t.rejected_reason}>
                                <Typography variant="caption" sx={{ display: "block", color: "error.main" }}>
                                  {t.rejected_reason.slice(0, 40)}
                                </Typography>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{
                              fontFamily: "monospace", maxWidth: 240, display: "inline-block",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {t.body_text.replace(/\n/g, " ↵ ").slice(0, 60)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="Forhåndsvis">
                                <IconButton size="small" onClick={() => setPreviewTpl(t)}>
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Send test">
                                <span>
                                  <IconButton size="small" disabled={t.status !== "APPROVED"}
                                              onClick={() => setTestTpl(t)} color="primary">
                                    <SendIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Slett">
                                <IconButton size="small" color="error" onClick={() => deleteTpl(t)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {tpls.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary"
                                      sx={{ textAlign: "center", py: 4 }}>
                            Ingen templates her. Klikk "Sync fra Meta" for å hente eksisterende,
                            eller "Sync Leadgrid" for å re-poste våre standard-templates.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {testTpl && (
        <SendTestDialog tpl={testTpl} onClose={() => setTestTpl(null)}
                        onSent={() => { setTestTpl(null); fetchAnalytics(); }} />
      )}
      {previewTpl && (
        <PreviewDialog tpl={previewTpl} onClose={() => setPreviewTpl(null)} />
      )}
      {createOpen && (
        <CreateTemplateDialog onClose={() => setCreateOpen(false)}
                              onCreated={() => { setCreateOpen(false); fetchTpls(); }}
                              orgKey={orgKey === "__global__" ? null : orgKey} />
      )}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color: color ?? "inherit" }}>
        {value}
      </Typography>
    </Box>
  );
}

// ============================================================
// SEND TEST DIALOG
// ============================================================
function SendTestDialog({ tpl, onClose, onSent }: {
  tpl: Tpl; onClose: () => void; onSent: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [params, setParams] = useState<string[]>(
    () => Array(tpl.body_param_count).fill(""),
  );
  const [buttonParam, setButtonParam] = useState("test123demo");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true); setError(null);
    try {
      const r = await fetch(`/api/superadmin/wa-templates/${encodeURIComponent(tpl.name)}/send-test`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone, language: tpl.language,
          body_params: params, button_param: buttonParam,
          recipient_label: `admin-test ${new Date().toLocaleTimeString()}`,
        }),
      });
      const j = await r.json();
      if (r.ok) onSent();
      else setError(j?.details?.error?.message ?? j?.error ?? "Ukjent feil");
    } finally { setSending(false); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send live-test: {tpl.name} ({tpl.language})</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Telefonnummer (E.164)" value={phone}
                     onChange={(e) => setPhone(e.target.value)}
                     placeholder="+4797959294" fullWidth size="small" />
          {params.map((p, i) => (
            <TextField key={i} label={`Body param {{${i + 1}}}`}
                       value={p}
                       onChange={(e) => {
                         const next = [...params]; next[i] = e.target.value; setParams(next);
                       }}
                       fullWidth size="small"
                       placeholder={Array.isArray(tpl.body_param_examples?.[0])
                         ? tpl.body_param_examples[0][i] ?? "" : ""} />
          ))}
          {Array.isArray(tpl.buttons) && tpl.buttons.length > 0 && (
            <TextField label="Button-parameter (f.eks. portal-token)"
                       value={buttonParam} onChange={(e) => setButtonParam(e.target.value)}
                       fullWidth size="small" />
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={send}
                disabled={!phone || sending || params.some((p) => !p)}>
          {sending ? "Sender…" : "Send test"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================
// PREVIEW DIALOG
// ============================================================
function PreviewDialog({ tpl, onClose }: { tpl: Tpl; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Forhåndsvis: {tpl.name}</DialogTitle>
      <DialogContent>
        <WaTemplatePhonePreview
          headerText={tpl.header_text}
          bodyText={tpl.body_text}
          bodyParamExamples={Array.isArray(tpl.body_param_examples?.[0])
            ? tpl.body_param_examples[0] : []}
          footerText={tpl.footer_text}
          buttons={tpl.buttons}
        />
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Lukk</Button></DialogActions>
    </Dialog>
  );
}

// ============================================================
// CREATE TEMPLATE DIALOG
// ============================================================
function CreateTemplateDialog({ onClose, onCreated, orgKey }: {
  onClose: () => void; onCreated: () => void; orgKey: string | null;
}) {
  const [form, setForm] = useState({
    name: "", language: "nb", category: "UTILITY",
    header_format: "TEXT", header_text: "",
    body_text: "", footer_text: "",
    button_type: "URL", button_text: "Åpne portalen",
    button_url: "https://leadgrid.theroleroom.com/c/{{1}}",
    button_example: "https://leadgrid.theroleroom.com/c/abc123xyz",
    has_button: true,
  });
  const [examples, setExamples] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync body-params examples
  const paramCount = useMemo(() => {
    const m = form.body_text.match(/\{\{\d+\}\}/g);
    return m ? m.length : 0;
  }, [form.body_text]);
  useEffect(() => {
    if (paramCount !== examples.length) {
      const next = [...examples];
      while (next.length < paramCount) next.push("");
      next.length = paramCount;
      setExamples(next);
    }
  }, [paramCount]);

  const submit = async () => {
    setSubmitting(true); setError(null);
    const body: any = {
      name: form.name, language: form.language, category: form.category,
      header_format: form.header_format === "TEXT" ? "TEXT" : null,
      header_text: form.header_format === "TEXT" ? form.header_text : null,
      body_text: form.body_text,
      body_param_examples: examples,
      footer_text: form.footer_text || null,
      buttons: form.has_button ? [{
        type: form.button_type, text: form.button_text,
        url: form.button_url, example: [form.button_example],
      }] : [],
      org_key: orgKey,
    };
    try {
      const r = await fetch(`/api/superadmin/wa-templates`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) onCreated();
      else setError(j?.details?.error?.error_user_msg ?? j?.error ?? "Ukjent feil");
    } finally { setSubmitting(false); }
  };

  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Ny WhatsApp-template</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Navn (lowercase, _-separert)" value={form.name}
                       onChange={(e) => upd("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                       fullWidth size="small" />
            <TextField select label="Språk" value={form.language}
                       onChange={(e) => upd("language", e.target.value)}
                       sx={{ minWidth: 100 }} size="small">
              <MenuItem value="nb">nb</MenuItem>
              <MenuItem value="en">en</MenuItem>
              <MenuItem value="sv">sv</MenuItem>
              <MenuItem value="da">da</MenuItem>
            </TextField>
            <TextField select label="Kategori" value={form.category}
                       onChange={(e) => upd("category", e.target.value)}
                       sx={{ minWidth: 150 }} size="small">
              <MenuItem value="UTILITY">UTILITY</MenuItem>
              <MenuItem value="MARKETING">MARKETING</MenuItem>
              <MenuItem value="AUTHENTICATION">AUTHENTICATION</MenuItem>
            </TextField>
          </Stack>

          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>HEADER (valgfri)</Typography>
            <TextField label="Header-tekst" value={form.header_text}
                       onChange={(e) => upd("header_text", e.target.value)}
                       fullWidth size="small" sx={{ mt: 1 }} />
          </Box>

          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>BODY (påkrevd)</Typography>
            <TextField label="Body-tekst (bruk {{1}}, {{2}} for variabler)"
                       value={form.body_text}
                       onChange={(e) => upd("body_text", e.target.value)}
                       fullWidth multiline rows={6} size="small" sx={{ mt: 1 }}
                       helperText={`${paramCount} variabel(er). NB: variabler kan ikke være siste tegn.`} />
            {paramCount > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Variabel-eksempler (kreves av Meta for godkjenning):
                </Typography>
                {Array.from({ length: paramCount }).map((_, i) => (
                  <TextField key={i} label={`Eksempel for {{${i + 1}}}`}
                             value={examples[i] ?? ""}
                             onChange={(e) => {
                               const next = [...examples]; next[i] = e.target.value; setExamples(next);
                             }}
                             fullWidth size="small" sx={{ mt: 1 }} />
                ))}
              </Box>
            )}
          </Box>

          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <FormControlLabel
              control={<Switch checked={form.has_button}
                                onChange={(e) => upd("has_button", e.target.checked)} />}
              label="Inkluder URL-button" />
            {form.has_button && (
              <Stack spacing={1} sx={{ mt: 1 }}>
                <TextField label="Button-tekst" value={form.button_text}
                           onChange={(e) => upd("button_text", e.target.value)}
                           fullWidth size="small" />
                <TextField label="URL (bruk {{1}} for dynamisk del)" value={form.button_url}
                           onChange={(e) => upd("button_url", e.target.value)}
                           fullWidth size="small" />
                <TextField label="URL-eksempel" value={form.button_example}
                           onChange={(e) => upd("button_example", e.target.value)}
                           fullWidth size="small" />
              </Stack>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={submit}
                disabled={!form.name || !form.body_text || submitting}>
          {submitting ? "Sender til Meta…" : "Opprett (sendes til Meta-godkjenning)"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
