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

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react';
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
} from '@mui/material';
import {
  Close as CloseIcon,
  EmailOutlined as EmailIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import { ROLE_ROOM_BRAND_ASSETS } from '../config/branding';
import { ROLE_ROOM_LANDING_CONFIG } from '../config/landing';
import authSessionService from '../services/authSessionService';
import { googleWorkspaceApi } from '../services/castingApiService';
import { parseClientPortalIntentFromWindow } from '../utils/clientPortal';
import { parseTalentPortalIntentFromWindow } from '../utils/talentPortal';
import { getRoleRoomVideoPosterUrl, getRoleRoomVideoStillUrl } from '../utils/roleRoomMedia';
import { getRoleRoomReturnPath, isRoleRoomStandaloneRuntime } from '../utils/runtime';

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
}

type LoginPersona = '' | 'production_team' | 'content_producer';

interface RoleRoomPublicStats {
  kreative: number;
  produksjoner: number;
  rollerBesatt: number;
}

interface RoleRoomPublicTestimonial {
  id: string;
  roleId: string;
  quote: string;
  author: string;
  title: string;
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
}> = {
  admin:             { label: 'Admin',         icon: '/role-room-assets/roleroom_dashboard.webp' },
  photographer:      { label: 'Fotograf',      icon: '/role-room-assets/roleroom_photographer.webp', video: '/role-room-assets/roleroom_photographer.mov' },
  film_photographer: { label: 'Innholdsprodusent',  icon: '/role-room-assets/roleroom_filmfotograf.webp',     video: '/role-room-assets/roleroom_filmfotograf.mp4' },
  photo_director:    { label: 'Fotodirektør',  icon: '/role-room-assets/roleroom_photo_director.webp',   video: '/role-room-assets/roleroom_photo_director.mov' },
  photo_assistant:   { label: 'Fotoassistent', icon: '/role-room-assets/roleroom_photo_assistant.webp',  video: '/role-room-assets/roleroom_photo_assistant.mov' },
  director:          { label: 'Regissør',      icon: '/role-room-assets/roleroom_director.webp',         video: '/role-room-assets/roleroom_director.mp4' },
  producer:          { label: 'Produsent',     icon: '/role-room-assets/roleroom_producer.webp', video: '/role-room-assets/roleroom_producer.mp4' },
  casting_director:  { label: 'Casting Director', icon: '/role-room-assets/roleroom_casting_director.webp', video: '/role-room-assets/roleroom_casting_director.mp4', videoPosition: '60% 15%' },
  camera_operator:   { label: 'Kamera',        icon: '/role-room-assets/roleroom_cinemag.webp', video: '/role-room-assets/roleroom_cinemag.mp4' },
  talent:            { label: 'Skuespiller',   icon: '/role-room-assets/roleroom_skuespiller.webp', video: '/role-room-assets/roleroom_skuespiller.mov' },
  agent:             { label: 'Agent',         icon: '/role-room-assets/roleroom_agent.webp',            video: '/role-room-assets/roleroom_agent.mp4' },
  client:            { label: 'Klient',        icon: '/role-room-assets/roleroom_klient.webp',       video: '/role-room-assets/roleroom_klient.mov' },

  // ── Sound ─────────────────────────────────────────────────────────────
  // Drop in icon / video paths once assets are ready
  sound_designer:    { label: 'Lyddesigner',  icon: '/role-room-assets/roleroom_sound_designer.webp', video: '/role-room-assets/roleroom_sound_designer.mp4' },
  sound_mixer:       { label: 'Lydmikser', icon: '/role-room-assets/roleroom_sound_designer.webp' },
  boom_operator:     { label: 'Bom-operator', video: '/role-room-assets/roleroom_boom_operator.mp4' },
  composer:          { label: 'Komponist'    , video: '/role-room-assets/roleroom_composer.mp4' },

  // ── HOW TO ADD A NEW CARD ────────────────────────────────────────────
  // 1. Add an entry below (copy any line above as a template)
  // 2. Add its id to a category in professionCategories below
  // 3. (Optional) put the asset in /public/role-room-assets/
  //
  // my_role: { label: 'My Role', icon: '/role-room-assets/roleroom_myrole.webp', video: '/role-room-assets/roleroom_myrole.mp4', videoPosition: '40% 20%' },
};

/* ── derived lookup map used internally by the card renderer ───────── */
const roleIcons = Object.fromEntries(Object.entries(ROLE_CARDS).filter(([, v]) => v.icon).map(([k, v]) => [k, v.icon!]));

/* ── use-case scenarios shown on the left branding panel ──────────── */
const USE_CASES: { roleId: string; line: string }[] = [
  { roleId: 'photographer',     line: 'Book talent, brief crew og lever ferdige bilder' },
  { roleId: 'director',         line: 'Bygg shotliste, koordiner crew og hold deadline' },
  { roleId: 'talent',           line: 'Søk auditions og motta rolletilbud direkte' },
  { roleId: 'producer',         line: 'Planlegg innspilling og logistikk i én flyt' },
  { roleId: 'agent',            line: 'Send klienter til riktige auditions automatisk' },
  { roleId: 'casting_director', line: 'Finn rett talent til rett rolle — raskt' },
  { roleId: 'client',           line: 'Følg produksjonen fra brief til ferdig levering' },
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
  sound_designer:    { r:  60, g: 200, b: 220 },
  sound_mixer:       { r:  70, g: 190, b: 200 },
  boom_operator:     { r:  90, g: 195, b: 200 },
  composer:          { r: 145, g: 105, b: 255 },
  admin:             { r: 130, g: 110, b: 255 },
};

/* ── short taglines shown on left panel when a role is selected ── */
const ROLE_TAGLINES: Record<string, string> = {
  photographer:      'Ditt blikk. Ditt brand.',
  film_photographer: 'Hver frame, et mesterverk.',
  photo_director:    'Visuell regi — fra idé til levering.',
  photo_assistant:   'Ryggraden i ethvert fotoset.',
  director:          'Visjonen begynner her.',
  producer:          'Alt henger på deg — og du holder det.',
  casting_director:  'Rett person. Rett rolle. Hvert gang.',
  camera_operator:   'Kameraet ser det øyet overser.',
  talent:            'Din scene. Ditt øyeblikk.',
  agent:             'Du åpner dørene. De går gjennom dem.',
  client:            'Fra brief til ferdig — full oversikt.',
  sound_designer:    'Lyden folk ikke vet de hører.',
  sound_mixer:       'Perfekt balanse, hvert eneste take.',
  boom_operator:     'Det beste opptak starter med deg.',
  composer:          'Musikken som gjør bildene levende.',
  admin:             'Du holder alt i bevegelse.',
};

/* ── default testimonials ─────────────────────────────────────── */
const DEFAULT_TESTIMONIALS: { roleId: string; quote: string; author: string; title: string }[] = [
  { roleId: 'casting_director', quote: 'The Role Room sparte meg 3 timer per casting-runde.',   author: 'Maria H.',   title: 'Casting Director' },
  { roleId: 'director',         quote: 'Endelig én plass for shotliste, crew og manus.',          author: 'Eskil T.',   title: 'Regissør' },
  { roleId: 'photographer',     quote: 'Jeg booker talent og briefer crew på 10 minutter.',       author: 'Lena K.',    title: 'Fotograf' },
  { roleId: 'producer',         quote: 'Produksjonskalenderen alene er verdt alt.',               author: 'Jonas W.',   title: 'Produsent' },
  { roleId: 'talent',           quote: 'Jeg fikk min første rolle via audition-portalen her.',    author: 'Camilla R.', title: 'Skuespiller' },
  { roleId: 'agent',            quote: 'Klientene mine finner riktige auditions automatisk.',      author: 'Henrik B.',  title: 'Agent' },
  { roleId: 'client',           quote: 'Full oversikt fra dag én — uten e-postkjeder.',           author: 'Sofie N.',   title: 'Klient' },
];

const ROLE_ROOM_PUBLIC_STATS_ENDPOINT = '/api/role-room/public/stats';
const ROLE_ROOM_STATS_REFRESH_MS = 15_000;
const ROLE_ROOM_PUBLIC_TESTIMONIALS_ENDPOINT = '/api/role-room/public/testimonials';
const ROLE_ROOM_TESTIMONIALS_REFRESH_MS = 60_000;
const CONTENT_PRODUCER_ROLE_IDS = new Set(['film_photographer', 'client']);

function formatRoleRoomStatValue(value: number): string {
  return value.toLocaleString('nb-NO');
}

function deriveLoginPersonaForRole(roleId: string): LoginPersona {
  if (!roleId) {
    return '';
  }

  return CONTENT_PRODUCER_ROLE_IDS.has(roleId)
    ? 'content_producer'
    : 'production_team';
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

/* ── categories: list role ids — all card data lives in ROLE_CARDS ─── *
 * HOW TO ADD A NEW CATEGORY:                                         *
 * 1. Add a new object: { id: 'my_cat', label: 'My Cat', roleIds: [] }
 * 2. Fill roleIds with ids that exist in ROLE_CARDS above            *
 * 3. That’s it — the grid renders automatically                      *
 * ─────────────────────────────────────────────────────────────────── */
const professionCategories = [
  { id: 'admin',  label: 'Admin', roleIds: ['admin'] },
  { id: 'foto',   label: 'Foto',  roleIds: ['photographer', 'film_photographer', 'photo_director', 'photo_assistant'] },
  { id: 'video',  label: 'Video', roleIds: ['director', 'producer', 'casting_director', 'camera_operator'] },
  { id: 'lyd',    label: 'Lyd',   roleIds: ['sound_designer', 'sound_mixer', 'boom_operator', 'composer'] },
  { id: 'felles', label: 'Andre', roleIds: ['talent', 'agent', 'client'] },
];

const allRoles = Object.entries(ROLE_CARDS).map(([id, v]) => ({ id, label: v.label }));

const LOGIN_PERSONA_OPTIONS: ReadonlyArray<{
  id: Exclude<LoginPersona, ''>;
  label: string;
  description: string;
}> = [
  {
    id: 'production_team',
    label: 'Produksjonsteam',
    description: 'For crew, planlegging og live set',
  },
  {
    id: 'content_producer',
    label: 'Innholdsprodusent',
    description: 'For innhold, storyboard og leveranser',
  },
];

const CONTENT_PRODUCER_ACCESS_OPTIONS: ReadonlyArray<{
  id: 'film_photographer' | 'client';
  label: string;
  description: string;
}> = [
  {
    id: 'film_photographer',
    label: 'Innholdsprodusent',
    description: 'Planlegg, produser og lever innhold',
  },
  {
    id: 'client',
    label: 'Klient',
    description: 'Legg inn brief, materiale og godkjenning',
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
    maxWidthDesktop:  'min(96vw, 1440px)',
    maxWidthMobile:   'min(96vw, 480px)',
    minHeightDesktop: 540,
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

/* ──────────────────── RoleChip sub-component ───────────────────── */

function RoleChip({
  role,
  selected,
  onSelect,
  video,
  videoPosition,
  compact = false,
}: {
  role: { id: string; label: string };
  selected: boolean;
  onSelect: (id: string) => void;
  video?: string;
  videoPosition?: string;
  compact?: boolean;
}) {
  const shortLabel = role.label.split(' ')[0];
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
        aspectRatio: compact ? '1 / 1.08' : DESIGN.card.aspectRatio,
        borderRadius: compact ? '12px' : DESIGN.card.borderRadius,
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
          ? `0 0 0 1px ${DESIGN.p.shadowRing}, 0 8px 40px ${DESIGN.p.glowInner}, 0 2px 0 ${DESIGN.p.glowInset} inset`
          : `0 4px 24px rgba(0,0,0,0.7), 0 1px 0 ${DESIGN.p.shadowIdle} inset`,
        animation: selected ? `${pulseGlow} ${DESIGN.card.pulseGlowDuration} ease-in-out infinite` : 'none',
        '&:hover': {
          transform: compact ? 'translateY(-4px) scale(1.02)' : DESIGN.card.hoverTransform,
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
          alt={role.label}
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
          alt={role.label}
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

      {/* ── top-left corner index ── */}
      {!compact && (
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
      {!compact && (
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
        height: compact ? '27%' : '30%', zIndex: 2,
        background: selected
          ? `linear-gradient(to top, ${DESIGN.p.labelBgSelInner} 0%, ${DESIGN.p.labelBgSelOuter} 55%, transparent 100%)`
          : 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: compact ? 0.6 : 0.75, pt: compact ? 1.4 : 2,
        borderTop: selected ? `1px solid ${DESIGN.p.labelBorderSelected}` : `1px solid ${DESIGN.p.labelBorderIdle}`,
      }}>
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
          {role.label}
        </Typography>
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
}: {
  category: (typeof professionCategories)[number];
  selectedRole: string;
  onSelect: (id: string) => void;
  isMobile: boolean;
  compact?: boolean;
}) {
  // 4 cols desktop / 2 mobile — all roles in one row
  const cols = isMobile ? DESIGN.grid.colsMobile : DESIGN.grid.colsDesktop;

  return (
    <Box>
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: glass.textMuted,
          mb: 0.75,
          pl: 0.25,
        }}
      >
        {category.label}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: DESIGN.grid.gap,
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

/* ════════════════════════ LoginDialog ═════════════════════════════ */

export default function LoginDialog({
  open,
  onClose,
  onLoginSuccess,
  isLandingPage = false,
  onGuestEnter,
}: LoginDialogProps) {
  const isMobile = useMediaQuery('(max-width:639px)');
  const isFullScreen = useMediaQuery('(max-width:479px)');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loginPersona, setLoginPersona] = useState<LoginPersona>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
  const hasSeenHint = useRef(false);
  const clientPortalIntent = parseClientPortalIntentFromWindow();
  const talentPortalIntent = parseTalentPortalIntentFromWindow();
  const backdropStillUrl = getRoleRoomVideoStillUrl(DESIGN.backdrop.src, '/role-room-assets/landing_backdrop.webp');

  useEffect(() => {
    setBackdropVideoReady(false);
    setBackdropVideoFailed(false);
  }, [open]);

  const visibleProfessionCategories =
    loginPersona === 'content_producer'
      ? professionCategories
          .map((category) => ({
            ...category,
            roleIds: category.roleIds.filter(
              (id) => id === 'film_photographer' || id === 'client'
            ),
          }))
          .filter((category) => category.roleIds.length > 0)
      : professionCategories;

  const loginEyebrow = ROLE_ROOM_LANDING_CONFIG.login.eyebrowText;
  const loginTitle = ROLE_ROOM_LANDING_CONFIG.login.title;
  const loginSubtitle = ROLE_ROOM_LANDING_CONFIG.login.subtitle;

  /* parse "roleId|Description" lines — fall back to compiled defaults */
  const activeUseCases: { roleId: string; line: string }[] = (() => {
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
    if (shouldShowRoleRoomStats && roleRoomPublicStats) {
      return [
        { value: formatRoleRoomStatValue(roleRoomPublicStats.kreative), label: 'kreative' },
        { value: formatRoleRoomStatValue(roleRoomPublicStats.produksjoner), label: 'produksjoner' },
        { value: formatRoleRoomStatValue(roleRoomPublicStats.rollerBesatt), label: 'roller besatt' },
      ];
    }
    return [];
  })();

  /* ── testimonials from visual editor or defaults ── */
  const activeTestimonials = (() => {
    if (Array.isArray(roleRoomPublicTestimonials) && roleRoomPublicTestimonials.length > 0) {
      return roleRoomPublicTestimonials;
    }
    return DEFAULT_TESTIMONIALS;
  })();

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
  // demoMode defaults to true — switched OFF in admin hides the guest bypass
  const demoModeEnabled = ROLE_ROOM_LANDING_CONFIG.demoModeEnabled;
  const shouldUseStandaloneDemoAuth = demoModeEnabled && isRoleRoomStandaloneRuntime();

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
      const t = setTimeout(() => {
        setEmail('');
        setPassword('');
        setSelectedRole('');
        setLoginPersona('');
        setError('');
        setLoading(false);
        setForgotPassword(false);
        setForgotEmail('');
        setForgotSent(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (testimonialIdx < activeTestimonials.length) {
      return;
    }
    setTestimonialIdx(0);
  }, [activeTestimonials.length, testimonialIdx]);

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
    if (loginPersona === 'content_producer') {
      if (!selectedRole) {
        setSelectedRole('film_photographer');
        return;
      }
      if (selectedRole !== 'film_photographer' && selectedRole !== 'client') {
        setSelectedRole('film_photographer');
      }
      return;
    }

    if (!isLandingPage && (selectedRole === 'film_photographer' || selectedRole === 'client')) {
      setSelectedRole('');
    }
  }, [isLandingPage, loginPersona, selectedRole]);

  useEffect(() => {
    if (!isLandingPage || !selectedRole) {
      return;
    }

    const derivedPersona = deriveLoginPersonaForRole(selectedRole);
    if (derivedPersona && loginPersona !== derivedPersona) {
      setLoginPersona(derivedPersona);
    }
  }, [isLandingPage, loginPersona, selectedRole]);

  /* submit */
  const handleLogin = useCallback(async () => {
    if (loading) return;
    const effectiveLoginPersona = getEffectiveLoginPersona(selectedRole, loginPersona);

    if (!email.trim() || !password) {
      setError('E-post og passord er påkrevd');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Vennligst oppgi en gyldig e-postadresse');
      return;
    }
    if (isLandingPage && !selectedRole) {
      setError('Velg en rolle for å fortsette');
      return;
    }
    if (!effectiveLoginPersona) {
      setError('Velg om du logger inn som Produksjonsteam eller Innholdsprodusent');
      return;
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
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      const request = fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: selectedRole,
          loginAs: effectiveLoginPersona || undefined,
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
      } = await Promise.race([request, timeout]);

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
        onLoginSuccess(normalizedUser);
      } else {
        setError(data.detail ?? data.error ?? 'Ugyldig e-post eller passord');
      }
    } catch {
      await completeLocalLogin();
    } finally {
      setLoading(false);
    }
  }, [loading, email, password, selectedRole, loginPersona, isLandingPage, onLoginSuccess, shouldUseStandaloneDemoAuth]);

  const handleGoogleLogin = useCallback(async () => {
    if (loading) return;
    const effectiveLoginPersona = getEffectiveLoginPersona(selectedRole, loginPersona);
    if (!effectiveLoginPersona) {
      setError('Velg om du logger inn som Produksjonsteam eller Innholdsprodusent');
      return;
    }
    if (isLandingPage && !selectedRole) {
      setError('Velg en rolle for å fortsette');
      return;
    }

    setLoading(true);
    setError('');

    try {
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
        throw new Error('Mangler autorisasjonslenke fra Google Workspace');
      }

      window.location.assign(response.authorizationUrl);
    } catch (googleError) {
      setLoading(false);
      setError(googleError instanceof Error ? googleError.message : 'Kunne ikke starte Google-innlogging');
    }
  }, [loading, loginPersona, isLandingPage, selectedRole, clientPortalIntent?.projectId, email]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleLogin();
    }
  };

  const selectedRoleLabel = allRoles.find((r) => r.id === selectedRole)?.label;
  const showPersonaChooserInLeftPanel = isLandingPage && !isMobile;
  const showPersonaChooserInRightPanel = true;
  const showContentProducerAccessChooser = loginPersona === 'content_producer';
  const loginPersonaChooser = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'rgba(225,218,246,0.95)',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}
      >
        Logg inn som
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
                if (option.id === 'production_team' && CONTENT_PRODUCER_ROLE_IDS.has(selectedRole)) {
                  setSelectedRole('producer');
                }
                if (option.id === 'content_producer' && !CONTENT_PRODUCER_ROLE_IDS.has(selectedRole)) {
                  setSelectedRole('film_photographer');
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
                  {option.label}
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
                  {option.description}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>
    </Box>
  );
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
      >
        Tilgang
      </Typography>
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
                  {option.label}
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
                  {option.description}
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
        aria-label="Lukk"
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
            width: isMobile ? '100%' : '42%',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 2.5, sm: 4 },
            pt: isMobile ? 2.75 : 5,
            pb: isMobile ? 2.25 : 5,
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
              width: { xs: 'min(168px, 46vw)', sm: '60%', md: '72%', lg: '82%' },
              height: 'auto',
              objectFit: 'contain',
              mb: { xs: 1.25, sm: 2 },
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 6px 28px rgba(130,110,255,0.28))',
            }}
          />

          {/* eyebrow label */}
          <Typography
            sx={{
              letterSpacing: '0.2em',
              fontSize: { xs: '0.6rem', sm: '0.75rem', md: '0.85rem', lg: '0.95rem' },
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'rgba(180,165,255,0.55)',
              textAlign: 'center',
              mb: 0.15,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {isLandingPage ? loginEyebrow : 'Administrasjon'}
          </Typography>

          {/* title */}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.34rem', sm: '2rem', md: '2.4rem', lg: '2.8rem' },
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
            {isLandingPage ? loginTitle : 'Logg inn'}
          </Typography>

          {/* subtitle */}
          <Typography
            sx={{
              mt: 0.6,
              color: 'rgba(200,195,220,0.65)',
              fontSize: { xs: '0.78rem', sm: '0.95rem', md: '1.05rem', lg: '1.15rem' },
              fontWeight: 300,
              letterSpacing: '0.015em',
              textAlign: 'center',
              maxWidth: { xs: 250, md: 300, lg: 340 },
              lineHeight: 1.45,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {isLandingPage
              ? loginSubtitle
              : 'Logg inn for å administrere The Role Room'}
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
                    {s.label}
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
                maxWidth: { xs: 260, md: 320, lg: 390, xl: 440 },
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
                    px: { xs: 1.5, md: 2, lg: 2.5, xl: 3 },
                    py: { xs: 1.25, md: 1.75, lg: 2.25, xl: 2.75 },
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
                    {ROLE_CARDS[selectedRole]?.label ?? selectedRole}
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
                    {ROLE_TAGLINES[selectedRole] ?? ''}
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
                    px: { xs: 1.5, md: 2, lg: 2.5, xl: 3 },
                    py: { xs: 1.25, md: 1.75, lg: 2.25, xl: 2.75 },
                    borderRadius: '18px',
                    bgcolor: 'rgba(130,110,255,0.08)',
                    border: '1px solid rgba(130,110,255,0.18)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.25, lg: 1.5 } }}>
                    {ROLE_CARDS[activeUseCases[ucIdx].roleId]?.icon && (
                      <Box
                        component="img"
                        src={ROLE_CARDS[activeUseCases[ucIdx].roleId].icon}
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
                      {ROLE_CARDS[activeUseCases[ucIdx].roleId]?.label ?? activeUseCases[ucIdx].roleId}
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
                    {activeUseCases[ucIdx].line}
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
                    &ldquo;{activeTestimonials[testimonialIdx]?.quote}&rdquo;
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
                    — {activeTestimonials[testimonialIdx]?.author},&nbsp;{activeTestimonials[testimonialIdx]?.title}
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
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: { xs: 2.25, sm: 4, md: 5 },
            py: { xs: 2.25, sm: 3 },
            gap: isLandingPage ? 1.5 : 2,
            overflowY: 'auto',
            maxHeight: isFullScreen ? 'calc(100vh - 132px)' : '100%',
          }}
        >
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

          {/* ── login persona chooser ── */}
          {showPersonaChooserInRightPanel && loginPersonaChooser}
          {contentProducerAccessChooser}

          {/* ── role picker ── */}
          {isLandingPage && (
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
              {!hasSeenHint.current && !selectedRole && (
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
                  >
                    Start her
                  </Typography>
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
                Velg din rolle
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.15,
                  ...(isMobile
                    ? {
                        maxHeight: 'min(42vh, 360px)',
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
                    compact={isMobile}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* ── email ── */}
          <TextField
            id="login-email"
            label="E-post"
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
            label="Passord"
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
              >
                Glemt passord?
              </Button>
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
                  ✓ Tilbakestillingslenke sendt til {forgotEmail}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Typography sx={{ fontSize: '0.76rem', color: 'rgba(200,190,255,0.7)', letterSpacing: '0.02em' }}>
                    Skriv inn e-postadressen din
                  </Typography>
                  <TextField
                    size="small"
                    type="email"
                    placeholder="din@epost.no"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    fullWidth
                    sx={glassInputSx(false)}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      onClick={() => setForgotPassword(false)}
                      sx={{ textTransform: 'none', fontSize: '0.77rem', color: glass.textMuted, flex: 1, borderRadius: '12px', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                    >
                      Avbryt
                    </Button>
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
                    >
                      Send tilbakestillingslenke
                    </Button>
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
                <span style={{ opacity: 0.6 }}>Logger inn…</span>
              </Box>
            ) : (
              ctaButtonLabel
            )}
          </Button>

          {/* ── OAuth row ── */}
          {isLandingPage && (
            <Box sx={{ display: 'flex', gap: 1.25, mt: 0.25 }}>
              {/* Google */}
              <Button
                fullWidth
                onClick={handleGoogleLogin}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  borderRadius: '14px',
                  py: 1.1,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(240,235,255,0.85)',
                  backdropFilter: 'blur(10px)',
                  gap: 0.9,
                  transition: 'all 0.25s ease',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.22)', transform: 'translateY(-1px)' },
                }}
                startIcon={
                  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 17, height: 17, flexShrink: 0 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </Box>
                }
              >
                Google
              </Button>
              {/* LinkedIn */}
              <Button
                fullWidth
                onClick={() => { window.location.href = '/api/auth/linkedin'; }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  borderRadius: '14px',
                  py: 1.1,
                  bgcolor: 'rgba(10,102,194,0.14)',
                  border: '1px solid rgba(10,102,194,0.28)',
                  color: 'rgba(130,190,255,0.9)',
                  backdropFilter: 'blur(10px)',
                  gap: 0.9,
                  transition: 'all 0.25s ease',
                  '&:hover': { bgcolor: 'rgba(10,102,194,0.22)', border: '1px solid rgba(10,102,194,0.45)', transform: 'translateY(-1px)' },
                }}
                startIcon={
                  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 17, height: 17, flexShrink: 0 }}>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2"/>
                  </Box>
                }
              >
                LinkedIn
              </Button>
            </Box>
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
          >
            Avbryt
          </Button>

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
              >
                Fortsett uten innlogging
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
