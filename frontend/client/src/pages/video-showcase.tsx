import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseSEO } from '@/hooks/useShowcaseSEO';
import UniversalShowcase from '../components/universal/UniversalShowcase';
import ShowcaseConversionFooter from '@/components/showcase/ShowcaseConversionFooter';

export default function VideoShowcase() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';
  const displayName = (user as { firstName?: string; lastName?: string; displayName?: string } | null)?.displayName
    || [(user as { firstName?: string } | null)?.firstName, (user as { lastName?: string } | null)?.lastName].filter(Boolean).join(' ').trim()
    || null;

  useShowcaseSEO({
    profession: 'videographer',
    displayName,
  });

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <UniversalShowcase
        profession="videographer"
        userId={userId}
        isOwner={true}
        compact={false}
        maxItems={20}
      />
      <ShowcaseConversionFooter
        profession="videographer"
        displayName={displayName}
        contactEmail={user?.email || null}
      />
    </Box>
  );
}
