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

import React, { useMemo } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
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

function injuryColor(status: DancerProfile['injuryStatus']): string {
  switch (status) {
    case 'healthy': return '#34d399';
    case 'rehab': return '#f87171';
    case 'cleared-with-restriction': return '#fbbf24';
    default: return '#9ca3af';
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
  compact,
  stats,
}) => {
  const initials = dancer.initials || getInitials(dancer.name);
  const top = useMemo(
    () => (profile ? topSkills(profile.skillLevels, 3) : []),
    [profile],
  );
  const availableNow = profile ? isAvailableNow(profile) : null;

  return (
    <Card
      data-testid={`dancer-profile-card-${dancer.id}`}
      sx={{
        bgcolor: '#0f1318',
        border: '1px solid #1e2536',
        boxShadow: 'none',
        borderRadius: 2,
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: '#374151' },
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
              bgcolor: dancer.color ?? '#3b82f6',
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
                    sx={{ color: '#9ca3af', p: 0.25, '&:hover': { color: '#a78bfa' } }}
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            {dancer.role && (
              <Typography noWrap sx={{ fontSize: 10, color: '#6b7280' }}>
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
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(167,139,250,0.15)', color: '#c4b5fd' }}
            />
            <Chip
              size="small"
              label={`${stats.rehearsalsCount} prøver`}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(96,165,250,0.15)', color: '#93c5fd' }}
            />
            <Chip
              size="small"
              label={`${stats.annotationsCount} kommentarer`}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
            />
          </Stack>
        ) : null}

        {profile === null ? (
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', mb: 0.75 }}>
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
                  color: '#c4b5fd',
                  borderColor: 'rgba(139,92,246,0.4)',
                  '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(139,92,246,0.08)' },
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
                    color: '#c4b5fd',
                    border: '1px solid rgba(139,92,246,0.4)',
                    textTransform: 'capitalize',
                  }}
                />
              )}
              {profile.heightCm != null && (
                <Chip
                  size="small"
                  label={`${profile.heightCm} cm`}
                  sx={{ height: 20, fontSize: 10, bgcolor: '#1e2536', color: '#cbd5e1' }}
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
                  color: availableNow ? '#34d399' : '#9ca3af',
                  fontStyle: 'italic',
                }}
              >
                {availableNow ? '✓ Tilgjengelig nå' : '— Utenfor tilgjengelighets-vindu'}
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default DancerProfileCard;
