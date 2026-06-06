// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

export default function VideographerOnboardingWizard() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('videographer');
  
  // Database connection for VideographerOnboardingWizard
  const { data: videoData = [], isLoading } = useQuery({
    queryKey: ['/api/video', 'user-data'],
    queryFn: () => apiRequest('/api/video/user-data', ),
    retry: false,
});

  // Mutation for updating video data
  const updateVideographerOnboardingWizard = useMutation({
    mutationFn: async (data: any) => 
      const auth = await getAuthHeader();
      return apiRequest('/api/video/update', {
        headers: auth,
        headers: {
    },
        
        method: 'POST',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
        Videographer Onboarding Wizard
      </Typography>
    </Box>
  );
}