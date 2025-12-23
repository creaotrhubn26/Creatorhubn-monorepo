/**
 * CreatorHub Norge - Calendar Conflict Checker
 * Sjekker kalenderkonflikter for prosjekt-utkast med Google Calendar
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
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
  CircularProgress
} from '@mui/material';
import {
  Warning,
  CheckCircle,
  Event,
  Schedule,
  DateRange,
  CalendarToday,
  Add,
  Link,
  PlayArrow,
  Info
} from '@mui/icons-material';
import { useAutosave } from '@/hooks/useAutosave';

interface CalendarConflictCheckerProps {
  draftData: any;
  open: boolean;
  onClose: () => void;
  onConfirm: (option: 'new_project' | 'link_existing' | 'continue_anyway') => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function CalendarConflictChecker({
  draftData,
  open,
  onClose,
  onConfirm,
  profession = 'photographer'
}: CalendarConflictCheckerProps) {
  const [conflictCheck, setConflictCheck] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [selectedOption, setSelectedOption] = useState<'new_project' | 'link_existing' | 'continue_anyway'>('continue_anyway');
  
  const { checkCalendarConflicts, isCheckingConflicts } = useAutosave(
    , 'conflict-check, ', 'photographer',
    draftData,
    false, // Don't enable autosave for conflict checker
    false  // Don't enable calendar sync for conflict checker
  );

  // Sjekk konflikter når dialog åpnes
  useEffect(() => {
    if (open && draftData) {
      checkConflicts();
  }
}, [open, draftData]);

  const checkConflicts = async () => {
    try {
      setIsChecking(true);
      const result = await checkCalendarConflicts(draftData);
      setConflictCheck(result);
  } catch (error) {
      console.error('Error checking calendar conflicts: ', error);
      setConflictCheck({
        hasConflicts: false,
        conflicts:  [],
        message: 'Kunne ikke sjekke kalenderkonflikter'
  });
  } finally {
      setIsChecking(false);
  }
};

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-N', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
});
};

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('nb-N', {
      hour: '2-digit',
      minute: '2-digit'
});
};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {theming.getThemedIcon('calendar')}
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Kalender Konfliktsjekk
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isChecking || isCheckingConflicts ? (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={4}>
            <CircularProgress />
            <Typography>Sjekker kalenderkonflikter...</Typography>
          </Box>
        ) : conflictCheck ? (
          <Box>
            {conflictCheck.hasConflicts ? (
              <Alert severity="info" sx={{ mb:  2 }}>
                <AlertTitle>📅 Eksisterende avtaler funnet</AlertTitle>
                {conflictCheck.message} - Du kan likevel fortsette med flere alternativer.
              </Alert>
            ) : (
              <Alert severity="success" sx={{ mb:  2 }}>
                <AlertTitle>✅ Ingen konflikter</AlertTitle>
                {conflictCheck.message}
              </Alert>
            )}

            {conflictCheck.conflicts && conflictCheck.conflicts.length > 0 && (
              <Paper elevation={1} sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Eksisterende avtaler: </Typography>
                <List>
                  {conflictCheck.conflicts.map((conflict: any, index: number) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <Event color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={conflict.summary || 'Ukjent avtale'}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              📅 {formatDate(conflict.start?.dateTime || conflict.start?.date)}
                            </Typography>
                            {conflict.start?.dateTime && (
                              <Typography variant="body2" color="text.secondary">
                                ⏰ {formatTime(conflict.start.dateTime)} - {formatTime(conflict.end?.dateTime)}
                              </Typography>
                            )}
                            {conflict.location && (
                              <Typography variant="body2" color="text.secondary">
                                📍 {conflict.location}
                              </Typography>
                            )}
                          </Box>
                      }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {/* Prosjektinformasjon */}
            <Paper elevation={1} sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Nytt prosjekt som skal legges til: </Typography>
              <Box display="flex" flexDirection="column" gap=, {, 1}>
                <Typography variant="body2">
                  <strong>📸 Prosjekt: </strong> {draftData.projectName || 'Navnløst prosjekt'}
                </Typography>
                <Typography variant="body2">
                  <strong>👤 Klient: </strong> {draftData.clientName || 'Ukjent klient'}
                </Typography>
                <Typography variant="body2">
                  <strong>📅 Dato: </strong> {draftData.projectDate ? formatDate(draftData.projectDate) : 'Ikke satt'}
                </Typography>
                {draftData.estimatedDuration && (
                  <Typography variant="body2">
                    <strong>⏱️ Varighet: </strong> {draftData.estimatedDuration} timer
                  </Typography>
                )}
                {draftData.location && (
                  <Typography variant="body2">
                    <strong>📍 Lokasjon: </strong> {draftData.location}
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* Konfliktløsning alternativer */}
            {conflictCheck.hasConflicts && (
              <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: 'rgba(3, 150, 243, 0.1)' ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Velg hvordan du vil fortsette: </Typography>
                
                <Box display="flex" flexDirection="column" gap=, {, 2}>
                  {/* Alternativ 1: Nytt separat prosjekt , *, /}
                  <Paper 
                    elevation={selectedOption === 'new_project' ? 3 : 1}
                    sx={{ 
                      p: 2, cursor: 'pointer',
                      border: selectedOption === 'new_project' ? '2px solid #1976d2' : '1px solid transparent', '&:hover': { elevation:  2 }
                  }}
                    onClick={() => setSelectedOption('new_project')}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Add color="primary" />
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Opprett som nytt separat prosjekt
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Ideelt for helt separate klienter eller forskjellige prosjekttyper samme dag
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Alternativ 2: Knytt til eksisterende , *, /}
                  <Paper 
                    elevation={selectedOption === 'link_existing' ? 3 : 1}
                    sx={{ 
                      p: 2, cursor: 'pointer',
                      border: selectedOption === 'link_existing' ? '2px solid #1976d2' : '1px solid transparent', '&:hover': { elevation:  2 }
                  }}
                    onClick={() => setSelectedOption('link_existing')}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Link color="primary" />
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Knytt til eksisterende prosjekt
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Hvis dette er del av samme bryllup/event som eksisterende avtale
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Alternativ 3: Fortsett likevel , *, /}
                  <Paper 
                    elevation={selectedOption === 'continue_anyway' ? 3 : 1}
                    sx={{ 
                      p: 2, cursor: 'pointer',
                      border: selectedOption === 'continue_anyway' ? '2px solid #1976d2' : '1px solid transparent', '&:hover': { elevation:  2 }
                  }}
                    onClick={() => setSelectedOption('continue_anyway')}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <PlayArrow color="primary" />
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Fortsett som planlagt
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Opprett prosjekt og kalenderblokk som normalt - du kan håndtere flere prosjekter samme dag
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              </Paper>
            )}

            {/* Calendar sync info */}
            <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: 'rgba(6, 125, 50, 0.1)' ,  ...theming.getThemedCardSx() }}>
              <Typography variant="body2" color="success.main">
                <CheckCircle sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                Google Calendar Sync aktivert - prosjektet vil automatisk blokkere tiden i kalenderen din
              </Typography>
              {conflictCheck.hasConflicts && (
                <Typography variant="body2" color="info.main" sx={{ mt:  1 }}>
                  <Info sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                  Fotografer kan effektivt håndtere flere prosjekter samme dag med smart tidsplanlegging
                </Typography>
              )}
            </Paper>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Avbryt
        </Button>
        {conflictCheck && (
          <Button
            onClick={checkConflicts}
            disabled={isChecking || isCheckingConflicts}
            startIcon={<DateRange />}
          >
            Sjekk på nytt
          </Button>
        )}
        <Button
          onClick={() => onConfirm(selectedOption)}
          variant="contained"
          disabled={isChecking || isCheckingConflicts}
          color="primary"
          startIcon={
            selectedOption === 'new_project' ? theming.getThemedIcon('add') :
            selectedOption === 'link_existing' ? <Link /> : theming.getThemedIcon('play')
        }
        >
          {conflictCheck?.hasConflicts ? (
            selectedOption === 'new_project' ? 'Opprett nytt prosjekt' :
            selectedOption === 'link_existing' ? 'Knytt til eksisterende' : 'Fortsett som planlagt') :'Bekreft og fortsett'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}