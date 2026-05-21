import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseSEO } from '@/hooks/useShowcaseSEO';
import UniversalShowcase from '../components/universal/UniversalShowcase';
import ShowcaseConversionFooter from '@/components/showcase/ShowcaseConversionFooter';

export default function PhotoShowcase() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || null;

  useShowcaseSEO({
    profession: 'photographer',
    displayName,
  });

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <UniversalShowcase
        profession="photographer"
        userId={userId}
        isOwner={true}
        compact={false}
        maxItems={20}
      />
      <ShowcaseConversionFooter
        profession="photographer"
        displayName={displayName}
        contactEmail={user?.email || null}
      />
    </Box>
  );
}
