import React from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { Chat, Email } from '@mui/icons-material';

interface FullscreenCommunicationTabsProps {
  activeTab: number;
  accentColor: string;
  onChangeTab: (tab: number) => void;
}

export default function FullscreenCommunicationTabs({
  activeTab,
  accentColor,
  onChangeTab,
}: FullscreenCommunicationTabsProps) {
  return (
    <>
      <Box
        sx={{
          px: 1.5,
          pt: 1,
          bgcolor: 'rgba(248,250,252,0.95)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => onChangeTab(newValue)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 42,
              borderRadius: 1.5,
              mx: 0.25,
              fontWeight: 600,
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: 3,
              bgcolor: accentColor,
            },
          }}
        >
          <Tab icon={<Chat fontSize="small" />} iconPosition="start" label="Direktemelding" />
          <Tab icon={<Email fontSize="small" />} iconPosition="start" label="E-post" />
          <Tab
            icon={<img src="/evendi-logo.png" alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />}
            iconPosition="start"
            label="Evendi"
          />
          <Tab
            icon={<img src="/academy-favicon.svg" alt="" style={{ width: 16, height: 16 }} />}
            iconPosition="start"
            label="Academy"
          />
        </Tabs>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center', py: 0.75, fontSize: '0.75rem' }}
        >
          {activeTab === 0
            ? 'Sanntids chat med øyeblikkelig levering'
            : activeTab === 1
            ? 'Profesjonell e-postkorrespondanse'
            : activeTab === 2
            ? 'Meldinger fra par på evendi.no'
            : 'Academy-verktøy, kurs og læringsressurser'}
        </Typography>
      </Box>
    </>
  );
}
