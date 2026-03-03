import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
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
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  CheckCircle,
  Error,
  RadioButtonUnchecked,
  Storage,
  Warning,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import MemoryCardVisualDesign, {
  MemoryCardSet,
  type MemoryCardStatus,
  type MemoryCardTypeKey,
} from './MemoryCardVisualDesign';

type ProfessionType = 'photographer' | 'videographer' | 'music_producer';

interface MemoryCardSelectorProps {
  onCardSelected?: (cardType: MemoryCardTypeKey) => void;
  selectedCard?: MemoryCardTypeKey | null;
  profession?: ProfessionType;
  showSetOverview?: boolean;
}

interface CardDetails {
  type: MemoryCardTypeKey;
  name: string;
  description: string;
  capacity: string;
  speed: string;
  status: MemoryCardStatus;
  usagePercent: number;
  files: number;
  lastUsed?: string;
}

interface PersistedSelection {
  selectedCard: MemoryCardTypeKey | null;
}

const LOCAL_STORAGE_KEY = 'creatorhub_memory_card_selector';

const CARD_DETAILS: CardDetails[] = [
  {
    type: 'A',
    name: 'Hovedkort',
    description: 'Primert kort for aktiv produksjon.',
    capacity: '128GB',
    speed: 'V90',
    status: 'active',
    usagePercent: 72,
    files: 287,
    lastUsed: '2 timer siden',
  },
  {
    type: 'B',
    name: 'Backup-kort',
    description: 'Synkron backup av viktig opptak.',
    capacity: '64GB',
    speed: 'V60',
    status: 'backup',
    usagePercent: 43,
    files: 123,
    lastUsed: '1 dag siden',
  },
  {
    type: 'C',
    name: 'Arkivkort',
    description: 'Langtidslagring av ferdige shoots.',
    capacity: '256GB',
    speed: 'V90',
    status: 'full',
    usagePercent: 97,
    files: 541,
    lastUsed: '3 dager siden',
  },
  {
    type: 'D',
    name: 'Reservekort',
    description: 'Tomt kort klart for raske bytter.',
    capacity: '32GB',
    speed: 'V30',
    status: 'empty',
    usagePercent: 0,
    files: 0,
    lastUsed: 'Aldri',
  },
  {
    type: 'E',
    name: 'Servicekort',
    description: 'Kort med feil, krever utskifting.',
    capacity: '64GB',
    speed: 'V60',
    status: 'error',
    usagePercent: 100,
    files: 0,
    lastUsed: '1 uke siden',
  },
];

function parseLocalStorageSelection(): MemoryCardTypeKey | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedSelection;
    return parsed.selectedCard ?? null;
  } catch {
    return null;
  }
}

function getStatusIcon(status: MemoryCardStatus): React.ReactNode {
  switch (status) {
    case 'active':
      return <CheckCircle sx={{ color: 'success.main' }} />;
    case 'backup':
      return <Storage sx={{ color: 'warning.main' }} />;
    case 'full':
      return <Warning sx={{ color: 'error.main' }} />;
    case 'error':
      return <Error sx={{ color: 'error.dark' }} />;
    case 'empty':
    default:
      return <RadioButtonUnchecked sx={{ color: 'text.disabled' }} />;
  }
}

function getStatusLabel(status: MemoryCardStatus): string {
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'backup':
      return 'Backup';
    case 'full':
      return 'Nesten fullt';
    case 'error':
      return 'Feil';
    case 'empty':
    default:
      return 'Tom';
  }
}

export default function MemoryCardSelector({
  onCardSelected,
  selectedCard,
  profession = 'photographer',
  showSetOverview = true,
}: MemoryCardSelectorProps): React.ReactElement {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theming = useTheming(profession);

  const [localSelection, setLocalSelection] = useState<MemoryCardTypeKey | null>(selectedCard ?? null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState<CardDetails | null>(null);

  const persistedSelectionQuery = useQuery({
    queryKey: ['memory-card-selection', user?.id],
    queryFn: async (): Promise<PersistedSelection | null> => {
      try {
        const result = await apiRequest('/api/memory-cards/selection');
        if (typeof result === 'object' && result !== null && 'selectedCard' in result) {
          const selectedFromApi = (result as PersistedSelection).selectedCard;
          return { selectedCard: selectedFromApi };
        }
      } catch {
        // Falls back to local state when endpoint is unavailable in local dev.
      }
      return null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (selectedCard !== undefined) {
      setLocalSelection(selectedCard);
      return;
    }

    const fromApi = persistedSelectionQuery.data?.selectedCard ?? null;
    if (fromApi) {
      setLocalSelection(fromApi);
      return;
    }

    const fromStorage = parseLocalStorageSelection();
    if (fromStorage) {
      setLocalSelection(fromStorage);
    }
  }, [persistedSelectionQuery.data, selectedCard]);

  const persistSelectionMutation = useMutation({
    mutationFn: async (nextSelection: MemoryCardTypeKey): Promise<void> => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ selectedCard: nextSelection }));
      try {
        await apiRequest('/api/memory-cards/selection', {
          method: 'POST',
          body: {
            selectedCard: nextSelection,
            userId: user?.id ?? null,
          },
        });
      } catch {
        // API can be unavailable in offline/local mode. Local persistence still works.
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-card-selection', user?.id] });
    },
  });

  const effectiveSelection = useMemo(
    () => selectedCard ?? localSelection,
    [selectedCard, localSelection],
  );

  const handleCardClick = (cardType: MemoryCardTypeKey): void => {
    setLocalSelection(cardType);
    onCardSelected?.(cardType);
    persistSelectionMutation.mutate(cardType);
  };

  const handleDetailsClick = (card: CardDetails): void => {
    setSelectedForDetails(card);
    setDetailsOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {showSetOverview ? (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
            Minnekortoversikt
          </Typography>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <MemoryCardSet profession={profession} showLabels />
            </CardContent>
          </Card>
        </Box>
      ) : null}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Velg Minnekort
        </Typography>
        {persistSelectionMutation.isPending ? <Chip size="small" label="Lagrer..." /> : null}
      </Stack>

      {persistedSelectionQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Kun lokal lagring er tilgjengelig akkurat ne.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        {CARD_DETAILS.map((card) => {
          const isSelected = effectiveSelection === card.type;
          const isDisabled = card.status === 'error';

          return (
            <Grid key={card.type} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  border: isSelected ? '2px solid' : '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.7 : 1,
                  transition: 'all 160ms ease',
                  '&:hover': isDisabled
                    ? undefined
                    : {
                        boxShadow: 4,
                        transform: 'translateY(-2px)',
                      },
                }}
                onClick={() => {
                  if (!isDisabled) {
                    handleCardClick(card.type);
                  }
                }}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <MemoryCardVisualDesign
                        cardType={card.type}
                        capacity={card.capacity}
                        speed={card.speed}
                        status={card.status}
                        profession={profession}
                        size="large"
                      />
                    </Box>

                    <Typography variant="h6" align="center" sx={{ color: theming.colors.primary }}>
                      Kort {card.type}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      {card.name}
                    </Typography>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Chip
                        icon={getStatusIcon(card.status)}
                        label={getStatusLabel(card.status)}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {card.capacity}
                      </Typography>
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      Bruk: {card.usagePercent}% • {card.files.toLocaleString()} filer
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDetailsClick(card);
                        }}
                        size="small"
                        variant="outlined"
                      >
                        Detaljer
                      </Button>
                      <Button
                        fullWidth
                        disabled={isDisabled}
                        size="small"
                        variant={isSelected ? 'contained' : 'outlined'}
                      >
                        {isSelected ? 'Valgt' : 'Velg'}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {selectedForDetails ? `Minnekort ${selectedForDetails.type}` : 'Kortdetaljer'}
        </DialogTitle>
        <DialogContent>
          {selectedForDetails ? (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <MemoryCardVisualDesign
                  cardType={selectedForDetails.type}
                  capacity={selectedForDetails.capacity}
                  speed={selectedForDetails.speed}
                  status={selectedForDetails.status}
                  profession={profession}
                  size="medium"
                />
              </Box>

              <Typography>{selectedForDetails.description}</Typography>

              {selectedForDetails.status === 'error' ? (
                <Alert severity="error">Dette kortet er markert med feil og ber ikke brukes.</Alert>
              ) : null}

              {selectedForDetails.status === 'full' ? (
                <Alert severity="warning">Kortet er nesten fullt. Frigjer plass fer neste opptak.</Alert>
              ) : null}

              <Grid container spacing={1}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Kapasitet
                  </Typography>
                  <Typography>{selectedForDetails.capacity}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Hastighet
                  </Typography>
                  <Typography>{selectedForDetails.speed}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Filer
                  </Typography>
                  <Typography>{selectedForDetails.files.toLocaleString()}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Sist brukt
                  </Typography>
                  <Typography>{selectedForDetails.lastUsed ?? 'Ukjent'}</Typography>
                </Grid>
              </Grid>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Lukk</Button>
          {selectedForDetails && selectedForDetails.status !== 'error' ? (
            <Button
              variant="contained"
              onClick={() => {
                handleCardClick(selectedForDetails.type);
                setDetailsOpen(false);
              }}
            >
              Velg dette kortet
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
