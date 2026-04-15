// @ts-nocheck
/**
 * Universal Onboarding med Kamera og Flash System Integrasjon
 * CreatorHub Norge - Sømløs integrasjon av utstyrsvalg i onboarding-prosessen
 * Koblet til Universal Dashboard profession adapter
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../utils/theming-helper';
import { useExternalData } from '../services/ExternalDataService';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Autocomplete,
  CircularProgress,
  Alert,
  Fade,
  Collapse,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tooltip,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  FlashOn as FlashIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  CloudSync as CloudIcon,
  Share as SocialIcon,
  Palette as BrandingIcon,
  Settings as WorkflowIcon,
  Launch as LaunchIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  LibraryMusic as MusicIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system  
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { useEnhancedPersonas } from './universal/hooks/useEnhancedPersonas';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
// Import pricing services
import { usePlatformPricing } from '../services/PlatformPricingService';
import { useClientServicePricing } from '../services/ClientServicePricingService';
// Import Google Pay
import GooglePayButton from '@/components/payment/GooglePayButton';

// Dynamic profession configurations loaded from database via useProfessionConfigs hook

interface Camera {
  id: string;
  brand: string;
  model: string;
  mount: string;
  type: string; // dslr, mirrorless, cinema, etc.
  firmwareVersion?: string;
  description?: string;
  features: string[];
  compatibility: string[]
}

interface FlashSystem {
  id: string;
  brand: string;
  model: string;
  type: string; // ttl, manual, studio, speedlight
  compatibility: string[];
  powerOutput?: string;
  features: string[];
  description?: string
}

interface AudioInterface {
  id: string;
  brand: string;
  model: string;
  type: string; // usb, thunderbolt, firewire, pcie
  inputs: number;
  outputs: number;
  preamps: number;
  maxSampleRate: string;
  bitDepth: string[];
  features: string[];
  description: string;
  compatibility: string[]; // M, acPC, iOS, Android
}

interface StudioMonitor {
  id: string;
  brand: string;
  model: string;
  type: string; // nearfield, midfield, farfield, subwoofer
  size: string; // driver size
  powerOutput: string;
  frequencyResponse: string;
  features: string[];
  description: string;
  placement: string[]; // desktop, stand, wall-mount
}

interface Microphone {
  id: string;
  brand: string;
  model: string;
  type: string; // condenser, dynamic, ribbon, lavalier
  pattern: string; // cardioid, omnidirectional, bidirectional
  connector: string; // XR, USB, 3.5mm, Lightning
  phantomPower: boolean;
  frequencyResponse: string;
  features: string[];
  description: string;
  applications: string[]; // vocal, instrument, broadcast, streaming
}

interface MIDIController {
  id: string;
  brand: string;
  model: string;
  type: string; // keyboard, pad, control-surface, hybrid
  keys?: number;
  pads?: number;
  knobs?: number;
  faders?: number;
  connectivity: string[]; // UB, MIDI DIN, Bluetooth, WiFi
  features: string[];
  description: string;
  compatibility: string[]
}

interface OnboardingData {
  profession: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  whyStatement?: string;
  howStatement?: string;
  whatStatement?: string;
  // Obligatoriske bedriftsinformasjon for norske brukere
  companyName: string;
  organizationNumber: string;
  businessAddress: string;
  website?: string;
  customLogo?: string;
  selectedCameras: Camera[];
  selectedFlashSystems: FlashSystem[];
  // Studio equipment for music producers
  selectedAudioInterfaces: AudioInterface[];
  selectedStudioMonitors: StudioMonitor[];
  selectedMicrophones: Microphone[];
  selectedMIDIControllers: MIDIController[];
  cloudProvider: string; // google, microsoft, other
  socialMediaAccounts: {
    instagram: string;
    facebook: string;
    linkedin: string;
    youtube: string;
    website: string;
};
  brandingSettings: {
    primaryColor: string;
    logo?: File;
    businessType: string;
};
  workflowPreferences: {
    projectTypes: string[];
    communicationStyle: string;
    deliveryPreferences: string[];
};
}

// Onboarding steps configuration
const getStepsForProfession = (profession: string) => {
  if (profession === 'enterprise') {
    return [
      'Profesjonsvalg', 'Team-profil', 'Hvorfor, Hvordan, Hva', 'Teammedlemmer', 'Kamera- og Utstyrssystem', 'Cloud Integrering', 'Sosiale Medier', 'Branding Setup', 'Arbeidsflyt Konfigurasjon', 'Velg Abonnement'
    ];
  }
  const baseSteps = [
    'Profesjonsvalg', 'Profildetaljer', 'Hvorfor, Hvordan, Hva', 'Kamera- og Utstyrssystem', 'Cloud Integrering', 'Sosiale Medier', 'Branding Setup', 'Arbeidsflyt Konfigurasjon', 'Velg Abonnement' // New payment/subscription step
  ];
  
  return baseSteps;
};

export default function UniversalOnboarding({ isOpen: open = true, onClose = () => {}, profession = 'photographer' }) {
  const queryClient = useQueryClient();
  
  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, auth, features, analytics } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value  
  const theming = useTheming(profession || 'photographer,');
  
  // External Data Service integration for location-based recommendations
  const { 
    getCurrentWeather,
    getWeatherForecast,
    getKartverketAddress,
    searchKartverketPlaceNames,
    calculateTravelCosts,
    getSSBEconomicIndicators,
    getSSBPopulationData,
    getProffCompanyData
  } = useExternalData();
  
  // Comprehensive Feature System for Universal Onboarding
  const onboardingAccess = features.checkFeatureAccess('universal-onboarding,');
  const professionSelectionAccess = features.checkFeatureAccess('profession-selection, ');
  const profileSetupAccess = features.checkFeatureAccess('profile-setup');
  const workspaceConfigurationAccess = features.checkFeatureAccess('workspace-configuration');
  const tutorialAccess = features.checkFeatureAccess('tutorial-system');
  const featureDiscoveryAccess = features.checkFeatureAccess('feature-discovery');
  const guidedTourAccess = features.checkFeatureAccess('guided-tour');
  const welcomeExperienceAccess = features.checkFeatureAccess('welcome-experience');
  
  // Use dynamic profession system (for basic profession data)
  const { professionConfigs: dynamicProfessionConfigs, isLoading: professionsLoading, error: professionsError, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  
  // Use dashboard profession configs (for full dashboard configuration from wizard)
  const { professionConfigs: dashboardProfessionConfigs, hasData: hasDashboardConfigs } = useProfessionConfigs();
  
  // Merge both config sources: dashboard configs take priority if available
  const professionConfigs = hasDashboardConfigs ? dashboardProfessionConfigs : dynamicProfessionConfigs;
  
  // Use enhanced personas system
  const { 
    personaConfigs, 
    isLoading: personasLoading, 
    getPersonaById, 
    getRecommendedPersonas,
    getPersonaInsights 
  } = useEnhancedPersonas();

  // Platform pricing service integration
  const { 
    subscriptionPlans, 
    formatPrice: formatPlatformPrice,
    isLoading: platformPricingLoading 
} = usePlatformPricing();

  // Client service pricing service integration
  const { 
    formatCurrency
  } = useClientServicePricing();
  
  // Check for pending onboarding data from landing page submission
  const [pendingData, setPendingData] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/kv/pendingOnboardingData', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (mounted && v) {
          setPendingData(v);
          // Clear server copy
          fetch('/api/user/kv', {
            method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
            body: JSON.stringify({ key: 'pendingOnboardingData', value: null })
          }).catch(() => {});
        } else {
          const stored = localStorage.getItem('pendingOnboardingData');
          if (stored) {
            setPendingData(JSON.parse(stored));
            localStorage.removeItem('pendingOnboardingData');
          }
        }
      } catch {
        const stored = localStorage.getItem('pendingOnboardingData');
        if (stored) {
          setPendingData(JSON.parse(stored));
          localStorage.removeItem('pendingOnboardingData');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [activeStep, setActiveStep] = useState(pendingData ? 1 : 0); // Skip profession selection if coming from form

  // Location-based recommendations state
  const [locationRecommendations, setLocationRecommendations] = useState<any>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  
  const [orgValidationState, setOrgValidationState] = useState({
    loading: false,
    validated: false,
    error: null as string | null,
    companyData: null as any
  });
  
  // Proff.no financial data state
  const [proffData, setProffData] = useState<any>(null);
  const [proffLoading, setProffLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    profession: pendingData?.profession || profession,
    firstName: pendingData?.firstName ||'',
    lastName: pendingData?.lastName ||'',
    email: pendingData?.email ||'',
    phone: pendingData?.phone ||'',
    business: pendingData?.business ||'',
    whyStatement: pendingData?.whyStatement || '',
    howStatement: pendingData?.howStatement || '',
    whatStatement: pendingData?.whatStatement || '',
    companyName: pendingData?.business ||'',
    organizationNumber: pendingData?.organizationNumber ||'',
    businessAddress: pendingData?.businessAddress ||'',
    website: pendingData?.website ||'',
    selectedCameras:  [],
    selectedFlashSystems:  [],
    selectedAudioInterfaces:  [],
    selectedStudioMonitors:  [],
    selectedMicrophones:  [],
    selectedMIDIControllers:  [],
    cloudProvider: '',
    socialMediaAccounts: {
      instagram: '',
      facebook: '',
      linkedin: '',
      youtube: '',
      website: pendingData?.website || ''
},
    brandingSettings: {
      primaryColor: professionConfigs?.[pendingData?.profession || profession]?.iconColor || '#ff8c00',
      businessType: ''
},
    customLogo: '',
    workflowPreferences: {
      projectTypes: [],
      communicationStyle: 'professional',
      deliveryPreferences: []
}
});

  const [cameraSearchQuery, setCameraSearchQuery] = useState('');
  const [flashSearchQuery, setFlashSearchQuery] = useState('');
  const [audioInterfaceSearchQuery, setAudioInterfaceSearchQuery] = useState('');
  const [studioMonitorSearchQuery, setStudioMonitorSearchQuery] = useState('');
  const [microphoneSearchQuery, setMicrophoneSearchQuery] = useState('');
  const [midiControllerSearchQuery, setMidiControllerSearchQuery] = useState('');
  const [equipmentTabValue, setEquipmentTabValue] = useState(0);
  
  // Location-based recommendations functions
  const fetchLocationRecommendations = async () => {
    setLocationLoading(true);
    try {
      // Get user's location (default to Oslo if not available)
      const defaultLocation = { lat: 59.9139, lng: 10.7522 }; // Oslo coordinates
      setUserLocation(defaultLocation);
      
      // Fetch current weather
      const weatherData = await getCurrentWeather({ 
        lat: defaultLocation.lat, 
        lon: defaultLocation.lng 
      });
      
      // Fetch weather forecast
      const weatherForecast = await getWeatherForecast({ 
        lat: defaultLocation.lat, 
        lon: defaultLocation.lng,
        days: 7
      });
      
      // ⭐ Fetch SSB economic indicators
      const economicData = await getSSBEconomicIndicators({ 
        region: 'Oslo'
      });
      
      // ⭐ Fetch SSB population data
      const populationData = await getSSBPopulationData({ 
        region: 'Oslo',
        year: new Date().getFullYear().toString()
      });
      
      // Generate profession recommendations based on location data
      const recommendations = generateProfessionRecommendations({
        weatherData,
        weatherForecast,
        economicData,
        populationData,
        location: defaultLocation
      });
      
      setLocationRecommendations({
        weatherData,
        weatherForecast,
        economicData,
        populationData,
        recommendations,
        location: defaultLocation
      });
      
    } catch (error) {
      console.warn('Failed to fetch location recommendations:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const generateProfessionRecommendations = (data: any) => {
    const recommendations = [];
    
    // Weather-based recommendations
    if (data.weatherData) {
      const temperature = data.weatherData.temperature;
      const windSpeed = data.weatherData.windSpeed;
      
      if (temperature > 15 && windSpeed < 5) {
        recommendations.push({
          profession: 'photographer',
          reason: 'Perfekt vær for utendørs fotografering',
          confidence: 0.9,
          weather: data.weatherData
    });
  }
      
      if (temperature < 5 || windSpeed > 10) {
        recommendations.push({
          profession: 'videographer',
          reason: 'Innendørs videoproduksjon anbefalt',
          confidence: 0.8,
          weather: data.weatherData
    });
  }
}
    
    // Economic-based recommendations
    if (data.economicData) {
      const gdp = data.economicData.indicators?.find((i: any) => i.title.includes('GDP'));
      if (gdp && gdp.value > 1000000) {
        recommendations.push({
          profession: 'music_producer',
          reason: 'Sterk økonomi støtter kreativ industri',
          confidence: 0.7,
          economic: data.economicData
    });
  }
}
    
    // Population-based recommendations
    if (data.populationData) {
      const population = data.populationData.data?.population;
      if (population > 500000) {
        recommendations.push({
          profession: 'photographer',
          reason: 'Stor befolkning gir mange fotograferingsmuligheter',
          confidence: 0.8,
          population: data.populationData
    });
  }
}
    
    return recommendations.sort((a, b) => b.confidence - a.confidence);
};
  
  // Custom camera state
  const [customCameraDialogOpen, setCustomCameraDialogOpen] = useState(false);
  const [customCamera, setCustomCamera] = useState({
    brand: '',
    model: '',
    mount: '',
    type: 'mirrorless',
    description: '',
    features: '',
    compatibility: ''
});

  // BRREG validation functions
  const handleOrgNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOnboardingData(prev => ({ ...prev, organizationNumber: value }));
    
    // Reset validation state when user types
    if (orgValidationState.validated || orgValidationState.error) {
      setOrgValidationState(prev => ({ ...prev, validated: false, error: null, companyData: null }));
}
};
  
  const validateOrgNumber = async () => {
    const orgNumber = onboardingData.organizationNumber?.trim();
    if (!orgNumber || orgNumber.length < 9) return;
    
    setOrgValidationState(prev => ({ ...prev, loading: true, error: null }));
    setProffLoading(true);
    
    try {
      // Fetch BRREG data
      const response = await apiRequest(`/api/brreg/company/${orgNumber}`);
      
      if (response.success && response.data) {
        // Auto-fill company information from BRREG
        setOnboardingData(prev => ({
          ...prev,
          business: response.data.navn,
          companyName: response.data.navn,
          businessAddress: response.data.forretningsadresse 
            ? `${response.data.forretningsadresse.adresse?.[0] ||''}, ${response.data.forretningsadresse.postnummer || ','} ${response.data.forretningsadresse.poststed || ''}`.trim() 
            : '',
          website: response.data.hjemmeside || prev.website
        }));
        
        setOrgValidationState({
          loading: false,
          validated: true,
          error: null,
          companyData: response.data
        });
        
        // ⭐ Also fetch Proff.no financial data
        try {
          const proffResponse = await getProffCompanyData(orgNumber);
          setProffData(proffResponse);
          console.log('✅ Proff.no data loaded: ', proffResponse);
        } catch (proffError) {
          console.warn('Proff.no data not available, continuing without it:', proffError);
        }
      } else {
        setOrgValidationState({
          loading: false,
          validated: false,
          error: 'Organisasjonsnummer ikke funnet i Brønnøysundregistrene',
          companyData: null
        });
      }
    } catch (error: any) {
      setOrgValidationState({
        loading: false,
        validated: false,
        error: error.message || 'Feil ved validering av organisasjonsnummer',
        companyData: null
      });
    } finally {
      setProffLoading(false);
    }
  };

  const steps = getStepsForProfession(onboardingData.profession);
  const selectedProfession = professionConfigs?.[onboardingData.profession];
  const selectedPersona = getPersonaById(onboardingData.profession);

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'UniversalOnboarding',
      name: 'Universal Onboarding',
      type: 'universal',
      category: 'onboarding',
      capabilities: ['user-onboarding','profession-selection','equipment-setup'],
      dependencies:  [],
      props:  [],
      events:  [],
      dataKeys: ['onboarding-data','profession-config','equipment-data']
});

    // Track feature usage
    features.trackFeatureUsage('universal-onboarding', 'opened', {
      timestamp: Date.now(),
      component: 'UniversalOnboarding',
      profession: profession,
      step: activeStep
});

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalOnboarding',
      dataKey: 'onboarding-data'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalOnboarding',
      dataKey: 'profession-config'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalOnboarding',
      dataKey: 'equipment-data'
});

    // Listen for onboarding events
    const unsubscribeProfessionChange = communication.onMessageType('onboarding:profession-change', (data: any) => {
      if (data.profession) {
        handleProfessionSelect(data.profession);
}
});

    const unsubscribeEquipmentAdd = communication.onMessageType('onboarding:equipment-add', (data: any) => {
      if (data.equipment && data.type) {
        switch (data.type) {
          case 'camera':
            handleCameraAdd(data.equipment);
            break;
          case 'flash':
            handleFlashAdd(data.equipment);
            break;
          case 'audioInterface':
            handleAudioInterfaceAdd(data.equipment);
            break;
          case 'microphone':
            handleMicrophoneAdd(data.equipment);
            break;
          case 'studioMonitor':
            handleStudioMonitorAdd(data.equipment);
            break;
          case 'midiController':
            handleMIDIControllerAdd(data.equipment);
            break;
  }
  }
});

    return () => {
      componentRegistry.unregisterComponent('UniversalOnboarding');
      dataFlow.unregisterNode('onboarding-data');
      dataFlow.unregisterNode('profession-config');
      dataFlow.unregisterNode('equipment-data');
      unsubscribeEquipmentAdd();
      unsubscribeProfessionChange();
};
}, [onboardingData, professionConfigs, componentRegistry, dataFlow, communication]);

  // Fetch location-based recommendations on component mount
  React.useEffect(() => {
    if (activeStep === 0) { // Only fetch on profession selection step
      fetchLocationRecommendations();
}
}, [activeStep]);

  // Fetch camera database
  const { data: cameraDatabase = [], isLoading: cameraLoading } = useQuery({
    queryKey: ['/api/equipment/cameras'],
    queryFn: () => apiRequest('/api/equipment/cameras'),
    enabled: activeStep === 2
  });

  // Fetch flash systems database
  const { data: flashDatabase = [], isLoading: flashLoading } = useQuery({
    queryKey: ['/api/equipment/flash-systems'],
    queryFn: () => apiRequest('/api/equipment/flash-systems'),
    enabled: activeStep === 2
  });

  // Fetch studio equipment databases for music producers
  const { data: audioInterfaceDatabase = [], isLoading: audioInterfaceLoading } = useQuery({
    queryKey: ['/api/equipment/audio-interfaces'],
    queryFn: () => apiRequest('/api/equipment/audio-interfaces'),
    enabled: activeStep === 2 && onboardingData.profession === 'music_producer'
  });

  const { data: studioMonitorDatabase = [], isLoading: studioMonitorLoading } = useQuery({
    queryKey: ['/api/equipment/studio-monitors'],
    queryFn: () => apiRequest('/api/equipment/studio-monitors'),
    enabled: activeStep === 2 && onboardingData.profession === 'music_producer'
  });

  const { data: microphoneDatabase = [], isLoading: microphoneLoading } = useQuery({
    queryKey: ['/api/equipment/microphones'],
    queryFn: () => apiRequest('/api/equipment/microphones'),
    enabled: activeStep === 2 && onboardingData.profession === 'music_producer'
  });

  const { data: midiControllerDatabase = [], isLoading: midiControllerLoading } = useQuery({
    queryKey: ['/api/equipment/midi-controllers'],
    queryFn: () => apiRequest('/api/equipment/midi-controllers'),
    enabled: activeStep === 2 && onboardingData.profession === 'music_producer'
  });

  // Filter cameras based on search and profession compatibility
  const filteredCameras = cameraDatabase.filter((camera: Camera) => {
    const matchesSearch = cameraSearchQuery === '' || 
      camera.brand.toLowerCase().includes(cameraSearchQuery.toLowerCase()) ||
      camera.model.toLowerCase().includes(cameraSearchQuery.toLowerCase()) ||
      (camera.description && camera.description.toLowerCase().includes(cameraSearchQuery.toLowerCase()));
    const matchesProfession = (selectedProfession as any)?.equipmentFocus?.includes('cameras') || 
                             camera.type?.includes('hybrid') || true; // Allow all cameras if no equipment focus defined
    return matchesSearch && matchesProfession;
});

  // Filter flash systems
  const filteredFlashSystems = flashDatabase.filter((flash: FlashSystem) => {
    const matchesSearch = flashSearchQuery === '' ||
      flash.brand.toLowerCase().includes(flashSearchQuery.toLowerCase()) ||
      flash.model.toLowerCase().includes(flashSearchQuery.toLowerCase()) ||
      (flash.description && flash.description.toLowerCase().includes(flashSearchQuery.toLowerCase()));
    return matchesSearch;
});

  // Studio equipment filtered lists
  const filteredAudioInterfaces = audioInterfaceSearchQuery
    ? audioInterfaceDatabase.filter((audioInterface: AudioInterface) => 
        audioInterface.brand.toLowerCase().includes(audioInterfaceSearchQuery.toLowerCase()) ||
        audioInterface.model.toLowerCase().includes(audioInterfaceSearchQuery.toLowerCase()) ||
        audioInterface.description?.toLowerCase().includes(audioInterfaceSearchQuery.toLowerCase())
      )
    : audioInterfaceDatabase;

  const filteredMicrophones = microphoneSearchQuery
    ? microphoneDatabase.filter((microphone: Microphone) => 
        microphone.brand.toLowerCase().includes(microphoneSearchQuery.toLowerCase()) ||
        microphone.model.toLowerCase().includes(microphoneSearchQuery.toLowerCase()) ||
        microphone.description?.toLowerCase().includes(microphoneSearchQuery.toLowerCase())
      )
    : microphoneDatabase;

  const filteredStudioMonitors = studioMonitorSearchQuery
    ? studioMonitorDatabase.filter((monitor: StudioMonitor) => 
        monitor.brand.toLowerCase().includes(studioMonitorSearchQuery.toLowerCase()) ||
        monitor.model.toLowerCase().includes(studioMonitorSearchQuery.toLowerCase()) ||
        monitor.description?.toLowerCase().includes(studioMonitorSearchQuery.toLowerCase())
      )
    : studioMonitorDatabase;

  const filteredMIDIControllers = midiControllerSearchQuery
    ? midiControllerDatabase.filter((controller: MIDIController) => 
        controller.brand.toLowerCase().includes(midiControllerSearchQuery.toLowerCase()) ||
        controller.model.toLowerCase().includes(midiControllerSearchQuery.toLowerCase()) ||
        controller.description?.toLowerCase().includes(midiControllerSearchQuery.toLowerCase())
      )
    : midiControllerDatabase;

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async (profileData: OnboardingData) => {
      const response = await fetch('/api/universal-onboarding/complete', {
        headers: {
          'Content-Type' : 'application/json'
        },
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify(profileData)
      });
      if (!response.ok) throw new Error('Failed to complete onboarding');
      return response.json();
    },
    onSuccess: async (data) => {
      console.log('✅ Onboarding completed successfully:', data);

      // Dispatch auth-changed event to refresh auth state
      window.dispatchEvent(new Event('auth-changed'));

      // Close onboarding modal
      if (onClose) onClose();

      // Check auto-redirect preference
      try {
        const prefResponse = await fetch('/api/user/ui-preferences', {
          credentials: 'include'
        });

        if (prefResponse.ok) {
          const prefData = await prefResponse.json();
          const shouldAutoRedirect = prefData.autoRedirectToDashboard ?? false;

          if (shouldAutoRedirect) {
            // Auto-redirect to dashboard
            const dashboardMap: { [key: string]: string } = {
              photographer: '/photographer-dashboard-material',
              videographer: '/videographer-dashboard',
              music_producer: '/music-producer-dashboard',
              vendor: '/vendor-dashboard',
              couple: '/couple-dashboard',
              partner: '/partner-dashboard',
              admin: '/admin-dashboard'
            };
            const dashboardUrl = dashboardMap[onboardingData.profession] || '/photographer-dashboard-material';
            window.location.href = dashboardUrl;
          }
          // Otherwise stay on landing page
        }
      } catch (error) {
        console.error('Failed to check auto-redirect preference:', error);
        // Default: stay on landing page
      }
    }
  });

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleCompleteOnboarding();
} else {
      setActiveStep((prev) => prev + 1);
}
};

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
};

  const handleCompleteOnboarding = async () => {
    try {
      // Broadcast onboarding completion event
      communication.sendBroadcast('onboarding:completed', {
        type: 'onboarding_completed',
        data: onboardingData,
        component: 'UniversalOnboarding'
}, 'medium');

      await completeOnboardingMutation.mutateAsync(onboardingData);

      // ⭐ Register profession as a Role Room role (fire-and-forget)
      try {
        await fetch('/api/role-room/onboarding/register-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: 'current-user',
            email: onboardingData.email,
            profession: onboardingData.profession,
          }),
        });
      } catch (_roleRoomErr) {
        // Non-blocking — Role Room registration is optional
      }

      // ⭐ Broadcast to other tabs/components via BroadcastChannel
      if (typeof window !== 'undefined') {
        const channel = new BroadcastChannel('business-info-sync');
        channel.postMessage({
          type: 'business-info-updated',
          userId: (onboardingData as any).userId || 'current-user',
          timestamp: Date.now(),
          source: 'onboarding_completed'
        });
        channel.close();
      }
} catch (error) {
      console.error('Onboarding completion error:', error);
}
};

  const handleProfessionSelect = (professionId: string) => {
    setOnboardingData(prev => ({ 
      ...prev, 
      profession: professionId,
      brandingSettings: {
        ...prev.brandingSettings,
        primaryColor: professionConfigs?.[professionId]?.iconColor || '#ff8c00'
      }
    }));
  };

  const handleCameraAdd = (camera: Camera) => {
    if (!onboardingData.selectedCameras.find(c => c.id === camera.id)) {
      setOnboardingData(prev => ({
        ...prev,
        selectedCameras: [...prev.selectedCameras, camera]
  }));
}
};

  const handleCameraRemove = (cameraId: string) => {
    setOnboardingData(prev => ({
      ...prev,
      selectedCameras: prev.selectedCameras.filter(c => c.id !== cameraId)
}));
};

  const handleFlashAdd = (flash: FlashSystem) => {
    if (!onboardingData.selectedFlashSystems.find(f => f.id === flash.id)) {
      setOnboardingData(prev => ({
        ...prev,
        selectedFlashSystems: [...prev.selectedFlashSystems, flash]
  }));
}
};

  const handleFlashRemove = (flashId: string) => {
    setOnboardingData(prev => ({
      ...prev,
      selectedFlashSystems: prev.selectedFlashSystems.filter(f => f.id !== flashId)
}));
};

  // Studio equipment handlers
  const handleAudioInterfaceAdd = (audioInterface: AudioInterface) => {
    if (!onboardingData.selectedAudioInterfaces.find(a => a.id === audioInterface.id)) {
      setOnboardingData(prev => ({
        ...prev,
        selectedAudioInterfaces: [...prev.selectedAudioInterfaces, audioInterface]
  }));
}
};

  const handleAudioInterfaceRemove = (audioInterfaceId: string) => {
    setOnboardingData(prev => ({
      ...prev,
      selectedAudioInterfaces: prev.selectedAudioInterfaces.filter(a => a.id !== audioInterfaceId)
}));
};

  const handleMicrophoneAdd = (microphone: Microphone) => {
    if (!onboardingData.selectedMicrophones.find(m => m.id === microphone.id)) {
      setOnboardingData(prev => ({
        ...prev,
        selectedMicrophones: [...prev.selectedMicrophones, microphone]
  }));
}
};

  const handleMicrophoneRemove = (microphoneId: string) => {
    setOnboardingData(prev => ({
      ...prev,
      selectedMicrophones: prev.selectedMicrophones.filter(m => m.id !== microphoneId)
}));
};

  const handleStudioMonitorAdd = (studioMonitor: StudioMonitor) => {
    if (!onboardingData.selectedStudioMonitors.find(s => s.id === studioMonitor.id)) {
      setOnboardingData(prev => ({
        ...prev,
        selectedStudioMonitors: [...prev.selectedStudioMonitors, studioMonitor]
  }));
}
};

  const handleStudioMonitorRemove = (studioMonitorId: string) => {
    setOnboardingData(prev => ({
      ...prev,
      selectedStudioMonitors: prev.selectedStudioMonitors.filter(s => s.id !== studioMonitorId)
}));
};

  const handleMIDIControllerAdd = (midiController: MIDIController) => {
    if (!onboardingData.selectedMIDIControllers.find(m => m.id === midiController.id)) {
      setOnboardingData(prev => ({
        ...prev,
        selectedMIDIControllers: [...prev.selectedMIDIControllers, midiController]
  }));
}
};

  const handleMIDIControllerRemove = (midiControllerId: string) => {
    setOnboardingData(prev => ({
      ...prev,
      selectedMIDIControllers: prev.selectedMIDIControllers.filter(m => m.id !== midiControllerId)
}));
};

  // Handle custom camera addition
  const handleAddCustomCamera = () => {
    if (!customCamera.brand || !customCamera.model) {
      return; // Don't add incomplete cameras
}

    const newCustomCamera: Camera = {
      id: `custom-${Date.now()}`,
      brand: customCamera.brand,
      model: customCamera.model,
      mount: customCamera.mount || 'Unknown',
      type: customCamera.type,
      features: customCamera.features.split('').map(f => f.trim()).filter(f => f),
      compatibility: customCamera.compatibility.split('').map(c => c.trim()).filter(c => c),
      description: customCamera.description || `Custom ${customCamera.brand} ${customCamera.model}`
};

    // Add to selected cameras and onboarding data
    const updatedCameras = [...onboardingData.selectedCameras, newCustomCamera];
    setOnboardingData(prev => ({
      ...prev,
      selectedCameras: updatedCameras
}));

    // Reset form and close dialog
    setCustomCamera({
      brand: '',
      model: ', ',
      mount: ', ',
      type: 'mirrorless',
      description: ', ',
      features: ', ',
      compatibility: ', '
});
    setCustomCameraDialogOpen(false);
};

  // State for subscription selection
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const canProceed = () => {
    switch (activeStep) {
      case 0: return onboardingData.profession !== ', ';
      case 1: return onboardingData.firstName && onboardingData.lastName && onboardingData.email;
      case 2:
        return Boolean(onboardingData.whyStatement && onboardingData.howStatement && onboardingData.whatStatement);
      case 3:
        // Enterprise: team members step (always proceed)
        if (onboardingData.profession === 'enterprise') return true;
        // Different equipment requirements based on profession
        if (onboardingData.profession === 'music_producer') {
          return onboardingData.selectedAudioInterfaces.length > 0; // Audio interface er påkrevd for musikk produsenter
        }
        return onboardingData.selectedCameras.length > 0; // Kamera er påkrevd for foto/video
      case 4: return onboardingData.profession === 'enterprise' ? true : onboardingData.cloudProvider !== ', '; // Enterprise: equipment optional
      case 5: return true; // Social media er valgfritt
      case 6: return true; // Branding er valgfritt
      case 7: return true; // Workflow preferences er valgfritt
      case 8: return true; // Payment is optional (can start with trial)
      case 9: return true; // Summary
      default: return false;
}
};

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Profesjonsvalg
        return (
          <Fade in>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 4, color: theming.colors.primary }}>
                Hvilken type kreativ profesjonell er du?
              </Typography>
              
              {/* Location-based Recommendations & SSB-Powered Benefits */}
              {locationLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Henter lokasjonsbaserte anbefalinger og markedsdata...
                  </Typography>
                </Box>
              )}
              
              {/* Enhanced Persona Recommendations */}
              {!locationLoading && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: 'secondary.light', border: '2px solid', borderColor: 'secondary.main' }}>
                  <Typography variant="h6" gutterBottom sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: 'secondary.dark',
                    fontWeight: 'bold'
                  }}>
                    🎯 Persona-baserte Anbefalinger
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Basert på norske markedsforhold og profesjonelle personatyper
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {Object.values(personaConfigs).slice(0, 4).map((persona) => (
                      <Grid item xs={12} sm={6} md={3} key={persona.id}>
                        <Card sx={{ 
                          p: 2, 
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: persona.norwegianMarket.demand === 'high' ? 'success.main' : 
                                       persona.norwegianMarket.demand === 'medium' ? 'warning.main' : 'info.main', '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 3
                          },
                          transition: 'all 0.2s'
                        }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            {persona.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            {persona.personaDescription}
                          </Typography>
                          
                          {/* Market indicators */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip 
                              label={`Etterspørsel: ${persona.norwegianMarket.demand}`}
                              size="small"
                              color={persona.norwegianMarket.demand === 'high' ? 'success' : 
                                     persona.norwegianMarket.demand === 'medium' ? 'warning' : 'info'}
                              variant="outlined"
                            />
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip 
                              label={`Konkurranse: ${persona.norwegianMarket.competition}`}
                              size="small"
                              color={persona.norwegianMarket.competition === 'low' ? 'success' : 
                                     persona.norwegianMarket.competition === 'medium' ? 'warning' : 'error'}
                              variant="outlined"
                            />
                          </Box>
                          
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            💰 {persona.norwegianMarket.pricingRange}
                          </Typography>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}
              
              {locationRecommendations && (
                <>
                  {/* SSB-Powered Market Analysis */}
                  <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.light', border: '2px solid', borderColor: 'info.main' }}>
                    <Typography variant="h6" gutterBottom sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      color: 'info.dark',
                      fontWeight: 'bold'
                    }}>
                      <CheckCircleIcon /> 
                      Hvorfor CreatorHub Norge er perfekt for deg
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Basert på Statistics Norway (SSB) data og lokale markedsforhold
                    </Typography>
                    
                    <Grid container spacing={2}>
                      {/* Economic Benefits */}
                      {locationRecommendations.economicData && (
                        <Grid item xs={12} md={6}>
                          <Card sx={{ p: 2, bgcolor: 'success.light' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BusinessIcon sx={{ color: 'success.dark' }} />
                              Sterkt marked for kreative
                            </Typography>
                            <List dense>
                              {locationRecommendations.economicData.indicators.map((indicator: any, index: number) => (
                                <ListItem key={index} sx={{ py: 0.5 }}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="body2">
                                        <strong>{indicator.title}:</strong> {indicator.value}{indicator.unit}
                                      </Typography>
                                    }
                                    secondary={
                                      <Typography variant="caption" color="text.secondary">
                                        {indicator.period} • SSB Dataset {indicator.datasetId}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                            <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: 'success.dark' }}>
                              💡 <strong>Hva dette betyr for deg:</strong> Sterk økonomi = Flere kunder med budsjett for kreative tjenester
                            </Typography>
                          </Card>
                        </Grid>
                      )}
                      
                      {/* Population Benefits */}
                      {locationRecommendations.populationData && (
                        <Grid item xs={12} md={6}>
                          <Card sx={{ p: 2, bgcolor: 'warning.light' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PersonIcon sx={{ color: 'warning.dark' }} />
                              Stort kundebase potensial
                            </Typography>
                            <List dense>
                              <ListItem sx={{ py: 0.5 }}>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2">
                                      <strong>Befolkning:</strong> {locationRecommendations.populationData.data.population.toLocaleString('no-NO')} innbyggere
                                    </Typography>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary">
                                      {locationRecommendations.populationData.region} • {locationRecommendations.populationData.year}
                                    </Typography>
                                  }
                                />
                              </ListItem>
                              <ListItem sx={{ py: 0.5 }}>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2">
                                      <strong>Vekst:</strong> {locationRecommendations.populationData.data.growth}% årlig
                                    </Typography>
                                  }
                                />
                              </ListItem>
                              <ListItem sx={{ py: 0.5 }}>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2">
                                      <strong>Tetthet:</strong> {locationRecommendations.populationData.data.density} per km²
                                    </Typography>
                                  }
                                />
                              </ListItem>
                            </List>
                            <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: 'warning.dark' }}>
                              💡 <strong>Hva dette betyr for deg:</strong> {locationRecommendations.populationData.data.population > 500000 
                                ? 'Stor by = Mange bryllup, firmafester og events'
                                : 'Nisjemarket med mindre konkurranse'
                              }
                            </Typography>
                          </Card>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                  
                  {/* Profession Recommendations */}
                  {locationRecommendations.recommendations && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: theming.colors.primary 
              }}>
                    🌍 Lokasjonsbaserte Anbefalinger
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Basert på værdata, økonomiske indikatorer og befolkningsdata for din lokasjon
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {locationRecommendations.recommendations.slice(0, 3).map((rec: any, index: number) => (
                      <Grid item xs={12} sm={6} md={4} key={index}>
                        <Card sx={{ 
                          p: 2, 
                          bgcolor: rec.confidence > 0.8 ? 'success.light' : rec.confidence > 0.6 ? 'warning.light' : 'info.light',
                          border: '1px solid',
                          borderColor: rec.confidence > 0.8 ? 'success.main' : rec.confidence > 0.6 ? 'warning.main' : 'info.main'
                    }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            {getProfessionDisplayName(rec.profession) || rec.profession}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {rec.reason}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Tillit: {Math.round(rec.confidence * 100)}%
                            </Typography>
                            <Box sx={{ 
                              width: 60, 
                              height: 4, 
                              bgcolor: 'background.paper', 
                              borderRadius: 2,
                              overflow: 'hidden'
                        }}>
                              <Box sx={{ 
                                width: `${rec.confidence * 100}%`, 
                                height: '100%', 
                                bgcolor: rec.confidence > 0.8 ? 'success.main' : rec.confidence > 0.6 ? 'warning.main' : 'info.main'
                          }} />
                            </Box>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  
                  {/* Weather and Economic Data Summary */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      📊 Lokasjonsdata
                    </Typography>
                    <Grid container spacing={2}>
                      {locationRecommendations.weatherData && (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">
                            🌡️ Temperatur: {locationRecommendations.weatherData.temperature}°C
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            💨 Vind: {locationRecommendations.weatherData.windSpeed} m/s
                          </Typography>
                        </Grid>
                      )}
                      {locationRecommendations.economicData && (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">
                            📈 Økonomi: {locationRecommendations.economicData.indicators?.length || 0} indikatorer
                          </Typography>
                        </Grid>
                      )}
                      {locationRecommendations.populationData && (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">
                            👥 Befolkning: {locationRecommendations.populationData.data?.population?.toLocaleString() || 'N/A'}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Paper>
                  )}
                </>
              )}
              
              <Box>
                {(professionsLoading || personasLoading) && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ ml: 2 }}>
                      Laster profesjoner og personatyper...
                    </Typography>
                  </Box>
                )}
                
                {professionsError && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Kunne ikke laste profesjoner. Prøver med standard alternativer.
                  </Alert>
                )}
                
                {personaConfigs && (
                  <Grid container spacing={3} justifyContent="center">
                    {Object.entries(personaConfigs).map(([key, persona]) => {
                      const isSelected = onboardingData.profession === key;
                      
                      return (
                        <Grid item xs={12} sm={6} md={4} key={key}>
                          <Card 
                            sx={{ 
                              cursor: 'pointer',
                              border: isSelected ? `3px solid ${persona.iconColor}` : '1px solid transparent',
                              bgcolor: isSelected ? `${persona.iconColor}15` : 'background.paper','&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 4
                              },
                              transition: 'all 0.2s',
                              ...theming.getThemedCardSx()
                            }}
                            onClick={() => handleProfessionSelect(key)}
                          >
                            <CardContent sx={{ textAlign: 'center', py: 3, ...theming.getThemedCardSx() }}>
                              <Avatar sx={{ 
                                bgcolor: persona.iconColor, 
                                mx: 'auto', 
                                mb: 2,
                                width: 64, 
                                height: 64 
                              }}>
                                <Box sx={{ fontSize: 32, color: 'white' }}>
                                  {persona.icon && React.cloneElement(persona.icon as React.ReactElement<any>, { sx: { fontSize: 32 } })}
                                </Box>
                              </Avatar>
                              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                                {persona.displayName}
                              </Typography>
                              
                              {/* Enhanced persona information */}
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                {persona.personaDescription}
                              </Typography>
                              
                              {/* Market indicators */}
                              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
                                <Chip 
                                  label={`Etterspørsel: ${persona.norwegianMarket.demand}`}
                                  size="small"
                                  color={persona.norwegianMarket.demand === 'high' ? 'success' : 
                                         persona.norwegianMarket.demand === 'medium' ? 'warning' : 'info'}
                                  variant="outlined"
                                />
                                <Chip 
                                  label={`Konkurranse: ${persona.norwegianMarket.competition}`}
                                  size="small"
                                  color={persona.norwegianMarket.competition === 'low' ? 'success' : 
                                         persona.norwegianMarket.competition === 'medium' ? 'warning' : 'error'}
                                  variant="outlined"
                                />
                              </Box>
                              
                              {/* Pricing range */}
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                💰 {persona.norwegianMarket.pricingRange}
                              </Typography>
                              
                              {/* Typical projects preview */}
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                📋 {persona.typicalProjects.slice(0, 2).join(', ')}
                                {persona.typicalProjects.length > 2 && '...'}
                              </Typography>
                              
                              {isSelected && (
                                <CheckCircleIcon sx={{ color: persona.iconColor, mt: 1 }} />
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Box>
            </Box>
          </Fade>
      );

      case 1: // Profildetaljer / Team-profil (enterprise)
        return (
          <Fade in>
            <Box>
              {/* Enterprise Team Profile Header */}
              {onboardingData.profession === 'enterprise' && (
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Box 
                      component="img" 
                      src="/norwed.png" 
                      alt="Norwedfilm" 
                      sx={{ width: 64, height: 64, borderRadius: 2, mr: 2, objectFit: 'contain', bgcolor: '#f5f5f5', p: 0.5 }}
                    />
                    <Box>
                      <Typography variant="h5" sx={{ color: '#6c3483', fontWeight: 700 }}>
                        Enterprise Team-profil
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Kombiner foto og video i ett team-dashbord
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Paper sx={{ p: 3, mb: 3, border: '2px solid #6c3483', borderRadius: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#6c3483' }}>
                      Kombinerte profesjoner
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Chip icon={<CameraIcon />} label="Fotograf" color="success" variant="outlined" />
                      <Chip icon={<Box component="span" sx={{ display: 'flex' }}><CameraIcon sx={{ fontSize: 18 }} /></Box>} label="Videograf" color="primary" variant="outlined" />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Ditt team vil ha tilgang til alle funksjoner for både fotografer og videografer,
                      inkludert delt utstyrshåndtering, felles prosjektstyring og samordnet leveranse.
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Standard profile details */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PersonIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                  {onboardingData.profession === 'enterprise' ? 'Bedriftsinformasjon' : (pendingData ? 'Bekreft din informasjon' : 'Profildetaljer')}
                </Typography>
              </Box>
              
              {pendingData && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    <strong>Informasjon hentet fra kontaktskjema: </strong> Kontroller at all informasjon er korrekt og oppdater om nødvendig.
                    Denne informasjonen vil automatisk brukes i kontrakter og offisielle dokumenter.
                  </Typography>
                </Alert>
              )}
              
              {orgValidationState.validated && orgValidationState.companyData && (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>✅ Bedriftsinformasjon bekreftet: </strong> {orgValidationState.companyData.navn} er hentet fra Brønnøysundregistrene og automatisk fylt ut.
                      {orgValidationState.companyData.naeringskode1 && (
                        <span> Bransje: {orgValidationState.companyData.naeringskode1.beskrivelse}</span>
                      )}
                    </Typography>
                  </Alert>
                  
                  {/* ⭐ Proff.no Financial Data Display */}
                  {proffData && proffData.source !== 'fallback' && (
                    <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.light', border: '2px solid', borderColor: 'primary.main' }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        color: 'primary.dark',
                        fontWeight: 'bold'
                      }}>
                        <CheckCircleIcon />
                        Økonomi & Kredittvurdering (Proff.no)
                      </Typography>
                      
                      <Grid container spacing={2}>
                        {/* Credit Rating */}
                        {proffData.creditRating && (
                          <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                              <Typography variant="caption" color="text.secondary">
                                Kredittvurdering
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                                {proffData.creditRating}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'success.dark' }}>
                                {proffData.creditRating === 'AAA' ? 'Utmerket' : 
                                 proffData.creditRating.startsWith('A') ? 'God' : 'Akseptabel'}
                              </Typography>
                            </Card>
                          </Grid>
                        )}
                        
                        {/* Revenue */}
                        {proffData.revenue && (
                          <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                              <Typography variant="caption" color="text.secondary">
                                Omsetning ({proffData.revenue.year})
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                                {(proffData.revenue.amount / 1000000).toFixed(1)}M NOK
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'info.dark' }}>
                                {proffData.marketIntelligence?.growthTrend === 'growing' ? '📈 Voksende' :
                                 proffData.marketIntelligence?.growthTrend === 'stable' ? '➡️ Stabil' : '📉 Fallende'}
                              </Typography>
                            </Card>
                          </Grid>
                        )}
                        
                        {/* Employees */}
                        {proffData.employees && (
                          <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                              <Typography variant="caption" color="text.secondary">
                                Ansatte
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
                                {proffData.employees}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                                {proffData.marketIntelligence?.businessVolume === 'small' ? 'Liten bedrift' :
                                 proffData.marketIntelligence?.businessVolume === 'medium' ? 'Mellomstorbedrift' :
                                 proffData.marketIntelligence?.businessVolume === 'large' ? 'Stor bedrift' : 'Enterprise'}
                              </Typography>
                            </Card>
                          </Grid>
                        )}
                        
                        {/* Market Position */}
                        {proffData.marketIntelligence && (
                          <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light' }}>
                              <Typography variant="caption" color="text.secondary">
                                Markedsposisjon
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'secondary.dark', mt: 1 }}>
                                {proffData.marketIntelligence.marketPosition === 'leader' ? '🏆 Markedsleder' :
                                 proffData.marketIntelligence.marketPosition === 'challenger' ? '🥈 Utfordrer' :
                                 proffData.marketIntelligence.marketPosition === 'follower' ? '🥉 Følger' : '🎯 Nisje'}
                              </Typography>
                            </Card>
                          </Grid>
                        )}
                      </Grid>
                      
                      {/* Risk Indicators */}
                      {proffData.riskIndicators && proffData.riskIndicators.length === 0 && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            <strong>✅ Ingen betalingsanmerkninger eller inkassosaker</strong> - Din bedrift har god økonomisk helse
                          </Typography>
                        </Alert>
                      )}
                      
                      {proffData.riskIndicators && proffData.riskIndicators.length > 0 && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            <strong>⚠️ {proffData.riskIndicators.length} risikoindikatorer funnet</strong>
                          </Typography>
                          <List dense>
                            {proffData.riskIndicators.map((risk: any, idx: number) => (
                              <ListItem key={idx}>
                                <ListItemText
                                  primary={risk.description}
                                  secondary={`Alvorlighetsgrad: ${risk.severity}`}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Alert>
                      )}
                      
                      <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                        Data fra Proff.no • Sist oppdatert: {new Date(proffData.lastUpdated).toLocaleDateString('no-NO')}
                      </Typography>
                    </Paper>
                  )}
                  
                  {proffLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <CircularProgress size={20} sx={{ mr: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        Henter økonomisk informasjon fra Proff.no...
                      </Typography>
                    </Box>
                  )}
                </>
              )}
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fornavn"
                    value={onboardingData.firstName}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Etternavn"
                    value={onboardingData.lastName}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="E-post"
                    type="email"
                    value={onboardingData.email}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Telefonnummer"
                    value={onboardingData.phone}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Bedriftsnavn"
                    value={onboardingData.business}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, business: e.target.value, companyName: e.target.value }))}
                    helperText={orgValidationState.validated ? "Bekreftet fra Brønnøysundregistrene" : "Brukes automatisk i kontrakter og offisielle dokumenter"}
                    InputProps={{
                      readOnly: orgValidationState.validated,
                      endAdornment: orgValidationState.validated ? (
                        <CheckIcon sx={{ color: 'green' }} />
                      ) : null
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Organisasjonsnummer"
                    value={onboardingData.organizationNumber}
                    onChange={handleOrgNumberChange}
                    onBlur={validateOrgNumber}
                    helperText={orgValidationState.loading ? "Validerer org.nr..." : orgValidationState.error || "Norsk org.nr. fra Brønnøysundregistrene"}
                    error={!!orgValidationState.error}
                    InputProps={{
                      endAdornment: orgValidationState.loading ? (
                        <CircularProgress size={20} />
                      ) : orgValidationState.validated && !orgValidationState.error ? (
                        <CheckIcon sx={{ color: 'green' }} />
                      ) : null
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Forretningsadresse"
                    value={onboardingData.businessAddress}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, businessAddress: e.target.value }))}
                    helperText={orgValidationState.validated ? "Hentet automatisk fra Brønnøysundregistrene" : "Bedriftens registrerte adresse"}
                    InputProps={{
                      endAdornment: orgValidationState.validated ? (
                        <CheckIcon sx={{ color: 'green' }} />
                      ) : null
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nettside (valgfritt)"
                    value={onboardingData.website}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://dinbedrift.no"
                  />
                </Grid>
              </Grid>
            </Box>
          </Fade>
      );

      case 2: // Hvorfor, Hvordan, Hva
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AutoAwesome sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                  Hvorfor, Hvordan, Hva
                </Typography>
              </Box>

              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                Fortell hvorfor du finnes, hvordan du jobber, og hva du leverer. Dette brukes i profiler og salgsdialoger.
              </Typography>

              <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'info.dark' }}>
                  Creatorhub med Hvorfor / Hvordan / Hva
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hvorfor: Vi hjelper kreative leverandorer a vokse med tillit og struktur.
                  Hvordan: Vi samler onboarding, drift og kundeopplevelse i ett system.
                  Hva: Et profesjonelt dashboard med verktøy for salg, leveranse og samarbeid.
                </Typography>
              </Paper>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Hvorfor (formål)"
                    value={onboardingData.whyStatement}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, whyStatement: e.target.value }))}
                    placeholder="Eksempel: Vi skaper minner gjennom visuelle opplevelser..."
                    multiline
                    minRows={3}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Hvordan (prosess)"
                    value={onboardingData.howStatement}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, howStatement: e.target.value }))}
                    placeholder="Eksempel: Vi jobber strukturert med forhåndsmøte, detaljert plan og tett oppfolging..."
                    multiline
                    minRows={3}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Hva (produkt)"
                    value={onboardingData.whatStatement}
                    onChange={(e) => setOnboardingData(prev => ({ ...prev, whatStatement: e.target.value }))}
                    placeholder="Eksempel: Vi leverer foto, video og eventplan med premium kundereise..."
                    multiline
                    minRows={3}
                    required
                  />
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );

      case 3: // Teammedlemmer (enterprise) or Utstyrssystem (standard)
        if (onboardingData.profession === 'enterprise') {
          return (
            <Fade in>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <BusinessIcon sx={{ color: '#6c3483', mr: 2, fontSize: 32 }} />
                  <Typography variant="h5" sx={{ color: '#6c3483', fontWeight: 700 }}>
                    Teammedlemmer
                  </Typography>
                </Box>
                
                <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                  Legg til teammedlemmene dine. Hvert medlem får tilgang til dashbordet og kan tildeles som fotograf eller videograf.
                </Typography>

                <Paper sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon /> Legg til teammedlem
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="E-post" placeholder="medlem@bedrift.no" size="small" />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Rolle</InputLabel>
                        <Select label="Rolle" defaultValue="member">
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="member">Medlem</MenuItem>
                          <MenuItem value="photographer">Fotograf</MenuItem>
                          <MenuItem value="videographer">Videograf</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Button variant="contained" fullWidth sx={{ bgcolor: '#6c3483', '&:hover': { bgcolor: '#5b2d70' }, height: 40 }}>
                        Inviter
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Pre-populated Norwedfilm team members */}
                <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Team ({3} medlemmer)
                  </Typography>
                  
                  <List>
                    {[
                      { email: 'admin@norwedfilm.no', role: 'Admin', status: 'Aktiv', avatar: 'A' },
                      { email: 'fotograf@norwedfilm.no', role: 'Fotograf', status: 'Aktiv', avatar: 'F' },
                      { email: 'videograf@norwedfilm.no', role: 'Videograf', status: 'Aktiv', avatar: 'V' },
                    ].map((member) => (
                      <ListItem key={member.email} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 1 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#6c3483' }}>{member.avatar}</Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                          primary={member.email} 
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Chip label={member.role} size="small" color="primary" variant="outlined" />
                              <Chip label={member.status} size="small" color="success" variant="outlined" />
                            </Box>
                          } 
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end">
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Teammedlemmer vil motta en invitasjons-e-post og får tilgang til dashbordet etter registrering.
                      Hvert medlem kan bruke Academy og Community med sin egen konto.
                    </Typography>
                  </Alert>
                </Paper>
              </Box>
            </Fade>
          );
        }
        // Fall through to standard equipment step for non-enterprise
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                {onboardingData.profession === 'music_producer' ? (
                  <MusicIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                ) : (
                  <CameraIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                )}
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                  {onboardingData.profession === 'music_producer' ? 'Studio Utstyrssystem' : 'Kamera- og Utstyrssystem'}
                </Typography>
              </Box>
              
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                {onboardingData.profession === 'music_producer' 
                  ? 'Velg ditt studio utstyr så vi kan tilpasse alle funksjoner til ditt oppsett'
                  : 'Velg dine kameraer og flash-systemer så vi kan tilpasse alle funksjoner til ditt utstyr'
                }
              </Typography>

              {onboardingData.profession === 'music_producer' ? (
                <Tabs 
                  value={equipmentTabValue}
                  onChange={(e, newValue) => setEquipmentTabValue(newValue)}
                  sx={{ mb: 3 }}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab 
                    label={`Audio Interface (${onboardingData.selectedAudioInterfaces.length})`}
                    icon={<SettingsIcon />}
                  />
                  <Tab 
                    label={`Mikrofoner (${onboardingData.selectedMicrophones.length})`}
                    icon={<MusicIcon />}
                  />
                  <Tab 
                    label={`Studio Monitorer (${onboardingData.selectedStudioMonitors.length})`}
                    icon={<SettingsIcon />}
                  />
                  <Tab 
                    label={`MIDI Kontrollere (${onboardingData.selectedMIDIControllers.length})`}
                    icon={<SettingsIcon />}
                  />
                </Tabs>
              ) : (
                <Tabs 
                  value={equipmentTabValue}
                  onChange={(e, newValue) => setEquipmentTabValue(newValue)}
                  sx={{ mb: 3 }}
                >
                  <Tab 
                    label={`Kameraer (${onboardingData.selectedCameras.length})`}
                    icon={<CameraIcon />}
                  />
                  <Tab 
                    label={`Flash/Lys (${onboardingData.selectedFlashSystems.length})`}
                    icon={<FlashIcon />}
                  />
                </Tabs>
              )}

              {/* Studio Equipment Tabs for Music Producer */}
              {onboardingData.profession === 'music_producer' ? (
                <>
                  {/* Audio Interface Tab */}
                  {equipmentTabValue === 0 && (
                    <Box>
                      <TextField
                        fullWidth
                        placeholder="Søk etter audio interface (f.eks. Focusrite, PreSonus, RME...)"
                        value={audioInterfaceSearchQuery}
                        onChange={(e) => setAudioInterfaceSearchQuery(e.target.value)}
                        sx={{ mb: 3 }}
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        }}
                      />

                      {/* Selected Audio Interfaces */}
                      {onboardingData.selectedAudioInterfaces.length > 0 && (
                        <Paper sx={{ p: 2, mb: 3, bgcolor: 'success.light', color: 'success.contrastText', ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Valgte Audio Interfaces ({onboardingData.selectedAudioInterfaces.length})
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {onboardingData.selectedAudioInterfaces.map((audioInterface) => (
                              <Chip
                                key={audioInterface.id}
                                label={`${audioInterface.brand} ${audioInterface.model}`}
                                onDelete={() => handleAudioInterfaceRemove(audioInterface.id)}
                                variant="outlined"
                                sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                              />
                            ))}
                          </Box>
                        </Paper>
                      )}

                      {/* Available Audio Interfaces */}
                      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                        {audioInterfaceLoading ? (
                          <Box sx={{ p: 4, textAlign: 'center' }}>
                            <CircularProgress />
                            <Typography sx={{ mt: 2 }}>Laster audio interface database...</Typography>
                          </Box>
                        ) : (
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>Audio Interface</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>In/Out</TableCell>
                                <TableCell align="center">Legg til</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredAudioInterfaces.slice(0, 10).map((audioInterface: AudioInterface) => {
                                const isSelected = onboardingData.selectedAudioInterfaces.some(a => a.id === audioInterface.id);
                                
                                return (
                                  <TableRow key={audioInterface.id}>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Avatar sx={{ bgcolor: (selectedProfession as any)?.color, mr: 2, width: 32, height: 32 }}>
                                          <MusicIcon fontSize="small" />
                                        </Avatar>
                                        <Box>
                                          <Typography variant="body2" fontWeight="bold">
                                            {audioInterface.brand} {audioInterface.model}
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            {audioInterface.description}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={audioInterface.type} size="small" />
                                    </TableCell>
                                    <TableCell>{audioInterface.inputs}/{audioInterface.outputs}</TableCell>
                                    <TableCell align="center">
                                      <IconButton
                                        onClick={() => handleAudioInterfaceAdd(audioInterface)}
                                        disabled={isSelected}
                                        color={isSelected ? "success" : "primary"}
                                      >
                                        {isSelected ? <CheckIcon /> : <AddIcon />}
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                              );
                          })}
                            </TableBody>
                          </Table>
                        )}
                      </TableContainer>
                    </Box>
                  )}

                  {/* Microphone Tab */}
                  {equipmentTabValue === 1 && (
                    <Box>
                      <TextField
                        fullWidth
                        placeholder="Søk etter mikrofoner (f.eks. Shure, Audio-Technica, Rode...)"
                        value={microphoneSearchQuery}
                        onChange={(e) => setMicrophoneSearchQuery(e.target.value)}
                        sx={{ mb: 3 }}
                        InputProps={{
                          startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        }}
                      />

                      {/* Selected Microphones */}
                      {onboardingData.selectedMicrophones.length > 0 && (
                        <Paper sx={{ p: 2, mb: 3, bgcolor: 'success.light', color: 'success.contrastText', ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Valgte Mikrofoner ({onboardingData.selectedMicrophones.length})
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {onboardingData.selectedMicrophones.map((microphone) => (
                              <Chip
                                key={microphone.id}
                                label={`${microphone.brand} ${microphone.model}`}
                                onDelete={() => handleMicrophoneRemove(microphone.id)}
                                variant="outlined"
                                sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                              />
                            ))}
                          </Box>
                        </Paper>
                      )}

                      {/* Available Microphones */}
                      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                        {microphoneLoading ? (
                          <Box sx={{ p: 4, textAlign: 'center' }}>
                            <CircularProgress />
                            <Typography sx={{ mt: 2 }}>Laster mikrofon database...</Typography>
                          </Box>
                        ) : (
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>Mikrofon</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Pattern</TableCell>
                                <TableCell align="center">Legg til</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredMicrophones.slice(0, 10).map((microphone: Microphone) => {
                                const isSelected = onboardingData.selectedMicrophones.some(m => m.id === microphone.id);
                                
                                return (
                                  <TableRow key={microphone.id}>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Avatar sx={{ bgcolor: (selectedProfession as any)?.color, mr: 2, width: 32, height: 32 }}>
                                          <MusicIcon fontSize="small" />
                                        </Avatar>
                                        <Box>
                                          <Typography variant="body2" fontWeight="bold">
                                            {microphone.brand} {microphone.model}
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            {microphone.description}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Chip label={microphone.type} size="small" />
                                    </TableCell>
                                    <TableCell>{microphone.pattern}</TableCell>
                                    <TableCell align="center">
                                      <IconButton
                                        onClick={() => handleMicrophoneAdd(microphone)}
                                        disabled={isSelected}
                                        color={isSelected ? "success" : "primary"}
                                      >
                                        {isSelected ? <CheckIcon /> : <AddIcon />}
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </TableContainer>
                    </Box>
                  )}
                </>
              ) : (
                <>
                  {/* Kamera Tab */}
                  {equipmentTabValue === 0 && (
                <Box>
                  <TextField
                    fullWidth
                    placeholder="Søk etter kamera (f.eks. Canon R1, R5 Mark II, Sony A6700, FX30...)"
                    value={cameraSearchQuery}
                    onChange={(e) => setCameraSearchQuery(e.target.value)}
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />

                  {/* Selected Cameras */}
                  {onboardingData.selectedCameras.length > 0 && (
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'success.light', color: 'success.contrastText', ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Valgte kameraer ({onboardingData.selectedCameras.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {onboardingData.selectedCameras.map((camera) => (
                          <Chip
                            key={camera.id}
                            label={`${camera.brand} ${camera.model}`}
                            onDelete={() => handleCameraRemove(camera.id)}
                            variant="outlined"
                            sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                          />
                        ))}
                      </Box>
                    </Paper>
                  )}

                  {/* Available Cameras */}
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    {cameraLoading ? (
                      <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 2 }}>Laster kameradatabase...</Typography>
                      </Box>
                    ) : (
                      <Table stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Kamera</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Mount</TableCell>
                            <TableCell align="center">Legg til</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredCameras.slice(0, 10).map((camera: Camera) => {
                            const isSelected = onboardingData.selectedCameras.some(c => c.id === camera.id);
                            
                            return (
                              <TableRow key={camera.id}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Avatar sx={{ bgcolor: (selectedProfession as any)?.color, mr: 2, width: 32, height: 32 }}>
                                      <CameraIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                      <Typography variant="body2" fontWeight="bold">
                                        {camera.brand} {camera.model}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary">
                                        {camera.description}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip label={camera.type} size="small" />
                                </TableCell>
                                <TableCell>{camera.mount}</TableCell>
                                <TableCell align="center">
                                  <IconButton
                                    onClick={() => handleCameraAdd(camera)}
                                    disabled={isSelected}
                                    color={isSelected ? "success" : "primary"}
                                  >
                                    {isSelected ? <CheckIcon /> : <AddIcon />}
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </TableContainer>
                  
                  {/* Add Custom Camera Button */}
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setCustomCameraDialogOpen(true)}
                      sx={{ 
                        borderColor: (selectedProfession as any)?.color,
                        color: (selectedProfession as any)?.color,
                        '&:hover': {
                          bgcolor: (selectedProfession as any)?.color + '10',
                          borderColor: (selectedProfession as any)?.color
                        }
                      }}
                    >
                      Ikke i vår oppdaterte database? Legg til manuelt
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Flash/Lys Tab */}
              {equipmentTabValue === 1 && (
                <Box>
                  <TextField
                    fullWidth
                    placeholder="Søk etter flash/lys (f.eks. Godox V1, Profoto B10...)"
                    value={flashSearchQuery}
                    onChange={(e) => setFlashSearchQuery(e.target.value)}
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: <FlashIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />

                  {/* Selected Flash Systems */}
                  {onboardingData.selectedFlashSystems.length > 0 && (
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'warning.light', color: 'warning.contrastText', ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Valgte lyssystemer ({onboardingData.selectedFlashSystems.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {onboardingData.selectedFlashSystems.map((flash) => (
                          <Chip
                            key={flash.id}
                            label={`${flash.brand} ${flash.model}`}
                            onDelete={() => handleFlashRemove(flash.id)}
                            variant="outlined"
                            sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                          />
                        ))}
                      </Box>
                    </Paper>
                  )}

                  {/* Available Flash Systems */}
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    {flashLoading ? (
                      <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 2 }}>Laster lys-database...</Typography>
                      </Box>
                    ) : (
                      <Table stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Lyssystem</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Kompatibilitet</TableCell>
                            <TableCell align="center">Legg til</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredFlashSystems.slice(0, 10).map((flash: FlashSystem) => {
                            const isSelected = onboardingData.selectedFlashSystems.some(f => f.id === flash.id);
                            
                            return (
                              <TableRow key={flash.id}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Avatar sx={{ bgcolor: (selectedProfession as any)?.color, mr: 2, width: 32, height: 32 }}>
                                      <FlashIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                      <Typography variant="body2" fontWeight="bold">
                                        {flash.brand} {flash.model}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary">
                                        {flash.description}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip label={flash.type} size="small" />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption">
                                    {flash.compatibility?.join(', ') || 'Universal'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <IconButton
                                    onClick={() => handleFlashAdd(flash)}
                                    disabled={isSelected}
                                    color={isSelected ? "success" : "primary"}
                                  >
                                    {isSelected ? <CheckIcon /> : <AddIcon />}
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </TableContainer>
                </Box>
              )}
                </>
              )}
            </Box>
          </Fade>
        );

      case 4: // Cloud Integrering
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <CloudIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Cloud Integrering</Typography>
              </Box>
              
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                Velg din foretrukne cloud-plattform for fillagring og samarbeid
              </Typography>

              <Grid container spacing={2}>
                {['google','microsoft','other'].map((provider) => (
                  <Grid item xs={12} sm={4} key={provider}>
                    <Card 
                      sx={{
                        cursor: 'pointer',
                        border: onboardingData.cloudProvider === provider ? `2px solid ${(selectedProfession as any)?.color}` : '1px solid transparent','&:hover': { boxShadow: 3 },
                        ...theming.getThemedCardSx()
                      }}
                      onClick={() => setOnboardingData(prev => ({ ...prev, cloudProvider: provider }))}
                    >
                      <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                        <Typography variant="h6" sx={{ textTransform: 'capitalize', color: theming.colors.primary }}>
                          {provider === 'google' ? 'Google Workspace' : 
                           provider === 'microsoft' ? 'Microsoft 365' : 'Annet'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Fade>
        );

      case 5: // Sosiale Medier
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SocialIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Sosiale Medier (valgfritt)</Typography>
              </Box>
              
              <Grid container spacing={3}>
                {Object.entries(onboardingData.socialMediaAccounts).map(([platform, value]) => (
                  <Grid item xs={12} sm={6} key={platform}>
                    <TextField
                      fullWidth
                      label={platform.charAt(0).toUpperCase() + platform.slice(1)}
                      value={value}
                      onChange={(e) => setOnboardingData(prev => ({
                        ...prev,
                        socialMediaAccounts: {
                          ...prev.socialMediaAccounts,
                          [platform]: e.target.value
                        }
                      }))}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Fade>
        );

      case 6: // Branding Setup
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <BrandingIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Branding Setup (valgfritt)</Typography>
              </Box>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Automatisk kontraktintegrasjon: </strong> Ved å laste opp din bedriftslogo, 
                  vil den automatisk vises på alle kontrakter, tilbud og offisielle dokumenter. 
                  Du kan endre dette senere i innstillingene.
                </Typography>
              </Alert>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ p: 3, textAlign: 'center', ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Bedriftslogo
                    </Typography>
                    
                    <Box sx={{ 
                      width: 100, 
                      height: 100, 
                      mx: 'auto', 
                      mb: 2,
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'background.paper'
                    }}>
                      {onboardingData.customLogo ? (
                        <img 
                          src={onboardingData.customLogo}
                          alt="Bedriftslogo" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <BusinessIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                      )}
                    </Box>
                    
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<AddIcon />}
                      size="small"
                    >
                      Last opp logo
                      <input
                        type="file"
                        hidden
                        accept="image/jpeg,image/png,image/svg+xml,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setOnboardingData(prev => ({
                                ...prev,
                                customLogo: e.target?.result as string
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </Button>
                    
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                      JPEG, PNG, SVG, WebP
                    </Typography>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Primærfarge"
                        type="color"
                        value={onboardingData.brandingSettings.primaryColor}
                        onChange={(e) => setOnboardingData(prev => ({
                          ...prev,
                          brandingSettings: {
                            ...prev.brandingSettings,
                            primaryColor: e.target.value
                          }
                        }))}
                        helperText="Fargen brukes i kontrakter og dokumenter"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Bedriftstype"
                        value={onboardingData.brandingSettings.businessType}
                        onChange={(e) => setOnboardingData(prev => ({
                          ...prev,
                          brandingSettings: {
                            ...prev.brandingSettings,
                            businessType: e.target.value
                          }
                        }))}
                        placeholder="F.eks. Fotostudio, Videoproduksjon..."
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Bedriftsnavn"
                        value={onboardingData.business}
                        onChange={(e) => setOnboardingData(prev => ({
                          ...prev,
                          business: e.target.value
                        }))}
                        helperText="Brukes i kontrakter og offisielle dokumenter"
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );

      case 7: // Arbeidsflyt Konfigurasjon
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <WorkflowIcon sx={{ color: (selectedProfession as any)?.color, mr: 2, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Arbeidsflyt Konfigurasjon (valgfritt)</Typography>
              </Box>
              
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                Tilpass arbeidsflyten din - dette kan endres senere
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Du kan hoppe over dette steget og konfigurere arbeidsflyten din senere i innstillingene.
                </Typography>
              </Alert>
            </Box>
          </Fade>
        );

      case 8: // Payment & Subscription
        return (
          <Fade in>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 2, color: theming.colors.primary }}>
                Velg ditt abonnement
              </Typography>
              
              <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', mb: 4 }}>
                {onboardingData.profession === 'enterprise' 
                  ? 'Enterprise-abonnement inkluderer team-dashbord, foto og video' 
                  : 'Start med 14 dagers gratis prøveperiode - ingen binding'}
              </Typography>

              {/* Enterprise Subscription Summary */}
              {onboardingData.profession === 'enterprise' && (
                <Paper sx={{ p: 3, mb: 4, border: '2px solid #6c3483', borderRadius: 3, bgcolor: 'rgba(108,52,131,0.03)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box component="img" src="/norwed.png" alt="Norwedfilm" sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'contain', bgcolor: '#f5f5f5', p: 0.5 }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#6c3483' }}>
                        Enterprise Team Plan
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Foto + Video kombinert • Teammedlemmer inkludert
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#6c348308' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#6c3483' }}>1 999</Typography>
                        <Typography variant="caption" color="text.secondary">NOK/mnd inkl. mva</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#6c348308' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#6c3483' }}>5</Typography>
                        <Typography variant="caption" color="text.secondary">Teammedlemmer inkl.</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#6c348308' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#6c3483' }}>436</Typography>
                        <Typography variant="caption" color="text.secondary">NOK/ekstra bruker</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.dark' }}>14</Typography>
                        <Typography variant="caption" color="text.secondary">Dager gratis prøve</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>Inkludert i Enterprise:</Typography>
                  <Grid container spacing={1}>
                    {['Team Management', 'Photo Suite', 'Video Suite', 'Showcase Galleri', 'Analytics', 'Academy', 'Community', 'Wedding Timeline', 'AI Enhancement', 'Equipment Sharing'].map((f) => (
                      <Grid item key={f}>
                        <Chip label={f} size="small" color="primary" variant="outlined" icon={<CheckCircleIcon />} />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}

              {/* Pricing Plans */}
              {!platformPricingLoading && subscriptionPlans && subscriptionPlans.length > 0 ? (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {subscriptionPlans.map((plan: any) => {
                    const isPopular = plan.id === 'pro-plan';
                    const isSelected = selectedPlan === plan.id;
                    
                    return (
                      <Grid item xs={12} md={4} key={plan.id}>
                        <Card
                          sx={{
                            position: 'relative',
                            height: '100%',
                            border: isSelected ? `3px solid ${(selectedProfession as any)?.color}` : isPopular ? '2px solid' : '1px solid',
                            borderColor: isSelected ? (selectedProfession as any)?.color : isPopular ? 'primary.main' : 'divider',
                            bgcolor: isSelected ? `${(selectedProfession as any)?.color}10` : 'background.paper',
                            cursor: 'pointer','&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4
                            },
                            transition: 'all 0.2s',
                            ...theming.getThemedCardSx()
                          }}
                          onClick={() => setSelectedPlan(plan.id)}
                        >
                          {isPopular && (
                            <Chip
                              label="MEST POPULÆR"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: -12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bgcolor: 'primary.main',
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            />
                          )}
                          
                          <CardContent sx={{ textAlign: 'center', p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                              {plan.name}
                            </Typography>
                            
                            <Typography variant="h3" sx={{ fontWeight: 'bold', color: (selectedProfession as any)?.color, my: 2 }}>
                              {formatPlatformPrice(plan.price, 'NOK')}
                            </Typography>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                              per måned
                            </Typography>
                            
                            <Divider sx={{ my: 2 }} />
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {plan.description}
                            </Typography>
                            
                            <List dense sx={{ textAlign: 'left' }}>
                              {plan.features?.map((feature: string, idx: number) => (
                                <ListItem key={idx} sx={{ py: 0.5 }}>
                                  <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mr: 1 }} />
                                  <ListItemText
                                    primary={
                                      <Typography variant="body2">
                                        {feature}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                            
                            {/* Google Pay Button */}
                            {isSelected && (
                              <Box sx={{ mt: 3 }}>
                                <GooglePayButton
                                  amount={plan.price * 100} // Convert to øre
                                  currency="NOK"
                                  productName={plan.name}
                                  description={plan.description}
                                  buttonType="subscribe"
                                  onSuccess={async (result) => {
                                    setPaymentCompleted(true);

                                    // ✅ Store payment confirmation SERVER-SIDE
                                    try {
                                      await fetch('/api/user/subscription-status', {
                                        method: 'POST',
                                        headers: { 'Content-Type' : 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({
                                          subscriptionSelected: true,
                                          paymentCompleted: true,
                                          transactionId: result.transactionId,
                                          planId: plan.id,
                                          planName: plan.name,
                                          amount: plan.price,
                                          timestamp: new Date().toISOString()
                                        })
                                      });
                                      console.log('✅ Payment status stored server-side');
                                    } catch (error) {
                                      console.error('❌ Failed to store payment status:', error);
                                    }

                                    analytics.trackEvent('subscription_purchased', {
                                      planId: plan.id,
                                      transactionId: result.transactionId,
                                      amount: plan.price
                                    });

                                    // Auto-advance to summary
                                    setTimeout(() => {
                                      setActiveStep(9); // Move to summary step
                                    }, 1500);
                                  }}
                                  onError={(error) => {
                                    console.error('Payment error:', error);
                                    analytics.trackEvent('subscription_payment_failed', {
                                      planId: plan.id,
                                      error
                                    });
                                  }}
                                  onCancel={() => {
                                    setSelectedPlan(null);
                                    analytics.trackEvent('subscription_payment_cancelled', {
                                      planId: plan.id
                                    });
                                  }}
                                />
                              </Box>
                            )}
                            
                            {!isSelected && (
                              <Button
                                variant={isPopular ? 'contained' : 'outlined'}
                                fullWidth
                                sx={{
                                  mt: 3,
                                  bgcolor: isPopular ? 'primary.main' : 'transparent',
                                  color: isPopular ? 'white' : (selectedProfession as any)?.color,
                                  borderColor: (selectedProfession as any)?.color,
                                  '&:hover': {
                                    bgcolor: isPopular ? 'primary.dark' : `${(selectedProfession as any)?.color}20`
                                  }
                                }}
                                onClick={() => setSelectedPlan(plan.id)}
                              >
                                Velg {plan.name}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Laster abonnementsplaner...
                  </Typography>
                </Box>
              )}

              {/* Trial Option */}
              <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', bgcolor: 'info.light', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.dark' }}>
                  <CheckCircleIcon />
                  Eller start med gratis prøveperiode
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Prøv CreatorHub Norge gratis i 14 dager med full tilgang til alle funksjoner. 
                  Ingen kredittkort påkrevd. Avbryt når som helst.
                </Typography>
                
                <Button
                  variant="outlined"
                  startIcon={<StarIcon />}
                  onClick={() => {
                    setSelectedPlan('trial');
                    analytics.trackEvent('trial_selected', {
                      profession: onboardingData.profession
                    });
                  }}
                  sx={{
                    borderColor: 'info.main',
                    color: 'info.main',
                    '&:hover': {
                      bgcolor: 'info.light',
                      borderColor: 'info.dark'
                    }
                  }}
                >
                  Start Gratis Prøveperiode
                </Button>
              </Paper>

              {paymentCompleted && (
                <Alert severity="success" sx={{ mt: 3, maxWidth: 800, mx: 'auto' }}>
                  <Typography variant="body2">
                    <strong>✅ Betaling vellykket!</strong> Ditt abonnement er aktivert. Fortsett til oppsummering.
                  </Typography>
                </Alert>
              )}
            </Box>
          </Fade>
        );

      case 9: // Summary (moved from case 6)
        return (
          <Fade in>
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 64, mb: 2 }} />
              <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
                Klar til å fullføre oppsettet
              </Typography>
              
              <Card sx={{ mt: 3, textAlign: 'left' }}>
                <CardContent>
                  <List>
                  <ListItem>
                    <ListItemText
                      primary="Profesjon"
                      secondary={selectedPersona?.displayName || selectedProfession?.displayName || 'Ikke valgt'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Navn"
                      secondary={`${onboardingData.firstName} ${onboardingData.lastName}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Hvorfor (formål)"
                      secondary={onboardingData.whyStatement || 'Ikke fylt ut'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Hvordan (prosess)"
                      secondary={onboardingData.howStatement || 'Ikke fylt ut'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Hva (produkt)"
                      secondary={onboardingData.whatStatement || 'Ikke fylt ut'}
                    />
                  </ListItem>
                  {selectedPersona && (
                    <>
                      <ListItem>
                        <ListItemText
                          primary="Markedsetterspørsel"
                          secondary={`${selectedPersona.norwegianMarket.demand} etterspørsel i Norge`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Typisk prosjektverdi"
                          secondary={selectedPersona.norwegianMarket.pricingRange}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Arbeidsmiljø"
                          secondary={selectedPersona.workEnvironment.join('')}
                        />
                      </ListItem>
                    </>
                  )}
                  <ListItem>
                    <ListItemText
                      primary="Kameraer"
                      secondary={`${onboardingData.selectedCameras.length} valgt`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Lyssystemer"
                      secondary={`${onboardingData.selectedFlashSystems.length} valgt`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Cloud Provider"
                      secondary={onboardingData.cloudProvider || 'Ikke valgt'}
                    />
                  </ListItem>
                </List>
                </CardContent>
              </Card>
            </Box>
          </Fade>
        );

      default: return null;
    }
  };

  if (!open) return null;

  return (
    <Dialog 
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '80vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ 
            color: (selectedProfession as any)?.color || '#ff6f00', 
            fontWeight: 'bold',
            mb: 1
          }}>
            Velkommen til CreatorHub Norge
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            La oss sette opp din personlige creative workspace
          </Typography>
          
          {/* Feature Analytics Display */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: 1,
            mt: 2,
            flexWrap: 'wrap'
          }}>
            <Typography variant="caption" color="text.secondary">
              Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
            </Typography>
            <Chip 
              label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18 }}
            />
            
            {/* Dynamic Config Indicator */}
            {hasDashboardConfigs && (
              <Chip 
                label="✓ Dynamic Configs"
                size="small"
                color="success"
                sx={{ fontSize: '10px', height: 18, fontWeight: 600}}
              />
            )}
            
            <Tooltip title={`Profesjoner lastet: ${Object.keys(professionConfigs || {}).length}`}>
              <Chip 
                label={`${Object.keys(professionConfigs || {}).length} professions`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 18 }}
              />
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        {/* Stepper */}
        <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card sx={{ minHeight: '400px', ...theming.getThemedCardSx() }}>
          <CardContent sx={{ p: 3,...theming.getThemedCardSx() }}>
            {renderStepContent()}
          </CardContent>
        </Card>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || completeOnboardingMutation.isPending}
          startIcon={<ArrowBackIcon />}
          sx={{ minWidth: 120 }}
        >
          Tilbake
        </Button>
        
        <Button variant="contained"
          onClick={handleNext}
          disabled={!canProceed() || completeOnboardingMutation.isPending}
          endIcon={completeOnboardingMutation.isPending ? 
            <CircularProgress size={20} /> : 
            (activeStep === steps.length - 1 ? <CheckIcon /> : <ArrowForwardIcon />)
          }
          sx={{ 
            minWidth: 120,
            bgcolor: (selectedProfession as any)?.color || 'primary.main', '&:hover': {
              bgcolor: (selectedProfession as any)?.color || 'primary.dark'
            }
          }}
        >
          {activeStep === steps.length - 1 ? 'Fullfør' : 'Neste'}
        </Button>
      </DialogActions>

      {/* Custom Camera Dialog */}
      <Dialog
        open={customCameraDialogOpen}
        onClose={() => setCustomCameraDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CameraIcon sx={{ color: (selectedProfession as any)?.color }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Legg til egendefinert kamera
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Finner du ikke kameraet ditt i vår oppdaterte database? Legg det til manuelt her. 
            Vi oppdaterer kontinuerlig med de nyeste modellene - søk gjerne først i kameradatabasen vår.
          </Typography>
          
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light', color: 'info.contrastText', ...theming.getThemedCardSx() }}>
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
              💡 <strong>Tips: </strong> Vår database inneholder de nyeste modellene fra 2024-2025 inkludert Canon EOS R1, R5 Mark II, R8, Sony A7C II, FX30, A6700, og mange flere. Prøv å søke først!
            </Typography>
          </Paper>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Merke"
                value={customCamera.brand}
                onChange={(e) => setCustomCamera(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="f.eks. Canon, Sony, Nikon..."
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Modell"
                value={customCamera.model}
                onChange={(e) => setCustomCamera(prev => ({ ...prev, model: e.target.value }))}
                placeholder="f.eks. EOS R5 II, A7 IV, Z9..."
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Mount/Fatning"
                value={customCamera.mount}
                onChange={(e) => setCustomCamera(prev => ({ ...prev, mount: e.target.value }))}
                placeholder="f.eks. RF, Z, EF..."
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={customCamera.type}
                  onChange={(e) => setCustomCamera(prev => ({ ...prev, type: e.target.value }))}
                >
                  <MenuItem value="mirrorless">Mirrorless</MenuItem>
                  <MenuItem value="dslr">DSLR</MenuItem>
                  <MenuItem value="cinema">Cinema</MenuItem>
                  <MenuItem value="action">Action Camera</MenuItem>
                  <MenuItem value="instant">Instant Camera</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Beskrivelse"
                value={customCamera.description}
                onChange={(e) => setCustomCamera(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Kort beskrivelse av kameraet..."
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Funksjoner"
                value={customCamera.features}
                onChange={(e) => setCustomCamera(prev => ({ ...prev, features: e.target.value }))}
                placeholder="Separer med komma: f.eks. 4K video, IBIS, Dual card slots..."
                helperText="Separer forskjellige funksjoner med komma"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Kompatibilitet"
                value={customCamera.compatibility}
                onChange={(e) => setCustomCamera(prev => ({ ...prev, compatibility: e.target.value }))}
                placeholder="f.eks. RF lenses, EF lenses (with adapter)..."
                helperText="Separer forskjellige kompatibiliteter med komma"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setCustomCameraDialogOpen(false)}
            startIcon={<CloseIcon />}
          >
            Avbryt
          </Button>
          
          <Button variant="contained"
            onClick={handleAddCustomCamera}
            disabled={!customCamera.brand || !customCamera.model}
            startIcon={<SaveIcon />}
            sx={{ 
              bgcolor: (selectedProfession as any)?.color,
              '&:hover': { bgcolor: (selectedProfession as any)?.color + 'DD' },
              ...theming.getThemedButtonSx()
            }}
          >
            Legg til kamera
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
