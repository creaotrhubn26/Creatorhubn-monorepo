/**
 * ProjectTabAccessDialog — prosjektlederen styrer hvem som ser og hvem som
 * administrerer hver fane i Story Arc Studio.
 *
 * Synlig kun for leder. Tre tilgangsnivåer per fane:
 *   - Skjult        → fanen vises ikke.
 *   - Se            → synlig, men skrivebeskyttet.
 *   - Administrere  → full lese/skrive.
 *
 * To faner i dialogen:
 *   1. Pr. rolle  — sett standard for hver rolle på prosjektet.
 *   2. Pr. bruker — overstyr for enkeltpersoner (vinner over rolle).
 *
 * Presets og fane-katalog kommer fra studioAccessModel (én kilde til sannhet).
 * Uten overstyring følger en target rollens preset ("Default"); lederen kan
 * når som helst tilbakestille en overstyring til preset igjen.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress,
  Dialog, DialogContent, DialogTitle, Divider, IconButton,
  Stack, Tab, Tabs, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  Close, Person, RestartAlt, VisibilityOff, Visibility, EditNote,
} from '@mui/icons-material';
import {
  roleRoomProjectTabConfigService,
} from '../services/roleRoomProjectTabConfigService';
import type {
  ProjectTabConfigResponse, ProjectTabOverride, TabConfigTargetType,
} from '../services/roleRoomProjectTabConfigService';
import {
  STUDIO_TABS, STUDIO_TAB_CLUSTER_LABELS, ROLE_LABELS,
  presetForRole, tabAccessToTabValues,
} from '../models/studioAccessModel';
import type {
  TabAccessMap, TabAccessLevel, TabAccessState, StudioTabCluster,
} from '../models/studioAccessModel';

export interface ProjectTabAccessDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const CLUSTER_ORDER: StudioTabCluster[] = ['oversikt', 'kreativt', 'produksjon', 'forretning'];

/** Effektivt tilgangskart + om det er en eksplisitt overstyring. */
function effectiveAccess(
  config: ProjectTabConfigResponse | null,
  targetType: TabConfigTargetType,
  targetValue: string,
  fallbackRole?: string | null,
): { access: TabAccessMap; isOverride: boolean } {
  const override = config?.overrides.find(
    (o) => o.targetType === targetType && o.targetValue === targetValue,
  );
  if (override) return { access: override.tabAccess ?? {}, isOverride: true };
  return { access: presetForRole(fallbackRole ?? targetValue), isOverride: false };
}

export function ProjectTabAccessDialog({ open, onClose, projectId }: ProjectTabAccessDialogProps) {
  const [config, setConfig] = useState<ProjectTabConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<0 | 1>(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const res = await roleRoomProjectTabConfigService.getConfig(projectId);
        if (!cancelled) setConfig(res);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  const handleSetLevel = async (
    targetType: TabConfigTargetType,
    targetValue: string,
    tabKey: string,
    level: TabAccessState,
    currentAccess: TabAccessMap,
  ) => {
    const key = `${targetType}:${targetValue}`;
    setSaving(key); setError(null);
    const next: TabAccessMap = { ...currentAccess };
    if (level === 'hidden') delete next[tabKey];
    else next[tabKey] = level as TabAccessLevel;
    try {
      await roleRoomProjectTabConfigService.setOverride(projectId, targetType, targetValue, next);
      setConfig((prev) => {
        if (!prev) return prev;
        const others = prev.overrides.filter(
          (o) => !(o.targetType === targetType && o.targetValue === targetValue),
        );
        const updated: ProjectTabOverride = {
          targetType, targetValue,
          tabValues: tabAccessToTabValues(next),
          tabAccess: next,
          updatedAt: new Date().toISOString(),
        };
        return { ...prev, overrides: [...others, updated] };
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (targetType: TabConfigTargetType, targetValue: string) => {
    const key = `${targetType}:${targetValue}`;
    setSaving(key); setError(null);
    try {
      await roleRoomProjectTabConfigService.clearOverride(projectId, targetType, targetValue);
      setConfig((prev) => prev ? {
        ...prev,
        overrides: prev.overrides.filter(
          (o) => !(o.targetType === targetType && o.targetValue === targetValue),
        ),
      } : prev);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(null);
    }
  };

  const uniqueRoles = useMemo(
    () => config
      ? Array.from(new Set(config.members.map((m) => m.role).filter((r): r is string => !!r)))
      : [],
    [config],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
            PaperProps={{ sx: { borderRadius: 3, maxHeight: '88vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Tilganger
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Bestem hvem som ser og hvem som administrerer hver fane på dette prosjektet.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close /></IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1 }}>
        <AccessLegend />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v as 0 | 1)} sx={{ px: 3, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Tab label="Pr. rolle" />
        <Tab label="Pr. bruker" />
      </Tabs>

      <DialogContent sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!loading && config && tab === 0 && (
          <Stack divider={<Divider />}>
            {uniqueRoles.length === 0 && (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>Ingen roller på prosjektet ennå.</Typography>
                <Typography variant="caption">Legg til team-medlemmer først, så dukker rollene opp her.</Typography>
              </Box>
            )}
            {uniqueRoles.map((role) => {
              const { access, isOverride } = effectiveAccess(config, 'role', role);
              const key = `role:${role}`;
              return (
                <Box key={role} sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {ROLE_LABELS[role] ?? role}
                      <Chip label={isOverride ? 'Overstyrt' : 'Default'} size="small"
                            color={isOverride ? 'primary' : 'default'}
                            sx={{ ml: 1, height: 18 }} />
                    </Typography>
                    {isOverride && (
                      <Button size="small" startIcon={<RestartAlt />}
                              disabled={saving === key}
                              onClick={() => handleReset('role', role)}>
                        Tilbakestill
                      </Button>
                    )}
                  </Stack>
                  <TabAccessMatrix
                    access={access}
                    disabled={saving === key}
                    onSetLevel={(tabKey, level) => handleSetLevel('role', role, tabKey, level, access)}
                  />
                </Box>
              );
            })}
          </Stack>
        )}

        {!loading && config && tab === 1 && (
          <Stack divider={<Divider />}>
            {config.members.length === 0 && (
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>Ingen team-medlemmer ennå.</Typography>
              </Box>
            )}
            {config.members.map((m) => {
              const { access, isOverride } = effectiveAccess(config, 'user', m.userId, m.role);
              const key = `user:${m.userId}`;
              return (
                <Box key={m.userId} sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                    <Avatar src={m.profileImageUrl ?? undefined} sx={{ width: 36, height: 36 }}>
                      {m.displayName?.[0] ?? <Person />}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                        {m.displayName ?? m.email ?? '(uten navn)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.role ? (ROLE_LABELS[m.role] ?? m.role) : 'Uten rolle'}
                        {' · '}
                        {isOverride ? 'Personlig overstyring' : 'Følger rolle-default'}
                      </Typography>
                    </Box>
                    {isOverride && (
                      <Button size="small" startIcon={<RestartAlt />}
                              disabled={saving === key}
                              onClick={() => handleReset('user', m.userId)}>
                        Tilbakestill
                      </Button>
                    )}
                  </Stack>
                  <TabAccessMatrix
                    access={access}
                    disabled={saving === key}
                    onSetLevel={(tabKey, level) => handleSetLevel('user', m.userId, tabKey, level, access)}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Underkomponenter ────────────────────────────────────────────────────

function AccessLegend() {
  return (
    <Stack direction="row" spacing={2} sx={{ color: 'text.secondary' }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <VisibilityOff sx={{ fontSize: 16 }} />
        <Typography variant="caption">Skjult</Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Visibility sx={{ fontSize: 16 }} />
        <Typography variant="caption">Se (les)</Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <EditNote sx={{ fontSize: 16 }} />
        <Typography variant="caption">Administrere (skriv)</Typography>
      </Stack>
    </Stack>
  );
}

function TabAccessMatrix({ access, onSetLevel, disabled }: {
  access: TabAccessMap;
  onSetLevel: (tabKey: string, level: TabAccessState) => void;
  disabled?: boolean;
}) {
  return (
    <Stack spacing={1.25}>
      {CLUSTER_ORDER.map((cluster) => {
        const tabs = STUDIO_TABS.filter((t) => t.cluster === cluster);
        if (tabs.length === 0) return null;
        return (
          <Box key={cluster}>
            <Typography variant="overline" color="text.secondary"
                        sx={{ fontSize: 10, letterSpacing: 0.6 }}>
              {STUDIO_TAB_CLUSTER_LABELS[cluster]}
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              columnGap: 2, rowGap: 0.5,
            }}>
              {tabs.map((t) => {
                const level: TabAccessState =
                  access[t.key] === 'manage' ? 'manage'
                  : access[t.key] === 'view' ? 'view' : 'hidden';
                return (
                  <Stack key={t.key} direction="row" alignItems="center"
                         justifyContent="space-between" spacing={1}
                         sx={{ py: 0.25 }}>
                    <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                      {t.label}
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={level}
                      disabled={disabled}
                      onChange={(_, v) => { if (v) onSetLevel(t.key, v as TabAccessState); }}
                      sx={{ '& .MuiToggleButton-root': { px: 0.75, py: 0.25, border: '1px solid rgba(0,0,0,0.12)' } }}
                    >
                      <ToggleButton value="hidden" aria-label="Skjult">
                        <Tooltip title="Skjult"><VisibilityOff sx={{ fontSize: 16 }} /></Tooltip>
                      </ToggleButton>
                      <ToggleButton value="view" aria-label="Se">
                        <Tooltip title="Se (les)"><Visibility sx={{ fontSize: 16 }} /></Tooltip>
                      </ToggleButton>
                      <ToggleButton value="manage" aria-label="Administrere">
                        <Tooltip title="Administrere (skriv)"><EditNote sx={{ fontSize: 16 }} /></Tooltip>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default ProjectTabAccessDialog;
