/**
 * InlineNorwegianSpellChecker.tsx
 *
 * Real-time inline Norwegian spelling and grammar checker
 * Shows contextual suggestions while typing with quick fix options
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Chip,
  Stack,
  Tooltip,
  Collapse,
  Badge,
  CircularProgress,
  Alert,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Spellcheck as SpellcheckIcon,
  Lightbulb as LightbulbIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SpellingError {
  word: string;
  type: 'spelling' | 'grammar' | 'style';
  message: string;
  suggestions: string[];
  context: string;
  offset: number;
  length: number;
}

interface InlineNorwegianSpellCheckerProps {
  content: string; // HTML or plain text content
  language?: 'nb' | 'nn'; // Bokmål or Nynorsk
  autoCheck?: boolean; // Auto-check while typing
  debounceMs?: number; // Debounce delay
  maxInlineErrors?: number; // Max errors to show inline
  onReplace?: (_original: string, _suggested: string) => void;
  onIgnore?: (_word: string) => void;
  onOpenPanel?: () => void; // Callback to open full panel
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function InlineNorwegianSpellChecker({
  content,
  language = 'nb',
  autoCheck = true,
  debounceMs = 1000,
  maxInlineErrors = 3,
  onReplace,
  onIgnore,
  onOpenPanel,
}: InlineNorwegianSpellCheckerProps) {
  const [errors, setErrors] = useState<SpellingError[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [lastCheckedContent, setLastCheckedContent] = useState('');
  const { auth } = useEnhancedMasterIntegration();

  // Extract plain text from HTML
  const plainText = useMemo(() => {
    const div = document.createElement('div');
    div.innerHTML = content;
    return div.textContent || div.innerText || ', ';
  }, [content]);

  // Check if content contains Norwegian text
  const hasNorwegianText = useMemo(() => {
    const norwegianChars = /[æøåÆØÅ]/;
    return norwegianChars.test(plainText);
  }, [plainText]);

  // Debounced spell check
  useEffect(() => {
    if (!autoCheck || !hasNorwegianText || plainText === lastCheckedContent) {
      return;
    }

    const timer = setTimeout(() => {
      checkSpelling();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [plainText, autoCheck, hasNorwegianText, language]);

  // Check spelling via API
  const checkSpelling = useCallback(async () => {
    if (plainText.trim().length < 10) {
      setErrors([]);
      return;
    }

    setIsChecking(true);
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/norwegian/spell-check', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: plainText,
          language,
          ignoredWords: Array.from(ignoredWords),
        }),
      });

      if (response.success && response.result) {
        // Filter out ignored words
        const filteredErrors = response.result.errors.filter(
          (err: SpellingError) => !ignoredWords.has(err.word),
        );

        setErrors(filteredErrors);
        setLastCheckedContent(plainText);
      }
    } catch (error) {
      console.error('Spell check failed: ', error);
      setErrors([]);
    } finally {
      setIsChecking(false);
    }
  }, [plainText, language, ignoredWords]);

  // Handle replace suggestion
  const handleReplace = useCallback(
    (error: SpellingError, suggestion: string) => {
      onReplace?.(error.word, suggestion);

      // Remove this error from list
      setErrors((prev) => prev.filter((e) => e.word !== error.word));
    },
    [onReplace],
  );

  // Handle ignore word
  const handleIgnore = useCallback(
    (word: string) => {
      setIgnoredWords((prev) => new Set(prev).add(word);
      setErrors((prev) => prev.filter((e) => e.word !== word));
      onIgnore?.(word);
    },
    [onIgnore],
  );

  // Manual check
  const handleManualCheck = useCallback(() => {
    checkSpelling();
  }, [checkSpelling]);

  // Don't show if no Norwegian text
  if (!hasNorwegianText) {
    return null;
  }

  // Errors to display inline
  const inlineErrors = errors.slice(0, maxInlineErrors);
  const hasMoreErrors = errors.length > maxInlineErrors;

  return (
    <Fade in={errors.length > 0 || isChecking}>
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 380,
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'hidden',
          zIndex: 130,
          border: '2px solid',
          borderColor: 'warning.main'}}
      >
        {/* Header */}
        <Box
          sx={{
            p: 1.5
           , bgcolor: 'warning.light',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'}}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Badge badgeContent={errors.length} color="error">
              <SpellcheckIcon />
            </Badge>
            <Typography variant="subtitle2" fontWeight="bold">
              Norsk stavekontroll
            </Typography>
            {isChecking && <CircularProgress size={16} />}
          </Stack>

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Sjekk på nytt">
              <IconButton size="small" onClick={handleManualCheck} disabled={isChecking}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {onOpenPanel && (
              <Tooltip title="Åpne fullstendig panel">
                <IconButton size="small" onClick={onOpenPanel}>
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Utvid">
              <IconButton
                size="small"
                onClick={() => setIsExpanded(!isExpanded)}
                sx={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'}}
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Content */}
        <Collapse in={isExpanded} collapsedSize={200}>
          <Box sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
            {errors.length === 0 && !isChecking && (
              <Alert severity="success" icon={<CheckCircleIcon />}>
                <Typography variant="body2">Ingen stavefeil funnet! 🎉</Typography>
              </Alert>
            )}

            {isChecking && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CircularProgress size={32} />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Sjekker tekst...
                </Typography>
              </Box>
            )}

            {/* Inline errors */}
            <Stack spacing={1.5}>
              {inlineErrors.map((error, idx) => (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{
                    p: 1.5
                   , bgcolor: error.type === 'spelling'
                        ? 'error.light'
                        : error.type === 'grammar'
                          ? 'warning.light'
                          : 'info.light',
                    opacity: 0.95
                    border: '1px solid',
                    borderColor: error.type === 'spelling'
                        ? 'error.main'
                        : error.type === 'grammar'
                          ? 'warning.main'
                          : 'info.main'}}
                >
                  <Stack spacing={1}>
                    {/* Error word and first suggestion */}
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight="bold" color="error.dark">
                        {error.word}
                      </Typography>
                      {error.suggestions.length > 0 && (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            →
                          </Typography>
                          <Typography variant="body2" fontWeight="bold" color="success.dark">
                            {error.suggestions[0]}
                          </Typography>
                        </>
                      )}
                      <Chip
                        label={
                          error.type === 'spelling' ? '✏️' : error.type === 'grammar' ? '📝' : '💬'
                        }
                        size="small"
                        sx={{ minWidth: 32, height: 20 }}
                      />
                    </Stack>

                    {/* Reason */}
                    <Typography variant="caption" color="text.primary" sx={{ fontStyle: 'italic' }}>
                      💡 {error.message}
                    </Typography>

                    {/* Context */}
                    <Box
                      sx={{
                        bgcolor: 'background.paper',
                        p: 0.75
                        borderRadius: 0.5
                       , border: '1px solid',
                        borderColor: 'divider'}}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      >
                        "...{error.context}..."
                      </Typography>
                    </Box>

                    {/* Actions */}
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {error.suggestions.length > 0 && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleReplace(error, error.suggestions[0])}
                          startIcon={<CheckCircleIcon />}
                          sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                        >
                          Bruk
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleIgnore(error.word)}
                        startIcon={<CloseIcon />}
                        sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                      >
                        Ignorer
                      </Button>
                    </Stack>

                    {/* More suggestions */}
                    {error.suggestions.length > 1 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                        {error.suggestions.slice(1, 4).map((suggestion, sIdx) => (
                          <Chip
                            key={sIdx}
                            label={suggestion}
                            size="small"
                            onClick={() => handleReplace(error, suggestion)}
                            clickable
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              ))}

              {/* More errors indicator */}
              {hasMoreErrors && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  onClick={onOpenPanel}
                  startIcon={<LightbulbIcon />}
                  endIcon={<OpenInNewIcon />}
                >
                  Se {errors.length - maxInlineErrors} flere forslag
                </Button>
              )}
            </Stack>
          </Box>
        </Collapse>

        {/* Quick info when collapsed */}
        {!isExpanded && errors.length > 0 && (
          <Box
            sx={{
              p: 1,
              bgcolor: 'background.default',
              borderTop: '1px solid',
              borderColor: 'divider',
              textAlign:'center'}}
          >
            <Typography variant="caption" color="text.secondary">
              Klikk for å se alle {errors.length} forslag
            </Typography>
          </Box>
        )}
      </Paper>
    </Fade>
  );
}
