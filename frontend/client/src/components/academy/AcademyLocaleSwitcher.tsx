import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import { useLocation } from 'wouter';
import { useAcademyLocale } from './academyLocale';

function isAcademyRoute(pathname: string): boolean {
  return pathname === '/academy-dashboard' || /^\/academy(?:$|[/-])/.test(pathname);
}

export default function AcademyLocaleSwitcher() {
  const [location] = useLocation();
  const { language, setLanguage, tt } = useAcademyLocale();

  if (!isAcademyRoute(location)) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        right: { xs: 12, md: 18 },
        bottom: { xs: 12, md: 18 },
        zIndex: 1800,
        borderRadius: '10px',
        border: '1px solid rgba(245,166,35,0.32)',
        bgcolor: 'rgba(8,11,18,0.9)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        px: 0.8,
        py: 0.6,
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={language}
        onChange={(_, next) => {
          if (next === 'no' || next === 'en') {
            setLanguage(next);
          }
        }}
      >
        <Tooltip title={tt('Norsk språk', 'Norwegian language')}>
          <ToggleButton
            value="no"
            aria-label="Norwegian"
            sx={{
              color: '#f8f1e7',
              borderColor: 'rgba(255,255,255,0.2)',
              '&.Mui-selected': {
                color: '#1e1306',
                background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
              },
            }}
          >
            <TranslateIcon sx={{ mr: 0.5, fontSize: 16 }} />
            NO
          </ToggleButton>
        </Tooltip>
        <Tooltip title={tt('Engelsk språk', 'English language')}>
          <ToggleButton
            value="en"
            aria-label="English"
            sx={{
              color: '#f8f1e7',
              borderColor: 'rgba(255,255,255,0.2)',
              '&.Mui-selected': {
                color: '#1e1306',
                background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
              },
            }}
          >
            EN
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Box>
  );
}
