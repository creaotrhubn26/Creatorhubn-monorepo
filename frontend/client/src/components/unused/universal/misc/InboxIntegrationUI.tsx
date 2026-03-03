// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Chip,
  IconButton,
  Divider,
  Avatar,
} from '@mui/material';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Inbox,
  Email,
  Star,
  Schedule,
  Reply,
  Archive,
  Delete,
} from '@mui/icons-material';
import { getAuthHeader } from '@/lib/google/impersonation';
interface InboxIntegrationUIProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
}
export default function InboxIntegrationUI({ 
  profession = 'photographer,' 
}: InboxIntegrationUIProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  // Database connection for InboxIntegrationUI
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});
  // Mutation for updating component data
  const updateInboxIntegrationUI = useMutation({
    mutationFn: async (data: any) => 
      const auth = await getAuthHeader();
      return apiRequest('/api/component/update', {
        headers: auth,
        headers: {},
        
        method: 'POST',
        body: JSON.stringify(data)
    ,}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/component", ],});
  }
});
  const [selectedFilter, setSelectedFilter] = useState('all');
  const professionColors = {
    photographer: '#ff8c00',
    videographer: '#e74c30', 
    musicproducer: '#9b59b0',
    vendor: '#27ae60'
,};
  const color = professionColors[profession];
  // Mock data removed - using database connection
  // Mock data removed - using database connection
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
  }
};
  const getCategoryChipColor = (category: string) => {
    switch (category) {
      case 'inquiry': return '#2196f3';
      case 'negotiation': return '#ff9800';
      case 'delivery': return '#9c27b0';
      case 'payment': return '#4caf50';
      default: return '#9e9e9e';
  }
};
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'inquiry': return 'Forespørsel';
      case 'negotiation': return 'Forhandling';
      case 'delivery': return 'Levering';
      case 'payment': return 'Betaling';
      default: return 'Ukjent';
  }
};
  const filteredMessages = selectedFilter === 'all' 
    ? inboxMessages 
    : inboxMessages.filter(m => 
        selectedFilter === 'unread' ? m.unread : m.category === selectedFilter
      );
  return (
    <Box sx={{ p:  2 }}>
      <MuiCard sx={{ border: `2px solid ${color}20` }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Inbox sx={{ color, fontSize: 24}} />
            <Typography variant="h6" sx={{  color, fontWeight: 600}}>
              Innboks Integrasjon
            </Typography>
            <Badge badgeContent={inboxMessages.filter(m => m.unread).length} color="error">
              {theming.getThemedIcon('email')}
            </Badge>
          </Box>
          {/* Filter chips */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap'}}>
            {filterOptions.map((option) => (
              <Chip
                key={option.key}
                label={`${option.label} (${option.count})`}
                variant={selectedFilter === option.key ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedFilter === option.key ? color : 'transparent',
                  borderColor: color,
                  color: selectedFilter === option.key ? 'white' : color'&:hover': {
                    bgcolor: selectedFilter === option.key ? color + 'dd' : color + '10'
                }
              }}
              />
            ))}
          </Box>
          <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
            {filteredMessages.length} meldinger
          </Typography>
          <List sx={{ bgcolor: '#fafafa', borderRadius: 1p:  0 }}>
            {filteredMessages.map((message, index) => (
              <React.Fragment key={message.id}>
                <ListItem
                  sx={{
                    cursor: 'pointer',
                    bgcolor: message.unread ? `${color}05` : 'transparent', '&:hover': { bgcolor: `${color}10` },
                    borderLeft: message.unread ? `4px solid ${color}` : '4px solid transparent'
                }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5}}>
                      <IconButton size="small" sx={{ color }}>
                        <Reply />
                      </IconButton>
                      <IconButton size="small" sx={{ color }}>
                        {theming.getThemedIcon('star')}
                      </IconButton>
                      <IconButton size="small" sx={{ color }}>
                        <Archive />
                      </IconButton>
                      <IconButton size="small" sx={{ color: '#f44336'}}>
                        {theming.getThemedIcon('delete')}
                      </IconButton>
                    </Box>
                }
                >
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: color, width:  40, height:  40, fontSize: '0.875rem'}}>
                      {message.from.charAt(0)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: essage.unread ? 700 : 60,
                            flex: 1
                        }}
                        >
                          {message.subject}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {message.timestamp}
                        </Typography>
                      </Box>
                  }
                    secondary={
                      <Box>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            fontWeight: essage.unread ? 600 : 40,
                            mb: 1
                        }}
                        >
                          Fra: {message.from} ({message.email})
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            mb:  1,
                            whiteSpace: 'nowrap'
                        }}
                        >
                          {message.preview}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center'}}>
                          <Box
                            sx={{
                              width:  8,
                              height:  8,
                              borderRadius: '50%',
                              bgcolor: getPriorityColor(message.priority)
                          }}
                          />
                          <Chip 
                            label={getCategoryLabel(message.category)}
                            size="small"
                            sx={{
                              bgcolor: getCategoryChipColor(message.category) + '2',
                              color: getCategoryChipColor(message.category),
                              height:  20,
                              fontSize: '0.7rem'
                          }}
                          />
                          {message.unread && (
                            <Chip 
                              label="Ulest"
                              size="small"
                              color="error"
                              sx={{ height:  20, fontSize: '0.7rem'}}
                            />
                          )}
                        </Box>
                      </Box>
                  }
                  />
                </ListItem>
                {index < filteredMessages.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
          <Box sx={{ mt:  3, p: 2, bgcolor: `${color}10`, borderRadius:  1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb:  1 }}>
              Smart Inbox Funksjoner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Automatisk kategorisering av innkommende meldinger<br/>
              • Prioritetsnivå basert på innhold og avsender<br/>
              • Direkte integrasjon med chat-system og prosjektadministrasjon<br/>
              • Automatiske svar-maler for vanlige forespørsler<br/>
              • Oppfølging påminnelser for ubesvarte meldinger
            </Typography>
          </Box>
        </CardContent>
      </MuiCard>
    </Box>
  );
}