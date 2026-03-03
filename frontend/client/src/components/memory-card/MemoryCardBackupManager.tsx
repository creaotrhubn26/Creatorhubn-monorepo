/**
 * CreatorHub Norge - Memory Card Backup Manager
 * Komplett løsning for minnekort-backup med Google Drive-integrasjon.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  CheckCircle,
  CloudUpload,
  Folder,
  Memory,
  PhotoCamera,
  PlayArrow,
  Refresh,
  Storage,
  Upload,
  Warning,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface MemoryCard {
  id: string;
  cardLabel: string;
  cardType: string;
  capacity: string;
  fileCount: number;
  totalSize: number;
  backupStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  backupProgress: number;
  backupLocation?: string;
}

interface BackupSession {
  sessionId: string;
  projectId: string;
  status: 'active' | 'completed' | 'failed';
  currentCardIndex: number;
  totalCards: number;
  equipment: string;
  profession: string;
}

interface MemoryCardBackupManagerProps {
  projectId: string;
  profession: 'photographer' | 'videographer';
  isOpen: boolean;
  onClose: () => void;
}

interface SessionForm {
  equipment: string;
  shootDate: string;
}

const initialSessionForm: SessionForm = {
  equipment: '',
  shootDate: '',
};

const CAPACITY_ESTIMATES: Record<string, { raw: number; craw: number }> = {
  '128GB': { raw: 260, craw: 5200 },
  '256GB': { raw: 520, craw: 10400 },
  '512GB': { raw: 1040, craw: 20800 },
  '1TB': { raw: 2080, craw: 41600 },
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function backupStatusColor(status: MemoryCard['backupStatus']): ChipProps['color'] {
  switch (status) {
    case 'completed':
      return 'success';
    case 'uploading':
      return 'info';
    case 'failed':
      return 'error';
    case 'pending':
    default:
      return 'default';
  }
}

function formatSize(sizeMb: number): string {
  if (sizeMb >= 1024) {
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  }
  return `${sizeMb.toFixed(0)} MB`;
}

function estimatePhotos(capacity: string): string {
  const estimate = CAPACITY_ESTIMATES[capacity];
  if (!estimate) {
    return 'Ukjent';
  }
  return `${estimate.raw} RAW / ${estimate.craw} C-RAW`;
}

export default function MemoryCardBackupManager({
  projectId,
  profession,
  isOpen,
  onClose,
}: MemoryCardBackupManagerProps): JSX.Element {
  const queryClient = useQueryClient();
  const theming = useTheming(profession);
  const { getProfessionDisplayName } = useDynamicProfessions();

  const [activeStep, setActiveStep] = useState(0);
  const [sessionForm, setSessionForm] = useState<SessionForm>(initialSessionForm);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  const sessionQuery = useQuery({
    queryKey: ['/api/memory-card/session', projectId],
    queryFn: async (): Promise<BackupSession | null> => {
      const data = await apiRequest(`/api/memory-card/session/${projectId}`);
      return data ? (data as BackupSession) : null;
    },
    enabled: isOpen && Boolean(projectId),
  });

  const cardsQuery = useQuery({
    queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId],
    queryFn: async (): Promise<MemoryCard[]> => {
      const sessionId = sessionQuery.data?.sessionId;
      if (!sessionId) {
        return [];
      }
      const data = await apiRequest(`/api/memory-card/cards/${sessionId}`);
      return safeArray<MemoryCard>(data).map((card) => ({
        ...card,
        backupProgress: typeof card.backupProgress === 'number' ? card.backupProgress : 0,
      }));
    },
    enabled: isOpen && Boolean(sessionQuery.data?.sessionId),
  });

  const initializeSession = useMutation({
    mutationFn: async (): Promise<void> => {
      await apiRequest('/api/memory-card/session', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          profession,
          equipment: sessionForm.equipment,
          shootDate: sessionForm.shootDate,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/memory-card/session', projectId] });
      setActiveStep(1);
    },
  });

  const registerCard = useMutation({
    mutationFn: async (card: {
      cardLabel: string;
      cardType: string;
      capacity: string;
      fileCount: number;
      totalSize: number;
    }): Promise<void> => {
      await apiRequest('/api/memory-card/cards', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionQuery.data?.sessionId,
          ...card,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId] });
    },
  });

  const runBackup = useMutation({
    mutationFn: async (cardId: string): Promise<void> => {
      await apiRequest(`/api/memory-card/backup/${cardId}/start`, {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId] });
    },
  });

  const cards = cardsQuery.data ?? [];
  const selectedCards = cards.filter((card) => selectedCardIds.has(card.id));

  const totalSizeSelected = useMemo(
    () => selectedCards.reduce((sum, card) => sum + card.totalSize, 0),
    [selectedCards],
  );

  const completedCount = useMemo(
    () => cards.filter((card) => card.backupStatus === 'completed').length,
    [cards],
  );

  const allCompleted = cards.length > 0 && completedCount === cards.length;

  const loading =
    sessionQuery.isLoading ||
    cardsQuery.isLoading ||
    initializeSession.isPending ||
    registerCard.isPending ||
    runBackup.isPending;

  const handleToggleCard = (cardId: string): void => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleStartSession = (): void => {
    if (!sessionForm.equipment || !sessionForm.shootDate) {
      return;
    }
    initializeSession.mutate();
  };

  const handleRegisterSampleCards = (): void => {
    const samples = [
      { cardLabel: 'A-CAM-1', cardType: 'CFexpress', capacity: '256GB', fileCount: 740, totalSize: 93000 },
      { cardLabel: 'B-CAM-1', cardType: 'SD UHS-II', capacity: '128GB', fileCount: 420, totalSize: 47000 },
    ];

    samples.forEach((sample) => {
      registerCard.mutate(sample);
    });
  };

  const handleRunBackup = (): void => {
    selectedCards.forEach((card) => {
      runBackup.mutate(card.id);
    });

    setActiveStep(2);
  };

  const steps = ['Opprett session', 'Velg minnekort', 'Backup status'];

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Memory color="primary" />
          Memory Card Backup Manager
          <Chip label={getProfessionDisplayName(profession)} size="small" variant="outlined" />
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        <Alert severity="info" sx={{ mb: 2 }}>
          Sikrer råmateriale direkte til strukturert prosjektbackup i sky.
        </Alert>

        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>{steps[0]}</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Utstyr"
                    value={sessionForm.equipment}
                    onChange={(event) =>
                      setSessionForm((prev) => ({ ...prev, equipment: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Shoot-dato"
                    InputLabelProps={{ shrink: true }}
                    value={sessionForm.shootDate}
                    onChange={(event) =>
                      setSessionForm((prev) => ({ ...prev, shootDate: event.target.value }))
                    }
                  />
                </Grid>
              </Grid>
              <Box mt={2} display="flex" gap={1}>
                <Button variant="contained" startIcon={<PlayArrow />} onClick={handleStartSession} disabled={initializeSession.isPending}>
                  Start session
                </Button>
                <Button variant="outlined" startIcon={<Refresh />} onClick={() => sessionQuery.refetch()}>
                  Oppdater
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{steps[1]}</StepLabel>
            <StepContent>
              <Stack spacing={1}>
                <Button variant="outlined" startIcon={<PhotoCamera />} onClick={handleRegisterSampleCards}>
                  Registrer demo-kort
                </Button>

                {cards.map((card) => {
                  const selected = selectedCardIds.has(card.id);

                  return (
                    <Paper key={card.id} variant="outlined" sx={{ p: 1.5, ...theming.getThemedCardSx() }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="subtitle1">{card.cardLabel}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {card.cardType} • {card.capacity} • {card.fileCount.toLocaleString('no-NO')} filer
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatSize(card.totalSize)} • Estimat: {estimatePhotos(card.capacity)}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip size="small" label={card.backupStatus} color={backupStatusColor(card.backupStatus)} />
                          <Button variant={selected ? 'contained' : 'outlined'} onClick={() => handleToggleCard(card.id)}>
                            {selected ? 'Valgt' : 'Velg'}
                          </Button>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>

              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Valgt størrelse: {formatSize(totalSizeSelected)}
                </Typography>
              </Box>

              <Box mt={2}>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={handleRunBackup}
                  disabled={selectedCards.length === 0 || runBackup.isPending}
                >
                  Kjør backup
                </Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{steps[2]}</StepLabel>
            <StepContent>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <StatCard icon={<Storage color="primary" />} label="Kort" value={cards.length.toString()} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <StatCard icon={<CheckCircle color="success" />} label="Ferdig" value={completedCount.toString()} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <StatCard
                        icon={allCompleted ? <CheckCircle color="success" /> : <Warning color="warning" />}
                        label="Status"
                        value={allCompleted ? 'Klar' : 'Pågår'}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <List>
                    {cards.map((card) => (
                      <ListItem key={card.id}>
                        <ListItemIcon>
                          {card.backupStatus === 'completed' ? <CheckCircle color="success" /> : <Upload color="action" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={card.cardLabel}
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {card.backupLocation ?? 'Ingen backup-lokasjon ennå'}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={card.backupProgress}
                                sx={{ mt: 0.5 }}
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        <Button
          variant="outlined"
          startIcon={<Folder />}
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId] });
          }}
        >
          Oppdater status
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box display="flex" alignItems="center" gap={1}>
        {icon}
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h6">{value}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}
