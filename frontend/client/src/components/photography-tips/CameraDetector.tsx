import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Chip,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PhotoCamera as CameraIcon,
  Upload as UploadIcon,
  CameraAlt as LensIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { PhotographyContextDetector } from '../../hooks/usePhotographyTips';
import { validateFileFormat, getFileAcceptAttribute } from '../../utils/UniversalFileFormatSupport';
import { apiRequest } from '@/lib/queryClient';
import { UniversalFileUpload } from '../universal/UniversalFileUpload';

interface CameraInfo {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  iso?: string;
  shutterSpeed?: string;
  dateTime?: string;
}

interface CameraDetectorProps {
  onCameraDetected?: (camera: string, lens?: string, settings?: any) => void;
  compact?: boolean;
}

export const CameraDetector: React.FC<CameraDetectorProps> = ({
  onCameraDetected,
  compact = false
}) => {
  const [loading, setLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // EXIF extraction utility connected to camera database
  const extractExifData = useCallback(async (file: File): Promise<CameraInfo> => {
    return new Promise(async (resolve, reject) => {
      try {
        // First check if camera database supports this file format
        const supportedFormat = await validateFileFormat(file);
        if (!supportedFormat.supported) {
          reject(new Error(`Filformat ${file.name.split('.').pop()?.toUpperCase()} er ikke støttet for dette kameraet. ${supportedFormat.message}`));
          return;
      }

        const reader = new FileReader();
        
        reader.onload = async () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;
            
            // Real EXIF extraction with camera database integration
            const exifData = await extractRealExifData(arrayBuffer, file.name, supportedFormat);
            
            // Validate camera against database
            if (exifData.make && exifData.model) {
              const cameraInfo = await validateCameraInDatabase(exifData.make, exifData.model);
              if (cameraInfo) {
                resolve({
                  ...exifData,
                  ...cameraInfo,
                  supportedFormat: supportedFormat.format
            });
            } else {
                resolve({
                  ...exifData,
                  supportedFormat: supportedFormat.format
            });
            }
          } else {
              resolve({
                ...exifData,
                supportedFormat: supportedFormat.format
          });
          }
        } catch (error) {
            reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
  } catch (error) {
      reject(error);
  }
});
}, []);

// Real EXIF data extraction with camera database support
const extractRealExifData = useCallback(async (arrayBuffer: ArrayBuffer, filename: string, supportedFormat: any): Promise<CameraInfo> => {
  try {
    // Use the camera database API for EXIF extraction
    const formData = new FormData();
    const blob = new Blob([arrayBuffer]);
    const file = new File([blob], filename);
    formData.append('file', file);
    
    const response = await apiRequest('/api/camera-formats/extract-exif', {
      headers: {
          "Content-Type" : "application/json"
    },
        
      method: 'POS',
      body: formData
});
    
    if (response.success && response.exifData) {
      return {
        make: response.exifData.make || 'Ukjent',
        model: response.exifData.model || 'Ukjent modell',
        lens: response.exifData.lens,
        focalLength: response.exifData.focalLength,
        aperture: response.exifData.aperture,
        iso: response.exifData.iso,
        shutterSpeed: response.exifData.shutterSpeed,
        dateTime: response.exifData.dateTime
  };
  }
    
    // Fallback for basic format info
    return {
      make: supportedFormat?.format?.manufacturer || 'Ukjent',
      model: 'Støttet modell',
      lens: 'Standard objektiv',
      focalLength: 'Variabel',
      aperture: 'Variabel',
      iso: 'Auto',
      shutterSpeed: 'Auto',
      dateTime: new Date().toISOString()
};
} catch (error) {
    console.warn('EXIF extraction failed, using format info: ', error);
    return {
      make: supportedFormat?.format?.manufacturer || 'Ukjent',
      model: 'Støttet modell',
      lens: 'Standard objektiv',
      focalLength: 'Variabel',
      aperture: 'Variabel',
      iso: 'Auto',
      shutterSpeed: 'Auto',
      dateTime: new Date().toISOString()
};
}
}, []);

// Validate camera against database
const validateCameraInDatabase = useCallback(async (make: string, model: string): Promise<any> => {
  try {
    const response = await apiRequest(`/api/camera-detection/validate?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    if (response.success && response.cameraInfo) {
      return response.cameraInfo;
  }
    return null;
} catch (error) {
    console.warn('Camera validation failed:', error);
    return null;
}
}, []);

  const handleFilesSelected = (files: File[]) => {
    console.log('📷 Bilde valgt for kamera-deteksjon, :', files);
    if (files.length > 0) {
      const file = files[0];
      processImageFile(file);
  }
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Kamera deteksjon opplasting fullført, :', results);
};

  const processImageFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const exifData = await extractExifData(file);
      setCameraInfo(exifData);

      // Extract and save camera info using context detector
      const camera = exifData.make && exifData.model ? 
        `${exifData.make} ${exifData.model}` : 
        undefined;
      
      if (camera) {
        PhotographyContextDetector.extractCameraFromExif({
          Make: exifData.make,
          Model: exifData.model
    });
        
        if (exifData.lens) {
          PhotographyContextDetector.extractLensFromExif({
            LensModel: exifData.lens
      });
      }

        onCameraDetected?.(camera, exifData.lens, {
          focalLength: exifData.focalLength,
          aperture: exifData.aperture,
          iso: exifData.iso,
          shutterSpeed: exifData.shutterSpeed
    });
    }

  } catch (error) {
      setError('Kunne ikke lese EXIF-data fra bildet');
      console.error('EXIF extraction error:', error);
  } finally {
      setLoading(false);
  }
}, [extractExifData, onCameraDetected]);

  if (compact) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap:  1 }}>
        <Box sx={{ display: 'inline-block', width: '120px'}}>
          <UniversalFileUpload
            onFilesSelected={handleFilesSelected}
            onUploadComplete={handleUploadComplete}
            allowedTypes="images"
            maxFiles={1}
            maxFileSizeMB={50}
            showFormatInfo={false}
            uploadEndpoint="/api/camera-formats/extract-exif"
            profession="photographer"
            enableBackgroundUpload={true}
            maxRetries={3}
          />
        </Box>
        {cameraInfo && (
          <Chip
            icon={<CheckIcon />}
            label={`${cameraInfo.make} ${cameraInfo.model}`}
            color="success"
            size="small"
          />
        )}
      </Box>
    );
}

  return (
    <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
          <CameraIcon sx={{ mr: 1, color: 'primary.main'}} />
          <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
            Smart Kamera-deteksjon
          </Typography>
          <Tooltip title="Last opp et bilde, så leser systemet EXIF-data automatisk">
            <InfoIcon sx={{ ml: 1, color: 'info.main', fontSize: 16}} />
          </Tooltip>
        </Box>

        {!cameraInfo && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
              Last opp et bilde fra kameraet ditt, så identifiserer systemet automatisk: </Typography>
            <Box sx={{ mb: 2 }}>
              <Chip icon={<CameraIcon />} label="Kameramodell" size="small" sx={{ mr: 1, mb: 1 }} />
              <Chip icon={<LensIcon />} label="Objektiv" size="small" sx={{ mr: 1, mb: 1 }} />
              <Chip icon={<SettingsIcon />} label="Innstillinger" size="small" sx={{ mr: 1, mb: 1 }} />
            </Box>
          </>
        )}

        <Box sx={{ textAlign: 'center'}}>
          <UniversalFileUpload
            onFilesSelected={handleFilesSelected}
            onUploadComplete={handleUploadComplete}
            allowedTypes="image"
            maxFiles={1}
            maxFileSizeMB={50}
            showFormatInfo={true}
            uploadEndpoint="/api/camera-formats/extract-exif"
            profession="photographer"
          />
        </Box>

        {loading && (
          <Box sx={{ mt:  2 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt:  1 }}>
              Leser EXIF-data...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mt:  2 }}>
            {error}
          </Alert>
        )}

        {cameraInfo && (
          <Box sx={{ mt:  2 }}>
            <Alert severity="success" sx={{ mb:  2 }}>
              <Typography variant="subtitle2">
                Kamera detektert automatisk!
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }} sm={6}>
                <Card variant="outlined" sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ py:  2 ,  ...theming.getThemedCardSx() }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <CameraIcon sx={{ mr: 1, fontSize: 20, color: 'primary.main'}} />
                      <Typography variant="subtitle2">Kamera</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {cameraInfo.make} {cameraInfo.model}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {cameraInfo.lens && (
                <Grid size={{ xs: 12 }} sm={6}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ py:  2 ,  ...theming.getThemedCardSx() }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                        <LensIcon sx={{ mr: 1, fontSize: 20, color: 'secondary.main'}} />
                        <Typography variant="subtitle2">Objektiv</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="bold">
                        {cameraInfo.lens}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ py:  2 ,  ...theming.getThemedCardSx() }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                      <SettingsIcon sx={{ mr: 1, fontSize: 20, color:'info.main'}} />
                      <Typography variant="subtitle2">Innstillinger</Typography>
                    </Box>
                    <Grid container spacing={1}>
                      {cameraInfo.aperture && (
                        <Grid item>
                          <Chip label={`Blender: ${cameraInfo.aperture}`} size="small" />
                        </Grid>
                      )}
                      {cameraInfo.shutterSpeed && (
                        <Grid item>
                          <Chip label={`Lukkertid: ${cameraInfo.shutterSpeed}`} size="small" />
                        </Grid>
                      )}
                      {cameraInfo.iso && (
                        <Grid item>
                          <Chip label={cameraInfo.iso} size="small" />
                        </Grid>
                      )}
                      {cameraInfo.focalLength && (
                        <Grid item>
                          <Chip label={`Brennvidde: ${cameraInfo.focalLength}`} size="small" />
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CameraDetector;