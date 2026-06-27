import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  ContentCopy,
  Error as ErrorIcon,
  Lightbulb,
  Refresh,
  Spellcheck,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { AdminButton } from './design-system';

type SpellErrorType = 'spelling' | 'grammar' | 'style';

type NorwegianLanguage = 'nb' | 'nn';

interface SpellError {
  word: string;
  position: number;
  length: number;
  suggestions: string[];
  type: SpellErrorType;
  message: string;
  context: string;
}

interface SpellCheckResult {
  text: string;
  errors: SpellError[];
  errorCount: number;
  language: NorwegianLanguage;
  confidence: number;
}

interface NorwegianSpellCheckerProps {
  initialText?: string;
  onTextChange?: (text: string) => void;
  autoCheck?: boolean;
  showStats?: boolean;
}

const FALLBACK_DICTIONARY_NB = new Set([
  'og',
  'i',
  'på',
  'for',
  'med',
  'av',
  'til',
  'som',
  'det',
  'en',
  'et',
  'ikke',
  'kan',
  'skal',
  'video',
  'prosjekt',
  'kunde',
  'story',
  'studio',
  'redigering',
]);

const FALLBACK_DICTIONARY_NN = new Set([
  'og',
  'i',
  'på',
  'for',
  'med',
  'av',
  'til',
  'som',
  'det',
  'ein',
  'eit',
  'ikkje',
  'kan',
  'skal',
  'video',
  'prosjekt',
  'kunde',
  'historie',
  'studio',
  'redigering',
]);

function getDictionary(language: NorwegianLanguage): Set<string> {
  return language === 'nn' ? FALLBACK_DICTIONARY_NN : FALLBACK_DICTIONARY_NB;
}

function tokenize(text: string): Array<{ word: string; start: number }> {
  const matches = Array.from(text.matchAll(/[A-Za-zÆØÅæøå]+/g));
  return matches.map((match) => ({
    word: match[0],
    start: match.index ?? 0,
  }));
}

function levenshteinDistance(left: string, right: string): number {
  const matrix: number[][] = [];

  for (let row = 0; row <= left.length; row += 1) {
    matrix[row] = [row];
  }

  for (let col = 0; col <= right.length; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function suggestionCandidates(word: string, dictionary: Set<string>): string[] {
  const normalizedWord = word.toLowerCase();
  return Array.from(dictionary)
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(normalizedWord, candidate),
    }))
    .filter((entry) => entry.distance <= 2)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3)
    .map((entry) => entry.candidate);
}

function localSpellCheck(
  text: string,
  language: NorwegianLanguage,
  ignoredWords: Set<string>,
  customDictionary: Set<string>,
): SpellCheckResult {
  const dictionary = new Set([...getDictionary(language), ...customDictionary]);
  const tokens = tokenize(text);

  const errors: SpellError[] = tokens
    .filter(({ word }) => {
      const normalized = word.toLowerCase();
      return !dictionary.has(normalized) && !ignoredWords.has(normalized);
    })
    .map(({ word, start }) => {
      const contextStart = Math.max(0, start - 24);
      const contextEnd = Math.min(text.length, start + word.length + 24);
      const context = text.slice(contextStart, contextEnd);

      return {
        word,
        position: start,
        length: word.length,
        suggestions: suggestionCandidates(word, dictionary),
        type: 'spelling',
        message: `Ordet "${word}" finnes ikke i ordlisten`,
        context,
      } satisfies SpellError;
    });

  return {
    text,
    errors,
    errorCount: errors.length,
    language,
    confidence: errors.length === 0 ? 0.99 : Math.max(0.5, 1 - errors.length * 0.02),
  };
}

function normalizeSpellResult(raw: unknown, fallback: SpellCheckResult): SpellCheckResult {
  if (typeof raw !== 'object' || raw === null) {
    return fallback;
  }

  const root = raw as Record<string, unknown>;
  const resultRaw =
    typeof root.result === 'object' && root.result !== null
      ? (root.result as Record<string, unknown>)
      : root;

  const rawErrors = Array.isArray(resultRaw.errors) ? resultRaw.errors : [];
  const errors: SpellError[] = rawErrors
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const word = typeof item.word === 'string' ? item.word : '';
      if (!word) {
        return null;
      }

      const suggestions = Array.isArray(item.suggestions)
        ? item.suggestions.filter((candidate): candidate is string => typeof candidate === 'string')
        : [];

      const typeCandidate = item.type;
      const type: SpellErrorType =
        typeCandidate === 'grammar' || typeCandidate === 'style' ? typeCandidate : 'spelling';

      return {
        word,
        position: typeof item.position === 'number' ? item.position : 0,
        length: typeof item.length === 'number' ? item.length : word.length,
        suggestions,
        type,
        message: typeof item.message === 'string' ? item.message : fallback.errors[0]?.message ?? 'Mulig feil',
        context: typeof item.context === 'string' ? item.context : fallback.text,
      } satisfies SpellError;
    })
    .filter((error): error is SpellError => error !== null);

  const languageRaw = resultRaw.language;
  const language: NorwegianLanguage = languageRaw === 'nn' ? 'nn' : 'nb';

  return {
    text: typeof resultRaw.text === 'string' ? resultRaw.text : fallback.text,
    errors,
    errorCount: typeof resultRaw.errorCount === 'number' ? resultRaw.errorCount : errors.length,
    language,
    confidence: typeof resultRaw.confidence === 'number' ? resultRaw.confidence : fallback.confidence,
  };
}

export const NorwegianSpellChecker: React.FC<NorwegianSpellCheckerProps> = ({
  initialText = '',
  onTextChange,
  autoCheck = true,
  showStats = true,
}) => {
  const { auth, analytics, componentRegistry } = useEnhancedMasterIntegration();

  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState<NorwegianLanguage>('nb');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SpellCheckResult | null>(null);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [customDictionary, setCustomDictionary] = useState<Set<string>>(new Set());

  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'norwegian-spell-checker',
      name: 'Norwegian Spell Checker',
      type: 'admin',
      category: 'settings',
      version: '2.0.0',
      capabilities: ['spell-check', 'norwegian', 'dictionary'],
      dependencies: ['language-api'],
      props: ['initialText', 'autoCheck', 'showStats'],
      events: ['spell-check-completed'],
      dataKeys: ['spell-check-results'],
      lastSeen: Date.now(),
      status: 'active',
    });

    return () => {
      componentRegistry.unregisterComponent('norwegian-spell-checker');
    };
  }, [componentRegistry]);

  const runSpellCheck = useCallback(
    async (textToCheck?: string) => {
      const content = (textToCheck ?? text).trim();
      if (!content) {
        setResult(null);
        return;
      }

      setIsChecking(true);
      analytics.trackEvent('norwegian_spell_check_started', {
        language,
        length: content.length,
      });

      const fallback = localSpellCheck(content, language, ignoredWords, customDictionary);

      try {
        const headers = await auth.getAuthHeader();
        const apiResponse = await apiRequest('/api/admin/norwegian/spell-check', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: {
            text: content,
            language,
            ignoredWords: Array.from(ignoredWords),
            customDictionary: Array.from(customDictionary),
          },
        });

        const normalized = normalizeSpellResult(apiResponse, fallback);
        setResult(normalized);

        analytics.trackEvent('norwegian_spell_check_completed', {
          language,
          errors: normalized.errorCount,
          source: 'api',
        });
      } catch {
        setResult(fallback);
        analytics.trackEvent('norwegian_spell_check_completed', {
          language,
          errors: fallback.errorCount,
          source: 'fallback',
        });
      } finally {
        setIsChecking(false);
      }
    },
    [analytics, auth, customDictionary, ignoredWords, language, text],
  );

  useEffect(() => {
    if (!autoCheck || !text.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runSpellCheck(text);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoCheck, runSpellCheck, text]);

  const applySuggestion = useCallback(
    (error: SpellError, suggestion: string) => {
      const before = text.slice(0, error.position);
      const after = text.slice(error.position + error.length);
      const nextText = `${before}${suggestion}${after}`;
      setText(nextText);
      onTextChange?.(nextText);

      analytics.trackEvent('norwegian_spell_suggestion_applied', {
        original: error.word,
        suggestion,
      });

      if (autoCheck) {
        void runSpellCheck(nextText);
      }
    },
    [analytics, autoCheck, onTextChange, runSpellCheck, text],
  );

  const ignoreWord = useCallback(
    (word: string) => {
      const normalized = word.toLowerCase();
      setIgnoredWords((previous) => new Set([...previous, normalized]));
      analytics.trackEvent('norwegian_spell_word_ignored', { word: normalized });
      if (autoCheck) {
        void runSpellCheck(text);
      }
    },
    [analytics, autoCheck, runSpellCheck, text],
  );

  const addToDictionary = useCallback(
    async (word: string) => {
      const normalized = word.toLowerCase();
      setCustomDictionary((previous) => new Set([...previous, normalized]));

      try {
        const headers = await auth.getAuthHeader();
        await apiRequest('/api/admin/norwegian/dictionary/add', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: {
            word: normalized,
            language,
          },
        });
      } catch {
        // Local dictionary update already applied.
      }

      analytics.trackEvent('norwegian_spell_dictionary_add', {
        word: normalized,
        language,
      });

      if (autoCheck) {
        void runSpellCheck(text);
      }
    },
    [analytics, auth, autoCheck, language, runSpellCheck, text],
  );

  const copyCorrectedText = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    analytics.trackEvent('norwegian_spell_copy_text', {
      length: text.length,
    });
  }, [analytics, text]);

  const errorTypeCounts = useMemo(() => {
    const counts: Record<SpellErrorType, number> = {
      spelling: 0,
      grammar: 0,
      style: 0,
    };

    result?.errors.forEach((error) => {
      counts[error.type] += 1;
    });

    return counts;
  }, [result]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Spellcheck color="primary" />
          Norsk stavekontroll
        </Typography>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Kopier korrigert tekst">
            <IconButton onClick={() => void copyCorrectedText()}>
              <ContentCopy />
            </IconButton>
          </Tooltip>
          <AdminButton
            tone="primary"
            loading={isChecking}
            startIcon={<Refresh />}
            disabled={isChecking || text.trim().length === 0}
            onClick={() => void runSpellCheck()}
          >
            {isChecking ? 'Sjekker...' : 'Sjekk nå'}
          </AdminButton>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          value={language}
          onChange={(_, value: NorwegianLanguage | null) => {
            if (value) {
              setLanguage(value);
            }
          }}
          size="small"
        >
          <ToggleButton value="nb">Bokmål</ToggleButton>
          <ToggleButton value="nn">Nynorsk</ToggleButton>
        </ToggleButtonGroup>

        {showStats && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip icon={<ErrorIcon />} label={`Feil: ${result?.errorCount ?? 0}`} color="error" size="small" />
            <Chip label={`Staving: ${errorTypeCounts.spelling}`} size="small" />
            <Chip label={`Grammatikk: ${errorTypeCounts.grammar}`} size="small" />
            <Chip label={`Stil: ${errorTypeCounts.style}`} size="small" />
            <Chip
              icon={<CheckCircle />}
              label={`Confidence: ${Math.round((result?.confidence ?? 0) * 100)}%`}
              size="small"
              color="success"
            />
          </Stack>
        )}
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={8}
          maxRows={16}
          label="Tekst"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onTextChange?.(event.target.value);
          }}
        />
      </Paper>

      {result && result.errorCount === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Ingen stavefeil funnet.
        </Alert>
      )}

      {result && result.errorCount > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Lightbulb color="warning" />
              Forslag ({result.errorCount})
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <List dense>
              {result.errors.map((error, index) => (
                <ListItem key={`${error.word}-${error.position}-${index}`} alignItems="flex-start" divider>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip size="small" color="error" label={error.word} />
                        <Typography variant="body2">{error.message}</Typography>
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={1} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Kontekst: {error.context}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {error.suggestions.length === 0 && (
                            <Chip size="small" label="Ingen forslag" variant="outlined" />
                          )}
                          {error.suggestions.map((suggestion) => (
                            <Button
                              key={`${error.word}-${suggestion}`}
                              size="small"
                              variant="outlined"
                              onClick={() => applySuggestion(error, suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                          <Button size="small" onClick={() => ignoreWord(error.word)}>
                            Ignorer
                          </Button>
                          <Button size="small" onClick={() => void addToDictionary(error.word)}>
                            Legg til i ordbok
                          </Button>
                        </Stack>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default NorwegianSpellChecker;
