/**
 * CreatorHub Norge - Payment Status Verification
 * Beautiful payment status display with Google Wallet integration
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  Stack,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Grid,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  CreditCard as PaymentIcon,
  CardMembership as MembershipIcon,
  Security as SecurityIcon,
  Email as EmailIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Wallet as WalletIcon,
  Smartphone as SmartphoneIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { googlePayService } from '@/services/GooglePayService';

// Google Pay Logo Component
const GooglePayLogo = ({ size = 24 }: { size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size * 0.6,
      position: 'relative',
      display: 'inline-block'}}
  >
    <Box
      sx={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(45deg, #4285F4 0%, #34A853 25%, #FBBC04 50%, #EA4335 75%, #4285F4 100%)',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: `${size * 0.4}px`,
        fontWeight: 'bold'}}
    >
      G
    </Box>
  </Box>
);

interface PaymentStatus {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  planName: string;
  createdAt: string;
  completedAt?: string;
  membershipCard?: {
    id: string;
    passId: string;
    status: 'active' | 'pending' | 'expired';
    qrCode?: string;
,};
}

interface PaymentStatusVerificationProps {
  userId?: string;
  transactionId?: string;
  onMembershipCreated?: (membershipCard: any) => void; 
}

export default function PaymentStatusVerification({
  userId,
  transactionId,
  onMembershipCreated,
}: PaymentStatusVerificationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [membershipCard, setMembershipCard] = useState<any>(null);

  // Fetch payment status
  const { data: paymentStatus, isLoading, refetch } = useQuery({
    queryKey: ['/api/payments/status', transactionId || userId],
    queryFn: async () => {
      const authHeader = await auth.getAuthHeader();
      const url = transactionId 
        ? `/api/payments/status/${transactiond}`
        : `/api/payments/status/user/${userId || user?.id}`;
      
      const response = await fetch(url, {
        headers: {
          ...authHeader, 'Content-Type' : 'application/json',
      },
    });
      if (!response.ok) throw new Error('Failed to fetch payment status');
      return response.json();
  },
    enabled: !!(transactionId || userId || user?.id),
    refetchInterval: (data) => {
      // Poll every 5 seconds if payment is pending
      return data && (data as any)?.status === 'pending' ? 5000 : false;
  ,},
});

  // Create Google Wallet membership card mutation
  const createMembershipMutation = useMutation({
    mutationFn: async () => {
      const authHeader = await auth.getAuthHeader();
      const response = await fetch('/api/google-wallet/create-membership-card', {
        method: 'POS',
        headers: {
          ...authHeader, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          userId: userId || user?.d,
          paymentId: paymentStatus?.d,
          planName: paymentStatus?.planName,
          merchantId: '7115-4985-802', // CreatorHub Norge Payments Profile ID
          issuerId: '7115-4985-802', // Same as merchant ID for Google Wallet
      }),
    });
      if (!response.ok) throw new Error('Failed to create membership card');
      return response.json();
  },
    onSuccess: (result) => {
      setMembershipCard(result);
      setShowMembershipDialog(true);
      onMembershipCreated?.(result);
      toast({
        title: 'Medlemskort opprettet, !',
        description: 'Ditt digitale medlemskort er klar for Google Wallet',
        variant: 'default',
    });
  },
    onError: (error) => {
      toast({
        title: 'Feil ved opprettelse av medlemskort',
        description: error.message || 'Kunne ikke opprette medlemskort',
        variant: 'destructive',
    });
  },
});

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('nb-N', {
      style: 'currency',
      currency,
      minimumFractionDigits:  0,
  }).format(amount / 100);
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon sx={{ color: '#4caf50'}} />;
      case 'failed':
        return <ErrorIcon sx={{ color: '#f44336'}} />;
      case 'refunded':
        return <ErrorIcon sx={{ color: '#ff9800'}} />;
      default: return <PendingIcon sx={{ color: '#2196f3'}} />;
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'refunded':
        return 'warning';
      default:
        return 'info';
  }
};

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Betaling fullført';
      case 'failed':
        return 'Betaling feilet';
      case 'refunded':
        return 'Refundert';
      default:
        return 'Behandler betaling...';
  }
};

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'google-pay':
        return <GooglePayLogo size={4} />;
      case 'stripe':
      case 'card':
        return <PaymentIcon sx={{ color: '#635BFF'}} />;
      case 'vipps':
        return (
          <Box
            sx={{
              width:  24,
              height:  24,
              borderRadius: '50, %',
              bgcolor: '#FF5B20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'}}
          >
            V
          </Box>
        );
      default: return <PaymentIcon />;
  }
};

  if (isLoading) {
    return (
      <Card sx={{ maxWidth: 60, mx: 'auto',  ...theming.getThemedCardSx() }}>
        <CardContent sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
          <LinearProgress sx={{ mb:  2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Sjekker betalingsstatus...
          </Typography>
        </CardContent>
      </Card>
    );
}

  if (!paymentStatus) {
    return (
      <Card sx={{ maxWidth: 60, mx: 'auto',  ...theming.getThemedCardSx() }}>
        <CardContent sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
          <ErrorIcon sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Kunne ikke finne betalingsinformasjon
          </Typography>
        </CardContent>
      </Card>
    );
}

  return (
    <Box>
      {/* Payment Status Card */}
      <Card sx={{ maxWidth: 60, mx: 'auto', mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={{ p:  4 ,  ...theming.getThemedCardSx() }}>
          <Stack direction="row" alignItems="center" spacing={3} sx={{ mb:  3 }}>
            <Avatar sx={{ bgcolor: getStatusColor(paymentStatus.status) + '.main', width:  64, height: 64}}>
              {getStatusIcon(paymentStatus.status)}
            </Avatar>
            <Box sx={{ flex:  1 }}>
              <Typography variant="h5" sx={{  fontWeight: 7, mb:  1  }}>
                {getStatusText(paymentStatus.status)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {paymentStatus.planName}
              </Typography>
            </Box>
            <Chip
              label={getStatusText(paymentStatus.status)}
              color={getStatusColor(paymentStatus.status) as any}
              size="medium"
            />
          </Stack>

          <Divider sx={{ my:  3 }} />

          {/* Payment Details */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Beløp
              </Typography>
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {formatPrice(paymentStatus.amount, paymentStatus.currency)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Betalingsmetode
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                {getPaymentMethodIcon(paymentStatus.paymentMethod)}
                <Typography variant="body2">
                  {paymentStatus.paymentMethod === 'google-pay' ? 'Google Pay' :
                   paymentStatus.paymentMethod === 'stripe' ? 'Kort (Stripe)' :
                   paymentStatus.paymentMethod === 'vipps' ? 'Vipps' : paymentStatus.paymentMethod}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Transaksjons-ID
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {paymentStatus.transactionId}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Dato
              </Typography>
              <Typography variant="body2">
                {new Date(paymentStatus.createdAt).toLocaleDateString('nb-NO')}
              </Typography>
            </Grid>
          </Grid>

          {paymentStatus.status === 'completed' && !paymentStatus.membershipCard && (
            <Box sx={{ mt:  3 }}>
              <Button variant="contained"
                startIcon={<GooglePayLogo size={20} sx={theming.getThemedButtonSx()}>}
                onClick={() => createMembershipMutation.mutate()}
                disabled={createMembershipMutation.isPending}
                sx={{
                  bgcolor: '#4285F0',
                  color: 'white',
                  px:  3,
                  py: 1.5,
                  borderRadius:  2,
                  textTransform: 'none',
                  fontSize: '16px',
                  fontWeight: 50&:hover': { bgcolor: '#3367D0',
                    boxShadow: '0 4px 8px rgba(6, 133, 244, 0.3)',
                }, '&:disabled': {
                    bgcolor: '#E8F0F0',
                    color: '#5F6360',
                }}}
              >
                {createMembershipMutation.isPending ? 'Oppretter...' : 'Legg til i Google Wallet'}
              </Button>
            </Box>
          )}

          {paymentStatus.membershipCard && (
            <Box sx={{ mt:  3 }}>
              <Alert 
                severity="success" 
                sx={{ 
                  mb:  2,
                  bgcolor: '#E8F5E0',
                  border: '1px solid #4CAF50','& .MuiAlert-icon': {
                    color: '#4CAF50',
                }}}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <VerifiedIcon sx={{ color: '#4CAF50'}} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 50}}>
                      Medlemskort lagt til i Google Wallet
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ditt medlemskort er nå tilgjengelig på alle enhetene dine
                    </Typography>
                  </Box>
                </Stack>
              </Alert>
              <Button
                variant="outlined"
                startIcon={<WalletIcon />}
                onClick={() => setShowMembershipDialog(true)}
                sx={{
                  borderColor: '#4285F0',
                  color: '#4285F0','&:hover': {
                    borderColor: '#3367D0',
                    bgcolor: '#E8F0F0',
                }}}
              >
                Se i Google Wallet
              </Button>
            </Box>
          )}

          {paymentStatus.status === 'pending' && (
            <Alert severity="info" sx={{ mt:  3 }}>
              <Typography variant="body2">
                Din betaling blir behandlet. Du vil få en e-post når betalingen er fullført.
              </Typography>
            </Alert>
          )}

          {paymentStatus.status === 'failed' && (
            <Alert severity="error" sx={{ mt:  3 }}>
              <Typography variant="body2">
                Betalingen feilet. Vennligst prøv igjen eller kontakt support.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Membership Card Dialog */}
      <Dialog 
        open={showMembershipDialog} 
        onClose={() => setShowMembershipDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px blur\(\s*([0-9]+px)\s*,\s*\)00.12)',
        }}}
      >
        <DialogTitle sx={{ pb:  1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <GooglePayLogo size={32} />
            <Box>
              <Typography variant="h6" sx={{  fontWeight: 50 }}>
                Google Wallet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                CreatorHub Norge Medlemskort
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt:  2 }}>
          {membershipCard && (
            <Box>
              {/* Google Wallet Card Preview */}
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
                  color: 'white',
                  mb:  3,
                  borderRadius:  2,
                  overflow: 'hidden',
                  position: 'relative'}}
               sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" sx={{  fontWeight: 600, mb:  1  }}>
                        {paymentStatus.planName}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9}}>
                        CreatorHub Norge
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width:  40,
                        height:  40,
                        borderRadius: '50, %',
                        bgcolor: 'rgba(25, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'}}
                    >
                      <MembershipIcon sx={{ color: 'white'}} />
                    </Box>
                  </Stack>
                  
                  {membershipCard.qrCode && (
                    <Box sx={{ mt: 2, textAlign: 'center'}}>
                      <img 
                        src={membershipCard.qrCode} 
                        alt="QR Code" 
                        style={{ 
                          width: 10, 
                          height: 10,
                          borderRadius: '8px',
                          backgroundColor: 'white',
                          padding: '8px'}}
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Features List */}
              <List sx={{ mb:  2 }}>
                <ListItem sx={{ px:  0 }}>
                  <ListItemIcon>
                    <SecurityIcon sx={{ color: '#4285F4'}} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sikker og kryptert"
                    secondary="Alle data er beskyttet med Google's sikkerhet"
                  />
                </ListItem>
                <ListItem sx={{ px:  0 }}>
                  <ListItemIcon>
                    <SmartphoneIcon sx={{ color: '#4285F4'}} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Tilgjengelig overalt"
                    secondary="Synkronisert på alle dine enheter"
                  />
                </ListItem>
                <ListItem sx={{ px:  0 }}>
                  <ListItemIcon>
                    <VerifiedIcon sx={{ color: '#4285F4'}} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Automatiske oppdateringer"
                    secondary="Oppdateres når din plan endres"
                  />
                </ListItem>
              </List>

              <Alert 
                severity="info" 
                sx={{ 
                  bgcolor: '#E8F0F0',
                  border: '1px solid #4285F0','& .MuiAlert-icon': {
                    color: '#4285F0',
                }}}
              >
                <Typography variant="body2">
                  <strong>Tips: </strong> Ditt medlemskort er nå tilgjengelig i Google Wallet appen. 
                  Du kan finne den ved å åpne appen og søke etter "CreatorHub".
                </Typography>
              </Alert>
            </Box>
         )}
        </DialogContent>
        <DialogActions sx={{ p:  3, pt:  1 }}>
          <Button 
            onClick={() => setShowMembershipDialog(false)}
            sx={{ textTransform: 'none'}}
          >
            Lukk
          </Button>
          <Button variant="contained"
            startIcon={<ShareIcon />}
            onClick={() => {
              // Share functionality
              if (navigator.share) {
                navigator.share({
                  title: 'CreatorHub Norge Medlemskort',
                  text: 'Sjekk ut mitt CreatorHub Norge medlemskort i Google Wallet, !',
                  url: window.location.href,
              });
            } else {
                // Fallback for browsers that don't support Web Share API
                navigator.clipboard.writeText(window.location.href);
                toast({
                  title: 'Link kopiert',
                  description: 'Del-linken er kopiert til utklippstavlen',
                  variant: 'default',
              });
            }
          }}
            sx={{
              bgcolor: '#4285F0',
              textTransform: 'none', '&:hover': { bgcolor: '#3367D6',}}}
          >
            Del medlemskort
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
