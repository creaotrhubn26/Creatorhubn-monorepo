// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { Box, Typography, Card as MuiCard, CardContent as MuiCardContent, Grid, Button, List, ListItem, ListItemText, ListItemIcon, Chip } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { PhotoCamera, Videocam, LibraryMusic, Store, AddCircle as Add, Event, Person, Business } from '@mui/icons-material';

interface ProjectManagementSystemProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
}

const professionConfig = {
  photographer: { name: 'Fotografprosjekter', icon: theming.getThemedIcon(','), color: '#ff8c00',},
  videographer: { name: 'Videoprosjekter', icon: theming.getThemedIcon(','), color: '#e74c3c',},
  musicproducer: { name: 'Musikkprosjekter', icon: theming.getThemedIcon(', '), color: '#9b59b6',},
  vendor: { name: 'Leverandørprosjekter', icon: theming.getThemedIcon(', '), color: '#27ae60',}
};

export default function ProjectManagementSystem({ profession = 'photographer' }: ProjectManagementSystemProps) {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || profession || 'photographer';
  
  // Use dynamic profession system with fallback to local config
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const dynamicConfig = professionConfigs?.[userProfession];
  const config = dynamicConfig || professionConfig[profession];
  
  const queryClient = useQueryClient();
  
  // Database connection for ProjectManagementSystem
  const { data: projectData = [], isLoading } = useQuery({
    queryKey: ['/api/project', 'user-data'],
    queryFn: () => apiRequest('/api/project/user-data', ),
    retry: false,
});

  // Mutation for updating project data
  const updateProjectManagementSystem = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/project/update', {
        method: 'POS',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project', ],});
  }
});

  // Mock projects for now until database is populated
  const mockProjects = [
    { id: 1, name: 'Bryllupsreportasje', client: 'Anna & Erik', date: '2024-06-1', status: 'Aktiv',},
    { id: 2, name: 'Portrettfotografering', client: 'Stine Hansen', date: '2024-06-2', status: 'Planlagt',}
  ];

  return (
    <Box sx={{ p:  2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: 32} })}
        <Typography variant="h5" sx={{  fontWeight: 600, color: config.color  }}>
          {dynamicConfig ? `${dynamicConfig.displayName} - Prosjekter` : config.name}
        </Typography>
        <Button variant="contained" 
          startIcon={theming.getThemedIcon('add')}
          sx={{ 
            ml: 'auto',
            bgcolor: config.color'&:hover': { bgcolor: config.color + 'dd',}
        }}
         sx={theming.getThemedButtonSx()}>
          Nytt Prosjekt
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }} md={8}>
          <MuiCard>
            <MuiCardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Aktive Prosjekter</Typography>
              <List>
                {mockProjects.map((project) => (
                  <ListItem key={project.id} divider>
                    <ListItemIcon>
                      {React.cloneElement(config.icon, { sx: { color: config.color } })}
                    </ListItemIcon>
                    <ListItemText
                      primary={project.name}
                      secondary={`Klient: ${project.client} • Dato: ${project.date}`}
                    />
                    <Chip 
                      label={project.status}
                      color={project.status === 'Aktiv' ? 'success' : 'default'}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </MuiCardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={4}>
          <MuiCard>
            <MuiCardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Hurtighandlinger</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                <Button variant="outlined" startIcon={<Event />}>
                  Se Kalender
                </Button>
                <Button variant="outlined" startIcon={theming.getThemedIcon('person')}>
                  Klientadministrasjon
                </Button>
                <Button variant="outlined" startIcon={theming.getThemedIcon('business')}>
                  Kontrakter
                </Button>
              </Box>
            </MuiCardContent>
          </MuiCard>
        </Grid>
      </Grid>
    </Box>
  );
}