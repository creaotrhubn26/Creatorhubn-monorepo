import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Button,
  Alert,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Update,
  Download,
  Warning,
  CheckCircle,
  Info,
  Security,
  BugReport,
  NewReleases,
  Schedule,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Business,
  Refresh,
  Settings,
  NotificationsActive,
  NotificationsOff,
  FilterList,
  Sort,
  ExpandMore,
  Launch,
  GetApp,
  Close,
  CloudDownload,
  Build,
  Cached,
  RssFeed,
  Verified,
  TipsAndUpdates,
  Newspaper,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';

const getErrorStatusCode = (error: unknown): number | null => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const prefixedMatch = message.match(/^(\d{3})[:\s]/);
  if (prefixedMatch) return Number(prefixedMatch[1]);
  return null;
};

// Source type colors and labels
const SOURCE_TYPE_CONFIG = {
  official: { color: '#4CAF50', label: 'Offisiell', icon: Verified },
  rumor: { color: '#FF9800', label: 'Rykter', icon: TipsAndUpdates },
  news: { color: '#2196F3', label: 'Nyheter', icon: Newspaper },
};

const CONFIDENCE_CONFIG = {
  high: { color: '#4CAF50', label: 'Høy' },
  medium: { color: '#FF9800', label: 'Middels' },
  low: { color: '#9E9E9E', label: 'Lav' },
};

interface FirmwareManagementInterfaceProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string
}

interface FirmwareUpdate {
  equipment: {
    id: number;
    brand: string;
    model: string;
    currentFirmwareVersion?: string;
    equipmentType: string;
    serialNumber?: string;
  };
  firmwareUpdate: {
    version: string;
    releaseDate: string;
    photographerBenefits?: string[];
    videographerBenefits?: string[];
    musicProducerBenefits?: string[];
    generalImprovements?: string[];
    bugFixes?: string[];
    newFeatures?: string[];
    isCritical: boolean;
    downloadUrl?: string;
    downloadSize?: string;
    installationTime?: string;
    photographerRecommendation?: string;
    videographerRecommendation?: string;
    musicProducerRecommendation?: string;
    riskLevel: string;
    installationSteps?: string[];
    requirements?: string[];
    knownIssues?: string[];
    sourceUrl?: string;
    // RSS source indicators
    sourceType?: 'official' | 'rumor' | 'news';
    sourceName?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}

const PROFESSION_COLORS = {
  photographer: '#FF6B30',
  videographer: '#9C27B0',
  music_producer: '#FF5720',
  vendor: '#2196F0',
};

const RISK_COLORS = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44330',
};

const ROLE_ROOM_BRAND = {
  pageBackground:
    'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 48%, rgba(30,41,59,0.82) 100%)',
  panelBackground: 'rgba(15,23,42,0.72)',
  panelBorder: '1px solid rgba(148,163,184,0.24)',
  textPrimary: '#f8fafc',
  textSecondary: 'rgba(226,232,240,0.78)',
  accent: '#a78bfa',
  accentSoft: 'rgba(167,139,250,0.18)',
  accentBlue: '#38bdf8',
  accentBlueSoft: 'rgba(56,189,248,0.18)',
};

const getRecommendationTone = (recommendation: string) => {
  if (recommendation === 'critical') {
    return { label: 'Kritisk', color: '#fca5a5', background: 'rgba(239,68,68,0.2)', border: 'rgba(248,113,113,0.5)' };
  }
  if (recommendation === 'recommended') {
    return { label: 'Anbefalt', color: '#fcd34d', background: 'rgba(245,158,11,0.18)', border: 'rgba(251,191,36,0.5)' };
  }
  return { label: 'Valgfri', color: '#cbd5e1', background: 'rgba(148,163,184,0.2)', border: 'rgba(148,163,184,0.45)' };
};

const FirmwareManagementInterface: React.FC<FirmwareManagementInterfaceProps> = ({
  profession,
  userId,
}) => {
  const [selectedUpdate, setSelectedUpdate] = useState<FirmwareUpdate | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [filterBy, setFilterBy] = useState<'all' | 'critical' | 'recommended' | 'optional'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'brand'>('priority');
  const [firmwareEndpointUnavailable, setFirmwareEndpointUnavailable] = useState(false);
  const queryClient = useQueryClient();
  
  const professionColor = PROFESSION_COLORS[profession];

  // Fetch firmware updates
  const {
    data: firmwareUpdates = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/equipment/firmware-updates', userId],
    enabled: Boolean(userId) && !firmwareEndpointUnavailable,
    queryFn: async () => {
      try {
        return await apiRequest(`/api/equipment/firmware-updates/${userId}`);
      } catch (error) {
        const status = getErrorStatusCode(error);
        if (status === 401 || status === 403 || status === 404) {
          setFirmwareEndpointUnavailable(true);
          return [];
        }
        throw error;
      }
    },
    retry: false,
  });

  // Hent brukerens utstyr — så vi kan skille «ingen utstyr lagt til» fra
  // «utstyr finnes, men ingen oppdateringer». Uten dette viste panelet
  // feilaktig «Alle firmware-versjoner er oppdaterte!» når lista var tom.
  const { data: userEquipment = [] } = useQuery({
    queryKey: ['/api/equipment/user', userId],
    enabled: Boolean(userId) && !firmwareEndpointUnavailable,
    queryFn: async () => {
      try {
        return await apiRequest(`/api/equipment/user/${userId}`);
      } catch {
        return [];
      }
    },
    retry: false,
  });
  const equipmentCount = Array.isArray(userEquipment) ? userEquipment.length : 0;

  // Manual firmware check
  const checkAllFirmwareMutation = useMutation({
    mutationFn: () => apiRequest('/api/equipment/sync-firmware', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment/firmware-updates', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment/user', userId],
      });
    },
  });

  // Helper to render source indicator
  const renderSourceIndicator = (update: FirmwareUpdate) => {
    const { sourceType, sourceName, confidence } = update.firmwareUpdate;
    if (!sourceType) return null;

    const sourceConfig = SOURCE_TYPE_CONFIG[sourceType];
    const confidenceConfig = confidence ? CONFIDENCE_CONFIG[confidence] : null;
    const SourceIcon = sourceConfig.icon;

    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
        <Tooltip title={`Kilde: ${sourceName || sourceConfig.label}`}>
          <Chip
            icon={<SourceIcon sx={{ fontSize: '0.9rem' }} />}
            label={sourceName || sourceConfig.label}
            size="small"
            sx={{
              bgcolor: sourceConfig.color + '20',
              color: sourceConfig.color,
              borderColor: sourceConfig.color,
              border: `1px solid ${sourceConfig.color}66`,
              fontSize: '0.7rem',
              height: 22,
              '& .MuiChip-icon': { color: sourceConfig.color },
            }}
            variant="outlined"
          />
        </Tooltip>
        {confidenceConfig && (
          <Tooltip title={`Pålitelighet: ${confidenceConfig.label}`}>
            <Chip
              label={confidenceConfig.label}
              size="small"
              sx={{
                bgcolor: confidenceConfig.color + '20',
                color: confidenceConfig.color,
                border: `1px solid ${confidenceConfig.color}66`,
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          </Tooltip>
        )}
      </Box>
    );
  };

  const getBenefitsForProfession = (update: FirmwareUpdate) => {
    switch (profession) {
      case 'photographer':
        return update.firmwareUpdate.photographerBenefits || [];
      case 'videographer':
        return update.firmwareUpdate.videographerBenefits || [];
      case 'music_producer':
        return update.firmwareUpdate.musicProducerBenefits || [];
      default:
        return update.firmwareUpdate.generalImprovements || [];
}
};

  const getRecommendationForProfession = (update: FirmwareUpdate) => {
    switch (profession) {
      case 'photographer':
        return update.firmwareUpdate.photographerRecommendation;
      case 'videographer':
        return update.firmwareUpdate.videographerRecommendation;
      case 'music_producer':
        return update.firmwareUpdate.musicProducerRecommendation;
      default:
        return 'optional';
}
};

  const filteredUpdates = firmwareUpdates.filter((update: FirmwareUpdate) => {
    if (filterBy === 'all') return true;
    const recommendation = getRecommendationForProfession(update);
    if (filterBy === 'critical') return update.firmwareUpdate.isCritical;
    if (filterBy === 'recommended') return recommendation === 'recommended';
    if (filterBy === 'optional') return recommendation === 'optional';
    return true;
});

  const sortedUpdates = [...filteredUpdates].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityA = a.firmwareUpdate.isCritical
          ? 3
          : getRecommendationForProfession(a) === 'recommended'
            ? 2
            : 1;
        const priorityB = b.firmwareUpdate.isCritical
          ? 3
          : getRecommendationForProfession(b) === 'recommended'
            ? 2
            : 1;
        return priorityB - priorityA;
      case 'date':
        return (
          new Date(b.firmwareUpdate.releaseDate).getTime() -
          new Date(a.firmwareUpdate.releaseDate).getTime()
        );
      case 'brand':
        return a.equipment.brand.localeCompare(b.equipment.brand);
      default: return 0;
}
});

  const criticalCount = firmwareUpdates.filter(
    (u: FirmwareUpdate) => u.firmwareUpdate.isCritical,
  ).length;
  const recommendedCount = firmwareUpdates.filter(
    (u: FirmwareUpdate) => getRecommendationForProfession(u) === 'recommended',
  ).length;

  const renderUpdateCard = (update: FirmwareUpdate) => {
    const benefits = getBenefitsForProfession(update);
    const recommendation = getRecommendationForProfession(update) || 'optional';
    const recommendationTone = getRecommendationTone(recommendation);
    const riskColor = RISK_COLORS[update.firmwareUpdate.riskLevel as keyof typeof RISK_COLORS] ?? '#94a3b8';
    const currentVersion = update.equipment.currentFirmwareVersion || 'Ukjent';

    return (
      <MuiCard
        key={update.equipment.id}
        sx={{
          border: update.firmwareUpdate.isCritical
            ? '1px solid rgba(248,113,113,0.62)'
            : `1px solid ${recommendationTone.border}`,
          background:
            'linear-gradient(155deg, rgba(2,6,23,0.86) 0%, rgba(15,23,42,0.78) 52%, rgba(30,41,59,0.64) 100%)',
          cursor: 'pointer',
          transition: 'all 0.28s ease',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: update.firmwareUpdate.isCritical
              ? 'linear-gradient(90deg, #f87171, #fb7185)'
              : 'linear-gradient(90deg, #a78bfa, #38bdf8)',
          },
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 14px 28px rgba(2,6,23,0.44)',
            borderColor: 'rgba(125,211,252,0.52)',
          },
        }}
        onClick={() => setSelectedUpdate(update)}
      >
        <CardContent
          sx={{
            p: 2,
            color: ROLE_ROOM_BRAND.textPrimary,
            '&:last-child': { pb: 2 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              sx={{
                mr: 2,
                background: `linear-gradient(140deg, ${professionColor}, ${ROLE_ROOM_BRAND.accentBlue})`,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.18) inset',
              }}
            >
              {profession === 'photographer' ? (
                <PhotoCamera />
              ) : profession === 'videographer' ? (
                <Videocam />
              ) : profession === 'music_producer' ? (
                <LibraryMusic />
              ) : (
                <Business />
              )}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', color: ROLE_ROOM_BRAND.textPrimary, fontWeight: 700 }}>
                {update.equipment.brand} {update.equipment.model}
              </Typography>
              <Typography variant="body2" sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                {currentVersion} → {update.firmwareUpdate.version}
              </Typography>
              {/* RSS Source Indicator */}
              {renderSourceIndicator(update)}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexDirection: 'column',
                alignItems: 'flex-end'}}
            >
              {update.firmwareUpdate.isCritical && (
                <Chip
                  label="Kritisk"
                  size="small"
                  icon={<Security />}
                  sx={{
                    bgcolor: 'rgba(239,68,68,0.2)',
                    color: '#fecaca',
                    border: '1px solid rgba(248,113,113,0.48)',
                  }}
                />
              )}
              <Chip
                label={recommendationTone.label}
                size="small"
                sx={{
                  bgcolor: recommendationTone.background,
                  color: recommendationTone.color,
                  border: `1px solid ${recommendationTone.border}`,
                }}
              />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: ROLE_ROOM_BRAND.accentBlue, fontWeight: 700 }}>
              {profession === 'music_producer' ? 'Programvareforbedringer: ' : 'Hovedforbedringer:'}
            </Typography>
            {benefits.slice(0, 2).map((benefit, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5, color: ROLE_ROOM_BRAND.textSecondary }}>
                {`• ${benefit}`}
              </Typography>
            ))}
            {benefits.length > 2 && (
              <Typography variant="body2" sx={{ color: 'rgba(148,163,184,0.95)' }}>
                +{benefits.length - 2} flere forbedringer...
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`Risiko: ${update.firmwareUpdate.riskLevel}`}
              size="small"
              sx={{
                bgcolor: `${riskColor}20`,
                color: riskColor,
                border: `1px solid ${riskColor}66`,
              }}
            />
            {update.firmwareUpdate.downloadSize && (
              <Chip
                label={update.firmwareUpdate.downloadSize}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: 'rgba(148,163,184,0.45)',
                  color: 'rgba(226,232,240,0.86)',
                }}
              />
            )}
            <Chip
              label={new Date(update.firmwareUpdate.releaseDate).toLocaleDateString('nb-NO')}
              size="small"
              variant="outlined"
              sx={{
                borderColor: 'rgba(148,163,184,0.45)',
                color: 'rgba(226,232,240,0.86)',
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {update.firmwareUpdate.downloadUrl && (
              <Button
                variant="contained"
                startIcon={<Download />}
                size="small"
                sx={{
                  bgcolor: ROLE_ROOM_BRAND.accent,
                  color: '#0f172a',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#c4b5fd' },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(update.firmwareUpdate.downloadUrl, '_blank');
                }}
              >
                Last ned
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<Info />}
              size="small"
              sx={{
                borderColor: 'rgba(56,189,248,0.55)',
                color: ROLE_ROOM_BRAND.accentBlue,
              }}
            >
              Detaljer
            </Button>
          </Box>
        </CardContent>
      </MuiCard>
    );
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          background: ROLE_ROOM_BRAND.pageBackground,
          border: ROLE_ROOM_BRAND.panelBorder,
        }}
      >
        <LinearProgress sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ROLE_ROOM_BRAND.accent } }} />
        <Typography sx={{ color: ROLE_ROOM_BRAND.textPrimary }}>Sjekker fastvare-oppdateringer...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        background: ROLE_ROOM_BRAND.pageBackground,
        border: ROLE_ROOM_BRAND.panelBorder,
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          background: 'linear-gradient(140deg, rgba(30,41,59,0.52) 0%, rgba(15,23,42,0.62) 100%)',
          border: '1px solid rgba(148,163,184,0.22)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2}}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                background: `linear-gradient(135deg, ${ROLE_ROOM_BRAND.accent}, ${ROLE_ROOM_BRAND.accentBlue})`,
              }}
            >
              <Update fontSize="small" />
            </Avatar>
            <Typography
              variant="h5"
              sx={{
                color: ROLE_ROOM_BRAND.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 800,
                letterSpacing: 0.2,
              }}
            >
              Fastvare-oppdateringer
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={checkAllFirmwareMutation.isPending ? <Cached className="animate-spin" /> : <Refresh />}
            onClick={() => checkAllFirmwareMutation.mutate()}
            disabled={checkAllFirmwareMutation.isPending}
            sx={{
              bgcolor: ROLE_ROOM_BRAND.accent,
              color: '#0f172a',
              fontWeight: 700,
              '&:hover': { bgcolor: '#c4b5fd' },
            }}
          >
            {checkAllFirmwareMutation.isPending ? 'Sjekker...' : 'Sjekk oppdateringer'}
          </Button>
        </Box>
        <Typography variant="body1" sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
          Hold {profession === 'music_producer' ? 'programvaren og utstyret' : 'utstyret'} ditt
          oppdatert med de nyeste {profession === 'music_producer' ? 'programvare-' : 'firmware-'}
          versjonene fra produsentene
        </Typography>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <MuiCard sx={{ background: ROLE_ROOM_BRAND.panelBackground, border: ROLE_ROOM_BRAND.panelBorder }}>
            <CardContent sx={{ textAlign: 'center', color: ROLE_ROOM_BRAND.textPrimary }}>
              <Typography variant="h4" sx={{ color: '#F44336' }}>
                {criticalCount}
              </Typography>
              <Typography variant="body2" sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                {profession === 'music_producer'
                  ? 'Kritiske programvareoppdateringer'
                  : 'Kritiske oppdateringer'}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MuiCard sx={{ background: ROLE_ROOM_BRAND.panelBackground, border: ROLE_ROOM_BRAND.panelBorder }}>
            <CardContent sx={{ textAlign: 'center', color: ROLE_ROOM_BRAND.textPrimary }}>
              <Typography variant="h4" sx={{ color: '#FF9800' }}>
                {recommendedCount}
              </Typography>
              <Typography variant="body2" sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                {profession === 'music_producer'
                  ? 'Anbefalte programvareoppdateringer'
                  : 'Anbefalte oppdateringer'}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MuiCard sx={{ background: ROLE_ROOM_BRAND.panelBackground, border: ROLE_ROOM_BRAND.panelBorder }}>
            <CardContent sx={{ textAlign: 'center', color: ROLE_ROOM_BRAND.textPrimary }}>
              <Typography variant="h4" sx={{ color: ROLE_ROOM_BRAND.accentBlue }}>
                {firmwareUpdates.length}
              </Typography>
              <Typography variant="body2" sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                Totalt tilgjengelige
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MuiCard sx={{ background: ROLE_ROOM_BRAND.panelBackground, border: ROLE_ROOM_BRAND.panelBorder }}>
            <CardContent sx={{ textAlign: 'center', color: ROLE_ROOM_BRAND.textPrimary }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoCheckEnabled}
                    onChange={(e) => setAutoCheckEnabled(e.target.checked)}
                    color="default"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: ROLE_ROOM_BRAND.accentBlue,
                      }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: ROLE_ROOM_BRAND.accentBlue,
                      }}}
                  />
                }
                label="Auto-sjekk"
                labelPlacement="bottom"
                sx={{
                  flexDirection: 'column',
                  alignItems: 'center','& .MuiFormControlLabel-label': {
                    fontSize: '0.875rem',
                    color: ROLE_ROOM_BRAND.textSecondary,
                  }}}
              />
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Filters and Sorting */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 3,
          alignItems: 'center',
          flexWrap: 'wrap',
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'rgba(15,23,42,0.58)',
          border: '1px solid rgba(148,163,184,0.24)',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>Filter</InputLabel>
          <Select
            value={filterBy}
            label="Filter"
            onChange={(e) => setFilterBy(e.target.value as any)}
            sx={{
              color: ROLE_ROOM_BRAND.textPrimary,
              bgcolor: 'rgba(2,6,23,0.5)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.34)' },
            }}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="critical">Kritiske</MenuItem>
            <MenuItem value="recommended">Anbefalte</MenuItem>
            <MenuItem value="optional">Valgfrie</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>Sorter</InputLabel>
          <Select
            value={sortBy}
            label="Sorter"
            onChange={(e) => setSortBy(e.target.value as any)}
            sx={{
              color: ROLE_ROOM_BRAND.textPrimary,
              bgcolor: 'rgba(2,6,23,0.5)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.34)' },
            }}
          >
            <MenuItem value="priority">Prioritet</MenuItem>
            <MenuItem value="date">Dato</MenuItem>
            <MenuItem value="brand">Merke</MenuItem>
          </Select>
        </FormControl>

        <Chip
          label={`${sortedUpdates.length} oppdateringer`}
          sx={{ bgcolor: ROLE_ROOM_BRAND.accentBlueSoft, color: ROLE_ROOM_BRAND.accentBlue, border: '1px solid rgba(56,189,248,0.34)' }}
        />
      </Box>

      {/* Updates List */}
      {firmwareEndpointUnavailable && !isLoading && (
        <Box sx={{ minHeight: { xs: 260, md: 320 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 860,
              textAlign: 'center',
              py: { xs: 5, md: 6 },
              px: { xs: 2.5, md: 4 },
              borderRadius: 2,
              background: 'linear-gradient(140deg, rgba(30,58,138,0.2) 0%, rgba(15,23,42,0.62) 100%)',
              border: '1px solid rgba(96,165,250,0.34)',
            }}
          >
            <Info sx={{ fontSize: '3.2rem', mb: 1.5, color: '#60a5fa' }} />
            <Typography variant="h5" sx={{ mb: 1, color: ROLE_ROOM_BRAND.textPrimary, fontWeight: 700 }}>
              Fastvaredata er ikke tilgjengelig ennå
            </Typography>
            <Typography sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
              Panelet viser oppdateringer automatisk når endepunktet blir aktivt.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Ingen utstyr lagt til — IKKE «alt oppdatert». Veiled til å legge til utstyr. */}
      {!firmwareEndpointUnavailable && sortedUpdates.length === 0 && !isLoading && equipmentCount === 0 && (
        <Box sx={{ minHeight: { xs: 260, md: 320 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 860,
              textAlign: 'center',
              py: { xs: 5, md: 6 },
              px: { xs: 2.5, md: 4 },
              borderRadius: 2,
              background: 'linear-gradient(140deg, rgba(96,165,250,0.14) 0%, rgba(15,23,42,0.62) 100%)',
              border: '1px solid rgba(96,165,250,0.34)',
            }}
          >
            <Info sx={{ fontSize: '3.2rem', mb: 1.5, color: '#60a5fa' }} />
            <Typography variant="h4" sx={{ mb: 1, color: ROLE_ROOM_BRAND.textPrimary, fontWeight: 700 }}>
              Ingen utstyr lagt til ennå
            </Typography>
            <Typography sx={{ color: ROLE_ROOM_BRAND.textSecondary, fontSize: '1.15rem' }}>
              Legg til kamera og utstyr i Utstyr-fanen, så viser vi firmware-status
              og oppdateringer for hvert produkt her.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Utstyr finnes, men ingen ventende oppdateringer → faktisk «alt oppdatert». */}
      {!firmwareEndpointUnavailable && sortedUpdates.length === 0 && !isLoading && equipmentCount > 0 && (
        <Box sx={{ minHeight: { xs: 260, md: 320 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 860,
              textAlign: 'center',
              py: { xs: 5, md: 6 },
              px: { xs: 2.5, md: 4 },
              borderRadius: 2,
              background: 'linear-gradient(140deg, rgba(16,185,129,0.14) 0%, rgba(15,23,42,0.62) 100%)',
              border: '1px solid rgba(74,222,128,0.35)',
            }}
          >
            <CheckCircle sx={{ fontSize: '3.2rem', mb: 1.5, color: '#4ade80' }} />
            <Typography variant="h4" sx={{ mb: 1, color: ROLE_ROOM_BRAND.textPrimary, fontWeight: 700 }}>
              Alle firmware-versjoner er oppdaterte!
            </Typography>
            <Typography sx={{ color: ROLE_ROOM_BRAND.textSecondary, fontSize: '1.15rem' }}>
              Ditt utstyr har de nyeste firmware-versjonene tilgjengelig.
            </Typography>
          </Box>
        </Box>
      )}

      <Grid container spacing={3}>
        {sortedUpdates.map(renderUpdateCard)}
      </Grid>

      {/* Detailed Update Dialog */}
      <Dialog
        open={!!selectedUpdate}
        onClose={() => setSelectedUpdate(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: ROLE_ROOM_BRAND.pageBackground,
            border: ROLE_ROOM_BRAND.panelBorder,
            color: ROLE_ROOM_BRAND.textPrimary,
          },
        }}
      >
        {selectedUpdate && (
          <>
            <DialogTitle component="div" sx={{ borderBottom: '1px solid rgba(148,163,184,0.24)' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ background: `linear-gradient(135deg, ${professionColor}, ${ROLE_ROOM_BRAND.accentBlue})` }}>
                    <Update />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: ROLE_ROOM_BRAND.textPrimary }}>
                      {selectedUpdate.equipment.brand} {selectedUpdate.equipment.model}
                    </Typography>
                    <Typography variant="body2" sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                      Firmware {selectedUpdate.firmwareUpdate.version}
                    </Typography>
                    {/* Source indicator in dialog header */}
                    {renderSourceIndicator(selectedUpdate)}
                  </Box>
                </Box>
                <IconButton onClick={() => setSelectedUpdate(null)} sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              {/* Source Information Box */}
              {selectedUpdate.firmwareUpdate.sourceType && (
                <Alert
                  severity="info"
                  icon={<RssFeed />}
                  sx={{
                    mb: 3,
                    bgcolor: 'rgba(30,58,138,0.16)',
                    border: '1px solid rgba(96,165,250,0.34)',
                    color: ROLE_ROOM_BRAND.textPrimary,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Kildeinformasjon
                  </Typography>
                  <Typography variant="body2">
                    Oppdaget via{', '}
                    <strong>
                      {selectedUpdate.firmwareUpdate.sourceName ||
                        SOURCE_TYPE_CONFIG[selectedUpdate.firmwareUpdate.sourceType].label}
                    </strong>
                    {selectedUpdate.firmwareUpdate.confidence && (
                      <> (Pålitelighet: {CONFIDENCE_CONFIG[selectedUpdate.firmwareUpdate.confidence].label})</>
                    )}
                  </Typography>
                </Alert>
              )}

              {/* Critical warning */}
              {selectedUpdate.firmwareUpdate.isCritical && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    bgcolor: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(248,113,113,0.4)',
                    color: ROLE_ROOM_BRAND.textPrimary,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Kritisk sikkerhetsoppdatering
                  </Typography>
                  <Typography variant="body2">
                    Denne oppdateringen inneholder viktige sikkerhetsforbedringer og bør installeres
                    umiddelbart.
                  </Typography>
                </Alert>
              )}

              {/* All benefits */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: ROLE_ROOM_BRAND.textPrimary }}>
                  Forbedringer for{', '}
                  {profession === 'photographer'
                    ? 'fotografer'
                    : profession === 'videographer'
                      ? 'videografer'
                      : profession === 'music_producer'
                        ? 'musikkprodusenter': 'leverandører'}
                </Typography>
                <List dense>
                  {getBenefitsForProfession(selectedUpdate).map((benefit, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircle sx={{ color: professionColor, fontSize: '1rem' }} />
                      </ListItemIcon>
                      <ListItemText primary={benefit} />
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* New features */}
              {selectedUpdate.firmwareUpdate.newFeatures && selectedUpdate.firmwareUpdate.newFeatures.length > 0 && (
                <Accordion sx={{ mb: 2, bgcolor: 'rgba(15,23,42,0.62)', border: '1px solid rgba(148,163,184,0.2)' }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>
                      <NewReleases sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Nye funksjoner ({selectedUpdate.firmwareUpdate.newFeatures.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {selectedUpdate.firmwareUpdate.newFeatures.map((feature, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <NewReleases sx={{ fontSize: '1rem' }} />
                          </ListItemIcon>
                          <ListItemText primary={feature} />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Bug fixes */}
              {selectedUpdate.firmwareUpdate.bugFixes && selectedUpdate.firmwareUpdate.bugFixes.length > 0 && (
                <Accordion sx={{ mb: 2, bgcolor: 'rgba(15,23,42,0.62)', border: '1px solid rgba(148,163,184,0.2)' }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>
                      <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Feilrettinger ({selectedUpdate.firmwareUpdate.bugFixes.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {selectedUpdate.firmwareUpdate.bugFixes.map((fix, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <BugReport sx={{ fontSize: '1rem' }} />
                          </ListItemIcon>
                          <ListItemText primary={fix} />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Requirements */}
              {selectedUpdate.firmwareUpdate.requirements && selectedUpdate.firmwareUpdate.requirements.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, color: ROLE_ROOM_BRAND.textPrimary }}>
                    Systemkrav
                  </Typography>
                  <List dense>
                    {selectedUpdate.firmwareUpdate.requirements.map((req, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle sx={{ color: 'success.main', fontSize: '1rem' }} />
                        </ListItemIcon>
                        <ListItemText primary={req} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Known issues */}
              {selectedUpdate.firmwareUpdate.knownIssues && selectedUpdate.firmwareUpdate.knownIssues.length > 0 && (
                <Alert
                  severity="warning"
                  sx={{
                    mb: 3,
                    bgcolor: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(251,191,36,0.4)',
                    color: ROLE_ROOM_BRAND.textPrimary,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Kjente problemer
                  </Typography>
                  <List dense>
                    {selectedUpdate.firmwareUpdate.knownIssues.map((issue, index) => (
                      <Typography key={index} variant="body2" component="li">
                        • {issue}
                      </Typography>
                    ))}
                  </List>
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.24)', px: 2, py: 1.5 }}>
              <Button onClick={() => setSelectedUpdate(null)} sx={{ color: ROLE_ROOM_BRAND.textSecondary }}>Lukk</Button>
              {selectedUpdate.firmwareUpdate.sourceUrl && (
                <Button
                  startIcon={<Launch />}
                  onClick={() => window.open(selectedUpdate.firmwareUpdate.sourceUrl, '_blank')}
                  sx={{ color: ROLE_ROOM_BRAND.accentBlue }}
                >
                  Produsent
                </Button>
              )}
              {selectedUpdate.firmwareUpdate.downloadUrl && (
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={() => {
                    window.open(selectedUpdate.firmwareUpdate.downloadUrl, '_blank');
                    setSelectedUpdate(null);
                  }}
                  sx={{
                    bgcolor: ROLE_ROOM_BRAND.accent,
                    color: '#0f172a',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#c4b5fd' },
                  }}
                >
                  Last ned firmware
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default FirmwareManagementInterface;
