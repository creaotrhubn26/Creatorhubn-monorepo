// @ts-nocheck
/**
 * TeamInvitePanel — Slice 9X.56
 *
 * Vises i tester-dashboardet KUN hvis innlogget bruker er team-master.
 * Lar masteren invitere opptil (maxTeamSize - 1) team-medlemmer som
 * alle får felles program_ends_at og samme grantedPlan/grantedFeatures.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Chip,
  Box,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Tooltip,
  MenuItem,
} from '@mui/material';
import {
  Groups as TeamIcon,
  PersonAdd as InviteIcon,
  Delete as DeleteIcon,
  CheckCircle as AcceptedIcon,
  HourglassEmpty as PendingIcon,
  Cancel as ExpiredIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/utils/ga4-client-tracking';

interface Member {
  id: string;
  email: string;
  name: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invitedAt: string;
  acceptedAt: string | null;
  programEndsAt: string | null;
  profession: string | null;
}

// Profesjoner et team-medlem kan ha (matcher backend ALLOWED_MEMBER_PROFESSIONS).
const MEMBER_PROFESSIONS: { value: string; label: string; emoji: string }[] = [
  { value: 'photographer', label: 'Fotograf', emoji: '📷' },
  { value: 'videographer', label: 'Videograf', emoji: '🎬' },
  { value: 'music_producer', label: 'Musikkprodusent', emoji: '🎧' },
  { value: 'vendor', label: 'Leverandør', emoji: '🛠️' },
];
const professionLabel = (p: string | null): string => {
  if (!p) return '';
  const m = MEMBER_PROFESSIONS.find((x) => x.value === p);
  return m ? `${m.emoji} ${m.label}` : p;
};

interface TeamData {
  isMaster: boolean;
  masterId: string;
  maxTeamSize: number;
  slotsRemaining: number;
  sharedProgramEndsAt: string;
  members: Member[];
}

const TeamInvitePanel: React.FC = () => {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = async () => {
    try {
      const r: any = await apiRequest('/api/prototype-tester-invites/me/team');
      setData(r);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading || !data?.isMaster) return null;

  const handleRevoke = async (memberId: string, email: string) => {
    if (!window.confirm(`Trekke tilbake invitasjon til ${email}? Dette går kun for invitasjoner som ikke er signert.`)) return;
    try {
      await apiRequest(`/api/prototype-tester-invites/me/team/${memberId}`, { method: 'DELETE' });
      trackEvent('prototype_tester_team_invite_revoked', { member_id: memberId });
      await load();
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke trekke tilbake');
    }
  };

  return (
    <>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TeamIcon color="primary" />
              <Typography variant="h6">Ditt tester-team</Typography>
              <Chip size="small" label="Team-master" color="primary" variant="outlined" />
            </Stack>
            <Button
              variant="contained"
              size="small"
              startIcon={<InviteIcon />}
              onClick={() => setInviteOpen(true)}
              disabled={data.slotsRemaining === 0}
            >
              Inviter medlem
            </Button>
          </Stack>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={`${data.members.length + 1} / ${data.maxTeamSize} plasser brukt`}
              color={data.slotsRemaining === 0 ? 'warning' : 'default'}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Programmet slutter ${new Date(data.sharedProgramEndsAt).toLocaleDateString('nb-NO')}`}
            />
          </Box>

          {data.slotsRemaining === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Teamet er fullt. For å invitere flere må du fjerne en ventende invitasjon eller kontakte CreatorHub.
            </Alert>
          )}

          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Hvert medlem signerer egen NDA personlig — du representerer teamet, men kan ikke signere for dem.
          </Typography>

          <List dense disablePadding>
            <ListItem sx={{ py: 0.5 }}>
              <Chip size="small" icon={<AcceptedIcon fontSize="small" />} label="Deg" color="success" sx={{ mr: 1 }} />
              <ListItemText primary="(Team-master)" />
            </ListItem>
            {data.members.length === 0 ? (
              <ListItem sx={{ py: 1 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary">
                      Ingen invitert ennå. Klikk «Inviter medlem» for å komme i gang.
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              data.members.map((m) => {
                const statusChip =
                  m.status === 'accepted'
                    ? <Chip size="small" icon={<AcceptedIcon fontSize="small" />} label="Signert" color="success" />
                    : m.status === 'pending'
                      ? <Chip size="small" icon={<PendingIcon fontSize="small" />} label="Venter på signering" />
                      : <Chip size="small" icon={<ExpiredIcon fontSize="small" />} label={m.status === 'expired' ? 'Utløpt' : 'Trukket'} color="error" />;
                return (
                  <ListItem
                    key={m.id}
                    sx={{ py: 0.5 }}
                    secondaryAction={
                      m.status === 'pending' && (
                        <Tooltip title="Trekk tilbake invitasjon">
                          <IconButton size="small" onClick={() => handleRevoke(m.id, m.email)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    {statusChip}
                    <ListItemText
                      sx={{ ml: 1 }}
                      primary={
                        <Typography variant="body2" component="span">
                          <b>{m.name}</b> · {m.email}
                          {m.profession && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={professionLabel(m.profession)}
                              sx={{ ml: 1, height: 20 }}
                            />
                          )}
                        </Typography>
                      }
                      secondary={
                        m.acceptedAt
                          ? `Signert ${new Date(m.acceptedAt).toLocaleDateString('nb-NO')}`
                          : `Invitert ${new Date(m.invitedAt).toLocaleDateString('nb-NO')}`
                      }
                    />
                  </ListItem>
                );
              })
            )}
          </List>
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); load(); }}
        slotsRemaining={data.slotsRemaining}
        sharedEndsAt={data.sharedProgramEndsAt}
      />
    </>
  );
};

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
  slotsRemaining: number;
  sharedEndsAt: string;
}

const InviteMemberDialog: React.FC<InviteDialogProps> = ({ open, onClose, onInvited, slotsRemaining, sharedEndsAt }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('photographer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setEmail(''); setName(''); setProfession('photographer'); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!email.trim() || !name.trim()) { setError('Navn og e-post er påkrevd'); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest('/api/prototype-tester-invites/me/team/invite', {
        method: 'POST',
        body: { email: email.trim(), name: name.trim(), profession },
      });
      trackEvent('prototype_tester_team_invite_sent', {});
      reset();
      onInvited();
    } catch (e: any) {
      setError(e?.message || 'Invitering feilet');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Inviter team-medlem</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            Medlemmet får en e-post med NDA-lenke. Når de signerer blir de aktive testere
            sammen med deg — programmet slutter felles {new Date(sharedEndsAt).toLocaleDateString('nb-NO')}.
          </Typography>
          <TextField label="Navn" value={name} onChange={(e) => setName(e.target.value)} fullWidth required size="small" />
          <TextField label="E-post" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required size="small" />
          <TextField
            select
            label="Profesjon"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            fullWidth
            size="small"
            helperText="Bestemmer hvilket dashboard medlemmet får (f.eks. videograf får videograf-verktøy)."
          >
            {MEMBER_PROFESSIONS.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.emoji} {p.label}</MenuItem>
            ))}
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="caption" color="text.secondary">
            Plasser igjen: {slotsRemaining}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={busy || !email.trim() || !name.trim() || slotsRemaining === 0}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {busy ? 'Sender…' : 'Send invitasjon'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamInvitePanel;
