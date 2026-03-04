import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  ViewColumn as ViewColumnIcon,
  ViewDay as ViewDayIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import type { ScriptRevision } from '../models/casting';

interface ScriptDiffViewerProps {
  revisions: ScriptRevision[];
  currentContent: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
  otherLineNumber?: number;
}

export const ScriptDiffViewer: React.FC<ScriptDiffViewerProps> = ({
  revisions,
  currentContent,
}) => {
  const [selectedRevision, setSelectedRevision] = useState<string>('');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  const sortedRevisions = useMemo(() => {
    return [...revisions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [revisions]);

  const currentRevision = useMemo(() => {
    return sortedRevisions.find(r => r.id === selectedRevision);
  }, [selectedRevision, sortedRevisions]);

  const diff = useMemo(() => {
    if (!currentRevision) return null;

    const oldLines = currentRevision.content.split('\n');
    const newLines = currentContent.split('\n');

    return computeDiff(oldLines, newLines);
  }, [currentRevision, currentContent]);

  const stats = useMemo(() => {
    if (!diff) return { added: 0, removed: 0, unchanged: 0 };

    return {
      added: diff.filter(d => d.type === 'added').length,
      removed: diff.filter(d => d.type === 'removed').length,
      unchanged: diff.filter(d => d.type === 'unchanged').length,
    };
  }, [diff]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Controls */}
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 300 }}>
            <InputLabel>Sammenlign med revisjon</InputLabel>
            <Select
              value={selectedRevision}
              onChange={e => setSelectedRevision(e.target.value)}
              label="Sammenlign med revisjon"
            >
              {sortedRevisions.map(revision => (
                <MenuItem key={revision.id} value={revision.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={revision.version}
                      size="small"
                      sx={{
                        bgcolor: revision.colorCode || '#999',
                        color: 'white',
                        minWidth: 60,
                      }}
                    />
                    <Typography variant="body2">
                      {new Date(revision.createdAt).toLocaleDateString('nb-NO')}
                    </Typography>
                    {revision.changesSummary && (
                      <Typography variant="caption" color="text.secondary">
                        - {revision.changesSummary}
                      </Typography>
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedRevision && (
            <Stack direction="row" spacing={1}>
              <Chip label={`+${stats.added} linjer`} color="success" size="small" />
              <Chip label={`-${stats.removed} linjer`} color="error" size="small" />
              <Chip label={`${stats.unchanged} uendret`} size="small" />
            </Stack>
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="side-by-side">
              <Tooltip title="Side ved side">
                <ViewColumnIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="unified">
              <Tooltip title="Samlet visning">
                <ViewDayIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Diff Display */}
      {!selectedRevision ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Velg en revisjon for å sammenligne endringer
          </Typography>
        </Box>
      ) : diff ? (
        <Paper
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
          }}
        >
          {viewMode === 'side-by-side' ? (
            <SideBySideDiff diff={diff} />
          ) : (
            <UnifiedDiff diff={diff} />
          )}
        </Paper>
      ) : null}
    </Box>
  );
};

// Simple line-based diff algorithm
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      // Only new lines left
      result.push({
        type: 'added',
        lineNumber: newIndex + 1,
        content: newLines[newIndex],
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Only old lines left
      result.push({
        type: 'removed',
        lineNumber: oldIndex + 1,
        content: oldLines[oldIndex],
      });
      oldIndex++;
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      // Lines match
      result.push({
        type: 'unchanged',
        lineNumber: oldIndex + 1,
        otherLineNumber: newIndex + 1,
        content: oldLines[oldIndex],
      });
      oldIndex++;
      newIndex++;
    } else {
      // Lines differ - look ahead to find match
      const oldMatchIndex = findMatch(oldLines, oldIndex + 1, newLines[newIndex]);
      const newMatchIndex = findMatch(newLines, newIndex + 1, oldLines[oldIndex]);

      if (oldMatchIndex >= 0 && (newMatchIndex < 0 || oldMatchIndex < newMatchIndex)) {
        // Old line was removed
        result.push({
          type: 'removed',
          lineNumber: oldIndex + 1,
          content: oldLines[oldIndex],
        });
        oldIndex++;
      } else if (newMatchIndex >= 0) {
        // New line was added
        result.push({
          type: 'added',
          lineNumber: newIndex + 1,
          content: newLines[newIndex],
        });
        newIndex++;
      } else {
        // Both lines changed - treat as removed + added
        result.push({
          type: 'removed',
          lineNumber: oldIndex + 1,
          content: oldLines[oldIndex],
        });
        result.push({
          type: 'added',
          lineNumber: newIndex + 1,
          content: newLines[newIndex],
        });
        oldIndex++;
        newIndex++;
      }
    }
  }

  return result;
}

function findMatch(lines: string[], startIndex: number, target: string, maxLookahead = 5): number {
  for (let i = startIndex; i < Math.min(startIndex + maxLookahead, lines.length); i++) {
    if (lines[i] === target) {
      return i;
    }
  }
  return -1;
}

const SideBySideDiff: React.FC<{ diff: DiffLine[] }> = ({ diff }) => {
  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Old version (left) */}
      <Box sx={{ flex: 1, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
        <Box sx={{ p: 1, bgcolor: '#2d2d2d', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" fontWeight="bold">
            Original Revisjon
          </Typography>
        </Box>
        {diff.map((line, index) =>
          line.type !== 'added' ? (
            <Box
              key={index}
              sx={{
                display: 'flex',
                bgcolor: line.type === 'removed' ? '#4b1818' : 'transparent',
                borderLeft: line.type === 'removed' ? '3px solid #f85149' : 'none',
                '&:hover': { bgcolor: line.type === 'removed' ? '#5a1f1f' : '#2d2d2d' },
              }}
            >
              <Box
                sx={{
                  minWidth: 50,
                  px: 1,
                  py: 0.5,
                  color: '#858585',
                  textAlign: 'right',
                  userSelect: 'none',
                }}
              >
                {line.lineNumber}
              </Box>
              <Box sx={{ flex: 1, px: 1, py: 0.5, whiteSpace: 'pre-wrap' }}>
                {line.content || ' '}
              </Box>
            </Box>
          ) : (
            <Box key={index} sx={{ height: '1.5em', bgcolor: '#f0f0f005' }} />
          )
        )}
      </Box>

      {/* New version (right) */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ p: 1, bgcolor: '#2d2d2d', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" fontWeight="bold">
            Nåværende Versjon
          </Typography>
        </Box>
        {diff.map((line, index) =>
          line.type !== 'removed' ? (
            <Box
              key={index}
              sx={{
                display: 'flex',
                bgcolor: line.type === 'added' ? '#1b3d1b' : 'transparent',
                borderLeft: line.type === 'added' ? '3px solid #3fb950' : 'none',
                '&:hover': { bgcolor: line.type === 'added' ? '#234d23' : '#2d2d2d' },
              }}
            >
              <Box
                sx={{
                  minWidth: 50,
                  px: 1,
                  py: 0.5,
                  color: '#858585',
                  textAlign: 'right',
                  userSelect: 'none',
                }}
              >
                {line.otherLineNumber || line.lineNumber}
              </Box>
              <Box sx={{ flex: 1, px: 1, py: 0.5, whiteSpace: 'pre-wrap' }}>
                {line.content || ' '}
              </Box>
            </Box>
          ) : (
            <Box key={index} sx={{ height: '1.5em', bgcolor: '#f0f0f005' }} />
          )
        )}
      </Box>
    </Box>
  );
};

const UnifiedDiff: React.FC<{ diff: DiffLine[] }> = ({ diff }) => {
  return (
    <Box sx={{ p: 1 }}>
      {diff.map((line, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            bgcolor:
              line.type === 'added'
                ? '#1b3d1b'
                : line.type === 'removed'
                ? '#4b1818'
                : 'transparent',
            borderLeft:
              line.type === 'added'
                ? '3px solid #3fb950'
                : line.type === 'removed'
                ? '3px solid #f85149'
                : 'none',
            '&:hover': {
              bgcolor:
                line.type === 'added'
                  ? '#234d23'
                  : line.type === 'removed'
                  ? '#5a1f1f'
                  : '#2d2d2d',
            },
          }}
        >
          <Box
            sx={{
              minWidth: 50,
              px: 1,
              py: 0.5,
              color: '#858585',
              textAlign: 'right',
              userSelect: 'none',
            }}
          >
            {line.lineNumber}
          </Box>
          <Box
            sx={{
              minWidth: 20,
              px: 1,
              py: 0.5,
              color: line.type === 'added' ? '#3fb950' : line.type === 'removed' ? '#f85149' : '#858585',
              fontWeight: 'bold',
              userSelect: 'none',
            }}
          >
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
          </Box>
          <Box sx={{ flex: 1, px: 1, py: 0.5, whiteSpace: 'pre-wrap' }}>
            {line.content || ' '}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
