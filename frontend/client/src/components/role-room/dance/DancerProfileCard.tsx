/**
 * DancerProfileCard — kompakt visning av en danser med key-extras.
 *
 * Vises i DancerProfileGrid og kan også brukes inline ved siden av
 * formation-puck eller i rehearsal-planner. Hvis `profile === null` viser
 * vi en placeholder med "Opprett profil"-knapp.
 *
 * Designprinsipp: ren visning. All redigering går gjennom
 * DancerProfileEditor (åpnes av onEdit-callbacken).
 */

import { danceFlowColors } from './danceFlowTheme';
import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import {
  Edit as EditIcon,
  AddCircleOutline as AddIcon,
  Healing as InjuryIcon,
  Schedule as ScheduleIcon,
  CheckCircleOutline as CheckIcon,
} from '@mui/icons-material';
import type { DancerProfile, SkillLevel } from './dancerProfileService';
import { getInitials } from './dancerProfile';
import type { Dancer } from './formationTypes';

// ─── Hjelpefunksjoner ───────────────────────────────────────────────────

const SKILL_RANK: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  pro: 4,
};

const SKILL_LABEL_NB: Record<SkillLevel, string> = {
  beginner: 'Nybegynner',
  intermediate: 'Mellomnivå',
  advanced: 'Avansert',
  pro: 'Pro',
};

function topSkills(
  skillLevels: Partial<Record<string, SkillLevel>>,
  limit = 3,
): Array<[string, SkillLevel]> {
  const entries: Array<[string, SkillLevel]> = [];
  for (const [k, v] of Object.entries(skillLevels)) {
    if (v) entries.push([k, v]);
  }
  entries.sort((a, b) => SKILL_RANK[b[1]] - SKILL_RANK[a[1]]);
  return entries.slice(0, limit);
}

function isAvailableNow(profile: DancerProfile): boolean | null {
  if (profile.availabilityWindows.length === 0) return null;
  const now = Date.now();
  for (const w of profile.availabilityWindows) {
    const from = Date.parse(w.from);
    const to = Date.parse(w.to);
    if (Number.isFinite(from) && Number.isFinite(to) && now >= from && now <= to) {
      return true;
    }
  }
  return false;
}

/** Antall hele dager siden et ISO-tidspunkt, eller null hvis ugyldig/tomt. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

const AVAILABILITY_STALE_DAYS = 30;

/**
 * Ferskhet på tilgjengeligheten. Utdatert = aldri bekreftet, eller bekreftet
 * for mer enn {@link AVAILABILITY_STALE_DAYS} dager siden.
 */
function availabilityFreshness(confirmedAt: string | null): { stale: boolean; label: string } {
  const days = daysSince(confirmedAt);
  if (days == null) return { stale: true, label: 'Ikke bekreftet' };
  if (days <= 0) return { stale: false, label: 'Bekreftet i dag' };
  if (days === 1) return { stale: false, label: 'Bekreftet i går' };
  return { stale: days > AVAILABILITY_STALE_DAYS, label: `Bekreftet for ${days} d siden` };
}

function injuryColor(status: DancerProfile['injuryStatus']): string {
  switch (status) {
    case 'healthy': return danceFlowColors.successPrimary;
    case 'rehab': return danceFlowColors.errorPrimary;
    case 'cleared-with-restriction': return danceFlowColors.gold;
    default: return danceFlowColors.textMuted;
  }
}

function injuryLabel(status: DancerProfile['injuryStatus']): string {
  switch (status) {
    case 'healthy': return 'Frisk';
    case 'rehab': return 'Rehab';
    case 'cleared-with-restriction': return 'Klarert m/ restriksjon';
    default: return 'Ukjent';
  }
}

// ─── Props ──────────────────────────────────────────────────────────────

export interface DancerProfileCardProps {
  /** Danser-objektet (alltid tilstede — kommer fra DEMO_DANCERS eller crew). */
  dancer: Dancer;
  /** Profil-extras hvis finnes; null betyr "ikke opprettet enda". */
  profile: DancerProfile | null;
  /** Klikk på "Rediger" eller "Opprett profil". */
  onEdit?: () => void;
  /**
   * Bekreft at tilgjengeligheten fortsatt stemmer (ferskhets-nudge). Får
   * danser-id. Vises kun når profilen har vinduer og stemplet er utdatert.
   */
  onConfirmAvailability?: (dancerId: string) => void | Promise<void>;
  /** Tighter layout for sidebars. */
  compact?: boolean;
  /** F6-2: aggregerte tall (formasjoner / prøver / annotasjoner). */
  stats?: { formationsCount: number; rehearsalsCount: number; annotationsCount: number };
}

// ─── Komponent ──────────────────────────────────────────────────────────

export const DancerProfileCard: React.FC<DancerProfileCardProps> = ({
  dancer,
  profile,
  onEdit,
  onConfirmAvailability,
  compact,
  stats,
}) => {
  const initials = dancer.initials || getInitials(dancer.name);
  const top = useMemo(
    () => (profile ? topSkills(profile.skillLevels, 3) : []),
    [profile],
  );
  const availableNow = profile ? isAvailableNow(profile) : null;
  const hasWindows = !!profile && profile.availabilityWindows.length > 0;
  const freshness = useMemo(
    () => (hasWindows ? availabilityFreshness(profile!.availabilityConfirmedAt) : null),
    [hasWindows, profile],
  );

  const [confirming, setConfirming] = useState(false);
  const handleConfirm = async (): Promise<void> => {
    if (!profile || !onConfirmAvailability) return;
    setConfirming(true);
    try {
      await onConfirmAvailability(profile.dancerId);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card
      data-testid={`dancer-profile-card-${dancer.id}`}
      sx={{
        bgcolor: danceFlowColors.bgPanel,
        border: '1px solid #1e2536',
        boxShadow: 'none',
        borderRadius: 2,
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: danceFlowColors.grayDark },
      }}
    >
      <CardContent sx={{ p: compact ? 1.25 : 1.75, '&:last-child': { pb: compact ? 1.25 : 1.75 } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1.25}>
          <Avatar
            src={dancer.photoUrl}
            sx={{
              width: compact ? 38 : 48,
              height: compact ? 38 : 48,
              fontSize: compact ? 13 : 16,
              fontWeight: 700,
              bgcolor: dancer.color ?? danceFlowColors.info,
              border: '2px solid rgba(255,255,255,0.08)',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography
                noWrap
                sx={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: '#fff' }}
              >
                {profile?.displayName || dancer.name}
              </Typography>
              {onEdit && profile && (
                <Tooltip title="Rediger profil">
                  <IconButton
                    size="small"
                    aria-label="Rediger danser-profil"
                    data-testid={`dancer-profile-edit-${dancer.id}`}
                    onClick={onEdit}
                    sx={{ color: danceFlowColors.textMuted, p: 0.25, '&:hover': { color: danceFlowColors.lavender } }}
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            {dancer.role && (
              <Typography noWrap sx={{ fontSize: 10, color: danceFlowColors.textDisabled }}>
                {dancer.role}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* F6-2: stats-chips */}
        {stats && (stats.formationsCount > 0 || stats.rehearsalsCount > 0 || stats.annotationsCount > 0) ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }} data-testid={`dancer-stats-${dancer.id}`}>
            <Chip
              size="small"
              label={`${stats.formationsCount} form.`}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(167,139,250,0.15)', color: danceFlowColors.lavenderLight }}
            />
            <Chip
              size="small"
              label={`${stats.rehearsalsCount} prøver`}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(96,165,250,0.15)', color: danceFlowColors.infoSoft }}
            />
            <Chip
              size="small"
              label={`${stats.annotationsCount} kommentarer`}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(251,191,36,0.15)', color: danceFlowColors.gold }}
            />
          </Stack>
        ) : null}

        {profile === null ? (
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled, fontStyle: 'italic', mb: 0.75 }}>
              Ingen profil enda
            </Typography>
            {onEdit && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={onEdit}
                data-testid={`dancer-profile-create-${dancer.id}`}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  color: danceFlowColors.lavenderLight,
                  borderColor: 'rgba(139,92,246,0.4)',
                  '&:hover': { borderColor: danceFlowColors.lavender, bgcolor: 'rgba(139,92,246,0.08)' },
                }}
              >
                Opprett profil
              </Button>
            )}
          </Box>
        ) : (
          <Stack spacing={0.75} sx={{ mt: 1.25 }}>
            {/* Stil + høyde */}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {profile.primaryStyle && (
                <Chip
                  size="small"
                  label={profile.primaryStyle}
                  sx={{
                    height: 20,
                    fontSize: 10,
                    bgcolor: 'rgba(139,92,246,0.18)',
                    color: danceFlowColors.lavenderLight,
                    border: '1px solid rgba(139,92,246,0.4)',
                    textTransform: 'capitalize',
                  }}
                />
              )}
              {profile.heightCm != null && (
                <Chip
                  size="small"
                  label={`${profile.heightCm} cm`}
                  sx={{ height: 20, fontSize: 10, bgcolor: danceFlowColors.borderStrong, color: danceFlowColors.grayLight }}
                />
              )}
              <Chip
                size="small"
                icon={<InjuryIcon sx={{ fontSize: 11 }} />}
                label={injuryLabel(profile.injuryStatus)}
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: `${injuryColor(profile.injuryStatus)}20`,
                  color: injuryColor(profile.injuryStatus),
                  border: `1px solid ${injuryColor(profile.injuryStatus)}55`,
                  '& .MuiChip-icon': { color: injuryColor(profile.injuryStatus) },
                }}
              />
            </Stack>

            {/* Topp-3 ferdigheter */}
            {top.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {top.map(([cat, level]) => (
                  <Chip
                    key={cat}
                    size="small"
                    label={`${cat} · ${SKILL_LABEL_NB[level]}`}
                    sx={{
                      height: 18,
                      fontSize: 9.5,
                      bgcolor: 'rgba(34,211,238,0.12)',
                      color: '#67e8f9',
                      border: '1px solid rgba(34,211,238,0.3)',
                    }}
                  />
                ))}
              </Stack>
            )}

            {/* Tilgjengelighet i dag */}
            {availableNow != null && (
              <Typography
                sx={{
                  fontSize: 10,
                  color: availableNow ? danceFlowColors.successPrimary : danceFlowColors.textMuted,
                  fontStyle: 'italic',
                }}
              >
                {availableNow ? '✓ Tilgjengelig nå' : '— Utenfor tilgjengelighets-vindu'}
              </Typography>
            )}

            {/* Ferskhet — når ble vinduene sist bekreftet? */}
            {hasWindows && freshness && (
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  icon={<ScheduleIcon sx={{ fontSize: 11 }} />}
                  label={freshness.label}
                  data-testid={`dancer-availability-freshness-${dancer.id}`}
                  sx={{
                    height: 18,
                    fontSize: 9.5,
                    bgcolor: freshness.stale ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.12)',
                    color: freshness.stale ? danceFlowColors.gold : danceFlowColors.textMuted,
                    border: freshness.stale ? '1px solid rgba(251,191,36,0.4)' : '1px solid transparent',
                    '& .MuiChip-icon': {
                      color: freshness.stale ? danceFlowColors.gold : danceFlowColors.textMuted,
                    },
                  }}
                />
                {freshness.stale && onConfirmAvailability && (
                  <Button
                    size="small"
                    onClick={() => void handleConfirm()}
                    disabled={confirming}
                    startIcon={confirming
                      ? <CircularProgress size={11} sx={{ color: 'inherit' }} />
                      : <CheckIcon sx={{ fontSize: 12 }} />}
                    data-testid={`dancer-availability-confirm-${dancer.id}`}
                    sx={{
                      textTransform: 'none',
                      fontSize: 9.5,
                      minWidth: 0,
                      py: 0,
                      px: 0.75,
                      color: danceFlowColors.successPrimary,
                      '&:hover': { bgcolor: 'rgba(52,211,153,0.08)' },
                    }}
                  >
                    Bekreft
                  </Button>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default DancerProfileCard;
