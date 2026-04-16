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
            ? 'Du har allerede brukt prøveperioden — velg add-on eller oppgrader.'
            : `Kunne ikke starte prøve: ${result.error}`,
        );
        return;
      }
      setMessage('Prøveperiode startet! Agenten er åpen nå.');
      onEntitlementChanged?.();
      window.setTimeout(onClose, 1200);
    } finally {
      setPending(null);
    }
  }, [onClose, onEntitlementChanged]);

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
        setError('Add-on er ikke helt klar ennå. Kontakt salg eller prøv gratis prøveperiode.');
        return;
      }
      setError(`Feil ved checkout: ${result.detail}`);
    } finally {
      setPending(null);
    }
  }, []);

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
          AI-assistansen er en betalt funksjon. Velg hvordan du vil ta den i bruk.
        </Typography>
      </DialogTitle>
      <DialogContent>
        {entitlement?.reason ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {entitlement.status === 'expired'
              ? 'Prøveperioden din er over.'
              : entitlement.status === 'revoked'
                ? 'Tilgangen din er trukket tilbake. Kontakt admin.'
                : 'AI-tilgang krever abonnement eller prøveperiode.'}
          </Alert>
        ) : null}

        <Stack spacing={1.5}>
          {upsell.canStartTrial ? (
            <Option
              icon={<RocketIcon />}
              title={`Start ${trialDays}-dagers prøve`}
              detail="Gratis i hele prøveperioden. Ingen binding, ingen kortkrav."
              cta={pending === 'trial' ? <CircularProgress size={20} /> : 'Start prøve'}
              onClick={handleStartTrial}
              disabled={pending !== null}
              emphasis
            />
          ) : null}

          {upsell.canBuyAddOn ? (
            <Option
              icon={<CardIcon />}
              title={`Legg til for ${addonPrice} kr/mnd`}
              detail="Månedlig abonnement som kan sies opp når som helst. Faktureres via Stripe."
              cta={pending === 'addon' ? <CircularProgress size={20} /> : 'Kjøp add-on'}
              onClick={handleAddOnCheckout}
              disabled={pending !== null}
            />
          ) : null}

          {upsell.canUpgradeToPro ? (
            <Option
              icon={<UpgradeIcon />}
              title="Bytt til Pro"
              detail="Pro-planen inkluderer hele produktet inklusive agenten."
              cta={pending === 'upgrade' ? <CircularProgress size={20} /> : 'Se Pro-planen'}
              onClick={handleUpgradeToPro}
              disabled={pending !== null}
            />
          ) : null}
        </Stack>

        {upsell.currentPlanType ? (
          <Chip
            size="small"
            label={`Nåværende plan: ${upsell.currentPlanType}`}
            variant="outlined"
            sx={{ mt: 2 }}
          />
        ) : null}

        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={pending !== null}>
          Senere
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
