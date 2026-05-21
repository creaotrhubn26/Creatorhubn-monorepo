import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseSEO } from '@/hooks/useShowcaseSEO';
import UniversalShowcase from '../components/universal/UniversalShowcase';

const MusicShowcase: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || null;

  useShowcaseSEO({
    profession: 'music_producer',
    displayName,
  });

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
