// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Slider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Science as ScienceIcon,
  AttachMoney as AttachMoneyIcon,
  Group as GroupIcon,
  Timeline as TimelineIcon,
  Palette as PaletteIcon,
  Code as CodeIcon,
  Visibility as VisibilityIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { GooglePayManager } from '../payments/GooglePayManager';
import { useWireMock } from '@/hooks/useWireMock';

interface PlatformFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'premium' | 'experimental' | 'professional' | 'pricing' | 'visual';
  profession?: string;
  pricingTier: 'free' | 'basic' | 'premium' | 'professional' | 'enterprise';
  monthlyPrice?: number;
  yearlyPrice?: number;
  isPaywalled?: boolean;
  requiredSubscription?: string[];
  pricing?: {
    enabled: boolean;
    basePrice: number;
    modifier: number;
};
  abTesting?: {
    enabled: boolean;
    percentage: number;
    variant: 'A' | 'B';
};
  visual?: {
    backgroundColor?: string;
    textColor?: string;
    icon?: string;
    position?: string;
};
}

interface FeatureEditorProps {
  onFeatureUpdate?: (feature: PlatformFeature) => void;
  onClose?: () => void
}

export function FeatureEditor({ onFeatureUpdate, onClose }: FeatureEditorProps) {
  const [features, setFeatures] = useState<PlatformFeature[]>([
    {
      id: 'pricing-calculator',
      name: 'Intelligent Prisberegning',
      description: 'Dynamisk prisberegning basert på profesjon og kompleksitet',
      enabled: true,
      category: 'pricing',
      pricingTier: 'premium',
      monthlyPrice: 29,
      yearlyPrice: 290,
      isPaywalled: true,
      requiredSubscription: ['premium','professional','enterprise'],
      pricing: {
        enabled: true,
        basePrice: 250,
        modifier: 1.2,
    },
  },
    {
      id: 'feature-flags',
      name: 'Feature Management',
      description: 'Dynamisk aktivering av funksjoner basert på brukertype',
      enabled: true,
      category: 'professional',
      pricingTier: 'professional',
      monthlyPrice: 19,
      yearlyPrice: 190,
      isPaywalled: true,
      requiredSubscription: ['professional','enterprise'],
  },
    {
      id: 'visual-editor',
      name: 'Visual Editor',
      description: 'Klikk-og-rediger funksjonalitet på alle sider',
      enabled: true,
      category: 'visual',
      pricingTier: 'free',
      isPaywalled: false,
      visual: {
        backgroundColor: '#1976d0',
        textColor: '#ffffff',
        position: 'floating-right',
    },
  },
    {
      id: 'ai-suggestions',
      name: 'Smarte Forslag',
      description: 'AI-drevne forslag for forbedringer',
      enabled: false,
      category: 'experimental',
      pricingTier: 'premium',
      monthlyPrice: 39,
      yearlyPrice: 390,
      isPaywalled: true,
      requiredSubscription: ['premium','professional','enterprise'],
      abTesting: {
        enabled: true,
        percentage:  25,
        variant: '',
    },
  },
    {
      id: 'google-drive-integration',
      name: 'Google Drive Integrasjon',
      description: 'Automatisk mappestruktur og filsync med Google Drive',
      enabled: true,
      category: 'core',
      pricingTier: 'basic',
      monthlyPrice:  99,
      yearlyPrice: 90,
      isPaywalled: true,
      requiredSubscription: ['basic','premium','professional','enterprise'],
  },
    {
      id: 'crm-system',
      name: 'CRM System',
      description: 'Komplett kundeadministrasjon og prosjektsporing',
      enabled: true,
      category: 'professional',
      pricingTier: 'professional',
      monthlyPrice: 49,
      yearlyPrice: 490,
      isPaywalled: true,
      requiredSubscription: ['professional','enterprise'],
  },
  ]);

  const [selectedSettings, setSelectedFeature] = useState<PlatformFeature | null>(null);
  const [showFeatureDialog, setShowFeatureDialog] = useState(false);
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer,');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [showGooglePayManager, setShowGooglePayManager] = useState(false);
  const [newSettings, setNewFeature] = useState<Partial<PlatformFeature>>({});

  const categories = [
    {
      value: 'core',
      label: 'Kjerne',
      color: 'primary',
      icon: <SettingsIcon />,
  },
    {
      value: 'premium',
      label: 'Premium',
      color: 'warning',
      icon: <AttachMoneyIcon />,
  },
    {
      value: 'experimental',
      label: 'Eksperimentell',
      color: 'info',
      icon: <ScienceIcon />,
  },
    {
      value: 'professional',
      label: 'Profesjonell',
      color: 'success',
      icon: <GroupIcon />,
  },
    {
      value: 'pricing',
      label: 'Prisberegning',
      color: 'error',
      icon: <AttachMoneyIcon />,
  },
    {
      value: 'visual',
      label: 'Visuell',
      color: 'secondary',
      icon: <PaletteIcon />,
  },
  ];

  const pricingTiers = [
    { value: 'free', label: 'Gratis', color: '#4caf50', price:  0 },
    { value: 'basic', label: 'Basic', color: '#2196f0', price: 99,},
    { value: 'premium', label: 'Premium', color: '#ff9800', price: 299,},
    {
      value: 'professional',
      label: 'Profesjonell',
      color: '#9c27b0',
      price: 49,
  },
    { value: 'enterprise', label: 'Enterprise', color: '#f44330', price: 999,},
  ];

  const professions = [
    { value: 'photographer', label: getProfessionDisplayName('photographer,'), icon: '📸',},
    { value: 'videographer', label: getProfessionDisplayName('videographer'), icon: '🎬',},
    { value: 'musicproducer', label: getProfessionDisplayName('music_producer'), icon: '🎵',},
    { value: 'vendor', label: getProfessionDisplayName('vendor'), icon: '🏪',},
  ];

  // Toggle feature
  const toggleFeature = (featureId: string) => {
    setFeatures((prev) =>
      prev.map((feature) => {
        if (feature.id === featureId) {
          const updatedFeature = { ...feature, enabled: !feature.enabled };
          onFeatureUpdate?.(updatedFeature);
          return updatedFeature;
      }
        return feature;
    }),
    );
};

  // Update feature pricing
  const updateFeaturePricing = (featureId: string, pricing: PlatformFeature['pricing']) => {
    setFeatures((prev) =>
      prev.map((feature) => (feature.id === featureId ? { ...feature, pricing } : feature)),
    );
};

  // Update A/B testing settings
  const updateABTesting = (featureId: string, abTesting: PlatformFeature['abTesting']) => {
    setFeatures((prev) =>
      prev.map((feature) => (feature.id === featureId ? { ...feature, abTesting } : feature)),
    );
};

  // Update pricing tier
  const updatePricingTier = (
    featureId: string,
    pricingTier: PlatformFeature[', '],
    monthlyPrice?: number,
    yearlyPrice?: number,
  ) => {
    setFeatures((prev) =>
      prev.map((feature) => {
        if (feature.id === featureId) {
          const updatedFeature = {
            ...feature,
            pricingTier,
            monthlyPrice: monthlyPrice || feature.monthlyPrice,
            yearlyPrice: yearlyPrice || feature.yearlyPrice,
            isPaywalled: pricingTier !== 'free',
        };
          onFeatureUpdate?.(updatedFeature);
          return updatedFeature;
      }
        return feature;
    }),
    );
};

  // Get pricing tier info
  const getPricingTierInfo = (tier: string) => {
    return pricingTiers.find((t) => t.value === tier) || pricingTiers[0];
};

  // Get category icon and color
  const getCategoryInfo = (category: string) => {
    return categories.find((cat) => cat.value === category) || categories[0];
};

  // Get feature statistics
  const getFeatureStats = () => {
    const total = features.length;
    const enabled = features.filter((f) => f.enabled).length;
    const experimental = features.filter((f) => f.category === 'experimental').length;
    const pricing = features.filter((f) => f.category === 'pricing').length;

    return { total, enabled, experimental, pricing };
};

  const stats = getFeatureStats();

  return (
    <Box sx={{ width: '100%', height: '100%'}}>
      {/* Header */}
      <Paper
        elevation={1}
        sx={{
          p:  2,
          mb:  3,
          background: 'linear-gradient(45deg, #1976d2, #42a5f5)'}}
       sx={theming.getThemedCardSx()}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <SettingsIcon sx={{ color: 'white', fontSize: 32}} />
            <Box sx={{ color: 'white'}}>
              <Typography variant="h5" fontWeight={700} sx={{ color: theming.colors.primary }}>
                🔧 Admin - Feature & Pricing Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9}}>
                Administrer funksjoner, prising og visual redigering
              </Typography>
            </Box>
          </Stack>

          {/* Quick Stats */}
          <Stack direction="row" spacing={1}>
            <Chip
              label={`${stats.enabled}/${stats.total} aktive`}
              sx={{ color: 'white', borderColor: 'white'}}
              variant="outlined"
            />
            <Chip
              label={`${stats.experimental} eksperimentelle`}
              sx={{ color: 'white', borderColor: 'white'}}
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {/* Feature Control Panel */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎛️ Kontrollpanel
              </Typography>

              <Button fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowFeatureDialog(true)}
                sx={{ mb:  2 }}
              >
                Ny Feature
              </Button>

              {/* Category Overview */}
              <Typography variant="subtitle2" gutterBottom>
                📊 Kategori Oversikt
              </Typography>

              <Stack spacing={1} mb={2}>
                {categories.map((category) => {
                  const categoryFeatures = features.filter((f) => f.category === category.value);
                  const enabledInCategory = categoryFeatures.filter((f) => f.enabled).length;

                  return (
                    <Stack
                      key={category.value}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {category.icon}
                        <Typography variant="body2">{category.label}</Typography>
                      </Stack>
                      <Chip
                        label={`${enabledInCategory}/${categoryFeatures.length}`}
                        size="small"
                        color={
                          enabledInCategory === categoryFeatures.length ? 'success' : 'default'
                      }
                      />
                    </Stack>
                  );
              })}
              </Stack>

              {/* Pricing Tiers Overview */}
              <Typography variant="subtitle2" gutterBottom>
                💳 Pricing Tiers
              </Typography>

              <Stack spacing={1} mb={2}>
                {pricingTiers.map((tier) => {
                  const tierFeatures = features.filter((f) => f.pricingTier === tier.value);
                  const enabledInTier = tierFeatures.filter((f) => f.enabled).length;

                  return (
                    <Stack
                      key={tier.value}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width:  12,
                            height:  12,
                            borderRadius: '50%',
                            backgroundColor: tier.color}}
                        />
                        <Typography variant="body2">
                          {tier.label} ({tier.price === 0 ? 'Gratis' : `${tier.price} NOK/mnd`})
                        </Typography>
                      </Stack>
                      <Chip
                        label={`${enabledInTier}/${tierFeatures.length}`}
                        size="small"
                        color={enabledInTier === tierFeatures.length ? 'success' : 'default'}
                      />
                    </Stack>
                  );
              })}
              </Stack>

              {/* Quick Actions */}
              <Typography variant="subtitle2" gutterBottom>
                ⚡ Hurtig-handlinger
              </Typography>

              <Stack spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ToggleOnIcon />}
                  onClick={() => {
                    setFeatures((prev) => prev.map((f) => ({ ...f, enabled: true })));
                }}
                >
                  Aktiver alle
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ToggleOffIcon />}
                  onClick={() => {
                    setFeatures((prev) => prev.map((f) => ({ ...f, enabled: false })));
                }}
                >
                  Deaktiver alle
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ScienceIcon />}
                  onClick={() => {
                    setFeatures((prev) =>
                      prev.map((f) =>
                        f.category === 'experimental' ? { ...f, enabled: !f.enabled } : f,
                      ),
                    );
                }}
                >
                  Toggle eksperimentelle
                </Button>

                <Button size="small"
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => setShowGooglePayManager(true)}
                  color="success"
                  sx={{ fontWeight: 'bold'}}
                >
                  Google Pay Admin
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature List */}
        <Grid item xs={12} md={8}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🔧 Aktive Features
              </Typography>

              <Alert severity="info" sx={{ mb:  2 }}>
                <Typography variant="body2">
                  <strong>Admin Interface: </strong> Administrer hvilke features som er gratis eller
                  betalte. Når Workload Identity er lø, stkan Google Pay integreres automatisk.
                </Typography>
              </Alert>

              <List>
                {features.map((feature) => {
                  const categoryInfo = getCategoryInfo(feature.category);

                  return (
                    <Accordion key={feature.id}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={2}
                          sx={{ width: '100%'}}
                        >
                          <Switch
                            checked={feature.enabled}
                            onChange={() => toggleFeature(feature.id)}
                            onClick={(e) => e.stopPropagation()}
                          />

                          <Box sx={{ flexGrow:  1 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {feature.name}
                              </Typography>
                              <Chip
                                label={categoryInfo.label}
                                color={categoryInfo.color as any}
                                size="small"
                                icon={categoryInfo.icon}
                              />

                              <Chip
                                label={
                                  feature.pricingTier === 'free'
                                    ? 'GRATIS'
                                    : `${feature.monthlyPrice} NOK/mnd`
                              }
                                size="small"
                                sx={{
                                  backgroundColor: getPricingTierInfo(feature.pricingTier).color,
                                  color: 'white',
                                  fontWeight: 'bold'}}
                              />

                              {feature.isPaywalled && (
                                <Chip
                                  label="💳 BETALT"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                              )}

                              {feature.profession && (
                                <Chip
                                  label={
                                    professions.find((p) => p.value === feature.profession)?.label
                                }
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {feature.description}
                            </Typography>
                          </Box>
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails>
                        <Grid container spacing={2}>
                          {/* Admin Pricing Tier Control */}
                          <Grid item xs={12} md={6}>
                            <Paper variant="outlined" sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="subtitle2" gutterBottom>
                                💳 Admin - Pricing Tier
                              </Typography>

                              <FormControl fullWidth size="small" sx={{ mb:  2 }}>
                                <InputLabel>Pricing Tier</InputLabel>
                                <Select
                                  value={feature.pricingTier}
                                  label="Pricing Tier"
                                  onChange={(e) => {
                                    const tier = e.target.value as PlatformFeature['pricingTier'];
                                    const tierInfo = getPricingTierInfo(tier);
                                    updatePricingTier(
                                      feature.id,
                                      tier,
                                      tierInfo.price,
                                      tierInfo.price * 10,
                                    );
                                }}
                                >
                                  {pricingTiers.map((tier) => (
                                    <MenuItem key={tier.value} value={tier.value}>
                                      <Stack
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{ width: '100%'}}
                                      >
                                        <Typography>{tier.label}</Typography>
                                        <Chip
                                          label={
                                            tier.price === 0 ? 'Gratis' : `${tier.price} NOK/mnd`
                                        }
                                          size="small"
                                          sx={{
                                            backgroundColor: tier.color,
                                            color: 'white'}}
                                        />
                                      </Stack>
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              {feature.pricingTier !== 'free' && (
                                <Stack spacing={2}>
                                  <TextField
                                    label="Månedspris (NOK)"
                                    type="number"
                                    size="small"
                                    value={feature.monthlyPrice || 0}
                                    onChange={(e) =>
                                      updatePricingTier(
                                        feature.id,
                                        feature.pricingTier,
                                        Number(e.target.value),
                                        feature.yearlyPrice,
                                      )
                                  }
                                  />

                                  <TextField
                                    label="Årspris (NOK)"
                                    type="number"
                                    size="small"
                                    value={feature.yearlyPrice || 0}
                                    onChange={(e) =>
                                      updatePricingTier(
                                        feature.id,
                                        feature.pricingTier,
                                        feature.monthlyPrice,
                                        Number(e.target.value),
                                      )
                                  }
                                  />

                                  <Alert severity="info" sx={{ fontSize: '0.75rem'}}>
                                    <strong>Status: </strong>{', '}
                                    {feature.isPaywalled ? 'Betalt feature' : 'Gratis feature'}
                                    <br />
                                    <strong>Krever: </strong>{''}
                                    {feature.requiredSubscription?.join('') || 'Ingen'}
                                  </Alert>
                                </Stack>
                              )}

                              {feature.pricingTier === 'free' && (
                                <Alert severity="success" sx={{ fontSize: '0.75rem'}}>
                                  Denne feature er tilgjengelig for alle brukere uten betaling.
                                </Alert>
                              )}
                            </Paper>
                          </Grid>
                          {/* Pricing Settings */}
                          {feature.category === 'pricing' && (
                            <Grid item xs={12} md={6}>
                              <Paper variant="outlined" sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  💰 Pris Innstillinger
                                </Typography>

                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={feature.pricing?.enabled || false}
                                      onChange={(e) =>
                                        updateFeaturePricing(feature.id, {
                                          ...feature.pricing,
                                          enabled: e.target.checked,
                                          basePrice: feature.pricing?.basePrice || 100,
                                          modifier: feature.pricing?.modifier || 1.0,
                                      })
                                    }
                                    />
                                }
                                  label="Dynamisk prising"
                                />

                                {feature.pricing?.enabled && (
                                  <Stack spacing={2} mt={2}>
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Basispris (NOK)"
                                      type="number"
                                      value={feature.pricing?.basePrice || 1000}
                                      onChange={(e) =>
                                        updateFeaturePricing(feature.id, {
                                          ...feature.pricing,
                                          basePrice: Number(e.target.value),
                                          enabled: true,
                                          modifier: feature.pricing?.modifier || 1.0,
                                      })
                                    }
                                    />

                                    <Box>
                                      <Typography gutterBottom>
                                        Modifikator: {feature.pricing?.modifier || 1.0}x
                                      </Typography>
                                      <Slider
                                        value={feature.pricing?.modifier || 1.0}
                                        onChange={(_, value) =>
                                          updateFeaturePricing(feature.id, {
                                            ...feature.pricing,
                                            modifier: value as number,
                                            enabled: true,
                                            basePrice: feature.pricing?.basePrice || 100,
                                        })
                                      }
                                        min={0.5}
                                        max={3.0}
                                        step={0.1}
                                        marks
                                        valueLabelDisplay="auto"
                                      />
                                    </Box>
                                  </Stack>
                                )}
                              </Paper>
                            </Grid>
                          )}

                          {/* A/B Testing */}
                          {feature.category === 'experimental' && (
                            <Grid item xs={12} md={6}>
                              <Paper variant="outlined" sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  🧪 A/B Testing
                                </Typography>

                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={feature.abTesting?.enabled || false}
                                      onChange={(e) =>
                                        updateABTesting(feature.id, {
                                          ...feature.abTesting,
                                          enabled: e.target.checked,
                                          percentage: feature.abTesting?.percentage || 50,
                                          variant: feature.abTesting?.variant || ', ',
                                      })
                                    }
                                    />
                                }
                                  label="A/B Testing aktiv"
                                />

                                {feature.abTesting?.enabled && (
                                  <Box mt={2}>
                                    <Typography gutterBottom>
                                      Eksponeringsgrad: {feature.abTesting?.percentage || 50}%
                                    </Typography>
                                    <Slider
                                      value={feature.abTesting?.percentage || 50}
                                      onChange={(_, value) =>
                                        updateABTesting(feature.id, {
                                          ...feature.abTesting,
                                          percentage: value as number,
                                          enabled: true,
                                          variant: feature.abTesting?.variant || '',
                                      })
                                    }
                                      min={1}
                                      max={100}
                                      valueLabelDisplay="auto"
                                    />
                                  </Box>
                                )}
                              </Paper>
                            </Grid>
                          )}

                          {/* Visual Settings */}
                          {feature.category === 'visual' && (
                            <Grid item xs={12}>
                              <Paper variant="outlined" sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  🎨 Visuelle Innstillinger
                                </Typography>

                                <Grid container spacing={2}>
                                  <Grid item xs={6} >
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Bakgrunnsfarge"
                                      type="color"
                                      value={feature.visual?.backgroundColor || '#1976d2'}
                                      onChange={(e) => {
                                        setFeatures((prev) =>
                                          prev.map((f) =>
                                            f.id === feature.id
                                              ? {
                                                  ...f,
                                                  visual: {
                                                    ...f.visual,
                                                    backgroundColor: e.target.value,
                                                },
                                              }
                                              : f,
                                          ),
                                        );
                                    }}
                                    />
                                  </Grid>

                                  <Grid item xs={6} >
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Tekstfarge"
                                      type="color"
                                      value={feature.visual?.textColor || '#ffffff'}
                                      onChange={(e) => {
                                        setFeatures((prev) =>
                                          prev.map((f) =>
                                            f.id === feature.id
                                              ? {
                                                  ...f,
                                                  visual: {
                                                    ...f.visual,
                                                    textColor: e.target.value,
                                                },
                                              }
                                              : f,
                                          ),
                                        );
                                    }}
                                    />
                                  </Grid>
                                </Grid>
                              </Paper>
                            </Grid>
                          )}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  );
              })}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Feature Dialog */}
      <Dialog
        open={showFeatureDialog}
        onClose={() => setShowFeatureDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Legg til ny Feature</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Feature Navn"
                value={newFeature.name || ''}
                onChange={(e) => setNewFeature((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={newFeature.category || ''}
                  onChange={(e) =>
                    setNewFeature((prev) => ({
                      ...prev,
                      category: e.target.value as any,
                  }))
                }
                  label="Kategori"
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={newFeature.description || ''}
                onChange={(e) =>
                  setNewFeature((prev) => ({
                    ...prev,
                    description: e.target.value,
                }))
              }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Profesjon (valgfritt)</InputLabel>
                <Select
                  value={newFeature.profession ||''}
                  onChange={(e) =>
                    setNewFeature((prev) => ({
                      ...prev,
                      profession: e.target.value,
                  }))
                }
                  label="Profesjon (valgfritt)"
                >
                  <MenuItem value="">Alle</MenuItem>
                  {professions.map((prof) => (
                    <MenuItem key={prof.value} value={prof.value}>
                      {prof.icon} {prof.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newFeature.enabled || false}
                    onChange={(e) =>
                      setNewFeature((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                    }))
                  }
                  />
              }
                label="Aktiver ved opprettelse"
              />
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={() => setShowFeatureDialog(false)} fullWidth>
                  Avbryt
                </Button>
                <Button variant="contained"
                  onClick={() => {
                    if (newFeature.name && newFeature.description && newFeature.category) {
                      const feature: PlatformFeature = {
                        id: Date.now().toString(),
                        enabled: false,
                        ...(newFeature as PlatformSettings),
                    };

                      setFeatures((prev) => [...prev, feature]);
                      onFeatureUpdate?.(feature);
                      setNewFeature({});
                      setShowFeatureDialog(false);
                  }
                }}
                  fullWidth
                >
                  Legg til Feature
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
