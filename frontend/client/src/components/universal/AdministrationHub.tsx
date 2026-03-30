import React, { useState } from 'react';
import {
  Box,
  Tabs as MuiTabs,
  Tab,
  Paper,
  Typography,
} from '@mui/material';
import { Article, Payments, AdminPanelSettings, Memory as MemoryIcon } from '@mui/icons-material';
import PriceAdministration from '../PriceAdministration';
import UniversalContractHub from './contracts/UniversalContractHub';
import EvendiOfferManager from '../evendi/EvendiOfferManager';
import MemoryCardPricingAdmin from '../admin/MemoryCardPricingAdmin';

interface AdministrationHubProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  selectedClient?: any;
  evendiCoupleId?: string;
  onPricingUpdate?: () => void;
}

export default function AdministrationHub({ 
  userId, 
  profession, 
  selectedClient,
  evendiCoupleId,
  onPricingUpdate 
}: AdministrationHubProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [pricingTab, setPricingTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Tabs - Very Visible */}
      <Paper
        elevation={3}
        sx={{
          mb: 4,
          borderRadius: 3,
          border: '3px solid',
          borderColor: 'primary.main',
          overflow: 'hidden',
          bgcolor: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
        }}
      >
        <Box sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AdminPanelSettings sx={{ fontSize: 32 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Administrasjon
          </Typography>
        </Box>
        
        <MuiTabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            bgcolor: 'grey.100',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '1.1rem',
              minHeight: 72,
              px: 4,
              gap: 2,
              color: 'text.primary',
              bgcolor: 'grey.200',
              border: '2px solid',
              borderColor: 'transparent',
              '&.Mui-selected': {
                color: 'primary.main',
                bgcolor: 'white',
                borderColor: 'primary.main',
                borderBottom: 'none'
              },
              '&:hover': {
                bgcolor: 'grey.300'
              }
            },
            '& .MuiTabs-indicator': {
              height: 5,
              backgroundColor: 'primary.main'
            }
          }}
        >
          <Tab 
            icon={<Payments sx={{ fontSize: 32 }} />} 
            label="PRISADMINISTRASJON" 
            iconPosition="start"
          />
          <Tab 
            icon={<Article sx={{ fontSize: 32 }} />} 
            label="KONTRAKTER" 
            iconPosition="start"
          />
          <Tab 
            icon={<img src="/evendi-logo.png" alt="" style={{ height: 28 }} />} 
            label="EVENDI TILBUD" 
            iconPosition="start"
          />
        </MuiTabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ minHeight: '400px' }}>
        {/* Tab 0: Prisadministrasjon */}
        {activeTab === 0 && (
          <Box sx={{ display: 'grid', gap: 3 }}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: 'background.paper',
              }}
            >
              <MuiTabs
                value={pricingTab}
                onChange={(_event, newValue) => setPricingTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: 1.5,
                  pt: 1.5,
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    minHeight: 60,
                    fontWeight: 700,
                    gap: 1,
                  },
                }}
              >
                <Tab
                  icon={<Payments />}
                  label="Tjenestepriser"
                  iconPosition="start"
                />
                <Tab
                  icon={<MemoryIcon />}
                  label="Minneskortpriser"
                  iconPosition="start"
                />
              </MuiTabs>
            </Paper>

            {pricingTab === 0 ? (
              <PriceAdministration 
                profession={profession}
                userId={userId}
                onContractCreate={onPricingUpdate}
              />
            ) : (
              <MemoryCardPricingAdmin
                onPricingUpdate={() => {
                  onPricingUpdate?.();
                }}
              />
            )}
          </Box>
        )}

        {/* Tab 1: Kontrakter */}
        {activeTab === 1 && (
          <Box>
            <UniversalContractHub
              profession={profession as 'photographer' | 'videographer' | 'music_producer'}
              userId={userId}
              selectedClient={selectedClient}
            />
          </Box>
        )}

        {/* Tab 2: Evendi Tilbud & Kontrakter */}
        {activeTab === 2 && (
          <Box>
            <EvendiOfferManager evendiCoupleId={evendiCoupleId} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
