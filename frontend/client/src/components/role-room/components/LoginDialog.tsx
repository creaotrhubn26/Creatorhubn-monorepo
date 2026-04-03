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
  MenuItem,
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
import { ROLE_ROOM_EDUCATION_PATH, getRoleRoomReturnPath, isRoleRoomStandaloneRuntime } from '../utils/runtime';

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

type LoginPersona = '' | 'production_team' | 'content_producer' | 'education_institution';
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
  education_institution: { label: 'Utdanningsinstitusjon', icon: ROLE_ROOM_BRAND_ASSETS.appLogo },

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
  { roleId: 'education_institution', line: 'La studenter, lærere og bransje jobbe i samme produksjonsflyt' },
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
  photographer:      'Ditt blikk. Ditt brand.',
  film_photographer: 'Brief, produksjon og levering i ett arbeidsrom.',
  photo_director:    'Visuell regi — fra idé til levering.',
  photo_assistant:   'Ryggraden i ethvert fotoset.',
  director:          'Fra storyboard til levering uten verktøykaos.',
  producer:          'Alt henger på deg — og du holder det.',
  casting_director:  'Rett person. Rett rolle. Hvert gang.',
  camera_operator:   'Skyt, koordiner og lever i samme flyt.',
  talent:            'Din scene. Ditt øyeblikk.',
  agent:             'Du åpner dørene. De går gjennom dem.',
  client:            'Fra brief til ferdig — full oversikt.',
  education_institution: 'Fra kull til produksjon, i samme arbeidsrom.',
  sound_designer:    'Lydarbeid og leveranse uten friksjon i små team.',
  sound_mixer:       'Perfekt balanse, hvert eneste take.',
  boom_operator:     'Det beste opptak starter med deg.',
  composer:          'Musikk, versjoner og godkjenning i samme prosjekt.',
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
  { roleId: 'education_institution', quote: 'Studentene våre fikk en faktisk produksjonsflyt å jobbe i, ikke bare flere løse verktøy.', author: 'Ragnhild E.', title: 'Programansvarlig' },
];
const CONTENT_PRODUCER_TESTIMONIALS: { roleId: string; quote: string; author: string; title: string }[] = [
  { roleId: 'film_photographer', quote: 'Jeg samler brief, produksjon og levering i ett arbeidsrom i stedet for fem verktøy.', author: 'Mina T.', title: 'Innholdsprodusent' },
  { roleId: 'photographer', quote: 'For små team er forskjellen enorm når kunde, filer og godkjenninger henger sammen fra dag én.', author: 'Sander H.', title: 'Fotograf' },
  { roleId: 'director', quote: 'Vi beveger oss raskere fra storyboard til opptak når hele teamet jobber i samme flyt.', author: 'Elise K.', title: 'Regissør' },
  { roleId: 'camera_operator', quote: 'Det føles bygget for små produksjoner som må levere raskt uten å miste oversikt.', author: 'Tobias L.', title: 'Kamera' },
  { roleId: 'sound_designer', quote: 'Selv når vi er få personer, er det tydelig hvem som gjør hva og hva som er klart til levering.', author: 'Mari A.', title: 'Lyddesigner' },
  { roleId: 'composer', quote: 'Det gir ro å vite at musikk, versjoner og godkjenninger er koblet til samme prosjekt.', author: 'Joakim R.', title: 'Komponist' },
];
const CONTENT_PRODUCER_USE_CASES: { roleId: string; line: string }[] = [
  { roleId: 'film_photographer', line: 'Samle brief, storyboard, opptak og levering i én flyt for solo creators og små team.' },
  { roleId: 'photographer', line: 'Hold kunder, filer og godkjenninger tett på uten å hoppe mellom løse verktøy.' },
  { roleId: 'director', line: 'Planlegg produksjon, shotlist og samarbeid i samme rom som leveransen faktisk skjer i.' },
  { roleId: 'camera_operator', line: 'Gi små videoteam en raskere og mer strukturert produksjonsflyt fra brief til eksport.' },
];
const DECISION_ROLE_SPOTLIGHTS: Partial<Record<string, {
  eyebrow: string;
  summary: string;
}>> = {
  film_photographer: {
    eyebrow: 'Hovedinngang',
    summary: 'For solo creators og små team som vil samle brief, opptak og levering i samme rom.',
  },
  photographer: {
    eyebrow: 'Foto & stills',
    summary: 'For produksjoner som må håndtere kunder, godkjenninger og leveranser uten ekstra prosjektverktøy.',
  },
  director: {
    eyebrow: 'Regi & storyboard',
    summary: 'For deg som leder visjon, plan og samarbeid fra idé til siste leveranse.',
  },
  camera_operator: {
    eyebrow: 'Video & capture',
    summary: 'For små videoteam som trenger fart, struktur og tydelig ansvar i samme arbeidsflyt.',
  },
  sound_designer: {
    eyebrow: 'Utvid senere',
    summary: 'Legg til lydarbeid når prosjektet krever mer kapasitet, uten å endre flyten.',
  },
  composer: {
    eyebrow: 'Utvid senere',
    summary: 'Koble musikk, versjoner og godkjenninger direkte til prosjektet når teamet vokser.',
  },
  producer: {
    eyebrow: 'Teamleder',
    summary: 'For produksjoner der produsenten holder sammen plan, fremdrift, bemanning og levering.',
  },
  casting_director: {
    eyebrow: 'Castingflyt',
    summary: 'For produksjoner som trenger tett samarbeid mellom roller, auditioner og planlegging.',
  },
  photo_director: {
    eyebrow: 'Visuell ledelse',
    summary: 'For team som bygger produksjonen rundt visuelt uttrykk, kamera og lysrigg.',
  },
  photo_assistant: {
    eyebrow: 'Utvid senere',
    summary: 'Legg til ekstra kapasitet når settet vokser og teamet trenger tydelig støttefunksjon.',
  },
  sound_mixer: {
    eyebrow: 'Lydteam',
    summary: 'Koble på miks og teknisk lydansvar når produksjonen trenger mer avansert lydflyt.',
  },
  boom_operator: {
    eyebrow: 'Lydteam',
    summary: 'For opptak der lyd jobber tett sammen med resten av crewet i samme plan og fremdrift.',
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
  { id: 'company', label: 'Bedrift', description: 'Verifiser foretaket før oppsettet åpnes.' },
  { id: 'role', label: 'Fokus', description: 'Velg hovedrollen som best beskriver hvordan dere jobber.' },
  { id: 'team', label: 'Team', description: 'Sett opp kontoeier, eventuelle ekstra plasser og plan.' },
  { id: 'auth', label: 'Betaling', description: 'Aktiver planen i Stripe før innlogging åpnes.' },
];
const PRODUCTION_TEAM_ONBOARDING_STEPS: ReadonlyArray<{
  id: ProductionTeamOnboardingStep;
  label: string;
  description: string;
}> = [
  { id: 'company', label: 'Bedrift', description: 'Verifiser foretaket før produksjonsteamet åpnes.' },
  { id: 'role', label: 'Rolle', description: 'Velg hvilken rolle som leder produksjonen inn i plattformen.' },
  { id: 'team', label: 'Team', description: 'Legg inn minst tre personer, fordel roller og se planoppsummeringen.' },
  { id: 'auth', label: 'Betaling', description: 'Aktiver planen i Stripe før innlogging åpnes.' },
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
const EDUCATION_INSTITUTION_TYPES: ReadonlyArray<{
  id: Exclude<EducationInstitutionType, ''>;
  label: string;
}> = [
  { id: 'upper_secondary', label: 'Videregående skole' },
  { id: 'folk_high_school', label: 'Folkehøyskole' },
  { id: 'vocational_college', label: 'Fagskole' },
  { id: 'higher_education', label: 'Høyskole / universitet' },
  { id: 'private_school', label: 'Privat skole / kursaktør' },
];
const EDUCATION_STUDENT_SEAT_OPTIONS: ReadonlyArray<{
  id: Exclude<EducationSeatRange, ''>;
  label: string;
}> = [
  { id: 'up_to_15', label: 'Opptil 15 studenter' },
  { id: 'up_to_30', label: '16–30 studenter' },
  { id: 'up_to_60', label: '31–60 studenter' },
  { id: 'up_to_120', label: '61–120 studenter' },
  { id: 'more_than_120', label: '120+ studenter' },
];
const EDUCATION_STAFF_SEAT_OPTIONS: ReadonlyArray<{
  id: Exclude<EducationSeatRange, ''>;
  label: string;
}> = [
  { id: 'up_to_15', label: '1–2 faglærere / koordinatorer' },
  { id: 'up_to_30', label: '3–5 faglærere / koordinatorer' },
  { id: 'up_to_60', label: '6–10 faglærere / koordinatorer' },
  { id: 'up_to_120', label: '11–20 faglærere / koordinatorer' },
  { id: 'more_than_120', label: '20+ faglærere / koordinatorer' },
];
const EDUCATION_START_WINDOW_OPTIONS: ReadonlyArray<{
  id: Exclude<EducationStartWindow, ''>;
  label: string;
}> = [
  { id: 'this_semester', label: 'Så snart som mulig' },
  { id: 'next_semester', label: 'Neste semester' },
  { id: 'next_academic_year', label: 'Neste studieår' },
  { id: 'exploring', label: 'Vi sonderer fortsatt' },
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
    return 'Ikke satt ennå';
  }
  return options.find((option) => option.id === value)?.label || 'Ikke satt ennå';
}

function getEducationStartWindowLabel(value: EducationStartWindow): string {
  if (!value) {
    return 'Ikke satt ennå';
  }
  return EDUCATION_START_WINDOW_OPTIONS.find((option) => option.id === value)?.label || 'Ikke satt ennå';
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
  { id: 'admin',  label: 'Admin', roleIds: ['admin'] },
  { id: 'foto',   label: 'Foto',  roleIds: ['photographer', 'film_photographer', 'photo_director', 'photo_assistant'] },
  { id: 'video',  label: 'Video', roleIds: ['director', 'producer', 'casting_director', 'camera_operator'] },
  { id: 'lyd',    label: 'Lyd',   roleIds: ['sound_designer', 'sound_mixer', 'boom_operator', 'composer'] },
  { id: 'felles', label: 'Andre', roleIds: ['talent', 'agent', 'client'] },
];
const contentProducerCategories = [
  {
    id: 'kjerne',
    label: 'Hovedfokus',
    description: 'Velg inngangen som best beskriver hvordan du tar inn brief, produserer og leverer for kunder.',
    roleIds: ['film_photographer', 'photographer', 'director', 'camera_operator'],
  },
  {
    id: 'utvid',
    label: 'Utvid ved behov',
    description: 'Disse kan legges til senere når leveransen trenger lyd, musikk eller mer spesialisert kapasitet.',
    roleIds: ['sound_designer', 'composer'],
  },
] as const;
const productionTeamCategories = [
  {
    id: 'kjerne',
    label: 'Kjerne & ledelse',
    description: 'Start med rollen som best beskriver hvem som leder produksjonen og eier hovedflyten i prosjektet.',
    roleIds: ['producer', 'director', 'casting_director', 'photo_director'],
  },
  {
    id: 'produksjon',
    label: 'Crew & capture',
    description: 'Legg til opptak, foto og settkapasitet når teamet settes opp i neste steg.',
    roleIds: ['camera_operator', 'photographer', 'photo_assistant'],
  },
  {
    id: 'utvid',
    label: 'Lyd & musikk',
    description: 'Aktiver spesialiserte lydroller når produksjonen trenger miks, boom eller originalmusikk.',
    roleIds: ['sound_designer', 'sound_mixer', 'boom_operator', 'composer'],
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
    label: 'Produksjonsteam',
    description: 'For crew, planlegging og live set',
  },
  {
    id: 'content_producer',
    label: 'Innholdsprodusent',
    description: 'For innhold, storyboard og leveranser',
  },
  {
    id: 'education_institution',
    label: 'Utdanningsinstitusjon',
    description: 'For skoler, kull og praksisnære produksjoner',
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
  const shortLabel = role.label.split(' ')[0];
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
            {spotlight.eyebrow}
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
                {role.label}
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
                  {spotlight.summary}
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
              {role.label}
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
        {category.label}
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
          {category.description}
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

/* ════════════════════════ LoginDialog ═════════════════════════════ */

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

  useEffect(() => {
    setBackdropVideoReady(false);
    setBackdropVideoFailed(false);
    if (!open) {
      persistedCommercialSetupRef.current = '';
      restoredCommercialDraftRef.current = false;
      handledCheckoutSessionRef.current = '';
    }
  }, [open]);

  const loginEyebrow = ROLE_ROOM_LANDING_CONFIG.login.eyebrowText;
  const loginTitle = ROLE_ROOM_LANDING_CONFIG.login.title;
  const loginSubtitle = ROLE_ROOM_LANDING_CONFIG.login.subtitle;
  const effectiveLoginPersona = getEffectiveLoginPersona(selectedRole, loginPersona);
  const requiresCommercialSetup =
    isLandingPage && !clientPortalIntent && !talentPortalIntent;
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
      : null;
  const visibleProfessionCategories = allowedRoleIds
    ? (
      isStepwiseContentProducerFlow
        ? contentProducerCategories
        : isStepwiseProductionTeamFlow
          ? productionTeamCategories
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
    ? 'Teamleder'
    : isEducationInstitutionFlow
      ? 'Institusjonsansvarlig'
      : 'Kontoeier';
  const buildCommercialSetupPayload = useCallback((
    persona: Exclude<LoginPersona, '' | 'education_institution'>,
  ) => {
    const normalizedMembers = productionTeamMembers
      .map((member, index) => {
        const roleLabel = allRoles.find((entry) => entry.id === member.roleId)?.label || member.roleId;
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
      orgLookupAbortRef.current?.abort();
      const t = setTimeout(() => {
        setEmail('');
        setPassword('');
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
        setEducationInquirySubmitted(null);
        setContentProducerStep('company');
        setProductionTeamStep('company');
        setError('');
        setLoading(false);
        setForgotPassword(false);
        setForgotEmail('');
        setForgotSent(false);
        setProductionTeamMembers(createInitialTeamMembers());
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

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
          throw new Error(payload.error || 'Kunne ikke verifisere foretaket');
        }

        const companyName = payload.data?.companyName?.trim();
        const isVerified = Boolean(payload.data?.brregVerified && companyName);

        if (!isVerified || !companyName) {
          throw new Error('Fant ikke foretaket i Brønnøysundregistrene');
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
            : 'Kunne ikke verifisere organisasjonsnummeret',
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
      setError('Velg om dette er Produksjonsteam, Innholdsprodusent eller Utdanningsinstitusjon');
      return false;
    }
    if (!hasVerifiedOrganization) {
      setError('Legg inn et gyldig organisasjonsnummer og verifiser foretaket før du fortsetter');
      return false;
    }
    if (!selectedRole) {
      setError('Velg rollen til den som leder kontoen før du fortsetter');
      return false;
    }
    if (persona === 'education_institution') {
      if (!teamOwner.name.trim() || !teamOwner.email.trim()) {
        setError('Fyll inn navn og e-post til institusjonsansvarlig');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teamOwner.email.trim())) {
        setError('Kontaktpersonen må ha en gyldig e-postadresse');
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
        setError('Fullfør institusjonsoppsettet før du sender forespørselen');
        return false;
      }
      return true;
    }
    if (productionTeamMembers.length < minimumSeatCount) {
      setError(
        persona === 'production_team'
          ? `Produksjonsteam må ha minst ${PRODUCTION_TEAM_MIN_MEMBERS} personer`
          : 'Legg inn minst én person i innholdsprodusent-teamet',
      );
      return false;
    }
    const incompleteMember = productionTeamMembers.find((member) => !isTeamMemberComplete(member));
    if (incompleteMember) {
      setError('Fyll inn navn, e-post og rolle for alle som skal inn i planen');
      return false;
    }
    const invalidEmailMember = productionTeamMembers.find((member) => (
      member.email.trim()
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email.trim())
    ));
    if (invalidEmailMember) {
      setError('Alle teammedlemmer må ha gyldige e-postadresser');
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
      throw new Error(result.error || 'Kunne ikke lagre Role Room-oppsettet');
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
        'Betalingen er registrert. Du kan nå fortsette til innlogging.',
    });
  }, []);

  const handleCommercialCheckout = useCallback(async () => {
    if (commercialPaymentPending || loading) {
      return;
    }

    const persona = effectiveLoginPersona;
    if (!persona || persona === 'education_institution') {
      setError('Velg Produksjonsteam eller Innholdsprodusent før du går til betaling.');
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
          message: 'Betaling er allerede registrert på dette teamoppsettet.',
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
        throw new Error(result.error || 'Kunne ikke starte Stripe Checkout');
      }

      if (result.alreadyPaid || result.paymentCompleted) {
        markCommercialPaymentComplete(commercialSetupSignature, {
          message: 'Betalingen er allerede registrert på dette teamoppsettet.',
        });
        return;
      }

      if (!result.checkoutUrl) {
        throw new Error('Mangler checkout-url fra Stripe Checkout');
      }

      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Kunne ikke starte Stripe Checkout',
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

    setLoading(true);
    setError('');

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
        }),
      });
      const result = await response.json() as RoleRoomEducationInquiryResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Kunne ikke sende institusjonsforespørselen');
      }

      setEducationInquirySubmitted({
        requestId: result.requestId ?? null,
        notificationEmailSent: Boolean(result.notificationEmailSent),
        message:
          result.message ||
          'Forespørselen er mottatt. Vi tar kontakt for å avtale neste steg.',
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Kunne ikke sende institusjonsforespørselen',
      );
    } finally {
      setLoading(false);
    }
  }, [
    educationContactRole,
    educationDesiredStartWindow,
    educationInstitutionType,
    educationProgramName,
    educationStaffSeatRange,
    educationStudentSeatRange,
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
        message: 'Betalingen ble avbrutt. Du kan fortsette når du er klar.',
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
          throw new Error(result.error || 'Kunne ikke verifisere Stripe-betalingen');
        }

        if (!result.paymentCompleted) {
          setCommercialPaymentNotice({
            severity: 'info',
            message: 'Stripe-betalingen behandles fortsatt. Oppdater siden om noen sekunder hvis statusen ikke endrer seg.',
          });
          return;
        }

        if (effectiveLoginPersona === 'content_producer') {
          setContentProducerStep('auth');
        }
        if (effectiveLoginPersona === 'production_team') {
          setProductionTeamStep('auth');
        }

        markCommercialPaymentComplete(commercialSetupSignature);
      } catch (sessionError) {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : 'Kunne ikke verifisere Stripe-betalingen',
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
      setError('Velg om du logger inn som Produksjonsteam, Innholdsprodusent eller Utdanningsinstitusjon');
      return;
    }
    if (effectiveLoginPersona === 'education_institution') {
      setError('Utdanningsinstitusjoner onboardes via samarbeid. Bruk institusjonsoppsettet og send forespørsel i stedet for direkte innlogging.');
      return;
    }
    if (!validateCommercialSetup(effectiveLoginPersona)) {
      return;
    }
    if (isCommercialPaymentRequired && !isCommercialPaymentSatisfied) {
      setError('Aktiver planen i Stripe før du logger inn.');
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
      await persistCommercialSetup(effectiveLoginPersona);
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
        clearRoleRoomCommercialDraft();
        onLoginSuccess(normalizedUser);
      } else {
        setError(data.detail ?? data.error ?? 'Ugyldig e-post eller passord');
      }
    } catch {
      await completeLocalLogin();
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
      setError('Velg om du logger inn som Produksjonsteam, Innholdsprodusent eller Utdanningsinstitusjon');
      return;
    }
    if (isLandingPage && !selectedRole) {
      setError('Velg en rolle for å fortsette');
      return;
    }
    if (effectiveLoginPersona === 'education_institution') {
      setError('Utdanningsinstitusjoner onboardes via samarbeid. Bruk institusjonsoppsettet og send forespørsel i stedet for direkte innlogging.');
      return;
    }
    if (!validateCommercialSetup(effectiveLoginPersona)) {
      return;
    }
    if (isCommercialPaymentRequired && !isCommercialPaymentSatisfied) {
      setError('Aktiver planen i Stripe før du logger inn.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await persistCommercialSetup(effectiveLoginPersona);
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
        setError('Verifiser organisasjonsnummeret før du går videre.');
        return;
      }
      setError('');
      setContentProducerStep('role');
      resetCommercialPanelScroll();
      return;
    }
    if (contentProducerStep === 'role') {
      if (!selectedRole) {
        setError('Velg hovedrollen som best beskriver hvordan dere jobber.');
        return;
      }
      setError('');
      setContentProducerStep('team');
      resetCommercialPanelScroll();
      return;
    }
    if (contentProducerStep === 'team') {
      if (!isCommercialSetupComplete) {
        setError('Fyll inn kontoeier, e-post og teamoppsett før du går videre til innlogging.');
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
        setError('Verifiser organisasjonsnummeret før du går videre.');
        return;
      }
      setError('');
      setProductionTeamStep('role');
      resetCommercialPanelScroll();
      return;
    }
    if (productionTeamStep === 'role') {
      if (!selectedRole) {
        setError('Velg rollen som leder produksjonsteamet inn i plattformen.');
        return;
      }
      setError('');
      setProductionTeamStep('team');
      resetCommercialPanelScroll();
      return;
    }
    if (productionTeamStep === 'team') {
      if (!isCommercialSetupComplete) {
        setError(`Legg inn minst ${PRODUCTION_TEAM_MIN_MEMBERS} personer med navn, e-post og rolle før du går videre til innlogging.`);
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

  const selectedRoleLabel = allRoles.find((r) => r.id === selectedRole)?.label;
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
                if (option.id === 'content_producer' && !clientPortalIntent) {
                  setSelectedRole('');
                } else {
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
                  {option.label}
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
                  {option.description}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>
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
                {`${index + 1}. ${step.label}`}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.86rem' }, fontWeight: 600, color: 'rgba(245,240,255,0.96)' }}>
          {contentProducerCurrentStep.label}
        </Typography>
        <Typography sx={{ mt: 0.2, fontSize: { xs: '0.7rem', sm: '0.76rem' }, lineHeight: 1.5, color: 'rgba(205,198,224,0.72)' }}>
          {contentProducerCurrentStep.description}
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
                {`${index + 1}. ${step.label}`}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.86rem' }, fontWeight: 600, color: 'rgba(245,240,255,0.96)' }}>
          {productionTeamCurrentStep.label}
        </Typography>
        <Typography sx={{ mt: 0.2, fontSize: { xs: '0.7rem', sm: '0.76rem' }, lineHeight: 1.5, color: 'rgba(205,198,224,0.72)' }}>
          {productionTeamCurrentStep.description}
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
        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(184,170,226,0.72)' }}>
          Klar til innlogging
        </Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(245,240,255,0.95)' }}>
          {organizationCompanyName || 'Foretak ikke satt'}
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
          {selectedRoleLabel || 'Rolle ikke valgt'} · {formatRoleRoomStatValue(planMonthlyTotal)} kr / måned eks. mva.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 0.35 }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          Kontoeier: {teamOwner.name.trim() || 'Ikke satt ennå'}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          E-post: {teamOwner.email.trim() || 'Ikke satt ennå'}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          Plasser: {billableSeatCount}
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
        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(184,170,226,0.72)' }}>
          Klar til innlogging
        </Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(245,240,255,0.95)' }}>
          {organizationCompanyName || 'Foretak ikke satt'}
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
          {selectedRoleLabel || 'Rolle ikke valgt'} · {formatRoleRoomStatValue(planMonthlyTotal)} kr / måned eks. mva.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 0.35 }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          Teamleder: {teamOwner.name.trim() || 'Ikke satt ennå'}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          Teamlederrolle: {selectedRoleLabel || 'Ikke satt ennå'}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
          Plasser: {billableSeatCount}
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
        >
          Plan
        </Typography>
        <Typography
          sx={{
            fontSize: '0.92rem',
            fontWeight: 700,
            color: 'rgba(245,240,255,0.96)',
          }}
        >
          Innholdsprodusent
        </Typography>
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
          {selectedRoleLabel || 'Velg hovedfokus'}
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
        >
          Plan
        </Typography>
        <Typography
          sx={{
            fontSize: '0.92rem',
            fontWeight: 700,
            color: 'rgba(245,240,255,0.96)',
          }}
        >
          Produksjonsteam
        </Typography>
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
          {selectedRoleLabel || 'Velg teamlederrolle'}
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
            {isLandingPage ? loginEyebrow : 'Administrasjon'}
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
            {isLandingPage ? loginTitle : 'Logg inn'}
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
                        ? (ROLE_CARDS[activeUseCase.roleId]?.label ?? activeUseCase.roleId)
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
                    {activeUseCase?.line ?? ''}
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
                Start med å velge om dette er et produksjonsteam, en innholdsprodusent-plan eller et institusjonssamarbeid. Deretter verifiserer du bedriften, setter opp teamet eller institusjonen og ser hva neste steg er.
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
                    >
                      Bedrift først
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        lineHeight: 1.5,
                        color: 'rgba(205,198,224,0.72)',
                      }}
                    >
                      Legg inn organisasjonsnummeret deres først. Vi verifiserer det automatisk mot Brønnøysundregistrene før team og abonnement åpnes.
                    </Typography>
                  </Box>

                  <TextField
                    label="Organisasjonsnummer"
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
                    helperText={organizationLookupError || '9 sifre. Bedriftsnavnet fylles inn automatisk når nummeret er verifisert.'}
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
                    <Typography sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(195,188,214,0.72)' }}>
                      Foretak
                    </Typography>
                    <Typography sx={{ mt: 0.35, fontSize: '0.94rem', fontWeight: 600, color: 'rgba(244,240,255,0.95)' }}>
                      {organizationCompanyName || 'Venter på verifisert organisasjonsnummer'}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: '0.74rem', color: 'rgba(205,198,224,0.68)' }}>
                      {hasVerifiedOrganization
                        ? `${formatOrganizationNumber(normalizedOrganizationNumber)} er verifisert.`
                        : 'Teamoppsettet låses opp når foretaket er verifisert.'}
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
                {isStepwiseProductionTeamFlow
                  ? 'Velg teamlederens rolle'
                  : isProductionTeamFlow
                    ? 'Din rolle i teamet'
                    : isStepwiseContentProducerFlow
                      ? 'Velg hovedfokus for teamet'
                      : 'Din rolle'}
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
                    ? 'Start med rollen som best beskriver hvem som leder produksjonen. Resten av crewet legges inn i neste steg.'
                    : 'Start med inngangen som best beskriver hvordan dere jobber i dag. Du kan utvide teamet med flere spesialiseringer senere.'}
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
                  {isEducationInstitutionFlow ? 'Institusjonsoppsett' : 'Team og abonnement'}
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
                    ? 'Fortell oss hvordan institusjonen deres jobber. Denne flyten brukes til samarbeid og onboarding, ikke til direkte selvbetjent innlogging.'
                    : isProductionTeamFlow
                      ? 'Sett opp hvem som skal inn i produksjonsteamet. Planen starter på tre personer, og hvert medlem prises individuelt.'
                      : 'Sett opp hvem som skal inn i innholdsprodusent-teamet. Planen starter på én person, men du kan bygge teamet videre med flere plasser.'}
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
                          {teamOwnerLabel}
                        </Typography>
                      </Box>
                      <TextField
                        label={`${teamOwnerLabel} navn`}
                        value={teamOwner.name}
                        onChange={(event) => updateProductionTeamMember(0, 'name', event.target.value)}
                        fullWidth
                        size="small"
                        sx={glassInputSx(false)}
                      />
                      <TextField
                        label="E-post"
                        type="email"
                        value={teamOwner.email}
                        onChange={(event) => updateProductionTeamMember(0, 'email', event.target.value)}
                        fullWidth
                        size="small"
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
                        label="Institusjonstype"
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
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Stilling / rolle"
                        value={educationContactRole}
                        onChange={(event) => setEducationContactRole(event.target.value)}
                        fullWidth
                        size="small"
                        placeholder="Programansvarlig, faglærer, instituttleder ..."
                        sx={glassInputSx(false)}
                      />
                      <TextField
                        label="Studieprogram / fagområde"
                        value={educationProgramName}
                        onChange={(event) => setEducationProgramName(event.target.value)}
                        fullWidth
                        size="small"
                        placeholder="Filmproduksjon, TV, foto, lyd ..."
                        sx={glassInputSx(false)}
                      />
                      <TextField
                        select
                        label="Omtrentlig studentomfang"
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
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Faglærere / koordinatorer"
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
                              {option.label}
                            </MenuItem>
                          ))}
                      </TextField>
                      <TextField
                        select
                        label="Ønsket oppstart"
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
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Hva ønsker dere å bruke The Role Room til?"
                        value={educationUseCase}
                        onChange={(event) => setEducationUseCase(event.target.value)}
                        multiline
                        minRows={4}
                        fullWidth
                        size="small"
                        placeholder="Beskriv hvordan dere ønsker å bruke plattformen i undervisning, studentproduksjoner, kull, praksis eller samarbeid med eksterne."
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
                      Institusjonsansvarlig blir hovedkontakt for oppsettet. Når samarbeid, kull og faglærerstruktur er avklart,
                      settes innlogging og tilgangsnivåer opp sammen med teamet vårt.
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
                            ? `Forespørsel-ID: ${educationInquirySubmitted.requestId}`
                            : 'Forespørselen er registrert.'}
                          {educationInquirySubmitted.notificationEmailSent
                            ? ' Admin er varslet på e-post.'
                            : ' Adminvarsel på e-post er ikke bekreftet ennå.'}
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
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(246,195,88,0.84)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Institusjonssamarbeid
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.96)' }}>
                        Samarbeidsforespørsel
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
                        Vi bruker opplysningene til å forberede en institusjonssamtale og anbefale riktig oppsett for kull, lærere og produksjonsflyt.
                      </Typography>
                      <Box sx={{ mt: 1, display: 'grid', gap: 0.55 }}>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Institusjon: {organizationCompanyName || 'Venter på verifisering'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Institusjonstype: {EDUCATION_INSTITUTION_TYPES.find((option) => option.id === educationInstitutionType)?.label || 'Ikke satt ennå'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Studieprogram: {educationProgramName.trim() || 'Ikke satt ennå'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Studenter: {getEducationSeatLabel(educationStudentSeatRange, EDUCATION_STUDENT_SEAT_OPTIONS)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Faglærere / koordinatorer: {getEducationSeatLabel(educationStaffSeatRange, EDUCATION_STAFF_SEAT_OPTIONS)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Ønsket oppstart: {getEducationStartWindowLabel(educationDesiredStartWindow)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Hovedkontakt: {teamOwner.name.trim() || 'Ikke satt ennå'}
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
                      <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: 'rgba(245,240,255,0.94)' }}>
                        Hva skjer etter innsending?
                      </Typography>
                      <Typography sx={{ fontSize: '0.74rem', lineHeight: 1.6, color: 'rgba(210,204,228,0.72)' }}>
                        Vi bruker forespørselen til å forstå struktur, kullstørrelse og behov før vi setter opp en institusjonssamtale med riktig oppsett og tilgangsmodell.
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 0.45 }}>
                        {[
                          'Vi gjennomgår organisasjon, studieprogram og ønsket bruk.',
                          'Vi foreslår et oppsett for kull, lærere og produksjonsrom.',
                          'Eventuelle kommersielle betingelser avklares i dialog. Alle tilbud oppgis eks. mva.',
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
                      >
                        Les mer om samarbeid
                      </Button>
                      <Button
                        type="button"
                        onClick={handleEducationInquirySubmit}
                        disabled={!isCommercialSetupComplete || loading}
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
                        {loading ? 'Sender forespørsel ...' : 'Send samarbeidsforespørsel'}
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
                              {teamOwnerLabel}
                            </Typography>
                          </Box>
                        )}
                        <TextField
                          label={index === 0 ? `${teamOwnerLabel} navn` : `Navn ${index + 1}`}
                          value={member.name}
                          onChange={(event) => updateProductionTeamMember(index, 'name', event.target.value)}
                          fullWidth
                          size="small"
                          sx={glassInputSx(false)}
                        />
                        <TextField
                          label="E-post"
                          type="email"
                          value={member.email}
                          onChange={(event) => updateProductionTeamMember(index, 'email', event.target.value)}
                          fullWidth
                          size="small"
                          sx={glassInputSx(false)}
                        />
                        <TextField
                          select
                          label="Rolle i teamet"
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
                              {ROLE_CARDS[roleId].label}
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
                            >
                              Fjern plass
                            </Button>
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
                    >
                      + Legg til person
                    </Button>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        lineHeight: 1.5,
                        color: 'rgba(198,191,218,0.68)',
                      }}
                    >
                      {isProductionTeamFlow
                        ? 'Det første medlemmet blir teamleder. Bare teamlederen kan senere utvide teamet videre.'
                        : 'Det første medlemmet blir kontoeier. Denne brukeren leder innholdsprodusent-planen og kan senere utvide teamet videre.'}
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
                        {isProductionTeamFlow ? 'Produksjonsteam-plan' : 'Innholdsprodusent-plan'}
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.96)' }}>
                        {formatRoleRoomStatValue(planMonthlyTotal)} kr
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(214,208,230,0.72)' }}>
                        {formatRoleRoomStatValue(seatPrice)} kr per person / måned eks. mva.
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontSize: '0.72rem', color: 'rgba(196,188,220,0.64)' }}>
                        Alle priser i The Role Room oppgis eks. mva.
                      </Typography>
                      <Box sx={{ mt: 1, display: 'grid', gap: 0.55 }}>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Minste team: {minimumSeatCount} {minimumSeatCount === 1 ? 'person' : 'personer'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Valgte plasser: {billableSeatCount}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Roller valgt: {teamVisualMembers.length}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          {teamOwnerLabel}: {teamOwner.name.trim() || 'Ikke satt ennå'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(234,228,245,0.84)' }}>
                          Bedrift: {organizationCompanyName || 'Venter på verifisering'}
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
                        const roleLabel = ROLE_CARDS[member.roleId]?.label || 'Rolle';
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
                                {member.name.trim() || `Teammedlem ${index + 1}`}
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
                            Når du velger roller til teamet ditt, dukker de opp her som en visuell teamstripe.
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
                  <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: 'rgba(245,240,255,0.94)' }}>
                    Admin-tilgang
                  </Typography>
                  <Typography sx={{ mt: 0.45, fontSize: '0.78rem', lineHeight: 1.5, color: 'rgba(210,204,228,0.72)' }}>
                    Administratorer går utenfor den vanlige teamplanen. Denne innloggingen bruker ikke produksjonsteamets setepris.
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
                    ? 'Når bedriften er verifisert og institusjonsoppsettet er fylt ut, kan du sende en forespørsel om samarbeid. Innlogging åpnes først etter avtalt onboarding.'
                    : 'Når bedriften er verifisert og alle i teamet er lagt inn, åpnes innloggingen nederst i modalen.'}
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
              >
                Tilbake
              </Button>
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
                        ? 'Fortsett til rolle'
                        : productionTeamStep === 'role'
                          ? 'Fortsett til team'
                          : 'Fortsett til betaling'
                    ) : (
                      contentProducerStep === 'company'
                        ? 'Fortsett til fokus'
                        : contentProducerStep === 'role'
                          ? 'Fortsett til team'
                          : 'Fortsett til betaling'
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
                {isCommercialPaymentSatisfied ? 'Plan aktivert' : 'Stripe Checkout'}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.96rem', sm: '1.02rem' }, fontWeight: 700, color: 'rgba(250,247,255,0.96)' }}>
                {isCommercialPaymentSatisfied
                  ? 'Betalingen er registrert. Innloggingen er nå åpen.'
                  : `Aktiver ${isProductionTeamFlow ? 'produksjonsteamet' : 'innholdsprodusent-planen'} før innlogging.`}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'rgba(210,204,228,0.72)' }}>
                {isCommercialPaymentSatisfied
                  ? `Planen er registrert på ${organizationCompanyName || 'bedriften'} med ${formatRoleRoomStatValue(planMonthlyTotal)} kr per måned eks. mva.`
                  : `Du sendes til Stripe for å aktivere ${billableSeatCount} ${billableSeatCount === 1 ? 'plass' : 'plasser'} til ${formatRoleRoomStatValue(planMonthlyTotal)} kr per måned eks. mva.`}
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
                  {commercialPaymentPending ? 'Starter Stripe Checkout…' : 'Gå til sikker betaling'}
                </Button>
              )}
            </Box>
          )}

          {/* ── email ── */}
          {shouldShowAuthFields && (
            <>
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
                Google
              </Button>
              {/* LinkedIn */}
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
            </Box>
          )}
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
