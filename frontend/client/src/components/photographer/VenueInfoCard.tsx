// @ts-nocheck
/**
 * VenueInfoCard — Slice 9X.34
 *
 * Auto-oppslag mot foto-lokasjons-katalogen basert på event-location.
 * Når Stine setter en location på et timeline-event (f.eks. "Losby Gods"),
 * kaller denne komponenten /api/photo-venues/lookup?q=… og viser:
 *   - Kontakt (telefon → tap-to-call, e-post → tap-to-email)
 *   - Booking-status (krever booking? permit?)
 *   - Pris (gratis / per time / on_request)
 *   - Åpningstider
 *   - Restriksjoner + photographer-notes fra community
 *
 * Hvis ingen match: viser "Ikke i katalogen ennå" + "Foreslå venue"-knapp.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Button,
  Link,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Language as WebIcon,
  EventNote as BookingIcon,
  Warning as WarningIcon,
  Verified as VerifiedIcon,
  AccessTime as ClockIcon,
  AttachMoney as PriceIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import EditIcon from '@mui/icons-material/Edit';
import AddBoxIcon from '@mui/icons-material/AddBox';
import { apiRequest } from '@/lib/queryClient';
import ContributeVenueDialog from './ContributeVenueDialog';

interface VenueLookupMatch {
  id: string;
  slug: string;
  name: string;
  venueType: string;
  address: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  requiresBooking: boolean;
  requiresPermit: boolean;
  feeKr: number | null;
  feeUnit: string | null;
  openingHours: Record<string, string[]> | null;
  restrictionsText: string | null;
  photographerNotes: string | null;
  lastVerifiedAt: string | null;
}

interface VenueInfoCardProps {
  /** Adresse/sted-tekst fra event (eller wedding_location.label). */
  locationQuery: string;
}

const feeLabel = (feeKr: number | null, unit: string | null): string => {
  if (unit === 'free' || feeKr === 0) return 'Gratis';
  if (unit === 'on_request' || feeKr == null) return 'Pris på forespørsel';
  const unitMap: Record<string, string> = {
    per_hour: 'per time',
    per_session: 'per session',
    per_day: 'per dag',
  };
  return `${feeKr.toFixed(0)} kr ${unitMap[unit ?? ''] || ''}`.trim();
};

const dayLabels: Record<string, string> = {
  mon: 'Man', tue: 'Tir', wed: 'Ons', thu: 'Tor', fri: 'Fre', sat: 'Lør', sun: 'Søn',
};

const VenueInfoCard: React.FC<VenueInfoCardProps> = ({ locationQuery }) => {
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<VenueLookupMatch | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeMode, setContributeMode] = useState<'new' | 'diff'>('new');

  useEffect(() => {
    const q = (locationQuery || '').trim();
    if (q.length < 3) {
      setMatch(null);
      setHasSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiRequest(`/api/photo-venues/lookup?q=${encodeURIComponent(q)}`)
      .then((r: any) => {
        if (cancelled) return;
        const top = (r.matches && r.matches[0]) || null;
        setMatch(top);
        setHasSearched(true);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [locationQuery]);

  if (!locationQuery || locationQuery.trim().length < 3) return null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption">Søker etter info om lokasjonen…</Typography>
      </Box>
    );
  }

  if (!match && hasSearched) {
    return (
      <>
        <Alert
          severity="info"
          sx={{ mt: 1 }}
          icon={<InfoIcon fontSize="small" />}
          action={
            <Button
              size="small"
              startIcon={<AddBoxIcon fontSize="small" />}
              onClick={() => { setContributeMode('new'); setContributeOpen(true); }}
            >
              Foreslå denne
            </Button>
          }
        >
          <Typography variant="caption">
            Ingen info om <b>{locationQuery}</b> i katalogen. Sjekk åpningstider og om foto er tillatt før du drar.
          </Typography>
        </Alert>
        <ContributeVenueDialog
          open={contributeOpen}
          onClose={() => setContributeOpen(false)}
          prefilledName={locationQuery}
        />
      </>
    );
  }

  if (!match) return null;

  return (
    <Card variant="outlined" sx={{ mt: 1, bgcolor: 'background.paper' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <LocationIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2">{match.name}</Typography>
          {match.lastVerifiedAt && (
            <Tooltip title={`Verifisert ${new Date(match.lastVerifiedAt).toLocaleDateString('nb-NO')}`}>
              <VerifiedIcon fontSize="small" color="success" />
            </Tooltip>
          )}
        </Stack>

        {/* Status-chips */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
          <Chip
            size="small"
            icon={<PriceIcon fontSize="small" />}
            label={feeLabel(match.feeKr, match.feeUnit)}
            color={match.feeUnit === 'free' ? 'success' : 'default'}
          />
          {match.requiresBooking && (
            <Chip size="small" icon={<BookingIcon fontSize="small" />} label="Krever booking" color="warning" />
          )}
          {match.requiresPermit && (
            <Chip size="small" icon={<WarningIcon fontSize="small" />} label="Krever permit" color="warning" />
          )}
        </Stack>

        {/* Kontakt — tap-to-call/email/web */}
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {match.contactPhone && (
            <Link href={`tel:${match.contactPhone}`} underline="hover" variant="body2">
              <PhoneIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              {match.contactPhone}
            </Link>
          )}
          {match.contactEmail && (
            <Link href={`mailto:${match.contactEmail}`} underline="hover" variant="body2">
              <EmailIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              {match.contactEmail}
            </Link>
          )}
          {match.websiteUrl && (
            <Link href={match.websiteUrl} target="_blank" rel="noopener" underline="hover" variant="body2">
              <WebIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              {match.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </Link>
          )}
          {match.bookingUrl && match.bookingUrl !== match.websiteUrl && (
            <Button
              href={match.bookingUrl}
              target="_blank"
              rel="noopener"
              size="small"
              variant="outlined"
              startIcon={<BookingIcon />}
              sx={{ mt: 0.5, alignSelf: 'flex-start' }}
            >
              Book / forespør
            </Button>
          )}
        </Stack>

        {/* Åpningstider */}
        {match.openingHours && Object.keys(match.openingHours).length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
              <ClockIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">Åpningstider</Typography>
            </Stack>
            <Typography variant="caption" component="div" sx={{ pl: 2 }}>
              {Object.entries(match.openingHours).map(([day, hours]) => (
                <span key={day} style={{ display: 'inline-block', marginRight: 12 }}>
                  <b>{dayLabels[day] || day}:</b> {Array.isArray(hours) ? hours.join(', ') : hours}
                </span>
              ))}
            </Typography>
          </>
        )}

        {/* Restriksjoner */}
        {match.restrictionsText && (
          <>
            <Divider sx={{ my: 1 }} />
            <Alert severity="warning" icon={<WarningIcon fontSize="small" />} sx={{ py: 0.5 }}>
              <Typography variant="caption">{match.restrictionsText}</Typography>
            </Alert>
          </>
        )}

        {/* Photographer-notes */}
        {match.photographerNotes && (
          <Alert severity="info" icon={<InfoIcon fontSize="small" />} sx={{ mt: 1, py: 0.5 }}>
            <Typography variant="caption"><b>Fra fellesskapet:</b> {match.photographerNotes}</Typography>
          </Alert>
        )}

        <Box sx={{ mt: 1, textAlign: 'right' }}>
          <Button
            size="small"
            startIcon={<EditIcon fontSize="small" />}
            onClick={() => { setContributeMode('diff'); setContributeOpen(true); }}
          >
            Foreslå korrigering
          </Button>
        </Box>

        <ContributeVenueDialog
          open={contributeOpen}
          onClose={() => setContributeOpen(false)}
          existingVenue={contributeMode === 'diff' ? match : null}
          prefilledName={contributeMode === 'new' ? locationQuery : undefined}
        />
      </CardContent>
    </Card>
  );
};

export default VenueInfoCard;
