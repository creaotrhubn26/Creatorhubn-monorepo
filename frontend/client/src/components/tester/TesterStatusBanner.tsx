// @ts-nocheck
/**
 * TesterStatusBanner — Slice 9X.53
 *
 * Persistent topbar-banner som vises for innloggede prototype-testere.
 * Viser dager igjen + feedback-status + lenke til feedback-knapp.
 *
 * Dukker også opp som velkomst-modal første gang etter signering
 * (driven av sessionStorage-flag satt av AcceptPrototypeTesterInvite).
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Science as TesterIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Schedule as ClockIcon,
  Feedback as FeedbackIcon,
  EmojiEvents as RewardIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { TESTER_PROGRAM_TERMS } from '@/lib/tester-program-terms';
import { resolveTesterAccess, getTierLabel } from '@/lib/tester-access-tiers';
import { trackEvent } from '@/utils/ga4-client-tracking';
import TeamInvitePanel from './TeamInvitePanel';

interface TesterStatus {
  isTester: boolean;
  inviteId?: string;
  programStartedAt?: string;
  programEndsAt?: string;
  daysRemaining?: number;
  feedbackCount?: number;
  expectedFeedbacks?: number;
  isOnTrack?: boolean;
  benefitGranted?: boolean;
  grantedPlan?: string;
  grantedFeatures?: string[];
  teamRole?: 'individual' | 'master' | 'member';
  masterInviteId?: string | null;
  maxTeamSize?: number;
}

const DISMISS_KEY = 'tester-banner-dismissed-day';

const TesterStatusBanner: React.FC = () => {
  const [status, setStatus] = useState<TesterStatus | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [bannerDismissedToday, setBannerDismissedToday] = useState(false);

  useEffect(() => {
    // Sjekk om dismissed i dag (lokal-tidspunkt)
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      const today = new Date().toISOString().slice(0, 10);
      if (stored === today) setBannerDismissedToday(true);
    } catch { /* ignore */ }

    apiRequest('/api/prototype-tester-invites/me/status')
      .then((r: any) => {
        setStatus(r);
        if (r.isTester) {
          try {
            const justSigned = sessionStorage.getItem('prototype-tester-just-signed');
            if (justSigned === '1') {
              setShowWelcome(true);
              sessionStorage.removeItem('prototype-tester-just-signed');
              trackEvent('prototype_tester_welcome_shown', {
                granted_plan: r.grantedPlan,
              });
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => setStatus(null));
  }, []);

  if (!status?.isTester) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10)); } catch { /* ignore */ }
    setBannerDismissedToday(true);
  };

  const handleOpenFeedback = () => {
    trackEvent('prototype_tester_feedback_clicked_from_banner', {});
    // Hvis det finnes en global feedback-knapp som lytter på event, fyrer vi den
    window.dispatchEvent(new CustomEvent('open-prototype-feedback', { detail: { source: 'tester_banner' } }));
  };

  const progressPct = status.expectedFeedbacks
    ? Math.min(100, Math.round(((status.feedbackCount || 0) / status.expectedFeedbacks) * 100))
    : 0;
  const programLengthDays = TESTER_PROGRAM_TERMS.durationWeeks * 7;
  const timePassedPct = Math.min(100, Math.round(((programLengthDays - (status.daysRemaining || 0)) / programLengthDays) * 100));

  return (
    <>
      {!bannerDismissedToday && (
        <Alert
          severity={status.isOnTrack ? 'success' : 'warning'}
          icon={<TesterIcon fontSize="small" />}
          sx={{
            borderRadius: 0,
            py: 0.5,
            '& .MuiAlert-message': { width: '100%', py: 0.5 },
          }}
          action={
            <IconButton size="small" onClick={handleDismiss} aria-label="Skjul i dag">
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ width: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
              <Typography variant="body2"><b>Prototype-tester</b></Typography>
              {status.teamRole === 'master' && (
                <Chip size="small" color="primary" variant="outlined" label="Team-master" />
              )}
              {status.teamRole === 'member' && (
                <Chip size="small" variant="outlined" label="Team-medlem" />
              )}
              <Chip size="small" label={`${status.daysRemaining ?? 0} dager igjen`} variant="outlined" />
              <Chip
                size="small"
                label={`${status.feedbackCount ?? 0}/${status.expectedFeedbacks ?? 0} feedbacks`}
                color={status.isOnTrack ? 'success' : 'warning'}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {status.isOnTrack ? 'Du er på rute' : `Logg ${(status.expectedFeedbacks ?? 0) - (status.feedbackCount ?? 0)} til for å være ajour`}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              {status.teamRole === 'master' && (
                <Button size="small" variant="text" onClick={() => setShowTeamPanel(true)}>
                  Administrer team
                </Button>
              )}
              <Button size="small" variant="outlined" startIcon={<FeedbackIcon />} onClick={handleOpenFeedback}>
                Gi feedback
              </Button>
            </Stack>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={timePassedPct}
            sx={{ mt: 0.5, height: 3 }}
          />
        </Alert>
      )}

      {/* Velkomst-modal — vises én gang rett etter signering */}
      <Dialog open={showWelcome} onClose={() => setShowWelcome(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TesterIcon color="primary" />
          Velkommen som prototype-tester
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body1">
              Du har <b>{TESTER_PROGRAM_TERMS.durationWeeks} uker</b> på deg til å teste og forme Creatorhubn.
              Her er hva du må vite for å komme i gang.
            </Typography>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Din tilgang</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  color="primary"
                  icon={<CheckIcon />}
                  label={getTierLabel(status.grantedPlan || 'tester_all_access')}
                />
              </Stack>
              {(() => {
                const access = resolveTesterAccess(status.grantedPlan || 'tester_all_access', status.grantedFeatures || []);
                return (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {access.isAllAccess
                      ? `Bygger på ${access.basedOnPlan} + alle in-development features.`
                      : `Bygger på ${access.basedOnPlan} + ${access.features.length} spesifikke in-dev features (vises i innstillinger).`}
                  </Typography>
                );
              })()}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Forventninger</Typography>
              <List dense disablePadding>
                <ListItem sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><FeedbackIcon fontSize="small" color="action" /></ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ variant: 'body2' }}
                    primary={`Logg minst ${TESTER_PROGRAM_TERMS.feedbackMinimumPerMonth} feedback per måned (in-app-knappen)`}
                  />
                </ListItem>
                <ListItem sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><ClockIcon fontSize="small" color="action" /></ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ variant: 'body2' }}
                    primary={`~${TESTER_PROGRAM_TERMS.expectedHoursPerWeek} timer per uke i aktiv testing`}
                  />
                </ListItem>
                <ListItem sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><CheckIcon fontSize="small" color="action" /></ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ variant: 'body2' }}
                    primary="Rapporter kritiske feil innen 24 timer"
                  />
                </ListItem>
              </List>
            </Box>

            <Box sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RewardIcon color="primary" fontSize="small" />
                <Typography variant="body2">
                  <b>Din belønning:</b> 12 måneder gratis Professional-plan når programmet er fullført.
                </Typography>
              </Stack>
            </Box>

            {status.teamRole === 'master' && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Ditt team</Typography>
                <TeamInvitePanel />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWelcome(false)}>Bli med</Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowWelcome(false);
              window.dispatchEvent(new CustomEvent('open-prototype-feedback', { detail: { source: 'welcome_modal' } }));
            }}
          >
            Logg første feedback
          </Button>
        </DialogActions>
      </Dialog>

      {/* Team-admin-dialog — åpnes fra banner-knappen */}
      <Dialog open={showTeamPanel} onClose={() => setShowTeamPanel(false)} fullWidth maxWidth="md">
        <DialogTitle>Administrer ditt tester-team</DialogTitle>
        <DialogContent dividers>
          <TeamInvitePanel />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTeamPanel(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TesterStatusBanner;
