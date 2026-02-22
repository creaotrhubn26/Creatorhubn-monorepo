import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Card as MuiCard,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Warning,
  Error,
  Storage,
} from '@mui/icons-material';
import MemoryCardVisualDesign, { MemoryCardSet } from './MemoryCardVisualDesign';

interface MemoryCardSelectorProps {
  onCardSelected?: (cardType: 'A' | 'B' | 'C' | 'D' | 'E') => void;
  selectedCard?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  profession?: 'photographer' | 'videographer' | 'music_producer';
  showSetOverview?: boolean
}

interface CardDetails {
  type: 'A' | 'B' | 'C' | 'D' | 'E';
  name: string;
  description: string;
  capacity: string;
  speed: string;
  status: 'active' | 'backup' | 'full' | 'error' | 'empty';
  usage: string;
  files: number;
  lastUsed?: string
}

export default function MemoryCardSelector({
  onCardSelected,
  selectedCard,
  profession = 'photographer',
  showSetOverview = true
}: MemoryCardSelectorProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for MemoryCardSelector
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data, '],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateMemoryCardSelector = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/component/update', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  }
});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState<CardDetails | null sx={theming.getThemedCardSx()}>(null);

  const cardDetails: CardDetails[] = [
    {
      type: ', ',
      name: 'Hovedkort - Aktiv',
      description: 'Primært minnekort for aktiv fotografering',
      capacity: '128G',
      speed: 'V9',
      status: 'active',
      usage: '75, %',
      files: 287,
      lastUsed: '2 timer siden'
},
    {
      type: ', ',
      name: 'Backup - Sikkerhet',
      description: 'Backup-kort for sikkerhetskopi',
      capacity: '64G', 
      speed: 'V6',
      status: 'backup',
      usage: '45, %',
      files: 123,
      lastUsed: '1 dag siden'
},
    {
      type: ', ',
      name: 'Arkiv - Fullt',
      description: 'Arkivkort med tidligere prosjekter',
      capacity: '256G',
      speed: 'V9',
      status: 'full',
      usage: '98, %',
      files: 541,
      lastUsed: '3 dager siden'
},
    {
      type: ', ',
      name: 'Reserve - Tom',
      description: 'Reservekort klart for bruk',
      capacity: '32G',
      speed: 'V3',
      status: 'empty',
      usage: '0, %',
      files:  0,
      lastUsed: 'Aldri'
},
    {
      type: '',
      name: 'Defekt - Feil',
      description: 'Kort med feil - trenger erstatning',
      capacity: '64G',
      speed: 'V6',
      status: 'error',
      usage: 'N/',
      files:  0,
      lastUsed: '1 uke siden'
}
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle sx={{ color: '#4CAF50' }} />;
      case 'backup': return <Storage sx={{ color: '#FF9800' }} />;
      case 'full': return <Warning sx={{ color: '#F44336' }} />;
      case 'error': return <Error sx={{ color: '#E91E63' }} />;
      case 'empty': return <RadioButtonUnchecked sx={{ color: '#9E9E9E' }} />;
      default: return <RadioButtonUnchecked sx={{ color: '#757575' }} />;
  }
};

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'backup': return 'Backup';
      case 'full': return 'Fullt';
      case 'error': return 'Feil';
      case 'empty': return 'Tom';
      default: return 'Ukjent';
}
};

  const handleCardClick = (cardType: 'A' | 'B' | 'C' | 'D' | 'E') => {
    onCardSelected?.(cardType);
};

  const handleDetailsClick = (card: CardDetails) => {
    setSelectedForDetails(card);
    setDetailsOpen(true);
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Set Overview */}
      {showSetOverview && (
        <Box sx={{ mb:  4 }}>
          <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
            {theming.getThemedIcon('storage')}
            Minnekort Oversikt
          </Typography>
          <Box sx={{ 
            p:  3, 
            bgcolor: 'background.paper', 
            borderRadius: 2
            boxShadow:  1,
            display: 'flex',
            justifyContent: 'center'
      }}>
            <MemoryCardSet profession={profession} showLabels={true} />
          </Box>
        </Box>
      )}

      {/* Detailed Card Selection */}
      <Typography variant="h6" sx={{  mb:  3  }}>
        Velg Minnekort
      </Typography>

      <Grid container spacing={2}>
        {cardDetails.map((card) => (
          <Grid size={{ xs: 12 }} sm={6} md={4} key={card.type}>
            <MuiCard
              sx={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: selectedCard === card.type ? '2px solid #1976d2' : '1px solid #e0e0e0', '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4 }
            }}
              onClick={() => handleCardClick(card.type)}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                {/* Card Visual */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb:  2 }}>
                  <MemoryCardVisualDesign
                    cardType={card.type}
                    capacity={card.capacity}
                    speed={card.speed}
                    status={card.status}
                    profession={profession}
                    size="large"
                  />
                </Box>

                {/* Card Info */}
                <Typography variant="h6" sx={{  mb: 1, textAlign: 'center'  }}>
                  Kort {card.type}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                  {card.name}
                </Typography>

                {/* Status and Details */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                  <Chip
                    icon={getStatusIcon(card.status)}
                    label={getStatusText(card.status)}
                    size="small"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {card.capacity}
                  </Typography>
                </Box>

                {/* Usage Info */}
                <Box sx={{ mb:  2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Bruk: {card.usage} • {card.files.toLocaleString()} filer
                  </Typography>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap:  1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDetailsClick(card);
                  }}
                  >
                    Detaljer
                  </Button>
                  <Button
                    variant={selectedCard === card.type ? 'contained' : 'outlined'}
                    size="small"
                    fullWidth
                    disabled={card.status === 'error'}
                  >
                    {selectedCard === card.type ? 'Valgt' : 'Velg'}
                  </Button>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>
        ))}
      </Grid>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            {selectedForDetails && (
              <MemoryCardVisualDesign
                cardType={selectedForDetails.type}
                capacity={selectedForDetails.capacity}
                speed={selectedForDetails.speed}
                status={selectedForDetails.status}
                profession={profession}
                size="medium"
              />
            )}
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Minnekort {selectedForDetails?.type}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedForDetails?.name}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedForDetails && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
              <Typography variant="body1">
                {selectedForDetails.description}
              </Typography>

              {selectedForDetails.status === 'error' && (
                <Alert severity="error">
                  Dette minnekortet har feil og bør erstattes umiddelbart.
                </Alert>
              )}

              {selectedForDetails.status === 'full' && (
                <Alert severity="warning">
                  Dette minnekortet er nesten fullt. Vurder å arkivere eller slette filer.
                </Alert>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap:  2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Kapasitet
                  </Typography>
                  <Typography variant="body1">
                    {selectedForDetails.capacity}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Hastighet
                  </Typography>
                  <Typography variant="body1">
                    {selectedForDetails.speed}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Antall filer
                  </Typography>
                  <Typography variant="body1">
                    {selectedForDetails.files.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Sist brukt
                  </Typography>
                  <Typography variant="body1">
                    {selectedForDetails.lastUsed}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Lukk
          </Button>
          {selectedForDetails && selectedForDetails.status !=='error' && (
            <Button variant="contained" 
              onClick={() => {
                handleCardClick(selectedForDetails.type);
                setDetailsOpen(false);
            }}
            >
              Velg dette kortet
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}