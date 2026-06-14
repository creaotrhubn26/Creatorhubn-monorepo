/**
 * AgentContextPreviewPanel.tsx
 *
 * Viser Daniel hva Role Room Agent VET om markedet etter at MI har kjørt.
 * Bestemor-vennlig — gjør usynlig "agent-kontekst" til synlig kort med
 * 4 seksjoner: Brand, Recent scans, Top opportunities, Active workflows.
 *
 * Daniel kan også se rå-stringen som Agent får (klikk "Vis rå prompt").
 *
 * Vises i Market Intelligence-overview rett under workflow-stripen.
 */

import React, { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Collapse, Divider, IconButton, Stack, Typography,
} from "@mui/material";
import {
  AutoAwesome as AutoAwesomeIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandIcon,
  Psychology as PsychologyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";
import { useMarketIntelAgentContext } from "./useMarketIntelAgentContext";

interface Props {
  projectId: string;
}

export default function AgentContextPreviewPanel({ projectId }: Props) {
  const { context, loading, error } = useMarketIntelAgentContext(projectId);
  const [showRawPrompt, setShowRawPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!context?.promptInjectionText) return;
    try {
      await navigator.clipboard.writeText(context.promptInjectionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Henter agent-kontekst…
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error || !context) {
    return (
      <Alert severity="warning" sx={{ mb: 1 }}>
        Kunne ikke hente agent-kontekst: {error ?? "ukjent"}
      </Alert>
    );
  }

  const hasContent =
    context.brandKit ||
    context.recentScans.length > 0 ||
    context.topOpportunities.length > 0 ||
    context.activeWorkflows.length > 0;

  return (
    <Card sx={{
      bgcolor: "rgba(96, 165, 250, 0.05)",
      border: "1px solid rgba(96, 165, 250, 0.2)",
    }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PsychologyIcon sx={{ color: "#60a5fa" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Hva Role Room Agent vet
            </Typography>
            <Chip
              size="small"
              label="Fase 5 av MI"
              sx={{
                bgcolor: "rgba(96, 165, 250, 0.15)",
                color: "#60a5fa",
                fontSize: 10,
                fontWeight: 700,
              }}
            />
          </Stack>
          <Button
            size="small"
            startIcon={showRawPrompt ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
            onClick={() => setShowRawPrompt(!showRawPrompt)}
          >
            {showRawPrompt ? "Skjul" : "Vis"} rå prompt
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Når du spør Role Room Agent om markedet eller en kampanje, får
          den automatisk denne konteksten. Slik kan agenten gi konkrete svar
          basert på faktiske funn — ikke generelle påstander.
        </Typography>

        {!hasContent ? (
          <Alert severity="info">
            Ingen MI-data ennå. Kjør en Brand Scan og en Market Scan først.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {/* Brand */}
            {context.brandKit && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>
                  Brand-regler agenten følger
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>{context.brandKit.brandName}</strong> · tone:{" "}
                  <em>{context.brandKit.toneOfVoice}</em> · CTA:{" "}
                  <em>{context.brandKit.primaryCTA}</em>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  USPs agenten kan vise til: {context.brandKit.usps.slice(0, 3).join(" · ")}
                </Typography>
              </Box>
            )}

            {/* Recent scans */}
            {context.recentScans.length > 0 && (
              <>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>
                    Markeder agenten har sett
                  </Typography>
                  {context.recentScans.map((s) => (
                    <Typography key={s.id} variant="body2" sx={{ mt: 0.5 }}>
                      • <strong>{s.name}</strong> ({s.totalCompetitors} konkurrenter,{" "}
                      {s.totalOpportunities} anbefalinger)
                    </Typography>
                  ))}
                </Box>
              </>
            )}

            {/* Top opportunities */}
            {context.topOpportunities.length > 0 && (
              <>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>
                    Anbefalinger agenten kan referere til
                  </Typography>
                  {context.topOpportunities.slice(0, 3).map((o) => (
                    <Typography key={o.id} variant="body2" sx={{ mt: 0.5 }}>
                      • {o.title}{" "}
                      <Chip
                        size="small"
                        label={o.impact}
                        sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" }}
                      />
                    </Typography>
                  ))}
                </Box>
              </>
            )}

            {/* Active workflows */}
            {context.activeWorkflows.length > 0 && (
              <>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>
                    Aktive kampanjer agenten kan hjelpe med
                  </Typography>
                  {context.activeWorkflows.slice(0, 3).map((w) => (
                    <Typography key={w.id} variant="body2" sx={{ mt: 0.5 }}>
                      • status: <Chip size="small" label={w.currentStatus} sx={{ height: 18, fontSize: 10, bgcolor: "rgba(52, 211, 153, 0.15)", color: "#34d399" }} />
                      {w.campaignDraftId && ` · kampanje-draft #${w.campaignDraftId}`}
                      {w.contentPackDraftIds.length > 0 && ` · ${w.contentPackDraftIds.length} content drafts`}
                    </Typography>
                  ))}
                </Box>
              </>
            )}
          </Stack>
        )}

        {/* Raw prompt */}
        <Collapse in={showRawPrompt}>
          <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#94a3b8" }}>
                Rå prompt-injection (det agenten faktisk får):
              </Typography>
              <Button
                size="small"
                startIcon={<CopyIcon sx={{ fontSize: 12 }} />}
                onClick={handleCopy}
              >
                {copied ? "Kopiert ✓" : "Kopier"}
              </Button>
            </Stack>
            <Box
              component="pre"
              sx={{
                bgcolor: "rgba(0, 0, 0, 0.4)",
                p: 1.5,
                borderRadius: 1,
                maxHeight: 400,
                overflow: "auto",
                fontSize: 10,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#cbd5e1",
                m: 0,
              }}
            >
              {context.promptInjectionText}
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
