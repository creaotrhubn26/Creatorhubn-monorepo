// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface VendorAnalyticsProps {
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

export default function VendorAnalytics({
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
}: VendorAnalyticsProps) {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('vendor');
  const userProfession = user?.profession || 'vendor';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  
  // Database connection for VendorAnalytics with profession context
  const { data: vendorData = [], isLoading } = useQuery({
    queryKey: ['/api/vendor', 'user-data', userProfession],
    queryFn: () => apiRequest(`/api/vendor/user-data?profession=${userProfession}`),
    retry: false,
});

  // Mutation for updating vendor data
  const updateVendorAnalytics = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/vendor/update', {
        method: 'POST',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        {professionConfig ? `${professionConfig.displayName} - Vendor Analytics` :'Vendor Analytics'}
      </Typography>
      {professionConfig && (
        <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
          Leverandøranalyse og salgsstatistikk for {professionConfig.displayName.toLowerCase()}
        </Typography>
      )}
      {isLoading && <Typography>Laster vendor data...</Typography>}
      {professionsLoading && <Typography>Laster profesjonsdata...</Typography>}
    </Box>
  );
}