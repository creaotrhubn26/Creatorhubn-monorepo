// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import { Box, Typography } from '@mui/material';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';

export default function MicrosoftOnedriveIntegration() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Database connection for MicrosoftOnedriveIntegration
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateMicrosoftOnedriveIntegration = useMutation({
    mutationFn: async (data: any) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/component/update', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        Microsoft Onedrive Integration
      </Typography>
    </Box>
  );
}