/**
 * CreatorHub Norge - Subscription Selection Flow
 * Beautiful subscription plan selection with payment integration
 */

import React, { useState, useEffect } from 'react';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  CreditCard as CreditCardIcon,
  AttachMoney as MoneyIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
    id: 'stripe',
    name: 'Stripe Checkout',
    icon: <CreditCardIcon />,
    color: '#635BF0',
    available: true,
  },
];

const PROFESSION_COLORS = {
  creatorhub: '#ff8c00',
  photographer: '#2e7d30',
  videographer: '#1565c0',
  music_producer: '#7b1fa0',
  vendor: '#ff8c00',
  education_institution: '#b8860b',
};

interface SubscriptionSelectionFlowProps {
  profession: string;
  requestId?: string | null;
  initialPlanId?: string | null;
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
  initialPlanId,
  fromInvite = false,
  onComplete,
  onBack,
}: SubscriptionSelectionFlowProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profession: adapterProfession } = useProfessionAdapter();

  const activeProfession =
    propProfession || adapterProfession || (user as any)?.profession || 'creatorhub';

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

  useEffect(() => {
    if (!initialPlanId || plans.length === 0 || selectedPlan) {
      return;
    }

    const matchedPlan = plans.find((plan) => plan.id === initialPlanId);
    if (matchedPlan) {
      setSelectedPlan(matchedPlan);
    }
  }, [initialPlanId, plans, selectedPlan]);

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async ({ plan, paymentMethod }: { plan: SubscriptionPlan; paymentMethod: string }) => {
      setPaymentProcessing(true);

      const returnParams = new URLSearchParams();
      returnParams.set('profession', activeProfession);
      returnParams.set('plan', plan.id);
      if (requestId) {
        returnParams.set('requestId', requestId);
      }
      if (fromInvite) {
        returnParams.set('fromInvite', 'true');
      }

      return apiRequest('/api/platform/billing/checkout-session', {
        method: 'POST',
        body: {
          planId: plan.id,
          paymentMethod,
          amount: plan.price,
          currency: plan.currency,
          userId: user?.id,
          userEmail: user?.email,
          requestId,
          profession: activeProfession,
          browserOrigin: window.location.origin,
          returnPath: `/subscription-selection?${returnParams.toString()}`,
        },
      });
    },
    onSuccess: (result) => {
      if (typeof (result as any)?.checkoutUrl === 'string' && (result as any).checkoutUrl.length > 0) {
        toast({
          title: 'Sender deg til Stripe',
          description: 'Du blir sendt til sikker betaling i Stripe Checkout.',
          variant: 'default',
        });
        window.location.assign((result as any).checkoutUrl);
        return;
      }

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
      nextParams.set('plan', selectedPlan!.id);
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

  const formatPlanLimit = (value: number) => {
    if (value < 0) {
      return '∞';
    }
    return String(value);
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
      <Box
        sx={{
          mb: 4,
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          background:
            'linear-gradient(135deg, rgba(255,140,0,0.14) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0.02) 100%)',
          p: { xs: 2.5, md: 3.2 },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 2.5, md: 4 }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack spacing={1.1} sx={{ maxWidth: 720 }}>
            <Typography
              sx={{
                fontSize: '0.8rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(255,186,108,0.84)',
                fontWeight: 700,
              }}
            >
              CreatorHub-abonnement
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '1.4rem', md: '1.8rem' },
              }}
            >
              Velg nivået som matcher arbeidsflyten din, og fullfør betalingen i Stripe.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.75 }}>
              Du velger plan her, går til sikker betaling i Stripe Checkout, og returnerer deretter til CreatorHub
              med bekreftet abonnement.
            </Typography>
          </Stack>

          <Stack
            spacing={1.1}
            sx={{
              minWidth: { md: 260 },
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {[
              'Sikker betaling via Stripe Checkout',
              'Månedlig abonnement med klar pris per plan',
              'Returnerer automatisk til CreatorHub etter betaling',
            ].map((line) => (
              <Stack key={line} direction="row" spacing={1.2} alignItems="flex-start">
                <CheckIcon sx={{ color: '#ffba6c', fontSize: 20, mt: 0.2 }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.6 }}>
                  {line}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Box>

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
                      {formatPlanLimit(plan.maxUsers)}
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
                      {formatPlanLimit(plan.maxProjects)}
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
                      {plan.storageLimit < 0 ? '∞' : `${plan.storageLimit}GB`}
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
        {selectedPlan && (
          <Alert
            severity="info"
            sx={{
              mb: 2,
              maxWidth: 760,
              mx: 'auto',
              textAlign: 'left',
              backgroundColor: 'rgba(99, 91, 240, 0.12)',
              border: '1px solid rgba(99, 91, 240, 0.35)',
              borderRadius: '16px',
              '& .MuiAlert-icon': {
                color: '#8e89ff',
              },
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.6 }}>
              Valgt plan: {selectedPlan.name}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
              {formatPrice(selectedPlan.price, selectedPlan.currency)} per{' '}
              {selectedPlan.interval === 'month' ? 'måned' : 'år'}.
              Stripe viser full betalingsdetalj og eventuell avgiftsberegning i checkout før du bekrefter.
            </Typography>
          </Alert>
        )}

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
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>Sikker betaling</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                CreatorHub bruker Stripe Checkout for abonnement og kortbetaling.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 3, lineHeight: 1.7 }}>
            Du er i ferd med å aktivere <strong>{selectedPlan?.name}</strong>. Betalingen fullføres i Stripe Checkout
            før du sendes tilbake til CreatorHub.
          </Typography>

          <Box
            sx={{
              p: 2.25,
              borderRadius: '18px',
              border: '1px solid rgba(99, 91, 240, 0.35)',
              background: 'linear-gradient(135deg, rgba(99,91,240,0.18) 0%, rgba(255,255,255,0.04) 100%)',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '14px',
                  backgroundColor: 'rgba(99,91,240,0.18)',
                  color: '#8e89ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CreditCardIcon />
              </Box>
              <Stack spacing={0.75}>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>Stripe Checkout</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.65 }}>
                  Kortdetaljer og eventuell avgiftsberegning håndteres på Stripes sikre betalingsside.
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              color: 'rgba(255, 255, 255, 0.5)',
              lineHeight: 1.7,
            }}
          >
            Du blir sendt til Stripe Checkout for å fullføre abonnementet på en sikker side før du returnerer til CreatorHub.
          </Typography>

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
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.7 }}>
                Du vil starte et abonnement på <strong>{selectedPlan.name}</strong> til{' '}
                <strong>{formatPrice(selectedPlan.price, selectedPlan.currency)}</strong> per{' '}
                {selectedPlan.interval === 'month' ? 'måned' : 'år'}.
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
            {paymentProcessing ? 'Sender til Stripe...' : 'Gå til Stripe Checkout'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
