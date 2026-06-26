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
import LocationOnIcon from "@mui/icons-material/LocationOn";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import MapIcon from "@mui/icons-material/Map";

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
                label="URL Research"
              />
            </Tabs>
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              {tab === "csv" ? <CsvImportFlow /> : <UrlResearchBulkFlow />}
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

// =====================================================================
// URL Research bulk-flow (mig 0351)
// =====================================================================

type LocationConfidence = "exact" | "geocoded" | "approximate" | "unknown";
type BatchStatus = "pending" | "running" | "completed" | "failed" | "partial" | "cancelled";
type ItemStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface BulkBatchStartResponse {
  batch_id: string;
  total_urls: number;
  accepted_urls: number;
  rejected_urls: string[];
}

interface BulkBatchProgress {
  batch_id: string;
  status: BatchStatus;
  progress: {
    completed: number;
    failed: number;
    pinned: number;
    total: number;
  };
  eta_seconds: number | null;
}

interface BulkBatchItem {
  id: string;
  url: string;
  order_index: number;
  status: ItemStatus;
  draft_lead_id: string | null;
  has_pin: boolean;
  location_confidence: LocationConfidence | null;
  error_message: string | null;
  research_result: {
    companyProfile?: {
      name?: string | null;
      company?: string | null;
    };
  } | null;
}

interface BulkBatchDetail {
  batch: {
    id: string;
    total_urls: number;
    completed_urls: number;
    failed_urls: number;
    pinned_leads: number;
    status: BatchStatus;
    started_at: string | null;
    finished_at: string | null;
  };
  items: BulkBatchItem[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    pinned: number;
    pending: number;
  };
}

function isActive(status: BatchStatus): boolean {
  return status === "pending" || status === "running";
}

function UrlResearchBulkFlow() {
  const [urlsText, setUrlsText] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [totalUrls, setTotalUrls] = useState(0);
  const [progress, setProgress] = useState<BulkBatchProgress | null>(null);
  const [detail, setDetail] = useState<BulkBatchDetail | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedUrls = useMemo(() => {
    return urlsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [urlsText]);

  const start = useCallback(async () => {
    if (parsedUrls.length === 0) return;
    if (parsedUrls.length > 100) {
      setError("Maks 100 URL-er per batch.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const resp = await postJson<BulkBatchStartResponse>(
        "/api/leadgrid/url-research/batch",
        { urls: parsedUrls },
      );
      setBatchId(resp.batch_id);
      setTotalUrls(resp.total_urls);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }, [parsedUrls]);

  const reset = useCallback(() => {
    setBatchId(null);
    setProgress(null);
    setDetail(null);
    setUrlsText("");
    setTotalUrls(0);
    setError(null);
  }, []);

  // Polling
  React.useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const [p, d] = await Promise.all([
          fetch(`/api/leadgrid/url-research/batches/${batchId}/poll`, {
            headers: authHeaders(),
            credentials: "include",
          }).then((r) => r.json() as Promise<BulkBatchProgress>),
          fetch(`/api/leadgrid/url-research/batches/${batchId}`, {
            headers: authHeaders(),
            credentials: "include",
          }).then((r) => r.json() as Promise<BulkBatchDetail>),
        ]);
        if (cancelled) return;
        setProgress(p);
        setDetail(d);
        if (isActive(p.status)) {
          timer = setTimeout(tick, 2000);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [batchId]);

  const cancel = useCallback(async () => {
    if (!batchId) return;
    try {
      await postJson(`/api/leadgrid/url-research/batches/${batchId}/cancel`, {});
    } catch (e) {
      setError((e as Error).message);
    }
  }, [batchId]);

  if (!batchId) {
    // Input-stage
    return (
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Lim inn URL-er (1-100, én per linje)
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Leadgrid Agent kjører hele research-pipelinen (Brønnøysund + Google Places + Claude) på hver URL og rapporterer live: <strong>"X av Y leads lagt til på kartet"</strong>.
          </Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        <TextField
          multiline
          rows={10}
          fullWidth
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={"acme.no\nhttps://example.com\nbedrift.no"}
          variant="outlined"
          InputProps={{
            sx: { fontFamily: "monospace", fontSize: 14 },
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: parsedUrls.length > 100 ? "error.main" : "text.secondary",
            }}
          >
            {parsedUrls.length} URL-er klare {parsedUrls.length > 100 && "— maks 100"}
          </Typography>
          <Button
            variant="contained"
            disabled={parsedUrls.length === 0 || parsedUrls.length > 100 || starting}
            onClick={start}
            startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
            sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
          >
            {starting ? "Starter…" : "Start research"}
          </Button>
        </Stack>
      </Stack>
    );
  }

  // Running / done
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {progress && (
        <BulkProgressHeader
          progress={progress}
          totalUrls={totalUrls}
          onCancel={cancel}
          onReset={reset}
        />
      )}
      {detail && progress && !isActive(progress.status) && (
        <BulkSuccessBanner detail={detail} progress={progress} onReset={reset} />
      )}
      {detail && <BulkItemList detail={detail} />}
    </Stack>
  );
}

function BulkProgressHeader({
  progress,
  totalUrls,
  onCancel,
  onReset,
}: {
  progress: BulkBatchProgress;
  totalUrls: number;
  onCancel: () => void;
  onReset: () => void;
}) {
  const fraction = totalUrls > 0
    ? ((progress.progress.completed + progress.progress.failed) / totalUrls) * 100
    : 0;
  const counterLine = isActive(progress.status)
    ? `Behandler ${progress.progress.completed + progress.progress.failed} av ${progress.progress.total} URL-er…`
    : `${progress.progress.pinned} av ${progress.progress.total} leads lagt til på kartet`;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {counterLine}
        </Typography>
        {progress.eta_seconds && progress.eta_seconds > 0 && (
          <Chip
            label={`~${progress.eta_seconds}s igjen`}
            size="small"
            sx={{ fontFamily: "monospace" }}
          />
        )}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={fraction}
        sx={{
          height: 10,
          borderRadius: 5,
          bgcolor: "#ede9fe",
          "& .MuiLinearProgress-bar": { bgcolor: "#7c3aed" },
        }}
      />
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Chip
          icon={<CheckCircleIcon />}
          label={`${progress.progress.completed} ferdig`}
          color="success"
          size="small"
        />
        {progress.progress.failed > 0 && (
          <Chip
            icon={<ErrorOutlineIcon />}
            label={`${progress.progress.failed} feilet`}
            color="error"
            size="small"
          />
        )}
        <Chip
          icon={<LocationOnIcon />}
          label={`${progress.progress.pinned} pin`}
          sx={{ bgcolor: "#ede9fe", color: "#7c3aed" }}
          size="small"
        />
      </Stack>
      {isActive(progress.status) && (
        <Button
          startIcon={<StopCircleIcon />}
          onClick={onCancel}
          sx={{ mt: 2 }}
          color="error"
          size="small"
        >
          Avbryt batch
        </Button>
      )}
      {!isActive(progress.status) && (
        <Button
          startIcon={<RestartAltIcon />}
          onClick={onReset}
          sx={{ mt: 2 }}
          size="small"
        >
          Importer flere
        </Button>
      )}
    </Box>
  );
}

function BulkSuccessBanner({
  detail,
  progress,
  onReset,
}: {
  detail: BulkBatchDetail;
  progress: BulkBatchProgress;
  onReset: () => void;
}) {
  // Beregn confidence-breakdown
  let exact = 0, geocoded = 0, approximate = 0, unknown = 0;
  let failed = 0;
  for (const item of detail.items) {
    if (item.status === "failed" || item.status === "skipped") {
      failed++;
      continue;
    }
    switch (item.location_confidence) {
      case "exact": exact++; break;
      case "geocoded": geocoded++; break;
      case "approximate": approximate++; break;
      case "unknown": unknown++; break;
      default: unknown++;
    }
  }
  return (
    <Card sx={{ borderRadius: 3, bgcolor: "#f5f3ff" }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#7c3aed" }}>
            {progress.progress.pinned} av {progress.progress.total} leads lagt til på kartet
          </Typography>
          <Stack spacing={0.5} sx={{ fontSize: 14 }}>
            {exact > 0 && (
              <Box>
                <CheckCircleIcon sx={{ color: "success.main", verticalAlign: "middle", mr: 1, fontSize: 18 }} />
                {exact} med eksakt lokasjon (Places-treff)
              </Box>
            )}
            {geocoded > 0 && (
              <Box>
                <LocationOnIcon sx={{ color: "warning.main", verticalAlign: "middle", mr: 1, fontSize: 18 }} />
                {geocoded} geokodet (Brreg-adresse)
              </Box>
            )}
            {approximate > 0 && (
              <Box>
                <LocationOnIcon sx={{ color: "orange", verticalAlign: "middle", mr: 1, fontSize: 18 }} />
                {approximate} med by-sentroid
              </Box>
            )}
            {failed > 0 && (
              <Box>
                <ErrorOutlineIcon sx={{ color: "error.main", verticalAlign: "middle", mr: 1, fontSize: 18 }} />
                {failed} feilet (uleselig / ingen company-info)
              </Box>
            )}
            {unknown > 0 && (
              <Box>
                <HourglassEmptyIcon sx={{ color: "text.secondary", verticalAlign: "middle", mr: 1, fontSize: 18 }} />
                {unknown} uten lokasjon
              </Box>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<MapIcon />}
              href="/leadgrid/map"
              sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
            >
              Vis alle på kartet
            </Button>
            <Button startIcon={<RestartAltIcon />} onClick={onReset}>
              Importer flere
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function BulkItemList({ detail }: { detail: BulkBatchDetail }) {
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700 }}>
          URL-status
        </Typography>
        <TableContainer sx={{ mt: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={36}></TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Bedrift</TableCell>
                <TableCell align="center" width={60}>Pin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><ItemStatusIcon status={item.status} /></TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                      {(() => {
                        try {
                          return new URL(item.url).host;
                        } catch {
                          return item.url;
                        }
                      })()}
                    </Typography>
                    {item.error_message && (
                      <Typography variant="caption" sx={{ display: "block", color: "error.main" }}>
                        {item.error_message}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.research_result?.companyProfile?.name ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {item.has_pin && (
                      <LocationOnIcon sx={{ color: "#7c3aed", fontSize: 18 }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function ItemStatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case "pending":
      return <HourglassEmptyIcon sx={{ color: "text.secondary", fontSize: 18 }} />;
    case "running":
      return <CircularProgress size={14} sx={{ color: "#7c3aed" }} />;
    case "completed":
      return <CheckCircleIcon sx={{ color: "success.main", fontSize: 18 }} />;
    case "failed":
      return <ErrorOutlineIcon sx={{ color: "error.main", fontSize: 18 }} />;
    case "skipped":
      return <HourglassEmptyIcon sx={{ color: "text.disabled", fontSize: 18 }} />;
  }
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
