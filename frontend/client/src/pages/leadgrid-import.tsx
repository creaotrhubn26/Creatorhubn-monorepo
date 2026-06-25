/**
 * leadgrid-import.tsx — /leadgrid/import
 *
 * 2-tabs lead-import-flow (mig 328 + leadgrid-import-routes.ts):
 *
 *   Tab 1: CSV/Excel — 3-stegs wizard
 *     Steg 1: Last opp fil    → /api/leadgrid/import/csv/preview
 *     Steg 2: Map kolonner
 *     Steg 3: Bekreft + commit → /api/leadgrid/import/csv/commit
 *
 *   Tab 2: URL/SoMe — lim inn 1-20 URLer
 *     Scrape → /api/leadgrid/import/url/scrape
 *     Velg leads + commit → /api/leadgrid/import/url/commit
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  Box, Container, Stack, Typography, Card, CardContent, Button, Tabs, Tab,
  Stepper, Step, StepLabel, Alert, LinearProgress, CircularProgress,
  TextField, MenuItem, Select, FormControl, InputLabel, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Checkbox, Chip,
  IconButton, Divider,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LanguageIcon from "@mui/icons-material/Language";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

// =====================================================================
// Felles kolonne-felt vi tilbyr i column-mapping
// =====================================================================
const TARGET_FIELDS: Array<{
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}> = [
  { key: "name", label: "Bedriftsnavn", required: true, hint: "Kreves" },
  { key: "company", label: "Firma (hvis ulik fra navn)" },
  { key: "email", label: "E-post" },
  { key: "phone", label: "Telefon" },
  { key: "address", label: "Adresse" },
  { key: "postal_code", label: "Postnummer" },
  { key: "city", label: "By" },
  { key: "country", label: "Land (NO/SE/...)" },
  { key: "website_url", label: "Nettside" },
  { key: "industry", label: "Bransje" },
  { key: "notes", label: "Notater" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "instagram_url", label: "Instagram URL" },
  { key: "facebook_url", label: "Facebook URL" },
  { key: "employee_count_estimate", label: "Antall ansatte" },
  { key: "lead_quality_score", label: "Lead score (0-100)" },
];

type DedupeStrategy = "email" | "phone" | "name+city" | "none";

interface PreviewResponse {
  file_token: string;
  file_name: string;
  columns: string[];
  rows: Record<string, string>[];
  total_rows: number;
}

interface CommitResponse {
  batch_id: string;
  imported: number;
  skipped_duplicates: number;
  errors: Array<{ row?: number; index?: number; error: string }>;
  errors_count: number;
}

interface ScrapeResultItem {
  url: string;
  lead?: {
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
    company: string | null;
    website_url: string | null;
    industry: string | null;
    country: string | null;
    linkedin_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    employee_count_estimate: number | null;
    lead_quality_score: number | null;
    notes: string | null;
    raw?: Record<string, unknown>;
  };
  error?: string;
}

// =====================================================================
// Felles helpers
// =====================================================================

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("creatorhub_auth_token");
  const h: Record<string, string> = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

// =====================================================================
// Page-shell
// =====================================================================
export default function LeadgridImportPage() {
  const [tab, setTab] = useState<"csv" | "url">("csv");

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f7f5fb", py: 6 }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ color: "#7c3aed", fontWeight: 700, letterSpacing: 1.5 }}>
              Leadgrid · Import
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              Importer leads
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary" }}>
              Last opp CSV/Excel fra eksisterende CRM, eller la Claude ekstrahere data direkte fra
              bedriftsnettsider og sosiale medier.
            </Typography>
          </Stack>

          <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
            >
              <Tab
                value="csv"
                icon={<UploadFileIcon />}
                iconPosition="start"
                label="CSV / Excel"
              />
              <Tab
                value="url"
                icon={<LanguageIcon />}
                iconPosition="start"
                label="Fra nettside / SoMe"
              />
            </Tabs>
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              {tab === "csv" ? <CsvImportFlow /> : <UrlImportFlow />}
            </CardContent>
          </Card>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ color: "text.secondary", fontSize: 14 }}
          >
            <Box>
              <strong>Gjenbruk:</strong> Importerte leads havner i Lead Map med kilde{" "}
              <code>csv_import</code> eller <code>url_extract</code>.
            </Box>
            <Box>
              <strong>Rate-limit URL:</strong> 20 URLer / minutt / bruker (Claude-cost-control).
            </Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// =====================================================================
// CSV / Excel flow
// =====================================================================
function CsvImportFlow() {
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dedupe, setDedupe] = useState<DedupeStrategy>("email");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0);
    setPreview(null);
    setMapping({});
    setDedupe("email");
    setCommitResult(null);
    setError(null);
  };

  const onUpload = useCallback(async (file: File) => {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/leadgrid/import/csv/preview", {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: fd,
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`${resp.status}: ${t || resp.statusText}`);
      }
      const data = (await resp.json()) as PreviewResponse;
      setPreview(data);
      // Smart auto-mapping: leter etter typiske kolonne-headers
      const auto: Record<string, string> = {};
      const lower = data.columns.map((c) => c.toLowerCase().trim());
      const findCol = (candidates: string[]) => {
        for (const cand of candidates) {
          const idx = lower.findIndex((c) =>
            c === cand || c.includes(cand),
          );
          if (idx >= 0) return data.columns[idx];
        }
        return undefined;
      };
      const nameCol = findCol(["bedrift", "firma", "navn", "company", "name"]);
      if (nameCol) auto.name = nameCol;
      const emailCol = findCol(["e-post", "epost", "email", "mail"]);
      if (emailCol) auto.email = emailCol;
      const phoneCol = findCol(["telefon", "phone", "tlf", "mobil"]);
      if (phoneCol) auto.phone = phoneCol;
      const cityCol = findCol(["by", "city", "sted", "poststed"]);
      if (cityCol) auto.city = cityCol;
      const addrCol = findCol(["adresse", "address", "gate"]);
      if (addrCol) auto.address = addrCol;
      const websiteCol = findCol(["nettside", "website", "web", "url"]);
      if (websiteCol) auto.website_url = websiteCol;
      const industryCol = findCol(["bransje", "industry", "industri"]);
      if (industryCol) auto.industry = industryCol;
      setMapping(auto);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const onCommit = useCallback(async () => {
    if (!preview) return;
    setCommitting(true);
    setError(null);
    try {
      const data = await postJson<CommitResponse>(
        "/api/leadgrid/import/csv/commit",
        {
          file_token: preview.file_token,
          mapping,
          dedupe_strategy: dedupe,
        },
      );
      setCommitResult(data);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [preview, mapping, dedupe]);

  return (
    <Stack spacing={3}>
      <Stepper activeStep={step} alternativeLabel>
        <Step><StepLabel>Last opp fil</StepLabel></Step>
        <Step><StepLabel>Map kolonner</StepLabel></Step>
        <Step><StepLabel>Bekreft</StepLabel></Step>
      </Stepper>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {step === 0 && <CsvUploadStep onUpload={onUpload} />}

      {step === 1 && preview && (
        <CsvMappingStep
          preview={preview}
          mapping={mapping}
          setMapping={setMapping}
          dedupe={dedupe}
          setDedupe={setDedupe}
          onNext={onCommit}
          onBack={() => setStep(0)}
          committing={committing}
        />
      )}

      {step === 2 && commitResult && (
        <CsvSuccessStep result={commitResult} onReset={reset} />
      )}
    </Stack>
  );
}

function CsvUploadStep({ onUpload }: { onUpload: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      sx={{
        border: "2px dashed",
        borderColor: dragOver ? "#7c3aed" : "#cbd5e1",
        borderRadius: 3,
        p: 6,
        textAlign: "center",
        bgcolor: dragOver ? "rgba(124,58,237,0.05)" : "#fbfafe",
        transition: "all .15s",
      }}
    >
      <UploadFileIcon sx={{ fontSize: 48, color: "#7c3aed", mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Dra inn CSV eller Excel-fil
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Maks 10 MB. Vi støtter <code>.csv</code>, <code>.xlsx</code> og <code>.xls</code>.
      </Typography>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.xlsm"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
      <Button
        variant="contained"
        sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
        onClick={() => inputRef.current?.click()}
      >
        Velg fil
      </Button>
    </Box>
  );
}

function CsvMappingStep({
  preview, mapping, setMapping, dedupe, setDedupe,
  onNext, onBack, committing,
}: {
  preview: PreviewResponse;
  mapping: Record<string, string>;
  setMapping: (m: Record<string, string>) => void;
  dedupe: DedupeStrategy;
  setDedupe: (d: DedupeStrategy) => void;
  onNext: () => void;
  onBack: () => void;
  committing: boolean;
}) {
  const nameMapped = Boolean(mapping.name);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Forhåndsvisning · <code>{preview.file_name}</code> · {preview.total_rows} rader
        </Typography>
        <TableContainer sx={{ maxHeight: 240, border: "1px solid #e5e7eb", borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {preview.columns.map((c) => (
                  <TableCell key={c} sx={{ fontWeight: 700, bgcolor: "#f3f0fa" }}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.rows.slice(0, 5).map((row, i) => (
                <TableRow key={i}>
                  {preview.columns.map((c) => (
                    <TableCell key={c} sx={{ fontSize: 12 }}>{row[c] || "—"}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Viser de 5 første radene av {preview.rows.length} i preview.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Map kolonner til Leadgrid-felter</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          {TARGET_FIELDS.map((field) => (
            <FormControl key={field.key} fullWidth size="small">
              <InputLabel>{field.label}{field.required ? " *" : ""}</InputLabel>
              <Select
                label={field.label + (field.required ? " *" : "")}
                value={mapping[field.key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value as string;
                  const m = { ...mapping };
                  if (v === "") delete m[field.key];
                  else m[field.key] = v;
                  setMapping(m);
                }}
              >
                <MenuItem value="">— ikke importér —</MenuItem>
                {preview.columns.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Duplikat-strategi</Typography>
        <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
          <Select value={dedupe} onChange={(e) => setDedupe(e.target.value as DedupeStrategy)}>
            <MenuItem value="email">E-post (anbefalt)</MenuItem>
            <MenuItem value="phone">Telefon</MenuItem>
            <MenuItem value="name+city">Navn + by</MenuItem>
            <MenuItem value="none">Ingen — importér alt (kan gi duplikater)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {!nameMapped && (
        <Alert severity="warning">
          Du må mappe minst <strong>Bedriftsnavn</strong> for å fortsette.
        </Alert>
      )}

      <Stack direction="row" spacing={2}>
        <Button onClick={onBack} startIcon={<ArrowBackIcon />} disabled={committing}>
          Tilbake
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          onClick={onNext}
          disabled={!nameMapped || committing}
          endIcon={committing ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
          sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
        >
          {committing ? `Importerer ${preview.total_rows} rader…` : `Importér ${preview.total_rows} rader`}
        </Button>
      </Stack>
      {committing && <LinearProgress />}
    </Stack>
  );
}

function CsvSuccessStep({ result, onReset }: { result: CommitResponse; onReset: () => void }) {
  return (
    <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: 4 }}>
      <CheckCircleIcon sx={{ fontSize: 64, color: "#10b981" }} />
      <Typography variant="h5" fontWeight={800}>
        {result.imported} leads importert
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
        <Chip label={`Importert: ${result.imported}`} color="success" />
        <Chip label={`Hoppet over (dupl.): ${result.skipped_duplicates}`} color="warning" />
        {result.errors_count > 0 && (
          <Chip label={`Feil: ${result.errors_count}`} color="error" />
        )}
      </Stack>
      {result.errors.length > 0 && (
        <Box sx={{ maxWidth: 600, width: "100%", textAlign: "left" }}>
          <Typography variant="subtitle2" gutterBottom>Eksempler på feil:</Typography>
          <Stack spacing={0.5}>
            {result.errors.slice(0, 5).map((e, i) => (
              <Typography key={i} variant="caption" sx={{ fontFamily: "monospace" }}>
                Rad {e.row ?? e.index}: {e.error}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={onReset}>
          Importér ny fil
        </Button>
        <Button
          variant="contained"
          href="/leadgrid"
          sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
        >
          Tilbake til Leadgrid
        </Button>
      </Stack>
    </Stack>
  );
}

// =====================================================================
// URL-import flow
// =====================================================================
function UrlImportFlow() {
  const [urlText, setUrlText] = useState("");
  const [scraping, setScraping] = useState(false);
  const [results, setResults] = useState<ScrapeResultItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const urls = useMemo(
    () => urlText.split(/\r?\n/).map((u) => u.trim()).filter(Boolean),
    [urlText],
  );

  const onScrape = useCallback(async () => {
    setError(null);
    setCommitResult(null);
    if (urls.length === 0) {
      setError("Lim inn minst én URL.");
      return;
    }
    if (urls.length > 20) {
      setError("Maks 20 URLer per batch.");
      return;
    }
    setScraping(true);
    try {
      const data = await postJson<{ results: ScrapeResultItem[] }>(
        "/api/leadgrid/import/url/scrape",
        { urls },
      );
      setResults(data.results);
      const selectedSet = new Set<number>();
      data.results.forEach((r, i) => {
        if (r.lead) selectedSet.add(i);
      });
      setSelected(selectedSet);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScraping(false);
    }
  }, [urls]);

  const onCommit = useCallback(async () => {
    setError(null);
    const leads = Array.from(selected)
      .map((idx) => results[idx])
      .filter((r) => r?.lead)
      .map((r) => r.lead!);
    if (leads.length === 0) {
      setError("Velg minst én lead å importere.");
      return;
    }
    setCommitting(true);
    try {
      const data = await postJson<CommitResponse>(
        "/api/leadgrid/import/url/commit",
        { leads, dedupe_strategy: "email" },
      );
      setCommitResult(data);
      setResults([]);
      setSelected(new Set());
      setUrlText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [results, selected]);

  if (commitResult) {
    return (
      <CsvSuccessStep
        result={commitResult}
        onReset={() => setCommitResult(null)}
      />
    );
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box>
        <Typography variant="h6" gutterBottom>Lim inn URL-er</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Én URL per linje. Vi støtter vanlige nettsider, <code>linkedin.com/company/...</code> og{" "}
          <code>instagram.com/profil</code>. Claude leser sidene og ekstraherer firma-data.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={6}
          placeholder={"https://acme.no\nhttps://linkedin.com/company/beta\nhttps://instagram.com/gamma"}
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          sx={{ fontFamily: "monospace" }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {urls.length} / 20 URL-er · rate-limit 20/min
          </Typography>
          <Button
            variant="contained"
            onClick={onScrape}
            disabled={scraping || urls.length === 0}
            endIcon={scraping ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
            sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
          >
            {scraping ? "Ekstraherer …" : `Ekstraher ${urls.length || ""} URL-er`}
          </Button>
        </Stack>
        {scraping && <LinearProgress sx={{ mt: 2 }} />}
      </Box>

      {results.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Resultat ({results.filter((r) => r.lead).length} OK / {results.filter((r) => r.error).length} feil)</Typography>
            <Button
              variant="contained"
              onClick={onCommit}
              disabled={committing || selected.size === 0}
              endIcon={committing ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
              sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
            >
              Importér {selected.size} valgte
            </Button>
          </Stack>
          <Stack spacing={1}>
            {results.map((r, i) => (
              <UrlResultRow
                key={i}
                idx={i}
                item={r}
                selected={selected.has(i)}
                onToggle={() => {
                  const next = new Set(selected);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  setSelected(next);
                }}
                onEdit={(patch) => {
                  const next = [...results];
                  if (next[i].lead) {
                    next[i] = { ...next[i], lead: { ...next[i].lead!, ...patch } };
                  }
                  setResults(next);
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function UrlResultRow({
  idx, item, selected, onToggle, onEdit,
}: {
  idx: number;
  item: ScrapeResultItem;
  selected: boolean;
  onToggle: () => void;
  onEdit: (patch: Partial<NonNullable<ScrapeResultItem["lead"]>>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (item.error) {
    return (
      <Box sx={{
        p: 2, border: "1px solid #fecaca", borderRadius: 1, bgcolor: "#fef2f2",
      }}>
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
          ❌ {item.url}
        </Typography>
        <Typography variant="caption" sx={{ color: "#b91c1c" }}>
          Feil: {item.error}
        </Typography>
      </Box>
    );
  }
  const lead = item.lead!;
  return (
    <Box sx={{
      p: 2, border: "1px solid #e5e7eb", borderRadius: 1, bgcolor: "#fff",
    }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Checkbox checked={selected} onChange={onToggle} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {lead.name || "(uten navn)"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            {item.url}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
            {lead.email && <Chip size="small" label={lead.email} />}
            {lead.phone && <Chip size="small" label={lead.phone} />}
            {lead.city && <Chip size="small" label={lead.city} />}
            {lead.country && <Chip size="small" label={lead.country} />}
            {lead.industry && <Chip size="small" label={lead.industry} variant="outlined" />}
            {typeof lead.lead_quality_score === "number" && (
              <Chip
                size="small"
                label={`Score ${lead.lead_quality_score}`}
                sx={{ bgcolor: "#ede9fe", color: "#6d28d9" }}
              />
            )}
          </Stack>
        </Box>
        <IconButton onClick={() => setExpanded((v) => !v)}>
          {expanded ? <DeleteOutlineIcon /> : <ArrowForwardIcon />}
        </IconButton>
      </Stack>
      {expanded && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <TextField
            label="Bedriftsnavn"
            size="small"
            fullWidth
            value={lead.name || ""}
            onChange={(e) => onEdit({ name: e.target.value })}
          />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              label="E-post"
              size="small"
              fullWidth
              value={lead.email || ""}
              onChange={(e) => onEdit({ email: e.target.value })}
            />
            <TextField
              label="Telefon"
              size="small"
              fullWidth
              value={lead.phone || ""}
              onChange={(e) => onEdit({ phone: e.target.value })}
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              label="Adresse"
              size="small"
              fullWidth
              value={lead.address || ""}
              onChange={(e) => onEdit({ address: e.target.value })}
            />
            <TextField
              label="By"
              size="small"
              fullWidth
              value={lead.city || ""}
              onChange={(e) => onEdit({ city: e.target.value })}
            />
          </Stack>
          {lead.notes && (
            <Box sx={{ fontSize: 13, color: "text.secondary" }}>
              <Divider sx={{ mb: 1 }} />
              {lead.notes}
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}
