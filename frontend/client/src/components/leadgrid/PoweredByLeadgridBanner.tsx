/**
 * PoweredByLeadgridBanner.tsx
 *
 * Banner som vises i klient-portalen (/c/{token}) når org'en er på
 * Solo Free. Subtil "Powered by Leadgrid"-tekst som leder til
 * /leadgrid for white-label-info.
 *
 * Skjules automatisk hvis org har white_label_portal-feature
 * (Agency-plan eller høyere).
 *
 * Brukes som:
 *   <PoweredByLeadgridBanner orgPlan={portalData.org_plan} />
 */

import React from 'react';
import { Box, Typography, Stack } from '@mui/material';

interface Props {
  /** plan_key fra portal-API (solo_free/solo_pro/agency/enterprise) */
  orgPlan?: string | null;
  /** Hvis true (Agency+), skjul banneret helt */
  hasWhiteLabelFeature?: boolean;
  /** Variant: footer (bunn av siden) eller corner (nede-til-høyre) */
  variant?: 'footer' | 'corner';
}

export function PoweredByLeadgridBanner({
  orgPlan, hasWhiteLabelFeature, variant = 'footer',
}: Props) {
  // Skjul hvis Agency+ eller eksplisitt white-label
  if (hasWhiteLabelFeature) return null;
  if (orgPlan && orgPlan !== 'solo_free' && orgPlan !== 'solo_pro') return null;

  const content = (
    <Stack
      direction="row" alignItems="center" spacing={1}
      component="a" href="https://theroleroom.com/leadgrid" target="_blank"
      rel="noopener noreferrer"
      sx={{
        textDecoration: 'none',
        color: 'rgba(255,255,255,0.6)',
        transition: 'color 0.2s',
        '&:hover': { color: '#a78bfa' },
      }}
    >
      <Typography variant="caption" sx={{ fontSize: 11, letterSpacing: 1 }}>
        POWERED BY
      </Typography>
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        fontWeight: 700, fontSize: 13,
      }}>
        <Box sx={{
          width: 18, height: 18, borderRadius: '50% 50% 50% 0',
          bgcolor: '#a78bfa', transform: 'rotate(-45deg)',
          boxShadow: '0 0 8px #a78bfa66',
        }} />
        <span>Leadgrid</span>
      </Box>
    </Stack>
  );

  if (variant === 'corner') {
    return (
      <Box sx={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        px: 2, py: 1, borderRadius: 4,
        bgcolor: 'rgba(10, 5, 18, 0.85)',
        border: '1px solid rgba(167, 139, 250, 0.2)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}>
        {content}
      </Box>
    );
  }

  // Footer-variant
  return (
    <Box sx={{
      mt: 6, py: 3,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', justifyContent: 'center',
    }}>
      {content}
    </Box>
  );
}
