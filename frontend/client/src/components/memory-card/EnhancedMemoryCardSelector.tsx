/**
 * CreatorHub Norge - Enhanced Memory Card Selector
 * Camera-aware memory card selection with intelligent recommendations
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Stack,
  Tooltip,
  IconButton,
  LinearProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ExpandMore, Security, AutoAwesome, Help, ReadMore, Settings } from '@mui/icons-material';
import { 
  MemoryCardIcon,
  CameraTemplateIcon,
  CameraSetupIcon,
  CameraSettingsIcon,
} from '../shared/CreatorHubIcons';
import type {
  MemoryCardType,
  MemoryCardRecommendation} from '../../data/memory-card-database';
import {
  MemoryCardRecommendationEngine,
  getMemoryCardTypesByProfession,
  getMemoryCardTypesByCamera,
  getMemoryCardTypeById,
  getCameraCompatibility,
  formatCurrency,
  getScandinavianReferences,
} from '../../data/memory-card-database';
import { useTheming } from '../../utils/theming-helper';
import MemoryCardPricingBenefits from './MemoryCardPricingBenefits';
import UpdateFrequencyRecommendations from './UpdateFrequencyRecommendations';

interface SelectedCamera {
  id: string;
  name?: string;
  brand?: string;
  model?: string;
}

interface DiscoveredCameraStatus {
  id: string;
  name: string;
  supportedCardTypes: string[];
  missingCompatibility: boolean;
  isNew: boolean;
}

interface EnhancedMemoryCardSelectorProps {
  selectedCameras: SelectedCamera[];
  projectType: string;
  profession: 'photographer' | 'videographer' | 'both';
  totalDays: number;
  budget?: 'budget' | 'mid' | 'premium' | 'professional';
  onSelectionChange: (selection: MemoryCardSelection) => void;
  initialSelection?: MemoryCardSelection 
}

interface MemoryCardSelection {
  recommendations: MemoryCardRecommendation[];
  customCards: CustomMemoryCard[];
  totalCards: number;
  totalCapacity: string;
  estimatedCost: number;
  backupStrategy: 'none' | 'basic' | 'professional' | 'redundant';
  autoBackup: boolean 
}

interface CustomMemoryCard {
  id: string;
  cardType: MemoryCardType;
  capacity: string;
  quantity: number;
  label: string;
  dayNumber?: number;
  purpose: string 
}

type BackupStrategy = MemoryCardSelection['backupStrategy'];

const EnhancedMemoryCardSelector: React.FC<EnhancedMemoryCardSelectorProps> = ({
  selectedCameras,
  projectType,
  profession,
  totalDays,
  budget = 'mid',
  onSelectionChange,
  initialSelection
}) => {
  const [selection, setSelection] = useState<MemoryCardSelection>(
    initialSelection || {
      recommendations: [],
      customCards: [],
      totalCards: 0,
      totalCapacity: '0GB',
      estimatedCost: 0,
      backupStrategy: 'basic',
      autoBackup: true
  }
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedCardType, setSelectedCardType] = useState<string>('');
  const [customCapacity, setCustomCapacity] = useState<string>('128GB');
  const [customQuantity, setCustomQuantity] = useState<number>(2);
  const [showPricingBenefits, setShowPricingBenefits] = useState(false);
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null);
  const [showPriceSources, setShowPriceSources] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updating' | 'error'>('idle');
  const [priceUpdateInterval, setPriceUpdateInterval] = useState<number | null>(null);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCameraStatus[]>([]);
  const [currencyReferences, setCurrencyReferences] = useState<{
    NOK: string;
    SEK: string;
    DKK: string;
    USD: string;
  } | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);

  // Feature system integration (simplified)
  const isAdvancedFeaturesEnabled = true;
  const isRealTimePricingEnabled = true;
  const isCameraDiscoveryEnabled = true;
  const isAnalyticsEnabled = true;

  // Get intelligent recommendations
  const recommendations = useMemo(() => {
    return MemoryCardRecommendationEngine.getRecommendations(
      selectedCameras,
      projectType,
      profession,
      budget,
      totalDays
    );
}, [selectedCameras, projectType, profession, budget, totalDays]);

  // Get compatible card types
  const compatibleCardTypes = useMemo(() => {
    if (selectedCameras.length === 0) {
      return getMemoryCardTypesByProfession(profession);
  }
    
    const allCompatible = new Set<MemoryCardType>();
    selectedCameras.forEach(camera => {
      const cameraCompatible = getMemoryCardTypesByCamera(camera.id);
      cameraCompatible.forEach((card: MemoryCardType) => allCompatible.add(card));
  });
    
    return Array.from(allCompatible);
}, [selectedCameras, profession]);

  const safeCompatibleCardTypes = useMemo(
    () =>
      compatibleCardTypes.filter(
        (cardType): cardType is MemoryCardType =>
          Boolean(cardType) &&
          typeof cardType.id === 'string' &&
          cardType.id.trim().length > 0 &&
          Array.isArray(cardType.commonCapacities) &&
          cardType.commonCapacities.length > 0
      ),
    [compatibleCardTypes]
  );

  const selectedCardTypeDetails = useMemo(
    () => safeCompatibleCardTypes.find((cardType) => cardType.id === selectedCardType) || null,
    [safeCompatibleCardTypes, selectedCardType]
  );

  const availableCapacities = useMemo(
    () =>
      (selectedCardTypeDetails?.commonCapacities || []).filter(
        (capacity): capacity is string => typeof capacity === 'string' && capacity.trim().length > 0
      ),
    [selectedCardTypeDetails]
  );

  // Get optimal configuration
  const optimalConfig = useMemo(() => {
    return MemoryCardRecommendationEngine.getOptimalConfiguration(selectedCameras, {
      projectType,
      profession,
      totalDays,
      budget
  });
}, [selectedCameras, projectType, profession, totalDays, budget]);

  // Component lifecycle registration (simplified)
  useEffect(() => {
    console.log('EnhancedMemoryCardSelector mounted');
    return () => {
      console.log('EnhancedMemoryCardSelector unmounted');
  };
}, []);

  const parseCapacityToGB = (capacity: string): number => {
    const normalized = capacity.trim().toUpperCase();
    if (normalized.endsWith('TB')) {
      const terabytes = Number.parseFloat(normalized.replace('TB', ''));
      return Number.isFinite(terabytes) ? terabytes * 1024 : 0;
    }
    if (normalized.endsWith('GB')) {
      const gigabytes = Number.parseFloat(normalized.replace('GB', ''));
      return Number.isFinite(gigabytes) ? gigabytes : 0;
    }
    const numericOnly = Number.parseFloat(normalized);
    return Number.isFinite(numericOnly) ? numericOnly : 0;
  };

  const getBaseCost = useCallback((
    cardType: MemoryCardType,
    capacity: string,
    budgetTier: 'budget' | 'mid' | 'premium' | 'professional' = budget
  ): number => {
    const capacityGB = parseCapacityToGB(capacity);
    const pricePerGB = cardType.pricePerGB[budgetTier];
    return Math.round(capacityGB * pricePerGB);
  }, [budget]);

  const recalculateSelectionTotals = useCallback((currentSelection: MemoryCardSelection): MemoryCardSelection => {
    const allCards = [...currentSelection.recommendations, ...currentSelection.customCards];
    const totalCards = allCards.reduce((sum, card) => sum + card.quantity, 0);
    const totalCapacityGB = allCards.reduce(
      (sum, card) => sum + parseCapacityToGB(card.capacity) * card.quantity,
      0
    );
    const estimatedCost = allCards.reduce(
      (sum, card) => sum + getBaseCost(card.cardType, card.capacity) * card.quantity,
      0
    );

    return {
      ...currentSelection,
      totalCards,
      totalCapacity: `${Math.round(totalCapacityGB)}GB`,
      estimatedCost,
    };
  }, [getBaseCost]);

  const updateSelection = useCallback((
    updates:
      | Partial<MemoryCardSelection>
      | ((current: MemoryCardSelection) => Partial<MemoryCardSelection>)
  ) => {
    setSelection((currentSelection) => {
      const patch = typeof updates === 'function' ? updates(currentSelection) : updates;
      const mergedSelection = { ...currentSelection, ...patch };
      return recalculateSelectionTotals(mergedSelection);
    });
  }, [recalculateSelectionTotals]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onSelectionChangeRef.current(selection);
  }, [selection]);

  // Camera discovery integration based on selected cameras and compatibility matrix.
  useEffect(() => {
    const knownCamerasStorageKey = 'creatorhub-known-camera-ids';
    const knownCameraIds = new Set<string>();

    try {
      const stored = localStorage.getItem(knownCamerasStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'string' && id.trim().length > 0) {
            knownCameraIds.add(id.trim());
          }
        });
      }
    } catch {
      // Ignore malformed persisted camera state.
    }

    const nextKnownCameraIds = new Set(knownCameraIds);
    const discovered = selectedCameras
      .filter((camera) => typeof camera?.id === 'string' && camera.id.trim().length > 0)
      .map((camera) => {
        const cameraId = camera.id.trim();
        const compatibility = getCameraCompatibility(cameraId);
        const supportedCardTypes = compatibility?.supportedCardTypes ?? [];
        const isNew = !knownCameraIds.has(cameraId);
        nextKnownCameraIds.add(cameraId);

        return {
          id: cameraId,
          name:
            camera.name ||
            [camera.brand, camera.model].filter((value): value is string => Boolean(value)).join(' ') ||
            cameraId,
          supportedCardTypes,
          missingCompatibility: supportedCardTypes.length === 0,
          isNew,
        };
      });

    setDiscoveredCameras(discovered);

    try {
      localStorage.setItem(
        knownCamerasStorageKey,
        JSON.stringify(Array.from(nextKnownCameraIds.values()))
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [selectedCameras]);

  // Periodically re-evaluate pricing using the active card mix and budget tier.
  useEffect(() => {
    if (!isRealTimePricingEnabled) {
      setLastUpdated(new Date());
      return;
    }

    const refreshPricing = () => {
      setUpdateStatus('updating');
      try {
        updateSelection(() => ({}));
        setLastUpdated(new Date());
        setUpdateStatus('idle');
        if (isAnalyticsEnabled) {
          console.log('Price update completed');
        }
      } catch (error) {
        setUpdateStatus('error');
        console.error('Price update failed:', error);
      }
    };

    refreshPricing();
    const intervalId = window.setInterval(refreshPricing, 30 * 60 * 1000);
    setPriceUpdateInterval(intervalId);

    return () => {
      window.clearInterval(intervalId);
      setPriceUpdateInterval(null);
    };
}, [isRealTimePricingEnabled, isAnalyticsEnabled, updateSelection]);

  useEffect(() => {
    let isActive = true;

    const loadCurrencyReferences = async () => {
      if (selection.estimatedCost <= 0) {
        if (isActive) {
          setCurrencyReferences(null);
        }
        return;
      }

      try {
        const references = await getScandinavianReferences(selection.estimatedCost);
        if (isActive) {
          setCurrencyReferences(references);
        }
      } catch (error) {
        console.error('Failed to fetch Scandinavian price references:', error);
        if (isActive) {
          setCurrencyReferences(null);
        }
      }
    };

    loadCurrencyReferences();
    return () => {
      isActive = false;
    };
  }, [selection.estimatedCost]);

  // Update selection when recommendations change
  useEffect(() => {
    if (recommendations.length === 0 || selection.recommendations.length > 0) {
      return;
    }

    const essentialRecommendations = recommendations.filter((rec) => rec.priority === 'essential');
    const recommendationSeed =
      essentialRecommendations.length > 0 ? essentialRecommendations : recommendations.slice(0, 1);

    updateSelection({
      recommendations: recommendationSeed,
      totalCards: optimalConfig.totalCards,
      totalCapacity: optimalConfig.totalCapacity,
      estimatedCost: optimalConfig.estimatedCost,
    });

    if (isAnalyticsEnabled) {
      console.log('Memory card recommendation generated:', recommendations.length);
    }
  }, [
    recommendations,
    selection.recommendations.length,
    optimalConfig,
    isAnalyticsEnabled,
    updateSelection,
  ]);

  useEffect(() => {
    if (safeCompatibleCardTypes.length === 0) {
      if (selectedCardType !== '') setSelectedCardType('');
      return;
    }

    const isCurrentCardTypeValid = safeCompatibleCardTypes.some(
      (cardType) => cardType.id === selectedCardType
    );
    if (!isCurrentCardTypeValid) {
      setSelectedCardType(safeCompatibleCardTypes[0].id);
    }
  }, [safeCompatibleCardTypes, selectedCardType]);

  useEffect(() => {
    if (availableCapacities.length === 0) {
      if (customCapacity !== '') setCustomCapacity('');
      return;
    }
    if (!availableCapacities.includes(customCapacity)) {
      setCustomCapacity(availableCapacities[0]);
    }
  }, [availableCapacities, customCapacity]);

  useEffect(() => {
    const validQuantities = [1, 2, 4, 8, 16];
    if (!validQuantities.includes(customQuantity)) {
      setCustomQuantity(2);
    }
  }, [customQuantity]);

  const handleRecommendationToggle = (recommendation: MemoryCardRecommendation, enabled: boolean) => {
    const startTime = performance.now();

    updateSelection((currentSelection) => {
      const isAlreadySelected = currentSelection.recommendations.some(
        (rec) => rec.cardType.id === recommendation.cardType.id
      );

      if (enabled && isAlreadySelected) {
        return {};
      }

      const newRecommendations = enabled
        ? [...currentSelection.recommendations, recommendation]
        : currentSelection.recommendations.filter(
            (rec) => rec.cardType.id !== recommendation.cardType.id
          );

      return { recommendations: newRecommendations };
    });
    
    // Track user interaction
    console.log('Memory card recommendation toggled:', recommendation.cardType.id, enabled);
    
    const endTime = performance.now();
    console.log(`Recommendation toggle took ${endTime - startTime}ms`);
};

  const handleCustomCardAdd = () => {
    if (!selectedCardType) return;
    
    const cardType = selectedCardTypeDetails || getMemoryCardTypeById(selectedCardType);
    if (!cardType) return;

    const newCustomCard: CustomMemoryCard = {
      id: `custom-${Date.now()}`,
      cardType,
      capacity: customCapacity,
      quantity: customQuantity,
      label: `${cardType.name} ${customCapacity}`,
      purpose: 'Custom configuration'
  };

    updateSelection((currentSelection) => ({
      customCards: [...currentSelection.customCards, newCustomCard],
    }));
    
    // Reset form
    setSelectedCardType('');
    setCustomCapacity((cardType.commonCapacities && cardType.commonCapacities[0]) || '128GB');
    setCustomQuantity(2);
};

  const handleCustomCardRemove = (cardId: string) => {
    updateSelection((currentSelection) => ({
      customCards: currentSelection.customCards.filter((card) => card.id !== cardId),
    }));
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'essential': return 'error';
      case 'recommended': return 'warning';
      case 'optional': return 'info';
      default: return 'default';
  }
};

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'essential': return theming.getThemedIcon('checkCircle','photographer','primary') as React.ReactElement;
      case 'recommended': return theming.getThemedIcon('warning','photographer','primary') as React.ReactElement;
      case 'optional': return theming.getThemedIcon('info','photographer','primary') as React.ReactElement;
      default: return theming.getThemedIcon('info','photographer','primary') as React.ReactElement;
  }
};

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <MemoryCardIcon sx={{ color: theming.colors.primary }} />
        Intelligent Memory Card Selection
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        AI-powered recommendations based on your selected cameras, project type, and profession.
      </Typography>

      {/* Last Updated Indicator */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {lastUpdated ? 
              `Sist oppdatert: ${lastUpdated.toLocaleString('no-NO')}` : 
              'Priser oppdateres automatisk...'
          }
          </Typography>
          {updateStatus === 'updating' && (
            <LinearProgress sx={{ width: 100, height: 4 }} />
          )}
          {updateStatus === 'error' && (
            <Chip 
              label="Oppdateringsfeil" 
              color="error" 
              size="small" 
              icon={theming.getThemedIcon('warning','photographer','primary') as React.ReactElement}
            />
          )}
          {/* Feature indicators */}
                  {isRealTimePricingEnabled && (
                    <Chip 
                      label="Real-time Pricing" 
                      color="success" 
                      size="small" 
                      icon={theming.getThemedIcon('trendingUp','photographer','primary') as React.ReactElement}
                    />
                  )}
                  {priceUpdateInterval && (
                    <Chip
                      label="Auto update: 30m"
                      color="default"
                      size="small"
                    />
                  )}
          {isCameraDiscoveryEnabled && (
            <Chip 
              label="Camera Discovery" 
              color="info" 
              size="small" 
              icon={<CameraTemplateIcon />}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<ReadMore />}
            onClick={() => setShowPricingBenefits(true)}
          >
            Les mer om priser
          </Button>
          <Button
            size="small"
            startIcon={theming.getThemedIcon('assessment','photographer','primary')}
            onClick={() => setShowPriceSources(true)}
          >
            Priskilder
          </Button>
        </Box>
      </Box>

      {/* Camera Compatibility Alert */}
      {selectedCameras.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Camera Compatibility: </strong> Analyzing {selectedCameras.length} selected camera(s) for optimal memory card recommendations.
          </Typography>
        </Alert>
      )}

      {/* Camera Discovery Status */}
      {isCameraDiscoveryEnabled && discoveredCameras.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Camera Discovery Active: </strong> {discoveredCameras.length} cameras discovered, 
            {discoveredCameras.filter(c => c.isNew).length} new cameras available.
          </Typography>
        </Alert>
      )}

      {isAdvancedFeaturesEnabled && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Tooltip title="Vis detaljert kompatibilitet og oppdagede kamera-profiler">
            <Help fontSize="small" color="action" />
          </Tooltip>
          <Button
            size="small"
            startIcon={<Settings />}
            onClick={() => setShowAdvanced((previous) => !previous)}
          >
            {showAdvanced ? 'Skjul avansert visning' : 'Vis avansert visning'}
          </Button>
        </Box>
      )}

      {showAdvanced && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default', ...theming.getThemedCardSx() }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: theming.colors.primary }}>
            Avansert kompatibilitetsoversikt
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`Valgte kameraer: ${selectedCameras.length}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`Støttede korttyper: ${safeCompatibleCardTypes.length}`}
              size="small"
              color="info"
              variant="outlined"
            />
            <Chip
              label={`Uten profil: ${discoveredCameras.filter((camera) => camera.missingCompatibility).length}`}
              size="small"
              color={
                discoveredCameras.some((camera) => camera.missingCompatibility) ? 'warning' : 'success'
              }
              variant="outlined"
            />
          </Stack>
          {discoveredCameras.length > 0 && (
            <List dense>
              {discoveredCameras.map((camera) => (
                <ListItem key={camera.id} divider>
                  <ListItemText
                    primary={camera.name}
                    secondary={
                      camera.missingCompatibility
                        ? 'Ingen kompatibilitetsprofil funnet ennå'
                        : `Kortstøtte: ${camera.supportedCardTypes.join(', ')}`
                    }
                  />
                  {camera.isNew && <Chip label="Ny" size="small" color="success" />}
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* Optimal Configuration Summary */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: theming.colors.primary, border: `2px solid ${theming.colors.accent}`, ...theming.getThemedCardSx() }}>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CameraSetupIcon sx={{ color: theming.colors.primary }} />
          Optimal Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2">
              <strong>Total Cards: </strong> {optimalConfig.totalCards}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2">
              <strong>Total Capacity: </strong> {optimalConfig.totalCapacity}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2">
              <strong>Estimated Cost: </strong> ${optimalConfig.estimatedCost}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Intelligent Recommendations */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore','photographer','primary') as React.ReactElement}>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <AutoAwesome sx={{ color: theming.colors.primary }} />
            AI Recommendations ({recommendations.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {recommendations.map((recommendation, index) => (
              <Card key={index} variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                        <MemoryCardIcon sx={{ color: theming.colors.primary }} /> {recommendation.cardType.fullName}
                        <Chip
                          icon={getPriorityIcon(recommendation.priority)}
                          label={recommendation.priority}
                          color={getPriorityColor(recommendation.priority)}
                          size="small"
                        />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {recommendation.cardType.description}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                        {recommendation.scandinavianReferences.NOK}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {recommendation.quantity}x {recommendation.capacity}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        🇸🇪 {recommendation.scandinavianReferences.SEK} | 
                        🇩🇰 {recommendation.scandinavianReferences.DKK}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Reasoning: </strong> {recommendation.reasoning}
                  </Typography>

                  <Button
                    size="small"
                    endIcon={
                      <ExpandMore
                        sx={{
                          transform:
                            expandedRecommendation === recommendation.cardType.id
                              ? 'rotate(180deg)'
                              : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    }
                    onClick={() =>
                      setExpandedRecommendation((current) =>
                        current === recommendation.cardType.id ? null : recommendation.cardType.id
                      )
                    }
                    sx={{ mb: 1 }}
                  >
                    {expandedRecommendation === recommendation.cardType.id
                      ? 'Skjul detaljer'
                      : 'Vis detaljer'}
                  </Button>

                  {expandedRecommendation === recommendation.cardType.id && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Anbefalt for:
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {recommendation.cardType.recommendedFor.map((useCase) => (
                          <Chip key={useCase} label={useCase} size="small" />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      icon={theming.getThemedIcon('speed','photographer','primary') as React.ReactElement}
                      label={`${recommendation.cardType.readSpeed}MB/s read`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      icon={theming.getThemedIcon('storage','photographer','primary') as React.ReactElement}
                      label={`${recommendation.cardType.writeSpeed}MB/s write`}
                      size="small"
                      variant="outlined"
                    />
                    {recommendation.cardType.videoClass && (
                      <Chip
                        label={`Class ${recommendation.cardType.videoClass}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    <Chip
                      label={recommendation.cardType.reliability}
                      size="small"
                      color={recommendation.cardType.reliability === 'professional' ? 'success' : 'default'}
                    />
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={selection.recommendations.some(rec => rec.cardType.id === recommendation.cardType.id)}
                        onChange={(e) => handleRecommendationToggle(recommendation, e.target.checked)}
                      />
                  }
                    label="Include in selection"
                  />
                </CardContent>
              </Card>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Custom Configuration */}
      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore','photographer','primary') as React.ReactElement}>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <CameraSettingsIcon sx={{ color: theming.colors.primary }} />
            Custom Configuration
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Card Type</InputLabel>
                <Select
                  value={
                    safeCompatibleCardTypes.some((cardType) => cardType.id === selectedCardType)
                      ? selectedCardType
                      : ''
                  }
                  onChange={(e) => setSelectedCardType(e.target.value)}
                >
                  {safeCompatibleCardTypes.length === 0 && (
                    <MenuItem value="" disabled>
                      Ingen kompatible korttyper
                    </MenuItem>
                  )}
                  {safeCompatibleCardTypes.map((cardType: MemoryCardType) => (
                    <MenuItem key={cardType.id} value={cardType.id}>
                      {cardType.icon} {cardType.fullName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Capacity</InputLabel>
                <Select
                  value={availableCapacities.includes(customCapacity) ? customCapacity : ''}
                  onChange={(e) => setCustomCapacity(e.target.value)}
                >
                  {availableCapacities.length === 0 ? (
                    <MenuItem value="" disabled>
                      Velg korttype først
                    </MenuItem>
                  ) : (
                    availableCapacities.map((capacity: string) => (
                      <MenuItem key={capacity} value={capacity}>
                        {capacity}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Quantity</InputLabel>
                <Select
                  value={String(customQuantity)}
                  onChange={(e) => setCustomQuantity(Number(e.target.value))}
                >
                  {[1, 2, 4, 8, 16].map((qty) => (
                    <MenuItem key={qty} value={String(qty)}>
                      {qty}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          <Button variant="contained"
            onClick={handleCustomCardAdd}
            disabled={!selectedCardType}
            startIcon={<MemoryCardIcon  sx={theming.getThemedButtonSx()} />}
            sx={{ 
              bgcolor: theming.colors.primary, '&:hover': { bgcolor: theming.colors.accent }
          }}
          >
            Add Custom Card
          </Button>

          {/* Custom Cards List */}
          {selection.customCards.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Custom Cards ({selection.customCards.length})
              </Typography>
              <List>
                {selection.customCards.map((card) => (
                  <ListItem key={card.id} divider>
                    <ListItemIcon>
                      <MemoryCardIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${card.cardType.fullName} ${card.capacity} x${card.quantity}`}
                      secondary={`Purpose: ${card.purpose} | Cost: NOK ${getBaseCost(card.cardType, card.capacity, budget) * card.quantity}`}
                    />
                    <IconButton
                      onClick={() => handleCustomCardRemove(card.id)}
                      color="error"
                    >
                      {theming.getThemedIcon('delete','photographer', 'primary')}
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Backup Strategy */}
      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore', 'photographer', 'primary') as React.ReactElement}>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <Security sx={{ color: theming.colors.primary }} />
            Backup Strategy
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Backup Strategy</InputLabel>
                <Select
                  value={selection.backupStrategy}
                  onChange={(e) => updateSelection({ backupStrategy: e.target.value as BackupStrategy })}
                >
                  <MenuItem value="none">No Backup</MenuItem>
                  <MenuItem value="basic">Basic (1 backup)</MenuItem>
                  <MenuItem value="professional">Professional (2 backups)</MenuItem>
                  <MenuItem value="redundant">Redundant (3+ backups)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selection.autoBackup}
                    onChange={(e) => updateSelection({ autoBackup: e.target.checked })}
                  />
              }
                label="Auto Backup"
              />
            </Grid>
          </Grid>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Recommended: </strong> Professional backup strategy with 2 copies for wedding and commercial projects.
            </Typography>
          </Alert>
        </AccordionDetails>
      </Accordion>

      {/* Selection Summary */}
      <Paper sx={{ p: 2, mt: 2, bgcolor:'grey.50', ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Selection Summary
        </Typography>
        <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
            <Typography variant="body2">
              <strong>Total Cards: </strong> {selection.totalCards}
            </Typography>
          </Grid>
            <Grid item xs={12} sm={3}>
            <Typography variant="body2">
              <strong>Total Capacity: </strong> {selection.totalCapacity}
            </Typography>
          </Grid>
            <Grid item xs={12} sm={3}>
            <Typography variant="body2">
              <strong>Estimated Cost: </strong>{' '}
              {currencyReferences?.NOK || formatCurrency(selection.estimatedCost, 'NOK')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              🇸🇪 {currencyReferences?.SEK || '-'} | 🇩🇰 {currencyReferences?.DKK || '-'}
            </Typography>
          </Grid>
            <Grid item xs={12} sm={3}>
            <Typography variant="body2">
              <strong>Backup Strategy: </strong> {selection.backupStrategy}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Pricing Benefits Dialog */}
      <Dialog open={showPricingBenefits} onClose={() => setShowPricingBenefits(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Hvorfor Minneskortpriser er Nyttige
        </DialogTitle>
        <DialogContent>
          <MemoryCardPricingBenefits showAsDialog={false} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPricingBenefits(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Update Frequency Recommendations Dialog */}
      <Dialog open={showPriceSources} onClose={() => setShowPriceSources(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Oppdateringsfrekvens og Priskilder
        </DialogTitle>
        <DialogContent>
          <UpdateFrequencyRecommendations />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPriceSources(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnhancedMemoryCardSelector;
