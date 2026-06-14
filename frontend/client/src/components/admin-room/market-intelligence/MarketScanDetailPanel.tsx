/**
 * MarketScanDetailPanel.tsx
 *
 * Detail-side for én Market Scan. Viser:
 *   - Scan-metadata (navn, marked, region, confidence)
 *   - Competitors-tabell (med kategori, positionering, CTA, confidence)
 *   - Funnel-map (11 stages × N competitors med detected/not + confidence)
 *   - Techniques-grid (26 teknikker med detected/not + recommended_next_step)
 *   - Tech Stack-grid (gruppert per kategori)
 *   - Content Signals (Claude-analyse per competitor)
 *   - Opportunity-kort med CTA-knapper (Create Campaign / Content Pack / Funnel Map / Send to Agent)
 *
 * Confidence-system: Confirmed / Likely / Estimated / Missing data
 * (mapped fra ConfidenceLevel + detected-boolean).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Grid, IconButton, Snackbar, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Tooltip, Typography,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  CampaignOutlined as CampaignIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Help as HelpIcon,
  Layers as LayersIcon,
  PsychologyAlt as PsychologyIcon,
  Send as SendIcon,
  TipsAndUpdates as TipsIcon,
} from "@mui/icons-material";

type ConfidenceLevel = "low" | "medium" | "high";

interface MarketScan {
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

interface Competitor {
  id: string;
  name: string;
  domain: string;
  category?: string | null;
  positioning?: string | null;
  primaryOffer?: string | null;
  primaryCTA?: string | null;
  pricingSignal?: string | null;
  confidence: ConfidenceLevel;
  sourceUrls: string[];
  lastScannedAt: string;
}

interface FunnelStage {
  id: string;
  competitorId?: string | null;
  stage: string;
  detected: boolean;
  explanation: string;
  evidence?: string | null;
  confidence: ConfidenceLevel;
  recommendedAction?: string | null;
}

interface MarketingTechnique {
  id: string;
  competitorId?: string | null;
  technique: string;
  label: string;
  simpleExplanation: string;
  detected: boolean;
  confidence: ConfidenceLevel;
  evidence?: string | null;
  whyItMatters?: string | null;
  recommendedNextStep?: string | null;
}

interface TechStackSignal {
  id: string;
  competitorId: string;
  category: string;
  toolName: string;
  confidence: ConfidenceLevel;
  evidence?: string | null;
}

interface OpportunityRow {
  id: string;
  title: string;
  simpleSummary: string;
  whyItMatters: string;
  evidenceSummary: string;
  recommendedAction: string;
  impact: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
  confidence: ConfidenceLevel;
  canCreateCampaign: boolean;
  canCreateContentPack: boolean;
  canCreateFunnelMap: boolean;
  sourceCompetitorIds: string[];
  sourceTechniqueIds: string[];
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("rr_bearer") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Confidence → human label per "trust-rules" i spec
function confidenceToLabel(c: ConfidenceLevel, detected: boolean): string {
  if (!detected) return "Mangler data";
  if (c === "high") return "Confirmed";
  if (c === "medium") return "Likely";
  return "Estimated";
}

function confidenceToColor(c: ConfidenceLevel, detected: boolean): string {
  if (!detected) return "#94a3b8";
  if (c === "high") return "#34d399";
  if (c === "medium") return "#fbbf24";
  return "#60a5fa";
}

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  awareness: "Oppmerksomhet",
  landing_page: "Landingsside",
  lead_magnet: "Lead magnet",
  signup: "Påmelding",
  demo_booking: "Demo-booking",
  email_nurture: "E-postserie",
  retargeting: "Retargeting",
  checkout: "Kasse",
  upsell: "Mer-salg",
  community: "Community",
  referral: "Anbefaling",
};

interface Props {
  scanId: string;
  onBack?: () => void;
  onCreateCampaign?: (opportunityId: string) => void;
  onCreateContentPack?: (opportunityId: string) => void;
  onCreateFunnelMap?: (opportunityId: string) => void;
  onSendToAgent?: (opportunityId: string) => void;
}

export default function MarketScanDetailPanel({
  scanId, onBack,
  onCreateCampaign, onCreateContentPack, onCreateFunnelMap, onSendToAgent,
}: Props) {
  const [scan, setScan] = useState<MarketScan | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [techniques, setTechniques] = useState<MarketingTechnique[]>([]);
  const [techStack, setTechStack] = useState<TechStackSignal[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { ...authHeaders() };
      const [scanResp, compsResp, funnelsResp, techsResp, stackResp, oppsResp] = await Promise.all([
        fetch(`/api/market-scans/${scanId}`, { credentials: "include", headers }),
        fetch(`/api/market-scans/${scanId}/competitors`, { credentials: "include", headers }),
        fetch(`/api/market-scans/${scanId}/funnels`, { credentials: "include", headers }),
        fetch(`/api/market-scans/${scanId}/techniques`, { credentials: "include", headers }),
        fetch(`/api/market-scans/${scanId}/tech-stack`, { credentials: "include", headers }),
        fetch(`/api/market-scans/${scanId}/opportunities`, { credentials: "include", headers }),
      ]);
      if (!scanResp.ok) {
        setError(`Kunne ikke hente scan: HTTP ${scanResp.status}`);
        return;
      }
      const scanBody = await scanResp.json();
      setScan(scanBody.scan);

      if (compsResp.ok) setCompetitors((await compsResp.json()).competitors ?? []);
      if (funnelsResp.ok) setFunnelStages((await funnelsResp.json()).funnelStages ?? []);
      if (techsResp.ok) setTechniques((await techsResp.json()).techniques ?? []);
      if (stackResp.ok) setTechStack((await stackResp.json()).techStack ?? []);
      if (oppsResp.ok) setOpportunities((await oppsResp.json()).opportunities ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !scan) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        {error ?? "Scan ikke funnet"}
      </Alert>
    );
  }

  // ── Funnel map: gruppér per stage ─────────────────────────────────
  const funnelByStage = new Map<string, FunnelStage[]>();
  for (const f of funnelStages) {
    const arr = funnelByStage.get(f.stage) ?? [];
    arr.push(f);
    funnelByStage.set(f.stage, arr);
  }

  // ── Techniques: aggregér per teknikk-key på tvers av konkurrenter ──
  const techniqueByKey = new Map<string, MarketingTechnique[]>();
  for (const t of techniques) {
    const arr = techniqueByKey.get(t.technique) ?? [];
    arr.push(t);
    techniqueByKey.set(t.technique, arr);
  }
  const techniqueAggregated = Array.from(techniqueByKey.entries()).map(([key, items]) => {
    const detectedCount = items.filter((x) => x.detected).length;
    const sample = items[0];
    return {
      key, detectedCount, total: items.length,
      label: sample.label, simpleExplanation: sample.simpleExplanation,
      whyItMatters: sample.whyItMatters,
      recommendedNextStep: sample.recommendedNextStep,
    };
  });

  // ── Tech Stack: gruppér per kategori ──────────────────────────────
  const stackByCategory = new Map<string, TechStackSignal[]>();
  for (const s of techStack) {
    const arr = stackByCategory.get(s.category) ?? [];
    arr.push(s);
    stackByCategory.set(s.category, arr);
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {onBack && (
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {scan.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {scan.marketQuery}
            {scan.region ? ` · ${scan.region}` : ""}
            {scan.industry ? ` · ${scan.industry}` : ""}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          label={`Confidence: ${scan.confidenceSummary.toUpperCase()}`}
          size="small"
          sx={{
            bgcolor: `${confidenceToColor(scan.confidenceSummary, true)}22`,
            color: confidenceToColor(scan.confidenceSummary, true),
            fontWeight: 700,
          }}
        />
      </Stack>

      {/* KPI-rad */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Konkurrenter</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#a78bfa" }}>{competitors.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Anbefalinger</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#fbbf24" }}>{opportunities.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Teknikker detektert</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#34d399" }}>
              {techniques.filter((t) => t.detected).length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Tech-signals</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#60a5fa" }}>{techStack.length}</Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Tab label="Opportunities" icon={<TipsIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label="Konkurrenter" />
          <Tab label="Funnel Map" />
          <Tab label="Teknikker" />
          <Tab label="Tech Stack" icon={<LayersIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>

        <CardContent>
          {/* ── Tab 0: Opportunities ───────────────────────────── */}
          {activeTab === 0 && (
            <Stack spacing={1.5}>
              {opportunities.length === 0 ? (
                <Alert severity="info">
                  Ingen anbefalinger ennå. Kjør scanet for å generere opportunity-anbefalinger.
                </Alert>
              ) : (
                opportunities.map((o) => (
                  <Card key={o.id} variant="outlined" sx={{
                    bgcolor: "rgba(251, 191, 36, 0.04)",
                    borderColor: "rgba(251, 191, 36, 0.2)",
                  }}>
                    <CardContent>
                      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                        <TipsIcon sx={{ color: "#fbbf24", mt: 0.5 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {o.title}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
                            {o.simpleSummary}
                          </Typography>

                          <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                            <Chip size="small" label={`Impact: ${o.impact}`}
                              sx={{ bgcolor: "rgba(251, 191, 36, 0.15)", color: "#fbbf24" }} />
                            <Chip size="small" label={`Difficulty: ${o.difficulty}`}
                              sx={{ bgcolor: "rgba(96, 165, 250, 0.15)", color: "#60a5fa" }} />
                            <Chip size="small" label={confidenceToLabel(o.confidence, true)}
                              sx={{
                                bgcolor: `${confidenceToColor(o.confidence, true)}22`,
                                color: confidenceToColor(o.confidence, true),
                              }} />
                          </Stack>

                          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa" }}>
                                Hvorfor det betyr noe
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {o.whyItMatters}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa" }}>
                                Hva vi baserer det på
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {o.evidenceSummary}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa" }}>
                                Neste handling
                              </Typography>
                              <Typography variant="body2">
                                {o.recommendedAction}
                              </Typography>
                            </Box>
                          </Stack>

                          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                            {o.canCreateCampaign && (
                              <Button
                                size="small" variant="contained"
                                startIcon={<CampaignIcon sx={{ fontSize: 14 }} />}
                                onClick={() => onCreateCampaign?.(o.id) ?? setSnack("Kampanje-funksjon kommer i Fase 4")}
                                sx={{ bgcolor: "#fbbf24", color: "#0a0a0f", "&:hover": { bgcolor: "#f59e0b" } }}
                              >
                                Lag kampanje
                              </Button>
                            )}
                            {o.canCreateContentPack && (
                              <Button
                                size="small" variant="outlined"
                                startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                                onClick={() => onCreateContentPack?.(o.id) ?? setSnack("Content Pack kommer i Fase 4")}
                                sx={{ borderColor: "#a78bfa", color: "#a78bfa" }}
                              >
                                Content pack
                              </Button>
                            )}
                            {o.canCreateFunnelMap && (
                              <Button
                                size="small" variant="outlined"
                                startIcon={<LayersIcon sx={{ fontSize: 14 }} />}
                                onClick={() => onCreateFunnelMap?.(o.id) ?? setSnack("Funnel Map kommer i Fase 4")}
                              >
                                Funnel map
                              </Button>
                            )}
                            <Button
                              size="small" variant="outlined"
                              startIcon={<SendIcon sx={{ fontSize: 14 }} />}
                              onClick={() => onSendToAgent?.(o.id) ?? setSnack("Send til Agent kommer i Fase 5")}
                              sx={{ borderColor: "#60a5fa", color: "#60a5fa" }}
                            >
                              Send til Agent
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          )}

          {/* ── Tab 1: Competitors ─────────────────────────────── */}
          {activeTab === 1 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Konkurrent</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Posisjonering</TableCell>
                    <TableCell>Primær CTA</TableCell>
                    <TableCell>Confidence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {competitors.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.domain}</Typography>
                      </TableCell>
                      <TableCell>{c.category ?? "—"}</TableCell>
                      <TableCell>
                        <Typography variant="caption">{c.positioning ?? "—"}</Typography>
                      </TableCell>
                      <TableCell>{c.primaryCTA ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={confidenceToLabel(c.confidence, true)}
                          sx={{
                            bgcolor: `${confidenceToColor(c.confidence, true)}22`,
                            color: confidenceToColor(c.confidence, true),
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ── Tab 2: Funnel Map ─────────────────────────────── */}
          {activeTab === 2 && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Hvert funnel-stadie sjekkes for hver konkurrent. Grønt = funnet,
                grått = ikke funnet (= opportunity for deg).
              </Typography>
              {Array.from(funnelByStage.entries()).map(([stage, items]) => {
                const detectedCount = items.filter((i) => i.detected).length;
                const total = items.length;
                const sample = items.find((i) => i.detected) ?? items[0];
                const isCovered = detectedCount > total / 2;
                return (
                  <Card key={stage} variant="outlined" sx={{
                    bgcolor: isCovered ? "rgba(52, 211, 153, 0.05)" : "rgba(148, 163, 184, 0.04)",
                    borderColor: isCovered ? "rgba(52, 211, 153, 0.2)" : "rgba(148, 163, 184, 0.15)",
                  }}>
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      <Stack direction="row" alignItems="flex-start" spacing={1}>
                        {isCovered ? (
                          <CheckIcon sx={{ color: "#34d399" }} />
                        ) : (
                          <CancelIcon sx={{ color: "#94a3b8" }} />
                        )}
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {FUNNEL_STAGE_LABELS[stage] ?? stage}
                            </Typography>
                            <Chip size="small" label={`${detectedCount}/${total}`} sx={{ height: 18, fontSize: 10 }} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {sample.explanation}
                          </Typography>
                          {!isCovered && sample.recommendedAction && (
                            <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#fbbf24" }}>
                              💡 {sample.recommendedAction}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}

          {/* ── Tab 3: Techniques ─────────────────────────────── */}
          {activeTab === 3 && (
            <Grid container spacing={1.5}>
              {techniqueAggregated.map((t) => {
                const covered = t.detectedCount > 0;
                return (
                  <Grid item xs={12} md={6} key={t.key}>
                    <Card variant="outlined" sx={{
                      bgcolor: covered ? "rgba(52, 211, 153, 0.04)" : "rgba(148, 163, 184, 0.03)",
                      height: "100%",
                    }}>
                      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                            {t.label}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${t.detectedCount}/${t.total}`}
                            sx={{
                              bgcolor: covered ? "rgba(52, 211, 153, 0.2)" : "rgba(148, 163, 184, 0.15)",
                              color: covered ? "#34d399" : "#94a3b8",
                              fontSize: 10,
                            }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {t.simpleExplanation}
                        </Typography>
                        {t.whyItMatters && (
                          <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#a78bfa" }}>
                            <strong>Hvorfor:</strong> {t.whyItMatters}
                          </Typography>
                        )}
                        {!covered && t.recommendedNextStep && (
                          <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#fbbf24" }}>
                            💡 {t.recommendedNextStep}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {/* ── Tab 4: Tech Stack ─────────────────────────────── */}
          {activeTab === 4 && (
            <Stack spacing={1.5}>
              {stackByCategory.size === 0 ? (
                <Alert severity="info">Ingen tech-stack-signaler funnet ennå.</Alert>
              ) : (
                Array.from(stackByCategory.entries()).map(([category, tools]) => (
                  <Card key={category} variant="outlined">
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#60a5fa", textTransform: "uppercase" }}>
                        {category.replace(/_/g, " ")}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
                        {tools.map((t) => {
                          const competitor = competitors.find((c) => c.id === t.competitorId);
                          return (
                            <Tooltip
                              key={t.id}
                              title={`Hos ${competitor?.name ?? "ukjent"} — ${t.evidence ?? "ingen detalj"}`}
                            >
                              <Chip
                                size="small"
                                label={`${t.toolName} (${confidenceToLabel(t.confidence, true)})`}
                                sx={{
                                  bgcolor: `${confidenceToColor(t.confidence, true)}22`,
                                  color: confidenceToColor(t.confidence, true),
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}
