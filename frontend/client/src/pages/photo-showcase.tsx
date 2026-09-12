import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useShowcaseSEO } from '@/hooks/useShowcaseSEO';
import UniversalShowcase from '../components/universal/UniversalShowcase';
import ShowcaseConversionFooter from '@/components/showcase/ShowcaseConversionFooter';

export default function PhotoShowcase() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'unknown-user';
  const displayName = (user as { firstName?: string; lastName?: string; displayName?: string } | null)?.displayName
    || [(user as { firstName?: string } | null)?.firstName, (user as { lastName?: string } | null)?.lastName].filter(Boolean).join(' ').trim()
    || null;

  useShowcaseSEO({
    profession: 'photographer',
    displayName,
  });

  return (
    // Dark cinematic backdrop spans the whole page so the conversion footer
    // (testimonials/FAQ/CTA) reads on-brand instead of on default white.
    <Box sx={{ minHeight: '100vh', bgcolor: '#0B0B0C', color: '#F5F2EA' }}>
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
        photographerId={userId}
        clientView={false}
        editable
      />
    </Box>
  );
}
