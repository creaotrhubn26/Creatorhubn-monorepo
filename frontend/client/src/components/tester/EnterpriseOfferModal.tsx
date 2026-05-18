// @ts-nocheck
/**
 * EnterpriseOfferModal — Slice 9X.57
 *
 * Vises automatisk for team-mastere som har et aktivt offer (sendt av
 * cron 14 dager før program_ends_at). Master kan akseptere → Stripe
 * Checkout, eller avslå.
 *
 * Tilbudet: 3 mnd gratis Enterprise + 25 % rabatt i 12 mnd, for X-personers team.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  EmojiEvents as RewardIcon,
  CheckCircle as CheckIcon,
  Schedule as ClockIcon,
  Workspaces as TeamIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/utils/ga4-client-tracking';

interface Offer {
  id: string;
  teamSize: number;
  freeMonths: number;
  discountPct: number;
  discountMonths: number;
  expiresAt: string;
  programEndsAt: string;
}

const DISMISS_KEY = (offerId: string) => `enterprise-offer-dismissed-today:${offerId}`;

const EnterpriseOfferModal: React.FC = () => {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiRequest('/api/tester-enterprise-offer/me')
      .then((r: any) => {
        const o = r?.offer || null;
        if (o) {
          // Sjekk om bruker dismisset i dag (lokal-tid)
          try {
            const today = new Date().toISOString().slice(0, 10);
            if (localStorage.getItem(DISMISS_KEY(o.id)) === today) {
              setDismissed(true);
            }
          } catch { /* ignore */ }
          setOffer(o);
          trackEvent('tester_to_enterprise_offer_shown', {
            offer_id: o.id,
            team_size: o.teamSize,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !offer || dismissed) return null;

  const handleAccept = async () => {
    setBusy(true);
    setError(null);
    try {
      trackEvent('tester_to_enterprise_offer_clicked', {
        offer_id: offer.id,
        team_size: offer.teamSize,
      });
      const r: any = await apiRequest(`/api/tester-enterprise-offer/${offer.id}/checkout`, { method: 'POST' });
      if (r?.checkoutUrl) {
        window.location.href = r.checkoutUrl;
      } else {
        setError('Stripe Checkout-URL mangler. Prøv igjen eller kontakt support.');
      }
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke starte Checkout');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm('Avslå tilbudet? Du kan be CreatorHub om et nytt tilbud senere ved å kontakte oss.')) return;
    try {
      await apiRequest(`/api/tester-enterprise-offer/${offer.id}/decline`, { method: 'POST' });
      trackEvent('tester_to_enterprise_offer_declined', { offer_id: offer.id });
      setOffer(null);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke registrere avslag');
    }
  };

  const handleSkipToday = () => {
    try { localStorage.setItem(DISMISS_KEY(offer.id), new Date().toISOString().slice(0, 10)); } catch { /* ignore */ }
    setDismissed(true);
  };

  const daysToProgramEnd = Math.max(0, Math.ceil((new Date(offer.programEndsAt).getTime() - Date.now()) / (24 * 3600 * 1000)));
  const daysToOfferExpiry = Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000)));

  return (
    <Dialog open={!!offer} onClose={handleSkipToday} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RewardIcon color="primary" />
        Fortsett som Enterprise-team — 3 mnd gratis
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body1">
            Tester-programmet ditt for <b>{offer.teamSize} personer</b> nærmer seg slutten
            ({daysToProgramEnd} dager igjen). Vi vil gjerne ha teamet videre på Enterprise-plan.
          </Typography>

          <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Vårt tilbud</Typography>
            <List dense disablePadding>
              <ListItem sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><CheckIcon fontSize="small" color="success" /></ListItemIcon>
                <ListItemText
                  primary={`${offer.freeMonths} måneder gratis Enterprise`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><CheckIcon fontSize="small" color="success" /></ListItemIcon>
                <ListItemText
                  primary={`${offer.discountPct} % rabatt i ${offer.discountMonths} måneder etter`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><TeamIcon fontSize="small" color="primary" /></ListItemIcon>
                <ListItemText
                  primary={`Hele teamet (${offer.teamSize} brukere) beholdes`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><CheckIcon fontSize="small" color="success" /></ListItemIcon>
                <ListItemText
                  primary="Beholder alle features dere har testet"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </Box>

          <Divider />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
            <ClockIcon fontSize="small" />
            <Typography variant="caption">
              Tilbudet utløper om {daysToOfferExpiry} dager. Etter det fortsetter teamet på Basic-tier.
            </Typography>
          </Stack>

          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Button onClick={handleDecline} color="error" size="small">
          Avslå tilbudet
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={handleSkipToday}>Vurder senere</Button>
          <Button
            variant="contained"
            onClick={handleAccept}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {busy ? 'Åpner Checkout…' : 'Fortsett til betaling'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default EnterpriseOfferModal;
