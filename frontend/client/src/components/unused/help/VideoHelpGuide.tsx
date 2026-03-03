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

export default function VideoHelpGuide() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for VideoHelpGuide
  const { data: videoData = [], isLoading } = useQuery({
    queryKey: ['/api/video', 'user-data'],
    queryFn: () => apiRequest('/api/video/user-data', ),
    retry: false,
});

  // Mutation for updating video data
  const updateVideoHelpGuide = useMutation({
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
        VideoHelpGuide
      </Typography>
    </Box>
  );
}