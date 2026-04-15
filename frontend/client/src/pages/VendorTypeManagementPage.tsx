// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
} from '@mui/material';
import { Category, Dashboard } from '@mui/icons-material';
import VendorTypeManager from '@/components/vendor/VendorTypeManager';
import UniversalVendorDashboard from '@/components/vendor/UniversalVendorDashboard';
import { useQuery } from '@tanstack/react-query';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return <div hidden={value !== index}>{value === index && <Box>{children}</Box>}</div>;
}

const VendorTypeManagementPage: React.FC = () => {
  const [tabValue, setTabValue] = useState<number>(0);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedVendorType, setSelectedVendorType] = useState<string>('audio');

  // Fetch vendor types for demo
  const { data: vendorTypesData } = useQuery({
    queryKey: ['/api/vendor-types'],
  });

  const handleTypeEnabled = (typeId: string) => {
    console.log(`✅ Vendor type enabled: ${typeId}`);
    setSelectedVendorType(typeId);
    setTabValue(1); // Switch to dashboard tab
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          ...theming.getThemedCardSx(),
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
          🚀 Skalerbar Vendor Type System
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.7, mb: 2 }}>
          Dynamisk ekspansjon av vendor kategorier for ubegrenset vekst
        </Typography>

        <Alert
          severity="info"
          sx={{
            mt: 2,
            bgcolor: 'rgba(255,255,255,0.1)',
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' },
        }}
        >
          <Typography variant="body2">
            Systemet støtter nå ubegrenset antall vendor-typer med konfigurerbare egenskaper og
            funksjoner
          </Typography>
        </Alert>
      </Paper>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            '& .MuiTab-root': {
              minWidth: 10,
              fontWeight: 600
            },
          }}
        >
          <Tab label="Type Manager" icon={<Category />} iconPosition="start" />
          <Tab label="Live Demo" icon={<Dashboard />} iconPosition="start" />
          <Tab label="Analytics" icon={theming.getThemedIcon('trendingUp')} iconPosition="start" />
          <Tab label="Innstillinger" icon={theming.getThemedIcon('settings')} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={tabValue} index={0}>
        <VendorTypeManager onTypeEnabled={handleTypeEnabled} />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box>
          <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h5" sx={{  mb: 2, fontWeight: 600}}>
              Live Demo - Test Vendor Dashboards
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb:  3 }}>
              Test forskjellige vendor-typer i sanntid med den nye skalbare arkitekturen
            </Typography>

            <Grid container spacing={2} sx={{ mb:  3 }}>
              {vendorTypesData?.vendorTypes?.slice(0, 6).map((type: any) => (
                <Grid item xs={6} sm={4} md={2} key={type.id}>
                  <Button
                    fullWidth
                    variant={selectedVendorType === type.id ? 'contained' : 'outlined'}
                    onClick={() => setSelectedVendorType(type.id)}
                    sx={{
                      bgcolor: selectedVendorType === type.id ? type.color : 'transparent',
                      borderColor: type.color,
                      color: selectedVendorType === type.id ? 'white' : type.color,
                      '&:hover': {
                        bgcolor: `${type.color}20`,
                        borderColor: type.color
                      }
                  }}
                  >
                    {type.name}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Live Dashboard Demo */}
          <UniversalVendorDashboard
            vendorType={selectedVendorType}
            vendorName={`Demo ${selectedVendorType} Vendor`}
            userId="demo-user"
            compact={false}
          />
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h5" sx={{  mb:  3, fontWeight: 600}}>
            📊 Vendor Type Analytics
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Aktive Vendor Typer
                  </Typography>
                  <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 700 }}>
                    {vendorTypesData?.totalTypes || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Core: {vendorTypesData?.coreTypes?.length || 0} | Expandable: {', '}
                    {vendorTypesData?.expandableTypes?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Kategorier
                  </Typography>
                  <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 700 }}>
                    {vendorTypesData?.categories?.length || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary',}}>
                    Creative, Technology, Service, Physical, Education
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Alert severity="success" sx={{ mt:  3 }}>
            <Typography variant="body2">
              <strong>Skalerings-suksess: </strong> Systemet støtter nå ubegrenset ekspansjon av
              vendor-typer med konfigurerbare egenskaper, automatisk UI-tilpasning og feature flags.
            </Typography>
          </Alert>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h5" sx={{  mb:  3, fontWeight: 600}}>
            ⚙️ Vendor Type System Innstillinger
          </Typography>

          <Alert severity="warning" sx={{ mb:  3 }}>
            <Typography variant="body2">
              <strong>Admin Only: </strong> Disse innstillingene krever administrator tilgang for å
              endre systemkonfigurasjon.
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{  mb:  2  }}>
                    Registry Configuration
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb:  2 }}>
                    Konfigurer vendor type registry innstillinger
                  </Typography>
                  <Button variant="outlined" disabled>
                    Konfigurer Registry
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{  mb:  2  }}>
                    Feature Flags
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb:  2 }}>
                    Administrer vendor type feature flags
                  </Typography>
                  <Button variant="outlined" disabled>
                    Administrer Features
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>
    </Box>
  );
};

export default VendorTypeManagementPage;
