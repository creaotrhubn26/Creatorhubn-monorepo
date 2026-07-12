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
  Alert, Box, Button, Card, CardContent, Chip, Collapse, IconButton,
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

export default function InsightsFeedPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
    </Card>
  );
}
