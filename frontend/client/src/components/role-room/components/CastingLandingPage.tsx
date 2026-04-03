import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayArrow as PlayArrowIcon,
  PersonSearch as PersonSearchIcon,
  Event as EventIcon,
  PeopleAlt as PeopleAltIcon,
  AutoStories as AutoStoriesIcon,
  CalendarMonth as CalendarMonthIcon,
  LocationOn as LocationOnIcon,
  Gavel as GavelIcon,
  Email as EmailIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import LoginDialog from './LoginDialog';
import { ROLE_ROOM_LANDING_CONFIG } from '../config/landing';
import { getRoleRoomVideoPosterUrl, getRoleRoomVideoStillUrl } from '../utils/roleRoomMedia';

interface CastingLandingPageProps {
  onEnter: () => void;
  onGuestEnter?: () => void;
}

/* ── Golden Circle content ──────────────────────────────────────────
 * WHY  — Purpose  (innermost circle — lead with this)
 * HOW  — Process  (how the purpose is fulfilled)
 * WHAT — Product  (the tangible features / result)
 * ────────────────────────────────────────────────────────────────── */
const WHY  = 'Vi tror at hver god fortelling starter med de rette menneskene i de rette rollene.';
const HOW  = 'Vi samler roller, kandidater, auditions og produksjonsplan i ett arbeidsrom — slik at du aldri mister oversikten.';
const WHAT_FEATURES = [
  { icon: <PersonSearchIcon sx={{ fontSize: 36 }} />, title: 'Casting & Kandidater',    desc: 'Søk, filtrer og administrer kandidater i grid eller tabell. Flytt dem gjennom prosessen med drag-and-drop Kanban.' },
  { icon: <PeopleAltIcon    sx={{ fontSize: 36 }} />, title: 'Roller & Crew',           desc: 'Bygg roller med krav og tilordne kandidater. Administrer hele crewet med avdeling, kontaktinfo og tilgjengelighet.' },
  { icon: <EventIcon        sx={{ fontSize: 36 }} />, title: 'Audition & Planlegging',  desc: 'Planlegg audition-tider, tildel kandidater til slots og administrer en felles audition-pool på tvers av prosjekter.' },
  { icon: <AutoStoriesIcon  sx={{ fontSize: 36 }} />, title: 'Manus & Historiestruktur',desc: 'Skriv manus med profesjonell filmatisk formatering og organiser historiestrukturen som beat-kort på korkplansje.' },
  { icon: <VideocamIcon     sx={{ fontSize: 36 }} />, title: 'Storyboard',   desc: 'Tegn storyboard direkte i nettleseren, kombiner med manus i split-visning, og la AI foreslå kameravinkler.' },
  { icon: <CalendarMonthIcon sx={{ fontSize: 36 }}/>, title: 'Produksjonskalender',     desc: 'Opprett produksjonsdagsplaner, sjekk crew-konflikter automatisk og send varsler til hele teamet.' },
  { icon: <LocationOnIcon   sx={{ fontSize: 36 }} />, title: 'Utstyr & Lokasjoner',     desc: 'Book filmingsutstyr med tilgjengelighetssporing og administrer opptakslokasjoner med kart og kontaktinfo.' },
  { icon: <GavelIcon        sx={{ fontSize: 36 }} />, title: 'Kontrakter & Samtykke',   desc: 'Send tilbud og kontrakter til cast/crew. Opprett og spor samtykkeskjemaer per kandidat med signeringsstatus.' },
  { icon: <EmailIcon        sx={{ fontSize: 36 }} />, title: 'Call Sheets & E-post',    desc: 'Generer komplette call sheets klar for utskrift og design rike HTML-e-poster med mal-bibliotek og forhåndsvisning.' },
];
export function CastingLandingPage({ onEnter, onGuestEnter }: CastingLandingPageProps) {
  const [showIntro, setShowIntro]       = useState(true);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [typedWhy,  setTypedWhy]  = useState('');
  const [typedHow,  setTypedHow]  = useState('');
  const [typedWhat, setTypedWhat] = useState('');
  const [cursorTarget, setCursorTarget] = useState<'why'|'how'|'what'|'none'>('none');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [backdropVideoReady, setBackdropVideoReady] = useState(false);
  const [backdropVideoFailed, setBackdropVideoFailed] = useState(false);
  const [introVideoReady, setIntroVideoReady] = useState(false);
  const [introVideoFailed, setIntroVideoFailed] = useState(false);

  const demoModeEnabled = ROLE_ROOM_LANDING_CONFIG.demoModeEnabled;
  const introEnabled = ROLE_ROOM_LANDING_CONFIG.intro.enabled;
  const introVideoUrl = ROLE_ROOM_LANDING_CONFIG.intro.videoUrl;
  const introSkipLabel = ROLE_ROOM_LANDING_CONFIG.intro.skipLabel;
  const backdropVideoUrl = ROLE_ROOM_LANDING_CONFIG.intro.backdropVideoUrl;
  const whyLabel = ROLE_ROOM_LANDING_CONFIG.intro.whyLabel;
  const whyText = WHY;
  const howLabel = ROLE_ROOM_LANDING_CONFIG.intro.howLabel;
  const howText = HOW;
  const whatLabel = ROLE_ROOM_LANDING_CONFIG.intro.whatLabel;
  const backdropStillUrl = getRoleRoomVideoStillUrl(backdropVideoUrl, '/role-room-assets/landing_backdrop.webp');
  const introStillUrl = getRoleRoomVideoPosterUrl(introVideoUrl, '/role-room-assets/landing_backdrop_with_logo.webp');

  /* skip intro entirely if disabled in role room config */
  useEffect(() => {
    if (!introEnabled) setShowIntro(false);
  }, [introEnabled]);

  useEffect(() => {
    setBackdropVideoReady(false);
    setBackdropVideoFailed(false);
  }, [backdropVideoUrl]);

  useEffect(() => {
    setIntroVideoReady(false);
    setIntroVideoFailed(false);
  }, [introVideoUrl]);

  // Chain typewriter: WHY label → HOW label → WHAT label
  useEffect(() => {
    if (showIntro) return;
    const steps = [
      { label: whyLabel,  setter: setTypedWhy,  target: 'why'  as const },
      { label: howLabel,   setter: setTypedHow,  target: 'how'  as const },
      { label: whatLabel,  setter: setTypedWhat, target: 'what' as const },
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stepIdx = 0;
    const runStep = (delay: number) => {
      if (stepIdx >= steps.length) {
        let blinks = 0;
        const blink = setInterval(() => {
          setCursorVisible(v => !v);
          if (++blinks >= 6) { clearInterval(blink); setCursorVisible(false); setCursorTarget('none'); }
        }, 350);
        return;
      }
      const { label, setter, target } = steps[stepIdx++];
      const t = setTimeout(() => {
        setCursorTarget(target);
        setCursorVisible(true);
        let i = 0;
        const iv = setInterval(() => {
          setter(label.slice(0, ++i));
          if (i >= label.length) { clearInterval(iv); runStep(150); }
        }, 80);
      }, delay);
      timers.push(t);
    };
    runStep(400);
    return () => timers.forEach(clearTimeout);
  }, [showIntro, whyLabel, howLabel, whatLabel]);

  // Safety fallback — dismiss intro if video never fires onEnded
  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 20_000);
    return () => clearTimeout(t);
  }, []);

  const handleStartClick   = () => setLoginDialogOpen(true);
  const handleLoginSuccess = () => {
    try {
      window.sessionStorage.removeItem('role-room-commercial-draft-v1');
    } catch {
      // Ignore storage cleanup failures.
    }
    setLoginDialogOpen(false);
    onEnter();
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('rrCheckout') || params.get('rrActivation')) {
      setLoginDialogOpen(true);
    }
  }, []);

  // The standalone casting shell sets html/body overflow:hidden.
  // Re-enable vertical scrolling while the landing page is mounted.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverflowY = html.style.overflowY;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverflowY = body.style.overflowY;

    html.style.overflow = 'auto';
    html.style.overflowY = 'auto';
    body.style.overflow = 'auto';
    body.style.overflowY = 'auto';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overflowY = prevHtmlOverflowY;
      body.style.overflow = prevBodyOverflow;
      body.style.overflowY = prevBodyOverflowY;
    };
  }, []);

  return (
    <Box sx={{
      width: '100%',
      minHeight: '100vh',
      bgcolor: '#0a0a0f',
      overflowX: loginDialogOpen ? 'visible' : 'hidden',
      overflowY: loginDialogOpen ? 'visible' : 'auto',
      position: 'relative',
    }}>

      {/* ── full-bleed video backdrop ── */}
      {backdropStillUrl ? (
        <Box
          component="img"
          src={backdropStillUrl}
          alt=""
          aria-hidden="true"
          sx={{
            position: 'fixed', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%',
            opacity: 0.22,
            zIndex: 0,
            pointerEvents: 'none',
            filter: 'saturate(0.6) brightness(0.55)',
          }}
        />
      ) : null}
      <Box
        component="video"
        src={backdropVideoUrl}
        autoPlay loop muted playsInline
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
        data-testid="role-room-landing-backdrop-video"
        data-media-mode={backdropVideoReady && !backdropVideoFailed ? 'video' : 'image'}
        sx={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 30%',
          opacity: backdropVideoReady && !backdropVideoFailed ? 0.22 : 0,
          zIndex: 0,
          pointerEvents: 'none',
          filter: 'saturate(0.6) brightness(0.55)',
          transition: 'opacity 0.3s ease',
        }}
      />
      {/* dark gradient over video so text is always readable */}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(10,10,15,0.55) 0%, rgba(10,10,15,0.4) 40%, rgba(10,10,15,0.75) 100%)',
      }} />

      {/* ── intro video splash ── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'fixed', inset: 0,
              zIndex: 100,
              background: '#000',
            }}
          >
            {introStillUrl ? (
              <Box
                component="img"
                src={introStillUrl}
                alt=""
                aria-hidden="true"
                sx={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  opacity: introVideoReady && !introVideoFailed ? 0.12 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              />
            ) : null}
            <Box
              component="video"
              src={introVideoUrl}
              autoPlay muted playsInline
              onEnded={() => setShowIntro(false)}
              onLoadedData={() => {
                setIntroVideoReady(true);
                setIntroVideoFailed(false);
              }}
              onCanPlay={() => {
                setIntroVideoReady(true);
                setIntroVideoFailed(false);
              }}
              onError={() => {
                setIntroVideoReady(false);
                setIntroVideoFailed(true);
              }}
              data-testid="role-room-landing-intro-video"
              data-media-mode={introVideoReady && !introVideoFailed ? 'video' : 'image'}
              sx={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: introVideoReady && !introVideoFailed ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />
            {/* Skip button */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
              style={{ position: 'absolute', bottom: 40, right: 40, zIndex: 10 }}
            >
              <Button
                onClick={() => setShowIntro(false)}
                sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem',
                  '&:hover': { color: 'rgba(255,255,255,0.8)' } }}
              >
                {introSkipLabel}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── main page ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showIntro ? 0 : 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{ position: 'relative', zIndex: 2 }}
      >
        <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 }, pb: 10 }}>

          {/* ── Logo hero ── */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0 }}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 1 }}>
              <Box
                component="img"
                src="/role-room-assets/landing_logo.webp"
                alt="The Role Room"
                sx={{
                  width: '100%',
                  maxWidth: 640,
                  height: 'auto',
                  display: 'block',
                  filter: 'drop-shadow(0 0 32px rgba(139,92,246,0.55))',
                }}
              />
            </motion.div>
          </Box>

          {/* ════ WHY ════ */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
              <Typography sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.25em',
                textTransform: 'uppercase', mb: 2, minHeight: '1.4em',
                background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {typedWhy}
                <Box component="span" sx={{
                  display: 'inline-block', width: '2px', height: '0.85em',
                  bgcolor: '#8b5cf6', ml: '2px', verticalAlign: 'middle',
                  opacity: cursorTarget === 'why' && cursorVisible ? 1 : 0, transition: 'opacity 0.15s',
                }} />
              </Typography>
              <Typography variant="h1" sx={{
                fontSize: { xs: '2rem', sm: '2.8rem', md: '3.6rem' },
                fontWeight: 800, color: '#fff', lineHeight: 1.15,
                maxWidth: 780, mx: 'auto',
              }}>
                {whyText}
              </Typography>
            </motion.div>
          </Box>

          {/* ════ HOW ════ */}
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.75, duration: 0.8 }}>
              <Typography sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.25em',
                textTransform: 'uppercase', mb: 2, minHeight: '1.4em',
                background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {typedHow}
                <Box component="span" sx={{
                  display: 'inline-block', width: '2px', height: '0.85em',
                  bgcolor: '#8b5cf6', ml: '2px', verticalAlign: 'middle',
                  opacity: cursorTarget === 'how' && cursorVisible ? 1 : 0, transition: 'opacity 0.15s',
                }} />
              </Typography>
              <Typography sx={{
                fontSize: { xs: '1.05rem', sm: '1.2rem' },
                color: 'rgba(255,255,255,0.72)',
                maxWidth: 600, mx: 'auto', lineHeight: 1.75, fontWeight: 300,
              }}>
                {howText}
              </Typography>
            </motion.div>
          </Box>

          {/* ── CTA ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, mb: 6 }}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
              <Button
                variant="contained" size="large"
                onClick={handleStartClick}
                startIcon={<PlayArrowIcon />}
                sx={{
                  px: 5, py: 2, fontSize: '1.05rem', fontWeight: 600, borderRadius: 3,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  boxShadow: '0 8px 32px rgba(139,92,246,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #9b6cf6 0%, #7376f1 100%)',
                    boxShadow: '0 12px 40px rgba(139,92,246,0.55)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Start The Role Room
              </Button>
            </motion.div>
            {onGuestEnter && demoModeEnabled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.6 }}>
                <Button
                  onClick={onGuestEnter}
                  size="small"
                  sx={{
                    color: 'rgba(200,185,255,0.5)',
                    fontSize: '0.78rem',
                    fontWeight: 400,
                    textTransform: 'none',
                    letterSpacing: '0.02em',
                    '&:hover': { color: 'rgba(200,185,255,0.85)', bgcolor: 'transparent', textDecoration: 'underline' },
                  }}
                >
                  Gå inn uten innlogging →
                </Button>
              </motion.div>
            )}
          </Box>

          {/* ════ WHAT ════ */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.6 }}>
              <Typography sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.25em',
                textTransform: 'uppercase', mb: 1, minHeight: '1.4em',
                background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {typedWhat}
                <Box component="span" sx={{
                  display: 'inline-block', width: '2px', height: '0.85em',
                  bgcolor: '#8b5cf6', ml: '2px', verticalAlign: 'middle',
                  opacity: cursorTarget === 'what' && cursorVisible ? 1 : 0, transition: 'opacity 0.15s',
                }} />
              </Typography>
            </motion.div>
          </Box>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
            mb: 10,
          }}>
            {WHAT_FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3 + i * 0.12, duration: 0.6 }}
              >
                <Box sx={{
                  p: 4, borderRadius: 3, height: '100%',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(12px)',
                  '&:hover': {
                    bgcolor: 'rgba(139,92,246,0.09)',
                    borderColor: 'rgba(139,92,246,0.28)',
                    transform: 'translateY(-4px)',
                  },
                }}>
                  <Box sx={{ color: '#8b5cf6', mb: 2 }}>{f.icon}</Box>
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1.05rem', mb: 1 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>

          {/* ── footer ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 1 }}>
            <Box sx={{
              mt: 12, textAlign: 'center',
              color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <Typography>Et produkt av</Typography>
              <Box
                component="img"
                src="/creatorhub-logo-amber.svg"
                alt="CreatorHub"
                sx={{
                  height: { xs: 24, sm: 28 },
                  width: 'auto',
                  opacity: 0.78,
                }}
              />
            </Box>
          </motion.div>

        </Container>
      </motion.div>

      <LoginDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onGuestEnter={onGuestEnter}
        isLandingPage={true}
      />
    </Box>
  );
}
