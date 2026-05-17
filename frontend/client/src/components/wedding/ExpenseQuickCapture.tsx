// @ts-nocheck
/**
 * ExpenseQuickCapture — Slice 9X.40
 *
 * FAB + dialog for hurtigregistrering av utlegg på bryllupsdagen.
 * Mobile-first: ta foto av kvittering, fyll inn beløp + kategori, lagre.
 * Auto-knyttet til bryllup-prosjektet.
 */

import React, { useEffect, useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  MenuItem,
  Box,
  Chip,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  PhotoCamera as CameraIcon,
  Delete as DeleteIcon,
  LocalParking as ParkingIcon,
  Restaurant as MealIcon,
  CardGiftcard as GiftIcon,
  Inventory as SuppliesIcon,
  LocalGasStation as FuelIcon,
  Toll as TollIcon,
  MoreHoriz as OtherIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const CATEGORIES = [
  { value: 'parking', label: 'Parkering', icon: <ParkingIcon /> },
  { value: 'meal', label: 'Mat / lunsj', icon: <MealIcon /> },
  { value: 'gift', label: 'Gave / blomster', icon: <GiftIcon /> },
  { value: 'supplies', label: 'Utstyr / forsyninger', icon: <SuppliesIcon /> },
  { value: 'fuel', label: 'Drivstoff', icon: <FuelIcon /> },
  { value: 'toll', label: 'Bom', icon: <TollIcon /> },
  { value: 'other', label: 'Annet', icon: <OtherIcon /> },
];

interface Expense {
  id: string;
  expenseCategory: string;
  description: string;
  amount: number;
  receiptPhotoUrl: string | null;
  isBillable: boolean;
  isReimbursable: boolean;
  createdAt: string;
}

interface ExpenseQuickCaptureProps {
  weddingId: string;
}

const ExpenseQuickCapture: React.FC<ExpenseQuickCaptureProps> = ({ weddingId }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Skjema-state
  const [category, setCategory] = useState('parking');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/expenses`);
      setList(r.expenses || []);
      setTotal(r.totalKr || 0);
    } catch (e) {
      // Stille ignore — tomt OK
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [weddingId]);

  const reset = () => {
    setCategory('parking');
    setAmount('');
    setDescription('');
    setIsBillable(true);
    setReceiptDataUrl(null);
    setError(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For MVP: lagre som data: URL i receipt_photo_url. Asset-upload-pipeline kan
    // komme i en senere slice (capture-routes har eksisterende S3-multipart-flyt).
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Skriv inn et beløp');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/expenses`, {
        method: 'POST',
        body: {
          expenseCategory: category,
          amount: amt,
          description: description.trim() || CATEGORIES.find((c) => c.value === category)?.label,
          isBillable,
          isReimbursable: !isBillable,
          receiptPhotoUrl: receiptDataUrl,
        },
      });
      reset();
      setOpen(false);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Lagring feilet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/wedding/${weddingId}/expenses/${id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      // Stille
    }
  };

  const categoryIcon = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.icon || <OtherIcon />;
  const categoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label || cat;

  return (
    <>
      {/* Summary-card vises inline der parent bestemmer */}
      <Box sx={{ mb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Utlegg i dag</Typography>
          <Chip label={`${total.toFixed(0)} kr`} color="primary" size="small" />
        </Stack>
        {loading && <CircularProgress size={20} />}
        {!loading && list.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Ingen utlegg ennå. Trykk + nederst for å registrere.
          </Typography>
        )}
        {!loading && list.length > 0 && (
          <List dense disablePadding>
            {list.map((e) => (
              <ListItem
                key={e.id}
                disableGutters
                secondaryAction={
                  <IconButton size="small" edge="end" onClick={() => handleDelete(e.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <Box sx={{ mr: 1, color: 'text.secondary' }}>{categoryIcon(e.expenseCategory)}</Box>
                <ListItemText
                  primary={`${e.description} — ${e.amount.toFixed(0)} kr`}
                  secondary={`${categoryLabel(e.expenseCategory)}${e.receiptPhotoUrl ? ' · kvittering vedlagt' : ''}${e.isBillable ? ' · faktureres' : ' · refunderes'}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* FAB nederst til høyre */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1300 }}
        onClick={() => setOpen(true)}
        aria-label="Registrer utlegg"
      >
        <ReceiptIcon />
      </Fab>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nytt utlegg</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              size="small"
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  <Stack direction="row" spacing={1} alignItems="center">{c.icon}<span>{c.label}</span></Stack>
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Beløp (NOK)"
              type="number"
              inputProps={{ inputMode: 'decimal', step: 1, min: 0 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              autoFocus
              size="small"
              placeholder="F.eks. 80"
            />

            <TextField
              label="Beskrivelse (valgfri)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              size="small"
              placeholder="F.eks. Lunsj på Losby"
            />

            <Button
              variant={receiptDataUrl ? 'outlined' : 'contained'}
              component="label"
              startIcon={<CameraIcon />}
              fullWidth
            >
              {receiptDataUrl ? 'Bytt kvitterings-foto' : 'Ta foto av kvittering'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handlePhotoChange}
              />
            </Button>
            {receiptDataUrl && (
              <Box sx={{ textAlign: 'center' }}>
                <img src={receiptDataUrl} alt="Kvittering" style={{ maxHeight: 160, borderRadius: 4 }} />
              </Box>
            )}

            <Stack direction="row" spacing={1}>
              <Chip
                label="Faktureres til kunde"
                color={isBillable ? 'success' : 'default'}
                onClick={() => setIsBillable(true)}
                clickable
              />
              <Chip
                label="Refunderes (eget utlegg)"
                color={!isBillable ? 'warning' : 'default'}
                onClick={() => setIsBillable(false)}
                clickable
              />
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { reset(); setOpen(false); }}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || !amount.trim()}
          >
            {submitting ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ExpenseQuickCapture;
