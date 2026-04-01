/**
 * CreatorHub Norge - Subscription Selection Flow
 * Beautiful subscription plan selection with payment integration
 */

import React, { useState, useEffect } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Avatar,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  CreditCard as CreditCardIcon,
  Google as GoogleIcon,
  Phone as VippsIcon,
  AttachMoney as MoneyIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  AutoAwesome as AutoAwesomeIcon,
  Business as BusinessIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Info as InfoIcon,
  Diamond as DiamondIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { googlePayService } from '@/services/GooglePayService';

interface SubscriptionPlan {
  id: string;
  name: string;
  profession: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  maxUsers: number;
  maxProjects: number;
  storageLimit: number;
  popular?: boolean;
  trialDays?: number;
  description?: string; 
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  available: boolean; 
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'google-pay',
    name: 'Google Pay',
    icon: <GoogleIcon />,
    color: '#4285F0',
    available: false,
  },
  {
    id: 'stripe',
    name: 'Kort (Visa/Mastercard)',
    icon: <CreditCardIcon />,
    color: '#635BF0',
    available: true,
  },
  {
    id: 'vipps',
    name: 'Vipps',
    icon: <VippsIcon />,
    color: '#FF5B20',
    available: true,
  },
];

const PROFESSION_ICONS = {
  photographer: <BusinessIcon sx={{ color: '#2e7d32'}} />,
  videographer: <SpeedIcon sx={{ color: '#1565c0'}} />,
  music_producer: <AutoAwesomeIcon sx={{ color: '#7b1fa2'}} />,
  vendor: <TrendingUpIcon sx={{ color: '#ff8c00'}} />,
};

const PROFESSION_COLORS = {
  photographer: '#2e7d30',
  videographer: '#1565c0',
  music_producer: '#7b1fa0',
  vendor: '#ff8c00',
};

interface SubscriptionSelectionFlowProps {
  profession: string;
  requestId?: string | null;
  fromInvite?: boolean;
  onComplete?: (
    plan: SubscriptionPlan,
    paymentMethod: string,
    transactionId?: string,
  ) => void;
  onBack?: () => void;
}

export default function SubscriptionSelectionFlow({
  profession: propProfession,
  requestId,
  fromInvite = false,
  onComplete,
  onBack,
}: SubscriptionSelectionFlowProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { auth } = useEnhancedMasterIntegration();
  const { profession: adapterProfession } = useProfessionAdapter();

  const activeProfession = propProfession || adapterProfession || (user as any)?.profession || 'photographer';
  
  // Theming system - use dynamic profession
  const theming = useTheming(activeProfession);

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    PAYMENT_METHODS.find((method) => method.available)?.id || '',
  );
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const availablePaymentMethods = PAYMENT_METHODS.filter((method) => method.available);

  useEffect(() => {
    if (
      availablePaymentMethods.length > 0 &&
      !availablePaymentMethods.some((method) => method.id === selectedPaymentMethod)
    ) {
      setSelectedPaymentMethod(availablePaymentMethods[0].id);
    }
  }, [availablePaymentMethods, selectedPaymentMethod]);

  // Fetch subscription plans for the profession
  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['/api/platform/subscription-plans', activeProfession],
    queryFn: async () => {
      const data = await apiRequest('/api/platform/subscription-plans');
      const payload = typeof data === 'object' && data !== null ? data as {
        plans?: Array<{
          id?: string;
          name?: string;
          displayName?: string;
          price?: number;
          currency?: string;
          billingCycle?: string;
          features?: string[];
          isActive?: boolean;
          isPopular?: boolean;
          popular?: boolean;
          trialDays?: number;
          description?: string;
          limits?: {
            maxUsers?: number;
            maxProjects?: number;
            maxStorageGB?: number;
          };
        }>;
      } : {};

      const plans = Array.isArray(payload.plans)
        ? payload.plans.map((plan) => ({
            id: typeof plan.id === 'string' ? plan.id : 'unknown',
            name: typeof plan.displayName === 'string' ? plan.displayName : (plan.name || 'Ukjent plan'),
            profession: activeProfession,
            price: typeof plan.price === 'number' ? Math.round(plan.price * 100) : 0,
            currency: typeof plan.currency === 'string' ? plan.currency : 'NOK',
            interval: plan.billingCycle === 'yearly' ? 'year' : 'month',
            features: Array.isArray(plan.features) ? plan.features : [],
            maxUsers: typeof plan.limits?.maxUsers === 'number' ? plan.limits.maxUsers : 1,
            maxProjects: typeof plan.limits?.maxProjects === 'number' ? plan.limits.maxProjects : 0,
            storageLimit: typeof plan.limits?.maxStorageGB === 'number' ? plan.limits.maxStorageGB : 0,
            popular: Boolean(plan.isPopular ?? plan.popular),
            trialDays: typeof plan.trialDays === 'number' ? plan.trialDays : 0,
            description: typeof plan.description === 'string' ? plan.description : undefined,
          }))
        : [];

      return { plans };
    },
    enabled: !!activeProfession,
    retry: 1,
  });

  const plans: SubscriptionPlan[] = plansData?.plans || [];

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async ({ plan, paymentMethod }: { plan: SubscriptionPlan; paymentMethod: string }) => {
      setPaymentProcessing(true);
      
      if (paymentMethod === 'google-pay') {
        // Use Google Pay service for Google Pay payments
        const paymentIntent = {
          id: `payment_${Date.now()}`,
          amount: plan.price,
          currency: plan.currency,
          productName: plan.name,
          description: plan.description || `Subscription for ${plan.name}`,
          userId: user?.id,
          metadata: {
            planId: plan.id,
            profession: activeProfession,
            requestId,
            recurring: plan.interval === 'month' || plan.interval === 'year',
            billingPeriod: plan.interval,
          },
        };

        const result = await googlePayService.processSubscriptionPayment(
          paymentIntent,
          {
            recurringInterval: plan.interval === 'year' ? 'yearly' : 'monthly',
            trialPeriod: plan.trialDays || 0,
          },
          {
            requestEmail: true,
            requestShipping: false,
          }
        );

        if (!result.success) {
          throw new Error(result.error || 'Google Pay payment failed');
        }

        return {
          success: true,
          transactionId: (result as any).transactionId || (result as any).transactiond,
          paymentMethod: 'google-pay',
          plan: plan,
      };
    } else {
        // Use generic payment processing for other methods
        const authHeader = await auth.getAuthHeader();
        const response = await fetch('/api/payments/create-payment-intent', {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: plan.id,
            paymentMethod,
            amount: plan.price,
            currency: plan.currency,
            userId: user?.id,
            requestId,
            profession: activeProfession,
          }),
        });

        if (!response.ok) throw new Error('Payment failed');
        return response.json();
      }
    },
    onSuccess: (result) => {
      const transactionId = (result as any).transactionId || (result as any).transactiond;
      // Store payment success (server-first)
      const payload = {
        plan: selectedPlan,
        paymentMethod: selectedPaymentMethod,
        transactionId,
        timestamp: new Date().toISOString(),
      };
      fetch('/api/user/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'paymentCompleted', value: payload })
      }).catch(() => {});
      localStorage.setItem('paymentCompleted', JSON.stringify(payload));

      toast({
        title: 'Betaling fullført, !',
        description: 'Din abonnementsplan er aktivert. Admin vil sende deg en e-post med tilgang.',
        variant: 'default',
      });

      const nextParams = new URLSearchParams();
      nextParams.set('profession', activeProfession);
      nextParams.set('payment', 'success');
      if (requestId) {
        nextParams.set('requestId', requestId);
      }
      if (fromInvite) {
        nextParams.set('fromInvite', 'true');
      }

      navigate(`/subscription-selection?${nextParams.toString()}`);
      onComplete?.(selectedPlan!, selectedPaymentMethod, transactionId);
    },
    onError: (error) => {
      toast({
        title: 'Betaling feilet',
        description: error.message || 'Kunne ikke fullføre betalingen',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setPaymentProcessing(false);
      setShowPaymentDialog(false);
    },
  });

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
  };

  const handlePaymentSelect = (method: string) => {
    setSelectedPaymentMethod(method);
  };

  const handleContinueToPayment = () => {
    if (!selectedPlan) {
      toast({
        title: 'Velg en plan',
        description: 'Du må velge en abonnementsplan før du kan fortsette',
        variant: 'destructive',
      });
      return;
  }

    if (availablePaymentMethods.length === 0) {
      toast({
        title: 'Betaling midlertidig utilgjengelig',
        description: 'Abonnementsplanene er tilgjengelige, men betalingsgatewayene er ikke aktivert på serveren ennå.',
        variant: 'destructive',
      });
      return;
    }
    setShowPaymentDialog(true);
};

  const handleProcessPayment = () => {
    if (selectedPlan && selectedPaymentMethod) {
      paymentMutation.mutate({
        plan: selectedPlan,
        paymentMethod: selectedPaymentMethod,
    });
  }
};

  const handleBack = () => {
    onBack?.();
};

  const professionColor = PROFESSION_COLORS[activeProfession as keyof typeof PROFESSION_COLORS] || '#ff8c00';
  const professionIcon = PROFESSION_ICONS[activeProfession as keyof typeof PROFESSION_ICONS] || <BusinessIcon />;

  if (plansLoading) {
    return (
      <Box sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <LinearProgress 
            sx={{ 
              mb: 2,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: professionColor,
              }
            }} 
          />
          <Typography variant="h6" sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 500,
          }}>
            Laster abonnementsplaner...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (plansError) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            backgroundColor: 'rgba(211, 47, 47, 0.1)',
            border: '1px solid rgba(211, 47, 47, 0.3)',
            borderRadius: '12px',
          }}
        >
          <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
            Kunne ikke laste abonnementsplaner
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {plansError instanceof Error ? plansError.message : 'En ukjent feil oppstod'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mt: 1 }}>
            Profession: {activeProfession}
          </Typography>
        </Alert>
        {onBack && (
          <Button
            variant="outlined"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            sx={{
              borderColor: professionColor,
              color: professionColor,
              '&:hover': {
                borderColor: professionColor,
                bgcolor: `${professionColor}15`,
              }
            }}
          >
            Tilbake
          </Button>
        )}
      </Box>
    );
  }

  if (plans.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            backgroundColor: `${professionColor}20`,
            border: `1px solid ${professionColor}40`,
            borderRadius: '12px',
          }}
        >
          <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
            Ingen abonnementsplaner tilgjengelig
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Det er for øyeblikket ingen abonnementsplaner tilgjengelig for {activeProfession}.
            Vennligst kontakt support for mer informasjon.
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mt: 1 }}>
            Profession: {activeProfession}
          </Typography>
        </Alert>
        {onBack && (
          <Button
            variant="outlined"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            sx={{
              borderColor: professionColor,
              color: professionColor,
              '&:hover': {
                borderColor: professionColor,
                bgcolor: `${professionColor}15`,
              }
            }}
          >
            Tilbake
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* Plans Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {plans.map((plan) => (
          <Grid size={{ xs: 12, md: 4 }} key={plan.id}>
            <Card
              sx={{
                height: '100%',
                border: selectedPlan?.id === plan.id 
                  ? `2px solid ${professionColor}` 
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                background: selectedPlan?.id === plan.id
                  ? `linear-gradient(135deg, ${professionColor}15 0%, ${professionColor}08 100%)`
                  : 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'visible',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: `0 12px 32px ${professionColor}30`,
                  border: `2px solid ${professionColor}60`,
                },
              }}>
              {plan.popular && (
                <Chip
                  label="Populær"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    bgcolor: professionColor,
                    color: 'white',
                    fontWeight: 700,
                    boxShadow: `0 4px 12px ${professionColor}60`,
                    zIndex: 1,
                  }}
                />
              )}

              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ 
                    fontWeight: 700, 
                    mb: 1.5, 
                    color: '#fff',
                    fontSize: '1.5rem',
                  }}>
                    {plan.name}
                  </Typography>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="h3" sx={{ 
                      color: professionColor, 
                      fontWeight: 800,
                      fontSize: '2.5rem',
                      lineHeight: 1,
                    }}>
                      {formatPrice(plan.price, plan.currency)}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.6)',
                      mt: 0.5,
                    }}>
                      per {plan.interval === 'month' ? 'måned' : 'år'}
                    </Typography>
                  </Box>
                </Box>

                {plan.description && (
                  <Typography variant="body2" sx={{ 
                    color: 'rgba(255, 255, 255, 0.7)',
                    mb: 2,
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}>
                    {plan.description}
                  </Typography>
                )}

                <List dense sx={{ flex: 1, mb: 3 }}>
                  {plan.features.slice(0, 6).map((feature, index) => (
                    <ListItem key={index} sx={{ px: 0, py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckIcon sx={{ 
                          color: professionColor, 
                          fontSize: 20,
                          filter: `drop-shadow(0 2px 4px ${professionColor}40)`,
                        }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={feature}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          sx: { color: 'rgba(255, 255, 255, 0.9)' }
                        }}
                      />
                    </ListItem>
                  ))}
                  {plan.features.length > 6 && (
                    <ListItem sx={{ px: 0, py: 0.75 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckIcon sx={{ 
                          color: professionColor, 
                          fontSize: 20,
                          filter: `drop-shadow(0 2px 4px ${professionColor}40)`,
                        }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`+${plan.features.length - 6} flere funksjoner`}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          sx: { color: 'rgba(255, 255, 255, 0.6)' }
                        }}
                      />
                    </ListItem>
                  )}
                </List>

                <Divider sx={{ 
                  my: 2,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }} />

                <Grid container spacing={2} sx={{ textAlign: 'center', mb: 3 }}>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255, 255, 255, 0.5)',
                      display: 'block',
                      mb: 0.5,
                    }}>
                      Brukere
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: '1rem',
                    }}>
                      {plan.maxUsers}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255, 255, 255, 0.5)',
                      display: 'block',
                      mb: 0.5,
                    }}>
                      Prosjekter
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: '1rem',
                    }}>
                      {plan.maxProjects}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255, 255, 255, 0.5)',
                      display: 'block',
                      mb: 0.5,
                    }}>
                      Lagring
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: '1rem',
                    }}>
                      {plan.storageLimit}GB
                    </Typography>
                  </Grid>
                </Grid>

                <Button
                  variant={selectedPlan?.id === plan.id ? 'contained' : 'outlined'}
                  fullWidth
                  onClick={() => handlePlanSelect(plan)}
                  sx={{
                    bgcolor: selectedPlan?.id === plan.id 
                      ? `linear-gradient(135deg, ${professionColor} 0%, ${professionColor}dd 100%)`
                      : 'transparent',
                    borderColor: professionColor,
                    borderWidth: '2px',
                    color: selectedPlan?.id === plan.id ? 'white' : professionColor,
                    borderRadius: '12px',
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: selectedPlan?.id === plan.id 
                      ? `0 4px 16px ${professionColor}50`
                      : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: selectedPlan?.id === plan.id 
                        ? `linear-gradient(135deg, ${professionColor}dd 0%, ${professionColor} 100%)`
                        : `${professionColor}15`,
                      borderColor: professionColor,
                      transform: 'translateY(-2px)',
                      boxShadow: selectedPlan?.id === plan.id 
                        ? `0 6px 20px ${professionColor}60`
                        : `0 4px 12px ${professionColor}30`,
                    }
                  }}
                >
                  {selectedPlan?.id === plan.id ? '✓ Valgt' : 'Velg plan'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Continue Button */}
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleContinueToPayment}
          disabled={!selectedPlan || availablePaymentMethods.length === 0}
          startIcon={<ArrowForwardIcon />}
          sx={{
            background: `linear-gradient(135deg, ${professionColor} 0%, ${professionColor}dd 100%)`,
            py: 2,
            px: 6,
            fontSize: '18px',
            fontWeight: 700,
            borderRadius: '16px',
            textTransform: 'none',
            boxShadow: `0 8px 24px ${professionColor}50`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: `linear-gradient(135deg, ${professionColor}dd 0%, ${professionColor} 100%)`,
              transform: 'translateY(-2px)',
              boxShadow: `0 12px 32px ${professionColor}60`,
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
              boxShadow: 'none',
            }
          }}
        >
          {availablePaymentMethods.length === 0 ? 'Betaling kommer snart' : 'Fortsett til betaling'}
        </Button>

        {selectedPlan && availablePaymentMethods.length === 0 && (
          <Alert
            severity="warning"
            sx={{
              mt: 2,
              maxWidth: 640,
              mx: 'auto',
              textAlign: 'left',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '12px',
              '& .MuiAlert-icon': {
                color: '#f59e0b',
              },
            }}
          >
            Online betaling er midlertidig utilgjengelig. Planene kan fortsatt vises, men checkout aktiveres først når betalingsrutene er koblet til backenden.
          </Alert>
        )}
      </Box>

      {/* Payment Dialog */}
      <Dialog 
        open={showPaymentDialog} 
        onClose={() => setShowPaymentDialog(false)} 
        maxWidth="sm" 
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '24px',
              background: 'rgba(26, 26, 46, 0.92)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              overflow: 'visible'
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${professionColor} 0%, ${professionColor}dd 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: `0 4px 12px ${professionColor}60`,
            }}>
              <MoneyIcon sx={{ fontSize: 24 }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>Betalingsmetode</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            mb: 3,
            lineHeight: 1.6,
          }}>
            Velg hvordan du vil betale for {selectedPlan?.name}
          </Typography>

          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={selectedPaymentMethod}
              onChange={(e) => handlePaymentSelect(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <FormControlLabel
                  key={method.id}
                  value={method.id}
                  control={<Radio sx={{ 
                    color: method.available ? method.color : 'rgba(255, 255, 255, 0.3)',
                    '&.Mui-checked': {
                      color: method.color,
                    }
                  }} />}
                  label={
                    <Stack 
                      direction="row" 
                      alignItems="center" 
                      spacing={2}
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: '12px',
                        background: selectedPaymentMethod === method.id 
                          ? `${method.color}20`
                          : 'rgba(255, 255, 255, 0.05)',
                        border: selectedPaymentMethod === method.id
                          ? `1.5px solid ${method.color}60`
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s ease',
                        width: '100%',
                      }}
                    >
                      <Box sx={{ 
                        color: method.color,
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        {method.icon}
                      </Box>
                      <Typography sx={{ 
                        color: method.available ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                        fontWeight: 600,
                      }}>
                        {method.name}
                      </Typography>
                      {!method.available && (
                        <Chip 
                          label="Kommer snart" 
                          size="small" 
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Stack>
                }
                  disabled={!method.available}
                  sx={{
                    width: '100%',
                    m: 0,
                    mb: 1.5,
                  }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {selectedPlan && (
            <Alert 
              severity="info" 
              sx={{ 
                mt: 3,
                backgroundColor: `${professionColor}20`,
                border: `1px solid ${professionColor}40`,
                borderRadius: '12px',
                '& .MuiAlert-icon': {
                  color: professionColor,
                }
              }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Du vil bli belastet <strong>{formatPrice(selectedPlan.price, selectedPlan.currency)}</strong> per {selectedPlan.interval === 'month' ? 'måned' : 'år'}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          pt: 2,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <Button 
            onClick={() => setShowPaymentDialog(false)}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              textTransform: 'none',
              '&:hover': {
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained"
            onClick={handleProcessPayment}
            disabled={paymentProcessing}
            sx={{ 
              background: `linear-gradient(135deg, ${professionColor} 0%, ${professionColor}dd 100%)`,
              color: 'white',
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              borderRadius: '12px',
              boxShadow: `0 4px 16px ${professionColor}50`,
              '&:hover': {
                background: `linear-gradient(135deg, ${professionColor}dd 0%, ${professionColor} 100%)`,
                boxShadow: `0 6px 20px ${professionColor}60`,
              },
              '&:disabled': {
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.3)',
              }
            }}
          >
            {paymentProcessing ? 'Behandler betaling...' : 'Betal nå'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
