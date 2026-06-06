// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { UniversalFileUpload } from '../UniversalFileUpload';

export default function FileUpload() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for FileUpload
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateFileUpload = useMutation({
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

  const handleFilesSelected = (files: File[]) => {
    console.log('📁 Universal filer valgt, :', files);
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Universal opplasting fullført, :', results);
    queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
};

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
        Universal filopplasting - Alle kameraformater støttet
      </Typography>
      
      <UniversalFileUpload
        onFilesSelected={handleFilesSelected}
        onUploadComplete={handleUploadComplete}
        allowedTypes="all"
        maxFiles={50}
        maxFileSizeMB={1000}
        enableBackgroundUpload={true}
        maxRetries={3}
        profession="photographer"
        showFormatInfo={true}
        uploadEndpoint="/api/universal/upload"
        profession="photographer"
      />
    </Box>
  );
}