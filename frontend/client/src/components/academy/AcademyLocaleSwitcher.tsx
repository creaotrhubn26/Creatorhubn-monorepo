import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
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
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '8px',
        border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.3)',
        bgcolor: 'rgba(8,11,18,0.55)',
        px: 0.35,
        py: 0.28,
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
        sx={{
          '& .MuiToggleButton-root': {
            borderColor: 'rgba(255,255,255,0.22)',
            color: '#f8f1e7',
            minWidth: 58,
            px: 1.05,
            py: 0.35,
            fontSize: 12,
            fontWeight: 700,
            borderRadius: '7px !important',
            textTransform: 'none',
          },
          '& .MuiToggleButton-root.Mui-selected': {
            color: '#1e1306',
            background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
          },
          '& .MuiToggleButtonGroup-grouped': {
            mx: 0.16,
            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22) !important',
          },
        }}
      >
        <Tooltip title={tt('Norsk språk', 'Norwegian language')}>
          <ToggleButton value="no" aria-label="Norwegian">
            🇳🇴 NO
          </ToggleButton>
        </Tooltip>
        <Tooltip title={tt('Engelsk språk', 'English language')}>
          <ToggleButton value="en" aria-label="English">
            🇺🇸 EN
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Box>
  );
}
