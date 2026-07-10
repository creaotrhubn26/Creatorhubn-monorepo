/**
 * AiTrafficPanel.tsx
 *
 * Viser EKTE AI-drevet trafikk (GA4-referrals fra chatgpt.com,
 * perplexity.ai, copilot, gemini, claude.ai) fra normalized_signals —
 * motstykket til GEO-panelets syntetiske målinger. Data kommer fra den
 * daglige owned-channels-synken (integrasjonsplanen steg 3).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Stack,
  Tooltip, Typography,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  TravelExplore as TrafficIcon,
} from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

interface AiTrafficReport {
  sources: Array<{ source: string; sessions: number }>;
  total: number;
  periodStart: string | null;
  periodEnd: string | null;
  lastCollectedAt: string | null;
  note?: string;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SOURCE_LABELS: Record<string, string> = {
  "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT (legacy)",
  "perplexity.ai": "Perplexity",
  "www.perplexity.ai": "Perplexity",
  "copilot.microsoft.com": "Copilot",
  "gemini.google.com": "Gemini",
  "claude.ai": "Claude",
};

export default function AiTrafficPanel() {
  const [report, setReport] = useState<AiTrafficReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/integrations/signals/ai-traffic", {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      setReport((await r.json()) as AiTrafficReport);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  const maxSessions = Math.max(1, ...(report?.sources.map((s) => s.sessions) ?? [1]));

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TrafficIcon sx={{ color: "#34d399" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              AI-trafikk til nettsidene
            </Typography>
            <Tooltip title="Ekte GA4-data: økter der besøkende kom fra en AI-assistent (referral). Synkes daglig fra tilkoblede GA4-properties.">
              <Chip label="Live-data" size="small" sx={{ bgcolor: "#34d39922", color: "#34d399", fontSize: 10 }} />
            </Tooltip>
          </Stack>
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void fetchReport()}>
            Oppdater
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Når AI-assistenter begynner å anbefale dere (GEO-panelet over), vises
          effekten her: faktiske besøk fra ChatGPT, Perplexity, Copilot og
          Gemini — målt i deres egne GA4-properties.
        </Typography>

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={fetchReport}
          isEmpty={!report || report.total === 0}
          empty={
            report?.note
              ? `Ikke tilgjengelig: ${report.note}`
              : "Ingen AI-referrals registrert i perioden ennå — enten har synken ikke kjørt, eller så har AI-assistentene ikke begynt å sende trafikk. Det er nullpunktet GEO-arbeidet skal flytte."
          }
        >
          <Stack spacing={1}>
            {report?.sources.map((s) => (
              <Stack key={s.source} direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" sx={{ minWidth: 110, fontWeight: 600 }}>
                  {SOURCE_LABELS[s.source] ?? s.source}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(s.sessions / maxSessions) * 100}
                    sx={{ height: 6, borderRadius: 3, "& .MuiLinearProgress-bar": { bgcolor: "#34d399" } }}
                  />
                </Box>
                <Typography variant="caption" sx={{ minWidth: 60, textAlign: "right" }}>
                  {s.sessions} økter
                </Typography>
              </Stack>
            ))}
            {report?.periodStart && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Periode: {report.periodStart.slice(0, 10)} – {report.periodEnd?.slice(0, 10)} · sist synket{" "}
                {report.lastCollectedAt ? new Date(report.lastCollectedAt).toLocaleString("nb-NO") : "—"}
              </Typography>
            )}
          </Stack>
        </PanelStateContainer>
      </CardContent>
    </Card>
  );
}
