/**
 * ContextualNudgeBanner — Kontekstuell intelligens-banner
 *
 * Viser smarte, kontekstuelle tips basert på brukerens læringshistorikk.
 * Legges inn i ulike paneler med en `context`-prop som bestemmer hva
 * slags nudges som hentes (f.eks. "casting", "equipment", "calendar").
 *
 * Henter userId selv via authSessionService — ingen prop nødvendig.
 * Returnerer null hvis ingen nudges eller feil oppstår.
 */
import { useState, useEffect, memo } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
} from '@mui/material';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CloseIcon from '@mui/icons-material/Close';
import { nudgesApi } from '../services/roleRoomLearningApi';
import { authSessionService } from '../services/authSessionService';

function getUserId(): string {
  const session = authSessionService.getSessionSync();
  if (session.currentUserId) return session.currentUserId;
  if (session.adminUser?.id !== undefined && session.adminUser?.id !== null) {
    return String(session.adminUser.id);
  }
  return 'default';
}

interface ContextualNudgeBannerProps {
  /** Kontekst-nøkkel sendt til API-et, f.eks. "casting", "equipment", "calendar" */
  context: string;
  /** Valgfri accent-farge for banneret (standard: #10b981) */
  accentColor?: string;
}

function ContextualNudgeBannerInner({ context, accentColor = '#10b981' }: ContextualNudgeBannerProps) {
  const [nudges, setNudges] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const userId = getUserId();
    if (userId === 'default') { setLoaded(true); return; }

    nudgesApi.get(userId, context)
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setNudges(data.slice(0, 3)); // maks 3 tips
        }
      })
      .catch(() => { /* stille feil — banneret vises bare ikke */ })
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, [context]);

  if (!loaded || nudges.length === 0 || !visible) return null;

  return (
    <Collapse in={visible}>
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          borderRadius: 2,
          bgcolor: `${accentColor}10`,
          border: `1px solid ${accentColor}40`,
        }}
      >
        <TipsAndUpdatesIcon sx={{ color: accentColor, fontSize: 22, mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: accentColor, fontWeight: 700, letterSpacing: 0.5 }}>
            Læringstips
          </Typography>
          {nudges.map((tip, i) => (
            <Typography key={i} variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mt: 0.25 }}>
              • {tip}
            </Typography>
          ))}
        </Box>
        <IconButton size="small" onClick={() => setVisible(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Collapse>
  );
}

export const ContextualNudgeBanner = memo(ContextualNudgeBannerInner);
