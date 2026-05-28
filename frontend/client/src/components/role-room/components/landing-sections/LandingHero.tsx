import { memo, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { ROLE_ROOM_LANDING_CONFIG } from '../../config/landing';

const WHY = 'Vi tror at hver god fortelling starter med de rette menneskene i de rette rollene.';
const HOW =
  'Vi samler roller, kandidater, auditions og produksjonsplan i ett arbeidsrom — slik at du aldri mister oversikten.';

interface LandingHeroProps {
  introShowing: boolean;
}

/**
 * Hero med logo, typewriter-labels (WHY/HOW) og innledende fortellings-
 * tekst. Type-writer hopper til full tekst hvis bruker har
 * prefers-reduced-motion aktivert.
 */
function LandingHeroImpl({ introShowing }: LandingHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const [typedWhy, setTypedWhy] = useState('');
  const [typedHow, setTypedHow] = useState('');
  const [cursorTarget, setCursorTarget] = useState<'why' | 'how' | 'done'>('why');
  const [cursorVisible, setCursorVisible] = useState(true);

  const whyLabel = ROLE_ROOM_LANDING_CONFIG.intro.whyLabel;
  const howLabel = ROLE_ROOM_LANDING_CONFIG.intro.howLabel;

  useEffect(() => {
    if (introShowing) return;
    if (shouldReduceMotion) {
      setTypedWhy(whyLabel);
      setTypedHow(howLabel);
      setCursorVisible(false);
      setCursorTarget('done');
      return;
    }
    const steps = [
      { label: whyLabel, setter: setTypedWhy, target: 'why' as const },
      { label: howLabel, setter: setTypedHow, target: 'how' as const },
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    let stepIdx = 0;
    const runStep = (delay: number) => {
      if (stepIdx >= steps.length) {
        setCursorTarget('done');
        return;
      }
      const { label, setter, target } = steps[stepIdx++];
      const t = setTimeout(() => {
        setCursorTarget(target);
        setCursorVisible(true);
        let i = 0;
        const iv = setInterval(() => {
          setter(label.slice(0, ++i));
          if (i >= label.length) {
            clearInterval(iv);
            runStep(150);
          }
        }, 25);
        intervals.push(iv);
      }, delay);
      timers.push(t);
    };
    runStep(400);
    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [introShowing, shouldReduceMotion, whyLabel, howLabel]);

  const labelSx = {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '1.1rem',
    fontWeight: 700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    mb: 2,
    minHeight: '1.4em',
    background: 'linear-gradient(90deg, #fff 0%, #8b5cf6 55%, #6366f1 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };
  const cursorSx = {
    display: 'inline-block',
    width: '2px',
    height: '0.85em',
    bgcolor: '#8b5cf6',
    ml: '2px',
    verticalAlign: 'middle',
    transition: 'opacity 0.15s',
  };

  return (
    <>
      {/* ── Logo hero ── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0 }} component="header">
        <motion.div
          initial={shouldReduceMotion ? false : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: shouldReduceMotion ? 0 : 1 }}
        >
          <Box
            component="img"
            src="/role-room-assets/landing_logo.webp"
            alt="The Role Room"
            width={640}
            height={240}
            loading="eager"
            {...{ fetchpriority: 'high' }}
            data-testid="role-room-landing-logo"
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
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <Typography sx={labelSx}>
            {typedWhy}
            <Box
              component="span"
              sx={{
                ...cursorSx,
                opacity: cursorTarget === 'why' && cursorVisible ? 1 : 0,
              }}
            />
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2rem', sm: '2.8rem', md: '3.6rem' },
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.15,
              maxWidth: 780,
              mx: 'auto',
            }}
          >
            {WHY}
          </Typography>
        </motion.div>
      </Box>

      {/* ════ HOW ════ */}
      <Box sx={{ textAlign: 'center', mb: 10 }}>
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.8 }}
        >
          <Typography sx={labelSx}>
            {typedHow}
            <Box
              component="span"
              sx={{
                ...cursorSx,
                opacity: cursorTarget === 'how' && cursorVisible ? 1 : 0,
              }}
            />
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.05rem', sm: '1.2rem' },
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.75,
              fontWeight: 300,
            }}
          >
            {HOW}
          </Typography>
        </motion.div>
      </Box>
    </>
  );
}

export const LandingHero = memo(LandingHeroImpl);
LandingHero.displayName = 'LandingHero';
