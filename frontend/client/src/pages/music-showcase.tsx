import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseSEO } from '@/hooks/useShowcaseSEO';
import UniversalShowcase from '../components/universal/UniversalShowcase';
import ShowcaseConversionFooter from '@/components/showcase/ShowcaseConversionFooter';

const MusicShowcase: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';
  const displayName = (user as { firstName?: string; lastName?: string; displayName?: string } | null)?.displayName
    || [(user as { firstName?: string } | null)?.firstName, (user as { lastName?: string } | null)?.lastName].filter(Boolean).join(' ').trim()
    || null;

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
      <ShowcaseConversionFooter
        profession="music_producer"
        displayName={displayName}
        contactEmail={user?.email || null}
      />
    </Box>
  );
};

export default MusicShowcase;
