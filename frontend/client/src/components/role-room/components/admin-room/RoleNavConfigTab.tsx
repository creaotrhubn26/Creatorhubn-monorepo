// @ts-nocheck
/**
 * RoleNavConfigTab — Admin Room-seksjon for å konfigurere hvilke faner
 * hver brukerrolle ser i Role Room. Endringene gjelder ALLE viewports:
 * telefon (bottom-nav), iPad portrait (scrollable tabs), iPad landscape
 * (side rail) og desktop (top tabs).
 *
 * UI-flyt:
 *   1. Admin velger en rolle fra venstre kolonne (11 stk).
 *   2. Høyre kolonne viser ordnet liste av faner for den rolen, med opp/ned
 *      og fjern-knapper. Nye faner legges til via en "Legg til"-velger.
 *   3. Under redigeringen vises 4 device-mockups (iPhone, iPad portrait,
 *      iPad landscape, MacBook) som live preview av navigasjonen.
 *   4. Lagre/tilbakestill-knapper sender PUT/DELETE til backend.
 *
 * Tilgjengelig kun for produkteier — ruten er email-låst på backend.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowDownward as ArrowDownIcon,
  ArrowUpward as ArrowUpIcon,
  Close as RemoveIcon,
  RestartAlt as ResetIcon,
  Save as SaveIcon,
  TheaterComedy as TheaterIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  CalendarMonth as CalendarIcon,
  YouTube as YouTubeIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Movie as MovieIcon,
  AutoFixHigh as AutoFixHighIcon,
  MoreHoriz as MoreIcon,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

import {
  ALL_USER_ROLES,
  DEFAULT_TABS_BY_ROLE,
  USER_ROLE_LABELS,
  useDeleteRoleNavConfig,
  useRoleNavConfigs,
  useUpdateRoleNavConfig,
  type SubTabValue,
} from '../../hooks/useRoleNavConfig';
import type { UserRoleType } from '../../models/casting';

interface TabSpec {
  value: SubTabValue;
  label: string;
  Icon: SvgIconComponent;
  color?: string;
}

const ALL_TABS: TabSpec[] = [
  { value: 'roles', label: 'Roller', Icon: TheaterIcon, color: '#f48fb1' },
  { value: 'candidates', label: 'Kandidater', Icon: PersonIcon, color: '#10b981' },
  { value: 'crew', label: 'Crew', Icon: GroupIcon, color: '#00d4ff' },
  { value: 'schedule', label: 'Tidsplan', Icon: CalendarIcon, color: '#9c27b0' },
  { value: 'publishing', label: 'Publisering', Icon: YouTubeIcon, color: '#ff0000' },
  { value: 'carousel', label: 'Ukescontent', Icon: EditIcon, color: '#84cc16' },
  { value: 'approval', label: 'Godkjenning', Icon: CheckCircleIcon, color: '#10b981' },
  { value: 'brief', label: 'Brief', Icon: EditIcon, color: '#3b82f6' },
  { value: 'planner', label: 'Planner', Icon: ScheduleIcon, color: '#a78bfa' },
  { value: 'shooting', label: 'Skyting', Icon: MovieIcon, color: '#ef4444' },
  { value: 'shotlist', label: 'Shotliste', Icon: TheaterIcon, color: '#ec4899' },
  { value: 'mannskap', label: 'Mannskap', Icon: GroupIcon, color: '#06b6d4' },
  { value: 'agent', label: 'Agent', Icon: AutoFixHighIcon, color: '#a78bfa' },
];

const TAB_BY_VALUE: Record<SubTabValue, TabSpec> = ALL_TABS.reduce(
  (acc, t) => {
    acc[t.value] = t;
    return acc;
  },
  {} as Record<SubTabValue, TabSpec>,
);

export const RoleNavConfigTab: React.FC = () => {
  const { data: configs, isLoading, error } = useRoleNavConfigs();
  const updateMut = useUpdateRoleNavConfig();
  const deleteMut = useDeleteRoleNavConfig();

  const [selectedRole, setSelectedRole] = useState<UserRoleType>('director');
  const [draftTabs, setDraftTabs] = useState<SubTabValue[]>([]);
  const [addValue, setAddValue] = useState<string>('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Resync draft når rolle eller server-data endres
  useEffect(() => {
    const fromServer = configs?.find((c) => c.role === selectedRole);
    if (fromServer && fromServer.tabValues.length > 0) {
      setDraftTabs(fromServer.tabValues);
    } else {
      setDraftTabs(DEFAULT_TABS_BY_ROLE[selectedRole] ?? []);
    }
    setAddValue('');
  }, [selectedRole, configs]);

  const draftSet = useMemo(() => new Set(draftTabs), [draftTabs]);
  const remainingTabs = useMemo(
    () => ALL_TABS.filter((t) => !draftSet.has(t.value)),
    [draftSet],
  );

  const isDirty = useMemo(() => {
    const fromServer = configs?.find((c) => c.role === selectedRole);
    const baseline = fromServer?.tabValues ?? DEFAULT_TABS_BY_ROLE[selectedRole] ?? [];
    if (baseline.length !== draftTabs.length) return true;
    return baseline.some((v, i) => v !== draftTabs[i]);
  }, [configs, draftTabs, selectedRole]);

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setDraftTabs((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (idx: number) => {
    setDraftTabs((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  };
  const removeAt = (idx: number) => {
    setDraftTabs((prev) => prev.filter((_, i) => i !== idx));
  };
  const addTab = (val: string) => {
    if (!val || draftSet.has(val as SubTabValue)) return;
    setDraftTabs((prev) => [...prev, val as SubTabValue]);
    setAddValue('');
  };

  const handleSave = async () => {
    if (draftTabs.length === 0) {
      setFeedback({ kind: 'error', message: 'Minst én fane må være valgt.' });
      return;
    }
    try {
      await updateMut.mutateAsync({ role: selectedRole, tabValues: draftTabs });
      setFeedback({ kind: 'success', message: `Lagret konfig for "${USER_ROLE_LABELS[selectedRole]}".` });
    } catch (err) {
      setFeedback({ kind: 'error', message: (err as Error).message });
    }
  };

  const handleReset = async () => {
    try {
      await deleteMut.mutateAsync(selectedRole);
      setDraftTabs(DEFAULT_TABS_BY_ROLE[selectedRole] ?? []);
      setFeedback({ kind: 'success', message: `Tilbakestilt til standard for "${USER_ROLE_LABELS[selectedRole]}".` });
    } catch (err) {
      setFeedback({ kind: 'error', message: (err as Error).message });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: '#a78bfa' }} />
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      {error && (
        <Alert severity="error">Kunne ikke laste konfig: {(error as Error).message}</Alert>
      )}
      {feedback && (
        <Alert severity={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Typography sx={{ color: '#cbd5e1', fontSize: '0.92rem' }}>
        Velg en rolle og bestem hvilke faner brukere med den rolen skal se, og i hvilken rekkefølge.
        Telefon viser de 4 første som primære i bunn-nav-en + resten i &laquo;Mer&raquo;-arket.
        iPad og desktop viser alle valgte faner i denne rekkefølgen.
      </Typography>

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.16)' }}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
              gap: 2.5,
            }}
          >
            {/* Rolle-velger */}
            <Box>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, letterSpacing: 0.5, mb: 1 }}>
                ROLLER ({ALL_USER_ROLES.length})
              </Typography>
              <Stack spacing={0.5}>
                {ALL_USER_ROLES.map((role) => {
                  const isActive = role === selectedRole;
                  const hasOverride = configs?.some((c) => c.role === role);
                  return (
                    <Box
                      key={role}
                      component="button"
                      onClick={() => setSelectedRole(role)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        px: 1.25,
                        py: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: isActive ? '#a78bfa' : 'rgba(148,163,184,0.16)',
                        bgcolor: isActive ? 'rgba(167,139,250,0.16)' : 'transparent',
                        color: isActive ? '#fff' : '#cbd5e1',
                        textAlign: 'left',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        WebkitTapHighlightColor: 'transparent',
                        '&:hover': { bgcolor: 'rgba(167,139,250,0.08)' },
                      }}
                    >
                      <span>{USER_ROLE_LABELS[role]}</span>
                      {hasOverride && (
                        <Chip
                          label="Egendefinert"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: 'rgba(167,139,250,0.2)',
                            color: '#c4b5fd',
                          }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* Tab-editor */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                  {USER_ROLE_LABELS[selectedRole]}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Tilbakestill til standard">
                    <span>
                      <Button
                        size="small"
                        startIcon={<ResetIcon />}
                        onClick={handleReset}
                        disabled={deleteMut.isPending || !configs?.some((c) => c.role === selectedRole)}
                        sx={{
                          color: '#cbd5e1',
                          textTransform: 'none',
                          '&:hover': { bgcolor: 'rgba(148,163,184,0.08)' },
                        }}
                      >
                        Tilbakestill
                      </Button>
                    </span>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={!isDirty || updateMut.isPending}
                    sx={{
                      bgcolor: '#a78bfa',
                      color: '#0b0815',
                      textTransform: 'none',
                      fontWeight: 700,
                      '&:hover': { bgcolor: '#8b5cf6' },
                    }}
                  >
                    {updateMut.isPending ? 'Lagrer…' : 'Lagre'}
                  </Button>
                </Stack>
              </Box>

              <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', mb: 1 }}>
                Rekkefølgen avgjør prioriteten — første 4 blir primære i bunn-nav-en på telefon.
              </Typography>

              <Stack spacing={0.75}>
                {draftTabs.map((value, idx) => {
                  const spec = TAB_BY_VALUE[value];
                  if (!spec) return null;
                  const SpecIcon = spec.Icon;
                  const isPrimary = idx < 4;
                  return (
                    <Box
                      key={value}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 0.75,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: isPrimary ? `${spec.color}55` : 'rgba(148,163,184,0.12)',
                        bgcolor: isPrimary ? `${spec.color}10` : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <Typography
                        sx={{
                          width: 24,
                          textAlign: 'center',
                          color: isPrimary ? spec.color : '#94a3b8',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        {idx + 1}
                      </Typography>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          bgcolor: `${spec.color}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <SpecIcon sx={{ fontSize: 16, color: spec.color }} />
                      </Box>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.88rem', flex: 1 }}>
                        {spec.label}
                      </Typography>
                      {isPrimary && (
                        <Chip
                          label={`Primær (${idx + 1})`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: `${spec.color}25`,
                            color: spec.color,
                          }}
                        />
                      )}
                      <IconButton
                        size="small"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        aria-label="Flytt opp"
                        sx={{ color: '#94a3b8', '&:hover': { color: '#fff' } }}
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveDown(idx)}
                        disabled={idx >= draftTabs.length - 1}
                        aria-label="Flytt ned"
                        sx={{ color: '#94a3b8', '&:hover': { color: '#fff' } }}
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => removeAt(idx)}
                        aria-label="Fjern"
                        sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>

              {remainingTabs.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                  <Select
                    size="small"
                    value={addValue}
                    onChange={(e) => setAddValue(String(e.target.value))}
                    displayEmpty
                    sx={{
                      flex: 1,
                      color: '#e2e8f0',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
                    }}
                  >
                    <MenuItem value="">
                      <em style={{ color: '#94a3b8' }}>Velg en fane å legge til…</em>
                    </MenuItem>
                    {remainingTabs.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <t.Icon sx={{ fontSize: 16, color: t.color }} />
                          <span>{t.label}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                  <Button
                    size="small"
                    onClick={() => addTab(addValue)}
                    disabled={!addValue}
                    sx={{
                      color: '#a78bfa',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(167,139,250,0.08)' },
                    }}
                  >
                    Legg til
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Live preview i 4 device-mockups */}
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.16)' }}>
        <CardContent>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, letterSpacing: 0.5, mb: 0.5 }}>
            FORHÅNDSVISNING I ALLE VIEWPORTS
          </Typography>
          <Typography sx={{ color: '#cbd5e1', fontSize: '0.82rem', mb: 2 }}>
            Slik ser navigasjonen ut for {USER_ROLE_LABELS[selectedRole]} på hver enhet.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 2,
              alignItems: 'end',
              justifyItems: 'center',
            }}
          >
            <PhoneMockup tabs={draftTabs} />
            <IpadPortraitMockup tabs={draftTabs} />
            <IpadLandscapeMockup tabs={draftTabs} />
            <MacbookMockup tabs={draftTabs} />
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

// ────────────────────────────────────────────────────────────────────────
// Device mockups — riktig aspect-ratio for hver enhet, kompakt for å passe i admin-UI
// iPhone 15 Pro:    393×852 → 19.5:9 (≈0.461)
// iPad Pro 11":     834×1194 → 1.43:1 (portrait)
// MacBook Pro 14":  3024×1964 → 1.54:1 + base
// ────────────────────────────────────────────────────────────────────────

const PHONE_W = 150;
const PHONE_H = 325; // 150 / 0.461 ≈ 325

const IPAD_P_W = 200;
const IPAD_P_H = 286; // 200 * (1194/834) ≈ 286

const IPAD_L_W = 286;
const IPAD_L_H = 200;

const MAC_W = 320;
const MAC_SCREEN_H = 200; // 16:10 aspect for screen
const MAC_BASE_H = 12;

interface MockupProps { tabs: SubTabValue[] }

function PhoneMockup({ tabs }: MockupProps) {
  const primary = tabs.slice(0, 4);
  const hasOverflow = tabs.length > 4;
  return (
    <Stack alignItems="center" spacing={1}>
      <Box
        aria-label="Telefon-mockup"
        sx={{
          width: PHONE_W,
          height: PHONE_H,
          borderRadius: 4.5,
          bgcolor: '#0a0815',
          border: '3px solid #1a1530',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Dynamic Island */}
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 50,
            height: 14,
            bgcolor: '#000',
            borderRadius: 7,
            zIndex: 2,
          }}
        />
        {/* Screen content */}
        <Box
          sx={{
            position: 'absolute',
            inset: 4,
            borderRadius: 3.5,
            bgcolor: '#16112c',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Status bar spacer for island */}
          <Box sx={{ height: 24, flexShrink: 0 }} />

          {/* Mock content */}
          <Box sx={{ flex: 1, p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ height: 22, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Box sx={{ height: 36, borderRadius: 0.75, bgcolor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.24)' }} />
            <Box sx={{ height: 14, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.06)', width: '70%' }} />
            <Box sx={{ flex: 1 }} />
          </Box>

          {/* Bottom-nav: 4 primary + Mer */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(15,12,33,0.96)',
              px: 0.25,
              py: 0.5,
            }}
          >
            {primary.map((v, i) => {
              const spec = TAB_BY_VALUE[v];
              if (!spec) return <Box key={v} />;
              const Icon = spec.Icon;
              return (
                <Stack key={v} alignItems="center" spacing={0.25} sx={{ py: 0.25 }}>
                  <Icon sx={{ fontSize: 12, color: i === 0 ? '#a78bfa' : 'rgba(255,255,255,0.6)' }} />
                  <Typography sx={{ fontSize: '0.45rem', color: i === 0 ? '#a78bfa' : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
                    {spec.label.length > 7 ? spec.label.slice(0, 6) + '…' : spec.label}
                  </Typography>
                </Stack>
              );
            })}
            <Stack alignItems="center" spacing={0.25} sx={{ py: 0.25 }}>
              <MoreIcon sx={{ fontSize: 12, color: hasOverflow ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)' }} />
              <Typography sx={{ fontSize: '0.45rem', color: hasOverflow ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)', lineHeight: 1 }}>
                Mer
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>iPhone (telefon)</Typography>
    </Stack>
  );
}

function IpadPortraitMockup({ tabs }: MockupProps) {
  const display = tabs.slice(0, 6);
  const hasMore = tabs.length > display.length;
  return (
    <Stack alignItems="center" spacing={1}>
      <Box
        aria-label="iPad portrait-mockup"
        sx={{
          width: IPAD_P_W,
          height: IPAD_P_H,
          borderRadius: 3,
          bgcolor: '#0a0815',
          border: '4px solid #1a1530',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 4,
            borderRadius: 2,
            bgcolor: '#16112c',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top tabs (scrollable strip) */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              px: 0.75,
              py: 0.5,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {display.map((v, i) => {
              const spec = TAB_BY_VALUE[v];
              if (!spec) return null;
              const Icon = spec.Icon;
              const isActive = i === 0;
              return (
                <Box
                  key={v}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.4,
                    px: 0.5,
                    py: 0.5,
                    borderBottom: isActive ? '2px solid #a78bfa' : '2px solid transparent',
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 10, color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.6)' }} />
                  <Typography sx={{ fontSize: '0.5rem', color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
                    {spec.label.length > 8 ? spec.label.slice(0, 7) + '…' : spec.label}
                  </Typography>
                </Box>
              );
            })}
            {hasMore && (
              <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)' }}>›</Typography>
              </Box>
            )}
          </Box>
          {/* Content area */}
          <Box sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ height: 28, borderRadius: 0.75, bgcolor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.24)' }} />
            <Box sx={{ height: 12, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Box sx={{ height: 12, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.06)', width: '70%' }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mt: 0.5 }}>
              <Box sx={{ height: 36, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Box sx={{ height: 36, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
            </Box>
          </Box>
        </Box>
      </Box>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>iPad portrait</Typography>
    </Stack>
  );
}

function IpadLandscapeMockup({ tabs }: MockupProps) {
  return (
    <Stack alignItems="center" spacing={1}>
      <Box
        aria-label="iPad landscape-mockup"
        sx={{
          width: IPAD_L_W,
          height: IPAD_L_H,
          borderRadius: 3,
          bgcolor: '#0a0815',
          border: '4px solid #1a1530',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 4,
            borderRadius: 2,
            bgcolor: '#16112c',
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          {/* Side rail */}
          <Box
            sx={{
              width: 56,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(20,14,48,0.55)',
              py: 0.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              overflowY: 'auto',
            }}
          >
            {tabs.slice(0, 6).map((v, i) => {
              const spec = TAB_BY_VALUE[v];
              if (!spec) return null;
              const Icon = spec.Icon;
              const isActive = i === 0;
              return (
                <Stack
                  key={v}
                  alignItems="center"
                  spacing={0.2}
                  sx={{
                    py: 0.5,
                    position: 'relative',
                    bgcolor: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
                  }}
                >
                  {isActive && (
                    <Box sx={{ position: 'absolute', left: 2, top: 6, bottom: 6, width: 2, bgcolor: '#a78bfa', borderRadius: 1 }} />
                  )}
                  <Icon sx={{ fontSize: 12, color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.6)' }} />
                  <Typography sx={{ fontSize: '0.46rem', color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.6)', lineHeight: 1, textAlign: 'center', maxWidth: 50, overflow: 'hidden' }}>
                    {spec.label.length > 7 ? spec.label.slice(0, 6) + '…' : spec.label}
                  </Typography>
                </Stack>
              );
            })}
          </Box>
          {/* Content area */}
          <Box sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ height: 18, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.06)', width: '50%' }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mt: 0.5 }}>
              <Box sx={{ height: 30, borderRadius: 0.75, bgcolor: 'rgba(167,139,250,0.1)' }} />
              <Box sx={{ height: 30, borderRadius: 0.75, bgcolor: 'rgba(167,139,250,0.1)' }} />
            </Box>
            <Box sx={{ height: 60, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
          </Box>
        </Box>
      </Box>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>iPad landscape</Typography>
    </Stack>
  );
}

function MacbookMockup({ tabs }: MockupProps) {
  const display = tabs.slice(0, 8);
  const hasMore = tabs.length > display.length;
  return (
    <Stack alignItems="center" spacing={1}>
      <Box aria-label="MacBook-mockup" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Screen */}
        <Box
          sx={{
            width: MAC_W,
            height: MAC_SCREEN_H,
            borderRadius: '8px 8px 2px 2px',
            bgcolor: '#0a0815',
            border: '4px solid #1a1530',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Camera notch */}
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 30,
              height: 5,
              bgcolor: '#0a0815',
              borderRadius: '0 0 4px 4px',
              zIndex: 2,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 4,
              borderRadius: 1,
              bgcolor: '#16112c',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Browser chrome */}
            <Box sx={{ height: 14, bgcolor: 'rgba(20,14,48,0.8)', display: 'flex', alignItems: 'center', px: 0.75, gap: 0.4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ff5f56' }} />
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#27c93f' }} />
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.5)' }}>theroleroom.com</Typography>
              <Box sx={{ flex: 1 }} />
            </Box>
            {/* Top tabs */}
            <Box
              sx={{
                display: 'flex',
                gap: 0.4,
                px: 0.75,
                py: 0.5,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {display.map((v, i) => {
                const spec = TAB_BY_VALUE[v];
                if (!spec) return null;
                const Icon = spec.Icon;
                const isActive = i === 0;
                return (
                  <Box
                    key={v}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.3,
                      px: 0.5,
                      py: 0.4,
                      borderBottom: isActive ? '2px solid #a78bfa' : '2px solid transparent',
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 9, color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.6)' }} />
                    <Typography sx={{ fontSize: '0.5rem', color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
                      {spec.label.length > 9 ? spec.label.slice(0, 8) + '…' : spec.label}
                    </Typography>
                  </Box>
                );
              })}
              {hasMore && (
                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', px: 0.5, alignSelf: 'center' }}>+{tabs.length - display.length}</Typography>
              )}
            </Box>
            {/* Content */}
            <Box sx={{ flex: 1, p: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5, alignContent: 'start' }}>
              <Box sx={{ height: 30, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Box sx={{ height: 30, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Box sx={{ height: 30, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
              <Box sx={{ height: 30, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.04)' }} />
            </Box>
          </Box>
        </Box>
        {/* Base / hinge */}
        <Box
          sx={{
            width: MAC_W + 24,
            height: MAC_BASE_H,
            background: 'linear-gradient(180deg, #2a2540 0%, #1a1530 60%, #0f0a20 100%)',
            borderRadius: '0 0 12px 12px',
            position: 'relative',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 60,
              height: 3,
              bgcolor: '#0a0815',
              borderRadius: '0 0 4px 4px',
            }}
          />
        </Box>
      </Box>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>MacBook (desktop)</Typography>
    </Stack>
  );
}

export default RoleNavConfigTab;
