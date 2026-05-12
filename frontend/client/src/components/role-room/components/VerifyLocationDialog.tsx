/**
 * VerifyLocationDialog — re-verifiserer en eksisterende lokasjon mot
 * Kartverket og viser forskjeller side-om-side. Brukeren kan velge å
 * apply forslagene, eller dismiss og beholde nåværende data.
 *
 * Mønster:
 *   1. Brukeren klikker "Verifiser mot Kartverket" på et kort
 *   2. Dialog åpnes med loading-state mens vi henter fersk Kartverket-data
 *   3. Når data kommer: viser side-om-side diff (current vs proposed)
 *   4. Apply: oppdater address/coordinates/municipality/county/postalCode
 *   5. Dismiss: lukk uten endringer
 *
 * Hensikt: data-kvalitet-vedlikehold for eldre lokasjoner som ble lagret
 * før Kartverket-autocomplete eksisterte, eller hvor adresseendringer
 * har skjedd siden lagring.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import { externalDataService } from '@/services/ExternalDataService';
import type { Location } from '../models/casting';

export interface VerifyLocationDialogProps {
  open: boolean;
  location: Location | null;
  onClose: () => void;
  /** Kalles når brukeren godkjenner forslag — forelder applier oppdateringen */
  onApply: (locationId: string, updates: Partial<Location>) => void | Promise<void>;
}

interface VerifyResult {
  proposedAddress: string;
  proposedCoordinates: { lat: number; lng: number } | null;
  proposedMunicipality: string;
  proposedCounty: string;
  proposedPostalCode: string;
  differences: string[];
}

function coordsDiffer(
  a: { lat: number; lng: number } | undefined,
  b: { lat: number; lng: number } | null,
): boolean {
  if (!a || !b) return Boolean(a) !== Boolean(b);
  // ~10m presisjon før vi flagger som forskjell (5 desimaler = 1.1m)
  return Math.abs(a.lat - b.lat) > 0.0001 || Math.abs(a.lng - b.lng) > 0.0001;
}

export const VerifyLocationDialog: React.FC<VerifyLocationDialogProps> = ({
  open,
  location,
  onClose,
  onApply,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !location?.address?.trim()) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);

    void (async () => {
      try {
        // Bruker eksisterende single-shot endpoint via service
        const suggestions = await externalDataService.searchKartverketAddressSuggestions(
          location.address!,
          { limit: 1, signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const top = suggestions[0];
        if (!top) {
          setError('Kartverket fant ingen treff på denne adressen. Vurder å redigere manuelt.');
          setLoading(false);
          return;
        }
        const currentMunicipality = (location.municipality as string | undefined) || '';
        const currentCounty = (location.county as string | undefined) || '';
        const currentPostalCode = (location.postalCode as string | undefined) || '';
        const differences: string[] = [];
        if (top.address !== location.address) differences.push('address');
        if (coordsDiffer(location.coordinates, top.coordinates)) differences.push('coordinates');
        if (top.municipality && top.municipality !== currentMunicipality) differences.push('municipality');
        if (top.county && top.county !== currentCounty) differences.push('county');
        if (top.postalCode && top.postalCode !== currentPostalCode) differences.push('postalCode');

        setResult({
          proposedAddress: top.address,
          proposedCoordinates: top.coordinates,
          proposedMunicipality: top.municipality,
          proposedCounty: top.county,
          proposedPostalCode: top.postalCode,
          differences,
        });
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Ukjent feil';
        setError(`Kunne ikke verifisere mot Kartverket: ${message}`);
        setLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [open, location]);

  const handleApply = async () => {
    if (!location || !result) return;
    setApplying(true);
    try {
      const updates: Partial<Location> = {};
      if (result.differences.includes('address')) updates.address = result.proposedAddress;
      if (result.differences.includes('coordinates') && result.proposedCoordinates) {
        updates.coordinates = result.proposedCoordinates;
      }
      if (result.differences.includes('municipality')) {
        (updates as Record<string, unknown>).municipality = result.proposedMunicipality;
      }
      if (result.differences.includes('county')) {
        (updates as Record<string, unknown>).county = result.proposedCounty;
      }
      if (result.differences.includes('postalCode')) {
        (updates as Record<string, unknown>).postalCode = result.proposedPostalCode;
      }
      await onApply(location.id, updates);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const noChanges = result && result.differences.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(15,23,42,0.98)',
          border: '1px solid rgba(168,85,247,0.32)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
        <CompareIcon sx={{ color: '#a855f7' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Verifiser mot Kartverket
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)' }}>
            {location?.name || 'Lokasjon'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }} aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, gap: 1.5 }}>
            <CircularProgress size={24} sx={{ color: '#a855f7' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.9rem' }}>
              Henter fersk data fra Kartverket …
            </Typography>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.32)',
            }}
          >
            <Typography sx={{ color: '#fcd34d', fontSize: '0.85rem' }}>{error}</Typography>
          </Box>
        )}

        {result && noChanges && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              borderRadius: 1.5,
              bgcolor: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.32)',
            }}
          >
            <CheckIcon sx={{ color: '#10b981', fontSize: 24 }} />
            <Box>
              <Typography sx={{ color: '#6ee7b7', fontWeight: 600 }}>
                Alt stemmer med Kartverket
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
                Adresse, koordinater og administrative data er konsistente.
              </Typography>
            </Box>
          </Box>
        )}

        {result && !noChanges && (
          <Stack spacing={1.25}>
            <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.85rem', mb: 0.5 }}>
              Kartverket foreslår {result.differences.length} endring{result.differences.length === 1 ? '' : 'er'}:
            </Typography>
            {[
              { key: 'address', label: 'Adresse', current: location?.address || '', proposed: result.proposedAddress },
              {
                key: 'coordinates',
                label: 'Koordinater',
                current: location?.coordinates
                  ? `${location.coordinates.lat.toFixed(5)}, ${location.coordinates.lng.toFixed(5)}`
                  : '—',
                proposed: result.proposedCoordinates
                  ? `${result.proposedCoordinates.lat.toFixed(5)}, ${result.proposedCoordinates.lng.toFixed(5)}`
                  : '—',
              },
              { key: 'municipality', label: 'Kommune', current: (location?.municipality as string | undefined) || '—', proposed: result.proposedMunicipality || '—' },
              { key: 'county', label: 'Fylke', current: (location?.county as string | undefined) || '—', proposed: result.proposedCounty || '—' },
              { key: 'postalCode', label: 'Postnummer', current: (location?.postalCode as string | undefined) || '—', proposed: result.proposedPostalCode || '—' },
            ].map((row) => {
              const isDifferent = result.differences.includes(row.key);
              return (
                <Box
                  key={row.key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 1fr',
                    gap: 1,
                    alignItems: 'center',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: isDifferent ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isDifferent ? 'rgba(251,191,36,0.28)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {row.label}
                  </Typography>
                  <Typography
                    sx={{
                      color: isDifferent ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)',
                      fontSize: '0.82rem',
                      textDecoration: isDifferent ? 'line-through' : 'none',
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.current || '—'}
                  </Typography>
                  <Typography
                    sx={{
                      color: isDifferent ? '#6ee7b7' : 'rgba(255,255,255,0.55)',
                      fontSize: '0.82rem',
                      fontWeight: isDifferent ? 600 : 400,
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.proposed || '—'}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          startIcon={<CloseIcon />}
          sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
        >
          Behold nåværende
        </Button>
        {result && !noChanges && (
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={applying}
            startIcon={applying ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <RefreshIcon />}
            sx={{
              bgcolor: '#9333ea',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { bgcolor: '#a855f7' },
            }}
          >
            {applying ? 'Oppdaterer …' : 'Bruk Kartverket-data'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
