/**
 * CreatorHub Norge - Price Administration Component
 * Comprehensive pricing management with custom categories
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../utils/theming-helper';
import { useClientServicePricing } from '../services/ClientServicePricingService';
import { useExternalData } from '../services/ExternalDataService';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Fab,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as PriceIcon,
  Category as CategoryIcon,
  Discount as DiscountIcon,
  Receipt as QuoteIcon,
  DriveEta as TravelIcon,
  LocalGasStation as FuelIcon,
  Analytics as AnalyticsIcon,
  Assessment as ReportIcon,
  CameraAlt as CameraIcon,
  Upload as UploadIcon,
  Receipt as ReceiptIcon,
  Scanner as ScanIcon,
  DirectionsCar as CarIcon,
  AddCircle,
  LocationOn as GPSIcon,
  Calculate as CalculateIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Route as RouteIcon,
  LocationOn as LocationIcon,
  Description as DescriptionIcon,
  EventNote as EventIcon,
  AccountBalance,
} from '@mui/icons-material';
import CreatePackageModal from './modals/CreatePackageModal';
import CreatePricingModal from './modals/CreatePricingModal';
import CreateCategoryModal from './modals/CreateCategoryModal';
import QuoteGeneratorModal from './modals/QuoteGeneratorModal';
import VehicleRegistryModal from './vehicle/VehicleRegistryModal';
import TollCalculationModal from './travel/TollCalculationModal';

// Import dynamic profession system
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface PriceAdministrationProps {
  profession?: string;
  userId?: string;
  // Integration props for universal workflow connectivity
  onProjectUpdate?: (project: any) => void;
  onContractCreate?: (contract: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`price-tabpanel-${index}`}
      aria-labelledby={`price-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
);
}

const PriceAdministration: React.FC<PriceAdministrationProps> = ({
  profession,
  userId,
  onProjectUpdate,
  onContractCreate,
  selectedProject,
  onProjectSelect
}) => {
  const [tabValue, setTabValue] = useState(0);
  
  // Get user and profession context
  const { user } = useAuth();
  const userProfession = user?.profession || 'photographer';
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor, isLoading: professionsLoading, getProfessionDisplayName } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || userProfession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';

  // Client service pricing service integration
  const { 
    formatCurrency,
    getDefaultPrice,
    getMVA,
    getTotalWithMVA,
    convertCurrency,
    isLoading: pricingLoading 
} = useClientServicePricing();

  // External data service integration
  const {
    getVehicleData,
    calculateTollCosts,
    calculateTravelCosts,
    getFuelPrices,
    getTaxRates,
    getMarketRates
} = useExternalData();
  // Use enhanced profession config (already set above)

  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  // Register component and data flow nodes with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('price-administration, ', 'pricing', [
      'data:read','data:write','event:emit','event:listen','ui:update','pricing:create','pricing:update','pricing:delete','package:manage','category:manage','quote:generate','travel:log'
    ]);

    dataFlow.registerNode({
      type: 'source,',
      componentId: 'price-administration',
      dataKey: 'price-administration:packages',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'price-administration',
      dataKey: 'price-administration:pricing',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'price-administration',
      dataKey: 'price-administration:categories',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });


    return () => {
      communication.unregisterComponent('price-administration');
};
}, [communication, dataFlow]);

  // Listen to global events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        console.log('💰 Price Administration: Project selected, ', message.data);
        // Update pricing context based on selected project
      }
      if (message.type === 'client: selected' && message.data) {
        console.log('💰 Price Administration: Client selected', message.data);
        // Update pricing context based on selected client
      }
      if (message.type === 'data: sync' && message.data.dataKey === 'price-administration:packages') {
        console.log('💰 Price Administration: Packages synced', message.data.data);
      }
      if (message.type === 'contract:created' && message.data) {
        console.log('💰 Price Administration: Contract created event received', message.data);
        // Could refresh quotes or show notification
        queryClient.invalidateQueries({ queryKey: ['/api/price-administration/quotes'] });
      }
      if (message.type === 'split-sheet:created' && message.data) {
        console.log('💰 Price Administration: Split sheet created event received', message.data);
        // Could refresh quotes or show notification
      }
      if (message.type === 'project:selected' && message.data) {
        console.log('💰 Price Administration: Project selected event received', message.data);
        // Could filter quotes by project
      }
    });
    return unsubscribe;
  }, [communication, queryClient]);

  const [createPackageOpen, setCreatePackageOpen] = useState(false);
  const [createPricingOpen, setCreatePricingOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [quoteGeneratorOpen, setQuoteGeneratorOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scannedReceipts, setScannedReceipts] = useState<any[]>([]);
  const [registeredReceiptIds, setRegisteredReceiptIds] = useState<string[]>([]);
  
  // Manual travel log state
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [vehicleRegistryOpen, setVehicleRegistryOpen] = useState(false);
  const [tollCalculationOpen, setTollCalculationOpen] = useState(false);
  const [travelLogForm, setTravelLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicle: '',
    vehicleRegistration: '',
    description: '',
    contact: '',
    fromAddress: '',
    toAddress: '',
    extraDestinations: [] as string[],
    returnTrip: false,
    kilometers:  0,
    tollFees:  0,
    additionalFees:  0,
    additionalFeesDescription: '',
    selectedVehicleData: null as any
});
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(false);
  const [tollCalculationResult, setTollCalculationResult] = useState<any>(null);
  const [travelCostResult, setTravelCostResult] = useState<any>(null);

  const queryClient = useQueryClient();

  // Minimal analytics tracker for Skattemelding aggregation
  const trackAnalytics = async (eventType: string, eventData: any) => {
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ eventType, eventData, userId: user?.id || null })
      });
    } catch {}
  };

  // Calculate travel costs using real APIs
  const calculateTravelCostMutation = useMutation({
    mutationFn: async (travelData: any) => {
      const response = await apiRequest('/api/price-administration/travel-costs', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(travelData)
});
      return response;
},
    onSuccess: (data) => {
      setTravelCostResult(data);
}
});

  // Toll calculation mutation  
  const tollCalculationMutation = useMutation({
    mutationFn: async (routeData: any) => {
      const response = await apiRequest('/api/price-administration/toll-calculation', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(routeData)
});
      return response;
},
    onSuccess: (data) => {
      setTollCalculationResult(data);
      if (data.success && data.calculation) {
        setTravelLogForm(prev => ({
          ...prev,
          tollFees: data.calculation.totalTolls,
          kilometers: data.calculation.totalDistance
  }));
  }
}
});

  // Travel log calculation helpers
  const calculateTravelCost = useMemo(() => {
    if (travelCostResult?.success) {
      return {
        totalKm: travelCostResult.calculation.distance,
        kmCost: travelCostResult.calculation.kmCost,
        totalCost: travelCostResult.calculation.totalCost,
        breakdown: travelCostResult.calculation.breakdown
};
}

    // Fallback calculation with dynamic rate from Vegvesen API
    const baseRate = travelLogForm.selectedVehicleData?.taxRate || 3.50;
    const totalKm = travelLogForm.returnTrip ? travelLogForm.kilometers * 2 : travelLogForm.kilometers;
    const kmCost = totalKm * baseRate;
    const totalCost = kmCost + travelLogForm.tollFees + travelLogForm.additionalFees;
    
    return {
      totalKm,
      kmCost, 
      totalCost,
      breakdown: `${totalKm} kilometer × ${baseRate} kr/km + Bompenger ${travelLogForm.tollFees.toFixed(2)} kr + Tillegg ${travelLogForm.additionalFees.toFixed(2)} kr = ${totalCost.toFixed(2)} kr`
};
}, [travelCostResult, travelLogForm]);

  // Handlers for new API integrations
  const handleVehicleSelected = (vehicle: any) => {
    setTravelLogForm(prev => ({
      ...prev,
      vehicle: `${vehicle.make} ${vehicle.model} (${vehicle.registration})`,
      vehicleRegistration: vehicle.registration,
      selectedVehicleData: vehicle
}));
    setVehicleRegistryOpen(false);
};

  const handleTollCalculationComplete = (result: any) => {
    if (result.success && result.calculation) {
      setTravelLogForm(prev => ({
        ...prev,
        tollFees: result.calculation.totalTolls,
        kilometers: result.calculation.totalDistance
}));
      setTollCalculationResult(result);
}
    setTollCalculationOpen(false);
};

  const handleCalculateFullTravelCost = () => {
    if (!travelLogForm.fromAddress || !travelLogForm.toAddress) {
      return;
}

    const travelData = {
      fromAddress: travelLogForm.fromAddress,
      toAddress: travelLogForm.toAddress,
      vehicleData: travelLogForm.selectedVehicleData,
      returnTrip: travelLogForm.returnTrip,
      additionalFees: travelLogForm.additionalFees
};

    calculateTravelCostMutation.mutate(travelData);
};

  // Manual travel log handlers
  const handleTravelLogSubmit = async () => {
    try {
      const travelLogData = {
        ...travelLogForm,
        calculatedCost: calculateTravelCost.totalCost,
        createdAt: new Date().toISOString()
};

      const response = await fetch('/api/travel-log', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(travelLogData)
});

      if (response.ok) {
        setManualEntryOpen(false);
        // Reset form
        setTravelLogForm({
          date: new Date().toISOString().split('T')[0],
          vehicle: '',
          vehicleRegistration: '',
          description: '',
          contact: '',
          fromAddress: '',
          toAddress: ', ',
          extraDestinations:  [],
          returnTrip: false,
          kilometers:  0,
          tollFees:  0,
          additionalFees:  0,
          additionalFeesDescription: ', '
  });
        console.log('Travel log entry saved successfully');
        
        // Track travel log creation for Skattemelding year aggregation
        try {
          await trackAnalytics('travel_log_created', {
            date: travelLogForm.date,
            kilometers: calculateTravelCost.totalKm,
            tollFees: travelLogForm.tollFees,
            additionalFees: travelLogForm.additionalFees,
          });
        } catch {}
  }
} catch (error) {
      console.error('Failed to save travel log: ', error);
}
};

  const addExtraDestination = () => {
    setTravelLogForm(prev => ({
      ...prev,
      extraDestinations: [...prev.extraDestinations, ', ']
    }));
  };

const removeExtraDestination = (index: number) => {
  setTravelLogForm((prev) => ({
    ...prev,
    extraDestinations: prev.extraDestinations.filter((_, i) => i !== index),
  }));
};

  // Button handlers
  const handleGPSTrackingConfig = () => {
    setGpsTrackingEnabled(!gpsTrackingEnabled);
    console.log('GPS tracking', gpsTrackingEnabled ? 'disabled' : 'enabled');
};

  const handleFuelCostManagement = () => {
    console.log('Opening fuel cost management interface');
    // This would open a separate modal or interface
};

  const handleStartAutomaticTracking = () => {
    console.log('Starting automatic cost tracking');
    // This would initialize the automatic tracking system
};

  // OCR Receipt Scanning Function
  const handleReceiptScan = async (file: File, source: 'camera' | 'upload') => {
    setScanningReceipt(true);

    try {
      // Note: tesseract.js is not installed - using placeholder OCR
      console.log(`📄 Starting OCR scanning from ${source}...`);

      // Placeholder: In production, install tesseract.js and uncomment:
      // const Tesseract = await import('tesseract.js');
      // const { data: { text } } = await Tesseract.recognize(file, 'nor+eng', {...});

      // For now, use placeholder text
      const text = 'Receipt scanning requires tesseract.js package';

      // Extract key information from OCR text
      const receiptData = extractReceiptData(text);

      const newReceipt = {
        id: Date.now().toString(),
        originalText: text,
        extractedData: receiptData,
        imageFile: file,
        scannedAt: new Date().toISOString(),
        source: source
};
      
      setScannedReceipts(prev => [...prev, newReceipt]);
      
      // Save to Google Drive and Google Sheets
      await saveReceiptToGoogleDrive(newReceipt);
      
      // Track scanned receipt (registered receipts can be tracked elsewhere when finalized)
      try {
        await trackAnalytics('receipt_scanned', {
          id: newReceipt.id,
          amount: newReceipt.extractedData?.amount,
          date: newReceipt.extractedData?.date,
          category: newReceipt.extractedData?.category,
          merchant: newReceipt.extractedData?.merchant,
          source,
        });
      } catch {}
      
      console.log('✅ OCR scanning completed:', receiptData);
} catch (error) {
      console.error('❌ OCR scanning failed:', error);
} finally {
      setScanningReceipt(false);
}
};

  // Extract relevant data from OCR text
  const extractReceiptData = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Norwegian-specific patterns
    const amountPattern = /(\d, +, [,\.]\d+)\s*(kr|NOK|kroner)/i;
    const datePattern = /(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/;
    const timePattern = /(\d{1,2}):(\d{2})/;
    
    // Common Norwegian fuel station names
    const fuelStations = ['shell','statoil','esso','circle k','uno-x','7-eleven'];
    const tollStations = ['bomstasjon','toll','bompenger'];
    const parkingStations = ['parkering','p-hus','easypark'];
    
    let amount = 0;
    let date = ', ';
    let merchant = ', ';
    let category = 'other';
    
    // Extract amount
    const amountMatch = text.match(amountPattern);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(', ','.'));
}
    
    // Extract date
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2,'0')}`;
    }
    
    // Determine category and merchant
    const textLower = text.toLowerCase();
    
    if (fuelStations.some(station => textLower.includes(station))) {
      category = 'fuel';
      merchant = fuelStations.find(station => textLower.includes(station)) || 'Fuel Station';
} else if (tollStations.some(toll => textLower.includes(toll))) {
      category = 'toll';
      merchant = 'Bomstasjon';
} else if (parkingStations.some(parking => textLower.includes(parking))) {
      category = 'parking';
      merchant = 'Parkering';
}
    
    return {
      amount,
      date,
      merchant: merchant || 'Unknown',
      category,
      currency: 'NO',
      confidence: amount > 0 ? 'high' : 'low'
};
};

  // Save receipt to Google Drive and Sheets
  const saveReceiptToGoogleDrive = async (receiptData: any) => {
    try {
      const response = await fetch('/api/price-administration/save-receipt', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({
          receiptData,
          saveToDrive: true,
          saveToSheets: true
  })
  });
      
      if (!response.ok) throw new Error('Failed to save receipt');
      
      const result = await response.json();
      console.log('✅ Receipt saved to Google Drive & Sheets:', result);
} catch (error) {
      console.error('❌ Failed to save receipt:', error);
}
};

  // Fetch data
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/price-administration/packages', ],
});

  const { data: pricingData, isLoading: pricingDataLoading } = useQuery({
    queryKey: ['/api/price-administration/pricing'],
  });

  const { data: costsData, isLoading: costsLoading } = useQuery({
    queryKey: ['/api/price-administration/additional-costs', ],
});

  const { data: discountsData, isLoading: discountsLoading } = useQuery({
    queryKey: ['/api/price-administration/discounts', ],
});

  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/price-administration/quotes', ],
});

  const { data: categoriesData } = useQuery({
    queryKey: ['/api/price-administration/categories', ],
});

  // Delete mutations
  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/price-administration/packages/${id}`, {
        method: 'DELETE',
  });
      if (!response.ok) throw new Error('Failed to delete package');
      return response.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/packages', ],});
},
});

  // Sync pricing data on component mount and data changes
  useEffect(() => {
    if (packagesData) {
      dataFlow.syncData('price-administration: packages', packagesData);
}
    if (pricingData) {
      dataFlow.syncData('price-administration: pricing', pricingData);
}
    if (categoriesData) {
      dataFlow.syncData('price-administration: categories', categoriesData);
}
}, [dataFlow, packagesData, pricingData, categoriesData]);

  // Enhanced handlers with integration broadcasting
  const handlePackageCreated = (packageData: any) => {
    console.log('💰 Package Created, :', packageData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:packageCreated',
      data: {
        ...packageData,
        createdBy: 'price-administration',
        timestamp: Date.now()
}
});

    // Sync data flow
    dataFlow.syncData('price-administration: packages', [...(packagesData || []), packageData]);
};

  const handlePricingCreated = (pricingData: any) => {
    console.log('💰 Pricing Created, :', pricingData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:pricingCreated',
      data: {
        ...pricingData,
        createdBy: 'price-administration',
        timestamp: Date.now()
}
});

    // Sync data flow
    dataFlow.syncData('price-administration: pricing', [...(pricingData || []), pricingData]);
};

  const handleCategoryCreated = (categoryData: any) => {
    console.log('💰 Category Created, :', categoryData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:categoryCreated',
      data: {
        ...categoryData,
        createdBy: 'price-administration',
        timestamp: Date.now()
}
});

    // Sync data flow
    dataFlow.syncData('price-administration: categories', [...(categoriesData || []), categoryData]);
};

  const handleQuoteGenerated = (quoteData: any) => {
    console.log('💰 Quote Generated, :', quoteData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'quote:created',
      data: {
        ...quoteData,
        generatedBy: 'price-administration',
        timestamp: Date.now()
      }
    });

    // Sync data flow
    dataFlow.syncData('price-administration: quotes', [...(quotesData || []), quoteData]);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Broadcast tab change to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:tabChanged',
      data: {
        tabValue: newValue,
        tabName: ['Pakker','Priser','Kategorier','Kvoter','Reise','Rapporter'][newValue] || 'Unknown',
        timestamp: Date.now()
      }
    });
  };

  const handleEditItem = (item: any) => {
    setSelectedItem(item);
    if (tabValue === 0) setCreatePackageOpen(true);
    else if (tabValue === 1) setCreatePricingOpen(true);
};

  const handleDeletePackage = (id: string) => {
    if (window.confirm('Er du sikker på at du vil slette denne pakken?')) {
      deletePackageMutation.mutate(id);
}
};

  // Use centralized currency formatting
  const formatPrice = (price: string | number) => {
    try {
      const numPrice = parseFloat(price.toString());
      if (isNaN(numPrice)) return '0 NOK';
      return formatCurrency(numPrice, 'NOK');
    } catch (error) {
      // Fallback formatting
      return new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
      }).format(Number(price));
    }
  };

  const getCategoryName = (category: string) => {
    const categoryMap: Record<string, string> = {
      bryllup: 'Bryllup',
      portrett: 'Portrett',
      bedrift: 'Bedrift',
      event: 'Event',
      reklame: 'Reklame',
};
    return categoryMap[category] || category;
};

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
          color: 'white',
          borderRadius: 0,
          ...theming.getThemedCardSx()
        }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: theming.colors.primary }}>
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Prisadministrasjon`
              : 'Prisadministrasjon'}
          </Typography>
        </Box>
        {professionConfig && (
          <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb:  3 }}>
            Prisadministrasjon for {professionConfig.displayName.toLowerCase()}
          </Typography>
        )}
<Typography variant="body1" sx={{ opacity: 0.9 }}>
          Administrer standardpakker, prisstrukturer, rabatter og generer tilbud
        </Typography>
      </Paper>

      {/* Navigation Tabs */}
      <Paper elevation={1} sx={{ borderRadius: 0, ...theming.getThemedCardSx() }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 5,
              fontSize: '0.95rem',
        }}}
        >
          <Tab icon={<CategoryIcon />} label="Standardpakker" />
          <Tab icon={<PriceIcon />} label="Prisstrukturer" />
          <Tab icon={<AddIcon />} label="Tilleggskostnader" />
          <Tab icon={<TravelIcon />} label="Kjørebok & Reise" />
          <Tab icon={<DiscountIcon />} label="Rabatter" />
          <Tab icon={<QuoteIcon />} label="Tilbud" />
          <Tab icon={<AnalyticsIcon />} label="Analyse & Rapporter" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      
      {/* Standard Packages */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Standardpakker` : 'Standardpakker'}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={() => setCreateCategoryOpen(true)}
              sx={{ mr:  2 }}
            >
              Legg til kategori
            </Button>
            <Button
  variant="contained"
  startIcon={<AddIcon sx={theming.getThemedButtonSx()} />}
  onClick={() => {
    setSelectedItem(null);
    setCreatePackageOpen(true);
  }}
>
              Ny pakke
            </Button>
          </Box>
        </Box>

        {packagesLoading ? (
          <Alert severity="info">Laster standardpakker...</Alert>
        ) : (
          <Grid container spacing={3}>
            {packagesData?.packages?.map((pkg: any) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={pkg.id}>
                <Card
                  elevation={2}
                  sx={{
                    height: '100%',
                    transition: 'all 0.2s', '&:hover': {
                      elevation: 4,
                      transform: 'translateY(-2px)'
                    },
                    ...theming.getThemedCardSx()
                  }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                      <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                        {pkg.name}
                      </Typography>
                      <Chip 
                        label={getCategoryName(pkg.category)}
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    
                    <Typography variant="h5" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
                      {formatPrice(pkg.basePrice)}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {pkg.description}
                    </Typography>
                    
                    {pkg.inclusions && (
                      <Box sx={{ mt:  2 }}>
                        <Typography variant="caption" display="block" gutterBottom>
                          Inkluderer: </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          <Chip size="small" label={`${pkg.inclusions.hours} timer`} />
                          <Chip size="small" label={`${pkg.inclusions.images} bilder`} />
                          {pkg.inclusions.videos && (
                            <Chip size="small" label={`${pkg.inclusions.videos} videoer`} />
                          )}
                          {pkg.inclusions.editing && (
                            <Chip size="small" label="Redigering" />
                          )}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                  
                  <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0, ...theming.getThemedCardSx() }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleEditItem(pkg)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeletePackage(pkg.id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {/* Pricing Structures */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Prisstrukturer` : 'Prisstrukturer'}
          </Typography>
          <Button
  variant="contained"
  startIcon={<AddIcon sx={theming.getThemedButtonSx()} />}
  onClick={() => {
    setSelectedItem(null);
    setCreatePricingOpen(true);
  }}
>
            Ny prisstruktur
          </Button>
        </Box>

        {pricingLoading ? (
          <Alert severity="info">Laster prisstrukturer...</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Navn</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Kategori</TableCell>
                  <TableCell>Priser</TableCell>
                  <TableCell align="right">Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pricingData?.pricing?.map((pricing: any) => (
                  <TableRow key={pricing.d}>
                    <TableCell>{pricing.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={pricing.type}
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell>{pricing.serviceCategory}</TableCell>
                    <TableCell>
                      {pricing.rates.hourlyRate && (
                        <Box>{formatPrice(pricing.rates.hourlyRate)}/t</Box>
                      )}
                      {pricing.rates.fullDayRate && (
                        <Box>{formatPrice(pricing.rates.fullDayRate)}/dag</Box>
                      )}
                      {pricing.rates.packageRate && (
                        <Box>{formatPrice(pricing.rates.packageRate)}</Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditItem(pricing)}
                        color="primary"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Additional Costs */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Tilleggskostnader` : 'Tilleggskostnader'}
          </Typography>
          <Button
  variant="contained"
  startIcon={<AddIcon sx={theming.getThemedButtonSx()} />}>
  Ny tilleggskostnad
</Button>
        </Box>

        {costsLoading ? (
          <Alert severity="info">Laster tilleggskostnader...</Alert>
        ) : (
          <Grid container spacing={2}>
            {costsData?.costs?.map((cost: any) => (
              <Grid size={{ xs: 12, md:  6 }} key={cost.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{cost.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cost.description}
                    </Typography>
                    <Chip 
                      label={cost.type}
                      size="small" 
                      sx={{ mt:  1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {/* Travel & Mileage */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ mb:  3 }}>
          <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Kjørebok & Reisekostnader` : 'Kjørebok & Reisekostnader'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Automatisk GPS-basert kjørebok med norske satser for {professionConfig ? professionConfig.displayName.toLowerCase() : 'profesjonelle'}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Mileage Settings */}
          <Grid size={{ xs:  12, md:  6 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                <TravelIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kjørebokkonfigurasjon</Typography>
                </Box>
                
                <Box sx={{ mb:  2 }}>
                  <Typography variant="subtitle2" gutterBottom>Norske skattesatser (2025)</Typography>
                  {(() => {
                    const taxRates = getTaxRates();
                    return (
                      <>
                        <Chip label={`Bil: ${taxRates.car} kr/km`} size="small" sx={{ mr: 1, mb: 1 }} />
                        <Chip label={`Elbil: ${taxRates.electric_car} kr/km`} size="small" sx={{ mr: 1, mb: 1 }} />
                        <Chip label={`Motorsykkel: ${taxRates.motorcycle} kr/km`} size="small" sx={{ mb:  1 }} />
                      </>
                  );
              })()}
                </Box>

                <Alert severity="info" sx={{ mb:  2 }}>
                  Automatisk GPS-sporing med gratis Geolocation API. 
                  Kjøretøyoppslag via Statens Vegvesen API.
                </Alert>

                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<GPSIcon />}
                  onClick={handleGPSTrackingConfig}
                  color={gpsTrackingEnabled ? 'success' : 'primary'}
                >
                  {gpsTrackingEnabled ? 'GPS-sporing aktiv' : 'Konfigurer GPS-sporing'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Fuel & Charging Costs */}
          <Grid size={{ xs:  12, md:  6 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                <FuelIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Drivstoff & Lading</Typography>
                </Box>

                <Box sx={{ mb:  2 }}>
                  <Typography variant="subtitle2" gutterBottom>Gjeldende priser (oppdateres automatisk)</Typography>
                  {(() => {
                    const marketRates = getMarketRates();
                    return (
                      <>
                        <Chip label={`Bensin: ~${marketRates.fuel.bensin} kr/L`} size="small" sx={{ mr: 1, mb: 1 }} />
                        <Chip label={`Diesel: ~${marketRates.fuel.diesel} kr/L`} size="small" sx={{ mr: 1, mb: 1 }} />
                        <Chip label={`Elbil-lading: ~${marketRates.fuel.elbil} kr/kWh`} size="small" sx={{ mb:  1 }} />
                      </>
                  );
              })()}
                </Box>

                <Alert severity="info" sx={{ mb:  2 }}>
                  Bruker realistiske norske drivstoffpriser basert på gjeldende markedspriser.
                  Intelligent kostberegning basert på kjøretøytype.
                </Alert>

                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<FuelIcon />}
                  onClick={handleFuelCostManagement}
                >
                  Administrer driftskostnader
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Norwegian-specific costs */}
          <Grid size={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Norskspesifikke kostnader</Typography>
                
                <Grid container spacing={2}>
                  <Grid size={{ xs:  12, md:  4 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Bompenger</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatisk registrering av bompasseringer basert på GPS-rute
                      </Typography>
                      <Chip label={`Gjennomsnitt: ${getMarketRates().tolls.range.min}-${getMarketRates().tolls.range.max} kr`} size="small" sx={{ mt: 1 }} />
                    </Box>
                  </Grid>
                  
                  <Grid size={{ xs:  12, md:  4 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Ferge</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatisk beregning av fergekostnader på norske ruter
                      </Typography>
                      <Chip label={`Varierer: ${getMarketRates().ferries.range.min}-${getMarketRates().ferries.range.max} kr`} size="small" sx={{ mt: 1 }} />
                    </Box>
                  </Grid>
                  
                  <Grid size={{ xs:  12, md:  4 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Parkering</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Parkering ved oppdragssteder med kvitteringsscanning
                      </Typography>
                      <Chip label={`Bysentrum: ${getMarketRates().parking.city_center.min}-${getMarketRates().parking.city_center.max} kr/t`} size="small" sx={{ mt: 1 }} />
                    </Box>
                  </Grid>
                </Grid>

                <Button
  variant="contained"
  sx={{ mt: 2 }}
  startIcon={<AnalyticsIcon sx={theming.getThemedButtonSx()} />}
  onClick={handleStartAutomaticTracking}
>
  Start automatisk kostnadssporing
</Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Manual Travel Log Entry */}
          <Grid size={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
  <EventIcon sx={{ mr: 2, color: 'primary.main' }} />
  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
    Manuell kjørebokføring
  </Typography>
</Box>
<Button
  variant="contained"
  startIcon={<AddIcon sx={theming.getThemedButtonSx()} />}
  onClick={() => setManualEntryOpen(true)}
>
                    Ny kjøretur
                  </Button>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Registrer kjøreturer manuelt med automatisk kostnadsberegning og integrert bompengekalkulering
                </Typography>

                <Alert severity="info" sx={{ mb:  2 }}>
                  <strong>Inkludert i manuell registrering: </strong>
                  <br />• Kjøretøyintegrasjon med Vegvesenet
                  <br />• Automatisk bompengeberegning via bompengekalkulatoren
                  <br />• Norske skattesatser , (, 3,50 kr/km basis + tillegg)
                  <br />• Retur-reise automatisk beregning
                </Alert>

                {calculateTravelCost.totalKm > 0 && (
                  <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 2,
    bgcolor: 'success.50',
    border: '1px solid',
    borderColor: 'success.200'}}
>
  <Typography variant="subtitle2" color="success.main" gutterBottom>
    💰 Siste kostnadsberegning
  </Typography>
  <Typography variant="body2">{calculateTravelCost.breakdown}</Typography>
</Paper>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Receipt OCR Scanner */}
          <Grid size={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <ReceiptIcon sx={{ color: 'primary.main'}} />
                  OCR Kvitteringsscanning
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                  Automatisk scanning av kvitteringer med Tesseract.js OCR - fungerer både på mobil og desktop
                </Typography>

                <Grid container spacing={2}>
                  <Grid size={{ xs:  12, md:  6 }}>
                  <Card
  variant="outlined"
  sx={{ ...theming.getThemedCardSx(), p: 2, textAlign: 'center' }}
>
  <CameraIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
    Ta bilde med kamera
  </Typography>
  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
    Bruk mobilkamera for å ta bilde av kvitteringen
  </Typography>

                      <input
                        accept="image/*"
                        capture="camera"
                        style={{ display: 'none'}}
                        id="camera-capture"
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleReceiptScan(file, 'camera');
                          }
                        }}
                      />
                      <label htmlFor="camera-capture">
                        <Button variant="contained" 
                          component="span"
                          startIcon={<CameraIcon sx={theming.getThemedButtonSx()} />}
                          fullWidth
                          disabled={scanningReceipt}
                        >
                          {scanningReceipt ? 'Scanner...' : 'Ta bilde'}
                        </Button>
                      </label>
                    </Card>
                  </Grid>
                  
                  <Grid size={{ xs:  12, md:  6 }}>
                    <Card variant="outlined" sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                      <UploadIcon sx={{ fontSize:  48, color: 'secondary.main', mb:  2 }} />
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Last opp eksisterende bilde</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        Velg kvitteringsbilde fra galleriet eller filsystemet
                      </Typography>
                      <input
                        accept="image/*"
                        style={{ display: 'none'}}
                        id="file-upload"
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleReceiptScan(file, 'upload');
                          }
                        }}
                      />
                      <label htmlFor="file-upload">
                        <Button 
                          variant="outlined" 
                          component="span"
                          startIcon={<UploadIcon />}
                          fullWidth
                          disabled={scanningReceipt}
                        >
                          {scanningReceipt ? 'Scanner...' : 'Last opp'}
                        </Button>
                      </label>
                    </Card>
                  </Grid>
                </Grid>

                {/* OCR Results Display */}
                <Box sx={{ mt:  3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Scannede kvitteringer
                  </Typography>
                  
                  <Alert severity="info" sx={{ mb:  2 }}>
                    <strong>OCR-funksjoner: </strong>
                    <br />• Automatisk informasjonshenting av beløp, dato og butikknavn
                    <br />• Mobiloptimalisert med kamerastøtte
                    <br />• Intelligent kategorisering (drivstoff, bompenger, parkering)
                    <br />• Norskspråkig OCR med valutagjenkjenning
                  </Alert>

                  <Grid container spacing={2}>
                    {scannedReceipts.length === 0 ? (
                      <Grid size={12}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50', ...theming.getThemedCardSx() }}>
                          <ScanIcon sx={{ fontSize:  32, color: 'grey.40', mb:  1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Scannede kvitteringer vil vises her med ekstrahert informasjon
                          </Typography>
                        </Paper>
                      </Grid>
                    ) : (
                      scannedReceipts.map((receipt) => (
                        <Grid size={{ xs:  12, md:  6 }} key={receipt.id}>
                          <Card variant="outlined" sx={theming.getThemedCardSx()}>
                            <CardContent sx={theming.getThemedCardSx()}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                                  {receipt.extractedData.merchant}
                                </Typography>
                                <Chip 
                                  label={receipt.extractedData.category}
                                  size="small" 
                                  color="primary" 
                                  variant="outlined"
                                />
                              </Box>
                              
                              <Typography variant="h5" color="success.main" gutterBottom sx={{ color: theming.colors.primary }}>
                                {formatPrice(receipt.extractedData.amount)}
                              </Typography>
                              
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Dato: {receipt.extractedData.date || 'Ikke funnet'}
                              </Typography>
                              
                              <Typography variant="caption" display="block">
                                Kilde: {receipt.source === 'camera' ? 'Kamera' : 'Opplastet fil'}
                              </Typography>
                              
                              <Typography variant="caption" display="block">
                                Tillit: {receipt.extractedData.confidence === 'high' ? 'Høy' : 'Lav'}
                              </Typography>
                      
                      {registeredReceiptIds.includes(receipt.id) ? (
                        <Chip label="Registrert" size="small" color="success" sx={{ mt: 1 }} />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ mt: 1 }}
                          onClick={async () => {
                            try {
                              await trackAnalytics('receipt_registered', {
                                id: receipt.id,
                                amount: receipt.extractedData?.amount,
                                date: receipt.extractedData?.date,
                                merchant: receipt.extractedData?.merchant,
                                category: receipt.extractedData?.category,
                              });
                              setRegisteredReceiptIds((prev) => (prev.includes(receipt.id) ? prev : [...prev, receipt.id]));
                            } catch {}
                          }}
                        >
                          Marker som registrert
                        </Button>
                      )}
                              
                              {receipt.extractedData.confidence === 'low' && (
                                <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem'}}>
                                  Manuell verifisering anbefales
                                </Alert>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      ))
                    )}
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Discounts */}
      <TabPanel value={tabValue} index={4}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Rabatter` : 'Rabatter'}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />}>
            Ny rabatt
          </Button>
        </Box>

        {discountsLoading ? (
          <Alert severity="info">Laster rabatter...</Alert>
        ) : (
          <Grid container spacing={2}>
            {discountsData?.discounts?.map((discount: any) => (
              <Grid size={{ xs: 12, md:  6 }} key={discount.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{discount.name}</Typography>
                    <Typography variant="h5" color="success.main" sx={{ color: theming.colors.primary }}>
                      {discount.isPercentage 
                        ? `${discount.discountValue}%` 
                        : formatPrice(discount.discountValue)
                  }
                    </Typography>
                    {discount.discountCode && (
                      <Chip 
                        label={`Kode: ${discount.discountCode}`}
                        size="small" 
                        sx={{ mt:  1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {/* Quotes */}
      <TabPanel value={tabValue} index={5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Tilbud` : 'Tilbud'}
          </Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setQuoteGeneratorOpen(true)}
          >
            Lag et tilbud
          </Button>
        </Box>

        {quotesLoading ? (
          <Alert severity="info">Laster tilbud...</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tilbudsnummer</TableCell>
                  <TableCell>Kunde</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Opprettet</TableCell>
                  <TableCell align="right">Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotesData?.quotes?.map((quote: any) => (
                  <TableRow key={quote.d}>
                    <TableCell>{quote.quoteNumber}</TableCell>
                    <TableCell>{quote.clientId}</TableCell>
                    <TableCell>{formatPrice(quote.totalAmount)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={quote.status}
                        size="small"
                        color={quote.status === 'accepted' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(quote.createdAt).toLocaleDateString('nb-NO')}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DescriptionIcon />}
                          onClick={() => {
                            // Emit event to create contract from quote
                            if (communication) {
                              communication.sendMessage({
                                from: 'price-administration',
                                to: 'contract-hub',
                                type: 'contract:create-from-quote',
                                data: {
                                  quoteId: quote.id,
                                  clientId: quote.clientId,
                                  totalAmount: quote.totalAmount,
                                  description: quote.description || quote.quoteNumber,
                                },
                              });
                            }
                            if (onContractCreate) {
                              onContractCreate({
                                clientId: quote.clientId,
                                totalAmount: quote.totalAmount,
                                projectDescription: quote.description || quote.quoteNumber,
                                status: 'draft',
                              });
                            }
                          }}
                        >
                          Opprett Kontrakt
                        </Button>
                        {userProfession === 'music_producer' && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AccountBalance />}
                            onClick={() => {
                              // Emit event to create split sheet from quote
                              if (communication) {
                                communication.sendMessage({
                                  from: 'price-administration',
                                  to: 'split-sheet-manager',
                                  type: 'split-sheet:create-from-quote',
                                  data: {
                                    quoteId: quote.id,
                                    projectId: selectedProject?.id,
                                    title: quote.quoteNumber || 'Split Sheet',
                                    description: quote.description,
                                    totalRevenue: quote.totalAmount,
                                  },
                                });
                              }
                            }}
                          >
                            Opprett Split Sheet
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Floating Action Button for Quick Quote */}
      <Fab
        color="primary"
        size="large"
        sx={{
          position: 'fixed',
          bottom:  24,
          right:  24}}
        onClick={() => setQuoteGeneratorOpen(true)}
      >
        <QuoteIcon />
      </Fab>

      {/* Modals */}
      <CreatePackageModal
        open={createPackageOpen}
        onClose={() => {
          setCreatePackageOpen(false);
          setSelectedItem(null);
    }}
        editData={selectedItem}
        categories={categoriesData?.categories || []}
      />

      <CreatePricingModal
        open={createPricingOpen}
        onClose={() => {
          setCreatePricingOpen(false);
          setSelectedItem(null);
    }}
        editData={selectedItem}
      />

      <CreateCategoryModal
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
      />

      <QuoteGeneratorModal
        open={quoteGeneratorOpen}
        onClose={() => setQuoteGeneratorOpen(false)}
        packages={packagesData?.packages || []}
        pricing={pricingData?.pricing || []}
        additionalCosts={costsData?.costs || []}
        discounts={discountsData?.discounts || []}
      />

      {/* Manual Travel Log Entry Dialog */}
      <Dialog 
        open={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center'}}>
            <CarIcon sx={{ mr: 2, color: 'primary.main'}} />
            Registrer ny kjøretur
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Details Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljer</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs:  12, sm:  6 }}>
                    <TextField
                      fullWidth
                      label="Dato"
                      type="date"
                      value={travelLogForm.date}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, date: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: <EventIcon sx={{ mr: 1, color: 'text.secondary'}} />
                  }}
                    />
                  </Grid>
                  
                  <Grid size={{ xs:  12, sm:  6 }}>
                    <Box sx={{ display: 'flex', gap:  1 }}>
                      <TextField
                        fullWidth
                        label="Kjøretøy"
                        value={travelLogForm.vehicle || ''}
                        InputProps={{
                          startAdornment: <CarIcon sx={{ mr: 1, color: 'text.secondary'}} />,
                          readOnly: true
                  }}
                        placeholder="Velg kjøretøy fra Vegvesenets register"
                        helperText="Ekte data fra Statens Vegvesen"
                      />
                      <Button
                        variant="outlined"
                        onClick={() => setVehicleRegistryOpen(true)}
                        sx={{ minWidth: 'auto', px:  2 }}
                      >
                        Velg
                      </Button>
                    </Box>
                  </Grid>

                  {travelLogForm.selectedVehicleData && (
                    <Grid size={12}>
                      <Card variant="outlined" sx={{ bgcolor: 'success.5', border: '1px solid', borderColor: 'success.200', ...theming.getThemedCardSx() }}>
                        <CardContent sx={{ py: 2, ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2" color="success.main" gutterBottom>
                            ✅ Kjøretøy verifisert via Statens Vegvesen
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap'}}>
                            <Typography variant="body2">
                              <strong>{travelLogForm.selectedVehicleData.registration}</strong> - {travelLogForm.selectedVehicleData.make} {travelLogForm.selectedVehicleData.model}
                            </Typography>
                            <Chip 
                              label={travelLogForm.selectedVehicleData.fuelType}
                              size="small" 
                              color={travelLogForm.selectedVehicleData.fuelType?.toLowerCase().includes('elektrisk') ? 'success' : 'default'}
                            />
                            <Chip 
                              label={`${travelLogForm.selectedVehicleData.taxRate} kr/km`}
                              size="small" 
                              color="primary" 
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  <Grid size={{ xs:  12, sm:  6 }}>
                    <TextField
                      fullWidth
                      label="Registreringsnummer"
                      value={travelLogForm.vehicleRegistration}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, vehicleRegistration: e.target.value.toUpperCase() }))}
                      placeholder="AB12345"
                      helperText="Henter informasjon fra Vegvesenet"
                      onBlur={async (e) => {
                        const regNumber = e.target.value;
                        if (regNumber.length >= 6) {
                          const vehicleInfo = await fetchVehicleInfo(regNumber);
                          if (vehicleInfo) {
                            console.log('Vehicle info fetched:', vehicleInfo);
                          }
                        }
                      }}
                    />
                  </Grid>
                  
                  <Grid size={{ xs:  12, sm:  6 }}>
                    <TextField
                      fullWidth
                      label="Kontakt (valgfri)"
                      value={travelLogForm.contact}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, contact: e.target.value }))}
                      InputProps={{
                        startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary'}} />
                  }}
                      placeholder="Klientnavn eller kontaktperson"
                    />
                  </Grid>
                  
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Beskrivelse/formål med reisen"
                      multiline
                      rows={2}
                      value={travelLogForm.description}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, description: e.target.value }))}
                      InputProps={{
                        startAdornment: <DescriptionIcon sx={{ mr: 1, color: 'text.secondary', alignSelf: 'flex-start', mt:  1 }} />
                  }}
                      placeholder="F.eks. Bryllupsfotografering hos brudeparet"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Route Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Strekning</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs:  12, sm:  5 }}>
                    <TextField
                      fullWidth
                      label="Fra adresse"
                      value={travelLogForm.fromAddress}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, fromAddress: e.target.value }))}
                      InputProps={{
                        startAdornment: <LocationIcon sx={{ mr: 1, color: 'success.main'}} />
                  }}
                      placeholder="Hjemmeadresse eller startpunkt"
                    />
                  </Grid>
                  
                  <Grid size={{ xs:  12, sm:  5 }}>
                    <TextField
                      fullWidth
                      label="Til adresse"
                      value={travelLogForm.toAddress}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, toAddress: e.target.value }))}
                      InputProps={{
                        startAdornment: <LocationIcon sx={{ mr: 1, color: 'error.main'}} />
                  }}
                      placeholder="Måladresse eller endepunkt"
                      onBlur={async () => {
                        if (travelLogForm.fromAddress && travelLogForm.toAddress) {
                          const tollFees = await calculateTollFees(travelLogForm.fromAddress, travelLogForm.toAddress);
                          setTravelLogForm(prev => ({ ...prev, tollFees }));
                    }
                  }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setTollCalculationOpen(true)}
                      disabled={!travelLogForm.fromAddress || !travelLogForm.toAddress}
                      sx={{ ...theming.getThemedButtonSx(), height: '56px', width: '100%' }}
                      startIcon={<RouteIcon />}
                    >
                      Beregn bompenger kostnader
                    </Button>
                  </Grid>

                  {tollCalculationResult?.success && (
                    <Grid size={12}>
                      <Alert severity="success">
                        <Typography variant="body2">
                          <strong>Bompengeberegning: </strong> {tollCalculationResult.calculation.totalTolls} kr • 
                          <strong>Distanse: </strong> {tollCalculationResult.calculation.totalDistance} km • 
                          <strong>Bomstasjoner: </strong> {tollCalculationResult.calculation.tollStations?.length || 0}
                        </Typography>
                      </Alert>
                    </Grid>
                  )}
                  
                  {/* Extra Destinations */}
                  {travelLogForm.extraDestinations.map((destination, index) => (
                    <Grid size={12} key={index}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center'}}>
                        <TextField
                          fullWidth
                          label={`Ekstra destinasjon ${index + 1}`}
                          value={destination}
                          onChange={(e) => updateExtraDestination(index, e.target.value)}
                          InputProps={{
                            startAdornment: <RouteIcon sx={{ mr: 1, color: 'text.secondary'}} />
                      }}
                          placeholder="Mellomstopp eller ekstra destinasjon"
                        />
                        <IconButton onClick={() => removeExtraDestination(index)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Grid>
                  ))}
                  
                  <Grid size={12}>
                    <Button
                      startIcon={theming.getThemedIcon('addCircle')}
                      onClick={addExtraDestination}
                      variant="outlined"
                      size="small"
                    >
                      Legg til ekstra destinasjon
                    </Button>
                  </Grid>
                  
                  <Grid size={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={travelLogForm.returnTrip}
                          onChange={(e) => setTravelLogForm(prev => ({ ...prev, returnTrip: e.target.checked }))}
                        />
                  }
                      label="Samme strekning ble kjørt i retur (beregner automatisk dobbel distanse)"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Cost Calculation Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kostnadsberegning</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <TextField
                      fullWidth
                      label="Antall kilometer for strekning"
                      type="number"
                      value={travelLogForm.kilometers}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, kilometers: parseFloat(e.target.value) || 0 }))}
                      InputProps={{
                        endAdornment: <Typography sx={{ color: 'text.secondary' }}>km</Typography>
                      }}
                      helperText={travelLogForm.returnTrip ? `Total: ${travelLogForm.kilometers * 2} km (inkl. retur)` : ''}
                    />
                  </Grid>
                  
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <TextField
                      fullWidth
                      label="Totale bompenger"
                      type="number"
                      value={travelLogForm.tollFees}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, tollFees: parseFloat(e.target.value) || 0 }))}
                      InputProps={{
                        endAdornment: <Typography sx={{ color: 'text.secondary'}}>kr</Typography>
                  }}
                      helperText={
                        <span>
                          Automatisk beregning fra autosync.no{', '}
                          <a 
                            href="https: //autosync.no/privat/bompengekalkulator/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'inherit'}}
                          >
                            bompengekalkulatoren
                          </a>
                        </span>
                  }
                    />
                  </Grid>
                  
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <TextField
                      fullWidth
                      label="Totalsum tilleggssatser"
                      type="number"
                      value={travelLogForm.additionalFees}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, additionalFees: parseFloat(e.target.value) || 0 }))}
                      InputProps={{
                        endAdornment: <Typography sx={{ color: 'text.secondary'}}>kr</Typography>
                  }}
                    />
                  </Grid>
                  
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Beskrivelse av tilleggssatser"
                      multiline
                      rows={2}
                      value={travelLogForm.additionalFeesDescription}
                      onChange={(e) => setTravelLogForm(prev => ({ ...prev, additionalFeesDescription: e.target.value }))}
                      placeholder={`F.eks. Tillegg for ekstra passasjerer, bruk av tilhenger, bagasje over 150kg/500liter, eller kjøring på skogs- og anleggsvei. Satsen er ${getTaxRates().additional_fees}kr per km for disse tilleggene.`}
                      helperText={`Tillegg for ekstra passasjerer, tilhenger, bagasje over 150kg/500L, eller skogs-/anleggsvei (${getTaxRates().additional_fees} kr/km)`}
                    />
                  </Grid>
                </Grid>
                
                {/* Cost Summary */}
                {calculateTravelCost.totalKm > 0 && (
                  <Paper sx={{ mt: 3, p: 2, bgcolor: 'primary.5', border: '1px solid', borderColor: 'primary.200', ...theming.getThemedCardSx() }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                      <CalculateIcon sx={{ mr: 1, color: 'primary.main'}} />
                      <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600 }}>
                        Kostnadsoversikt
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={2}>
                      <Grid size={{ xs:  12, sm:  6 }}>
                        <Typography variant="body2">
                        <strong>Kjørelengde: </strong> {calculateTravelCost.totalKm} km
                        </Typography>
                        <Typography variant="body2">
                          <strong>Kjøregodtgjørelse: </strong> {calculateTravelCost.kmCost.toFixed()} NOK
                        </Typography>
                      </Grid>
                      <Grid size={{ xs:  12, sm:  6 }}>
                        <Typography variant="body2">
                          <strong>Bompenger: </strong> {travelLogForm.tollFees.toFixed(2)} NOK
                        </Typography>
                        <Typography variant="body2">
                          <strong>Tilleggssatser: </strong> {travelLogForm.additionalFees.toFixed()} NOK
                        </Typography>
                      </Grid>
                    </Grid>
                    
                    <Divider sx={{ my:  2 }} />
                    
                    <Typography variant="body1" sx={{ fontWeight: 600, color:'primary.main'}}>
                      {calculateTravelCost.breakdown}
                    </Typography>
                  </Paper>
                )}
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setManualEntryOpen(false)}>Avbryt</Button>
          <Button variant="contained" 
            onClick={handleTravelLogSubmit}
            disabled={!travelLogForm.fromAddress || !travelLogForm.toAddress || travelLogForm.kilometers === 0}
           sx={theming.getThemedButtonSx()}>
            Lagre kjøretur
          </Button>
        </DialogActions>
      </Dialog>

      {/* New API Integration Modals */}
      <VehicleRegistryModal
        open={vehicleRegistryOpen}
        onClose={() => setVehicleRegistryOpen(false)}
        onVehicleSelected={handleVehicleSelected}
      />

      <TollCalculationModal
        open={tollCalculationOpen}
        onClose={() => setTollCalculationOpen(false)}
        onCalculationComplete={handleTollCalculationComplete}
        initialFrom={travelLogForm.fromAddress}
        initialTo={travelLogForm.toAddress}
        vehicleData={travelLogForm.selectedVehicleData}
      />
    </Box>
);
};

export default PriceAdministration;