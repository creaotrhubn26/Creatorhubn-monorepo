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
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
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
import type { AppLanguage } from '@/components/language-provider';

interface SubscriptionPlan {
  id: string;
  name: string;
  profession: string;
  price: number;
  monthlyPrice?: number;
  yearlyPrice?: number;
  yearlySavingsLabel?: string;
  currency: string;
  interval: string;
  features: string[];
  maxUsers: number;
  maxProjects: number;
  storageLimit: number;
  popular?: boolean;
  trialDays?: number;
  description?: string;
  isPublic?: boolean;
  contactSalesOnly?: boolean;
  publicPriceLabel?: string;
  ctaLabel?: string;
}

type BillingCycle = 'monthly' | 'yearly';

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
    name: 'Stripe',
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
  language?: AppLanguage;
  requestId?: string | null;
  initialPlanId?: string | null;
  initialBillingCycle?: BillingCycle | null;
  fromInvite?: boolean;
  onComplete?: (
    plan: SubscriptionPlan,
    paymentMethod: string,
    transactionId?: string,
  ) => void;
  onBack?: () => void;
}

const subscriptionFlowCopy: Record<
  AppLanguage,
  {
    planLabel: string;
    planSummaryLabel: string;
    priceLabel: string;
    billingLabel: string;
    billingMonthly: string;
    billingYearly: string;
    cadenceMonth: string;
    cadenceYear: string;
    choosePlanTitle: string;
    choosePlanDescription: string;
    paymentFailedTitle: string;
    paymentFailedDescription: string;
    paymentCompletedTitle: string;
    paymentCompletedDescription: string;
    redirectingTitle: string;
    redirectingDescription: string;
    enterpriseTitle: string;
    enterpriseDescription: string;
    enterpriseEmailSubject: string;
    paymentUnavailableTitle: string;
    paymentUnavailableDescription: string;
    loadingTitle: string;
    loadingDescription: string;
    errorTitle: string;
    unknownError: string;
    professionLabel: string;
    noPlansTitle: string;
    noPlansDescription: (profession: string) => string;
    back: string;
    heroTitle: string;
    heroDescription: string;
    checklist: string[];
    billingToggleTitle: string;
    billingToggleDescription: string;
    yearlyBadge: string;
    selectedButton: string;
    choosePlanButton: string;
    contactSales: string;
    stripeCheckoutHint: string;
    continueToPayment: string;
    paymentComingSoon: string;
    paymentComingSoonInline: string;
    dialogTitle: string;
    dialogReady: string;
    dialogDescription: string;
    stripeCardBody: string;
    summaryTitle: string;
    redirectNotice: string;
    afterPaymentTitle: string;
    afterPaymentCreated: (planName: string) => string;
    afterPaymentReturn: string;
    afterPaymentManage: string;
    cancel: string;
    goToStripe: string;
    sendingToStripe: string;
  }
> = {
  no: {
    planLabel: 'CreatorHub-abonnement',
    planSummaryLabel: 'Plan',
    priceLabel: 'Pris',
    billingLabel: 'Fakturering',
    billingMonthly: 'Månedlig',
    billingYearly: 'Årlig',
    cadenceMonth: 'måned',
    cadenceYear: 'år',
    choosePlanTitle: 'Velg en plan',
    choosePlanDescription: 'Du må velge en abonnementsplan før du kan fortsette',
    paymentFailedTitle: 'Betaling feilet',
    paymentFailedDescription: 'Kunne ikke fullføre betalingen',
    paymentCompletedTitle: 'Betaling fullført',
    paymentCompletedDescription:
      'Abonnementet ditt er aktivert. Du får e-post med bekreftelse og videre tilgang.',
    redirectingTitle: 'Sender deg til Stripe',
    redirectingDescription: 'Du blir sendt til sikker betaling i Stripe.',
    enterpriseTitle: 'Enterprise settes opp med CreatorHub',
    enterpriseDescription: 'Kontakt hello@creatorhubn.com for demo, onboarding og tilbud.',
    enterpriseEmailSubject: 'CreatorHub Enterprise – forespørsel om demo og tilbud',
    paymentUnavailableTitle: 'Betaling midlertidig utilgjengelig',
    paymentUnavailableDescription:
      'Abonnementsplanene er tilgjengelige, men betalingsgatewayene er ikke aktivert på serveren ennå.',
    loadingTitle: 'Laster abonnementssiden',
    loadingDescription:
      'Vi henter planer, priser og faktureringsvalg fra CreatorHub slik at landingssiden og betalingsflyten viser samme informasjon.',
    errorTitle: 'Kunne ikke laste abonnementsplaner',
    unknownError: 'En ukjent feil oppstod',
    professionLabel: 'Profesjon',
    noPlansTitle: 'Ingen abonnementsplaner tilgjengelig',
    noPlansDescription: (profession) =>
      `Det er for øyeblikket ingen abonnementsplaner tilgjengelig for ${profession}. Vennligst kontakt support for mer informasjon.`,
    back: 'Tilbake',
    heroTitle: 'Velg nivået som matcher arbeidsflyten din, og fullfør betalingen i Stripe.',
    heroDescription:
      'Du velger plan her, går til sikker betaling i Stripe, og returnerer deretter til CreatorHub med bekreftet abonnement.',
    checklist: [
      'Sikker betaling via Stripe',
      'Bytt mellom månedlig og årlig fakturering uten å skifte flyt',
      'Enterprise settes opp separat med demo og onboarding',
      'Returnerer automatisk til CreatorHub etter betaling',
    ],
    billingToggleTitle: 'Velg fakturering',
    billingToggleDescription:
      'Årlig fakturering gir høyere kontraktsverdi og holder prisen tydelig med 2 måneder gratis.',
    yearlyBadge: '2 måneder gratis på alle selvbetjente årsplaner',
    selectedButton: '✓ Valgt',
    choosePlanButton: 'Velg plan',
    contactSales: 'Kontakt salg',
    stripeCheckoutHint:
      'Stripe viser full betalingsdetalj og eventuell avgiftsberegning før du bekrefter.',
    continueToPayment: 'Fortsett til sikker betaling',
    paymentComingSoon: 'Betaling kommer snart',
    paymentComingSoonInline:
      'Online betaling er midlertidig utilgjengelig. Planene kan fortsatt vises, men betaling aktiveres først når betalingsrutene er koblet til backenden.',
    dialogTitle: 'Bekreft planen før du går til betaling',
    dialogReady: 'Klar til sikker betaling i Stripe.',
    dialogDescription:
      'Her ser du akkurat hva som aktiveres. Når du fortsetter, åpnes Stripe i samme flyt og du returnerer til CreatorHub med oppdatert abonnementsstatus.',
    stripeCardBody:
      'Kortdetaljer, kvittering og eventuell avgiftsberegning håndteres på Stripes sikre betalingsside.',
    summaryTitle: 'Oppsummering',
    redirectNotice:
      'Du blir sendt til Stripe for å fullføre abonnementet på en sikker side før du returnerer til CreatorHub.',
    afterPaymentTitle: 'Hva skjer etter betaling',
    afterPaymentCreated: (planName) => `Abonnementet på ${planName} opprettes i Stripe.`,
    afterPaymentReturn: 'Du sendes tilbake til CreatorHub med oppdatert status.',
    afterPaymentManage: 'Du kan administrere abonnementet videre fra CreatorHub.',
    cancel: 'Avbryt',
    goToStripe: 'Gå til Stripe',
    sendingToStripe: 'Sender til Stripe...',
  },
  en: {
    planLabel: 'CreatorHub subscription',
    planSummaryLabel: 'Plan',
    priceLabel: 'Price',
    billingLabel: 'Billing',
    billingMonthly: 'Monthly',
    billingYearly: 'Annual',
    cadenceMonth: 'month',
    cadenceYear: 'year',
    choosePlanTitle: 'Choose a plan',
    choosePlanDescription: 'You need to choose a subscription plan before continuing.',
    paymentFailedTitle: 'Payment failed',
    paymentFailedDescription: 'Could not complete the payment.',
    paymentCompletedTitle: 'Payment completed',
    paymentCompletedDescription:
      'Your subscription is active. You will receive a confirmation email with next steps and access details.',
    redirectingTitle: 'Sending you to Stripe',
    redirectingDescription: 'You are being sent to secure payment in Stripe Checkout.',
    enterpriseTitle: 'Enterprise is handled with CreatorHub',
    enterpriseDescription: 'Contact hello@creatorhubn.com for a demo, onboarding, and pricing.',
    enterpriseEmailSubject: 'CreatorHub Enterprise - request demo and pricing',
    paymentUnavailableTitle: 'Payments are temporarily unavailable',
    paymentUnavailableDescription:
      'The subscription plans are available, but the payment gateways are not activated on the server yet.',
    loadingTitle: 'Loading subscription page',
    loadingDescription:
      'We are loading plans, pricing, and billing options from CreatorHub so the landing page and checkout flow show the same information.',
    errorTitle: 'Could not load subscription plans',
    unknownError: 'An unknown error occurred',
    professionLabel: 'Profession',
    noPlansTitle: 'No subscription plans available',
    noPlansDescription: (profession) =>
      `There are currently no subscription plans available for ${profession}. Please contact support for more information.`,
    back: 'Back',
    heroTitle: 'Choose the level that matches your workflow and complete payment with Stripe.',
    heroDescription:
      'Select your plan here, move to secure payment in Stripe Checkout, and return to CreatorHub with a confirmed subscription.',
    checklist: [
      'Secure payment through Stripe Checkout',
      'Switch between monthly and annual billing without leaving the flow',
      'Enterprise is handled separately with demo and onboarding',
      'Automatically returns to CreatorHub after payment',
    ],
    billingToggleTitle: 'Choose billing',
    billingToggleDescription:
      'Annual billing increases contract value and keeps pricing clear with 2 months free.',
    yearlyBadge: '2 months free on all annual self-serve plans',
    selectedButton: '✓ Selected',
    choosePlanButton: 'Choose plan',
    contactSales: 'Contact sales',
    stripeCheckoutHint:
      'Stripe shows the full payment breakdown and any tax calculation in checkout before you confirm.',
    continueToPayment: 'Continue to payment',
    paymentComingSoon: 'Payment coming soon',
    paymentComingSoonInline:
      'Online payments are temporarily unavailable. Plans can still be viewed, but checkout will be activated once the payment routes are connected to the backend.',
    dialogTitle: 'Confirm your plan before going to Stripe',
    dialogReady: 'Ready for secure payment in Stripe Checkout.',
    dialogDescription:
      'This shows exactly what will be activated. When you continue, Stripe Checkout opens in the same flow and returns you to CreatorHub with an updated subscription status.',
    stripeCardBody:
      'Card details, receipts, and any tax calculation are handled on Stripe’s secure payment page.',
    summaryTitle: 'Summary',
    redirectNotice:
      'You will be sent to Stripe Checkout to complete the subscription on a secure page before returning to CreatorHub.',
    afterPaymentTitle: 'What happens after payment',
    afterPaymentCreated: (planName) => `The subscription for ${planName} is created in Stripe.`,
    afterPaymentReturn: 'You are sent back to CreatorHub with an updated status.',
    afterPaymentManage: 'You can continue managing the subscription from CreatorHub.',
    cancel: 'Cancel',
    goToStripe: 'Go to Stripe Checkout',
    sendingToStripe: 'Sending to Stripe...',
  },
};

export default function SubscriptionSelectionFlow({
  profession: propProfession,
  language = 'no',
  requestId,
  initialPlanId,
  initialBillingCycle,
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
  const locale: AppLanguage = activeProfession === 'creatorhub'
    ? 'no'
    : language === 'en'
      ? 'en'
      : 'no';
  const copy = subscriptionFlowCopy[locale];

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>(
    initialBillingCycle === 'yearly' ? 'yearly' : 'monthly',
  );
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

  useEffect(() => {
    if (initialBillingCycle === 'yearly' || initialBillingCycle === 'monthly') {
      setSelectedBillingCycle(initialBillingCycle);
    }
  }, [initialBillingCycle]);

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
          isPublic?: boolean;
          contactSalesOnly?: boolean;
          publicPriceLabel?: string | null;
          ctaLabel?: string | null;
          limits?: {
            maxUsers?: number;
            maxProjects?: number;
            maxStorageGB?: number;
          };
        }>;
      } : {};

      const plans = Array.isArray(payload.plans)
        ? payload.plans.map((plan) => {
            const monthlyPrice =
              typeof (plan as any).monthlyPrice === 'number'
                ? Math.round((plan as any).monthlyPrice * 100)
                : typeof plan.price === 'number'
                  ? Math.round(plan.price * 100)
                  : 0;
            const yearlyPrice =
              typeof (plan as any).yearlyPrice === 'number'
                ? Math.round((plan as any).yearlyPrice * 100)
                : undefined;

            return {
              id: typeof plan.id === 'string' ? plan.id : 'unknown',
              name: typeof plan.displayName === 'string' ? plan.displayName : (plan.name || 'Ukjent plan'),
              profession: activeProfession,
              price: monthlyPrice,
              monthlyPrice,
              yearlyPrice,
              yearlySavingsLabel:
                typeof (plan as any).yearlySavingsLabel === 'string'
                  ? (plan as any).yearlySavingsLabel
                  : undefined,
              currency: typeof plan.currency === 'string' ? plan.currency : 'NOK',
              interval: 'month',
              features: Array.isArray(plan.features) ? plan.features : [],
              maxUsers: typeof plan.limits?.maxUsers === 'number' ? plan.limits.maxUsers : 1,
              maxProjects: typeof plan.limits?.maxProjects === 'number' ? plan.limits.maxProjects : 0,
              storageLimit: typeof plan.limits?.maxStorageGB === 'number' ? plan.limits.maxStorageGB : 0,
              popular: Boolean(plan.isPopular ?? plan.popular),
              trialDays: typeof plan.trialDays === 'number' ? plan.trialDays : 0,
              description: typeof plan.description === 'string' ? plan.description : undefined,
              isPublic: plan.isPublic !== false,
              contactSalesOnly: Boolean(plan.contactSalesOnly),
              publicPriceLabel:
                typeof plan.publicPriceLabel === 'string' ? plan.publicPriceLabel : undefined,
              ctaLabel: typeof plan.ctaLabel === 'string' ? plan.ctaLabel : undefined,
            };
          })
        : [];

      return { plans };
    },
    enabled: !!activeProfession,
    retry: 1,
  });

  const plans: SubscriptionPlan[] = plansData?.plans || [];
  const publicPlans = plans.filter((plan) => plan.isPublic !== false);
  const selfServePlans = publicPlans.filter(
    (plan) => !plan.contactSalesOnly && plan.price > 0,
  );
  const enterprisePlan =
    publicPlans.find((plan) => plan.contactSalesOnly) || null;
  const showBillingCycleToggle = selfServePlans.some(
    (plan) => typeof plan.yearlyPrice === 'number' && plan.yearlyPrice > 0,
  );

  const resolvePlanPrice = (plan: SubscriptionPlan, billingCycle = selectedBillingCycle) => {
    if (billingCycle === 'yearly' && typeof plan.yearlyPrice === 'number' && plan.yearlyPrice > 0) {
      return plan.yearlyPrice;
    }
    return plan.monthlyPrice ?? plan.price;
  };

  const resolveCadenceLabel = (billingCycle = selectedBillingCycle) =>
    billingCycle === 'yearly' ? copy.cadenceYear : copy.cadenceMonth;

  useEffect(() => {
    if (!initialPlanId || plans.length === 0 || selectedPlan) {
      return;
    }

    const matchedPlan = plans.find((plan) => plan.id === initialPlanId);
    if (matchedPlan && !matchedPlan.contactSalesOnly && matchedPlan.price > 0) {
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
      returnParams.set('billing', selectedBillingCycle);
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
          billingCycle: selectedBillingCycle,
          paymentMethod,
          amount: resolvePlanPrice(plan),
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
          title: copy.redirectingTitle,
          description: copy.redirectingDescription,
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
        title: copy.paymentCompletedTitle,
        description: copy.paymentCompletedDescription,
        variant: 'default',
      });

      const nextParams = new URLSearchParams();
      nextParams.set('profession', activeProfession);
      nextParams.set('plan', selectedPlan!.id);
      nextParams.set('billing', selectedBillingCycle);
      nextParams.set('payment', 'success');
      if (requestId) {
        nextParams.set('requestId', requestId);
      }
      if (fromInvite) {
        nextParams.set('fromInvite', 'true');
      }
      nextParams.set('lang', locale);

      navigate(`/subscription-selection?${nextParams.toString()}`);
      onComplete?.(selectedPlan!, selectedPaymentMethod, transactionId);
    },
    onError: (error) => {
      toast({
        title: copy.paymentFailedTitle,
        description: error.message || copy.paymentFailedDescription,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setPaymentProcessing(false);
      setShowPaymentDialog(false);
    },
  });

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'nb-NO', {
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

  const selectedPlanPriceLabel = selectedPlan
    ? formatPrice(resolvePlanPrice(selectedPlan), selectedPlan.currency)
    : null;

  const selectedPlanSummaryRows = selectedPlan
    ? [
        { label: copy.planSummaryLabel, value: selectedPlan.name },
        { label: copy.priceLabel, value: `${selectedPlanPriceLabel} / ${resolveCadenceLabel()}` },
        {
          label: copy.billingLabel,
          value: selectedBillingCycle === 'yearly' ? copy.billingYearly : copy.billingMonthly,
        },
      ]
    : [];

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
  };

  const handleBillingCycleChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextBillingCycle: BillingCycle | null,
  ) => {
    if (!nextBillingCycle) {
      return;
    }
    setSelectedBillingCycle(nextBillingCycle);
  };

  const handlePaymentSelect = (method: string) => {
    setSelectedPaymentMethod(method);
  };

  const handleContinueToPayment = () => {
    if (!selectedPlan) {
      toast({
        title: copy.choosePlanTitle,
        description: copy.choosePlanDescription,
        variant: 'destructive',
      });
      return;
    }

    if (selectedPlan.contactSalesOnly) {
      toast({
        title: copy.enterpriseTitle,
        description: copy.enterpriseDescription,
        variant: 'default',
      });
      window.location.href =
        'mailto:hello@creatorhubn.com?subject=' +
        encodeURIComponent(copy.enterpriseEmailSubject);
      return;
    }

    if (availablePaymentMethods.length === 0) {
      toast({
        title: copy.paymentUnavailableTitle,
        description: copy.paymentUnavailableDescription,
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
      <Box
        sx={{
          borderRadius: '30px',
          border: '1px solid rgba(255,255,255,0.08)',
          background:
            'linear-gradient(135deg, rgba(27,21,16,0.96) 0%, rgba(18,15,23,0.92) 56%, rgba(11,11,17,0.96) 100%)',
          boxShadow: '0 28px 70px rgba(0,0,0,0.34)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: { xs: 2.5, md: 3.25 },
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, rgba(255,140,0,0.12) 0%, rgba(255,255,255,0.02) 100%)',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.8rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,186,108,0.84)',
              fontWeight: 700,
              mb: 1,
            }}
          >
            {copy.planLabel}
          </Typography>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            {copy.loadingTitle}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.68)', maxWidth: 720, lineHeight: 1.7 }}>
            {copy.loadingDescription}
          </Typography>
        </Box>

        <Box sx={{ p: { xs: 2.5, md: 3.25 } }}>
          <LinearProgress
            sx={{
              mb: 3,
              height: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: professionColor,
              },
            }}
          />

          <Grid container spacing={2.5}>
            {[0, 1, 2].map((index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Box
                  sx={{
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.035)',
                    p: 2.25,
                  }}
                >
                  <Skeleton variant="text" width="60%" height={34} sx={{ bgcolor: 'rgba(255,255,255,0.12)' }} />
                  <Skeleton variant="text" width="42%" height={56} sx={{ bgcolor: 'rgba(255,255,255,0.12)' }} />
                  <Skeleton variant="text" width="100%" height={26} sx={{ bgcolor: 'rgba(255,255,255,0.09)' }} />
                  <Skeleton variant="text" width="88%" height={26} sx={{ bgcolor: 'rgba(255,255,255,0.09)' }} />
                  <Skeleton variant="text" width="76%" height={26} sx={{ bgcolor: 'rgba(255,255,255,0.09)' }} />
                  <Skeleton variant="rounded" width="100%" height={52} sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />
                </Box>
              </Grid>
            ))}
          </Grid>
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
            {copy.errorTitle}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {plansError instanceof Error ? plansError.message : copy.unknownError}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mt: 1 }}>
            {copy.professionLabel}: {activeProfession}
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
            {copy.back}
          </Button>
        )}
      </Box>
    );
  }

  if (publicPlans.length === 0) {
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
            {copy.noPlansTitle}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {copy.noPlansDescription(activeProfession)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mt: 1 }}>
            {copy.professionLabel}: {activeProfession}
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
            {copy.back}
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
              {copy.planLabel}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '1.4rem', md: '1.8rem' },
              }}
            >
              {copy.heroTitle}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.75 }}>
              {copy.heroDescription}
            </Typography>
          </Stack>

          <Stack
            spacing={1.1}
            sx={{
              minWidth: { md: 260 },
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {copy.checklist.map((line) => (
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

      {showBillingCycleToggle && (
        <Box
          sx={{
            mb: 3.5,
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            p: { xs: 2, md: 2.4 },
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 2, md: 3 }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.6 }}>
                {copy.billingToggleTitle}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>
                {copy.billingToggleDescription}
              </Typography>
            </Box>

            <Stack spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <ToggleButtonGroup
                exclusive
                value={selectedBillingCycle}
                onChange={handleBillingCycleChange}
                sx={{
                  p: 0.5,
                  borderRadius: '999px',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  alignSelf: { xs: 'stretch', md: 'flex-end' },
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 0,
                    borderRadius: '999px !important',
                    px: 2,
                    py: 1,
                    color: 'rgba(255,255,255,0.72)',
                    textTransform: 'none',
                    fontWeight: 700,
                    '&.Mui-selected': {
                      color: '#150d05',
                      backgroundColor: '#ffba6c',
                    },
                  },
                }}
              >
                <ToggleButton value="monthly">{copy.billingMonthly}</ToggleButton>
                <ToggleButton value="yearly">{copy.billingYearly}</ToggleButton>
              </ToggleButtonGroup>
              {selectedBillingCycle === 'yearly' ? (
                <Typography
                  sx={{
                    color: 'rgba(255,186,108,0.9)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    alignSelf: { xs: 'flex-start', md: 'flex-end' },
                  }}
                >
                  {copy.yearlyBadge}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Plans Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {selfServePlans.map((plan) => (
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
                      {formatPrice(resolvePlanPrice(plan), plan.currency)}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.6)',
                      mt: 0.5,
                    }}>
                      per {resolveCadenceLabel()}
                    </Typography>
                    {selectedBillingCycle === 'yearly' && plan.yearlySavingsLabel ? (
                      <Chip
                        label={plan.yearlySavingsLabel}
                        size="small"
                        sx={{
                          mt: 1.2,
                          bgcolor: 'rgba(255,186,108,0.12)',
                          color: '#ffba6c',
                          border: '1px solid rgba(255,186,108,0.3)',
                          fontWeight: 700,
                        }}
                      />
                    ) : null}
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
                    background:
                      selectedPlan?.id === plan.id
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
                  {selectedPlan?.id === plan.id ? copy.selectedButton : plan.ctaLabel || copy.choosePlanButton}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {enterprisePlan && (
        <Box
          sx={{
            mb: 4,
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.1)',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,140,0,0.1) 100%)',
            p: { xs: 2.5, md: 3 },
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={{ xs: 2.5, lg: 3.5 }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', lg: 'center' }}
          >
            <Box sx={{ maxWidth: 820 }}>
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,186,108,0.84)',
                  fontWeight: 700,
                  mb: 1,
                }}
              >
                Enterprise
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.3rem', md: '1.55rem' } }}
              >
                {enterprisePlan.publicPriceLabel || copy.contactSales}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, mt: 1 }}>
                {enterprisePlan.description}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 0.9, sm: 1.6 }}
                sx={{ mt: 1.6, flexWrap: 'wrap' }}
              >
                {enterprisePlan.features.slice(0, 4).map((feature) => (
                  <Stack key={feature} direction="row" spacing={1} alignItems="center">
                    <CheckIcon sx={{ color: '#ffba6c', fontSize: 18 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.86)' }}>{feature}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Button
              variant="outlined"
              onClick={() => {
                window.location.href =
                  'mailto:hello@creatorhubn.com?subject=' +
                  encodeURIComponent(copy.enterpriseEmailSubject);
              }}
              endIcon={<ArrowForwardIcon />}
              sx={{
                flexShrink: 0,
                borderColor: 'rgba(255,186,108,0.45)',
                color: '#ffba6c',
                borderRadius: '999px',
                px: 3,
                py: 1.2,
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#ffba6c',
                  bgcolor: 'rgba(255,186,108,0.08)',
                },
              }}
            >
              {enterprisePlan.ctaLabel || copy.contactSales}
            </Button>
          </Stack>
        </Box>
      )}

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
              {copy.planSummaryLabel}: {selectedPlan.name}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 }}>
                {formatPrice(resolvePlanPrice(selectedPlan), selectedPlan.currency)} per{' '}
                {resolveCadenceLabel()}.
              {selectedBillingCycle === 'yearly' && selectedPlan.yearlySavingsLabel
                ? ` ${selectedPlan.yearlySavingsLabel}.`
                : ''}
              {` ${copy.stripeCheckoutHint}`}
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
          {availablePaymentMethods.length === 0 ? copy.paymentComingSoon : copy.continueToPayment}
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
            {copy.paymentComingSoonInline}
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
          pb: 2.5,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <Stack spacing={1.8}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{
                width: 52,
                height: 52,
                borderRadius: '14px',
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
                <Typography
                  sx={{
                    fontSize: '0.76rem',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,186,108,0.88)',
                    fontWeight: 700,
                    mb: 0.4,
                  }}
                >
                  CreatorHub betaling
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                  {copy.dialogTitle}
                </Typography>
              </Box>
            </Stack>

            {selectedPlan ? (
              <Box
                sx={{
                  borderRadius: '18px',
                  border: '1px solid rgba(255,186,108,0.18)',
                  background:
                    'linear-gradient(135deg, rgba(255,186,108,0.12) 0%, rgba(255,255,255,0.03) 100%)',
                  p: 2,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
                      {selectedPlan.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.68)', mt: 0.4 }}>
                      {copy.dialogReady}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                    <Typography sx={{ color: '#ffba6c', fontWeight: 800, fontSize: '1.55rem', lineHeight: 1 }}>
                      {selectedPlanPriceLabel}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.62)', mt: 0.45 }}>
                      per {resolveCadenceLabel()}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            ) : null}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.72)', mb: 3, lineHeight: 1.7 }}>
            {copy.dialogDescription}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: '100%',
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
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>Stripe</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.65 }}>
                      {copy.stripeCardBody}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: '100%',
                  p: 2.25,
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.035)',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1.2 }}>{copy.summaryTitle}</Typography>
                <Stack spacing={1}>
                  {selectedPlanSummaryRows.map((row) => (
                    <Stack
                      key={row.label}
                      direction="row"
                      justifyContent="space-between"
                      spacing={2}
                      sx={{ color: 'rgba(255,255,255,0.76)' }}
                    >
                      <Typography sx={{ color: 'rgba(255,255,255,0.56)' }}>{row.label}</Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 700, textAlign: 'right' }}>
                        {row.value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1.25,
              color: 'rgba(255, 255, 255, 0.5)',
              lineHeight: 1.7,
            }}
          >
            {copy.redirectNotice}
          </Typography>

          {selectedPlan && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                {copy.afterPaymentTitle}
              </Typography>
              <Stack spacing={1}>
                {[
                  copy.afterPaymentCreated(selectedPlan.name),
                  copy.afterPaymentReturn,
                  selectedBillingCycle === 'yearly' && selectedPlan.yearlySavingsLabel
                    ? selectedPlan.yearlySavingsLabel
                    : copy.afterPaymentManage,
                ].map((line) => (
                  <Stack key={line} direction="row" spacing={1.2} alignItems="flex-start">
                    <CheckIcon sx={{ color: '#ffba6c', fontSize: 18, mt: 0.25 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>
                      {line}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
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
            {copy.cancel}
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
            {paymentProcessing ? copy.sendingToStripe : copy.goToStripe}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
