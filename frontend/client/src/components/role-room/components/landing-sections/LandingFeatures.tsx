import { memo, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import {
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
import { ROLE_ROOM_LANDING_CONFIG } from '../../config/landing';

const WHAT_FEATURES = [
  { icon: <PersonSearchIcon sx={{ fontSize: 36 }} />, title: 'Casting & Kandidater', desc: 'Søk, filtrer og administrer kandidater i grid eller tabell. Flytt dem gjennom prosessen med drag-and-drop Kanban.' },
  { icon: <PeopleAltIcon sx={{ fontSize: 36 }} />, title: 'Roller & Crew', desc: 'Bygg roller med krav og tilordne kandidater. Administrer hele crewet med avdeling, kontaktinfo og tilgjengelighet.' },
  { icon: <EventIcon sx={{ fontSize: 36 }} />, title: 'Audition & Planlegging', desc: 'Planlegg audition-tider, tildel kandidater til slots og administrer en felles audition-pool på tvers av prosjekter.' },
  { icon: <AutoStoriesIcon sx={{ fontSize: 36 }} />, title: 'Manus & Historiestruktur', desc: 'Skriv manus med profesjonell filmatisk formatering og organiser historiestrukturen som beat-kort på korkplansje.' },
  { icon: <VideocamIcon sx={{ fontSize: 36 }} />, title: 'Storyboard', desc: 'Tegn storyboard direkte i nettleseren, kombiner med manus i split-visning, og la AI foreslå kameravinkler.' },
  { icon: <CalendarMonthIcon sx={{ fontSize: 36 }} />, title: 'Produksjonskalender', desc: 'Opprett produksjonsdagsplaner, sjekk crew-konflikter automatisk og send varsler til hele teamet.' },
  { icon: <LocationOnIcon sx={{ fontSize: 36 }} />, title: 'Utstyr & Lokasjoner', desc: 'Book filmingsutstyr med tilgjengelighetssporing og administrer opptakslokasjoner med kart og kontaktinfo.' },
  { icon: <GavelIcon sx={{ fontSize: 36 }} />, title: 'Kontrakter & Samtykke', desc: 'Send tilbud og kontrakter til cast/crew. Opprett og spor samtykkeskjemaer per kandidat med signeringsstatus.' },
  { icon: <EmailIcon sx={{ fontSize: 36 }} />, title: 'Call Sheets & E-post', desc: 'Generer komplette call sheets klar for utskrift og design rike HTML-e-poster med mal-bibliotek og forhåndsvisning.' },
];

interface LandingFeaturesProps {
  introShowing: boolean;
}

/**
 * "What"-seksjon med 9 produktfunksjoner i grid + typewriter-label.
 * Tung seksjon (9 ikoner + 9 cards), lazy-loaded via parent.
 */
function LandingFeaturesImpl({ introShowing }: LandingFeaturesProps) {
  const shouldReduceMotion = useReducedMotion();
  const [typedWhat, setTypedWhat] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [showCursor, setShowCursor] = useState(true);

  const whatLabel = ROLE_ROOM_LANDING_CONFIG.intro.whatLabel;

  useEffect(() => {
    if (introShowing) return;
    if (shouldReduceMotion) {
      setTypedWhat(whatLabel);
      setCursorVisible(false);
      setShowCursor(false);
      return;
    }
    // WHY (1.4s) + HOW (1.4s) + buffer = trigger WHAT around t=3s
    const startDelay = setTimeout(() => {
      let i = 0;
      const iv = setInterval(() => {
        setTypedWhat(whatLabel.slice(0, ++i));
        if (i >= whatLabel.length) {
          clearInterval(iv);
          // Blink 6 times then hide
          let blinks = 0;
          const blink = setInterval(() => {
            setCursorVisible((v) => !v);
            if (++blinks >= 6) {
              clearInterval(blink);
              setCursorVisible(false);
              setShowCursor(false);
            }
          }, 350);
        }
      }, 25);
    }, 3000);
    return () => clearTimeout(startDelay);
  }, [introShowing, shouldReduceMotion, whatLabel]);

  return (
    <>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <Typography
            sx={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '1.1rem',
              fontWeight: 700,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              mb: 1,
              minHeight: '1.4em',
              background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {typedWhat}
            {showCursor && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: '2px',
                  height: '0.85em',
                  bgcolor: '#8b5cf6',
                  ml: '2px',
                  verticalAlign: 'middle',
                  opacity: cursorVisible ? 1 : 0,
                  transition: 'opacity 0.15s',
                }}
              />
            )}
          </Typography>
        </motion.div>
      </Box>
      <Box
        component="section"
        aria-label="Funksjonalitet i The Role Room"
        data-testid="role-room-landing-features"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
          mb: 10,
        }}
      >
        {WHAT_FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.3 + i * 0.12, duration: 0.6 }}
          >
            <Box
              sx={{
                p: 4,
                borderRadius: 3,
                height: '100%',
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
              }}
            >
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
    </>
  );
}

const LandingFeatures = memo(LandingFeaturesImpl);
LandingFeatures.displayName = 'LandingFeatures';

export default LandingFeatures;
