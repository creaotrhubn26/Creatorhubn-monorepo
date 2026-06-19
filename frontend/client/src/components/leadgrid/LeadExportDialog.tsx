/**
 * LeadExportDialog.tsx
 *
 * Modal som lar markedssjef eksportere leads til CSV eller PDF for
 * rapportering. Filter på periode, status, tildelt rep, teamleder.
 *
 * To moduser:
 *   - 'list': full leads-tabell (CSV eller landscape PDF)
 *   - 'summary': KPI-rapport (kun PDF, A4 portrett)
 */

import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography,
  TextField, MenuItem, Button, Box, ToggleButtonGroup, ToggleButton,
  Chip, Alert, CircularProgress, FormControl, RadioGroup, FormControlLabel, Radio,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableViewIcon from "@mui/icons-material/TableView";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AssessmentIcon from "@mui/icons-material/Assessment";

interface Props { open: boolean; onClose: () => void; }

export function LeadExportDialog({ open, onClose }: Props) {
  const [mode, setMode] = useState<"list" | "summary">("list");
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [statusFilter, setStatusFilter] = useState<"all" | "won" | "lost" | "in_pipeline" | "active">("all");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true); setError(null);
    try {
      const url = mode === "summary"
        ? `/api/leadgrid/leads/export-summary?period=${period}`
        : `/api/leadgrid/leads/export?format=${format}&period=${period}&status=${statusFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error ?? "Eksport feilet");
        return;
      }
      // Trigger browser-download fra blob
      const blob = await r.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      const filename = mode === "summary"
        ? `salgs-rapport-${new Date().toISOString().slice(0, 10)}.pdf`
        : `leads-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Nettverksfeil");
    } finally { setDownloading(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <FileDownloadIcon sx={{ color: "primary.main" }} />
          <Box>
            Eksporter leads
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              For rapportering, regnskap eller backup
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Mode: list vs summary */}
          <FormControl>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Type rapport
            </Typography>
            <RadioGroup value={mode} onChange={(_, v) => setMode(v as any)}>
              <ModeCard selected={mode === "list"}
                         icon={<TableViewIcon sx={{ color: "#a78bfa" }} />}
                         title="Lead-liste"
                         desc="Full tabell m/ alle leads i perioden. Velg CSV eller PDF."
                         onClick={() => setMode("list")}
                         value="list" />
              <ModeCard selected={mode === "summary"}
                         icon={<AssessmentIcon sx={{ color: "#9be15d" }} />}
                         title="Salgs-rapport (KPI)"
                         desc="Sammendrag m/ KPI, topp selgere, lost-årsaker, konverterings-trakt. Kun PDF."
                         onClick={() => setMode("summary")}
                         value="summary" />
            </RadioGroup>
          </FormControl>

          {/* Format */}
          {mode === "list" && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Format
              </Typography>
              <ToggleButtonGroup value={format} exclusive
                                  onChange={(_, v) => v && setFormat(v)}
                                  fullWidth>
                <ToggleButton value="csv">
                  <TableViewIcon sx={{ mr: 1 }} /> CSV (Excel)
                </ToggleButton>
                <ToggleButton value="pdf">
                  <PictureAsPdfIcon sx={{ mr: 1 }} /> PDF
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Periode */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Periode
            </Typography>
            <ToggleButtonGroup value={period} exclusive
                                onChange={(_, v) => v && setPeriod(v)}
                                fullWidth>
              <ToggleButton value="7d">Siste 7 dager</ToggleButton>
              <ToggleButton value="30d">Siste 30 dager</ToggleButton>
              <ToggleButton value="90d">Siste 90 dager</ToggleButton>
              {mode === "list" && <ToggleButton value="all">Alt</ToggleButton>}
            </ToggleButtonGroup>
          </Box>

          {/* Status-filter (kun list) */}
          {mode === "list" && (
            <TextField label="Status-filter" value={statusFilter}
                       onChange={(e) => setStatusFilter(e.target.value as any)}
                       select fullWidth size="small">
              <MenuItem value="all">Alle statuser</MenuItem>
              <MenuItem value="active">Aktive (ekskl. arkivert)</MenuItem>
              <MenuItem value="in_pipeline">I pipeline</MenuItem>
              <MenuItem value="won">Kun vunnet 🎉</MenuItem>
              <MenuItem value="lost">Kun tapt</MenuItem>
            </TextField>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {mode === "summary" && (
            <Alert severity="info" icon={<AssessmentIcon />}>
              Salgs-rapporten inkluderer din organisasjons branding (logo + farger).
              Format: A4 portrett. Klar for ledermøtet eller å sende til styret.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={download} disabled={downloading}
                startIcon={downloading ? <CircularProgress size={16} /> : <FileDownloadIcon />}>
          {downloading ? "Genererer…" : `Last ned ${mode === "summary" ? "rapport (PDF)" : format.toUpperCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ModeCard({ selected, icon, title, desc, onClick, value }: {
  selected: boolean; icon: React.ReactNode; title: string; desc: string;
  onClick: () => void; value: string;
}) {
  return (
    <FormControlLabel value={value} control={<Radio />}
      label={
        <Box onClick={onClick} sx={{
          display: "flex", alignItems: "flex-start", gap: 1.5,
          p: 1.5, border: "1px solid",
          borderColor: selected ? "primary.main" : "divider",
          borderRadius: 1, cursor: "pointer", flex: 1,
          transition: "all 0.15s",
        }}>
          <Box>{icon}</Box>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{desc}</Typography>
          </Box>
        </Box>
      }
      sx={{ alignItems: "flex-start", m: 0, mb: 1, "& .MuiFormControlLabel-label": { flex: 1 } }} />
  );
}
