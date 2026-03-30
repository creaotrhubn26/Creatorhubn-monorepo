// client/src/components/common/TrialFeatureWithPricing.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  CreditCard,
  Google,
  Phone,
  Timer,
  Upgrade,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { TrialActivationDialog } from './TrialActivationDialog';
import { pricingService } from '@/services/PricingService';
import { useTrialFeatureIntegration } from '@/contexts/TrialFeatureContext';

interface TrialFeatureWithPricingProps {
  featureId: string;
  componentId: string;
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
  variant?: 'card' | 'banner' | 'inline' | 'minimal';
  showPricing?: boolean;
  onTrialStart?: () => void;
  onUpgradeRequired?: () => void;
  onFeatureUsed?: (action: string) => void;
  className?: string;
}

type PaymentMethod = 'google-pay' | 'stripe' | 'vipps';

interface PaymentIntentResponse {
  success?: boolean;
  paymentIntent?: {
    id?: string;
    clientSecret?: string;
    amount?: number;
    currency?: string;
  };
}

export function TrialFeatureWithPricing({
  featureId,
  componentId,
  children,
  fallbackComponent,
  variant = 'card',
  showPricing = true,
  onTrialStart,
  onUpgradeRequired,
  onFeatureUsed,
  className,
}: TrialFeatureWithPricingProps) {
  const theming = useTheming('photographer');
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('google-pay');
  const [loading, setLoading] = useState(false);

  const {
    feature,
    trialStatus,
    hasAccess,
    isActive,
    startTrial,
    trackUsage,
    showTrialDialog,
    setShowTrialDialog,
    openTrialDialog,
  } = useTrialFeatureIntegration(featureId, componentId);

  const pricing = useMemo(() => {
    pricingService.initializePricing();
    return feature ? pricingService.getFeaturePricing(featureId) : null;
  }, [feature, featureId]);

  const daysLeft = useMemo(() => {
    if (!trialStatus?.endDate) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil((new Date(trialStatus.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
  }, [trialStatus]);

  const handleTrialStart = async () => {
    try {
      setLoading(true);
      await startTrial();
      onTrialStart?.();
      onFeatureUsed?.('trial_started');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    trackUsage('upgrade_prompt_opened');
    if (showPricing && pricing) {
      setShowPricingDialog(true);
    } else {
      onUpgradeRequired?.();
    }
  };

  const handlePayment = async (paymentMethod: PaymentMethod) => {
    if (!pricing) {
      return;
    }

    try {
      setLoading(true);
      trackUsage(`upgrade_attempted_${paymentMethod}`);

      const amount =
        billingCycle === 'monthly' ? pricing.pricing.monthly : pricing.pricing.yearly;

      const response = await fetch('/api/google-pay/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: `${featureId}_${billingCycle}`,
          userId: 'current-user',
          paymentMethod,
          billingCycle,
          amount,
          currency: pricing.pricing.currency,
        }),
      });

      const result = (await response.json()) as PaymentIntentResponse;
      const intentId = result.paymentIntent?.id;

      if (intentId) {
        window.location.href = `/checkout/${paymentMethod}?intent=${encodeURIComponent(intentId)}`;
        return;
      }

      setShowPricingDialog(false);
      onUpgradeRequired?.();
    } finally {
      setLoading(false);
    }
  };

  if (hasAccess) {
    return <>{children}</>;
  }

  if (isActive) {
    return (
      <Box className={className}>
        {children}
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<Timer />}
            label={`Trial aktiv${daysLeft > 0 ? ` - ${daysLeft} dager igjen` : ''}`}
            color="warning"
            size="small"
            variant="outlined"
          />
          <Button size="small" startIcon={<Upgrade />} onClick={handleUpgrade} variant="outlined">
            Oppgrader
          </Button>
        </Box>
      </Box>
    );
  }

  const renderTrialPrompt = () => {
    if (!feature || !pricing) {
      return null;
    }

    const price =
      billingCycle === 'monthly' ? pricing.pricing.monthly : pricing.pricing.yearly;
    const savings =
      billingCycle === 'yearly'
        ? pricingService.getYearlySavings(pricing.pricing.monthly, pricing.pricing.yearly)
        : 0;

    switch (variant) {
      case 'banner':
        return (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<AutoAwesome />} onClick={openTrialDialog} variant="outlined">
                  Prøv gratis
                </Button>
                <Button size="small" startIcon={<Upgrade />} onClick={handleUpgrade} variant="contained">
                  {pricingService.formatPrice(price)}
                </Button>
              </Box>
            }
          >
            <Typography variant="body2">
              <strong>{feature.name}</strong> - {pricingService.formatPrice(price)}/måned
            </Typography>
          </Alert>
        );

      case 'inline':
        return (
          <Box
            sx={{
              p: 2,
              mb: 2,
              bgcolor: 'primary.5',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'primary.20',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AutoAwesome color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {feature.name} - {pricingService.formatPrice(price)}/måned
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<AutoAwesome />} onClick={openTrialDialog} variant="outlined">
                  Prøv gratis
                </Button>
                <Button size="small" startIcon={<Upgrade />} onClick={handleUpgrade} variant="contained">
                  Kjøp
                </Button>
              </Box>
            </Box>
          </Box>
        );

      case 'minimal':
        return (
          <Tooltip
            title={`Prøv ${feature.name} gratis eller kjøp for ${pricingService.formatPrice(price)}/måned`}
          >
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" onClick={openTrialDialog} sx={{ color: 'primary.main' }}>
                <AutoAwesome />
              </IconButton>
              <IconButton size="small" onClick={handleUpgrade} sx={{ color: 'success.main' }}>
                <Upgrade />
              </IconButton>
            </Box>
          </Tooltip>
        );

      case 'card':
      default:
        return (
          <Card
            sx={{
              mt: 2,
              bgcolor: 'primary.5',
              border: '1px solid',
              borderColor: 'primary.20',
              position: 'relative',
              overflow: 'hidden',
              ...theming.getThemedCardSx(),
            }}
          >
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: feature.color || 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.5rem',
                  }}
                >
                  {feature.icon || '⭐'}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {feature.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {feature.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Chip
                      label={`${feature.trialDuration} dager gratis`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip label={feature.category} size="small" />
                    {billingCycle === 'yearly' && savings > 0 && (
                      <Chip
                        label={`Spar ${pricingService.formatPrice(savings)}`}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                    {pricingService.formatPrice(price)}
                    <Typography component="span" variant="body2" color="text.secondary">
                      /{billingCycle === 'monthly' ? 'måned' : 'år'}
                    </Typography>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" startIcon={<AutoAwesome />} onClick={openTrialDialog} size="small">
                      Prøv gratis
                    </Button>
                    <Button variant="contained" startIcon={<Upgrade />} onClick={handleUpgrade} size="small">
                      Kjøp nå
                    </Button>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <Box className={className}>
      {fallbackComponent ?? children}
      {renderTrialPrompt()}

      {feature && (
        <TrialActivationDialog
          open={showTrialDialog}
          feature={feature}
          onAccept={() => {
            void handleTrialStart();
          }}
          onDecline={() => setShowTrialDialog(false)}
          onUpgrade={handleUpgrade}
          trialStatus={trialStatus}
          loading={loading}
        />
      )}

      <Dialog open={showPricingDialog} onClose={() => setShowPricingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Oppgrader til {feature?.name}</DialogTitle>
        <DialogContent>
          {pricing && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Velg faktureringssyklus
                </Typography>
                <FormControl component="fieldset">
                  <RadioGroup
                    value={billingCycle}
                    onChange={(event) => setBillingCycle(event.target.value as 'monthly' | 'yearly')}
                  >
                    <FormControlLabel
                      value="monthly"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            Månedlig - {pricingService.formatPrice(pricing.pricing.monthly)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Faktureres hver måned
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="yearly"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            Årlig - {pricingService.formatPrice(pricing.pricing.yearly)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Spar{' '}
                            {pricingService.calculateYearlyDiscount(
                              pricing.pricing.monthly,
                              pricing.pricing.yearly,
                            )}
                            % - faktureres årlig
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Velg betalingsmetode
                </Typography>
                <FormControl component="fieldset">
                  <RadioGroup
                    value={selectedPaymentMethod}
                    onChange={(event) => setSelectedPaymentMethod(event.target.value as PaymentMethod)}
                  >
                    <FormControlLabel
                      value="google-pay"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Google color="primary" />
                          <Typography>Google Pay</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="stripe"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CreditCard color="primary" />
                          <Typography>Kort (Stripe)</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="vipps"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone color="primary" />
                          <Typography>Vipps</Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Inkluderte funksjoner
                </Typography>
                <List dense>
                  {feature?.benefits.map((benefit) => (
                    <ListItem key={benefit}>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText primary={benefit} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPricingDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              void handlePayment(selectedPaymentMethod);
            }}
            disabled={loading}
            startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <Upgrade />}
          >
            {loading
              ? 'Behandler...'
              : `Betal ${pricingService.formatPrice(
                  billingCycle === 'monthly' ? pricing?.pricing.monthly ?? 0 : pricing?.pricing.yearly ?? 0,
                )}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
