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
  Paper,
  Stack,
  Button,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Home as HomeIcon } from '@mui/icons-material';
import SubscriptionSelectionFlow from '../components/subscription/SubscriptionSelectionFlow';
import PaymentStatusVerification from '../components/subscription/PaymentStatusVerification';
import { apiRequest } from '../lib/queryClient';

export default function SubscriptionSelectionPage() {
  const [, navigate] = useLocation();
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Get profession from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const requestedProfession = urlParams.get('profession') || 'creatorhub';
  const profession = requestedProfession || 'creatorhub';
  const initialPlanId = urlParams.get('plan');
  const initialBillingCycle = urlParams.get('billing') === 'yearly' ? 'yearly' : 'monthly';
  const requestId = urlParams.get('requestId');
  const fromInvite = urlParams.get('fromInvite') === 'true';
  const stripeSessionId = urlParams.get('session_id');
  const isCreatorHubCheckout = profession === 'creatorhub';
  const theming = useTheming(isCreatorHubCheckout ? 'vendor' : profession);

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
      fetch('/api/user/kv/paymentCompleted', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
          if (v) {
            setPaymentData(v);
            setShowPaymentStatus(true);
            // Clear server copy best-effort
            fetch('/api/user/kv', {
              method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
              body: JSON.stringify({ key: 'paymentCompleted', value: null })
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
      fetch('/api/payments/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
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
        fetch('/api/user/ui-preferences', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
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

  const handleMembershipCreated = (membershipCard: any) => {
    console.log('Membership card created, :', membershipCard);
    // Could trigger additional actions here
};

  if (showPaymentStatus && paymentData) {
    return (
      <Container maxWidth="lg" sx={{ py:  4 }}>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            background: 'linear-gradient(135deg, #4caf5015 0%, #4caf5005 100%)',
            border: '1px solid #4caf50',
            borderRadius: 3,
            p: 4,
            mb: 4,
            ...theming.getThemedCardSx()
          }}
        >
          <Stack direction="row" alignItems="center" spacing={3}>
            <Box sx={{ flex:  1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                Betaling fullført! 🎉
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                CreatorHub-abonnementet ditt er aktivert
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <PaymentStatusVerification
          sessionId={paymentData.sessionId}
          transactionId={paymentData.transactionId}
          onMembershipCreated={handleMembershipCreated}
        />

        <Box sx={{ textAlign: 'center', mt:  4 }}>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={handleBack}
            sx={{ mr:  2 }}
          >
            Tilbake til hjem
          </Button>
          <Alert severity="info" sx={{ mt: 2, maxWidth: 600, mx: 'auto' }}>
            <Typography variant="body2">
              Stripe-betalingen er registrert. CreatorHub oppdaterer medlemskap og tilgang etter bekreftet betaling.
            </Typography>
          </Alert>
        </Box>
      </Container>
    );
}

  return (
    <Container maxWidth="lg" sx={{ py:  4 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #ff8c0015 0%, #ff8c0005 100%)',
          border: '1px solid #ff8c00',
          borderRadius: 3,
          p: 4,
          mb: 4,
          ...theming.getThemedCardSx()
        }}
      >
        <Stack direction="row" alignItems="center" spacing={3}>
          <Box sx={{ flex:  1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
              Velg CreatorHub-abonnement
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ ...{}, color: theming.colors.primary }}>
              Velg plan og fullfør betalingen i Stripe Checkout
            </Typography>
          </Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="outlined"
            sx={{ borderColor: '#ff8c0', color: '#ff8c00',}}
          >
            Tilbake
          </Button>
        </Stack>
      </Paper>

      {paymentCancelled && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Stripe Checkout ble avbrutt. Den valgte planen din er fortsatt valgt, så du kan fortsette når du er klar.
        </Alert>
      )}

        <SubscriptionSelectionFlow
          profession={profession}
          requestId={requestId}
          initialPlanId={initialPlanId}
          initialBillingCycle={initialBillingCycle}
          fromInvite={fromInvite}
          onComplete={handlePaymentComplete}
          onBack={handleBack}
      />
    </Container>
  );
}
