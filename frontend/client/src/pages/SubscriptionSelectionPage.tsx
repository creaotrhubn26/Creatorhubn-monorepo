/**
 * CreatorHub Norge - Subscription Selection Page
 * Beautiful subscription selection page with payment integration
 */

import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Box,
  Container,
  Typography,
  Stack,
  Button,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Home as HomeIcon } from '@mui/icons-material';
import SubscriptionSelectionFlow from '../components/subscription/SubscriptionSelectionFlow';
import PaymentStatusVerification from '../components/subscription/PaymentStatusVerification';
import { apiRequest } from '../lib/queryClient';
import { useLanguage, type AppLanguage } from '../components/language-provider';

const normalizeAppLanguage = (value: string | null | undefined): AppLanguage =>
  value === 'en' ? 'en' : 'no';

const subscriptionPageCopy: Record<
  AppLanguage,
  {
    commerceLabel: string;
    title: string;
    subtitle: string;
    back: string;
    cancelled: string;
    successLabel: string;
    successTitle: string;
    successSubtitle: string;
    backHome: string;
    successInfo: string;
  }
> = {
  no: {
    commerceLabel: 'CreatorHub betaling',
    title: 'Velg CreatorHub-abonnement',
    subtitle:
      'Velg plan, sammenlign månedlig og årlig fakturering, og gå videre til sikker betaling i Stripe i en flyt som matcher CreatorHub-landingen.',
    back: 'Tilbake',
    cancelled:
      'Betalingen i Stripe ble avbrutt. Den valgte planen din er fortsatt valgt, så du kan fortsette når du er klar.',
    successLabel: 'CreatorHub betaling',
    successTitle: 'Betaling fullført',
    successSubtitle:
      'CreatorHub-abonnementet ditt er aktivert. Herfra kan du gå tilbake til hjemsiden og se betalings- og abonnementsoversikten din.',
    backHome: 'Tilbake til hjem',
    successInfo:
      'Stripe-betalingen er registrert. CreatorHub oppdaterer medlemskap og tilgang etter bekreftet betaling.',
  },
  en: {
    commerceLabel: 'CreatorHub Commerce',
    title: 'Choose your CreatorHub subscription',
    subtitle:
      'Pick a plan, compare monthly and annual billing, and continue to Stripe Checkout in a flow that matches the CreatorHub landing page.',
    back: 'Back',
    cancelled:
      'Stripe Checkout was cancelled. Your selected plan is still saved, so you can continue whenever you are ready.',
    successLabel: 'CreatorHub Checkout',
    successTitle: 'Payment completed',
    successSubtitle:
      'Your CreatorHub subscription is now active. From here you can go back home or continue with membership verification.',
    backHome: 'Back to home',
    successInfo:
      'The Stripe payment has been recorded. CreatorHub updates membership and access after the payment is confirmed.',
  },
};

export default function SubscriptionSelectionPage() {
  const [, navigate] = useLocation();
  const { language, setLanguage } = useLanguage();
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Get profession from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const requestedProfession = urlParams.get('profession') || 'creatorhub';
  const profession = requestedProfession || 'creatorhub';
  const initialPlanId = urlParams.get('plan');

  // Slice 9X.55 — Prototype-testere skal aldri se Stripe-checkout.
  // Hvis noen lander her med plan=prototype_tester, send dem tilbake til
  // forsiden — den ekte flyten er InviteRequestForm + admin-godkjenning.
  useEffect(() => {
    if (initialPlanId === 'prototype_tester' || requestedProfession === 'prototype_tester') {
      navigate('/?prototype_tester_pending=1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initialBillingCycle = urlParams.get('billing') === 'yearly' ? 'yearly' : 'monthly';
  const requestId = urlParams.get('requestId');
  const fromInvite = urlParams.get('fromInvite') === 'true';
  const stripeSessionId = urlParams.get('session_id');
  const hasLanguageParam = urlParams.has('lang');
  const requestedLanguage = normalizeAppLanguage(urlParams.get('lang'));
  const isCreatorHubCheckout = profession === 'creatorhub';
  const resolvedLanguage: AppLanguage = isCreatorHubCheckout
    ? 'no'
    : hasLanguageParam
      ? requestedLanguage
      : language;
  const copy = subscriptionPageCopy[resolvedLanguage];
  const theming = useTheming(isCreatorHubCheckout ? 'vendor' : profession);

  useEffect(() => {
    if (hasLanguageParam && language !== requestedLanguage) {
      setLanguage(requestedLanguage);
    }
  }, [hasLanguageParam, language, requestedLanguage, setLanguage]);

  // Check if user came from payment completion
  const paymentCompleted = urlParams.get('payment') === 'success';
  const paymentCancelled = urlParams.get('payment') === 'cancel';

  useEffect(() => {
    if (paymentCompleted) {
      if (stripeSessionId) {
        apiRequest(`/api/platform/billing/session-status?sessionId=${encodeURIComponent(stripeSessionId)}`)
          .then((status) => {
            setPaymentData({
              ...(typeof status === 'object' && status !== null ? status : {}),
              sessionId: stripeSessionId,
              transactionId:
                typeof (status as any)?.transactionId === 'string'
                  ? (status as any).transactionId
                  : stripeSessionId,
            });
            setShowPaymentStatus(true);
          })
          .catch(() => {
            setPaymentData({
              sessionId: stripeSessionId,
              transactionId: stripeSessionId,
            });
            setShowPaymentStatus(true);
          });
        return;
      }

      // Server-first payment data
      apiRequest('/api/user/kv/paymentCompleted')
        .then((j: unknown) => {
          const v = j && typeof j === 'object' && 'value' in (j as Record<string, unknown>)
            ? (j as Record<string, unknown>).value
            : j;
          if (v) {
            setPaymentData(v);
            setShowPaymentStatus(true);
            // Clear server copy best-effort
            apiRequest('/api/user/kv', {
              method: 'POST',
              body: JSON.stringify({ key: 'paymentCompleted', value: null }),
            }).catch(() => {});
          } else {
            const storedPayment = localStorage.getItem('paymentCompleted');
            if (storedPayment) {
              setPaymentData(JSON.parse(storedPayment));
              setShowPaymentStatus(true);
              localStorage.removeItem('paymentCompleted');
            }
          }
        })
        .catch(() => {
          const storedPayment = localStorage.getItem('paymentCompleted');
          if (storedPayment) {
            setPaymentData(JSON.parse(storedPayment));
            setShowPaymentStatus(true);
            localStorage.removeItem('paymentCompleted');
          }
        });
    }
  }, [paymentCompleted]);

  const handleBack = () => {
    navigate('/');
};

  const handlePaymentComplete = (
    plan: any,
    paymentMethod: string,
    transactionId?: string,
  ) => {
    // Store payment completion data
    const completedPaymentData = {
      plan,
      paymentMethod,
      transactionId,
      timestamp: new Date().toISOString(),
    };
    setPaymentData(completedPaymentData);
    setShowPaymentStatus(true);

    // Mark subscription as selected
    localStorage.setItem('subscriptionSelected', 'true');

    // Fire-and-forget receipt email request (server will resolve user via session)
    try {
      const amount = typeof plan?.price === 'number' ? plan.price : Number(plan?.price) || 0;
      apiRequest('/api/payments/send-receipt', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: transactionId || 'compat',
          requestId,
          planId: plan?.id || plan?.name || 'unknown',
          amount,
          currency: plan?.currency || 'NOK',
        }),
      }).catch(() => {});
    } catch {}

    // If user came from invite request flow, redirect to dashboard after payment
    if (fromInvite) {
      setTimeout(() => {
        // Check auto-redirect preference
        apiRequest('/api/user/ui-preferences')
          .then((data: { autoRedirectToDashboard?: boolean } | null) => {
            const shouldAutoRedirect = data?.autoRedirectToDashboard ?? true; // Default to true for new users

            if (shouldAutoRedirect) {
              // Redirect to profession-specific dashboard
              const dashboardMap: { [key: string]: string } = {
                photographer: '/photographer-dashboard-material',
                videographer: '/videographer-dashboard',
                music_producer: '/music-producer-dashboard',
                vendor: '/vendor-dashboard',
                couple: '/couple-dashboard',
                partner: '/partner-dashboard',
                admin: '/admin-dashboard'
              };
              const dashboardUrl = dashboardMap[profession] || '/photographer-dashboard-material';
              window.location.href = dashboardUrl;
            } else {
              // Go back to landing page
              navigate('/');
            }
          })
          .catch(() => {
            // Default: go to landing page
            navigate('/');
          });
      }, 2000); // Give user time to see success message
    }
};

  if (showPaymentStatus && paymentData) {
    return (
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top, rgba(255,173,80,0.18) 0%, rgba(15,10,7,0.96) 36%, #090807 100%)',
          py: { xs: 4, md: 6 },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(120deg, rgba(255,186,108,0.08) 0%, transparent 35%, rgba(110,86,255,0.08) 100%)',
          }}
        />
        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              borderRadius: '32px',
              border: '1px solid rgba(255,255,255,0.08)',
              background:
                'linear-gradient(135deg, rgba(25,19,15,0.96) 0%, rgba(18,15,23,0.92) 56%, rgba(13,12,17,0.94) 100%)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
              p: { xs: 2.75, md: 4.25 },
              mb: 4,
              ...theming.getThemedCardSx(),
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
              {copy.successLabel}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>
              {copy.successTitle}
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.72)', maxWidth: 720 }}>
              {copy.successSubtitle}
            </Typography>
          </Box>

          <PaymentStatusVerification
            sessionId={paymentData.sessionId}
            transactionId={paymentData.transactionId}
          />

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={handleBack}
              sx={{
                mr: 2,
                borderColor: 'rgba(255,186,108,0.42)',
                color: '#ffba6c',
                borderRadius: '999px',
                px: 3,
                py: 1.1,
                '&:hover': {
                  borderColor: '#ffba6c',
                  bgcolor: 'rgba(255,186,108,0.08)',
                },
              }}
            >
              {copy.backHome}
            </Button>
            <Alert
              severity="info"
              sx={{
                mt: 2,
                maxWidth: 700,
                mx: 'auto',
                textAlign: 'left',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
              }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.74)' }}>
                {copy.successInfo}
              </Typography>
            </Alert>
          </Box>
        </Container>
      </Box>
    );
}

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at top, rgba(255,173,80,0.18) 0%, rgba(15,10,7,0.97) 35%, #090807 100%)',
        py: { xs: 4, md: 6 },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(120deg, rgba(255,186,108,0.08) 0%, transparent 35%, rgba(110,86,255,0.08) 100%)',
        }}
      />
      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            borderRadius: '32px',
            border: '1px solid rgba(255,255,255,0.08)',
            background:
              'linear-gradient(135deg, rgba(31,23,17,0.96) 0%, rgba(18,15,23,0.92) 56%, rgba(11,11,17,0.95) 100%)',
            boxShadow: '0 36px 80px rgba(0,0,0,0.42)',
            p: { xs: 2.5, md: 4.5 },
            mb: 4,
            ...theming.getThemedCardSx(),
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            spacing={{ xs: 2.5, md: 4 }}
          >
            <Box sx={{ flex: 1, maxWidth: 820 }}>
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
                {copy.commerceLabel}
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 1.2 }}>
                {copy.title}
              </Typography>
              <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
                {copy.subtitle}
              </Typography>
            </Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              variant="outlined"
              sx={{
                borderColor: 'rgba(255,186,108,0.42)',
                color: '#ffba6c',
                borderRadius: '999px',
                px: 3,
                py: 1.1,
                flexShrink: 0,
                '&:hover': {
                  borderColor: '#ffba6c',
                  bgcolor: 'rgba(255,186,108,0.08)',
                },
              }}
            >
              {copy.back}
            </Button>
          </Stack>
        </Box>

        {paymentCancelled && (
          <Alert
            severity="info"
            sx={{
              mb: 3,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
            }}
          >
            {copy.cancelled}
          </Alert>
        )}

        <SubscriptionSelectionFlow
          profession={profession}
          language={resolvedLanguage}
          requestId={requestId}
          initialPlanId={initialPlanId}
          initialBillingCycle={initialBillingCycle}
          fromInvite={fromInvite}
          onComplete={handlePaymentComplete}
          onBack={handleBack}
        />
      </Container>
    </Box>
  );
}
