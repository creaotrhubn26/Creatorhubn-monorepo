/**
 * CreatorHub Norge - Calendar Conflict Checker
 * Sjekker kalenderkonflikter for prosjekt-utkast mot kalenderdata.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import {
  Add,
  CheckCircle,
  DateRange,
  Event,
  Info,
  Link,
  PlayArrow,
} from '@mui/icons-material';

interface DraftData {
  projectName?: string;
  clientName?: string;
  projectDate?: string;
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number;
  location?: string;
}

interface CalendarEventTime {
  dateTime?: string;
  date?: string;
}

interface CalendarConflictEvent {
  summary?: string;
  location?: string;
  start?: CalendarEventTime;
  end?: CalendarEventTime;
}

interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: CalendarConflictEvent[];
  message: string;
}

interface CalendarConflictCheckerProps {
  draftData: DraftData;
  open: boolean;
  onClose: () => void;
  onConfirm: (option: 'new_project' | 'link_existing' | 'continue_anyway') => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const toEventTime = (value: unknown): CalendarEventTime | undefined => {
  if (!isObject(value)) return undefined;
  const dateTime = toString(value.dateTime);
  const date = toString(value.date);
  if (!dateTime && !date) return undefined;
  return { dateTime: dateTime || undefined, date: date || undefined };
};

const toConflictEvent = (value: unknown): CalendarConflictEvent | null => {
  if (!isObject(value)) return null;

  return {
    summary: toString(value.summary) || undefined,
    location: toString(value.location) || undefined,
    start: toEventTime(value.start),
    end: toEventTime(value.end),
  };
};

const normalizeConflictResult = (value: unknown): ConflictCheckResult => {
  if (!isObject(value)) {
    return {
      hasConflicts: false,
      conflicts: [],
      message: 'Kunne ikke lese svar fra konflikt-sjekk.',
    };
  }

  const rawConflicts = Array.isArray(value.conflicts) ? value.conflicts : [];
  const conflicts = rawConflicts
    .map(toConflictEvent)
    .filter((event): event is CalendarConflictEvent => event !== null);

  return {
    hasConflicts: Boolean(value.hasConflicts),
    conflicts,
    message: toString(value.message, conflicts.length > 0 ? 'Konflikter funnet.' : 'Ingen konflikter funnet.'),
  };
};

const resolveTimeWindow = (draftData: DraftData): { startTime: string; endTime: string } | null => {
  if (draftData.startTime && draftData.endTime) {
    return {
      startTime: draftData.startTime,
      endTime: draftData.endTime,
    };
  }

  if (!draftData.projectDate) {
    return null;
  }

  const start = new Date(draftData.projectDate);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  start.setHours(9, 0, 0, 0);
  const durationHours = draftData.estimatedDuration && draftData.estimatedDuration > 0
    ? draftData.estimatedDuration
    : 2;
  const end = new Date(start);
  end.setHours(start.getHours() + durationHours);

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
};

export default function CalendarConflictChecker({
  draftData,
  open,
  onClose,
  onConfirm,
  profession = 'photographer',
}: CalendarConflictCheckerProps) {
  const theming = useTheming(profession);
  const [conflictCheck, setConflictCheck] = useState<ConflictCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedOption, setSelectedOption] =
    useState<'new_project' | 'link_existing' | 'continue_anyway'>('continue_anyway');

  const checkConflicts = async () => {
    try {
      setIsChecking(true);

      const timeWindow = resolveTimeWindow(draftData);
      if (!timeWindow) {
        setConflictCheck({
          hasConflicts: false,
          conflicts: [],
          message: 'Mangler dato/tid for å kjøre konflikt-sjekk.',
        });
        return;
      }

      const result = await apiRequest('/api/calendar/check-conflicts', {
        method: 'POST',
        body: {
          startTime: timeWindow.startTime,
          endTime: timeWindow.endTime,
          projectName: draftData.projectName,
          clientName: draftData.clientName,
          location: draftData.location,
        },
      });

      setConflictCheck(normalizeConflictResult(result));
    } catch (error) {
      console.error('Error checking calendar conflicts:', error);
      setConflictCheck({
        hasConflicts: false,
        conflicts: [],
        message: 'Kunne ikke sjekke kalenderkonflikter.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void checkConflicts();
  }, [open, draftData]);

  const formatDate = (value: string): string =>
    new Date(value).toLocaleDateString('nb-NO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatTime = (value: string): string =>
    new Date(value).toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const confirmLabel = useMemo(() => {
    if (!conflictCheck?.hasConflicts) return 'Bekreft og fortsett';

    if (selectedOption === 'new_project') return 'Opprett nytt prosjekt';
    if (selectedOption === 'link_existing') return 'Knytt til eksisterende';
    return 'Fortsett som planlagt';
  }, [conflictCheck, selectedOption]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {theming.getThemedIcon('calendar')}
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Kalender Konfliktsjekk
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isChecking ? (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={4}>
            <CircularProgress />
            <Typography>Sjekker kalenderkonflikter...</Typography>
          </Box>
        ) : conflictCheck ? (
          <Box>
            {conflictCheck.hasConflicts ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Eksisterende avtaler funnet</AlertTitle>
                {conflictCheck.message}
              </Alert>
            ) : (
              <Alert severity="success" sx={{ mb: 2 }}>
                <AlertTitle>Ingen konflikter</AlertTitle>
                {conflictCheck.message}
              </Alert>
            )}

            {conflictCheck.conflicts.length > 0 && (
              <Paper elevation={1} sx={{ p: 2, mt: 2, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Eksisterende avtaler
                </Typography>
                <List>
                  {conflictCheck.conflicts.map((conflict, index) => {
                    const startValue = conflict.start?.dateTime ?? conflict.start?.date ?? '';
                    const endValue = conflict.end?.dateTime ?? conflict.end?.date ?? '';

                    return (
                      <ListItem key={`${conflict.summary ?? 'conflict'}-${index}`} divider>
                        <ListItemIcon>
                          <Event color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={conflict.summary ?? 'Ukjent avtale'}
                          secondary={
                            <Box>
                              {startValue && (
                                <Typography variant="body2" color="text.secondary">
                                  {formatDate(startValue)}
                                </Typography>
                              )}
                              {conflict.start?.dateTime && conflict.end?.dateTime && (
                                <Typography variant="body2" color="text.secondary">
                                  {formatTime(conflict.start.dateTime)} - {formatTime(conflict.end.dateTime)}
                                </Typography>
                              )}
                              {conflict.location && (
                                <Typography variant="body2" color="text.secondary">
                                  {conflict.location}
                                </Typography>
                              )}
                              {!startValue && !endValue && (
                                <Typography variant="body2" color="text.secondary">
                                  Tidspunkt ikke tilgjengelig.
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            )}

            <Paper elevation={1} sx={{ p: 2, mt: 2, ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Nytt prosjekt som skal legges til
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="body2">
                  <strong>Prosjekt:</strong> {draftData.projectName || 'Navnløst prosjekt'}
                </Typography>
                <Typography variant="body2">
                  <strong>Klient:</strong> {draftData.clientName || 'Ukjent klient'}
                </Typography>
                <Typography variant="body2">
                  <strong>Dato:</strong>{' '}
                  {draftData.projectDate ? formatDate(draftData.projectDate) : 'Ikke satt'}
                </Typography>
                {draftData.estimatedDuration && (
                  <Typography variant="body2">
                    <strong>Varighet:</strong> {draftData.estimatedDuration} timer
                  </Typography>
                )}
                {draftData.location && (
                  <Typography variant="body2">
                    <strong>Lokasjon:</strong> {draftData.location}
                  </Typography>
                )}
              </Box>
            </Paper>

            {conflictCheck.hasConflicts && (
              <Paper
                elevation={1}
                sx={{ p: 2, mt: 2, backgroundColor: 'rgba(3, 150, 243, 0.1)', ...theming.getThemedCardSx() }}
              >
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Velg hvordan du vil fortsette
                </Typography>

                <Box display="flex" flexDirection="column" gap={2}>
                  {[ 
                    {
                      key: 'new_project' as const,
                      icon: <Add color="primary" />,
                      title: 'Opprett som nytt separat prosjekt',
                      body: 'Anbefalt for separate klienter eller ulike typer oppdrag samme dag.',
                    },
                    {
                      key: 'link_existing' as const,
                      icon: <Link color="primary" />,
                      title: 'Knytt til eksisterende prosjekt',
                      body: 'Bruk hvis dette er del av samme event eller produksjon.',
                    },
                    {
                      key: 'continue_anyway' as const,
                      icon: <PlayArrow color="primary" />,
                      title: 'Fortsett som planlagt',
                      body: 'Opprett prosjekt og håndter planlegging manuelt i neste steg.',
                    },
                  ].map((option) => (
                    <Paper
                      key={option.key}
                      elevation={selectedOption === option.key ? 3 : 1}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border:
                          selectedOption === option.key
                            ? '2px solid #1976d2'
                            : '1px solid transparent',
                      }}
                      onClick={() => setSelectedOption(option.key)}
                    >
                      <Box display="flex" alignItems="center" gap={2}>
                        {option.icon}
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {option.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.body}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Paper>
            )}

            <Paper
              elevation={1}
              sx={{ p: 2, mt: 2, backgroundColor: 'rgba(6, 125, 50, 0.1)', ...theming.getThemedCardSx() }}
            >
              <Typography variant="body2" color="success.main">
                <CheckCircle sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                Kalender-sync er aktiv. Prosjektet kan blokkere tid automatisk når du fortsetter.
              </Typography>
              {conflictCheck.hasConflicts && (
                <Typography variant="body2" color="info.main" sx={{ mt: 1 }}>
                  <Info sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  Du kan fortsatt fortsette med valgt strategi over.
                </Typography>
              )}
            </Paper>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        {conflictCheck && (
          <Button onClick={() => void checkConflicts()} disabled={isChecking} startIcon={<DateRange />}>
            Sjekk på nytt
          </Button>
        )}
        <Button
          onClick={() => onConfirm(selectedOption)}
          variant="contained"
          disabled={isChecking}
          color="primary"
          startIcon={
            selectedOption === 'new_project' ? <Add /> : selectedOption === 'link_existing' ? <Link /> : <PlayArrow />
          }
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
