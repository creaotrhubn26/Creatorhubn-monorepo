/**
 * CreatorHub Norge - Comprehensive Pricing Page
 * Central pricing management interface
 */

import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import { Box, Container, Typography, Breadcrumbs, Link, Tabs, Tab, Paper } from '@mui/material';
import {
  Home as HomeIcon,
  LocalOffer as PriceIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import PricingManagement from '@/components/pricing/PricingManagement';
import PricingDashboardWidget from '@/components/pricing/PricingDashboardWidget';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number; 
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PricingPage() {
  const [, setLocation] = useLocation();
  
  // Theming system
  const theming = useTheming('photographer');
  const [tabValue, setTabValue] = useState(0);

  // Mock user data - in real app this would come from auth context
  const userId = 'demo-user';
  const profession = 'photographer';

  const handlePricingUpdate = () => {
    // Refresh pricing data or show success message
    console.log('Pricing updated');
};

  return (
    <Container maxWidth="xl" sx={{ py:  3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb:  3 }}>
        <Link
          color="inherit"
          onClick={() => setLocation('/')}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer',}}
        >
          <HomeIcon sx={{ mr: 0.5,}} fontSize="inherit" />
          Dashbord
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center',}}>
          <PriceIcon sx={{ mr: 0.5,}} fontSize="inherit" />
          Prissystem
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ mb: 2, color: theming.colors.primary }}>
          Prissystem
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          Administrer tjenester, pakkepriser og kunderabatter
        </Typography>
      </Box>

      {/* Tabs Navigation */}
      <Paper
        sx={{
          ...theming.getThemedCardSx(),
          background: 'rgba(25, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(25, 107, 53, 0.2)',
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{
                '& .MuiTab-root': {
                  color: '#666', '&.Mui-selected': {
                    color: '#ff6b30'
                  }
              }, '& .MuiTabs-indicator': {
                backgroundColor: '#ff6b30'
              }
            }}
          >
            <Tab icon={<AnalyticsIcon />} label="Oversikt" iconPosition="start" />
            <Tab icon={<PriceIcon />} label="Administrer priser" iconPosition="start" />
            <Tab icon={<CalculateIcon />} label="Priskalulator" iconPosition="start" />
            <Tab icon={<SettingsIcon />} label="Innstillinger" iconPosition="start" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <PricingDashboardWidget
            userId={userId}
            profession={profession}
            variant="detailed"
            onManagePricing={() => setTabValue(1)}
          />
        </TabPanel>

        {/* Management Tab */}
        <TabPanel value={tabValue} index={1}>
          <PricingManagement
            userId={userId}
            profession={profession}
            onPricingUpdate={handlePricingUpdate}
          />
        </TabPanel>

        {/* Calculator Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p:  3 }}>
            <Typography variant="h6" sx={{  mb:  2  }}>
              Priskalulator
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Avansert priskalulator for komplekse tilbud og pakkepriser kommer snart.
            </Typography>
          </Box>
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p:  3 }}>
            <Typography variant="h6" sx={{  mb:  2  }}>
              Prisinnstillinger
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Globale prisinnstillinger og automatiseringsregler kommer snart.
            </Typography>
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
}
