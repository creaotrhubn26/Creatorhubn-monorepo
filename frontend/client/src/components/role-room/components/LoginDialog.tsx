/**
 * LoginDialog — Apple Glassmorphism redesign (from scratch)
 *
 * Visual concept
 * ──────────────
 * • Two-panel layout on ≥ 640 px: branding left | form right
 * • Single-column stacked layout on mobile
 * • Role picker: scrollable icon-chip grid (not a <select>)
 * • Inputs: pill shape, frosted glass, icon prefix
 * • Modal: multi-layer frosted glass with ambient glow orbs
 * • Palette: near-black base, white/10 glass, indigo-violet accents
 */

import { useState, useEffect, useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useT, type TranslationKey } from '../../../i18n';
import { keyframes } from '@mui/system';
import {
  Dialog,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Fade,
  useMediaQuery,
  MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
  AccountBalanceOutlined as DanceStudioOwnerIcon,
  AccessibilityNewOutlined as DanceFreelanceIcon,
  MailOutlineOutlined as DanceInviteHolderIcon,
} from '@mui/icons-material';
import { ROLE_ROOM_BRAND_ASSETS } from '../config/branding';
import { ROLE_ROOM_LANDING_CONFIG } from '../config/landing';
import {
  getActiveProfessionMode,
  setActiveProfessionMode,
  type ProfessionMode,
} from '../config/professionMode';
import authSessionService from '../services/authSessionService';
import { FeideLoginButton } from '../education/FeideLoginButton';
import { googleWorkspaceApi } from '../services/castingApiService';
import { parseClientPortalIntentFromWindow } from '../utils/clientPortal';
import { parseTalentPortalIntentFromWindow } from '../utils/talentPortal';
import { getRoleRoomVideoPosterUrl, getRoleRoomVideoStillUrl } from '../utils/roleRoomMedia';
import { ROLE_ROOM_EDUCATION_PATH, getRoleRoomReturnPath, isRoleRoomStandaloneRuntime } from '../utils/runtime';
import { useRoleRoomBrand } from '../hooks/useRoleRoomBrand';

/* ─────────────────────────── types ────────────────────────────── */

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    id: number | string;
    email: string;
    role: string;
    display_name: string;
    name?: string;
    loginAs?: string;
    requestedRole?: string | null;
  }) => void;
  isLandingPage?: boolean;
  onGuestEnter?: () => void;
  initialPersona?: LoginPersona;
}

// 2026-06-07: 'talents' lagt til som egen persona for skuespillere/talent-side.
// Per-persona-logikken (getMinimumSeatCount/getSeatPrice/etc) faller tilbake til
// defaults når persona = 'talents' — TheRoleRoomLanding bruker det som
// initialPersona-hint, og dialogen vil senere kunne få egen UI for talents.
type LoginPersona = '' | 'production_team' | 'content_producer' | 'education_institution' | 'dance_studio' | 'talents';
type EducationInstitutionType = '' | 'upper_secondary' | 'folk_high_school' | 'vocational_college' | 'higher_education' | 'private_school';
type EducationSeatRange = '' | 'up_to_15' | 'up_to_30' | 'up_to_60' | 'up_to_120' | 'more_than_120';
type EducationStartWindow = '' | 'this_semester' | 'next_semester' | 'next_academic_year' | 'exploring';
type ContentProducerOnboardingStep = 'company' | 'role' | 'team' | 'auth';
type ProductionTeamOnboardingStep = 'company' | 'role' | 'team' | 'auth';
type RoleChipVariant = 'default' | 'decision';

interface RoleRoomPublicStats {
  kreative: number;
  produksjoner: number;
  rollerBesatt: number;
  kandidater?: number;
  auditioner?: number;
  crew?: number;
  lokasjoner?: number;
}

interface RoleRoomPublicTestimonial {
  id: string;
  roleId: string;
  quote: string;
  author: string;
  title: string;
}

interface TeamMemberDraft {
  name: string;
  email: string;
  roleId: string;
}

interface RoleRoomCompanyScreeningResponse {
  success: boolean;
  data?: {
    organizationNumber?: string;
    companyName?: string;
    brregVerified?: boolean;
    screeningSource?: string;
    source?: string;
  };
  error?: string;
}

interface RoleRoomCommercialAccessResponse {
  success: boolean;
  organizationNumber?: string;
  companyName?: string;
  planId?: string;
  planName?: string;
  monthlyTotalExVat?: number;
  paymentCompleted?: boolean;
  membersRegistered?: number;
  teamLeadEmail?: string;
  error?: string;
}

interface RoleRoomCommercialCheckoutResponse {
  success: boolean;
  alreadyPaid?: boolean;
  paymentCompleted?: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  planId?: string;
  planName?: string;
  monthlyTotalExVat?: number;
  membersRegistered?: number;
  error?: string;
}

interface RoleRoomCommercialSessionStatusResponse {
  success: boolean;
  sessionId?: string;
  status?: string | null;
  paymentStatus?: string | null;
  paymentCompleted?: boolean;
  activationRequired?: boolean;
  activationApproved?: boolean;
  activationEmailsSent?: boolean;
  transactionId?: string | null;
  paymentAmount?: number | null;
  paymentTimestamp?: string | null;
  planId?: string | null;
  planName?: string | null;
  stripeSubscriptionId?: string | null;
  error?: string;
}

interface RoleRoomEducationInquiryResponse {
  success: boolean;
  requestId?: string | null;
  companyName?: string;
  organizationNumber?: string;
  status?: string;
  notificationEmailSent?: boolean;
  notificationAcceptedRecipients?: string[];
  message?: string;
  error?: string;
}

type RoleRoomTurnstileWidgetId = string | number;

type RoleRoomTurnstileApi = {
  ready: (callback: () => void) => void;
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'timeout-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => RoleRoomTurnstileWidgetId;
  reset: (widgetId?: RoleRoomTurnstileWidgetId) => void;
  remove?: (widgetId?: RoleRoomTurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: RoleRoomTurnstileApi;
  }
}

/* ─────────────────────────── per-card config ───────────────────────────
 * Add a new card by adding one entry here — label, icon, video and focal
 * point all in one place.  Then reference its id in professionCategories.
 * ─────────────────────────────────────────────────────────────────────── */
const ROLE_CARDS: Record<string, {
  label:          string;
  icon?:          string;
  video?:         string;
  videoPosition?: string;
  /** Inline-ikon rendret når icon/video mangler. Brukes for dans-roller
   *  (MUI SVG-ikon med fontSize: 'inherit' — skaleres av parent-Box). */
  glyph?:         ReactNode;
}> = {
  admin:             { label: 'dlgLogin.role.admin',         icon: '/role-room-assets/roleroom_dashboard.webp' },
  photographer:      { label: 'dlgLogin.role.photographer',      icon: '/role-room-assets/roleroom_photographer.webp', video: '/role-room-assets/roleroom_photographer.mov' },
  film_photographer: { label: 'dlgLogin.role.film_photographer',  icon: '/role-room-assets/roleroom_filmfotograf.webp',     video: '/role-room-assets/roleroom_filmfotograf.mp4' },
  photo_director:    { label: 'dlgLogin.role.photo_director',  icon: '/role-room-assets/roleroom_photo_director.webp',   video: '/role-room-assets/roleroom_photo_director.mov' },
  photo_assistant:   { label: 'dlgLogin.role.photo_assistant', icon: '/role-room-assets/roleroom_photo_assistant.webp',  video: '/role-room-assets/roleroom_photo_assistant.mov' },
  director:          { label: 'dlgLogin.role.director',      icon: '/role-room-assets/roleroom_director.webp',         video: '/role-room-assets/roleroom_director.mp4' },
  producer:          { label: 'dlgLogin.role.producer',     icon: '/role-room-assets/roleroom_producer.webp', video: '/role-room-assets/roleroom_producer.mp4' },
  casting_director:  { label: 'dlgLogin.role.casting_director', icon: '/role-room-assets/roleroom_casting_director.webp', video: '/role-room-assets/roleroom_casting_director.mp4', videoPosition: '60% 15%' },
  camera_operator:   { label: 'dlgLogin.role.camera_operator',        icon: '/role-room-assets/roleroom_cinemag.webp', video: '/role-room-assets/roleroom_cinemag.mp4' },
  talent:            { label: 'dlgLogin.role.talent',   icon: '/role-room-assets/roleroom_skuespiller.webp', video: '/role-room-assets/roleroom_skuespiller.mov' },
  agent:             { label: 'dlgLogin.role.agent',         icon: '/role-room-assets/roleroom_agent.webp',            video: '/role-room-assets/roleroom_agent.mp4' },
  client:            { label: 'dlgLogin.role.client',        icon: '/role-room-assets/roleroom_klient.webp',       video: '/role-room-assets/roleroom_klient.mov' },
  education_institution: { label: 'dlgLogin.role.education_institution', icon: ROLE_ROOM_BRAND_ASSETS.appLogo },

  // ── Sound ─────────────────────────────────────────────────────────────
  // Drop in icon / video paths once assets are ready
  sound_designer:    { label: 'dlgLogin.role.sound_designer',  icon: '/role-room-assets/roleroom_sound_designer.webp', video: '/role-room-assets/roleroom_sound_designer.mp4' },
  sound_mixer:       { label: 'dlgLogin.role.sound_mixer', icon: '/role-room-assets/roleroom_sound_designer.webp' },
  boom_operator:     { label: 'dlgLogin.role.boom_operator', video: '/role-room-assets/roleroom_boom_operator.mp4' },
  composer:          { label: 'dlgLogin.role.composer'    , video: '/role-room-assets/roleroom_composer.mp4' },

  // ── Dans-vertikalen — 3 path-valg (Studio-eier / Frilansdanser / Har invitasjon)
  // De gamle 5 dance-rollekortene (Koreograf/Instruktør/Co-danser/Pianist) er
  // droppet — de er nå custom roller som Studio-eier definerer per studio og
  // tildeler ved invite, ikke noe brukeren selv-velger ved signup.
  dance_studio_owner:    { label: 'dlgLogin.role.dance_studio_owner',    glyph: <DanceStudioOwnerIcon   sx={{ fontSize: 'inherit' }} /> },
  dance_freelance:       { label: 'dlgLogin.role.dance_freelance',  glyph: <DanceFreelanceIcon     sx={{ fontSize: 'inherit' }} /> },
  dance_invite_holder:   { label: 'dlgLogin.role.dance_invite_holder', glyph: <DanceInviteHolderIcon  sx={{ fontSize: 'inherit' }} /> },

  // ── HOW TO ADD A NEW CARD ────────────────────────────────────────────
  // 1. Add an entry below (copy any line above as a template)
  // 2. Add its id to a category in professionCategories below
  // 3. (Optional) put the asset in /public/role-room-assets/
  //
  // my_role: { label: 'My Role', icon: '/role-room-assets/roleroom_myrole.webp', video: '/role-room-assets/roleroom_myrole.mp4', videoPosition: '40% 20%' },
};

/* ── derived lookup maps used internally by the card renderer ─────── */
const roleIcons = Object.fromEntries(Object.entries(ROLE_CARDS).filter(([, v]) => v.icon).map(([k, v]) => [k, v.icon!]));
const roleGlyphs = Object.fromEntries(Object.entries(ROLE_CARDS).filter(([, v]) => v.glyph).map(([k, v]) => [k, v.glyph!]));

const ROLE_ROOM_TURNSTILE_VERIFY_ACTION = 'role_room_education_inquiry';
const ROLE_ROOM_TURNSTILE_SCRIPT_ID = 'role-room-turnstile-script';
const ROLE_ROOM_TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const ROLE_ROOM_TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

function getRoleRoomTurnstileSiteKey() {
  const configured = String(
    import.meta.env.VITE_ROLE_ROOM_TURNSTILE_SITE_KEY
      || import.meta.env.VITE_TURNSTILE_SITE_KEY
      || '',
  ).trim();
  if (configured) {
    return configured;
  }
  return import.meta.env.DEV ? ROLE_ROOM_TURNSTILE_TEST_SITE_KEY : '';
}

function RoleRoomTurnstileWidget({
  siteKey,
  action,
  resetSignal,
  onTokenChange,
  onErrorChange,
}: {
  siteKey: string;
  action: string;
  resetSignal: number;
  onTokenChange: (token: string) => void;
  onErrorChange: (message: string) => void;
}) {
  const { t } = useLoginT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<RoleRoomTurnstileWidgetId | null>(null);

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    const renderWidget = () => {
      if (
        cancelled
        || !window.turnstile
        || !containerRef.current
        || widgetIdRef.current !== null
      ) {
        return;
      }

      onErrorChange('');
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: 'dark',
        callback: (token) => {
          onErrorChange('');
          onTokenChange(token);
        },
        'expired-callback': () => {
          onTokenChange('');
          onErrorChange(t('dlgLogin.turnstile.expired'));
        },
        'timeout-callback': () => {
          onTokenChange('');
          onErrorChange(t('dlgLogin.turnstile.timeout'));
        },
        'error-callback': () => {
          onTokenChange('');
          onErrorChange(t('dlgLogin.turnstile.loadFailed'));
        },
      });
    };

    const existingScript = document.getElementById(
      ROLE_ROOM_TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (!window.turnstile) {
        onErrorChange(t('dlgLogin.turnstile.initFailed'));
        return;
      }
      renderWidget();
    };

    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', () => {
        onErrorChange(t('dlgLogin.turnstile.loadFailed'));
      });
    } else {
      const script = document.createElement('script');
      script.id = ROLE_ROOM_TURNSTILE_SCRIPT_ID;
      script.src = ROLE_ROOM_TURNSTILE_SCRIPT_SRC;
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', () => {
        onErrorChange(t('dlgLogin.turnstile.loadFailed'));
      });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (existingScript) {
        existingScript.removeEventListener('load', handleLoad);
      }
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onErrorChange, onTokenChange, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current === null || !window.turnstile) {
      return;
    }
    onTokenChange('');
    onErrorChange('');
    window.turnstile.reset(widgetIdRef.current);
  }, [onErrorChange, onTokenChange, resetSignal]);

  return <Box ref={containerRef} sx={{ minHeight: 65 }} />;
}

/* ── use-case scenarios shown on the left branding panel ──────────── */
const USE_CASES: { roleId: string; line: string }[] = [
  { roleId: 'photographer',     line: 'dlgLogin.useCase.photographer' },
  { roleId: 'director',         line: 'dlgLogin.useCase.director' },
  { roleId: 'talent',           line: 'dlgLogin.useCase.talent' },
  { roleId: 'producer',         line: 'dlgLogin.useCase.producer' },
  { roleId: 'agent',            line: 'dlgLogin.useCase.agent' },
  { roleId: 'casting_director', line: 'dlgLogin.useCase.casting_director' },
  { roleId: 'client',           line: 'dlgLogin.useCase.client' },
  { roleId: 'education_institution', line: 'dlgLogin.useCase.education_institution' },
];

/* ── per-role accent RGB — drives reactive glow + tinting ─────── */
const ROLE_COLOURS: Record<string, { r: number; g: number; b: number }> = {
  photographer:      { r: 100, g: 180, b: 255 },
  film_photographer: { r:  80, g: 150, b: 255 },
  photo_director:    { r: 130, g: 100, b: 255 },
  photo_assistant:   { r: 160, g: 210, b: 255 },
  director:          { r: 230, g:  70, b:  70 },
  producer:          { r: 230, g: 140, b:  50 },
  casting_director:  { r: 210, g:  80, b: 230 },
  camera_operator:   { r:  90, g: 200, b: 180 },
  talent:            { r:  80, g: 215, b: 130 },
  agent:             { r: 230, g: 185, b:  50 },
  client:            { r: 180, g: 130, b: 255 },
  education_institution: { r: 246, g: 195, b: 88 },
  sound_designer:    { r:  60, g: 200, b: 220 },
  sound_mixer:       { r:  70, g: 190, b: 200 },
  boom_operator:     { r:  90, g: 195, b: 200 },
  composer:          { r: 145, g: 105, b: 255 },
  admin:             { r: 130, g: 110, b: 255 },
};

/* ── short taglines shown on left panel when a role is selected ── */
const ROLE_TAGLINES: Record<string, string> = {
  photographer:      'dlgLogin.tagline.photographer',
  film_photographer: 'dlgLogin.tagline.film_photographer',
  photo_director:    'dlgLogin.tagline.photo_director',
  photo_assistant:   'dlgLogin.tagline.photo_assistant',
  director:          'dlgLogin.tagline.director',
  producer:          'dlgLogin.tagline.producer',
  casting_director:  'dlgLogin.tagline.casting_director',
  camera_operator:   'dlgLogin.tagline.camera_operator',
  talent:            'dlgLogin.tagline.talent',
  agent:             'dlgLogin.tagline.agent',
  client:            'dlgLogin.tagline.client',
  education_institution: 'dlgLogin.tagline.education_institution',
  sound_designer:    'dlgLogin.tagline.sound_designer',
  sound_mixer:       'dlgLogin.tagline.sound_mixer',
  boom_operator:     'dlgLogin.tagline.boom_operator',
  composer:          'dlgLogin.tagline.composer',
  admin:             'dlgLogin.tagline.admin',
};

/* ── default testimonials ─────────────────────────────────────── */
const DEFAULT_TESTIMONIALS: { roleId: string; quote: string; author: string; title: string }[] = [
  { roleId: 'casting_director', quote: 'dlgLogin.testi.casting_director.quote',   author: 'Maria H.',   title: 'dlgLogin.testi.casting_director.title' },
  { roleId: 'director',         quote: 'dlgLogin.testi.director.quote',          author: 'Eskil T.',   title: 'dlgLogin.testi.director.title' },
  { roleId: 'photographer',     quote: 'dlgLogin.testi.photographer.quote',       author: 'Lena K.',    title: 'dlgLogin.testi.photographer.title' },
  { roleId: 'producer',         quote: 'dlgLogin.testi.producer.quote',               author: 'Jonas W.',   title: 'dlgLogin.testi.producer.title' },
  { roleId: 'talent',           quote: 'dlgLogin.testi.talent.quote',    author: 'Camilla R.', title: 'dlgLogin.testi.talent.title' },
  { roleId: 'agent',            quote: 'dlgLogin.testi.agent.quote',      author: 'Henrik B.',  title: 'dlgLogin.testi.agent.title' },
  { roleId: 'client',           quote: 'dlgLogin.testi.client.quote',           author: 'Sofie N.',   title: 'dlgLogin.testi.client.title' },
  { roleId: 'education_institution', quote: 'dlgLogin.testi.education_institution.quote', author: 'Ragnhild E.', title: 'dlgLogin.testi.education_institution.title' },
];
const CONTENT_PRODUCER_TESTIMONIALS: { roleId: string; quote: string; author: string; title: string }[] = [
  { roleId: 'film_photographer', quote: 'dlgLogin.cpTesti.film_photographer.quote', author: 'Mina T.', title: 'dlgLogin.cpTesti.film_photographer.title' },
  { roleId: 'photographer', quote: 'dlgLogin.cpTesti.photographer.quote', author: 'Sander H.', title: 'dlgLogin.cpTesti.photographer.title' },
  { roleId: 'director', quote: 'dlgLogin.cpTesti.director.quote', author: 'Elise K.', title: 'dlgLogin.cpTesti.director.title' },
  { roleId: 'camera_operator', quote: 'dlgLogin.cpTesti.camera_operator.quote', author: 'Tobias L.', title: 'dlgLogin.cpTesti.camera_operator.title' },
  { roleId: 'sound_designer', quote: 'dlgLogin.cpTesti.sound_designer.quote', author: 'Mari A.', title: 'dlgLogin.cpTesti.sound_designer.title' },
  { roleId: 'composer', quote: 'dlgLogin.cpTesti.composer.quote', author: 'Joakim R.', title: 'dlgLogin.cpTesti.composer.title' },
];
const CONTENT_PRODUCER_USE_CASES: { roleId: string; line: string }[] = [
  { roleId: 'film_photographer', line: 'dlgLogin.cpUseCase.film_photographer' },
  { roleId: 'photographer', line: 'dlgLogin.cpUseCase.photographer' },
  { roleId: 'director', line: 'dlgLogin.cpUseCase.director' },
  { roleId: 'camera_operator', line: 'dlgLogin.cpUseCase.camera_operator' },
];
const DECISION_ROLE_SPOTLIGHTS: Partial<Record<string, {
  eyebrow: string;
  summary: string;
}>> = {
  film_photographer: {
    eyebrow: 'dlgLogin.spot.film_photographer.eyebrow',
    summary: 'dlgLogin.spot.film_photographer.summary',
  },
  photographer: {
    eyebrow: 'dlgLogin.spot.photographer.eyebrow',
    summary: 'dlgLogin.spot.photographer.summary',
  },
  director: {
    eyebrow: 'dlgLogin.spot.director.eyebrow',
    summary: 'dlgLogin.spot.director.summary',
  },
  camera_operator: {
    eyebrow: 'dlgLogin.spot.camera_operator.eyebrow',
    summary: 'dlgLogin.spot.camera_operator.summary',
  },
  sound_designer: {
    eyebrow: 'dlgLogin.spot.sound_designer.eyebrow',
    summary: 'dlgLogin.spot.sound_designer.summary',
  },
  composer: {
    eyebrow: 'dlgLogin.spot.composer.eyebrow',
    summary: 'dlgLogin.spot.composer.summary',
  },
  producer: {
    eyebrow: 'dlgLogin.spot.producer.eyebrow',
    summary: 'dlgLogin.spot.producer.summary',
  },
  casting_director: {
    eyebrow: 'dlgLogin.spot.casting_director.eyebrow',
    summary: 'dlgLogin.spot.casting_director.summary',
  },
  photo_director: {
    eyebrow: 'dlgLogin.spot.photo_director.eyebrow',
    summary: 'dlgLogin.spot.photo_director.summary',
  },
  photo_assistant: {
    eyebrow: 'dlgLogin.spot.photo_assistant.eyebrow',
    summary: 'dlgLogin.spot.photo_assistant.summary',
  },
  sound_mixer: {
    eyebrow: 'dlgLogin.spot.sound_mixer.eyebrow',
    summary: 'dlgLogin.spot.sound_mixer.summary',
  },
  boom_operator: {
    eyebrow: 'dlgLogin.spot.boom_operator.eyebrow',
    summary: 'dlgLogin.spot.boom_operator.summary',
  },
};

const ROLE_ROOM_PUBLIC_STATS_ENDPOINT = '/api/role-room/public/stats';
const ROLE_ROOM_STATS_REFRESH_MS = 15_000;
const ROLE_ROOM_PUBLIC_TESTIMONIALS_ENDPOINT = '/api/role-room/public/testimonials';
const ROLE_ROOM_TESTIMONIALS_REFRESH_MS = 60_000;
const ROLE_ROOM_SELECT_MENU_PROPS = {
  transitionDuration: 0,
  anchorOrigin: {
    vertical: 'bottom',
    horizontal: 'left',
  },
  transformOrigin: {
    vertical: 'top',
    horizontal: 'left',
  },
  sx: {
    zIndex: 10060,
  },
  PaperProps: {
    sx: {
      zIndex: 10061,
      mt: 0.5,
      maxHeight: 'min(52vh, 360px)',
      bgcolor: 'rgba(18,14,30,0.98)',
      color: 'rgba(245,240,255,0.94)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(18px)',
      '& .MuiMenuItem-root': {
        fontSize: '0.82rem',
      },
      '& .MuiMenuItem-root:hover': {
        bgcolor: 'rgba(255,255,255,0.08)',
      },
      '& .MuiMenuItem-root.Mui-selected': {
        bgcolor: 'rgba(160,140,255,0.18)',
      },
      '& .MuiMenuItem-root.Mui-selected:hover': {
        bgcolor: 'rgba(160,140,255,0.24)',
      },
    },
  },
} as const;
const CONTENT_TEAM_ROLE_IDS = [
  'film_photographer',
  'photographer',
  'director',
  'camera_operator',
  'sound_designer',
  'composer',
] as const;
const CONTENT_PRODUCER_ROLE_IDS = new Set([...CONTENT_TEAM_ROLE_IDS, 'client']);
const CONTENT_PRODUCER_ONBOARDING_STEPS: ReadonlyArray<{
  id: ContentProducerOnboardingStep;
  label: string;
  description: string;
}> = [
  { id: 'company', label: 'dlgLogin.cpStep.company.label', description: 'dlgLogin.cpStep.company.desc' },
  { id: 'role', label: 'dlgLogin.cpStep.role.label', description: 'dlgLogin.cpStep.role.desc' },
  { id: 'team', label: 'dlgLogin.cpStep.team.label', description: 'dlgLogin.cpStep.team.desc' },
  { id: 'auth', label: 'dlgLogin.cpStep.auth.label', description: 'dlgLogin.cpStep.auth.desc' },
];
const PRODUCTION_TEAM_ONBOARDING_STEPS: ReadonlyArray<{
  id: ProductionTeamOnboardingStep;
  label: string;
  description: string;
}> = [
  { id: 'company', label: 'dlgLogin.ptStep.company.label', description: 'dlgLogin.ptStep.company.desc' },
  { id: 'role', label: 'dlgLogin.ptStep.role.label', description: 'dlgLogin.ptStep.role.desc' },
  { id: 'team', label: 'dlgLogin.ptStep.team.label', description: 'dlgLogin.ptStep.team.desc' },
  { id: 'auth', label: 'dlgLogin.ptStep.auth.label', description: 'dlgLogin.ptStep.auth.desc' },
];
const PRODUCTION_TEAM_MIN_MEMBERS = 3;
const CONTENT_PRODUCER_MIN_MEMBERS = 1;
const EDUCATION_INSTITUTION_MIN_CONTACTS = 1;
const PRODUCTION_TEAM_PRICE_PER_PERSON = 795;
const CONTENT_PRODUCER_MONTHLY_PRICE = 495;
const BRREG_LOOKUP_DEBOUNCE_MS = 450;
const PRODUCTION_TEAM_ROLE_IDS = [
  'producer',
  'director',
  'casting_director',
  'camera_operator',
  'photographer',
  'photo_director',
  'photo_assistant',
  'sound_designer',
  'sound_mixer',
  'boom_operator',
  'composer',
] as const;
const DANCE_STUDIO_ROLE_IDS = [
  'dance_studio_owner',
  'dance_freelance',
  'dance_invite_holder',
] as const;
const EDUCATION_INSTITUTION_TYPES: ReadonlyArray<{
  id: Exclude<EducationInstitutionType, ''>;
  label: string;
}> = [
  { id: 'upper_secondary', label: 'dlgLogin.eduInst.upper_secondary' },
  { id: 'folk_high_school', label: 'dlgLogin.eduInst.folk_high_school' },
  { id: 'vocational_college', label: 'dlgLogin.eduInst.vocational_college' },
  { id: 'higher_education', label: 'dlgLogin.eduInst.higher_education' },
  { id: 'private_school', label: 'dlgLogin.eduInst.private_school' },
];
const EDUCATION_STUDENT_SEAT_OPTIONS: ReadonlyArray<{
  id: Exclude<EducationSeatRange, ''>;
  label: string;
}> = [
  { id: 'up_to_15', label: 'dlgLogin.eduStudent.up_to_15' },
  { id: 'up_to_30', label: 'dlgLogin.eduStudent.up_to_30' },
  { id: 'up_to_60', label: 'dlgLogin.eduStudent.up_to_60' },
  { id: 'up_to_120', label: 'dlgLogin.eduStudent.up_to_120' },
  { id: 'more_than_120', label: 'dlgLogin.eduStudent.more_than_120' },
];
const EDUCATION_STAFF_SEAT_OPTIONS: ReadonlyArray<{
  id: Exclude<EducationSeatRange, ''>;
  label: string;
}> = [
  { id: 'up_to_15', label: 'dlgLogin.eduStaff.up_to_15' },
  { id: 'up_to_30', label: 'dlgLogin.eduStaff.up_to_30' },
  { id: 'up_to_60', label: 'dlgLogin.eduStaff.up_to_60' },
  { id: 'up_to_120', label: 'dlgLogin.eduStaff.up_to_120' },
  { id: 'more_than_120', label: 'dlgLogin.eduStaff.more_than_120' },
];
const EDUCATION_START_WINDOW_OPTIONS: ReadonlyArray<{
  id: Exclude<EducationStartWindow, ''>;
  label: string;
}> = [
  { id: 'this_semester', label: 'dlgLogin.eduStart.this_semester' },
  { id: 'next_semester', label: 'dlgLogin.eduStart.next_semester' },
  { id: 'next_academic_year', label: 'dlgLogin.eduStart.next_academic_year' },
  { id: 'exploring', label: 'dlgLogin.eduStart.exploring' },
];
const ROLE_ROOM_EDUCATION_INQUIRY_ENDPOINT = '/api/role-room/education-inquiries';
const ROLE_ROOM_COMMERCIAL_CHECKOUT_ENDPOINT = '/api/role-room/billing/checkout-session';
const ROLE_ROOM_COMMERCIAL_SESSION_STATUS_ENDPOINT = '/api/role-room/billing/session-status';
const ROLE_ROOM_COMMERCIAL_DRAFT_STORAGE_KEY = 'role-room-commercial-draft-v1';

type RoleRoomCommercialDraft = {
  loginPersona: LoginPersona;
  selectedRole: string;
  email: string;
  organizationNumber: string;
  organizationCompanyName: string;
  organizationValidatedNumber: string;
  paidCommercialSetupSignature: string;
  contentProducerStep: ContentProducerOnboardingStep;
  productionTeamStep: ProductionTeamOnboardingStep;
  productionTeamMembers: TeamMemberDraft[];
};

type CommercialPaymentNotice = {
  severity: 'success' | 'warning' | 'info';
  message: string;
};

function createBlankTeamMember(): TeamMemberDraft {
  return {
    name: '',
    email: '',
    roleId: '',
  };
}

function createInitialTeamMembers(): TeamMemberDraft[] {
  return [createBlankTeamMember()];
}

function formatRoleRoomStatValue(value: number): string {
  return value.toLocaleString('nb-NO');
}

function normalizeOrganizationNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 9);
}

function formatOrganizationNumber(value: string): string {
  return normalizeOrganizationNumber(value)
    .replace(/(\d{3})(?=\d)/g, '$1 ')
    .trim();
}

function getMinimumSeatCount(persona: LoginPersona): number {
  if (persona === 'production_team') {
    return PRODUCTION_TEAM_MIN_MEMBERS;
  }
  if (persona === 'content_producer') {
    return CONTENT_PRODUCER_MIN_MEMBERS;
  }
  if (persona === 'education_institution') {
    return EDUCATION_INSTITUTION_MIN_CONTACTS;
  }
  return CONTENT_PRODUCER_MIN_MEMBERS;
}

function getSeatPrice(persona: LoginPersona): number {
  if (persona === 'education_institution') {
    return 0;
  }
  return persona === 'production_team'
    ? PRODUCTION_TEAM_PRICE_PER_PERSON
    : CONTENT_PRODUCER_MONTHLY_PRICE;
}

function getCommercialSubscriptionPlan(
  persona: Exclude<LoginPersona, '' | 'education_institution'>,
) {
  if (persona === 'production_team') {
    return {
      planId: 'role-room-production-team',
      planName: 'Produksjonsteam',
    };
  }

  return {
    planId: 'role-room-content-producer',
    planName: 'Innholdsprodusent',
  };
}

function isTeamMemberComplete(member: TeamMemberDraft): boolean {
  return Boolean(member.name.trim() && member.email.trim() && member.roleId);
}

function deriveLoginPersonaForRole(roleId: string): LoginPersona {
  if (!roleId) {
    return '';
  }

  if (roleId === 'education_institution') {
    return 'education_institution';
  }

  return CONTENT_PRODUCER_ROLE_IDS.has(roleId)
    ? 'content_producer'
    : 'production_team';
}

function getDefaultRoleForPersona(
  persona: LoginPersona,
  options?: {
    clientPortalIntent?: boolean;
    talentPortalIntent?: boolean;
  },
): string {
  if (persona === 'content_producer') {
    return options?.clientPortalIntent ? 'client' : 'film_photographer';
  }
  if (persona === 'production_team') {
    return options?.talentPortalIntent && !options?.clientPortalIntent ? 'talent' : 'producer';
  }
  if (persona === 'education_institution') {
    return 'education_institution';
  }
  return '';
}

function getEducationSeatLabel(
  value: EducationSeatRange,
  options: ReadonlyArray<{ id: Exclude<EducationSeatRange, ''>; label: string }>,
): string {
  if (!value) {
    return 'dlgLogin.notSet';
  }
  return options.find((option) => option.id === value)?.label || 'dlgLogin.notSet';
}

function getEducationStartWindowLabel(value: EducationStartWindow): string {
  if (!value) {
    return 'dlgLogin.notSet';
  }
  return EDUCATION_START_WINDOW_OPTIONS.find((option) => option.id === value)?.label || 'dlgLogin.notSet';
}

function getEffectiveLoginPersona(
  selectedRole: string,
  loginPersona: LoginPersona,
): LoginPersona {
  if (loginPersona) {
    return loginPersona;
  }

  return deriveLoginPersonaForRole(selectedRole);
}

function getRoleCardPreviewAsset(roleId: string): string | undefined {
  const card = ROLE_CARDS[roleId];
  if (!card) {
    return undefined;
  }

  return card.icon
    || getRoleRoomVideoPosterUrl(card.video)
    || getRoleRoomVideoStillUrl(card.video);
}

function readRoleRoomCommercialDraft(): RoleRoomCommercialDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ROLE_ROOM_COMMERCIAL_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<RoleRoomCommercialDraft> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const productionTeamMembers = Array.isArray(parsed.productionTeamMembers)
      ? parsed.productionTeamMembers
          .filter((member): member is TeamMemberDraft => Boolean(member && typeof member === 'object'))
          .map((member) => ({
            name: String(member.name || ''),
            email: String(member.email || ''),
            roleId: String(member.roleId || ''),
          }))
      : createInitialTeamMembers();

    return {
      loginPersona:
        parsed.loginPersona === 'production_team'
        || parsed.loginPersona === 'content_producer'
        || parsed.loginPersona === 'education_institution'
          ? parsed.loginPersona
          : '',
      selectedRole: String(parsed.selectedRole || ''),
      email: String(parsed.email || ''),
      organizationNumber: String(parsed.organizationNumber || ''),
      organizationCompanyName: String(parsed.organizationCompanyName || ''),
      organizationValidatedNumber: String(parsed.organizationValidatedNumber || ''),
      paidCommercialSetupSignature: String(parsed.paidCommercialSetupSignature || ''),
      contentProducerStep:
        parsed.contentProducerStep === 'company'
        || parsed.contentProducerStep === 'role'
        || parsed.contentProducerStep === 'team'
        || parsed.contentProducerStep === 'auth'
          ? parsed.contentProducerStep
          : 'company',
      productionTeamStep:
        parsed.productionTeamStep === 'company'
        || parsed.productionTeamStep === 'role'
        || parsed.productionTeamStep === 'team'
        || parsed.productionTeamStep === 'auth'
          ? parsed.productionTeamStep
          : 'company',
      productionTeamMembers:
        productionTeamMembers.length > 0 ? productionTeamMembers : createInitialTeamMembers(),
    };
  } catch {
    return null;
  }
}

function writeRoleRoomCommercialDraft(draft: RoleRoomCommercialDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      ROLE_ROOM_COMMERCIAL_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
  } catch {
    // Ignore storage persistence errors.
  }
}

function clearRoleRoomCommercialDraft() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(ROLE_ROOM_COMMERCIAL_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors.
  }
}

/* ── categories: list role ids — all card data lives in ROLE_CARDS ─── *
 * HOW TO ADD A NEW CATEGORY:                                         *
 * 1. Add a new object: { id: 'my_cat', label: 'My Cat', roleIds: [] }
 * 2. Fill roleIds with ids that exist in ROLE_CARDS above            *
 * 3. That’s it — the grid renders automatically                      *
 * ─────────────────────────────────────────────────────────────────── */
const professionCategories = [
  { id: 'admin',  label: 'dlgLogin.cat.prof.admin', roleIds: ['admin'] },
  { id: 'foto',   label: 'dlgLogin.cat.prof.foto',  roleIds: ['photographer', 'film_photographer', 'photo_director', 'photo_assistant'] },
  { id: 'video',  label: 'dlgLogin.cat.prof.video', roleIds: ['director', 'producer', 'casting_director', 'camera_operator'] },
  { id: 'lyd',    label: 'dlgLogin.cat.prof.lyd',   roleIds: ['sound_designer', 'sound_mixer', 'boom_operator', 'composer'] },
  { id: 'felles', label: 'dlgLogin.cat.prof.felles', roleIds: ['talent', 'agent', 'client'] },
];
const contentProducerCategories = [
  {
    id: 'kjerne',
    label: 'dlgLogin.cat.cp.kjerne.label',
    description: 'dlgLogin.cat.cp.kjerne.desc',
    roleIds: ['film_photographer', 'photographer', 'director', 'camera_operator'],
  },
  {
    id: 'utvid',
    label: 'dlgLogin.cat.cp.utvid.label',
    description: 'dlgLogin.cat.cp.utvid.desc',
    roleIds: ['sound_designer', 'composer'],
  },
] as const;
const productionTeamCategories = [
  {
    id: 'kjerne',
    label: 'dlgLogin.cat.pt.kjerne.label',
    description: 'dlgLogin.cat.pt.kjerne.desc',
    roleIds: ['producer', 'director', 'casting_director', 'photo_director'],
  },
  {
    id: 'produksjon',
    label: 'dlgLogin.cat.pt.produksjon.label',
    description: 'dlgLogin.cat.pt.produksjon.desc',
    roleIds: ['camera_operator', 'photographer', 'photo_assistant'],
  },
  {
    id: 'utvid',
    label: 'dlgLogin.cat.pt.utvid.label',
    description: 'dlgLogin.cat.pt.utvid.desc',
    roleIds: ['sound_designer', 'sound_mixer', 'boom_operator', 'composer'],
  },
] as const;
const danceStudioCategories = [
  {
    id: 'velg_vei',
    label: 'dlgLogin.cat.dance.velg_vei.label',
    description: 'dlgLogin.cat.dance.velg_vei.desc',
    roleIds: ['dance_studio_owner', 'dance_freelance', 'dance_invite_holder'],
  },
] as const;

const allRoles = Object.entries(ROLE_CARDS).map(([id, v]) => ({ id, label: v.label }));

const LOGIN_PERSONA_OPTIONS: ReadonlyArray<{
  id: Exclude<LoginPersona, ''>;
  label: string;
  description: string;
}> = [
  {
    id: 'production_team',
    label: 'dlgLogin.persona.production_team.label',
    description: 'dlgLogin.persona.production_team.desc',
  },
  {
    id: 'content_producer',
    label: 'dlgLogin.persona.content_producer.label',
    description: 'dlgLogin.persona.content_producer.desc',
  },
  {
    id: 'education_institution',
    label: 'dlgLogin.persona.education_institution.label',
    description: 'dlgLogin.persona.education_institution.desc',
  },
  {
    id: 'dance_studio',
    label: 'dlgLogin.persona.dance_studio.label',
    description: 'dlgLogin.persona.dance_studio.desc',
  },
];

const CONTENT_PRODUCER_ACCESS_OPTIONS: ReadonlyArray<{
  id: 'film_photographer' | 'client';
  label: string;
  description: string;
}> = [
  {
    id: 'film_photographer',
    label: 'dlgLogin.cpAccess.film_photographer.label',
    description: 'dlgLogin.cpAccess.film_photographer.desc',
  },
  {
    id: 'client',
    label: 'dlgLogin.cpAccess.client.label',
    description: 'dlgLogin.cpAccess.client.desc',
  },
];

/* ═══════════════════ ✏️  VISUAL DESIGN CONFIG ════════════════════ *
 * All visual design values live here. Change colours, sizes,        *
 * timings and assets without touching layout or logic code.         *
 * ═════════════════════════════════════════════════════════════════*/
const DESIGN = {
  /** Playing-card dimensions, animation timing, typography */
  card: {
    aspectRatio:        '2 / 3',
    borderRadius:       '14px',
    background:         'rgba(4,2,10,0.92)',
    defaultFocalPoint:  'center 15%',          // objectPosition fallback
    hoverTransform:     'translateY(-10px) rotate(-2deg) scale(1.04)',
    activeTransform:    'translateY(-4px) rotate(0deg) scale(0.98)',
    transitionDuration: '0.3s',
    pulseGlowDuration:  '2s',
    shimmerDuration:    '0.75s',
    labelFont:          'Georgia, serif',
    labelFontSize:      '0.67rem',
    cornerFontSize:     '0.62rem',
  },

  /** Purple accent palette — swap every purple by editing this block */
  p: {
    // borders
    borderIdle:          'rgba(147,51,234,0.35)',
    borderSelected:      'rgba(192,132,252,0.95)',
    borderHover:         'rgba(192,132,252,0.85)',
    // shadows / glows
    glowInner:           'rgba(109,40,217,0.60)',
    glowInset:           'rgba(216,180,254,0.20)',
    glowHover:           'rgba(109,40,217,0.65)',
    shadowRing:          'rgba(192,132,252,0.40)',
    shadowRingHover:     'rgba(192,132,252,0.50)',
    shadowIdle:          'rgba(109,40,217,0.15)',
    // pulse-glow keyframe stops
    pulse0:              'rgba(147,51,234,0.45)',
    pulse0Outer:         'rgba(147,51,234,0.15)',
    pulse50:             'rgba(192,132,252,0.70)',
    pulse50Outer:        'rgba(192,132,252,0.25)',
    // shimmer sweep
    shimmerMid:          'rgba(200,150,255,0.28)',
    shimmerEdge:         'rgba(220,180,255,0.12)',
    // top-edge shine
    edgeIdle:            'rgba(147,51,234,0.40)',
    edgeSelected:        'rgba(192,132,252,0.70)',
    // label band
    labelBorderIdle:     'rgba(147,51,234,0.10)',
    labelBorderSelected: 'rgba(147,51,234,0.30)',
    labelBgSelInner:     'rgba(12,2,22,0.97)',
    labelBgSelOuter:     'rgba(22,5,40,0.85)',
    // text
    textIdle:            'rgba(167,139,250,0.85)',
    textSelected:        'rgba(216,180,254,1.00)',
    textGlow:            'rgba(192,132,252,0.80)',
    textLabelGlow:       'rgba(192,132,252,0.70)',
    // selected radial burst
    burstInner:          'rgba(147,51,234,0.14)',
    burstOuter:          'rgba(109,40,217,0.06)',
    // icon effects
    iconDropHover:       'rgba(192,132,252,0.55)',
    iconDropSelected:    'rgba(192,132,252,0.40)',
  },

  /** Ambient video backdrop shown behind the modal */
  backdrop: {
    src:            '/role-room-assets/landing_backdrop.mp4',
    opacity:        0.28,
    objectPosition: 'center 30%',
    filter:         'saturate(0.75) brightness(0.6)',
  },

  /** Modal container sizing and surface colours */
  modal: {
    maxWidthDesktop:  'clamp(1560px, 95vw, 4400px)',
    maxWidthMobile:   'min(96vw, 480px)',
    minHeightDesktop: 'clamp(640px, 80vh, 1540px)',
    bgOpaque:         'rgba(14,14,22,0.96)',
    bgTranslucent:    'rgba(14,14,22,0.72)',
    backdropBg:       'rgba(6,6,12,0.65)',
    borderRadiusLg:   '28px',
    borderRadiusSm:   '24px',
  },

  /** Role-picker card grid */
  grid: {
    colsMobile:  2,
    colsDesktop: 4,
    gap:         0.75,   // MUI spacing units
  },
} as const;

/* ─────────────────────── shared tokens ────────────────────────── */

const glass = {
  surface: 'rgba(255,255,255,0.055)',
  surfaceHover: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.1)',
  borderHover: 'rgba(255,255,255,0.2)',
  borderFocus: 'rgba(160,140,255,0.55)',
  text: 'rgba(255,255,255,0.92)',
  textSub: 'rgba(255,255,255,0.45)',
  textMuted: 'rgba(255,255,255,0.28)',
} as const;

const easing = 'cubic-bezier(0.25,0.46,0.45,0.94)';

/* ──────────────────── card animations ─────────────────────────── */

const shimmerAnim = keyframes`
  0%   { transform: translateX(-180%) skewX(-18deg); opacity: 0; }
  30%  { opacity: 0.7; }
  100% { transform: translateX(220%)  skewX(-18deg); opacity: 0; }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 18px 4px ${DESIGN.p.pulse0}, 0 0 60px 10px ${DESIGN.p.pulse0Outer}; }
  50%       { box-shadow: 0 0 32px 8px ${DESIGN.p.pulse50}, 0 0 80px 20px ${DESIGN.p.pulse50Outer}; }
`;

const badgeIconEnter = keyframes`
  0%   { opacity: 0; transform: scale(0.4) rotate(-15deg); }
  60%  { opacity: 1; transform: scale(1.18) rotate(4deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
`;

const dotPulse = keyframes`
  0%, 100% { box-shadow: 0 0 6px 2px rgba(80,230,140,0.5); }
  50%       { box-shadow: 0 0 12px 5px rgba(80,230,140,0.9); }
`;

const hintBounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(6px); }
`;

/* ──────────────────── DanceInvitePasteEntry ─────────────────────
 * Vises i stedet for email/password-feltene når brukeren klikker
 * "Har invitasjon" i dance-flyten. Tar imot enten en hel invite-URL
 * (https://creatorhubn.com/dance/invite/<token>) eller bare token.
 * Navigerer til /dance/invite/<token> der mottakeren kan logge inn
 * og akseptere. Trenger ingen email/password — selve invite-token er
 * nok for å identifisere mottakeren.
 */
function DanceInvitePasteEntry(): React.ReactElement {
  const { t } = useLoginT();
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const trimmed = raw.trim();
    if (!trimmed) { setErr(t('dlgLogin.dance.pasteFirst')); return; }
    // Hent token-delen — enten siste path-segment fra URL eller hele input
    let token = trimmed;
    try {
      const url = new URL(trimmed);
      const m = url.pathname.match(/\/dance\/invite\/([^/]+)/);
      if (m) token = decodeURIComponent(m[1]);
      else {
        const segs = url.pathname.split('/').filter(Boolean);
        token = segs[segs.length - 1] ?? trimmed;
      }
    } catch {
      // Ikke URL — bruk som token direkte
    }
    if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) {
      setErr(t('dlgLogin.dance.invalidToken'));
      return;
    }
    window.location.href = `/dance/invite/${encodeURIComponent(token)}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Typography sx={{ fontSize: 12, color: 'rgba(229,231,235,0.7)', mb: 0.5 }}>
        {t('dlgLogin.dance.pasteHelp')}
      </Typography>
      {err ? <Alert severity="error">{err}</Alert> : null}
      <TextField
        label={t('dlgLogin.dance.inviteLabel')}
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setErr(null); }}
        fullWidth
        autoFocus
        placeholder="https://creatorhubn.com/dance/invite/abc123…"
        sx={{ '& .MuiInputLabel-root, & .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
      />
      <Button
        variant="contained"
        onClick={submit}
        sx={{
          bgcolor: 'var(--role-violet, #8b5cf6)',
          '&:hover': { bgcolor: '#4c1d95' },
          textTransform: 'none',
          fontWeight: 600,
          alignSelf: 'flex-start',
          mt: 0.5,
        }}
      >{t('dlgLogin.dance.continueBtn')}</Button>
    </Box>
  );
}

/* ──────────────────── RoleChip sub-component ───────────────────── */

function RoleChip({
  role,
  selected,
  onSelect,
  video,
  videoPosition,
  compact = false,
  variant = 'default',
}: {
  role: { id: string; label: string };
  selected: boolean;
  onSelect: (id: string) => void;
  video?: string;
  videoPosition?: string;
  compact?: boolean;
  variant?: RoleChipVariant;
}) {
  const { tr } = useLoginT();
  const roleLabel = tr(role.label);
  const shortLabel = roleLabel.split(' ')[0];
  const spotlight = variant === 'decision'
    ? DECISION_ROLE_SPOTLIGHTS[role.id]
    : null;
  const showDecisionDetails = variant === 'decision' && selected;
  const videoRef   = useRef<HTMLVideoElement>(null);
  const cardRef    = useRef<HTMLButtonElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const objPos = videoPosition ?? DESIGN.card.defaultFocalPoint;
  const fallbackImage = getRoleRoomVideoStillUrl(video, roleIcons[role.id]);
  const fallbackPoster = getRoleRoomVideoPosterUrl(video, fallbackImage);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
    setVideoSrc(undefined);
  }, [video]);

  // Lazy-load: only assign src once the card scrolls into view
  useEffect(() => {
    if (!video) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVideoSrc(video);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video]);

  useEffect(() => {
    if (selected && video && !videoSrc) {
      setVideoSrc(video);
    }
  }, [selected, video, videoSrc]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || videoFailed) return;
    if (selected && videoSrc && !videoReady) {
      el.load();
      return;
    }
    if (selected && videoReady) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [selected, videoFailed, videoReady, videoSrc]);

  return (
    <Box
      component="button"
      type="button"
      ref={cardRef}
      onClick={() => onSelect(role.id)}
      data-testid={`role-room-role-card-${role.id}`}
      data-media-mode={selected && videoReady && !videoFailed ? 'video' : 'image'}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        aspectRatio: variant === 'decision'
          ? (compact ? '1 / 1.16' : '1 / 1.22')
          : (compact ? '1 / 1.08' : DESIGN.card.aspectRatio),
        borderRadius: variant === 'decision'
          ? (compact ? '16px' : '22px')
          : (compact ? '12px' : DESIGN.card.borderRadius),
        overflow: 'hidden',
        outline: 'none',
        p: 0,
        border: '1.5px solid',
        borderColor: selected
          ? DESIGN.p.borderSelected
          : DESIGN.p.borderIdle,
        background: DESIGN.card.background,
        transition: `all ${DESIGN.card.transitionDuration} ${easing}`,
        boxShadow: selected
          ? `0 0 0 1px ${DESIGN.p.shadowRing}, 0 14px 48px ${DESIGN.p.glowInner}, 0 2px 0 ${DESIGN.p.glowInset} inset`
          : `0 4px 24px rgba(0,0,0,0.7), 0 1px 0 ${DESIGN.p.shadowIdle} inset`,
        animation: selected ? `${pulseGlow} ${DESIGN.card.pulseGlowDuration} ease-in-out infinite` : 'none',
        '&:hover': {
          transform: variant === 'decision'
            ? 'translateY(-6px) scale(1.018)'
            : (compact ? 'translateY(-4px) scale(1.02)' : DESIGN.card.hoverTransform),
          borderColor: DESIGN.p.borderHover,
          boxShadow: `0 20px 60px ${DESIGN.p.glowHover}, 0 0 0 1px ${DESIGN.p.shadowRingHover}`,
          '& .card-shimmer': {
            animation: `${shimmerAnim} ${DESIGN.card.shimmerDuration} ease-in-out forwards`,
          },
          '& .card-icon': {
            filter: `brightness(1.15) saturate(1.3) drop-shadow(0 0 18px ${DESIGN.p.iconDropHover})`,
          },
        },
        '&:active': { transform: compact ? 'scale(0.985)' : DESIGN.card.activeTransform },
      }}
    >
      {/* ── full-bleed video or icon fills entire card ── */}
      {fallbackImage ? (
        <Box
          component="img"
          src={fallbackImage}
          alt={roleLabel}
          className="card-icon"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: objPos,
            zIndex: 0,
            filter: selected
              ? `brightness(1.08) saturate(1.15) drop-shadow(0 0 14px ${DESIGN.p.iconDropSelected})`
              : 'brightness(0.88) saturate(0.95)',
            transition: `filter 0.3s ${easing}, opacity 0.3s ${easing}`,
            opacity: selected && videoReady && !videoFailed ? 0.12 : 1,
          }}
        />
      ) : null}
      {video ? (
        <Box
          component="video"
          ref={videoRef}
          src={videoSrc}
          poster={fallbackPoster}
          loop
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => {
            setVideoReady(true);
            setVideoFailed(false);
          }}
          onCanPlay={() => {
            setVideoReady(true);
            setVideoFailed(false);
          }}
          onError={() => {
            setVideoReady(false);
            setVideoFailed(true);
          }}
          data-testid={`role-room-role-card-video-${role.id}`}
          className="card-icon"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: objPos,
            zIndex: 0,
            filter: selected
              ? 'brightness(1.1) saturate(1.3)'
              : 'brightness(0.82) saturate(0.9)',
            transition: `filter 0.3s ${easing}, opacity 0.3s ${easing}`,
            opacity: selected && videoReady && !videoFailed ? 1 : 0,
          }}
        />
      ) : roleIcons[role.id] ? (
        <Box
          component="img"
          src={roleIcons[role.id]}
          alt={roleLabel}
          className="card-icon"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: objPos,
            zIndex: 0,
            filter: selected
              ? `brightness(1.1) saturate(1.25) drop-shadow(0 0 14px ${DESIGN.p.iconDropSelected})`
              : 'brightness(0.88) saturate(0.95)',
            transition: `filter 0.3s ${easing}`,
          }}
        />
      ) : roleGlyphs[role.id] ? (
        <Box
          className="card-icon"
          aria-hidden="true"
          sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 0,
            // Lilla gradient som matcher dans-vertikalens branding-tokens.
            background: selected
              ? 'radial-gradient(circle at 50% 40%, rgba(167,139,250,0.35) 0%, rgba(76,29,149,0.85) 70%, #0a0a0a 100%)'
              : 'radial-gradient(circle at 50% 40%, rgba(139,92,246,0.18) 0%, rgba(30,18,52,0.92) 70%, #0a0a0a 100%)',
            transition: `background 0.3s ${easing}`,
            // SVG-ikon arver fontSize fra parent.
            fontSize: 'clamp(40px, 14vw, 76px)',
            lineHeight: 1,
            color: selected ? 'rgba(237,233,254,0.98)' : 'rgba(221,214,254,0.88)',
            filter: selected
              ? `drop-shadow(0 0 14px rgba(167,139,250,0.7)) drop-shadow(0 0 6px rgba(255,255,255,0.35))`
              : 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
          }}
        >
          {roleGlyphs[role.id]}
        </Box>
      ) : null}

      {/* ── dark vignette ── */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 45%, transparent 28%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* ── shimmer sweep layer ── */}
      <Box
        className="card-shimmer"
        sx={{
          position: 'absolute', top: 0, bottom: 0,
          width: '55%', zIndex: 5, pointerEvents: 'none',
          background: `linear-gradient(105deg, transparent 20%, ${DESIGN.p.shimmerMid} 50%, ${DESIGN.p.shimmerEdge} 65%, transparent 80%)`,

          transform: 'translateX(-180%) skewX(-18deg)',
        }}
      />

      {/* ── gold top-edge shine ── */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px', zIndex: 4,
        background: selected
          ? `linear-gradient(90deg, transparent, ${DESIGN.p.edgeSelected}, transparent)`
          : `linear-gradient(90deg, transparent, ${DESIGN.p.edgeIdle}, transparent)`,
      }} />

      {variant === 'decision' && spotlight ? (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 4,
            px: 0.85,
            py: 0.4,
            borderRadius: '999px',
            bgcolor: selected ? 'rgba(15,12,28,0.82)' : 'rgba(10,8,18,0.72)',
            border: selected
              ? `1px solid ${DESIGN.p.shadowRing}`
              : '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Typography
            sx={{
              fontSize: compact ? '0.48rem' : '0.54rem',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: selected ? DESIGN.p.textSelected : 'rgba(228,220,245,0.78)',
            }}
          >
            {tr(spotlight.eyebrow)}
          </Typography>
        </Box>
      ) : null}

      {/* ── top-left corner index ── */}
      {!compact && variant !== 'decision' && (
        <Box sx={{
          position: 'absolute', top: 6, left: 7, zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        }}>
          <Typography sx={{
            fontSize: DESIGN.card.cornerFontSize, fontWeight: 900, lineHeight: 1,
            color: selected ? DESIGN.p.textSelected : DESIGN.p.textIdle,
            textShadow: selected ? `0 0 8px ${DESIGN.p.textGlow}` : '0 1px 3px rgba(0,0,0,0.9)',
            letterSpacing: '0.02em',
            fontFamily: DESIGN.card.labelFont,
            whiteSpace: 'nowrap',
            maxWidth: '30px', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {shortLabel}
          </Typography>
          {roleIcons[role.id] && (
            <Box component="img" src={roleIcons[role.id]} alt=""
              sx={{ width: 11, height: 11, objectFit: 'contain', opacity: selected ? 0.95 : 0.55,
                filter: selected ? 'hue-rotate(230deg) saturate(1.5)' : 'none' }}
            />
          )}
        </Box>
      )}

      {/* ── bottom-right corner index (rotated 180°) ── */}
      {!compact && variant !== 'decision' && (
        <Box sx={{
          position: 'absolute', bottom: 6, right: 7, zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
          transform: 'rotate(180deg)',
        }}>
          <Typography sx={{
            fontSize: DESIGN.card.cornerFontSize, fontWeight: 900, lineHeight: 1,
            color: selected ? DESIGN.p.textSelected : DESIGN.p.textIdle,
            textShadow: selected ? `0 0 8px ${DESIGN.p.textGlow}` : '0 1px 3px rgba(0,0,0,0.9)',
            letterSpacing: '0.02em',
            fontFamily: DESIGN.card.labelFont,
            whiteSpace: 'nowrap',
            maxWidth: '30px', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {shortLabel}
          </Typography>
          {roleIcons[role.id] && (
            <Box component="img" src={roleIcons[role.id]} alt=""
              sx={{ width: 11, height: 11, objectFit: 'contain', opacity: selected ? 0.95 : 0.55,
                filter: selected ? 'hue-rotate(230deg) saturate(1.5)' : 'none' }}
            />
          )}
        </Box>
      )}

      {/* ── bottom label band ── */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: variant === 'decision'
          ? (showDecisionDetails ? (compact ? '28%' : '23%') : (compact ? '10%' : '8%'))
          : (compact ? '27%' : '30%'),
        zIndex: 2,
        background: selected
          ? `linear-gradient(to top, ${DESIGN.p.labelBgSelInner} 0%, ${DESIGN.p.labelBgSelOuter} 55%, transparent 100%)`
          : variant === 'decision'
            ? 'linear-gradient(to top, rgba(8,4,16,0.72) 0%, rgba(8,4,16,0.24) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)',
        display: 'flex',
        alignItems: showDecisionDetails ? 'center' : 'flex-end',
        justifyContent: 'center',
        px: compact ? 0.75 : 0.95,
        pt: variant === 'decision'
          ? (showDecisionDetails ? (compact ? 0.8 : 1.1) : 0)
          : (compact ? 1.4 : 2),
        pb: variant === 'decision' && !showDecisionDetails ? (compact ? 0.45 : 0.55) : 0,
        borderTop: selected ? `1px solid ${DESIGN.p.labelBorderSelected}` : `1px solid ${DESIGN.p.labelBorderIdle}`,
      }}>
        {variant === 'decision' ? (
          showDecisionDetails ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.26 }}>
              <Typography sx={{
                fontSize: compact ? '0.62rem' : '0.82rem',
                fontWeight: 700,
                lineHeight: 1.1,
                textAlign: 'center',
                letterSpacing: '0.01em',
                color: DESIGN.p.textSelected,
                textShadow: `0 0 12px ${DESIGN.p.textLabelGlow}, 0 1px 3px rgba(0,0,0,1)`,
                maxWidth: '92%',
              }}>
                {roleLabel}
              </Typography>
              {spotlight ? (
                <Typography
                  sx={{
                    fontSize: compact ? '0.47rem' : '0.56rem',
                    lineHeight: 1.32,
                    textAlign: 'center',
                    color: 'rgba(236,231,247,0.84)',
                    maxWidth: compact ? '88%' : '90%',
                  }}
                >
                  {tr(spotlight.summary)}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Box
              sx={{
                width: compact ? '62%' : '44%',
                height: '2px',
                borderRadius: '999px',
                bgcolor: 'rgba(192,132,252,0.46)',
                boxShadow: '0 0 18px rgba(192,132,252,0.22)',
              }}
            />
          )
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <Typography sx={{
              fontSize: compact ? '0.6rem' : DESIGN.card.labelFontSize,
              fontWeight: 700,
              lineHeight: 1.1,
              textAlign: 'center',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: DESIGN.card.labelFont,
              color: selected ? DESIGN.p.textSelected : DESIGN.p.textIdle,
              textShadow: selected
                ? `0 0 12px ${DESIGN.p.textLabelGlow}, 0 1px 3px rgba(0,0,0,1)`
                : '0 1px 4px rgba(0,0,0,0.95)',
              wordBreak: 'break-word',
            }}>
              {roleLabel}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── selected radial burst ── */}
      {selected && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 35%, ${DESIGN.p.burstInner} 0%, ${DESIGN.p.burstOuter} 50%, transparent 75%)`,
        }} />
      )}
    </Box>
  );
}

/* ────────────────────── CategorySection ───────────────────────── */

function CategorySection({
  category,
  selectedRole,
  onSelect,
  isMobile,
  compact = false,
  variant = 'default',
}: {
  category: { id: string; label: string; roleIds: readonly string[]; description?: string };
  selectedRole: string;
  onSelect: (id: string) => void;
  isMobile: boolean;
  compact?: boolean;
  variant?: RoleChipVariant;
}) {
  const { tr } = useLoginT();
  const isSecondaryDecisionGroup = variant === 'decision' && category.id === 'utvid';
  const cols = variant === 'decision'
    ? 2
    : (isMobile ? DESIGN.grid.colsMobile : DESIGN.grid.colsDesktop);

  return (
    <Box
      sx={variant === 'decision'
        ? {
            p: isSecondaryDecisionGroup ? { xs: 0.9, sm: 1.1 } : { xs: 1.05, sm: 1.25 },
            borderRadius: isSecondaryDecisionGroup ? '16px' : '20px',
            bgcolor: isSecondaryDecisionGroup ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.04)',
            border: isSecondaryDecisionGroup
              ? '1px solid rgba(255,255,255,0.07)'
              : '1px solid rgba(170,145,255,0.12)',
          }
        : undefined}
    >
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: variant === 'decision'
            ? (isSecondaryDecisionGroup ? 'rgba(196,188,220,0.62)' : 'rgba(225,216,248,0.88)')
            : glass.textMuted,
          mb: category.description ? 0.35 : 0.75,
          pl: 0.25,
        }}
      >
        {tr(category.label)}
      </Typography>
      {variant === 'decision' && category.description ? (
        <Typography
          sx={{
            fontSize: isSecondaryDecisionGroup ? '0.68rem' : '0.74rem',
            lineHeight: 1.55,
            color: isSecondaryDecisionGroup ? 'rgba(194,188,212,0.62)' : 'rgba(218,211,236,0.76)',
            mb: 0.9,
            maxWidth: isSecondaryDecisionGroup ? 560 : 760,
            pl: 0.25,
          }}
        >
          {tr(category.description)}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: variant === 'decision' ? 1 : DESIGN.grid.gap,
        }}
      >
        {category.roleIds.map((id) => {
          const card = ROLE_CARDS[id];
          if (!card) return null;
          return (
            <RoleChip
              key={id}
              role={{ id, label: card.label }}
              selected={selectedRole === id}
              onSelect={onSelect}
              video={card.video}
              videoPosition={card.videoPosition}
              compact={compact}
              variant={variant}
            />
          );
        })}
      </Box>
    </Box>
  );
}

/* ──────────────────────── glass input styles ──────────────────────────── */

function glassInputSx(focused?: boolean) {
  return {
    '& .MuiOutlinedInput-root': {
      color: glass.text,
      bgcolor: glass.surface,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRadius: '16px',
      fontSize: '1.1rem',
      fontWeight: 300,
      letterSpacing: '0.01em',
      transition: `all 0.35s ${easing}`,
      '& fieldset': {
        borderColor: glass.border,
        transition: `all 0.35s ${easing}`,
      },
      '&:hover': {
        bgcolor: glass.surfaceHover,
        '& fieldset': { borderColor: glass.borderHover },
      },
      '&.Mui-focused': {
        bgcolor: 'rgba(255,255,255,0.08)',
        boxShadow: '0 0 0 4px rgba(130,110,255,0.1)',
        '& fieldset': {
          borderColor: glass.borderFocus,
          borderWidth: '1.5px',
        },
      },
    },
    '& .MuiInputLabel-root': {
      color: glass.textSub,
      fontWeight: 300,
      fontSize: '1rem',
      '&.Mui-focused': { color: 'rgba(180,165,255,0.85)' },
    },
    '& .MuiInputAdornment-root .MuiSvgIcon-root': {
      fontSize: '1.3rem',   // 17.6px — proportional to 0.95rem input text
      color: focused ? 'rgba(160,145,255,0.75)' : glass.textMuted,
      transition: `color 0.3s ${easing}`,
      flexShrink: 0,
    },
    '& .MuiInputBase-input': {
      py: 2.1,
    },
  } as const;
}

/* ─── Profession mode picker — kompakt meta brukt i landingens login-dialog ─── */

interface ProfessionPickerMeta {
  label: string;
  glyph: string;
  accent: string;
  beta?: boolean;
}

const PROFESSION_PICKER_META: Record<ProfessionMode, ProfessionPickerMeta> = {
  production:       { label: 'Film/video',       glyph: '🎬', accent: '#60a5fa' },
  photographer:     { label: 'Fotograf',         glyph: '📷', accent: 'var(--role-cyan, #22d3ee)' },
  content_producer: { label: 'Innholdsprodusent', glyph: '✍️', accent: '#a855f7' },
  content_creator:  { label: 'Innholdsskaper',   glyph: '⚡', accent: '#f59e0b' },
  dance_studio:     { label: 'Dansestudio',      glyph: '🎓', accent: '#8b5cf6', beta: true },
  dance_freelance:  { label: 'Dans — frilans',   glyph: '💫', accent: '#8b5cf6', beta: true },
  education:        { label: 'Utdanningsinstitusjon', glyph: '🏫', accent: '#8b5cf6', beta: true },
  student:          { label: 'Student', glyph: '🎓', accent: '#8b5cf6', beta: true },
};

// Landing-velgeren viser kun profesjoner som IKKE allerede dekkes av
// persona-velgeren (production_team / content_producer / education_institution).
// Det forhindrer dobbel-presentasjon av "produksjonsteam" og "innholds-
// produsent" som allerede er kjernen av onboarding-flyten over.
const LANDING_PROFESSION_PICKER_MODES: readonly ProfessionMode[] = [
  'photographer',
  'content_creator',
  'dance_studio',
  'dance_freelance',
] as const;

/* ════════════════════════ LoginDialog ═════════════════════════════ */

function useLoginT() {
  const { t } = useT();
  const tr = useCallback((k?: string) => (k ? t(k as TranslationKey) : ''), [t]);
  return { t, tr };
}

export default function LoginDialog({
  open,
  onClose,
  onLoginSuccess,
  isLandingPage = false,
  onGuestEnter,
  initialPersona = '',
}: LoginDialogProps) {
  const isMobile = useMediaQuery('(max-width:639px)');
  const isFullScreen = useMediaQuery('(max-width:479px)');
  // CreatorHub Design: selv-brand login-dialogen (--role-cyan m.fl.) fra theroleroom-tokens, så
  // cyan-aksenten retinter også når dialogen vises på landingssiden (der casting-shellet ikke er
  // montert). Ingen override → vars uset → literalene (#22d3ee) gjelder → identisk.
  useRoleRoomBrand();
  const { t, tr } = useLoginT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loginPersona, setLoginPersona] = useState<LoginPersona>('');
  // Profesjonsvalg på landingssiden — settes i localStorage så Role Room
  // post-login lander i riktig vertikal (DanceWorkspace ved dans, ellers
  // standard produksjons-flyt).
  const [selectedProfessionMode, setSelectedProfessionMode] = useState<ProfessionMode>(
    () => getActiveProfessionMode(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 2FA-state: når backend returnerer needs_2fa, vises inline-prompt
  // for 6-sifret kode. Når brukeren submitter går vi til complete-2fa.
  const [twoFactorState, setTwoFactorState] = useState<{ tempToken: string; message: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const completeTwoFactorLogin = useCallback(async (): Promise<void> => {
    if (!twoFactorState) return;
    const code = twoFactorCode.trim();
    if (code.length < 6) {
      setTwoFactorError(t('dlgLogin.tfa.enterCode'));
      return;
    }
    setTwoFactorSubmitting(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/auth/login/complete-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: twoFactorState.tempToken, code }),
      });
      const payload = await response.json().catch(() => null) as {
        success?: boolean;
        token?: string;
        user?: any;
        error?: string;
        message?: string;
        usedBackupCode?: boolean;
      } | null;
      if (!response.ok || !payload?.success) {
        setTwoFactorError(payload?.message ?? t('dlgLogin.tfa.wrongCode'));
        return;
      }
      // Match samme normalisering som vanlig login-success-grenen
      const user = payload.user as { id: number | string; email: string; role: string; display_name?: string; name?: string; loginAs?: string; requestedRole?: string | null };
      const normalizedUser = {
        ...user,
        loginAs: user.loginAs,
        requestedRole: user.requestedRole ?? null,
        display_name: user.display_name || user.name || user.email.split('@')[0],
      };
      await authSessionService.setSessionToken(payload.token ?? null);
      await authSessionService.setAdminUser(normalizedUser);
      await authSessionService.setCurrentUserId(String(normalizedUser.id));
      clearRoleRoomCommercialDraft();
      setTwoFactorState(null);
      setTwoFactorCode('');
      onLoginSuccess(normalizedUser);
    } catch {
      setTwoFactorError(t('dlgLogin.tfa.networkError'));
    } finally {
      setTwoFactorSubmitting(false);
    }
  }, [twoFactorState, twoFactorCode, onLoginSuccess]);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [ucIdx, setUcIdx] = useState(0);
  const [ucVisible, setUcVisible] = useState(true);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialVisible, setTestimonialVisible] = useState(true);
  const [backdropVideoReady, setBackdropVideoReady] = useState(false);
  const [backdropVideoFailed, setBackdropVideoFailed] = useState(false);
  const [roleRoomPublicStats, setRoleRoomPublicStats] = useState<RoleRoomPublicStats | null>(null);
  const [roleRoomPublicTestimonials, setRoleRoomPublicTestimonials] = useState<RoleRoomPublicTestimonial[] | null>(null);
  const [organizationNumber, setOrganizationNumber] = useState('');
  const [organizationCompanyName, setOrganizationCompanyName] = useState('');
  const [organizationLookupError, setOrganizationLookupError] = useState('');
  const [organizationLookupLoading, setOrganizationLookupLoading] = useState(false);
  const [organizationValidatedNumber, setOrganizationValidatedNumber] = useState('');
  const [commercialPaymentNotice, setCommercialPaymentNotice] = useState<CommercialPaymentNotice | null>(null);
  const [commercialPaymentPending, setCommercialPaymentPending] = useState(false);
  const [paidCommercialSetupSignature, setPaidCommercialSetupSignature] = useState('');
  const [educationInstitutionType, setEducationInstitutionType] = useState<EducationInstitutionType>('');
  const [educationProgramName, setEducationProgramName] = useState('');
  const [educationStudentSeatRange, setEducationStudentSeatRange] = useState<EducationSeatRange>('');
  const [educationStaffSeatRange, setEducationStaffSeatRange] = useState<EducationSeatRange>('');
  const [educationContactRole, setEducationContactRole] = useState('');
  const [educationDesiredStartWindow, setEducationDesiredStartWindow] = useState<EducationStartWindow>('');
  const [educationUseCase, setEducationUseCase] = useState('');
  const [educationInquiryStartedAt, setEducationInquiryStartedAt] = useState<number>(() => Date.now());
  const [educationInquiryWebsite, setEducationInquiryWebsite] = useState('');
  const [educationInquiryTurnstileToken, setEducationInquiryTurnstileToken] = useState('');
  const [educationInquiryTurnstileError, setEducationInquiryTurnstileError] = useState('');
  const [educationInquiryTurnstileResetSignal, setEducationInquiryTurnstileResetSignal] = useState(0);
  const [educationInquirySubmitted, setEducationInquirySubmitted] = useState<{
    requestId: string | null;
    notificationEmailSent: boolean;
    message: string;
  } | null>(null);
  const [contentProducerStep, setContentProducerStep] = useState<ContentProducerOnboardingStep>('company');
  const [productionTeamStep, setProductionTeamStep] = useState<ProductionTeamOnboardingStep>('company');
  const [productionTeamMembers, setProductionTeamMembers] = useState<TeamMemberDraft[]>(
    () => createInitialTeamMembers(),
  );
  const hasSeenHint = useRef(false);
  const orgLookupAbortRef = useRef<AbortController | null>(null);
  const restoredCommercialDraftRef = useRef(false);
  const handledCheckoutSessionRef = useRef('');
  const persistedCommercialSetupRef = useRef('');
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const rolePickerScrollRef = useRef<HTMLDivElement>(null);
  const clientPortalIntent = parseClientPortalIntentFromWindow();
  const talentPortalIntent = parseTalentPortalIntentFromWindow();
  const effectiveLoginPersona = getEffectiveLoginPersona(selectedRole, loginPersona);
  const backdropStillUrl = getRoleRoomVideoStillUrl(DESIGN.backdrop.src, '/role-room-assets/landing_backdrop.webp');
  const resetCommercialPanelScroll = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const panel = rightPanelRef.current;
    const rolePicker = rolePickerScrollRef.current;
    const scrollToTop = () => {
      panel?.scrollTo({ top: 0, behavior: 'auto' });
      rolePicker?.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.requestAnimationFrame(scrollToTop);
    window.setTimeout(scrollToTop, 70);
  }, []);
  const clearCommercialCheckoutParams = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('rrCheckout');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const clearCommercialActivationParams = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('rrActivation');
    url.searchParams.delete('rrActivationMessage');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const resetRoleRoomPersonaSelection = useCallback((options?: {
    clearAuthFields?: boolean;
  }) => {
    orgLookupAbortRef.current?.abort();
    restoredCommercialDraftRef.current = false;
    handledCheckoutSessionRef.current = '';
    persistedCommercialSetupRef.current = '';
    clearRoleRoomCommercialDraft();
    clearCommercialCheckoutParams();
    clearCommercialActivationParams();
    setSelectedRole('');
    setLoginPersona('');
    setOrganizationNumber('');
    setOrganizationCompanyName('');
    setOrganizationLookupError('');
    setOrganizationLookupLoading(false);
    setOrganizationValidatedNumber('');
    setCommercialPaymentNotice(null);
    setCommercialPaymentPending(false);
    setPaidCommercialSetupSignature('');
    setEducationInstitutionType('');
    setEducationProgramName('');
    setEducationStudentSeatRange('');
    setEducationStaffSeatRange('');
    setEducationContactRole('');
    setEducationDesiredStartWindow('');
    setEducationUseCase('');
    setEducationInquiryWebsite('');
    setEducationInquiryStartedAt(Date.now());
    setEducationInquiryTurnstileToken('');
    setEducationInquiryTurnstileError('');
    setEducationInquiryTurnstileResetSignal((value) => value + 1);
    setEducationInquirySubmitted(null);
    setContentProducerStep('company');
    setProductionTeamStep('company');
    setProductionTeamMembers(createInitialTeamMembers());
    setError('');
    setLoading(false);

    if (options?.clearAuthFields) {
      setEmail('');
      setPassword('');
      setForgotPassword(false);
      setForgotEmail('');
      setForgotSent(false);
    }

    resetCommercialPanelScroll();
  }, [
    clearCommercialActivationParams,
    clearCommercialCheckoutParams,
    resetCommercialPanelScroll,
  ]);

  useEffect(() => {
    setBackdropVideoReady(false);
    setBackdropVideoFailed(false);
    if (!open) {
      persistedCommercialSetupRef.current = '';
      restoredCommercialDraftRef.current = false;
      handledCheckoutSessionRef.current = '';
      setEducationInquiryWebsite('');
      setEducationInquiryStartedAt(Date.now());
      setEducationInquiryTurnstileToken('');
      setEducationInquiryTurnstileError('');
      setEducationInquiryTurnstileResetSignal(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || effectiveLoginPersona !== 'education_institution') {
      return;
    }
    setEducationInquiryWebsite('');
    setEducationInquiryStartedAt(Date.now());
    setEducationInquiryTurnstileToken('');
    setEducationInquiryTurnstileError('');
    setEducationInquiryTurnstileResetSignal((value) => value + 1);
  }, [effectiveLoginPersona, open]);

  const loginEyebrow = ROLE_ROOM_LANDING_CONFIG.login.eyebrowText;
  const loginTitle = ROLE_ROOM_LANDING_CONFIG.login.title;
  const loginSubtitle = ROLE_ROOM_LANDING_CONFIG.login.subtitle;
  const educationTurnstileSiteKey = getRoleRoomTurnstileSiteKey();
  const educationTurnstileEnabled = Boolean(educationTurnstileSiteKey);
  // Dans-personaen hopper over hele commercial-setup-flyten (org-oppslag,
  // Stripe, team-onboarding) inntil intervjuene avgjør pricing-modellen.
  // Brukeren lander rett i DanceWorkspace etter standard e-post-/Google-
  // innlogging.
  const requiresCommercialSetup =
    isLandingPage
    && !clientPortalIntent
    && !talentPortalIntent
    && loginPersona !== 'dance_studio';
  const isStepwiseContentProducerFlow = Boolean(
    isLandingPage
    && requiresCommercialSetup
    && effectiveLoginPersona === 'content_producer'
    && !clientPortalIntent,
  );
  const isStepwiseProductionTeamFlow = Boolean(
    isLandingPage
    && requiresCommercialSetup
    && effectiveLoginPersona === 'production_team',
  );
  const isStepwiseCommercialFlow = isStepwiseContentProducerFlow || isStepwiseProductionTeamFlow;
  const useCompactMobileHeader = isMobile && isLandingPage;
  const isProductionTeamFlow = effectiveLoginPersona === 'production_team';
  const isEducationInstitutionFlow = effectiveLoginPersona === 'education_institution';
  const isAdminRoleSelection = selectedRole === 'admin';
  const allowedRoleIds = effectiveLoginPersona === 'content_producer'
    ? new Set(clientPortalIntent ? ['client'] : CONTENT_TEAM_ROLE_IDS)
    : effectiveLoginPersona === 'production_team'
      ? new Set(
          talentPortalIntent && !clientPortalIntent
            ? [...PRODUCTION_TEAM_ROLE_IDS, 'talent']
            : PRODUCTION_TEAM_ROLE_IDS,
        )
      : effectiveLoginPersona === 'dance_studio'
        ? new Set<string>(DANCE_STUDIO_ROLE_IDS)
        : null;
  const visibleProfessionCategories = allowedRoleIds
    ? (
      isStepwiseContentProducerFlow
        ? contentProducerCategories
        : isStepwiseProductionTeamFlow
          ? productionTeamCategories
          : effectiveLoginPersona === 'dance_studio'
            ? danceStudioCategories
            : professionCategories
    )
        .map((category) => ({
          ...category,
          roleIds: category.roleIds.filter((id) => allowedRoleIds.has(id)),
        }))
        .filter((category) => category.roleIds.length > 0)
    : professionCategories;
  const minimumSeatCount = getMinimumSeatCount(effectiveLoginPersona);
  const seatPrice = getSeatPrice(effectiveLoginPersona);
  const billableSeatCount = Math.max(
    minimumSeatCount,
    productionTeamMembers.length,
  );
  const planMonthlyTotal = billableSeatCount * seatPrice;
  const teamVisualMembers = productionTeamMembers.filter((member) => member.roleId);
  const shouldShowSetupFlow = !isLandingPage || Boolean(effectiveLoginPersona);
  const normalizedOrganizationNumber = normalizeOrganizationNumber(organizationNumber);
  const hasVerifiedOrganization = !requiresCommercialSetup || Boolean(
    normalizedOrganizationNumber.length === 9
    && organizationValidatedNumber === normalizedOrganizationNumber
    && organizationCompanyName.trim(),
  );
  const teamOwner = productionTeamMembers[0] ?? createBlankTeamMember();
  const teamOwnerLabel = isProductionTeamFlow
    ? 'dlgLogin.teamLeadLabel'
    : isEducationInstitutionFlow
      ? 'dlgLogin.institutionContactLabel'
      : 'dlgLogin.accountOwnerLabel';
  const buildCommercialSetupPayload = useCallback((
    persona: Exclude<LoginPersona, '' | 'education_institution'>,
  ) => {
    const normalizedMembers = productionTeamMembers
      .map((member, index) => {
        const roleLabel = tr(allRoles.find((entry) => entry.id === member.roleId)?.label) || member.roleId;
        return {
          name: member.name.trim(),
          email: member.email.trim().toLowerCase(),
          roleId: member.roleId,
          roleLabel,
          isLeader: index === 0,
        };
      })
      .filter((member) => member.name && member.email && member.roleId);

    const plan = getCommercialSubscriptionPlan(persona);
    return {
      persona,
      organizationNumber: normalizedOrganizationNumber,
      companyName: organizationCompanyName.trim(),
      selectedRole,
      planId: plan.planId,
      planName: plan.planName,
      monthlyTotalExVat: planMonthlyTotal,
      teamMembers: normalizedMembers,
    };
  }, [
    normalizedOrganizationNumber,
    organizationCompanyName,
    planMonthlyTotal,
    productionTeamMembers,
    selectedRole,
  ]);
  const isTeamOwnerConfigured = Boolean(
    teamOwner.name.trim() && teamOwner.email.trim() && teamOwner.roleId,
  );
  const isCommercialSetupComplete = !requiresCommercialSetup || (
    hasVerifiedOrganization
    && Boolean(selectedRole)
    && (
      isEducationInstitutionFlow
        ? Boolean(
            teamOwner.name.trim()
            && teamOwner.email.trim()
            && educationContactRole.trim()
            && educationInstitutionType
            && educationProgramName.trim()
            && educationStudentSeatRange
            && educationStaffSeatRange
            && educationDesiredStartWindow
            && educationUseCase.trim()
          )
        : (
            productionTeamMembers.length >= minimumSeatCount
            && productionTeamMembers.every(isTeamMemberComplete)
          )
    )
  );
  const isCommercialPaymentRequired = Boolean(
    requiresCommercialSetup
    && effectiveLoginPersona
    && effectiveLoginPersona !== 'education_institution'
    && !isAdminRoleSelection,
  );
  const commercialSetupSignature = (
    isCommercialPaymentRequired
    && effectiveLoginPersona
    && effectiveLoginPersona !== 'education_institution'
  )
    ? JSON.stringify(buildCommercialSetupPayload(effectiveLoginPersona))
    : '';
  const isCommercialPaymentSatisfied = !isCommercialPaymentRequired || (
    paidCommercialSetupSignature.length > 0
    && paidCommercialSetupSignature === commercialSetupSignature
  );
  const shouldShowCommercialDetails = !requiresCommercialSetup || hasVerifiedOrganization;
  const shouldShowCommercialPaymentGate = shouldShowSetupFlow && (
    isCommercialPaymentRequired
    && isCommercialSetupComplete
    && (
      !isStepwiseCommercialFlow
      || (
        isStepwiseContentProducerFlow
          ? contentProducerStep === 'auth'
          : productionTeamStep === 'auth'
      )
    )
  );
  const shouldShowAuthFields = shouldShowSetupFlow && (
    !isEducationInstitutionFlow
    && (!requiresCommercialSetup || isCommercialSetupComplete)
    && isCommercialPaymentSatisfied
    && (
      !isStepwiseCommercialFlow
      || (
        isStepwiseContentProducerFlow
          ? contentProducerStep === 'auth'
          : productionTeamStep === 'auth'
      )
    )
  );
  /* parse "roleId|Description" lines — fall back to compiled defaults */
  const activeUseCases: { roleId: string; line: string }[] = (() => {
    if (effectiveLoginPersona === 'content_producer') {
      return CONTENT_PRODUCER_USE_CASES;
    }
    return USE_CASES;
  })();

  /* ── accent colour from selected role ── */
  const { r: aR = 130, g: aG = 110, b: aB = 255 } =
    (selectedRole && ROLE_COLOURS[selectedRole]) || {};

  const shouldShowRoleRoomStats = Boolean(
    roleRoomPublicStats
    && Number.isFinite(roleRoomPublicStats.produksjoner)
    && roleRoomPublicStats.produksjoner >= 100,
  );

  /* ── stats: only show after real traction ── */
  const activeStats: { value: string; label: string }[] = (() => {
    if (!shouldShowRoleRoomStats || !roleRoomPublicStats) {
      return [];
    }
    // Bygg stats fra alle tilgjengelige metrics — viser kun de
    // med faktisk verdi (>0) så vi unngår "0 kandidater"-pinligheter.
    const allStats: { value: number | undefined; label: string }[] = [
      { value: roleRoomPublicStats.kreative, label: 'dlgLogin.stat.kreative' },
      { value: roleRoomPublicStats.produksjoner, label: 'dlgLogin.stat.produksjoner' },
      { value: roleRoomPublicStats.rollerBesatt, label: 'dlgLogin.stat.rollerBesatt' },
      { value: roleRoomPublicStats.kandidater, label: 'dlgLogin.stat.kandidater' },
      { value: roleRoomPublicStats.auditioner, label: 'dlgLogin.stat.auditioner' },
      { value: roleRoomPublicStats.crew, label: 'dlgLogin.stat.crew' },
      { value: roleRoomPublicStats.lokasjoner, label: 'dlgLogin.stat.lokasjoner' },
    ];
    return allStats
      .filter((s) => Number.isFinite(s.value) && (s.value as number) > 0)
      .slice(0, 4)
      .map((s) => ({ value: formatRoleRoomStatValue(s.value as number), label: s.label }));
  })();

  /* ── testimonials from visual editor or defaults ── */
  const activeTestimonials = (() => {
    if (Array.isArray(roleRoomPublicTestimonials) && roleRoomPublicTestimonials.length > 0) {
      return roleRoomPublicTestimonials;
    }
    if (effectiveLoginPersona === 'content_producer') {
      return CONTENT_PRODUCER_TESTIMONIALS;
    }
    return DEFAULT_TESTIMONIALS;
  })();
  const activeUseCase = activeUseCases[ucIdx] ?? activeUseCases[0] ?? null;

  /* ── per-role testimonial + badge animation on role change ── */
  useEffect(() => {
    if (!selectedRole) return;
    hasSeenHint.current = true;
    const idx = activeTestimonials.findIndex(t => t.roleId === selectedRole);
    if (idx !== -1) {
      setTestimonialVisible(false);
      setTimeout(() => { setTestimonialIdx(idx); setTestimonialVisible(true); }, 300);
    }
    setBadgeKey(k => k + 1);
  }, [selectedRole]);

  /* ── cycle testimonials every 6 s when no role selected ── */
  useEffect(() => {
    if (!isLandingPage || selectedRole) return;
    const timer = setInterval(() => {
      setTestimonialVisible(false);
      setTimeout(() => {
        setTestimonialIdx(i => (i + 1) % activeTestimonials.length);
        setTestimonialVisible(true);
      }, 300);
    }, 6000);
    return () => clearInterval(timer);
  }, [isLandingPage, selectedRole]);

  /* ── CTA button label ── */
  const ctaButtonLabel = ROLE_ROOM_LANDING_CONFIG.login.ctaButtonLabel;
  // Keep the guest bypass visible when demo mode is enabled, but never use the
  // tokenless "local login" path on real hosted Role Room environments.
  const demoModeEnabled = ROLE_ROOM_LANDING_CONFIG.demoModeEnabled;
  const shouldUseStandaloneDemoAuth =
    demoModeEnabled &&
    isRoleRoomStandaloneRuntime() &&
    typeof window !== 'undefined' &&
    (
      import.meta.env.DEV ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );

  /* cycle use-case scenarios every 3.5 s */
  useEffect(() => {
    if (!isLandingPage) return;
    const timer = setInterval(() => {
      setUcVisible(false);
      setTimeout(() => {
        setUcIdx(i => (i + 1) % activeUseCases.length);
        setUcVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(timer);
  }, [isLandingPage]);

  /* reset on close */
  useEffect(() => {
    if (!open) {
      orgLookupAbortRef.current?.abort();
      const t = setTimeout(() => {
        resetRoleRoomPersonaSelection({ clearAuthFields: true });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, resetRoleRoomPersonaSelection]);

  useEffect(() => {
    if (!loginPersona) {
      return;
    }

    const minimumSeats = getMinimumSeatCount(loginPersona);
    setProductionTeamMembers((current) => (
      current.length >= minimumSeats
        ? current
        : [
            ...current,
            ...Array.from(
              { length: minimumSeats - current.length },
              () => createBlankTeamMember(),
            ),
          ]
    ));
  }, [loginPersona]);

  useEffect(() => {
    if (!isStepwiseContentProducerFlow) {
      return;
    }
    if (!hasVerifiedOrganization && contentProducerStep !== 'company') {
      setContentProducerStep('company');
      return;
    }
    if (!selectedRole && (contentProducerStep === 'team' || contentProducerStep === 'auth')) {
      setContentProducerStep('role');
      return;
    }
    if (!isCommercialSetupComplete && contentProducerStep === 'auth') {
      setContentProducerStep('team');
    }
  }, [
    contentProducerStep,
    hasVerifiedOrganization,
    isCommercialSetupComplete,
    isStepwiseContentProducerFlow,
    selectedRole,
  ]);

  useEffect(() => {
    if (!isStepwiseProductionTeamFlow) {
      return;
    }
    if (!hasVerifiedOrganization && productionTeamStep !== 'company') {
      setProductionTeamStep('company');
      return;
    }
    if (!selectedRole && (productionTeamStep === 'team' || productionTeamStep === 'auth')) {
      setProductionTeamStep('role');
      return;
    }
    if (!isCommercialSetupComplete && productionTeamStep === 'auth') {
      setProductionTeamStep('team');
    }
  }, [
    hasVerifiedOrganization,
    isCommercialSetupComplete,
    isStepwiseProductionTeamFlow,
    productionTeamStep,
    selectedRole,
  ]);

  useEffect(() => {
    if (testimonialIdx < activeTestimonials.length) {
      return;
    }
    setTestimonialIdx(0);
  }, [activeTestimonials.length, testimonialIdx]);

  useEffect(() => {
    if (activeUseCases.length === 0) {
      return;
    }
    if (ucIdx >= activeUseCases.length) {
      setUcIdx(0);
    }
  }, [activeUseCases.length, ucIdx]);

  useEffect(() => {
    if (!open || !isStepwiseCommercialFlow) {
      return;
    }
    resetCommercialPanelScroll();
  }, [contentProducerStep, isStepwiseCommercialFlow, open, productionTeamStep, resetCommercialPanelScroll]);

  useEffect(() => {
    if (!open || !isLandingPage) {
      return;
    }

    let disposed = false;

    const fetchStats = async () => {
      try {
        const response = await fetch(ROLE_ROOM_PUBLIC_STATS_ENDPOINT);
        if (!response.ok) {
          throw new Error(`Role Room stats request failed with ${response.status}`);
        }
        const data = (await response.json()) as Partial<RoleRoomPublicStats>;
        if (disposed) {
          return;
        }
        setRoleRoomPublicStats({
          kreative: Number.isFinite(data.kreative) ? Number(data.kreative) : 0,
          produksjoner: Number.isFinite(data.produksjoner) ? Number(data.produksjoner) : 0,
          rollerBesatt: Number.isFinite(data.rollerBesatt) ? Number(data.rollerBesatt) : 0,
          kandidater: Number.isFinite(data.kandidater) ? Number(data.kandidater) : undefined,
          auditioner: Number.isFinite(data.auditioner) ? Number(data.auditioner) : undefined,
          crew: Number.isFinite(data.crew) ? Number(data.crew) : undefined,
          lokasjoner: Number.isFinite(data.lokasjoner) ? Number(data.lokasjoner) : undefined,
        });
      } catch (statsError) {
        if (!disposed) {
          console.debug('Role Room login stats fallback:', statsError);
        }
      }
    };

    void fetchStats();
    const intervalId = window.setInterval(() => {
      void fetchStats();
    }, ROLE_ROOM_STATS_REFRESH_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [isLandingPage, open]);

  useEffect(() => {
    if (!open || !isLandingPage) {
      return;
    }

    let disposed = false;

    const fetchTestimonials = async () => {
      try {
        const response = await fetch(ROLE_ROOM_PUBLIC_TESTIMONIALS_ENDPOINT);
        if (!response.ok) {
          throw new Error(`Role Room testimonials request failed with ${response.status}`);
        }
        const data = (await response.json()) as RoleRoomPublicTestimonial[];
        if (disposed || !Array.isArray(data)) {
          return;
        }

        const normalized = data
          .filter((entry) =>
            entry
            && typeof entry.quote === 'string'
            && typeof entry.author === 'string'
            && typeof entry.title === 'string'
            && typeof entry.roleId === 'string',
          )
          .map((entry, index) => ({
            id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : `testimonial-${index}`,
            roleId: entry.roleId.trim().toLowerCase(),
            quote: entry.quote.trim(),
            author: entry.author.trim(),
            title: entry.title.trim(),
          }))
          .filter((entry) => entry.quote && entry.author && entry.title && entry.roleId);

        setRoleRoomPublicTestimonials(normalized.length > 0 ? normalized : null);
      } catch (testimonialError) {
        if (!disposed) {
          console.debug('Role Room login testimonials fallback:', testimonialError);
        }
      }
    };

    void fetchTestimonials();
    const intervalId = window.setInterval(() => {
      void fetchTestimonials();
    }, ROLE_ROOM_TESTIMONIALS_REFRESH_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [isLandingPage, open]);

  useEffect(() => {
    if (!open || !clientPortalIntent) {
      return;
    }
    setLoginPersona('content_producer');
    setSelectedRole('client');
  }, [clientPortalIntent, open]);

  useEffect(() => {
    if (!open || !talentPortalIntent || clientPortalIntent) {
      return;
    }
    setLoginPersona('production_team');
    setSelectedRole('talent');
  }, [clientPortalIntent, open, talentPortalIntent]);

  useEffect(() => {
    if (!open || !initialPersona || clientPortalIntent || talentPortalIntent) {
      return;
    }
    setLoginPersona(initialPersona);
    setSelectedRole(getDefaultRoleForPersona(initialPersona));
  }, [clientPortalIntent, initialPersona, open, talentPortalIntent]);

  useEffect(() => {
    if (!open || !requiresCommercialSetup || clientPortalIntent || talentPortalIntent) {
      return;
    }
    if (restoredCommercialDraftRef.current) {
      return;
    }

    restoredCommercialDraftRef.current = true;
    const draft = readRoleRoomCommercialDraft();
    if (!draft) {
      return;
    }

    setLoginPersona(draft.loginPersona);
    setSelectedRole(draft.selectedRole);
    setEmail(draft.email);
    setOrganizationNumber(draft.organizationNumber);
    setOrganizationCompanyName(draft.organizationCompanyName);
    setOrganizationValidatedNumber(draft.organizationValidatedNumber);
    setPaidCommercialSetupSignature(draft.paidCommercialSetupSignature);
    setContentProducerStep(draft.contentProducerStep);
    setProductionTeamStep(draft.productionTeamStep);
    setProductionTeamMembers(
      draft.productionTeamMembers.length > 0
        ? draft.productionTeamMembers
        : createInitialTeamMembers(),
    );
  }, [clientPortalIntent, open, requiresCommercialSetup, talentPortalIntent]);

  useEffect(() => {
    if (loginPersona === 'content_producer') {
      if (!selectedRole) {
        if (!isStepwiseContentProducerFlow) {
          setSelectedRole(getDefaultRoleForPersona('content_producer', { clientPortalIntent: Boolean(clientPortalIntent) }));
        }
        return;
      }
      if (!CONTENT_PRODUCER_ROLE_IDS.has(selectedRole)) {
        setSelectedRole(getDefaultRoleForPersona('content_producer', { clientPortalIntent: Boolean(clientPortalIntent) }));
      }
      return;
    }

    if (loginPersona === 'production_team') {
      if (!selectedRole) {
        setSelectedRole(getDefaultRoleForPersona('production_team', {
          clientPortalIntent: Boolean(clientPortalIntent),
          talentPortalIntent: Boolean(talentPortalIntent),
        }));
        return;
      }
      if (
        CONTENT_PRODUCER_ROLE_IDS.has(selectedRole)
        && selectedRole !== 'talent'
      ) {
        setSelectedRole(getDefaultRoleForPersona('production_team', {
          clientPortalIntent: Boolean(clientPortalIntent),
          talentPortalIntent: Boolean(talentPortalIntent),
        }));
      }
      return;
    }

    if (loginPersona === 'education_institution') {
      if (selectedRole !== 'education_institution') {
        setSelectedRole('education_institution');
      }
      return;
    }

    if (!isLandingPage && (selectedRole === 'film_photographer' || selectedRole === 'client')) {
      setSelectedRole('');
    }
  }, [clientPortalIntent, isLandingPage, isStepwiseContentProducerFlow, loginPersona, selectedRole, talentPortalIntent]);

  useEffect(() => {
    if (!isLandingPage || !selectedRole || loginPersona) {
      return;
    }

    const derivedPersona = deriveLoginPersonaForRole(selectedRole);
    if (derivedPersona) {
      setLoginPersona(derivedPersona);
    }
  }, [isLandingPage, loginPersona, selectedRole]);

  useEffect(() => {
    if (!selectedRole) {
      return;
    }

    setProductionTeamMembers((current) => {
      const next = current.length > 0 ? [...current] : [createBlankTeamMember()];
      if (next[0]?.roleId === selectedRole) {
        return current;
      }
      next[0] = {
        ...next[0],
        roleId: selectedRole,
      };
      return next;
    });
  }, [selectedRole]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!requiresCommercialSetup) {
      clearRoleRoomCommercialDraft();
      return;
    }

    if (!loginPersona && !selectedRole && !organizationNumber.trim()) {
      clearRoleRoomCommercialDraft();
      return;
    }

    writeRoleRoomCommercialDraft({
      loginPersona,
      selectedRole,
      email,
      organizationNumber,
      organizationCompanyName,
      organizationValidatedNumber,
      paidCommercialSetupSignature,
      contentProducerStep,
      productionTeamStep,
      productionTeamMembers,
    });
  }, [
    contentProducerStep,
    email,
    loginPersona,
    open,
    organizationCompanyName,
    organizationNumber,
    organizationValidatedNumber,
    paidCommercialSetupSignature,
    productionTeamMembers,
    productionTeamStep,
    requiresCommercialSetup,
    selectedRole,
  ]);

  useEffect(() => {
    if (
      paidCommercialSetupSignature
      && commercialSetupSignature
      && paidCommercialSetupSignature !== commercialSetupSignature
    ) {
      setCommercialPaymentNotice(null);
    }
  }, [commercialSetupSignature, paidCommercialSetupSignature]);

  useEffect(() => {
    if (!open || !requiresCommercialSetup || !effectiveLoginPersona) {
      return;
    }

    if (normalizedOrganizationNumber.length === 0) {
      setOrganizationCompanyName('');
      setOrganizationLookupError('');
      setOrganizationLookupLoading(false);
      setOrganizationValidatedNumber('');
      orgLookupAbortRef.current?.abort();
      return;
    }

    if (normalizedOrganizationNumber.length < 9) {
      setOrganizationCompanyName('');
      setOrganizationLookupError('Oppgi et gyldig organisasjonsnummer med 9 siffer');
      setOrganizationLookupLoading(false);
      setOrganizationValidatedNumber('');
      orgLookupAbortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      orgLookupAbortRef.current?.abort();
      orgLookupAbortRef.current = controller;
      setOrganizationLookupLoading(true);
      setOrganizationLookupError('');

      try {
        const response = await fetch(
          `/api/external-data/proff/company/${normalizedOrganizationNumber}`,
          { signal: controller.signal },
        );
        const payload = await response.json() as RoleRoomCompanyScreeningResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || t('dlgLogin.err.verifyCompanyFailed'));
        }

        const companyName = payload.data?.companyName?.trim();
        const isVerified = Boolean(payload.data?.brregVerified && companyName);

        if (!isVerified || !companyName) {
          throw new Error(t('dlgLogin.err.companyNotFound'));
        }

        setOrganizationCompanyName(companyName);
        setOrganizationValidatedNumber(normalizedOrganizationNumber);
        setOrganizationLookupError('');
      } catch (lookupError) {
        if (controller.signal.aborted) {
          return;
        }
        setOrganizationCompanyName('');
        setOrganizationValidatedNumber('');
        setOrganizationLookupError(
          lookupError instanceof Error
            ? lookupError.message
            : t('dlgLogin.err.verifyOrgFailed'),
        );
      } finally {
        if (!controller.signal.aborted) {
          setOrganizationLookupLoading(false);
        }
      }
    }, BRREG_LOOKUP_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    effectiveLoginPersona,
    normalizedOrganizationNumber,
    open,
    requiresCommercialSetup,
  ]);

  const validateCommercialSetup = useCallback((persona: LoginPersona): boolean => {
    if (!requiresCommercialSetup) {
      return true;
    }
    if (!persona) {
      setError(t('dlgLogin.err.choosePersona'));
      return false;
    }
    if (!hasVerifiedOrganization) {
      setError(t('dlgLogin.err.verifyOrgFirst'));
      return false;
    }
    if (!selectedRole) {
      setError(t('dlgLogin.err.chooseLeadRole'));
      return false;
    }
    if (persona === 'education_institution') {
      if (!teamOwner.name.trim() || !teamOwner.email.trim()) {
        setError(t('dlgLogin.err.fillInstitutionContact'));
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teamOwner.email.trim())) {
        setError(t('dlgLogin.err.contactEmail'));
        return false;
      }
      if (
        !educationContactRole.trim()
        || !educationInstitutionType
        || !educationProgramName.trim()
        || !educationStudentSeatRange
        || !educationStaffSeatRange
        || !educationDesiredStartWindow
        || !educationUseCase.trim()
      ) {
        setError(t('dlgLogin.err.completeInstitution'));
        return false;
      }
      return true;
    }
    if (productionTeamMembers.length < minimumSeatCount) {
      setError(
        persona === 'production_team'
          ? t('dlgLogin.err.minTeam', { n: PRODUCTION_TEAM_MIN_MEMBERS })
          : t('dlgLogin.err.minCpTeam'),
      );
      return false;
    }
    const incompleteMember = productionTeamMembers.find((member) => !isTeamMemberComplete(member));
    if (incompleteMember) {
      setError(t('dlgLogin.err.fillAllMembers'));
      return false;
    }
    const invalidEmailMember = productionTeamMembers.find((member) => (
      member.email.trim()
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email.trim())
    ));
    if (invalidEmailMember) {
      setError(t('dlgLogin.err.allValidEmails'));
      return false;
    }
    return true;
  }, [
    educationContactRole,
    educationDesiredStartWindow,
    educationInstitutionType,
    educationProgramName,
    educationStaffSeatRange,
    educationStudentSeatRange,
    educationUseCase,
    hasVerifiedOrganization,
    minimumSeatCount,
    productionTeamMembers,
    requiresCommercialSetup,
    selectedRole,
    teamOwner.email,
    teamOwner.name,
  ]);

  const persistCommercialSetup = useCallback(async (
    persona: Exclude<LoginPersona, '' | 'education_institution'>,
  ) => {
    if (!requiresCommercialSetup) {
      return null;
    }

    const payload = buildCommercialSetupPayload(persona);
    const signature = JSON.stringify(payload);
    if (persistedCommercialSetupRef.current === signature) {
      return null;
    }

    const response = await fetch('/api/role-room/commercial-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as RoleRoomCommercialAccessResponse;

    if (!response.ok || !result.success) {
      throw new Error(result.error || t('dlgLogin.err.saveSetupFailed'));
    }

    persistedCommercialSetupRef.current = signature;
    if (result.paymentCompleted) {
      setPaidCommercialSetupSignature(signature);
    }
    return result;
  }, [
    buildCommercialSetupPayload,
    requiresCommercialSetup,
  ]);

  const markCommercialPaymentComplete = useCallback((
    signature: string,
    options?: {
      message?: string;
      severity?: CommercialPaymentNotice['severity'];
    },
  ) => {
    setPaidCommercialSetupSignature(signature);
    setCommercialPaymentNotice({
      severity: options?.severity || 'success',
      message:
        options?.message ||
        t('dlgLogin.notice.paymentRegisteredContinue'),
    });
  }, []);

  const handleCommercialCheckout = useCallback(async () => {
    if (commercialPaymentPending || loading) {
      return;
    }

    const persona = effectiveLoginPersona;
    if (!persona || persona === 'education_institution') {
      setError(t('dlgLogin.err.choosePersonaBeforePayment'));
      return;
    }
    if (!validateCommercialSetup(persona)) {
      return;
    }

    setCommercialPaymentPending(true);
    setCommercialPaymentNotice(null);
    setError('');

    try {
      writeRoleRoomCommercialDraft({
        loginPersona,
        selectedRole,
        email,
        organizationNumber,
        organizationCompanyName,
        organizationValidatedNumber,
        paidCommercialSetupSignature,
        contentProducerStep,
        productionTeamStep,
        productionTeamMembers,
      });

      const persisted = await persistCommercialSetup(persona);
      if (persisted?.paymentCompleted) {
        markCommercialPaymentComplete(commercialSetupSignature, {
          message: t('dlgLogin.notice.paymentAlreadyShort'),
        });
        return;
      }

      const payload = buildCommercialSetupPayload(persona);
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const returnPath = typeof window !== 'undefined'
        ? getRoleRoomReturnPath(window.location)
        : '/';

      const response = await fetch(ROLE_ROOM_COMMERCIAL_CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          browserOrigin,
          returnPath,
        }),
      });
      const result = await response.json() as RoleRoomCommercialCheckoutResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || t('dlgLogin.err.startStripeFailed'));
      }

      if (result.alreadyPaid || result.paymentCompleted) {
        markCommercialPaymentComplete(commercialSetupSignature, {
          message: t('dlgLogin.notice.paymentAlready'),
        });
        return;
      }

      if (!result.checkoutUrl) {
        throw new Error(t('dlgLogin.err.missingCheckoutUrl'));
      }

      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : t('dlgLogin.err.startStripeFailed'),
      );
    } finally {
      setCommercialPaymentPending(false);
    }
  }, [
    buildCommercialSetupPayload,
    commercialPaymentPending,
    commercialSetupSignature,
    contentProducerStep,
    effectiveLoginPersona,
    email,
    loading,
    markCommercialPaymentComplete,
    organizationCompanyName,
    organizationNumber,
    organizationValidatedNumber,
    paidCommercialSetupSignature,
    persistCommercialSetup,
    productionTeamMembers,
    productionTeamStep,
    selectedRole,
    validateCommercialSetup,
  ]);

  const handleEducationInquirySubmit = useCallback(async () => {
    if (loading) return;

    if (!validateCommercialSetup('education_institution')) {
      return;
    }

    if (educationTurnstileEnabled && !educationInquiryTurnstileToken) {
      const message = educationInquiryTurnstileError
        || t('dlgLogin.err.confirmHuman');
      setEducationInquiryTurnstileError(message);
      setError(message);
      return;
    }

    setLoading(true);
    setError('');
    setEducationInquiryTurnstileError('');

    try {
      const response = await fetch(ROLE_ROOM_EDUCATION_INQUIRY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationNumber: normalizedOrganizationNumber,
          companyName: organizationCompanyName.trim(),
          contactName: teamOwner.name.trim(),
          contactEmail: teamOwner.email.trim(),
          contactRole: educationContactRole.trim(),
          institutionType: educationInstitutionType,
          programName: educationProgramName.trim(),
          studentSeatRange: educationStudentSeatRange,
          staffSeatRange: educationStaffSeatRange,
          desiredStartWindow: educationDesiredStartWindow,
          useCase: educationUseCase.trim(),
          startedAt: new Date(educationInquiryStartedAt).toISOString(),
          website: educationInquiryWebsite.trim(),
          turnstileToken: educationInquiryTurnstileToken,
        }),
      });
      const result = await response.json() as RoleRoomEducationInquiryResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || t('dlgLogin.err.sendInstitutionFailed'));
      }

      setEducationInquirySubmitted({
        requestId: result.requestId ?? null,
        notificationEmailSent: Boolean(result.notificationEmailSent),
        message:
          result.message ||
          t('dlgLogin.notice.requestReceived'),
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('dlgLogin.err.sendInstitutionFailed'),
      );
    } finally {
      if (educationTurnstileEnabled) {
        setEducationInquiryTurnstileToken('');
        setEducationInquiryTurnstileResetSignal((value) => value + 1);
      }
      setLoading(false);
    }
  }, [
    educationContactRole,
    educationDesiredStartWindow,
    educationInstitutionType,
    educationInquiryStartedAt,
    educationInquiryTurnstileError,
    educationInquiryTurnstileToken,
    educationInquiryWebsite,
    educationProgramName,
    educationStaffSeatRange,
    educationStudentSeatRange,
    educationTurnstileEnabled,
    educationUseCase,
    loading,
    normalizedOrganizationNumber,
    organizationCompanyName,
    teamOwner.email,
    teamOwner.name,
    validateCommercialSetup,
  ]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }

    const activationStatus = new URL(window.location.href).searchParams.get('rrActivation');
    const activationMessage = new URL(window.location.href).searchParams.get('rrActivationMessage');
    if (!activationStatus) {
      return;
    }

    if (activationStatus === 'success') {
      setCommercialPaymentNotice({
        severity: 'success',
        message: activationMessage || t('dlgLogin.notice.accountApproved'),
      });
      setError('');
    } else {
      setError(activationMessage || t('dlgLogin.err.accountApproveFailed'));
    }

    clearCommercialActivationParams();
  }, [clearCommercialActivationParams, open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const checkoutStatus = url.searchParams.get('rrCheckout');
    const sessionId = url.searchParams.get('session_id');

    if (checkoutStatus === 'cancel') {
      if (handledCheckoutSessionRef.current === 'cancel') {
        return;
      }
      handledCheckoutSessionRef.current = 'cancel';
      setCommercialPaymentNotice({
        severity: 'warning',
        message: t('dlgLogin.notice.paymentCanceled'),
      });
      clearCommercialCheckoutParams();
      return;
    }

    if (
      checkoutStatus !== 'success'
      || !sessionId
      || !commercialSetupSignature
      || handledCheckoutSessionRef.current === sessionId
    ) {
      return;
    }

    handledCheckoutSessionRef.current = sessionId;
    setCommercialPaymentPending(true);
    setCommercialPaymentNotice(null);
    setError('');

    void (async () => {
      try {
        const response = await fetch(
          `${ROLE_ROOM_COMMERCIAL_SESSION_STATUS_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`,
        );
        const result = await response.json() as RoleRoomCommercialSessionStatusResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.error || t('dlgLogin.err.verifyStripeFailed'));
        }

        if (!result.paymentCompleted) {
          setCommercialPaymentNotice({
            severity: 'info',
            message: t('dlgLogin.notice.stripeProcessing'),
          });
          return;
        }

        if (effectiveLoginPersona === 'content_producer') {
          setContentProducerStep('auth');
        }
        if (effectiveLoginPersona === 'production_team') {
          setProductionTeamStep('auth');
        }

        setCommercialPaymentNotice({
          severity: result.activationRequired ? 'warning' : 'success',
          message: result.activationRequired
            ? t('dlgLogin.notice.paymentRegisteredApprove')
            : t('dlgLogin.notice.paymentRegisteredOpen'),
        });
        markCommercialPaymentComplete(commercialSetupSignature);
      } catch (sessionError) {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : t('dlgLogin.err.verifyStripeFailed'),
        );
      } finally {
        clearCommercialCheckoutParams();
        setCommercialPaymentPending(false);
      }
    })();
  }, [
    clearCommercialCheckoutParams,
    commercialSetupSignature,
    effectiveLoginPersona,
    markCommercialPaymentComplete,
    open,
  ]);

  /* submit */
  const handleLogin = useCallback(async () => {
    if (loading) return;
    const effectiveLoginPersona = getEffectiveLoginPersona(selectedRole, loginPersona);

    if (!email.trim() || !password) {
      setError(t('dlgLogin.err.emailPwRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('dlgLogin.err.invalidEmail'));
      return;
    }
    if (isLandingPage && !selectedRole) {
      setError(t('dlgLogin.err.chooseRole'));
      return;
    }
    // Admin variant (isLandingPage=false) authenticates on pure email +
    // password and skips the commercial gate — admin/super_admin rows
    // in `users` aren't backed by a Stripe invite + onboarding flow,
    // so requiring a persona here blocks legitimate admin logins
    // (including Meta App Review reviewer accounts).
    if (isLandingPage) {
      if (!effectiveLoginPersona) {
        setError(t('dlgLogin.err.choosePersonaLogin'));
        return;
      }
      if (effectiveLoginPersona === 'education_institution') {
        setError(t('dlgLogin.err.educationOnboard'));
        return;
      }
      if (!validateCommercialSetup(effectiveLoginPersona)) {
        return;
      }
      if (isCommercialPaymentRequired && !isCommercialPaymentSatisfied) {
        setError(t('dlgLogin.err.activateBeforeLogin'));
        return;
      }
    }

    setLoading(true);
    setError('');

    if (selectedRole) await authSessionService.setSelectedProfession(selectedRole);

    const completeLocalLogin = async () => {
      await authSessionService.setSessionToken(null);
      const normalizedSessionUserId = email.trim().toLowerCase();
      const mockUser = {
        id: normalizedSessionUserId,
        email: email.trim(),
        role:
          effectiveLoginPersona === 'content_producer'
            ? (selectedRole === 'client' ? 'client_reviewer' : 'content_producer')
            : (selectedRole || 'producer'),
        loginAs: effectiveLoginPersona || undefined,
        requestedRole: selectedRole || null,
        display_name: email.trim().split('@')[0],
      };
      await authSessionService.setAdminUser(mockUser);
      await authSessionService.setCurrentUserId(String(mockUser.id));
      clearRoleRoomCommercialDraft();
      onLoginSuccess(mockUser);
    };

    if (shouldUseStandaloneDemoAuth) {
      try {
        await completeLocalLogin();
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (
        effectiveLoginPersona === 'production_team' ||
        effectiveLoginPersona === 'content_producer' ||
        effectiveLoginPersona === 'dance_studio'
      ) {
        await persistCommercialSetup(effectiveLoginPersona);
      }
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      const request = fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          // Admin variant must NOT send role/loginAs so the backend
          // commercial gate does not trigger for admin/super_admin
          // users that have no Stripe invite.
          role: isLandingPage ? selectedRole : undefined,
          loginAs: isLandingPage ? (effectiveLoginPersona || undefined) : undefined,
        }),
        credentials: 'include',
      }).then((r) => r.json());

      const data: {
        success: boolean;
        token?: string;
        user: {
          id: number | string;
          email: string;
          role: string;
          display_name?: string;
          name?: string;
          loginAs?: string;
          requestedRole?: string | null;
        };
        detail?: string;
        error?: string;
        needs_2fa?: boolean;
        method?: string;
        tempToken?: string;
        message?: string;
      } = await Promise.race([request, timeout]);

      // 2FA-gate: backend ber om kode før session opprettes.
      // Aktiver inline 2FA-prompt — bruker taster inn 6-sifret kode +
      // POST'er til complete-2fa for å fullføre login.
      if (!data.success && data.needs_2fa && data.tempToken) {
        setTwoFactorState({
          tempToken: data.tempToken,
          message: data.message ?? t('dlgLogin.tfa.promptDefault'),
        });
        setLoading(false);
        return;
      }

      if (data.success) {
        const resolvedRole =
          effectiveLoginPersona === 'content_producer'
            ? (selectedRole === 'client' ? 'client_reviewer' : 'content_producer')
            : (data.user.requestedRole?.trim() || data.user.role);
        const normalizedUser = {
          ...data.user,
          role: resolvedRole,
          loginAs: data.user.loginAs || effectiveLoginPersona || undefined,
          requestedRole: data.user.requestedRole ?? selectedRole ?? null,
          display_name:
            data.user.display_name ||
            data.user.name ||
            data.user.email.split('@')[0],
        };
        await authSessionService.setSessionToken(data.token ?? null);
        await authSessionService.setAdminUser(normalizedUser);
        await authSessionService.setCurrentUserId(String(normalizedUser.id));
        clearRoleRoomCommercialDraft();
        onLoginSuccess(normalizedUser);
      } else {
        setError(data.detail ?? data.error ?? t('dlgLogin.err.invalidCredentials'));
      }
    } catch {
      setError(t('dlgLogin.err.loginIncomplete'));
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    email,
    password,
    selectedRole,
    loginPersona,
    isLandingPage,
    onLoginSuccess,
    persistCommercialSetup,
    isCommercialPaymentRequired,
    isCommercialPaymentSatisfied,
    shouldUseStandaloneDemoAuth,
    validateCommercialSetup,
  ]);

  const handleGoogleLogin = useCallback(async () => {
    if (loading) return;
    const effectiveLoginPersona = getEffectiveLoginPersona(selectedRole, loginPersona);
    if (!effectiveLoginPersona) {
      setError(t('dlgLogin.err.choosePersonaLogin'));
      return;
    }
    if (isLandingPage && !selectedRole) {
      setError(t('dlgLogin.err.chooseRole'));
      return;
    }
    if (effectiveLoginPersona === 'education_institution') {
      setError(t('dlgLogin.err.educationOnboard'));
      return;
    }
    if (!validateCommercialSetup(effectiveLoginPersona)) {
      return;
    }
    if (isCommercialPaymentRequired && !isCommercialPaymentSatisfied) {
      setError(t('dlgLogin.err.activateBeforeLogin'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (
        effectiveLoginPersona === 'production_team' ||
        effectiveLoginPersona === 'content_producer' ||
        effectiveLoginPersona === 'dance_studio'
      ) {
        await persistCommercialSetup(effectiveLoginPersona);
      }
      const browserOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const currentPath = typeof window !== 'undefined'
        ? getRoleRoomReturnPath(window.location)
        : getRoleRoomReturnPath(null);
      const response = await googleWorkspaceApi.startOauth({
        mode: 'login',
        loginAs: effectiveLoginPersona,
        requestedRole: selectedRole || null,
        projectId: clientPortalIntent?.projectId,
        returnPath: currentPath,
        browserOrigin,
        email: email.trim() || undefined,
      });

      if (!response.authorizationUrl) {
        throw new Error(t('dlgLogin.err.missingGoogleAuth'));
      }

      window.location.assign(response.authorizationUrl);
    } catch (googleError) {
      setLoading(false);
      setError(googleError instanceof Error ? googleError.message : t('dlgLogin.err.startGoogleFailed'));
    }
  }, [
    loading,
    loginPersona,
    isLandingPage,
    selectedRole,
    clientPortalIntent?.projectId,
    email,
    isCommercialPaymentRequired,
    isCommercialPaymentSatisfied,
    persistCommercialSetup,
    validateCommercialSetup,
  ]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleLogin();
    }
  };

  const updateProductionTeamMember = useCallback((
    index: number,
    field: keyof TeamMemberDraft,
    value: string,
  ) => {
    setProductionTeamMembers((current) => current.map((member, memberIndex) => {
      if (memberIndex !== index) {
        return member;
      }
      return {
        ...member,
        [field]: value,
      };
    }));

    if (index === 0 && field === 'roleId' && value !== selectedRole) {
      setSelectedRole(value);
    }
    if (index === 0 && field === 'email') {
      setEmail(value);
    }
  }, []);

  const addProductionTeamSeat = useCallback(() => {
    setProductionTeamMembers((current) => [...current, createBlankTeamMember()]);
  }, []);

  const removeProductionTeamSeat = useCallback((index: number) => {
    setProductionTeamMembers((current) => {
      if (current.length <= minimumSeatCount) {
        return current;
      }
      return current.filter((_, memberIndex) => memberIndex !== index);
    });
  }, [minimumSeatCount]);

  const contentProducerStepIndex = CONTENT_PRODUCER_ONBOARDING_STEPS.findIndex(
    (step) => step.id === contentProducerStep,
  );
  const contentProducerCurrentStep = CONTENT_PRODUCER_ONBOARDING_STEPS[contentProducerStepIndex]
    || CONTENT_PRODUCER_ONBOARDING_STEPS[0];
  const contentProducerCanAdvance = contentProducerStep === 'company'
    ? hasVerifiedOrganization
    : contentProducerStep === 'role'
      ? Boolean(selectedRole)
      : contentProducerStep === 'team'
        ? isCommercialSetupComplete
        : false;
  const handleContentProducerNextStep = useCallback(() => {
    if (!isStepwiseContentProducerFlow) {
      return;
    }
    if (contentProducerStep === 'company') {
      if (!hasVerifiedOrganization) {
        setError(t('dlgLogin.err.verifyOrgNumber'));
        return;
      }
      setError('');
      setContentProducerStep('role');
      resetCommercialPanelScroll();
      return;
    }
    if (contentProducerStep === 'role') {
      if (!selectedRole) {
        setError(t('dlgLogin.err.chooseMainRole'));
        return;
      }
      setError('');
      setContentProducerStep('team');
      resetCommercialPanelScroll();
      return;
    }
    if (contentProducerStep === 'team') {
      if (!isCommercialSetupComplete) {
        setError(t('dlgLogin.err.fillOwner'));
        return;
      }
      setError('');
      setContentProducerStep('auth');
      resetCommercialPanelScroll();
    }
  }, [
    contentProducerStep,
    hasVerifiedOrganization,
    isCommercialSetupComplete,
    isStepwiseContentProducerFlow,
    resetCommercialPanelScroll,
    selectedRole,
  ]);
  const handleContentProducerPreviousStep = useCallback(() => {
    if (!isStepwiseContentProducerFlow || contentProducerStepIndex <= 0) {
      return;
    }
    setError('');
    setContentProducerStep(CONTENT_PRODUCER_ONBOARDING_STEPS[contentProducerStepIndex - 1].id);
    resetCommercialPanelScroll();
  }, [contentProducerStepIndex, isStepwiseContentProducerFlow, resetCommercialPanelScroll]);
  const productionTeamStepIndex = PRODUCTION_TEAM_ONBOARDING_STEPS.findIndex(
    (step) => step.id === productionTeamStep,
  );
  const productionTeamCurrentStep = PRODUCTION_TEAM_ONBOARDING_STEPS[productionTeamStepIndex]
    || PRODUCTION_TEAM_ONBOARDING_STEPS[0];
  const productionTeamCanAdvance = productionTeamStep === 'company'
    ? hasVerifiedOrganization
    : productionTeamStep === 'role'
      ? Boolean(selectedRole)
      : productionTeamStep === 'team'
        ? isCommercialSetupComplete
        : false;
  const handleProductionTeamNextStep = useCallback(() => {
    if (!isStepwiseProductionTeamFlow) {
      return;
    }
    if (productionTeamStep === 'company') {
      if (!hasVerifiedOrganization) {
        setError(t('dlgLogin.err.verifyOrgNumber'));
        return;
      }
      setError('');
      setProductionTeamStep('role');
      resetCommercialPanelScroll();
      return;
    }
    if (productionTeamStep === 'role') {
      if (!selectedRole) {
        setError(t('dlgLogin.err.chooseLeadTeamRole'));
        return;
      }
      setError('');
      setProductionTeamStep('team');
      resetCommercialPanelScroll();
      return;
    }
    if (productionTeamStep === 'team') {
      if (!isCommercialSetupComplete) {
        setError(t('dlgLogin.err.addMembersBeforeLogin', { n: PRODUCTION_TEAM_MIN_MEMBERS }));
        return;
      }
      setError('');
      setProductionTeamStep('auth');
      resetCommercialPanelScroll();
    }
  }, [
    hasVerifiedOrganization,
    isCommercialSetupComplete,
    isStepwiseProductionTeamFlow,
    productionTeamStep,
    resetCommercialPanelScroll,
    selectedRole,
  ]);
  const handleProductionTeamPreviousStep = useCallback(() => {
    if (!isStepwiseProductionTeamFlow || productionTeamStepIndex <= 0) {
      return;
    }
    setError('');
    setProductionTeamStep(PRODUCTION_TEAM_ONBOARDING_STEPS[productionTeamStepIndex - 1].id);
    resetCommercialPanelScroll();
  }, [isStepwiseProductionTeamFlow, productionTeamStepIndex, resetCommercialPanelScroll]);

  const selectedRoleLabel = tr(allRoles.find((r) => r.id === selectedRole)?.label);
  const effectiveLoginPersonaOption = effectiveLoginPersona
    ? LOGIN_PERSONA_OPTIONS.find((option) => option.id === effectiveLoginPersona) || null
    : null;
  const teamRoleOptions = effectiveLoginPersona === 'content_producer'
    ? (clientPortalIntent ? ['client'] : [...CONTENT_TEAM_ROLE_IDS])
    : effectiveLoginPersona === 'education_institution'
      ? []
      : [...PRODUCTION_TEAM_ROLE_IDS];
  const showPersonaChooserInLeftPanel = false;
  const showPersonaChooserInRightPanel = !(isStepwiseCommercialFlow && isMobile);
  const showContentProducerPersonaSummary =
    isStepwiseContentProducerFlow
    && !isMobile
    && loginPersona === 'content_producer';
  const showProductionTeamPersonaSummary =
    isStepwiseProductionTeamFlow
    && !isMobile
    && loginPersona === 'production_team';
  const showContentProducerAccessChooser = loginPersona === 'content_producer' && Boolean(clientPortalIntent);
  const showContentProducerCompanyStep = !isStepwiseContentProducerFlow || contentProducerStep === 'company';
  const showContentProducerRoleStep = !isStepwiseContentProducerFlow || contentProducerStep === 'role';
  const showContentProducerTeamStep = !isStepwiseContentProducerFlow || contentProducerStep === 'team';
  const showContentProducerAuthSummary = isStepwiseContentProducerFlow && contentProducerStep === 'auth';
  const showProductionTeamCompanyStep = !isStepwiseProductionTeamFlow || productionTeamStep === 'company';
  const showProductionTeamRoleStep = !isStepwiseProductionTeamFlow || productionTeamStep === 'role';
  const showProductionTeamTeamStep = !isStepwiseProductionTeamFlow || productionTeamStep === 'team';
  const showProductionTeamAuthSummary = isStepwiseProductionTeamFlow && productionTeamStep === 'auth';
  const showCommercialCompanyStep = isStepwiseContentProducerFlow
    ? showContentProducerCompanyStep
    : isStepwiseProductionTeamFlow
      ? showProductionTeamCompanyStep
      : true;
  const showCommercialRoleStep = isStepwiseContentProducerFlow
    ? showContentProducerRoleStep
    : isStepwiseProductionTeamFlow
      ? showProductionTeamRoleStep
      : true;
  const showCommercialTeamStep = isStepwiseContentProducerFlow
    ? showContentProducerTeamStep
    : isStepwiseProductionTeamFlow
      ? showProductionTeamTeamStep
      : true;
  const loginPersonaChooser = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {LOGIN_PERSONA_OPTIONS.map((option) => {
          const isSelected = loginPersona === option.id;
          return (
            <Button
              key={option.id}
              type="button"
              onClick={() => {
                setLoginPersona(option.id);
                setContentProducerStep('company');
                setProductionTeamStep('company');
                if (option.id === 'dance_studio') {
                  // Default til studio når personaen velges. Brukeren kan
                  // bytte til frilansdanser i undervalg-raden under.
                  setSelectedProfessionMode('dance_studio');
                  setActiveProfessionMode('dance_studio');
                  setSelectedRole('');
                } else if (option.id === 'content_producer' && !clientPortalIntent) {
                  // Tilbakestill til standard produksjon hvis brukeren
                  // bytter ut av dans-modus midt i flyten.
                  setActiveProfessionMode('production');
                  setSelectedProfessionMode('production');
                  setSelectedRole('');
                } else {
                  setActiveProfessionMode('production');
                  setSelectedProfessionMode('production');
                  setSelectedRole(getDefaultRoleForPersona(option.id, {
                    clientPortalIntent: Boolean(clientPortalIntent),
                    talentPortalIntent: Boolean(talentPortalIntent),
                  }));
                }
              }}
              aria-pressed={isSelected}
              sx={{
                textTransform: 'none',
                borderRadius: '14px',
                py: 1,
                px: 1.25,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                textAlign: 'left',
                border: `1px solid ${
                  isSelected
                    ? `rgba(${aR},${aG},${aB},0.45)`
                    : 'rgba(255,255,255,0.12)'
                }`,
                bgcolor: isSelected
                  ? `rgba(${aR},${aG},${aB},0.16)`
                  : 'rgba(255,255,255,0.05)',
                color: isSelected ? glass.text : 'rgba(235,235,245,0.82)',
                transition: `all 0.25s ${easing}`,
                '&:hover': {
                  bgcolor: isSelected
                    ? `rgba(${aR},${aG},${aB},0.22)`
                    : 'rgba(255,255,255,0.08)',
                  borderColor: isSelected
                    ? `rgba(${aR},${aG},${aB},0.62)`
                    : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography
                  sx={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    letterSpacing: '0.01em',
                  }}
                >
                  {tr(option.label)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    lineHeight: 1.3,
                    maxWidth: 180,
                    color: isSelected
                      ? `rgba(${aR},${aG},${aB},0.95)`
                      : 'rgba(185,185,200,0.7)',
                    transition: 'color 0.25s ease',
                  }}
                >
                  {tr(option.description)}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>

      {loginPersona === 'dance_studio' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.8,
            mt: 0.4,
          }}
        >
          {([
            { mode: 'dance_studio',    label: 'dlgLogin.danceMode.studio.label',          desc: 'dlgLogin.danceMode.studio.desc' },
            { mode: 'dance_freelance', label: 'dlgLogin.danceMode.freelance.label',   desc: 'dlgLogin.danceMode.freelance.desc' },
          ] as const).map((opt) => {
            const active = selectedProfessionMode === opt.mode;
            return (
              <Button
                key={opt.mode}
                type="button"
                onClick={() => {
                  setSelectedProfessionMode(opt.mode);
                  setActiveProfessionMode(opt.mode);
                }}
                aria-pressed={active}
                sx={{
                  textTransform: 'none',
                  borderRadius: '12px',
                  py: 0.7,
                  px: 1,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  border: `1px solid ${active ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.1)'}`,
                  bgcolor: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : 'rgba(235,235,245,0.78)',
                  '&:hover': {
                    bgcolor: active ? 'rgba(139,92,246,0.24)' : 'rgba(255,255,255,0.08)',
                    borderColor: active ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.18)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.2 }}>
                    {tr(opt.label)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: active ? 'rgba(255,255,255,0.85)' : 'rgba(185,185,200,0.65)' }}>
                    {tr(opt.desc)}
                  </Typography>
                </Box>
              </Button>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
  const contentProducerStepNavigation = isStepwiseContentProducerFlow ? (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: { xs: 0.9, sm: 1.25 },
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 0.45, sm: 0.7 },
        }}
      >
        {CONTENT_PRODUCER_ONBOARDING_STEPS.map((step, index) => {
          const isActive = contentProducerStep === step.id;
          const isComplete = index < contentProducerStepIndex;
          return (
            <Box
              key={step.id}
              sx={{
                p: { xs: 0.68, sm: 0.85 },
                borderRadius: '14px',
                border: isActive
                  ? `1px solid rgba(${aR},${aG},${aB},0.4)`
                  : '1px solid rgba(255,255,255,0.08)',
                bgcolor: isActive
                  ? `rgba(${aR},${aG},${aB},0.14)`
                  : isComplete
                    ? 'rgba(80,230,140,0.08)'
                    : 'rgba(255,255,255,0.03)',
              }}
            >
              <Typography sx={{ fontSize: { xs: '0.56rem', sm: '0.62rem' }, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? glass.text : 'rgba(185,185,200,0.62)' }}>
                {`${index + 1}. ${tr(step.label)}`}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.86rem' }, fontWeight: 600, color: 'rgba(245,240,255,0.96)' }}>
          {tr(contentProducerCurrentStep.label)}
        </Typography>
        <Typography sx={{ mt: 0.2, fontSize: { xs: '0.7rem', sm: '0.76rem' }, lineHeight: 1.5, color: 'rgba(205,198,224,0.72)' }}>
          {tr(contentProducerCurrentStep.description)}
        </Typography>
      </Box>
    </Box>
  ) : null;
  const productionTeamStepNavigation = isStepwiseProductionTeamFlow ? (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: { xs: 0.9, sm: 1.25 },
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 0.45, sm: 0.7 },
        }}
      >
        {PRODUCTION_TEAM_ONBOARDING_STEPS.map((step, index) => {
          const isActive = productionTeamStep === step.id;
          const isComplete = index < productionTeamStepIndex;
          return (
            <Box
              key={step.id}
              sx={{
                p: { xs: 0.68, sm: 0.85 },
                borderRadius: '14px',
                border: isActive
                  ? `1px solid rgba(${aR},${aG},${aB},0.4)`
                  : '1px solid rgba(255,255,255,0.08)',
                bgcolor: isActive
                  ? `rgba(${aR},${aG},${aB},0.14)`
                  : isComplete
                    ? 'rgba(80,230,140,0.08)'
                    : 'rgba(255,255,255,0.03)',
              }}
            >
              <Typography sx={{ fontSize: { xs: '0.56rem', sm: '0.62rem' }, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? glass.text : 'rgba(185,185,200,0.62)' }}>
                {`${index + 1}. ${tr(step.label)}`}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.86rem' }, fontWeight: 600, color: 'rgba(245,240,255,0.96)' }}>
          {tr(productionTeamCurrentStep.label)}
        </Typography>
        <Typography sx={{ mt: 0.2, fontSize: { xs: '0.7rem', sm: '0.76rem' }, lineHeight: 1.5, color: 'rgba(205,198,224,0.72)' }}>
          {tr(productionTeamCurrentStep.description)}
        </Typography>
      </Box>
    </Box>
  ) : null;
  const contentProducerAuthSummary = showContentProducerAuthSummary ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
        p: { xs: 1.15, sm: 1.25 },
        borderRadius: '18px',
        bgcolor: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box sx={{ display: 'grid', gap: 0.4 }}>
        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(184,170,226,0.72)' }}>{t('dlgLogin.readyToLogin')}</Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(245,240,255,0.95)' }}>
          {organizationCompanyName || t('dlgLogin.companyNotSet')}
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
          {selectedRoleLabel || t('dlgLogin.roleNotSelected')} · {formatRoleRoomStatValue(planMonthlyTotal)} {t('dlgLogin.krPerMonthExVat')}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 0.35 }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          {t('dlgLogin.accountOwnerLabel')}: {teamOwner.name.trim() || t('dlgLogin.notSet')}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          {t('dlgLogin.emailColon')}: {teamOwner.email.trim() || t('dlgLogin.notSet')}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          {t('dlgLogin.seatsLabel')}: {billableSeatCount}
        </Typography>
      </Box>
    </Box>
  ) : null;
  const productionTeamAuthSummary = showProductionTeamAuthSummary ? (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
        p: { xs: 1.15, sm: 1.25 },
        borderRadius: '18px',
        bgcolor: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box sx={{ display: 'grid', gap: 0.4 }}>
        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(184,170,226,0.72)' }}>{t('dlgLogin.readyToLogin')}</Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(245,240,255,0.95)' }}>
          {organizationCompanyName || t('dlgLogin.companyNotSet')}
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
          {selectedRoleLabel || t('dlgLogin.roleNotSelected')} · {formatRoleRoomStatValue(planMonthlyTotal)} {t('dlgLogin.krPerMonthExVat')}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 0.35 }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          {t('dlgLogin.teamLeadLabel')}: {teamOwner.name.trim() || t('dlgLogin.notSet')}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          {t('dlgLogin.teamLeadRoleLabel')}: {selectedRoleLabel || t('dlgLogin.notSet')}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          {t('dlgLogin.seatsLabel')}: {billableSeatCount}
        </Typography>
      </Box>
    </Box>
  ) : null;
  const contentProducerPersonaSummary = showContentProducerPersonaSummary ? (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.25,
        p: { xs: 1.05, sm: 1.15 },
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
        <Typography
          sx={{
            fontSize: '0.64rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(188,176,222,0.66)',
          }}
        >{t('dlgLogin.planLabel')}</Typography>
        <Typography
          sx={{
            fontSize: '0.92rem',
            fontWeight: 700,
            color: 'rgba(245,240,255,0.96)',
          }}
        >{t('dlgLogin.persona.content_producer.label')}</Typography>
      </Box>
      <Box
        sx={{
          px: 1.1,
          py: 0.55,
          borderRadius: '999px',
          bgcolor: `rgba(${aR},${aG},${aB},0.14)`,
          border: `1px solid rgba(${aR},${aG},${aB},0.26)`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.74rem',
            fontWeight: 600,
            color: `rgba(${aR},${aG},${aB},0.95)`,
            letterSpacing: '0.01em',
          }}
        >
          {selectedRoleLabel || t('dlgLogin.chooseMainFocus')}
        </Typography>
      </Box>
    </Box>
  ) : null;
  const productionTeamPersonaSummary = showProductionTeamPersonaSummary ? (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.25,
        p: { xs: 1.05, sm: 1.15 },
        borderRadius: '16px',
        bgcolor: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
        <Typography
          sx={{
            fontSize: '0.64rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(188,176,222,0.66)',
          }}
        >{t('dlgLogin.planLabel')}</Typography>
        <Typography
          sx={{
            fontSize: '0.92rem',
            fontWeight: 700,
            color: 'rgba(245,240,255,0.96)',
          }}
        >{t('dlgLogin.persona.production_team.label')}</Typography>
      </Box>
      <Box
        sx={{
          px: 1.1,
          py: 0.55,
          borderRadius: '999px',
          bgcolor: `rgba(${aR},${aG},${aB},0.14)`,
          border: `1px solid rgba(${aR},${aG},${aB},0.26)`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.74rem',
            fontWeight: 600,
            color: `rgba(${aR},${aG},${aB},0.95)`,
            letterSpacing: '0.01em',
          }}
        >
          {selectedRoleLabel || t('dlgLogin.chooseTeamLeadRoleShort')}
        </Typography>
      </Box>
    </Box>
  ) : null;
  const contentProducerAccessChooser = showContentProducerAccessChooser ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'rgba(225,218,246,0.95)',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}
      >{t('dlgLogin.accessLabel')}</Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1,
        }}
      >
        {CONTENT_PRODUCER_ACCESS_OPTIONS.map((option) => {
          const isSelected = selectedRole === option.id;
          return (
            <Button
              key={option.id}
              type="button"
              onClick={() => setSelectedRole(option.id)}
              aria-pressed={isSelected}
              sx={{
                textTransform: 'none',
                borderRadius: '14px',
                py: 1,
                px: 1.25,
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                textAlign: 'left',
                border: `1px solid ${
                  isSelected
                    ? `rgba(${aR},${aG},${aB},0.45)`
                    : 'rgba(255,255,255,0.12)'
                }`,
                bgcolor: isSelected
                  ? `rgba(${aR},${aG},${aB},0.16)`
                  : 'rgba(255,255,255,0.05)',
                color: isSelected ? glass.text : 'rgba(235,235,245,0.82)',
                transition: `all 0.25s ${easing}`,
                '&:hover': {
                  bgcolor: isSelected
                    ? `rgba(${aR},${aG},${aB},0.22)`
                    : 'rgba(255,255,255,0.08)',
                  borderColor: isSelected
                    ? `rgba(${aR},${aG},${aB},0.62)`
                    : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography
                  sx={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    letterSpacing: '0.01em',
                  }}
                >
                  {tr(option.label)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    lineHeight: 1.3,
                    color: isSelected
                      ? `rgba(${aR},${aG},${aB},0.95)`
                      : 'rgba(185,185,200,0.7)',
                    transition: 'color 0.25s ease',
                  }}
                >
                  {tr(option.description)}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>
    </Box>
  ) : null;

  /* ── render ── */
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason !== 'backdropClick') onClose();
      }}
      maxWidth={false}
      fullScreen={isFullScreen}
      TransitionComponent={Fade}
      transitionDuration={{ enter: 480, exit: 280 }}
      sx={{
        zIndex: 10002,
        '& .MuiBackdrop-root': {
          bgcolor: DESIGN.modal.backdropBg,
          backdropFilter: 'blur(28px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
        },
      }}
      PaperProps={{
        elevation: 0,
        sx: {
          m: isFullScreen ? 0 : { xs: 2, sm: 3 },
          width: isFullScreen
            ? '100%'
            : isMobile
            ? DESIGN.modal.maxWidthMobile
            : DESIGN.modal.maxWidthDesktop,
          maxWidth: '100%',
          maxHeight: isFullScreen ? '100%' : 'calc(100vh - 32px)',
          height: isFullScreen ? '100%' : 'auto',
          borderRadius: isFullScreen ? 0 : { xs: DESIGN.modal.borderRadiusSm, sm: DESIGN.modal.borderRadiusLg },
          overflow: 'hidden',
          bgcolor: 'transparent',
          border: isFullScreen ? 'none' : `1px solid ${glass.border}`,
          background: isFullScreen
            ? DESIGN.modal.bgOpaque
            : DESIGN.modal.bgTranslucent,
          backdropFilter: 'blur(80px) saturate(180%)',
          WebkitBackdropFilter: 'blur(80px) saturate(180%)',
          boxShadow: isFullScreen
            ? 'none'
            : `
              0 40px 100px rgba(0,0,0,0.55),
              0 0 0 1px rgba(255,255,255,0.06),
              inset 0 1px 0 rgba(255,255,255,0.08)
            `,

        },
      }}
    >
      {/* ── video backdrop ── */}
      {backdropStillUrl ? (
        <Box
          component="img"
          src={backdropStillUrl}
          alt=""
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: DESIGN.backdrop.objectPosition,
            opacity: DESIGN.backdrop.opacity,
            zIndex: 0,
            pointerEvents: 'none',
            filter: DESIGN.backdrop.filter,
          }}
        />
      ) : null}
      <Box
        component="video"
        src={DESIGN.backdrop.src}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => {
          setBackdropVideoReady(true);
          setBackdropVideoFailed(false);
        }}
        onCanPlay={() => {
          setBackdropVideoReady(true);
          setBackdropVideoFailed(false);
        }}
        onError={() => {
          setBackdropVideoReady(false);
          setBackdropVideoFailed(true);
        }}
        data-testid="role-room-login-backdrop-video"
        data-media-mode={backdropVideoReady && !backdropVideoFailed ? 'video' : 'image'}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: DESIGN.backdrop.objectPosition,
          opacity: backdropVideoReady && !backdropVideoFailed ? DESIGN.backdrop.opacity : 0,
          zIndex: 0,
          pointerEvents: 'none',
          filter: DESIGN.backdrop.filter,
          transition: `opacity 0.3s ${easing}`,
        }}
      />

      {/* ── floating close button ── */}
      <IconButton
        onClick={onClose}
        aria-label={t('dlgLogin.close')}
        sx={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 20,
          width: 30,
          height: 30,
          bgcolor: 'rgba(255,255,255,0.07)',
          border: `1px solid ${glass.border}`,
          color: glass.textSub,
          backdropFilter: 'blur(12px)',
          transition: `all 0.3s ${easing}`,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.13)',
            color: glass.text,
            transform: 'scale(1.08) rotate(90deg)',
          },
          '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* ── two-panel wrapper ── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: isMobile ? 'auto' : '100%',
          minHeight: isMobile ? 'auto' : DESIGN.modal.minHeightDesktop,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ════ LEFT — branding panel ════ */}
        <Box
          sx={{
            position: 'relative',
            width: isMobile
              ? '100%'
              : isStepwiseContentProducerFlow
                ? { md: '35%', lg: '34%', xl: '33%' }
                : { md: '40%', lg: '42%', xl: '40%' },
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'center',
            px: { xs: useCompactMobileHeader ? 1.1 : 2, sm: 4, xl: 4.8 },
            pt: isMobile ? (useCompactMobileHeader ? 0.55 : 1.5) : { md: 4.5, xl: 5.4 },
            pb: isMobile ? (useCompactMobileHeader ? 0.55 : 1.15) : { md: 4.5, xl: 5.2 },
            borderRight: isMobile ? 'none' : `1px solid rgba(255,255,255,0.07)`,
            borderBottom: isMobile ? `1px solid rgba(255,255,255,0.07)` : 'none',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-20%',
              left: '-10%',
              width: '70%',
              height: '70%',
              background:
                'radial-gradient(circle, rgba(110,90,255,0.18) 0%, transparent 65%)',
              filter: 'blur(48px)',
              pointerEvents: 'none',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: '-15%',
              right: '-10%',
              width: '60%',
              height: '60%',
              background:
                'radial-gradient(circle, rgba(200,100,255,0.1) 0%, transparent 65%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            },
          }}
        >
          {/* reactive accent glow — transitions when a role is picked */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 22% 5%, rgba(${aR},${aG},${aB},0.22) 0%, transparent 55%),
                           radial-gradient(ellipse at 85% 88%, rgba(${aR},${aG},${aB},0.13) 0%, transparent 50%)`,
              transition: 'background 1.4s ease',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* logo */}
          <Box
            component="img"
            src={ROLE_ROOM_BRAND_ASSETS.wordmark}
            alt="The Role Room"
            sx={{
              width: { xs: useCompactMobileHeader ? 'min(92px, 28vw)' : 'min(144px, 40vw)', sm: '60%', md: '72%', lg: '82%', xl: '90%' },
              height: 'auto',
              objectFit: 'contain',
              mb: { xs: useCompactMobileHeader ? 0.28 : 0.85, sm: 2 },
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 6px 28px rgba(130,110,255,0.28))',
            }}
          />

          {/* eyebrow label */}
          <Typography
            sx={{
              letterSpacing: '0.2em',
              fontSize: { xs: useCompactMobileHeader ? '0.4rem' : '0.54rem', sm: '0.75rem', md: '0.85rem', lg: '0.95rem', xl: '1.02rem' },
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'rgba(180,165,255,0.55)',
              textAlign: 'center',
              mb: { xs: useCompactMobileHeader ? 0 : 0.05, sm: 0.15 },
              position: 'relative',
              zIndex: 1,
            }}
          >
            {isLandingPage ? loginEyebrow : t('dlgLogin.eyebrowAdmin')}
          </Typography>

          {/* title */}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: useCompactMobileHeader ? '0.82rem' : '1.12rem', sm: '2rem', md: '2.4rem', lg: '2.8rem', xl: '3.55rem' },
              letterSpacing: '-0.03em',
              textAlign: 'center',
              lineHeight: 1.15,
              position: 'relative',
              zIndex: 1,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
              background:
                'linear-gradient(135deg, #ffffff 0%, rgba(200,185,255,1) 55%, rgba(130,110,255,0.95) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isLandingPage ? loginTitle : t('dlgLogin.logIn')}
          </Typography>

          {/* subtitle */}
          <Typography
            sx={{
              mt: { xs: useCompactMobileHeader ? 0.2 : 0.35, sm: 0.6 },
              color: 'rgba(200,195,220,0.65)',
              fontSize: { xs: useCompactMobileHeader ? '0.56rem' : '0.72rem', sm: '0.95rem', md: '1.05rem', lg: '1.15rem', xl: '1.26rem' },
              fontWeight: 300,
              letterSpacing: '0.015em',
              textAlign: 'center',
              maxWidth: { xs: useCompactMobileHeader ? 188 : 230, md: 300, lg: 340, xl: 440 },
              lineHeight: { xs: 1.35, sm: 1.45 },
              position: 'relative',
              zIndex: 1,
            }}
          >
            {isLandingPage
              ? loginSubtitle
              : t('dlgLogin.adminSubtitle')}
          </Typography>

          {showPersonaChooserInLeftPanel && (
            <Box
              sx={{
                mt: { xs: 1.5, md: 2.2 },
                width: '100%',
                maxWidth: { xs: 260, md: 320, lg: 390, xl: 440 },
                px: { xs: 0.25, md: 0.5 },
                position: 'relative',
                zIndex: 2,
              }}
            >
              {loginPersonaChooser}
            </Box>
          )}

          {/* ── social proof stats bar ── */}
          {isLandingPage && activeStats.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                gap: { xs: 1.5, md: 3.5, lg: 4 },
                mt: { xs: 1.35, md: 2.5 },
                px: 1,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {activeStats.map((s, i) => (
                <Box key={i} sx={{ textAlign: 'center' }}>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.98rem', md: '1.35rem', lg: '1.7rem' },
                      fontWeight: 700,
                      color: `rgba(${aR},${aG + 20},${aB + 20},0.95)`,
                      letterSpacing: '-0.04em',
                      lineHeight: 1,
                      transition: 'color 1.2s ease',
                      textShadow: `0 0 20px rgba(${aR},${aG},${aB},0.45)`,
                    }}
                  >
                    {s.value}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.52rem', md: '0.65rem', lg: '0.73rem' },
                      color: 'rgba(200,190,255,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      mt: 0.3,
                    }}
                  >
                    {tr(s.label)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {isLandingPage && !isMobile && (
            <Box
              sx={{
                mt: { xs: 2, md: 2.5, lg: 3 },
                width: '100%',
                maxWidth: isStepwiseContentProducerFlow
                  ? { xs: 260, md: 360, lg: 430, xl: 560 }
                  : { xs: 260, md: 320, lg: 390, xl: 440 },
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* thin top rule */}
              <Box
                sx={{
                  width: '100%',
                  height: '1px',
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(160,140,255,0.35) 40%, rgba(160,140,255,0.35) 60%, transparent 100%)',
                  mb: { xs: 1.5, md: 2 },
                }}
              />

              {/* scenario card — contextual when role picked, ticker otherwise */}
              {selectedRole ? (
                /* ── contextual role panel ── */
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: { xs: 1, md: 1.25, lg: 1.75 },
                    px: isStepwiseContentProducerFlow
                      ? { xs: 1.5, md: 2.2, lg: 2.9, xl: 3.8 }
                      : { xs: 1.5, md: 2, lg: 2.5, xl: 3 },
                    py: isStepwiseContentProducerFlow
                      ? { xs: 1.25, md: 1.9, lg: 2.7, xl: 3.3 }
                      : { xs: 1.25, md: 1.75, lg: 2.25, xl: 2.75 },
                    borderRadius: '18px',
                    bgcolor: `rgba(${aR},${aG},${aB},0.10)`,
                    border: `1px solid rgba(${aR},${aG},${aB},0.25)`,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    transition: 'background 1.2s ease, border-color 1.2s ease',
                  }}
                >
                  {ROLE_CARDS[selectedRole]?.icon && (
                    <Box
                      component="img"
                      src={ROLE_CARDS[selectedRole].icon}
                      alt=""
                      sx={{
                        width: { xs: 36, md: 52, lg: 68, xl: 80 },
                        height: { xs: 36, md: 52, lg: 68, xl: 80 },
                        objectFit: 'contain',
                        opacity: 0.97,
                        flexShrink: 0,
                        filter: `drop-shadow(0 2px 14px rgba(${aR},${aG},${aB},0.5))`,
                        transition: 'filter 1.2s ease',
                      }}
                    />
                  )}
                  <Typography
                    sx={{
                      fontSize: { xs: '0.78rem', md: '0.95rem', lg: '1.15rem', xl: '1.3rem' },
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      color: `rgba(${aR + 30},${aG + 30},${aB + 10},1)`,
                      transition: 'color 1.2s ease',
                      textShadow: `0 0 20px rgba(${aR},${aG},${aB},0.4)`,
                    }}
                  >
                    {tr(ROLE_CARDS[selectedRole]?.label) || selectedRole}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.8rem', md: '0.95rem', lg: '1.05rem', xl: '1.2rem' },
                      fontWeight: 300,
                      fontStyle: 'italic',
                      color: 'rgba(220,215,240,0.8)',
                      textAlign: 'center',
                      lineHeight: 1.55,
                    }}
                  >
                    {tr(ROLE_TAGLINES[selectedRole])}
                  </Typography>
                </Box>
              ) : (
                /* ── use-case ticker card ── */
                <Box
                  sx={{
                    opacity: ucVisible ? 1 : 0,
                    transform: ucVisible ? 'translateY(0)' : 'translateY(6px)',
                    transition: 'opacity 0.35s ease, transform 0.35s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: { xs: 0.75, md: 1, lg: 1.5 },
                    px: isStepwiseContentProducerFlow
                      ? { xs: 1.5, md: 2.2, lg: 2.9, xl: 3.8 }
                      : { xs: 1.5, md: 2, lg: 2.5, xl: 3 },
                    py: isStepwiseContentProducerFlow
                      ? { xs: 1.25, md: 1.9, lg: 2.7, xl: 3.3 }
                      : { xs: 1.25, md: 1.75, lg: 2.25, xl: 2.75 },
                    borderRadius: '18px',
                    bgcolor: 'rgba(130,110,255,0.08)',
                    border: '1px solid rgba(130,110,255,0.18)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.25, lg: 1.5 } }}>
                    {activeUseCase && ROLE_CARDS[activeUseCase.roleId]?.icon && (
                      <Box
                        component="img"
                        src={ROLE_CARDS[activeUseCase.roleId].icon}
                        alt=""
                        sx={{
                          width: { xs: 20, md: 36, lg: 52, xl: 64 },
                          height: { xs: 20, md: 36, lg: 52, xl: 64 },
                          objectFit: 'contain',
                          opacity: 0.95,
                          flexShrink: 0,
                          filter: 'drop-shadow(0 2px 10px rgba(130,110,255,0.35))',
                        }}
                      />
                    )}
                    <Typography
                      sx={{
                        fontSize: { xs: '0.72rem', md: '0.9rem', lg: '1.1rem', xl: '1.25rem' },
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                        background:
                          'linear-gradient(90deg, rgba(200,185,255,1) 0%, rgba(130,110,255,0.9) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {activeUseCase
                        ? (tr(ROLE_CARDS[activeUseCase.roleId]?.label) || activeUseCase.roleId)
                        : ''}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.8rem', md: '0.95rem', lg: '1.1rem', xl: '1.25rem' },
                      fontWeight: 300,
                      color: 'rgba(220,215,240,0.85)',
                      textAlign: 'center',
                      lineHeight: 1.55,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {tr(activeUseCase?.line)}
                  </Typography>
                </Box>
              )}

              {/* progress dots — only when no role selected */}
              {!selectedRole && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 0.75,
                    mt: { xs: 1.25, md: 1.75 },
                  }}
                >
                  {activeUseCases.map((_, i) => (
                    <Box
                      key={i}
                      onClick={() => { setUcVisible(false); setTimeout(() => { setUcIdx(i); setUcVisible(true); }, 350); }}
                      sx={{
                        width: i === ucIdx ? { xs: 16, md: 22 } : { xs: 6, md: 7 },
                        height: { xs: 4, md: 5 },
                        borderRadius: '99px',
                        bgcolor: i === ucIdx
                          ? 'rgba(160,140,255,0.9)'
                          : 'rgba(160,140,255,0.25)',
                        transition: 'all 0.4s ease',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(160,140,255,0.6)' },
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* testimonial strip */}
              {activeTestimonials.length > 0 && (
                <Box
                  sx={{
                    opacity: testimonialVisible ? 1 : 0,
                    transform: testimonialVisible ? 'translateY(0)' : 'translateY(4px)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                    mt: { xs: 1.5, md: 2 },
                    textAlign: 'center',
                    px: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: '0.75rem', md: '0.85rem', lg: '0.96rem' },
                      color: 'rgba(220,215,240,0.72)',
                      fontStyle: 'italic',
                      lineHeight: 1.65,
                      mb: 0.4,
                    }}
                  >
                    &ldquo;{tr(activeTestimonials[testimonialIdx]?.quote)}&rdquo;
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.63rem', md: '0.70rem', lg: '0.80rem' },
                      color: `rgba(${aR},${aG},${aB},0.85)`,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      transition: 'color 1.2s ease',
                    }}
                  >
                    — {activeTestimonials[testimonialIdx]?.author},&nbsp;{tr(activeTestimonials[testimonialIdx]?.title)}
                  </Typography>
                </Box>
              )}

              {/* thin bottom rule */}
              <Box
                sx={{
                  width: '100%',
                  height: '1px',
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(160,140,255,0.35) 40%, rgba(160,140,255,0.35) 60%, transparent 100%)',
                  mt: { xs: 1.5, md: 2 },
                }}
              />
            </Box>
          )}

          {/* selected role badge (desktop only) */}
          {!isMobile && selectedRoleLabel && (
            <Box
              sx={{
                mt: 2.5,
                px: { xs: 2, md: 2.5, lg: 3 },
                py: { xs: 1, md: 1.25, lg: 1.5 },
                borderRadius: '24px',
                bgcolor: `rgba(${aR},${aG},${aB},0.22)`,
                border: `1.5px solid rgba(${aR},${aG},${aB},0.60)`,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, md: 1.25, lg: 1.5 },
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                position: 'relative',
                zIndex: 1,
                transition: 'background 1.2s ease, border-color 1.2s ease, box-shadow 1.2s ease',
                boxShadow: `0 0 0 1px rgba(${aR},${aG},${aB},0.12), 0 4px 24px rgba(${aR},${aG},${aB},0.38)`,
              }}
            >
              {/* green presence dot */}
              <Box
                sx={{
                  width: { xs: 8, md: 10, lg: 12 },
                  height: { xs: 8, md: 10, lg: 12 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(80,230,140,1)',
                  boxShadow: '0 0 8px 2px rgba(80,230,140,0.7)',
                  animation: `${dotPulse} 2s ease-in-out infinite`,
                  flexShrink: 0,
                }}
              />
              {roleIcons[selectedRole] && (
                <Box
                  key={badgeKey}
                  component="img"
                  src={roleIcons[selectedRole]}
                  alt=""
                  sx={{ width: { xs: 22, md: 28, lg: 34 }, height: { xs: 22, md: 28, lg: 34 }, minWidth: { xs: 22, md: 28, lg: 34 }, objectFit: 'contain', opacity: 1, animation: `${badgeIconEnter} 0.5s ease both` }}
                />
              )}
              <Typography
                sx={{
                  fontSize: { xs: '0.88rem', md: '1rem', lg: '1.15rem' },
                  color: '#fff',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  textShadow: '0 1px 8px rgba(130,110,255,0.5)',
                }}
              >
                {selectedRoleLabel}
              </Typography>
            </Box>
          )}

          {/* login icon watermark */}
          <Box
            component="img"
            src="/role-room-assets/roleroom_login.webp"
            alt=""
            sx={{
              width: isMobile ? 36 : 48,
              height: isMobile ? 36 : 48,
              objectFit: 'contain',
              opacity: 0.08,
              position: 'absolute',
              bottom: 14,
              right: isMobile ? 14 : 18,
              filter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          />
        </Box>

        {/* ════ RIGHT — form panel ════ */}
        <Box
          ref={rightPanelRef}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: { xs: 1.45, sm: 4, md: 5.25, lg: 5.75, xl: 6.75 },
            py: { xs: 1.35, sm: 3, xl: 3.4 },
            gap: isLandingPage ? { xs: 1.1, sm: 1.45, xl: 1.8 } : 2,
            overflowY: 'auto',
            maxHeight: isFullScreen ? 'calc(100vh - 132px)' : '100%',
          }}
        >
          {commercialPaymentNotice && (
            <Alert
              icon={false}
              severity={commercialPaymentNotice.severity}
              sx={{
                bgcolor:
                  commercialPaymentNotice.severity === 'success'
                    ? 'rgba(38,178,103,0.10)'
                    : commercialPaymentNotice.severity === 'warning'
                      ? 'rgba(255,186,73,0.11)'
                      : 'rgba(97,177,255,0.10)',
                border:
                  commercialPaymentNotice.severity === 'success'
                    ? '1px solid rgba(38,178,103,0.22)'
                    : commercialPaymentNotice.severity === 'warning'
                      ? '1px solid rgba(255,186,73,0.24)'
                      : '1px solid rgba(97,177,255,0.20)',
                borderRadius: '14px',
                color:
                  commercialPaymentNotice.severity === 'success'
                    ? 'rgba(140,255,194,0.94)'
                    : commercialPaymentNotice.severity === 'warning'
                      ? 'rgba(255,222,145,0.95)'
                      : 'rgba(184,225,255,0.95)',
                fontSize: '0.83rem',
                fontWeight: 400,
                py: 1,
                px: 1.75,
                backdropFilter: 'blur(12px)',
                '& .MuiAlert-message': { width: '100%', textAlign: 'center' },
              }}
            >
              {commercialPaymentNotice.message}
            </Alert>
          )}

          {/* error */}
          {error && (
            <Alert
              icon={false}
              severity="error"
              sx={{
                bgcolor: 'rgba(255,59,48,0.08)',
                border: '1px solid rgba(255,59,48,0.18)',
                borderRadius: '14px',
                color: 'rgba(255,100,95,0.95)',
                fontSize: '0.83rem',
                fontWeight: 400,
                py: 1,
                px: 1.75,
                backdropFilter: 'blur(12px)',
                '& .MuiAlert-message': { width: '100%', textAlign: 'center' },
              }}
            >
              {error}
            </Alert>
          )}

          {isLandingPage && effectiveLoginPersona && !clientPortalIntent && !talentPortalIntent && (
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: { xs: 'flex-start', md: 'space-between' },
                gap: 1,
                flexDirection: { xs: 'column', md: 'row' },
                width: '100%',
                minWidth: 0,
                mb: 0.15,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.18, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(181,171,212,0.62)',
                  }}
                >{t('dlgLogin.selectedEntry')}</Typography>
                <Typography
                  sx={{
                    fontSize: { xs: '0.9rem', sm: '0.96rem' },
                    fontWeight: 600,
                    color: 'rgba(244,240,255,0.96)',
                  }}
                >
                  {tr(effectiveLoginPersonaOption?.label) || 'The Role Room'}
                </Typography>
              </Box>
              <Button
                type="button"
                onClick={() => resetRoleRoomPersonaSelection()}
                sx={{
                  minHeight: 34,
                  px: 0,
                  py: 0,
                  textTransform: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  borderRadius: 0,
                  color: 'rgba(214,206,238,0.82)',
                  alignSelf: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'flex-start',
                  minWidth: 0,
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: 'rgba(242,236,255,0.96)',
                  },
                }}
              >{t('dlgLogin.changeEntry')}</Button>
            </Box>
          )}

          {/* ── login persona chooser ── */}
          {showContentProducerPersonaSummary ? contentProducerPersonaSummary : null}
          {showProductionTeamPersonaSummary ? productionTeamPersonaSummary : null}
          {showPersonaChooserInRightPanel && !showContentProducerPersonaSummary && !showProductionTeamPersonaSummary && loginPersonaChooser}
          {contentProducerStepNavigation}
          {productionTeamStepNavigation}
          {contentProducerAccessChooser}
          {isLandingPage && !effectiveLoginPersona && (
            <Box
              sx={{
                p: 1.2,
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  color: 'rgba(206,199,226,0.72)',
                }}
              >
                {t('dlgLogin.introBlurb')}
              </Typography>
            </Box>
          )}
          {contentProducerAuthSummary}
          {productionTeamAuthSummary}

          {isLandingPage && effectiveLoginPersona && requiresCommercialSetup && (!isStepwiseCommercialFlow || (isStepwiseContentProducerFlow ? contentProducerStep !== 'auth' : productionTeamStep !== 'auth')) && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                p: { xs: 1.2, sm: 1.45 },
                borderRadius: '18px',
                bgcolor: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {showCommercialCompanyStep && (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                    <Typography
                      sx={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: 'rgba(232,226,246,0.96)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >{t('dlgLogin.companyFirst')}</Typography>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        lineHeight: 1.5,
                        color: 'rgba(205,198,224,0.72)',
                      }}
                    >
                      {t('dlgLogin.companyFirstHelp')}
                    </Typography>
                  </Box>

                  <TextField
                    label={t('dlgLogin.orgNumberLabel')}
                    value={formatOrganizationNumber(organizationNumber)}
                    onChange={(event) => {
                      setOrganizationNumber(event.target.value);
                      setOrganizationLookupError('');
                      setOrganizationCompanyName('');
                      setOrganizationValidatedNumber('');
                    }}
                    fullWidth
                    size="small"
                    error={Boolean(organizationLookupError)}
                    helperText={organizationLookupError || t('dlgLogin.orgNumberHelper')}
                    inputProps={{
                      inputMode: 'numeric',
                      maxLength: 11,
                      pattern: '[0-9 ]*',
                    }}
                    InputProps={{
                      endAdornment: organizationLookupLoading ? (
                        <InputAdornment position="end">
                          <CircularProgress size={18} sx={{ color: `rgba(${aR},${aG},${aB},0.9)` }} />
                        </InputAdornment>
                      ) : null,
                    }}
                    sx={glassInputSx(false)}
                  />

                  <Box
                    sx={{
                      p: 1,
                      borderRadius: '16px',
                      bgcolor: hasVerifiedOrganization
                        ? `rgba(${aR},${aG},${aB},0.14)`
                        : 'rgba(255,255,255,0.03)',
                      border: hasVerifiedOrganization
                        ? `1px solid rgba(${aR},${aG},${aB},0.28)`
                        : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(195,188,214,0.72)' }}>{t('dlgLogin.companyField')}</Typography>
                    <Typography sx={{ mt: 0.35, fontSize: '0.94rem', fontWeight: 600, color: 'rgba(244,240,255,0.95)' }}>
                      {organizationCompanyName || t('dlgLogin.waitingVerifiedOrg')}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: '0.74rem', color: 'rgba(205,198,224,0.68)' }}>
                      {hasVerifiedOrganization
                        ? t('dlgLogin.orgVerified', { num: formatOrganizationNumber(normalizedOrganizationNumber) })
                        : t('dlgLogin.teamUnlocks')}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* ── role picker ── */}
          {isLandingPage && shouldShowSetupFlow && shouldShowCommercialDetails && !isEducationInstitutionFlow && showCommercialRoleStep && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                ...(isMobile
                  ? {
                      p: 1.2,
                      borderRadius: '18px',
                      bgcolor: 'rgba(255,255,255,0.035)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }
                  : {}),
              }}
            >
              {/* onboarding hint arrow */}
              {!hasSeenHint.current && !selectedRole && !isStepwiseContentProducerFlow && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.25,
                    mb: 0.5,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      color: `rgba(${aR},${aG},${aB},0.75)`,
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      transition: 'color 1.2s ease',
                    }}
                  >{t('dlgLogin.startHere')}</Typography>
                  <Box
                    sx={{
                      fontSize: '1.1rem',
                      color: `rgba(${aR},${aG},${aB},0.65)`,
                      animation: `${hintBounce} 1.4s ease-in-out infinite`,
                      lineHeight: 1,
                      transition: 'color 1.2s ease',
                    }}
                  >
                    ↓
                  </Box>
                </Box>
              )}
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: glass.textSub,
                  letterSpacing: '0.03em',
                }}
              >
                {isStepwiseProductionTeamFlow
                  ? t('dlgLogin.chooseTeamLeadRole')
                  : isProductionTeamFlow
                    ? t('dlgLogin.yourRoleInTeam')
                    : isStepwiseContentProducerFlow
                      ? t('dlgLogin.chooseTeamFocus')
                      : t('dlgLogin.yourRole')}
              </Typography>
              {(isStepwiseContentProducerFlow || isStepwiseProductionTeamFlow) && (
                <Typography
                  sx={{
                    mt: -0.55,
                    fontSize: { xs: '0.72rem', sm: '0.75rem' },
                    lineHeight: 1.55,
                    color: 'rgba(208,201,226,0.7)',
                    maxWidth: 760,
                  }}
                >
                  {isStepwiseProductionTeamFlow
                    ? t('dlgLogin.roleStepHintPt')
                    : t('dlgLogin.roleStepHintCp')}
                </Typography>
              )}
              <Box
                ref={rolePickerScrollRef}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.15,
                  ...(isMobile
                    ? {
                        maxHeight: 'min(46vh, 430px)',
                        overflowY: 'auto',
                        pr: 0.5,
                        overscrollBehavior: 'contain',
                      }
                    : {}),
                }}
              >
                {visibleProfessionCategories.map((cat) => (
                  <CategorySection
                    key={cat.id}
                    category={cat}
                    selectedRole={selectedRole}
                    onSelect={setSelectedRole}
                    isMobile={isMobile}
                    compact={isMobile || ((isStepwiseContentProducerFlow || isStepwiseProductionTeamFlow) && cat.id === 'utvid')}
                    variant={isStepwiseCommercialFlow ? 'decision' : 'default'}
                  />
                ))}
              </Box>
            </Box>
          )}

          {isLandingPage && effectiveLoginPersona && shouldShowCommercialDetails && showCommercialTeamStep && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.2,
                p: { xs: 1.3, sm: 1.75 },
                borderRadius: '20px',
                bgcolor: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: 'rgba(232,226,246,0.96)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {isEducationInstitutionFlow ? t('dlgLogin.institutionSetup') : t('dlgLogin.teamAndSubscription')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    color: 'rgba(205,198,224,0.72)',
                    maxWidth: 560,
                  }}
                >
                  {isEducationInstitutionFlow
                    ? t('dlgLogin.teamStepDescEdu')
                    : isProductionTeamFlow
                      ? t('dlgLogin.teamStepDescPt')
                      : t('dlgLogin.teamStepDescCp')}
                </Typography>
              </Box>

              {isEducationInstitutionFlow ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
                    gap: 1.25,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        p: 0,
                        m: -1,
                        overflow: 'hidden',
                        clip: 'rect(0 0 0 0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                    >
                      <TextField
                        label={t('dlgLogin.website')}
                        name="website"
                        value={educationInquiryWebsite}
                        onChange={(event) => setEducationInquiryWebsite(event.target.value)}
                        autoComplete="off"
                        tabIndex={-1}
                        size="small"
                      />
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1,
                        p: 1,
                        borderRadius: '16px',
                        bgcolor: 'rgba(255,255,255,0.035)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <Box sx={{ gridColumn: '1 / -1', mb: 0.15 }}>
                        <Typography
                          sx={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: `rgba(${aR},${aG},${aB},0.92)`,
                          }}
                        >
                          {tr(teamOwnerLabel)}
                        </Typography>
                      </Box>
                      <TextField
                        label={t('dlgLogin.ownerName', { owner: tr(teamOwnerLabel) })}
                        value={teamOwner.name}
                        onChange={(event) => updateProductionTeamMember(0, 'name', event.target.value)}
                        fullWidth
                        size="small"
                        sx={glassInputSx(false)}
                      />
                      <TextField
                        label={t('dlgLogin.emailLabel')}
                        type="email"
                        value={teamOwner.email}
                        onChange={(event) => updateProductionTeamMember(0, 'email', event.target.value)}
                        fullWidth
                        size="small"
                        helperText={t('dlgLogin.emailHelperEdu')}
                        sx={glassInputSx(false)}
                      />
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1,
                        p: 1,
                        borderRadius: '16px',
                        bgcolor: 'rgba(255,255,255,0.035)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <TextField
                        select
                        label={t('dlgLogin.institutionTypeLabel')}
                        value={educationInstitutionType}
                        onChange={(event) => setEducationInstitutionType(event.target.value as EducationInstitutionType)}
                        fullWidth
                        size="small"
                        SelectProps={{
                          MenuProps: ROLE_ROOM_SELECT_MENU_PROPS,
                        }}
                        sx={glassInputSx(false)}
                      >
                        {EDUCATION_INSTITUTION_TYPES.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {tr(option.label)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label={t('dlgLogin.positionRoleLabel')}
                        value={educationContactRole}
                        onChange={(event) => setEducationContactRole(event.target.value)}
                        fullWidth
                        size="small"
                        placeholder={t('dlgLogin.positionPlaceholder')}
                        sx={glassInputSx(false)}
                      />
                      <TextField
                        label={t('dlgLogin.programLabel')}
                        value={educationProgramName}
                        onChange={(event) => setEducationProgramName(event.target.value)}
                        fullWidth
                        size="small"
                        placeholder={t('dlgLogin.programPlaceholder')}
                        sx={glassInputSx(false)}
                      />
                      <TextField
                        select
                        label={t('dlgLogin.studentScopeLabel')}
                        value={educationStudentSeatRange}
                        onChange={(event) => setEducationStudentSeatRange(event.target.value as EducationSeatRange)}
                        fullWidth
                        size="small"
                        SelectProps={{
                          MenuProps: ROLE_ROOM_SELECT_MENU_PROPS,
                        }}
                        sx={glassInputSx(false)}
                      >
                        {EDUCATION_STUDENT_SEAT_OPTIONS.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {tr(option.label)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label={t('dlgLogin.staffLabel')}
                        value={educationStaffSeatRange}
                        onChange={(event) => setEducationStaffSeatRange(event.target.value as EducationSeatRange)}
                        fullWidth
                        size="small"
                        SelectProps={{
                          MenuProps: ROLE_ROOM_SELECT_MENU_PROPS,
                        }}
                        sx={glassInputSx(false)}
                      >
                          {EDUCATION_STAFF_SEAT_OPTIONS.map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                              {tr(option.label)}
                            </MenuItem>
                          ))}
                      </TextField>
                      <TextField
                        select
                        label={t('dlgLogin.desiredStartLabel')}
                        value={educationDesiredStartWindow}
                        onChange={(event) => setEducationDesiredStartWindow(event.target.value as EducationStartWindow)}
                        fullWidth
                        size="small"
                        SelectProps={{
                          MenuProps: ROLE_ROOM_SELECT_MENU_PROPS,
                        }}
                        sx={glassInputSx(false)}
                      >
                        {EDUCATION_START_WINDOW_OPTIONS.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {tr(option.label)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label={t('dlgLogin.useCaseLabel')}
                        value={educationUseCase}
                        onChange={(event) => setEducationUseCase(event.target.value)}
                        multiline
                        minRows={4}
                        fullWidth
                        size="small"
                        placeholder={t('dlgLogin.useCasePlaceholder')}
                        sx={{
                          gridColumn: '1 / -1',
                          ...glassInputSx(false),
                        }}
                      />
                    </Box>

                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        lineHeight: 1.55,
                        color: 'rgba(198,191,218,0.68)',
                      }}
                    >
                      {t('dlgLogin.institutionContactNote')}
                    </Typography>
                    {educationInquirySubmitted ? (
                      <Alert
                        severity="success"
                        sx={{
                          borderRadius: '16px',
                          bgcolor: 'rgba(18, 64, 40, 0.34)',
                          color: 'rgba(241,255,247,0.96)',
                          border: '1px solid rgba(98, 199, 142, 0.35)',
                          '& .MuiAlert-icon': {
                            color: 'rgba(117, 230, 165, 0.92)',
                          },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>
                          {educationInquirySubmitted.message}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', mt: 0.35, color: 'rgba(224,244,233,0.82)' }}>
                          {educationInquirySubmitted.requestId
                            ? t('dlgLogin.requestId', { id: educationInquirySubmitted.requestId })
                            : t('dlgLogin.requestRegistered')}
                          {educationInquirySubmitted.notificationEmailSent
                            ? t('dlgLogin.adminNotified')
                            : t('dlgLogin.adminNotifyUnconfirmed')}
                        </Typography>
                      </Alert>
                    ) : null}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box
                      sx={{
                        p: 1.2,
                        borderRadius: '18px',
                        bgcolor: 'rgba(14,10,28,0.66)',
                        border: '1px solid rgba(246,195,88,0.22)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(246,195,88,0.84)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('dlgLogin.institutionPartnership')}</Typography>
                      <Typography sx={{ mt: 0.5, fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.96)' }}>{t('dlgLogin.partnershipRequest')}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
                        {t('dlgLogin.partnershipBlurb')}
                      </Typography>
                      <Box sx={{ mt: 1, display: 'grid', gap: 0.55 }}>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.institutionLabel')}: {organizationCompanyName || t('dlgLogin.awaitingVerification')}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.institutionTypeLabel')}: {tr(EDUCATION_INSTITUTION_TYPES.find((option) => option.id === educationInstitutionType)?.label || 'dlgLogin.notSet')}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.programShort')}: {educationProgramName.trim() || t('dlgLogin.notSet')}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.studentsLabel')}: {tr(getEducationSeatLabel(educationStudentSeatRange, EDUCATION_STUDENT_SEAT_OPTIONS))}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.staffLabel')}: {tr(getEducationSeatLabel(educationStaffSeatRange, EDUCATION_STAFF_SEAT_OPTIONS))}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.desiredStartLabel')}: {tr(getEducationStartWindowLabel(educationDesiredStartWindow))}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.mainContact')}: {teamOwner.name.trim() || t('dlgLogin.notSet')}
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        p: 1.1,
                        borderRadius: '18px',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.85,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: 'rgba(245,240,255,0.94)' }}>{t('dlgLogin.whatHappensAfter')}</Typography>
                      <Typography sx={{ fontSize: '0.74rem', lineHeight: 1.6, color: 'rgba(210,204,228,0.72)' }}>
                        {t('dlgLogin.afterSubmitBlurb')}
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 0.45 }}>
                        {[
                          t('dlgLogin.afterStep1'),
                          t('dlgLogin.afterStep2'),
                          t('dlgLogin.afterStep3'),
                        ].map((line) => (
                          <Typography
                            key={line}
                            sx={{ fontSize: '0.72rem', lineHeight: 1.55, color: 'rgba(220,214,235,0.8)' }}
                          >
                            {line}
                          </Typography>
                        ))}
                      </Box>
                    </Box>

                    {educationTurnstileEnabled ? (
                      <Box
                        sx={{
                          p: 1.1,
                          borderRadius: '18px',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.75,
                        }}
                      >
                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: 'rgba(245,240,255,0.94)' }}>{t('dlgLogin.confirmSubmission')}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.55, color: 'rgba(210,204,228,0.72)' }}>
                          {t('dlgLogin.turnstileBlurb')}
                        </Typography>
                        <RoleRoomTurnstileWidget
                          siteKey={educationTurnstileSiteKey}
                          action={ROLE_ROOM_TURNSTILE_VERIFY_ACTION}
                          resetSignal={educationInquiryTurnstileResetSignal}
                          onTokenChange={setEducationInquiryTurnstileToken}
                          onErrorChange={setEducationInquiryTurnstileError}
                        />
                        {educationInquiryTurnstileError ? (
                          <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.5, color: '#ffb4c1' }}>
                            {educationInquiryTurnstileError}
                          </Typography>
                        ) : null}
                      </Box>
                    ) : null}

                    <Box
                      sx={{
                        display: 'grid',
                        gap: 0.85,
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      }}
                    >
                      <Button
                        type="button"
                        onClick={() => window.location.assign(ROLE_ROOM_EDUCATION_PATH)}
                        sx={{
                          minHeight: 44,
                          textTransform: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          borderRadius: '999px',
                          color: 'rgba(248,245,239,0.92)',
                          bgcolor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.1)',
                          },
                        }}
                      >{t('dlgLogin.readMorePartnership')}</Button>
                      <Button
                        type="button"
                        onClick={handleEducationInquirySubmit}
                        disabled={
                          !isCommercialSetupComplete
                          || loading
                          || (educationTurnstileEnabled && !educationInquiryTurnstileToken)
                        }
                        sx={{
                          minHeight: 44,
                          textTransform: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: '999px',
                          color: '#0d1018',
                          bgcolor: '#f6c358',
                          '&:hover': {
                            bgcolor: '#ffd787',
                          },
                          '&.Mui-disabled': {
                            color: 'rgba(7,8,14,0.36)',
                            bgcolor: 'rgba(246,195,88,0.42)',
                          },
                        }}
                      >
                        {loading ? t('dlgLogin.sendingRequest') : t('dlgLogin.sendPartnershipRequest')}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              ) : !isAdminRoleSelection ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
                    gap: 1.25,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {productionTeamMembers.map((member, index) => (
                      <Box
                        key={`team-member-${index}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 1,
                          p: 1,
                          borderRadius: '16px',
                          bgcolor: 'rgba(255,255,255,0.035)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        {index === 0 && (
                          <Box
                            sx={{
                              gridColumn: '1 / -1',
                              mb: 0.15,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: `rgba(${aR},${aG},${aB},0.92)`,
                              }}
                            >
                              {tr(teamOwnerLabel)}
                            </Typography>
                          </Box>
                        )}
                        <TextField
                          label={index === 0 ? t('dlgLogin.ownerName', { owner: tr(teamOwnerLabel) }) : t('dlgLogin.nameN', { n: index + 1 })}
                          value={member.name}
                          onChange={(event) => updateProductionTeamMember(index, 'name', event.target.value)}
                          fullWidth
                          size="small"
                          sx={glassInputSx(false)}
                        />
                        <TextField
                          label={t('dlgLogin.emailLabel')}
                          type="email"
                          value={member.email}
                          onChange={(event) => updateProductionTeamMember(index, 'email', event.target.value)}
                          fullWidth
                          size="small"
                          sx={glassInputSx(false)}
                        />
                        <TextField
                          select
                          label={t('dlgLogin.roleInTeamLabel')}
                          value={member.roleId}
                          onChange={(event) => updateProductionTeamMember(index, 'roleId', event.target.value)}
                          fullWidth
                          size="small"
                          SelectProps={{
                            MenuProps: ROLE_ROOM_SELECT_MENU_PROPS,
                          }}
                          sx={{
                            gridColumn: { xs: '1 / -1', sm: '1 / span 1' },
                            ...glassInputSx(false),
                          }}
                        >
                          {teamRoleOptions.map((roleId) => (
                            <MenuItem key={roleId} value={roleId}>
                              {tr(ROLE_CARDS[roleId].label)}
                            </MenuItem>
                          ))}
                        </TextField>
                        {productionTeamMembers.length > minimumSeatCount ? (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: { xs: 'stretch', sm: 'flex-end' },
                              alignItems: 'center',
                            }}
                          >
                            <Button
                              type="button"
                              onClick={() => removeProductionTeamSeat(index)}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.74rem',
                                borderRadius: '12px',
                                color: 'rgba(220,212,242,0.82)',
                                minWidth: { xs: '100%', sm: 112 },
                                bgcolor: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                '&:hover': {
                                  bgcolor: 'rgba(255,255,255,0.08)',
                                },
                              }}
                            >{t('dlgLogin.removeSeat')}</Button>
                          </Box>
                        ) : null}
                      </Box>
                    ))}

                    <Button
                      type="button"
                      onClick={addProductionTeamSeat}
                      disabled={!isTeamOwnerConfigured || !hasVerifiedOrganization}
                      sx={{
                        alignSelf: 'flex-start',
                        textTransform: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        borderRadius: '999px',
                        px: 1.6,
                        py: 0.75,
                        color: `rgba(${aR},${aG},${aB},0.95)`,
                        bgcolor: `rgba(${aR},${aG},${aB},0.12)`,
                        border: `1px solid rgba(${aR},${aG},${aB},0.24)`,
                        '&:hover': {
                          bgcolor: `rgba(${aR},${aG},${aB},0.18)`,
                        },
                        '&:disabled': {
                          color: 'rgba(255,255,255,0.32)',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        },
                      }}
                    >{t('dlgLogin.addPerson')}</Button>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        lineHeight: 1.5,
                        color: 'rgba(198,191,218,0.68)',
                      }}
                    >
                      {isProductionTeamFlow
                        ? t('dlgLogin.firstMemberLeadPt')
                        : t('dlgLogin.firstMemberOwnerCp')}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.2,
                        borderRadius: '18px',
                        bgcolor: 'rgba(14,10,28,0.66)',
                        border: '1px solid rgba(160,140,255,0.18)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(184,170,226,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isProductionTeamFlow ? t('dlgLogin.productionTeamPlan') : t('dlgLogin.contentProducerPlan')}
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.96)' }}>
                        {formatRoleRoomStatValue(planMonthlyTotal)} kr
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
                        {formatRoleRoomStatValue(seatPrice)} {t('dlgLogin.krPerPersonPerMonthExVat')}
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontSize: '0.72rem', color: 'rgba(196,188,220,0.64)' }}>
                        {t('dlgLogin.allPricesExVat')}
                      </Typography>
                      <Box sx={{ mt: 1, display: 'grid', gap: 0.55 }}>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.minTeamLabel')}: {minimumSeatCount} {minimumSeatCount === 1 ? t('dlgLogin.person') : t('dlgLogin.persons')}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.selectedSeats')}: {billableSeatCount}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.rolesSelected')}: {teamVisualMembers.length}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {tr(teamOwnerLabel)}: {teamOwner.name.trim() || t('dlgLogin.notSet')}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {t('dlgLogin.companyLabel')}: {organizationCompanyName || t('dlgLogin.awaitingVerification')}
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 0.9,
                      }}
                    >
                      {teamVisualMembers.length > 0 ? teamVisualMembers.map((member, index) => {
                        const previewAsset = getRoleCardPreviewAsset(member.roleId);
                        const roleLabel = tr(ROLE_CARDS[member.roleId]?.label) || t('dlgLogin.roleFallback');
                        return (
                          <Box
                            key={`team-card-${index}`}
                            sx={{
                              p: 0.85,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.035)',
                              border: '1px solid rgba(255,255,255,0.07)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.65,
                            }}
                          >
                            <Box
                              sx={{
                                aspectRatio: '1 / 1',
                                borderRadius: '14px',
                                overflow: 'hidden',
                                bgcolor: 'rgba(8,8,14,0.8)',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              {previewAsset ? (
                                <Box
                                  component="img"
                                  src={previewAsset}
                                  alt={roleLabel}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                                  <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.48)' }}>
                                    {roleLabel}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(245,240,255,0.95)' }}>
                                {member.name.trim() || t('dlgLogin.teamMemberN', { n: index + 1 })}
                              </Typography>
                              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(195,188,214,0.72)' }}>
                                {roleLabel}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }) : (
                        <Box
                          sx={{
                            gridColumn: '1 / -1',
                            p: 1.1,
                            borderRadius: '16px',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: '1px dashed rgba(255,255,255,0.12)',
                          }}
                        >
                          <Typography sx={{ fontSize: '0.76rem', lineHeight: 1.5, color: 'rgba(205,198,224,0.68)' }}>
                            {t('dlgLogin.teamStripeHint')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              ) : isProductionTeamFlow ? (
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: '18px',
                    bgcolor: 'rgba(14,10,28,0.66)',
                    border: '1px solid rgba(160,140,255,0.18)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: 'rgba(245,240,255,0.94)' }}>{t('dlgLogin.adminAccess')}</Typography>
                  <Typography sx={{ mt: 0.45, fontSize: '0.78rem', lineHeight: 1.5, color: 'rgba(210,204,228,0.72)' }}>
                    {t('dlgLogin.adminAccessBlurb')}
                  </Typography>
                </Box>
              ) : null}

              {!isCommercialSetupComplete && requiresCommercialSetup && !isAdminRoleSelection && (
                <Typography
                  sx={{
                    fontSize: '0.76rem',
                    lineHeight: 1.5,
                    color: 'rgba(205,198,224,0.68)',
                  }}
                >
                  {isEducationInstitutionFlow
                    ? t('dlgLogin.setupCompleteNoteEdu')
                    : t('dlgLogin.setupCompleteNotePt')}
                </Typography>
              )}
            </Box>
          )}

          {isStepwiseCommercialFlow && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Button
                type="button"
                onClick={isStepwiseProductionTeamFlow ? handleProductionTeamPreviousStep : handleContentProducerPreviousStep}
                disabled={isStepwiseProductionTeamFlow ? productionTeamStepIndex === 0 || loading : contentProducerStepIndex === 0 || loading}
                sx={{
                  minHeight: 44,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '999px',
                  px: 1.8,
                  color: 'rgba(248,245,239,0.92)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >{t('dlgLogin.back')}</Button>
              {((isStepwiseContentProducerFlow && contentProducerStep !== 'auth') || (isStepwiseProductionTeamFlow && productionTeamStep !== 'auth')) && (
                <Button
                  type="button"
                  onClick={isStepwiseProductionTeamFlow ? handleProductionTeamNextStep : handleContentProducerNextStep}
                  disabled={isStepwiseProductionTeamFlow ? !productionTeamCanAdvance || loading : !contentProducerCanAdvance || loading}
                  sx={{
                    minHeight: 44,
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '999px',
                    px: 1.9,
                    color: '#0d1018',
                    bgcolor: '#8ea7ff',
                    '&:hover': {
                      bgcolor: '#b5c3ff',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(7,8,14,0.36)',
                      bgcolor: 'rgba(142,167,255,0.32)',
                    },
                  }}
                >
                  {isStepwiseProductionTeamFlow
                    ? (
                      productionTeamStep === 'company'
                        ? t('dlgLogin.continueToRole')
                        : productionTeamStep === 'role'
                          ? t('dlgLogin.continueToTeam')
                          : t('dlgLogin.continueToPayment')
                    ) : (
                      contentProducerStep === 'company'
                        ? t('dlgLogin.continueToFocus')
                        : contentProducerStep === 'role'
                          ? t('dlgLogin.continueToTeam')
                          : t('dlgLogin.continueToPayment')
                    )}
                </Button>
              )}
            </Box>
          )}

          {shouldShowCommercialPaymentGate && (
            <Box
              sx={{
                p: { xs: 1.35, sm: 1.6 },
                borderRadius: '18px',
                bgcolor: isCommercialPaymentSatisfied
                  ? 'rgba(38,178,103,0.08)'
                  : 'rgba(17,12,34,0.78)',
                border: isCommercialPaymentSatisfied
                  ? '1px solid rgba(38,178,103,0.2)'
                  : '1px solid rgba(160,140,255,0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: isCommercialPaymentSatisfied ? 'rgba(142,255,196,0.88)' : 'rgba(184,170,226,0.74)' }}>
                {isCommercialPaymentSatisfied ? t('dlgLogin.planActivated') : 'Stripe Checkout'}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.96rem', sm: '1.02rem' }, fontWeight: 700, color: 'rgba(250,247,255,0.96)' }}>
                {isCommercialPaymentSatisfied
                  ? t('dlgLogin.paymentRegisteredFinish')
                  : t('dlgLogin.activateBeforeLoginX', { what: isProductionTeamFlow ? t('dlgLogin.theProductionTeam') : t('dlgLogin.theContentProducerPlan') })}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'rgba(210,204,228,0.72)' }}>
                {isCommercialPaymentSatisfied
                  ? t('dlgLogin.planRegisteredOn', { company: organizationCompanyName || t('dlgLogin.theCompany'), total: formatRoleRoomStatValue(planMonthlyTotal) })
                  : t('dlgLogin.stripeActivate', { n: billableSeatCount, seatWord: billableSeatCount === 1 ? t('dlgLogin.seat') : t('dlgLogin.seats'), total: formatRoleRoomStatValue(planMonthlyTotal) })}
              </Typography>
              {!isCommercialPaymentSatisfied && (
                <Button
                  type="button"
                  onClick={handleCommercialCheckout}
                  disabled={commercialPaymentPending || loading}
                  variant="contained"
                  disableElevation
                  sx={{
                    mt: 0.2,
                    minHeight: 48,
                    borderRadius: '15px',
                    textTransform: 'none',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    bgcolor: '#f6c358',
                    color: '#171410',
                    '&:hover': {
                      bgcolor: '#ffd981',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(246,195,88,0.34)',
                      color: 'rgba(23,20,16,0.48)',
                    },
                  }}
                >
                  {commercialPaymentPending ? t('dlgLogin.startingStripe') : t('dlgLogin.goToSecurePayment')}
                </Button>
              )}
            </Box>
          )}

          {/* ── Dans invite-holder: paste-flow i stedet for email/password ── */}
          {shouldShowAuthFields && selectedRole === 'dance_invite_holder' && (
            <DanceInvitePasteEntry />
          )}

          {/* ── email ── */}
          {shouldShowAuthFields && selectedRole !== 'dance_invite_holder' && (
            <>
          <TextField
            id="login-email"
            label={t('dlgLogin.emailLabel')}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            fullWidth
            autoFocus={!isLandingPage}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
            sx={glassInputSx(emailFocused)}
          />

          {/* ── password ── */}
          <TextField
            id="login-password"
            label={t('dlgLogin.passwordLabel')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            fullWidth
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
            }}
            sx={glassInputSx(passwordFocused)}
          />

          {/* ── forgot password ── */}
          {!forgotPassword ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
              <Button
                onClick={() => { setForgotPassword(true); setForgotEmail(email); }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  color: `rgba(${aR},${aG},${aB},0.70)`,
                  p: 0,
                  minWidth: 0,
                  transition: 'color 1.2s ease',
                  '&:hover': { bgcolor: 'transparent', color: `rgba(${aR},${aG},${aB},0.95)`, textDecoration: 'underline' },
                }}
              >{t('dlgLogin.forgotPassword')}</Button>
            </Box>
          ) : (
            <Box
              sx={{
                p: 1.75,
                borderRadius: '16px',
                bgcolor: 'rgba(130,110,255,0.07)',
                border: '1px solid rgba(130,110,255,0.18)',
              }}
            >
              {forgotSent ? (
                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(100,230,160,0.85)', textAlign: 'center', py: 0.5 }}>
                  {t('dlgLogin.resetLinkSent', { email: forgotEmail })}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Typography sx={{ fontSize: '0.76rem', color: 'rgba(200,190,255,0.7)', letterSpacing: '0.02em' }}>{t('dlgLogin.enterYourEmail')}</Typography>
                  <TextField
                    size="small"
                    type="email"
                    placeholder={t('dlgLogin.emailPlaceholder')}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    fullWidth
                    sx={glassInputSx(false)}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      onClick={() => setForgotPassword(false)}
                      sx={{ textTransform: 'none', fontSize: '0.77rem', color: glass.textMuted, flex: 1, borderRadius: '12px', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                    >{t('dlgLogin.cancel')}</Button>
                    <Button
                      variant="contained"
                      disableElevation
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/request-password-reset', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: forgotEmail }),
                          });
                        } catch (_) { /* ignore */ }
                        setForgotSent(true);
                      }}
                      disabled={!forgotEmail}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.77rem',
                        fontWeight: 500,
                        flex: 2,
                        borderRadius: '12px',
                        bgcolor: `rgba(${aR},${aG},${aB},0.22)`,
                        border: `1px solid rgba(${aR},${aG},${aB},0.35)`,
                        color: 'rgba(255,255,255,0.9)',
                        boxShadow: 'none',
                        transition: 'background 1.2s ease',
                        '&:hover': { bgcolor: `rgba(${aR},${aG},${aB},0.34)`, boxShadow: 'none' },
                      }}
                    >{t('dlgLogin.sendResetLink')}</Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* ── login button ── */}
          <Button
            onClick={handleLogin}
            disabled={loading}
            fullWidth
            disableElevation
            variant="contained"
            startIcon={
              !loading && !isMobile ? (
                <Box
                  component="img"
                  src="/role-room-assets/roleroom_login.webp"
                  alt=""
                  sx={{
                    width: 22,
                    height: 22,
                    minWidth: 22,
                    objectFit: 'contain',
                    opacity: 0.88,
                    // Align optically with button text (0.97rem ≈ 15.5px cap-height)
                    mt: '1px',
                  }}
                />
              ) : null
            }
            sx={{
              mt: 0.5,
              py: 1.7,
              borderRadius: '16px',
              textTransform: 'none',
              fontSize: '0.97rem',
              fontWeight: 500,
              letterSpacing: '0.01em',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
              bgcolor: 'rgba(130,110,255,0.18)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(160,140,255,0.22)',
              color: 'rgba(220,215,255,0.95)',
              boxShadow: 'none',
              position: 'relative',
              overflow: 'hidden',
              transition: `all 0.35s ${easing}`,
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)',
                pointerEvents: 'none',
              },
              '&:hover': {
                bgcolor: 'rgba(130,110,255,0.28)',
                border: '1px solid rgba(160,140,255,0.38)',
                transform: 'translateY(-1px)',
                boxShadow:
                  '0 8px 32px rgba(110,90,255,0.22), 0 0 0 1px rgba(160,140,255,0.15)',
              },
              '&:active': { transform: 'scale(0.988)' },
              '&:disabled': {
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.22)',
                boxShadow: 'none',
                '&::before': { opacity: 0 },
              },
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.5)' }} />
                <span style={{ opacity: 0.6 }}>{t('dlgLogin.loggingIn')}</span>
              </Box>
            ) : (
              ctaButtonLabel
            )}
          </Button>

          {/* ── OAuth row ── */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isLandingPage
                ? 'repeat(2, minmax(0, 1fr))'
                : 'minmax(0, 1fr)',
              gap: 1,
              mt: 0.35,
            }}
          >
              {/* Google */}
              <Button
                fullWidth
                onClick={handleGoogleLogin}
                sx={{
                  textTransform: 'none',
                  fontSize: { xs: '0.76rem', sm: '0.8rem' },
                  fontWeight: 500,
                  borderRadius: '14px',
                  minHeight: 48,
                  py: { xs: 0.95, sm: 1.1 },
                  px: { xs: 1, sm: 1.5 },
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(240,235,255,0.85)',
                  backdropFilter: 'blur(10px)',
                  gap: 0.7,
                  justifyContent: 'center',
                  transition: 'all 0.25s ease',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.22)', transform: 'translateY(-1px)' },
                  '& .MuiButton-startIcon': {
                    marginRight: 0.7,
                    marginLeft: 0,
                  },
                }}
                startIcon={
                  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 16, height: 16, flexShrink: 0 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </Box>
                }
              >
                {isLandingPage ? 'Google' : t('dlgLogin.continueWithGoogle')}
              </Button>
              {/* Feide (institusjons-innlogging) — skjuler seg selv hvis ikke konfigurert */}
              <FeideLoginButton compact={isLandingPage} />
              {/* LinkedIn */}
              {isLandingPage && (
                <Button
                  fullWidth
                  onClick={() => { window.location.href = '/api/auth/linkedin'; }}
                  sx={{
                    textTransform: 'none',
                    fontSize: { xs: '0.76rem', sm: '0.8rem' },
                    fontWeight: 500,
                    borderRadius: '14px',
                    minHeight: 48,
                    py: { xs: 0.95, sm: 1.1 },
                    px: { xs: 1, sm: 1.5 },
                    bgcolor: 'rgba(10,102,194,0.14)',
                    border: '1px solid rgba(10,102,194,0.28)',
                    color: 'rgba(130,190,255,0.9)',
                    backdropFilter: 'blur(10px)',
                    gap: 0.7,
                    justifyContent: 'center',
                    transition: 'all 0.25s ease',
                    '&:hover': { bgcolor: 'rgba(10,102,194,0.22)', border: '1px solid rgba(10,102,194,0.45)', transform: 'translateY(-1px)' },
                    '& .MuiButton-startIcon': {
                      marginRight: 0.7,
                      marginLeft: 0,
                    },
                  }}
                  startIcon={
                    <Box component="svg" viewBox="0 0 24 24" sx={{ width: 16, height: 16, flexShrink: 0 }}>
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2"/>
                    </Box>
                  }
                >
                  LinkedIn
                </Button>
              )}
          </Box>
            </>
          )}

          {/* ── cancel ── */}
          <Button
            onClick={onClose}
            disabled={loading}
            fullWidth
            sx={{
              textTransform: 'none',
              fontSize: '0.84rem',
              fontWeight: 300,
              color: glass.textMuted,
              borderRadius: '12px',
              py: 0.9,
              letterSpacing: '0.01em',
              transition: `all 0.25s ${easing}`,
              '&:hover': {
                color: glass.textSub,
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >{t('dlgLogin.cancel')}</Button>

          {/* ── guest bypass (only when demoMode is enabled in admin) ── */}
          {onGuestEnter && demoModeEnabled && (
            <Box sx={{ textAlign: 'center', mt: 0.25 }}>
              <Button
                onClick={onGuestEnter}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 400,
                  color: 'rgba(160,150,200,0.4)',
                  letterSpacing: '0.01em',
                  p: 0,
                  minWidth: 0,
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: 'rgba(180,170,220,0.7)',
                    textDecoration: 'underline',
                  },
                }}
              >{t('dlgLogin.continueWithoutLogin')}</Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* 2FA-prompt overlay — vises kun når backend returnerte needs_2fa */}
      <Dialog
        open={twoFactorState !== null}
        onClose={twoFactorSubmitting ? undefined : () => { setTwoFactorState(null); setTwoFactorCode(''); setTwoFactorError(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0b1226', color: '#f8fafc' } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 1, color: 'var(--role-cyan, #22d3ee)' }}>{t('dlgLogin.tfaTitle')}</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.72)', mb: 2 }}>
            {twoFactorState?.message}
          </Typography>
          <Box
            component="input"
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={twoFactorCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTwoFactorCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 8))
            }
            placeholder="123456"
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') void completeTwoFactorLogin();
            }}
            sx={{
              width: '100%',
              p: 1.4,
              fontSize: '1.4rem',
              fontFamily: 'monospace',
              letterSpacing: '8px',
              textAlign: 'center',
              bgcolor: 'rgba(15,23,42,0.6)',
              color: '#f8fafc',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: '8px',
              outline: 'none',
              '&:focus': { borderColor: 'var(--role-cyan, #22d3ee)' },
            }}
          />
          {twoFactorError ? (
            <Typography sx={{ color: '#f87171', fontSize: '0.82rem', mt: 1.2 }}>
              {twoFactorError}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1, mt: 2.4 }}>
            <Button
              onClick={() => { setTwoFactorState(null); setTwoFactorCode(''); setTwoFactorError(null); }}
              disabled={twoFactorSubmitting}
              sx={{ textTransform: 'none', color: '#94a3b8', flex: 1 }}
            >{t('dlgLogin.cancel')}</Button>
            <Button
              onClick={() => void completeTwoFactorLogin()}
              disabled={twoFactorSubmitting || twoFactorCode.length < 6}
              variant="contained"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                flex: 2,
                bgcolor: 'var(--role-cyan, #22d3ee)',
                color: '#0b1226',
                '&:hover': { bgcolor: '#06b6d4' },
              }}
            >
              {twoFactorSubmitting ? t('dlgLogin.verifying') : t('dlgLogin.confirm')}
            </Button>
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: 'rgba(226,232,240,0.5)', mt: 1.4 }}>{t('dlgLogin.backupCodeHint')}</Typography>
        </Box>
      </Dialog>
    </Dialog>
  );
}
