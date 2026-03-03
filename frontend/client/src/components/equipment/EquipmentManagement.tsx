import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Avatar,
  Chip,
  Button,
  IconButton,
  Badge,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Business,
  CameraAlt,
  Lens,
  Headphones,
  FlashOn,
  Computer,
  Extension,
  Update,
  Warning,
  CheckCircle,
  Build,
  Add,
  Info,
  Download,
  History,
  Settings,
  Security,
  Search,
  Inventory,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import FirmwareManagementInterface from './FirmwareManagementInterface';
import PluginDetectionInterface from '../plugins/PluginDetectionInterface';
import EquipmentCatalogBrowser from './EquipmentCatalogBrowser';

interface EquipmentManagementProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId: string
}

interface Equipment {
  id: number;
  userId: string;
  profession: string;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber?: string;
  condition: string;
  isActive: boolean;
  currentFirmwareVersion?: string;
  latestFirmwareVersion?: string;
  firmwareUpdateAvailable: boolean;
  specifications?: any;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  lastUsed?: string;
  totalShots?: number;
  totalHours?: number;
  location?: string
}

interface FirmwareUpdate {
  equipment: Equipment;
  firmwareUpdate: {
    version: string;
    releaseDate: string;
    photographerBenefits?: string[];
    videographerBenefits?: string[];
    generalImprovements?: string[];
    bugFixes?: string[];
    newFeatures?: string[];
    isCritical: boolean;
    downloadUrl?: string;
    downloadSize?: string;
    installationTime?: string;
    photographerRecommendation?: string;
    videographerRecommendation?: string;
    riskLevel: string;
};
}

const EQUIPMENT_TYPES = {
  camera: { icon: CameraAlt, label: 'Kameraer', color: '#FF6B35' },
  lens: { icon: Lens, label: 'Objektiver', color: '#9C27B0' },
  audio: { icon: Headphones, label: 'Lyd', color: '#FF5722' },
  lighting: { icon: FlashOn, label: 'Lys', color: '#FFC107' },
  computer: { icon: Computer, label: 'Datautstyr', color: '#2196F3' },
  accessory: { icon: Extension, label: 'Tilbehør', color: '#4CAF50' },
  audio_interface: { icon: Headphones, label: 'Lydkort', color: '#E91E63' },
  synthesizer: { icon: LibraryMusic, label: 'Synthesizere', color: '#673AB7' },
  controller: { icon: Settings, label: 'Kontrollere', color: '#009688' },
  software: { icon: Computer, label: 'Programvare', color: '#607D8B' },
};

const CONDITION_COLORS = {
  excellent: '#4CAF50',
  good: '#8BC34A',
  fair: '#FF9800',
  poor: '#FF5722',
  needs_repair: '#F44336',
};

const PROFESSION_COLORS = {
  photographer: '#FF6B35',
  videographer: '#9C27B0',
  music_producer: '#FF5722',
  vendor: '#2196F3',
  enterprise: '#6c3483',
};

const EquipmentManagement: React.FC<EquipmentManagementProps> = ({ profession, userId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false);
  const queryClient = useQueryClient();

  // Theming system
  const theming = useTheming(profession);

  const professionColor = PROFESSION_COLORS[profession];

  // Fetch user equipment
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery({
    queryKey: [ '/api/equipment/user,', userId],
    queryFn: () => apiRequest(`/api/equipment/user/${userId}`),
  });

  // Fetch equipment statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/equipment/stats,', userId],
    queryFn: () => apiRequest(`/api/equipment/stats/${userId}`),
  });

  // Fetch firmware updates
  const { data: firmwareUpdates = [] } = useQuery({
    queryKey: ['/api/equipment/firmware-updates', userId],
    queryFn: () => apiRequest(`/api/equipment/firmware-updates/${userId}`),
  });

  // Check firmware update mutation
  const checkFirmwareMutation = useMutation({
    mutationFn: (equipmentId: number) =>
      apiRequest(`/api/equipment/check-firmware/${equipmentId}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment/user', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment/firmware-updates', userId],
      });
    },
  });

  const getEquipmentsByType = (type: string) => {
    return equipment.filter((eq: Equipment) => eq.equipmentType === type);
  };

  const getBenefitsForProfession = (update: FirmwareUpdate) => {
    switch (profession) {
      case 'photographer':
      case 'enterprise':
        return update.firmwareUpdate.photographerBenefits || [];
      case 'videographer':
        return update.firmwareUpdate.videographerBenefits || [];
      default:
        return update.firmwareUpdate.generalImprovements || [];
    }
  };

  const getRecommendationForProfession = (update: FirmwareUpdate) => {
    switch (profession) {
      case 'photographer':
      case 'enterprise':
        return update.firmwareUpdate.photographerRecommendation;
      case 'videographer':
        return update.firmwareUpdate.videographerRecommendation;
      default:
        return 'optional';
    }
  };

  const renderEquipmentCard = (eq: Equipment) => {
    const equipmentType = EQUIPMENT_TYPES[eq.equipmentType as keyof typeof EQUIPMENT_TYPES];
    const Icon = equipmentType?.icon || Extension;

    return (
      <MuiCard
        key={eq.id}
        sx={{
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.3s ease', '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
          border: eq.firmwareUpdateAvailable ? `2px solid ${professionColor}` : '1px solid #e0e0e0'}}
        onClick={() => setSelectedEquipment(eq)}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              sx={{
                bgcolor: equipmentType?.color || '#666',
                mr: 2,
                width: 48,
                height: 48}}
            >
              <Icon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: theming.colors.primary }}>
                {eq.brand} {eq.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {equipmentType?.label || eq.equipmentType}
              </Typography>
            </Box>
            {eq.firmwareUpdateAvailable && (
              <Badge badgeContent="!" color="error">
                <Update sx={{ color: professionColor }} />
              </Badge>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={eq.condition}
              size="small"
              sx={{
                bgcolor: CONDITION_COLORS[eq.condition as keyof typeof CONDITION_COLORS] + '20',
                color: CONDITION_COLORS[eq.condition as keyof typeof CONDITION_COLORS]}}
            />
            {eq.currentFirmwareVersion && (
              <Chip label={`v${eq.currentFirmwareVersion}`} size="small" variant="outlined" />
            )}
          </Box>

          {eq.equipmentType === 'camera' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {eq.totalShots ? `${eq.totalShots.toLocaleString()} bilder` : 'Ikke registrert'}
              </Typography>
              {eq.lastUsed && (
                <Typography variant="body2" color="text.secondary">
                  Sist brukt: {new Date(eq.lastUsed).toLocaleDateString('no-NO')}
                </Typography>
              )}
            </Box>
          )}

          {(eq.equipmentType === 'audio' ||
            eq.equipmentType === 'audio_interface' ||
            eq.equipmentType === 'software') && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {eq.totalHours ? `${Number(eq.totalHours).toFixed(1)} timer` : 'Ikke registrert'}
              </Typography>
              {eq.lastUsed && (
                <Typography variant="body2" color="text.secondary">
                  Sist brukt: {new Date(eq.lastUsed).toLocaleDateString('no-NO')}
                </Typography>
              )}
            </Box>
          )}

          {eq.firmwareUpdateAvailable && (
            <Alert
              severity="warning"
              sx={{ mt: 2 }}
              action={
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    checkFirmwareMutation.mutate(eq.id);
                  }}
                  disabled={checkFirmwareMutation.isPending}
                >
                  Sjekk
                </Button>
              }
            >
              Firmware-oppdatering tilgjengelig
            </Alert>
          )}
        </CardContent>
      </MuiCard>
    );
  };

  const renderFirmwareUpdates = () => {
    if (!firmwareUpdates.length) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle sx={{ color: '#4CAF50' }} />
            <Typography>Alle dine kameraer har de nyeste firmware-versjonene!</Typography>
          </Box>
        </Alert>
      );
    }

    return (
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {firmwareUpdates.map((update: FirmwareUpdate) => {
          const benefits = getBenefitsForProfession(update);
          const recommendation = getRecommendationForProfession(update);

          return (
            <Grid item xs={12} md={6} key={update.equipment.id}>
              <MuiCard
                sx={{
                  border: update.firmwareUpdate.isCritical
                    ? '2px solid #FF5722'
                    : '1px solid #e0e0e0'}}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: professionColor, mr: 2 }}>
                      <CameraAlt />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {update.equipment.brand} {update.equipment.model}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {update.equipment.currentFirmwareVersion} → {update.firmwareUpdate.version}
                      </Typography>
                    </Box>
                    {update.firmwareUpdate.isCritical && (
                      <Chip label="Kritisk" color="error" size="small" icon={<Warning />} />
                    )}
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: professionColor }}>
                      Forbedringer for{''}
                      {profession === 'photographer' ? 'fotografer' : 'videografer'}:
                    </Typography>
                    {benefits.slice(0, 3).map((benefit: string, index: number) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        • {benefit}
                      </Typography>
                    ))}
                    {benefits.length > 3 && (
                      <Typography variant="body2" color="text.secondary">
                        +{benefits.length - 3} flere forbedringer...
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
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
                    <Chip
                      label={`Risiko: ${update.firmwareUpdate.riskLevel}`}
                      size="small"
                      variant="outlined"
                    />
                    {update.firmwareUpdate.downloadSize && (
                      <Chip
                        label={update.firmwareUpdate.downloadSize}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {update.firmwareUpdate.downloadUrl && (
                      <Button
                        variant="contained"
                        startIcon={<Download />}
                        sx={{ bgcolor: professionColor }}
                        size="small"
                        onClick={() => window.open(update.firmwareUpdate.downloadUrl, '_blank')}
                      >
                        Last ned
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<Info />}
                      size="small"
                      onClick={() => setSelectedEquipment(update.equipment)}
                    >
                      Detaljer
                    </Button>
                  </Box>

                  {update.firmwareUpdate.installationTime && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      Installasjonstid: {update.firmwareUpdate.installationTime}
                    </Typography>
                  )}
                </CardContent>
              </MuiCard>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  if (equipmentLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography>Laster utstyr...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            mb: 2,
            color: theming.colors.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 2}}
        >
          <Build sx={{ color: professionColor }} />
          Utstyrsadministrasjon
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Administrer ditt utstyr og hold firmware oppdatert
        </Typography>
      </Box>

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <MuiCard>
              <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h4" sx={{ color: professionColor }}>
                  {stats.totalEquipment}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Totalt utstyr
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <MuiCard>
              <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h4" sx={{ color: '#FF5722' }}>
                  {stats.firmwareUpdatesAvailable}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Firmware-oppdateringer
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <MuiCard>
              <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h4" sx={{ color: '#4CAF50' }}>
                  {stats.totalValue?.toLocaleString('no-NO', {
                    style: 'currency',
                    currency: 'NOK',
                    maximumFractionDigits: 0,
                  }) || '0 kr'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total verdi
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <MuiCard>
              <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h4" sx={{ color: '#FF9800' }}>
                  {stats.needsService}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Trenger service
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          textColor="inherit"
          sx={{
            '& .MuiTab-root': {
              color: 'text.secondary', '&.Mui-selected': {
                color: professionColor,
              },
            }, '& .MuiTabs-indicator': {
              backgroundColor: professionColor,
            }}}
        >
          <Tab label="Mitt utstyr" icon={<Inventory />} iconPosition="start" />
          <Tab label="Utstyrskatalog" icon={<Search />} iconPosition="start" />
          <Tab
            label={
              <Badge badgeContent={firmwareUpdates.length} color="error">
                {profession === 'music_producer'
                  ? 'Programvare' : 'Firmware'}
              </Badge>
            }
            icon={<Update />}
            iconPosition="start"
          />
          {profession === 'music_producer' && <Tab label="Plugins" icon={<Extension />} iconPosition="start" />}
          <Tab label="Service" icon={<Build />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {/* Tab 0: My Equipment */}
      {activeTab === 0 && (
        <Box>
          {Object.entries(EQUIPMENT_TYPES).map(([type, config]) => {
            const equipmentOfType = getEquipmentsByType(type);
            if (!equipmentOfType.length) return null;

            return (
              <Box key={type} sx={{ mb: 4 }}>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    color: config.color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1}}
                >
                  <config.icon />
                  {config.label} ({equipmentOfType.length})
                </Typography>
                <Grid container spacing={3}>
                  {equipmentOfType.map(renderEquipmentCard)}
                </Grid>
              </Box>
            );
          })}

          {!equipment.length && (
            <Alert severity="info">
              Du har ikke registrert noe utstyr ennå. Gå til "Utstyrskatalog" for å finne og legge til utstyr.
            </Alert>
          )}
        </Box>
      )}

      {/* Tab 1: Equipment Catalog Browser */}
      {activeTab === 1 && (
        <EquipmentCatalogBrowser profession={profession} userId={userId} />
      )}

      {/* Tab 2: Firmware Management */}
      {activeTab === 2 && <FirmwareManagementInterface profession={profession} userId={userId} />}

      {/* Tab 3: Plugins (music_producer only) */}
      {activeTab === 3 && profession === 'music_producer' && (
        <PluginDetectionInterface userId={userId} profession={profession} />
      )}

      {/* Tab 4 (or 3 for non-music_producer): Service */}
      {activeTab === (profession === 'music_producer' ? 4 : 3) && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
            Service & Vedlikehold
          </Typography>
          <Alert severity="info">Service og vedlikeholdsfunksjoner kommer snart.</Alert>
        </Box>
      )}

      {/* Add Equipment Button */}
      <Button
        variant="contained"
        startIcon={<Add />}
        onClick={() => setAddEquipmentOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: professionColor,
          '&:hover': {
            bgcolor: professionColor,
            opacity: 0.9,
          },
        }}
      >
        Legg til utstyr
      </Button>
    </Box>
  );
};

export default EquipmentManagement;
