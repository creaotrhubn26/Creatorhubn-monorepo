// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function ContractGeneratorWizard() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for ContractGeneratorWizard
  const { data: contractData = [], isLoading } = useQuery({
    queryKey: ['/api/contract', 'user-data'],
    queryFn: () => apiRequest('/api/contract/user-data', ),
    retry: false,
});

  // Mutation for updating contract data
  const updateContractGeneratorWizard = useMutation({
    mutationFn: async (data: any) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/contract/update', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        Contract Generator Wizard
      </Typography>
    </Box>
  );
}