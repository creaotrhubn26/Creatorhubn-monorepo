import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Fade,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  Slide,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  CheckCircle,
  CreditCard,
  Diamond,
  Google,
  Phone,
  Star,
  Work,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  type Currency,
  type PlatformSubscriptionPlan,
  usePlatformPricing,
} from '../../services/PlatformPricingService';
import { useTheming } from '../../utils/theming-helper';

type BillingCycle = 'monthly' | 'yearly';
type SupportLevel = 'basic' | 'priority' | 'dedicated';
type PaymentMethod = 'google-pay' | 'card' | 'invoice';

export interface SubscriptionPlan {
  id: string;
  name: string;
  profession: string;
  price: number;
  currency: string;
  interval: BillingCycle;
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
  supportLevel: SupportLevel;
}

interface SubscriptionPlanSelectorProps {
  profession: string;
  onPlanSelect: (plan: SubscriptionPlan) => void;
  onTrialStart: (plan: SubscriptionPlan) => void;
  selectedPlan?: SubscriptionPlan | null;
}

interface BillingPlanApi {
  id: string;
  name: string;
  description?: string;
  profession?: string;
  price: number;
  currency?: string;
  interval?: string;
  active?: boolean;
  popular?: boolean;
  trialDays?: number;
  maxUsers?: number;
  maxProjects?: number;
  maxClients?: number;
  features?: string[];
  benefits?: string[];
  limitations?: string[];
  integrations?: string[];
  supportLevel?: string;
}

interface BillingPlanResponseApi {
  plans?: BillingPlanApi[];
}

const PROFESSION_COLORS: Record<string, string> = {
  photographer: '#FF6B30',
  videographer: '#004E80',
  music_producer: '#7209B0',
  designer: '#2E7D30',
  vendor: '#C2410C',
  enterprise: '#1D4ED8',
};

const PAYMENT_METHODS: Array<{ id: PaymentMethod; name: string; icon: React.ReactElement; color: string }> = [
  { id: 'google-pay', name: 'Google Pay', icon: <Google />, color: '#4285F4' },
  { id: 'card', name: 'Kort', icon: <CreditCard />, color: '#635BFF' },
  { id: 'invoice', name: 'Faktura', icon: <Phone />, color: '#FF5B24' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function toSupportLevel(value: string | undefined): SupportLevel {
  if (value === 'priority' || value === 'dedicated') {
    return value;
  }
  return 'basic';
}

function normalizeCurrency(value: string | undefined): string {
  if (!value) {
    return 'NOK';
  }
  return value.toUpperCase();
}

function normalizeBillingCycle(value: string | undefined): BillingCycle {
  if (value === 'yearly' || value === 'annual' || value === 'year') {
    return 'yearly';
  }
  return 'monthly';
}

function fromPlatformPlan(
  plan: PlatformSubscriptionPlan,
  profession: string,
): SubscriptionPlan {
  const supportLevel: SupportLevel =
    plan.tier === 'enterprise' || plan.tier === 'premium'
      ? 'dedicated'
      : plan.tier === 'professional'
        ? 'priority'
        : 'basic';

  return {
    id: plan.id,
    name: plan.displayName,
    profession,
    price: plan.price,
    currency: plan.currency,
    interval: plan.billingCycle,
    features: plan.features,
    active: plan.isActive,
    maxUsers: plan.limits.maxUsers,
    maxProjects: plan.limits.maxProjects,
    maxClients: plan.limits.maxClients,
    trialDays: plan.trialDays,
    popular: plan.isPopular,
    description: plan.description,
    benefits: [],
    limitations: [],
    integrations: [],
    supportLevel,
  };
}

function mapBillingPlan(plan: BillingPlanApi, profession: string): SubscriptionPlan {
  return {
    id: plan.id,
    name: plan.name,
    profession: plan.profession ?? profession,
    price: plan.price,
    currency: normalizeCurrency(plan.currency),
    interval: normalizeBillingCycle(plan.interval),
    features: plan.features ?? [],
    active: plan.active ?? true,
    maxUsers: plan.maxUsers ?? 1,
    maxProjects: plan.maxProjects ?? 25,
    maxClients: plan.maxClients ?? 100,
    trialDays: plan.trialDays ?? 14,
    popular: plan.popular ?? false,
    description: plan.description ?? plan.name,
    benefits: plan.benefits ?? [],
    limitations: plan.limitations ?? [],
    integrations: plan.integrations ?? [],
    supportLevel: toSupportLevel(plan.supportLevel),
  };
}

function parseBillingPlans(payload: unknown, profession: string): SubscriptionPlan[] {
  if (!isRecord(payload)) {
    return [];
  }

  const response = payload as BillingPlanResponseApi;
  if (!Array.isArray(response.plans)) {
    return [];
  }

  return response.plans
    .filter((plan): plan is BillingPlanApi => {
      return isRecord(plan) && typeof plan.id === 'string' && typeof plan.name === 'string' && typeof plan.price === 'number';
    })
    .map((plan) => mapBillingPlan(plan, profession));
}

function getPlanIcon(planId: string): React.ReactElement {
  if (planId === 'professional' || planId === 'pro') {
    return <Star />;
  }
  if (planId === 'enterprise' || planId === 'premium' || planId === 'business') {
    return <Diamond />;
  }
  return <Work />;
}

function formatCurrencyAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: currency || 'NOK',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency || 'NOK'}`;
  }
}

function displayUnlimited(value: number): string {
  return value < 0 ? 'Ubegrenset' : String(value);
}

function getSupportLabel(level: SupportLevel): string {
  if (level === 'dedicated') {
    return 'Dedikert';
  }
  if (level === 'priority') {
    return 'Prioritert';
  }
  return 'Grunnleggende';
}

export default function SubscriptionPlanSelector({
  profession,
  onPlanSelect,
  onTrialStart,
  selectedPlan,
}: SubscriptionPlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>('google-pay');
  const [showComparison, setShowComparison] = useState(false);

  const theming = useTheming(profession);

  const { subscriptionPlans, isLoading: platformLoading, formatPrice } = usePlatformPricing();

  const {
    data: billingResponse,
    isLoading: billingLoading,
    error: billingError,
  } = useQuery({
    queryKey: ['/api/billing/plans', profession],
    queryFn: async () => {
      return apiRequest(`/api/billing/plans?profession=${encodeURIComponent(profession)}`);
    },
    enabled: Boolean(profession),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const platformMappedPlans = useMemo(
    () => subscriptionPlans.map((plan) => fromPlatformPlan(plan, profession)),
    [profession, subscriptionPlans],
  );

  const billingMappedPlans = useMemo(
    () => parseBillingPlans(billingResponse, profession),
    [billingResponse, profession],
  );

  const plans = useMemo(
    () => (billingMappedPlans.length > 0 ? billingMappedPlans : platformMappedPlans),
    [billingMappedPlans, platformMappedPlans],
  );

  const isLoading = billingLoading || platformLoading;
  const professionColor = PROFESSION_COLORS[profession] ?? theming.colors.primary;

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Laster abonnementsplaner...
        </Typography>
      </Box>
    );
  }

  if (plans.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning">
          Ingen planer tilgjengelig akkurat na. Prov igjen om litt.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Fade in timeout={500}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Velg din plan
          </Typography>
        </Fade>
        <Fade in timeout={700}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            Start med gratis proveperiode og oppgrader nar du er klar.
          </Typography>
        </Fade>

        {billingError ? (
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
            Kunne ikke hente profesjonsspesifikke planer. Viser plattformplaner i stedet.
          </Alert>
        ) : null}

        <Fade in timeout={900}>
          <Paper
            sx={{
              display: 'inline-flex',
              p: 1,
              borderRadius: 2,
              mb: 3,
              ...theming.getThemedCardSx(),
            }}
          >
            <FormControl component="fieldset">
              <RadioGroup
                row
                value={billingCycle}
                onChange={(event) =>
                  setBillingCycle(
                    event.target.value === 'yearly' ? 'yearly' : 'monthly',
                  )
                }
              >
                <FormControlLabel value="monthly" control={<Radio />} label="Manedlig" />
                <FormControlLabel
                  value="yearly"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>Arlig</span>
                      <Chip label="Spar 20%" size="small" color="success" />
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Paper>
        </Fade>
      </Box>

      <Grid container spacing={3} justifyContent="center">
        {plans.map((plan, index) => {
          const isSelected = selectedPlan?.id === plan.id;
          const basePrice = plan.price;
          const yearlyPrice = Math.round(basePrice * 12 * 0.8);
          const displayedPrice = billingCycle === 'yearly' ? yearlyPrice : basePrice;
          const yearlySavings = Math.max(0, basePrice * 12 - yearlyPrice);
          const cardColor = plan.popular ? professionColor : theming.colors.primary;

          return (
            <Grid item xs={12} md={4} key={plan.id}>
              <Slide direction="up" in timeout={500 + index * 140}>
                <Card
                  onClick={() => onPlanSelect(plan)}
                  sx={{
                    height: '100%',
                    position: 'relative',
                    cursor: 'pointer',
                    border: isSelected ? `3px solid ${cardColor}` : '1px solid transparent',
                    backgroundColor: isSelected ? `${cardColor}14` : 'background.paper',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: 6,
                    },
                  }}
                >
                  {plan.popular ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2,
                      }}
                    >
                      <Chip
                        icon={<Star />}
                        label="Mest populare"
                        sx={{
                          backgroundColor: cardColor,
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      />
                    </Box>
                  ) : null}

                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Box sx={{ textAlign: 'center', mb: 2.5 }}>
                      <Avatar
                        sx={{
                          width: 64,
                          height: 64,
                          bgcolor: cardColor,
                          mx: 'auto',
                          mb: 1.5,
                        }}
                      >
                        {getPlanIcon(plan.id)}
                      </Avatar>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {plan.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {plan.description}
                      </Typography>

                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="h4" sx={{ color: cardColor, fontWeight: 800 }}>
                          {basePrice === 0
                            ? 'Gratis'
                            : formatCurrencyAmount(displayedPrice, plan.currency)}
                        </Typography>
                        {basePrice > 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            /{billingCycle === 'yearly' ? 'ar' : 'maned'}
                          </Typography>
                        ) : null}
                        {billingCycle === 'yearly' && basePrice > 0 ? (
                          <Typography variant="caption" color="success.main">
                            Spar {formatCurrencyAmount(yearlySavings, plan.currency)} per ar
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>

                    <Box sx={{ flex: 1 }}>
                      <List dense>
                        {plan.features.map((feature) => (
                          <ListItem key={`${plan.id}-${feature}`} sx={{ px: 0, py: 0.4 }}>
                            <ListItemIcon sx={{ minWidth: 30 }}>
                              <CheckCircle sx={{ color: cardColor, fontSize: 18 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={feature}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>

                    {plan.trialDays > 0 ? (
                      <Alert severity="info" sx={{ my: 1.5 }}>
                        {plan.trialDays} dager gratis proveperiode
                      </Alert>
                    ) : null}

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {plan.trialDays > 0 ? (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={(event) => {
                            event.stopPropagation();
                            onTrialStart(plan);
                          }}
                          sx={{
                            backgroundColor: cardColor,
                            '&:hover': { backgroundColor: cardColor },
                          }}
                        >
                          Start proveperiode
                        </Button>
                      ) : (
                        <Button
                          variant={basePrice === 0 ? 'outlined' : 'contained'}
                          fullWidth
                          startIcon={basePrice === 0 ? <CheckCircle /> : <ArrowForward />}
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlanSelect(plan);
                          }}
                          sx={{
                            color: basePrice === 0 ? cardColor : '#fff',
                            borderColor: cardColor,
                            backgroundColor: basePrice === 0 ? 'transparent' : cardColor,
                            '&:hover': {
                              backgroundColor:
                                basePrice === 0 ? `${cardColor}16` : cardColor,
                            },
                          }}
                        >
                          {basePrice === 0 ? 'Velg gratis plan' : 'Velg plan'}
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

      {selectedPlan && selectedPlan.price > 0 ? (
        <Fade in timeout={500}>
          <Card sx={{ mt: 4, p: 3, ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
              Velg betalingsmetode
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              {PAYMENT_METHODS.map((method) => (
                <Tooltip key={method.id} title={method.name}>
                  <IconButton
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    aria-label={`Velg ${method.name}`}
                    sx={{
                      width: 58,
                      height: 58,
                      border:
                        selectedPaymentMethod === method.id
                          ? `2px solid ${method.color}`
                          : '1px solid #d6d6d6',
                      backgroundColor:
                        selectedPaymentMethod === method.id
                          ? `${method.color}1A`
                          : '#fff',
                      '&:hover': {
                        backgroundColor: `${method.color}26`,
                      },
                    }}
                  >
                    {React.cloneElement(method.icon, {
                      sx: { color: method.color, fontSize: 26 },
                    })}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Card>
        </Fade>
      ) : null}

      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          variant="outlined"
          onClick={() => setShowComparison((prev) => !prev)}
        >
          {showComparison ? 'Skjul sammenligning' : 'Sammenlign planer'}
        </Button>
      </Box>

      {showComparison ? (
        <Fade in timeout={500}>
          <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2.5, textAlign: 'center' }}>
                Detaljert sammenligning
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Funksjon</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`head-${plan.id}`} align="center">
                          {plan.name}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Pris</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`price-${plan.id}`} align="center">
                          {plan.price === 0
                            ? 'Gratis'
                            : formatPrice(plan.price, plan.currency as Currency)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Maks brukere</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`users-${plan.id}`} align="center">
                          {displayUnlimited(plan.maxUsers)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Maks prosjekter</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`projects-${plan.id}`} align="center">
                          {displayUnlimited(plan.maxProjects)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Maks kunder</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`clients-${plan.id}`} align="center">
                          {displayUnlimited(plan.maxClients)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Stotte</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`support-${plan.id}`} align="center">
                          {getSupportLabel(plan.supportLevel)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Proveperiode</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`trial-${plan.id}`} align="center">
                          {plan.trialDays} dager
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Integrasjoner</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`integrations-${plan.id}`} align="center">
                          {plan.integrations.length > 0
                            ? `${plan.integrations.length} tjenester`
                            : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Fordeler</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`benefits-${plan.id}`} align="center">
                          {plan.benefits.length > 0
                            ? plan.benefits.slice(0, 2).join(', ')
                            : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Begrensninger</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`limits-${plan.id}`} align="center">
                          {plan.limitations.length > 0
                            ? plan.limitations.slice(0, 2).join(', ')
                            : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Hovedfunksjoner</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={`features-${plan.id}`} align="center">
                          {isStringArray(plan.features)
                            ? `${plan.features.length} funksjoner`
                            : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Fade>
      ) : null}
    </Box>
  );
}

