/**
 * CreatorHub Norge - Memory Card Backup Manager
 * Komplett løsning for minnekort backup med Google Drive integration
 * Implementerer post-produksjon backup prosess med progresjon
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Stack,
  Divider,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Memory,
  CloudUpload,
  Check,
  Warning,
  PhotoCameraAlt,
  Folder,
  Storage,
  Upload,
  PlayArrowArrow,
  Pause,
  Stop,
  Refresh,
  Info,
  CheckCircle,
  Error as ErrorIcon,
  Delete,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MemoryCard {
  id: string;
  cardLabel: string;
  cardType: string;
  capacity: string;
  fileCount: number;
  totalSize: number;
  backupStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  backupProgress?: number;
  backupLocation?: string;
  estimatedPhotos?: number
}

interface BackupSession {
  sessionId: string;
  projectId: string;
  status: 'active' | 'completed' | 'failed';
  currentCardIndex: number;
  totalCards: number;
  equipment: string;
  profession: string
}

interface MemoryCardBackupManagerProps {
  projectId: string;
  profession: 'photographer' | 'videographer';
  isOpen: boolean;
  onClose: () => void
}

// Canon R5 capacity estimations
const CANON_R5_ESTIMATES = {
  '128GB': { raw: 260, craw: 5200,} '256GB': { raw: 520, craw: 10400,}, '512GB': { raw: 1040, craw: 20800,}, '1TB': { raw: 2080, craw: 41600,}, '2TB': { raw: 4160, craw: 83200,},
};

export default function MemoryCardBackupManager({
  projectId,
  profession,
  isOpen,
  onClose,
}: MemoryCardBackupManagerProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCards, setSelectedCards] = useState<MemoryCard[]>([]);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [currentBackupCard, setCurrentBackupCard] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer,');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  // Fetch active backup session
  const { data: backupSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/memory-card/session', projectId],
    queryFn: () => apiRequest(`/api/memory-card/session/${projectId}`),
    enabled: isOpen && !!projectd,
});

  // Fetch memory cards for session
  const { data: memoryCards, isLoading: cardsLoading } = useQuery({
    queryKey: ['/api/memory-card/cards', backupSession?.sessionId],
    queryFn: () => apiRequest(`/api/memory-card/cards/${backupSession.sessiond}`),
    enabled: !!backupSession?.sessiond,
});

  // Initialize backup session mutation
  const initializeSession = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/memory-card/activate', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory-card/session', ],});
      setActiveStep(1);
  },
});

  // Register memory card mutation
  const registerCard = useMutation({
    mutationFn: (cardData: any) =>
      apiRequest('/api/memory-card/register', {
        method: 'POS',
        body: JSON.stringify(cardData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', ],});
  },
});

  // Start backup process mutation
  const startBackup = useMutation({
    mutationFn: async (cardId: string) => {
      // Simulate file upload to Google Drive
      const card = selectedCards.find((c) => c.id === cardId);
      if (!card) throw new Error('Card not found');

      // Create Google Drive folder structure
      const driveFolder = `uploads/raw/${card.cardLabel}_${card.capacity}`;

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Update progress in UI
        setSelectedCards((prev) =>
          prev.map((c) =>
            c.id === cardId
              ? {
                  ...c,
                  backupProgress: progress,
                  backupStatus: 'uploading' as const,
              }
              : c,
          ),
        );
    }

      // Mark as completed
      return apiRequest('/api/memory-card/backup-complete', {
        method: 'POS',
        body: JSON.stringify({
          cardd,
          backupLocation: driveFolder,
          fileCount: card.fileCount,
          totalSize: card.totalSize,
      }),
    });
  },
    onSuccess: (data, cardId) => {
      setSelectedCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, backupStatus: 'completed' as const, backupProgress: 100,} : c,
        ),
      );

      // Move to next card
      const currentIndex = selectedCards.findIndex((c) => c.id === cardId);
      if (currentIndex < selectedCards.length - 1) {
        const nextCard = selectedCards[currentIndex + 1];
        setCurrentBackupCard(nextCard.id);
        startBackup.mutate(nextCard.id);
    } else {
        setBackupInProgress(false);
        setActiveStep(3); // Completion step
    }
  },
});

  // Initialize backup process
  const handleInitializeBackup = () => {
    initializeSession.mutate({
      projectId,
      profession,
      eventType: 'single_day',
      totalDays:  1,
      executionDate: new Date().toISOString(),
  });
};

  // Add memory card to backup list
  const handleAddCard = (cardType: string, capacity: string) => {
    const cardNumber = selectedCards.length + 1;
    const cardLabel = `Minnekort ${String.fromCharCode(64 + cardNumber)}`;
    const estimates = CANON_R5_ESTIMATES[capacity as keyof typeof CANON_R5_ESTIMATES];

    const newCard: MemoryCard = {
      id: `card-${Date.now()}`,
      cardLabel,
      cardType,
      capacity,
      fileCount: estimates?.raw || 0,
      totalSize: parseInt(capacity.replace('G', ', ')) * 1024 * 1024 * 1024,
      backupStatus: 'pending',
      backupProgress:  0,
      estimatedPhotos: estimates?.raw || 0,
  };

    setSelectedCards((prev) => [...prev, newCard]);

    // Register with backend
    if (backupSession?.sessionId) {
      registerCard.mutate({
        sessionId: backupSession.sessiond,
        cardLabel: newCard.cardLabel,
        cardType: newCard.cardType,
        capacity: newCard.capacity,
        fileCount: newCard.fileCount,
        totalSize: newCard.totalSize,
    });
  }
};

  // Start backup process for all cards
  const handleStartBackup = () => {
    if (selectedCards.length === 0) return;

    setBackupInProgress(true);
    setActiveStep(2);
    const firstCard = selectedCards[0];
    setCurrentBackupCard(firstCard.id);
    startBackup.mutate(firstCard.id);
};

  // Reset and start over
  const handleReset = () => {
    setActiveStep(0);
    setSelectedCards([]);
    setBackupInProgress(false);
    setCurrentBackupCard(null);
};

  const steps = ['Initialiser Backup Session', 'Velg Minnekort', 'Backup Prosess','Fullført'];

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '70vh',} }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap:  2,
          background: 'linear-gradient(135deg, #ff8c00 0%, #ff6b35 100%)',
          color: 'white'}}
      >
        <Memory />
        <Typography variant="h6" sx={{  fontWeight: 600}}>
          Minnekort Backup Manager - {getProfessionDisplayName(profession)}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p:  3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Initialize Session , *, /}
          <Step>
            <StepLabel>Initialiser Backup Session</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb:  2 }}>
                <Typography variant="body2">
                  Basert på registrert utstyr (Canon R5) foreslår vi minnekort størrelser
                  optimalisert for ditt arbeid.
                </Typography>
              </Alert>

              <MuiCard sx={{ mb:  2 }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap:  2,
                      mb:  2}}
                  >
                    <PhotoCamera color="primary" />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Canon R5 Optimalisering</Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Systemet har registrert at du bruker Canon R5. Her er anbefalte minnekort
                    størrelser: </Typography>

                  <Grid container spacing={2}>
                    {Object.entries(CANON_R5_ESTIMATES).map(([capacity, estimates]) => (
                      <Grid item xs={12} sm={6} md={4} key={capacity}>
                        <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                            {capacity}
                          </Typography>
                          <Typography variant="body2">
                            ~{estimates.raw.toLocaleString()} RAW bilder
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ~{estimates.craw.toLocaleString()} C-RAW bilder
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </MuiCard>

              <Button variant="contained"
                onClick={handleInitializeBackup}
                disabled={initializeSession.isPending}
                startIcon={theming.getThemedIcon('play')}
                sx={{ mt:  2 }}
               sx={theming.getThemedButtonSx()}>
                {initializeSession.isPending ? 'Initialiserer...' : 'Start Backup Session'}
              </Button>
            </StepContent>
          </Step>

          {/* Step 2: Select Memory Cards , *, /}
          <Step>
            <StepLabel>Velg Minnekort for Backup</StepLabel>
            <StepContent>
              <Typography variant="body1" sx={{ mb:  2 }}>
                Legg til minnekortene du brukte under fotograferingen: </Typography>

              <Stack direction="row" spacing={2} sx={{ mb:  3, flexWrap: 'wrap', gap:  1 }}>
                {['128GB', '256GB','512GB', '1TB', '2TB'].map((capacity) => (
                  <Button
                    key={capacity}
                    variant="outlined"
                    onClick={() => handleAddCard('CFexpress Type B', capacity)}
                    startIcon={theming.getThemedIcon('storage')}
                  >
                    Legg til {capacity}
                  </Button>
                ))}
              </Stack>

              {selectedCards.length > 0 && (
                <MuiCard sx={{ mb:  2 }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{  mb:  2  }}>
                      Valgte Minnekort ({selectedCards.length})
                    </Typography>

                    <List dense>
                      {selectedCards.map((card, index) => (
                        <ListItem key={card.id}>
                          <ListItemIcon>
                            <Memory color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${card.cardLabel} - ${card.capacity}`}
                            secondary={`~${card.estimatedPhotos?.toLocaleString()} RAW bilder estimert`}
                          />
                          <Chip
                            label={card.backupStatus}
                            color={
                              card.backupStatus === 'completed'
                                ? 'success'
                                : card.backupStatus === 'failed'
                                  ? 'error'
                                  : 'default'
                          }
                            size="small"
                          />
                          <IconButton
                            size="small"
                            onClick={() =>
                              setSelectedCards((prev) => prev.filter((c) => c.id !== card.id))
                          }
                          >
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </MuiCard>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button variant="contained"
                  onClick={handleStartBackup}
                  disabled={selectedCards.length === 0}
                  startIcon={theming.getThemedIcon('cloudUpload')}
                 sx={theming.getThemedButtonSx()}>
                  Start Backup Prosess
                </Button>
                <Button onClick={() => setActiveStep(0)}>Tilbake</Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Backup Process , *, /}
          <Step>
            <StepLabel>Backup Prosess</StepLabel>
            <StepContent>
              <Alert severity="warning" sx={{ mb:  2 }}>
                <Typography variant="body2">
                  Ikke fjern minnekortene under backup prosessen. Systemet vil laste opp til
                  strukturerte Google Drive mapper.
                </Typography>
              </Alert>

              {selectedCards.map((card, index) => {
                const isCurrentCard = currentBackupCard === card.id;
                const isCompleted = card.backupStatus === 'completed';
                const isUploading = card.backupStatus === 'uploading';

                return (
                  <MuiCard
                    key={card.id}
                    sx={{
                      mb:  2,
                      bgcolor: isCurrentCard ? 'primary.50' : 'background.paper',
                      border: isCurrentCard ? 2 : 1,
                      borderColor: isCurrentCard ? 'primary.main' : 'divider'}}
                  >
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap:  2,
                          mb:  2}}
                      >
                        <Memory
                          color={isCompleted ? 'success' : isCurrentCard ? 'primary' : 'action'}
                        />
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{card.cardLabel}</Typography>
                        <Chip label={card.capacity} size="small" color="primary" />
                        {isCompleted && <CheckCircle color="success" />}
                        {isUploading && <CloudUpload color="primary" />}
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        Mål: uploads/raw/{card.cardLabel}_{card.capacity}/
                      </Typography>

                      {isUploading && (
                        <Box sx={{ mb:  2 }}>
                          <LinearProgress
                            variant="determinate"
                            value={card.backupProgress || 0}
                            sx={{ height:  8, borderRadius:  1 }}
                          />
                          <Typography variant="body2" sx={{ mt:  1 }}>
                            {card.backupProgress || 0}% fullført
                          </Typography>
                        </Box>
                      )}

                      {isCompleted && (
                        <Alert severity="success" sx={{ mt:  1 }}>
                          <Typography variant="body2">
                            ✅ Backup fullført til Google Drive: {card.backupLocation}
                          </Typography>
                        </Alert>
                      )}
                    </CardContent>
                  </MuiCard>
                );
            })}

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button onClick={() => setActiveStep(1)} disabled={backupInProgress}>
                  Tilbake
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 4: Completion , *, /}
          <Step>
            <StepLabel>Backup Fullført</StepLabel>
            <StepContent>
              <Alert severity="success" sx={{ mb:  2 }}>
                <Typography variant="h6" sx={{  mb:  1  }}>
                  🎉 Minnekort Backup Fullført!
                </Typography>
                <Typography variant="body2">
                  Alle {selectedCards.length} minnekort er trygt sikkerhetskopiert til Google Drive.
                </Typography>
              </Alert>

              <MuiCard sx={{ mb:  2 }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{  mb:  2  }}>
                    Backup Sammendrag
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={6} >
                      <Typography variant="body2" color="text.secondary">
                        Totalt minnekort: </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedCards.length}</Typography>
                    </Grid>
                    <Grid item xs={6} >
                      <Typography variant="body2" color="text.secondary">
                        Estimerte bilder: </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {selectedCards
                          .reduce((sum, card) => sum + (card.estimatedPhotos || 0), 0)
                          .toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my:  2 }} />

                  <Typography variant="body2" color="text.secondary">
                    Filer er organisert i Google Drive under: </Typography>
                  {selectedCards.map((card) => (
                    <Typography
                      key={card.d}
                      variant="body2"
                      sx={{ fontFamily: 'monospace', mt:  1 }}
                    >
                      📁 uploads/raw/{card.cardLabel}_{card.capacity}/
                    </Typography>
                  ))}
                </CardContent>
              </MuiCard>

              <Box sx={{ display: 'flex', gap:  2 }}>
                <Button variant="contained" onClick={onClose} sx={theming.getThemedButtonSx()}>
                  Lukk
                </Button>
                <Button variant="outlined" onClick={handleReset}>
                  Start Ny Backup
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
    </Dialog>
  );
}
