/**
 * ProjectTabAccessDialog — produksjonsteam-leder styrer hvilke faner
 * hver rolle og enkeltbruker ser på prosjektet sitt.
 *
 * Synlig kun for leder. Wired fra CrewSubPanel via "Tab-tilganger"-knapp.
 *
 * UX: To faner i selve dialogen:
 *   1. Pr. rolle — matrise (rolle × tab) for kjapp bulk-konfig.
 *   2. Pr. bruker — overstyrer for spesifikke personer.
 *
 * Hvis ingen override finnes for en target, vises "Bruker plattform-default"
 * og bryteren er ufylt. Brukeren legger til override ved å klikke.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Checkbox, Chip, CircularProgress,
  Dialog, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton,
  Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { Close, Person, RestartAlt } from '@mui/icons-material';
import {
  roleRoomProjectTabConfigService,
} from '../services/roleRoomProjectTabConfigService';
import type {
  ProjectTabConfigResponse, ProjectTabMember, ProjectTabOverride,
  TabConfigTargetType,
} from '../services/roleRoomProjectTabConfigService';

export interface ProjectTabAccessDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const TAB_LABELS: Record<string, string> = {
  roles: 'Roller', candidates: 'Kandidater', crew: 'Crew', schedule: 'Tidsplan',
  publishing: 'Publisering', carousel: 'Carousel', approval: 'Godkjenning',
  brief: 'Brief', planner: 'Planner', shooting: 'Shooting', shotlist: 'Shotlist',
  mannskap: 'Mannskap', agent: 'Agent', economy: 'Økonomi', 'admin-room': 'Admin Room',
};

const ROLE_LABELS: Record<string, string> = {
  leder: 'Leder (deg)',
  director: 'Director', producer: 'Producer', casting_director: 'Casting Director',
  production_manager: 'Production Manager', camera_team: 'Camera Team',
  content_producer: 'Content Producer', client_reviewer: 'Klient/reviewer',
  agency: 'Byrå', writer: 'Forfatter', script_editor: 'Script Editor',
  reader: 'Leser',
};

const FALLBACK_DEFAULTS_BY_ROLE: Record<string, string[]> = {
  leder: ['roles', 'candidates', 'crew', 'schedule', 'brief', 'planner', 'approval', 'shooting', 'shotlist', 'mannskap', 'economy', 'agent', 'publishing', 'admin-room'],
  director: ['roles', 'candidates', 'schedule', 'brief', 'crew', 'approval', 'shooting', 'shotlist', 'planner', 'agent'],
  producer: ['roles', 'schedule', 'crew', 'approval', 'candidates', 'brief', 'planner', 'shooting', 'shotlist', 'mannskap', 'agent'],
  casting_director: ['roles', 'candidates', 'schedule', 'brief', 'approval', 'crew', 'planner', 'agent'],
  production_manager: ['roles', 'schedule', 'crew', 'approval', 'candidates', 'shooting', 'shotlist', 'mannskap', 'planner'],
  camera_team: ['shooting', 'shotlist', 'schedule', 'crew', 'mannskap', 'roles'],
  content_producer: ['candidates', 'brief', 'planner', 'approval', 'economy', 'roles', 'carousel', 'publishing', 'schedule', 'agent'],
  client_reviewer: ['approval', 'brief'],
};

function tabsForTarget(
  config: ProjectTabConfigResponse | null,
  targetType: TabConfigTargetType,
  targetValue: string,
  fallbackRole?: string | null,
): { values: string[]; isOverride: boolean } {
  if (!config) return { values: [], isOverride: false };
  const override = config.overrides.find(
    (o) => o.targetType === targetType && o.targetValue === targetValue,
  );
  if (override) return { values: override.tabValues, isOverride: true };
  const roleKey = fallbackRole ?? targetValue;
  return {
    values: FALLBACK_DEFAULTS_BY_ROLE[roleKey] ?? FALLBACK_DEFAULTS_BY_ROLE.producer,
    isOverride: false,
  };
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

  const handleToggle = async (
    targetType: TabConfigTargetType,
    targetValue: string,
    tabKey: string,
    currentValues: string[],
  ) => {
    const key = `${targetType}:${targetValue}`;
    setSaving(key); setError(null);
    const next = currentValues.includes(tabKey)
      ? currentValues.filter((v) => v !== tabKey)
      : [...currentValues, tabKey];
    try {
      await roleRoomProjectTabConfigService.setOverride(projectId, targetType, targetValue, next);
      // Oppdater lokalt
      setConfig((prev) => {
        if (!prev) return prev;
        const others = prev.overrides.filter(
          (o) => !(o.targetType === targetType && o.targetValue === targetValue),
        );
        const updated: ProjectTabOverride = {
          targetType, targetValue, tabValues: next, updatedAt: new Date().toISOString(),
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

  const allTabs = config?.validTabValues ?? Object.keys(TAB_LABELS);
  const uniqueRoles = config
    ? Array.from(new Set(config.members.map((m) => m.role).filter((r): r is string => !!r)))
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
            PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Tab-tilganger
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Styr hvilke faner hver rolle og bruker ser på dette prosjektet.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close /></IconButton>
      </DialogTitle>

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
                <Typography>Ingen team-medlemmer ennå.</Typography>
                <Typography variant="caption">Legg til medlemmer i Crew-fanen først.</Typography>
              </Box>
            )}
            {uniqueRoles.map((role) => {
              const { values, isOverride } = tabsForTarget(config, 'role', role);
              const key = `role:${role}`;
              return (
                <Box key={role} sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {ROLE_LABELS[role] ?? role}
                      {isOverride ? (
                        <Chip label="Overstyrt" size="small" color="primary" sx={{ ml: 1, height: 18 }} />
                      ) : (
                        <Chip label="Default" size="small" sx={{ ml: 1, height: 18 }} />
                      )}
                    </Typography>
                    {isOverride && (
                      <Button size="small" startIcon={<RestartAlt />}
                              disabled={saving === key}
                              onClick={() => handleReset('role', role)}>
                        Tilbakestill
                      </Button>
                    )}
                  </Stack>
                  <TabCheckboxGrid
                    allTabs={allTabs}
                    selected={values}
                    onToggle={(t) => handleToggle('role', role, t, values)}
                    disabled={saving === key}
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
              const { values, isOverride } = tabsForTarget(config, 'user', m.userId, m.role);
              const key = `user:${m.userId}`;
              return (
                <Box key={m.userId} sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
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
                  <TabCheckboxGrid
                    allTabs={allTabs}
                    selected={values}
                    onToggle={(t) => handleToggle('user', m.userId, t, values)}
                    disabled={saving === key}
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

function TabCheckboxGrid({ allTabs, selected, onToggle, disabled }: {
  allTabs: string[]; selected: string[]; onToggle: (tab: string) => void; disabled?: boolean;
}) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
      gap: 0.25,
    }}>
      {allTabs.map((t) => (
        <FormControlLabel
          key={t}
          control={
            <Checkbox size="small" checked={selected.includes(t)} disabled={disabled}
                      onChange={() => onToggle(t)} />
          }
          label={<Typography variant="body2">{TAB_LABELS[t] ?? t}</Typography>}
          sx={{ m: 0 }}
        />
      ))}
    </Box>
  );
}

export default ProjectTabAccessDialog;
