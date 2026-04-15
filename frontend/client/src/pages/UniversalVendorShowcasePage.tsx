// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Tab,
  Tabs,
  Avatar,
  Container,
  useTheme,
  alpha,
  Badge,
  Paper,
} from '@mui/material';
import { CorporateIcon,
  Print,
  AudioDescription,
  Brush,
  Code,
  Security,
  TrendingUp,
  Star,
  Download,
  Visibility, } from '../components/shared/CreatorHubIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import UniversalVendorShowcase from '../components/showcase/UniversalVendorShowcase';
import { CREATOR_HUB_BRANDING } from '../constants/CreatorHubBranding';


// Vendor type configurations
const vendorTypes = {
  print: {
    name: 'Print & Design',
    color: '#e91e60',
    icon: <Print />,
    description: 'Profesjonelle design-maler, fonter og grafiske elementer',
    examples: ['NorthTone Design', 'Nordic Print Solutions','Scandinavian Templates'],
},
  audio: {
    name: 'Audio & Music',
    color: '#9c27b0',
    icon: <AudioFile />,
    description: 'Plugins, samples, presets og musikk-software',
    examples: ['Norsk Musikk Plugins A','Arctic Audio','Nordic Sound Design'],
},
  design: {
    name: 'Design & Creative',
    color: '#ff5720',
    icon: <Brush />,
    description: 'Kreative verktøy, pensler, teksturer og design-assets',
    examples: ['Creative Norway','Nordic Design Co','Fjord Graphics']
  },
  software: {
    name: 'Software & Tools',
    color: '#2196f0',
    icon: <Code />,
    description: 'Applikasjoner, utvidelser og utviklerverktøy',
    examples: ['Nordic Software','Scandinavian Tech','Arctic Dev Tools'],
},
  hardware: {
    name: 'Hardware & Equipment',
    color: '#795540',
    icon: theming.getThemedIcon(''),
    description: 'Kameraer, objektiver, audio-utstyr og tilbehør',
    examples: ['Nordic Gear', 'Scandinavian Equipment','Arctic Hardware'],
},
};

export default function UniversalVendorShowcasePage() {
  const theme = useTheme();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const [selectedVendorType, setSelectedVendorType] = useState<string>('print');
  const [selectedVendor, setSelectedVendor] = useState<string>('');

  // Fetch vendors by type
  const { data: vendorsByType = {} } = useQuery({
    queryKey: ['/api/vendors-by-type', ],
    queryFn: async () => {
      const results: any = {};
      for (const type of Object.keys(vendorTypes)) {
        try {
          const vendors = await apiRequest(`/api/universal-vendors/${type}`);
          results[type] = vendors;
      } catch (error) {
          console.error(`Error fetching ${type} vendors:`, error);
          results[type] = [];
      }
    }
      return results;
  },
});

  const currentConfig = vendorTypes[selectedVendorType as keyof typeof vendorTypes];
  const currentVendors = vendorsByType[selectedVendorType] || [];

  const handleVendorTypeChange = (event: React.SyntheticEvent, newValue: string) => {
    setSelectedVendorType(newValue);
    setSelectedVendor(', '); // Reset vendor selection when type changes
  };

  return (
    <Container maxWidth="xl" sx={{ py:  4 }}>
      {/* Page Header */}
      <Box sx={{ mb:  4, textAlign: 'center',}}>
        <Typography variant="h3"
          sx={{ 
            fontWeight: 700,
            mb:  2,
            background: 'linear-gradient(135deg, #CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY, #e91e63, #9c27b0)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent' }}>
          Universal Vendor Showcase
        </Typography>
        <Typography variant="h6" sx={{  color: 'text.secondary', mb:  4  }}>
          Utforsk profesjonelle verktøy og ressurser fra ledende norske leverandører
        </Typography>

        {/* Vendor Type Stats */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {Object.entries(vendorTypes).map(([key, config]) => (
            <Grid item xs={12} sm={6} md={2.4} key={key}>
              <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                <Card
                  sx={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: selectedVendorType === key
                        ? `2px solid ${config.color}`
                        : '1px solid transparent',
                    bgcolor: selectedVendorType === key ? `${config.color}10` : 'background.paper','&:hover': {
                      bgcolor: `${config.color}08`,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 25px ${config.color}25`,
                  },
                    transition: 'all 0.3s ease',
                }}
                  onClick={() => {
                    setSelectedVendorType(key);
                    setSelectedVendor(', ');
                }}
                >
                  <CardContent sx={{ py:  2 ,  ...theming.getThemedCardSx() }}>
                    <Avatar
                      sx={{
                        bgcolor: config.color,
                        mx: 'auto',
                        mb:  1,
                        width:  48,
                        height:  48,
                    }}
                    >
                      {config.icon}
                    </Avatar>
                    <Typography variant="h6"
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: selectedVendorType === key ? config.color : theming.colors.primary }}>
                      {config.name}
                    </Typography>
                    <Badge
                      badgeContent={vendorsByType[key]?.length || 0}
                      color="primary"
                      sx={{
                        '& .MuiBadge-badge': {
                          bgcolor: config.color,
                      },
                    }}
                    >
                      <Chip
                        label="Vendors"
                        size="small"
                        sx={{
                          bgcolor: `${config.color}15`,
                          color: config.color,
                          fontSize: '0.7rem',
                      }}
                      />
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Selected Vendor Type Info */}
      <Paper
        sx={{
          p:  3,
          mb:  4,
          bgcolor: `${currentConfig.color}08`,
          border: `1px solid ${currentConfig.color}30`,
      }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: currentConfig.color, width:  56, height: 56,}}>
            {currentConfig.icon}
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{  fontWeight: 700, color: currentConfig.color  }}>
              {currentConfig.name}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary',}}>
              {currentConfig.description}
            </Typography>
          </Box>
        </Box>

        {/* Example Vendors */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary',}}>
            Eksempel leverandører: </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap',}}>
            {currentConfig.examples.map((example) => (
              <Chip
                key={example}
                label={example}
                size="small"
                sx={{
                  bgcolor: `${currentConfig.color}15`,
                  color: currentConfig.color,
              }}
              />
            ))}
          </Box>
        </Box>
      </Paper>

      {/* Vendor Selection */}
      {currentVendors.length > 0 && (
        <Box sx={{ mb:  4 }}>
          <Typography variant="h5"
            sx={{ 
              fontWeight: 600,
              mb: 3,
              color: currentConfig.color,
              display: 'flex',
              alignItems: 'center',
              gap:  1 }}>
            <CorporateIcon />
            Velg Leverandør
          </Typography>

          <Grid container spacing={2}>
            {currentVendors.map((vendor: any) => (
              <Grid item xs={12} sm={6} md={4} key={vendor.vendorName}>
                <motion.div whileHover={{ scale: 1.02}} transition={{ duration: 0.2,}}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selectedVendor === vendor.vendorName
                          ? `2px solid ${currentConfig.color}`
                          : '1px solid transparent',
                      bgcolor: selectedVendor === vendor.vendorName
                          ? `${currentConfig.color}08`
                          : 'background.paper', '&:hover': {
                        bgcolor: `${currentConfig.color}05`,
                        borderColor: currentConfig.color,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 20px ${currentConfig.color}20`,
                    },
                      transition: 'all 0.3s ease',
                  }}
                    onClick={() => setSelectedVendor(vendor.vendorName)}
                  >
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                        <Avatar sx={{ bgcolor: currentConfig.color }}>{currentConfig.icon}</Avatar>
                        <Box sx={{ flex:  1 }}>
                          <Typography variant="h6" sx={{  fontWeight: 600}}>
                            {vendor.vendorName}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary',}}>
                            {vendor.totalProducts || 0} produkter
                          </Typography>
                        </Box>
                        <IconButton
                          sx={{ color: currentConfig.color }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVendor(vendor.vendorName);
                        }}
                        >
                          {theming.getThemedIcon('visibility')}
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Vendor Showcase */}
      {selectedVendor && (
        <motion.div
          initial={{ opacity: 0, y: 20,}}
          animate={{ opacity: 1, y:  0 }}
          transition={{ duration: 0.5,}}
        >
          <UniversalVendorShowcase
            vendorType={selectedVendorType as any}
            vendorName={selectedVendor}
            userId="demo-user"
            viewMode="public"
          />
        </motion.div>
      )}

      {/* No Vendor Selected State */}
      {!selectedVendor && currentVendors.length > 0 && (
        <Paper
          sx={{
            p:  6,
            textAlign: 'center',
            bgcolor: `${currentConfig.color}05`,
            border: `2px dashed ${currentConfig.color}30`,
        }}
        >
          <Avatar
            sx={{
              bgcolor: currentConfig.color,
              mx: 'auto',
              mb:  2,
              width:  80,
              height:  80,
              fontSize: '2rem',
          }}
          >
            {currentConfig.icon}
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: currentConfig.color }}>
            Velg en leverandør for å se showcase
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb:  3 }}>
            Klikk på en av leverandørene ovenfor for å utforske deres produkter og tjenester
          </Typography>
        </Paper>
      )}

      {/* No Vendors Available State */}
      {currentVendors.length === 0 && (
        <Paper
          sx={{
            p:  6,
            textAlign: 'center',
            bgcolor: 'background.paper',
            border: '2px dashed #ccc',
        }}
        >
          <Avatar
            sx={{
              bgcolor: 'grey.40',
              mx: 'auto',
              mb:  2,
              width:  80,
              height:  80,
              fontSize: '2rem',
          }}
          >
            <CorporateIcon />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: theming.colors.primary }}>
            Ingen leverandører tilgjengelig
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb:  3 }}>
            Det er ingen registrerte leverandører i kategorien {currentConfig.name} ennå.
          </Typography>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('trendingUp')}
            onClick={() => {
              // Navigate to vendor registration or contact
              console.log('Navigate to vendor registration');
          }}
          >
            Bli en leverandør
          </Button>
        </Paper>
      )}
    </Container>
  );
}
