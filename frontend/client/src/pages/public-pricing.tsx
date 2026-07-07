import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockRenderer from '@/components/role-room/cms/BlockRenderer';
import { useCmsBlocks } from '@/components/role-room/cms/useCmsBlocks';
import { DEFAULT_LOCALE } from '@/components/role-room/cms/blockSchema';

/**
 * Offentlig "sammenlign planer"-side for CreatorHub — creatorhubn.com/pricing.
 *
 * Henter samme datakilde som prisseksjonen på forsiden
 * (GET /api/platform/subscription-plans, ingen auth), men viser alle
 * tilgjengelige nivåer (inkl. gratis-tier) med full features-liste i
 * stedet for forsidens korte teaser.
 *
 * NB: /pricing pekte tidligere på et internt admin-verktøy for
 * priskalkulering (PricingPage.tsx, nå flyttet til
 * /admin/pricing-calculator). Denne siden er den faktiske, offentlige
 * markedssiden som lenker fra nav/footer allerede forventet å finnes her.
 */

interface PublicSubscriptionPlan {
  id: string;
  displayName: string;
  description: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  yearlySavingsLabel?: string | null;
  features: string[];
  contactSalesOnly?: boolean;
  publicPriceLabel?: string | null;
  ctaLabel?: string | null;
}

const FALLBACK_PLANS: PublicSubscriptionPlan[] = [
  {
    id: 'prototype',
    displayName: 'Gratis',
    description: 'Kom i gang og utforsk plattformen.',
    currency: 'NOK',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ['1 prosjekt', 'Grunnleggende verktøy', 'Community-tilgang'],
    ctaLabel: 'Kom i gang',
  },
  {
    id: 'basic',
    displayName: 'Basic Creator',
    description: 'For deg som jobber med kreativt arbeid på egen hånd.',
    currency: 'NOK',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    features: ['Ubegrensede prosjekter', 'ResumeBuilder', 'Academy-kurs'],
    ctaLabel: 'Velg Basic',
  },
  {
    id: 'professional',
    displayName: 'Professional Creator',
    description: 'For team og profesjonelle som trenger mer kraft.',
    currency: 'NOK',
    monthlyPrice: 449,
    yearlyPrice: 4490,
    features: ['Alt i Basic', 'Team-samarbeid', 'Prioritert support'],
    ctaLabel: 'Velg Professional',
  },
  {
    id: 'premium',
    displayName: 'Premium Studio',
    description: 'For studioer og byråer med høyt volum.',
    currency: 'NOK',
    monthlyPrice: 1199,
    yearlyPrice: 11990,
    features: ['Alt i Professional', 'Avansert rapportering', 'Dedikert onboarding'],
    ctaLabel: 'Velg Premium',
  },
];

const FALLBACK_ENTERPRISE: PublicSubscriptionPlan = {
  id: 'enterprise',
  displayName: 'Enterprise',
  description: 'Skreddersydd løsning for store organisasjoner.',
  currency: 'NOK',
  monthlyPrice: 0,
  yearlyPrice: null,
  features: ['Skreddersydde integrasjoner', 'SLA og dedikert kundeansvarlig', 'Volumrabatt'],
  contactSalesOnly: true,
  publicPriceLabel: 'Kontakt oss',
  ctaLabel: 'Book en samtale',
};

export default function PublicPricingPage() {
  const cmsBlocks = useCmsBlocks('pricing');
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<PublicSubscriptionPlan[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/platform/subscription-plans');
        if (!response.ok) return;
        const payload = (await response.json()) as { plans?: Array<Record<string, unknown>> };
        if (!mounted || !Array.isArray(payload.plans)) return;

        const normalized = payload.plans
          .filter((plan) => plan && typeof plan === 'object')
          .map((plan) => ({
            id: String(plan.id || ''),
            displayName: String(plan.displayName || plan.name || ''),
            description: String(plan.description || ''),
            currency: String(plan.currency || 'NOK'),
            monthlyPrice:
              typeof plan.monthlyPrice === 'number'
                ? plan.monthlyPrice
                : typeof plan.price === 'number'
                  ? plan.price
                  : 0,
            yearlyPrice: typeof plan.yearlyPrice === 'number' ? plan.yearlyPrice : null,
            yearlySavingsLabel: typeof plan.yearlySavingsLabel === 'string' ? plan.yearlySavingsLabel : null,
            features: Array.isArray(plan.features)
              ? plan.features.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
              : [],
            contactSalesOnly: Boolean(plan.contactSalesOnly),
            publicPriceLabel: typeof plan.publicPriceLabel === 'string' ? plan.publicPriceLabel : null,
            ctaLabel: typeof plan.ctaLabel === 'string' ? plan.ctaLabel : null,
          }))
          .filter((plan) => plan.id && plan.displayName);

        if (normalized.length > 0) setPlans(normalized);
      } catch {
        // Behold fallback-planene under.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (cmsBlocks) {
    return <BlockRenderer blocks={cmsBlocks} locale={DEFAULT_LOCALE} />;
  }

  const resolvedPlans = plans && plans.length > 0 ? plans.filter((p) => !p.contactSalesOnly) : FALLBACK_PLANS;
  const enterprisePlan = plans?.find((p) => p.contactSalesOnly) || FALLBACK_ENTERPRISE;

  const formatPrice = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('nb-NO', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  };

  const choosePlan = (planId: string) => {
    const params = new URLSearchParams();
    params.set('profession', 'creatorhub');
    params.set('billing', 'monthly');
    params.set('plan', planId);
    setLocation(`/subscription-selection?${params.toString()}`);
  };

  const contactSales = () => {
    const subject = `${enterprisePlan.displayName} – forespørsel om demo og tilbud`;
    const body = 'Hei CreatorHub,\n\nVi ønsker en demo og et tilbud for Enterprise.\n\nSelskap:\nTeamstørrelse:\nBehov / integrasjoner:\n';
    window.location.href = `mailto:hello@creatorhubn.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#05060a', color: '#f6f2ea', py: { xs: 6, md: 9 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1.5} sx={{ textAlign: 'center', mb: 6 }}>
          <Typography sx={{ color: '#ff8c00', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.82rem' }}>
            Priser
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '2.6rem' } }}>
            Velg planen som passer deg
          </Typography>
          <Typography sx={{ color: 'rgba(246,242,234,0.72)', maxWidth: 640, mx: 'auto' }}>
            Alle planer inkluderer tilgang til kjerneplattformen. Oppgrader når du trenger mer kapasitet, team-samarbeid eller support.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: `repeat(${resolvedPlans.length}, 1fr)` },
            gap: 3,
            mb: 5,
          }}
        >
          {resolvedPlans.map((plan) => {
            const isHighlighted = plan.id === 'professional';
            return (
              <Card
                key={plan.id}
                sx={{
                  bgcolor: isHighlighted ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isHighlighted ? '2px solid #ff8c00' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '18px',
                  color: '#f6f2ea',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {isHighlighted ? (
                  <Chip
                    label="Mest populær"
                    size="small"
                    sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', bgcolor: '#ff8c00', color: '#000', fontWeight: 700 }}
                  />
                ) : null}
                <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {plan.displayName}
                  </Typography>
                  <Typography sx={{ color: 'rgba(246,242,234,0.6)', fontSize: '0.88rem', mb: 2 }}>
                    {plan.description}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.3 }}>
                    {plan.monthlyPrice > 0 ? formatPrice(plan.monthlyPrice, plan.currency) : 'Gratis'}
                  </Typography>
                  {plan.monthlyPrice > 0 ? (
                    <Typography sx={{ color: 'rgba(246,242,234,0.6)', fontSize: '0.82rem', mb: 2 }}>per måned</Typography>
                  ) : (
                    <Box sx={{ mb: 2 }} />
                  )}
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />
                  <List dense sx={{ flex: 1, mb: 2 }}>
                    {plan.features.map((feature) => (
                      <ListItem key={feature} disableGutters sx={{ py: 0.4 }}>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: '#ff8c00' }} />
                        </ListItemIcon>
                        <ListItemText primary={feature} primaryTypographyProps={{ fontSize: '0.85rem' }} />
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    fullWidth
                    variant={isHighlighted ? 'contained' : 'outlined'}
                    onClick={() => choosePlan(plan.id)}
                    sx={isHighlighted ? { bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00' } } : { borderColor: 'rgba(255,255,255,0.3)', color: '#f6f2ea' }}
                  >
                    {plan.ctaLabel || 'Velg plan'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', color: '#f6f2ea' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={3}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                  {enterprisePlan.displayName}
                </Typography>
                <Typography sx={{ color: 'rgba(246,242,234,0.7)', mb: 1 }}>{enterprisePlan.description}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {enterprisePlan.features.slice(0, 4).map((feature) => (
                    <Chip key={feature} label={feature} size="small" sx={{ bgcolor: 'rgba(255,140,0,0.1)', color: '#f6f2ea' }} />
                  ))}
                </Stack>
              </Box>
              <Button
                variant="contained"
                onClick={contactSales}
                sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00' }, whiteSpace: 'nowrap' }}
              >
                {enterprisePlan.ctaLabel || 'Kontakt salg'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
