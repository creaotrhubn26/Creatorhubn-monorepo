/**
 * EmailNorwegianSpellCheck - Lightweight spell checker for email designer
 * Integrates with RichTextEditor for real-time Norwegian spell checking
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Collapse,
  Alert,
  Badge,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Spellcheck as SpellcheckIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface SpellError {
  word: string;
  type: 'spelling' | 'grammar' | 'style';
  message: string;
  suggestions: string[];
  context: string;
  position: number;
  length: number;
}

interface EmailNorwegianSpellCheckProps {
  text: string; // Plain text or HTML content
  onApplySuggestion?: (original: string, suggestion: string) => void;
  onIgnoreWord?: (word: string) => void;
  language?: 'nb' | 'nn'; // Bokmål (default) or Nynorsk
  autoCheck?: boolean;
}

export default function EmailNorwegianSpellCheck({
  text,
  onApplySuggestion,
  onIgnoreWord,
  language = 'nb',
  autoCheck = true,
}: EmailNorwegianSpellCheckProps) {
  const [errors, setErrors] = useState<SpellError[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [lastCheckedText, setLastCheckedText] = useState('');

  // Extract plain text from HTML
  const extractPlainText = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || ', ';
  };

  const plainText = extractPlainText(text);

  // Check if text contains Norwegian characters
  const hasNorwegianText = /[æøåÆØÅ]/.test(plainText);

  // Auto-check with debounce
  useEffect(() => {
    if (!autoCheck || !hasNorwegianText || plainText === lastCheckedText || plainText.length < 10) {
      return;
    }

    const timer = setTimeout(() => {
      checkSpelling();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [plainText, autoCheck, hasNorwegianText]);

  // Perform spell check
  const checkSpelling = useCallback(async () => {
    if (plainText.trim().length < 10) {
      setErrors([]);
      return;
    }

    setIsChecking(true);
    try {
      // Simplified spell check using basic Norwegian dictionary
      const response = await checkNorwegianSpelling(plainText, language, Array.from(ignoredWords));

      if (response.errors) {
        const filteredErrors = response.errors.filter(
          (err: SpellError) => !ignoredWords.has(err.word),
        );
        setErrors(filteredErrors);
        setLastCheckedText(plainText);
      }
    } catch (error) {
      console.error('Norwegian spell check failed: ', error);
      // Fall back to basic check
      const basicErrors = performBasicNorwegianCheck(plainText);
      setErrors(basicErrors);
    } finally {
      setIsChecking(false);
    }
  }, [plainText, language, ignoredWords]);

  // Handle applying suggestion
  const handleApplySuggestion = (error: SpellError, suggestion: string) => {
    onApplySuggestion?.(error.word, suggestion);
    setErrors((prev) => prev.filter((e) => e.word !== error.word));
  };

  // Handle ignoring word
  const handleIgnore = (word: string) => {
    setIgnoredWords((prev) => new Set(prev).add(word));
    setErrors((prev) => prev.filter((e) => e.word !== word));
    onIgnoreWord?.(word);
  };

  // Don't show if no Norwegian text
  if (!hasNorwegianText) {
    return (
      <Alert severity="info" sx={{ fontSize: 11 }}>
        💡 Norsk stavekontroll aktiveres automatisk når du skriver norsk tekst
      </Alert>
    );
  }

  const errorCount = errors.length;

  return (
    <Paper sx={{ p: 2 }} elevation={0}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpellcheckIcon color={errorCount > 0 ? 'warning' : 'success'} fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
            Norsk stavekontroll
          </Typography>
          <Chip
            label={language === 'nb' ? 'Bokmål' : 'Nynorsk'}
            size="small"
            sx={{ height: 18, fontSize: 10 }} />
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {isChecking && <CircularProgress size={16} />}
          <Badge badgeContent={errorCount} color="error" max={99}>
            <IconButton
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              disabled={errorCount === 0}
            >
              <ExpandIcon
                sx={{
                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                  transition: '0.3s'}} />
            </IconButton>
          </Badge>
          <Tooltip title="Sjekk på nytt">
            <IconButton size="small" onClick={checkSpelling} disabled={isChecking}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Status */}
      {!isChecking && errorCount === 0 && lastCheckedText && (
        <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 1, py: 0 }}>
          <Typography variant="caption">Ingen stavefeil funnet! ✓</Typography>
        </Alert>
      )}

      {/* Errors List */}
      <Collapse in={isExpanded && errorCount > 0}>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Funnet {errorCount} feil: </Typography>

          <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
            {errors.map((error, index) => (
              <ListItem
                key={index}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  mb: 1,
                  p: 1,
                  border: '1px solid',
                  borderColor: error.type === 'spelling' ? 'error.light' : 'warning.light'}}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 0.5 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                      {error.word}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {error.message}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleIgnore(error.word)}
                    sx={{ mt: -0.5 }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Context */}
                {error.context && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontStyle: 'italic',
                      color: 'text.secondary',
                      mb: 1,
                      display: 'block',
                      fontSize: 10}}>
                    "...{error.context}..."
                  </Typography>
                )}

                {/* Suggestions */}
                {error.suggestions.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                    {error.suggestions.slice(0, 5).map((suggestion, idx) => (
                      <Chip
                        key={idx}
                        label={suggestion}
                        size="small"
                        onClick={() => handleApplySuggestion(error, suggestion)}
                        sx={{
                          height: 24,
                          fontSize: 11,
                          cursor: 'pointer','&:hover': { bgcolor: 'primary.light', color: 'white' }}}
                      />
                    ))}
                  </Stack>
                )}
              </ListItem>
            ))}
          </List>
        </Box>
      </Collapse>

      {/* Tips */}
      {hasNorwegianText && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'info.lighter', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            💡 Tips: Automatisk stavekontroll kjører mens du skriver. Klikk på forslag for å
            erstatte ord.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Actual API call to spell checker
async function checkNorwegianSpelling(
  text: string,
  language: 'nb' | 'nn',
  ignoredWords: string[],
): Promise<{ errors: SpellError[] }> {
  try {
    const response = await apiRequest('/api/admin/norwegian/spell-check', {
      method: 'POST',
      body: JSON.stringify({
        text,
        language,
        ignoredWords,
      }),
    });

    return response;
  } catch (error) {
    console.error('API spell check failed, using fallback: ', error);
    throw error;
  }
}

// Basic fallback Norwegian spell checker
function performBasicNorwegianCheck(text: string): SpellError[] {
  const errors: SpellError[] = [];
  const words = text.split(/\s+/);

  // Common Norwegian spelling mistakes
  const commonMistakes: Record<string, string[]> = {
    mye: ['myhe','muke'],
    kunne: ['kunna','konne'],
    skulle: ['skulla','skolle'],
    hadde: ['hade','hadda'],
    ville: ['villa','vilje'],
    være: ['vare','vere'],
    gjøre: ['gjore','gjære'],
    få: ['faa','fa'],
    å: ['aa','a'],
    år: ['aar'],
    før: ['for'],
    går: ['gaar','gar'],
    også: ['ogsa', 'ocksa'],
    høyre: ['hoyre'],
    venstre: ['vensra'],
    nord: ['nort'],
    sør: ['sor'],
    øst: ['ost'],
    vest: ['vest'],
  };

  // Check each word
  words.forEach((word, index) => {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');

    // Check against common mistakes (reversed lookup)
    for (const [correct, mistakes] of Object.entries(commonMistakes)) {
      if (mistakes.includes(cleanWord)) {
        errors.push({
          word: word,
          type:'spelling',
          message: `Mulig stavefeil. Mente du "${correct}"?`,
          suggestions: [correct],
          context: words.slice(Math.max(0, index - 2), index + 3).join(''),
          position: text.indexOf(word),
          length: word.length,
        });
      }
    }
  });

  return errors;
}
