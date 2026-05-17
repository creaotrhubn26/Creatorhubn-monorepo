// @ts-nocheck
/**
 * ContributeVenueDialog — Slice 9X.35
 *
 * Stine kan foreslå en NY foto-lokasjon ELLER korrigere en eksisterende.
 * Brukes fra to mount-points i VenueInfoCard:
 *   - "Foreslå denne lokasjonen" (når ingen match) → proposalKind='new',
 *     navn pre-fylt fra Stines location-tekst
 *   - "Foreslå korrigering" (når match finnes) → proposalKind='diff',
 *     skjemaet pre-fylles med eksisterende verdier, bare endrede felter
 *     sendes
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Grid,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

interface ExistingVenue {
  id: string;
  slug?: string;
  name?: string;
  venueType?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  county?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  bookingUrl?: string | null;
  requiresBooking?: boolean;
  requiresPermit?: boolean;
  feeKr?: number | null;
  feeUnit?: string | null;
  restrictionsText?: string | null;
  photographerNotes?: string | null;
}

interface ContributeVenueDialogProps {
  open: boolean;
  onClose: () => void;
  /** Hvis satt → diff-modus mot denne. Ellers → ny venue. */
  existingVenue?: ExistingVenue | null;
  /** Navn å pre-fylle for "ny"-modus (Stines location-tekst) */
  prefilledName?: string;
  onSubmitted?: () => void;
}

const VENUE_TYPES = [
  { value: 'castle', label: 'Slott' },
  { value: 'mansion', label: 'Herregård' },
  { value: 'church', label: 'Kirke / kapell' },
  { value: 'park', label: 'Park' },
  { value: 'beach', label: 'Strand' },
  { value: 'forest', label: 'Skog' },
  { value: 'mountain', label: 'Fjell / utsikt' },
  { value: 'lake', label: 'Innsjø' },
  { value: 'urban', label: 'Urban / bygate' },
  { value: 'historical', label: 'Historisk sted' },
  { value: 'other', label: 'Annet' },
];

const FEE_UNITS = [
  { value: 'free', label: 'Gratis' },
  { value: 'per_hour', label: 'Per time' },
  { value: 'per_session', label: 'Per session' },
  { value: 'per_day', label: 'Per dag' },
  { value: 'on_request', label: 'På forespørsel' },
];

const ContributeVenueDialog: React.FC<ContributeVenueDialogProps> = ({
  open,
  onClose,
  existingVenue,
  prefilledName,
  onSubmitted,
}) => {
  const isDiff = !!existingVenue?.id;
  const initial = (): Record<string, any> => ({
    name: existingVenue?.name ?? prefilledName ?? '',
    venueType: existingVenue?.venueType ?? '',
    address: existingVenue?.address ?? '',
    city: existingVenue?.city ?? '',
    postalCode: existingVenue?.postalCode ?? '',
    county: existingVenue?.county ?? '',
    contactName: existingVenue?.contactName ?? '',
    contactEmail: existingVenue?.contactEmail ?? '',
    contactPhone: existingVenue?.contactPhone ?? '',
    websiteUrl: existingVenue?.websiteUrl ?? '',
    bookingUrl: existingVenue?.bookingUrl ?? '',
    requiresBooking: !!existingVenue?.requiresBooking,
    requiresPermit: !!existingVenue?.requiresPermit,
    feeKr: existingVenue?.feeKr ?? '',
    feeUnit: existingVenue?.feeUnit ?? '',
    restrictionsText: existingVenue?.restrictionsText ?? '',
    photographerNotes: existingVenue?.photographerNotes ?? '',
  });
  const [data, setData] = useState<Record<string, any>>(initial());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setData(initial());
      setNote('');
      setError(null);
      setSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingVenue?.id, prefilledName]);

  const setField = (key: string, value: any) => setData((d) => ({ ...d, [key]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Diff-modus: send bare felter som er endret fra eksisterende verdi
      let proposed: Record<string, any>;
      if (isDiff && existingVenue) {
        proposed = {};
        for (const [key, val] of Object.entries(data)) {
          const orig = (existingVenue as any)[key];
          const normOrig = orig == null ? '' : orig;
          const normVal = val == null ? '' : val;
          if (String(normOrig) !== String(normVal)) {
            proposed[key] = val === '' ? null : val;
          }
        }
        if (Object.keys(proposed).length === 0) {
          setError('Du har ikke endret noe.');
          setSubmitting(false);
          return;
        }
      } else {
        proposed = { ...data };
        if (!proposed.name) {
          setError('Navn er påkrevd.');
          setSubmitting(false);
          return;
        }
        // Fjern tomme felter for "new"-modus
        for (const key of Object.keys(proposed)) {
          if (proposed[key] === '' || proposed[key] == null) delete proposed[key];
        }
      }

      await apiRequest('/api/photo-venues/contributions', {
        method: 'POST',
        body: {
          proposalKind: isDiff ? 'diff' : 'new',
          targetVenueId: existingVenue?.id || null,
          proposedData: proposed,
          contributorNote: note || undefined,
        },
      });
      setSuccess(true);
      onSubmitted?.();
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      setError(e?.message || 'Innsending feilet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isDiff
          ? `Foreslå korrigering: ${existingVenue?.name}`
          : 'Foreslå ny foto-lokasjon'}
      </DialogTitle>
      <DialogContent dividers>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Takk! Bidraget ditt er sendt til gjennomgang.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isDiff
            ? 'Endre feltene du vet er feil/utdaterte. Vi sammenligner med eksisterende data og sender kun det du faktisk endrer.'
            : 'Fyll ut det du vet. Du trenger ikke å vite alt — bare det Stine-fotografer trenger for å besøke stedet.'}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth size="small" required label="Navn på lokasjon"
              value={data.name} onChange={(e) => setField('name', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth size="small" select label="Type"
              value={data.venueType ?? ''} onChange={(e) => setField('venueType', e.target.value)}
            >
              <MenuItem value="">—</MenuItem>
              {VENUE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={8}>
            <TextField fullWidth size="small" label="Adresse" value={data.address} onChange={(e) => setField('address', e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="Postnr" value={data.postalCode} onChange={(e) => setField('postalCode', e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="Sted" value={data.city} onChange={(e) => setField('city', e.target.value)} />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Kontakt</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Kontaktnavn" value={data.contactName} onChange={(e) => setField('contactName', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Telefon" value={data.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" type="email" label="E-post" value={data.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Nettside" value={data.websiteUrl} onChange={(e) => setField('websiteUrl', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Booking-URL (hvis annet enn nettside)" value={data.bookingUrl} onChange={(e) => setField('bookingUrl', e.target.value)} />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Pris og tilgang</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={<Switch checked={!!data.requiresBooking} onChange={(e) => setField('requiresBooking', e.target.checked)} />}
              label="Krever booking"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={<Switch checked={!!data.requiresPermit} onChange={(e) => setField('requiresPermit', e.target.checked)} />}
              label="Krever permit"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" type="number" label="Pris (NOK)" value={data.feeKr} onChange={(e) => setField('feeKr', e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" select label="Pris-enhet" value={data.feeUnit ?? ''} onChange={(e) => setField('feeUnit', e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {FEE_UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Restriksjoner / regler"
              placeholder="F.eks. Drone forbudt, ikke tillatt med stativ innendørs"
              value={data.restrictionsText} onChange={(e) => setField('restrictionsText', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Tips fra fellesskapet (for fotografer)"
              placeholder="F.eks. Beste lys ved soloppgang, parkering på baksiden"
              value={data.photographerNotes} onChange={(e) => setField('photographerNotes', e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Din kommentar til admin (valgfri)"
              placeholder="F.eks. Var der i april 2026, prisen var endret"
              value={note} onChange={(e) => setNote(e.target.value)}
            />
          </Grid>
        </Grid>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || success}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {submitting ? 'Sender…' : 'Send inn forslag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContributeVenueDialog;
