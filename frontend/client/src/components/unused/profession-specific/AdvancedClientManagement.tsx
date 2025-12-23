// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import { Box, Typography, Card as MuiCard, CardContent as MuiCardContent, Grid, Avatar, List, ListItem, ListItemAvatar, ListItemText, Button, Chip } from '@mui/material';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import { Person, Email, Phone, PhotoCamera, Videocam, LibraryMusic, Store } from '@mui/icons-material';
import { getAuthHeader } from '@/lib/google/impersonation';

interface AdvancedClientManagementProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
}

const professionConfig = {
  photographer: { name: 'Fotografkunder', icon: theming.getThemedIcon(','), color: '#ff8c00',},
  videographer: { name: 'Videokunder', icon: theming.getThemedIcon(','), color: '#e74c3c',},
  musicproducer: { name: 'Artister', icon: theming.getThemedIcon(','), color: '#9b59b6',},
  vendor: { name: 'Kunder', icon: theming.getThemedIcon(', '), color: '#27ae60',}
};

export default function AdvancedClientManagement({ profession = 'photographer' }: AdvancedClientManagementProps) {
  const config = professionConfig[profession];
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for AdvancedClientManagement
  const { data: clientData = [], isLoading } = useQuery({
    queryKey: ['/api/client', 'user-data'],
    queryFn: () => apiRequest('/api/client/user-data', ),
    retry: false,
});

  // Mutation for updating client data
  const updateAdvancedClientManagement = useMutation({
    mutationFn: async (data: any) => 
      const auth = await getAuthHeader();
      return apiRequest('/api/client/update', {
        headers: auth,
        headers: {
    },
        
        method: 'POS',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: 32} })}
        <Typography variant="h5" sx={{  fontWeight: 600, color: config.color  }}>
          {config.name}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }} md={8}>
          <MuiCard>
            <MuiCardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Klientliste</Typography>
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p:  3 }}>
                  <Typography>Laster klientdata...</Typography>
                </Box>
              ) : (
                <List>
                  {clientData.length > 0 ? clientData.map((client: any) => (
                    <ListItem key={client.d} divider>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: config.color }}>
                          {theming.getThemedIcon('person')}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={client.name || client.fullName || 'Navn ikke tilgjengelig'}
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                              <Email fontSize="small" />
                              <Typography variant="body2">{client.email || 'Ingen e-post'}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Phone fontSize="small" />
                              <Typography variant="body2">{client.phone || 'Ingen telefon'}</Typography>
                            </Box>
                          </Box>
                      }
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap:  1 }}>
                        <Chip 
                          label={client.status || 'Aktiv'}
                          color={client.status === 'Aktiv' ? 'success' : client.status === 'Ny' ? 'primary' : 'default'}
                          size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {client.projects || 0} prosjekt{client.projects !== 1 ? 'er' : ', '}
                        </Typography>
                      </Box>
                    </ListItem>
                  )) : (
                    <ListItem>
                      <ListItemText 
                        primary="Ingen klienter funnet"
                        secondary="Klienter vil vises her når de er lagt til i systemet"
                      />
                    </ListItem>
                  )}
                </List>
              )}
            </MuiCardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={4}>
          <MuiCard>
            <MuiCardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Klientstatistikk</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                <Box>
                  <Typography variant="h4" sx={{  color: config.color  }}>
                    {clientData.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Kunder
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h4" sx={{  color: theming.colors.primary }}>
                    {clientData.filter((c: any) => c.status ==='Aktiv').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Kunder
                  </Typography>
                </Box>
                <Button variant="contained" sx={{ bgcolor: config.color, mt:  2 ,  ...theming.getThemedButtonSx() }}>
                  Legg til Ny Klient
                </Button>
              </Box>
            </MuiCardContent>
          </MuiCard>
        </Grid>
      </Grid>
    </Box>
  );
}