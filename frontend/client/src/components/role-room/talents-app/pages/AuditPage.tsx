/**
 * AuditPage.tsx — "Hvem har sett profilen min?"
 *
 * Mål: Irlin skal alltid kunne sjekke hvem som har sett henne, når, og
 * hva de så. Tillit-kritisk for at hun deler data i utgangspunktet.
 *
 * Henter audit-logg fra /api/role-room/talents/me/access-audit (aggregert
 * per partner-day siste 90 dager).
 */

import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import ShieldIcon from '@mui/icons-material/Shield';
import { useCallback, useEffect, useState } from 'react';

import roleRoomTalentsService, {
  type RoleRoomTalentAccessAuditRow,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

interface AuditPageProps {
  demoMode: boolean;
}

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

const SCOPE_LABELS: Record<string, string> = {
  basic_profile: 'Basis-profil',
  media_portfolio: 'Media (headshot/showreel/CV)',
  contact_info: 'Kontaktinfo',
  demographics: 'Demografi',
  availability: 'Tilgjengelighet',
  audition_invitations: 'Audition-invites',
  self_tape_review: 'Self-tape',
  full_profile: 'Full tilgang',
  workshop_access: 'Workshops',
};

function formatScopes(scopes: string[]): string {
  if (!scopes || scopes.length === 0) return 'Basis';
  return scopes.map((s) => SCOPE_LABELS[s] || s).join(', ');
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I går';
  if (diff < 7) return `${diff} dager siden`;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AuditPage({ demoMode }: AuditPageProps) {
  const [rows, setRows] = useState<RoleRoomTalentAccessAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    // Audit-endpoint krever auth — i demo-modus viser vi tom liste med info.
    if (demoMode) {
      setRows([]);
      setLoading(false);
      return;
    }
    const data = await roleRoomTalentsService.fetchMyAccessAudit();
    setRows(data);
    setLoading(false);
  }, [demoMode]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Henter aktivitet…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 980, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15 }}>
            Hvem har sett profilen min?
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem', mt: 0.6, maxWidth: 720 }}>
            Aktivitet siste 90 dager. Hver gang en partner åpner profilen din, logges det her.
            Dette er din egen oversikt — partnere ser ikke at du sjekker.
          </Typography>
        </Box>
      </Stack>

      {demoMode ? (
        <Alert severity="info" sx={{ mb: 3, bgcolor: 'rgba(168,85,247,0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.accentBright } }}>
          Demo-modus: ingen ekte aktivitet vises. Logg inn med din konto for å se din egen audit-logg.
        </Alert>
      ) : null}

      {rows.length === 0 && !demoMode ? (
        <Box sx={{ ...cardSx, textAlign: 'center', py: 6 }}>
          <VisibilityIcon sx={{ color: palette.textMuted, fontSize: 56, mb: 1.4 }} />
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.1rem', mb: 0.8 }}>
            Ingen aktivitet ennå
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem' }}>
            Når en partner ser profilen din, dukker det opp her.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {rows.map((row, i) => (
            <Box
              key={`${row.partner_ref}-${row.day}-${i}`}
              sx={{
                ...cardSx,
                p: 1.8,
                display: 'grid',
                gridTemplateColumns: '40px 1fr auto',
                gap: 1.4,
                alignItems: 'center',
              }}
            >
              <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(168,85,247,0.18)', color: palette.accentBright }}>
                <VisibilityIcon fontSize="small" />
              </Avatar>
              <Stack spacing={0.4}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.92rem' }}>
                  {row.partner_name || row.partner_type}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem' }}>
                  {formatDay(row.day)} · {row.access_count} {row.access_count === 1 ? 'visning' : 'visninger'} · så {formatScopes(row.scopes_seen)}
                </Typography>
              </Stack>
              <Chip
                label={new Date(row.last_accessed).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                size="small"
                sx={{ bgcolor: 'rgba(168,85,247,0.12)', color: palette.accentBright, fontWeight: 600 }}
              />
            </Box>
          ))}
        </Stack>
      )}

      {/* GDPR-info */}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 3, color: palette.textMuted, fontSize: '0.82rem' }}>
        <ShieldIcon sx={{ fontSize: 18, color: palette.success }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
          Vi lagrer denne loggen i 12 måneder før den slettes automatisk (GDPR art. 30).
        </Typography>
      </Stack>
    </Box>
  );
}
