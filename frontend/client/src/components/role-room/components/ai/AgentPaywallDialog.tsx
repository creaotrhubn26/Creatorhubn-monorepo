// @ts-nocheck
/**
 * AgentPaywallDialog — shown when the agent returns HTTP 402. Three CTAs
 * match the hybrid monetization model:
 *   1. "Start 14-dagers prøve" — only if the user has never used the trial
 *   2. "Legg til for 99 kr/mnd" — Stripe add-on checkout
 *   3. "Bytt til Pro" — upsell to existing subscription plan
 *
 * When the Stripe add-on is not yet configured the second CTA shows
 * a "kommer snart" state and prompts the user to contact sales.
 */

import React, { useCallback, useState } from 'react';
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
  Stack,
  Typography,
} from '@mui/material';
import {
  RocketLaunch as RocketIcon,
  Upgrade as UpgradeIcon,
  CardMembership as CardIcon,
} from '@mui/icons-material';

import {
  createAddonCheckout,
  startAgentTrialRequest,
  type EntitlementConfig,
  type EntitlementResult,
} from '../../services/roleRoomAgentEntitlementApi';
import { useT } from '../../../../i18n';

interface AgentPaywallDialogProps {
  open: boolean;
  onClose: () => void;
  entitlement: EntitlementResult | null;
  config?: EntitlementConfig | null;
  /** Fires after a successful trial start / checkout redirect so the
   *  parent can refresh entitlement state. */
  onEntitlementChanged?: () => void;
}

export const AgentPaywallDialog: React.FC<AgentPaywallDialogProps> = ({
  open,
  onClose,
  entitlement,
  config,
  onEntitlementChanged,
}) => {
  const { t } = useT();
  const [pending, setPending] = useState<null | 'trial' | 'addon' | 'upgrade'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upsell = entitlement?.upsell ?? {
    canStartTrial: true,
    canBuyAddOn: true,
    canUpgradeToPro: true,
    currentPlanType: null,
  };
  const trialDays = config?.trialDays ?? 14;
  const addonPrice = config?.addonMonthlyPriceNok ?? 99;

  const handleStartTrial = useCallback(async () => {
    setPending('trial');
    setError(null);
    setMessage(null);
    try {
      const result = await startAgentTrialRequest();
      if (!result.ok) {
        setError(
          result.error === 'trial_already_used'
            ? t('agentPaywall.trialAlreadyUsed')
            : t('agentPaywall.trialStartFailed', { error: result.error }),
        );
        return;
      }
      setMessage(t('agentPaywall.trialStarted'));
      onEntitlementChanged?.();
      window.setTimeout(onClose, 1200);
    } finally {
      setPending(null);
    }
  }, [onClose, onEntitlementChanged, t]);

  const handleAddOnCheckout = useCallback(async () => {
    setPending('addon');
    setError(null);
    setMessage(null);
    try {
      const result = await createAddonCheckout();
      if (result.status === 'ok') {
        window.location.href = result.url;
        return;
      }
      if (result.status === 'not_configured') {
        setError(t('agentPaywall.addonNotReady'));
        return;
      }
      setError(t('agentPaywall.checkoutError', { detail: result.detail }));
    } finally {
      setPending(null);
    }
  }, [t]);

  const handleUpgradeToPro = useCallback(() => {
    setPending('upgrade');
    // Routes to the existing subscription management page.
    window.location.href = '/settings/subscription';
  }, []);

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        The Role Room Agent
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t('agentPaywall.subtitle')}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {entitlement?.reason ? (
          <Alert severity={entitlement.reason.startsWith('trial_') ? 'warning' : 'info'} sx={{ mb: 2 }}>
            {entitlement.reason.startsWith('trial_daily_cap_reached')
              ? t('agentPaywall.reasonDailyCap')
              : entitlement.reason.startsWith('trial_total_cap_reached')
                ? t('agentPaywall.reasonTotalCap')
                : entitlement.status === 'expired'
                  ? t('agentPaywall.reasonExpired')
                  : entitlement.status === 'revoked'
                    ? t('agentPaywall.reasonRevoked')
                    : t('agentPaywall.reasonDefault')}
          </Alert>
        ) : null}

        <Stack spacing={1.5}>
          {upsell.canStartTrial ? (
            <Option
              icon={<RocketIcon />}
              title={t('agentPaywall.trialTitle', { days: trialDays })}
              detail={t('agentPaywall.trialDetail')}
              cta={pending === 'trial' ? <CircularProgress size={20} /> : t('agentPaywall.trialCta')}
              onClick={handleStartTrial}
              disabled={pending !== null}
              emphasis
            />
          ) : null}

          {upsell.canBuyAddOn ? (
            <Option
              icon={<CardIcon />}
              title={t('agentPaywall.addonTitle', { price: addonPrice })}
              detail={t('agentPaywall.addonDetail')}
              cta={pending === 'addon' ? <CircularProgress size={20} /> : t('agentPaywall.addonCta')}
              onClick={handleAddOnCheckout}
              disabled={pending !== null}
            />
          ) : null}

          {upsell.canUpgradeToPro ? (
            <Option
              icon={<UpgradeIcon />}
              title={t('agentPaywall.upgradeTitle')}
              detail={t('agentPaywall.upgradeDetail')}
              cta={pending === 'upgrade' ? <CircularProgress size={20} /> : t('agentPaywall.upgradeCta')}
              onClick={handleUpgradeToPro}
              disabled={pending !== null}
            />
          ) : null}
        </Stack>

        {upsell.currentPlanType ? (
          <Chip
            size="small"
            label={t('agentPaywall.currentPlan', { plan: upsell.currentPlanType })}
            variant="outlined"
            sx={{ mt: 2 }}
          />
        ) : null}

        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={pending !== null}>
          {t('agentPaywall.laterBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface OptionProps {
  icon: React.ReactNode;
  title: string;
  detail: string;
  cta: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}

const Option: React.FC<OptionProps> = ({ icon, title, detail, cta, onClick, disabled, emphasis }) => (
  <Box
    sx={{
      p: 2,
      borderRadius: 2,
      border: '1px solid',
      borderColor: emphasis ? '#6366f1' : 'divider',
      bgcolor: emphasis ? 'rgba(99,102,241,0.06)' : 'background.paper',
    }}
  >
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: emphasis ? '#6366f1' : 'text.secondary', mt: 0.5 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {detail}
        </Typography>
      </Box>
      <Button
        size="small"
        variant={emphasis ? 'contained' : 'outlined'}
        onClick={onClick}
        disabled={disabled}
        sx={{ textTransform: 'none', fontWeight: 700, minWidth: 120 }}
      >
        {cta}
      </Button>
    </Stack>
  </Box>
);

export default AgentPaywallDialog;
