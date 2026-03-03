// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import { Box, Typography } from '@mui/material';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';

// Integration props for unified workflow connectivity
interface FeatureOverviewProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void
}

export default function FeatureOverview({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: FeatureOverviewProps) {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Database connection for FeatureOverview
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateFeatureOverview = useMutation({
    mutationFn: async (data: any) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/component/update', {
        headers: auth,
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
      handleFeatureOverviewUpdated(data);
  }
});

  // Integration handlers for unified workflow system
  const handleFeatureOverviewUpdated = (overviewData: any) => {
    console.log('📊 Feature Overview Updated, :', overviewData);
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `feature_overview_updated_${Date.now()}`,
        type: 'feature_overview_updated',
        title: 'Feature Overview Updated',
        message: 'Feature overview data has been updated',
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'feature_overview'
  });
  }
};

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        Feature Overview
      </Typography>
    </Box>
  );
}