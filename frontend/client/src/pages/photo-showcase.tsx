import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import UniversalShowcase from '../components/universal/UniversalShowcase';

export default function PhotoShowcase() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <UniversalShowcase
        profession="photographer"
        userId={userId}
        isOwner={true}
        compact={false}
        maxItems={20}
      />
    </Box>
  );
}
