import React from 'react';
import { Box, Typography, LinearProgress, Chip, Stack } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';

interface HealthCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
}

interface ProjectHealthCheckProps {
  projectId?: string;
  items?: HealthCheckItem[];
}

const ProjectHealthCheck: React.FC<ProjectHealthCheckProps> = ({
  projectId,
  items = [],
}) => {
  const defaultItems: HealthCheckItem[] = [
    { id: 'client', label: 'Klientinfo', status: 'ok' },
    { id: 'timeline', label: 'Tidslinje', status: 'warning', message: 'Mangler deadlines' },
    { id: 'budget', label: 'Budsjett', status: 'ok' },
    { id: 'team', label: 'Team', status: 'ok' },
  ];

  const checkItems = items.length > 0 ? items : defaultItems;
  const okCount = checkItems.filter(i => i.status === 'ok').length;
  const progress = (okCount / checkItems.length) * 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle sx={{ color: '#10b981', fontSize: 18 }} />;
      case 'warning': return <Warning sx={{ color: '#ffb800', fontSize: 18 }} />;
      case 'error': return <ErrorIcon sx={{ color: '#ef4444', fontSize: 18 }} />;
      default: return null;
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
        Prosjekthelse
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          mb: 2,
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': {
            bgcolor: progress === 100 ? '#10b981' : '#ffb800',
          },
        }}
      />
      <Stack spacing={1}>
        {checkItems.map((item) => (
          <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon(item.status)}
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', flex: 1 }}>
              {item.label}
            </Typography>
            {item.message && (
              <Chip
                label={item.message}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: 'rgba(255,184,0,0.2)',
                  color: '#ffb800',
                }}
              />
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default ProjectHealthCheck;
