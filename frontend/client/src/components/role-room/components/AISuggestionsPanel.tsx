/**
 * AISuggestionsPanel.tsx
 *
 * Review-UI for AI Suggestion System. Henter forslag for et prosjekt
 * (eventuelt filtrert til én scene/rolle/manuskript) og lar brukeren
 * akseptere eller avvise enkeltvis.
 *
 * Arkitekturreferanse:
 *   ../ai-suggestion-architecture.md
 *
 * Prinsipper materialisert i UI:
 *   - Forslag aldri auto-aksepteres — hvert klikk er eksplisitt
 *   - Confidence-bånd styrer visuell prominens (primary 0.9+, secondary
 *     0.7-0.89, skjult bak toggle for 0.5-0.69)
 *   - Type-spesifikke renderere — hver suggestion_type vet hvordan den
 *     vises som menneskelig tekst (parallelt med backend agent-registry)
 *
 * Bruk:
 *   <AISuggestionsPanel projectId={projectId} filter={{ sourceType: 'scene', sourceId }} />
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InventoryIcon from '@mui/icons-material/Inventory2';
import PlaceIcon from '@mui/icons-material/Place';
import StyleIcon from '@mui/icons-material/Style';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import VideocamIcon from '@mui/icons-material/Videocam';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { useAISuggestions } from '../hooks/useAISuggestions';
import type {
  AISuggestion,
  AISuggestionFilter,
  BreakdownPropPayload,
  BreakdownLocationPayload,
  BreakdownCostumePayload,
  BreakdownRiskFlagPayload,
  CastingRoleStubPayload,
  StoryLoglinePayload,
  StoryContinuityIssuePayload,
  ShotListDraftPayload,
} from '../models/casting';
import RuleIcon from '@mui/icons-material/Rule';

// ─────────────────────────────────────────────────────────────────────
// Confidence-bånd-håndtering
// ─────────────────────────────────────────────────────────────────────

type ConfidenceBand = 'primary' | 'secondary' | 'uncertain';

function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.9) return 'primary';
  if (confidence >= 0.7) return 'secondary';
  return 'uncertain';
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const band = bandFor(confidence);
  const label = `${Math.round(confidence * 100)}%`;
  if (band === 'primary') {
    return <Chip label={label} color="primary" size="small" variant="filled" />;
  }
  if (band === 'secondary') {
    return <Chip label={label} size="small" variant="outlined" />;
  }
  return <Chip label={label} size="small" color="default" variant="outlined" sx={{ opacity: 0.7 }} />;
}

// ─────────────────────────────────────────────────────────────────────
// Per-type renderers
// ─────────────────────────────────────────────────────────────────────
// Hver suggestion_type oversetter sin payload til human-readable JSX.
// Parallelt med backend agent-registry — å legge til en ny type er én
// entry i RENDERERS-mapen.

interface SuggestionRenderer {
  icon: React.ComponentType<{ fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  label: string;
  render: (suggestion: AISuggestion) => React.ReactNode;
  /** Hvis true, gis denne typen ekstra visuell prominens (gul kant) */
  highlight?: boolean;
}

const RENDERERS: Record<string, SuggestionRenderer> = {
  'breakdown.prop': {
    icon: InventoryIcon,
    label: 'Prop',
    render: (s) => {
      const p = s.payload as BreakdownPropPayload;
      return (
        <Box>
          <Typography variant="body2">
            <strong>{p.name}</strong>
            {p.existingPropId ? (
              <Chip label="eksisterende" size="small" sx={{ ml: 1 }} />
            ) : (
              <Chip label="ny" size="small" color="info" sx={{ ml: 1 }} />
            )}
          </Typography>
          {p.category && (
            <Typography variant="caption" color="text.secondary">
              Kategori: {p.category}
            </Typography>
          )}
          {p.note && (
            <Typography variant="caption" display="block" color="text.secondary">
              {p.note}
            </Typography>
          )}
        </Box>
      );
    },
  },

  'breakdown.location': {
    icon: PlaceIcon,
    label: 'Location',
    render: (s) => {
      const p = s.payload as BreakdownLocationPayload;
      return (
        <Box>
          <Typography variant="body2">
            <strong>{p.name}</strong>
            {p.intExt && (
              <Chip label={p.intExt} size="small" sx={{ ml: 1 }} variant="outlined" />
            )}
            {p.existingLocationId ? (
              <Chip label="eksisterende" size="small" sx={{ ml: 1 }} />
            ) : (
              <Chip label="ny" size="small" color="info" sx={{ ml: 1 }} />
            )}
          </Typography>
          {p.note && (
            <Typography variant="caption" display="block" color="text.secondary">
              {p.note}
            </Typography>
          )}
        </Box>
      );
    },
  },

  'breakdown.costume': {
    icon: StyleIcon,
    label: 'Kostyme',
    render: (s) => {
      const p = s.payload as BreakdownCostumePayload;
      return (
        <Box>
          <Typography variant="body2">
            <strong>{p.characterName}</strong>: {p.description}
          </Typography>
          {p.note && (
            <Typography variant="caption" display="block" color="text.secondary">
              {p.note}
            </Typography>
          )}
        </Box>
      );
    },
  },

  'breakdown.vfx-flag': {
    icon: MovieFilterIcon,
    label: 'VFX',
    render: (s) => {
      const p = s.payload as { description: string; complexity?: string };
      return (
        <Typography variant="body2">
          {p.description}
          {p.complexity && ` (kompleksitet: ${p.complexity})`}
        </Typography>
      );
    },
  },

  'breakdown.risk-flag': {
    icon: WarningAmberIcon,
    label: 'Risiko',
    highlight: true,
    render: (s) => {
      const p = s.payload as BreakdownRiskFlagPayload;
      return (
        <Box>
          <Typography variant="body2">
            <strong>{p.riskType}</strong>: {p.description}
          </Typography>
          {p.recommendedAction && (
            <Typography variant="caption" display="block" color="text.secondary">
              Anbefalt: {p.recommendedAction}
            </Typography>
          )}
        </Box>
      );
    },
  },

  'casting.role-stub': {
    icon: PersonAddIcon,
    label: 'Rolle',
    render: (s) => {
      const p = s.payload as CastingRoleStubPayload;
      return (
        <Box>
          <Typography variant="body2">
            <strong>{p.characterName}</strong>
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {p.sceneCount} {p.sceneCount === 1 ? 'scene' : 'scener'}
            </Typography>
          </Typography>
          {p.shortDescription && (
            <Typography variant="caption" display="block" color="text.secondary">
              {p.shortDescription}
            </Typography>
          )}
        </Box>
      );
    },
  },

  'story.logline': {
    icon: AutoStoriesIcon,
    label: 'Logline',
    render: (s) => {
      const p = s.payload as StoryLoglinePayload;
      return (
        <Box>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            "{p.logline}"
          </Typography>
          {p.alternatives && p.alternatives.length > 0 && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              {p.alternatives.length} alternativ{p.alternatives.length === 1 ? '' : 'er'} tilgjengelig
            </Typography>
          )}
        </Box>
      );
    },
  },

  'shot-list.draft': {
    icon: VideocamIcon,
    label: 'Shot list',
    render: (s) => {
      const p = s.payload as ShotListDraftPayload & { coverageRationale?: string };
      return (
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>{p.shots.length}</strong> {p.shots.length === 1 ? 'shot' : 'shots'} foreslått
          </Typography>
          {p.coverageRationale && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ fontStyle: 'italic', mb: 0.5 }}>
              {p.coverageRationale}
            </Typography>
          )}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {p.shots.slice(0, 6).map((shot, idx) => (
              <Chip
                key={idx}
                label={shot.type}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 18 }}
              />
            ))}
            {p.shots.length > 6 && (
              <Typography variant="caption" color="text.secondary">
                +{p.shots.length - 6}
              </Typography>
            )}
          </Stack>
        </Box>
      );
    },
  },

  'story.continuity-issue': {
    icon: RuleIcon,
    label: 'Continuity',
    highlight: true,
    render: (s) => {
      const p = s.payload as StoryContinuityIssuePayload;
      return (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Chip
              label={p.severity === 'major' ? 'Alvorlig' : 'Liten'}
              size="small"
              color={p.severity === 'major' ? 'error' : 'warning'}
              variant="outlined"
            />
            <Typography variant="caption" color="text.secondary">
              {p.issueType}
            </Typography>
          </Stack>
          <Typography variant="body2">{p.description}</Typography>
          {p.suggestion && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              Forslag: {p.suggestion}
            </Typography>
          )}
          {p.affectedSceneIds.length > 0 && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              Berører {p.affectedSceneIds.length} {p.affectedSceneIds.length === 1 ? 'scene' : 'scener'}
            </Typography>
          )}
        </Box>
      );
    },
  },
};

// Fallback for ukjente suggestion_types (forward compat for nye agenter)
const fallbackRenderer: SuggestionRenderer = {
  icon: HelpOutlineIcon,
  label: 'Forslag',
  render: (s) => (
    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
      {JSON.stringify(s.payload, null, 2)}
    </Typography>
  ),
};

function rendererFor(suggestionType: string): SuggestionRenderer {
  return RENDERERS[suggestionType] ?? fallbackRenderer;
}

// ─────────────────────────────────────────────────────────────────────
// Single suggestion card
// ─────────────────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onAccept,
  onReject,
}) => {
  const [busy, setBusy] = useState(false);
  const renderer = rendererFor(suggestion.suggestionType);
  const Icon = renderer.icon;

  const handleAccept = async () => {
    setBusy(true);
    try {
      await onAccept(suggestion.id);
    } catch {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(suggestion.id);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: renderer.highlight ? '4px solid' : undefined,
        borderLeftColor: renderer.highlight ? 'warning.main' : undefined,
        opacity: busy ? 0.5 : 1,
        transition: 'opacity 120ms',
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ mt: 0.25 }}>
            <Icon fontSize="small" />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="overline" color="text.secondary">
                {renderer.label}
              </Typography>
              <ConfidenceBadge confidence={suggestion.confidence} />
            </Stack>
            {renderer.render(suggestion)}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {suggestion.agentName} · {suggestion.modelVersion}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<CheckIcon />}
              onClick={handleAccept}
              disabled={busy}
            >
              Godta
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<CloseIcon />}
              onClick={handleReject}
              disabled={busy}
            >
              Avvis
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────

export interface AISuggestionsPanelProps {
  projectId: string;
  filter?: Omit<AISuggestionFilter, 'minConfidence'>;
  /** Override default heading. */
  title?: string;
  /** Skjul "vis usikre"-toggle hvis du vil låse til primary+secondary. */
  hideUncertainToggle?: boolean;
  /**
   * Hvis satt vises "Generer forslag"-knappen i headeren. Callback har ansvar
   * for å kalle generateSuggestions med riktig agent + payload (caller kjenner
   * kontekst). Panelet refetcher automatisk når Promise resolver.
   */
  onGenerate?: () => Promise<void>;
}

export const AISuggestionsPanel: React.FC<AISuggestionsPanelProps> = ({
  projectId,
  filter,
  title = 'AI-forslag',
  hideUncertainToggle = false,
  onGenerate,
}) => {
  const [showUncertain, setShowUncertain] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<Error | null>(null);
  const effectiveFilter = React.useMemo<AISuggestionFilter>(
    () => ({
      ...filter,
      minConfidence: showUncertain ? 0.5 : 0.7,
    }),
    [filter, showUncertain],
  );

  const { suggestions, pendingCount, loading, error, accept, reject, refetch } =
    useAISuggestions(projectId, effectiveFilter);

  const handleGenerate = async () => {
    if (!onGenerate) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await onGenerate();
      await refetch();
    } catch (err) {
      setGenerateError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setGenerating(false);
    }
  };

  const primarySuggestions = suggestions.filter((s) => bandFor(s.confidence) === 'primary');
  const secondarySuggestions = suggestions.filter((s) => bandFor(s.confidence) === 'secondary');
  const uncertainSuggestions = suggestions.filter((s) => bandFor(s.confidence) === 'uncertain');

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1">
          {title}
          {pendingCount > 0 && (
            <Chip label={pendingCount} size="small" sx={{ ml: 1 }} />
          )}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {!hideUncertainToggle && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showUncertain}
                  onChange={(e) => setShowUncertain(e.target.checked)}
                />
              }
              label={<Typography variant="caption">Vis usikre</Typography>}
            />
          )}
          {onGenerate && (
            <Button
              size="small"
              variant="outlined"
              startIcon={generating ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={handleGenerate}
              disabled={generating}
            >
              Generer forslag
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error.message}
        </Alert>
      )}

      {generateError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setGenerateError(null)}>
          Kunne ikke generere forslag: {generateError.message}
        </Alert>
      )}

      {loading && suggestions.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && suggestions.length === 0 && !error && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Ingen forslag akkurat nå.
        </Typography>
      )}

      <Stack spacing={1}>
        {primarySuggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} onAccept={accept} onReject={reject} />
        ))}
        {secondarySuggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} onAccept={accept} onReject={reject} />
        ))}
        {showUncertain &&
          uncertainSuggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} onAccept={accept} onReject={reject} />
          ))}
      </Stack>
    </Box>
  );
};

export default AISuggestionsPanel;
