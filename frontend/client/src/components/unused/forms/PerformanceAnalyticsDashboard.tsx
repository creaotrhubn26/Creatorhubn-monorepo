// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

export default function PerformanceAnalyticsDashboard() {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || 'photographer';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  
  // Database connection for PerformanceAnalyticsDashboard with profession context
  const { data: dashboardData = [], isLoading } = useQuery({
    queryKey: ['/api/performance', 'user-data', userProfession],
    queryFn: () => apiRequest(`/api/performance/user-data?profession=${userProfession}`),
    retry: false,
});

  // Mutation for updating dashboard data
  const updatePerformanceAnalyticsDashboard = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/dashboard/update', {
        method: 'POST',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        {professionConfig ? `${professionConfig.displayName} - Performance Analytics` :'Performance Analytics Dashboard'}
      </Typography>
      {professionConfig && (
        <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
          Ytelsesanalyse og benchmarking for {professionConfig.displayName.toLowerCase()}
        </Typography>
      )}
      {isLoading && <Typography>Laster performance data...</Typography>}
      {professionsLoading && <Typography>Laster profesjonsdata...</Typography>}
    </Box>
  );
}