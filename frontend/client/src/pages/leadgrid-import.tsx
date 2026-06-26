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
 *   Tab 2: URL Research — iPad-native flate. Web-versjonen viser kun
 *     en lenke til Leadgrid iPad-appen. Hele research-pipelinen
 *     (Brønnøysund + Google Places + Claude) kjører på iPad og
 *     ender med en pin på Lead Map.
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
              Last opp CSV/Excel fra eksisterende CRM. URL-Research er en
              iPad-native flate — bruk Leadgrid-appen for å gjøre research
              som ender med en pin på kartet.
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
                label="URL Research (iPad)"
              />
            </Tabs>
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              {tab === "csv" ? <CsvImportFlow /> : <UrlResearchIpadHint />}
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
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function UrlResearchIpadHint() {
  return (
    <Box sx={{ textAlign: "center", py: 6 }}>
      <LanguageIcon sx={{ fontSize: 64, color: "#7c3aed", mb: 2 }} />
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        URL Research lever i Leadgrid på iPad
      </Typography>
      <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 520, mx: "auto" }}>
        Selgeren limer inn nettsiden i feltet og Leadgrid Agent kjører hele
        research-pipelinen (Brønnøysund + Google Places + Claude). Resultatet
        blir en lead med pin på kartet — klar til å besøke.
      </Typography>
      <Typography variant="caption" sx={{ display: "block", mt: 3, color: "text.secondary" }}>
        Web-flaten støtter CSV/Excel-bulk-import; URL-Research er iPad-native.
      </Typography>
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
