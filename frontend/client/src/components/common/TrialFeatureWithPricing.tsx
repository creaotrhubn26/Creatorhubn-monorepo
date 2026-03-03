// client/src/components/common/TrialFeatureWithPricing.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Alert,
  LinearProgress,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AutoAwesome,
  PlayArrow as PlayArrowArrow,
  Upgrade,
  Timer,
  CheckCircle,
  Close,
  Star,
  Payment,
  Google,
  CreditCard as CreditDirectionsCard,
  Phone,
  Info,
} from '@mui/icons-material';
import { TrialActivationDialog } from './TrialActivationDialog';
import { pricingService, type FeaturePricing } from '@/services/PricingService';
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
  className?: string
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
  className
}: TrialFeatureWithPricingProps) {
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'google-pay' | 'stripe' | 'vipps'>('google-pay');
  const [loading, setLoading] = useState(false);

  const {
    feature,
    trialStatus,
    hasAccess,
    isActive,
    startTrial,
    trackUsage,
    showTrialDialog,
    setShowTrialDialog
} = useTrialFeatureIntegration(featureId, componentId);

  const pricing = feature ? pricingService.getFeaturePricing(featureId) : null;

  const handleTrialStart = async () => {
    try {
      setLoading(true);
      await startTrial();
      onTrialStart?.();
  } catch (error) {
      console.error('Failed to start trial:', error);
  } finally {
      setLoading(false);
  }
};

  const handleUpgrade = () => {
    if (showPricing && pricing) {
      setShowPricingDialog(true);
  } else {
      onUpgradeRequired?.();
  }
};

  const handlePayment = async (paymentMethod: string) => {
    try {
      setLoading(true);
      
      // Track upgrade attempt
      trackUsage('upgrade_attempted');
      
      // Create payment intent
      const response = await fetch('/api/google-pay/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          productId: `${featured}_${billingCycle}`,
          userId: 'current-user', // This should come from auth context
          paymentMethod,
          billingCycle,
          amount: billingCycle === 'monthly' ? pricing?.pricing.monthly : pricing?.pricing.yearly,
          currency: pricing?.pricing.currency || 'NOK'
    })
    });

      const result = await response.json();
      
      if (result.success) {
        // Process payment based on method
        switch (paymentMethod) {
          case 'google-pay':
            await processGooglePayPayment(result.paymentIntent);
            break;
          case 'stripe':
            await processStripePayment(result.paymentIntent);
            break;
          case 'vipps':
            await processVippsPayment(result.paymentIntent);
            break;
      }
    }
  } catch (error) {
      console.error('Payment failed: ', error);
  } finally {
      setLoading(false);
  }
};

  const processGooglePayPayment = async (paymentIntent: any) => {
    // Initialize Google Pay
    if (typeof window !== 'undefined' && (window as any).google) {
      const paymentsClient = new (window as any).google.payments.api.PaymentsClient({
        environment: 'TEST' // Change to 'PRODUCTION' in production
  });

      const paymentDataRequest = {
        apiVersion:  2,
        apiVersionMinor:  0,
        allowedPaymentMethods: [{
          type: 'CAR',
          parameters: {
            allowedAuthMethods: ['PAN_ONL', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['MASTERCAR', 'VISA']
        },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWA',
            parameters: {
              gateway: 'stripe',
              gatewayMerchantId: process.env.NEXT_PUBLIC_STRIPE_MERCHANT_ID
        }
        }
      }],
        transactionInfo: {
          totalPriceStatus: 'FINA',
          totalPrice: (paymentIntent.amount / 100).toFixed(),
          currencyCode: paymentIntent.currency
    },
        merchantInfo: {
          merchantId: process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_D,
          merchantName: 'CreatorHub Norge'
    }
    };

      try {
        const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
        // Process payment with backend
        await fetch('/api/google-pay/process-payment', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json',},
          body: JSON.stringify({
            paymentData,
            paymentIntent,
            featureId,
            billingCycle
        })
      });
        
        setShowPricingDialog(false);
        onUpgradeRequired?.();
    } catch (error) {
        console.error('Google Pay payment failed:', error);
    }
  }
};

  const processStripePayment = async (paymentIntent: any) => {
    // Redirect to Stripe Checkout or use Stripe Elements
    window.location.href = `/checkout/stripe?intent=${paymentIntent.d}`;
};

  const processVippsPayment = async (paymentIntent: any) => {
    // Redirect to Vipps payment flow
    window.location.href = `/checkout/vipps?intent=${paymentIntent.d}`;
};

  // If user has access, show the feature
  if (hasAccess) {
    return <>{children}</>;
}

  // If trial is active, show feature with trial indicator
  if (isActive) {
    return (
      <Box className={className}>
        {children}
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
          <Chip
            icon={<Timer />}
            label={`Trial aktiv - ${Math.ceil((trialStatus!.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dager igjen`}
            color="warning"
            size="small"
            variant="outlined"
          />
          <Button
            size="small"
            startIcon={<Upgrade />}
            onClick={handleUpgrade}
            variant="outlined"
          >
            Oppgrader
          </Button>
        </Box>
      </Box>
    );
}

  // Show trial dialog if needed
  if (showTrialDialog && feature) {
    return (
      <>
        {fallbackComponent || children}
        <TrialActivationDialog
          open={showTrialDialog}
          feature={feature}
          onAccept={handleTrialStart}
          onDecline={() => setShowTrialDialog(false)}
          onUpgrade={handleUpgrade}
          trialStatus={trialStatus}
          loading={loading}
        />
      </>
    );
}

  // Show fallback or children with trial prompt
  const renderTrialPrompt = () => {
    if (!feature || !pricing) return null;

    const price = billingCycle === 'monthly' ? pricing.pricing.monthly : pricing.pricing.yearly;
    const savings = billingCycle === 'yearly' ? pricingService.getYearlySavings(pricing.pricing.monthly, pricing.pricing.yearly) : 0;

    switch (variant) {
      case 'banner':
        return (
          <Alert 
            severity="info" 
            action={
              <Box sx={{ display: 'flex', gap:  1 }}>
                <Button
                  size="small"
                  startIcon={theming.getThemedIcon('play')}
                  onClick={() => setShowTrialDialog(true)}
                  variant="outlined"
                >
                  Prøv gratis
                </Button>
                <Button
                  size="small"
                  startIcon={<Upgrade />}
                  onClick={handleUpgrade}
                  variant="contained"
                >
                  {pricingService.formatPrice(price)}
                </Button>
              </Box>
          }
            sx={{ mb:  2 }}
          >
            <Typography variant="body2">
              <strong>{feature.name}</strong> - {pricingService.formatPrice(price)}/måned
            </Typography>
          </Alert>
        );

      case 'inline':
        return (
          <Box sx={{ 
            p: 2, bgcolor: 'primary.5', 
            borderRadius:  1,
            border: '1px solid',
            borderColor: 'primary.20',
            mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <AutoAwesome color="primary" />
              <Box sx={{ flex:  1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {feature.name} - {pricingService.formatPrice(price)}/måned
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap:  1 }}>
                <Button
                  size="small"
                  startIcon={theming.getThemedIcon('play')}
                  onClick={() => setShowTrialDialog(true)}
                  variant="outlined"
                >
                  Prøv gratis
                </Button>
                <Button
                  size="small"
                  startIcon={<Upgrade />}
                  onClick={handleUpgrade}
                  variant="contained"
                >
                  Kjøp
                </Button>
              </Box>
            </Box>
          </Box>
        );

      case 'minimal':
        return (
          <Tooltip title={`Prøv ${feature.name} gratis eller kjøp for ${pricingService.formatPrice(price)}/måned`}>
            <Box sx={{ display: 'flex', gap: 0.5}}>
              <IconButton
                size="small"
                onClick={() => setShowTrialDialog(true)}
                sx={{ color: 'primary.main'}}
              >
                {theming.getThemedIcon('play')}
              </IconButton>
              <IconButton
                size="small"
                onClick={handleUpgrade}
                sx={{ color: 'success.main'}}
              >
                <Upgrade />
              </IconButton>
            </Box>
          </Tooltip>
        );

      case 'card':
      default: return (
          <Card sx={{ 
            mt: 2, bgcolor: 'primary.5', 
            border: '1px solid', 
            borderColor: 'primary.20',
            position: 'relative',
            overflow: 'hidden'
      ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Box
                  sx={{
                    width:  48,
                    height:  48,
                    borderRadius:  1,
                    bgcolor: feature.color || 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.5rem'
              }}
                >
                  {feature.icon || '⭐'}
                </Box>
                <Box sx={{ flex:  1 }}>
                  <Typography variant="h6" color="primary" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                    {feature.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    {feature.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  1 }}>
                    <Chip label={`${feature.trialDuration} dager gratis`} size="small" color="primary" variant="outlined" />
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
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap:  1 }}>
                  <Typography variant="h6" color="primary" sx={{  fontWeight: 'bold' }}>
                    {pricingService.formatPrice(price)}
                    <Typography component="span" variant="body2" color="text.secondary">
                      /{billingCycle === 'monthly' ? 'måned' : 'år'}
                    </Typography>
                  </Typography>
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <Button
                      variant="outlined"
                      startIcon={theming.getThemedIcon('play')}
                      onClick={() => setShowTrialDialog(true)}
                      size="small"
                    >
                      Prøv gratis
                    </Button>
                    <Button variant="contained"
                      startIcon={<Upgrade />}
                      onClick={handleUpgrade}
                      size="small"
                    >
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
      {fallbackComponent || children}
      {renderTrialPrompt()}

      {/* Pricing Dialog */}
      <Dialog open={showPricingDialog} onClose={() => setShowPricingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Upgrade color="primary" />
            Oppgrader til {feature?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          {pricing && (
            <Grid container spacing={3}>
              {/* Pricing Options */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Velg faktureringssyklus
                </Typography>
                <FormControl component="fieldset">
                  <RadioGroup
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
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
                            Spar {pricingService.calculateYearlyDiscount(pricing.pricing.monthly, pricing.pricing.yearly)}% - Faktureres årlig
                          </Typography>
                        </Box>
                    }
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {/* Payment Methods */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Velg betalingsmetode
                </Typography>
                <FormControl component="fieldset">
                  <RadioGroup
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value as any)}
                  >
                    <FormControlLabel
                      value="google-pay"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Google color="primary" />
                          <Typography>Google Pay</Typography>
                        </Box>
                    }
                    />
                    <FormControlLabel
                      value="stripe"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <CreditCard color="primary" />
                          <Typography>Kort (Stripe)</Typography>
                        </Box>
                    }
                    />
                    <FormControlLabel
                      value="vipps"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Phone color="primary" />
                          <Typography>Vipps</Typography>
                        </Box>
                    }
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {/* Features List */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Inkluderte funksjoner
                </Typography>
                <List dense>
                  {feature?.benefits.map((benefit, index) => (
                    <ListItem key={index}>
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
          <Button onClick={() => setShowPricingDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={() => handlePayment(selectedPaymentMethod)}
            disabled={loading}
            startIcon={loading ? <LinearProgress size={20} /> : theming.getThemedIcon('payment')}
          >
            {loading ? 'Behandler...' : `Betal ${pricingService.formatPrice(
              billingCycle ==='monthly' ? pricing?.pricing.monthly || 0 : pricing?.pricing.yearly || 0
            )}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
