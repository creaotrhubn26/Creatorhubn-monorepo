import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { apiRequest } from'@/lib/queryClient';

export default function ProjectManager() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
        ProjectManager
      </Typography>
    </Box>
  );
}
