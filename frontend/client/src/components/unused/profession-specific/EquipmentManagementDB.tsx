import React, { useMemo, useState } from 'react';
import { useTheming } from '../../../utils/theming-helper';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  Build,
  LibraryMusic,
  PhotoCamera,
  Store,
  Videocam,
} from '@mui/icons-material';

interface EquipmentManagementDBProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
}

interface EquipmentItem {
  id: string | number;
  brand: string;
  model: string;
  category?: string | null;
  status?: string | null;
}

const professionConfig = {
  photographer: {
    name: 'Fotoutstyr',
    icon: PhotoCamera,
    color: '#ff8c00',
    defaultCategory: 'camera',
  },
  videographer: {
    name: 'Videoutstyr',
    icon: Videocam,
    color: '#e74c30',
    defaultCategory: 'camera',
  },
  musicproducer: {
    name: 'Studioutstyr',
    icon: LibraryMusic,
    color: '#9b59b0',
    defaultCategory: 'audio',
  },
  vendor: {
    name: 'Lagerutstyr',
    icon: Store,
    color: '#27ae60',
    defaultCategory: 'accessory',
  },
} as const;

const CATEGORY_OPTIONS = [
  'camera',
  'lens',
  'audio',
  'lighting',
  'accessory',
  'memory',
  'tripod',
  'slider',
  'flash',
  'software',
] as const;

type EquipmentCategory = (typeof CATEGORY_OPTIONS)[number];

const STATUS_OPTIONS = ['Tilgjengelig', 'I bruk', 'Utleid', 'Ledig', 'Vedlikehold'];

export default function EquipmentManagementDB({
  profession = 'photographer',
}: EquipmentManagementDBProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const theming = useTheming(profession);
  const config = professionConfig[profession];

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState<{
    brand: string;
    model: string;
    category: EquipmentCategory;
    status: string;
  }>({
    brand: '',
    model: '',
    category: config.defaultCategory,
    status: 'Tilgjengelig',
  });

  const { data: equipment = [], isLoading } = useQuery<EquipmentItem[]>({
    queryKey: ['/api/equipment', profession, userId],
    queryFn: async () =>
      (await apiRequest(
        `/api/equipment?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId ?? '')}`
      )) as EquipmentItem[],
    enabled: Boolean(userId),
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async () =>
      apiRequest('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          profession,
          brand: newEquipment.brand,
          model: newEquipment.model,
          category: newEquipment.category,
          status: newEquipment.status,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment', profession, userId] });
      setAddDialogOpen(false);
      setNewEquipment({
        brand: '',
        model: '',
        category: config.defaultCategory,
        status: 'Tilgjengelig',
      });
    },
  });

  const stats = useMemo(() => {
    const total = equipment.length;
    const available = equipment.filter((item) =>
      ['Tilgjengelig', 'Ledig'].includes(item.status ?? '')
    ).length;
    const inUse = equipment.filter((item) =>
      ['I bruk', 'Utleid'].includes(item.status ?? '')
    ).length;
    return { total, available, inUse };
  }, [equipment]);

  const Icon = config.icon;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Icon sx={{ color: config.color, fontSize: 32 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: config.color }}>
          {config.name}
        </Typography>
        <Button
          variant="contained"
          startIcon={theming.getThemedIcon('build')}
          sx={{ ml: 'auto', bgcolor: config.color, '&:hover': { bgcolor: `${config.color}dd` } }}
          onClick={() => setAddDialogOpen(true)}
        >
          Legg til utstyr
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <MuiCard>
            <MuiCardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Utstyrsliste
              </Typography>
              <List>
                {equipment.map((item) => (
                  <ListItem key={item.id} divider>
                    <ListItemIcon>
                      <Build sx={{ color: config.color }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${item.brand} ${item.model}`}
                      secondary={`Type: ${item.category ?? 'Ukjent'}`}
                    />
                    <Chip
                      label={item.status ?? 'Ukjent'}
                      color={
                        ['Tilgjengelig', 'Ledig'].includes(item.status ?? '')
                          ? 'success'
                          : ['I bruk', 'Utleid'].includes(item.status ?? '')
                            ? 'warning'
                            : 'default'
                      }
                      size="small"
                    />
                  </ListItem>
                ))}
                {!isLoading && equipment.length === 0 && (
                  <ListItem>
                    <ListItemText primary="Ingen utstyr registrert ennå." />
                  </ListItem>
                )}
              </List>
            </MuiCardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <MuiCard>
            <MuiCardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Utstyrsstatistikk
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="h4" sx={{ color: config.color }}>
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totalt utstyr
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {stats.available}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tilgjengelig
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {stats.inUse}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    I bruk
                  </Typography>
                </Box>
              </Box>
            </MuiCardContent>
          </MuiCard>
        </Grid>
      </Grid>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Legg til utstyr</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Merke"
              value={newEquipment.brand}
              onChange={(event) =>
                setNewEquipment((prev) => ({ ...prev, brand: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Modell"
              value={newEquipment.model}
              onChange={(event) =>
                setNewEquipment((prev) => ({ ...prev, model: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Kategori"
              value={newEquipment.category}
              onChange={(event) =>
                setNewEquipment((prev) => {
                  const nextCategory = CATEGORY_OPTIONS.find(
                    (value) => value === event.target.value
                  );
                  return {
                    ...prev,
                    category: nextCategory ?? prev.category,
                  };
                })
              }
              select
              fullWidth
            >
              <MenuItem value="camera">Kamera</MenuItem>
              <MenuItem value="lens">Objektiv</MenuItem>
              <MenuItem value="audio">Audio</MenuItem>
              <MenuItem value="lighting">Lys</MenuItem>
              <MenuItem value="accessory">Tilbehør</MenuItem>
              <MenuItem value="memory">Minne</MenuItem>
              <MenuItem value="tripod">Stativ</MenuItem>
              <MenuItem value="slider">Slider</MenuItem>
              <MenuItem value="flash">Blitz</MenuItem>
              <MenuItem value="software">Programvare</MenuItem>
            </TextField>
            <TextField
              label="Status"
              value={newEquipment.status}
              onChange={(event) =>
                setNewEquipment((prev) => ({ ...prev, status: event.target.value }))
              }
              select
              fullWidth
            >
              {STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => addEquipmentMutation.mutate()}
            disabled={
              addEquipmentMutation.isPending ||
              !newEquipment.brand.trim() ||
              !newEquipment.model.trim()
            }
          >
            {addEquipmentMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
