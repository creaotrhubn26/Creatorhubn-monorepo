/**
 * InsightsFeedPanel.tsx
 *
 * Innsiktsmotoren fase 1 (docs/integration-audit/10): «hva skjer i
 * markedet?» som operativ feed øverst i MI — detektor-funn over
 * normalized_signals med severity, konfidens og utvidbar evidens.
 * Tom-tilstand er ærlig: ingen vesentlige endringer = stillhet, ikke støy.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Collapse,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Stack, Tooltip, Typography,
} from "@mui/material";
import {
  Close as DismissIcon,
  ExpandMore as ExpandIcon,
  Insights as InsightsIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

interface Insight {
  id: string;
  detector: string;
  severity: "info" | "notable" | "important" | "critical";
  confidence: number;
  title: string;
  explanation: string;
  evidence: Array<{ ref: string; label: string; value: string | number }>;
  topic: string | null;
  status: string;
  detected_at: string;
  dedupe_key?: string;
  diagnosis?: {
    status: "generated" | "insufficient_evidence";
    narrative?: string;
    reason?: string;
    evidence?: Array<{ n: number; source: string; label: string; value: string | number }>;
  } | null;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SEVERITY_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: "#f8717122", fg: "#f87171", label: "Kritisk" },
  important: { bg: "#f59e0b22", fg: "#f59e0b", label: "Viktig" },
  notable: { bg: "#60a5fa22", fg: "#60a5fa", label: "Verdt å se" },
  info: { bg: "#94a3b822", fg: "#94a3b8", label: "Info" },
};

/** trigger|<source>|<eventId> eller deadline|<source>|<eventId> → anbudsreferanse. */
function tenderRefFromDedupeKey(key?: string): { source: string; eventId: string } | null {
  if (!key) return null;
  const m = /^(?:trigger|deadline)\|([^|]+)\|(.+)$/.exec(key);
  if (!m) return null;
  if (!["doffin", "ted"].includes(m[1])) return null;
  return { source: m[1], eventId: m[2] };
}

interface Brief {
  text: string;
  facts: Array<{ n: number; label: string; value: string }>;
  generatedAt: string;
}

export default function InsightsFeedPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [briefFor, setBriefFor] = useState<{ title: string; ref: { source: string; eventId: string } } | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [bidSaved, setBidSaved] = useState<string | null>(null);

  const openBrief = async (title: string, ref: { source: string; eventId: string }) => {
    setBriefFor({ title, ref });
    setBrief(null);
    setBriefError(null);
    setBidSaved(null);
    setBriefLoading(true);
    try {
      const r = await fetch("/api/integrations/tenders/strategy-brief", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ source: ref.source, eventId: ref.eventId }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setBriefError(body?.error === "for_tynt_grunnlag_for_brief"
          ? "For tynt datagrunnlag for en ærlig brief — les kunngjøringen direkte."
          : `Kunne ikke lage brief (${body?.error ?? r.status})`);
        return;
      }
      setBrief(body.brief as Brief);
    } catch (e) {
      setBriefError(String(e));
    } finally {
      setBriefLoading(false);
    }
  };

  const setBidStatus = async (status: string) => {
    if (!briefFor) return;
    const r = await fetch("/api/integrations/tenders/bid-status", {
      method: "PATCH",
      credentials: "include",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ source: briefFor.ref.source, eventId: briefFor.ref.eventId, bidStatus: status }),
    });
    setBidSaved(r.ok ? status : "feil");
  };

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/integrations/insights?status=new", {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      setInsights(((await r.json()).insights ?? []) as Insight[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInsights(); }, [fetchInsights]);

  const dismiss = async (id: string) => {
    setInsights((list) => list.filter((i) => i.id !== id));
    await fetch(`/api/integrations/insights/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InsightsIcon sx={{ color: "#f59e0b" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Innsikter
            </Typography>
            {insights.length > 0 && (
              <Chip label={`${insights.length} nye`} size="small"
                sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontWeight: 700 }} />
            )}
          </Stack>
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void fetchInsights()}>
            Oppdater
          </Button>
        </Stack>

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={fetchInsights}
          isEmpty={insights.length === 0}
          empty="Ingen vesentlige endringer siden sist — detektorene melder kun det som krysser tersklene."
        >
          <Stack spacing={1.5}>
            {insights.map((ins) => {
              const style = SEVERITY_STYLE[ins.severity] ?? SEVERITY_STYLE.info;
              const isOpen = expanded === ins.id;
              return (
                <Box
                  key={ins.id}
                  sx={{
                    border: `1px solid ${style.fg}33`,
                    borderLeft: `3px solid ${style.fg}`,
                    borderRadius: 1.5, p: 1.5,
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                        <Chip label={style.label} size="small"
                          sx={{ bgcolor: style.bg, color: style.fg, fontSize: 10, fontWeight: 700, height: 18 }} />
                        <Tooltip title="Konfidens beregnet fra utvalgsstørrelse og endringsstørrelse">
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(ins.confidence * 100)} % konfidens
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(ins.detected_at).toLocaleDateString("nb-NO")}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>
                        {ins.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {ins.explanation}
                      </Typography>
                      <Collapse in={isOpen}>
                        {ins.diagnosis?.status === "generated" && ins.diagnosis.narrative && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: "rgba(96,165,250,0.08)", borderRadius: 1, borderLeft: "2px solid #60a5fa" }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, color: "#60a5fa" }}>
                              Hvorfor? — AI-tolkning, bygger kun på evidensen under
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                              {ins.diagnosis.narrative}
                            </Typography>
                            {(ins.diagnosis.evidence ?? []).length > 0 && (
                              <Box sx={{ mt: 0.75 }}>
                                {ins.diagnosis.evidence!.map((e) => (
                                  <Typography key={e.n} variant="caption" sx={{ display: "block", fontFamily: "monospace", opacity: 0.8 }}>
                                    [{e.n}] ({e.source}) {e.label}: {e.value}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </Box>
                        )}
                        {ins.diagnosis?.status === "insufficient_evidence" && (
                          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                            Ingen «hvorfor»-tolkning: {ins.diagnosis.reason ?? "for tynt kryss-kilde-grunnlag"} — heller stillhet enn spekulasjon.
                          </Typography>
                        )}
                        <Box sx={{ mt: 1, p: 1, bgcolor: "rgba(148,163,184,0.06)", borderRadius: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                            Evidens ({ins.detector})
                          </Typography>
                          {ins.evidence.map((e, i) => (
                            <Typography key={i} variant="caption" sx={{ display: "block", fontFamily: "monospace" }}>
                              {e.label}: {e.value} <span style={{ opacity: 0.5 }}>[{e.ref.slice(0, 24)}]</span>
                            </Typography>
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                    <IconButton size="small" onClick={() => setExpanded(isOpen ? null : ins.id)}
                      sx={{ transform: isOpen ? "rotate(180deg)" : "none" }}>
                      <ExpandIcon fontSize="small" />
                    </IconButton>
                    {tenderRefFromDedupeKey(ins.dedupe_key) && (
                      <Tooltip title="Tilbudsstrategi-brief (AI, siterings-validert)">
                        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, fontSize: 11 }}
                          onClick={() => void openBrief(ins.title, tenderRefFromDedupeKey(ins.dedupe_key)!)}>
                          Strategi
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip title="Avvis">
                      <IconButton size="small" onClick={() => void dismiss(ins.id)}>
                        <DismissIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </PanelStateContainer>
      </CardContent>

      <Dialog open={briefFor !== null} onClose={() => setBriefFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>Tilbudsstrategi — {briefFor?.title.slice(0, 70)}</DialogTitle>
        <DialogContent>
          {briefLoading && (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Bygger faktabunt og skriver brief…
              </Typography>
            </Stack>
          )}
          {briefError && <Alert severity="warning">{briefError}</Alert>}
          {brief && (
            <>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
                {brief.text}
              </Typography>
              <Box sx={{ mt: 1.5, p: 1, bgcolor: "rgba(148,163,184,0.06)", borderRadius: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                  Faktagrunnlaget ([n]-referansene)
                </Typography>
                {brief.facts.map((f) => (
                  <Typography key={f.n} variant="caption" sx={{ display: "block", fontFamily: "monospace" }}>
                    [{f.n}] {f.label}: {f.value.slice(0, 120)}
                  </Typography>
                ))}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary">Bud-status:</Typography>
                {["interested", "bid", "won", "lost"].map((st) => (
                  <Button key={st} size="small" variant={bidSaved === st ? "contained" : "outlined"}
                    sx={{ fontSize: 10, px: 1, minWidth: 0 }}
                    onClick={() => void setBidStatus(st)}>
                    {{ interested: "Interessert", bid: "Budt", won: "Vant", lost: "Tapte" }[st]}
                  </Button>
                ))}
                {bidSaved && bidSaved !== "feil" && (
                  <Typography variant="caption" sx={{ color: "#4ade80" }}>lagret ✓</Typography>
                )}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBriefFor(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
