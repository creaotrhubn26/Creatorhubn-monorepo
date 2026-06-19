// @ts-nocheck
import React, { Suspense, useEffect, useState } from 'react';
import {
  AccountTree,
  ArrowForward,
  AutoAwesome,
  Close,
  Groups,
  Insights,
  Menu,
  NorthEast,
  PlayArrow,
  School,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  GlobalStyles,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import LoginModal from '@/components/auth/LoginModal';
const InviteRequestForm = React.lazy(() => import('@/components/InviteRequestForm'));
import { GdprNotice } from '@/components/common/GdprNotice';
import { useLanguage } from '@/components/language-provider';
import { getPublicSocialProfiles, PUBLIC_BRAND_LINKS } from '@/lib/publicBrandLinks';

type Locale = 'no' | 'en';
type LandingMode = 'desktop' | 'mobile';

interface CreatorHubInvestorLandingProps {
  mode: LandingMode;
}

interface CreatorHubPublicPricingPlan {
  id: string;
  name: string;
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

const CREATORHUB_ICON_URL = '/creatorhub-icon.png';
const CREATORHUB_WORDMARK_URL = '/creatorhub-wordmark-light.png';
const ROLE_ROOM_LOGO_URL = '/role-room-assets/TheRoleRoom_Logo_Tagline.webp';
const ACADEMY_LOGO_URL = '/creatorhub-academy-logo.svg';
const COMMUNITY_ICON_URL = '/creatorhub-community-icon.svg';
const ROLE_ROOM_EXTERNAL_URL = 'https://theroleroom.com';

const localeOptions: Array<{ value: Locale; flag: string; no: string; en: string }> = [
  { value: 'no', flag: '🇳🇴', no: 'Norsk', en: 'Norwegian' },
  { value: 'en', flag: '🇬🇧', no: 'Engelsk', en: 'English' },
];

const landingCopy = {
  no: {
    title: 'Creatorhub | Plattformen for kreativt arbeid',
    nav: {
      platform: 'Plattform',
      roleRoom: 'Role Room',
      academy: 'Academy',
      community: 'Community',
      signIn: 'Logg inn',
    },
    hero: {
      eyebrow: 'Bygget av kreative, for kreative.',
      title: 'Plattformen for kreativt arbeid',
      subtitle:
        'Administrer prosjekter, samarbeid med team og gjennomfør produksjon i ett system.',
      support:
        'Creatorhub er en plattform for å administrere, gjennomføre og skalere kreativt arbeid med innebygde verktøy, produkter og fellesskap.',
      primaryCta: 'Se planer og priser',
      secondaryCta: 'Se produktene',
      systemLine: 'Kjerneplattform / Produkter / Community-lag',
      architectureTitle: 'Creatorhub AS',
      architectureLead:
        'Et strukturert system der kjerneplattformen driver produkter, læring og nettverkseffekter.',
    },
    architecture: {
      core: {
        title: 'Kjerneplattform',
        subtitle: 'Prosjektstyringssystem',
        items: [
          'Prosjektstyring for kreative fag og team',
          'Team-samarbeid på tvers av roller',
          'Struktur for arbeidsflyt og produksjon',
        ],
      },
      products: {
        title: 'Produkter',
        subtitle: 'Utvidelser bygget på plattformen',
        items: ['The Role Room', 'Creatorhub Academy'],
      },
      community: {
        title: 'Community-lag',
        subtitle: 'Retensjon, nettverk og samarbeid',
        items: ['Kreatører', 'Team', 'Fagpersoner'],
      },
    },
    platform: {
      label: 'Kjerneplattform',
      title: 'Et system bygget for kreative arbeidsflyter',
      body:
        'Creatorhub gir et strukturert miljø for å administrere kreativt arbeid på tvers av fag, team og produksjoner.',
      items: [
        'Prosjektstyring tilpasset kreativt arbeid',
        'Samarbeid mellom team og profesjoner',
        'Arbeidsflyt med tydelig struktur',
        'Oppgave- og produksjonsoppfølging',
      ],
      foundation: 'Dette er fundamentet. Role Room og Academy bygges på toppen av denne kjernen.',
    },
    products: {
      label: 'Produkter',
      title: 'Bygget på toppen av plattformen',
      body:
        'Produktene utdyper bruksmønstre, utvider plattformen og gir flere innganger inn i økosystemet.',
      roleRoom: {
        title: 'The Role Room',
        body:
          'Et produksjonssystem for storskala videoproduksjonsteam og innholdsprodusenter som vil samarbeide tett med klienter fra planlegging til levering.',
        cta: 'Åpne The Role Room',
        metaLabel: 'For produksjonsteam',
        metaValue: 'Planlegging / Klientsamarbeid / Levering',
      },
      academy: {
        title: 'Creatorhub Academy',
        body: 'En læringsplattform designet for å utvikle ferdigheter og koble sammen skapere.',
        cta: 'Åpne Academy',
      },
    },
    community: {
      label: 'Kreativt økosystem',
      title: 'Et sammenkoblet kreativt økosystem',
      body:
        'Kreatører, team og fagpersoner kobles sammen gjennom Creatorhub for samarbeid, læring og reell produksjon.',
      points: [
        'Kreatører med prosjekter og ideer',
        'Team som skal koordinere arbeid og leveranser',
        'Fagpersoner som skal lære, bidra og skape nye muligheter',
      ],
      panelItems: ['Kreatører', 'Team', 'Fagpersoner'],
      cta: 'Utforsk Community',
    },
    differentiation: {
      label: 'Hvorfor Creatorhub skiller seg ut',
      title: 'Mer enn verktøy, et strukturert system',
      body:
        'Creatorhub samler prosjektstyring, produksjonsverktøy, læring og fellesskap i en samlet plattform.',
      pillars: [
        { title: 'Prosjektstyring', body: 'Arbeidsflyt, struktur og ansvar for kreative team.' },
        { title: 'Produksjonsverktøy', body: 'Dype verktøy som driver gjennomføring.' },
        { title: 'Læring', body: 'Academy som bygger ferdigheter og vekst.' },
        { title: 'Community', body: 'Et lag for tilknytning, samarbeid og retensjon.' },
      ],
    },
    pricing: {
      label: 'Abonnement',
      title: 'Velg inngangen inn i CreatorHub',
      body:
        'De selvbetjente abonnementene er bygget for ulike faser av kreativ drift, fra solooperatører til studioer. Enterprise settes opp sammen med CreatorHub, ikke som vanlig checkout.',
      trustLine: 'Månedlig abonnement / Stripe Checkout for selvbetjente planer / Enterprise via salg',
      monthlyLabel: 'Månedlig',
      yearlyLabel: 'Årlig',
      yearlyBadge: '2 måneder gratis',
      yearlySupport: 'Årlig fakturering låser inn en tydeligere pris og øker kontraktsverdien uten å gjøre kjøpsløpet mer komplisert.',
      cards: [
        {
          id: 'basic',
          name: 'Basic Creator',
          monthlyPrice: '249 kr',
          yearlyPrice: '2 490 kr',
          monthlyCadence: 'per måned',
          yearlyCadence: 'per år',
          summary: 'For solo kreatører som vil profesjonalisere prosjekter, kunder og leveranser uten å betale for teamlag.',
          points: ['Opptil 25 prosjekter', 'Avansert CRM', 'Kontraktstyring'],
          cta: 'Velg Basic',
        },
        {
          id: 'professional',
          name: 'Professional Creator',
          monthlyPrice: '449 kr',
          yearlyPrice: '4 490 kr',
          monthlyCadence: 'per måned',
          yearlyCadence: 'per år',
          summary: 'For profesjonelle kreatører som trenger full arbeidsflyt, rapportering og tydeligere forretningskontroll.',
          points: ['Ubegrensede prosjekter', 'Ubegrensede klienter', '50 GB lagring'],
          cta: 'Velg Professional',
          highlight: true,
        },
        {
          id: 'premium',
          name: 'Premium Studio',
          monthlyPrice: '1 199 kr',
          yearlyPrice: '11 990 kr',
          monthlyCadence: 'per måned',
          yearlyCadence: 'per år',
          summary: 'For studioer og team som trenger delt arbeidsflyt, automasjon og prioritet i drift.',
          points: ['Teamtilgang', 'Automatiseringer', '250 GB lagring'],
          cta: 'Velg Premium',
        },
      ],
      enterprise: {
        name: 'Enterprise',
        price: 'Kontakt salg',
        summary: 'For større miljøer som trenger white label, governance, onboarding og egne integrasjoner.',
        points: ['White label', 'Dedikert onboarding', 'Tilpassede integrasjoner', 'SSO og tilgangsstyring'],
        cta: 'Kontakt salg',
      },
    },
    why: {
      label: 'Hvorfor dette er kraftfullt',
      title: 'Hvorfor dette er kraftfullt',
      items: [
        'Kjerneplattform - sterkere produktbruk',
        'Produkter - utvidelse og dypere verdi',
        'Academy - rekruttering og vekst',
        'Community - retensjon og nettverkseffekt',
      ],
    },
    finalCta: {
      title: 'Ett system for å styre og skalere kreativt arbeid.',
      body:
        'Creatorhub er laget for kreative profesjoner som trenger struktur, produkter og et økosystem rundt arbeidet sitt.',
      primary: 'Velg abonnement',
      secondary: 'Åpne Community',
    },
    social: {
      label: 'Sosiale medier',
      body: 'Følg CreatorHub for lanseringer, community og produktoppdateringer.',
      instagram: 'Instagram',
      facebook: 'Facebook',
    },
    footer: 'Creatorhub AS - laget av kreative, for kreative.',
    legal: {
      privacy: 'Personvernerklæring',
      terms: 'Vilkår',
    },
  },
  en: {
    title: 'Creatorhub | The platform for creative work',
    nav: {
      platform: 'Platform',
      roleRoom: 'Role Room',
      academy: 'Academy',
      community: 'Community',
      signIn: 'Sign in',
    },
    hero: {
      eyebrow: 'Built by creatives, for creatives.',
      title: 'The platform for creative work',
      subtitle: 'Manage projects, collaborate with teams and execute production in one system.',
      support:
        'Creatorhub is a platform for managing, executing and scaling creative work with built-in tools, products and community.',
      primaryCta: 'See plans & pricing',
      secondaryCta: 'See the products',
      systemLine: 'Core platform / Products / Community layer',
      architectureTitle: 'Creatorhub AS',
      architectureLead:
        'A structured system where the core platform drives products, learning and long-term network effects.',
    },
    architecture: {
      core: {
        title: 'Core Platform',
        subtitle: 'Project Management System',
        items: [
          'Project management tailored for creative professions',
          'Team collaboration across roles and disciplines',
          'Workflow structure for production and delivery',
        ],
      },
      products: {
        title: 'Products',
        subtitle: 'Extensions built on top of the platform',
        items: ['The Role Room', 'Creatorhub Academy'],
      },
      community: {
        title: 'Community Layer',
        subtitle: 'Retention, network and collaboration',
        items: ['Creators', 'Teams', 'Professionals'],
      },
    },
    platform: {
      label: 'Core Platform',
      title: 'A system built for creative workflows',
      body:
        'Creatorhub provides a structured environment for managing creative work across professions, teams and productions.',
      items: [
        'Project management tailored for creative work',
        'Team collaboration',
        'Workflow structure',
        'Task and production tracking',
      ],
      foundation:
        'This is the foundation. Role Room and Academy sit on top of the platform rather than competing with it.',
    },
    products: {
      label: 'Products',
      title: 'Built on top of the platform',
      body:
        'The product layer deepens usage, expands the surface area of the platform and creates multiple entry points into the ecosystem.',
      roleRoom: {
        title: 'The Role Room',
        body:
          'A production system for large-scale video production teams and content producers who need close collaboration with clients from planning through delivery.',
        cta: 'Open The Role Room',
        metaLabel: 'Built for production teams',
        metaValue: 'Planning / Client collaboration / Delivery',
      },
      academy: {
        title: 'Creatorhub Academy',
        body: 'A learning platform designed to develop skills and connect creators.',
        cta: 'Open Academy',
      },
    },
    community: {
      label: 'Community',
      title: 'A connected creative ecosystem',
      body:
        'Creators, teams and professionals are connected through Creatorhub, enabling collaboration, learning and real-world production.',
      points: [
        'Creators with projects, ideas and momentum',
        'Teams coordinating delivery across disciplines',
        'Professionals looking to learn, contribute and grow',
      ],
      panelItems: ['Creators', 'Teams', 'Professionals'],
      cta: 'Explore Community',
    },
    differentiation: {
      label: 'Differentiation',
      title: 'More than tools, a structured system',
      body:
        'Creatorhub combines project management, production tools, learning and community into one unified platform.',
      pillars: [
        { title: 'Project management', body: 'Workflow, structure and accountability for creative teams.' },
        { title: 'Production tools', body: 'Deep product layers designed for execution.' },
        { title: 'Learning', body: 'Academy as a growth and acquisition layer.' },
        { title: 'Community', body: 'A retention layer built around connection and real work.' },
      ],
    },
    pricing: {
      label: 'Subscriptions',
      title: 'Choose your CreatorHub entry point',
      body:
        'The self-serve plans are built for different stages of creative operations, from solo creators to studios. Enterprise is set up with CreatorHub, not through standard checkout.',
      trustLine: 'Monthly subscription / Stripe Checkout for self-serve plans / Enterprise via sales',
      monthlyLabel: 'Monthly',
      yearlyLabel: 'Yearly',
      yearlyBadge: '2 months free',
      yearlySupport: 'Annual billing increases contract value while keeping the purchase path clean and predictable.',
      cards: [
        {
          id: 'basic',
          name: 'Basic Creator',
          monthlyPrice: 'NOK 249',
          yearlyPrice: 'NOK 2,490',
          monthlyCadence: 'per month',
          yearlyCadence: 'per year',
          summary: 'For solo creatives who want a more professional operating layer around projects, clients and delivery.',
          points: ['Up to 25 projects', 'Advanced CRM', 'Contract management'],
          cta: 'Choose Basic',
        },
        {
          id: 'professional',
          name: 'Professional Creator',
          monthlyPrice: 'NOK 449',
          yearlyPrice: 'NOK 4,490',
          monthlyCadence: 'per month',
          yearlyCadence: 'per year',
          summary: 'For professionals who need a fuller workflow, reporting and stronger business control.',
          points: ['Unlimited projects', 'Unlimited clients', '50 GB storage'],
          cta: 'Choose Professional',
          highlight: true,
        },
        {
          id: 'premium',
          name: 'Premium Studio',
          monthlyPrice: 'NOK 1,199',
          yearlyPrice: 'NOK 11,990',
          monthlyCadence: 'per month',
          yearlyCadence: 'per year',
          summary: 'For teams and studios that need shared workflows, automation and priority support.',
          points: ['Team access', 'Automations', '250 GB storage'],
          cta: 'Choose Premium',
        },
      ],
      enterprise: {
        name: 'Enterprise',
        price: 'Contact sales',
        summary: 'For larger environments that need white label, governance, onboarding and custom integrations.',
        points: ['White label', 'Dedicated onboarding', 'Custom integrations', 'SSO and access control'],
        cta: 'Contact sales',
      },
    },
    why: {
      label: 'Why This Is Powerful',
      title: 'Why this is powerful',
      items: [
        'Core platform - sticky product usage',
        'Products - expansion and monetizable depth',
        'Academy - acquisition and growth',
        'Community - retention and network effect',
      ],
    },
    finalCta: {
      title: 'One system for managing and scaling creative work.',
      body:
        'Creatorhub is built for creative professionals who need structure, products and a connected ecosystem around their work.',
      primary: 'Choose a plan',
      secondary: 'Open Community',
    },
    social: {
      label: 'Social media',
      body: 'Follow CreatorHub for launches, community updates and product releases.',
      instagram: 'Instagram',
      facebook: 'Facebook',
    },
    footer: 'Creatorhub AS - built by creatives, for creatives.',
    legal: {
      privacy: 'Privacy Policy',
      terms: 'Terms',
    },
  },
} as const;

const sectionOrder = ['platform', 'role-room', 'academy', 'community', 'pricing'] as const;

const MotionDiv = motion.div;

function upsertHeadLink(rel: string, href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existing) {
    existing.href = href;
    return;
  }

  const next = document.createElement('link');
  next.rel = rel;
  next.href = href;
  document.head.appendChild(next);
}

function ensureLandingFonts() {
  if (typeof document === 'undefined' || document.getElementById('creatorhub-investor-fonts')) {
    return;
  }

  const link = document.createElement('link');
  link.id = 'creatorhub-investor-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap';
  document.head.appendChild(link);
}

function SectionHeading({
  label,
  title,
  body,
  align = 'left',
}: {
  label: string;
  title: string;
  body: string;
  align?: 'left' | 'center';
}) {
  return (
    <Stack
      spacing={2}
      sx={{
        maxWidth: align === 'center' ? 760 : 680,
        mx: align === 'center' ? 'auto' : 0,
        textAlign: align,
      }}
    >
      <Typography
        sx={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontSize: '0.8rem',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'rgba(255,186,108,0.84)',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h2"
        sx={{
          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
          fontWeight: 700,
          fontSize: { xs: '2rem', md: '3.2rem' },
          lineHeight: 1.02,
          color: '#f7f1e8',
          letterSpacing: '-0.04em',
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '1rem', md: '1.12rem' },
          lineHeight: 1.75,
          color: 'rgba(242,234,223,0.72)',
          maxWidth: 620,
          mx: align === 'center' ? 'auto' : 0,
        }}
      >
        {body}
      </Typography>
    </Stack>
  );
}

export default function CreatorHubInvestorLanding({
  mode,
}: CreatorHubInvestorLandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [prototypeTesterFormOpen, setPrototypeTesterFormOpen] = useState(false);
  const [pricingBillingCycle, setPricingBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [publicPricingPlans, setPublicPricingPlans] = useState<CreatorHubPublicPricingPlan[] | null>(null);
  const [, setLocation] = useLocation();
  const { language, setLanguage } = useLanguage();
  const isMobile = mode === 'mobile';
  const locale = language as Locale;
  const copy = landingCopy[locale];

  useEffect(() => {
    ensureLandingFonts();
    document.title = copy.title;
    upsertHeadLink('icon', CREATORHUB_ICON_URL);
    upsertHeadLink('apple-touch-icon', CREATORHUB_ICON_URL);
  }, [copy.title]);

  useEffect(() => {
    let mounted = true;

    const loadPublicPricing = async () => {
      try {
        const response = await fetch('/api/platform/subscription-plans');
        if (!response.ok) return;
        const payload = (await response.json()) as { plans?: Array<Record<string, unknown>> };
        if (!mounted || !Array.isArray(payload.plans)) return;

        const normalized = payload.plans
          .filter((plan) => plan && typeof plan === 'object')
          .map((plan) => ({
            id: String(plan.id || ''),
            name: String(plan.name || ''),
            displayName: String(plan.displayName || plan.name || ''),
            description: String(plan.description || ''),
            currency: String(plan.currency || 'NOK'),
            monthlyPrice:
              typeof plan.monthlyPrice === 'number'
                ? plan.monthlyPrice
                : typeof plan.price === 'number'
                  ? plan.price
                  : 0,
            yearlyPrice:
              typeof plan.yearlyPrice === 'number' ? plan.yearlyPrice : null,
            yearlySavingsLabel:
              typeof plan.yearlySavingsLabel === 'string' ? plan.yearlySavingsLabel : null,
            features: Array.isArray(plan.features)
              ? plan.features.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
              : [],
            contactSalesOnly: Boolean(plan.contactSalesOnly),
            publicPriceLabel:
              typeof plan.publicPriceLabel === 'string' ? plan.publicPriceLabel : null,
            ctaLabel: typeof plan.ctaLabel === 'string' ? plan.ctaLabel : null,
          }))
          .filter((plan) => plan.id && plan.displayName);

        setPublicPricingPlans(normalized);
      } catch {
        // Keep static landing copy as fallback.
      }
    };

    void loadPublicPricing();

    return () => {
      mounted = false;
    };
  }, []);

  const navigateToSection = (id: string) => {
    if (typeof document === 'undefined') {
      return;
    }

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMenuOpen(false);
  };

  const openRoute = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
  };

  const openLoginModal = () => {
    setMenuOpen(false);
    setLoginOpen(true);
  };

  const openSubscriptionSelection = (
    planId?: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
  ) => {
    const params = new URLSearchParams();
    params.set('profession', 'creatorhub');
    params.set('billing', billingCycle);
    params.set('lang', locale);
    if (planId) {
      params.set('plan', planId);
    }
    openRoute(`/subscription-selection?${params.toString()}`);
  };

  const openCreatorHubSalesContact = (planName = 'CreatorHub Enterprise') => {
    const subject =
      locale === 'no'
        ? `${planName} – forespørsel om demo og tilbud`
        : `${planName} - request for demo and pricing`;
    const body =
      locale === 'no'
        ? 'Hei CreatorHub,\n\nVi ønsker en demo og et tilbud for Enterprise.\n\nSelskap:\nTeamstørrelse:\nBehov / integrasjoner:\n'
        : 'Hi CreatorHub,\n\nWe would like a demo and pricing for Enterprise.\n\nCompany:\nTeam size:\nNeeds / integrations:\n';
    openExternalUrl(
      `mailto:hello@creatorhubn.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  };

  const openExternalUrl = (url: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  const navigationItems = [
    { id: 'platform', label: copy.nav.platform },
    { id: 'role-room', label: copy.nav.roleRoom },
    { id: 'academy', label: copy.nav.academy },
    { id: 'community', label: copy.nav.community },
    { id: 'pricing', label: locale === 'no' ? 'Priser' : 'Pricing' },
  ];

  const pricingNumberFormatter = new Intl.NumberFormat(locale === 'no' ? 'nb-NO' : 'en-US', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const formatPublicPricingValue = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale === 'no' ? 'nb-NO' : 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return pricingNumberFormatter.format(amount);
    }
  };

  const resolvedPricingCards = (() => {
    if (!publicPricingPlans || publicPricingPlans.length === 0) {
      return copy.pricing.cards.map((plan) => ({
        ...plan,
        yearlySavingsLabel: copy.pricing.yearlyBadge,
      }));
    }

    const order = ['basic', 'professional', 'premium'];
    return publicPricingPlans
      .filter((plan) => !plan.contactSalesOnly && order.includes(plan.id))
      .sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id))
      .map((plan) => ({
        id: plan.id,
        name: plan.displayName || plan.name,
        monthlyPrice: formatPublicPricingValue(plan.monthlyPrice, plan.currency),
        yearlyPrice:
          typeof plan.yearlyPrice === 'number'
            ? formatPublicPricingValue(plan.yearlyPrice, plan.currency)
            : formatPublicPricingValue(plan.monthlyPrice * 10, plan.currency),
        monthlyCadence: locale === 'no' ? 'per måned' : 'per month',
        yearlyCadence: locale === 'no' ? 'per år' : 'per year',
        summary: plan.description,
        points: plan.features.slice(0, 4),
        cta: plan.ctaLabel || (locale === 'no' ? 'Velg plan' : 'Choose plan'),
        highlight: plan.id === 'professional',
        yearlySavingsLabel: plan.yearlySavingsLabel || copy.pricing.yearlyBadge,
      }));
  })();

  const resolvedEnterprisePlan = (() => {
    const enterprisePlan = publicPricingPlans?.find((plan) => plan.contactSalesOnly);
    if (!enterprisePlan) {
      return copy.pricing.enterprise;
    }

    return {
      name: enterprisePlan.displayName || enterprisePlan.name || copy.pricing.enterprise.name,
      price: enterprisePlan.publicPriceLabel || copy.pricing.enterprise.price,
      summary: enterprisePlan.description || copy.pricing.enterprise.summary,
      points: enterprisePlan.features.slice(0, 4).length > 0 ? enterprisePlan.features.slice(0, 4) : copy.pricing.enterprise.points,
      cta: enterprisePlan.ctaLabel || copy.pricing.enterprise.cta,
    };
  })();
  const creatorhubSocialLinks = getPublicSocialProfiles('creatorhub');

  return (
    <Box sx={{ bgcolor: '#05060a', color: '#f6f2ea' }}>
      <GlobalStyles
        styles={{
          html: { scrollBehavior: 'smooth' },
          body: {
            backgroundColor: '#05060a',
            color: '#f6f2ea',
          },
          '#root': {
            backgroundColor: '#05060a',
          },
        }}
      />

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top right, rgba(255,163,72,0.22), transparent 32%), radial-gradient(circle at left 20%, rgba(218,120,49,0.14), transparent 36%), #05060a',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 78% 18%, rgba(255,186,108,0.16), transparent 24%), radial-gradient(circle at 22% 72%, rgba(208,120,56,0.14), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 24%, rgba(255,255,255,0) 24%, rgba(255,255,255,0) 100%)',
            opacity: 0.92,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(120deg, rgba(5,6,10,0.94) 10%, rgba(5,6,10,0.72) 46%, rgba(5,6,10,0.96) 92%)',
          }}
        />

        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(22px)',
            background: 'rgba(5,6,10,0.58)',
          }}
        >
          <Container maxWidth="xl" sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Button
                onClick={() => navigateToSection('hero')}
                sx={{
                  px: 0,
                  minWidth: 0,
                  color: '#fff5e8',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                <Box
                  component="img"
                  src={CREATORHUB_WORDMARK_URL}
                  alt="Creatorhub"
                  sx={{
                    width: { xs: 148, md: 186 },
                    maxWidth: '100%',
                    height: 'auto',
                    display: 'block',
                    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.35))',
                  }}
                />
              </Button>

              {!isMobile ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  {navigationItems.map((item) => (
                    <Button
                      key={item.id}
                      onClick={() => navigateToSection(item.id)}
                      sx={{
                        color: 'rgba(246,242,234,0.74)',
                        fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                        fontSize: '0.82rem',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        '&:hover': { color: '#fff5e8', bgcolor: 'transparent' },
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Stack>
              ) : null}

              <Stack direction="row" spacing={1} alignItems="center">
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    p: 0.5,
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {localeOptions.map((option) => (
                    <Button
                      key={option.value}
                      onClick={() => setLanguage(option.value)}
                      startIcon={<span>{option.flag}</span>}
                      sx={{
                        minWidth: 0,
                        px: 1.4,
                        py: 0.65,
                        borderRadius: '999px',
                        color: locale === option.value ? '#150d05' : 'rgba(246,242,234,0.72)',
                        backgroundColor:
                          locale === option.value ? '#ffba6c' : 'transparent',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor:
                            locale === option.value ? '#ffba6c' : 'rgba(255,255,255,0.06)',
                        },
                      }}
                    >
                      {locale === 'no' ? option.no : option.en}
                    </Button>
                  ))}
                </Stack>

                {!isMobile ? (
                  <Button
                    onClick={openLoginModal}
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    sx={{
                      borderColor: 'rgba(255,186,108,0.4)',
                      color: '#ffba6c',
                      borderRadius: '999px',
                      px: 2.2,
                      '&:hover': {
                        borderColor: '#ffba6c',
                        bgcolor: 'rgba(255,186,108,0.08)',
                      },
                    }}
                  >
                    {copy.nav.signIn}
                  </Button>
                ) : (
                  <IconButton
                    onClick={() => setMenuOpen(true)}
                    sx={{ color: '#fff5e8' }}
                    aria-label="Open navigation"
                  >
                    <Menu />
                  </IconButton>
                )}
              </Stack>
            </Stack>
          </Container>
        </Box>

        <Container
          id="hero"
          maxWidth="xl"
          sx={{
            position: 'relative',
            zIndex: 2,
            minHeight: { xs: 'calc(100svh - 74px)', md: 'calc(100svh - 82px)' },
            display: 'flex',
            alignItems: 'center',
            py: { xs: 8, md: 10 },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)' },
              gap: { xs: 6, md: 8 },
              alignItems: 'end',
              width: '100%',
            }}
          >
            <MotionDiv
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              <Stack spacing={3.2} sx={{ maxWidth: 760 }}>
                <Typography
                  sx={{
                    fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                    fontSize: '0.82rem',
                    letterSpacing: '0.26em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,186,108,0.88)',
                  }}
                >
                  {copy.hero.eyebrow}
                </Typography>

                <Box
                  component="img"
                  src={CREATORHUB_WORDMARK_URL}
                  alt="Creatorhub"
                  sx={{
                    width: { xs: 210, md: 280 },
                    maxWidth: '100%',
                    height: 'auto',
                    display: 'block',
                    filter: 'drop-shadow(0 18px 38px rgba(0,0,0,0.3))',
                  }}
                />
                <Typography
                  variant="h1"
                  sx={{
                    fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                    fontWeight: 700,
                    fontSize: { xs: '3.1rem', sm: '4.4rem', md: '6.2rem' },
                    lineHeight: { xs: 0.95, md: 0.92 },
                    letterSpacing: '-0.06em',
                    maxWidth: 720,
                    color: '#fbf5ee',
                  }}
                >
                  {copy.hero.title}
                </Typography>

                <Typography
                  sx={{
                    fontSize: { xs: '1.08rem', md: '1.28rem' },
                    lineHeight: 1.7,
                    color: 'rgba(246,242,234,0.76)',
                    maxWidth: 620,
                  }}
                >
                  {copy.hero.subtitle}
                </Typography>

                <Typography
                  sx={{
                    maxWidth: 620,
                    fontSize: { xs: '0.98rem', md: '1.02rem' },
                    lineHeight: 1.8,
                    color: 'rgba(246,242,234,0.58)',
                  }}
                >
                  {copy.hero.support}
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    onClick={() => openSubscriptionSelection('professional')}
                    variant="contained"
                    endIcon={<ArrowForward />}
                    sx={{
                      borderRadius: '999px',
                      px: 3.2,
                      py: 1.4,
                      bgcolor: '#ffba6c',
                      color: '#150d05',
                      fontWeight: 800,
                      '&:hover': { bgcolor: '#ffc788' },
                    }}
                  >
                    {copy.hero.primaryCta}
                  </Button>
                  <Button
                    onClick={() => navigateToSection('role-room')}
                    variant="text"
                    endIcon={<PlayArrow />}
                    sx={{
                      alignSelf: { xs: 'stretch', sm: 'center' },
                      justifyContent: { xs: 'space-between', sm: 'center' },
                      color: '#f6f2ea',
                      borderRadius: '999px',
                      px: { xs: 0, sm: 2.6 },
                      '&:hover': { bgcolor: 'transparent', color: '#ffcf95' },
                    }}
                  >
                    {copy.hero.secondaryCta}
                  </Button>
                </Stack>

                <Typography
                  sx={{
                    fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                    fontSize: '0.76rem',
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'rgba(246,242,234,0.48)',
                  }}
                >
                  {copy.hero.systemLine}
                </Typography>
              </Stack>
            </MotionDiv>

            <MotionDiv
              initial={{ opacity: 0, y: 42 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.16, ease: 'easeOut' }}
            >
              <Box
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '32px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                  boxShadow: '0 36px 120px rgba(0,0,0,0.32)',
                  p: { xs: 2.8, md: 3.6 },
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(circle at top right, rgba(255,186,108,0.24), transparent 28%), radial-gradient(circle at bottom left, rgba(208,120,56,0.16), transparent 34%)',
                  }}
                />
                <Stack spacing={2.6} sx={{ position: 'relative' }}>
                  <Stack spacing={1.2}>
                    <Typography
                      sx={{
                        fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                        fontSize: '0.82rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,186,108,0.8)',
                      }}
                    >
                      {copy.hero.architectureTitle}
                    </Typography>
                    <Typography sx={{ fontSize: '0.98rem', lineHeight: 1.75, color: 'rgba(246,242,234,0.72)' }}>
                      {copy.hero.architectureLead}
                    </Typography>
                  </Stack>

                  {[
                    copy.architecture.core,
                    copy.architecture.products,
                    copy.architecture.community,
                  ].map((layer, index) => (
                    <Box
                      key={layer.title}
                      sx={{
                        p: 2.2,
                        borderRadius: '22px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: index === 0 ? 'rgba(255,186,108,0.14)' : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Stack spacing={1.2}>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography
                            sx={{
                              fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: '#fbf5ee',
                            }}
                          >
                            {layer.title}
                          </Typography>
                          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(246,242,234,0.56)' }}>
                            0{index + 1}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: '0.92rem', color: 'rgba(246,242,234,0.62)' }}>
                          {layer.subtitle}
                        </Typography>
                        <Stack spacing={0.85}>
                          {layer.items.map((item) => (
                            <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '999px',
                                  mt: 0.95,
                                  flexShrink: 0,
                                  bgcolor: index === 0 ? '#ffba6c' : 'rgba(246,242,234,0.72)',
                                }}
                              />
                              <Typography sx={{ fontSize: '0.92rem', color: 'rgba(246,242,234,0.82)' }}>
                                {item}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </MotionDiv>
          </Box>
        </Container>
      </Box>

      <Box component="main" sx={{ position: 'relative', zIndex: 1 }}>
        <Container
          maxWidth="xl"
          sx={{
            pt: { xs: 6, md: 8 },
            pb: { xs: 10, md: 14 },
          }}
        >
          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65 }}
          >
            <Box id="platform" sx={{ pt: 0, pb: { xs: 8, md: 10 } }}>
              <SectionHeading
                label={copy.platform.label}
                title={copy.platform.title}
                body={copy.platform.body}
              />

              <Box
                sx={{
                  mt: 6,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.92fr) minmax(0, 1.08fr)' },
                  gap: { xs: 4, md: 7 },
                  alignItems: 'start',
                }}
              >
                <Stack spacing={3.5}>
                  <Typography
                    sx={{
                      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                      fontSize: { xs: '1.42rem', md: '1.8rem' },
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {copy.platform.foundation}
                  </Typography>
                  <Box
                    sx={{
                      borderLeft: '1px solid rgba(255,186,108,0.32)',
                      pl: 2.4,
                    }}
                  >
                    <Typography sx={{ color: 'rgba(246,242,234,0.62)', lineHeight: 1.85 }}>
                      {copy.hero.support}
                    </Typography>
                  </Box>
                </Stack>

                <Stack
                  spacing={0}
                  sx={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {copy.platform.items.map((item, index) => (
                    <Stack
                      key={item}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      sx={{
                        py: 2.6,
                        borderBottom:
                          index === copy.platform.items.length - 1
                            ? 'none'
                            : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Typography
                        sx={{
                          minWidth: 54,
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: '0.82rem',
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          color: 'rgba(255,186,108,0.84)',
                        }}
                      >
                        0{index + 1}
                      </Typography>
                      <Typography sx={{ fontSize: { xs: '1.02rem', md: '1.16rem' }, color: '#fbf5ee' }}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={{ duration: 0.65 }}
          >
            <Box sx={{ py: { xs: 10, md: 14 } }}>
              <SectionHeading
                label={copy.products.label}
                title={copy.products.title}
                body={copy.products.body}
              />

              <Stack spacing={4} sx={{ mt: 6 }}>
                <Box
                  id="role-room"
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '30px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background:
                      'linear-gradient(120deg, rgba(20,12,28,0.92) 0%, rgba(12,12,18,0.92) 100%)',
                    p: { xs: 3, md: 4.5 },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(circle at 82% 18%, rgba(255,186,108,0.18), transparent 22%), radial-gradient(circle at 18% 78%, rgba(147,99,255,0.12), transparent 26%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                      opacity: 0.96,
                    }}
                  />
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.92fr) minmax(260px, 0.72fr)' },
                      gap: { xs: 3, md: 5 },
                      alignItems: 'center',
                    }}
                  >
                    <Stack spacing={2.2} sx={{ maxWidth: 560 }}>
                      <Box component="img" src={ROLE_ROOM_LOGO_URL} alt="The Role Room" sx={{ width: { xs: 220, md: 300 }, height: 'auto' }} />
                      <Typography
                        sx={{
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: { xs: '1.6rem', md: '2rem' },
                          fontWeight: 700,
                        }}
                      >
                        {copy.products.roleRoom.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(246,242,234,0.7)', lineHeight: 1.85 }}>
                        {copy.products.roleRoom.body}
                      </Typography>
                      <Button
                        onClick={() => openExternalUrl(ROLE_ROOM_EXTERNAL_URL)}
                        endIcon={<NorthEast />}
                        sx={{
                          alignSelf: 'flex-start',
                          color: '#ffba6c',
                          px: 0,
                          '&:hover': { bgcolor: 'transparent', color: '#ffd59f' },
                        }}
                      >
                        {copy.products.roleRoom.cta}
                      </Button>
                    </Stack>

                    <Box
                      sx={{
                        justifySelf: { xs: 'stretch', md: 'end' },
                        borderRadius: '24px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        p: 2.6,
                      }}
                    >
                      <Stack spacing={1.1}>
                        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,186,108,0.8)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                          {copy.products.roleRoom.metaLabel}
                        </Typography>
                        <Typography sx={{ fontSize: '1rem', color: '#f9f4ea', lineHeight: 1.65 }}>
                          {copy.products.roleRoom.metaValue}
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Box>

                <Box
                  id="academy"
                  sx={{
                    overflow: 'hidden',
                    borderRadius: '30px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background:
                      'linear-gradient(135deg, rgba(33,26,13,0.96) 0%, rgba(12,12,18,0.96) 100%)',
                    p: { xs: 3, md: 4.5 },
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.72fr) minmax(0, 1fr)' },
                      gap: { xs: 3, md: 5 },
                      alignItems: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        borderRadius: '24px',
                        border: '1px solid rgba(255,186,108,0.16)',
                        bgcolor: 'rgba(255,186,108,0.06)',
                        p: { xs: 3, md: 4 },
                        minHeight: { xs: 180, md: 220 },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box component="img" src={ACADEMY_LOGO_URL} alt="Creatorhub Academy" sx={{ width: '100%', maxWidth: 260, height: 'auto' }} />
                    </Box>

                    <Stack spacing={2.2} sx={{ maxWidth: 560 }}>
                      <Typography
                        sx={{
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: { xs: '1.6rem', md: '2rem' },
                          fontWeight: 700,
                        }}
                      >
                        {copy.products.academy.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(246,242,234,0.7)', lineHeight: 1.85 }}>
                        {copy.products.academy.body}
                      </Typography>
                      <Button
                        onClick={() => openRoute('/academy')}
                        endIcon={<NorthEast />}
                        sx={{
                          alignSelf: 'flex-start',
                          color: '#ffba6c',
                          px: 0,
                          '&:hover': { bgcolor: 'transparent', color: '#ffd59f' },
                        }}
                      >
                        {copy.products.academy.cta}
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            </Box>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65 }}
          >
            <Box
              id="community"
              sx={{
                py: { xs: 10, md: 14 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.9fr) minmax(320px, 0.72fr)' },
                gap: { xs: 5, md: 7 },
                alignItems: 'center',
              }}
            >
              <Box>
                <SectionHeading
                  label={copy.community.label}
                  title={copy.community.title}
                  body={copy.community.body}
                />
                <Stack spacing={2.2} sx={{ mt: 5 }}>
                  {copy.community.points.map((point) => (
                    <Stack key={point} direction="row" spacing={1.5}>
                      <Groups sx={{ color: '#ffba6c', mt: 0.2 }} />
                      <Typography sx={{ color: 'rgba(246,242,234,0.72)', lineHeight: 1.8 }}>
                        {point}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                <Button
                  onClick={() => openRoute('/community')}
                  variant="text"
                  endIcon={<NorthEast />}
                  sx={{
                    mt: 4,
                    color: '#ffba6c',
                    px: 0,
                    '&:hover': { bgcolor: 'transparent', color: '#ffd59f' },
                  }}
                >
                  {copy.community.cta}
                </Button>
              </Box>

              <Box
                sx={{
                  borderRadius: '32px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                  p: { xs: 3, md: 4 },
                }}
              >
                <Stack spacing={3}>
                  <Box component="img" src={COMMUNITY_ICON_URL} alt="Creatorhub Community" sx={{ width: 72, height: 72 }} />
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Stack spacing={2.2}>
                    {[
                      { icon: <AccountTree sx={{ color: '#ffba6c' }} />, label: copy.community.panelItems[0] },
                      { icon: <AutoAwesome sx={{ color: '#ffba6c' }} />, label: copy.community.panelItems[1] },
                      { icon: <Insights sx={{ color: '#ffba6c' }} />, label: copy.community.panelItems[2] },
                    ].map((entry) => (
                      <Stack key={entry.label} direction="row" spacing={1.5} alignItems="center">
                        {entry.icon}
                        <Typography sx={{ fontSize: '1rem', color: '#f7f1e8' }}>{entry.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            </Box>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={{ duration: 0.65 }}
          >
            <Box sx={{ py: { xs: 6, md: 10 } }}>
              <SectionHeading
                label={copy.differentiation.label}
                title={copy.differentiation.title}
                body={copy.differentiation.body}
              />

              <Box
                sx={{
                  mt: 5,
                  borderRadius: '30px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                }}
              >
                {copy.differentiation.pillars.map((pillar, index) => (
                  <Box
                    key={pillar.title}
                    sx={{
                      p: { xs: 3, md: 3.5 },
                      borderRight: {
                        xs: 'none',
                        md:
                          index === copy.differentiation.pillars.length - 1
                            ? 'none'
                            : '1px solid rgba(255,255,255,0.08)',
                      },
                      borderBottom: {
                        xs:
                          index === copy.differentiation.pillars.length - 1
                            ? 'none'
                            : '1px solid rgba(255,255,255,0.08)',
                        md: 'none',
                      },
                      backgroundColor: index === 0 ? 'rgba(255,186,108,0.08)' : 'transparent',
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Typography
                        sx={{
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: '#fbf5ee',
                        }}
                      >
                        {pillar.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(246,242,234,0.68)', lineHeight: 1.8 }}>
                        {pillar.body}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={{ duration: 0.65 }}
          >
            <Box sx={{ py: { xs: 6, md: 10 } }}>
              <SectionHeading
                label={copy.why.label}
                title={copy.why.title}
                body={copy.differentiation.body}
              />

              <Box
                sx={{
                  mt: 5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                  gap: 1.5,
                }}
              >
                {copy.why.items.map((item, index) => (
                  <Box
                    key={item}
                    sx={{
                      p: 2.6,
                      borderRadius: '22px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background:
                        index === 0
                          ? 'linear-gradient(180deg, rgba(255,186,108,0.12) 0%, rgba(255,186,108,0.04) 100%)'
                          : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                        fontSize: '0.82rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,186,108,0.84)',
                        mb: 1.1,
                      }}
                    >
                      0{index + 1}
                    </Typography>
                    <Typography sx={{ color: '#fbf5ee', lineHeight: 1.7 }}>{item}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={{ duration: 0.65 }}
          >
            <Box id="pricing" sx={{ py: { xs: 6, md: 10 } }}>
              <SectionHeading
                label={copy.pricing.label}
                title={copy.pricing.title}
                body={copy.pricing.body}
              />

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mt: 3.5, mb: 5 }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                      fontSize: '0.8rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,186,108,0.82)',
                    }}
                  >
                    {copy.pricing.trustLine}
                  </Typography>
                  <Typography sx={{ color: 'rgba(246,242,234,0.68)', lineHeight: 1.75, mt: 1.2 }}>
                    {copy.pricing.yearlySupport}
                  </Typography>
                </Box>
                <Stack spacing={1.2} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Stack
                    direction="row"
                    spacing={0.6}
                    sx={{
                      p: 0.6,
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {([
                      ['monthly', copy.pricing.monthlyLabel],
                      ['yearly', copy.pricing.yearlyLabel],
                    ] as const).map(([value, label]) => (
                      <Button
                        key={value}
                        onClick={() => setPricingBillingCycle(value)}
                        sx={{
                          minWidth: 0,
                          px: 1.8,
                          py: 0.8,
                          borderRadius: '999px',
                          textTransform: 'none',
                          fontWeight: 700,
                          color: pricingBillingCycle === value ? '#150d05' : 'rgba(246,242,234,0.76)',
                          bgcolor: pricingBillingCycle === value ? '#ffba6c' : 'transparent',
                          '&:hover': {
                            bgcolor:
                              pricingBillingCycle === value
                                ? '#ffba6c'
                                : 'rgba(255,255,255,0.06)',
                          },
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Stack>

                  {pricingBillingCycle === 'yearly' ? (
                    <Typography sx={{ color: '#ffba6c', fontWeight: 700 }}>
                      {copy.pricing.yearlyBadge}
                    </Typography>
                  ) : null}

                  <Button
                    onClick={() => openSubscriptionSelection('professional', pricingBillingCycle)}
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    sx={{
                      alignSelf: { xs: 'flex-start', md: 'center' },
                      borderRadius: '999px',
                      borderColor: 'rgba(255,186,108,0.36)',
                      color: '#ffba6c',
                      '&:hover': {
                        borderColor: '#ffba6c',
                        bgcolor: 'rgba(255,186,108,0.08)',
                      },
                    }}
                  >
                    {copy.hero.primaryCta}
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {resolvedPricingCards.map((plan) => (
                  <Box
                    key={plan.id}
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: '28px',
                      border: plan.highlight
                        ? '1px solid rgba(255,186,108,0.44)'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: plan.highlight
                        ? 'linear-gradient(180deg, rgba(255,186,108,0.13) 0%, rgba(255,255,255,0.03) 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                      p: { xs: 2.6, md: 3 },
                      minHeight: '100%',
                    }}
                  >
                    {plan.highlight ? (
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: 18,
                          right: 18,
                          borderRadius: '999px',
                          bgcolor: '#ffba6c',
                          color: '#150d05',
                          px: 1.3,
                          py: 0.55,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {locale === 'no' ? 'Anbefalt' : 'Recommended'}
                      </Typography>
                    ) : null}

                    <Stack spacing={2.1} sx={{ height: '100%' }}>
                      <Stack spacing={1}>
                        <Typography
                          sx={{
                            fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                            fontSize: '1.28rem',
                            fontWeight: 700,
                            color: '#fbf5ee',
                            pr: plan.highlight ? 8 : 0,
                          }}
                        >
                          {plan.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="baseline">
                          <Typography
                            sx={{
                              fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                              fontSize: { xs: '2.2rem', md: '2.6rem' },
                              lineHeight: 0.95,
                              letterSpacing: '-0.05em',
                              color: '#ffba6c',
                              fontWeight: 700,
                            }}
                          >
                            {pricingBillingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
                          </Typography>
                          <Typography sx={{ color: 'rgba(246,242,234,0.58)' }}>
                            {pricingBillingCycle === 'yearly' ? plan.yearlyCadence : plan.monthlyCadence}
                          </Typography>
                        </Stack>
                        {pricingBillingCycle === 'yearly' ? (
                          <Typography
                            sx={{
                              color: '#ffba6c',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {plan.yearlySavingsLabel || copy.pricing.yearlyBadge}
                          </Typography>
                        ) : null}
                      </Stack>

                      <Typography sx={{ color: 'rgba(246,242,234,0.72)', lineHeight: 1.75 }}>
                        {plan.summary}
                      </Typography>

                      <Stack spacing={1}>
                        {plan.points.map((point) => (
                          <Stack key={point} direction="row" spacing={1.1} alignItems="flex-start">
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                borderRadius: '999px',
                                flexShrink: 0,
                                mt: 0.9,
                                bgcolor: '#ffba6c',
                              }}
                            />
                            <Typography sx={{ color: 'rgba(246,242,234,0.84)', lineHeight: 1.65 }}>{point}</Typography>
                          </Stack>
                        ))}
                      </Stack>

                      <Box sx={{ mt: 'auto', pt: 1 }}>
                        <Button
                          onClick={() => openSubscriptionSelection(plan.id, pricingBillingCycle)}
                          fullWidth
                          variant={plan.highlight ? 'contained' : 'outlined'}
                          endIcon={<ArrowForward />}
                          sx={{
                            borderRadius: '999px',
                            py: 1.25,
                            fontWeight: 700,
                            textTransform: 'none',
                            bgcolor: plan.highlight ? '#ffba6c' : 'transparent',
                            color: plan.highlight ? '#150d05' : '#fff5e8',
                            borderColor: plan.highlight ? '#ffba6c' : 'rgba(255,255,255,0.16)',
                            '&:hover': {
                              bgcolor: plan.highlight ? '#ffc788' : 'rgba(255,255,255,0.05)',
                              borderColor: plan.highlight ? '#ffc788' : '#fff5e8',
                            },
                          }}
                        >
                          {plan.cta}
                        </Button>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  mt: 2.5,
                  borderRadius: '28px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,186,108,0.08) 100%)',
                  p: { xs: 2.6, md: 3.2 },
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, 0.9fr)' },
                    gap: 3,
                    alignItems: 'start',
                  }}
                >
                  <Stack spacing={1.4}>
                    <Typography
                      sx={{
                        fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                        fontSize: '0.78rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,186,108,0.82)',
                      }}
                    >
                          {locale === 'no' ? 'Enterprise-spor' : 'Enterprise lane'}
                    </Typography>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.25}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                    >
                      <Box>
                        <Typography
                          sx={{
                            fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                            fontSize: { xs: '1.5rem', md: '1.8rem' },
                            fontWeight: 700,
                            color: '#fbf5ee',
                          }}
                        >
                          {resolvedEnterprisePlan.name}
                        </Typography>
                        <Typography sx={{ color: 'rgba(246,242,234,0.72)', lineHeight: 1.75, mt: 0.8, maxWidth: 760 }}>
                          {resolvedEnterprisePlan.summary}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: { xs: '1.4rem', md: '1.7rem' },
                          color: '#ffba6c',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {resolvedEnterprisePlan.price}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack spacing={1.05}>
                    {resolvedEnterprisePlan.points.map((point) => (
                      <Stack key={point} direction="row" spacing={1.1} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '999px',
                            flexShrink: 0,
                            mt: 0.9,
                            bgcolor: '#ffba6c',
                          }}
                        />
                        <Typography sx={{ color: 'rgba(246,242,234,0.84)', lineHeight: 1.65 }}>{point}</Typography>
                      </Stack>
                    ))}

                    <Button
                      onClick={() => openCreatorHubSalesContact(resolvedEnterprisePlan.name)}
                      variant="outlined"
                      endIcon={<ArrowForward />}
                      sx={{
                        mt: 1,
                        alignSelf: 'flex-start',
                        borderRadius: '999px',
                        py: 1.15,
                        px: 2.5,
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#fff5e8',
                        borderColor: 'rgba(255,255,255,0.18)',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.05)',
                          borderColor: '#fff5e8',
                        },
                      }}
                    >
                      {resolvedEnterprisePlan.cta}
                    </Button>
                  </Stack>
                </Box>
              </Box>

              {/* Slice 9X.53 — Prototype-tester rad: lavmælt CTA for plass-begrenset gruppe */}
              <Box
                sx={{
                  mt: 2,
                  borderRadius: '20px',
                  border: '1px dashed rgba(255,186,108,0.32)',
                  background: 'rgba(255,186,108,0.04)',
                  p: { xs: 2, md: 2.4 },
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                  gap: { xs: 2, md: 3 },
                  alignItems: 'center',
                }}
              >
                <Stack spacing={0.6}>
                  <Typography
                    sx={{
                      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                      fontSize: '0.72rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,186,108,0.82)',
                    }}
                  >
                    {locale === 'no' ? 'Plass-begrenset' : 'Limited spots'}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                      fontSize: { xs: '1.15rem', md: '1.35rem' },
                      fontWeight: 700,
                      color: '#fbf5ee',
                    }}
                  >
                    {locale === 'no'
                      ? 'Prototype-tester — tidlig tilgang mot ærlig tilbakemelding'
                      : 'Prototype tester — early access in exchange for honest feedback'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(246,242,234,0.7)', lineHeight: 1.6, fontSize: '0.92rem' }}>
                    {locale === 'no'
                      ? 'Send en søknad så gjennomgår CreatorHub den personlig. Du får tilgang før offentlig lansering og kan forme verktøyet i ekte jobb.'
                      : 'Submit an application and CreatorHub reviews each one personally. Get access before public launch and help shape the product in real work.'}
                  </Typography>
                </Stack>
                <Button
                  onClick={() => {
                    setPrototypeTesterFormOpen(true);
                    if (typeof window !== 'undefined' && (window as any).gtag) {
                      (window as any).gtag('event', 'prototype_tester_cta_clicked', {
                        source: 'landing_pricing_section',
                      });
                    }
                  }}
                  variant="outlined"
                  endIcon={<ArrowForward />}
                  sx={{
                    alignSelf: { xs: 'flex-start', md: 'center' },
                    borderRadius: '999px',
                    py: 1.1,
                    px: 2.4,
                    fontWeight: 700,
                    textTransform: 'none',
                    color: '#150d05',
                    bgcolor: '#ffba6c',
                    borderColor: '#ffba6c',
                    '&:hover': {
                      bgcolor: '#ffc788',
                      borderColor: '#ffc788',
                    },
                  }}
                >
                  {locale === 'no' ? 'Søk om plass' : 'Apply for a spot'}
                </Button>
              </Box>
            </Box>
          </MotionDiv>
        </Container>

        <Box
          sx={{
            px: { xs: 2, md: 4 },
            pb: { xs: 10, md: 14 },
          }}
        >
          <Box
            sx={{
              maxWidth: 1480,
              mx: 'auto',
              borderRadius: '36px',
              overflow: 'hidden',
              border: '1px solid rgba(255,186,108,0.14)',
              background:
                'linear-gradient(135deg, rgba(255,186,108,0.16) 0%, rgba(27,18,9,0.96) 55%, rgba(10,10,16,0.98) 100%)',
              p: { xs: 3, md: 5 },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                gap: { xs: 3, md: 4 },
                alignItems: 'center',
              }}
            >
              <Stack spacing={2}>
                <Typography
                  sx={{
                    fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                    fontWeight: 700,
                    fontSize: { xs: '2rem', md: '3.4rem' },
                    lineHeight: 1,
                    letterSpacing: '-0.05em',
                    maxWidth: 780,
                  }}
                >
                  {copy.finalCta.title}
                </Typography>
                <Typography sx={{ maxWidth: 720, color: 'rgba(246,242,234,0.72)', lineHeight: 1.85 }}>
                  {copy.finalCta.body}
                </Typography>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                <Button
                  onClick={() => openSubscriptionSelection('professional')}
                  variant="contained"
                  endIcon={<ArrowForward />}
                  sx={{
                    borderRadius: '999px',
                    px: 3,
                    py: 1.3,
                    bgcolor: '#ffba6c',
                    color: '#150d05',
                    fontWeight: 800,
                    '&:hover': { bgcolor: '#ffcb91' },
                  }}
                >
                  {copy.finalCta.primary}
                </Button>
                <Button
                  onClick={() => openRoute('/community')}
                  variant="outlined"
                  endIcon={<NorthEast />}
                  sx={{
                    borderRadius: '999px',
                    px: 3,
                    py: 1.3,
                    borderColor: 'rgba(255,245,232,0.22)',
                    color: '#fff5e8',
                    '&:hover': {
                      borderColor: '#fff5e8',
                      bgcolor: 'rgba(255,255,255,0.04)',
                    },
                  }}
                >
                  {copy.finalCta.secondary}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>

        <Container maxWidth="xl" sx={{ pb: 5 }}>
          <Stack
            direction={{ xs: 'column', xl: 'row' }}
            justifyContent="space-between"
            spacing={2.5}
            sx={{
              pt: 2,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(246,242,234,0.52)',
            }}
          >
            <Stack spacing={0.6}>
              <Typography sx={{ fontSize: '0.88rem' }}>{copy.footer}</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(246,242,234,0.38)' }}>
                {PUBLIC_BRAND_LINKS.creatorhub.email}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 0.6, sm: 1.4 }}
                sx={{ pt: 0.6 }}
              >
                <Box
                  component="a"
                  href="/creatorhub-innovasjon"
                  sx={{
                    color: '#fff5e8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '0.18em',
                    fontSize: '0.82rem',
                    '&:hover': { color: '#ffcb91' },
                  }}
                >
                  Creatorhub Innovasjon
                </Box>
                <Box
                  component="a"
                  href="/partner/apply"
                  sx={{
                    color: '#fff5e8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '0.18em',
                    fontSize: '0.82rem',
                    '&:hover': { color: '#ffcb91' },
                  }}
                >
                  Bli redigeringspartner
                </Box>
                <Box
                  component="a"
                  href="/privacy-policy"
                  sx={{
                    color: '#fff5e8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '0.18em',
                    fontSize: '0.82rem',
                    '&:hover': { color: '#ffcb91' },
                  }}
                >
                  {copy.legal.privacy}
                </Box>
                <Box
                  component="a"
                  href="/terms-and-conditions"
                  sx={{
                    color: '#fff5e8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '0.18em',
                    fontSize: '0.82rem',
                    '&:hover': { color: '#ffcb91' },
                  }}
                >
                  {copy.legal.terms}
                </Box>
              </Stack>
            </Stack>

            <PublicSocialLinks
              label={copy.social.label}
              body={copy.social.body}
              links={creatorhubSocialLinks}
              tone="creatorhub"
              maxWidth={380}
            />

            <Typography
              sx={{
                fontSize: '0.88rem',
                textAlign: { xs: 'left', xl: 'right' },
                maxWidth: { xl: 360 },
              }}
            >
              {sectionOrder.map((item) => navigationItems.find((nav) => nav.id === item)?.label).join('  /  ')}
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            bgcolor: '#0b0d12',
            color: '#f6f2ea',
            p: 2,
          },
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box component="img" src={CREATORHUB_ICON_URL} alt="Creatorhub" sx={{ width: 28, height: 28 }} />
              <Typography sx={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontWeight: 700 }}>
                Creatorhub
              </Typography>
            </Stack>
            <IconButton onClick={() => setMenuOpen(false)} sx={{ color: '#f6f2ea' }}>
              <Close />
            </IconButton>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {navigationItems.map((item) => (
            <Button
              key={item.id}
              onClick={() => navigateToSection(item.id)}
              sx={{
                justifyContent: 'space-between',
                color: '#fbf5ee',
                py: 1.4,
                px: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: 'transparent', color: '#ffba6c' },
              }}
              endIcon={<ArrowForward />}
            >
              {item.label}
            </Button>
          ))}

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          <Stack spacing={1.2}>
            <Button
              onClick={() => openSubscriptionSelection('professional')}
              variant="contained"
              sx={{
                borderRadius: '999px',
                bgcolor: '#ffba6c',
                color: '#150d05',
                fontWeight: 800,
                '&:hover': { bgcolor: '#ffcb91' },
              }}
            >
              {copy.hero.primaryCta}
            </Button>
            <Button
              onClick={openLoginModal}
              variant="outlined"
              sx={{
                borderRadius: '999px',
                borderColor: 'rgba(255,245,232,0.22)',
                color: '#fff5e8',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#fff5e8',
                  bgcolor: 'rgba(255,255,255,0.04)',
                },
              }}
            >
              {copy.nav.signIn}
            </Button>
          </Stack>
        </Stack>
      </Drawer>

      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#ffba6c' }} />
          </Box>
        }
      >
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          context="general"
          initialLoginType="general"
          redirectTo="/dashboard"
        />
        <InviteRequestForm
          isOpen={prototypeTesterFormOpen}
          onClose={() => setPrototypeTesterFormOpen(false)}
          selectedRole="prototype_tester"
          selectedPlan={{
            id: 'prototype_tester',
            name: 'Prototype Tester',
            tier: 'prototype_tester',
            price: 0,
            currency: 'NOK',
          }}
          source="prototype_tester_pricing"
        />
      </Suspense>

      <GdprNotice position="bottom" />
    </Box>
  );
}
