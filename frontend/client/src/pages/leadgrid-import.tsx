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
 *   Tab 2: URL/Research — én URL, eksisterende Role Room Agent-stack
 *     Research → /api/leadgrid/import/url/research (runBrandScan +
 *                Market Scan, oppretter draft-lead)
 *     Preview → vis Brand Kit + Market Scan-status
 *     Commit  → /api/leadgrid/import/url/commit (accept/reject)
 *
 *   Ingen Claude-orchestration på frontend — vi gjenbruker eksisterende
 *   pipelines og viser bare resultatene direkte.
 */
import React, { useState, useCallback } from "react";
import {
  Box, Container, Stack, Typography, Card, CardContent, Button, Tabs, Tab,
  Stepper, Step, StepLabel, Alert, LinearProgress, CircularProgress,
  TextField, MenuItem, Select, FormControl, InputLabel, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  Divider, Avatar,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LanguageIcon from "@mui/icons-material/Language";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
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

// URL-research-respons fra /api/leadgrid/import/url/research.
// Speilet av LeadgridImportSheet.swift på iPad slik at backend-shape er
// kanonisk på tvers av klienter.
interface BrandKitSummary {
  id: string;
  source_url: string;
  business_name: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  target_audience: string | null;
  tone_of_voice: string | null;
  usps: string[];
  primary_cta: string | null;
  logo_url: string | null;
  colors: {
    primary: string | null;
    accent: string | null;
    secondary: string | null;
  };
  social_links: {
    linkedin: string | null;
    instagram: string | null;
    facebook: string | null;
  };
  last_scanned_at: string | null;
}

interface UrlResearchResult {
  draft_lead_id: string;
  brand_kit: BrandKitSummary | null;
  market_scan_id: string | null;
  status: "completed" | "partial" | "failed";
  error: string | null;
}

interface UrlCommitResult {
  ok: boolean;
  lead_id: string;
  status: "lead" | "rejected";
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
              Last opp CSV/Excel fra eksisterende CRM, eller research en URL via Role Room Agent
              (Brand Kit + Market Scan) og legg den til som lead.
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
                label="URL / Research"
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
              <code>csv_import</code> eller <code>url_research</code>.
            </Box>
            <Box>
              <strong>URL-flyten:</strong> bruker eksisterende <code>runBrandScan</code>{" "}
              + Market Scan — ingen separat Claude-orchestration.
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
// URL-research flow — gjenbruker runBrandScan + Market Scan på backend.
// Frontend har INGEN Claude-orchestration; vi viser kun resultater.
// =====================================================================
function UrlImportFlow() {
  const [urlText, setUrlText] = useState("");
  const [researching, setResearching] = useState(false);
  const [research, setResearch] = useState<UrlResearchResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<UrlCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Brukerens overrides før accept
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const normalizedUrl = (() => {
    const t = urlText.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  })();

  const reset = useCallback(() => {
    setUrlText("");
    setResearch(null);
    setCommitted(null);
    setError(null);
    setEditName("");
    setEditEmail("");
    setEditPhone("");
    setEditCity("");
    setEditNotes("");
  }, []);

  const onResearch = useCallback(async () => {
    setError(null);
    setCommitted(null);
    if (!normalizedUrl) {
      setError("Skriv inn en gyldig URL.");
      return;
    }
    setResearching(true);
    try {
      const data = await postJson<UrlResearchResult>(
        "/api/leadgrid/import/url/research",
        { url: normalizedUrl },
      );
      setResearch(data);
      // Pre-fyll overrides fra brand-kit
      setEditName(data.brand_kit?.business_name ?? "");
      setEditNotes(data.brand_kit?.description ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResearching(false);
    }
  }, [normalizedUrl]);

  const onCommit = useCallback(
    async (accept: boolean) => {
      if (!research) return;
      setError(null);
      setCommitting(true);
      try {
        const overrides = accept
          ? {
              name: editName.trim() || undefined,
              email: editEmail.trim() || undefined,
              phone: editPhone.trim() || undefined,
              city: editCity.trim() || undefined,
              notes: editNotes.trim() || undefined,
            }
          : undefined;
        const data = await postJson<UrlCommitResult>(
          "/api/leadgrid/import/url/commit",
          {
            draft_lead_id: research.draft_lead_id,
            accept,
            overrides,
          },
        );
        setCommitted(data);
        setResearch(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setCommitting(false);
      }
    },
    [research, editName, editEmail, editPhone, editCity, editNotes],
  );

  if (committed) {
    return <UrlCommitSuccessStep result={committed} onReset={reset} />;
  }

  if (research) {
    return (
      <UrlPreviewStep
        result={research}
        editName={editName}
        editEmail={editEmail}
        editPhone={editPhone}
        editCity={editCity}
        editNotes={editNotes}
        setEditName={setEditName}
        setEditEmail={setEditEmail}
        setEditPhone={setEditPhone}
        setEditCity={setEditCity}
        setEditNotes={setEditNotes}
        committing={committing}
        onCommit={onCommit}
        onTryAgain={reset}
        error={error}
      />
    );
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box>
        <Typography variant="h6" gutterBottom>Research en URL som lead</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Lim inn én adresse — vi kjører <strong>Role Room Agent</strong> (Brand Kit + Market Scan)
          på den. Du får en preview-rapport, og kan velge om leaden skal inn på kartet.
        </Typography>
        <TextField
          fullWidth
          placeholder="acme.no eller https://acme.no"
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          sx={{ fontFamily: "monospace" }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Gjenbruker eksisterende brand-kit-cache · ingen ny Claude-cost per request.
          </Typography>
          <Button
            variant="contained"
            onClick={onResearch}
            disabled={researching || !normalizedUrl}
            endIcon={
              researching ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoAwesomeIcon />
              )
            }
            sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
          >
            {researching ? "Researcher …" : "Kjør research"}
          </Button>
        </Stack>
        {researching && <LinearProgress sx={{ mt: 2 }} />}
      </Box>
    </Stack>
  );
}

function UrlPreviewStep({
  result,
  editName, editEmail, editPhone, editCity, editNotes,
  setEditName, setEditEmail, setEditPhone, setEditCity, setEditNotes,
  committing, onCommit, onTryAgain, error,
}: {
  result: UrlResearchResult;
  editName: string;
  editEmail: string;
  editPhone: string;
  editCity: string;
  editNotes: string;
  setEditName: (v: string) => void;
  setEditEmail: (v: string) => void;
  setEditPhone: (v: string) => void;
  setEditCity: (v: string) => void;
  setEditNotes: (v: string) => void;
  committing: boolean;
  onCommit: (accept: boolean) => void;
  onTryAgain: () => void;
  error: string | null;
}) {
  const bk = result.brand_kit;

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      {bk ? (
        <>
          {/* Header card */}
          <Box sx={{
            p: 3, border: "1px solid #ede9fe", borderRadius: 2, bgcolor: "#faf7ff",
          }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              {bk.logo_url ? (
                <Avatar
                  src={bk.logo_url}
                  variant="rounded"
                  sx={{ width: 64, height: 64, bgcolor: "#fff" }}
                />
              ) : (
                <Avatar variant="rounded" sx={{ width: 64, height: 64, bgcolor: "#7c3aed" }}>
                  {(bk.business_name ?? "?").slice(0, 1)}
                </Avatar>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {bk.business_name ?? "(uten navn)"}
                </Typography>
                {bk.tagline && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {bk.tagline}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block", fontFamily: "monospace" }}
                >
                  {bk.source_url}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Brand Kit card */}
          <Box sx={{
            p: 3, border: "1px solid #e5e7eb", borderRadius: 2, bgcolor: "#fff",
          }}>
            <Typography variant="h6" gutterBottom sx={{ color: "#7c3aed" }}>
              Brand Kit
            </Typography>
            {bk.description && (
              <Typography variant="body2" sx={{ mb: 2 }}>
                {bk.description}
              </Typography>
            )}
            <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap" }}>
              <ColorSwatch hex={bk.colors.primary} label="Primær" />
              <ColorSwatch hex={bk.colors.accent} label="Aksent" />
              <ColorSwatch hex={bk.colors.secondary} label="Sekundær" />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1}>
              {bk.industry && <KeyValueRow k="Industri" v={bk.industry} />}
              {bk.target_audience && <KeyValueRow k="Målgruppe" v={bk.target_audience} />}
              {bk.tone_of_voice && <KeyValueRow k="Tone" v={bk.tone_of_voice} />}
              {bk.primary_cta && <KeyValueRow k="Hovedhandling" v={bk.primary_cta} />}
            </Stack>

            {bk.usps.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" sx={{ color: "text.secondary" }}>USPs</Typography>
                <Stack spacing={0.5}>
                  {bk.usps.map((u, i) => (
                    <Typography key={i} variant="body2">• {u}</Typography>
                  ))}
                </Stack>
              </>
            )}

            {(bk.social_links.linkedin || bk.social_links.instagram || bk.social_links.facebook) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={1}>
                  {bk.social_links.linkedin && (
                    <Chip size="small" label="LinkedIn" component="a" href={bk.social_links.linkedin} target="_blank" clickable />
                  )}
                  {bk.social_links.instagram && (
                    <Chip size="small" label="Instagram" component="a" href={bk.social_links.instagram} target="_blank" clickable />
                  )}
                  {bk.social_links.facebook && (
                    <Chip size="small" label="Facebook" component="a" href={bk.social_links.facebook} target="_blank" clickable />
                  )}
                </Stack>
              </>
            )}
          </Box>

          {/* Market scan card */}
          {result.market_scan_id && (
            <Box sx={{
              p: 3, border: "1px solid #ede9fe", borderRadius: 2, bgcolor: "#faf7ff",
            }}>
              <Typography variant="h6" sx={{ color: "#7c3aed" }}>
                Market Scan opprettet
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Konkurrenter og posisjonering er klare for full Claude-analyse. Legg leaden til —
                så kjører du <code>Run Agent Scan</code> fra lead-detaljen for SWOT og opportunities.
              </Typography>
            </Box>
          )}

          {/* Overrides */}
          <Box sx={{
            p: 3, border: "1px solid #e5e7eb", borderRadius: 2, bgcolor: "#fff",
          }}>
            <Typography variant="h6" gutterBottom>Justér før lagring</Typography>
            <Stack spacing={2}>
              <TextField
                label="Navn" size="small" fullWidth
                value={editName} onChange={(e) => setEditName(e.target.value)}
              />
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="E-post" size="small" fullWidth
                  value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                />
                <TextField
                  label="Telefon" size="small" fullWidth
                  value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                />
              </Stack>
              <TextField
                label="By" size="small" fullWidth
                value={editCity} onChange={(e) => setEditCity(e.target.value)}
              />
              <TextField
                label="Notater" size="small" fullWidth multiline minRows={2}
                value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
              />
            </Stack>
          </Box>

          {/* Actions */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => onCommit(false)}
              disabled={committing}
            >
              Forkast
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              onClick={onTryAgain}
              disabled={committing}
              startIcon={<ArrowBackIcon />}
            >
              Ny URL
            </Button>
            <Button
              variant="contained"
              onClick={() => onCommit(true)}
              disabled={committing}
              endIcon={committing ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
              sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
            >
              {committing ? "Lagrer …" : "Legg til som lead"}
            </Button>
          </Stack>
        </>
      ) : (
        <UrlResearchFailed result={result} onCommit={onCommit} onTryAgain={onTryAgain} committing={committing} />
      )}
    </Stack>
  );
}

function UrlResearchFailed({
  result, onCommit, onTryAgain, committing,
}: {
  result: UrlResearchResult;
  onCommit: (accept: boolean) => void;
  onTryAgain: () => void;
  committing: boolean;
}) {
  return (
    <Box sx={{
      p: 4, border: "1px solid #fed7aa", borderRadius: 2, bgcolor: "#fffbeb",
      textAlign: "center",
    }}>
      <Typography variant="h6" gutterBottom>
        Brand Kit-scan feilet
      </Typography>
      {result.error && (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {result.error}
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
        Draft-leaden er opprettet. Du kan beholde den manuelt eller forkaste.
      </Typography>
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          variant="outlined"
          color="error"
          onClick={() => onCommit(false)}
          disabled={committing}
        >
          Forkast
        </Button>
        <Button
          variant="contained"
          onClick={() => onCommit(true)}
          disabled={committing}
          sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
        >
          Behold likevel
        </Button>
        <Button onClick={onTryAgain} disabled={committing}>
          Prøv ny URL
        </Button>
      </Stack>
    </Box>
  );
}

function UrlCommitSuccessStep({
  result, onReset,
}: { result: UrlCommitResult; onReset: () => void }) {
  return (
    <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: 4 }}>
      {result.status === "lead" ? (
        <CheckCircleIcon sx={{ fontSize: 64, color: "#10b981" }} />
      ) : (
        <DeleteOutlineIcon sx={{ fontSize: 64, color: "#9ca3af" }} />
      )}
      <Typography variant="h5" fontWeight={800}>
        {result.status === "lead" ? "Lead lagt til" : "Draft forkastet"}
      </Typography>
      {result.status === "lead" && (
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 480 }}>
          Åpne lead-detaljen for å se SWOT-analyse fra Market Scan når Role Room Agent er ferdig.
        </Typography>
      )}
      <Stack direction="row" spacing={2}>
        <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={onReset}>
          Importér ny URL
        </Button>
        {result.status === "lead" && (
          <Button
            variant="contained"
            href="/leadgrid"
            sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
          >
            Til Leadgrid
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

function ColorSwatch({ hex, label }: { hex: string | null; label: string }) {
  return (
    <Box sx={{ textAlign: "center" }}>
      <Box sx={{
        width: 56, height: 28, borderRadius: 1,
        bgcolor: hex ?? "#f3f4f6",
        border: "1px solid rgba(0,0,0,0.08)",
      }} />
      <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
        {label}
      </Typography>
      {hex && (
        <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.disabled" }}>
          {hex}
        </Typography>
      )}
    </Box>
  );
}

function KeyValueRow({ k, v }: { k: string; v: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>{k}</Typography>
      <Typography variant="caption" sx={{ textAlign: "right" }}>{v}</Typography>
    </Stack>
  );
}
