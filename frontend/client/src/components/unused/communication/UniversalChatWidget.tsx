// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

export default function UniversalChatWidget() {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || 'photographer';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  
  // Database connection for UniversalChatWidget
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateUniversalChatWidget = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/component/update', {
        method: 'POS',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        {professionConfig ? `${professionConfig.displayName} - Chat` :'Universal Chat'}
      </Typography>
      {professionConfig && (
        <Typography variant="body1" color="text.secondary" sx={{ mt:  2 }}>
          Kommunikasjon tilpasset {professionConfig.displayName.toLowerCase()}-arbeid og klientsamtaler
        </Typography>
      )}
    </Box>
  );
}