// @ts-nocheck
/**
 * CreativeSuggestionsPanel — sidebar som hjelper storyboard-artisten
 * å vite hva han/hun burde tegne. Tre seksjoner:
 *
 *   1. Shot suggestions    — heuristikk-basert per scene
 *   2. Coverage gaps       — hva som mangler i nåværende scene
 *   3. Reference inspirations — bransje-referanser per mood/genre
 *
 * Kobles inn ved siden av FrameDrawingEditor / StoryboardIntegrationView.
 * Tar inn scene + dialog + alle scener (for cross-scene-coverage).
 */

import React, { useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Divider,
  Tooltip,
  Alert,
  Paper,
} from '@mui/material';
import {
  Lightbulb,
  CameraAlt,
  AssignmentLate,
  AutoAwesome,
  CheckCircleOutline,
  ErrorOutline,
  WarningAmber,
} from '@mui/icons-material';
import type { SceneBreakdown, DialogueLine } from '../../models/casting';
import {
  suggestShotsForScene,
  analyzeCoverage,
  suggestReferences,
  type ShotSuggestion,
} from './creativeSuggestions';

export interface CreativeSuggestionsPanelProps {
  /** Scene som vises i editoren nå. */
  activeScene: SceneBreakdown | null;
  /** Alle scener i prosjektet — for coverage-sammenligning. */
  allScenes?: SceneBreakdown[];
  /** Dialog-linjer for hele manuskriptet. */
  dialogue?: DialogueLine[];
  /** Compact mode — mindre padding, brukes når panel er tett inntil canvas. */
  compact?: boolean;
}

const PRIORITY_COLOR: Record<ShotSuggestion['priority'], string> = {
  critical: '#ef4444',
  recommended: '#3b82f6',
  try: '#a78bfa',
};

const PRIORITY_LABEL: Record<ShotSuggestion['priority'], string> = {
  critical: 'KRITISK',
  recommended: 'ANBEFALT',
  try: 'PRØV',
};

export const CreativeSuggestionsPanel: React.FC<CreativeSuggestionsPanelProps> = ({
  activeScene,
  allScenes = [],
  dialogue = [],
  compact = false,
}) => {
  const suggestions = useMemo(
    () => (activeScene ? suggestShotsForScene(activeScene, dialogue) : []),
    [activeScene, dialogue],
  );

  const references = useMemo(
    () => (activeScene ? suggestReferences(activeScene, 4) : []),
    [activeScene],
  );

  const coverageReport = useMemo(() => {
    const scenes = allScenes.length > 0 ? allScenes : (activeScene ? [activeScene] : []);
    if (scenes.length === 0) return null;
    return analyzeCoverage(scenes);
  }, [activeScene, allScenes]);

  const activeCoverage = useMemo(
    () => coverageReport?.find((r) => r.sceneId === activeScene?.id),
    [coverageReport, activeScene],
  );

  const otherSceneGaps = useMemo(() => {
    if (!coverageReport) return [];
    return coverageReport
      .filter((r) => r.sceneId !== activeScene?.id && r.severity !== 'ok')
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, ok: 2 };
        return order[a.severity] - order[b.severity];
      })
      .slice(0, 5);
  }, [coverageReport, activeScene]);

  if (!activeScene) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'rgba(20,20,30,0.95)', color: '#fff' }} data-testid="creative-suggestions-empty">
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <AutoAwesome sx={{ color: '#fbbf24' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Creative Studio</Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
          Velg en scene for å se shot-forslag, coverage-status og inspirasjoner.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      data-testid="creative-suggestions-panel"
      sx={{
        p: compact ? 1.5 : 2,
        bgcolor: 'rgba(20,20,30,0.95)',
        color: '#fff',
        maxWidth: 380,
        minWidth: 280,
        maxHeight: '85vh',
        overflowY: 'auto',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <AutoAwesome sx={{ color: '#fbbf24', fontSize: 22 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Creative Studio
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            Scene {activeScene.sceneNumber ?? '—'}: {activeScene.sceneHeading || activeScene.heading || 'Uten tittel'}
          </Typography>
        </Box>
      </Stack>

      {/* === 1. Shot Suggestions === */}
      <SectionHeader icon={<CameraAlt sx={{ fontSize: 16 }} />} title="Foreslåtte shots" />
      <Stack spacing={1} sx={{ mb: 2 }} data-testid="suggestions-list">
        {suggestions.map((suggestion, idx) => (
          <Box
            key={`${suggestion.shotType}-${idx}`}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: 'rgba(255,255,255,0.04)',
              borderLeft: `3px solid ${PRIORITY_COLOR[suggestion.priority]}`,
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              <Chip
                label={PRIORITY_LABEL[suggestion.priority]}
                size="small"
                sx={{
                  bgcolor: PRIORITY_COLOR[suggestion.priority],
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 800,
                  height: 18,
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
                {suggestion.label}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.4 }}>
              {suggestion.rationale}
            </Typography>
            {suggestion.references && suggestion.references.length > 0 && (
              <Tooltip title={suggestion.references.join(' · ')}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(167,139,250,0.85)',
                    fontSize: 11,
                    display: 'block',
                    mt: 0.5,
                    fontStyle: 'italic',
                    cursor: 'help',
                  }}
                >
                  Ref: {suggestion.references[0]}
                  {suggestion.references.length > 1 && ` +${suggestion.references.length - 1}`}
                </Typography>
              </Tooltip>
            )}
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5, bgcolor: 'rgba(255,255,255,0.08)' }} />

      {/* === 2. Coverage Gaps === */}
      <SectionHeader icon={<AssignmentLate sx={{ fontSize: 16 }} />} title="Coverage status" />
      {activeCoverage && (
        <Box sx={{ mb: 1.5 }} data-testid="coverage-status">
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            {activeCoverage.severity === 'ok' && <CheckCircleOutline sx={{ fontSize: 16, color: '#34d399' }} />}
            {activeCoverage.severity === 'warning' && <WarningAmber sx={{ fontSize: 16, color: '#fbbf24' }} />}
            {activeCoverage.severity === 'critical' && <ErrorOutline sx={{ fontSize: 16, color: '#ef4444' }} />}
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
              {activeCoverage.framesCount} frame{activeCoverage.framesCount !== 1 ? 's' : ''}
              {activeCoverage.wordsPerFrame !== null && ` · ${Math.round(activeCoverage.wordsPerFrame)} ord/frame`}
            </Typography>
          </Stack>
          {activeCoverage.gaps.length === 0 ? (
            <Alert
              severity="success"
              variant="outlined"
              sx={{ bgcolor: 'rgba(52,211,153,0.06)', color: '#86efac', borderColor: 'rgba(52,211,153,0.3)', fontSize: 12 }}
            >
              Solid coverage for denne scenen.
            </Alert>
          ) : (
            <Stack spacing={0.5}>
              {activeCoverage.gaps.map((gap, idx) => (
                <Typography
                  key={idx}
                  variant="caption"
                  sx={{
                    color: 'rgba(255,200,150,0.85)',
                    fontSize: 12,
                    pl: 1.5,
                    borderLeft: '2px solid rgba(251,191,36,0.4)',
                  }}
                >
                  {gap.message}
                </Typography>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {otherSceneGaps.length > 0 && (
        <Box sx={{ mb: 1.5 }} data-testid="cross-scene-gaps">
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, display: 'block', mb: 0.5 }}>
            Andre scener som trenger oppmerksomhet:
          </Typography>
          <Stack spacing={0.4}>
            {otherSceneGaps.map((gap) => (
              <Typography
                key={gap.sceneId}
                variant="caption"
                sx={{
                  color: gap.severity === 'critical' ? '#fca5a5' : '#fcd34d',
                  fontSize: 11,
                  pl: 1,
                }}
              >
                <strong>{gap.sceneLabel}:</strong> {gap.framesCount} frames · {gap.gaps[0]?.message}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 1.5, bgcolor: 'rgba(255,255,255,0.08)' }} />

      {/* === 3. Reference Inspirations === */}
      <SectionHeader icon={<Lightbulb sx={{ fontSize: 16, color: '#fbbf24' }} />} title="Inspirasjoner" />
      <Stack spacing={0.75} data-testid="references-list">
        {references.map((ref, idx) => (
          <Box
            key={`${ref.title}-${idx}`}
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: 'rgba(167,139,250,0.06)',
              border: '1px solid rgba(167,139,250,0.18)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12.5 }}>
              {ref.title}
              {ref.filmmaker && (
                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400, ml: 0.5, fontSize: 11 }}>
                  · {ref.filmmaker}
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, lineHeight: 1.45, display: 'block', mt: 0.25 }}>
              {ref.why}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
    {icon}
    <Typography
      variant="overline"
      sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.65)' }}
    >
      {title}
    </Typography>
  </Stack>
);

export default CreativeSuggestionsPanel;
