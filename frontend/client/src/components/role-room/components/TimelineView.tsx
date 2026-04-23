import { useEffect, useMemo, useState, type FC } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  InfoOutlined as InfoOutlinedIcon,
  WarningAmber as WarningAmberIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
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

type DurationUnit = 'minutes' | 'seconds';

type RuntimeScene = {
  scene: SceneBreakdown;
  sceneNumber: string;
  heading: string;
  locationName: string;
  intExt: string;
  timeOfDay: string;
  durationMinutes: number;
  startMinutes: number;
  endMinutes: number;
  charactersCount: number;
  hasIssues: boolean;
};

const formatMinutes = (value: number): string => {
  const rounded = Number.isFinite(value) ? Math.max(value, 0) : 0;
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const mins = Math.round(rounded % 60);
    return `${hours} t ${mins} min`;
  }
  return `${Math.round(rounded)} min`;
};

const detectDurationUnit = (durations: number[]): DurationUnit => {
  if (durations.length === 0) return 'minutes';

  const longValues = durations.filter((value) => value >= 60).length;
  const veryLongValue = durations.some((value) => value > 300);

  // Heuristikk: de fleste datasett med 60/120/180 representerer sekunder.
  if (veryLongValue || longValues >= Math.ceil(durations.length * 0.6)) {
    return 'seconds';
  }

  return 'minutes';
};

const normalizeIntExt = (scene: SceneBreakdown): string => {
  const raw = String(scene.intExt ?? '').toUpperCase();
  if (raw.includes('INT') && raw.includes('EXT')) return 'INT/EXT';
  if (raw.startsWith('INT')) return 'INT';
  if (raw.startsWith('EXT')) return 'EXT';
  return raw || 'UKJENT';
};

const normalizeTimeOfDay = (scene: SceneBreakdown): string => {
  const raw = String(scene.timeOfDay ?? '').toUpperCase();
  return raw || 'UKJENT';
};

const getBarBackground = (scene: RuntimeScene, selected: boolean): string => {
  if (selected) {
    return 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
  }

  if (scene.hasIssues) {
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  }

  if (scene.intExt === 'EXT') {
    return scene.timeOfDay === 'NIGHT'
      ? 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)'
      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  }

  return scene.timeOfDay === 'NIGHT'
    ? 'linear-gradient(135deg, #334155 0%, #1e293b 100%)'
    : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
};

const conflictIconBySeverity = {
  error: <ErrorOutlineIcon sx={{ fontSize: 16 }} />,
  warning: <WarningAmberIcon sx={{ fontSize: 16 }} />,
  info: <InfoOutlinedIcon sx={{ fontSize: 16 }} />,
};

export const TimelineView: FC<TimelineViewProps> = ({
  scenes,
  onSceneSelect,
  selectedScene,
  onConflictsDetected,
  onRuntimeCalculated,
}) => {
  const [zoom, setZoom] = useState(1);

  const timelineData = useMemo(() => {
    const rawDurations = scenes
      .map((scene) => Number(scene.estimatedDuration ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    const durationUnit = detectDurationUnit(rawDurations);

    let cursor = 0;

    const rows: RuntimeScene[] = scenes.map((scene, index) => {
      const rawDuration = Number(scene.estimatedDuration ?? 0);
      const fallbackMinutes = Number(scene.pageLength ?? 0) > 0
        ? Math.max(1, Number(scene.pageLength) * 1.25)
        : 2;

      const durationSource = Number.isFinite(rawDuration) && rawDuration > 0
        ? rawDuration
        : fallbackMinutes;

      const normalizedMinutes = durationUnit === 'seconds'
        ? durationSource / 60
        : durationSource;

      const durationMinutes = Math.max(0.5, Number(normalizedMinutes.toFixed(2)));

      const startMinutes = Number(cursor.toFixed(2));
      const endMinutes = Number((cursor + durationMinutes).toFixed(2));
      cursor += durationMinutes;

      const sceneNumber = String(scene.sceneNumber ?? index + 1);
      const heading = String(scene.sceneHeading ?? scene.heading ?? `Scene ${sceneNumber}`);
      const locationName = String(scene.locationName ?? 'Mangler lokasjon');
      const intExt = normalizeIntExt(scene);
      const timeOfDay = normalizeTimeOfDay(scene);
      const charactersCount = Array.isArray(scene.characters) ? scene.characters.length : 0;
      const hasIssues = !scene.locationName || !scene.timeOfDay || !scene.sceneHeading;

      return {
        scene,
        sceneNumber,
        heading,
        locationName,
        intExt,
        timeOfDay,
        durationMinutes,
        startMinutes,
        endMinutes,
        charactersCount,
        hasIssues,
      };
    });

    const totalMinutes = rows.reduce((sum, row) => sum + row.durationMinutes, 0);

    return {
      rows,
      totalMinutes: Math.max(1, Number(totalMinutes.toFixed(2))),
      durationUnit,
    };
  }, [scenes]);

  const conflicts = useMemo<ConflictWarning[]>(() => {
    const detected: ConflictWarning[] = [];

    if (timelineData.totalMinutes > 120) {
      detected.push({
        type: 'time',
        severity: 'warning',
        message: `Estimert spilletid er ${formatMinutes(timelineData.totalMinutes)}. Vurder å stramme inn tempoet.`,
        sceneNumbers: [],
      });
    }

    const missingMeta = timelineData.rows
      .filter((row) => row.hasIssues)
      .map((row) => row.sceneNumber);

    if (missingMeta.length > 0) {
      detected.push({
        type: 'resource',
        severity: 'error',
        message: `Manglende data i ${missingMeta.length} scener (heading/lokasjon/tid).`,
        sceneNumbers: missingMeta,
      });
    }

    const locationMap = new Map<string, string[]>();
    timelineData.rows.forEach((row) => {
      const key = row.locationName.trim();
      if (!key) return;
      const existing = locationMap.get(key) ?? [];
      locationMap.set(key, [...existing, row.sceneNumber]);
    });

    locationMap.forEach((sceneNumbers, location) => {
      if (sceneNumbers.length >= 4) {
        detected.push({
          type: 'location',
          severity: 'info',
          message: `Lokasjon "${location}" brukes i ${sceneNumbers.length} scener.`,
          sceneNumbers,
        });
      }
    });

    const nightExtRows = timelineData.rows.filter(
      (row) => row.intExt === 'EXT' && row.timeOfDay === 'NIGHT'
    );

    if (nightExtRows.length >= 3) {
      detected.push({
        type: 'lighting',
        severity: 'warning',
        message: `Mange natt-eksteriør scener (${nightExtRows.length}). Sikre lysplan og backup-værplan.`,
        sceneNumbers: nightExtRows.map((row) => row.sceneNumber),
      });
    }

    return detected;
  }, [timelineData]);

  useEffect(() => {
    onConflictsDetected?.(conflicts);
    onRuntimeCalculated?.(timelineData.totalMinutes);
  }, [conflicts, onConflictsDetected, onRuntimeCalculated, timelineData.totalMinutes]);

  const totalScenes = timelineData.rows.length;
  const averageDuration = totalScenes > 0 ? timelineData.totalMinutes / totalScenes : 0;
  const missingDataCount = timelineData.rows.filter((row) => row.hasIssues).length;

  const selectedRuntimeScene = useMemo(
    () => timelineData.rows.find((row) => row.scene.id === selectedScene?.id),
    [selectedScene?.id, timelineData.rows]
  );

  const pxPerMinute = 22 * zoom;
  const timelineWidth = Math.max(860, timelineData.totalMinutes * pxPerMinute);

  const majorTickMinutes = timelineData.totalMinutes <= 45
    ? 5
    : timelineData.totalMinutes <= 150
      ? 10
      : timelineData.totalMinutes <= 300
        ? 20
        : 30;

  const tickMarks = useMemo(() => {
    const marks: number[] = [];
    const roundedTotal = Math.ceil(timelineData.totalMinutes);

    for (let minute = 0; minute <= roundedTotal; minute += majorTickMinutes) {
      marks.push(minute);
    }

    if (marks[marks.length - 1] !== roundedTotal) {
      marks.push(roundedTotal);
    }

    return marks;
  }, [majorTickMinutes, timelineData.totalMinutes]);

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper
        sx={{
          p: 2,
          border: '1px solid rgba(148, 163, 184, 0.18)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(17,24,39,0.98))',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Tidslinje for scener
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Oversikt over rekkefølge, estimert varighet og produksjonsrisiko.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 240 }}>
            <IconButton size="small" onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.1))} aria-label="Zoom ut">
              <ZoomOutIcon fontSize="small" />
            </IconButton>
            <Slider
              value={zoom}
              min={0.6}
              max={2.4}
              step={0.1}
              onChange={(_, value) => setZoom(value as number)}
              sx={{ minWidth: 120 }}
              size="small"
            />
            <IconButton size="small" onClick={() => setZoom((prev) => Math.min(2.4, prev + 0.1))} aria-label="Zoom inn">
              <ZoomInIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" sx={{ minWidth: 42, textAlign: 'right', fontWeight: 600 }}>
              {Math.round(zoom * 100)}%
            </Typography>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.6)' }}>
            <Typography variant="caption" color="text.secondary">Scener</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{totalScenes}</Typography>
          </Paper>
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.6)' }}>
            <Typography variant="caption" color="text.secondary">Estimert total</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatMinutes(timelineData.totalMinutes)}</Typography>
          </Paper>
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.6)' }}>
            <Typography variant="caption" color="text.secondary">Snitt per scene</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatMinutes(averageDuration)}</Typography>
          </Paper>
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.6)' }}>
            <Typography variant="caption" color="text.secondary">Datamangler</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: missingDataCount > 0 ? 'warning.main' : 'success.main' }}>
              {missingDataCount}
            </Typography>
          </Paper>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          minHeight: 0,
          flex: 1,
          gridTemplateColumns: {
            xs: '1fr',
            xl: '320px minmax(0, 1fr)',
          },
        }}
      >
        <Paper
          sx={{
            p: 2,
            minHeight: 280,
            border: '1px solid rgba(148, 163, 184, 0.16)',
            overflow: 'auto',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Innsikt og varsler
          </Typography>

          <Stack spacing={1} sx={{ mb: 2 }}>
            {conflicts.length === 0 && (
              <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                Ingen kritiske konflikter oppdaget i tidslinjen.
              </Alert>
            )}

            {conflicts.map((conflict, index) => (
              <Alert
                key={`${conflict.type}-${index}`}
                severity={conflict.severity}
                icon={conflictIconBySeverity[conflict.severity]}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {conflict.message}
                </Typography>
                {conflict.sceneNumbers.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Scener: {conflict.sceneNumbers.join(', ')}
                  </Typography>
                )}
              </Alert>
            ))}
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Fargekode
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip size="small" label="INT dag" sx={{ bgcolor: '#06b6d4', color: '#fff' }} />
            <Chip size="small" label="INT natt" sx={{ bgcolor: '#334155', color: '#fff' }} />
            <Chip size="small" label="EXT dag" sx={{ bgcolor: '#f59e0b', color: '#111827' }} />
            <Chip size="small" label="EXT natt" sx={{ bgcolor: '#1d4ed8', color: '#fff' }} />
            <Chip size="small" label="Mangler data" sx={{ bgcolor: '#ef4444', color: '#fff' }} />
          </Stack>

          {selectedRuntimeScene && (
            <Paper sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.6)' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Valgt scene {selectedRuntimeScene.sceneNumber}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }} noWrap>
                {selectedRuntimeScene.heading}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {selectedRuntimeScene.locationName}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {selectedRuntimeScene.intExt} • {selectedRuntimeScene.timeOfDay}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Varighet: {formatMinutes(selectedRuntimeScene.durationMinutes)}
              </Typography>
            </Paper>
          )}
        </Paper>

        <Paper
          sx={{
            minHeight: 280,
            border: '1px solid rgba(148, 163, 184, 0.16)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {timelineData.rows.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">Ingen scener tilgjengelig ennå. Legg til scener for å se tidslinjen.</Alert>
            </Box>
          ) : (
            <Box sx={{ p: 2, minHeight: 0, flex: 1, overflow: 'auto' }}>
              <Box sx={{ minWidth: `${timelineWidth + 260}px`, width: '100%' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '260px minmax(0, 1fr)',
                    alignItems: 'end',
                    pb: 1,
                    mb: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    top: 0,
                    zIndex: 4,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, px: 1 }}>
                    SCENER
                  </Typography>
                  <Box sx={{ position: 'relative', height: 28 }}>
                    {tickMarks.map((tick) => {
                      const left = `${(tick / timelineData.totalMinutes) * 100}%`;
                      return (
                        <Box
                          key={tick}
                          sx={{
                            position: 'absolute',
                            left,
                            transform: 'translateX(-50%)',
                          }}
                        >
                          <Box sx={{ width: 1, height: 8, bgcolor: 'divider', mx: 'auto' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {tick}m
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                <Stack spacing={1.25}>
                  {timelineData.rows.map((row) => {
                    const isSelected = selectedScene?.id === row.scene.id;
                    const startPx = row.startMinutes * pxPerMinute;
                    const widthPx = Math.max(42, row.durationMinutes * pxPerMinute);

                    return (
                      <Box
                        key={row.scene.id || `${row.sceneNumber}-${row.startMinutes}`}
                        sx={{
                          display: 'grid',
                          gap: 1,
                          gridTemplateColumns: '260px minmax(0, 1fr)',
                          alignItems: 'center',
                        }}
                      >
                        <Box
                          onClick={() => onSceneSelect(row.scene)}
                          sx={{
                            px: 1,
                            py: 1,
                            borderRadius: 1.5,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: isSelected ? 'action.selected' : 'background.default',
                            transition: 'all 0.16s ease',
                            '&:hover': {
                              borderColor: 'primary.main',
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Scene {row.sceneNumber}
                          </Typography>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                            {row.heading}
                          </Typography>
                          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                            <Chip size="small" label={row.intExt} sx={{ height: 18 }} />
                            <Chip size="small" label={row.timeOfDay} sx={{ height: 18 }} />
                            {row.charactersCount > 0 && (
                              <Chip size="small" label={`${row.charactersCount} roller`} sx={{ height: 18 }} />
                            )}
                          </Stack>
                        </Box>

                        <Box
                          onClick={() => onSceneSelect(row.scene)}
                          sx={{
                            position: 'relative',
                            height: 60,
                            cursor: 'pointer',
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: 'background.default',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0.32,
                              backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent ${Math.max(majorTickMinutes * pxPerMinute - 1, 1)}px, rgba(148,163,184,0.35) ${Math.max(majorTickMinutes * pxPerMinute - 1, 1)}px, rgba(148,163,184,0.35) ${majorTickMinutes * pxPerMinute}px)`,
                            }}
                          />

                          <Tooltip
                            title={`${row.heading} • ${row.locationName} • ${formatMinutes(row.durationMinutes)}`}
                            arrow
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${startPx}px`,
                                width: `${widthPx}px`,
                                top: 8,
                                bottom: 8,
                                px: 1,
                                borderRadius: 1.25,
                                border: '1px solid rgba(255,255,255,0.24)',
                                color: '#f8fafc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                background: getBarBackground(row, isSelected),
                                boxShadow: isSelected
                                  ? '0 8px 24px rgba(14, 165, 233, 0.34)'
                                  : '0 4px 14px rgba(15, 23, 42, 0.22)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.32)',
                                },
                              }}
                            >
                              <Typography variant="caption" noWrap sx={{ fontWeight: 700 }}>
                                {row.locationName}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, flexShrink: 0 }}>
                                {Math.round(row.durationMinutes * 10) / 10}m
                              </Typography>
                            </Box>
                          </Tooltip>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Varighetsmodus: {timelineData.durationUnit === 'seconds' ? 'sekunder konvertert til minutter' : 'minutter'}.
      </Typography>
    </Box>
  );
};

export default TimelineView;
