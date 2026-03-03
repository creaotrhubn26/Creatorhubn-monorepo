/**
 * CreatorHub Norge - Memory Card Backup Panel
 * Intelligent memory-card backup panel with localized flow.
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
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Memory as MemoryIcon,
  PhotoCamera as CameraIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Upload as UploadIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface MemoryCardBackupPanelProps {
  projectId: string;
  profession: 'photographer' | 'videographer';
  onSessionActivated?: (sessionId: string) => void;
}

interface MemoryCardSession {
  sessionId: string;
  projectId: string;
  profession: string;
  eventType: string;
  status: 'active' | 'completed' | 'failed';
  totalCards: number;
  backedUpCards: number;
}

interface MemoryCard {
  id: string;
  cardLabel: string;
  cardType: string;
  capacity: string;
  fileCount: number;
  totalSizeMb: number;
  backupStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  backupProgress: number;
  backupLocation?: string;
}

interface BackupTip {
  id: string;
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusColor(status: MemoryCard['backupStatus']): ChipProps['color'] {
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

function formatSize(totalSizeMb: number): string {
  if (totalSizeMb >= 1024) {
    return `${(totalSizeMb / 1024).toFixed(2)} GB`;
  }
  return `${totalSizeMb.toFixed(0)} MB`;
}

export function MemoryCardBackupPanel({
  projectId,
  profession,
  onSessionActivated,
}: MemoryCardBackupPanelProps): JSX.Element {
  const theming = useTheming(profession);
  const queryClient = useQueryClient();

  const [addCardDialogOpen, setAddCardDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    cardLabel: '',
    cardType: 'SD UHS-II',
    capacity: '128GB',
    fileCount: 0,
    totalSizeMb: 0,
  });

  const sessionQuery = useQuery({
    queryKey: ['/api/memory-card/session', projectId],
    queryFn: async (): Promise<MemoryCardSession | null> => {
      const data = await apiRequest(`/api/memory-card/session/${projectId}`);
      return data ? (data as MemoryCardSession) : null;
    },
    enabled: Boolean(projectId),
  });

  const cardsQuery = useQuery({
    queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId],
    queryFn: async (): Promise<MemoryCard[]> => {
      const sessionId = sessionQuery.data?.sessionId;
      if (!sessionId) {
        return [];
      }
      const data = await apiRequest(`/api/memory-card/cards/${sessionId}`);
      return safeArray<MemoryCard>(data);
    },
    enabled: Boolean(sessionQuery.data?.sessionId),
  });

  const tipsQuery = useQuery({
    queryKey: ['/api/memory-card/tips', profession],
    queryFn: async (): Promise<BackupTip[]> => {
      const data = await apiRequest(`/api/memory-card/tips?profession=${profession}`);
      const tips = safeArray<BackupTip>(data);
      if (tips.length > 0) {
        return tips;
      }
      return [
        {
          id: 'tip-1',
          title: '3-2-1 backup',
          description: 'Behold minst tre kopier av data i to ulike medier, hvorav én offsite.',
          importance: 'high',
        },
      ];
    },
    enabled: Boolean(projectId),
  });

  const activateSession = useMutation({
    mutationFn: async (): Promise<{ sessionId: string }> => {
      return (await apiRequest('/api/memory-card/activate', {
        method: 'POST',
        body: JSON.stringify({ projectId, profession }),
      })) as { sessionId: string };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/memory-card/session', projectId] });
      onSessionActivated?.(data.sessionId);
    },
  });

  const addCard = useMutation({
    mutationFn: async (): Promise<void> => {
      await apiRequest('/api/memory-card/cards', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionQuery.data?.sessionId,
          ...newCard,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId] });
      setAddCardDialogOpen(false);
      setNewCard({ cardLabel: '', cardType: 'SD UHS-II', capacity: '128GB', fileCount: 0, totalSizeMb: 0 });
    },
  });

  const triggerBackup = useMutation({
    mutationFn: async (cardId: string): Promise<void> => {
      await apiRequest(`/api/memory-card/backup/${cardId}`, {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/memory-card/cards', sessionQuery.data?.sessionId] });
    },
  });

  const cards = cardsQuery.data ?? [];
  const tips = tipsQuery.data ?? [];

  const loading =
    sessionQuery.isLoading ||
    cardsQuery.isLoading ||
    activateSession.isPending ||
    addCard.isPending ||
    triggerBackup.isPending;

  const progressPercent = useMemo(() => {
    if (cards.length === 0) {
      return 0;
    }
    const completed = cards.filter((card) => card.backupStatus === 'completed').length;
    return (completed / cards.length) * 100;
  }, [cards]);

  return (
    <Box>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <MemoryIcon color="primary" />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Memory Card Backup
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => cardsQuery.refetch()}>
                Oppdater
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddCardDialogOpen(true)}>
                Legg til kort
              </Button>
            </Stack>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {!sessionQuery.data && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ingen aktiv backup-session. Start en ny session for prosjektet.
            </Alert>
          )}

          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            <Chip label={`Prosjekt: ${projectId}`} variant="outlined" />
            <Chip label={`Profesjon: ${profession}`} variant="outlined" />
            <Chip label={`Status: ${sessionQuery.data?.status ?? 'ikke aktiv'}`} color={sessionQuery.data ? 'primary' : 'default'} />
          </Box>

          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => activateSession.mutate()}
            disabled={activateSession.isPending}
            sx={{ mb: 2 }}
          >
            Aktiver session
          </Button>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Backup-fremdrift
            </Typography>
            <LinearProgress variant="determinate" value={progressPercent} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {progressPercent.toFixed(0)}% fullført
            </Typography>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <List>
                {cards.map((card) => (
                  <ListItem key={card.id} divider>
                    <ListItemIcon>
                      {card.backupStatus === 'completed' ? <CheckCircleIcon color="success" /> : <StorageIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${card.cardLabel} • ${card.capacity}`}
                      secondary={`${card.cardType} • ${card.fileCount.toLocaleString('no-NO')} filer • ${formatSize(card.totalSizeMb)}`}
                    />
                    <Chip size="small" label={card.backupStatus} color={statusColor(card.backupStatus)} sx={{ mr: 1 }} />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => triggerBackup.mutate(card.id)}
                      disabled={triggerBackup.isPending}
                    >
                      Backup
                    </Button>
                  </ListItem>
                ))}
              </List>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Backup-tips
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <List>
                  {tips.map((tip) => (
                    <ListItem key={tip.id}>
                      <ListItemIcon>
                        {tip.importance === 'high' ? <WarningIcon color="warning" /> : <CameraIcon color="action" />}
                      </ListItemIcon>
                      <ListItemText primary={tip.title} secondary={tip.description} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Dialog open={addCardDialogOpen} onClose={() => setAddCardDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Legg til minnekort</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            fullWidth
            label="Kortlabel"
            value={newCard.cardLabel}
            onChange={(event) => setNewCard((prev) => ({ ...prev, cardLabel: event.target.value }))}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Korttype"
            value={newCard.cardType}
            onChange={(event) => setNewCard((prev) => ({ ...prev, cardType: event.target.value }))}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="memory-card-capacity-label">Kapasitet</InputLabel>
                <Select
                  labelId="memory-card-capacity-label"
                  label="Kapasitet"
                  value={newCard.capacity}
                  onChange={(event) =>
                    setNewCard((prev) => ({ ...prev, capacity: event.target.value }))
                  }
                >
                  <MenuItem value="64GB">64GB</MenuItem>
                  <MenuItem value="128GB">128GB</MenuItem>
                  <MenuItem value="256GB">256GB</MenuItem>
                  <MenuItem value="512GB">512GB</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                margin="normal"
                fullWidth
                label="Antall filer"
                type="number"
                value={newCard.fileCount}
                onChange={(event) =>
                  setNewCard((prev) => ({ ...prev, fileCount: Number(event.target.value) || 0 }))
                }
              />
            </Grid>
          </Grid>
          <TextField
            margin="normal"
            fullWidth
            label="Total størrelse (MB)"
            type="number"
            value={newCard.totalSizeMb}
            onChange={(event) =>
              setNewCard((prev) => ({ ...prev, totalSizeMb: Number(event.target.value) || 0 }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCardDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => addCard.mutate()} disabled={addCard.isPending}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MemoryCardBackupPanel;
