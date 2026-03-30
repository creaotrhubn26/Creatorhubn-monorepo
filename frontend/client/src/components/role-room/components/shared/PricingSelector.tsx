/**
 * PricingSelector - Service Package & Quote Selector
 * 
 * Displays available service packages and price quotes for split sheet services.
 * When a package or quote is selected, it auto-populates split sheet fields.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  Grid,
  TextField,
  InputAdornment,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ShoppingCart,
  RequestQuote,
  CheckCircle,
  Search,
  Star,
  AttachMoney,
  Info,
} from '@mui/icons-material';
import { shouldUseRoleRoomLocalFallback } from '../../utils/runtime';

// ============================================================================
// Types
// ============================================================================

export interface ServicePackage {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  features: string[];
  popular?: boolean;
  category: string;
}

export interface PriceQuote {
  id: string;
  quoteNumber?: string;
  description?: string;
  total: number;
  currency: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  validUntil?: string;
  status: 'draft' | 'sent' | 'accepted' | 'expired';
}

export interface PricingSelectorProps {
  onSelectPackage?: (pkg: ServicePackage) => void;
  onSelectQuote?: (quote: PriceQuote) => void;
  currency?: string;
  projectId?: string;
}

// ============================================================================
// Default Packages
// ============================================================================

const DEFAULT_PACKAGES: ServicePackage[] = [
  {
    id: 'basic-split',
    name: 'Enkel Fordeling',
    description: 'Standard split sheet for simple two-party agreements',
    price: 499,
    currency: 'NOK',
    features: [
      'Inntil 3 parter',
      'Standard kontrakt',
      'PDF-eksport',
      'E-signering',
    ],
    category: 'split-sheet',
  },
  {
    id: 'pro-split',
    name: 'Profesjonell Fordeling',
    description: 'Advanced split sheet with detailed royalty tracking and multiple revenue streams',
    price: 1499,
    currency: 'NOK',
    features: [
      'Ubegrenset parter',
      'Avansert royalty-sporing',
      'Flere inntektsstrømmer',
      'Juridisk gjennomgang',
      'PDF & DOCX eksport',
      'E-signering med ID-verifisering',
    ],
    popular: true,
    category: 'split-sheet',
  },
  {
    id: 'enterprise-split',
    name: 'Bedriftsavtale',
    description: 'Full-service split sheet management for production companies and labels',
    price: 4999,
    currency: 'NOK',
    features: [
      'Alt i Profesjonell',
      'Dedikert rådgiver',
      'Tilpassede kontrakter',
      'API-integrasjon',
      'Kvartalsrapporter',
      'Prioritert support',
    ],
    category: 'split-sheet',
  },
  {
    id: 'music-license',
    name: 'Musikklisens',
    description: 'Standard music licensing agreement for film and media',
    price: 2499,
    currency: 'NOK',
    features: [
      'Synk-lisens',
      'Masterrettigheter',
      'Territoriell dekning',
      'Tidsperiode-administrasjon',
    ],
    category: 'licensing',
  },
];

// ============================================================================
// Component
// ============================================================================

export function PricingSelector({
  onSelectPackage,
  onSelectQuote,
  currency = 'NOK',
  projectId,
}: PricingSelectorProps) {
  const useLocalFallback = shouldUseRoleRoomLocalFallback();
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [packages, setPackages] = useState<ServicePackage[]>(DEFAULT_PACKAGES);
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Fetch packages and quotes from backend
  const fetchData = useCallback(async () => {
    if (useLocalFallback) {
      setPackages(DEFAULT_PACKAGES);
      setQuotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [pkgRes, quoteRes] = await Promise.allSettled([
        fetch(`/api/pricing/packages${projectId ? `?projectId=${projectId}` : ''}`),
        fetch(`/api/pricing/quotes${projectId ? `?projectId=${projectId}` : ''}`),
      ]);

      if (pkgRes.status === 'fulfilled' && pkgRes.value.ok) {
        const data = await pkgRes.value.json();
        if (Array.isArray(data.packages) && data.packages.length > 0) {
          setPackages(data.packages);
        }
      }

      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        const data = await quoteRes.value.json();
        if (Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
        }
      }
    } catch (error) {
      console.warn('[PricingSelector] Could not fetch pricing data, using defaults:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, useLocalFallback]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPackages = packages.filter(
    (pkg) =>
      pkg.currency === currency &&
      (searchTerm === '' ||
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredQuotes = quotes.filter(
    (q) =>
      q.status !== 'expired' &&
      (searchTerm === '' ||
        q.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatPrice = (amount: number, cur: string) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSelectPackage = (pkg: ServicePackage) => {
    setSelectedPackageId(pkg.id);
    setSelectedQuoteId(null);
    onSelectPackage?.(pkg);
  };

  const handleSelectQuote = (quote: PriceQuote) => {
    setSelectedQuoteId(quote.id);
    setSelectedPackageId(null);
    onSelectQuote?.(quote);
  };

  return (
    <Box>
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoney color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Velg Tjeneste
          </Typography>
        </Box>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Søk pakker og tilbud..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          fullWidth
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
        >
          <Tab
            icon={<ShoppingCart />}
            label={`Pakker (${filteredPackages.length})`}
            iconPosition="start"
          />
          <Tab
            icon={<RequestQuote />}
            label={`Tilbud (${filteredQuotes.length})`}
            iconPosition="start"
          />
        </Tabs>

        <Divider />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {/* Packages Tab */}
        {!loading && activeTab === 0 && (
          <Grid container spacing={2}>
            {filteredPackages.length === 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Ingen pakker tilgjengelig for valgt valuta ({currency})
                </Alert>
              </Grid>
            )}
            {filteredPackages.map((pkg) => (
              <Grid item xs={12} sm={6} md={4} key={pkg.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    position: 'relative',
                    borderColor:
                      selectedPackageId === pkg.id ? 'primary.main' : 'divider',
                    borderWidth: selectedPackageId === pkg.id ? 2 : 1,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      borderColor: 'primary.light',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => handleSelectPackage(pkg)}
                >
                  {pkg.popular && (
                    <Chip
                      icon={<Star />}
                      label="Populær"
                      size="small"
                      color="warning"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                      }}
                    />
                  )}
                  {selectedPackageId === pkg.id && (
                    <CheckCircle
                      color="primary"
                      sx={{ position: 'absolute', top: 8, left: 8 }}
                    />
                  )}
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {pkg.name}
                      </Typography>
                      <Typography
                        variant="h5"
                        fontWeight={700}
                        color="primary.main"
                      >
                        {formatPrice(pkg.price, pkg.currency)}
                      </Typography>
                      {pkg.description && (
                        <Typography variant="body2" color="text.secondary">
                          {pkg.description}
                        </Typography>
                      )}
                      <Divider />
                      <Stack spacing={0.5}>
                        {pkg.features.map((feature, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <CheckCircle
                              fontSize="small"
                              color="success"
                              sx={{ fontSize: 14 }}
                            />
                            <Typography variant="caption">
                              {feature}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                      <Button
                        variant={
                          selectedPackageId === pkg.id
                            ? 'contained'
                            : 'outlined'
                        }
                        size="small"
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPackage(pkg);
                        }}
                      >
                        {selectedPackageId === pkg.id
                          ? 'Valgt'
                          : 'Velg Pakke'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Quotes Tab */}
        {!loading && activeTab === 1 && (
          <Stack spacing={2}>
            {filteredQuotes.length === 0 && (
              <Alert severity="info">
                Ingen aktive tilbud. Opprett et tilbud fra prosjektpanelet.
              </Alert>
            )}
            {filteredQuotes.map((quote) => (
              <Card
                key={quote.id}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  borderColor:
                    selectedQuoteId === quote.id ? 'primary.main' : 'divider',
                  borderWidth: selectedQuoteId === quote.id ? 2 : 1,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: 'primary.light' },
                }}
                onClick={() => handleSelectQuote(quote)}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        {quote.quoteNumber || `Tilbud #${quote.id.slice(0, 8)}`}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={
                            quote.status === 'accepted'
                              ? 'Akseptert'
                              : quote.status === 'sent'
                                ? 'Sendt'
                                : 'Utkast'
                          }
                          size="small"
                          color={
                            quote.status === 'accepted'
                              ? 'success'
                              : quote.status === 'sent'
                                ? 'info'
                                : 'default'
                          }
                        />
                        {selectedQuoteId === quote.id && (
                          <CheckCircle color="primary" fontSize="small" />
                        )}
                      </Box>
                    </Box>
                    {quote.description && (
                      <Typography variant="body2" color="text.secondary">
                        {quote.description}
                      </Typography>
                    )}
                    <Divider />
                    {quote.lineItems.map((item, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          px: 1,
                        }}
                      >
                        <Typography variant="body2">
                          {item.description}{' '}
                          {item.quantity > 1 ? `× ${item.quantity}` : ''}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatPrice(
                            item.amount * item.quantity,
                            quote.currency
                          )}
                        </Typography>
                      </Box>
                    ))}
                    <Divider />
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="subtitle2">Totalt</Typography>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        color="primary.main"
                      >
                        {formatPrice(quote.total, quote.currency)}
                      </Typography>
                    </Box>
                    {quote.validUntil && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <Tooltip title="Gyldig til">
                          <IconButton size="small">
                            <Info fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Typography variant="caption" color="text.secondary">
                          Gyldig til{' '}
                          {new Date(quote.validUntil).toLocaleDateString(
                            'nb-NO'
                          )}
                        </Typography>
                      </Box>
                    )}
                    <Button
                      variant={
                        selectedQuoteId === quote.id ? 'contained' : 'outlined'
                      }
                      size="small"
                      fullWidth
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectQuote(quote);
                      }}
                    >
                      {selectedQuoteId === quote.id
                        ? 'Valgt'
                        : 'Bruk Dette Tilbudet'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default PricingSelector;
