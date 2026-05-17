// Slice 9X.19 — utstyrs-tracking for fotograf.
// Picker fra kuratert katalog (Canon R5, Sony A7 IV, Nikon Z8, etc),
// auto-prefylt med bilde, firmware-link, default garanti-måneder.
// Beregner remaining warranty + reklamasjonstid per utstyr.
//
// Garanti = produsentens/forhandlerens frivillige forpliktelse.
// Reklamasjon = lovpålagt forbruker-rett (Forbrukerkjøpsloven §27).

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, TextField, IconButton, Chip,
  CircularProgress, Alert, LinearProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid2, MenuItem, Select, FormControl, InputLabel, Snackbar,
  Tooltip, Tabs, Tab, InputAdornment, Autocomplete, Card, CardMedia,
  CardContent, CardActions, Divider,
} from '@mui/material';
import {
  ArrowBack, CameraAlt, Add, Search, OpenInNew, Edit, Delete,
  Info, CheckCircle, Warning, Shield, Gavel,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface CatalogEntry {
  id: string;
  brand: string;
  model: string;
  category: string;
  releasedYear: number | null;
  msrpNok: number | null;
  warrantyMonths: number;
  reklamasjonMonths: number;
  imageUrl: string;
  firmwareUrl: string | null;
}

interface Equipment {
  id: number;
  category: string | null;
  brand: string;
  model: string;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  condition: string | null;
  catalogId: string | null;
  imageUrl: string | null;
  firmwareUrl: string | null;
  firmwareVersion: string | null;
  latestFirmwareVersion: string | null;
  warrantyMonths: number | null;
  reklamasjonMonths: number | null;
  warranty: { endDate: string | null; daysRemaining: number | null; pctElapsed: number | null; expired: boolean };
  reklamasjon: { endDate: string | null; daysRemaining: number | null; pctElapsed: number | null; expired: boolean };
  retailer: string | null;
  receiptUrl: string | null;
  notes: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDaysRemaining(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `Utløpt for ${Math.abs(days)} dager siden`;
  if (days === 0) return 'Utløper i dag';
  if (days < 30) return `${days} dager igjen`;
  if (days < 365) return `${Math.round(days / 30)} mnd igjen`;
  return `${(days / 365).toFixed(1)} år igjen`;
}

function categoryLabel(c: string | null): string {
  switch (c) {
    case 'camera_body': return 'Kamera';
    case 'lens': return 'Objektiv';
    case 'flash': return 'Blitz';
    case 'tripod': return 'Stativ';
    case 'lighting': return 'Lys';
    case 'audio': return 'Lyd';
    case 'computer': return 'Datamaskin';
    case 'storage': return 'Lagring';
    default: return c ?? 'Annet';
  }
}

export default function PhotographerEquipment() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogEntry | null>(null);
  const [addDraft, setAddDraft] = useState({
    purchaseDate: '',
    purchasePrice: '',
    serialNumber: '',
    retailer: '',
  });
  const [definitionsOpen, setDefinitionsOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const { data, isLoading } = useQuery<{ equipment: Equipment[] }>({
    queryKey: ['/api/photographer/equipment'],
    queryFn: () => apiRequest('/api/photographer/equipment'),
  });

  const { data: catalogData } = useQuery<{ catalog: CatalogEntry[] }>({
    queryKey: ['/api/photographer/equipment/catalog'],
    queryFn: () => apiRequest('/api/photographer/equipment/catalog'),
    enabled: addOpen,
  });

  const createEquipment = useMutation<{ id: number }, Error, void>({
    mutationFn: () => {
      if (!selectedCatalog) throw new Error('Velg en modell fra katalogen først');
      return apiRequest('/api/photographer/equipment', {
        method: 'POST',
        body: JSON.stringify({
          catalogId: selectedCatalog.id,
          purchaseDate: addDraft.purchaseDate || null,
          purchasePrice: addDraft.purchasePrice ? Number(addDraft.purchasePrice) : null,
          serialNumber: addDraft.serialNumber || null,
          retailer: addDraft.retailer || null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/photographer/equipment'] });
      setAddOpen(false);
      setSelectedCatalog(null);
      setAddDraft({ purchaseDate: '', purchasePrice: '', serialNumber: '', retailer: '' });
      setSnackbar({ msg: 'Utstyr lagt til', severity: 'success' });
    },
  });

  const deleteEquipment = useMutation<unknown, Error, number>({
    mutationFn: (id) => apiRequest(`/api/photographer/equipment/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/photographer/equipment'] });
      setSnackbar({ msg: 'Utstyr slettet', severity: 'info' });
    },
  });

  const equipment = data?.equipment ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return equipment;
    const q = search.toLowerCase();
    return equipment.filter((e) =>
      `${e.brand} ${e.model} ${e.serialNumber ?? ''}`.toLowerCase().includes(q),
    );
  }, [equipment, search]);

  const totalValue = useMemo(() =>
    equipment.reduce((sum, e) => sum + (e.currentValue ?? e.purchasePrice ?? 0), 0),
    [equipment]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/dashboard')}>
          <ArrowBack />
        </IconButton>
        <CameraAlt color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">Utstyr</Typography>
          <Typography variant="caption" color="text.secondary">
            Garantier, reklamasjonsrett, firmware og vedlikehold
          </Typography>
        </Box>
        <Button startIcon={<Info />} onClick={() => setDefinitionsOpen(true)}>
          Garanti vs reklamasjon
        </Button>
        <Button startIcon={<Add />} variant="contained" onClick={() => setAddOpen(true)}>
          Legg til utstyr
        </Button>
      </Stack>

      {/* Totals */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Total utstyrs-verdi</Typography>
          <Typography variant="h5">{totalValue.toLocaleString('nb-NO')} kr</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Antall</Typography>
          <Typography variant="h5">{equipment.length}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="caption" color="text.secondary">Garanti utløper snart</Typography>
          <Typography variant="h5" color="warning.main">
            {equipment.filter((e) => e.warranty.daysRemaining !== null
              && e.warranty.daysRemaining > 0 && e.warranty.daysRemaining < 90).length}
          </Typography>
        </Paper>
      </Stack>

      <TextField
        fullWidth size="small" sx={{ mb: 3 }}
        placeholder="Søk merke, modell eller serienummer"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
        }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info">
          {search.trim()
            ? 'Ingen treff.'
            : 'Ingen utstyr lagt til ennå. Klikk "Legg til utstyr" for å starte.'}
        </Alert>
      ) : (
        <Grid2 container spacing={2}>
          {filtered.map((e) => {
            const warrantyColor = e.warranty.expired ? 'error'
              : (e.warranty.daysRemaining !== null && e.warranty.daysRemaining < 90) ? 'warning'
              : 'success';
            const reklamasjonColor = e.reklamasjon.expired ? 'error'
              : (e.reklamasjon.daysRemaining !== null && e.reklamasjon.daysRemaining < 180) ? 'warning'
              : 'success';
            return (
              <Grid2 key={e.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {e.imageUrl ? (
                    <CardMedia
                      component="img"
                      sx={{ height: 160, objectFit: 'contain', bgcolor: 'grey.100', p: 1 }}
                      image={e.imageUrl}
                      alt={`${e.brand} ${e.model}`}
                      onError={(ev) => {
                        (ev.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Box sx={{
                      height: 160, bgcolor: 'grey.100',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CameraAlt sx={{ fontSize: 64, color: 'action.disabled' }} />
                    </Box>
                  )}

                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {categoryLabel(e.category)} · {e.brand}
                        </Typography>
                        <Typography variant="h6" sx={{ lineHeight: 1.2, mt: 0.5 }}>
                          {e.model}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack spacing={1} sx={{ mt: 2 }}>
                      <Box>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Shield sx={{ fontSize: 14 }} /> Garanti
                          </Typography>
                          <Typography variant="caption" color={`${warrantyColor}.main`} fontWeight={500}>
                            {formatDaysRemaining(e.warranty.daysRemaining)}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={e.warranty.pctElapsed ?? 0}
                          color={warrantyColor}
                          sx={{ height: 4, borderRadius: 1 }}
                        />
                        {e.warranty.endDate && (
                          <Typography variant="caption" color="text.secondary">
                            Til {formatDate(e.warranty.endDate)} ({e.warrantyMonths} mnd)
                          </Typography>
                        )}
                      </Box>

                      <Box>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Gavel sx={{ fontSize: 14 }} /> Reklamasjon
                          </Typography>
                          <Typography variant="caption" color={`${reklamasjonColor}.main`} fontWeight={500}>
                            {formatDaysRemaining(e.reklamasjon.daysRemaining)}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={e.reklamasjon.pctElapsed ?? 0}
                          color={reklamasjonColor}
                          sx={{ height: 4, borderRadius: 1 }}
                        />
                        {e.reklamasjon.endDate && (
                          <Typography variant="caption" color="text.secondary">
                            Til {formatDate(e.reklamasjon.endDate)} ({e.reklamasjonMonths} mnd)
                          </Typography>
                        )}
                      </Box>
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    <Stack spacing={0.5}>
                      {e.purchaseDate && (
                        <Typography variant="caption" color="text.secondary">
                          Kjøpt {formatDate(e.purchaseDate)}
                          {e.purchasePrice && ` for ${e.purchasePrice.toLocaleString('nb-NO')} kr`}
                        </Typography>
                      )}
                      {e.retailer && (
                        <Typography variant="caption" color="text.secondary">
                          Fra: {e.retailer}
                        </Typography>
                      )}
                      {e.serialNumber && (
                        <Typography variant="caption" color="text.secondary"
                          sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                          S/N: {e.serialNumber}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', p: 1.5 }}>
                    {e.firmwareUrl && (
                      <Button
                        size="small"
                        startIcon={<OpenInNew />}
                        onClick={() => window.open(e.firmwareUrl!, '_blank')}
                      >
                        Firmware
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (confirm(`Slett ${e.brand} ${e.model}?`)) {
                          deleteEquipment.mutate(e.id);
                        }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid2>
            );
          })}
        </Grid2>
      )}

      {/* Add equipment dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Legg til utstyr</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={catalogData?.catalog ?? []}
              value={selectedCatalog}
              onChange={(_, v) => setSelectedCatalog(v)}
              getOptionLabel={(o) => `${o.brand} ${o.model}`}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              groupBy={(o) => categoryLabel(o.category)}
              renderInput={(params) => (
                <TextField {...params}
                  label="Søk og velg modell fra katalog"
                  placeholder="f.eks. Canon R5"
                  size="small"
                  autoFocus
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                    <Box
                      component="img"
                      src={option.imageUrl}
                      alt=""
                      sx={{ width: 40, height: 32, objectFit: 'contain', flexShrink: 0 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">{option.brand} {option.model}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.releasedYear ?? ''} · {option.msrpNok?.toLocaleString('nb-NO') ?? '?'} kr MSRP
                      </Typography>
                    </Box>
                    <Chip size="small" label={`${option.warrantyMonths}m garanti`} variant="outlined"
                      sx={{ height: 18, fontSize: 11 }} />
                  </Stack>
                </li>
              )}
            />

            {selectedCatalog && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    component="img"
                    src={selectedCatalog.imageUrl}
                    alt=""
                    sx={{ width: 80, height: 60, objectFit: 'contain', flexShrink: 0 }}
                  />
                  <Box>
                    <Typography variant="subtitle1">{selectedCatalog.brand} {selectedCatalog.model}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Default {selectedCatalog.warrantyMonths} mnd garanti ·
                      {' '}{selectedCatalog.reklamasjonMonths} mnd reklamasjonsrett
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            <Stack direction="row" spacing={2}>
              <TextField
                label="Kjøpsdato" size="small" type="date" fullWidth required
                InputLabelProps={{ shrink: true }}
                value={addDraft.purchaseDate}
                onChange={(e) => setAddDraft((s) => ({ ...s, purchaseDate: e.target.value }))}
              />
              <TextField
                label="Pris (NOK)" size="small" type="number" fullWidth
                value={addDraft.purchasePrice}
                onChange={(e) => setAddDraft((s) => ({ ...s, purchasePrice: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Forhandler (viktig for reklamasjon)"
              size="small" fullWidth
              placeholder="F.eks. Foto Video Bredo, Eplehuset, CEWE"
              value={addDraft.retailer}
              onChange={(e) => setAddDraft((s) => ({ ...s, retailer: e.target.value }))}
            />
            <TextField
              label="Serienummer (valgfritt)"
              size="small" fullWidth
              value={addDraft.serialNumber}
              onChange={(e) => setAddDraft((s) => ({ ...s, serialNumber: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!selectedCatalog || createEquipment.isPending}
            onClick={() => createEquipment.mutate()}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Definitions dialog */}
      <Dialog open={definitionsOpen} onClose={() => setDefinitionsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Info color="primary" /> Garanti vs reklamasjonsrett i Norge
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Shield color="primary" />
                <Typography variant="h6">Garanti</Typography>
              </Stack>
              <Typography variant="body2" paragraph>
                <strong>Frivillig forpliktelse</strong> fra produsent eller forhandler.
                Den varierer per produkt og merke — Canon/Sony/Nikon gir typisk 2 år EU-garanti
                på speilløse kameraer, men billigere blitser kan ha kun 12 mnd.
              </Typography>
              <Typography variant="body2">
                Garanti <strong>kan ikke redusere</strong> lovpålagte forbruker-rettigheter.
                Den kan bare gi deg MER rettigheter (f.eks. raskere reparasjon, dekning av
                feil som ikke kvalifiserer som "mangel" under reklamasjonsretten).
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Gavel color="primary" />
                <Typography variant="h6">Reklamasjonsrett</Typography>
              </Stack>
              <Typography variant="body2" paragraph>
                <strong>Lovpålagt</strong> under <em>Forbrukerkjøpsloven §27</em>.
                Du har rett til å reklamere på <strong>mangler</strong> ved produktet i:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 1 }}>
                <li>
                  <Typography variant="body2"><strong>2 år</strong> — standard for de fleste varer</Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>5 år</strong> — for varer som er ment å vare <em>vesentlig lengre enn 2 år</em>.
                    Profesjonelle kameraer (50k+ NOK) regnes typisk hit. Også høyverdi-objektiver, dyre stativer.
                  </Typography>
                </li>
              </Box>
              <Typography variant="body2" paragraph sx={{ mt: 1 }}>
                <strong>Krav fremmes mot forhandleren</strong> der du kjøpte det, ikke produsenten.
                Derfor er det viktig å registrere forhandler-navn i utstyrs-loggen.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Reklamasjon dekker mangler som forelå ved kjøp, ikke slitasje eller brukerfeil.
                Ved tvist: kontakt Forbrukertilsynet (forbrukertilsynet.no).
              </Typography>
            </Paper>

            <Alert severity="info">
              <strong>Tips:</strong> Last opp kvittering som <em>receipt_url</em> så du har bevis
              hvis du senere må reklamere. Norsk lov krever ikke at du har originalkvittering,
              men det gjør prosessen mye enklere.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDefinitionsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4500}
        onClose={() => setSnackbar(null)}
      >
        <Alert
          severity={snackbar?.severity ?? 'info'}
          onClose={() => setSnackbar(null)}
          sx={{ width: '100%' }}
        >
          {snackbar?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
