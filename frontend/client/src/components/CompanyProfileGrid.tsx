import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Search as SearchIcon,
  ViewList as ListViewIcon,
  ViewModule as GridViewIcon,
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useTheming } from '../utils/theming-helper';
import CompanyProfileQuickView from './CompanyProfileQuickView';

export interface CompanyProfile {
  id: string;
  name: string;
  organizationNumber: string;
  industry: string;
  status: 'active' | 'inactive' | 'verified';
  logo?: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  employees?: number;
  revenue?: {
    amount: number;
    year: number;
    currency: string;
  };
  rating?: number;
  verification: {
    brreg: boolean;
    proff: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  description?: string;
  founded?: number;
  services?: string[];
  socialProof?: {
    projects: number;
    clients: number;
    reviews: number;
  };
}

interface CompanyProfileGridProps {
  title?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  maxItems?: number;
  defaultView?: 'grid' | 'list';
  animation?: 'slide' | 'fade' | 'zoom' | 'stagger';
  onProfileSelect?: (profile: CompanyProfile) => void;
  onProfileContact?: (profile: CompanyProfile) => void;
  filterIndustries?: string[];
  showRiskIndicators?: boolean;
}

const SAMPLE_PROFILES: CompanyProfile[] = [
  {
    id: 'nordic-photo',
    name: 'Nordic Photo Studio AS',
    organizationNumber: '987654321',
    industry: 'Fotografi',
    status: 'verified',
    address: 'Oslo, Norge',
    phone: '+47 12 34 56 78',
    email: 'post@nordicphoto.no',
    website: 'https://nordicphoto.no',
    employees: 12,
    revenue: { amount: 2_500_000, year: 2024, currency: 'NOK' },
    rating: 4.8,
    verification: { brreg: true, proff: true, riskLevel: 'low' },
    description: 'Profesjonell foto- og videoproduksjon for events og kommersielle kunder.',
    founded: 2015,
    services: ['Bryllup', 'Bedrift', 'Portrett', 'Produktfoto'],
    socialProof: { projects: 150, clients: 89, reviews: 72 },
  },
  {
    id: 'bergen-video',
    name: 'Bergen Video Production',
    organizationNumber: '876543219',
    industry: 'Videoproduksjon',
    status: 'active',
    address: 'Bergen, Norge',
    phone: '+47 98 76 54 32',
    email: 'kontakt@bergenvideo.no',
    website: 'https://bergenvideo.no',
    employees: 8,
    revenue: { amount: 1_850_000, year: 2024, currency: 'NOK' },
    rating: 4.6,
    verification: { brreg: true, proff: false, riskLevel: 'low' },
    description: 'Creative video-produksjon for markedsføring og dokumentar.',
    founded: 2018,
    services: ['Reklamefilm', 'Eventvideo', 'Intervjuer'],
    socialProof: { projects: 95, clients: 65, reviews: 48 },
  },
];

const normalizeProfile = (item: unknown): CompanyProfile | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const data = item as Partial<CompanyProfile>;
  if (!data.id || !data.name || !data.organizationNumber || !data.industry || !data.address) {
    return null;
  }

  return {
    id: String(data.id),
    name: String(data.name),
    organizationNumber: String(data.organizationNumber),
    industry: String(data.industry),
    status:
      data.status === 'active' || data.status === 'inactive' || data.status === 'verified'
        ? data.status
        : 'active',
    logo: data.logo,
    address: String(data.address),
    phone: data.phone,
    email: data.email,
    website: data.website,
    employees: data.employees,
    revenue: data.revenue,
    rating: data.rating,
    verification: data.verification ?? { brreg: false, proff: false, riskLevel: 'medium' },
    description: data.description,
    founded: data.founded,
    services: data.services,
    socialProof: data.socialProof,
  };
};

export const CompanyProfileGrid: React.FC<CompanyProfileGridProps> = ({
  title = 'Bedriftsprofiler',
  showFilters = true,
  showSearch = true,
  maxItems,
  defaultView = 'grid',
  animation = 'stagger',
  onProfileSelect,
  onProfileContact,
  filterIndustries = [],
  showRiskIndicators = false,
}) => {
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'employees' | 'revenue' | 'founded'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView);

  const { data: profiles = SAMPLE_PROFILES, isLoading } = useQuery({
    queryKey: ['/api/companies/profiles'],
    queryFn: async () => {
      const response = await apiRequest('/api/companies/profiles', { method: 'GET' });

      const payload = Array.isArray(response)
        ? response
        : Array.isArray(response?.profiles)
          ? response.profiles
          : [];

      const normalized = payload.map(normalizeProfile).filter((item): item is CompanyProfile => item !== null);
      return normalized.length > 0 ? normalized : SAMPLE_PROFILES;
    },
  });

  const industries = useMemo(() => {
    const raw = profiles.map((profile) => profile.industry);
    return [...new Set(raw)].sort((left, right) => left.localeCompare(right, 'nb-NO'));
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    let list = [...profiles];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((profile) => {
        return (
          profile.name.toLowerCase().includes(query) ||
          profile.industry.toLowerCase().includes(query) ||
          profile.address.toLowerCase().includes(query)
        );
      });
    }

    if (selectedIndustry) {
      list = list.filter((profile) => profile.industry === selectedIndustry);
    }

    if (filterIndustries.length > 0) {
      list = list.filter((profile) => filterIndustries.includes(profile.industry));
    }

    list.sort((left, right) => {
      switch (sortBy) {
        case 'rating':
          return (right.rating ?? 0) - (left.rating ?? 0);
        case 'employees':
          return (right.employees ?? 0) - (left.employees ?? 0);
        case 'revenue':
          return (right.revenue?.amount ?? 0) - (left.revenue?.amount ?? 0);
        case 'founded':
          return (right.founded ?? 0) - (left.founded ?? 0);
        case 'name':
        default:
          return left.name.localeCompare(right.name, 'nb-NO');
      }
    });

    if (typeof maxItems === 'number') {
      return list.slice(0, maxItems);
    }

    return list;
  }, [filterIndustries, maxItems, profiles, searchQuery, selectedIndustry, sortBy]);

  const gridItemProps = (mode: 'grid' | 'list') => {
    if (mode === 'list') {
      return { xs: 12 };
    }
    return { xs: 12, sm: 6, md: 4, lg: 3 };
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          {title}
        </Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 6 }, (_, index) => (
            <Grid item key={`skeleton-${index}`} xs={12} sm={6} md={4}>
              <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <BusinessIcon color="primary" />
          <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
            {title}
          </Typography>
          <Chip label={`${filteredProfiles.length} bedrifter`} size="small" color="primary" variant="outlined" />
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <IconButton
            aria-label="Grid view"
            color={viewMode === 'grid' ? 'primary' : 'default'}
            onClick={() => setViewMode('grid')}
          >
            <GridViewIcon />
          </IconButton>
          <IconButton
            aria-label="List view"
            color={viewMode === 'list' ? 'primary' : 'default'}
            onClick={() => setViewMode('list')}
          >
            <ListViewIcon />
          </IconButton>
        </Box>
      </Box>

      {(showFilters || showSearch) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2.5, ...theming.getThemedCardSx() }}>
          <Grid container spacing={1.5}>
            {showSearch && (
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Søk i bedrifter"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}

            {showFilters && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Bransje</InputLabel>
                    <Select
                      label="Bransje"
                      value={selectedIndustry}
                      onChange={(event) => setSelectedIndustry(event.target.value)}
                    >
                      <MenuItem value="">Alle</MenuItem>
                      {industries.map((industry) => (
                        <MenuItem key={industry} value={industry}>
                          {industry}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sorter</InputLabel>
                    <Select
                      label="Sorter"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                    >
                      <MenuItem value="name">Navn</MenuItem>
                      <MenuItem value="rating">Vurdering</MenuItem>
                      <MenuItem value="employees">Ansatte</MenuItem>
                      <MenuItem value="revenue">Omsetning</MenuItem>
                      <MenuItem value="founded">Grunnlagt</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
      )}

      {filteredProfiles.length === 0 ? (
        <Alert severity="info">Ingen bedrifter funnet med valgte kriterier.</Alert>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Grid container spacing={2}>
            <AnimatePresence mode="popLayout">
              {filteredProfiles.map((profile, index) => (
                <Grid key={profile.id} item {...gridItemProps(viewMode)}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: animation === 'slide' || animation === 'stagger' ? 16 : 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: animation === 'stagger' ? index * 0.04 : 0 }}
                  >
                    <CompanyProfileQuickView
                      profile={profile}
                      variant={viewMode === 'list' ? 'expanded' : 'compact'}
                      animation={animation === 'stagger' ? 'slide' : animation}
                      showRiskIndicators={showRiskIndicators}
                      onViewDetails={onProfileSelect}
                      onContact={onProfileContact}
                    />
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        </motion.div>
      )}
    </Box>
  );
};

export default CompanyProfileGrid;
