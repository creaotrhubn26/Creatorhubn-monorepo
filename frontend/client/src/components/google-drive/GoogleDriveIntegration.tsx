import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { CloudDone, Launch } from '@mui/icons-material';

interface GoogleDriveIntegrationProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'
}

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size?: string;
  modifiedTime: string
}

export const GoogleDriveIntegration: React.FC<GoogleDriveIntegrationProps> = ({
  userd,
  profession
}) => {
  // Enhanced Master Integration
  const { features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Comprehensive Feature System for Google Drive Integration
  const googleDriveIntegrationAccess = features.checkFeatureAccess('google-drive-integration,');
  const googleDriveSyncAccess = features.checkFeatureAccess('google-drive-sync');
  const googleDriveFileAccess = features.checkFeatureAccess('google-drive-file-access');
  const googleDriveUploadAccess = features.checkFeatureAccess('google-drive-upload');
  const googleDriveDownloadAccess = features.checkFeatureAccess('google-drive-download');
  const googleDriveSharingAccess = features.checkFeatureAccess('google-drive-sharing');
  const googleDriveAnalyticsAccess = features.checkFeatureAccess('google-drive-analytics');
  const googleDriveBackupAccess = features.checkFeatureAccess('google-drive-backup');

  const { user } = useAuth();
  
  // Track feature usage
  useEffect(() => {
    features.trackFeatureUsage('google-drive-integration', 'opened', {
      timestamp: Date.now(),
      component: 'GoogleDriveIntegration',
      userId: userd,
      profession: profession
});
}, [features, userId, profession]);
  
  // Fetch Google Drive connection status
  const { data: connectionStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['google-drive-connection', userId],
    queryFn: async () => {
      const response = await fetch('/test/api/google-drive/hybrid/test', {
        headers: auth
  });
      return response.json();
  }
});

  const getConnectionStatusColor = () => {
    if (statusLoading) return 'default';
    if (connectionStatus?.success && connectionStatus?.oauthAvailable) return 'success';
    if (connectionStatus?.success) return 'warning';
    return 'error';
};

  return (
    <Box>
      {/* Feature Analytics Display */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, mb:  2,
        p:  1,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius:  1,
        border: '1px solid rgba(0,0,0,0.1)'
    }}>
        <Typography variant="caption" color="text.secondary">
          Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
        </Typography>
        <Chip 
          label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '10px', height: 18}}
        />
      </Box>

      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudDone color="primary" />
          <Typography variant="subtitle1">
            Google Drive
          </Typography>
        </Box>
        <Chip
          label={statusLoading ? 'Sjekker...' : connectionStatus?.success ? 'Tilkoblet' : 'Ikke tilkoblet'}
          color={getConnectionStatusColor()}
          size="small"
        />
      </Box>

      <Button variant="contained"
        startIcon={theming.getThemedIcon('launch')}
        onClick={() => window.open('https://drive.google.com', '_blank')}
        fullWidth
        sx={{ mt:  1 }}
      >
        Åpne Google Drive
      </Button>
    </Box>
  );
};

export default GoogleDriveIntegration;