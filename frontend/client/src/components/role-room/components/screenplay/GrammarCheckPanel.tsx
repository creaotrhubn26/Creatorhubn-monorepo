/**
 * Grammar Check Panel
 * 
 * Full-featured grammar checking panel with ML-based corrections.
 * Replaces the simpler SpellCheckPanel with comprehensive grammar support.
 * 
 * Features:
 * - Grammar, spelling, punctuation, style, agreement, tense checking
 * - Learning from user corrections (before → after)
 * - Adaptive aggressiveness based on user preferences
 * - Real-time suggestions
 * - Export parallel corpora for external training
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tab,
  Tabs,
  TextField,
  alpha,
} from '@mui/material';
import {
  Spellcheck as SpellcheckIcon,
  AutoFixHigh as AutoFixIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Psychology as LearnIcon,
  Download as ExportIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Lightbulb as SuggestionIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  ContentCopy as CopyIcon,
  School as TrainIcon,
  Rule as RuleIcon,
} from '@mui/icons-material';
import { StatsIcon } from '../icons/CastingIcons';
import {
  grammarMLService,
  GrammarError,
  GrammarSuggestion,
  GrammarCheckResult,
  UserPreferences,
} from '../../services/grammarMLService';
import { AggressivenessSlider, GrammarStatsWidget } from './GrammarSuggestionsOverlay';

// ============================================================================
// Types
// ============================================================================

interface GrammarCheckPanelProps {
  content: string;
  onGoToLine?: (lineNumber: number, column?: number) => void;
  onReplaceText?: (
    lineNumber: number,
    columnStart: number,
    columnEnd: number,
    newText: string
  ) => void;
  onContentChange?: (newContent: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  darkMode?: boolean;
}

type TabValue = 'errors' | 'settings' | 'learning' | 'training';

// ============================================================================
// Helper Components
// ============================================================================

const getSeverityIcon = (severity: GrammarError['severity']) => {
  switch (severity) {
    case 'error':
      return <ErrorIcon fontSize="small" color="error" />;
    case 'warning':
      return <WarningIcon fontSize="small" color="warning" />;
    case 'suggestion':
      return <SuggestionIcon fontSize="small" color="info" />;
    default:
      return <InfoIcon fontSize="small" />;
  }
};

const getSeverityColor = (severity: GrammarError['severity']): string => {
  switch (severity) {
    case 'error': return '#f44336';
    case 'warning': return '#ff9800';
    case 'suggestion': return '#2196f3';
    default: return '#9e9e9e';
  }
};

const getTypeLabel = (type: GrammarError['type']): string => {
  const labels: Record<GrammarError['type'], string> = {
    grammar: 'Grammatikk',
    spelling: 'Stavekontroll',
    punctuation: 'Tegnsetting',
    style: 'Stil',
    agreement: 'Samsvar',
    tense: 'Tempus',
  };
  return labels[type] || type;
};

const getTypeColor = (type: GrammarError['type']): string => {
  const colors: Record<GrammarError['type'], string> = {
    grammar: '#9c27b0',
    spelling: '#f44336',
    punctuation: '#607d8b',
    style: '#00bcd4',
    agreement: '#ff5722',
    tense: '#4caf50',
  };
  return colors[type] || '#9e9e9e';
};

// ============================================================================
// Main Component
// ============================================================================

export const GrammarCheckPanel: React.FC<GrammarCheckPanelProps> = ({
  content,
  onGoToLine,
  onReplaceText,
  onContentChange,
  isOpen = true,
  onClose,
  darkMode = true,
}) => {
  // State
  const [result, setResult] = useState<GrammarCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<GrammarError | null>(null);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [tabValue, setTabValue] = useState<TabValue>('errors');
  const [preferences, setPreferences] = useState<UserPreferences>(grammarMLService.getPreferences());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [trainingText, setTrainingText] = useState('');
  const [stats, setStats] = useState(grammarMLService.getStats());

  // Run grammar check
  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const checkResult = await grammarMLService.checkDocument(content);
      setResult(checkResult);
      setCurrentErrorIndex(0);
      if (checkResult.errors.length > 0) {
        setSelectedError(checkResult.errors[0]);
      }
      setStats(grammarMLService.getStats());
    } catch (e) {
      console.error('Grammar check failed:', e);
    } finally {
      setLoading(false);
    }
  }, [content]);

  // Initial check on content change
  useEffect(() => {
    if (content) {
      runCheck();
    }
  }, [content, runCheck]);

  // Navigate errors
  const goToNextError = useCallback(() => {
    if (!result || result.errors.length === 0) return;
    const nextIndex = (currentErrorIndex + 1) % result.errors.length;
    setCurrentErrorIndex(nextIndex);
    setSelectedError(result.errors[nextIndex]);
  }, [result, currentErrorIndex]);

  const goToPrevError = useCallback(() => {
    if (!result || result.errors.length === 0) return;
    const prevIndex = currentErrorIndex === 0 ? result.errors.length - 1 : currentErrorIndex - 1;
    setCurrentErrorIndex(prevIndex);
    setSelectedError(result.errors[prevIndex]);
  }, [result, currentErrorIndex]);

  // Handle accepting a suggestion
  const handleAccept = useCallback((error: GrammarError, suggestion: GrammarSuggestion) => {
    if (onReplaceText) {
      onReplaceText(error.lineNumber, error.columnStart, error.columnEnd, suggestion.text);
    } else if (onContentChange) {
      const lines = content.split('\n');
      if (error.lineNumber > 0 && error.lineNumber <= lines.length) {
        const line = lines[error.lineNumber - 1];
        lines[error.lineNumber - 1] = 
          line.substring(0, error.columnStart) + 
          suggestion.text + 
          line.substring(error.columnEnd);
        onContentChange(lines.join('\n'));
      }
    }

    grammarMLService.acceptSuggestion(error, suggestion, error.context);
    setStats(grammarMLService.getStats());

    // Move to next error
    setTimeout(() => {
      runCheck();
    }, 100);
  }, [onReplaceText, onContentChange, content, runCheck]);

  // Handle dismissing an error
  const handleDismiss = useCallback((error: GrammarError) => {
    grammarMLService.ignoreSuggestion(error, error.context);
    setStats(grammarMLService.getStats());
    goToNextError();
  }, [goToNextError]);

  // Handle ignoring a rule
  const handleIgnoreRule = useCallback((ruleId: string) => {
    grammarMLService.ignoreRule(ruleId);
    runCheck();
  }, [runCheck]);

  // Fix all with auto-fix
  const handleFixAll = useCallback(() => {
    if (!result || result.errors.length === 0) return;

    let newContent = content;
    // Sort errors by offset descending to avoid position shifts
    const sortedErrors = [...result.errors].sort((a, b) => b.offset - a.offset);

    for (const error of sortedErrors) {
      if (error.suggestions.length > 0 && error.confidence >= 0.7) {
        const bestSuggestion = error.suggestions[0];
        newContent = 
          newContent.substring(0, error.offset) +
          bestSuggestion.text +
          newContent.substring(error.offset + error.length);
        
        grammarMLService.acceptSuggestion(error, bestSuggestion, error.context);
      }
    }

    if (onContentChange) {
      onContentChange(newContent);
    }

    setTimeout(runCheck, 100);
  }, [result, content, onContentChange, runCheck]);

  // Update preferences
  const handlePreferenceChange = useCallback((updates: Partial<UserPreferences>) => {
    grammarMLService.updatePreferences(updates);
    setPreferences(grammarMLService.getPreferences());
    runCheck();
  }, [runCheck]);

  // Train on custom text
  const handleTrainOnText = useCallback(() => {
    if (trainingText.trim()) {
      grammarMLService.trainOnDocument(trainingText);
      setTrainingText('');
      setStats(grammarMLService.getStats());
    }
  }, [trainingText]);

  // Export parallel corpora
  const handleExport = useCallback(() => {
    const corpora = grammarMLService.exportParallelCorpora();
    const data = JSON.stringify(corpora, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grammar-corrections-corpora.json';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  }, []);

  // Filter errors by type
  const errorsByType = useMemo(() => {
    if (!result) return {};
    const grouped: Record<string, GrammarError[]> = {};
    for (const error of result.errors) {
      if (!grouped[error.type]) grouped[error.type] = [];
      grouped[error.type].push(error);
    }
    return grouped;
  }, [result]);

  // Styles
  const bgColor = darkMode ? 'rgba(20, 20, 35, 0.95)' : '#fff';
  const textColor = darkMode ? '#fff' : '#000';
  const borderColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  if (!isOpen) return null;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: bgColor,
        color: textColor,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AutoFixIcon color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
          Grammatikk & Stavekontroll
        </Typography>
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        sx={{
          minHeight: 36,
          borderBottom: `1px solid ${borderColor}`,
          '& .MuiTab-root': {
            minHeight: 36,
            py: 0,
            fontSize: '0.75rem',
          },
        }}
      >
        <Tab
          value="errors"
          label={
            <Badge badgeContent={result?.stats.totalErrors || 0} color="error" max={99}>
              <Box sx={{ pr: 1 }}>Feil</Box>
            </Badge>
          }
        />
        <Tab value="settings" label="Innstillinger" />
        <Tab value="learning" label="Læring" />
        <Tab value="training" label="Trening" />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Errors Tab */}
        {tabValue === 'errors' && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Stats bar */}
            <Box
              sx={{
                p: 1,
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={runCheck}
                disabled={loading}
              >
                Sjekk nå
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AutoFixIcon />}
                onClick={handleFixAll}
                disabled={!result || result.errors.length === 0}
              >
                Fiks alle ({result?.errors.filter(e => e.confidence >= 0.7).length || 0})
              </Button>
              
              {result && (
                <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
                  {Object.entries(result.stats).map(([key, value]) => {
                    if (key === 'processingTime' || key === 'totalErrors') return null;
                    if (value === 0) return null;
                    const typeKey = key.replace('Errors', '').replace('Issues', '') as GrammarError['type'];
                    return (
                      <Chip
                        key={key}
                        label={`${value}`}
                        size="small"
                        sx={{
                          bgcolor: alpha(getTypeColor(typeKey), 0.2),
                          fontSize: '0.7rem',
                          height: 20,
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
            </Box>

            {/* Navigation */}
            {result && result.errors.length > 0 && (
              <Box
                sx={{
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                <IconButton size="small" onClick={goToPrevError}>
                  <PrevIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {currentErrorIndex + 1} av {result.errors.length}
                </Typography>
                <IconButton size="small" onClick={goToNextError}>
                  <NextIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            {/* Selected error detail */}
            {selectedError && (
              <Paper
                sx={{
                  m: 1,
                  p: 1.5,
                  bgcolor: alpha(getSeverityColor(selectedError.severity), 0.1),
                  border: `1px solid ${getSeverityColor(selectedError.severity)}`,
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1}>
                  {getSeverityIcon(selectedError.severity)}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {selectedError.message}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        bgcolor: alpha('#000', 0.2),
                        p: 0.5,
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      Linje {selectedError.lineNumber}: "
                      <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                        {selectedError.originalText}
                      </span>
                      "
                    </Typography>

                    <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
                      <Chip
                        label={getTypeLabel(selectedError.type)}
                        size="small"
                        sx={{ 
                          bgcolor: alpha(getTypeColor(selectedError.type), 0.3),
                          fontSize: '0.7rem',
                        }}
                      />
                      <Chip
                        label={`${Math.round(selectedError.confidence * 100)}%`}
                        size="small"
                        sx={{ fontSize: '0.7rem' }}
                      />
                      {selectedError.suggestions[0]?.source === 'learned' && (
                        <Chip
                          icon={<LearnIcon sx={{ fontSize: '0.9rem !important' }} />}
                          label="Lært"
                          size="small"
                          color="success"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      )}
                    </Stack>

                    {/* Suggestions */}
                    <Typography variant="caption" sx={{ opacity: 0.7, mb: 0.5, display: 'block' }}>
                      Forslag:
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {selectedError.suggestions.map((suggestion, idx) => (
                        <Button
                          key={idx}
                          size="small"
                          variant={idx === 0 ? 'contained' : 'outlined'}
                          color="success"
                          onClick={() => handleAccept(selectedError, suggestion)}
                          startIcon={idx === 0 ? <CheckIcon /> : undefined}
                          sx={{ textTransform: 'none', mb: 0.5 }}
                        >
                          {suggestion.text}
                        </Button>
                      ))}
                    </Stack>

                    {/* Actions */}
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleDismiss(selectedError)}
                      >
                        Ignorer denne
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleIgnoreRule(selectedError.ruleId)}
                      >
                        Ignorer regel
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => onGoToLine?.(selectedError.lineNumber, selectedError.columnStart)}
                      >
                        Gå til linje
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* Error list by type */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              {Object.entries(errorsByType).map(([type, errors]) => (
                <Accordion
                  key={type}
                  sx={{
                    bgcolor: 'transparent',
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: getTypeColor(type as GrammarError['type']),
                        }}
                      />
                      <Typography variant="body2">
                        {getTypeLabel(type as GrammarError['type'])}
                      </Typography>
                      <Chip label={errors.length} size="small" sx={{ height: 18, fontSize: '0.7rem' }} />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <List dense>
                      {errors.map((error) => (
                        <ListItemButton
                          key={error.id}
                          selected={selectedError?.id === error.id}
                          onClick={() => {
                            setSelectedError(error);
                            const idx = result?.errors.findIndex(e => e.id === error.id) ?? 0;
                            setCurrentErrorIndex(idx);
                          }}
                          sx={{
                            py: 0.5,
                            borderLeft: `3px solid ${getSeverityColor(error.severity)}`,
                          }}
                        >
                          <ListItemText
                            primary={error.shortMessage}
                            secondary={`L${error.lineNumber}: "${error.originalText}"`}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption', sx: { opacity: 0.7 } }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}

              {(!result || result.errors.length === 0) && !loading && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Ingen feil funnet! 🎉
                </Alert>
              )}
            </Box>
          </Box>
        )}

        {/* Settings Tab */}
        {tabValue === 'settings' && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Korrigeringsintensitet
            </Typography>
            <AggressivenessSlider
              value={preferences.aggressiveness}
              onChange={(v) => handlePreferenceChange({ aggressiveness: v })}
              darkMode={darkMode}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Aktive kategorier
            </Typography>
            {Object.entries(preferences.enabledCategories).map(([category, enabled]) => (
              <FormControlLabel
                key={category}
                control={
                  <Switch
                    size="small"
                    checked={enabled}
                    onChange={(e) => handlePreferenceChange({
                      enabledCategories: {
                        ...preferences.enabledCategories,
                        [category]: e.target.checked,
                      },
                    })}
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: getTypeColor(category as GrammarError['type']),
                      }}
                    />
                    <Typography variant="body2">
                      {getTypeLabel(category as GrammarError['type'])}
                    </Typography>
                  </Stack>
                }
                sx={{ display: 'block', mb: 0.5 }}
              />
            ))}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Konfidensterskel
            </Typography>
            <Slider
              value={preferences.confidenceThreshold * 100}
              onChange={(_, v) => handlePreferenceChange({
                confidenceThreshold: (v as number) / 100,
              })}
              min={0}
              max={100}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}%`}
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
            />
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 1 }}>
              Bare vis forslag med høyere konfidensverdi enn terskel
            </Typography>

            {preferences.ignoredRules.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Ignorerte regler ({preferences.ignoredRules.length})
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {preferences.ignoredRules.map((ruleId) => (
                    <Chip
                      key={ruleId}
                      label={ruleId}
                      size="small"
                      onDelete={() => {
                        grammarMLService.enableRule(ruleId);
                        setPreferences(grammarMLService.getPreferences());
                        runCheck();
                      }}
                      sx={{ fontSize: '0.7rem', mb: 0.5 }}
                    />
                  ))}
                </Stack>
              </>
            )}
          </Box>
        )}

        {/* Learning Tab */}
        {tabValue === 'learning' && (
          <Box sx={{ p: 2 }}>
            <GrammarStatsWidget darkMode={darkMode} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Eksporter læringsdata
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
              Eksporter paralelle korpus (før → etter) for ekstern trening
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={() => setShowExportDialog(true)}
            >
              Eksporter korpora
            </Button>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Mest aksepterte regler
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 2 }}>
              {stats.learningStats.topAcceptedRules.map((ruleId) => (
                <Chip
                  key={ruleId}
                  label={ruleId}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {stats.learningStats.topAcceptedRules.length === 0 && (
                <Typography variant="caption" sx={{ opacity: 0.5 }}>
                  Ingen data ennå
                </Typography>
              )}
            </Stack>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Mest ignorerte regler
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {stats.learningStats.topIgnoredRules.map((ruleId) => (
                <Chip
                  key={ruleId}
                  label={ruleId}
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {stats.learningStats.topIgnoredRules.length === 0 && (
                <Typography variant="caption" sx={{ opacity: 0.5 }}>
                  Ingen data ennå
                </Typography>
              )}
            </Stack>
          </Box>
        )}

        {/* Training Tab */}
        {tabValue === 'training' && (
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Tren språkmodellen på din egen tekst for bedre forslag tilpasset din skrivestil.
            </Alert>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Lim inn tekst å trene på
            </Typography>
            <TextField
              multiline
              rows={8}
              fullWidth
              placeholder="Lim inn godt skrevet tekst her..."
              value={trainingText}
              onChange={(e) => setTrainingText(e.target.value)}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  bgcolor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                },
              }}
            />
            <Button
              variant="contained"
              startIcon={<TrainIcon />}
              onClick={handleTrainOnText}
              disabled={!trainingText.trim()}
            >
              Tren modell
            </Button>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Tren på nåværende dokument
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
              Bruk det nåværende manuset som treningsdata for å lære din skrivestil.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<TrainIcon />}
              onClick={() => grammarMLService.trainOnDocument(content)}
            >
              Tren på dokument ({content.split(/\s+/).length} ord)
            </Button>
          </Box>
        )}
      </Box>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)}>
        <DialogTitle>Eksporter paralelle korpus</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Dette eksporterer alle korrigeringer du har gjort (før → etter) som kan brukes til å trene
            eksterne ML-modeller.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Antall korrigeringer: {grammarMLService.exportParallelCorpora().length}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleExport} startIcon={<ExportIcon />}>
            Eksporter JSON
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GrammarCheckPanel;
