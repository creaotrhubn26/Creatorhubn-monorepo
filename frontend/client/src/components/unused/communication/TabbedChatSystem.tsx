// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

export default function TabbedChatSystem() {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || 'photographer';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  
  // Database connection for TabbedChatSystem
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateTabbedChatSystem = useMutation({
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
        {professionConfig ? `${professionConfig.displayName} - Tabbed Chat System` :'Tabbed Chat System'}
      </Typography>
      {professionConfig && (
        <Typography variant="body1" color="text.secondary" sx={{ mt:  2 }}>
          Fanebasert chat-system for {professionConfig.displayName.toLowerCase()}-prosjekter
        </Typography>
      )}
    </Box>
  );
}