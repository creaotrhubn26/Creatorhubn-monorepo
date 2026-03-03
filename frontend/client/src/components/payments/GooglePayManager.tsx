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
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudOff as CloudOffIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Payment as PaymentIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';

export type GooglePayCategory = 'feature' | 'subscription' | 'addon' | 'service';

export interface GooglePayProduct {
  id: string;
  name: string;
  description: string;
  priceNok: number;
  category: GooglePayCategory;
  recurring: boolean;
  billingPeriod?: 'monthly' | 'yearly';
  features: string[];
  isActive: boolean;
  googlePayProductId?: string;
  createdAt: string;
  updatedAt: string;
}

interface GooglePayManagerProps {
  onClose?: () => void;
}

interface ProductDraft {
  name: string;
  description: string;
  priceNok: number;
  category: GooglePayCategory;
  recurring: boolean;
  billingPeriod: 'monthly' | 'yearly';
  featuresText: string;
  isActive: boolean;
}

const CATEGORY_LABELS: Record<GooglePayCategory, string> = {
  feature: 'Feature',
  subscription: 'Abonnement',
  addon: 'Tillegg',
  service: 'Tjeneste',
};

function emptyDraft(): ProductDraft {
  return {
    name: '',
    description: '',
    priceNok: 0,
    category: 'feature',
    recurring: false,
    billingPeriod: 'monthly',
    featuresText: '',
    isActive: true,
  };
}

const seedProducts: GooglePayProduct[] = [
  {
    id: 'subscription-basic',
    name: 'Basic Plan',
    description: 'Grunnpakke for enkelt produksjonsarbeid.',
    priceNok: 299,
    category: 'subscription',
    recurring: true,
    billingPeriod: 'monthly',
    features: ['10 prosjekter', 'Google Drive sync', 'Basis support'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'feature-auto-captions',
    name: 'Auto Captions+',
    description: 'Automatisk teksting med norsk/engelsk støtte.',
    priceNok: 149,
    category: 'feature',
    recurring: true,
    billingPeriod: 'monthly',
    features: ['Norsk transkripsjon', 'Tidskode eksport', 'SRT/VTT'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function GooglePayManager({ onClose }: GooglePayManagerProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<GooglePayProduct[]>(seedProducts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft());
  const [isSyncing, setIsSyncing] = useState(false);
  const [workloadIdentityReady, setWorkloadIdentityReady] = useState(false);

  const activeCount = useMemo(() => products.filter((product) => product.isActive).length, [products]);

  const openCreateDialog = () => {
    setEditingProductId(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  };

  const openEditDialog = (product: GooglePayProduct) => {
    setEditingProductId(product.id);
    setDraft({
      name: product.name,
      description: product.description,
      priceNok: product.priceNok,
      category: product.category,
      recurring: product.recurring,
      billingPeriod: product.billingPeriod ?? 'monthly',
      featuresText: product.features.join(', '),
      isActive: product.isActive,
    });
    setDialogOpen(true);
  };

  const saveProduct = () => {
    if (!draft.name.trim()) {
      toast({ title: 'Mangler navn', description: 'Produktnavn er paakrevd.', variant: 'warning' });
      return;
    }

    if (draft.priceNok <= 0) {
      toast({ title: 'Ugyldig pris', description: 'Pris maa vaere stoerre enn 0.', variant: 'warning' });
      return;
    }

    const now = new Date().toISOString();
    const features = draft.featuresText
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const nextProduct: GooglePayProduct = {
      id: editingProductId ?? `product-${Date.now()}`,
      name: draft.name.trim(),
      description: draft.description.trim(),
      priceNok: draft.priceNok,
      category: draft.category,
      recurring: draft.recurring,
      billingPeriod: draft.recurring ? draft.billingPeriod : undefined,
      features,
      isActive: draft.isActive,
      createdAt:
        products.find((product) => product.id === editingProductId)?.createdAt ??
        now,
      updatedAt: now,
    };

    setProducts((previous) => {
      if (!editingProductId) {
        return [nextProduct, ...previous];
      }

      return previous.map((product) => (product.id === editingProductId ? nextProduct : product));
    });

    toast({
      title: editingProductId ? 'Produkt oppdatert' : 'Produkt opprettet',
      description: `${nextProduct.name} er lagret i katalogen.`,
      variant: 'success',
    });

    setDialogOpen(false);
  };

  const removeProduct = (productId: string) => {
    const product = products.find((entry) => entry.id === productId);
    setProducts((previous) => previous.filter((entry) => entry.id !== productId));
    if (product) {
      toast({ title: 'Produkt slettet', description: `${product.name} ble fjernet.`, variant: 'info' });
    }
  };

  const toggleActive = (productId: string) => {
    setProducts((previous) =>
      previous.map((product) =>
        product.id === productId
          ? {
              ...product,
              isActive: !product.isActive,
              updatedAt: new Date().toISOString(),
            }
          : product,
      ),
    );
  };

  const syncWithGooglePay = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/google-pay/sync-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products }),
      });

      if (!response.ok) {
        throw new Error(`Sync feilet (${response.status})`);
      }

      const payload = (await response.json()) as { workloadIdentityReady?: boolean; syncedProducts?: number };
      setWorkloadIdentityReady(payload.workloadIdentityReady === true);
      toast({
        title: 'Synkronisert',
        description: `${payload.syncedProducts ?? products.length} produkter synkronisert mot Google Pay.`,
        variant: 'success',
      });
    } catch (error) {
      setWorkloadIdentityReady(false);
      toast({
        title: 'Sync utilgjengelig',
        description: error instanceof Error ? error.message : 'Ukjent feil under synkronisering.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Google Pay produktstyring</Typography>
          <Typography variant="body2" color="text.secondary">
            {activeCount} aktive av {products.length} produkter
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onClose}>
            Lukk
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Nytt produkt
          </Button>
        </Stack>
      </Stack>

      {!workloadIdentityReady && (
        <Alert severity="warning" icon={<CloudOffIcon />} sx={{ mb: 2 }}>
          Workload Identity er ikke verifisert i denne sesjonen. Synk kan fortsatt testes, men kan feile ved backend-policy.
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Katalog</Typography>
            <Button variant="outlined" startIcon={<SyncIcon />} onClick={syncWithGooglePay} disabled={isSyncing}>
              {isSyncing ? 'Synkroniserer...' : 'Synk med Google Pay'}
            </Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <List>
            {products.map((product) => (
              <ListItem
                key={product.id}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <FormControlLabel
                      control={<Switch checked={product.isActive} onChange={() => toggleActive(product.id)} />}
                      label="Aktiv"
                    />
                    <IconButton onClick={() => openEditDialog(product)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" onClick={() => removeProduct(product.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                }
                disableGutters
                sx={{ py: 1.25 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{product.name}</Typography>
                      <Chip size="small" label={CATEGORY_LABELS[product.category]} />
                      {product.recurring && <Chip size="small" color="primary" label={product.billingPeriod === 'yearly' ? 'Aarlig' : 'Maanedlig'} />}
                    </Stack>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {product.description}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip size="small" icon={<PaymentIcon />} label={`${product.priceNok} NOK`} />
                        {product.features.map((feature) => (
                          <Chip key={`${product.id}-${feature}`} size="small" variant="outlined" label={feature} />
                        ))}
                      </Stack>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingProductId ? 'Rediger produkt' : 'Opprett produkt'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Navn"
              value={draft.name}
              onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
            />
            <TextField
              label="Beskrivelse"
              multiline
              minRows={2}
              value={draft.description}
              onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Pris NOK"
                  type="number"
                  fullWidth
                  value={draft.priceNok}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      priceNok: Number.isFinite(Number(event.target.value)) ? Number(event.target.value) : 0,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    label="Kategori"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        category: event.target.value as GooglePayCategory,
                      }))
                    }
                  >
                    <MenuItem value="feature">Feature</MenuItem>
                    <MenuItem value="subscription">Abonnement</MenuItem>
                    <MenuItem value="addon">Tillegg</MenuItem>
                    <MenuItem value="service">Tjeneste</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.recurring}
                    onChange={(event) => setDraft((previous) => ({ ...previous, recurring: event.target.checked }))}
                  />
                }
                label="Gjentakende betaling"
              />

              {draft.recurring && (
                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel>Fakturering</InputLabel>
                  <Select
                    label="Fakturering"
                    value={draft.billingPeriod}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        billingPeriod: event.target.value as 'monthly' | 'yearly',
                      }))
                    }
                  >
                    <MenuItem value="monthly">Maanedlig</MenuItem>
                    <MenuItem value="yearly">Aarlig</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>

            <TextField
              label="Features (kommaseparert)"
              value={draft.featuresText}
              onChange={(event) => setDraft((previous) => ({ ...previous, featuresText: event.target.value }))}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={draft.isActive}
                  onChange={(event) => setDraft((previous) => ({ ...previous, isActive: event.target.checked }))}
                />
              }
              label="Produkt aktivt"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={saveProduct}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GooglePayManager;
