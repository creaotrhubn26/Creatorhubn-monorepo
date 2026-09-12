import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircleOutline as CheckIcon,
  Close as RejectIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import {
  STORYBOARD_SKILL_DEFINITIONS,
  type StoryboardSkillChange,
  type StoryboardSkillContext,
  type StoryboardSkillDefinition,
  type StoryboardSkillId,
  type StoryboardSkillSuggestion,
} from '@shared/storyboard-skills';
import {
  acceptStoryboardSkillSuggestion,
  fetchStoryboardSkillCatalog,
  fetchStoryboardSkillSuggestions,
  rejectStoryboardSkillSuggestion,
  runStoryboardSkill,
} from '../../services/storyboardSkillsService';

export interface StoryboardSkillsPanelProps {
  context: StoryboardSkillContext;
  onApplyChanges: (changes: StoryboardSkillChange[]) => void | Promise<void>;
  compact?: boolean;
}

const severityColor = (
  severity: StoryboardSkillSuggestion['payload']['severity'],
): 'default' | 'warning' | 'error' => {
  if (severity === 'blocking') return 'error';
  if (severity === 'warning') return 'warning';
  return 'default';
};

export const StoryboardSkillsPanel: React.FC<StoryboardSkillsPanelProps> = ({
  context,
  onApplyChanges,
  compact = false,
}) => {
  const [catalog, setCatalog] = useState<readonly StoryboardSkillDefinition[]>(
    STORYBOARD_SKILL_DEFINITIONS,
  );
  const [selectedSkillId, setSelectedSkillId] = useState<StoryboardSkillId>(
    'plan_scene_coverage',
  );
  const [suggestions, setSuggestions] = useState<StoryboardSkillSuggestion[]>([]);
  const [running, setRunning] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [retryChanges, setRetryChanges] = useState<StoryboardSkillChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchStoryboardSkillCatalog(context.project.id),
      fetchStoryboardSkillSuggestions(context.project.id, ['pending']),
    ]).then(([remoteCatalog, pending]) => {
      if (!active) return;
      if (remoteCatalog.length) setCatalog(remoteCatalog);
      setSuggestions(pending.filter((entry) => entry.sourceId === context.scene.id));
    }).catch(() => {
      // Catalogen er bundlet som trygg offline-fallback. Kjøring viser en
      // eksplisitt feil hvis den autentiserte serveren faktisk er utilgjengelig.
    });
    return () => { active = false; };
  }, [context.project.id, context.scene.id]);

  const definition = useMemo(
    () => catalog.find((entry) => entry.id === selectedSkillId)
      ?? STORYBOARD_SKILL_DEFINITIONS.find((entry) => entry.id === selectedSkillId)!,
    [catalog, selectedSkillId],
  );
  const suggestion = useMemo(
    () => suggestions
      .filter((entry) => entry.payload.skillId === selectedSkillId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0],
    [selectedSkillId, suggestions],
  );

  const run = async () => {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const created = await runStoryboardSkill(context.project.id, selectedSkillId, context);
      setSuggestions((current) => [
        created,
        ...current.filter((entry) => entry.payload.skillId !== selectedSkillId),
      ]);
      setRetryChanges([]);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Kunne ikke kjøre skillen.');
    } finally {
      setRunning(false);
    }
  };

  const acceptAndApply = async (changes: StoryboardSkillChange[]) => {
    if (!suggestion) return;
    setReviewing(true);
    setError(null);
    setMessage(null);
    let reviewPersisted = false;
    try {
      const accepted = await acceptStoryboardSkillSuggestion(
        context.project.id,
        suggestion.id,
        changes.length ? `Brukte ${changes.length} godkjente endringer.` : 'Analyse godkjent uten endringer.',
      );
      reviewPersisted = true;
      setSuggestions((current) => current.map((entry) =>
        entry.id === accepted.id ? accepted : entry));
      setRetryChanges(changes);
      if (changes.length) await onApplyChanges(changes);
      setRetryChanges([]);
      setMessage(changes.length
        ? 'Forslaget er godkjent og brukt. Du kan fortsatt angre via storyboardets historikk.'
        : 'Analysen er godkjent. Ingen storyboarddata ble endret.');
    } catch (reviewError) {
      const detail = reviewError instanceof Error ? reviewError.message : 'Ukjent feil.';
      setError(reviewPersisted
        ? `Forslaget er godkjent, men ble ikke brukt: ${detail}`
        : detail);
    } finally {
      setReviewing(false);
    }
  };

  const retryApply = async () => {
    if (!retryChanges.length) return;
    setReviewing(true);
    setError(null);
    try {
      await onApplyChanges(retryChanges);
      setRetryChanges([]);
      setMessage('Det godkjente forslaget er nå brukt.');
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Kunne ikke bruke forslaget.');
    } finally {
      setReviewing(false);
    }
  };

  const reject = async () => {
    if (!suggestion) return;
    setReviewing(true);
    setError(null);
    setMessage(null);
    try {
      const rejected = await rejectStoryboardSkillSuggestion(
        context.project.id,
        suggestion.id,
        'Avvist fra Storyboard Skills-panelet.',
      );
      setSuggestions((current) => current.map((entry) =>
        entry.id === rejected.id ? rejected : entry));
      setMessage('Forslaget er avvist. Storyboardet ble ikke endret.');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Kunne ikke avvise forslaget.');
    } finally {
      setReviewing(false);
    }
  };

  const pending = suggestion?.status === 'pending';
  const result = suggestion?.payload;

  return (
    <Card
      data-testid="storyboard-skills-panel"
      variant="outlined"
      sx={{
        bgcolor: 'rgba(15, 13, 25, 0.96)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
        color: 'common.white',
        minWidth: 0,
      }}
    >
      <CardContent sx={{ p: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.25}>
          <AutoAwesomeIcon sx={{ color: '#a78bfa' }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800}>Storyboard Skills</Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.62)">
              Fagforslag · alltid forhåndsvisning · 0 USD
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" gap={0.75} flexWrap="wrap" mb={1.5}>
          {catalog.map((entry) => (
            <Chip
              key={entry.id}
              data-testid={`storyboard-skill-select-${entry.id}`}
              label={entry.shortTitle}
              clickable
              onClick={() => {
                setSelectedSkillId(entry.id);
                setError(null);
                setMessage(null);
              }}
              color={selectedSkillId === entry.id ? 'secondary' : 'default'}
              variant={selectedSkillId === entry.id ? 'filled' : 'outlined'}
              size="small"
              sx={{
                color: 'common.white',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </Stack>

        <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)' }}>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Box>
              <Typography variant="subtitle2" fontWeight={750}>{definition.title}</Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.66)">
                {definition.description}
              </Typography>
            </Box>
            <Chip label={`v${definition.version}`} size="small" variant="outlined" />
          </Stack>
          <Button
            data-testid="run-storyboard-skill"
            onClick={run}
            disabled={running || reviewing || (definition.scope === 'frame' && !context.activeFrameId)}
            startIcon={running ? <CircularProgress size={15} /> : <RunIcon />}
            variant="contained"
            size="small"
            sx={{ mt: 1.25 }}
          >
            {running ? 'Analyserer…' : 'Kjør skill'}
          </Button>
        </Box>

        {running && <LinearProgress sx={{ mt: 1.25 }} />}
        {error && <Alert severity="error" sx={{ mt: 1.25 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mt: 1.25 }}>{message}</Alert>}

        {result && (
          <Box data-testid="storyboard-skill-result" sx={{ mt: 1.5 }}>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.09)', mb: 1.25 }} />
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={800}>{result.title}</Typography>
              <Chip label={`${Math.round(result.confidence * 100)} %`} size="small" />
              <Chip label={result.severity} color={severityColor(result.severity)} size="small" />
              <Chip label={suggestion.status} size="small" variant="outlined" />
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.75 }}>{result.summary}</Typography>
            <Typography variant="caption" display="block" color="rgba(255,255,255,0.58)" sx={{ mt: 0.5 }}>
              {result.rationale}
            </Typography>

            {result.evidence.length > 0 && (
              <Stack spacing={0.75} mt={1.25} data-testid="storyboard-skill-evidence">
                {result.evidence.map((entry) => (
                  <Box key={entry.id} sx={{ borderLeft: '2px solid #8b5cf6', pl: 1 }}>
                    <Typography variant="caption" fontWeight={800}>{entry.label}</Typography>
                    <Typography variant="caption" display="block" color="rgba(255,255,255,0.65)">
                      {entry.detail}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}

            {result.alternatives.length > 0 && (
              <Stack spacing={0.8} mt={1.25} data-testid="storyboard-skill-alternatives">
                {result.alternatives.map((alternative) => (
                  <Box key={alternative.id} sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" fontWeight={800}>{alternative.title}</Typography>
                    <Typography variant="caption" display="block" color="rgba(255,255,255,0.62)">
                      {alternative.tradeoff}
                    </Typography>
                    {pending && (
                      <Button
                        data-testid={`apply-storyboard-skill-alternative-${alternative.id}`}
                        size="small"
                        onClick={() => acceptAndApply(alternative.changes)}
                        disabled={reviewing}
                        sx={{ mt: 0.5 }}
                      >
                        Velg og bruk
                      </Button>
                    )}
                  </Box>
                ))}
              </Stack>
            )}

            {result.warnings.map((warning) => (
              <Alert key={warning} severity="warning" sx={{ mt: 1 }}>{warning}</Alert>
            ))}

            {pending && result.alternatives.length === 0 && (
              <Stack direction="row" gap={1} mt={1.25}>
                <Button
                  data-testid="apply-storyboard-skill"
                  onClick={() => acceptAndApply(result.recommendedChanges)}
                  disabled={reviewing}
                  startIcon={<CheckIcon />}
                  variant="contained"
                  color="secondary"
                  size="small"
                >
                  {result.recommendedChanges.length
                    ? `Godkjenn og bruk ${result.recommendedChanges.length}`
                    : 'Godkjenn analyse'}
                </Button>
                <Button
                  data-testid="reject-storyboard-skill"
                  onClick={reject}
                  disabled={reviewing}
                  startIcon={<RejectIcon />}
                  size="small"
                  color="inherit"
                >
                  Avvis
                </Button>
              </Stack>
            )}

            {pending && result.alternatives.length > 0 && (
              <Button
                data-testid="reject-storyboard-skill"
                onClick={reject}
                disabled={reviewing}
                startIcon={<RejectIcon />}
                size="small"
                color="inherit"
                sx={{ mt: 1.25 }}
              >
                Avvis alle alternativer
              </Button>
            )}

            {suggestion.status === 'accepted' && retryChanges.length > 0 && (
              <Button
                data-testid="retry-storyboard-skill-apply"
                onClick={retryApply}
                disabled={reviewing}
                startIcon={<CheckIcon />}
                variant="outlined"
                color="warning"
                size="small"
                sx={{ mt: 1.25 }}
              >
                Prøv å bruke godkjent forslag igjen
              </Button>
            )}

            <Typography variant="caption" display="block" color="rgba(255,255,255,0.42)" sx={{ mt: 1 }}>
              Fingerprint {result.contextFingerprint.slice(0, 12)} · {result.cost.provider} · {result.cost.estimatedUsd} USD
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StoryboardSkillsPanel;
