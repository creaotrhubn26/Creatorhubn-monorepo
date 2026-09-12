/**
 * MarketingCatalogTab.tsx
 *
 * Business DNA — Catalog. Auto-populeres fra systemets vertikaler (backend
 * seeder ved GET), og admin kan legge til / fjerne / skru av produkter kampanjene
 * kan trekke fra. Bruker marketingCatalogApi (adminRoomApi, Bearer-auth).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { marketingCatalogApi, type CatalogItem } from '../../../services/adminRoomApi';

const SOURCE_LABEL: Record<string, string> = {
  system_vertical: 'Vertikal',
  custom: 'Egendefinert',
  url_import: 'Fra URL',
};

export function MarketingCatalogTab() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await marketingCatalogApi.list());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (item: CatalogItem) => {
    setBusy(`toggle-${item.id}`);
    // Optimistisk
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)));
    try {
      await marketingCatalogApi.update(item.id, { active: !item.active });
    } catch (err) {
      setError((err as Error).message);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy('add');
    try {
      await marketingCatalogApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      setAddOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(`delete-${id}`);
    try {
      await marketingCatalogApi.remove(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const activeCount = items.filter((i) => i.active).length;

  return (
    <Box sx={{ p: 3, maxWidth: 940, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Katalog
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Produktene og vertikalene kampanjene dine kan trekke fra. Auto-oppdaget fra systemet —
            legg til eller fjern når som helst. {items.length > 0 && `(${activeCount}/${items.length} aktive)`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => setAddOpen(true)}>
          Legg til produkt
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Card key={item.id} variant="outlined" sx={{ opacity: item.active ? 1 : 0.55 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  {item.imageUrl && (
                    <Box
                      component="img"
                      src={item.imageUrl}
                      alt=""
                      sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }}
                    />
                  )}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{item.name}</Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={item.source === 'system_vertical' ? 'primary' : 'default'}
                        label={SOURCE_LABEL[item.source] ?? item.source}
                      />
                    </Stack>
                    {item.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title={item.active ? 'Aktiv i kampanjer' : 'Skjult fra kampanjer'}>
                    <Switch
                      size="small"
                      checked={item.active}
                      disabled={busy === `toggle-${item.id}`}
                      onChange={() => toggleActive(item)}
                    />
                  </Tooltip>
                  <Tooltip title="Fjern fra katalog">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={busy === `delete-${item.id}`}
                        onClick={() => handleDelete(item.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Legg til produkt i katalogen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Beskrivelse (valgfritt)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Avbryt</Button>
          <Button variant="contained" disabled={!name.trim() || busy === 'add'} onClick={handleAdd}>
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MarketingCatalogTab;
