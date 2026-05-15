/**
 * SceneReadinessCard.tsx
 *
 * Top-level status-kort som aggregerer alle AI-faser for en scene. Vises
 * øverst i scene-edit-dialogen for å gi brukeren én rask oversikt heller
 * enn å scrolle gjennom 13 individuelle paneler.
 *
 * Data kommer fra scene-readiness-agent (programmatic aggregator).
 * Konsumerer eksisterende AISuggestionsPanel-substrat via useAISuggestions.
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

import { useAISuggestions } from '../hooks/useAISuggestions';
import { generateSuggestions } from '../services/aiSuggestionsClient';
import type {
  AISuggestion,
  ScenePhase,
  ScenePhaseStatus,
  SceneReadinessReportPayload,
} from '../models/casting';

const STATUS_META: Record<
  ScenePhaseStatus,
  { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }
> = {
  unstarted: { label: 'Ikke startet', color: 'default' },
  'in-progress': { label: 'Pågår', color: 'primary' },
  'needs-attention': { label: 'Trenger fix', color: 'error' },
  ready: { label: 'Klar', color: 'success' },
};

const PHASE_LABELS: Record<ScenePhase, string> = {
  pre: 'Pre-prod',
  live: 'Live set',
  post: 'Post-prod',
};

function StatusIcon({ status }: { status: ScenePhaseStatus }) {
  const sx = { fontSize: 18 };
  switch (status) {
    case 'ready':
      return <CheckCircleIcon sx={{ ...sx, color: 'success.main' }} />;
    case 'in-progress':
      return <HourglassEmptyIcon sx={{ ...sx, color: 'primary.main' }} />;
    case 'needs-attention':
      return <ErrorOutlineIcon sx={{ ...sx, color: 'error.main' }} />;
    default:
      return <RadioButtonUncheckedIcon sx={{ ...sx, color: 'action.disabled' }} />;
  }
}

export interface SceneReadinessCardProps {
  projectId: string;
  sceneId: string;
}

export const SceneReadinessCard: React.FC<SceneReadinessCardProps> = ({ projectId, sceneId }) => {
  const { suggestions, loading, error, refetch } = useAISuggestions(projectId, {
    sourceType: 'scene',
    sourceId: sceneId,
    suggestionType: 'scene.readiness-report',
    minConfidence: 0.0,
  });

  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<Error | null>(null);

  // Plukker siste suggestion — det er den nyeste readiness-rapporten
  const latestReport = suggestions[0] as AISuggestion<SceneReadinessReportPayload> | undefined;
  const report = latestReport?.payload;

  const handleRegenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateSuggestions(projectId, {
        agentName: 'scene-readiness-agent',
        sourceType: 'scene',
        sourceId: sceneId,
        payload: { sceneId },
      });
      await refetch();
    } catch (err) {
      setGenerateError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setGenerating(false);
    }
  };

  if (loading && !report) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle1">Scene-status</Typography>
              <Typography variant="caption" color="text.secondary">
                Ikke generert ennå. Kjør readiness-aggregator for oversikt.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={generating ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={handleRegenerate}
              disabled={generating}
            >
              Generer status
            </Button>
          </Stack>
          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error.message}
            </Alert>
          )}
          {generateError && (
            <Alert severity="error" sx={{ mt: 1 }} onClose={() => setGenerateError(null)}>
              {generateError.message}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  const meta = STATUS_META[report.overallStatus];
  const scorePct = Math.round(report.readyScore * 100);

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: '4px solid',
        borderLeftColor:
          report.overallStatus === 'ready' ? 'success.main' :
          report.overallStatus === 'needs-attention' ? 'error.main' :
          report.overallStatus === 'in-progress' ? 'primary.main' : 'divider',
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusIcon status={report.overallStatus} />
            <Typography variant="subtitle1">Scene-status</Typography>
            <Chip label={meta.label} color={meta.color} size="small" />
          </Stack>
          <Tooltip title="Regenerer status fra alle agenter">
            <Button
              size="small"
              variant="text"
              startIcon={generating ? <CircularProgress size={12} /> : <RefreshIcon fontSize="small" />}
              onClick={handleRegenerate}
              disabled={generating}
            >
              Oppdater
            </Button>
          </Tooltip>
        </Stack>

        {/* Ready-score progress bar */}
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">
              Klargjøring
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {scorePct}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={scorePct}
            color={
              report.overallStatus === 'ready' ? 'success' :
              report.overallStatus === 'needs-attention' ? 'error' : 'primary'
            }
          />
        </Box>

        {/* Phase-chips */}
        <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
          {(['pre', 'live', 'post'] as ScenePhase[]).map((phase) => {
            const summary = report.phases[phase];
            const phaseMeta = STATUS_META[summary.status];
            return (
              <Tooltip
                key={phase}
                title={
                  <Box>
                    <Typography variant="caption" display="block">
                      {summary.pendingCount} pending · {summary.acceptedCount} godkjent · {summary.rejectedCount} avvist
                    </Typography>
                    {summary.blockers.length > 0 && (
                      <Typography variant="caption" display="block" color="error.light">
                        {summary.blockers.length} blocker{summary.blockers.length === 1 ? '' : 's'}
                      </Typography>
                    )}
                  </Box>
                }
              >
                <Chip
                  icon={<StatusIcon status={summary.status} />}
                  label={`${PHASE_LABELS[phase]}: ${phaseMeta.label}`}
                  size="small"
                  color={phaseMeta.color}
                  variant="outlined"
                />
              </Tooltip>
            );
          })}
        </Stack>

        {/* Rationale */}
        {report.rationale && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            {report.rationale}
          </Typography>
        )}

        {/* Blockers */}
        {report.blockers.length > 0 && (
          <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
            <Typography variant="caption" component="div">
              <strong>Blockers:</strong>
            </Typography>
            {report.blockers.slice(0, 5).map((b, idx) => (
              <Typography key={idx} variant="caption" display="block">
                · {b}
              </Typography>
            ))}
            {report.blockers.length > 5 && (
              <Typography variant="caption" color="text.secondary">
                +{report.blockers.length - 5} flere
              </Typography>
            )}
          </Alert>
        )}

        {/* Next actions */}
        {report.nextActions && report.nextActions.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Foreslåtte neste steg:
            </Typography>
            {report.nextActions.map((action, idx) => (
              <Typography key={idx} variant="caption" display="block" color="text.secondary">
                → {action}
              </Typography>
            ))}
          </Box>
        )}

        {generateError && (
          <Alert severity="error" sx={{ mt: 1 }} onClose={() => setGenerateError(null)}>
            {generateError.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default SceneReadinessCard;
