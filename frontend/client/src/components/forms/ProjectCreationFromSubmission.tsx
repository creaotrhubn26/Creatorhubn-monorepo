import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

export default function ProjectCreationFromSubmission() {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || 'photographer';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  
  // Database connection for ProjectCreationFromSubmission with profession context
  const { data: projectData = [], isLoading } = useQuery({
    queryKey: ['/api/project','user-data', userProfession],
    queryFn: () => apiRequest(`/api/project/user-data?profession=${userProfession}`),
    retry: false,
});

  // Mutation for updating project data with profession context
  const updateProjectCreationFromSubmission = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/project/update', {
        method: 'POST',
        body: JSON.stringify({ ...data, profession: userProfession })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project', 'user-data', userProfession] });
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        {professionConfig ? `${professionConfig.displayName} - Prosjektopprettelse fra henvendelse` :'Prosjektopprettelse fra henvendelse'}
      </Typography>
      {professionConfig && (
        <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
          Opprett nye prosjekter basert på {professionConfig.displayName.toLowerCase()}-henvendelser
        </Typography>
      )}
      {isLoading && <Typography>Laster prosjektdata...</Typography>}
      {professionsLoading && <Typography>Laster profesjonsdata...</Typography>}
    </Box>
  );
}