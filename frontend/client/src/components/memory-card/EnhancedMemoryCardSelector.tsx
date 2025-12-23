/**
 * CreatorHub Norge - Enhanced Memory Card Selector
 * Camera-aware memory card selection with intelligent recommendations
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Divider,
  Paper,
  Stack,
  Tooltip,
  IconButton,
  Badge,
  LinearProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Memory,
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Speed,
  Storage,
  Security,
  PriceCheck,
  CameraAlt,
  Videocam,
  AutoAwesome,
  Refresh,
  Help,
  ReadMore,
  TrendingUp,
  TrendingDown,
  Business,
  Assessment,
  Settings,
  Delete,
} from '@mui/icons-material';
import { 
  CREATOR_HUB_ICONS,
  MemoryCardIcon,
  CameraTemplateIcon,
  CameraSetupIcon,
  WorkflowIcon,
  TemplateManagerIcon,
  CameraGearIcon,
  LensIcon,
  TripodIcon,
  GimbalIcon,
  LightingIcon,
  CameraSettingsIcon,
  VideoSettingsIcon,
  PhotoSettingsIcon,
  TemplateCategoryIcon,
  TemplateShareIcon,
  TemplateImportIcon,
  TemplateExportIcon,
  TemplateSearchIcon,
  TemplateFilterIcon,
  TemplateRatingIcon,
  TemplateUsageIcon
} from '../shared/CreatorHubIcons';
import {
  MemoryCardRecommendationEngine,
  getMemoryCardTypesByProfession,
  getMemoryCardTypesByCamera,
  getMemoryCardTypeById,
  getCameraCompatibility,
  MemoryCardType,
  MemoryCardRecommendation,
  formatCurrency,
  convertCurrency,
  getScandinavianReferences,
} from '../../data/memory-card-database';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import MemoryCardPricingBenefits from './MemoryCardPricingBenefits';
import UpdateFrequencyRecommendations from './UpdateFrequencyRecommendations';

interface EnhancedMemoryCardSelectorProps {
  selectedCameras: any[];
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

const EnhancedMemoryCardSelector: React.FC<EnhancedMemoryCardSelectorProps> = ({
  selectedCameras,
  projectType,
  profession,
  totalDays,
  budget = 'mid',
  onSelectionChange,
  initialSelection
}) => {
  const { 
    integration, 
    communication, 
    dataFlow, 
    componentRegistry
} = useEnhancedMasterIntegration();
  
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
  const [priceUpdateInterval, setPriceUpdateInterval] = useState<NodeJS.Timeout | null>(null);
  const [discoveredCameras, setDiscoveredCameras] = useState<any[]>([]);

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
    console.log('EnhancedMemoryCardSelector mounted, ');
    return () => {
      console.log('EnhancedMemoryCardSelector unmounted, ');
  };
}, []);

  // Camera discovery integration (simplified for now)
  useEffect(() => {
    // For now, we'll use a simplified approach without camera discovery
    // This can be enhanced later when the integration system is fully implemented
    setDiscoveredCameras([]);
    console.log('Camera discovery integration placeholder, ');
}, []);

  // Real-time price updates (only if feature is enabled)
  useEffect(() => {
    if (!isRealTimePricingEnabled) {
      setLastUpdated(new Date()); // Set initial timestamp
      return;
  }

    const updatePrices = async () => {
      setUpdateStatus('updating');
      try {
        // Simulate price update - in real implementation, this would call price service
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLastUpdated(new Date());
        setUpdateStatus('idle');
        
        if (isAnalyticsEnabled) {
          console.log('Price update completed');
      }
    } catch (error) {
        setUpdateStatus('error');
        console.error('Price update failed: ', error);
        if (isAnalyticsEnabled) {
          console.log('Price update failed');
      }
    }
  };

    // Start price updates every 30 minutes (frequent frequency)
    const interval = setInterval(updatePrices, 30 * 60 * 1000);
    setPriceUpdateInterval(interval);

    // Initial price update
    updatePrices();

    return () => {
      if (interval) clearInterval(interval);
  };
}, [isRealTimePricingEnabled, isAnalyticsEnabled]);

  // Update selection when recommendations change
  useEffect(() => {
    if (recommendations.length > 0 && selection.recommendations.length === 0) {
      const newSelection = {
        ...selection,
        recommendations: recommendations.filter(rec => rec.priority === 'essential'),
        totalCards: optimalConfig.totalCards,
        totalCapacity: optimalConfig.totalCapacity,
        estimatedCost: optimalConfig.estimatedCost
    };
      setSelection(newSelection);
      onSelectionChange(newSelection);
      
      // Track feature usage
      console.log('Memory card recommendation generated:', recommendations.length);
  }
}, [recommendations, optimalConfig, projectType, profession, budget]);

  const handleRecommendationToggle = (recommendation: MemoryCardRecommendation, enabled: boolean) => {
    const startTime = performance.now();
    
    const newRecommendations = enabled
      ? [...selection.recommendations, recommendation]
      : selection.recommendations.filter(rec => rec.cardType.id !== recommendation.cardType.id);
    
    updateSelection({ recommendations: newRecommendations });
    
    // Track user interaction
    console.log('Memory card recommendation toggled:', recommendation.cardType.id, enabled);
    
    const endTime = performance.now();
    console.log(`Recommendation toggle took ${endTime - startTime}ms`);
};

  const handleCustomCardAdd = () => {
    if (!selectedCardType) return;
    
    const cardType = getMemoryCardTypeById(selectedCardType);
    if (!cardType) return;

    const newCustomCard: CustomMemoryCard = {
      id: `custom-${Date.now()}`,
      cardType,
      capacity: customCapacity,
      quantity: customQuantity,
      label: `${cardType.name} ${customCapacity}`,
      purpose: 'Custom configuration'
  };

    const newCustomCards = [...selection.customCards, newCustomCard];
    updateSelection({ customCards: newCustomCards });
    
    // Reset form
    setSelectedCardType('');
    setCustomCapacity('128GB');
    setCustomQuantity(2);
};

  const handleCustomCardRemove = (cardId: string) => {
    const newCustomCards = selection.customCards.filter(card => card.id !== cardId);
    updateSelection({ customCards: newCustomCards });
};

  const updateSelection = (updates: Partial<MemoryCardSelection>) => {
    const newSelection = { ...selection, ...updates };
    
    // Recalculate totals
    const allCards = [...newSelection.recommendations, ...newSelection.customCards];
    const totalCards = allCards.reduce((sum, card) => sum + card.quantity, 0);
    const totalCapacityGB = allCards.reduce((sum, card) => {
      const capacityGB = parseInt(card.capacity.replace('GB',', '));
      return sum + (capacityGB * card.quantity);
  }, 0);
    const totalCapacity = `${totalCapacityGB}GB`;
    const estimatedCost = allCards.reduce((sum, card) => {
      const baseCost = getBaseCost(card.cardType, card.capacity);
      return sum + (baseCost * card.quantity);
  }, 0);

    const finalSelection = {
      ...newSelection,
      totalCards,
      totalCapacity,
      estimatedCost
  };

    setSelection(finalSelection);
    onSelectionChange(finalSelection);
};

  const getBaseCost = (cardType: MemoryCardType, capacity: string, budget: string = 'mid'): number => {
    const capacityGB = parseInt(capacity.replace('GB', ', '));
    const pricePerGB = cardType.pricePerGB[budget as keyof typeof cardType.pricePerGB];
    return Math.round(capacityGB * pricePerGB);
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
                  value={selectedCardType}
                  onChange={(e) => setSelectedCardType(e.target.value)}
                >
                  {compatibleCardTypes.map((cardType: MemoryCardType) => (
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
                  value={customCapacity}
                  onChange={(e) => setCustomCapacity(e.target.value)}
                >
                  {selectedCardType && getMemoryCardTypeById(selectedCardType)?.commonCapacities.map((capacity: string) => (
                    <MenuItem key={capacity} value={capacity}>
                      {capacity}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Quantity</InputLabel>
                <Select
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(Number(e.target.value))}
                >
                  {[1358, 10].map((qty) => (
                    <MenuItem key={qty} value={qty}>
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
                  onChange={(e) => updateSelection({ backupStrategy: e.target.value as any })}
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
              <strong>Estimated Cost: </strong> NOK {selection.estimatedCost.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              🇸🇪 SEK {Math.round(selection.estimatedCost * 0.9).toLocaleString()} | 
              🇩🇰 DKK {Math.round(selection.estimatedCost * 0.7).toLocaleString()}
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
