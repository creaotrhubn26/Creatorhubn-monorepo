/**
 * NextRoleReferralDialog — Inviter en venn → begge får 1 mnd gratis.
 *
 * Viser brukerens unike referral-kode + delbar lenke, kopier-knapp,
 * delelinker for SMS / e-post / Messenger / WhatsApp / LinkedIn,
 * og statistikk over hvor mange som har løst inn og hvor mange
 * bonus-måneder brukeren har tjent.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Paper, IconButton, Chip,
  CircularProgress, Alert, Divider, TextField, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CardGiftcard as GiftIcon,
  CheckCircle as CheckIcon,
  Send as SendIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  LinkedIn as LinkedInIcon,
  WhatsApp as WhatsAppIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ReferralState {
  code: string;
  shareUrl: string;
  invitedCount: number;
  rewardsEarned: number;
  bonusMonthsEarned: number;
  recentRedemptions: { redeemedAt: string; rewardApplied: boolean }[];
}

const SHARE_MESSAGE =
  'Jeg bruker NextRole til å bygge CV-en min. Her er 1 måned gratis hvis du registrerer deg via denne lenken:';

export const NextRoleReferralDialog: React.FC<Props> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [state, setState] = useState<ReferralState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = (await apiRequest('/api/marketplace/next-role/referrals/me', {
          headers: { 'x-user-id': user?.id || '' },
        })) as ReferralState;
        if (!cancelled) {
          setState(data);
          trackGA4('nextrole_referral_dialog_opened', {
            invited_count: data.invitedCount,
            bonus_months_earned: data.bonusMonthsEarned,
          });
        }
      } catch (err) {
        console.error('Referral fetch feilet', err);
        if (!cancelled) setError('Kunne ikke hente koden din. Prøv igjen.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const handleCopy = async (value: string, kind: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
      trackGA4('nextrole_referral_copied', { kind, code: state?.code });
    } catch {
      /* noop */
    }
  };

  const handleShare = (channel: string) => {
    if (!state) return;
    trackGA4('nextrole_referral_shared', { channel, code: state.code });
    const msg = encodeURIComponent(`${SHARE_MESSAGE} ${state.shareUrl}`);
    const subject = encodeURIComponent('1 måned gratis CV-bygger fra NextRole');
    let url = '';
    switch (channel) {
      case 'sms':
        url = `sms:?&body=${msg}`;
        break;
      case 'email':
        url = `mailto:?subject=${subject}&body=${msg}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${msg}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(state.shareUrl)}`;
        break;
      case 'native':
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
          (navigator as any)
            .share({
              title: 'NextRole — 1 måned gratis',
              text: SHARE_MESSAGE,
              url: state.shareUrl,
            })
            .catch(() => {});
          return;
        }
        url = state.shareUrl;
        break;
      default:
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <GiftIcon sx={{ color: '#F5B82E' }} />
          <Typography variant="h6" component="span">Inviter en venn</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {state && !loading && (
          <Stack spacing={2.5}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1F2937', mb: 0.5 }}>
                Begge får 1 måned gratis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Når vennen din fullfører trial og blir betalende, forlenges abonnementet ditt og deres med 30 dager.
              </Typography>
            </Box>

            {/* Statistikk-kort */}
            <Stack direction="row" spacing={2}>
              <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: '#FAFAFA' }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#1F2937' }}>
                  {state.invitedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Innløst hittil
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  p: 2,
                  textAlign: 'center',
                  bgcolor: state.bonusMonthsEarned > 0 ? '#FFF8E1' : '#FAFAFA',
                  borderColor: state.bonusMonthsEarned > 0 ? '#F5B82E' : 'divider',
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#1F2937' }}>
                  {state.bonusMonthsEarned}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Bonus-måneder
                </Typography>
              </Paper>
            </Stack>

            {/* Din kode */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                DIN KODE
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  value={state.code}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    sx: { fontFamily: 'monospace', fontWeight: 700, fontSize: 20, letterSpacing: 2 },
                  }}
                />
                <Tooltip title={copied === 'code' ? 'Kopiert' : 'Kopier kode'}>
                  <Button
                    variant="outlined"
                    onClick={() => handleCopy(state.code, 'code')}
                    sx={{ minWidth: 56 }}
                  >
                    {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                </Tooltip>
              </Stack>
            </Box>

            {/* Delelys */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                ELLER DEL LENKEN DIREKTE
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  value={state.shareUrl}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true, sx: { fontSize: 13 } }}
                />
                <Tooltip title={copied === 'url' ? 'Kopiert' : 'Kopier lenke'}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleCopy(state.shareUrl, 'url')}
                    sx={{ minWidth: 56 }}
                  >
                    {copied === 'url' ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                </Tooltip>
              </Stack>
            </Box>

            <Divider />

            {/* Share-kanaler */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                DEL VIA
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button startIcon={<SmsIcon />} variant="outlined" size="small" onClick={() => handleShare('sms')}>
                  SMS
                </Button>
                <Button startIcon={<EmailIcon />} variant="outlined" size="small" onClick={() => handleShare('email')}>
                  E-post
                </Button>
                <Button startIcon={<WhatsAppIcon />} variant="outlined" size="small" onClick={() => handleShare('whatsapp')}>
                  WhatsApp
                </Button>
                <Button startIcon={<LinkedInIcon />} variant="outlined" size="small" onClick={() => handleShare('linkedin')}>
                  LinkedIn
                </Button>
                {typeof navigator !== 'undefined' && (navigator as any).share && (
                  <Button startIcon={<ShareIcon />} variant="outlined" size="small" onClick={() => handleShare('native')}>
                    Annet
                  </Button>
                )}
              </Stack>
            </Box>

            {state.recentRedemptions.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                    SISTE INNLØSNINGER
                  </Typography>
                  <Stack spacing={0.5}>
                    {state.recentRedemptions.slice(0, 5).map((r, i) => (
                      <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          {new Date(r.redeemedAt).toLocaleDateString('no-NO', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Typography>
                        <Chip
                          size="small"
                          label={r.rewardApplied ? 'Bonus utløst' : 'Avventer betaling'}
                          color={r.rewardApplied ? 'success' : 'default'}
                          variant={r.rewardApplied ? 'filled' : 'outlined'}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleReferralDialog;
