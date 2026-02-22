import * as React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

export default function ViewMode() {
  const [mode, setMode] = React.useState<'setup' | 'view' | 'export' | 'community'>('setup');
  
  React.useEffect(() => {
    // Dispatch event to notify other components of view mode change
    const event = new CustomEvent('vs-view-mode-changed', { detail: { mode } });
    window.dispatchEvent(event);
  }, [mode]);
  
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: 11 }}>
        View Mode
      </Typography>
      <ToggleButtonGroup 
        exclusive 
        size="small" 
        value={mode} 
        onChange={(_, v) => v && setMode(v)}
        fullWidth
        sx={{
          '& .MuiToggleButton-root': {
            textTransform: 'none',
            fontSize: 12,
            px: 1,
            py: 0.5,
            borderColor: '#d1d5db',
            color: '#64748b',
            '&.Mui-selected': {
              bgcolor: '#3b82f6',
              color: '#fff',
              borderColor: '#3b82f6',
              '&:hover': {
                bgcolor: '#2563eb',
              },
            },
            '&:hover': {
              bgcolor: '#f8fafc',
            },
          },
        }}
      >
        <ToggleButton value="setup">Setup</ToggleButton>
        <ToggleButton value="view">View</ToggleButton>
        <ToggleButton value="export">Export</ToggleButton>
        <ToggleButton value="community">Community</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
