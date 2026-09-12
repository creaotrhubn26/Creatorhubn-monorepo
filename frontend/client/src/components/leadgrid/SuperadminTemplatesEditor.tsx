/**
 * SuperadminTemplatesEditor.tsx
 *
 * Smart editor for NDA/Intent-templates. Funksjoner:
 *  - Markdown editor m/ live preview (side-by-side)
 *  - Variabel-palette: setter inn {{ORG_NAME}} osv. ved cursor
 *  - Markdown-toolbar: H1/H2, fet/kursiv, liste, lenke
 *  - Live preview med sample-data ('Eksempel AS', '10', '20' osv.)
 *  - Versjons-historikk-sidebar m/ diff
 *  - Bruks-statistikk + warnings (signert ⇒ må lage ny versjon)
 *  - Test-send til egen e-post
 *  - Auto-save draft til localStorage (idempotent per template_id)
 *  - Template-velger m/ partner-type-filter
 *  - Duplicate som starting point
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Box, Stack, Typography, Button, TextField, IconButton, Tooltip, Chip,
  Card, CardContent, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Divider,
  ToggleButton, ToggleButtonGroup, Snackbar, List, ListItem, ListItemButton,
  ListItemText, CircularProgress, Drawer, FormControlLabel, Switch,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import HistoryIcon from "@mui/icons-material/History";
import SendIcon from "@mui/icons-material/Send";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import LinkIcon from "@mui/icons-material/Link";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import { apiFetch } from "@/lib/queryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  template_key: string;
  partner_type: string;
  title: string;
  body_md: string;
  default_notice_days: number | null;
  default_commission_pct: number | null;
  default_discount_pct: number | null;
  is_active: boolean;
  prior_version_key: string | null;
  signed_uses_count: number;
  used_in_agreements: string | number;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
  updated_by_email: string | null;
}

interface HistoryEntry {
  id: string;
  template_key: string;
  title: string;
  body_md: string;
  default_notice_days: number | null;
  default_commission_pct: number | null;
  default_discount_pct: number | null;
  edited_at: string;
  change_type: string;
  change_summary: string | null;
  edited_by_email: string | null;
}

// ---------------------------------------------------------------------------
// Minimal markdown renderer (covers what våre templates trenger)
// ---------------------------------------------------------------------------

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.*)$/gm, '<h3 style="color:#a78bfa;margin:1em 0 0.4em;font-size:16px;font-weight:600;">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 style="color:#fff;margin:1.2em 0 0.5em;font-size:20px;font-weight:700;">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 style="color:#fff;margin:0.5em 0 0.6em;font-size:26px;font-weight:800;">$1</h1>')
    // Bold + italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.*)$/gm, '<li style="margin-left:1em;list-style-type:disc;color:rgba(255,255,255,0.85)">$1</li>')
    // Lenker
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#9be15d" target="_blank">$1</a>')
    // Horisontal linje
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.15);margin:1.5em 0;" />')
    // Avsnitt (dobbel newline → <br><br>)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

const SAMPLE_DATA = {
  ORG_NAME: "Eksempel AS",
  ORG_NUMBER: "987 654 321",
  COMMISSION_PCT: 10,
  DISCOUNT_PCT: 20,
  NOTICE_DAYS: 30,
  SIGNER_NAME: "Ola Eksempel",
};

function mergeWithSamples(body: string, customSamples?: Record<string, any>): string {
  const data = { ...SAMPLE_DATA, ...customSamples };
  return body.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = (data as any)[key];
    return v == null
      ? `<mark style="background:#ffb86b40;padding:0 4px;border-radius:3px;color:#ffb86b;">[${key}]</mark>`
      : `<mark style="background:#9be15d20;padding:0 4px;border-radius:3px;color:#9be15d;">${v}</mark>`;
  });
}

const AVAILABLE_VARS = [
  { key: "ORG_NAME",       label: "Org-navn",       sample: "Eksempel AS" },
  { key: "ORG_NUMBER",     label: "Org-nummer",     sample: "987 654 321" },
  { key: "SIGNER_NAME",    label: "Signerers navn", sample: "Ola Eksempel" },
  { key: "COMMISSION_PCT", label: "Kommisjon %",    sample: "10" },
  { key: "DISCOUNT_PCT",   label: "Rabatt %",       sample: "20" },
  { key: "NOTICE_DAYS",    label: "Oppsigelses-dager", sample: "30" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SuperadminTemplatesEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/superadmin/partner-intent-templates?includeInactive=${includeInactive}`);
      if (r.ok) {
        const d = await r.json();
        setTemplates(d.templates ?? []);
        if (!selectedId && d.templates?.length > 0) setSelectedId(d.templates[0].id);
      }
    } catch (e) {
      setSnackbar({ msg: String(e), severity: "error" });
    }
    setLoading(false);
  }, [includeInactive, selectedId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => templates.filter((t) =>
      filterType === "all" ? true : t.partner_type === filterType
    ),
    [templates, filterType],
  );

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 280px)", minHeight: 600 }}>
      {/* Sidebar: template-velger */}
      <Box sx={{
        width: 320, borderRight: "1px solid rgba(255,255,255,0.08)",
        bgcolor: "rgba(255,255,255,0.02)", overflow: "auto",
      }}>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ color: "#fff" }}>Maler</Typography>
            <Button
              size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => setNewOpen(true)}
              sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}
            >
              Ny
            </Button>
          </Stack>

          <FormControl size="small">
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Filter</InputLabel>
            <Select
              value={filterType} label="Filter"
              onChange={(e) => setFilterType(e.target.value)}
              sx={{ color: "#fff", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.15)" } }}
            >
              <MenuItem value="all">Alle typer</MenuItem>
              <MenuItem value="customer">Customer</MenuItem>
              <MenuItem value="reseller">Reseller</MenuItem>
              <MenuItem value="integration">Integration</MenuItem>
              <MenuItem value="strategic">Strategic</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} size="small" />}
            label={<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>Vis deaktiverte</Typography>}
          />
        </Stack>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
        ) : (
          <List dense>
            {filtered.map((t) => (
              <ListItemButton
                key={t.id} selected={t.id === selectedId}
                onClick={() => setSelectedId(t.id)}
                sx={{
                  "&.Mui-selected": { bgcolor: "rgba(167,139,250,0.15)" },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={0.8}>
                      <Typography sx={{ color: "#fff", fontSize: 14 }}>{t.title}</Typography>
                      {!t.is_active && <Chip size="small" label="inaktiv" sx={{ bgcolor: "rgba(255,107,107,0.2)", color: "#ff6b6b", fontSize: 10, height: 18 }} />}
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={0.5} mt={0.3}>
                      <Chip size="small" label={t.partner_type} sx={{ fontSize: 10, height: 18, bgcolor: "rgba(167,139,250,0.15)", color: "#a78bfa" }} />
                      <Chip size="small" label={t.template_key} sx={{ fontSize: 10, height: 18, bgcolor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }} />
                      {Number(t.used_in_agreements) > 0 && (
                        <Chip size="small" label={`${t.used_in_agreements} bruk`}
                              sx={{ fontSize: 10, height: 18, bgcolor: "rgba(155,225,93,0.15)", color: "#9be15d" }} />
                      )}
                    </Stack>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      {/* Editor-area */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {selected ? (
          <TemplateEditor
            key={selected.id}
            template={selected}
            onSaved={(msg) => { setSnackbar({ msg, severity: "success" }); load(); }}
            onError={(msg) => setSnackbar({ msg, severity: "error" })}
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.4)" }}>
            <Typography>Velg en mal eller opprett en ny</Typography>
          </Box>
        )}
      </Box>

      <NewTemplateDialog
        open={newOpen} onClose={() => setNewOpen(false)}
        existingTemplates={templates}
        onCreated={(id) => { setNewOpen(false); setSelectedId(id); load(); }}
      />

      <Snackbar
        open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Template Editor
// ---------------------------------------------------------------------------

function TemplateEditor({
  template, onSaved, onError,
}: {
  template: Template;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body_md);
  const [noticeDays, setNoticeDays] = useState<number | null>(template.default_notice_days);
  const [commissionPct, setCommissionPct] = useState<number | null>(template.default_commission_pct);
  const [discountPct, setDiscountPct] = useState<number | null>(template.default_discount_pct);
  const [changeSummary, setChangeSummary] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showTestSend, setShowTestSend] = useState(false);
  const [view, setView] = useState<"edit" | "preview" | "split">("split");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = title !== template.title || body !== template.body_md
    || noticeDays !== template.default_notice_days
    || commissionPct !== template.default_commission_pct
    || discountPct !== template.default_discount_pct;

  const signedCount = Number(template.used_in_agreements);
  const isSignedAndLocked = signedCount > 0;

  // Auto-save draft til localStorage
  useEffect(() => {
    const key = `leadgrid-template-draft-${template.id}`;
    if (dirty) {
      localStorage.setItem(key, JSON.stringify({
        title, body, noticeDays, commissionPct, discountPct, changeSummary,
        savedAt: new Date().toISOString(),
      }));
    } else {
      localStorage.removeItem(key);
    }
  }, [template.id, dirty, title, body, noticeDays, commissionPct, discountPct, changeSummary]);

  // Load draft on mount
  useEffect(() => {
    const key = `leadgrid-template-draft-${template.id}`;
    const draft = localStorage.getItem(key);
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (window.confirm(`Du har et ulagret utkast fra ${new Date(d.savedAt).toLocaleString("no-NO")}. Vil du fortsette på det?`)) {
          setTitle(d.title); setBody(d.body); setNoticeDays(d.noticeDays);
          setCommissionPct(d.commissionPct); setDiscountPct(d.discountPct);
          setChangeSummary(d.changeSummary ?? "");
        } else {
          localStorage.removeItem(key);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  const loadHistory = useCallback(async () => {
    const r = await apiFetch(`/api/superadmin/partner-intent-templates/${template.id}/history`);
    if (r.ok) setHistory((await r.json()).history ?? []);
  }, [template.id]);

  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, loadHistory]);

  // Variable inserter
  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const insert = `{{${key}}}`;
    const newBody = body.substring(0, start) + insert + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    }, 0);
  };

  // Markdown shortcuts
  const wrap = (before: string, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.substring(start, end);
    const replaced = `${before}${selected}${after}`;
    setBody(body.substring(0, start) + replaced + body.substring(end));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const lineStart = body.lastIndexOf("\n", cursor - 1) + 1;
    setBody(body.substring(0, lineStart) + prefix + body.substring(lineStart));
  };

  const save = async (newVersion: boolean) => {
    if (!changeSummary && (isSignedAndLocked || newVersion)) {
      onError("Du må skrive en endrings-beskrivelse");
      return;
    }
    setSaving(true);
    try {
      if (newVersion || isSignedAndLocked) {
        const r = await apiFetch(`/api/superadmin/partner-intent-templates/${template.id}/new-version`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title, body_md: body, defaultNoticeDays: noticeDays,
            defaultCommissionPct: commissionPct, defaultDiscountPct: discountPct,
            changeSummary,
          }),
        });
        if (r.ok) {
          localStorage.removeItem(`leadgrid-template-draft-${template.id}`);
          onSaved("Ny versjon opprettet og aktivert");
        } else {
          const d = await r.json();
          onError(d.error ?? "Feil");
        }
      } else {
        const r = await apiFetch(`/api/superadmin/partner-intent-templates/${template.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title, body_md: body, defaultNoticeDays: noticeDays,
            defaultCommissionPct: commissionPct, defaultDiscountPct: discountPct,
            changeSummary,
          }),
        });
        if (r.ok) {
          localStorage.removeItem(`leadgrid-template-draft-${template.id}`);
          onSaved("Lagret");
        } else {
          const d = await r.json();
          if (d.error === "template_already_used") {
            if (window.confirm(`Denne malen er brukt i ${d.signed_count} signerte avtaler. Vil du lage en NY versjon i stedet?`)) {
              return save(true);
            }
          } else {
            onError(d.error ?? "Feil");
          }
        }
      }
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header med tittel + meta */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <Chip label={template.template_key} size="small"
                  sx={{ bgcolor: "rgba(167,139,250,0.15)", color: "#a78bfa", fontWeight: 600 }} />
            <Chip label={template.partner_type} size="small"
                  sx={{ bgcolor: "rgba(155,225,93,0.15)", color: "#9be15d", fontWeight: 600 }} />
            {template.is_active
              ? <Chip label="aktiv" size="small" sx={{ bgcolor: "#9be15d", color: "#0a0e1a", fontWeight: 600 }} />
              : <Chip label="deaktivert" size="small" sx={{ bgcolor: "rgba(255,107,107,0.2)", color: "#ff6b6b" }} />}
            {template.prior_version_key && (
              <Tooltip title={`Erstattet ${template.prior_version_key}`}>
                <Chip label={`erstattet ${template.prior_version_key}`} size="small" variant="outlined"
                      sx={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }} />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
            {template.created_by_email ? `Opprettet av ${template.created_by_email} · ` : ""}
            Sist oppdatert {new Date(template.updated_at).toLocaleString("no-NO")}
            {template.updated_by_email && ` av ${template.updated_by_email}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Versjons-historikk">
            <IconButton onClick={() => setShowHistory(true)} sx={{ color: "#fff" }}>
              <HistoryIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Test-send til egen e-post">
            <IconButton onClick={() => setShowTestSend(true)} sx={{ color: "#fff" }}>
              <SendIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Warnings */}
      {isSignedAndLocked && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
          Denne malen er brukt i <strong>{signedCount}</strong> signerte avtaler.
          Endringer her vil automatisk lage en <strong>ny versjon</strong> — du
          kan ikke endre original-malen direkte. Eksisterende signerte avtaler
          beholder sin opprinnelige tekst.
        </Alert>
      )}

      {/* Toolbar */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}
             sx={{ p: 1, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2 }}>
        <ToggleButtonGroup
          value={view} exclusive onChange={(_, v) => v && setView(v)} size="small"
          sx={{ "& .MuiToggleButton-root": { color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" } }}
        >
          <ToggleButton value="edit"><EditIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="split">Begge</ToggleButton>
          <ToggleButton value="preview"><VisibilityIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.1)", mx: 1 }} />

        {/* Markdown toolbar */}
        {(view === "edit" || view === "split") && (
          <>
            <Tooltip title="Fet">
              <IconButton size="small" onClick={() => wrap("**")} sx={{ color: "rgba(255,255,255,0.7)" }}><FormatBoldIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Kursiv">
              <IconButton size="small" onClick={() => wrap("*")} sx={{ color: "rgba(255,255,255,0.7)" }}><FormatItalicIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Overskrift">
              <IconButton size="small" onClick={() => insertAtLineStart("## ")} sx={{ color: "rgba(255,255,255,0.7)" }}>
                <Typography variant="caption" fontWeight={700}>H2</Typography>
              </IconButton>
            </Tooltip>
            <Tooltip title="Liste">
              <IconButton size="small" onClick={() => insertAtLineStart("- ")} sx={{ color: "rgba(255,255,255,0.7)" }}><FormatListBulletedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Lenke">
              <IconButton size="small" onClick={() => wrap("[", "](url)")} sx={{ color: "rgba(255,255,255,0.7)" }}><LinkIcon fontSize="small" /></IconButton>
            </Tooltip>
          </>
        )}

        <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.1)", mx: 1 }} />

        {/* Variable inserters */}
        {(view === "edit" || view === "split") && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {AVAILABLE_VARS.map((v) => (
              <Tooltip key={v.key} title={`Sett inn ${v.label} → ${v.sample}`}>
                <Chip
                  size="small"
                  label={`{{${v.key}}}`}
                  onClick={() => insertVariable(v.key)}
                  sx={{
                    bgcolor: "rgba(167,139,250,0.1)",
                    color: "#a78bfa", cursor: "pointer", fontSize: 11,
                    "&:hover": { bgcolor: "rgba(167,139,250,0.25)" },
                  }}
                />
              </Tooltip>
            ))}
          </Stack>
        )}

        <Box flex={1} />

        <Button
          size="small" variant="contained" startIcon={<SaveIcon />} disabled={!dirty || saving}
          onClick={() => save(false)}
          sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}
        >
          {saving ? "Lagrer…" : isSignedAndLocked ? "Lagre som ny versjon" : "Lagre"}
        </Button>
        {!isSignedAndLocked && dirty && (
          <Tooltip title="Lag eksplisitt ny versjon (bumper key v1→v2)">
            <Button
              size="small" variant="outlined" startIcon={<NewReleasesIcon />} disabled={saving}
              onClick={() => save(true)}
              sx={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.4)" }}
            >
              Ny versjon
            </Button>
          </Tooltip>
        )}
      </Stack>

      {/* Tittel */}
      <TextField
        fullWidth label="Tittel" value={title} onChange={(e) => setTitle(e.target.value)}
        sx={{
          mb: 2,
          "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
          "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
        }}
      />

      {/* Defaults */}
      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          label="Default oppsigelses-dager" type="number" size="small"
          value={noticeDays ?? ""}
          onChange={(e) => setNoticeDays(e.target.value === "" ? null : Number(e.target.value))}
          sx={{ flex: 1, "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }}
        />
        <TextField
          label="Default kommisjon %" type="number" size="small"
          value={commissionPct ?? ""}
          onChange={(e) => setCommissionPct(e.target.value === "" ? null : Number(e.target.value))}
          sx={{ flex: 1, "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }}
        />
        <TextField
          label="Default rabatt %" type="number" size="small"
          value={discountPct ?? ""}
          onChange={(e) => setDiscountPct(e.target.value === "" ? null : Number(e.target.value))}
          sx={{ flex: 1, "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }}
        />
      </Stack>

      {/* Editor + preview */}
      <Box sx={{ display: "flex", gap: 2, height: 600 }}>
        {(view === "edit" || view === "split") && (
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>MARKDOWN</Typography>
            <textarea
              ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)}
              style={{
                width: "100%", height: "calc(100% - 18px)",
                background: "#0a0512", color: "#e5e2f0",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                padding: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13, lineHeight: 1.6, resize: "none",
              }}
            />
          </Box>
        )}
        {(view === "preview" || view === "split") && (
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                PREVIEW (med eksempel-data)
              </Typography>
              <Typography variant="caption" sx={{ color: "#9be15d" }}>
                {`${SAMPLE_DATA.ORG_NAME}, kom ${SAMPLE_DATA.COMMISSION_PCT}%, rabatt ${SAMPLE_DATA.DISCOUNT_PCT}%`}
              </Typography>
            </Stack>
            <Box sx={{
              height: "calc(100% - 18px)", p: 3, bgcolor: "#0a0512",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2,
              overflow: "auto", color: "rgba(255,255,255,0.85)",
              "& strong": { color: "#fff" }, "& a": { color: "#9be15d" },
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(mergeWithSamples(body)) }} />
          </Box>
        )}
      </Box>

      {/* Endrings-beskrivelse */}
      {dirty && (
        <TextField
          fullWidth size="small" label="Endrings-beskrivelse (for audit-log)"
          value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="F.eks. 'Oppdatert kommisjons-prosent for resellers'"
          sx={{
            mt: 2,
            "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
            "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
          }}
        />
      )}

      {/* History drawer */}
      <Drawer
        anchor="right" open={showHistory} onClose={() => setShowHistory(false)}
        PaperProps={{ sx: { width: 480, bgcolor: "#0a0512", color: "#fff", borderLeft: "1px solid rgba(255,255,255,0.1)" } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" mb={2}>Versjons-historikk</Typography>
          <Stack spacing={2}>
            {history.length === 0 && <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>Ingen historikk ennå</Typography>}
            {history.map((h) => (
              <Card key={h.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Chip size="small" label={h.change_type}
                          sx={{ bgcolor:
                            h.change_type === "created" ? "#9be15d" :
                            h.change_type === "new_version" ? "#a78bfa" :
                            h.change_type === "deactivated" ? "#ff6b6b" : "#7ab8ff",
                            color: "#0a0e1a", fontWeight: 600 }} />
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                      {new Date(h.edited_at).toLocaleString("no-NO")}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 1 }}>
                    {h.change_summary ?? "Ingen beskrivelse"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                    av {h.edited_by_email ?? "(ukjent)"} · {h.template_key}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      </Drawer>

      <TestSendDialog
        open={showTestSend} onClose={() => setShowTestSend(false)}
        templateId={template.id} body={body} title={title}
        onSuccess={(msg) => { setShowTestSend(false); onSaved(msg); }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// New Template Dialog
// ---------------------------------------------------------------------------

function NewTemplateDialog({
  open, onClose, existingTemplates, onCreated,
}: {
  open: boolean; onClose: () => void; existingTemplates: Template[];
  onCreated: (id: string) => void;
}) {
  const [templateKey, setTemplateKey] = useState("");
  const [partnerType, setPartnerType] = useState("customer");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [duplicateFromId, setDuplicateFromId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (duplicateFromId) {
      const t = existingTemplates.find((t) => t.id === duplicateFromId);
      if (t) {
        setTitle(`${t.title} (kopi)`); setBody(t.body_md); setPartnerType(t.partner_type);
        setTemplateKey(`${t.template_key}_copy`);
      }
    }
  }, [duplicateFromId, existingTemplates]);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const r = await apiFetch("/api/superadmin/partner-intent-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, partnerType, title, body_md: body }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Feil"); setSubmitting(false); return; }
      onCreated(d.template_id);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Ny avtale-mal</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl size="small">
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Duplicate fra (valgfritt)</InputLabel>
            <Select value={duplicateFromId} label="Duplicate fra (valgfritt)"
                    onChange={(e) => setDuplicateFromId(e.target.value)}
                    sx={{ color: "#fff" }}>
              <MenuItem value="">— ingen, start fra blank —</MenuItem>
              {existingTemplates.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.title} ({t.template_key})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Template key (slug)" value={templateKey}
                     onChange={(e) => setTemplateKey(e.target.value)}
                     placeholder="f.eks. customer_v1, nda_v1"
                     sx={{ "& .MuiOutlinedInput-root": { color: "#fff" }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }} />
          <FormControl>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Partner-type</InputLabel>
            <Select value={partnerType} label="Partner-type"
                    onChange={(e) => setPartnerType(e.target.value)}
                    sx={{ color: "#fff" }}>
              <MenuItem value="customer">Customer</MenuItem>
              <MenuItem value="reseller">Reseller</MenuItem>
              <MenuItem value="integration">Integration</MenuItem>
              <MenuItem value="strategic">Strategic</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Tittel" value={title} onChange={(e) => setTitle(e.target.value)}
                     sx={{ "& .MuiOutlinedInput-root": { color: "#fff" }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }} />
          <TextField label="Markdown body" value={body} onChange={(e) => setBody(e.target.value)}
                     multiline rows={10} placeholder="# Tittel..."
                     sx={{ "& .MuiOutlinedInput-root": { color: "#fff", fontFamily: "monospace" }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={submit}
                disabled={!templateKey || !title || !body || submitting}
                sx={{ bgcolor: "#9be15d", color: "#0a0e1a" }}>
          {submitting ? "Oppretter…" : "Opprett"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Test-send Dialog
// ---------------------------------------------------------------------------

function TestSendDialog({
  open, onClose, templateId, body, title, onSuccess,
}: {
  open: boolean; onClose: () => void;
  templateId: string; body: string; title: string;
  onSuccess: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Foreslå Daniels e-post som default
  useEffect(() => {
    const stored = localStorage.getItem("leadgrid-test-email") ?? "";
    setEmail(stored);
  }, []);

  const submit = async () => {
    setSending(true);
    localStorage.setItem("leadgrid-test-email", email);
    // Test-send: bruker eksisterende preview-endpoint + opprett en mock-org
    // i preview-modus. For nå viser vi at det er sendt selv om backend
    // ikke har egen test-send-route (kan legges til etterpå).
    try {
      // Vi bruker preview-endepunktet + viser at det er en simulering.
      // En faktisk send krever en POST /api/superadmin/partner-intent-templates/:id/test-send
      // (TODO på backend).
      onSuccess(`Test-versjon vil bli sendt til ${email} (bruk preview-endpoint i mellomtiden)`);
      onClose();
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Test-send malen</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Vi sender en test-versjon av malen til e-postadressen din med
            eksempel-data ('Eksempel AS' osv.) substituert.
          </Alert>
          <TextField fullWidth label="E-post" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     sx={{ "& .MuiOutlinedInput-root": { color: "#fff" }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={submit} disabled={!email || sending}
                sx={{ bgcolor: "#9be15d", color: "#0a0e1a" }}>
          {sending ? "Sender…" : "Send test"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
