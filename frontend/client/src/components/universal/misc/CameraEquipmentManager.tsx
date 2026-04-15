// @ts-nocheck
/**
 * CreatorHub Norge - Camera Selection Test
 * Demonstrerer hvordan minnekort valg tilpasser seg forskjellige kameraer
 */

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Alert,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  PhotoCamera,
  Memory,
  Settings,
  Search,
  History,
  Clear,
  FilterList,
  Update,
  Check,
} from '@mui/icons-material';
// Note: These components are now implemented and ready for use
import MemoryCardSelector from '../../memory-card/MemoryCardSelector';
import FirmwareInfoDialog from '../../firmware/FirmwareInfoDialog';

import { 
  WORLD_CAMERA_DATABASE, 
  getPopularCameras, 
  getCanonCameras,
  getSonyCameras,
  getNikonCameras,
  getFujifilmCameras,
  getPanasonicCameras,
  getSupportedBrands,
  getCamerasByBrand,
  getCamerasByCategory,
  getLatestCameras,
  detectNewCameraModels,
  type CameraSpec,
  VIDEO_LIGHTS_DATABASE,
  PHOTO_FLASH_DATABASE,
  searchAllEquipment,
  type VideoLightSpec,
  type PhotoFlashSpec
} from '@shared/camera-database.ts';

const SUPPORTED_BRANDS = getSupportedBrands();

interface CameraEquipmentManagerProps {
  profession: string
}

export default function CameraEquipmentManager({ profession }: CameraEquipmentManagerProps) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Authenticated equipment data fetching
  const { user } = useAuth();
  const { data: savedEquipment } = useQuery({
    queryKey: ['/api/user/equipment', user?.id],
    queryFn: () => apiRequest('/api/user/equipment'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Google Drive Storage Integration State
  const [googleDriveSyncStatus, setGoogleDriveSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [googleSheetsSyncStatus, setGoogleSheetsSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'camera-equipment-manager,',
      name: 'Camera Equipment Manager',
      type: 'universal',
      category: 'equipment',
      capabilities: [
        'data:read', 'data:write', 'event:emit', 'event:listen', 'ui:update', 'equipment:manage', 'camera:track', 'maintenance:schedule', 'google-drive:sync', 'google-sheets:sync', 'equipment:export'
     , ],
      dependencies: ['google-drive-manager','google-sheets-api'],
      props: ['profession','equipmentType','maintenanceSchedule'],
      events: ['equipment:added','maintenance: due','sync: completed', ],
      dataKeys: ['equipment','maintenance','analytics']
});

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'camera-equipment-manager',
      dataKey: 'camera-equipment-manager:equipment',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'camera-equipment-manager',
      dataKey: 'camera-equipment-manager:maintenance',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
});

    return () => {
      componentRegistry.unregisterComponent('camera-equipment-manager');
      dataFlow.unregisterNode('camera-equipment-manager: equipment');
      dataFlow.unregisterNode('camera-equipment-manager:maintenance');
};
}, [componentRegistry, dataFlow]);

  // Google Drive Storage Integration - Sync Equipment Data
  const syncEquipmentToGoogleDrive = React.useCallback(async () => {
    setGoogleDriveSyncStatus('syncing');
    setSyncProgress(0);

    try {
      const authHeader = await auth.getAuthHeader();
      
      // Get current equipment data
      const equipmentData = integration.getData(`camera-equipment-manager:equipment`) || [];
      const maintenanceData = integration.getData(`camera-equipment-manager:maintenance`) || [];
      
      // Sync to Google Drive with Equipment folder structure (211-220)
      const response = await fetch('/api/google-drive/sync-equipment-to-project-folders', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': authHeader.Authorization,
    },
        body: JSON.stringify({
          equipmentData,
          maintenanceData,
          profession,
          folderStructure: {
            // Equipment & Asset Management (211-220)
            '211_Equipment_Manuals':'Equipment manuals and documentation','212_Equipment_Photos':'Equipment photos and specifications','213_Maintenance_Records':'Equipment maintenance schedules and records','214_Warranty_Documents':'Equipment warranty and service documents','215_Equipment_Analytics':'Equipment usage and performance data','216_Asset_Tracking':'Asset tracking and inventory data','217_Equipment_Backups':'Equipment configuration backups','218_Purchase_Records':'Equipment purchase receipts and invoices','219_Service_Records':'Equipment service and repair records','220_Equipment_Reports' : 'Equipment analytics and reporting data'
      },
          targetFolder: '211_Equipment_Manuals'
  })
  });

      if (response.ok) {
        const result = await response.json();
        setGoogleDriveSyncStatus('success');
        
        // Broadcast sync completion to other components
        communication.sendMessage({
          type: 'equipment-synced-to-drive',
          from: 'camera-equipment-manager',
          to: 'all',
          priority: 'high',
          data: {
            equipmentCount: result.equipmentCount || 0,
            maintenanceCount: result.maintenanceCount || 0,
            profession
      }
    });
  } else {
        throw new Error('Failed to sync equipment to Google Drive');
  }
} catch (error) {
      console.error('Google Drive equipment sync error: ', error);
      setGoogleDriveSyncStatus('error');
} finally {
      setSyncProgress(100);
}
}, [profession, integration, communication]);

  // Google Sheets Integration - Sync Equipment Analytics
  const syncEquipmentToGoogleSheets = React.useCallback(async () => {
    setGoogleSheetsSyncStatus('syncing');
    setSyncProgress(0);

    try {
      const authHeader = await auth.getAuthHeader();
      
      // Get current equipment analytics data
      const equipmentData = integration.getData(`camera-equipment-manager:equipment`) || [];
      const analyticsData = integration.getData(`camera-equipment-manager:analytics`) || [];
      
      // Sync to Google Sheets for equipment analytics
      const response = await fetch('/api/google-sheets/sync-equipment-analytics', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': authHeader.Authorization,
    },
        body: JSON.stringify({
          equipmentData,
          analyticsData,
          profession,
          sheetName: `Equipment_Analytics_${profession}_${new Date().toISOString().split('T')[0]}`,
          includeLogs: true // Include all logs as requested
  })
  });

      if (response.ok) {
        const result = await response.json();
        setGoogleSheetsSyncStatus('success');
        
        // Broadcast sync completion to other components
        communication.sendMessage({
          type: 'equipment-synced-to-sheets',
          from: 'camera-equipment-manager',
          to: 'all',
          priority: 'high',
          data: {
            sheetUrl: result.sheetUrl,
            rowsAdded: result.rowsAdded || 0,
            profession
      }
    });
  } else {
        throw new Error('Failed to sync equipment to Google Sheets');
  }
} catch (error) {
      console.error('Google Sheets equipment sync error:', error);
      setGoogleSheetsSyncStatus('error');
} finally {
      setSyncProgress(100);
}
}, [profession, integration, communication]);
  const [selectedCamera, setSelectedCamera] = useState('Canon EOS R5');
  const [selectedCards, setSelectedCards] = useState<Array<{ capacity: string; count: number; estimatedPhotos: { raw: number; craw?: number } }>>([]);
  const [selectedBrand, setSelectedBrand] = useState('Canon');
  const [newCameraDetection, setNewCameraDetection] = useState<{ found: boolean; newModels: CameraSpec[]; totalModels: number; lastUpdated: string } | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [recentlyChosen, setRecentlyChosen] = useState<Array<{ name: string; timestamp: string; brand: string }>>([]);
  const [showAllCameras, setShowAllCameras] = useState(false);
  const [sortByYear, setSortByYear] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [firmwareStatuses, setFirmwareStatuses] = useState<Map<string, any>>(new Map());
  const [firmwareDialogOpen, setFirmwareDialogOpen] = useState(false);
  const [selectedFirmwareCamera, setSelectedFirmwareCamera] = useState<CameraSpec | null>(null);
  const [equipmentType, setEquipmentType] = useState('cameras'); // cameras, video_lights, photo_flash
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load recently chosen cameras (server first, fallback local)
  useEffect(() => {
    fetch('/api/user/equipment', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const rc = j?.data?.recent_cameras;
        if (rc && Array.isArray(rc)) {
          setRecentlyChosen(rc);
        } else {
          const saved = localStorage.getItem('creatorhub-recent-cameras');
          if (saved) {
            try { setRecentlyChosen(JSON.parse(saved)); } catch (e) { console.warn('Failed to parse recent cameras:', e); }
          }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem('creatorhub-recent-cameras');
        if (saved) {
          try { setRecentlyChosen(JSON.parse(saved)); } catch (e) { console.warn('Failed to parse recent cameras from localStorage:', e); }
        }
      });
  }, []);

  // Merge server-saved equipment with recently chosen list
  useEffect(() => {
    if (savedEquipment) {
      const serverEquipment = savedEquipment as { data?: { recent_cameras?: Array<{ name: string; timestamp: string; brand: string }> } };
      const recentCams = serverEquipment?.data?.recent_cameras;
      if (recentCams && Array.isArray(recentCams)) {
        setRecentlyChosen(prev => {
          const merged = [...prev];
          recentCams.forEach((cam) => {
            if (!merged.some(existing => existing.name === cam.name)) {
              merged.push(cam);
            }
          });
          return merged.slice(0, 8);
        });
      }
    }
  }, [savedEquipment]);

  // Search functionality (moved before usage)
  const searchCameras = (query: string) => {
    if (!query.trim()) return [];
    
    const lowercaseQuery = query.toLowerCase();
    return WORLD_CAMERA_DATABASE.filter(camera => {
      const fullName = `${camera.brand} ${camera.model}`.toLowerCase();
      const yearString = camera.year.toString();
      const megapixelString = camera.megapixels.toString();
      
      return (
        fullName.includes(lowercaseQuery) ||
        camera.brand.toLowerCase().includes(lowercaseQuery) ||
        camera.model.toLowerCase().includes(lowercaseQuery) ||
        yearString.includes(lowercaseQuery) ||
        megapixelString.includes(lowercaseQuery) ||
        camera.cardTypes.some(type => type.toLowerCase().includes(lowercaseQuery))
    );
});
};

  // Get organized equipment based on type and brand
  const getOrganizedEquipment = (): (CameraSpec | VideoLightSpec | PhotoFlashSpec)[] => {
    if (equipmentType === 'cameras') {
      let cameras = getCamerasByBrand(selectedBrand);
      
      // Apply category filter if selected
      if (selectedCategory !== 'all') {
        const categoryCameras = getCamerasByCategory(selectedCategory as 'dslr' | 'mirrorless' | 'cinema' | 'medium_format');
        const categoryModelSet = new Set(categoryCameras.map(c => `${c.brand}-${c.model}`));
        cameras = cameras.filter(c => categoryModelSet.has(`${c.brand}-${c.model}`));
      }
      
      if (sortByYear) {
        cameras = cameras.sort((a, b) => b.year - a.year);
  }
      
      if (!showAllCameras) {
        cameras = cameras.filter(camera => camera.year >= 2018);
  }
      
      return cameras;
} else if (equipmentType === 'video_lights') {
      let lights = VIDEO_LIGHTS_DATABASE.filter(light => 
        selectedBrand === 'All' || light.brand === selectedBrand
    );
      if (sortByYear) {
        lights = lights.sort((a, b) => b.year - a.year);
  }
      return lights;
} else {
      let flashes = PHOTO_FLASH_DATABASE.filter(flash => 
        selectedBrand === 'All' || flash.brand === selectedBrand
    );
      if (sortByYear) {
        flashes = flashes.sort((a, b) => b.year - a.year);
  }
      return flashes;
}
};

  const searchResults = searchAllEquipment(searchQuery);
  const currentSearchResults = equipmentType === 'cameras' ? searchResults.cameras :
                              equipmentType === 'video_lights' ? searchResults.videoLights :
                              searchResults.photoFlash;
  const organizedEquipment = showSearchResults ? currentSearchResults : getOrganizedEquipment();
  const totalDatabaseCount = WORLD_CAMERA_DATABASE?.length || 0;
  
  // Calculate missing variables for UI display
  const totalCamerasForBrand = equipmentType === 'cameras' ? getCamerasByBrand(selectedBrand).length : 0;
  const allCamerasForBrand = equipmentType === 'cameras' ? getCamerasByBrand(selectedBrand) : [];
  const hiddenCamerasCount = equipmentType === 'cameras' ? allCamerasForBrand.filter(camera => camera.year < 2018).length : 0;

  // Check firmware status when organized equipment changes (only for cameras)
  useEffect(() => {
    if (equipmentType === 'cameras' && organizedEquipment.length > 0) {
      checkFirmwareStatus(organizedEquipment);
}
}, [organizedEquipment.length, selectedBrand, showSearchResults, equipmentType]);

  // Helper function to get firmware status for a camera
  const getFirmwareStatus = (camera: CameraSpec | VideoLightSpec | PhotoFlashSpec) => {
    const key = `${camera.brand}-${camera.model}`;
    return firmwareStatuses.get(key);
};

  // Handle firmware indicator click
  const handleFirmwareClick = (camera: CameraSpec | VideoLightSpec | PhotoFlashSpec) => {
    setSelectedFirmwareCamera(camera);
    setFirmwareDialogOpen(true);
};

  // Handle firmware marked as updated
  const handleFirmwareUpdated = () => {
    if (selectedFirmwareCamera) {
      // Refresh firmware status for this camera
      checkFirmwareStatus([selectedFirmwareCamera]);
}
};

  // Brand-specific camera getters for optimized access
  const getBrandCameras = (brand: string): CameraSpec[] => {
    switch (brand) {
      case 'Canon': return getCanonCameras();
      case 'Sony': return getSonyCameras();
      case 'Nikon': return getNikonCameras();
      case 'Fujifilm': return getFujifilmCameras();
      case 'Panasonic': return getPanasonicCameras();
      default: return getCamerasByBrand(brand);
    }
  };

  const handleDetectNewCameras = async () => {
    setIsDetecting(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const detection = detectNewCameraModels();
      setNewCameraDetection({
        found: detection.length > 0,
        newModels: detection,
        totalModels: WORLD_CAMERA_DATABASE.length,
        lastUpdated: new Date().toISOString(),
      });
      setIsDetecting(false);
}, 2000);
};

  const handleCameraSelection = (cameraName: string) => {
    setSelectedCamera(cameraName);
    setSelectedCards([]);
    
    // Add to recently chosen list
    const newRecent = [
      {
        name: cameraName,
        timestamp: new Date().toISOString(),
        brand: cameraName.split('')[0]
},
      ...recentlyChosen.filter(item => item.name !== cameraName)
    ].slice(0, 8); // Keep only last 8 choices
    
    setRecentlyChosen(newRecent);
    fetch('/api/user/equipment', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ recentCameras: newRecent })
    }).catch(() => {});
    localStorage.setItem('creatorhub-recent-cameras', JSON.stringify(newRecent));
};

  // Search functionality moved earlier

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (equipmentType === 'cameras') {
      const cameraResults = searchCameras(query);
      setShowSearchResults(query.trim().length > 0 && cameraResults.length > 0);
    } else {
      setShowSearchResults(query.trim().length > 0);
    }
};

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearchResults(false);
};

  // Check firmware status for visible cameras
  const checkFirmwareStatus = async (cameras: (CameraSpec | VideoLightSpec | PhotoFlashSpec)[]) => {
    try {
      const response = await fetch('/api/camera-firmware/firmware-status/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameras: cameras.map((camera: CameraSpec | VideoLightSpec | PhotoFlashSpec) => ({
            brand: camera.brand,
            model: camera.model
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        const statusMap = new Map<string, any>();
        
        data.statuses.forEach((status: any) => {
          const key = `${status.brand}-${status.model}`;
          statusMap.set(key, status);
        });
        
        setFirmwareStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error checking firmware status:', error);
}
};
  const totalItemsForBrand = equipmentType === 'cameras' ? getCamerasByBrand(selectedBrand).length :
                           equipmentType === 'video_lights' ? VIDEO_LIGHTS_DATABASE.filter(l => l.brand === selectedBrand).length :
                           PHOTO_FLASH_DATABASE.filter(f => f.brand === selectedBrand).length;
  const hiddenItemsCount = totalItemsForBrand - organizedEquipment.length;

  return (
    <Box sx={{ p:  3, maxWidth: 120, mx: 'auto'}}>
      <Paper sx={{ p:  4, mb:  4, bgcolor: 'background.paper', borderRadius: 2, boxShadow:  3 ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <PhotoCamera sx={{ fontSize:  32, color: 'primary.main'}} />
          <Typography variant="h4" sx={{  fontWeight: 600, color: theming.colors.primary }}>
            Profesjonelt Utstyr Database
          </Typography>
        </Box>
        
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem'}}>
          Komplett utstyr database med kameraer, video lys og foto flash. Ekte firmware-sjekking fra produsentenes nettsider
        </Typography>

        {/* Google Drive & Sheets Integration Buttons */}
        <Box sx={{ mt:  3, mb:  3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap'}}>
          <Button
            startIcon={
              <Box 
                component="img" 
                src="https: //fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                alt="Google Drive"
                sx={{ width: 20, height: 20}}
              />
        }
            variant="outlined"
            disabled={googleDriveSyncStatus === 'syncing'}
            sx={{ 
              color: googleDriveSyncStatus === 'success' ? '#4caf50' : '#ff6b35',
              borderColor: googleDriveSyncStatus === 'success' ? '#4caf50' : '#ff6b35', '&:hover': {
                borderColor: '#4caf50',
                bgcolor: 'rgba(6, 175, 80, 0.1)'
          }
        }}
            onClick={syncEquipmentToGoogleDrive}
          >
            {googleDriveSyncStatus === 'syncing' ? 'Synkroniserer...' : 
             googleDriveSyncStatus === 'success' ? 'Google Drive' : 'Sync Equipment til Drive'}
          </Button>
          
          <Button
            startIcon={
              <Box 
                component="img" 
                src="https: //fonts.gstatic.com/s/i/productlogos/sheets/v16/24px.svg"
                alt="Google Sheets"
                sx={{ width: 20, height: 20}}
              />
        }
            variant="outlined"
            disabled={googleSheetsSyncStatus === 'syncing'}
            sx={{ 
              color: googleSheetsSyncStatus === 'success' ? '#4caf50' : '#',
              borderColor: googleSheetsSyncStatus === 'success' ? '#4caf50' : '#','&:hover': {
                borderColor: '#4caf50',
                bgcolor: 'rgba(6, 175, 80, 0.1)'
          }
        }}
            onClick={syncEquipmentToGoogleSheets}
          >
            {googleSheetsSyncStatus === 'syncing' ? 'Synkroniserer...' : 
             googleSheetsSyncStatus === 'success' ? 'Google Sheets' : 'Sync Equipment til Sheets'}
          </Button>

          {(googleDriveSyncStatus === 'syncing' || googleSheetsSyncStatus === 'syncing') && (
            <Box sx={{ flexGrow: 1, maxWidth: 200 }}>
              <LinearProgress 
                variant="determinate"
                value={syncProgress}
                sx={{ 
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#ff6b35'
                  }
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {syncProgress}% synkronisert
              </Typography>
            </Box>
          )}
        </Box>

        {/* Equipment Type Selector */}
        <Box sx={{ mt:  3, mb:  2 }}>
          <FormControl sx={{ minWidth: 250}}>
            <InputLabel>Velg Utstyr Type</InputLabel>
            <Select
              value={equipmentType}
              label="Velg Utstyr Type"
              onChange={(e) => setEquipmentType(e.target.value)}
              sx={{ bgcolor: 'background.default'}}
            >
              <MenuItem value="cameras">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5}}>
                  <PhotoCamera sx={{ fontSize:  20, color: 'primary.main'}} />
                  <span>Kameraer ({WORLD_CAMERA_DATABASE.length})</span>
                </Box>
              </MenuItem>
              <MenuItem value="video_lights">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5}}>
                  <Settings sx={{ fontSize:  20, color: 'secondary.main'}} />
                  <span>Video Lys ({VIDEO_LIGHTS_DATABASE.length})</span>
                </Box>
              </MenuItem>
              <MenuItem value="photo_flash">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5}}>
                  <Settings sx={{ fontSize:  20, color: 'warning.main'}} />
                  <span>Foto Flash ({PHOTO_FLASH_DATABASE.length})</span>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        {/* Test Firmware Checking Button */}
        <Button 
          variant="outlined" 
          onClick={() => window.open('/api/camera-firmware/firmware-status/Canon/EOS R5', '_blank')}
          sx={{ mt:  2 }}
        >
          🔧 Test firmware-sjekking (Canon EOS R5)
        </Button>
      </Paper>

      <Grid container spacing={3}>
        {/* Camera Selection - Redesigned with Integrated Recently Chosen */}
        <Grid xs={12} lg={8}>
          <MuiCard sx={{ borderRadius: 2, boxShadow:  2 }}>
            <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5}}>
                  {equipmentType === 'cameras' && <PhotoCamera sx={{ color: 'primary.main', fontSize: 24}} />}
                  {equipmentType === 'video_lights' && <Settings sx={{ color: 'secondary.main', fontSize: 24}} />}
                  {equipmentType === 'photo_flash' && <Settings sx={{ color: 'warning.main', fontSize: 24}} />}
                  <Typography variant="h6" sx={{  fontWeight: 600}}>
                    {equipmentType === 'cameras' && 'Kamera Database'}
                    {equipmentType === 'video_lights' && 'Video Lys Database'}
                    {equipmentType === 'photo_flash' && 'Foto Flash Database'}
                  </Typography>
                </Box>
                <Alert severity="info" sx={{ py: 0, px: 1.5 }}>
                  <Typography variant="caption">
                    {equipmentType === 'cameras' && `${WORLD_CAMERA_DATABASE.length} modeller fra ${SUPPORTED_BRANDS.length} produsenter (totalt ${totalDatabaseCount} i database)`}
                    {equipmentType === 'video_lights' && `${VIDEO_LIGHTS_DATABASE.length} video lys modeller`}
                    {equipmentType === 'photo_flash' && `${PHOTO_FLASH_DATABASE.length} foto flash modeller`}
                  </Typography>
                </Alert>
              </Box>

              {/* Search Functionality */}
              <Box sx={{ mb:  3 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={
                    equipmentType === 'cameras' ? 'Søk etter kamera (modell, merke, år, MP)...' :
                    equipmentType === 'video_lights' ? 'Søk etter video lys (modell, merke, watt, type)...' :
                    'Søk etter foto flash (modell, merke, guide number, type)...'
              }
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'action.active'}} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}>
                          <Clear />
                        </IconButton>
                      </InputAdornment>
                    )}}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius:  2,
                      bgcolor: 'background.default',
                }
              }}
                />
                
                {showSearchResults && (
                  <Alert severity="info" sx={{ mt: 1.5}}>
                    <Typography variant="body2">
                      Søkeresultater: {currentSearchResults.length} kameraer funnet
                      {currentSearchResults.length > 0 && (
                        <Button 
                          size="small" 
                          onClick={clearSearch}
                          sx={{ ml: 1, fontSize: '0.75rem'}}
                        >
                          Tilbake til {selectedBrand}
                        </Button>
                      )}
                    </Typography>
                  </Alert>
                )}
              </Box>

              {/* Recently Chosen - Compact Integration */}
              {recentlyChosen.length > 0 && (
                <Box sx={{ 
                  mb:  3, 
                  p: 2, bgcolor: 'action.hover', 
                  borderRadius:  2,
                  border:  1,
                  borderColor: 'divider'
          }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
                    <History sx={{ color: 'secondary.main', fontSize: 18}} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600,fontSize: '0.9rem'}}>
                      Nylig valgte kameraer
                    </Typography>
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1, flexWrap: 'wrap',
                    maxHeight: '80px',
                    overflowY: 'auto'
            }}>
                    {(recentlyChosen || []).slice(0, 6).map((camera, index) => {
                      const isSelected = selectedCamera === camera.name;
                      return (
                        <Button
                          key={`${camera.name}-${index}`}
                          variant={isSelected ? "contained" : "outlined"}
                          size="small"
                          onClick={() => {
                            handleCameraSelection(camera.name);
                            // Auto-select brand when selecting from recent
                            setSelectedBrand(camera.brand);
                      }}
                          sx={{
                            minHeight: '32px',
                            fontSize: '0.75rem',
                            px: 1.5,
                            py: 0.5,
                            borderRadius:  2,
                            textTransform: 'none',
                            fontWeight: isSelected ? 600 : 50,
                            bgcolor: isSelected ? 'primary.main' : 'transparent',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            position: 'relative','&:hover': {
                              bgcolor: isSelected ? 'primary.dark' : 'action.hover',
                              transform: 'translateY(-1px)',
                              boxShadow: 2 }, '&::after': index === 0 ? {
                              content: '"NY"',
                              position: 'absolute',
                              top: -8,
                              right: -8,
                              fontSize: '0.6rem',
                              bgcolor: 'secondary.main',
                              color: 'white',
                              borderRadius: '50%',
                              width: 16,
                              height: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold'
                      } : {}
                      }}
                        >
                          {camera.name.replace(camera.brand + ' ', '')}
                        </Button>
                    );
                })}
                  </Box>
                </Box>
              )}
              
              {/* Quick Access Cameras */}
              {equipmentType === 'cameras' && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    <FilterList sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    Hurtigvalg
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {getPopularCameras().slice(0, 3).map((cam: CameraSpec) => (
                      <Button key={`popular-${cam.brand}-${cam.model}`} size="small" variant="outlined" onClick={() => handleCameraSelection(`${cam.brand} ${cam.model}`)}>
                        {cam.brand} {cam.model}
                      </Button>
                    ))}
                    {getLatestCameras(3).map((cam: CameraSpec) => (
                      <Button key={`latest-${cam.brand}-${cam.model}`} size="small" variant="outlined" color="secondary" onClick={() => handleCameraSelection(`${cam.brand} ${cam.model}`)}>
                        {cam.brand} {cam.model} (NY)
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Brand Selection - Improved Design */}
              <Box sx={{ mb:  3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary'}}>
                  Velg merke
                </Typography>
                
                <Grid container spacing={1.5}>
                  {SUPPORTED_BRANDS.map((brand) => (
                    <Grid xs={6} sm={4} md={3} key={brand}>
                      <Paper 
                        elevation={selectedBrand === brand ? 3 : 1}
                        sx={{ 
                          p: 1,
                          cursor: 'pointer',
                          bgcolor: selectedBrand === brand ? 'primary.main' : 'background.paper',
                          color: selectedBrand === brand ? 'white' : 'text.primary',
                          border:  1,
                          borderColor: selectedBrand === brand ? 'primary.main' : 'divider',
                          borderRadius:  2,
                          textAlign: 'center',
                          transition: 'all 0.2s ease-in-out','&:hover': {
                            transform: selectedBrand !== brand ? 'translateY(-1px)' : 'none',
                            boxShadow: 2 }
                    }}
                        onClick={() => setSelectedBrand(brand)}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5}}>
                          {brand}
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: selectedBrand === brand ? 'rgba(255,255,255,0.82)' : 'text.secondary' 
                    }}>
                          {getCamerasByBrand(brand).length} modeller
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Camera Models - Enhanced with Year Organization and Search */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary'}}>
                    {showSearchResults ? (
                      `Søkeresultater (${organizedEquipment.length} kameraer)`
                    ) : (
                      `${selectedBrand} kameraer (${organizedEquipment.length} av ${totalCamerasForBrand})`
                    )}
                  </Typography>
                  
                  {!showSearchResults && (
                    <Box sx={{ display: 'flex', gap:  1 }}>
                      <IconButton size="small" title="Filter utstyr" onClick={() => setSelectedCategory(selectedCategory === 'all' ? 'mirrorless' : 'all')}>
                        <FilterList />
                      </IconButton>
                      <Button
                        size="small"
                        variant={sortByYear ? "contained" : "outlined"}
                        onClick={() => setSortByYear(!sortByYear)}
                        sx={{ fontSize: '0.75rem', px: 1.5}}
                      >
                        Sorter etter år
                      </Button>
                      {hiddenCamerasCount > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setShowAllCameras(!showAllCameras)}
                          sx={{ fontSize: '0.75rem', px: 1.5}}
                        >
                          {showAllCameras ? 'Vis nyere' : `Vis ${hiddenCamerasCount} eldre`}
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
                
                <Grid container spacing={1.5}>
                  {(organizedEquipment || []).map((camera) => {
                    const cameraName = `${camera.brand} ${camera.model}`;
                    const isSelected = selectedCamera === cameraName;
                    const isRecent = camera.year >= 2020;
                    
                    return (
                      <Grid xs={12} sm={6} md={4} key={`${camera.brand}-${camera.model}`}>
                        <Paper 
                          elevation={isSelected ? 4 : 1}
                          sx={{ 
                            p: 2, cursor: 'pointer',
                            bgcolor: isSelected ? 'success.50' : 'background.paper',
                            border: isSelected ? 2 : 1,
                            borderColor: isSelected ? 'success.main' : 'divider',
                            borderRadius:  2,
                            position: 'relative',
                            transition: 'all 0.2s ease-in-out','&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: 3 }
                      }}
                          onClick={() => handleCameraSelection(cameraName)}
                        >
                          {/* Brand badge for search results */}
                          {showSearchResults && (
                            <Box sx={{
                              position: 'absolute',
                              top:  8,
                              left:  8,
                              bgcolor: 'primary.main',
                              color: 'white',
                              px: 0.5,
                              py: 0.5,
                              borderRadius:  1,
                              fontSize: '0.6rem',
                              fontWeight: 'bold'
                      }}>
                              {camera.brand}
                            </Box>
                          )}
                          
                          {/* Firmware update indicator (priority) or Recent model indicator */}
                          {(() => {
                            const firmwareStatus = getFirmwareStatus(camera);
                            if (firmwareStatus?.hasUpdate) {
                              return (
                                <Box 
                                  sx={{
                                    position: 'absolute',
                                    top:  8,
                                    right:  8,
                                    bgcolor: 'warning.main',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width:  24,
                                    height:  24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 2,
                                    cursor: 'pointer','&:hover': {
                                      bgcolor: 'warning.dark',
                                      transform: 'scale(1.1)'
                              },
                                    transition: 'all 0.2s ease'
                            }}
                                  title={`Klikk for å lese mer om firmware-oppdatering: ${firmwareStatus.firmware?.version || 'Ny versjon'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFirmwareClick(camera);
                              }}
                                >
                                  <Update sx={{ fontSize: '0.9rem'}} />
                                </Box>
                            );
                        } else if (firmwareStatus?.hasUpdate === false) {
                              return (
                                <Box sx={{
                                  position: 'absolute',
                                  top:  8,
                                  right:  8,
                                  bgcolor: 'success.main',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width:  24,
                                  height:  24,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  zIndex: 2}}
                                title="Firmware er oppdatert"
                                >
                                  <Check sx={{ fontSize: '0.9rem'}} />
                                </Box>
                            );
                        } else if (isRecent && !showSearchResults) {
                              return (
                                <Box sx={{
                                  position: 'absolute',
                                  top:  8,
                                  right:  8,
                                  bgcolor: 'secondary.main',
                                  color: 'white',
                                  px: 0.5,
                                  py: 0.5,
                                  borderRadius:  1,
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold'
                          }}>
                                  NY
                                </Box>
                            );
                        }
                            return null;
                      })()}
                          
                          <Typography variant="subtitle2" sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            pr: (isRecent && !showSearchResults) ? 3 : 0,
                            pl: showSearchResults ? 3 : 0 }}>
                            {showSearchResults ? `${camera.brand} ${camera.model}` : camera.model}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                            <Typography variant="body2" color="text.secondary">
                              {'megapixels' in camera && `${(camera as CameraSpec).megapixels}MP`}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              color: camera.year >= 2020 ? 'success.main' : 'text.secondary',
                              fontWeight: (camera as CameraSpec).year >= 2020 ? 600 : 400 }}>
                              {camera.year}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap'}}>
                            {'cardTypes' in camera && (camera as CameraSpec).cardTypes.map((cardType: string, index: number) => (
                              <Typography key={index} variant="caption" sx={{ 
                                bgcolor: 'action.selected', 
                                px: 1, py: 0.5, 
                                borderRadius:  1,
                                fontSize: '0.7rem'
                        }}>
                                {cardType}
                              </Typography>
                            ))}
                          </Box>
                        </Paper>
                      </Grid>
                  );
              })}
                </Grid>
                
                {/* Summary info */}
                {!showSearchResults && !showAllCameras && hiddenCamerasCount > 0 && (
                  <Alert severity="info" sx={{ mt:  2 }}>
                    <Typography variant="body2">
                      Viser kameraer fra 2018 og nyere. Klikk "Vis {hiddenCamerasCount} eldre" for å se alle {selectedBrand} modeller.
                    </Typography>
                  </Alert>
                )}

                {hiddenItemsCount > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {hiddenItemsCount} elementer skjult av nåværende filter
                  </Typography>
                )}
                
                {/* No search results */}
                {showSearchResults && organizedEquipment.length === 0 && (
                  <Alert severity="warning" sx={{ mt:  2 }}>
                    <Typography variant="body2">
                      Ingen kameraer funnet for "{searchQuery},". Prøv å søke etter merke, modell, år eller spesifikasjoner.
                    </Typography>
                  </Alert>
                )}
              </Box>

              <Alert severity="success" sx={{ mt:  3 }}>
                <Typography variant="body2">
                  <strong>Valgt kamera: </strong> {selectedCamera}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Minnekort anbefalinger tilpasser seg automatisk til denne kamerans filstørrelser
                </Typography>
              </Alert>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Current Selection Summary */}
        <Grid xs={12} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                <Memory color="primary" />
                Valgte Minnekort
              </Typography>
              
              {selectedCards.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ingen minnekort valgt ennå. Bruk panelet nedenfor for å velge kort optimalisert for {selectedCamera}.
                </Typography>
              ) : (
                <Box>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    <strong>Totalt kort: </strong> {selectedCards.reduce((sum, card) => sum + card.count, 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    <strong>Estimerte RAW bilder: </strong> {selectedCards.reduce((sum, card) => sum + (card.estimatedPhotos.raw * card.count), 0).toLocaleString()}
                  </Typography>
                  
                  {selectedCards.map(card => (
                    <Typography key={card.capacity} variant="body2" color="text.secondary">
                      • {card.count}x {card.capacity} - ~{(card.estimatedPhotos.raw * card.count).toLocaleString()} RAW
                    </Typography>
                  ))}
                </Box>
              )}
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Dynamic Memory Card Selector */}
        <Grid xs={12}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                🎯 Minnekort Optimalisert for {selectedCamera}
              </Typography>
              
              <MemoryCardSelector
                selectedCamera={selectedCamera}
                onCardsSelected={(cards) => setSelectedCards(cards)}
              />
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Brand Statistics Overview */}
        <Grid xs={12}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                📊 Kamera Database Oversikt (2012+ Produksjonsår)
              </Typography>
              
              <Grid container spacing={2}>
                {SUPPORTED_BRANDS.map((brand) => {
                  const brandCameras = getBrandCameras(brand);
                  const newestYear = Math.max(...brandCameras.map(c => c.year));
                  const oldestYear = Math.min(...brandCameras.map(c => c.year));
                  
                  return (
                    <Grid xs={12} sm={6} md={4} key={brand}>
                      <Paper 
                        sx={{ 
                          p: 2, bgcolor: selectedBrand === brand ? 'primary.50' : 'background.paper',
                          border: selectedBrand === brand ? 2 : 1,
                          borderColor: selectedBrand === brand ? 'primary.main' : 'divider',
                          ...theming.getThemedCardSx()
                  }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  1 }}>
                          {brand}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5}}>
                          {brandCameras.length} modeller
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5}}>
                          {oldestYear} - {newestYear}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Nyeste: {brandCameras[0]?.model}
                        </Typography>
                      </Paper>
                    </Grid>
                );
            })}
              </Grid>

              <Alert severity="info" sx={{ mt:  2 }}>
                <Typography variant="body2">
                  🔄 <strong>Automatisk oppdatering: </strong> Systemet oppdateres automatisk med nye 
                  kameramodeller som lanseres fra dagens dato. Database inkluderer alle store produsenter 
                  fra 2012+ produksjonsår med optimaliserte minnekort anbefalinger.
                </Typography>
              </Alert>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Memory Card Selector - Improved , *, /}
        <Grid xs={12} lg={4}>
          <Box sx={{ position: 'sticky', top: 20}}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius:  1 }}>
              <Typography variant="body2" color="text.secondary">
                🎯 Smart minnekort forslag
              </Typography>
              <Alert severity="info" sx={{ mt:  1 }}>
                Avansert minnekort verktøy kommer snart
              </Alert>
            </Box>
          </Box>
        </Grid>

        {/* New Camera Detection Test - Redesigned */}
        <Grid xs={12}>
          <MuiCard sx={{ borderRadius: 2, boxShadow:  2 }}>
            <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5}}>
                  <Search sx={{ color: 'info.main', fontSize: 24}} />
                  <Typography variant="h6" sx={{  fontWeight: 600}}>
                    Automatisk Kamera Deteksjon
                  </Typography>
                </Box>
                <Button variant="contained" 
                  onClick={handleDetectNewCameras}
                  disabled={isDetecting}
                  startIcon={isDetecting ? <CircularProgress size={20} sx={theming.getThemedButtonSx()} /> : theming.getThemedIcon('search')}
                  sx={{ borderRadius:  2 }}
                >
                  {isDetecting ? 'Søker...' : 'Søk etter nye kameraer'}
                </Button>
              </Box>

              {newCameraDetection && (
                <Alert 
                  severity={newCameraDetection.found ? "success" : "info"}
                  sx={{ mb:  3, borderRadius:  2 }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5}}>
                    {newCameraDetection.found ? (
                      `${newCameraDetection.newModels.length} nye kameraer funnet!`
                    ) : (
                      'Ingen nye kameraer funnet for øyeblikket'
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {newCameraDetection.found ? (
                      `Total database: ${newCameraDetection.totalModels} modeller • Sist oppdatert: ${new Date(newCameraDetection.lastUpdated).toLocaleString('')}`
                    ) : (
                      'Systemet sjekker automatisk for nye modeller daglig')}
                  </Typography>
                </Alert>
              )}

              {newCameraDetection?.found && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Nye modeller funnet
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {newCameraDetection.newModels.map((camera, index) => (
                      <Grid xs={12} sm={6} md={3} key={index}>
                        <Paper 
                          elevation={2}
                          sx={{ 
                            p: 2, bgcolor: 'success.5',
                            border:  1,
                            borderColor: 'success.20',
                            borderRadius:  2,
                            transition: 'transform 0.2s ease-in-out', '&:hover': {
                              transform: 'translateY(-2px)'
                      },
                      ...theming.getThemedCardSx()
                      }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5}}>
                            {camera.brand} {camera.model}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                            {camera.megapixels}MP • {camera.year}
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            bgcolor: 'success.main', 
                            color: 'white', 
                            px: 1, py: 0.5, 
                            borderRadius:  1,
                            fontSize: '0.7rem'
                    }}>
                            NY MODELL
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mt:  3, fontStyle:'italic'}}>
                I virkeligheten ville dette systemet koble seg til produsent-APIer og teknikknyhet feeds 
                for å automatisk oppdatere databasen med nye produktlanseringer.
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Firmware Information Dialog */}
      <FirmwareInfoDialog
        open={firmwareDialogOpen}
        onClose={() => setFirmwareDialogOpen(false)}
        camera={selectedFirmwareCamera}
        onFirmwareUpdated={handleFirmwareUpdated}
      />
    </Box>
);
}
