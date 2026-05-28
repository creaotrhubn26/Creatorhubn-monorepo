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
  TextField, Typography,
} from '@mui/material';
import {
  Close, Delete, DeleteForever, PersonAdd, PersonOff, Person,
} from '@mui/icons-material';
import { roleRoomProjectMembersService } from '../services/roleRoomProjectMembersService';
import type { ProjectMember } from '../services/roleRoomProjectMembersService';

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
  const [tab, setTab] = useState<0 | 1>(0);
  const [active, setActive] = useState<ProjectMember[]>([]);
  const [removed, setRemoved] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<ProjectMember | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [permanentNotice, setPermanentNotice] = useState(false);

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
      await roleRoomProjectMembersService.deactivate(projectId, confirmRemove.userId, removeReason);
      setConfirmRemove(null); setRemoveReason('');
      await load();
      onMembershipChanged?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = async (m: ProjectMember) => {
    setBusy(m.userId); setError(null);
    try {
      await roleRoomProjectMembersService.reactivate(projectId, m.userId);
      await load();
      onMembershipChanged?.();
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
              Medlemmer
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Administrer hvem som har tilgang. Å fjerne et medlem frigir seat-billing.
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><Close /></IconButton>
        </DialogTitle>

        <Tabs value={tab} onChange={(_, v) => setTab(v as 0 | 1)} sx={{ px: 3, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <Tab label={`Aktive (${active.length})`} />
          <Tab label={`Fjernede (${removed.length})`} />
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
                  <Typography>Ingen aktive medlemmer ennå.</Typography>
                  <Typography variant="caption">Legg dem til via Crew-fanen.</Typography>
                </Box>
              )}
              {active.map((m) => (
                <MemberRow
                  key={m.userId}
                  member={m}
                  busy={busy === m.userId}
                  actions={
                    <Button size="small" color="error" startIcon={<PersonOff />}
                            disabled={busy === m.userId}
                            onClick={() => setConfirmRemove(m)}>
                      Fjern
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
                  <Typography>Ingen fjernede medlemmer.</Typography>
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
                        Slett permanent
                      </Button>
                      <Button size="small" variant="outlined" color="primary" startIcon={<PersonAdd />}
                              disabled={busy === m.userId}
                              onClick={() => void handleReactivate(m)}>
                        Aktiver igjen
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
        <DialogTitle>Fjern medlem</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{confirmRemove?.displayName ?? confirmRemove?.email ?? 'Medlem'}</strong>{' '}
            mister tilgang til prosjektet.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Dette frigir seat-billing for denne brukeren. Alt bruker-data (kommentarer,
            kandidater, opplastinger) <strong>beholdes</strong>. Du kan aktivere
            brukeren igjen senere fra "Fjernede"-fanen — da starter billing for
            denne seaten igjen.
          </Alert>
          <TextField fullWidth size="small" label="Årsak (valgfritt)"
                     value={removeReason}
                     onChange={(e) => setRemoveReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)}>Avbryt</Button>
          <Button color="error" variant="contained" startIcon={<Delete />}
                  disabled={busy === confirmRemove?.userId}
                  onClick={() => void handleDeactivate()}>
            Fjern medlem
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent-slett notice */}
      <Dialog open={permanentNotice} onClose={() => setPermanentNotice(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Permanent sletting</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Permanent sletting av bruker og all data de har laget er ikke
            aktivert ennå. Det krever ekstra forarbeid pr. tabell (kommentarer,
            casting-data, opplastinger osv.) før vi kan tilby det trygt.
          </Alert>
          <Typography variant="body2">
            Frem til da kan du fjerne brukeren (soft-delete) — det frigir seat
            og skjuler dem fra listene, men beholder data slik at du kan
            gjenopprette senere.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermanentNotice(false)}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function MemberRow({ member, actions, busy }: {
  member: ProjectMember; actions: React.ReactNode; busy: boolean;
}) {
  return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5,
                opacity: member.isActive ? 1 : 0.75 }}>
      <Avatar src={member.profileImageUrl ?? undefined} sx={{ width: 48, height: 48 }}>
        {member.displayName?.[0] ?? <Person />}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
          {member.displayName ?? member.email ?? '(uten navn)'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {member.role ?? 'Uten rolle'}
          {member.email && ` · ${member.email}`}
        </Typography>
        {!member.isActive && member.deactivatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Fjernet {new Date(member.deactivatedAt).toLocaleDateString('nb-NO')}
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
      </Box>
      <Box sx={{ pt: 0.5 }}>
        {busy ? <CircularProgress size={20} /> : actions}
      </Box>
    </Box>
  );
}

export default ProjectMembersDialog;
