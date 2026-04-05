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
} from '@mui/icons-material';
import { apiRequest } from '../../lib/queryClient';
import fikenLogo from '../../assets/integrations/fiken-logo.svg';
import tripletexLogo from '../../assets/integrations/tripletex-logo.svg';

interface AppStoreItem {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
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
  ctaLabel?: string;
}

interface CreatorHubMarketplaceProps {
  onSelect?: (appId: string) => void;
  profession?: string;
  userId?: string;
  showPricing?: boolean;
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
    rating: 5,
    title: '',
    comment: '',
    userName: '',
  });
  const [marketplaceStats, setMarketplaceStats] = useState<MarketplaceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const apps: AppStoreItem[] = [
    {
      id: 'resume-builder',
      name: 'ResumeBuilder',
      category: 'Career',
      rating: 4.9,
      reviews: 2547,
      description: 'Profesjonelle CV-er med AI-assistanse',
      longDescription: 'Lag imponerende CV-er som får deg lagt merke til. AI-skriving, ATS-optimalisering og automatisk import av prosjekter.',
      featured: true,
      downloadCount: 125000,
      monthlyGrowth: 15,
      features: [
        { icon: <DocumentIcon />, text: '7+ profesjonelle maler' },
        { icon: <AIIcon />, text: 'AI-assistert skriving' },
        { icon: <AnalyzeIcon />, text: 'ATS-optimalisering' },
        { icon: <UploadIcon />, text: 'Automatisk import' },
        { icon: <VersionIcon />, text: 'Versjonskontroll' },
        { icon: <DriveIcon />, text: 'Google Drive-integrasjon' },
      ],
      pricing: { free: true, price: 149, currency: 'kr/mnd' },
      gradientStart: '#ff8c00',
      gradientEnd: '#14b8a6',
      categoryIcon: <BriefcaseIcon />,
    },
    {
      id: 'portfolio-pro',
      name: 'Portfolio Pro',
      category: 'Showcase',
      rating: 4.8,
      reviews: 1823,
      description: 'Imponerende porteføljer som konverterer',
      longDescription: 'Bygget for kreative fagfolk. Vis frem dine beste prosjekter med moderne design og interaktive elementer.',
      trending: true,
      downloadCount: 98000,
      monthlyGrowth: 22,
      features: [
        { icon: <DocumentIcon />, text: 'Responsivt design' },
        { icon: <AIIcon />, text: 'SEO-optimalisert' },
        { icon: <AnalyzeIcon />, text: 'Analytics dashboard' },
        { icon: <UploadIcon />, text: 'Drag & drop editor' },
      ],
      pricing: { free: true, price: 199, currency: 'kr/mnd' },
      gradientStart: '#6366F1',
      gradientEnd: '#EC4899',
      categoryIcon: <ImageIcon />,
    },
    {
      id: 'contract-genius',
      name: 'Contract Genius',
      category: 'Legal',
      rating: 4.7,
      reviews: 956,
      description: 'Automatiserte juridiske avtaler',
      longDescription: 'Opprett profesjonelle kontrakter på minutter. Maler for alle situasjoner, inkludert e‑signering.',
      downloadCount: 45000,
      monthlyGrowth: 8,
      features: [
        { icon: <DocumentIcon />, text: 'Avtalmaler' },
        { icon: <AIIcon />, text: 'E-signering' },
        { icon: <CheckIcon />, text: 'Juridisk gjennomgang' },
      ],
      pricing: { free: false, price: 99, currency: 'kr/mnd' },
      gradientStart: '#10B981',
      gradientEnd: '#059669',
      categoryIcon: <GavelIcon />,
    },
    {
      id: 'accounting-integration',
      name: 'Fakturaflyt og regnskapsoppsett',
      category: 'Finance',
      rating: 0,
      reviews: 0,
      description: 'For deg som vil gjøre veien fra avtale til faktura, betaling og regnskap enklere med Fiken eller Tripletex.',
      longDescription: 'Vi setter opp fakturaflyt for CreatorHub og klargjør betalingshistorikk, kvitteringer og regnskapsgrunnlag slik at oppfølgingen blir enklere fra avtale til betaling og videre til regnskap.',
      featured: true,
      downloadCount: 0,
      features: [
        { icon: <ReceiptIcon />, text: 'Fakturaer, kvitteringer og historikk' },
        { icon: <DriveIcon />, text: 'Oppsett av fakturaflyt' },
        { icon: <AnalyzeIcon />, text: 'Bilagsgrunnlag for videre bokføring' },
        { icon: <GroupsIcon />, text: 'Enterprise inkludert i avtalen' },
      ],
      pricing: {
        free: false,
        displayPrice: 'Fra 6 900 kr',
        currency: 'engangspris',
        note: 'Løpende drift og overvåking fra 990 kr/mnd. Eventuelle lisenser håndteres direkte med leverandøren.',
        enterpriseIncluded: true,
      },
      gradientStart: '#0f172a',
      gradientEnd: '#1e293b',
      categoryIcon: <ReceiptIcon />,
      partnerLogos: [
        { name: 'Fiken', src: fikenLogo, background: '#ffffff' },
        { name: 'Tripletex', src: tripletexLogo, background: '#ffffff' },
      ],
      ctaLabel: 'Bestill oppsett',
    },
    {
      id: 'invoice-pro',
      name: 'Invoice Pro',
      category: 'Finance',
      rating: 4.9,
      reviews: 3210,
      description: 'Profesjonelle fakturaer på sekunder',
      longDescription: 'Effektiviser fakturering med automatisk sporing, påminnelser og integrasjoner med regnskapssystemer.',
      featured: true,
      downloadCount: 156000,
      monthlyGrowth: 12,
      features: [
        { icon: <DocumentIcon />, text: 'Automatisk fakturering' },
        { icon: <AnalyzeIcon />, text: 'Betalingssporing' },
        { icon: <UploadIcon />, text: 'Integrasjoner' },
      ],
      pricing: { free: true, price: 79, currency: 'kr/mnd' },
      gradientStart: '#F59E0B',
      gradientEnd: '#D97706',
      categoryIcon: <ReceiptIcon />,
    },
    {
      id: 'client-management',
      name: 'Client Hub',
      category: 'Business',
      rating: 4.8,
      reviews: 1547,
      description: 'Alt-i-ett klientadministrasjon',
      longDescription: 'Administrer alle klientinteraksjoner på ett sted: e-post, avtaler, prosjekter og betalinger.',
      trending: true,
      downloadCount: 87000,
      monthlyGrowth: 18,
      features: [
        { icon: <DocumentIcon />, text: 'CRM-system' },
        { icon: <AIIcon />, text: 'Automatisering' },
        { icon: <AnalyzeIcon />, text: 'Rapporter' },
      ],
      pricing: { free: false, price: 129, currency: 'kr/mnd' },
      gradientStart: '#8B5CF6',
      gradientEnd: '#6366F1',
      categoryIcon: <GroupsIcon />,
    },
    {
      id: 'time-tracker',
      name: 'Time Tracker',
      category: 'Productivity',
      rating: 4.6,
      reviews: 1102,
      description: 'Tidsregistrering og timeadministrasjon',
      longDescription: 'Spor timer automatisk, generer timesedler og analyser tidsbruk – integrert med prosjekter.',
      downloadCount: 65000,
      monthlyGrowth: 25,
      features: [
        { icon: <DocumentIcon />, text: 'Automatisk sporing' },
        { icon: <AnalyzeIcon />, text: 'Timesedler' },
        { icon: <TrendingIcon />, text: 'Produktivitetsanalyse' },
      ],
      pricing: { free: true, price: 49, currency: 'kr/mnd' },
      gradientStart: '#06B6D4',
      gradientEnd: '#0891B2',
      categoryIcon: <TimerIcon />,
    },
    {
      id: 'role-room',
      name: 'The Role Room',
      category: 'Business',
      rating: 4.9,
      reviews: 412,
      description: 'Casting, crew & produksjonsplanlegging',
      longDescription: 'Komplett casting-system for film, TV og teater. Administrer roller, kandidater, crew, tidsplaner og produksjonsdetaljer — alt koblet til Creatorhub-prosjekter.',
      featured: true,
      downloadCount: 34000,
      monthlyGrowth: 30,
      features: [
        { icon: <GroupsIcon />, text: 'Rolleforvaltning & casting' },
        { icon: <DocumentIcon />, text: 'Kandidat-administrasjon' },
        { icon: <TimerIcon />, text: 'Tidsplanlegging' },
        { icon: <AnalyzeIcon />, text: 'Prosjektsynkronisering' },
      ],
      pricing: { free: true },
      gradientStart: '#F59E0B',
      gradientEnd: '#D946EF',
      categoryIcon: <GroupsIcon />,
    },
  ];

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

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const stats = await apiRequest('/api/marketplace/stats');
        setMarketplaceStats(stats);
      } catch (error) {
        setMarketplaceStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, []);

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
          display: 'flex',
          flexDirection: 'column',
          borderRadius: featured ? 3 : 2,
          border: featured ? `2px solid ${app.gradientStart}` : '1px solid #e0e0e0',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: featured
            ? `linear-gradient(135deg, ${app.gradientStart}10 0%, ${app.gradientEnd}10 100%)`
            : '#fff',
          '&:hover': {
            transform: `translateY(${featured ? -12 : -8}px)`,
            boxShadow: featured
              ? `0 30px 60px rgba(0, 0, 0, 0.16)`
              : '0 20px 40px rgba(0, 0, 0, 0.12)',
            borderColor: app.gradientStart,
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
                  background: 'rgba(255, 255, 255, 0.95)',
                  color: app.gradientStart,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              />
            )}
            {app.trending && (
              <Chip
                icon={<TrendingIcon />}
                label={`+${app.monthlyGrowth}% denne måneden`}
                size="small"
                sx={{
                  background: 'rgba(255, 255, 255, 0.95)',
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
              }}
            >
              {app.categoryIcon}
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
              <Typography variant={featured ? 'h5' : 'h6'} sx={{ fontWeight: 700, mb: 0.5, color: '#1a1a1a' }}>
                {app.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ color: app.gradientStart }}>
                  <CategoryIcon category={app.category} />
                </Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>
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
                  '&:hover': {
                    color: app.gradientStart,
                    background: `${app.gradientStart}15`,
                  },
                }}
              >
                {favorites.has(app.id) ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          <Typography
            variant={featured ? 'body1' : 'body2'}
            sx={{ color: '#666', mb: 2.5, minHeight: featured ? 50 : 40 }}
          >
            {app.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, pb: 2.5, borderBottom: '1px solid #f0f0f0' }}>
            <Box sx={{ flex: 1 }}>
              {displayReviews > 0 ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <Rating value={displayRating} readOnly size="small" />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                      {Number.isFinite(displayRating) ? displayRating.toFixed(1) : '—'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#999', fontSize: '0.7rem' }}>
                    {Number.isFinite(displayReviews) ? displayReviews.toLocaleString() : '0'} anmeldelser
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#1a1a1a', display: 'block', mb: 0.25 }}>
                    Tjeneste og oppsett
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#999', fontSize: '0.7rem' }}>
                    Leveres som implementasjonsprosjekt
                  </Typography>
                </>
              )}
            </Box>

            <Box sx={{ flex: 1 }}>
              {app.downloadCount > 0 ? (
                <>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: '#1a1a1a', display: 'block', mb: 0.25 }}
                  >
                    {(app.downloadCount / 1000).toFixed(0)}K nedlastinger
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 4,
                      background: '#e0e0e0',
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
                    sx={{ fontWeight: 600, color: '#1a1a1a', display: 'block', mb: 0.25 }}
                  >
                    Enterprise inkludert
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#999', fontSize: '0.7rem' }}>
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
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '0.8rem' }}>
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
                    <Typography variant="caption" sx={{ color: '#999' }}>
                      + Pro fra {app.pricing.price} {app.pricing.currency}
                    </Typography>
                  </>
                ) : (
                  <Chip
                    label={app.pricing.displayPrice || `Fra ${app.pricing.price} ${app.pricing.currency}`}
                    size="small"
                    sx={{
                      background: '#F3E5F5',
                      color: '#6A1B9A',
                      fontWeight: 700,
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
                <Typography variant="caption" sx={{ color: '#777', lineHeight: 1.45 }}>
                  {app.pricing.note}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>

        <Box sx={{ p: featured ? 3 : 2.5, pt: 0 }}>
          <Stack spacing={1}>
            <Button
              fullWidth
              variant="contained"
              size={featured ? 'medium' : 'small'}
              onClick={() => onSelect?.(app.id)}
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
              {app.ctaLabel || `Hent ${app.name}`}
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
        <Typography variant="h6" sx={{ color: '#666', fontWeight: 400, mb: 3 }}>
          Oppdag kraftige verktøy for å skalere din kreative bedrift
        </Typography>

        <Grid container spacing={2} sx={{ mb: 4, justifyContent: 'center' }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ff8c00', mb: 0.5 }}>
                {statsLoading ? '—' : marketplaceStats ? marketplaceStats.totalApps : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#999' }}>
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
              <Typography variant="caption" sx={{ color: '#999' }}>
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
              <Typography variant="caption" sx={{ color: '#999' }}>
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
              <Typography variant="caption" sx={{ color: '#999' }}>
                Aktive brukere
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              placeholder="Søk i apper og kategorier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#999' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  background: '#f5f5f5',
                  fontSize: '0.95rem',
                  '&:hover': {
                    background: '#f0f0f0',
                  },
                  '& fieldset': {
                    borderColor: '#e0e0e0',
                  },
                },
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                sx={{ borderRadius: 2, background: '#f5f5f5' }}
              >
                <MenuItem value="featured">Utvalgt</MenuItem>
                <MenuItem value="rating">Best vurdert</MenuItem>
                <MenuItem value="downloads">Mest populær</MenuItem>
                <MenuItem value="trending">Trender</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                sx={{ borderRadius: 2, background: '#f5f5f5' }}
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
        <Box sx={{ mb: 6 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>
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
                  background: 'linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%)',
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1a1a1a' }}>
                  Hvorfor velge {topRatedApp.name}?
                </Typography>
                <Stack spacing={2}>
                  {topRatedApp.features.slice(0, 3).map((feature, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ color: topRatedApp.gradientStart, mt: 0.5 }}>{feature.icon}</Box>
                      <Typography variant="body2" sx={{ color: '#666' }}>{feature.text}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#1a1a1a' }}>
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
          <Paper sx={{ p: 6, textAlign: 'center', background: '#f5f5f5', borderRadius: 2 }}>
            <Typography color="textSecondary" variant="h6">
              Ingen apper funnet
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1 }}>
              Prøv å justere søk eller filtre
            </Typography>
          </Paper>
        )}
      </Box>

      <Box sx={{ mt: 8, pt: 4, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
        <Typography variant="body1" sx={{ color: '#666', mb: 2 }}>
          Finner du ikke det du leter etter?
        </Typography>
        <Typography variant="body2" sx={{ color: '#999' }}>
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
                  <Typography variant="body2" sx={{ color: '#999' }}>
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
                <Paper key={review.id} sx={{ p: 2, borderRadius: 2, background: '#fafafa' }}>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {review.title || 'Anmeldelse'}
                      </Typography>
                      <Rating value={review.rating} readOnly size="small" />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      {review.comment || 'Ingen kommentar gitt.'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>
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
