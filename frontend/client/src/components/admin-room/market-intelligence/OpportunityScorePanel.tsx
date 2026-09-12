/**
 * OpportunityScorePanel.tsx — GEO Opportunity Score (fase 3, doc 11)
 *
 * «Hva bør virksomheten gjøre nå?» som rangert liste: temaer scoret av
 * en gjennomsiktig faktormodell. Hver score kan dekomponeres (faktor for
 * faktor, med evidens), dekning vises alltid, og FORSLAG-merket står til
 * eieren har lagret sine egne vekter — modellen later aldri som den er
 * kalibrert når den ikke er det.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Collapse, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  Slider, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandIcon,
  Refresh as RefreshIcon,
  TrackChanges as ScoreIcon,
  Tune as TuneIcon,
} from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

interface FactorDefinition {
  key: string;
  label: string;
  description: string;
  proposedWeight: number;
}

interface FactorValue {
  key: string;
  value: number | null;
  missingReason?: string;
  evidence: Array<{ ref: string; label: string; value: string | number }>;
}

interface Contribution {
  key: string;
  weight: number;
  normalizedWeight: number;
  value: number | null;
  points: number | null;
}

interface OpportunityEntry {
  promptSetId: string;
  setName: string;
  targetBrand: string;
  topic: string;
  answers: number;
  score: number | null;
  coverage: number;
  factors: FactorValue[];
  contributions: Contribution[];
}

interface ScoreModelResponse {
  isDraft: boolean;
  config: { weights: Record<string, number>; commercialValues: Record<string, number> };
  factorDefinitions: FactorDefinition[];
  entries: OpportunityEntry[];
  promptSets: Array<{ id: string; name: string }>;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 45) return "#f59e0b";
  return "#94a3b8";
}

export default function OpportunityScorePanel() {
  const [data, setData] = useState<ScoreModelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftWeights, setDraftWeights] = useState<Record<string, number>>({});
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/integrations/score-models/geo-opportunity", {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      const body = (await r.json()) as ScoreModelResponse;
      setData(body);
      setDraftWeights({ ...body.config.weights });
      setDraftValues({ ...body.config.commercialValues });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/integrations/score-models/geo-opportunity/config", {
        method: "PATCH",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ weights: draftWeights, commercialValues: draftValues }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { details?: string[] } | null;
        setSaveError(body?.details?.join("; ") ?? `HTTP ${r.status}`);
        return;
      }
      setSettingsOpen(false);
      await load();
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const defs = data?.factorDefinitions ?? [];
  const defByKey = new Map(defs.map((d) => [d.key, d]));

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ScoreIcon sx={{ color: "#4ade80" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Muligheter — GEO Opportunity Score
            </Typography>
            {data?.isDraft && (
              <Tooltip title="Scoren bruker foreslåtte startvekter. Åpne innstillingene, juster og lagre — da forsvinner merket.">
                <Chip label="FORSLAG" size="small"
                  sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontWeight: 700 }} />
              </Tooltip>
            )}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Vekter og kommersiell verdi">
              <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                <TuneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>
              Oppdater
            </Button>
          </Stack>
        </Stack>

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={load}
          isEmpty={(data?.entries.length ?? 0) === 0}
          empty="Ingen målinger å score ennå — kjør en GEO-måling først."
        >
          <Stack spacing={1}>
            {data?.entries.map((entry) => {
              const id = `${entry.promptSetId}|${entry.topic}`;
              const isOpen = expanded === id;
              return (
                <Box key={id} sx={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 1.5, p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ minWidth: 52, textAlign: "center" }}>
                      {entry.score !== null ? (
                        <Typography sx={{ fontWeight: 800, fontSize: "1.25rem", color: scoreColor(entry.score) }}>
                          {entry.score}
                        </Typography>
                      ) : (
                        <Typography sx={{ fontWeight: 700, color: "text.disabled" }}>—</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {Math.round(entry.coverage * 100)} % dekn.
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{entry.topic}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.setName} · {entry.answers} svar i siste måling
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setExpanded(isOpen ? null : id)}
                      sx={{ transform: isOpen ? "rotate(180deg)" : "none" }}>
                      <ExpandIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Collapse in={isOpen}>
                    <Stack spacing={0.75} sx={{ mt: 1.25, pl: 1 }}>
                      {entry.factors.map((factor) => {
                        const def = defByKey.get(factor.key);
                        const contribution = entry.contributions.find((c) => c.key === factor.key);
                        return (
                          <Box key={factor.key}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Tooltip title={def?.description ?? ""}>
                                <Typography variant="caption" sx={{ width: 130, fontWeight: 600 }}>
                                  {def?.label ?? factor.key}
                                </Typography>
                              </Tooltip>
                              {factor.value !== null ? (
                                <>
                                  <LinearProgress variant="determinate" value={factor.value * 100}
                                    sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                                  <Typography variant="caption" sx={{ width: 90, textAlign: "right" }}>
                                    {contribution?.points ?? 0} p (vekt {contribution?.weight ?? 0})
                                  </Typography>
                                </>
                              ) : (
                                <Typography variant="caption" color="text.disabled" sx={{ flex: 1 }}>
                                  mangler data: {factor.missingReason}
                                </Typography>
                              )}
                            </Stack>
                            {factor.evidence.length > 0 && (
                              <Typography variant="caption" color="text.secondary"
                                sx={{ display: "block", pl: "138px", fontFamily: "monospace", fontSize: 10 }}>
                                {factor.evidence.map((e) => `${e.label}: ${e.value}`).join(" · ")}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        </PanelStateContainer>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Gjennomsiktig faktormodell (docs/integration-audit/11): manglende
          faktorer settes aldri stille til 0 — vekten omfordeles og
          dekningen vises. Kalibreres mot won/lost i fase 4.
        </Typography>
      </CardContent>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vekter og kommersiell verdi</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Dette er modellens strategi-flate: vektene sier hva som teller
            mest for deg, verdsettingen hva en kunde per sett er verdt (1–10).
            Lagring fjerner FORSLAG-merket.
          </Alert>
          <Stack spacing={1.5}>
            {defs.map((def) => (
              <Box key={def.key}>
                <Stack direction="row" justifyContent="space-between">
                  <Tooltip title={def.description}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{def.label}</Typography>
                  </Tooltip>
                  <Typography variant="body2">{draftWeights[def.key] ?? 0}</Typography>
                </Stack>
                <Slider size="small" min={0} max={100} value={draftWeights[def.key] ?? 0}
                  onChange={(_, v) => setDraftWeights((w) => ({ ...w, [def.key]: v as number }))} />
              </Box>
            ))}
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              Kommersiell verdi per prompt-sett (1–10)
            </Typography>
            {data?.promptSets.map((set) => (
              <Stack key={set.id} direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ flex: 1 }}>{set.name}</Typography>
                <TextField size="small" type="number" sx={{ width: 90 }}
                  inputProps={{ min: 1, max: 10, step: 1 }}
                  value={draftValues[set.id] ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDraftValues((v) => {
                      const next = { ...v };
                      if (raw === "") delete next[set.id];
                      else next[set.id] = Math.min(10, Math.max(1, Number(raw)));
                      return next;
                    });
                  }} />
              </Stack>
            ))}
            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            {saving ? "Lagrer…" : "Lagre mine vekter"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
