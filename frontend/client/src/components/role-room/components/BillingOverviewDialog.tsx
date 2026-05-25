/**
 * BillingOverviewDialog — central "Mine abonnementer"-view that lists every
 * active Stripe subscription the user has (Role Room sub, Post Agent,
 * add-ons, etc.) with per-line pricing + total monthly cost, plus a single
 * button to launch the Stripe Customer Portal where everything is managed.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { apiRequest } from '../../../lib/queryClient';

interface BillingItem {
  itemId: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string;
  quantity: number;
  monthlyEquivalent: number;
}

interface BillingSubscription {
  id: string;
  status: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  items: BillingItem[];
}

interface BillingOverview {
  subscriptions: BillingSubscription[];
  totalMonthlyNok: number;
  currency: string;
  mixedCurrencies?: boolean;
  degraded?: boolean;
  detail?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACCENT = '#a030c0';

export const BillingOverviewDialog: React.FC<Props> = ({ open, onClose }) => {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiRequest('/api/post-agent/billing/overview');
        const json = (res as any)?.json ? await (res as any).json() : res;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Kunne ikke laste abonnementene');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  async function openPortal() {
    setPortalBusy(true);
    try {
      const res = await apiRequest('/api/post-agent/billing/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: window.location.pathname }),
      });
      const json = (res as any)?.json ? await (res as any).json() : res;
      if (json?.url) {
        window.location.href = json.url;
        return;
      }
      setError(json?.detail || json?.error || 'Kunne ikke åpne billing-portalen');
    } catch (e: any) {
      setError(e?.message || 'Nettverksfeil');
    } finally {
      setPortalBusy(false);
    }
  }

  const subs = data?.subscriptions ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Mine abonnementer
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!loading && error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
        {!loading && !error && subs.length === 0 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info">Du har ingen aktive abonnementer ennå.</Alert>
          </Box>
        )}
        {!loading && !error && subs.length > 0 && (
          <Box>
            {/* Summary header */}
            <Box sx={{ p: 2.5, background: `linear-gradient(135deg, rgba(160,48,192,0.10), rgba(110,63,199,0.04))`, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
                Total per måned
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: ACCENT, lineHeight: 1.1 }}>
                {data?.totalMonthlyNok?.toLocaleString('nb-NO')} {data?.currency || 'NOK'}
              </Typography>
              {data?.mixedCurrencies && (
                <Typography variant="caption" color="text.secondary">
                  ⚠ Du har abonnementer i flere valutaer — totalen viser kun NOK-andelen
                </Typography>
              )}
            </Box>

            {subs.map((sub) => (
              <Box key={sub.id} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Chip
                    size="small"
                    label={sub.status}
                    sx={{
                      bgcolor: sub.status === 'active' ? 'rgba(74,212,138,0.15)' : 'rgba(245,158,11,0.15)',
                      color: sub.status === 'active' ? '#2a9568' : '#a16207',
                      fontWeight: 600,
                    }}
                  />
                  {sub.cancelAtPeriodEnd && (
                    <Chip size="small" label="Avsluttes ved periode-slutt" sx={{ bgcolor: 'rgba(239,79,111,0.15)', color: '#c63152', fontWeight: 600 }} />
                  )}
                </Stack>
                {sub.items.map((it) => (
                  <Box key={it.itemId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{it.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {it.unitAmount.toLocaleString('nb-NO')} {it.currency} / {it.interval}
                        {it.quantity > 1 && ` × ${it.quantity}`}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, ml: 2, whiteSpace: 'nowrap' }}>
                      {Math.round(it.monthlyEquivalent).toLocaleString('nb-NO')} {it.currency}/mnd
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Lukk</Button>
        <Button
          variant="contained"
          startIcon={<OpenInNewIcon />}
          disabled={portalBusy || (subs.length === 0 && !loading)}
          onClick={openPortal}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#b94dd6' } }}
        >
          {portalBusy ? 'Åpner…' : 'Administrer i Stripe'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillingOverviewDialog;
