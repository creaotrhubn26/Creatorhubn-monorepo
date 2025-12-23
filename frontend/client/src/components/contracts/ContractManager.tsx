import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ContractManagerProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function ContractManager({ 
  profession = 'photographer' 
}: ContractManagerProps) {
  const queryClient = useQueryClient();

  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // Database connection for ContractManager
  const { data: contractData = [], isLoading } = useQuery({
    queryKey: ['/api/contracts','user-data'],
    queryFn: () => apiRequest('/api/contracts'),
    retry: false,
  });

  // Mutation for updating contract data
  const updateContractManager = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/contracts/update', {
        headers: {
          'Content-Type' : 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
    },
  });

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        ContractManager
      </Typography>
    </Box>
  );
}
