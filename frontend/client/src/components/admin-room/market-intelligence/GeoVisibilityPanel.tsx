/**
 * GeoVisibilityPanel.tsx
 *
 * MI-panel for GEO Visibility (docs/integration-audit/08): «blir du
 * anbefalt når noen spør AI om løsninger i din bransje?»
 *
 * Flyt: generer prompt-sett (draft) → se/rediger prompts → godkjenn →
 * kjør probe → rapport (share-of-voice, manglende temaer, motor-brudd,
 * trend). Alle tall er SYNTETISKE målinger — Estimated-merket og
 * metodikk-teksten er ikke valgfrie (No Fake Integrations).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddCircleOutline as AddIcon,
  CheckCircle as ApproveIcon,
  PlayArrow as RunIcon,
  Psychology as AiIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

// ── Types (matcher backend) ───────────────────────────────────────────
interface GeoPromptSet {
  id: string;
  name: string;
  industry: string;
  region: string;
  targetBrand: string;
  competitorBrands: string[];
  status: "draft" | "approved" | "archived";
  createdAt: string;
}

interface GeoPrompt {
  id: string;
  text: string;
  topic: string;
  intent: string;
  enabled: boolean;
}

interface GeoReport {
  latestRun: {
    runId: string;
    startedAt: string;
    status: string;
    engines: string[];
    answers: number;
  } | null;
  brandShare: Array<{ brand: string; isTarget: boolean; mentions: number; sharePercent: number }>;
  missingTopics: Array<{ topic: string; prompts: number }>;
  engineBreakdown: Array<{ engine: string; answers: number; targetMentioned: number }>;
  trend: Array<{ runId: string; startedAt: string; targetSharePercent: number }>;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ENGINE_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "ChatGPT (API)",
  perplexity: "Perplexity",
};

export default function GeoVisibilityPanel() {
  const [sets, setSets] = useState<GeoPromptSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSet, setActiveSet] = useState<GeoPromptSet | null>(null);
  const [prompts, setPrompts] = useState<GeoPrompt[]>([]);
  const [report, setReport] = useState<GeoReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [form, setForm] = useState({
    industry: "",
    targetBrand: "",
    targetDomain: "",
    region: "Norge",
    competitors: "",
  });

  const fetchSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/geo-visibility/prompt-sets", {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setSets(body.promptSets ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSets(); }, [fetchSets]);

  const openSet = useCallback(async (set: GeoPromptSet) => {
    setActiveSet(set);
    setDetailLoading(true);
    setReport(null);
    try {
      const [pr, rr] = await Promise.all([
        fetch(`/api/geo-visibility/prompt-sets/${set.id}`, {
          credentials: "include", headers: authHeaders(),
        }),
        fetch(`/api/geo-visibility/prompt-sets/${set.id}/report`, {
          credentials: "include", headers: authHeaders(),
        }),
      ]);
      if (pr.ok) setPrompts((await pr.json()).prompts ?? []);
      if (rr.ok) setReport((await rr.json()).report ?? null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const createSet = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/geo-visibility/prompt-sets", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: form.industry,
          targetBrand: form.targetBrand,
          targetDomain: form.targetDomain || undefined,
          region: form.region,
          competitorBrands: form.competitors
            .split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setSnack(`Generering feilet: ${body.error ?? r.status}`);
        return;
      }
      setCreateOpen(false);
      setSnack("Prompt-sett generert — gå gjennom og godkjenn spørsmålene.");
      await fetchSets();
    } finally {
      setCreating(false);
    }
  };

  const approve = async (set: GeoPromptSet) => {
    const r = await fetch(`/api/geo-visibility/prompt-sets/${set.id}/approve`, {
      method: "POST", credentials: "include", headers: authHeaders(),
    });
    if (r.ok) {
      setSnack("Godkjent — settet kjøres nå ukentlig (og kan kjøres manuelt).");
      await fetchSets();
      if (activeSet?.id === set.id) setActiveSet({ ...set, status: "approved" });
    }
  };

  const togglePrompt = async (promptId: string, enabled: boolean) => {
    setPrompts((p) => p.map((x) => (x.id === promptId ? { ...x, enabled } : x)));
    await fetch(
      `/api/geo-visibility/prompt-sets/${activeSet?.id}/prompts/${promptId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      },
    );
  };

  const runNow = async (set: GeoPromptSet) => {
    setRunning(true);
    try {
      const r = await fetch(`/api/geo-visibility/prompt-sets/${set.id}/run`, {
        method: "POST", credentials: "include", headers: authHeaders(),
      });
      if (r.status === 202) {
        setSnack("Probe startet — rapporten oppdateres når kjøringen er ferdig (~1-3 min).");
      } else {
        const body = await r.json().catch(() => ({}));
        setSnack(`Kunne ikke starte: ${body.error ?? r.status}`);
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AiIcon sx={{ color: "#a78bfa" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              AI-synlighet (GEO)
            </Typography>
            <Tooltip title="Syntetiske målinger: vi stiller testspørsmål til AI-motorene via offisielle APIer og måler hvilke merkevarer som nevnes. API-modellene kan svare annerledes enn forbruker-appene. Dette er estimater — ikke reelle brukertall.">
              <Chip label="Estimert" size="small" sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontSize: 10 }} />
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<RefreshIcon />} onClick={() => void fetchSets()}>
              Oppdater
            </Button>
            <Button
              size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: "#a78bfa", "&:hover": { bgcolor: "#8b5cf6" } }}
            >
              Nytt prompt-sett
            </Button>
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Blir du anbefalt når noen spør AI «hvordan skaffe leads» eller «beste
          system for …» i din bransje? Vi genererer testspørsmål (du godkjenner
          dem), stiller dem til AI-motorene ukentlig, og måler hvem som nevnes.
        </Typography>

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={fetchSets}
          isEmpty={sets.length === 0}
          empty="Ingen prompt-sett ennå. Klikk «Nytt prompt-sett» — vi foreslår spørsmål for bransjen din."
        >
          <Stack spacing={2}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Navn</TableCell>
                    <TableCell>Merkevare</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Handling</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sets.map((s) => (
                    <TableRow
                      key={s.id} hover selected={activeSet?.id === s.id}
                      onClick={() => void openSet(s)} sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.targetBrand}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={s.status === "draft" ? "Utkast — venter godkjenning" : s.status === "approved" ? "Godkjent" : "Arkivert"}
                          color={s.status === "approved" ? "success" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        {s.status === "draft" ? (
                          <Button size="small" startIcon={<ApproveIcon />} onClick={() => void approve(s)}>
                            Godkjenn
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            startIcon={running ? <CircularProgress size={12} /> : <RunIcon />}
                            disabled={running}
                            onClick={() => void runNow(s)}
                          >
                            Kjør nå
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {activeSet && (
              <Box>
                {detailLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {/* Rapport */}
                    {report?.latestRun ? (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          Siste måling: {new Date(report.latestRun.startedAt).toLocaleString("nb-NO")} ·{" "}
                          {report.latestRun.answers} AI-svar fra{" "}
                          {report.latestRun.engines.map((e) => ENGINE_LABELS[e] ?? e).join(", ")}
                          {report.latestRun.status === "partial" && " · delvis kjøring (én eller flere motorer utilgjengelige)"}
                        </Typography>

                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                            Hvem nevner AI-ene? (share-of-voice)
                          </Typography>
                          <Stack spacing={0.75}>
                            {report.brandShare.map((b) => (
                              <Stack key={b.brand} direction="row" alignItems="center" spacing={1}>
                                <Typography
                                  variant="caption"
                                  sx={{ minWidth: 120, fontWeight: b.isTarget ? 700 : 400, color: b.isTarget ? "#a78bfa" : undefined }}
                                >
                                  {b.brand}{b.isTarget ? " (deg)" : ""}
                                </Typography>
                                <Box sx={{ flex: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(b.sharePercent, 100)}
                                    sx={{
                                      height: 6, borderRadius: 3,
                                      "& .MuiLinearProgress-bar": { bgcolor: b.isTarget ? "#a78bfa" : "#64748b" },
                                    }}
                                  />
                                </Box>
                                <Typography variant="caption" sx={{ minWidth: 70, textAlign: "right" }}>
                                  {b.sharePercent}% ({b.mentions})
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>

                        {report.missingTopics.length > 0 && (
                          <Alert severity="warning">
                            <strong>Du mangler i {report.missingTopics.length} temaer:</strong>{" "}
                            {report.missingTopics.map((t) => t.topic).join(", ")} — her nevner
                            AI-ene konkurrenter, men ikke deg. Dette er innholds-gapet å tette.
                          </Alert>
                        )}

                        {report.engineBreakdown.length > 0 && (
                          <Stack direction="row" spacing={1}>
                            {report.engineBreakdown.map((e) => (
                              <Chip
                                key={e.engine} size="small" variant="outlined"
                                label={`${ENGINE_LABELS[e.engine] ?? e.engine}: nevnt i ${e.targetMentioned}/${e.answers} svar`}
                              />
                            ))}
                          </Stack>
                        )}

                        {report.trend.length > 1 && (
                          <Typography variant="caption" color="text.secondary">
                            Trend (share-of-voice per kjøring):{" "}
                            {report.trend.map((t) => `${t.targetSharePercent}%`).join(" → ")}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Alert severity="info">
                        Ingen målinger ennå{activeSet.status === "draft" ? " — godkjenn settet først" : " — klikk «Kjør nå»"}.
                      </Alert>
                    )}

                    {/* Prompt-liste (godkjenningsflyt) */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Testspørsmål ({prompts.filter((p) => p.enabled).length} aktive)
                      </Typography>
                      <Stack spacing={0.5} sx={{ maxHeight: 260, overflowY: "auto" }}>
                        {prompts.map((p) => (
                          <Stack key={p.id} direction="row" alignItems="center" spacing={1}>
                            <Switch
                              size="small" checked={p.enabled}
                              disabled={activeSet.status !== "draft"}
                              onChange={(e) => void togglePrompt(p.id, e.target.checked)}
                            />
                            <Chip label={p.topic} size="small" sx={{ fontSize: 9 }} />
                            <Typography variant="caption" sx={{ opacity: p.enabled ? 1 : 0.5 }}>
                              {p.text}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                )}
              </Box>
            )}
          </Stack>
        </PanelStateContainer>

        {snack && (
          <Alert severity="info" sx={{ mt: 2 }} onClose={() => setSnack(null)}>
            {snack}
          </Alert>
        )}

        {/* Opprett-dialog */}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Nytt AI-synlighets-sett</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
              Vi genererer 30 norske testspørsmål for bransjen — uten å nevne
              merkevarene (vi måler om AI-en nevner dem uoppfordret). Du
              godkjenner listen før noe kjøres.
            </Alert>
            <Stack spacing={2}>
              <TextField
                label="Bransje" required fullWidth
                placeholder="f.eks. leadgenerering for håndverkere"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
              <TextField
                label="Din merkevare" required fullWidth
                placeholder="f.eks. Leadgrid"
                value={form.targetBrand}
                onChange={(e) => setForm({ ...form, targetBrand: e.target.value })}
              />
              <TextField
                label="Ditt domene (for sitering-måling)" fullWidth
                placeholder="f.eks. theroleroom.com"
                value={form.targetDomain}
                onChange={(e) => setForm({ ...form, targetDomain: e.target.value })}
              />
              <TextField
                label="Konkurrenter (kommaseparert)" fullWidth
                placeholder="f.eks. HubSpot, Pipedrive"
                value={form.competitors}
                onChange={(e) => setForm({ ...form, competitors: e.target.value })}
              />
              <TextField
                label="Region" fullWidth value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
            <Button
              variant="contained" disabled={creating || !form.industry || !form.targetBrand}
              startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
              onClick={() => void createSet()}
            >
              Generer spørsmål
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
