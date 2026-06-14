/**
 * MarketIntelligenceOverviewPanel.tsx
 *
 * Hovedflate for Market Intelligence-modulen. Viser:
 *   1. Workflow-flyt (Brand Scan → Market Scan → Opportunities → Cockpit)
 *   2. New Market Scan-CTA (dialog)
 *   3. Recent scans (tabell)
 *   4. Top opportunities på tvers av siste scans
 *   5. Confidence summary
 *
 * Konsistent UX:
 *   - Mørk tema (matcher AdminRoom og resten av MarketingCockpitTab)
 *   - Soft purple accent (#a78bfa) på MI-specifikt
 *   - Rounded cards, status badges (Complete/Live/Pending/Ready/Failed)
 *   - Forklarer hvert teknisk begrep direkte i UI (bestemor-vennlig)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, LinearProgress, MenuItem, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import {
  AddCircleOutline as AddIcon,
  ArrowForward as ArrowForwardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Brush as BrushIcon,
  Insights as InsightsIcon,
  PlayArrow as RunIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  TipsAndUpdates as TipsIcon,
} from "@mui/icons-material";

// ── Types matching backend ────────────────────────────────────────────
type ConfidenceLevel = "low" | "medium" | "high";

interface MarketScanRow {
  id: string;
  name: string;
  marketQuery: string;
  region?: string | null;
  industry?: string | null;
  targetAudience?: string | null;
  goal?: string | null;
  status: "draft" | "running" | "completed" | "failed";
  confidenceSummary: ConfidenceLevel;
  totalCompetitors: number;
  totalOpportunities: number;
  createdAt: string;
  completedAt?: string | null;
}

interface OpportunityRow {
  id: string;
  marketScanId: string;
  title: string;
  simpleSummary: string;
  impact: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
  confidence: ConfidenceLevel;
}

// ── Helpers ───────────────────────────────────────────────────────────
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("rr_bearer") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_META: Record<
  MarketScanRow["status"],
  { label: string; color: string }
> = {
  draft:     { label: "Ikke startet", color: "#94a3b8" },
  running:   { label: "Pågår…",       color: "#60a5fa" },
  completed: { label: "Ferdig",       color: "#34d399" },
  failed:    { label: "Feilet",       color: "#fda4af" },
};

const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; color: string }> = {
  low:    { label: "Lav",     color: "#fda4af" },
  medium: { label: "Middels", color: "#fbbf24" },
  high:   { label: "Høy",     color: "#34d399" },
};

const IMPACT_META: Record<"low" | "medium" | "high", { label: string; color: string }> = {
  low:    { label: "Liten",   color: "#94a3b8" },
  medium: { label: "Middels", color: "#60a5fa" },
  high:   { label: "Stor",    color: "#fbbf24" },
};

// ── Workflow-flyt-strip (visuell pipeline) ────────────────────────────
function WorkflowStrip({ activeStep }: { activeStep: number }) {
  const steps = [
    { label: "Brand Scan", icon: <BrushIcon sx={{ fontSize: 16 }} />,
      explain: "Vi henter merkets farger, font, tone og slagord." },
    { label: "Market Scan", icon: <SearchIcon sx={{ fontSize: 16 }} />,
      explain: "Vi finner og scanner konkurrenter automatisk." },
    { label: "Funnel + Teknikker", icon: <InsightsIcon sx={{ fontSize: 16 }} />,
      explain: "Vi sjekker funnel-stadier, teknikker og tech stack." },
    { label: "Opportunities", icon: <TipsIcon sx={{ fontSize: 16 }} />,
      explain: "AI lager 3–8 konkrete anbefalinger basert på funnene." },
    { label: "Cockpit", icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} />,
      explain: "Anbefalinger → kampanje-utkast → godkjenning → publisering." },
  ];
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: "auto", pb: 1 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <Card
              sx={{
                minWidth: 180,
                bgcolor: i === activeStep
                  ? "rgba(167, 139, 250, 0.15)"
                  : i < activeStep
                    ? "rgba(52, 211, 153, 0.08)"
                    : "rgba(148, 163, 184, 0.05)",
                border: i === activeStep
                  ? "1px solid rgba(167, 139, 250, 0.5)"
                  : "1px solid rgba(148, 163, 184, 0.15)",
              }}
            >
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box sx={{
                    bgcolor: i < activeStep ? "#34d399" : i === activeStep ? "#a78bfa" : "#475569",
                    color: "#0a0a0f",
                    borderRadius: "50%",
                    width: 22, height: 22,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {i + 1}
                  </Box>
                  {s.icon}
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11 }}>
                    {s.label}
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontSize: 10, color: "text.secondary", lineHeight: 1.3 }}>
                  {s.explain}
                </Typography>
              </CardContent>
            </Card>
            {i < steps.length - 1 && (
              <ArrowForwardIcon sx={{ fontSize: 16, color: "rgba(167, 139, 250, 0.5)", flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </Stack>
    </Box>
  );
}

// ── Main panel ────────────────────────────────────────────────────────
interface Props {
  projectId?: string;
  defaultBrandKitId?: string | null;
  onOpenScanDetail?: (scanId: string) => void;
}

export default function MarketIntelligenceOverviewPanel({
  projectId,
  defaultBrandKitId,
  onOpenScanDetail,
}: Props) {
  const [scans, setScans] = useState<MarketScanRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  // New scan dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    marketQuery: "",
    region: "Norge",
    industry: "",
    targetAudience: "",
    goal: "",
  });
  const [creating, setCreating] = useState(false);

  // Running scan id
  const [runningId, setRunningId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const r = await fetch(`/api/market-scans${qs}`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      const list: MarketScanRow[] = body.scans ?? [];
      setScans(list);

      // Fetch top opportunities fra 3 nyeste completed scans
      const recentCompleted = list.filter((s) => s.status === "completed").slice(0, 3);
      const allOpps: OpportunityRow[] = [];
      for (const s of recentCompleted) {
        const oResp = await fetch(`/api/market-scans/${s.id}/opportunities`, {
          credentials: "include",
          headers: authHeaders(),
        });
        if (oResp.ok) {
          const oBody = await oResp.json();
          allOpps.push(...(oBody.opportunities ?? []));
        }
      }
      setOpportunities(allOpps.slice(0, 6));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.marketQuery.trim()) {
      setSnack("Navn og market-query er påkrevd");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/market-scans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: form.name.trim(),
          marketQuery: form.marketQuery.trim(),
          region: form.region.trim() || undefined,
          industry: form.industry.trim() || undefined,
          targetAudience: form.targetAudience.trim() || undefined,
          goal: form.goal.trim() || undefined,
          projectId,
          brandKitId: defaultBrandKitId,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setSnack(`Feil: ${body.error ?? r.status}`);
      } else {
        setSnack(`Scan opprettet — klikk «Kjør scan» for å starte.`);
        setCreateOpen(false);
        setForm({
          name: "", marketQuery: "", region: "Norge", industry: "",
          targetAudience: "", goal: "",
        });
        await fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (scanId: string) => {
    setRunningId(scanId);
    try {
      const r = await fetch(`/api/market-scans/${scanId}/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const body = await r.json();
      if (!r.ok) {
        setSnack(`Scan feilet: ${body.error ?? r.status}`);
      } else {
        setSnack(
          `Scan ferdig — ${body.competitors?.length ?? 0} konkurrenter, ` +
          `${body.opportunities?.length ?? 0} anbefalinger.`,
        );
        await fetchData();
      }
    } catch (e) {
      setSnack(`Feil: ${String(e)}`);
    } finally {
      setRunningId(null);
    }
  };

  const activeStep = useMemo(() => {
    if (scans.length === 0) return 0;
    const hasCompleted = scans.some((s) => s.status === "completed");
    if (hasCompleted && opportunities.length > 0) return 3;
    if (hasCompleted) return 2;
    return 1;
  }, [scans, opportunities]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <InsightsIcon sx={{ color: "#a78bfa" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Market Intelligence
          </Typography>
          <Chip
            size="small"
            label="Fase 1–6 av MI-modulen"
            sx={{
              bgcolor: "rgba(167, 139, 250, 0.15)",
              color: "#a78bfa",
              fontSize: 10,
              fontWeight: 700,
            }}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchData}>
            Oppdater
          </Button>
          <Button
            size="small" variant="contained" startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              bgcolor: "#a78bfa", color: "#0a0a0f",
              "&:hover": { bgcolor: "#8b5cf6" },
            }}
          >
            Ny market scan
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Et market scan finner konkurrenter automatisk, sjekker hvilke
        markedsføringsteknikker de bruker, og foreslår konkrete handlinger
        du kan gjøre. Hver anbefaling viser tydelig hva den bygger på — så
        du aldri trenger gjette.
      </Typography>

      <WorkflowStrip activeStep={activeStep} />

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {/* Recent scans */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Recent scans
              </Typography>
              {scans.length === 0 ? (
                <Alert severity="info">
                  Du har ingen scans ennå. Klikk «Ny market scan» øverst for å begynne.
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Navn</TableCell>
                        <TableCell>Marked</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Confidence</TableCell>
                        <TableCell align="right">Konkurrenter</TableCell>
                        <TableCell align="right">Anbefalinger</TableCell>
                        <TableCell align="right">Handling</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scans.map((s) => {
                        const stMeta = STATUS_META[s.status];
                        const cfMeta = CONFIDENCE_META[s.confidenceSummary];
                        return (
                          <TableRow key={s.id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {s.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(s.createdAt).toLocaleString("nb-NO")}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {s.marketQuery.slice(0, 60)}{s.marketQuery.length > 60 ? "…" : ""}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={stMeta.label}
                                sx={{ bgcolor: `${stMeta.color}33`, color: stMeta.color, fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={cfMeta.label}
                                sx={{ bgcolor: `${cfMeta.color}22`, color: cfMeta.color }}
                              />
                            </TableCell>
                            <TableCell align="right">{s.totalCompetitors}</TableCell>
                            <TableCell align="right">{s.totalOpportunities}</TableCell>
                            <TableCell align="right">
                              {s.status === "draft" || s.status === "failed" ? (
                                <Button
                                  size="small"
                                  startIcon={runningId === s.id ? <CircularProgress size={12} /> : <RunIcon sx={{ fontSize: 14 }} />}
                                  onClick={() => handleRun(s.id)}
                                  disabled={runningId !== null}
                                >
                                  Kjør
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => onOpenScanDetail?.(s.id)}
                                  sx={{ borderColor: "#a78bfa", color: "#a78bfa" }}
                                >
                                  Åpne
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Top opportunities */}
          {opportunities.length > 0 && (
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <TipsIcon sx={{ color: "#fbbf24", fontSize: 18 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Top anbefalinger på tvers av scans
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  {opportunities.map((o) => {
                    const imp = IMPACT_META[o.impact];
                    const cf = CONFIDENCE_META[o.confidence];
                    return (
                      <Card key={o.id} variant="outlined" sx={{ bgcolor: "rgba(251, 191, 36, 0.04)" }}>
                        <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {o.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                {o.simpleSummary}
                              </Typography>
                              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                <Chip size="small" label={`Impact: ${imp.label}`} sx={{ bgcolor: `${imp.color}22`, color: imp.color, fontSize: 10 }} />
                                <Chip size="small" label={`Confidence: ${cf.label}`} sx={{ bgcolor: `${cf.color}22`, color: cf.color, fontSize: 10 }} />
                              </Stack>
                            </Box>
                            <Button
                              size="small"
                              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                              onClick={() => onOpenScanDetail?.(o.marketScanId)}
                              sx={{ color: "#a78bfa", whiteSpace: "nowrap" }}
                            >
                              Se scan
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      {/* New scan dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ny market scan</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            Vi bruker beskrivelsen din til å foreslå reelle konkurrenter, hente
            nettstedene deres, og finne mønstre i hvordan de markedsfører seg.
            Tar typisk 30–90 sekunder.
          </Alert>
          <Stack spacing={2}>
            <TextField
              label="Navn på scan"
              fullWidth required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="F.eks. «Casting-plattformer Q2 2026»"
            />
            <TextField
              label="Beskriv markedet"
              fullWidth required multiline rows={2}
              value={form.marketQuery}
              onChange={(e) => setForm({ ...form, marketQuery: e.target.value })}
              placeholder="F.eks. «Casting-plattformer i Norden for skuespillere og produsenter»"
              helperText="En setning eller to — hva slags marked vil du analysere?"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Region (valgfritt)"
                fullWidth
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
              <TextField
                label="Industri (valgfritt)"
                fullWidth
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </Stack>
            <TextField
              label="Målgruppe (valgfritt)"
              fullWidth
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              placeholder="F.eks. «skuespillere 18–45 + casting-byrå»"
            />
            <TextField
              label="Mål (valgfritt)"
              fullWidth
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="F.eks. «Forstå hvordan de konverterer skuespillere til betalende medlemmer»"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
            sx={{
              bgcolor: "#a78bfa", color: "#0a0a0f",
              "&:hover": { bgcolor: "#8b5cf6" },
            }}
          >
            Opprett scan
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}
