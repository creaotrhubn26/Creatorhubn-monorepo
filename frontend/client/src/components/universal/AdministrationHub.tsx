import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  Box,
  Tabs as MuiTabs,
  Tab,
  Paper,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Article,
  Payments,
  AdminPanelSettings,
  Memory as MemoryIcon,
  Forum as ForumIcon,
  Receipt as QuoteIcon,
} from '@mui/icons-material';
import PriceAdministration from '../PriceAdministration';
import UniversalContractHub from './contracts/UniversalContractHub';
import EvendiOfferManager from '../evendi/EvendiOfferManager';
import MemoryCardPricingAdmin from '../admin/MemoryCardPricingAdmin';
import CommunicationHub from '../business-intelligence/CommunicationHub';
import { consumePendingAdministrationDeepLink } from './administrationHubDeepLink';

// Lazy so the ~50kB quote builder (+ Kartverket hooks + MVA helpers)
// isn't loaded for photographers who never open Admin → Tilbud.
const QuoteGeneratorModal = lazy(() => import('../modals/QuoteGeneratorModal'));

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
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Consume the ``?subTab=`` deep-link UniversalDashboard stashed in
  // sessionStorage before this hub mounted. sessionStorage rather
  // than a DOM event because a synchronous event would land before
  // our listener is attached.
  useEffect(() => {
    const target = consumePendingAdministrationDeepLink();
    if (!target) return;
    setActiveTab(target.tabIndex);
    if (target.kind === 'quote') {
      // ``?subTab=quotes`` = "show me the general quote builder".
      // Pops QuoteGeneratorModal open over Prisadministrasjon so the
      // photographer has pricing context one tap away.
      setShowQuoteGenerator(true);
    }
  }, []);

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
            icon={<ForumIcon sx={{ fontSize: 32 }} />}
            label="KOMMUNIKASJON"
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
            {/* Quick-action row: one-tap entry into the general quote
                builder. Desktop trigger for the same modal the iPad
                ``?subTab=quotes`` deep-link auto-opens; keeps both
                flows visually consistent. */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<QuoteIcon />}
                onClick={() => setShowQuoteGenerator(true)}
              >
                Nytt tilbud
              </Button>
            </Box>
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

        {/* Tab 2: Kommunikasjon — samler e-post, møter, notater og chat
            i en inbox slik at fotografen ikke trenger å jonglere Signature,
            Gmail og WhatsApp for samme jobb. CommunicationHub er allerede
            koblet til /api/communication/* og /api/emails/* endepunktene. */}
        {activeTab === 2 && (
          <Box>
            <CommunicationHub userId={userId} profession={profession} />
          </Box>
        )}

        {/* Tab 3: Evendi Tilbud & Kontrakter */}
        {activeTab === 3 && (
          <Box>
            <EvendiOfferManager evendiCoupleId={evendiCoupleId} />
          </Box>
        )}
      </Box>

      <Suspense fallback={<Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>}>
        {showQuoteGenerator && (
          <QuoteGeneratorModal
            open={showQuoteGenerator}
            onClose={() => setShowQuoteGenerator(false)}
            packages={[]}
            pricing={[]}
            additionalCosts={[]}
            discounts={[]}
          />
        )}
      </Suspense>
    </Box>
  );
}
