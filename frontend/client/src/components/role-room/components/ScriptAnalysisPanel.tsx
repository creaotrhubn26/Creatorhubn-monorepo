/**
 * ScriptAnalysisPanel - Story consistency and character conflict detection
 * 
 * Analyzes screenplay for:
 * - Character name conflicts (similar names, typos)
 * - Story consistency issues (timeline, continuity)
 * - Script statistics
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  Alert,
  Badge,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Person as CharacterIcon,
  Timeline as TimelineIcon,
  Movie as SceneIcon,
  Chat as DialogueIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Build as FixIcon,
  NavigateBefore as GotoIcon,
} from '@mui/icons-material';
import {
  analyzeScript,
  ScriptAnalysisResult,
  CharacterConflict,
  ConsistencyIssue,
} from '../services/scriptAnalysisService';

interface ScriptAnalysisPanelProps {
  content: string;
  onGotoLine?: (lineNumber: number) => void;
  darkMode?: boolean;
}

const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
  switch (severity) {
    case 'error':
      return <ErrorIcon sx={{ color: '#ef4444' }} />;
    case 'warning':
      return <WarningIcon sx={{ color: '#f59e0b' }} />;
    default:
      return <InfoIcon sx={{ color: '#3b82f6' }} />;
  }
};

const getSeverityColor = (severity: 'error' | 'warning' | 'info') => {
  switch (severity) {
    case 'error':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    default:
      return '#3b82f6';
  }
};

export const ScriptAnalysisPanel: React.FC<ScriptAnalysisPanelProps> = ({
  content,
  onGotoLine,
  darkMode = true,
}) => {
  const [expanded, setExpanded] = useState<string | false>('conflicts');

  // Analyze script
  const analysis = useMemo((): ScriptAnalysisResult => {
    return analyzeScript(content);
  }, [content]);

  const handleAccordionChange = (panel: string) => (
    _event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpanded(isExpanded ? panel : false);
  };

  const totalIssues = analysis.characterConflicts.length + analysis.consistencyIssues.length;
  const errors = [...analysis.characterConflicts, ...analysis.consistencyIssues]
    .filter(i => i.severity === 'error').length;
  const warnings = [...analysis.characterConflicts, ...analysis.consistencyIssues]
    .filter(i => i.severity === 'warning').length;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: darkMode ? '#1a1a2e' : '#f8f9fa',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: darkMode ? 'rgba(30,30,50,0.9)' : 'rgba(255,255,255,0.95)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6" sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckIcon color="primary" />
            Manus-analyse
          </Typography>
          <Tooltip title="Analyser på nytt">
            <IconButton size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Summary Chips */}
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
          {totalIssues === 0 ? (
            <Chip
              icon={<CheckIcon />}
              label="Ingen problemer funnet"
              color="success"
              size="small"
            />
          ) : (
            <>
              {errors > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${errors} feil`}
                  size="small"
                  sx={{ bgcolor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                />
              )}
              {warnings > 0 && (
                <Chip
                  icon={<WarningIcon />}
                  label={`${warnings} advarsler`}
                  size="small"
                  sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
                />
              )}
              {totalIssues - errors - warnings > 0 && (
                <Chip
                  icon={<InfoIcon />}
                  label={`${totalIssues - errors - warnings} info`}
                  size="small"
                  sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}
                />
              )}
            </>
          )}
        </Stack>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {/* Statistics */}
        <Accordion
          expanded={expanded === 'stats'}
          onChange={handleAccordionChange('stats')}
          sx={{
            bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
            '&:before': { display: 'none' },
            mb: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SceneIcon color="primary" />
              <Typography variant="subtitle2">Statistikk</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <Paper
                  sx={{
                    p: 2,
                    flex: 1,
                    bgcolor: 'rgba(59,130,246,0.1)',
                    borderRadius: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" color="primary.main">
                    {analysis.stats.totalScenes}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Scener
                  </Typography>
                </Paper>
                <Paper
                  sx={{
                    p: 2,
                    flex: 1,
                    bgcolor: 'rgba(34,197,94,0.1)',
                    borderRadius: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h4" sx={{ color: '#22c55e' }}>
                    {analysis.stats.totalCharacters}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Karakterer
                  </Typography>
                </Paper>
              </Stack>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Lengste scene
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip
                    label={`Scene ${analysis.stats.longestScene.number}`}
                    size="small"
                    color="primary"
                  />
                  <Typography variant="body2">
                    {analysis.stats.longestScene.lines} linjer
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Korteste scene
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip
                    label={`Scene ${analysis.stats.shortestScene.number}`}
                    size="small"
                  />
                  <Typography variant="body2">
                    {analysis.stats.shortestScene.lines} linjer
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Character Conflicts */}
        <Accordion
          expanded={expanded === 'conflicts'}
          onChange={handleAccordionChange('conflicts')}
          sx={{
            bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
            '&:before': { display: 'none' },
            mb: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <Badge badgeContent={analysis.characterConflicts.length} color="warning">
                <CharacterIcon color="primary" />
              </Badge>
              <Typography variant="subtitle2">Karakternavn-konflikter</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {analysis.characterConflicts.length === 0 ? (
              <Alert severity="success" sx={{ m: 2 }}>
                Ingen karakternavn-konflikter funnet!
              </Alert>
            ) : (
              <List dense>
                {analysis.characterConflicts.map((conflict, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      borderLeft: `3px solid ${getSeverityColor(conflict.severity)}`,
                      mb: 0.5,
                    }}
                    secondaryAction={
                      <Tooltip title="Gå til linje">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => onGotoLine?.(conflict.lineNumbers[0])}
                        >
                          <GotoIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getSeverityIcon(conflict.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {conflict.characters.map((char, i) => (
                            <Chip
                              key={i}
                              label={char}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          ))}
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                            {conflict.description}
                          </Typography>
                          {conflict.suggestion && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 0.5,
                                color: 'primary.main',
                              }}
                            >
                              <FixIcon sx={{ fontSize: 14 }} />
                              {conflict.suggestion}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Consistency Issues */}
        <Accordion
          expanded={expanded === 'consistency'}
          onChange={handleAccordionChange('consistency')}
          sx={{
            bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
            '&:before': { display: 'none' },
            mb: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <Badge badgeContent={analysis.consistencyIssues.length} color="info">
                <TimelineIcon color="primary" />
              </Badge>
              <Typography variant="subtitle2">Kontinuitetsproblemer</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {analysis.consistencyIssues.length === 0 ? (
              <Alert severity="success" sx={{ m: 2 }}>
                Ingen kontinuitetsproblemer funnet!
              </Alert>
            ) : (
              <List dense>
                {analysis.consistencyIssues.map((issue, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      borderLeft: `3px solid ${getSeverityColor(issue.severity)}`,
                      mb: 0.5,
                    }}
                    secondaryAction={
                      <Tooltip title="Gå til linje">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => onGotoLine?.(issue.lineNumber)}
                        >
                          <GotoIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getSeverityIcon(issue.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Chip
                            label={issue.type}
                            size="small"
                            color="default"
                            sx={{ fontSize: '0.65rem', height: 18, textTransform: 'uppercase' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Linje {issue.lineNumber}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                            {issue.description}
                          </Typography>
                          {issue.suggestion && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 0.5,
                                color: 'primary.main',
                              }}
                            >
                              <FixIcon sx={{ fontSize: 14 }} />
                              {issue.suggestion}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Scene Completeness Check */}
        <Accordion
          expanded={expanded === 'scenes'}
          onChange={handleAccordionChange('scenes')}
          sx={{
            bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
            '&:before': { display: 'none' },
            mb: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <SceneIcon color="primary" />
              <Typography variant="subtitle2">Scene-fullstendighet</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {analysis.beatCards.length === 0 ? (
              <Alert severity="info">
                Ingen scener funnet i manuset
              </Alert>
            ) : (
              <Stack spacing={1}>
                {analysis.beatCards.map((beat, idx) => {
                  const isComplete = beat.characters.length > 0 && beat.beat.length > 20;
                  const hasDialogue = beat.characters.length > 0;
                  
                  return (
                    <Paper
                      key={idx}
                      sx={{
                        p: 1.5,
                        bgcolor: isComplete ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                        borderLeft: `3px solid ${isComplete ? '#22c55e' : '#f59e0b'}`,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                      }}
                      onClick={() => onGotoLine?.(beat.lineNumber)}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2" sx={{ minWidth: 60 }}>
                          Scene {beat.sceneNumber}
                        </Typography>
                        {isComplete ? (
                          <Chip
                            icon={<CheckIcon />}
                            label="Komplett"
                            size="small"
                            color="success"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        ) : (
                          <Chip
                            icon={<WarningIcon />}
                            label={hasDialogue ? 'Kort' : 'Mangler dialog'}
                            size="small"
                            color="warning"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        )}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {beat.heading}
                        </Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};

export default ScriptAnalysisPanel;
