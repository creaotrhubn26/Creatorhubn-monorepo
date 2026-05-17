// @ts-nocheck
/**
 * GalleryDeliveryPanel — Slice 9X.42
 *
 * Stine setter leveringsfrist, ser status (pending → proof_sent →
 * awaiting_selection → delivered), antall favoritter brudeparet har valgt,
 * og kan markere leveranse-stadier ferdig. Frist-countdown med farge.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  LinearProgress,
  Box,
} from '@mui/material';
import {
  PhotoLibrary as GalleryIcon,
  Schedule as DeadlineIcon,
  Favorite as FavoriteIcon,
  CheckCircle as DeliveredIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Delivery {
  id: string;
  deadlineAt: string;
  deliveredAt: string | null;
  proofSentAt: string | null;
  selectionCompletedAt: string | null;
  status: 'pending' | 'proof_sent' | 'awaiting_selection' | 'delivered' | 'overdue';
  galleryId: string | null;
  daysUntilDeadline: number | null;
  notes: string | null;
}

const STATUS_STEPS = [
  { value: 'pending', label: 'Ikke startet' },
  { value: 'proof_sent', label: 'Proof sendt' },
  { value: 'awaiting_selection', label: 'Venter på utvalg' },
  { value: 'delivered', label: 'Levert' },
];

const Props = {
  weddingId: '' as string,
};

const GalleryDeliveryPanel: React.FC<{ weddingId: string }> = ({ weddingId }) => {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [galleryIdInput, setGalleryIdInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [d, f]: any[] = await Promise.all([
        apiRequest(`/api/wedding/${weddingId}/gallery-delivery`).catch(() => ({ delivery: null })),
        apiRequest(`/api/wedding/${weddingId}/gallery/favorites`).catch(() => ({ favorites: [] })),
      ]);
      setDelivery(d.delivery);
      setFavorites(f.favorites || []);
      if (d.delivery) {
        setDeadlineInput(new Date(d.delivery.deadlineAt).toISOString().slice(0, 16));
        setGalleryIdInput(d.delivery.galleryId || '');
      } else {
        setEditingDeadline(true);
        // Default: 4 uker fra nå
        const fourWeeks = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
        setDeadlineInput(fourWeeks.toISOString().slice(0, 16));
      }
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [weddingId]);

  const handleSaveDeadline = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/gallery-delivery`, {
        method: 'PUT',
        body: {
          deadlineAt: new Date(deadlineInput).toISOString(),
          galleryId: galleryIdInput.trim() || undefined,
        },
      });
      setEditingDeadline(false);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Lagring feilet');
    } finally {
      setSubmitting(false);
    }
  };

  const markStep = async (endpoint: 'mark-proof-sent' | 'mark-delivered') => {
    setSubmitting(true);
    try {
      await apiRequest(`/api/wedding/${weddingId}/gallery-delivery/${endpoint}`, { method: 'POST' });
      reload();
    } catch (e: any) {
      setError(e?.message || 'Operasjon feilet');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Box sx={{ textAlign: 'center', p: 2 }}><CircularProgress size={24} /></Box>;

  const stepIndex = delivery ? STATUS_STEPS.findIndex((s) => s.value === delivery.status) : 0;
  const progress = delivery ? Math.max(0, (stepIndex / (STATUS_STEPS.length - 1)) * 100) : 0;
  const days = delivery?.daysUntilDeadline ?? null;
  const deadlineColor = days == null ? 'inherit' : days < 0 ? 'error' : days <= 3 ? 'warning' : days <= 7 ? 'info' : 'success';

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <GalleryIcon color="primary" />
          <Typography variant="h6">Galleri-leveranse</Typography>
        </Stack>

        {!delivery && !editingDeadline && (
          <Button startIcon={<DeadlineIcon />} onClick={() => setEditingDeadline(true)}>
            Sett leveringsfrist
          </Button>
        )}

        {editingDeadline && (
          <Stack spacing={1.5}>
            <TextField
              label="Leveringsfrist"
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
              helperText="Avtalt frist for ferdig galleri (typisk 4-6 uker etter bryllup)"
            />
            <TextField
              label="Galleri-ID (valgfri — for å koble proof-bilder)"
              value={galleryIdInput}
              onChange={(e) => setGalleryIdInput(e.target.value)}
              size="small"
              fullWidth
              helperText="UUID for client_galleries-raden. Brukes til å hente brudepar-favoritter."
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSaveDeadline} disabled={submitting || !deadlineInput}>
                {submitting ? 'Lagrer…' : 'Lagre frist'}
              </Button>
              {delivery && (
                <Button onClick={() => { setEditingDeadline(false); }}>Avbryt</Button>
              )}
            </Stack>
          </Stack>
        )}

        {delivery && !editingDeadline && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip
                icon={<DeadlineIcon />}
                label={
                  days != null
                    ? days < 0
                      ? `${Math.abs(days)} dager forsinket`
                      : days === 0
                        ? 'Forfaller i dag'
                        : `${days} dager igjen`
                    : 'Ingen frist'
                }
                color={deadlineColor as any}
              />
              <Typography variant="caption" color="text.secondary">
                {new Date(delivery.deadlineAt).toLocaleString('nb-NO')}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => setEditingDeadline(true)}>Endre</Button>
            </Stack>

            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4, mb: 1 }}
              color={delivery.status === 'delivered' ? 'success' : days != null && days < 0 ? 'error' : 'primary'}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
              {STATUS_STEPS.map((s, i) => (
                <Typography
                  key={s.value}
                  variant="caption"
                  sx={{
                    color: i <= stepIndex ? 'primary.main' : 'text.disabled',
                    fontWeight: i === stepIndex ? 600 : 400,
                  }}
                >
                  {s.label}
                </Typography>
              ))}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {/* Favoritter-status */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <FavoriteIcon color="error" fontSize="small" />
              <Typography variant="body2">
                <b>{favorites.length}</b> bilder markert som favoritt av brudeparet
              </Typography>
              {!delivery.galleryId && (
                <Chip size="small" label="Ingen galleri koblet" color="warning" />
              )}
            </Stack>

            {/* Action-knapper */}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {delivery.status === 'pending' && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => markStep('mark-proof-sent')}
                  disabled={submitting}
                >
                  Marker proof sendt
                </Button>
              )}
              {(delivery.status === 'proof_sent' || delivery.status === 'awaiting_selection') && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<DeliveredIcon />}
                  onClick={() => markStep('mark-delivered')}
                  disabled={submitting}
                >
                  Marker ferdig levert
                </Button>
              )}
              {delivery.status === 'delivered' && (
                <Chip
                  icon={<DeliveredIcon />}
                  label={`Levert ${new Date(delivery.deliveredAt!).toLocaleDateString('nb-NO')}`}
                  color="success"
                />
              )}
            </Stack>
          </>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
};

export default GalleryDeliveryPanel;
