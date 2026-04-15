// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AutoAwesome,
  Check,
  Close,
  ExpandMore,
  Psychology,
  Refresh,
  Settings,
  TrendingUp,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import type {
  NeuralEngineConfig,
  WritingContext,
  WritingStats,
  WritingSuggestion,
} from '@/services/AIWritingSuggestionsService';
import AIWritingSuggestionsService from '@/services/AIWritingSuggestionsService';

interface AIWritingSuggestionsProps {
  content: string;
  cursorPosition: number;
  selectedText?: string;
  onSuggestionAccept: (suggestion: WritingSuggestion) => void;
  onSuggestionReject: (suggestion: WritingSuggestion) => void;
  onSuggestionApply: (suggestion: WritingSuggestion) => void;
  className?: string;
  maxHeight?: number;
  showStats?: boolean;
  enableLearning?: boolean;
  autoGenerate?: boolean;
  variant?: 'sidebar' | 'floating' | 'inline';
}

const writingService = AIWritingSuggestionsService.getInstance();

function byConfidenceDesc(a: WritingSuggestion, b: WritingSuggestion): number {
  return b.confidence - a.confidence;
}

export default function AIWritingSuggestions({
  content,
  cursorPosition,
  selectedText,
  onSuggestionAccept,
  onSuggestionReject,
  onSuggestionApply,
  className,
  maxHeight = 400,
  showStats = true,
  enableLearning = true,
  autoGenerate = true,
  variant = 'sidebar',
}: AIWritingSuggestionsProps): React.ReactElement {
  const theming = useTheming('photographer');

  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState<WritingStats | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | WritingSuggestion['category']>('all');
  const [config, setConfig] = useState<NeuralEngineConfig>(() => {
    const base = writingService.getConfig();
    return { ...base, enableLearning };
  });

  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateSuggestions = useCallback(async (): Promise<void> => {
    if (!content.trim()) {
      setSuggestions([]);
      return;
    }

    setIsGenerating(true);
    try {
      const context: WritingContext = {
        currentText: content,
        cursorPosition,
        selectedText,
        documentType: 'note',
        writingStyle: 'casual',
        targetAudience: 'general',
        language: 'no',
      };

      const nextSuggestions = await writingService.generateSuggestions(context);
      setSuggestions(nextSuggestions.sort(byConfidenceDesc));
      if (showStats) {
        setStats(writingService.getWritingStats());
      }
    } finally {
      setIsGenerating(false);
    }
  }, [content, cursorPosition, selectedText, showStats]);

  useEffect(() => {
    writingService.updateConfig({ enableLearning: config.enableLearning, suggestionLimit: config.suggestionLimit });
  }, [config.enableLearning, config.suggestionLimit]);

  useEffect(() => {
    if (!autoGenerate) {
      return;
    }
    if (generationTimer.current) {
      clearTimeout(generationTimer.current);
    }
    generationTimer.current = setTimeout(() => {
      void generateSuggestions();
    }, 500);

    return () => {
      if (generationTimer.current) {
        clearTimeout(generationTimer.current);
      }
    };
  }, [autoGenerate, generateSuggestions]);

  const filteredSuggestions = useMemo(() => {
    if (categoryFilter === 'all') {
      return suggestions;
    }
    return suggestions.filter((suggestion) => suggestion.category === categoryFilter);
  }, [categoryFilter, suggestions]);

  const handleAccept = (suggestion: WritingSuggestion): void => {
    writingService.acceptSuggestion(suggestion);
    onSuggestionAccept(suggestion);
    setSuggestions((previous) => previous.filter((entry) => entry.id !== suggestion.id));
  };

  const handleReject = (suggestion: WritingSuggestion): void => {
    writingService.rejectSuggestion(suggestion);
    onSuggestionReject(suggestion);
    setSuggestions((previous) => previous.filter((entry) => entry.id !== suggestion.id));
  };

  const handleApply = (suggestion: WritingSuggestion): void => {
    onSuggestionApply(suggestion);
    setSuggestions((previous) => previous.filter((entry) => entry.id !== suggestion.id));
  };

  return (
    <Card className={className} sx={{ maxHeight, overflow: 'auto' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Psychology color="primary" />
            <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
              AI Writing Suggestions
            </Typography>
            <Chip size="small" label={variant} />
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Regenerate suggestions">
              <IconButton size="small" onClick={() => void generateSuggestions()}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setShowSettings(true)}>
                <Settings fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Category
          </Typography>
          <Select
            size="small"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="grammar">Grammar</MenuItem>
            <MenuItem value="style">Style</MenuItem>
            <MenuItem value="structure">Structure</MenuItem>
            <MenuItem value="vocabulary">Vocabulary</MenuItem>
            <MenuItem value="tone">Tone</MenuItem>
            <MenuItem value="flow">Flow</MenuItem>
          </Select>
        </Stack>

        {isGenerating ? <LinearProgress sx={{ mb: 1 }} /> : null}

        {filteredSuggestions.length === 0 && !isGenerating ? (
          <Alert severity="info">No suggestions right now. Keep writing or regenerate.</Alert>
        ) : null}

        <Stack spacing={1}>
          {filteredSuggestions.map((suggestion) => (
            <Paper key={suggestion.id} variant="outlined" sx={{ p: 1 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AutoAwesome fontSize="small" color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {suggestion.type}
                    </Typography>
                    <Chip size="small" label={suggestion.category} />
                  </Stack>
                  <Chip
                    size="small"
                    color={suggestion.confidence >= 0.8 ? 'success' : 'default'}
                    label={`${Math.round(suggestion.confidence * 100)}%`}
                  />
                </Stack>

                <Typography variant="body2">{suggestion.reason}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Suggested text: {suggestion.text}
                </Typography>

                {suggestion.originalText ? (
                  <Typography variant="caption" color="text.secondary">
                    Original: {suggestion.originalText}
                  </Typography>
                ) : null}

                <Stack direction="row" spacing={0.5}>
                  <Button size="small" variant="contained" startIcon={<Check />} onClick={() => handleApply(suggestion)}>
                    Apply
                  </Button>
                  <Button size="small" variant="outlined" color="success" onClick={() => handleAccept(suggestion)}>
                    Keep
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<Close />} onClick={() => handleReject(suggestion)}>
                    Dismiss
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>

        {showStats && stats ? (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingUp fontSize="small" />
                <Typography variant="subtitle2">Writing Stats</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={1}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2">Words: {stats.totalWords}</Typography>
                  <Typography variant="body2">Suggestions: {stats.totalSuggestions}</Typography>
                  <Typography variant="body2">Accepted: {stats.acceptedSuggestions}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2">Rejected: {stats.rejectedSuggestions}</Typography>
                  <Typography variant="body2">Score: {stats.writingScore.toFixed(1)}</Typography>
                  <Typography variant="body2">Readability: {stats.readabilityScore.toFixed(1)}</Typography>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        ) : null}
      </CardContent>

      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>AI Writing Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableLearning}
                  onChange={(event) => {
                    const enableLearningValue = event.target.checked;
                    setConfig((previous) => ({ ...previous, enableLearning: enableLearningValue }));
                  }}
                />
              }
              label="Enable learning"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableStyleEnhancement}
                  onChange={(event) => {
                    const enableStyleEnhancement = event.target.checked;
                    setConfig((previous) => ({ ...previous, enableStyleEnhancement }));
                  }}
                />
              }
              label="Enable style enhancement"
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Suggestion limit
              </Typography>
              <Select
                fullWidth
                size="small"
                value={config.suggestionLimit}
                onChange={(event) => {
                  const suggestionLimit = Number(event.target.value);
                  setConfig((previous) => ({ ...previous, suggestionLimit }));
                }}
              >
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={5}>5</MenuItem>
                <MenuItem value={8}>8</MenuItem>
                <MenuItem value={12}>12</MenuItem>
              </Select>
            </Box>
          </Stack>
          <Divider sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              writingService.updateConfig(config);
              setShowSettings(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
