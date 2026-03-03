import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function AmazonStyleVideoShowcase() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for AmazonStyleVideoShowcase
  const { data: videoData = [], isLoading } = useQuery({
    queryKey: ['/api/video', 'user-data'],
    queryFn: () => apiRequest('/api/video/user-data', ),
    retry: false,
});

  // Mutation for updating video data
  const updateAmazonStyleVideoShowcase = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/video/update', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        AmazonStyleVideoShowcase
      </Typography>
    </Box>
  );
}