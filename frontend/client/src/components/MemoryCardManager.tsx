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
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddCircle,
  Lock,
  Memory,
  Search,
  Security,
  Storage,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SecuritySettings {
  pinRequired: boolean;
  pin?: string;
  passwordRequired: boolean;
  password?: string;
  encryptionEnabled: boolean;
  accessLevel: 'public' | 'restricted' | 'private';
}

interface MemoryCard {
  id: string;
  serialNumber: string;
  brand: string;
  type: string;
  capacity: string;
  speed: string;
  location: string;
  notes: string;
  status: 'available' | 'in_use' | 'needs_attention';
  securitySettings: SecuritySettings;
}

interface NewCardForm {
  serialNumber: string;
  brand: string;
  type: string;
  capacity: string;
  speed: string;
  location: string;
  notes: string;
  status: MemoryCard['status'];
  securitySettings: SecuritySettings;
}

const LOCAL_KEY = 'memory_card_manager_cards';

const EMPTY_SECURITY: SecuritySettings = {
  pinRequired: false,
  pin: '',
  passwordRequired: false,
  password: '',
  encryptionEnabled: false,
  accessLevel: 'public',
};

const EMPTY_FORM: NewCardForm = {
  serialNumber: '',
  brand: '',
  type: 'SDXC',
  capacity: '128GB',
  speed: 'UHS-II',
  location: '',
  notes: '',
  status: 'available',
  securitySettings: EMPTY_SECURITY,
};

function parseCardsResponse(payload: unknown): MemoryCard[] {
  if (Array.isArray(payload)) {
    return payload as MemoryCard[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: MemoryCard[] }).data;
  }

  return [];
}

function loadLocalCards(): MemoryCard[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryCard[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCards(cards: MemoryCard[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cards));
  } catch {
    // Ignore persistence failures.
  }
}

function statusColor(status: MemoryCard['status']): 'success' | 'warning' | 'error' {
  if (status === 'available') {
    return 'success';
  }
  if (status === 'in_use') {
    return 'warning';
  }
  return 'error';
}

function accessColor(level: SecuritySettings['accessLevel']): 'success' | 'warning' | 'error' {
  if (level === 'public') {
    return 'success';
  }
  if (level === 'restricted') {
    return 'warning';
  }
  return 'error';
}

function estimateTravelCost(kilometers: number, vehicleType: string): number {
  const perKm = vehicleType === 'van' ? 7.5 : vehicleType === 'electric' ? 3.2 : 5.8;
  const tollEstimate = Math.max(0, kilometers * 0.35);
  return Math.round((kilometers * perKm + tollEstimate) * 100) / 100;
}

export default function MemoryCardManager() {
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MemoryCard | null>(null);
  const [form, setForm] = useState<NewCardForm>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | MemoryCard['status']>('all');

  const [travelDistanceKm, setTravelDistanceKm] = useState(50);
  const [travelVehicleType, setTravelVehicleType] = useState('car');

  const cardsQueryKey = ['/api/memory-cards'];

  const { data: cards = [], isLoading, isError } = useQuery({
    queryKey: cardsQueryKey,
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/memory-cards');
        const parsed = parseCardsResponse(response);
        if (parsed.length > 0) {
          saveLocalCards(parsed);
          return parsed;
        }
      } catch {
        // Local fallback below.
      }

      return loadLocalCards();
    },
  });

  const createCard = useMutation({
    mutationFn: async (newCard: MemoryCard) => {
      try {
        await apiRequest('/api/memory-cards', { method: 'POST', body: newCard });
      } catch {
        // Local fallback handles persistence.
      }

      const next = [newCard, ...cards];
      saveLocalCards(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(cardsQueryKey, next);
      setShowAddDialog(false);
      setForm(EMPTY_FORM);
    },
  });

  const updateSecurity = useMutation({
    mutationFn: async (payload: { cardId: string; securitySettings: SecuritySettings }) => {
      try {
        await apiRequest(`/api/memory-cards/${payload.cardId}/security`, {
          method: 'PUT',
          body: payload.securitySettings,
        });
      } catch {
        // Local fallback handles persistence.
      }

      const next = cards.map((card) =>
        card.id === payload.cardId ? { ...card, securitySettings: payload.securitySettings } : card,
      );
      saveLocalCards(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(cardsQueryKey, next);
      setShowSecurityDialog(false);
      setSelectedCard(null);
      setForm(EMPTY_FORM);
    },
  });

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch =
        card.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || card.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [cards, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: cards.length,
      available: cards.filter((card) => card.status === 'available').length,
      inUse: cards.filter((card) => card.status === 'in_use').length,
      needsAttention: cards.filter((card) => card.status === 'needs_attention').length,
    };
  }, [cards]);

  const travelCost = estimateTravelCost(travelDistanceKm, travelVehicleType);

  const handleSaveCard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.serialNumber || !form.brand) {
      return;
    }

    const payload: MemoryCard = {
      id: `card-${Date.now()}`,
      serialNumber: form.serialNumber,
      brand: form.brand,
      type: form.type,
      capacity: form.capacity,
      speed: form.speed,
      location: form.location,
      notes: form.notes,
      status: form.status,
      securitySettings: form.securitySettings,
    };

    await createCard.mutateAsync(payload);
  };

  const openSecurity = (card: MemoryCard) => {
    setSelectedCard(card);
    setForm({
      serialNumber: card.serialNumber,
      brand: card.brand,
      type: card.type,
      capacity: card.capacity,
      speed: card.speed,
      location: card.location,
      notes: card.notes,
      status: card.status,
      securitySettings: card.securitySettings,
    });
    setShowSecurityDialog(true);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Memory color="primary" />
          Memory Card Manager
        </Typography>
        <Button variant="contained" startIcon={<AddCircle />} onClick={() => setShowAddDialog(true)}>
          Add card
        </Button>
      </Stack>

      {isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          API not available. Showing local memory card data.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined"><CardContent><Typography variant="overline">Total</Typography><Typography variant="h6">{stats.total}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined"><CardContent><Typography variant="overline">Available</Typography><Typography variant="h6">{stats.available}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined"><CardContent><Typography variant="overline">In use</Typography><Typography variant="h6">{stats.inUse}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined"><CardContent><Typography variant="overline">Needs attention</Typography><Typography variant="h6">{stats.needsAttention}</Typography></CardContent></Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              placeholder="Search by serial, brand, type"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as 'all' | MemoryCard['status'])}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="in_use">In use</MenuItem>
              <MenuItem value="needs_attention">Needs attention</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Card variant="outlined">
            <CardContent>
              {isLoading ? (
                <Typography color="text.secondary">Loading cards...</Typography>
              ) : filteredCards.length === 0 ? (
                <Alert severity="info">No memory cards match current filters.</Alert>
              ) : (
                <Stack spacing={1.25}>
                  {filteredCards.map((card) => (
                    <Card key={card.id} variant="outlined" sx={{ bgcolor: 'background.default' }}>
                      <CardContent>
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {card.brand} {card.type} ({card.capacity})
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Serial: {card.serialNumber} • Speed: {card.speed} • Location: {card.location || 'N/A'}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Chip size="small" label={card.status} color={statusColor(card.status)} />
                              <Chip
                                size="small"
                                icon={<Lock fontSize="small" />}
                                label={card.securitySettings.accessLevel}
                                color={accessColor(card.securitySettings.accessLevel)}
                              />
                              {card.securitySettings.encryptionEnabled && (
                                <Chip size="small" icon={<Security fontSize="small" />} label="Encrypted" />
                              )}
                            </Stack>
                          </Box>
                          <Box>
                            <IconButton onClick={() => openSecurity(card)}>
                              <Security fontSize="small" />
                            </IconButton>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage fontSize="small" />
                Travel Cost Estimator
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  type="number"
                  label="Distance (km)"
                  value={travelDistanceKm}
                  onChange={(event) => setTravelDistanceKm(Math.max(0, Number(event.target.value) || 0))}
                  fullWidth
                />
                <TextField
                  select
                  label="Vehicle type"
                  value={travelVehicleType}
                  onChange={(event) => setTravelVehicleType(event.target.value)}
                  fullWidth
                >
                  <MenuItem value="car">Car</MenuItem>
                  <MenuItem value="van">Van</MenuItem>
                  <MenuItem value="electric">Electric</MenuItem>
                </TextField>
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  Estimated total (fuel + toll):
                </Typography>
                <Typography variant="h6">{travelCost.toFixed(2)} NOK</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveCard}>
          <DialogTitle>Add Memory Card</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <TextField label="Serial number" value={form.serialNumber} onChange={(event) => setForm((prev) => ({ ...prev, serialNumber: event.target.value }))} fullWidth required />
              <TextField label="Brand" value={form.brand} onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))} fullWidth required />
              <TextField label="Type" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} fullWidth />
              <TextField label="Capacity" value={form.capacity} onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))} fullWidth />
              <TextField label="Speed" value={form.speed} onChange={(event) => setForm((prev) => ({ ...prev, speed: event.target.value }))} fullWidth />
              <TextField label="Location" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} fullWidth />
              <TextField label="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} fullWidth multiline minRows={3} />
              <TextField
                select
                label="Status"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as MemoryCard['status'] }))}
                fullWidth
              >
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="in_use">In use</MenuItem>
                <MenuItem value="needs_attention">Needs attention</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createCard.isPending}>
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={showSecurityDialog} onClose={() => setShowSecurityDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Security Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Access level"
              value={form.securitySettings.accessLevel}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  securitySettings: {
                    ...prev.securitySettings,
                    accessLevel: event.target.value as SecuritySettings['accessLevel'],
                  },
                }))
              }
              fullWidth
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="restricted">Restricted</MenuItem>
              <MenuItem value="private">Private</MenuItem>
            </TextField>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography>Require PIN</Typography>
              <Switch
                checked={form.securitySettings.pinRequired}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    securitySettings: {
                      ...prev.securitySettings,
                      pinRequired: event.target.checked,
                    },
                  }))
                }
              />
            </Stack>
            {form.securitySettings.pinRequired && (
              <TextField
                label="PIN"
                value={form.securitySettings.pin ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    securitySettings: {
                      ...prev.securitySettings,
                      pin: event.target.value,
                    },
                  }))
                }
                fullWidth
              />
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography>Require password</Typography>
              <Switch
                checked={form.securitySettings.passwordRequired}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    securitySettings: {
                      ...prev.securitySettings,
                      passwordRequired: event.target.checked,
                    },
                  }))
                }
              />
            </Stack>
            {form.securitySettings.passwordRequired && (
              <TextField
                label="Password"
                value={form.securitySettings.password ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    securitySettings: {
                      ...prev.securitySettings,
                      password: event.target.value,
                    },
                  }))
                }
                fullWidth
              />
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography>Enable encryption</Typography>
              <Switch
                checked={form.securitySettings.encryptionEnabled}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    securitySettings: {
                      ...prev.securitySettings,
                      encryptionEnabled: event.target.checked,
                    },
                  }))
                }
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSecurityDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedCard || updateSecurity.isPending}
            onClick={() => {
              if (!selectedCard) {
                return;
              }

              updateSecurity.mutate({
                cardId: selectedCard.id,
                securitySettings: form.securitySettings,
              });
            }}
          >
            Save security
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
