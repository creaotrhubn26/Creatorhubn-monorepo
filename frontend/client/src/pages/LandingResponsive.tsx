import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import LandingDesktop from './landing-desktop';
import LandingMobile from './landing-mobile';
import TheRoleRoomLanding from './theroleroom-landing';

/**
 * Domene-detektert root-landing.
 *
 * - theroleroom.com (eller subdomener av) → <TheRoleRoomLanding />
 * - alt annet (creatorhubn.com, vercel-preview, localhost) → Creatorhub-investor
 *
 * Override via query: ?landing=trr | ?landing=creatorhub
 */
const LandingResponsive: React.FC = () => {
  const theme = useTheme();
  useTheming('photographer');
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const isTheRoleRoom = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const override = new URLSearchParams(window.location.search).get('landing');
    if (override === 'trr') return true;
    if (override === 'creatorhub') return false;
    return window.location.host.toLowerCase().includes('theroleroom');
  }, []);

  if (isTheRoleRoom) return <TheRoleRoomLanding />;
  return isDesktop ? <LandingDesktop /> : <LandingMobile />;
};

export default LandingResponsive;
