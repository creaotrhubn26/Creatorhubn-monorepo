/**
 * NextRoleSplash — animert splash-skjerm for NextRole.
 *
 * To bruksmønstre:
 *
 *   1. <NextRoleSplash />            Full-screen splash som auto-skjuler
 *                                     etter ~2,2 sekunder (fades ut).
 *
 *   2. <NextRoleLoader />            Liten inline-loader for kortere
 *                                     venting (data-fetch, etc.) — bare
 *                                     pulserende logo + tekst.
 *
 * Animasjonen matcher logo-konseptet:
 *   • Dør står på gløtt → åpnes helt (translateX + skalering)
 *   • Amber-gradient inni fader inn
 *   • Silhuett-par fader inn fra venstre
 *   • "Next" og "Role" stykker inn (Role får et glow-pulse-loop)
 *
 * Bruker kun CSS keyframes — ingen framer-motion-avhengighet.
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Fade } from '@mui/material';

const NAVY = '#1F2937';
const AMBER = '#F5B82E';
const CREAM = '#FAF5E8';

// ════════════════════════════════════════════════════════════════════
// DEN ANIMERTE LOGOEN — gjenbrukes av begge varianter
// ════════════════════════════════════════════════════════════════════

interface AnimatedLogoProps {
  size?: number;
  /** true = anim løper én gang; false = looper kontinuerlig */
  oneShot?: boolean;
  /** Skjul wordmark og vis bare ikon-marken */
  markOnly?: boolean;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 200,
  oneShot = false,
  markOnly = false,
}) => {
  // Animasjons-stadier:
  //   0–600ms:  dør på gløtt
  //   600–1200ms: dør åpnes
  //   1200–1700ms: silhuetter fader inn
  //   1700ms+:  wordmark fader inn + Role glow-pulse
  return (
    <Box sx={{ position: 'relative', width: size, height: size * 0.78 }}>
      <svg
        viewBox="0 0 320 250"
        width={size}
        height={size * 0.78}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="ambGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD45E" />
            <stop offset="100%" stopColor={AMBER} />
          </linearGradient>
          <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={AMBER} />
            <stop offset="100%" stopColor="#E5A325" />
          </linearGradient>
          <filter id="amberGlow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Bakgrunn — cream */}
        <rect width="320" height="250" rx="24" fill={CREAM} />

        {/* DØR-RAMME (statisk navy) */}
        <g>
          {/* Venstre dør-side (åpen, vinklet) */}
          <path
            d="M 110 30 L 130 50 L 130 200 L 110 220 Z"
            fill={NAVY}
            style={{
              opacity: 0,
              animation: `splashFadeIn 0.5s 0.1s ease-out forwards${oneShot ? '' : ', splashIdle 4s 3s infinite'}`,
            }}
          />
          {/* Høyre dør-side */}
          <path
            d="M 250 30 L 270 50 L 270 200 L 250 220 Z"
            fill={NAVY}
            style={{
              opacity: 0,
              animation: `splashFadeIn 0.5s 0.1s ease-out forwards`,
            }}
          />
        </g>

        {/* DØR-ÅPNING (amber gradient — utvider seg) */}
        <g
          style={{
            opacity: 0,
            animation: `splashDoorOpen 0.9s 0.5s cubic-bezier(.16,1,.3,1) forwards${oneShot ? '' : ', splashGlow 3s 2.5s ease-in-out infinite'}`,
            transformOrigin: '190px 125px',
          }}
        >
          <path d="M 130 50 L 250 50 L 250 200 L 130 200 Z" fill="url(#ambGrad)" />
          {/* Gulvet som rekker ut */}
          <path
            d="M 130 200 L 250 200 L 290 230 L 90 230 Z"
            fill="url(#floorGrad)"
            opacity="0.85"
          />
        </g>

        {/* SILHUETTER (mann + kvinne) — fader inn etter dør-åpning */}
        <g
          style={{
            opacity: 0,
            animation: `splashSilhouettesIn 0.8s 1.2s ease-out forwards`,
            transformOrigin: '180px 200px',
          }}
        >
          {/* Mann */}
          <ellipse cx="170" cy="105" rx="11" ry="11" fill={NAVY} />
          <path
            d="M 158 116 Q 156 130 158 148 L 160 196 L 168 196 L 170 165 L 172 196 L 180 196 L 184 148 Q 186 130 184 116 L 182 110 Q 175 108 168 108 L 158 110 Z"
            fill={NAVY}
          />
          {/* Kvinne */}
          <ellipse cx="205" cy="108" rx="9" ry="9" fill={NAVY} />
          <path
            d="M 196 119 Q 195 132 196 148 L 199 196 L 207 196 L 209 168 L 211 196 L 218 196 L 220 148 Q 221 132 218 119 L 217 113 Q 211 111 205 111 L 198 113 Z"
            fill={NAVY}
          />
        </g>

        {/* WORDMARK (Next + Role) */}
        {!markOnly && (
          <>
            <text
              x="20"
              y="120"
              fontFamily="Inter, -apple-system, sans-serif"
              fontWeight="800"
              fontSize="44"
              fill={NAVY}
              style={{
                opacity: 0,
                animation: `splashWordmarkIn 0.6s 1.7s ease-out forwards`,
              }}
            >
              Next
            </text>
            <text
              x="20"
              y="170"
              fontFamily="Inter, -apple-system, sans-serif"
              fontWeight="800"
              fontSize="44"
              fill={AMBER}
              filter="url(#amberGlow)"
              style={{
                opacity: 0,
                animation: `splashWordmarkIn 0.6s 1.95s ease-out forwards${oneShot ? '' : ', splashRolePulse 3s 2.7s ease-in-out infinite'}`,
              }}
            >
              Role
            </text>
          </>
        )}
      </svg>

      {/* CSS keyframes */}
      <style>{`
        @keyframes splashFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes splashDoorOpen {
          from { opacity: 0; transform: scaleX(0.2); }
          to { opacity: 1; transform: scaleX(1); }
        }
        @keyframes splashSilhouettesIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes splashWordmarkIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes splashRolePulse {
          0%, 100% { filter: url(#amberGlow) drop-shadow(0 0 0 ${AMBER}); }
          50% { filter: url(#amberGlow) drop-shadow(0 0 8px ${AMBER}); }
        }
        @keyframes splashGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        @keyframes splashIdle {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-1px); }
        }
      `}</style>
    </Box>
  );
};

// ════════════════════════════════════════════════════════════════════
// FULL-SCREEN SPLASH
// ════════════════════════════════════════════════════════════════════

interface SplashProps {
  /** Antall ms før splash fader ut. Default 2200. */
  durationMs?: number;
  /** Callback når splash er ferdig + fjernet fra DOM. */
  onComplete?: () => void;
}

export const NextRoleSplash: React.FC<SplashProps> = ({
  durationMs = 2200,
  onComplete,
}) => {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const fadeOutTimer = setTimeout(() => setShow(false), durationMs);
    const completeTimer = setTimeout(() => onComplete?.(), durationMs + 500);
    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [durationMs, onComplete]);

  return (
    <Fade in={show} timeout={400}>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          bgcolor: CREAM,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <AnimatedLogo size={320} oneShot />
        <Typography
          variant="caption"
          sx={{
            mt: 3,
            letterSpacing: 3,
            fontWeight: 600,
            color: '#6B7280',
            textTransform: 'uppercase',
            opacity: 0,
            animation: 'splashTaglineIn 0.6s 2s ease-out forwards',
            '@keyframes splashTaglineIn': {
              to: { opacity: 1 },
            },
          }}
        >
          by CreatorHub
        </Typography>
      </Box>
    </Fade>
  );
};

// ════════════════════════════════════════════════════════════════════
// INLINE LOADER (mindre, looping)
// ════════════════════════════════════════════════════════════════════

interface LoaderProps {
  size?: number;
  label?: string;
  /** Sentralt på siden eller inline */
  fullPage?: boolean;
}

export const NextRoleLoader: React.FC<LoaderProps> = ({
  size = 120,
  label,
  fullPage = false,
}) => {
  const content = (
    <Box sx={{ textAlign: 'center' }}>
      <AnimatedLogo size={size} markOnly />
      {label && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 1.5,
            letterSpacing: 0.5,
            opacity: 0,
            animation: 'loaderLabelIn 0.4s 1.5s ease-out forwards',
            '@keyframes loaderLabelIn': { to: { opacity: 1 } },
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
  if (!fullPage) return content;
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'rgba(250, 245, 232, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
      }}
    >
      {content}
    </Box>
  );
};

export default NextRoleSplash;
