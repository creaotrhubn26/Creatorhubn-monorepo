import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Tooltip,
  IconButton,
  Slider,
  Alert,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Check as CheckIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import type { SceneBreakdown } from '../models/casting';

interface ConflictWarning {
  type: 'lighting' | 'location' | 'time' | 'resource';
  severity: 'error' | 'warning' | 'info';
  message: string;
  sceneNumbers: string[];
}

interface TimelineViewProps {
  scenes: SceneBreakdown[];
  onSceneSelect: (scene: SceneBreakdown) => void;
  selectedScene?: SceneBreakdown;
  onConflictsDetected?: (conflicts: ConflictWarning[]) => void;
  onRuntimeCalculated?: (runtime: number) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ 
  scenes, 
  onSceneSelect, 
  selectedScene,
  onConflictsDetected,
  onRuntimeCalculated,
}) => {
  const [zoom, setZoom] = useState(1);
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate total runtime
  const totalRuntime = scenes.reduce((sum, scene) => {
    return sum + (scene.estimatedDuration || 0);
  }, 0);

  // Detect conflicts
  useEffect(() => {
    const detected: ConflictWarning[] = [];

    // Check for location overuse
    const locationCounts = new Map<string, string[]>();
    scenes.forEach(scene => {
      if (scene.locationName) {
        const existing = locationCounts.get(scene.locationName) || [];
        locationCounts.set(scene.locationName, [...existing, scene.sceneNumber]);
      }
    });

    locationCounts.forEach((sceneNums, location) => {
      if (sceneNums.length > 5) {
        detected.push({
          type: 'location',
          severity: 'warning',
          message: `Lokasjon "${location}" brukt i ${sceneNums.length} scener`,
          sceneNumbers: sceneNums,
        });
      }
    });

    // Check for lighting consistency issues
    const intSettings = scenes.filter(s => s.intExt === 'INT');
    const extSettings = scenes.filter(s => s.intExt === 'EXT');
    
    if (intSettings.length === 0 && extSettings.length > 10) {
      detected.push({
        type: 'lighting',
        severity: 'warning',
        message: 'Ingen innendørs scener - vær oppmerksom på væravhengighet',
        sceneNumbers: [],
      });
    }

    // Check for time overruns
    if (totalRuntime > 120) {
      detected.push({
        type: 'time',
        severity: 'error',
        message: `Estimert spilletid: ${Math.round(totalRuntime)} min (over 2 timer)`,
        sceneNumbers: [],
      });
    }

    setConflicts(detected);
    
    // Notify parent of conflicts and runtime
    onConflictsDetected?.(detected);
    onRuntimeCalculated?.(totalRuntime);
  }, [scenes, totalRuntime, onConflictsDetected, onRuntimeCalculated]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with stats */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={3}>
            <Box>
              <Typography variant="caption" color="text.secondary">Totalt Scener</Typography>
              <Typography variant="h5">{scenes.length}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Estimert Spilletid</Typography>
              <Typography variant="h5">{Math.round(totalRuntime)} min</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Advarsler</Typography>
              <Typography variant="h5" color={conflicts.length > 0 ? 'error.main' : 'success.main'}>
                {conflicts.length}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
              <ZoomOutIcon />
            </IconButton>
            <Typography variant="caption">{Math.round(zoom * 100)}%</Typography>
            <IconButton size="small" onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
              <ZoomInIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {conflicts.map((conflict, i) => (
            <Alert key={i} severity={conflict.severity}>
              <Typography variant="body2">
                <strong>{conflict.type.toUpperCase()}:</strong> {conflict.message}
              </Typography>
            </Alert>
          ))}
        </Stack>
      )}

      {/* Timeline */}
      <Paper
        ref={timelineRef}
        sx={{
          flex: 1,
          p: 2,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Stack spacing={1}>
          {scenes.map((scene, index) => (
            <TimelineSceneBlock
              key={scene.id || index}
              scene={scene}
              zoom={zoom}
              isSelected={selectedScene?.id === scene.id}
              onClick={() => onSceneSelect(scene)}
            />
          ))}
        </Stack>

        {/* Timeline ruler */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            borderTop: 1,
            borderColor: 'divider',
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
          }}
        >
          {Array.from({ length: Math.ceil(totalRuntime / 10) }).map((_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                borderLeft: i > 0 ? 1 : 0,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {i * 10}min
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

interface TimelineSceneBlockProps {
  scene: SceneBreakdown;
  zoom: number;
  isSelected: boolean;
  onClick: () => void;
}

const TimelineSceneBlock: React.FC<TimelineSceneBlockProps> = ({ scene, zoom, isSelected, onClick }) => {
  const duration = scene.estimatedDuration || 0;
  const hasIssues = !scene.locationName || !scene.timeOfDay;
  
  // Calculate width based on duration (1 min = 20px base)
  const width = duration * 20 * zoom;

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption">
            <strong>Scene {scene.sceneNumber}</strong>
          </Typography>
          <Typography variant="caption" display="block">
            {scene.locationName} - {scene.intExt} - {scene.timeOfDay}
          </Typography>
          <Typography variant="caption" display="block">
            Varighet: {duration} min
          </Typography>
          {scene.characters && scene.characters.length > 0 && (
            <Typography variant="caption" display="block">
              Karakterer: {scene.characters.join(', ')}
            </Typography>
          )}
        </Box>
      }
      arrow
    >
      <Card
        onClick={onClick}
        sx={{
          minWidth: Math.max(width, 100),
          width: width,
          cursor: 'pointer',
          border: 2,
          borderColor: isSelected ? 'primary.main' : hasIssues ? 'error.main' : 'transparent',
          bgcolor: isSelected
            ? 'primary.light'
            : scene.intExt === 'INT'
            ? 'info.light'
            : 'warning.light',
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: 3,
          },
        }}
      >
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" noWrap>
              {scene.sceneNumber}
            </Typography>
            {hasIssues && <WarningIcon fontSize="small" color="error" />}
          </Stack>
          
          <Typography variant="caption" display="block" noWrap>
            {scene.locationName || 'Ingen lokasjon'}
          </Typography>

          <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap">
            <Chip
              label={scene.intExt}
              size="small"
              sx={{ fontSize: '0.65rem', height: 16 }}
            />
            <Chip
              label={scene.timeOfDay}
              size="small"
              sx={{ fontSize: '0.65rem', height: 16 }}
            />
            {scene.characters && scene.characters.length > 0 && (
              <Chip
                label={`${scene.characters.length} chars`}
                size="small"
                sx={{ fontSize: '0.65rem', height: 16 }}
              />
            )}
          </Stack>

          {/* Mini shot indicators */}
          {scene.description && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.25 }}>
              {Array.from({ length: Math.min(5, Math.ceil(duration / 2)) }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 8,
                    height: 8,
                    bgcolor: 'primary.main',
                    borderRadius: 0.5,
                    opacity: 0.5,
                  }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Tooltip>
  );
};

export default TimelineView;
