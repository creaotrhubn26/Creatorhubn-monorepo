import { useTheming } from '../../utils/theming-helper';
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

const FirmwareManagementInterface: React.FC<FirmwareManagementInterfaceProps> = ({
  profession,
  userId,
}) => {
  const [selectedUpdate, setSelectedUpdate] = useState<FirmwareUpdate | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [filterBy, setFilterBy] = useState<'all' | 'critical' | 'recommended' | 'optional'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'brand'>('priority');
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  const professionColor = PROFESSION_COLORS[profession];

  // Fetch firmware updates
  const {
    data: firmwareUpdates = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/equipment/firmware-updates', userId],
    queryFn: () => apiRequest(`/api/equipment/firmware-updates/${userId}`),
  });

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
              fontSize: '0.7rem',
              height: 22}}
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
                fontSize: '0.7rem',
                height: 22}}
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
    const recommendation = getRecommendationForProfession(update);

    return (
      <MuiCard
        key={update.equipment.id}
        sx={{
          border: update.firmwareUpdate.isCritical ? '2px solid #F44336' : '1px solid #e0e0e0',
          cursor: 'pointer',
          transition: 'all 0.3s ease', '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 4,
          }}}
        onClick={() => setSelectedUpdate(update)}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: professionColor, mr: 2 }}>
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
              <Typography variant="h6" sx={{ fontSize: '1.1rem', color: theming.colors.primary }}>
                {update.equipment.brand} {update.equipment.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {update.equipment.currentFirmwareVersion} → {update.firmwareUpdate.version}
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
                <Chip label="Kritisk" color="error" size="small" icon={<Security />} />
              )}
              <Chip
                label={
                  recommendation === 'recommended'
                    ? 'Anbefalt'
                    : recommendation === 'critical'
                      ? 'Kritisk'
                      : 'Valgfri'
                }
                size="small"
                color={
                  recommendation === 'critical'
                    ? 'error'
                    : recommendation === 'recommended'
                      ? 'warning'
                      : 'default'
                }
              />
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: professionColor }}>
              {profession === 'music_producer' ? 'Programvareforbedringer: ' : 'Hovedforbedringer:'}
            </Typography>
            {benefits.slice(0, 2).map((benefit, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                • {benefit}
              </Typography>
            ))}
            {benefits.length > 2 && (
              <Typography variant="body2" color="text.secondary">
                +{benefits.length - 2} flere forbedringer...
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`Risiko: ${update.firmwareUpdate.riskLevel}`}
              size="small"
              sx={{
                bgcolor: RISK_COLORS[update.firmwareUpdate.riskLevel as keyof typeof RISK_COLORS] + '20',
                color: RISK_COLORS[update.firmwareUpdate.riskLevel as keyof typeof RISK_COLORS]}}
            />
            {update.firmwareUpdate.downloadSize && (
              <Chip label={update.firmwareUpdate.downloadSize} size="small" variant="outlined" />
            )}
            <Chip
              label={new Date(update.firmwareUpdate.releaseDate).toLocaleDateString('no')}
              size="small"
              variant="outlined"
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {update.firmwareUpdate.downloadUrl && (
              <Button
                variant="contained"
                startIcon={<Download />}
                size="small"
                sx={{ bgcolor: professionColor }}
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
              sx={{ borderColor: professionColor, color: professionColor }}
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
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Sjekker firmware-oppdateringer...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2}}
        >
          <Typography
            variant="h4"
            sx={{
              color: theming.colors.primary,
              display: 'flex',
              alignItems: 'center',
              gap: 2}}
          >
            <Update />
            Firmware-administrasjon
          </Typography>
          <Button
            variant="contained"
            startIcon={checkAllFirmwareMutation.isPending ? <Cached className="animate-spin" /> : <Refresh />}
            onClick={() => checkAllFirmwareMutation.mutate()}
            disabled={checkAllFirmwareMutation.isPending}
            sx={{ bgcolor: professionColor }}
          >
            {checkAllFirmwareMutation.isPending ? 'Sjekker...' : 'Sjekk oppdateringer'}
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Hold {profession === 'music_producer' ? 'programvaren og utstyret' : 'utstyret'} ditt
          oppdatert med de nyeste {profession === 'music_producer' ? 'programvare-' : 'firmware-'}
          versjonene fra produsentene
        </Typography>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <MuiCard>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#F44336' }}>
                {criticalCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profession === 'music_producer'
                  ? 'Kritiske programvareoppdateringer'
                  : 'Kritiske oppdateringer'}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MuiCard>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#FF9800' }}>
                {recommendedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profession === 'music_producer'
                  ? 'Anbefalte programvareoppdateringer'
                  : 'Anbefalte oppdateringer'}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MuiCard>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: professionColor }}>
                {firmwareUpdates.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totalt tilgjengelige
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MuiCard>
            <CardContent sx={{ textAlign: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoCheckEnabled}
                    onChange={(e) => setAutoCheckEnabled(e.target.checked)}
                    color="default"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: professionColor,
                      }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: professionColor,
                      }}}
                  />
                }
                label="Auto-sjekk"
                labelPlacement="bottom"
                sx={{
                  flexDirection: 'column',
                  alignItems: 'center','& .MuiFormControlLabel-label': {
                    fontSize: '0.875rem',
                    color: 'text.secondary',
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
          flexWrap: 'wrap'}}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Filter</InputLabel>
          <Select
            value={filterBy}
            label="Filter"
            onChange={(e) => setFilterBy(e.target.value as any)}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="critical">Kritiske</MenuItem>
            <MenuItem value="recommended">Anbefalte</MenuItem>
            <MenuItem value="optional">Valgfrie</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sorter</InputLabel>
          <Select value={sortBy} label="Sorter" onChange={(e) => setSortBy(e.target.value as any)}>
            <MenuItem value="priority">Prioritet</MenuItem>
            <MenuItem value="date">Dato</MenuItem>
            <MenuItem value="brand">Merke</MenuItem>
          </Select>
        </FormControl>

        <Chip
          label={`${sortedUpdates.length} oppdateringer`}
          sx={{ bgcolor: professionColor + '20', color: professionColor }}
        />
      </Box>

      {/* Updates List */}
      {sortedUpdates.length === 0 && !isLoading && (
        <Alert severity="info" sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircle sx={{ fontSize: '3rem', mb: 2, color: 'success.main' }} />
          <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
            Alle firmware-versjoner er oppdaterte!
          </Typography>
          <Typography>Ditt utstyr har de nyeste firmware-versjonene tilgjengelig.</Typography>
        </Alert>
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
      >
        {selectedUpdate && (
          <>
            <DialogTitle>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: professionColor }}>
                    <Update />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {selectedUpdate.equipment.brand} {selectedUpdate.equipment.model}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Firmware {selectedUpdate.firmwareUpdate.version}
                    </Typography>
                    {/* Source indicator in dialog header */}
                    {renderSourceIndicator(selectedUpdate)}
                  </Box>
                </Box>
                <IconButton onClick={() => setSelectedUpdate(null)}>
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              {/* Source Information Box */}
              {selectedUpdate.firmwareUpdate.sourceType && (
                <Alert
                  severity="info"
                  icon={<RssFeed />}
                  sx={{ mb: 3 }}
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
                <Alert severity="error" sx={{ mb: 3 }}>
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
                <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
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
                <Accordion sx={{ mb: 2 }}>
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
                <Accordion sx={{ mb: 2 }}>
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
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
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
                <Alert severity="warning" sx={{ mb: 3 }}>
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
            <DialogActions>
              <Button onClick={() => setSelectedUpdate(null)}>Lukk</Button>
              {selectedUpdate.firmwareUpdate.sourceUrl && (
                <Button
                  startIcon={<Launch />}
                  onClick={() => window.open(selectedUpdate.firmwareUpdate.sourceUrl, '_blank')}
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
                  sx={{ bgcolor: professionColor }}
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
