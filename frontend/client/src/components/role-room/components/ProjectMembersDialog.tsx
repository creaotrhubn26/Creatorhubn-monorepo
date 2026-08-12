/**
 * ProjectMembersDialog — produksjonsteam-leder ser aktive + fjernede
 * medlemmer på prosjektet og kan deaktivere / reaktivere / (kommer)
 * permanent slette.
 *
 * Soft-delete: frigir seat-billing, beholder all bruker-data.
 * Reaktiver: tar tilbake seat-billing igjen.
 * Permanent: knapp eksisterer men viser "kommer snart" — vi sletter
 * ikke bruker-data uten å vite at det er trygt.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Stack, Tab, Tabs,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Close, Delete, DeleteForever, PersonAdd, PersonOff, Person,
} from '@mui/icons-material';
import { roleRoomProjectMembersService } from '../services/roleRoomProjectMembersService';
import type { ProjectMember } from '../services/roleRoomProjectMembersService';
import { useProjectMemberAvailability } from '../hooks/useProjectMemberAvailability';
import { summarizeAvailabilityForToday } from '../utils/crewAvailabilitySync';
import { useT } from '../../../i18n';

export interface ProjectMembersDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Kalles etter membership-endring så parent kan re-fetche seat-status. */
  onMembershipChanged?: () => void;
}

export function ProjectMembersDialog({
  open, onClose, projectId, onMembershipChanged,
}: ProjectMembersDialogProps) {
  const { t } = useT();
  const [tab, setTab] = useState<0 | 1>(0);
  const [active, setActive] = useState<ProjectMember[]>([]);
  const [removed, setRemoved] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<ProjectMember | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [permanentNotice, setPermanentNotice] = useState(false);

  // Tilgjengelighet fra medlemmenes egne kalendere (samme delte kilde som Crew
  // Management) — så lederen ser hvem som er ledig mens teamet settes sammen.
  const { availabilityByUser } = useProjectMemberAvailability(open ? projectId : undefined);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [a, r] = await Promise.all([
        roleRoomProjectMembersService.list(projectId, 'active'),
        roleRoomProjectMembersService.list(projectId, 'removed'),
      ]);
      setActive(a.members);
      setRemoved(r.members);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();

  }, [open, projectId]);

  const handleDeactivate = async () => {
    if (!confirmRemove) return;
    setBusy(confirmRemove.userId); setError(null);
    try {
      const res = await roleRoomProjectMembersService.deactivate(projectId, confirmRemove.userId, removeReason);
      setConfirmRemove(null); setRemoveReason('');
      await load();
      onMembershipChanged?.();
      if (res.stripeWarning) {
        setError(t('projMembers.deactivateWarning', { warning: res.stripeWarning }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = async (m: ProjectMember) => {
    setBusy(m.userId); setError(null);
    try {
      const res = await roleRoomProjectMembersService.reactivate(projectId, m.userId);
      await load();
      onMembershipChanged?.();
      if (res.stripeWarning) {
        setError(t('projMembers.reactivateWarning', { warning: res.stripeWarning }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
              PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {t('projMembers.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('projMembers.subtitle')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><Close /></IconButton>
        </DialogTitle>

        <Tabs value={tab} onChange={(_, v) => setTab(v as 0 | 1)} sx={{ px: 3, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <Tab label={t('projMembers.tabActive', { n: active.length })} />
          <Tab label={t('projMembers.tabRemoved', { n: removed.length })} />
        </Tabs>

        <DialogContent sx={{ p: 0 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}
          {error && <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>{error}</Alert>}

          {!loading && tab === 0 && (
            <Stack divider={<Divider />}>
              {active.length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography>{t('projMembers.noActive')}</Typography>
                  <Typography variant="caption">{t('projMembers.addViaCrew')}</Typography>
                </Box>
              )}
              {active.map((m) => (
                <MemberRow
                  key={m.userId}
                  member={m}
                  busy={busy === m.userId}
                  availabilityLabel={summarizeAvailabilityForToday(availabilityByUser.get(m.userId))}
                  actions={
                    <Button size="small" color="error" startIcon={<PersonOff />}
                            disabled={busy === m.userId}
                            onClick={() => setConfirmRemove(m)}>
                      {t('projMembers.remove')}
                    </Button>
                  }
                />
              ))}
            </Stack>
          )}

          {!loading && tab === 1 && (
            <Stack divider={<Divider />}>
              {removed.length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography>{t('projMembers.noRemoved')}</Typography>
                </Box>
              )}
              {removed.map((m) => (
                <MemberRow
                  key={m.userId}
                  member={m}
                  busy={busy === m.userId}
                  actions={
                    <Stack direction="row" spacing={1}>
                      <Button size="small" color="error" startIcon={<DeleteForever />}
                              disabled={busy === m.userId}
                              onClick={() => setPermanentNotice(true)}>
                        {t('projMembers.deletePermanent')}
                      </Button>
                      <Button size="small" variant="outlined" color="primary" startIcon={<PersonAdd />}
                              disabled={busy === m.userId}
                              onClick={() => void handleReactivate(m)}>
                        {t('projMembers.reactivate')}
                      </Button>
                    </Stack>
                  }
                />
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Soft-delete bekreftelse */}
      <Dialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('projMembers.removeMemberTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{confirmRemove?.displayName ?? confirmRemove?.email ?? t('projMembers.memberFallback')}</strong>{' '}
            {t('projMembers.losesAccess')}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('projMembers.freesSeatPre')}<strong>{t('projMembers.freesSeatBold')}</strong>{t('projMembers.freesSeatPost')}
          </Alert>
          <TextField fullWidth size="small" label={t('projMembers.reasonLabel')}
                     value={removeReason}
                     onChange={(e) => setRemoveReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)}>{t('projMembers.cancel')}</Button>
          <Button color="error" variant="contained" startIcon={<Delete />}
                  disabled={busy === confirmRemove?.userId}
                  onClick={() => void handleDeactivate()}>
            {t('projMembers.removeMemberTitle')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent-slett notice */}
      <Dialog open={permanentNotice} onClose={() => setPermanentNotice(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('projMembers.permanentTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('projMembers.permanentNotice1')}
          </Alert>
          <Typography variant="body2">
            {t('projMembers.permanentNotice2')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermanentNotice(false)}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function MemberRow({ member, actions, busy, availabilityLabel }: {
  member: ProjectMember; actions: React.ReactNode; busy: boolean;
  availabilityLabel?: string | null;
}) {
  const { t } = useT();
  return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5,
                opacity: member.isActive ? 1 : 0.75 }}>
      <Avatar src={member.profileImageUrl ?? undefined} sx={{ width: 48, height: 48 }}>
        {member.displayName?.[0] ?? <Person />}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
          {member.displayName ?? member.email ?? t('projMembers.noName')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {member.role ?? t('projMembers.noRole')}
          {member.email && ` · ${member.email}`}
        </Typography>
        {!member.isActive && member.deactivatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {t('projMembers.removedOn', { date: new Date(member.deactivatedAt).toLocaleDateString('nb-NO') })}
            {member.deactivationReason ? ` — ${member.deactivationReason}` : ''}
          </Typography>
        )}
        {member.professions.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {member.professions.slice(0, 3).map((p) => (
              <Chip key={p} label={p} size="small" sx={{ height: 18, fontSize: 11 }} />
            ))}
          </Stack>
        )}
        {availabilityLabel && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip
              label={availabilityLabel}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: 11, borderColor: '#a030c0', color: '#c07fe0' }}
            />
            <Tooltip title={t('projMembers.syncedTooltip')} arrow>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#a030c0',
                         boxShadow: '0 0 4px rgba(160,48,192,0.9)' }} />
            </Tooltip>
          </Stack>
        )}
      </Box>
      <Box sx={{ pt: 0.5 }}>
        {busy ? <CircularProgress size={20} /> : actions}
      </Box>
    </Box>
  );
}

export default ProjectMembersDialog;
