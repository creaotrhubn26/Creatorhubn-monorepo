/**
 * Grammar Suggestions Overlay
 * 
 * Real-time inline grammar suggestions that appear as users type.
 * Features:
 * - Floating suggestions near cursor
 * - Quick-accept with keyboard shortcuts
 * - Learn user preferences over time
 * - Smooth animations for non-disruptive experience
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Popper,
  ClickAwayListener,
  Divider,
  LinearProgress,
  Stack,
  alpha,
} from '@mui/material';
import {
  Check as AcceptIcon,
  Close as DismissIcon,
  AutoFixHigh as AutoFixIcon,
  Psychology as LearnIcon,
  Lightbulb as SuggestionIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  grammarMLService,
  GrammarError,
  GrammarSuggestion,
  useGrammarCheck,
} from '../../services/grammarMLService';

// ============================================================================
// Types
// ============================================================================

interface GrammarSuggestionsOverlayProps {
  content: string;
  cursorPosition: { line: number; column: number };
  onApplySuggestion: (
    lineNumber: number,
    columnStart: number,
    columnEnd: number,
    newText: string
  ) => void;
  enabled?: boolean;
  debounceMs?: number;
  maxSuggestions?: number;
  anchorEl?: HTMLElement | null;
  darkMode?: boolean;
}

interface InlineErrorMarker {
  error: GrammarError;
  element: HTMLElement | null;
}

// ============================================================================
// Severity Icon Helper
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

const getSeverityColor = (severity: GrammarError['severity']) => {
  switch (severity) {
    case 'error':
      return '#f44336';
    case 'warning':
      return '#ff9800';
    case 'suggestion':
      return '#2196f3';
    default:
      return '#9e9e9e';
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

// ============================================================================
// Main Component
// ============================================================================

export const GrammarSuggestionsOverlay: React.FC<GrammarSuggestionsOverlayProps> = ({
  content,
  cursorPosition,
  onApplySuggestion,
  enabled = true,
  debounceMs = 300,
  maxSuggestions = 3,
  anchorEl,
  darkMode = true,
}) => {
  const { errors, loading } = useGrammarCheck(content, debounceMs);
  const [selectedError, setSelectedError] = useState<GrammarError | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const popperRef = useRef<HTMLDivElement>(null);

  // Filter errors near cursor
  const nearbyErrors = useMemo(() => {
    if (!enabled) return [];
    
    return errors
      .filter(e => !dismissedErrors.has(e.id))
      .filter(e => {
        // Show errors on current line or within 2 lines
        const lineDiff = Math.abs(e.lineNumber - cursorPosition.line);
        if (lineDiff > 2) return false;
        
        // Prioritize errors near cursor column
        if (e.lineNumber === cursorPosition.line) {
          const columnDiff = Math.abs(e.columnStart - cursorPosition.column);
          return columnDiff < 50; // Within 50 characters
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by proximity to cursor
        const aLineDiff = Math.abs(a.lineNumber - cursorPosition.line);
        const bLineDiff = Math.abs(b.lineNumber - cursorPosition.line);
        if (aLineDiff !== bLineDiff) return aLineDiff - bLineDiff;
        
        const aColDiff = Math.abs(a.columnStart - cursorPosition.column);
        const bColDiff = Math.abs(b.columnStart - cursorPosition.column);
        if (aColDiff !== bColDiff) return aColDiff - bColDiff;
        
        // Then by confidence
        return b.confidence - a.confidence;
      })
      .slice(0, maxSuggestions);
  }, [errors, cursorPosition, enabled, dismissedErrors, maxSuggestions]);

  // Auto-select first error
  useEffect(() => {
    if (nearbyErrors.length > 0 && !selectedError) {
      setSelectedError(nearbyErrors[0]);
    } else if (nearbyErrors.length === 0) {
      setSelectedError(null);
    }
  }, [nearbyErrors, selectedError]);

  // Handle accepting a suggestion
  const handleAccept = useCallback((error: GrammarError, suggestion: GrammarSuggestion) => {
    onApplySuggestion(
      error.lineNumber,
      error.columnStart,
      error.columnEnd,
      suggestion.text
    );
    
    // Record acceptance for learning
    grammarMLService.acceptSuggestion(error, suggestion, error.context);
    
    // Remove from view
    setDismissedErrors(prev => new Set([...prev, error.id]));
    setSelectedError(null);
  }, [onApplySuggestion]);

  // Handle dismissing an error
  const handleDismiss = useCallback((error: GrammarError) => {
    grammarMLService.ignoreSuggestion(error, error.context);
    setDismissedErrors(prev => new Set([...prev, error.id]));
    
    if (selectedError?.id === error.id) {
      setSelectedError(null);
    }
  }, [selectedError]);

  // Handle ignoring rule permanently
  const handleIgnoreRule = useCallback((error: GrammarError) => {
    grammarMLService.ignoreRule(error.ruleId);
    setDismissedErrors(prev => new Set([...prev, error.id]));
    setSelectedError(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedError || !enabled) return;

      // Tab to accept first suggestion
      if (e.key === 'Tab' && e.ctrlKey && selectedError.suggestions.length > 0) {
        e.preventDefault();
        handleAccept(selectedError, selectedError.suggestions[0]);
      }

      // Escape to dismiss
      if (e.key === 'Escape' && showDetails) {
        e.preventDefault();
        setShowDetails(false);
      }

      // Alt+G to toggle grammar overlay
      if (e.key === 'g' && e.altKey) {
        e.preventDefault();
        setShowDetails(!showDetails);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedError, enabled, showDetails, handleAccept]);

  if (!enabled || nearbyErrors.length === 0) {
    return null;
  }

  const bgColor = darkMode ? 'rgba(30, 30, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const textColor = darkMode ? '#fff' : '#000';
  const borderColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <>
      {/* Floating suggestions bar */}
      <Popper
        open={true}
        anchorEl={anchorEl}
        placement="bottom-start"
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 8],
            },
          },
          {
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
              padding: 8,
            },
          },
        ]}
        transition
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              ref={popperRef}
              elevation={8}
              sx={{
                bgcolor: bgColor,
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 2,
                maxWidth: 400,
                minWidth: 280,
                overflow: 'hidden',
              }}
            >
              {loading && (
                <LinearProgress
                  sx={{
                    height: 2,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                  }}
                />
              )}

              {/* Compact error list */}
              <Box sx={{ p: 1 }}>
                {nearbyErrors.map((error, idx) => (
                  <Box
                    key={error.id}
                    onClick={() => setSelectedError(error)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.75,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: selectedError?.id === error.id
                        ? alpha(getSeverityColor(error.severity), 0.15)
                        : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(getSeverityColor(error.severity), 0.1),
                      },
                      borderLeft: `3px solid ${getSeverityColor(error.severity)}`,
                      mb: idx < nearbyErrors.length - 1 ? 0.5 : 0,
                    }}
                  >
                    {getSeverityIcon(error.severity)}
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {error.shortMessage}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          opacity: 0.7,
                          fontSize: '0.7rem',
                        }}
                      >
                        "{error.originalText}"
                        {error.suggestions[0] && (
                          <> → "{error.suggestions[0].text}"</>
                        )}
                      </Typography>
                    </Box>

                    {/* Quick accept button */}
                    {error.suggestions.length > 0 && (
                      <Tooltip title="Godta forslag (Ctrl+Tab)">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(error, error.suggestions[0]);
                          }}
                          sx={{
                            color: 'success.main',
                            '&:hover': { bgcolor: alpha('#4caf50', 0.1) },
                          }}
                        >
                          <AcceptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    <Tooltip title="Ignorer">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(error);
                        }}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { bgcolor: alpha('#f44336', 0.1) },
                        }}
                      >
                        <DismissIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>

              {/* Expanded details for selected error */}
              {selectedError && showDetails && (
                <>
                  <Divider sx={{ borderColor }} />
                  <Box sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {selectedError.message}
                    </Typography>

                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
                      <Chip
                        label={getTypeLabel(selectedError.type)}
                        size="small"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                      <Chip
                        label={`${Math.round(selectedError.confidence * 100)}% sikker`}
                        size="small"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                      {selectedError.suggestions[0]?.source === 'learned' && (
                        <Chip
                          icon={<LearnIcon sx={{ fontSize: '0.8rem !important' }} />}
                          label="Lært"
                          size="small"
                          color="success"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </Stack>

                    {/* All suggestions */}
                    <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mb: 0.5 }}>
                      Forslag:
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {selectedError.suggestions.map((suggestion, idx) => (
                        <Chip
                          key={idx}
                          label={suggestion.text}
                          size="small"
                          onClick={() => handleAccept(selectedError, suggestion)}
                          icon={suggestion.source === 'learned' ? <LearnIcon /> : undefined}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: idx === 0 ? alpha('#4caf50', 0.2) : undefined,
                            '&:hover': { bgcolor: alpha('#4caf50', 0.3) },
                          }}
                        />
                      ))}
                    </Stack>

                    <Divider sx={{ my: 1, borderColor }} />

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Ignorer alltid denne regelen">
                        <Chip
                          label="Ignorer regel"
                          size="small"
                          variant="outlined"
                          onClick={() => handleIgnoreRule(selectedError)}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Tooltip>
                    </Stack>
                  </Box>
                </>
              )}

              {/* Toggle details */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  py: 0.25,
                  borderTop: `1px solid ${borderColor}`,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha('#fff', 0.05) },
                }}
                onClick={() => setShowDetails(!showDetails)}
              >
                <ArrowDownIcon
                  fontSize="small"
                  sx={{
                    transform: showDetails ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    opacity: 0.5,
                  }}
                />
              </Box>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
};

// ============================================================================
// Aggressiveness Slider Component
// ============================================================================

interface AggressivenessSliderProps {
  value: number;
  onChange: (value: number) => void;
  darkMode?: boolean;
}

export const AggressivenessSlider: React.FC<AggressivenessSliderProps> = ({
  value,
  onChange,
  darkMode = true,
}) => {
  const labels = ['Minimal', 'Forsiktig', 'Balansert', 'Aktiv', 'Aggressiv'];
  const labelIndex = Math.min(4, Math.floor(value * 5));

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="caption" sx={{ opacity: 0.7, mb: 1, display: 'block' }}>
        Korrigeringsintensitet: <strong>{labels[labelIndex]}</strong>
      </Typography>
      <Box
        component="input"
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        sx={{
          width: '100%',
          height: 4,
          appearance: 'none',
          bgcolor: 'rgba(255,255,255,0.2)',
          borderRadius: 2,
          outline: 'none',
          '&::-webkit-slider-thumb': {
            appearance: 'none',
            width: 16,
            height: 16,
            bgcolor: 'primary.main',
            borderRadius: '50%',
            cursor: 'pointer',
          },
        }}
      />
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.65rem' }}>
          Færre forslag
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.65rem' }}>
          Flere forslag
        </Typography>
      </Stack>
    </Box>
  );
};

// ============================================================================
// Grammar Stats Widget
// ============================================================================

interface GrammarStatsWidgetProps {
  darkMode?: boolean;
}

export const GrammarStatsWidget: React.FC<GrammarStatsWidgetProps> = ({
  darkMode = true,
}) => {
  const [stats, setStats] = useState(grammarMLService.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(grammarMLService.getStats());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const bgColor = darkMode ? 'rgba(30, 30, 50, 0.8)' : 'rgba(255, 255, 255, 0.9)';

  return (
    <Paper
      sx={{
        p: 1.5,
        bgcolor: bgColor,
        borderRadius: 2,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <LearnIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">
          Læringsstatus
        </Typography>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Korrigeringer
          </Typography>
          <Typography variant="h6">
            {stats.learningStats.totalCorrections}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Akseptrate
          </Typography>
          <Typography variant="h6">
            {Math.round(stats.learningStats.acceptanceRate * 100)}%
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Lærte mønstre
          </Typography>
          <Typography variant="h6">
            {stats.learningStats.learnedPatterns}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Modellstørrelse
          </Typography>
          <Typography variant="h6">
            {stats.modelSize.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 1 }} />

      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
        Anbefalt intensitet: {Math.round(stats.suggestedAggressiveness * 100)}%
      </Typography>
    </Paper>
  );
};

export default GrammarSuggestionsOverlay;
