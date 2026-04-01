import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import UniversalShowcase from '../components/universal/UniversalShowcase';

const MusicShowcase: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <UniversalShowcase
        profession="music_producer"
        userId={userId}
        isOwner={true}
        compact={false}
        maxItems={20}
      />
    </Box>
  );
};

export default MusicShowcase;
