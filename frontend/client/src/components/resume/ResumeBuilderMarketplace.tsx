/**
 * CreatorHub Markedsplass - App Store stil
 * Viser CreatorHub-apper og verktøy i et profesjonelt app store design
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Grid,
  TextField,
  InputAdornment,
  Rating,
  Paper,
  Container,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Description as DocumentIcon,
  AutoAwesome as AIIcon,
  Assessment as AnalyzeIcon,
  CloudUpload as UploadIcon,
  History as VersionIcon,
  DriveFolderUpload as DriveIcon,
  CheckCircle as CheckIcon,
  Search as SearchIcon,
  GetApp as GetAppIcon,
  Verified as VerifiedIcon,
  TrendingUp as TrendingIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Work as BriefcaseIcon,
  Gavel as GavelIcon,
  Receipt as ReceiptIcon,
  Groups as GroupsIcon,
  Timer as TimerIcon,
  Image as ImageIcon,
  Clear as ClearIcon,
  SearchOff as SearchOffIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { marketplaceEvents } from '../../utils/creatorhub-events';
import fikenLogo from '../../assets/integrations/fiken-logo.svg';
import tripletexLogo from '../../assets/integrations/tripletex-logo.svg';

interface AppStoreItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  reviewsCount?: number;
  description: string;
  longDescription: string;
  featured?: boolean;
  trending?: boolean;
  downloadCount: number;
  features: { icon: React.ReactNode; text: string }[];
  pricing: {
    free: boolean;
    price?: number;
    currency?: string;
    displayPrice?: string;
    note?: string;
    enterpriseIncluded?: boolean;
  };
  gradientStart: string;
  gradientEnd: string;
  categoryIcon: React.ReactNode;
  monthlyGrowth?: number;
  partnerLogos?: {
    name: string;
    src: string;
    background: string;
  }[];
  mediaGallery?: {
    src: string;
    alt: string;
    label: string;
  }[];
  ctaLabel?: string;
  logoSrc?: string;
  logoAlt?: string;
  /**
   * Slice 9X.70 — abonnements-tiers for apper med flere planer.
   * Marketplace vil rendre dem som kort under prisen og markere ett som
   * "Anbefalt for deg" basert på brukerens profesjon. Reason-feltet
   * forklarer hvorfor systemet anbefaler den planen.
   */
  subscriptionTiers?: Array<{
    id: string;
    name: string;
    price: string;
    /** Hvem dette passer for — vises i selve kortet */
    bestFor: string;
    features: string[];
    /** Profesjoner som får "Anbefalt"-badge for denne planen */
    recommendedFor?: string[];
    /** Vises som forklaring under "Anbefalt"-badgen */
    recommendationReason?: string;
  }>;
}

interface CreatorHubMarketplaceProps {
  onSelect?: (appId: string) => void;
  profession?: string;
  userId?: string;
  showPricing?: boolean;
  appStateById?: Record<string, {
    statusLabel?: string;
    statusDescription?: string;
    ctaLabel?: string;
    accentColor?: string;
  }>;
}

interface AppReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  verified?: boolean | null;
  createdAt?: string | null;
}

interface MarketplaceStats {
  totalApps: number;
  totalDownloads: number;
  averageRating: number;
  totalReviews: number;
  activeUsers: number;
}

const marketplaceGalleryById: Record<string, AppStoreItem['mediaGallery']> = {
  'resume-builder': [
    {
      src: '/marketplace-previews/resume-builder-editor.png',
      alt: 'ResumeBuilder med anonym CV-redigering, erfaringsblokker og tydelige forbedringspunkter.',
      label: 'Editor',
    },
    {
      src: '/marketplace-previews/resume-builder-templates.png',
      alt: 'ResumeBuilder med flere CV-maler og layoutvalg før eksport.',
      label: 'Maler',
    },
    {
      src: '/marketplace-previews/resume-builder-insights.png',
      alt: 'ResumeBuilder med match score, nøkkelord og forbedringsanalyse.',
      label: 'Analyse',
    },
  ],
  'portfolio-pro': [
    {
      src: '/marketplace-previews/portfolio-pro-gallery.png',
      alt: 'Portfolio Pro med kuratert prosjektgalleri og tydelig bildehierarki.',
      label: 'Galleri',
    },
    {
      src: '/marketplace-previews/portfolio-pro-story.png',
      alt: 'Portfolio Pro med case study-visning for prosess, leveranser og respons.',
      label: 'Case study',
    },
    {
      src: '/marketplace-previews/portfolio-pro-insights.png',
      alt: 'Portfolio Pro med innsiktspanel for visninger, respons og kontaktpunkter.',
      label: 'Innsikt',
    },
  ],
  'contract-genius': [
    {
      src: '/marketplace-previews/contract-genius-builder.png',
      alt: 'Contract Genius med modulbasert oppsett av avtaleseksjoner.',
      label: 'Bygging',
    },
    {
      src: '/marketplace-previews/contract-genius-review.png',
      alt: 'Contract Genius med avtalerevisjon, endringer og status per klausul.',
      label: 'Gjennomgang',
    },
    {
      src: '/marketplace-previews/contract-genius-signing.png',
      alt: 'Contract Genius med oversikt over signering, vedlegg og fremdrift.',
      label: 'Signering',
    },
  ],
  'accounting-integration': [
    {
      src: '/marketplace-previews/accounting-integration-flow.png',
      alt: 'Regnskapsoppsett med flyt fra avtale til faktura, betaling og bokføring.',
      label: 'Flyt',
    },
    {
      src: '/marketplace-previews/accounting-integration-ledger.png',
      alt: 'Regnskapsoppsett med avstemming av bilag, kvitteringer og bokføringsgrunnlag.',
      label: 'Avstemming',
    },
    {
      src: '/marketplace-previews/accounting-integration-payouts.png',
      alt: 'Regnskapsoppsett med oppfølging av innbetalinger og manglende dokumentasjon.',
      label: 'Oppfølging',
    },
  ],
  'invoice-pro': [
    {
      src: '/marketplace-previews/invoice-pro-compose.png',
      alt: 'Invoice Pro med linjebasert fakturakomponering og kontroll før utsending.',
      label: 'Fakturering',
    },
    {
      src: '/marketplace-previews/invoice-pro-tracking.png',
      alt: 'Invoice Pro med statusoversikt for sendte, åpnete og betalte fakturaer.',
      label: 'Sporing',
    },
    {
      src: '/marketplace-previews/invoice-pro-recurring.png',
      alt: 'Invoice Pro med oppsett for gjentakende fakturaregler og løp.',
      label: 'Oppsett',
    },
  ],
  'client-management': [
    {
      src: '/marketplace-previews/client-management-pipeline.png',
      alt: 'Client Hub med pipeline for leads, tilbud, aktive løp og oppfølging.',
      label: 'Pipeline',
    },
    {
      src: '/marketplace-previews/client-management-communication.png',
      alt: 'Client Hub med kommunikasjonspanel for tråder, notater og oppfølging.',
      label: 'Kommunikasjon',
    },
    {
      src: '/marketplace-previews/client-management-outcomes.png',
      alt: 'Client Hub med oversikt over konvertering, oppfølging og leveransehastighet.',
      label: 'Oppfølging',
    },
  ],
  'time-tracker': [
    {
      src: '/marketplace-previews/time-tracker-capture.png',
      alt: 'Time Tracker med aktiv tidsføring, kategorier og prosjektkontekst.',
      label: 'Føring',
    },
    {
      src: '/marketplace-previews/time-tracker-timeline.png',
      alt: 'Time Tracker med tidslinje over arbeidsblokker og prosjektfordeling per dag.',
      label: 'Oversikt',
    },
    {
      src: '/marketplace-previews/time-tracker-insights.png',
      alt: 'Time Tracker med innsikt i tidsbruk, kapasitet og lønnsomhet.',
      label: 'Analyse',
    },
  ],
};

const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
  const icons: Record<string, React.ReactNode> = {
    Career: <BriefcaseIcon />,
    Showcase: <ImageIcon />,
    Legal: <GavelIcon />,
    Finance: <ReceiptIcon />,
    Business: <GroupsIcon />,
    Productivity: <TimerIcon />,
  };
  return <>{icons[category] || <DocumentIcon />}</>;
};

const categoryLabelMap: Record<string, string> = {
  all: 'Alle',
  Career: 'Karriere',
  Showcase: 'Utstilling',
  Legal: 'Juridisk',
  Finance: 'Økonomi',
  Business: 'Bedrift',
  Productivity: 'Produktivitet',
};

export const CreatorHubMarketplace: React.FC<CreatorHubMarketplaceProps> = ({
  onSelect,
  profession = 'photographer',
  userId = 'anonymous',
  showPricing = true,
  appStateById = {},
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [activeReviewApp, setActiveReviewApp] = useState<AppStoreItem | null>(null);
  const [reviewsByApp, setReviewsByApp] = useState<Record<string, AppReview[]>>({});
  const [reviewSummaryByApp, setReviewSummaryByApp] = useState<
    Record<string, { avgRating: number; reviewCount: number }>
  >({});
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    rating: 0,
    title: '',
    comment: '',
    userName: '',
  });

  const hardcodedApps: AppStoreItem[] = [
    {
      id: 'next-role',
      name: 'NextRole',
      category: 'Karriere',
      rating: 0,
      reviews: 0,
      description: 'Å søke jobb har aldri vært enklere.',
      longDescription:
        'AI-drevet CV-bygger og jobbsøk-pakke på norsk. 15 maler, 8 fargeskjemaer, AI-assistert skriving (Claude), PDF-import, GitHub-import, ATS-optimalisering, søknadsbrev, intervjuforberedelse, oversettelse til engelsk, offentlig CV-deling, versjonshistorikk. Bygget av CreatorHub for norske jobbsøkere.',
      featured: true,
      trending: false,
      downloadCount: 0,
      monthlyGrowth: 0,
      features: [
        { icon: <DocumentIcon />, text: '15 profesjonelle maler + 8 farger' },
        { icon: <AIIcon />, text: 'AI-CV: import, omskriv, oversett' },
        { icon: <AnalyzeIcon />, text: 'ATS-score + keyword-match' },
        { icon: <UploadIcon />, text: 'PDF/DOCX-import med Claude' },
        { icon: <VersionIcon />, text: 'Versjon-historikk + restore' },
        { icon: <DriveIcon />, text: 'Offentlig CV-lenke + deling' },
      ],
      mediaGallery: marketplaceGalleryById['resume-builder'],
      pricing: {
        free: false,
        price: 49,
        currency: 'kr/mnd',
        displayPrice: '49 kr / mnd',
        note: '14 dagers gratis prøveperiode med alle Pro-features — ingen kort kreves',
      },
      subscriptionTiers: [
        {
          id: 'trial',
          name: '14 dagers prøveperiode',
          price: 'Gratis i 14 dager',
          bestFor: 'Prøv ALLE Pro-features uten kort — så velg pakken som passer',
          features: [
            'Alle Pro-features låst opp i 14 dager',
            'Ingen kortinformasjon nødvendig',
            'Auto-konverterer til Standard (49 kr/mnd) etter — kanselleres når som helst',
          ],
        },
        {
          id: 'standard',
          name: 'Standard',
          price: '49 kr / mnd',
          bestFor: 'Aktive jobbsøkere — kampanjepris ut 2026',
          recommendedFor: ['photographer', 'videographer', 'developer', 'designer', 'marketing', 'consultant', 'creator'],
          recommendationReason: 'Du jobber i en bransje der profesjonell CV gjør forskjellen. Standard gir deg alt du trenger for å lande neste rolle.',
          features: [
            '5 CV-er (master + tilpasninger per stilling)',
            'Alle 15 maler + 8 fargeskjemaer',
            'AI: sammendrag, omskriv-bullets, ATS-analyse',
            'PDF/DOCX-import (Claude leser eksisterende CV)',
            'Offentlig CV-deling med trygg lenke',
            'Eksport i PDF, DOCX, TXT',
            'Jobbsøknadssporing',
            'LinkedIn- og Vitnemålsportalen-import',
          ],
        },
        {
          id: 'pro',
          name: 'Pro',
          price: '99 kr / mnd',
          bestFor: 'Bytter jobb ofte eller jobber internasjonalt',
          features: [
            'Alt i Standard pluss:',
            'Ubegrenset antall CV-er',
            'AI søknadsbrev-generator (norsk + engelsk)',
            'AI intervjuforberedelse',
            'Engelsk versjon av CV-en med ett klikk',
            'Versjon-historikk med restore',
            'GitHub-import av prosjekter',
            'CSV-/JSON-eksport',
            'Prioritert AI-rate-limit (50/min, 500/dag)',
            'Tidlig tilgang til nye funksjoner',
          ],
        },
      ],
      logoSrc: '/NextRole_Iconapp.png',
      logoAlt: 'NextRole logo',
      gradientStart: '#1F2937',
      gradientEnd: '#F5B82E',
      categoryIcon: <BriefcaseIcon />,
    },
    {
      id: 'post-agent',
      name: 'Post Agent',
      category: 'Produksjon',
      rating: 0,
      reviews: 0,
      description: 'Hele produksjonen — fra opptak til ferdig demo.',
      longDescription:
        'Mac-app (Apple Silicon) for film- og innholdsproduksjon. Kjøp kun modulene du trenger: Demo Studio (interaktive produktdemoer + Product Brain + publisering), Marketing (persona×funnel×kanal-motor med 11 rammeverk), Capture & iPad (Canon-tethering + AI-culling + on-set iPad + leveranse), og Resolve-bro (DaVinci Resolve + Photoshop/Firefly + voiceover). Appen låser opp modulene du abonnerer på — last ned én gang, betal kun for det du bruker.',
      featured: true,
      trending: true,
      downloadCount: 0,
      monthlyGrowth: 0,
      features: [
        { icon: <ImageIcon />, text: 'Demo Studio: interaktive produktdemoer' },
        { icon: <AIIcon />, text: 'Marketing: 11 rammeverk × persona × funnel' },
        { icon: <UploadIcon />, text: 'Capture: Canon-tethering + AI-culling + iPad' },
        { icon: <AnalyzeIcon />, text: 'Resolve + Photoshop/Firefly-bro' },
        { icon: <GetAppIcon />, text: 'Last ned én app — moduler låses opp etter kjøp' },
        { icon: <TimerIcon />, text: 'Krever Mac med Apple Silicon' },
      ],
      pricing: {
        free: false,
        price: 149,
        currency: 'kr/mnd',
        displayPrice: 'Fra 149 kr / mnd',
        note: 'À la carte — kjøp kun modulene du trenger. Alle fire = 299 kr/mnd (Komplett-pakke).',
      },
      subscriptionTiers: [
        {
          id: 'demo_studio',
          name: 'Demo Studio',
          price: '199 kr / mnd',
          bestFor: 'Lag interaktive produktdemoer + one-pagere + publiser delbare guider',
          recommendedFor: ['marketing', 'consultant', 'creator', 'developer'],
          recommendationReason: 'Du selger produkt eller tjeneste — Demo Studio gjør komplekse ting forklart på minutter.',
          features: [
            'Interaktive produktdemoer med hotspots',
            'Product Brain: one-pager → verifisert tankekart',
            'AI-infographics + branding fra siden din',
            'Publiser som delbar hostet lenke + analytics',
          ],
        },
        {
          id: 'marketing',
          name: 'Marketing',
          price: '199 kr / mnd',
          bestFor: 'Markedsføring med struktur: persona × funnel × kanal',
          recommendedFor: ['marketing', 'agency'],
          recommendationReason: 'Markedsmotoren binder metode til faktiske produktdeler — ikke generisk fyll.',
          features: [
            '11 rammeverk × 7 mål × 7 kanaler',
            'Beat→evidens-binding mot produktet',
            'Kontekstuelle infographics',
            'Asset-bibliotek for gjenbruk',
          ],
        },
        {
          id: 'capture',
          name: 'Capture & iPad',
          price: '399 kr / mnd',
          bestFor: 'Fotografer/studioer: tethering, culling og leveranse',
          recommendedFor: ['photographer', 'videographer'],
          recommendationReason: 'Erstatter tethering + culling + leveranse-galleri i ett — den dyreste delen av flyten.',
          features: [
            'Canon R6 MkII-tethering (CCAPI)',
            'AI-culling + highlight-scoring',
            'iPad on-set capture (TestFlight)',
            'Leveranse + signerte galleri-lenker',
          ],
        },
        {
          id: 'resolve',
          name: 'Resolve-bro',
          price: '149 kr / mnd',
          bestFor: 'Redigerere som lever i DaVinci Resolve + Photoshop',
          recommendedFor: ['videographer', 'editor'],
          recommendationReason: 'Multi-agent-bro mellom Resolve native og Photoshop+Firefly — automatiserer kjedelig grading/eksport.',
          features: [
            'DaVinci Resolve 21-bro (live command-router)',
            'Photoshop + Firefly-integrasjon',
            'Quick Export + PowerGrade',
            'Auto-voiceover (Resolve + Web Speech)',
          ],
        },
      ],
      ctaLabel: 'Velg moduler',
      gradientStart: '#0F172A',
      gradientEnd: '#6D28D9',
      categoryIcon: <ImageIcon />,
    },
    {
      id: 'role-room',
      name: 'The Role Room',
      category: 'Business',
      rating: 0,
      reviews: 0,
      description: 'Casting, crew & produksjonsplanlegging',
      longDescription: 'Komplett casting-system for film, TV og teater. Administrer roller, kandidater, crew, tidsplaner og produksjonsdetaljer — alt koblet til Creatorhub-prosjekter.',
      featured: true,
      downloadCount: 0,
      monthlyGrowth: 0,
      features: [
        { icon: <GroupsIcon />, text: 'Rolleforvaltning & casting' },
        { icon: <DocumentIcon />, text: 'Kandidat-administrasjon' },
        { icon: <TimerIcon />, text: 'Tidsplanlegging' },
        { icon: <AnalyzeIcon />, text: 'Prosjektsynkronisering' },
      ],
      mediaGallery: [
        {
          src: '/marketplace-previews/role-room-after-click.png',
          alt: 'The Role Room velkomstflyt med inngangsvalg for produksjonsteam, innholdsprodusent og utdanningsinstitusjon.',
          label: 'Inngang',
        },
        {
          src: '/marketplace-previews/role-room-team-step.png',
          alt: 'The Role Room produksjonsteam-oppsett med plantrinn for bedrift, rolle, team og betaling.',
          label: 'Produksjonsteam',
        },
        {
          src: '/marketplace-previews/role-room-content-producer-step.png',
          alt: 'The Role Room innholdsprodusent-oppsett med fokus på brief, storyboard og leveranser.',
          label: 'Innholdsprodusent',
        },
      ],
      pricing: {
        free: false,
        displayPrice: 'Fra 495 kr / mnd eks. mva.',
        note: 'Installeres fra Marketplace. Fanen i CreatorHub blir tilgjengelig når installasjon, abonnement og aktivering er registrert.',
      },
      gradientStart: '#F59E0B',
      gradientEnd: '#D946EF',
      categoryIcon: <GroupsIcon />,
      logoSrc: '/TheRoleRoom_App_Logo.png',
      logoAlt: 'The Role Room',
      subscriptionTiers: [
        {
          id: 'individual',
          name: 'Innholdsprodusent',
          price: '495 kr / mnd',
          bestFor: 'Solo-skaper som lager video- og foto-innhold for kunder eller egne kanaler.',
          features: [
            'Brief + storyboarding-verktøy',
            'Egen produksjonsplan & sjekklister',
            'Inntil 3 aktive prosjekter',
            'Leveranse-tracker mot kunde',
          ],
          recommendedFor: ['photographer', 'videographer', 'music_producer', 'vendor'],
          recommendationReason:
            'Du jobber som individuell skaper. Innholdsprodusent-planen gir deg brief, storyboard og leveranse-flyt — uten kompleksiteten i et helt casting-system du ikke trenger.',
        },
        {
          id: 'production-team',
          name: 'Produksjonsteam',
          price: '1 495 kr / mnd',
          bestFor: 'Film-, TV- og kommersielle produksjoner med skuespillere, crew og flere scener.',
          features: [
            'Full casting-modul (auditions, callbacks)',
            'Crew- og scene-styring',
            'Ubegrensede prosjekter',
            'Team-roller, rettigheter og approval-flyt',
          ],
          recommendedFor: ['enterprise', 'admin'],
          recommendationReason:
            'Du er del av et team. Produksjonsteam-planen håndterer skuespillere, crew og scener på film/TV-nivå — designet for produksjoner med flere personer som koordinerer.',
        },
        {
          id: 'education',
          name: 'Utdanningsinstitusjon',
          price: 'Tilpasset tilbud',
          bestFor: 'Film- og medie-skoler med klasse-basert storyboarding og student-evalueringer.',
          features: [
            'Klasse-tilgang med læringsmål',
            'Student-portfolio & eksamen',
            'Lærer-dashboard',
            'Volum-rabatt',
          ],
          recommendedFor: ['education_institution'],
          recommendationReason:
            'Skoler får en egen modus for klasse-basert undervisning, student-portfolios og lærer-evaluering.',
        },
      ],
    },
  ];

  // Slice 9X.70 — admin-styrt marketplace. Apper hentes fra
  // /api/marketplace/apps (admin-konfigurert). Faller tilbake på hardkodet
  // liste hvis backend ikke svarer eller tabellen er tom.
  const { data: apiAppsData, isLoading: appsLoading } = useQuery({
    queryKey: ['marketplace-apps-public'],
    queryFn: async () => {
      try {
        const res = await apiRequest('/api/marketplace/apps');
        return (res?.data || []) as AppStoreItem[];
      } catch { return []; }
    },
    staleTime: 30_000,
  });
  const apps: AppStoreItem[] = useMemo(() => {
    const apiApps = apiAppsData || [];
    if (apiApps.length === 0) return hardcodedApps;
    // Admin-konfig overstyrer hardkodet pr. id; nye admin-apper kommer i tillegg.
    const adminIds = new Set(apiApps.map((a) => a.id));
    const hardcodedFallback = hardcodedApps.filter((a) => !adminIds.has(a.id));
    return [...apiApps, ...hardcodedFallback];
  }, [apiAppsData, hardcodedApps]);

  // Stats utledes fra den faktiske app-lista (DB + katalog). Det gamle
  // /api/marketplace/stats-endepunktet aggregerte feil tabell (editing-vendor-
  // produkter, 333 stk) og viste meningsløse tall (rating 1, downloads=reviews).
  const statsLoading = appsLoading;
  const marketplaceStats: MarketplaceStats = useMemo(() => {
    const rc = (a: AppStoreItem) => a.reviewsCount ?? a.reviews ?? 0;
    const totalDownloads = apps.reduce((s, a) => s + (a.downloadCount || 0), 0);
    const totalReviews = apps.reduce((s, a) => s + rc(a), 0);
    const rated = apps.filter((a) => (a.rating || 0) > 0 && rc(a) > 0);
    const weighted = rated.reduce((s, a) => s + (a.rating || 0) * rc(a), 0);
    const ratingWeight = rated.reduce((s, a) => s + rc(a), 0);
    return {
      totalApps: apps.length,
      totalDownloads,
      averageRating: ratingWeight ? weighted / ratingWeight : 0,
      totalReviews,
      activeUsers: totalReviews, // 4. felt viser nå «Vurderinger»
    };
  }, [apps, appsLoading]);

  const categories = ['all', 'Career', 'Showcase', 'Legal', 'Finance', 'Business', 'Productivity'];

  const filteredApps = useMemo(() => {
    let result = apps.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    result = result.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'downloads':
          return b.downloadCount - a.downloadCount;
        case 'trending':
          return (b.monthlyGrowth || 0) - (a.monthlyGrowth || 0);
        case 'featured':
        default:
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          if (a.trending && !b.trending) return -1;
          if (!a.trending && b.trending) return 1;
          return 0;
      }
    });

    return result;
  }, [apps, searchTerm, selectedCategory, sortBy]);

  const accountingIntegrationApp = apps.find((app) => app.id === 'accounting-integration') || null;
  const featuredApps = apps.filter(app => app.featured && app.id !== 'accounting-integration');
  const topRatedApp = apps
    .filter((app) => app.id !== 'accounting-integration')
    .reduce((prev, current) =>
    prev.rating > current.rating ? prev : current
  );

  const toggleFavorite = (appId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(appId)) {
        newFavorites.delete(appId);
      } else {
        newFavorites.add(appId);
      }
      return newFavorites;
    });
  };

  const fetchReviews = async (appId: string) => {
    setReviewsLoading(true);
    setReviewError(null);

    try {
      const response = await apiRequest(`/api/marketplace/apps/${appId}/reviews`);
      setReviewsByApp(prev => ({ ...prev, [appId]: response.reviews || [] }));
      setReviewSummaryByApp(prev => ({
        ...prev,
        [appId]: response.summary || { avgRating: 0, reviewCount: 0 },
      }));
    } catch (error) {
      setReviewError('Kunne ikke laste anmeldelser. Prøv igjen.');
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleOpenReviewDialog = (app: AppStoreItem) => {
    setActiveReviewApp(app);
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!activeReviewApp) return;

    setReviewSubmitLoading(true);
    setReviewError(null);

    try {
      await apiRequest(`/api/marketplace/apps/${activeReviewApp.id}/reviews`, {
        method: 'POST',
        body: {
          userId: userId || 'anonymous',
          userName: reviewForm.userName || 'Anonymous',
          rating: reviewForm.rating,
          title: reviewForm.title,
          comment: reviewForm.comment,
        },
      });

      setReviewForm({ rating: 5, title: '', comment: '', userName: reviewForm.userName });
      await fetchReviews(activeReviewApp.id);
    } catch (error) {
      setReviewError('Kunne ikke sende anmeldelsen. Prøv igjen.');
    } finally {
      setReviewSubmitLoading(false);
    }
  };

  useEffect(() => {
    if (reviewDialogOpen && activeReviewApp) {
      fetchReviews(activeReviewApp.id);
    }
  }, [reviewDialogOpen, activeReviewApp]);


  const formatCompactNumber = (value?: number | null) => {
    if (!value || Number.isNaN(value)) return '—';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const formatRatingValue = (value?: number | null) => {
    if (!value || Number.isNaN(value)) return '—';
    return `${value.toFixed(1)}★`;
  };

  const renderAppCard = (app: AppStoreItem, featured = false) => {
    const appState = appStateById[app.id];
    const summary = reviewSummaryByApp[app.id];
    const displayRating = Number.isFinite(summary?.avgRating)
      ? summary!.avgRating
      : app.rating || 0;
    const displayReviews = Number.isFinite(summary?.reviewCount)
      ? summary!.reviewCount
      : app.reviews;

    return (
      <Card
        key={app.id}
        sx={{
          height: '100%',
          minHeight: featured ? 660 : 580,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: featured ? 3 : 2,
          border: featured ? `2px solid ${app.gradientStart}` : '1px solid rgba(255,255,255,0.10)',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: featured
            ? `linear-gradient(135deg, ${app.gradientStart}10 0%, ${app.gradientEnd}10 100%)`
            : 'rgba(255,255,255,0.04)',
          '&:hover': {
            transform: `translateY(${featured ? -12 : -8}px)`,
            boxShadow: featured
              ? `0 30px 60px rgba(0, 0, 0, 0.40)`
              : '0 20px 40px rgba(0, 0, 0, 0.30)',
            borderColor: app.gradientStart,
            background: featured
              ? `linear-gradient(135deg, ${app.gradientStart}18 0%, ${app.gradientEnd}18 100%)`
              : 'rgba(255,255,255,0.06)',
          },
        }}
      >
        <Box
          sx={{
            background: `linear-gradient(135deg, ${app.gradientStart} 0%, ${app.gradientEnd} 100%)`,
            height: featured ? 160 : 120,
            position: 'relative',
            overflow: 'hidden',
            px: 2.5,
            py: 2,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
            {app.featured && (
              <Chip
                icon={<VerifiedIcon />}
                label="Utvalgt"
                size="small"
                sx={{
                  background: 'rgba(255,255,255,0.04)',
                  color: app.gradientStart,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              />
            )}
            {app.trending && app.monthlyGrowth && app.monthlyGrowth > 0 && (
              <Chip
                icon={<TrendingIcon />}
                label={`+${app.monthlyGrowth}% denne måneden`}
                size="small"
                sx={{
                  background: 'rgba(255,186,108,0.18)',
                  color: app.gradientStart,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              />
            )}
          </Stack>
          <Box sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                backdropFilter: 'blur(14px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
                overflow: 'hidden',
              }}
            >
              {app.logoSrc ? (
                <Box
                  component="img"
                  src={app.logoSrc}
                  alt={app.logoAlt || app.name}
                  sx={{ width: 40, height: 40, objectFit: 'contain' }}
                />
              ) : (
                app.categoryIcon
              )}
            </Box>

            {app.partnerLogos && app.partnerLogos.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {app.partnerLogos.map((partner) => (
                  <Box
                    key={partner.name}
                    sx={{
                      height: 36,
                      px: 1.5,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: partner.background,
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
                    }}
                  >
                    <Box
                      component="img"
                      src={partner.src}
                      alt={partner.name}
                      sx={{ display: 'block', height: 16, maxWidth: 92, width: 'auto' }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Box>

        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: featured ? 3 : 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant={featured ? 'h5' : 'h6'} sx={{ fontWeight: 700, mb: 0.5, color: 'rgba(255,255,255,0.95)' }}>
                {app.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ color: app.gradientStart }}>
                  <CategoryIcon category={app.category} />
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                  {categoryLabelMap[app.category] || app.category}
                </Typography>
              </Box>
            </Box>
            <Tooltip title={favorites.has(app.id) ? 'Fjern favoritt' : 'Legg til favoritt'}>
              <IconButton
                size="small"
                onClick={() => toggleFavorite(app.id)}
                sx={{
                  color: favorites.has(app.id) ? app.gradientStart : '#ccc',
                  transition: 'transform 0.1s',
                  '&:hover': {
                    color: app.gradientStart,
                    background: `${app.gradientStart}15`,
                  },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              >
                {favorites.has(app.id) ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          <Typography
            variant={featured ? 'body1' : 'body2'}
            sx={{ color: 'rgba(255,255,255,0.70)', mb: 2.5, minHeight: featured ? 50 : 40 }}
          >
            {app.description}
          </Typography>

          {app.mediaGallery?.length ? (
            <Box sx={{ mb: 2.5 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 1,
                }}
              >
                {app.mediaGallery.slice(0, 3).map((media) => (
                  <Box
                    key={media.src}
                    sx={{
                      position: 'relative',
                      height: featured ? 112 : 88,
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: '#09090f',
                      boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)',
                    }}
                  >
                    <Box
                      component="img"
                      loading="lazy"
                      src={media.src}
                      alt={media.alt}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        filter: 'brightness(0.92) saturate(1.04)',
                        transform: 'scale(1.01)',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, rgba(9, 9, 15, 0.04) 0%, rgba(9, 9, 15, 0.78) 100%)',
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        left: 10,
                        bottom: 8,
                        color: '#fff',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        fontSize: '0.66rem',
                      }}
                    >
                      {media.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, pb: 2.5, borderBottom: '1px solid #f0f0f0' }}>
            <Box sx={{ flex: 1 }}>
              {displayReviews > 0 ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <Rating value={displayRating} readOnly size="small" />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                      {Number.isFinite(displayRating) ? displayRating.toFixed(1) : '—'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>
                    {Number.isFinite(displayReviews) ? displayReviews.toLocaleString() : '0'} anmeldelser
                  </Typography>
                </>
              ) : (
                // Slice 9X.78 — "Ny app"-badge istedenfor mock-stjerner
                <Chip
                  icon={<InfoOutlinedIcon sx={{ fontSize: '0.9rem' }} />}
                  label="Ny app — venter på vurderinger"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(79, 172, 254, 0.12)',
                    color: '#0284c7',
                    fontWeight: 700,
                    fontSize: '0.66rem',
                    height: 22,
                    '& .MuiChip-icon': { color: '#0284c7' },
                  }}
                />
              )}
            </Box>

            <Box sx={{ flex: 1 }}>
              {app.downloadCount > 0 ? (
                <>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)', display: 'block', mb: 0.25 }}
                  >
                    {(app.downloadCount / 1000).toFixed(0)}K nedlastinger
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 4,
                      background: 'rgba(255,255,255,0.10)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${Math.min((app.downloadCount / 160000) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${app.gradientStart} 0%, ${app.gradientEnd} 100%)`,
                      }}
                    />
                  </Box>
                </>
              ) : (
                <>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)', display: 'block', mb: 0.25 }}
                  >
                    Enterprise inkludert
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem' }}>
                    Inkludert når oppsett er del av avtalen
                  </Typography>
                </>
              )}
            </Box>
          </Box>

          <Grid container spacing={1} sx={{ mb: 2.5 }}>
            {app.features.slice(0, 3).map((feature, idx) => (
              <Grid item xs={6} key={idx}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ color: app.gradientStart, mt: 0.25, fontSize: '1rem' }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.70)', fontSize: '0.8rem' }}>
                    {feature.text}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {showPricing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {app.pricing.free ? (
                  <>
                    <Chip
                      label="Gratis"
                      size="small"
                      sx={{
                        background: '#E8F5E9',
                        color: '#2E7D32',
                        fontWeight: 700,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                      + Pro fra {app.pricing.price} {app.pricing.currency}
                    </Typography>
                  </>
                ) : (
                  // Slice 9X.70 — Stine så ikke prisen. Gjør chippen større
                  // og mer prominent slik at "Fra 495 kr/mnd" leses tydelig.
                  <Chip
                    label={app.pricing.displayPrice || `Fra ${app.pricing.price} ${app.pricing.currency}`}
                    sx={{
                      background: app.gradientStart,
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '1rem',
                      px: 1.5,
                      py: 2.5,
                      height: 'auto',
                      border: `1.5px solid ${app.gradientStart}55`,
                    }}
                  />
                )}
                {app.pricing.enterpriseIncluded && (
                  <Chip
                    label="Inkludert i Enterprise"
                    size="small"
                    sx={{
                      background: '#E8F5E9',
                      color: '#2E7D32',
                      fontWeight: 700,
                    }}
                  />
                )}
              </Box>
              {app.pricing.note && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>
                  {app.pricing.note}
                </Typography>
              )}

              {/* Slice 9X.70 — abonnements-tier-velger med "Anbefalt"-badge */}
              {app.subscriptionTiers && app.subscriptionTiers.length > 0 && (
                <Box sx={{ width: '100%', mt: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.78)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1, display: 'block' }}
                  >
                    Velg plan
                  </Typography>
                  <Stack spacing={1}>
                    {app.subscriptionTiers.map((tier) => {
                      const isRecommended = profession ? (tier.recommendedFor || []).includes(profession) : false;
                      return (
                        <Box
                          key={tier.id}
                          sx={{
                            p: 2,
                            borderRadius: 3.5,
                            border: isRecommended ? `2px solid ${app.gradientStart}` : '1px solid rgba(255,255,255,0.10)',
                            background: isRecommended ? `${app.gradientStart}18` : 'rgba(255,255,255,0.04)',
                            position: 'relative',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: app.gradientStart, transform: 'translateY(-1px)' },
                          }}
                        >
                          {isRecommended && (
                            <Chip
                              label="Anbefalt for deg"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: -10,
                                left: 12,
                                bgcolor: app.gradientStart,
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                height: 20,
                              }}
                            />
                          )}
                          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                            <Typography variant="body1" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.95)' }}>
                              {tier.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 800, color: app.gradientStart, fontFamily: '"Space Grotesk", sans-serif' }}
                            >
                              {tier.price}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)', display: 'block', mb: 0.75, lineHeight: 1.4 }}>
                            {tier.bestFor}
                          </Typography>
                          <Stack spacing={0.25}>
                            {tier.features.map((f) => (
                              <Stack key={f} direction="row" spacing={0.5} alignItems="flex-start">
                                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: app.gradientStart, mt: 0.7, flexShrink: 0 }} />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.70)', fontSize: '0.72rem', lineHeight: 1.45 }}>
                                  {f}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                          {isRecommended && tier.recommendationReason && (
                            <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: `${app.gradientStart}14`, border: `1px solid ${app.gradientStart}33` }}>
                              <Typography variant="caption" sx={{ color: '#444', fontStyle: 'italic', lineHeight: 1.45, display: 'block' }}>
                                <strong style={{ color: app.gradientStart }}>Hvorfor anbefalt: </strong>
                                {tier.recommendationReason}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {appState?.statusLabel ? (
                <Box
                  sx={{
                    mt: 0.5,
                    width: '100%',
                    p: 1.2,
                    borderRadius: 1.75,
                    border: '1px solid',
                    borderColor: appState.accentColor ? `${appState.accentColor}33` : '#e5e7eb',
                    background: appState.accentColor ? `${appState.accentColor}12` : '#f8fafc',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Chip
                      label={appState.statusLabel}
                      size="small"
                      sx={{
                        background: appState.accentColor ? `${appState.accentColor}22` : '#ffffff',
                        color: appState.accentColor || '#334155',
                        fontWeight: 700,
                      }}
                    />
                    {appState.statusDescription ? (
                      <Typography variant="caption" sx={{ color: '#4b5563', lineHeight: 1.45 }}>
                        {appState.statusDescription}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}
            </Box>
          )}
        </CardContent>

        <Box sx={{ p: featured ? 3 : 2.5, pt: 0 }}>
          <Stack spacing={1}>
            <Button
              fullWidth
              variant="contained"
              size={featured ? 'medium' : 'small'}
              onClick={() => {
                marketplaceEvents.installClicked(app.id, appState?.ctaLabel || app.ctaLabel);
                onSelect?.(app.id);
              }}
              startIcon={<GetAppIcon />}
              sx={{
                background: `linear-gradient(135deg, ${app.gradientStart} 0%, ${app.gradientEnd} 100%)`,
                color: '#fff',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: featured ? '0.95rem' : '0.85rem',
                py: featured ? 1.25 : 0.75,
                '&:hover': {
                  opacity: 0.9,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {appState?.ctaLabel || app.ctaLabel || `Hent ${app.name}`}
            </Button>
            {app.id !== 'accounting-integration' && (
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => handleOpenReviewDialog(app)}
                sx={{
                  borderColor: `${app.gradientStart}55`,
                  color: app.gradientStart,
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: app.gradientStart,
                    background: `${app.gradientStart}10`,
                  },
                }}
              >
                Anmeldelser
              </Button>
            )}
          </Stack>
        </Box>
      </Card>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            mb: 1,
            background: 'linear-gradient(135deg, #ff8c00 0%, #14b8a6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          CreatorHub Markedsplass
        </Typography>
        <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.70)', fontWeight: 400, mb: 3 }}>
          Oppdag kraftige verktøy for å skalere din kreative bedrift
        </Typography>

        <Grid container spacing={2} sx={{ mb: 4, justifyContent: 'center' }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ff8c00', mb: 0.5 }}>
                {statsLoading ? '—' : marketplaceStats ? marketplaceStats.totalApps : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                Premium‑apper
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ff8c00', mb: 0.5 }}>
                {statsLoading
                  ? '—'
                  : marketplaceStats
                    ? formatCompactNumber(marketplaceStats.totalDownloads)
                    : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                Totale nedlastinger
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ff8c00', mb: 0.5 }}>
                {statsLoading
                  ? '—'
                  : marketplaceStats
                    ? formatRatingValue(marketplaceStats.averageRating)
                    : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                Gj.snittlig vurdering
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ff8c00', mb: 0.5 }}>
                {statsLoading
                  ? '—'
                  : marketplaceStats
                    ? formatCompactNumber(marketplaceStats.activeUsers)
                    : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                Vurderinger
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={1} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              placeholder="Søk i apper og kategorier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.55)' }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label="Tøm søk"
                      onClick={() => setSearchTerm('')}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.04)',
                  fontSize: '0.95rem',
                  '&:hover': {
                    background: '#f0f0f0',
                  },
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.10)',
                  },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={3.5}>
            <FormControl fullWidth>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                sx={{ borderRadius: 2, background: 'rgba(255,255,255,0.04)' }}
              >
                <MenuItem value="featured">Utvalgt</MenuItem>
                <MenuItem value="rating">Best vurdert</MenuItem>
                <MenuItem value="downloads">Mest populær</MenuItem>
                <MenuItem value="trending">Trender</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3.5}>
            <FormControl fullWidth>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                sx={{ borderRadius: 2, background: 'rgba(255,255,255,0.04)' }}
              >
                <MenuItem value="all">Alle kategorier</MenuItem>
                {categories.slice(1).map(cat => (
                  <MenuItem key={cat} value={cat}>{categoryLabelMap[cat] || cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {accountingIntegrationApp && (
        <Paper
          sx={{
            mb: 6,
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f172a 0%, #111827 54%, #1f2937 100%)',
            color: '#fff',
            position: 'relative',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.22)',
          }}
        >
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Regnskap" size="small" sx={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700 }} />
                  <Chip label="Fiken og Tripletex" size="small" sx={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700 }} />
                  <Chip label="Enterprise inkludert" size="small" sx={{ background: 'rgba(34,197,94,0.18)', color: '#BBF7D0', fontWeight: 700 }} />
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ letterSpacing: 1.6, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                    Klar for en enklere fakturaflyt?
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05, mt: 0.5 }}>
                    Gjør veien fra avtale til faktura og regnskap enklere
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.76)', maxWidth: 640 }}>
                    Vi setter opp Fiken eller Tripletex for deg, slik at fakturaer, betalinger, kvitteringer og regnskapsgrunnlag blir enklere å følge opp i hverdagen.
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
                  {accountingIntegrationApp.partnerLogos?.map((partner) => (
                    <Box
                      key={partner.name}
                      sx={{
                        minWidth: 140,
                        px: 2,
                        py: 1.25,
                        borderRadius: 3,
                        background: partner.background,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box
                        component="img"
                        src={partner.src}
                        alt={partner.name}
                        sx={{ display: 'block', height: 18, maxWidth: '100%', width: 'auto' }}
                      />
                    </Box>
                  ))}
                </Stack>

                <Grid container spacing={1.5}>
                  {accountingIntegrationApp.features.map((feature, idx) => (
                    <Grid item xs={12} sm={6} key={idx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box sx={{ color: '#FBBF24' }}>{feature.icon}</Box>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.84)' }}>
                          {feature.text}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  borderRadius: 4,
                  p: 3,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <Typography variant="overline" sx={{ color: '#FCD34D', fontWeight: 800, letterSpacing: 1.2 }}>
                  Marketplace-pris
                </Typography>
                <Typography variant="h3" sx={{ mt: 1, fontWeight: 900 }}>
                  {accountingIntegrationApp.pricing.displayPrice}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.76)' }}>
                  {accountingIntegrationApp.pricing.currency}
                </Typography>

                <Stack spacing={1.25} sx={{ mt: 3 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.84)' }}>
                    Dette er en oppsettstjeneste. Marketplace viser prisen for fakturaflyt, integrasjon og arbeid, ikke leverandørenes API- eller lisenskostnader.
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.84)' }}>
                    {accountingIntegrationApp.pricing.note}
                  </Typography>
                </Stack>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => onSelect?.(accountingIntegrationApp.id)}
                  startIcon={<GetAppIcon />}
                  sx={{
                    mt: 3,
                    py: 1.3,
                    fontWeight: 800,
                    textTransform: 'none',
                    borderRadius: 999,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #fb7185 100%)',
                    color: '#111827',
                    '&:hover': {
                      opacity: 0.94,
                    },
                  }}
                >
                  {accountingIntegrationApp.ctaLabel}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {featuredApps.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 4,
            background:
              'linear-gradient(135deg, rgba(255,140,0,0.08) 0%, rgba(20,184,166,0.04) 100%)',
            borderRadius: 4,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 }}>
            ⭐ Redaktørens valg
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              {renderAppCard(topRatedApp, true)}
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 3,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.04) 100%)',
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'rgba(255,255,255,0.95)' }}>
                  Hvorfor velge {topRatedApp.name}?
                </Typography>
                <Stack spacing={2}>
                  {topRatedApp.features.slice(0, 3).map((feature, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ color: topRatedApp.gradientStart, mt: 0.5 }}>{feature.icon}</Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.70)' }}>{feature.text}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: 'rgba(255,255,255,0.95)' }}>
          {selectedCategory === 'all'
            ? `Alle apper (${filteredApps.length})`
            : `${categoryLabelMap[selectedCategory] || selectedCategory}‑apper (${filteredApps.length})`}
        </Typography>
        <Grid container spacing={3}>
          {filteredApps.map((app) => (
            <Grid item xs={12} sm={6} md={4} key={app.id}>
              {renderAppCard(app)}
            </Grid>
          ))}
        </Grid>
        {filteredApps.length === 0 && (
          <Paper sx={{ p: 6, textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
            <SearchOffIcon sx={{ fontSize: 64, color: '#ddd', mb: 2 }} />
            <Typography color="textSecondary" variant="h6">
              Ingen apper funnet
            </Typography>
            <Typography color="textSecondary" variant="subtitle1" sx={{ mt: 1 }}>
              Prøv andre søkeord eller kategorier
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1 }}>
              Prøv å justere søk eller filtre
            </Typography>
          </Paper>
        )}
      </Box>

      <Box sx={{ mt: 8, pt: 4, borderTop: '1px solid rgba(255,255,255,0.10)', textAlign: 'center' }}>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.70)', mb: 2 }}>
          Finner du ikke det du leter etter?
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
          Foreslå en ny app eller integrasjon på hello@creatorhubn.com
        </Typography>
      </Box>

      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {activeReviewApp ? `Anmeldelser for ${activeReviewApp.name}` : 'Anmeldelser'}
        </DialogTitle>
        <DialogContent dividers>
          {activeReviewApp && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Legg inn anmeldelse
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Rating
                    value={reviewForm.rating}
                    onChange={(_, value) =>
                      setReviewForm(prev => ({ ...prev, rating: value || 5 }))
                    }
                  />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                    {reviewForm.rating} / 5
                  </Typography>
                </Box>
                <TextField
                  label="Navn"
                  value={reviewForm.userName}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, userName: e.target.value }))}
                  placeholder="Anonym"
                  fullWidth
                />
                <TextField
                  label="Tittel"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Kommentar"
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Stack>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Nyeste anmeldelser
          </Typography>

          {reviewError && (
            <Typography color="error" sx={{ mb: 2 }}>
              {reviewError}
            </Typography>
          )}

          {reviewsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!reviewsLoading && activeReviewApp && (
            <Stack spacing={2}>
              {(reviewsByApp[activeReviewApp.id] || []).length === 0 && (
                <Typography color="textSecondary">Ingen anmeldelser ennå. Vær den første!</Typography>
              )}
              {(reviewsByApp[activeReviewApp.id] || []).map((review) => (
                <Paper key={review.id} sx={{ p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.04)' }}>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {review.title || 'Anmeldelse'}
                      </Typography>
                      <Rating value={review.rating} readOnly size="small" />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.70)' }}>
                      {review.comment || 'Ingen kommentar gitt.'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                      {review.userName}{review.createdAt ? ` · ${new Date(review.createdAt).toLocaleDateString()}` : ''}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReviewDialogOpen(false)} color="inherit">
            Lukk
          </Button>
          <Button
            onClick={handleSubmitReview}
            variant="contained"
            disabled={reviewSubmitLoading || !activeReviewApp}
          >
            {reviewSubmitLoading ? 'Sender...' : 'Send anmeldelse'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CreatorHubMarketplace;
