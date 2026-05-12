/**
 * ValidationDisplay — viser ValidationResult fra storyValidation.ts som en
 * mentor-tone tilbakemelding (energy-aware, ikke rødt for lav score).
 *
 * UX-prinsipper (numerert i kommentarer):
 *   #2  One Insight at a Time — den største strukturelle svakheten først,
 *       med progressiv disclosure ("Vis all tilbakemelding (N)") for resten
 *   #3  Energy-aware fargekoder — nøytral grå, ikke rødt
 *   #4  "Story Engine Confidence" labels istedenfor prosentvisning
 *   #8  Soft amber for contradictions (mild advarsel, ikke alarm)
 *   #12 Progressiv disclosure for coaching-tips
 *
 * Ekstraktert fra StoryLogicPanel.tsx for å:
 *   - Redusere panel-størrelsen
 *   - Muliggjøre gjenbruk fra fase-komponenter (ConceptPhase/LoglinePhase/
 *     ThemePhase) når split-arbeidet fortsetter
 */

import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Button,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
  GpsFixed as GpsFixedIcon,
  TipsAndUpdates as TipsIcon,
  ReportProblem as ContradictionIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import type { ValidationResult } from '../types';
import { getConfidenceTier, getEnergyColor, getFieldLabelNb } from '../constants';

export interface ValidationDisplayProps {
  result: ValidationResult;
  title: string;
  onJumpToField?: (fieldId: string) => void;
}

export const ValidationDisplay: React.FC<ValidationDisplayProps> = ({
  result,
  title,
  onJumpToField,
}) => {
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const confidence = getConfidenceTier(result.score);
  const energyColor = getEnergyColor(result.score);

  const topWarning =
    result.warnings.length > 0
      ? [...result.warnings].sort((a, b) => b.pointsLost - a.pointsLost)[0]
      : null;
  const totalFeedbackCount = result.warnings.length + result.suggestions.length;
  const remainingCount = totalFeedbackCount - (topWarning ? 1 : 0);

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(0,0,0,0.3)',
        border: `1px solid ${result.score >= 70 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 2,
        mt: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#d4d4d8' }}>
          {title} selvtillit
        </Typography>
        <Chip
          size="small"
          label={confidence.label}
          sx={{ bgcolor: `${confidence.color}20`, color: confidence.color, fontWeight: 600 }}
        />
      </Box>
      <LinearProgress
        variant="determinate"
        value={result.score}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': {
            bgcolor: energyColor,
            borderRadius: 3,
          },
        }}
      />

      {topWarning && (
        <Box
          sx={{
            mt: 1.5,
            p: 1.5,
            bgcolor: 'rgba(255,255,255,0.04)',
            borderRadius: 1.5,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <GpsFixedIcon sx={{ fontSize: '1.1rem', color: '#60a5fa', mt: 0.25 }} aria-hidden />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600, letterSpacing: 0.5 }}>
                STØRSTE MULIGHET
              </Typography>
              <Typography variant="body2" sx={{ color: '#e5e7eb', fontWeight: 500, mt: 0.25 }}>
                {topWarning.message}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9ca3af', mt: 0.5, display: 'block', lineHeight: 1.4 }}>
                {topWarning.impact}
              </Typography>
            </Box>
            {onJumpToField && (
              <Tooltip title={`Gå til ${getFieldLabelNb(topWarning.fieldId)}`}>
                <IconButton
                  size="small"
                  onClick={() => onJumpToField(topWarning.fieldId)}
                  sx={{ color: '#60a5fa' }}
                >
                  <GpsFixedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}

      {remainingCount > 0 && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={() => setShowAllFeedback(!showAllFeedback)}
            endIcon={showAllFeedback ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#6b7280', textTransform: 'none', fontSize: '0.75rem' }}
          >
            {showAllFeedback ? 'Fokusmodus' : `Vis all tilbakemelding (${remainingCount})`}
          </Button>
          <Collapse in={showAllFeedback}>
            <Box sx={{ mt: 0.5 }}>
              {result.warnings
                .filter((w) => w !== topWarning)
                .map((w, idx) => (
                  <Box
                    key={`w-${idx}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1,
                      mb: 0.5,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      borderRadius: 1,
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <TipsIcon sx={{ fontSize: '0.95rem', color: '#fbbf24', mt: 0.1 }} aria-hidden />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: '#d4d4d8' }}>
                        {w.message}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>
                        {w.impact}
                      </Typography>
                    </Box>
                    {onJumpToField && (
                      <IconButton
                        size="small"
                        onClick={() => onJumpToField(w.fieldId)}
                        aria-label={`Gå til ${getFieldLabelNb(w.fieldId)}`}
                        sx={{ color: '#60a5fa' }}
                      >
                        <GpsFixedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              {result.suggestions.map((s, idx) => (
                <Box
                  key={`s-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1,
                    mb: 0.5,
                    bgcolor: 'rgba(59, 130, 246, 0.04)',
                    borderRadius: 1,
                  }}
                >
                  <TipsIcon sx={{ fontSize: 16, color: '#60a5fa', mt: 0.2 }} />
                  <Typography variant="body2" sx={{ color: '#93c5fd' }}>
                    {s}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {result.affirmations.length > 0 && result.score >= 70 && (
        <Box sx={{ mt: 1.5 }}>
          {result.affirmations.map((a, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />
              <Typography variant="body2" sx={{ color: '#6ee7b7' }}>
                {a}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {result.contradictions.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          {result.contradictions.map((c, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1,
                mb: 0.5,
                bgcolor: 'rgba(251,191,36,0.06)',
                borderRadius: 1,
                border: '1px solid rgba(251,191,36,0.15)',
              }}
            >
              <ContradictionIcon sx={{ fontSize: 16, color: '#fbbf24', mt: 0.2 }} />
              <Typography variant="body2" sx={{ color: '#fcd34d' }}>
                {c}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {result.coaching.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            startIcon={<SchoolIcon />}
            onClick={() => setShowCoaching(!showCoaching)}
            endIcon={showCoaching ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#a78bfa', textTransform: 'none', fontSize: '0.75rem' }}
          >
            {showCoaching ? 'Skjul' : 'Vis'} mentor-tips ({result.coaching.length})
          </Button>
          <Collapse in={showCoaching}>
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                bgcolor: 'rgba(139, 92, 246, 0.06)',
                borderRadius: 1.5,
                border: '1px solid rgba(139, 92, 246, 0.15)',
              }}
            >
              {result.coaching.map((tip, idx) => (
                <Box key={idx} sx={{ mb: idx < result.coaching.length - 1 ? 2 : 0 }}>
                  <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600 }}>
                    Eksempel:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 0.5, fontStyle: 'italic' }}>
                    "{tip.example}"
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600 }}>
                    Mal:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 0.5 }}>
                    {tip.template}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>
                    Pass på:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#a1a1aa' }}>
                    {tip.avoid}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Paper>
  );
};
