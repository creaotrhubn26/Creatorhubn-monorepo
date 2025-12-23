/**
 * Norwegian Spell Checker
 *
 * Features: * - Real-time spell checking for Norwegian text
 * - Spelling suggestions (Bokmål & Nynorsk)
 * - Grammar checking
 * - Word frequency analysis
 * - Custom dictionary support
 * - Ignore/Add to dictionary
 * - Integration with Visual Editor
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  List,
  ListItem,
  IconButton,
  Alert,
  AlertTitle,
  Divider,
  Card,
  CardContent,
  Badge,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Spellcheck as SpellcheckIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Close,
  Lightbulb as LightbulbIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface SpellError {
  word: string;
  position: number;
  length: number;
  suggestions: string[];
  type: 'spelling' | 'grammar' | 'style';
  message: string;
  context: string;
}

interface SpellCheckResult {
  text: string;
  errors: SpellError[];
  errorCount: number;
  language: 'nb' | 'nn'; // Bokmål or Nynorsk
  confidence: number;
}

interface Props {
  initialText?: string;
  onTextChange?: (_text: string) => void;
  autoCheck?: boolean;
  showStats?: boolean;
}

export const NorwegianSpellChecker: React.FC<Props> = ({
  initialText = ', ',
  onTextChange,
  autoCheck = true,
}) => {
  const { componentRegistry, analytics, communication, auth } = useEnhancedMasterIntegration();

  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState<'nb' | 'nn'>('nb'); // Default to Bokmål
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SpellCheckResult | null>(null);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [customDictionary, setCustomDictionary] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'contextual' | 'list'>('contextual');
  const [expandedError, setExpandedError] = useState<number | null>(null);

  // Register component
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'norwegian-spell-checker,',
      type: 'admin',
      version: '1.0.0',
      capabilities: {
        data: ['spell-check','norwegian'],
        events: ['spell-check-completed'],
        actions: ['check','correct'],
        ui: ['panel'],
        system: ['language-service'],
      },
      dependencies: ['language-tool-api'],
      lastActive: Date.now(),
      performance: { renderCount: 0, avgRenderTime: 0, memoryUsage: 0 },
    });

    return () => componentRegistry.unregisterComponent('norwegian-spell-checker,');
  }, [componentRegistry]);

  // Listen for Visual Editor requests
  useEffect(() => {
    const unsubscribe = communication.onMessage(
      (message: { type: string; data: { text: string } }) => {
        if (message.type === 'visual-editor:check-norwegian-spelling') {
          setText(message.data.text);
          handleCheckSpelling(message.data.text);
        }
      },
    );

    return unsubscribe;
  }, [communication]);

  // Spell check API call
  const handleCheckSpelling = async (textToCheck?: string) => {
    const content = textToCheck || text;
    if (!content.trim()) return;

    setIsChecking(true);
    analytics.trackEvent('spell_check_started', {
      language,
      textLength: content.length,
    });

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/norwegian/spell-check', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: content,
          language,
          customDictionary: Array.from(customDictionary),
          ignoredWords: Array.from(ignoredWords),
        }),
      });

      if (response.success) {
        setResult(response.result);

        // Broadcast to other components
        communication.sendBroadcast('spell-check:complete', {
          errorCount: response.result.errorCount,
          language,
        });

        analytics.trackEvent('spell_check_completed', {
          language,
          errorCount: response.result.errorCount,
        });
      }
    } catch (error) {
      console.error('Spell check failed: ', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Apply suggestion
  const handleApplySuggestion = useCallback(
    (error: SpellError, suggestion: string) => {
      const before = text.substring(0, error.position);
      const after = text.substring(error.position + error.length);
      const newText = before + suggestion + after;

      setText(newText);
      onTextChange?.(newText);

      analytics.trackEvent('spell_suggestion_applied', {
        original: error.word,
        suggestion,
      });

      // Re-check
      if (autoCheck) {
        handleCheckSpelling(newText);
      }
    },
    [text, autoCheck, onTextChange, analytics],
  );

  // Ignore word
  const handleIgnoreWord = useCallback(
    (word: string) => {
      setIgnoredWords((prev) => new Set([...prev, word]);
      analytics.trackEvent('spell_word_ignored', { word });
    },
    [analytics],
  );

  // Add to dictionary
  const handleAddToDictionary = useCallback(
    async (word: string) => {
      setCustomDictionary((prev) => new Set([...prev, word]));

      try {
        const headers = await auth.getAuthHeader();
        await apiRequest('/api/admin/norwegian/dictionary/add', {
          method: 'POST',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify({ word, language }),
        });

        analytics.trackEvent('word_added_to_dictionary', { word, language });
      } catch (error) {
        console.error('Failed to add word to dictionary:', error);
      }
    },
    [language, analytics, auth],
  );

  // Copy corrected text
  const handleCopyCorrectedText = useCallback(() => {
    navigator.clipboard.writeText(text);
    analytics.trackEvent('corrected_text_copied', { length: text.length });
  }, [text, analytics]);

  const errorsByType =
    result?.errors.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ) || {};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpellcheckIcon sx={{ fontSize: 40, color: '#4caf50' }} />
          Norsk Stavekontroll
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sanntidsstavekontroll for norsk bokmål og nynorsk
        </Typography>
      </Box>

      {/* Controls */}}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 } flexWrap="wrap">
        <Typography variant="body2" sx={{ fontWeight: 600}}>
          Språk: </Typography>
        <ToggleButtonGroup
          value={language}
          exclusive
          onChange={(_, val) => val && setLanguage(val)}
          size="small"
        >
          <ToggleButton value="nb">🇳🇴 Bokmål</ToggleButton>
          <ToggleButton value="nn">🇳🇴 Nynorsk</ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        <Typography variant="body2" sx={{ fontWeight: 600}}>
          Visning: </Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="contextual">💡 Forslag</ToggleButton>
          <ToggleButton value="list">📋 Liste</ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="contained"
          startIcon={<SpellcheckIcon />}
          onClick={() => handleCheckSpelling()}
          disabled={isChecking || !text.trim()}
          sx={{ ml: 'auto' }}>
          {isChecking ? 'Sjekker...' : 'Sjekk Stavemåte'}
        </Button>
      </Stack>

      {/* Text Input */}
      <TextField
        fullWidth
        multiline
        rows={10}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onTextChange?.(e.target.value);
        }}
        placeholder="Skriv eller lim inn norsk tekst her for stavekontroll..."
        variant="outlined"
        sx={{ mb: 3 }} />

      {/* Stats */}
      {showStats && result && (
        <Card sx={{ mb: 3, bgcolor: result.errorCount === 0 ? 'success.light' : 'error.light' }}>
          <CardContent>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'white' }}>
                  {result.errorCount}
                </Typography>
                <Typography variant="caption" sx={{ color: 'white' }}>
                  Feil funnet
                </Typography>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ bgcolor: 'white' }} />

              <Stack spacing={1}>
                {Object.entries(errorsByType).map(([type, count]) => (
                  <Chip
                    key={type}
                    label={`${type}: ${count}`}
                    size="small"
                    sx={{ bgcolor: 'white' }} />
                ))}
              </Stack>

              {result.errorCount === 0 && (
                <Box sx={{ ml: 'auto' }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: 'white' }} />
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Contextual Suggestions View */}
      {result && result.errors.length > 0 && viewMode === 'contextual' && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}, sx={{ mb: 2 }}>
            <Badge
              badgeContent={result.errors.filter((e) => !ignoredWords.has(e.word).length}
              color="error"
            >
              <LightbulbIcon color="warning" sx={{ fontSize: 32 }} />
            </Badge>
            <Typography variant="h6">Forbedringsforslag</Typography>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1.5}>
            {result.errors
              .filter((error) => !ignoredWords.has(error.word)
              .map((error, idx) => (
                <Card
                  key={idx}
                  variant="outlined"
                  sx={{
                    border: expandedError === idx ? '2px solid' : '1px solid',
                    borderColor: expandedError === idx ? 'error.main' : 'divider',
                    bgcolor: error.type === 'spelling'
                        ? 'error.light'
                        : error.type === 'grammar'
                          ? 'warning.light'
                          : 'info.light',
                    opacity: 0.95 }}>
                  <CardContent sx={{ p: 1.5 '&:last-child': { pb: 1.5 } }>
                    <Stack spacing={1}>
                      {/* Header */}
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1} flex={1}>
                          <Typography variant="body1" fontWeight="bold" color="error.dark">
                            {error.word}
                          </Typography>
                          {error.suggestions.length > 0 && (
                            <>
                              <SwapHorizIcon fontSize="small" color="action" />
                              <Typography variant="body1" fontWeight="bold" color="success.dark">
                                {error.suggestions[0]}
                              </Typography>
                            </>
                          )}
                          <Chip
                            label={
                              error.type === 'spelling'
                                ? '✏️ Stavefeil'
                                : error.type === 'grammar'
                                  ? '📝 Grammatikk'
                                  : '💬 Stil'
                            }
                            size="small"
                            color={error.type === 'spelling' ? 'error' : 'warning'}
                          />
                        </Stack>

                        <Stack direction="row" spacing={0.5}>
                          {error.suggestions.length > 0 && (
                            <Tooltip title="Bruk første forslag">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApplySuggestion(error, error.suggestions[0])}
                              >
                                <CheckCircleIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Ignorer">
                            <IconButton size="small" onClick={() => handleIgnoreWord(error.word)}>
                              <Close fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      {/* Reason */}
                      <Typography variant="body2" color="text.primary" sx={{ fontStyle: 'italic' }}>
                        💡 {error.message}
                      </Typography>

                      {/* Context */}
                      <Box
                        sx={{
                          bgcolor: 'background.paper',
                          p: 1,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider'}}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: 'monospace' }}>
                          "...{error.context}..."
                        </Typography>
                      </Box>

                      {/* All Suggestions */}
                      {error.suggestions.length > 1 && (
                        <Collapse in={expandedError === idx} timeout="auto" unmountOnExit>
                          <Divider sx={{ my: 1 }} />
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            sx={{ mb: 1, display: 'block' }}>
                            Alle forslag: </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                            {error.suggestions.map((suggestion, sIdx) => (
                              <Button
                                key={sIdx}
                                size="small"
                                variant="outlined"
                                onClick={() => handleApplySuggestion(error, suggestion)}
                                sx={{ textTransform: 'none' }}>
                                {suggestion}
                              </Button>
                            ))}
                          </Stack>

                          <Divider sx={{ my: 1 }} />
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => handleAddToDictionary(error.word)}
                              variant="text"
                            >
                              Legg til ordbok
                            </Button>
                          </Stack>
                        </Collapse>
                      )}

                      {/* Expand Button */}
                      {error.suggestions.length > 1 && (
                        <Button
                          size="small"
                          onClick={() => setExpandedError(expandedError === idx ? null : idx)}
                          endIcon={<LightbulbIcon />}
                          sx={{ alignSelf: 'flex-start' }}>
                          {expandedError === idx
                            ? 'Skjul detaljer'
                            : `Se alle ${error.suggestions.length} forslag`}
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
          </Stack>
        </Paper>
      )}

      {/* List View */}
      {result && result.errors.length > 0 && viewMode === 'list' && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Feil og forslag: </Typography>

          <List>
            {result.errors
              .filter((error) => !ignoredWords.has(error.word)
              .map((error, idx) => (
                <React.Fragment key={idx}>
                  <ListItem
                    sx={{
                      bgcolor: error.type === 'spelling'
                          ? 'error.light'
                          : error.type === 'grammar'
                            ? 'warning.light'
                            : 'info.light',
                      borderRadius: 1,
                      mb: 1}}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <ErrorIcon fontSize="small" />
                        <Typography variant="body1" sx={{ fontWeight: 600}}>
                          "{error.word}"
                        </Typography>
                        <Chip
                          label={error.type}
                          size="small"
                          color={error.type === 'spelling' ? 'error' : 'warning'}
                        />
                      </Stack>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {error.message}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mb: 2, display:'block' }}>
                        Kontekst: "...{error.context}..."
                      </Typography>

                      {error.suggestions.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600}}>
                            Forslag: </Typography>
                          {error.suggestions.slice(0, 5).map((suggestion, sIdx) => (
                            <Button
                              key={sIdx}
                              size="small"
                              variant="outlined"
                              onClick={() => handleApplySuggestion(error, suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </Stack>
                      )}

                      <Stack direction="row" spacing={1}, sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          startIcon={<RemoveIcon />}
                          onClick={() => handleIgnoreWord(error.word)}
                        >
                          Ignorer
                        </Button>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleAddToDictionary(error.word)}
                        >
                          Legg til ordbok
                        </Button>
                      </Stack>
                    </Box>
                  </ListItem>
                </React.Fragment>
              ))}
          </List>
        </Paper>
      )}

      {/* Success Message */}
      {result && result.errorCount === 0 && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <AlertTitle>✅ Ingen stavefeil funnet!</AlertTitle>
          Teksten din ser bra ut. Ingen stavefeil eller grammatikkfeil ble funnet.
        </Alert>
      )}

      {/* Actions */}
      {result && (
        <Stack direction="row" spacing={2}, sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyCorrectedText}
          >
            Kopier tekst
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setText('');
              setResult(null);
            }}
          >
            Tilbakestill
          </Button>
        </Stack>
      )}

      {/* Custom Dictionary Info */}
      {customDictionary.size > 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <AlertTitle>📖 Din ordbok ({customDictionary.size} ord)</AlertTitle>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {Array.from(customDictionary).map((word) => (
              <Chip
                key={word}
                label={word}
                size="small"
                onDelete={() => {
                  setCustomDictionary((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(word);
                    return newSet;
                  });
                }
              />
            ))}
          </Stack>
        </Alert>
      )}
    </Box>
  );
};

export default NorwegianSpellChecker;
