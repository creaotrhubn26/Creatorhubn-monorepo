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
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Fab as _Fab,
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
  DialogContentText,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
  Snackbar as _Snackbar,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
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
  Assessment as _ReportIcon,
  CameraAlt as CameraIcon,
  Upload as UploadIcon,
  Receipt as ReceiptIcon,
  Scanner as ScanIcon,
  DirectionsCar as CarIcon,
  AddCircle as _AddCircle,
  CheckCircle as CheckCircleIcon,
  LocationOn as GPSIcon,
  Calculate as CalculateIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Route as RouteIcon,
  LocationOn as LocationIcon,
  Description as DescriptionIcon,
  EventNote as EventIcon,
  AccountBalance,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import CreatePackageModal from './modals/CreatePackageModal';
import CreatePricingModal from './modals/CreatePricingModal';
import CreateCategoryModal from './modals/CreateCategoryModal';
import QuoteGeneratorModal from './modals/QuoteGeneratorModal';
import VehicleRegistryModal from './vehicle/VehicleRegistryModal';
import TollCalculationModal from './travel/TollCalculationModal';

// Import dynamic profession system
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';

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
  userId: _userId,
  onProjectUpdate,
  onContractCreate,
  selectedProject,
  onProjectSelect
}) => {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  
  // Get user and profession context
  const { user } = useAuth();
  const userProfession = user?.profession || 'photographer';
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor, isLoading: _professionsLoading, getProfessionDisplayName: _getProfessionDisplayName } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || userProfession || 'photographer';
  // This is intentionally unused but kept for profession system consistency
  const _professionIcon = getProfessionIcon(currentProfession);
  const _professionConfig = professionConfigs?.[currentProfession];
  const _enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || _professionConfig;
  const _professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';

  // Client service pricing service integration
  const { 
    formatCurrency,
    getTotalWithMVA: _getTotalWithMVA,
    convertCurrency: _convertCurrency
} = useClientServicePricing();

  // External data service integration
  const {
    getVehicleData: _getVehicleData,
    calculateTollCosts: _calculateTollCosts,
    calculateTravelCosts: _calculateTravelCosts,
    getFuelPrices: _getFuelPrices,
    getTaxRates,
    getMarketRates
} = useExternalData();
  // Use enhanced profession config (already set above)

  // Master integration system for "everything interacts with everything"
  const { integration: _integration, communication, dataFlow, componentRegistry: _componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  // Register component and data flow nodes with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('price-administration', 'pricing', [
      'data:read','data:write','event:emit','event:listen','ui:update',
      'pricing:create','pricing:update','pricing:delete',
      'package:manage','category:manage','quote:generate','travel:log',
      'showcase:pricing-link','project:pricing-link','client:pricing-link'
    ]);

    dataFlow.registerNode({
      type: 'source',
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

    // Additional data flow nodes for quotes, discounts, costs, and travel logs
    dataFlow.registerNode({
      type: 'source',
      componentId: 'price-administration',
      dataKey: 'price-administration:quotes',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'price-administration',
      dataKey: 'price-administration:discounts',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'price-administration',
      dataKey: 'price-administration:costs',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'price-administration',
      dataKey: 'price-administration:travel-logs',
      transform: <T extends Record<string, unknown>>(data: T) => ({ ...data, lastUpdated: Date.now() }),
    });


    return () => {
      communication.unregisterComponent('price-administration');
};
}, [communication, dataFlow]);

  // Listen to global events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      // Project selection from UniversalDashboard
      if (message.type === 'project:selected' && message.data) {
        console.log('💰 Price Administration: Project selected', message.data);
        // Store selected project for quote generation context
        if (onProjectSelect) onProjectSelect(message.data);
      }
      // Client selection from UniversalDashboard
      if (message.type === 'client:selected' && message.data) {
        console.log('💰 Price Administration: Client selected', message.data);
        // Update pricing context based on selected client - could auto-apply client discounts
      }
      // Showcase item selected - link pricing to showcase
      if (message.type === 'showcase:item-selected' && message.data) {
        console.log('💰 Price Administration: Showcase item selected', message.data);
        // Could suggest pricing based on showcase item type
      }
      // Showcase synced to drive - could link pricing to showcase exports
      if (message.type === 'showcase-synced-to-drive' && message.data) {
        console.log('💰 Price Administration: Showcase synced to drive', message.data);
      }
      // Package sync from other components
      if (message.type === 'data:sync' && message.data.dataKey === 'price-administration:packages') {
        console.log('💰 Price Administration: Packages synced', message.data.data);
      }
      // Contract created - refresh quotes
      if (message.type === 'contract:created' && message.data) {
        console.log('💰 Price Administration: Contract created event received', message.data);
        queryClient.invalidateQueries({ queryKey: ['/api/price-administration/quotes'] });
      }
      // Split sheet created
      if (message.type === 'split-sheet:created' && message.data) {
        console.log('💰 Price Administration: Split sheet created event received', message.data);
      }
      // Showcase updated - could link pricing
      if (message.type === 'showcase:updated' && message.data) {
        console.log('💰 Price Administration: Showcase updated', message.data);
      }
      // Request for pricing data from other components
      if (message.type === 'pricing:request-packages' && message.to === 'price-administration') {
        // Send packages data to requesting component (Note: packagesData, pricingData, discountsData defined below)
        // This listener is only registered once per mount, separate effect handles data syncing
      }
      // Request for quote generation from external component
      if (message.type === 'pricing:generate-quote-request' && message.data) {
        console.log('💰 Price Administration: Quote generation requested', message.data);
        setQuoteGeneratorOpen(true);
      }
    });
    return unsubscribe;
  }, [communication, queryClient, onProjectSelect]);

  const [createPackageOpen, setCreatePackageOpen] = useState(false);
  const [createPricingOpen, setCreatePricingOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [createCostOpen, setCreateCostOpen] = useState(false);
  const [createDiscountOpen, setCreateDiscountOpen] = useState(false);
  const [quoteGeneratorOpen, setQuoteGeneratorOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scannedReceipts, setScannedReceipts] = useState<any[]>([]);
  const [registeredReceiptIds, setRegisteredReceiptIds] = useState<string[]>([]);
  
  // Loading states
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Cost form state
  const [costForm, setCostForm] = useState({
    name: '',
    description: '',
    type: 'fixed',
    amount: 0,
    category: ''
  });
  
  // Discount form state
  const [discountForm, setDiscountForm] = useState({
    name: '',
    discountValue: 0,
    isPercentage: true,
    discountCode: '',
    validFrom: '',
    validTo: '',
    minPurchase: 0
  });
  
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
  const [_vehicles, _setVehicles] = useState<any[]>([]);
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(false);
  const [tollCalculationResult, setTollCalculationResult] = useState<any>(null);
  const [travelCostResult, setTravelCostResult] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; type: string; id: string | null; label: string }>({ open: false, type: '', id: null, label: '' });

  // Minimal analytics tracker for Skattemelding aggregation
  const trackAnalytics = async (eventType: string, eventData: any) => {
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ eventType, eventData, userId: user?.id || null })
      });
    } catch {
      // Silently handle analytics tracking errors
    }
  };

  // Calculate travel costs using real APIs
  const calculateTravelCostMutation = useMutation({
    mutationFn: async (travelData: any) => {
      const response = await fetch('/api/price-administration/travel-costs', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(travelData)
});
      if (!response.ok) throw new Error('Failed to calculate travel costs');
      return response.json();
},
    onSuccess: (data) => {
      setTravelCostResult(data);
}
});

  // Toll calculation mutation  
  const _tollCalculationMutation = useMutation({
    mutationFn: async (routeData: any) => {
      const response = await fetch('/api/price-administration/toll-calculation', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(routeData)
});
      if (!response.ok) throw new Error('Failed to calculate toll');
      return response.json();
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

  // Travel log calculation helpers
  const _handleCalculateFullTravelCost = () => {
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
          toAddress: '',
          extraDestinations: [],
          returnTrip: false,
          kilometers: 0,
          tollFees: 0,
          additionalFees: 0,
          additionalFeesDescription: '',
          selectedVehicleData: null
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
        } catch {
          // Silently handle analytics tracking errors
        }
  }
} catch (_error) {
      console.error('Failed to save travel log: ', _error);
}
};

  const addExtraDestination = () => {
    setTravelLogForm(prev => ({
      ...prev,
      extraDestinations: [...prev.extraDestinations, ', ']
    }));
  };

const removeExtraDestination = (_index: number) => {
  setTravelLogForm((prev) => ({
    ...prev,
    extraDestinations: prev.extraDestinations.filter((_: any, i: number) => i !== _index),
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
  const _handleReceiptScan = async (file: File, source: 'camera' | 'upload') => {
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
      await _handleReceiptScan(newReceipt.imageFile, 'camera');
      
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
} catch {
          // Silently handle error in scanned receipt analytics
        }
      
      console.log('✅ OCR scanning completed:', receiptData);
} catch (error) {
      console.error('❌ OCR scanning failed:', error);
} finally {
      setScanningReceipt(false);
}
};

  // Extract relevant data from OCR text
  const extractReceiptData = (text: string) => {
    const _lines = text.split('\n').filter(line => line.trim());
    
    // Norwegian-specific patterns
    const amountPattern = /(\d[.,]\d+)\s*(kr|NOK|kroner)/i;
    const datePattern = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
    const _timePattern = /(\d{1,2}):(\d{2})/;
    
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
  const _saveReceiptToGoogleDrive = async (receiptData: any) => {
    try {
      const response = await fetch('/api/price-administration/save-receipt', {
        method: 'POST',
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
    queryKey: ['/api/pricing/packages'],
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
    queryKey: [`/api/pricing/categories/${user?.id}`],
    enabled: !!user?.id
});

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      setIsDeletingItem(true);
      const response = await fetch(`/api/pricing/packages/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete package');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages'] });
      setIsDeletingItem(false);
    },
    onError: () => {
      setIsDeletingItem(false);
    }
  });

  const deletePricingMutation = useMutation({
    mutationFn: async (id: string) => {
      setIsDeletingItem(true);
      const response = await fetch(`/api/price-administration/pricing/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete pricing');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/pricing'] });
      setIsDeletingItem(false);
    },
    onError: () => {
      setIsDeletingItem(false);
    }
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      setIsDeletingItem(true);
      const response = await fetch(`/api/price-administration/additional-costs/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete cost');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/additional-costs'] });
      setIsDeletingItem(false);
    },
    onError: () => {
      setIsDeletingItem(false);
    }
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (id: string) => {
      setIsDeletingItem(true);
      const response = await fetch(`/api/price-administration/discounts/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete discount');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/discounts'] });
      setIsDeletingItem(false);
    },
    onError: () => {
      setIsDeletingItem(false);
    }
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      setIsDeletingItem(true);
      const response = await fetch(`/api/price-administration/quotes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/quotes'] });
      setIsDeletingItem(false);
    },
    onError: () => {
      setIsDeletingItem(false);
    }
  });

  const createCostMutation = useMutation({
    mutationFn: async (costData: any) => {
      const response = await fetch('/api/price-administration/additional-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(costData)
      });
      if (!response.ok) throw new Error('Failed to create cost');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/additional-costs'] });
      setCreateCostOpen(false);
      setCostForm({ name: '', description: '', type: 'fixed', amount: 0, category: '' });
      handleCostCreated(data);
    }
  });

  const createDiscountMutation = useMutation({
    mutationFn: async (discountData: any) => {
      const response = await fetch('/api/price-administration/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discountData)
      });
      if (!response.ok) throw new Error('Failed to create discount');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/discounts'] });
      setCreateDiscountOpen(false);
      setDiscountForm({ name: '', discountValue: 0, isPercentage: true, discountCode: '', validFrom: '', validTo: '', minPurchase: 0 });
      handleDiscountCreated(data);
    }
  });

  // Fetch travel logs
  const { data: travelLogsData, isLoading: travelLogsLoading } = useQuery({
    queryKey: ['/api/travel-log'],
  });

  const deleteTravelLogMutation = useMutation({
    mutationFn: async (id: string) => {
      setIsDeletingItem(true);
      const response = await fetch(`/api/travel-log/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete travel log');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/travel-log'] });
      setIsDeletingItem(false);
    },
    onError: () => {
      setIsDeletingItem(false);
    }
  });

  // Sync pricing data on component mount and data changes
  useEffect(() => {
    if (packagesData) {
      dataFlow.syncData('price-administration:packages', packagesData);
    }
    if (pricingData) {
      dataFlow.syncData('price-administration:pricing', pricingData);
    }
    if (categoriesData) {
      dataFlow.syncData('price-administration:categories', categoriesData);
    }
    if (quotesData) {
      dataFlow.syncData('price-administration:quotes', quotesData);
    }
    if (discountsData) {
      dataFlow.syncData('price-administration:discounts', discountsData);
    }
    if (costsData) {
      dataFlow.syncData('price-administration:costs', costsData);
    }
    if (travelLogsData) {
      dataFlow.syncData('price-administration:travel-logs', travelLogsData);
    }
  }, [dataFlow, packagesData, pricingData, categoriesData, quotesData, discountsData, costsData, travelLogsData]);

  // Enhanced handlers with integration broadcasting
  const handlePackageCreated = (packageData: any) => {
    console.log('💰 Package Created:', packageData);
    
    // Broadcast to other components (UniversalDashboard, UniversalShowcase, etc.)
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:packageCreated',
      priority: 'medium',
      data: {
        ...packageData,
        createdBy: 'price-administration',
        timestamp: Date.now()
      }
    });

    // Sync data flow for real-time updates across components
    dataFlow.syncData('price-administration:packages', packagesData ? [...(Array.isArray(packagesData) ? packagesData : []), packageData] : [packageData]);
    
    // Invalidate queries for data refresh
    queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages'] });
  };

  const handlePricingCreated = (pricingCreatedData: any) => {
    console.log('💰 Pricing Created:', pricingCreatedData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:pricingCreated',
      priority: 'medium',
      data: {
        ...pricingCreatedData,
        createdBy: 'price-administration',
        timestamp: Date.now()
      }
    });

    // Sync data flow
    dataFlow.syncData('price-administration:pricing', pricingData ? [...(Array.isArray(pricingData) ? pricingData : []), pricingCreatedData] : [pricingCreatedData]);
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['/api/price-administration/pricing'] });
  };

  const handleCategoryCreated = (categoryData: any) => {
    console.log('💰 Category Created:', categoryData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:categoryCreated',
      priority: 'medium',
      data: {
        ...categoryData,
        createdBy: 'price-administration',
        timestamp: Date.now()
      }
    });

    // Sync data flow
    dataFlow.syncData('price-administration:categories', categoriesData ? [...(Array.isArray(categoriesData) ? categoriesData : []), categoryData] : [categoryData]);
  };

  const handleQuoteGenerated = (quoteData: any) => {
    console.log('💰 Quote Generated:', quoteData);
    
    // Broadcast to other components - important for ContractHub, ClientManagement
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'quote:created',
      priority: 'high',
      data: {
        ...quoteData,
        generatedBy: 'price-administration',
        timestamp: Date.now()
      }
    });

    // Also broadcast to specific components that need quote data
    communication.sendMessage({
      from: 'price-administration',
      to: 'contract-hub',
      type: 'quote:available-for-contract',
      priority: 'medium',
      data: quoteData
    });

    // Sync data flow
    dataFlow.syncData('price-administration:quotes', quotesData ? [...(Array.isArray(quotesData) ? quotesData : []), quoteData] : [quoteData]);
    
    // Invalidate quotes query
    queryClient.invalidateQueries({ queryKey: ['/api/price-administration/quotes'] });
    
    // Notify project update if linked to a project
    if (quoteData.projectId && onProjectUpdate) {
      onProjectUpdate({ id: quoteData.projectId, hasQuote: true, quoteId: quoteData.id });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Broadcast tab change to other components
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:tabChanged',
      priority: 'low',
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
    setConfirmDelete({ open: true, type: 'package', id, label: 'pakken' });
  };

  const handleDeletePricing = (id: string) => {
    setConfirmDelete({ open: true, type: 'pricing', id, label: 'prisstrukturen' });
  };

  const handleDeleteCost = (id: string) => {
    setConfirmDelete({ open: true, type: 'cost', id, label: 'tilleggskostnaden' });
  };

  const handleDeleteDiscount = (id: string) => {
    setConfirmDelete({ open: true, type: 'discount', id, label: 'rabatten' });
  };

  const handleDeleteQuote = (id: string) => {
    setConfirmDelete({ open: true, type: 'quote', id, label: 'tilbudet' });
  };

  const handleDeleteTravelLog = (id: string) => {
    setConfirmDelete({ open: true, type: 'travelLog', id, label: 'kjøreturen' });
  };

  const executeDelete = () => {
    if (!confirmDelete.id) return;
    switch (confirmDelete.type) {
      case 'package': deletePackageMutation.mutate(confirmDelete.id); break;
      case 'pricing': deletePricingMutation.mutate(confirmDelete.id); break;
      case 'cost': deleteCostMutation.mutate(confirmDelete.id); break;
      case 'discount': deleteDiscountMutation.mutate(confirmDelete.id); break;
      case 'quote': deleteQuoteMutation.mutate(confirmDelete.id); break;
      case 'travelLog': deleteTravelLogMutation.mutate(confirmDelete.id); break;
    }
    setConfirmDelete({ open: false, type: '', id: null, label: '' });
  };

  const handleCostCreated = (costData: any) => {
    console.log('💰 Cost Created:', costData);
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:costCreated',
      priority: 'medium',
      data: { ...costData, createdBy: 'price-administration', timestamp: Date.now() }
    });
    // Sync data flow
    dataFlow.syncData('price-administration:costs', costsData ? [...(Array.isArray(costsData) ? costsData : []), costData] : [costData]);
  };

  const handleDiscountCreated = (discountData: any) => {
    console.log('💰 Discount Created:', discountData);
    communication.sendMessage({
      from: 'price-administration',
      to: 'all',
      type: 'pricing:discountCreated',
      priority: 'medium',
      data: { ...discountData, createdBy: 'price-administration', timestamp: Date.now() }
    });
    // Sync data flow
    dataFlow.syncData('price-administration:discounts', discountsData ? [...(Array.isArray(discountsData) ? discountsData : []), discountData] : [discountData]);
  };

  const handleCreateCost = () => {
    createCostMutation.mutate({
      ...costForm,
      userId: user?.id,
      createdAt: new Date().toISOString()
    });
  };

  const handleCreateDiscount = () => {
    createDiscountMutation.mutate({
      ...discountForm,
      userId: user?.id,
      createdAt: new Date().toISOString()
    });
  };

  const handleEditCost = (cost: any) => {
    setCostForm({
      name: cost.name || '',
      description: cost.description || '',
      type: cost.type || 'fixed',
      amount: cost.amount || 0,
      category: cost.category || ''
    });
    setSelectedItem(cost);
    setCreateCostOpen(true);
  };

  const handleEditDiscount = (discount: any) => {
    setDiscountForm({
      name: discount.name || '',
      discountValue: discount.discountValue || 0,
      isPercentage: discount.isPercentage ?? true,
      discountCode: discount.discountCode || '',
      validFrom: discount.validFrom || '',
      validTo: discount.validTo || '',
      minPurchase: discount.minPurchase || 0
    });
    setSelectedItem(discount);
    setCreateDiscountOpen(true);
  };

  // Report generation handlers
  const handleGeneratePriceReport = async () => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/price-administration/reports/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prisrapport-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to generate price report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGeneratePackageAnalysis = async () => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/price-administration/reports/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pakkeanalyse-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to generate package analysis:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGenerateQuoteReport = async () => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/price-administration/reports/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tilbudsrapport-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to generate quote report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportAll = async () => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/price-administration/reports/export-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prisadministrasjon-eksport-${new Date().toISOString().split('T')[0]}.zip`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export all data:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Use centralized currency formatting
  const formatPrice = (price: string | number) => {
    try {
      const numPrice = parseFloat(price.toString());
      if (isNaN(numPrice)) return '0 NOK';
      return formatCurrency(numPrice, 'NOK');
    } catch (_error) {
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

  // Helper function for vehicle info fetch
  const fetchVehicleInfo = async (regNumber: string) => {
    try {
      const response = await fetch(`/api/vehicle-info/${regNumber}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch vehicle info:', error);
    }
    return null;
  };

  // Helper function for toll calculation
  const calculateTollFees = async (fromAddress: string, toAddress: string) => {
    try {
      const response = await fetch('/api/calculate-toll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAddress, toAddress })
      });
      if (response.ok) {
        const data = await response.json();
        return data.totalTolls || 0;
      }
    } catch (error) {
      console.error('Failed to calculate toll fees:', error);
    }
    return 0;
  };

  // Helper function for extra destinations
  const updateExtraDestination = (index: number, value: string) => {
    setTravelLogForm(prev => {
      const newDestinations = [...prev.extraDestinations];
      newDestinations[index] = value;
      return { ...prev, extraDestinations: newDestinations };
    });
  };

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.default' }}>
      {/* Simple Header */}
      <Box sx={{ mb: 4, pb: 2, borderBottom: '2px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Administrer standardpakker, prisstrukturer, rabatter og generer tilbud
        </Typography>
      </Box>

      {/* Navigation Tabs */}
      <Paper 
        elevation={0} 
        sx={{ 
          mb: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          ...theming.getThemedCardSx() 
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            pt: 2,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              minHeight: 56,
              px: 3,
              gap: 1.5,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: theming.colors.primary,
                fontWeight: 700
              },
              '&:hover': {
                bgcolor: 'action.hover',
                borderRadius: '8px 8px 0 0'
              }
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              backgroundColor: theming.colors.primary
            }
        }}
        >
          <Tab icon={<CategoryIcon />} iconPosition="start" label="Standardpakker" />
          <Tab icon={<PriceIcon />} iconPosition="start" label="Prisstrukturer" />
          <Tab icon={<AddIcon />} iconPosition="start" label="Tilleggskostnader" />
          <Tab icon={<TravelIcon />} iconPosition="start" label="Kjørebok & Reise" />
          <Tab icon={<DiscountIcon />} iconPosition="start" label="Rabatter" />
          <Tab icon={<QuoteIcon />} iconPosition="start" label="Tilbud" />
          <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analyse & Rapporter" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      
      {/* Standard Packages */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'primary.50',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CategoryIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
                {_professionConfig ? `${_professionConfig.displayName} - Standardpakker` : 'Standardpakker'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Opprett og administrer standardiserte prispakker
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={() => setCreateCategoryOpen(true)}
              sx={{ 
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Legg til kategori
            </Button>
            <Button
  variant="contained"
  startIcon={<AddIcon />}
  onClick={() => {
    setSelectedItem(null);
    setCreatePackageOpen(true);
  }}
  sx={{
    ...theming.getThemedButtonSx(),
    borderRadius: 2,
    px: 3,
    py: 1.25,
    fontWeight: 700,
    textTransform: 'none',
    boxShadow: 2,
    '&:hover': {
      boxShadow: 4
    }
  }}
>
              Ny pakke
            </Button>
          </Box>
        </Box>

        {packagesLoading ? (
          <Alert severity="info">Laster standardpakker...</Alert>
        ) : (
          <Grid2 container spacing={3}>
            {(Array.isArray(packagesData) ? packagesData : ((packagesData as any)?.packages) || [])?.map((pkg: any) => (
              <Grid2 size={{ xs: 12, md: 6, lg: 4 }} key={pkg.id}>
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
                    
                    <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 700, fontSize: '1.25rem' }}>
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
              </Grid2>
            ))}
          </Grid2>
        )}
      </TabPanel>

      {/* Pricing Structures */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700, fontSize: '1.25rem' }}>
            {_professionConfig ? `${_professionConfig.displayName} - Prisstrukturer` : 'Prisstrukturer'}
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

        {pricingDataLoading ? (
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
                {((Array.isArray(pricingData) ? pricingData : ((pricingData as any)?.pricing)) || [])?.map((pricing: any) => (
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
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeletePricing(pricing.id)}
                        color="error"
                        disabled={isDeletingItem}
                      >
                        <DeleteIcon fontSize="small" />
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
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'warning.50',
                color: 'warning.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AddIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {_professionConfig ? `${_professionConfig.displayName} - Tilleggskostnader` : 'Tilleggskostnader'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Håndter ekstra kostnader og tillegg
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedItem(null);
              setCostForm({ name: '', description: '', type: 'fixed', amount: 0, category: '' });
              setCreateCostOpen(true);
            }}
            sx={{
              ...theming.getThemedButtonSx(),
              borderRadius: 2,
              px: 3,
              py: 1.25,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 2,
              '&:hover': { boxShadow: 4 }
            }}
          >
            Ny tilleggskostnad
          </Button>
        </Box>

        {costsLoading ? (
          <Alert severity="info">Laster tilleggskostnader...</Alert>
        ) : (
          <Grid2 container spacing={2}>
            {((Array.isArray(costsData) ? costsData : ((costsData as any)?.costs)) || [])?.map((cost: any) => (
              <Grid2 size={{ xs: 12, md:  6 }} key={cost.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{cost.name}</Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleEditCost(cost)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteCost(cost.id)} color="error" disabled={isDeletingItem}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {cost.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Chip label={cost.type} size="small" />
                      {cost.amount && <Chip label={formatPrice(cost.amount)} size="small" color="primary" />}
                    </Box>
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
        )}
      </TabPanel>

      {/* Travel & Mileage */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'info.50',
                color: 'info.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TravelIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {_professionConfig ? `${_professionConfig.displayName} - Kjørebok & Reisekostnader` : 'Kjørebok & Reisekostnader'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Automatisk GPS-basert kjørebok med norske satser for {_professionConfig ? _professionConfig.displayName.toLowerCase() : 'profesjonelle'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Grid2 container spacing={3}>
          {/* Mileage Settings */}
          <Grid2 size={{ xs:  12, md:  6 }}>
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
          </Grid2>

          {/* Fuel & Charging Costs */}
          <Grid2 size={{ xs:  12, md:  6 }}>
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
          </Grid2>

          {/* Norwegian-specific costs */}
          <Grid2 size={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Norskspesifikke kostnader</Typography>
                
                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs:  12, md:  4 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Bompenger</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatisk registrering av bompasseringer basert på GPS-rute
                      </Typography>
                      <Chip label={`Gjennomsnitt: ${getMarketRates().tolls.range.min}-${getMarketRates().tolls.range.max} kr`} size="small" sx={{ mt: 1 }} />
                    </Box>
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, md:  4 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Ferge</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Automatisk beregning av fergekostnader på norske ruter
                      </Typography>
                      <Chip label={`Varierer: ${getMarketRates().ferries.range.min}-${getMarketRates().ferries.range.max} kr`} size="small" sx={{ mt: 1 }} />
                    </Box>
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, md:  4 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Parkering</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Parkering ved oppdragssteder med kvitteringsscanning
                      </Typography>
                      <Chip label={`Bysentrum: ${getMarketRates().parking.city_center.min}-${getMarketRates().parking.city_center.max} kr/t`} size="small" sx={{ mt: 1 }} />
                    </Box>
                  </Grid2>
                </Grid2>

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
          </Grid2>

          {/* Manual Travel Log Entry */}
          <Grid2 size={12}>
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
  <Typography variant="subtitle2" color="success.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <PriceIcon fontSize="small" /> Siste kostnadsberegning
  </Typography>
  <Typography variant="body2">{calculateTravelCost.breakdown}</Typography>
</Paper>
                )}
              </CardContent>
            </Card>
          </Grid2>

          {/* Travel Log History */}
          <Grid2 size={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <RouteIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Kjørelogg historikk
                    </Typography>
                  </Box>
                </Box>

                {travelLogsLoading ? (
                  <Alert severity="info">Laster kjørelogg...</Alert>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Dato</TableCell>
                          <TableCell>Beskrivelse</TableCell>
                          <TableCell>Fra</TableCell>
                          <TableCell>Til</TableCell>
                          <TableCell align="right">Km</TableCell>
                          <TableCell align="right">Bompenger</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Handlinger</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {((Array.isArray(travelLogsData) ? travelLogsData : ((travelLogsData as any)?.logs)) || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                                Ingen kjøreturer registrert ennå. Klikk "Ny kjøretur" for å komme i gang.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          ((Array.isArray(travelLogsData) ? travelLogsData : ((travelLogsData as any)?.logs)) || []).map((log: any) => (
                            <TableRow key={log.id} hover>
                              <TableCell>{new Date(log.date).toLocaleDateString('nb-NO')}</TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {log.description || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {log.fromAddress}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {log.toAddress}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{log.kilometers} km</TableCell>
                              <TableCell align="right">{formatPrice(log.tollFees || 0)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>{formatPrice(log.calculatedCost || 0)}</TableCell>
                              <TableCell align="right">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteTravelLog(log.id)}
                                  color="error"
                                  disabled={isDeletingItem}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid2>

          {/* Receipt OCR Scanner */}
          <Grid2 size={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <ReceiptIcon sx={{ color: 'primary.main'}} />
                  OCR Kvitteringsscanning
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                  Automatisk scanning av kvitteringer med Tesseract.js OCR - fungerer både på mobil og desktop
                </Typography>

                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs:  12, md:  6 }}>
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
                        capture
                        style={{ display: 'none'}}
                        id="camera-capture"
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            _handleReceiptScan(file, 'camera');
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
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, md:  6 }}>
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
                            _handleReceiptScan(file, 'upload');
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
                  </Grid2>
                </Grid2>

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

                  <Grid2 container spacing={2}>
                    {scannedReceipts.length === 0 ? (
                      <Grid2 size={12}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50', ...theming.getThemedCardSx() }}>
                          <ScanIcon sx={{ fontSize:  32, color: 'grey.40', mb:  1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Scannede kvitteringer vil vises her med ekstrahert informasjon
                          </Typography>
                        </Paper>
                      </Grid2>
                    ) : (
                      scannedReceipts.map((receipt) => (
                        <Grid2 size={{ xs:  12, md:  6 }} key={receipt.id}>
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
                              
                              <Typography variant="h6" color="success.main" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 700, fontSize: '1.25rem' }}>
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
                            } catch {
                              // Silently handle API errors
                            
          // Silently handle analytics tracking errors
        }
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
                        </Grid2>
                      ))
                    )}
                  </Grid2>
                </Box>
              </CardContent>
            </Card>
          </Grid2>
        </Grid2>
      </TabPanel>

      {/* Discounts */}
      <TabPanel value={tabValue} index={4}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'success.50',
                color: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <DiscountIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {_professionConfig ? `${_professionConfig.displayName} - Rabatter` : 'Rabatter'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Administrer rabatter og kampanjer
              </Typography>
            </Box>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedItem(null);
              setDiscountForm({ name: '', discountValue: 0, isPercentage: true, discountCode: '', validFrom: '', validTo: '', minPurchase: 0 });
              setCreateDiscountOpen(true);
            }}
            sx={{
              ...theming.getThemedButtonSx(),
              borderRadius: 2,
              px: 3,
              py: 1.25,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 2,
              '&:hover': { boxShadow: 4 }
            }}
          >
            Ny rabatt
          </Button>
        </Box>

        {discountsLoading ? (
          <Alert severity="info">Laster rabatter...</Alert>
        ) : (
          <Grid2 container spacing={2}>
            {((Array.isArray(discountsData) ? discountsData : ((discountsData as any)?.discounts)) || [])?.map((discount: any) => (
              <Grid2 size={{ xs: 12, md:  6 }} key={discount.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{discount.name}</Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleEditDiscount(discount)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteDiscount(discount.id)} color="error" disabled={isDeletingItem}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary, fontWeight: 700, fontSize: '1.25rem' }}>
                      {discount.isPercentage 
                        ? `${discount.discountValue}%` 
                        : formatPrice(discount.discountValue)
                      }
                    </Typography>
                    {discount.discountCode && (
                      <Chip 
                        label={`Kode: ${discount.discountCode}`}
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
        )}
      </TabPanel>

      {/* Quotes */}
      <TabPanel value={tabValue} index={5}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'secondary.50',
                color: 'secondary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <QuoteIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {_professionConfig ? `${_professionConfig.displayName} - Tilbud` : 'Tilbud'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Opprett og administrer tilbud til kunder
              </Typography>
            </Box>
          </Box>
          <Button 
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setQuoteGeneratorOpen(true)}
            sx={{
              ...theming.getThemedButtonSx(),
              borderRadius: 2,
              px: 3,
              py: 1.25,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 2,
              '&:hover': { boxShadow: 4 }
            }}
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
                {((Array.isArray(quotesData) ? quotesData : ((quotesData as any)?.quotes)) || [])?.map((quote: any) => (
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
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
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
                                priority: 'medium',
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
                                  priority: 'medium',
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
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteQuote(quote.id)}
                          color="error"
                          disabled={isDeletingItem}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Analytics & Reports */}
      <TabPanel value={tabValue} index={6}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          mb: 4,
          pb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'info.50',
                color: 'info.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AnalyticsIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Analyse & Rapporter
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Innsikt i prising og økonomi
              </Typography>
            </Box>
          </Box>
        </Box>

        <Grid2 container spacing={3}>
          {/* Revenue Overview */}
          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: 2.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon sx={{ fontSize: 32, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Total omsetning</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {formatPrice(0)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Basert på alle tilbud og pakker
              </Typography>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                borderRadius: 2.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CategoryIcon sx={{ fontSize: 32, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Aktive pakker</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {(Array.isArray(packagesData) ? packagesData : ((packagesData as any)?.packages) || []).length}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Standardpakker tilgjengelig
              </Typography>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                borderRadius: 2.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <QuoteIcon sx={{ fontSize: 32, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Tilbud sendt</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                {(Array.isArray(quotesData) ? quotesData : ((quotesData as any)?.quotes) || []).length}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Totalt antall tilbud
              </Typography>
            </Card>
          </Grid2>

          {/* Reports Section */}
          <Grid2 size={12}>
            <Card
              sx={{
                p: 3,
                borderRadius: 2.5,
                bgcolor: 'white',
                boxShadow: 2
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Rapporter
              </Typography>
              <Grid2 container spacing={2}>
                <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DescriptionIcon />}
                    onClick={handleGeneratePriceReport}
                    disabled={isGeneratingReport}
                    sx={{
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    {isGeneratingReport ? 'Genererer...' : 'Prisrapport'}
                  </Button>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DescriptionIcon />}
                    onClick={handleGeneratePackageAnalysis}
                    disabled={isGeneratingReport}
                    sx={{
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    {isGeneratingReport ? 'Genererer...' : 'Pakkeanalyse'}
                  </Button>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DescriptionIcon />}
                    onClick={handleGenerateQuoteReport}
                    disabled={isGeneratingReport}
                    sx={{
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    {isGeneratingReport ? 'Genererer...' : 'Tilbudsrapport'}
                  </Button>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DescriptionIcon />}
                    onClick={handleExportAll}
                    disabled={isGeneratingReport}
                    sx={{
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    {isGeneratingReport ? 'Eksporterer...' : 'Eksporter alt'}
                  </Button>
                </Grid2>
              </Grid2>
            </Card>
          </Grid2>
        </Grid2>
      </TabPanel>

      {/* Modals */}
      <CreatePackageModal
        open={createPackageOpen}
        onClose={() => {
          setCreatePackageOpen(false);
          setSelectedItem(null);
        }}
        editData={selectedItem}
        categories={(Array.isArray(categoriesData) ? categoriesData : ((categoriesData as any)?.categories)) || []}
        onPackageSaved={handlePackageCreated}
      />

      <CreatePricingModal
        open={createPricingOpen}
        onClose={() => {
          setCreatePricingOpen(false);
          setSelectedItem(null);
        }}
        editData={selectedItem}
        onPricingSaved={handlePricingCreated}
      />

      <CreateCategoryModal
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        onCategoryCreated={handleCategoryCreated}
      />

      <QuoteGeneratorModal
        open={quoteGeneratorOpen}
        onClose={() => setQuoteGeneratorOpen(false)}
        packages={(Array.isArray(packagesData) ? packagesData : ((packagesData as any)?.packages)) || []}
        pricing={(Array.isArray(pricingData) ? pricingData : ((pricingData as any)?.pricing)) || []}
        additionalCosts={(Array.isArray(costsData) ? costsData : ((costsData as any)?.costs)) || []}
        discounts={(Array.isArray(discountsData) ? discountsData : ((discountsData as any)?.discounts)) || []}
        onQuoteGenerated={handleQuoteGenerated}
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
                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs:  12, sm:  6 }}>
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
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, sm:  6 }}>
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
                  </Grid2>

                  {travelLogForm.selectedVehicleData && (
                    <Grid2 size={12}>
                      <Card variant="outlined" sx={{ bgcolor: 'success.5', border: '1px solid', borderColor: 'success.200', ...theming.getThemedCardSx() }}>
                        <CardContent sx={{ py: 2, ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2" color="success.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon fontSize="small" /> Kjøretøy verifisert via Statens Vegvesen
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
                    </Grid2>
                  )}
                  
                  <Grid2 size={{ xs:  12, sm:  6 }}>
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
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, sm:  6 }}>
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
                  </Grid2>
                  
                  <Grid2 size={12}>
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
                  </Grid2>
                </Grid2>
              </AccordionDetails>
            </Accordion>

            {/* Route Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Strekning</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs:  12, sm:  5 }}>
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
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, sm:  5 }}>
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
                  </Grid2>

                  <Grid2 size={{ xs: 12, sm: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setTollCalculationOpen(true)}
                      disabled={!travelLogForm.fromAddress || !travelLogForm.toAddress}
                      sx={{ ...theming.getThemedButtonSx(), height: '56px', width: '100%' }}
                      startIcon={<RouteIcon />}
                    >
                      Beregn bompenger kostnader
                    </Button>
                  </Grid2>

                  {tollCalculationResult?.success && (
                    <Grid2 size={12}>
                      <Alert severity="success">
                        <Typography variant="body2">
                          <strong>Bompengeberegning: </strong> {tollCalculationResult.calculation.totalTolls} kr • 
                          <strong>Distanse: </strong> {tollCalculationResult.calculation.totalDistance} km • 
                          <strong>Bomstasjoner: </strong> {tollCalculationResult.calculation.tollStations?.length || 0}
                        </Typography>
                      </Alert>
                    </Grid2>
                  )}
                  
                  {/* Extra Destinations */}
                  {travelLogForm.extraDestinations.map((destination, index) => (
                    <Grid2 size={12} key={index}>
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
                    </Grid2>
                  ))}
                  
                  <Grid2 size={12}>
                    <Button
                      startIcon={theming.getThemedIcon('addCircle')}
                      onClick={addExtraDestination}
                      variant="outlined"
                      size="small"
                    >
                      Legg til ekstra destinasjon
                    </Button>
                  </Grid2>
                  
                  <Grid2 size={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={travelLogForm.returnTrip}
                          onChange={(e) => setTravelLogForm(prev => ({ ...prev, returnTrip: e.target.checked }))}
                        />
                  }
                      label="Samme strekning ble kjørt i retur (beregner automatisk dobbel distanse)"
                    />
                  </Grid2>
                </Grid2>
              </AccordionDetails>
            </Accordion>

            {/* Cost Calculation Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kostnadsberegning</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs:  12, sm:  4 }}>
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
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, sm:  4 }}>
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
                  </Grid2>
                  
                  <Grid2 size={{ xs:  12, sm:  4 }}>
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
                  </Grid2>
                  
                  <Grid2 size={12}>
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
                  </Grid2>
                </Grid2>
                
                {/* Cost Summary */}
                {calculateTravelCost.totalKm > 0 && (
                  <Paper sx={{ mt: 3, p: 2, bgcolor: 'primary.5', border: '1px solid', borderColor: 'primary.200', ...theming.getThemedCardSx() }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                      <CalculateIcon sx={{ mr: 1, color: 'primary.main'}} />
                      <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600 }}>
                        Kostnadsoversikt
                      </Typography>
                    </Box>
                    
                    <Grid2 container spacing={2}>
                      <Grid2 size={{ xs:  12, sm:  6 }}>
                        <Typography variant="body2">
                        <strong>Kjørelengde: </strong> {calculateTravelCost.totalKm} km
                        </Typography>
                        <Typography variant="body2">
                          <strong>Kjøregodtgjørelse: </strong> {calculateTravelCost.kmCost.toFixed()} NOK
                        </Typography>
                      </Grid2>
                      <Grid2 size={{ xs:  12, sm:  6 }}>
                        <Typography variant="body2">
                          <strong>Bompenger: </strong> {travelLogForm.tollFees.toFixed(2)} NOK
                        </Typography>
                        <Typography variant="body2">
                          <strong>Tilleggssatser: </strong> {travelLogForm.additionalFees.toFixed()} NOK
                        </Typography>
                      </Grid2>
                    </Grid2>
                    
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

      {/* Create/Edit Cost Dialog */}
      <Dialog 
        open={createCostOpen}
        onClose={() => {
          setCreateCostOpen(false);
          setSelectedItem(null);
          setCostForm({ name: '', description: '', type: 'fixed', amount: 0, category: '' });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AddIcon sx={{ mr: 2, color: 'primary.main' }} />
            {selectedItem ? 'Rediger tilleggskostnad' : 'Ny tilleggskostnad'}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Navn"
              value={costForm.name}
              onChange={(e) => setCostForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="F.eks. Reisekostnader, Utstyrleie"
            />
            <TextField
              fullWidth
              label="Beskrivelse"
              multiline
              rows={2}
              value={costForm.description}
              onChange={(e) => setCostForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beskriv tilleggskostnaden"
            />
            <TextField
              fullWidth
              label="Type"
              select
              value={costForm.type}
              onChange={(e) => setCostForm(prev => ({ ...prev, type: e.target.value }))}
            >
              <MenuItem value="fixed">Fast beløp</MenuItem>
              <MenuItem value="percentage">Prosent</MenuItem>
              <MenuItem value="per_hour">Per time</MenuItem>
              <MenuItem value="per_item">Per enhet</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Beløp"
              type="number"
              value={costForm.amount}
              onChange={(e) => setCostForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              InputProps={{
                endAdornment: <Typography sx={{ color: 'text.secondary' }}>{costForm.type === 'percentage' ? '%' : 'kr'}</Typography>
              }}
            />
            <TextField
              fullWidth
              label="Kategori (valgfritt)"
              value={costForm.category}
              onChange={(e) => setCostForm(prev => ({ ...prev, category: e.target.value }))}
              placeholder="F.eks. Reise, Utstyr, Materialer"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateCostOpen(false);
            setSelectedItem(null);
            setCostForm({ name: '', description: '', type: 'fixed', amount: 0, category: '' });
          }}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateCost}
            disabled={!costForm.name || createCostMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {createCostMutation.isPending ? 'Lagrer...' : selectedItem ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Discount Dialog */}
      <Dialog 
        open={createDiscountOpen}
        onClose={() => {
          setCreateDiscountOpen(false);
          setSelectedItem(null);
          setDiscountForm({ name: '', discountValue: 0, isPercentage: true, discountCode: '', validFrom: '', validTo: '', minPurchase: 0 });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DiscountIcon sx={{ mr: 2, color: 'primary.main' }} />
            {selectedItem ? 'Rediger rabatt' : 'Ny rabatt'}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Navn"
              value={discountForm.name}
              onChange={(e) => setDiscountForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="F.eks. Returkunde-rabatt, Kampanje"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Rabattverdi"
                type="number"
                value={discountForm.discountValue}
                onChange={(e) => setDiscountForm(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                InputProps={{
                  endAdornment: <Typography sx={{ color: 'text.secondary' }}>{discountForm.isPercentage ? '%' : 'kr'}</Typography>
                }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={discountForm.isPercentage}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, isPercentage: e.target.checked }))}
                  />
                }
                label="Prosent"
                sx={{ minWidth: 120 }}
              />
            </Box>
            <TextField
              fullWidth
              label="Rabattkode (valgfritt)"
              value={discountForm.discountCode}
              onChange={(e) => setDiscountForm(prev => ({ ...prev, discountCode: e.target.value.toUpperCase() }))}
              placeholder="F.eks. SOMMAR25"
            />
            <Grid2 container spacing={2}>
              <Grid2 size={6}>
                <TextField
                  fullWidth
                  label="Gyldig fra"
                  type="date"
                  value={discountForm.validFrom}
                  onChange={(e) => setDiscountForm(prev => ({ ...prev, validFrom: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid2>
              <Grid2 size={6}>
                <TextField
                  fullWidth
                  label="Gyldig til"
                  type="date"
                  value={discountForm.validTo}
                  onChange={(e) => setDiscountForm(prev => ({ ...prev, validTo: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid2>
            </Grid2>
            <TextField
              fullWidth
              label="Minimumskjøp (valgfritt)"
              type="number"
              value={discountForm.minPurchase}
              onChange={(e) => setDiscountForm(prev => ({ ...prev, minPurchase: parseFloat(e.target.value) || 0 }))}
              InputProps={{
                endAdornment: <Typography sx={{ color: 'text.secondary' }}>kr</Typography>
              }}
              helperText="Rabatten gjelder kun for kjøp over dette beløpet"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDiscountOpen(false);
            setSelectedItem(null);
            setDiscountForm({ name: '', discountValue: 0, isPercentage: true, discountCode: '', validFrom: '', validTo: '', minPurchase: 0 });
          }}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateDiscount}
            disabled={!discountForm.name || createDiscountMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {createDiscountMutation.isPending ? 'Lagrer...' : selectedItem ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, type: '', id: null, label: '' })}
      >
        <DialogTitle>Bekreft Sletting</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Er du sikker på at du vil slette denne {confirmDelete.label}? Denne handlingen kan ikke angres.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete({ open: false, type: '', id: null, label: '' })}>
            Avbryt
          </Button>
          <Button onClick={executeDelete} color="error" variant="contained">
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
);
};

export default PriceAdministration;
