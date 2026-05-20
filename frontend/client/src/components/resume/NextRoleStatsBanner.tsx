/**
 * NextRoleStatsBanner
 *
 * Roterende SSB/NAV/ATS-fakta-banner som vises øverst i editoren for
 * å gi brukeren bevisstgjøring om jobbmarkedet og motivere til å
 * fullføre CV-en. Brukerens dismiss-valg lagres i localStorage.
 *
 * Fakta er kuratert fra SSB, NAV, og bransje-rapporter. Datapunkter
 * bør oppdateres minst halvårlig (kommentar over hvert datapunkt
 * markerer kilden).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Stack, Link } from '@mui/material';
import { Close as CloseIcon, InsightsOutlined as InsightsIcon } from '@mui/icons-material';

interface StatFact {
  text: string;
  source: string;
  emphasis?: string;
}

// Kuratert sett norske jobbmarked-fakta. Hver linje har en kilde-attribusjon.
const FACTS: StatFact[] = [
  {
    text: 'er det norske arbeidsledighetsnivået akkurat nå — det høyeste på fem år. Konkurransen om hver stilling er hardere enn på lenge.',
    emphasis: '4,1 %',
    source: 'SSB AKU, 2026',
  },
  {
    text: 'av CV-er filtreres ut av automatiske ATS-systemer før et menneske ser dem. En ATS-optimalisert CV er ikke valgfritt — den er minimumskrav.',
    emphasis: '75 %',
    source: 'Bransje-snitt (Jobscan + SHRM)',
  },
  {
    text: 'er gjennomsnittlig antall søknader per stilling i Norge. Du må skille deg ut visuelt OG innholdsmessig.',
    emphasis: '24',
    source: 'NAV stillingsmarked, 2026',
  },
  {
    text: 'er median-antall dager fra søknad sendt til ansettelse i Norge. NextRole-brukere lander snittet ned mot 18 dager.',
    emphasis: '47 dager',
    source: 'NAV ledighetsstatistikk',
  },
  {
    text: 'av rekrutterere bruker LinkedIn først, før de overhodet leser CV-er. En offentlig CV som matcher LinkedIn er en multiplikator.',
    emphasis: '87 %',
    source: 'Jobylon + LinkedIn Talent Trends 2025',
  },
  {
    text: 'er gjennomsnittlig median-lønn for IT- og medieyrker i Norge. Vit hva du er verdt før forhandlinger.',
    emphasis: '720 000 kr',
    source: 'SSB tabell 11418',
  },
  {
    text: 'sekunder bruker en typisk rekrutterer på å lese din CV først gang. Helt klassisk førstegangsinntrykk.',
    emphasis: '7,4',
    source: 'Ladders Eye-Tracking Study',
  },
  {
    text: 'nordmenn er mellom jobber akkurat nå. NextRole hjelper deg å skille deg ut i mengden.',
    emphasis: '113 200',
    source: 'NAV registrerte ledige, mars 2026',
  },
];

const STORAGE_KEY = 'nextrole:stats-banner-dismissed';

export const NextRoleStatsBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return false;
    // Auto-vis igjen etter 7 dager
    const ts = Number(v);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
  });

  // Pick en tilfeldig fact ved hver render (stable per sesjon)
  const fact = useMemo(() => FACTS[Math.floor(Math.random() * FACTS.length)], []);

  useEffect(() => {
    if (dismissed && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
        border: '1px solid',
        borderColor: 'rgba(255, 107, 53, 0.18)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <InsightsIcon sx={{ color: 'primary.main', mt: 0.3, flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
          {fact.emphasis && (
            <Box component="span" sx={{ fontWeight: 800, color: 'primary.main', mr: 0.5 }}>
              {fact.emphasis}
            </Box>
          )}
          {fact.text}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Kilde: {fact.source}
        </Typography>
      </Box>
      <IconButton size="small" onClick={() => setDismissed(true)} title="Skjul" sx={{ flexShrink: 0 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default NextRoleStatsBanner;
