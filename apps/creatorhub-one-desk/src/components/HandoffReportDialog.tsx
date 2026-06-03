import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DescriptionIcon from "@mui/icons-material/Description";
import { save } from "@tauri-apps/plugin-dialog";
import {
  exportHandoffReport,
  generateHandoffReport,
  ReportData,
  saveSessionNote,
} from "../api";

interface Props {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function HandoffReportDialog({ sessionId, open, onClose }: Props) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    setLoading(true);
    setError(null);
    generateHandoffReport(sessionId)
      .then((r) => {
        setReport(r);
        setNote(r.note);
      })
      .catch((e) => setError(typeof e === "string" ? e : String(e)))
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  const handleSaveNote = async () => {
    if (!sessionId) return;
    setSavingNote(true);
    try {
      await saveSessionNote(sessionId, note);
      // Re-generer rapport så markdown speiler oppdatert notat
      const fresh = await generateHandoffReport(sessionId);
      setReport(fresh);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setSavingNote(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopyStatus("Markdown kopiert");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (e) {
      setError(`Kopiering feilet: ${e}`);
    }
  };

  const handleExportMarkdown = async () => {
    if (!report) return;
    try {
      const fname = `handoff-${report.volume_label.replace(/[^A-Za-z0-9_-]/g, "_")}-${report.session_id}.md`;
      const path = await save({
        defaultPath: fname,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await exportHandoffReport(report.session_id, path);
      setCopyStatus(`Lagret: ${path}`);
      setTimeout(() => setCopyStatus(null), 3000);
    } catch (e) {
      setError(`Eksport feilet: ${e}`);
    }
  };

  const handleMailto = () => {
    if (!report) return;
    const subject = `Backup-rapport ${report.volume_label} (${new Date(report.started_at_ms).toLocaleDateString("nb-NO")})`;
    // mailto: har URL-grenser; kort body med lenke til lokal markdown anbefales,
    // men her sender vi alt så det fungerer uten ekstra steg for små rapporter.
    const body = report.markdown;
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(href, "_blank");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Handoff-rapport
          </Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {report?.volume_label || "Backup-økt"}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {copyStatus && <Alert severity="success" sx={{ mb: 2 }}>{copyStatus}</Alert>}
        {report && (
          <Stack spacing={3}>
            {/* Sammendrag-chips */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip label={`${report.totals.file_count} filer`} color="primary" />
              <Chip label={humanBytes(report.totals.total_bytes)} />
              <Chip
                label={`${report.totals.verified_count} / ${report.totals.success_count} verifisert (xxHash64)`}
                color="success"
                variant="outlined"
              />
              {report.totals.failed_count > 0 && (
                <Chip label={`${report.totals.failed_count} feil`} color="error" />
              )}
              {report.totals.skipped_count > 0 && (
                <Chip label={`${report.totals.skipped_count} hoppet`} variant="outlined" />
              )}
            </Stack>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Per kamera</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Kamera</TableCell>
                    <TableCell align="right">Filer</TableCell>
                    <TableCell align="right">Størrelse</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.cameras.map((c) => (
                    <TableRow key={c.label}>
                      <TableCell>{c.label}</TableCell>
                      <TableCell align="right">{c.files}</TableCell>
                      <TableCell align="right">{humanBytes(c.bytes)}</TableCell>
                    </TableRow>
                  ))}
                  {report.cameras.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ color: "text.secondary" }}>
                        Ingen filer kopiert
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Per destinasjon</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Destinasjon</TableCell>
                    <TableCell align="right">Filer</TableCell>
                    <TableCell align="right">Størrelse</TableCell>
                    <TableCell align="right">Feil</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.destinations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {d.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                          {d.path}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{d.files}</TableCell>
                      <TableCell align="right">{humanBytes(d.bytes)}</TableCell>
                      <TableCell align="right">
                        {d.failures > 0 ? (
                          <Chip size="small" label={d.failures} color="error" />
                        ) : (
                          <Typography variant="caption" color="success.main">✓</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            {report.failures.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error" sx={{ mb: 1 }}>
                  Feil-detaljer ({report.failures.length})
                </Typography>
                <Stack spacing={0.5}>
                  {report.failures.map((f, i) => (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{ fontFamily: "monospace", fontSize: 11 }}
                    >
                      {f.source_path.split("/").pop()} → {f.dest_id}: {f.error}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Notater til produsent
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder="F.eks. «Kort 3 ga clicking-sound midt på dagen, byttet til reserve.» Notatet legges nederst i rapporten."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                size="small"
                onClick={handleSaveNote}
                disabled={savingNote || note === report.note}
                sx={{ mt: 1 }}
              >
                {savingNote ? "Lagrer…" : "Lagre notat"}
              </Button>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ flex: 1, color: "text.secondary" }}>
          {report && (
            <Typography variant="caption">
              Session-ID: <code>{report.session_id}</code>
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Tooltip title="Kopier markdown til utklippstavlen">
            <span>
              <Button
                onClick={handleCopyMarkdown}
                startIcon={<ContentCopyIcon />}
                disabled={!report}
              >
                Kopier
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Lagre rapport som .md-fil">
            <span>
              <Button
                onClick={handleExportMarkdown}
                startIcon={<DescriptionIcon />}
                disabled={!report}
              >
                Eksporter
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            onClick={handleMailto}
            startIcon={<EmailIcon />}
            disabled={!report}
          >
            Send til produsent
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
