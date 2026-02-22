// client/src/components/onboarding/SubscriptionPlanSelector.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Fade,
  Slide,
  Zoom,
  Alert,
  Divider,
  Radio,
  RadioGroup,
  FormControl,
  FormControlLabel,
  Paper,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CheckCircle,
  Star,
  TrendingUp,
  People,
  Work,
  Speed as Speed,
  Security,
  CloudSync,
  MonetizationOn,
  AutoAwesome,
  ArrowForward,
  Info,
  Google,
  CreditCard,
  Phone,
  Timer,
  Diamond,
  RocketLaunch as Rocket,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SubscriptionPlan {
  id: string;
  name: string;
  profession: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  active: boolean;
  maxUsers: number;
  maxProjects: number;
  maxClients: number;
  trialDays: number;
  popular?: boolean;
  description: string;
  benefits: string[];
  limitations: string[];
  integrations: string[];
  supportLevel: 'basic' | 'priority' | 'dedicated'
}

interface SubscriptionPlanSelectorProps {
  profession: string;
  onPlanSelect: (plan: SubscriptionPlan) => void;
  onTrialStart: (plan: SubscriptionPlan) => void;
  selectedPlan?: SubscriptionPlan | null
}

// PROFESSION_ICONS will be defined inside component after theming is available

const PROFESSION_COLORS = {
  photographer: '#FF6B30',
  videographer: '#004E80',
  music_producer: '#7209B0',
  designer: '#2E7D30',
};

// PAYMENT_METHODS will be defined inside component after theming is available

export default function SubscriptionPlanSelector({
  profession,
  onPlanSelect,
  onTrialStart,
  selectedPlan,
}: SubscriptionPlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('google-pay');
  const [showComparison, setShowComparison] = useState(false);

  // Theming system
  const theming = useTheming('photographer');

  // Define icons and payment methods after theming is available
  const PROFESSION_ICONS = {
    photographer: <Work />,
    videographer: theming.getThemedIcon('videographer'),
    music_producer: theming.getThemedIcon('music_producer'),
    designer: <Diamond />,
  };

  const PAYMENT_METHODS = [
    { id: 'google-pay', name: 'Google Pay', icon: <Google />, color: '#4285F4' },
    { id: 'stripe', name: 'Kort', icon: <CreditCard />, color: '#635BFF' },
    { id: 'vipps', name: 'Vipps', icon: theming.getThemedIcon('vipps'), color: '#FF5B24' },
  ];

  // Fetch subscription plans for the profession using the billing API
  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['/api/billing/plans', profession],
    queryFn: async () => {
      const response = await fetch(`/api/billing/plans?profession=${encodeURIComponent(profession)}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch plans:', response.status, errorText);
        throw new Error(`Failed to fetch plans: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      console.log('Plans data received:', data);
      return data;
    },
    enabled: !!profession,
    retry: 1,
  });

  // Fallback plans if service is not available
  const fallbackPlans: SubscriptionPlan[] = [
    {
      id: 'basic',
      name: 'Basic Creator',
      profession,
      price:  0,
      currency: 'NO',
      interval: 'monthly',
      features: [
        'Grunnleggende CRM',
        'Enkel kontrakthåndtering',
        'Basis fakturering',
        'Opptil 5 prosjekter',
        'Opptil 10 kunder',
        'Google Workspace integrasjon',
      ],
      active: true,
      maxUsers:  1,
      maxProjects:  5,
      maxClients:  10,
      trialDays:  0,
      description: 'Perfekt for å komme i gang',
      benefits: ['Gratis for alltid','Grunnleggende funksjoner','Enkel oppsett'],
      limitations: ['Begrenset antall kunder','Ingen avanserte funksjoner'],
      integrations: ['Google Workspace','Gmail'],
      supportLevel: 'basic',
  },
    {
      id: 'professional',
      name: 'Professional Creator',
      profession,
      price: 29,
      currency: 'NO',
      interval: 'monthly',
      features: [
        'Avansert CRM med kundeanalyse',
        'Automatisert kontrakthåndtering',
        'AI-drevet fakturering og påminnelser',
        'Opptil 50 prosjekter',
        'Opptil 200 kunder',
        'Premium støtte',
        'Alle integrasjoner',
        'Avansert rapportering',
        'Kundegalleri og portefølje',
      ],
      active: true,
      maxUsers:  3,
      maxProjects:  50,
      maxClients: 20,
      trialDays:  14,
      popular: true,
      description: 'Mest populære valg for profesjonelle',
      benefits: ['14 dager gratis prøveperiode','Alle funksjoner','Prioritert støtte'],
      limitations: ['Begrenset til 3 brukere', ],
      integrations: ['Google Workspace','Gmail','Google Drive','Google Calendar','Vipps','Stripe'],
      supportLevel: 'priority',
  },
    {
      id: 'business',
      name: 'Business Creator',
      profession,
      price: 59,
      currency: 'NO',
      interval: 'monthly',
      features: [
        'Enterprise CRM med AI-analyse',
        'Avansert automatisering',
        'AI-drevet kundesegmentering',
        'Ubegrenset prosjekter',
        'Ubegrenset kunder',
        'Dedikert støtte',
        'Alle integrasjoner',
        'Team samarbeid',
        'Avansert rapportering og analytics',
        'White-label løsning',
      ],
      active: true,
      maxUsers: 10,
      maxProjects: 999999, // Unlimited
      maxClients: 999999, // Unlimited
      trialDays:  14,
      description: 'For større team og bedrifter',
      benefits: ['14 dager gratis prøveperiode','Alle funksjoner','Dedikert støtte','Team samarbeid'],
      limitations:  [],
      integrations: ['Google Workspace', 'Gmail', 'Google Drive', 'Google Calendar', 'Vipps', 'Stripe', 'Google Pay','Microsoft 365'],
      supportLevel: 'dedicated',
  },
  ];

  // Map API response to component's SubscriptionPlan format
  const apiPlans: SubscriptionPlan[] = (plansData?.plans || []).map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    profession: plan.profession || profession,
    price: plan.price / 100, // Convert from øre to NOK
    currency: plan.currency || 'NOK',
    interval: plan.interval || 'month',
    features: plan.features || [],
    active: plan.active !== false,
    maxUsers: plan.maxUsers || 1,
    maxProjects: plan.maxProjects || 100,
    maxClients: 200, // Default value
    trialDays: 14, // Default trial days
    popular: plan.popular || false,
    description: plan.description || plan.name,
    benefits: plan.benefits || [],
    limitations: plan.limitations || [],
    integrations: plan.integrations || [],
    supportLevel: (plan.supportLevel || 'basic') as 'basic' | 'priority' | 'dedicated'
  }));

  // Use API plans if available, otherwise fallback
  const plans: SubscriptionPlan[] = apiPlans.length > 0 ? apiPlans : fallbackPlans;

  // Format price function
  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat('no-NO', {
        style: 'currency',
        currency: currency || 'NOK',
      }).format(price);
    } catch (error) {
      // Fallback formatting
      return `${price} ${currency || 'NOK'}`;
    }
  };

  const getYearlyDiscount = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * 0.2); // 20% discount
};

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'basic':
        return theming.getThemedIcon(', ');
      case 'professional':
        return theming.getThemedIcon('star');
      case 'business':
        return <Diamond />;
      default: return <Work />;
}
};

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'basic':
        return '#6B7280';
      case 'professional':
        return PROFESSION_COLORS[profession as keyof typeof PROFESSION_COLORS] || '#FF6B35';
      case 'business':
        return '#805AD5';
      default:
        return '#6B7280';
}
};

  // Show loading state
  if (plansLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Laster abonnementsplaner...
        </Typography>
      </Box>
    );
  }

  // Show error state
  if (plansError) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Kunne ikke laste abonnementsplaner
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {plansError instanceof Error ? plansError.message : 'En ukjent feil oppstod'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            Profession: {profession}
          </Typography>
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Bruker fallback-planer
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb:  4 }}>
        <Fade in timeout={500}>
          <Typography variant="h4" sx={{  fontWeight: 'bold', mb:  2  }}>
            Velg din plan
          </Typography>
        </Fade>
        <Fade in timeout={700}>
          <Typography variant="h6" color="text.secondary" sx={{  mb:  3  }}>
            Start med en gratis prøveperiode og oppgrader når du er klar
          </Typography>
        </Fade>

        {/* Billing Cycle Toggle */}
        <Fade in timeout={900}>
          <Paper
            sx={{
              display: 'inline-flex',
              p:  1,
              bgcolor: 'grey.10',
              borderRadius:  2,
              mb:  3}}
           sx={theming.getThemedCardSx()}>
            <FormControl component="fieldset">
              <RadioGroup
                row
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
              >
                <FormControlLabel
                  value="monthly"
                  control={<Radio />}
                  label="Månedlig"
                />
                <FormControlLabel
                  value="yearly"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <span>Årlig</span>
                      <Chip label="Spar 20%" size="small" color="success" />
                    </Box>
                }
                />
              </RadioGroup>
            </FormControl>
          </Paper>
        </Fade>
      </Box>

      {/* Plans Grid */}
      <Grid container spacing={3} justifyContent="center">
        {plans.map((plan, index) => {
          const isSelected = selectedPlan?.id === plan.id;
          const planColor = getPlanColor(plan.id);
          const displayPrice = billingCycle === 'yearly' && plan.price > 0 
            ? plan.price * 12 - getYearlyDiscount(plan.price)
            : plan.price;

          return (
            <Grid item xs={12} md={4} key={plan.id}>
              <Slide direction="up" in timeout={500 + index * 200}>
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    cursor: 'pointer',
                    border: isSelected ? `3px solid ${planColor}` : '1px solid transparent',
                    bgcolor: isSelected ? `${planColor}10` : 'background.paper','&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow:  6,
                  },
                    transition: 'all 0.3s ease'}}
                  onClick={() => onPlanSelect(plan)}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -2,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1}}
                    >
                      <Chip
                        label="Mest populære"
                        color="primary"
                        icon={theming.getThemedIcon('star')}}
                        sx={{
                          bgcolor: planColor,
                          color: 'white',
                          fontWeight: 'bold'}}
                      />
                    </Box>
                  )}

                  <CardContent sx={{ p:  3, height: '100%', display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
                    {/* Plan Header */}
                    <Box sx={{ textAlign: 'center', mb:  3 }}>
                      <Avatar
                        sx={{
                          width:  64,
                          height:  64,
                          bgcolor: planColor,
                          mx: 'auto',
                          mb:  2}}
                      >
                        {React.cloneElement(getPlanIcon(plan.id), { sx: { fontSize: 32} })}
                      </Avatar>
                      <Typography variant="h5" sx={{  fontWeight: 'bold', mb:  1  }}>
                        {plan.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        {plan.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center'}}>
                        <Typography variant="h3"
                          sx={{ 
                            fontWeight: 'bold',
                            color: planColor }}>
                          {plan.price === 0 ? 'Gratis' : formatPrice(displayPrice, plan.currency)}
                        </Typography>
                        {plan.price > 0 && (
                          <Typography variant="body2" color="text.secondary" sx={{ ml:  1 }}>
                            /{billingCycle === 'yearly' ? 'år' : 'måned'}
                          </Typography>
                        )}
                      </Box>
                      {billingCycle === 'yearly' && plan.price > 0 && (
                        <Typography variant="caption" color="success.main" sx={{ display: 'block', mt:  1 }}>
                          Spar {formatPrice(getYearlyDiscount(plan.price), plan.currency)} per år
                        </Typography>
                      )}
                    </Box>

                    {/* Features List */}
                    <Box sx={{ flex: 1mb:  3 }}>
                      <List dense>
                        {plan.features.map((feature, featureIndex) => (
                          <ListItem key={featureIndex} sx={{ px: 0, py: 0.5}}>
                            <ListItemIcon sx={{ minWidth: 32}}>
                              <CheckCircle sx={{ color: planColor, fontSize: 20}} />
                            </ListItemIcon>
                            <ListItemText
                              primary={feature}
                              primaryTypographyProps={{ variant: 'body2'}}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>

                    {/* Trial Info */}
                    {plan.trialDays > 0 && (
                      <Alert severity="info" sx={{ mb:  2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Timer />
                          <Typography variant="body2">
                            {plan.trialDays} dager gratis prøveperiode
                          </Typography>
                        </Box>
                      </Alert>
                    )}

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap:  1 }}>
                      {plan.trialDays > 0 ? (
                        <Button variant="contained"
                          fullWidth
                          startIcon={theming.getThemedIcon('play')}
                          onClick={(e) = sx={theming.getThemedButtonSx()}> {
                            e.stopPropagation();
                            onTrialStart(plan);
                        }}
                          sx={{
                            bgcolor: planColor'&:hover': { bgcolor: planColor }}}
                        >
                          Start gratis prøveperiode
                        </Button>
                      ) : (
                        <Button
                          variant={plan.price === 0 ? 'outlined' : 'contained'}
                          fullWidth
                          startIcon={plan.price === 0 ? theming.getThemedIcon('checkCircle') : <ArrowForward />}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlanSelect(plan);
                        }}
                          sx={{
                            bgcolor: plan.price === 0 ? 'transparent' : planColor,
                            borderColor: planColor,
                            color: planColor'&:hover': {
                              bgcolor: plan.price === 0 ? `${planColor}10` : planColor,
                          }}}
                        >
                          {plan.price === 0 ? 'Velg gratis plan' : 'Velg plan'}
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Slide>
            </Grid>
          );
      })}
      </Grid>

      {/* Payment Methods */}
      {selectedPlan && selectedPlan.price > 0 && (
        <Fade in timeout={500}>
          <Card sx={{ mt:  4, p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{  mb: 2, textAlign: 'center' }}>
              Velg betalingsmetode
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center'}}>
              {PAYMENT_METHODS.map((method) => (
                <Tooltip key={method.id} title={method.name}>
                  <IconButton
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    sx={{
                      width:  60,
                      height:  60,
                      border: selectedPaymentMethod === method.id ? `3px solid ${method.color}` : '1px solid #e0e0e0',
                      bgcolor: selectedPaymentMethod === method.id ? `${method.color}10` : 'white', '&:hover': {
                        bgcolor: `${method.color}20`,
                    }}}
                  >
                    {React.cloneElement(method.icon, { 
                      sx: { color: method.color, fontSize: 28}
                  })}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Card>
        </Fade>
      )}

      {/* Comparison Toggle */}
      <Box sx={{ textAlign: 'center', mt:  4 }}>
        <Button
          variant="outlined"
          onClick={() => setShowComparison(!showComparison)}
          startIcon={theming.getThemedIcon('trendingUp')}
        >
          {showComparison ? 'Skjul sammenligning' : 'Sammenlign planer'}
        </Button>
      </Box>

      {/* Plan Comparison Table */}
      {showComparison && (
        <Fade in timeout={500}>
          <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  3, textAlign: 'center' }}>
                Detaljert sammenligning
              </Typography>
              <Box sx={{ overflowX: 'auto'}}>
                <table style={{ width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px'}}>Funksjoner</th>
                      {plans.map((plan) => (
                        <th key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '12px'}}>Pris</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.price === 0 ? 'Gratis' : formatPrice(plan.price, plan.currency)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px'}}>Maks brukere</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.maxUsers === -1 ? 'Ubegrenset' : plan.maxUsers}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px'}}>Maks prosjekter</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.maxProjects === -1 ? 'Ubegrenset' : plan.maxProjects}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px'}}>Maks kunder</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.maxClients === -1 ? 'Ubegrenset' : plan.maxClients}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px'}}>Integrasjoner</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.integrations.length} tjenester
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px'}}>Støtte</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.supportLevel === 'basic' ? 'Grunnleggende' : 
                           plan.supportLevel === 'priority' ? 'Prioritert' : 'Dedikert'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '12px'}}>Prøveperiode</td>
                      {plans.map((plan) => (
                        <td key={plan.id} style={{ textAlign: 'center', padding: '12px'}}>
                          {plan.trialDays} dager
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}
    </Box>
  );
}
