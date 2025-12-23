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

export default function PhotoDeliveryGalleryManager() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for PhotoDeliveryGalleryManager
  const { data: galleryData = [], isLoading } = useQuery({
    queryKey: ['/api/gallery', 'user-data'],
    queryFn: () => apiRequest('/api/gallery/user-data', ),
    retry: false,
});

  // Mutation for updating gallery data
  const updatePhotoDeliveryGalleryManager = useMutation({
    mutationFn: async (data: any) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/gallery/update', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gallery', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        Photo Delivery Gallery Manager
      </Typography>
    </Box>
  );
}