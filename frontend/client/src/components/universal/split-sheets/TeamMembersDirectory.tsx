// @ts-nocheck
/**
 * TeamMembersDirectory — Slice 9X.70
 *
 * Persistent team-direktorat. Hver person:
 *   - profilbilde (URL eller initialer)
 *   - navn, e-post, telefon
 *   - default-rolle (fra ROLE_CATALOG)
 *   - kommentar / notat
 *
 * Persistence: localStorage. Backend-sync er en TODO.
 * Komponenten kan brukes som standalone-direktorat og som picker
 * (modus="picker") inne i SplitSheetRoleWizard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { teamDirectoryEvents } from '@/utils/creatorhub-events';
import {
  Box,
  Stack,
  Typography,
  Card,
  Avatar,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  InputAdornment,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  Group as GroupIcon,
} from '@mui/icons-material';

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  defaultRoleId?: string;
  notes?: string;
  createdAt: string;
}

// Holdes konsistent med ROLE_CATALOG_* i SplitSheetRoleWizard
const ROLE_OPTIONS_VISUAL = [
  { id: 'photo', label: 'Foto (kamera)' },
  { id: 'photo-edit', label: 'Foto + redigering' },
  { id: 'video', label: 'Video (kamera)' },
  { id: 'video-edit', label: 'Video + redigering' },
  { id: 'edit-only', label: 'Bare redigering' },
  { id: 'second-shooter', label: 'Second shooter' },
  { id: 'assistant', label: 'Assistent' },
  { id: 'logistics', label: 'Logistikk / koordinering' },
];

const ROLE_OPTIONS_MUSIC = [
  { id: 'producer', label: 'Produsent' },
  { id: 'songwriter', label: 'Låtskriver' },
  { id: 'beatmaker', label: 'Beatmaker' },
  { id: 'vocalist', label: 'Vokalist' },
  { id: 'mix-engineer', label: 'Mix-engineer' },
  { id: 'master-engineer', label: 'Master-engineer' },
  { id: 'session-musician', label: 'Session-musiker' },
  { id: 'feature-artist', label: 'Feature-artist' },
];

const roleOptionsFor = (profession?: string) =>
  profession === 'music_producer' ? ROLE_OPTIONS_MUSIC : ROLE_OPTIONS_VISUAL;

// Bakoverkompatibel default (begge listene slått sammen)
const ROLE_OPTIONS = [...ROLE_OPTIONS_VISUAL, ...ROLE_OPTIONS_MUSIC];

const STORAGE_KEY = 'team-members-directory';

export function loadTeamMembers(): TeamMember[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTeamMembers(members: TeamMember[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch {}
}

interface Props {
  /** "directory" = full visning. "picker" = velger som calls onPick med valgte */
  mode?: 'directory' | 'picker';
  onPick?: (picked: TeamMember[]) => void;
  initialPickedIds?: string[];
  profession?: string;
}

const TeamMembersDirectory: React.FC<Props> = ({ mode = 'directory', onPick, initialPickedIds = [], profession }) => {
  const roleOptions = roleOptionsFor(profession);
  const [members, setMembers] = useState<TeamMember[]>(() => loadTeamMembers());
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set(initialPickedIds));

  useEffect(() => { saveTeamMembers(members); }, [members]);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q),
    );
  }, [members, search]);

  const upsertMember = (m: TeamMember) => {
    setMembers((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx >= 0) {
        teamDirectoryEvents.memberEdited(m.id);
        const copy = [...prev];
        copy[idx] = m;
        return copy;
      }
      teamDirectoryEvents.memberAdded(!!m.defaultRoleId, !!m.email, !!m.phone);
      return [m, ...prev];
    });
  };

  const removeMember = (id: string) => {
    teamDirectoryEvents.memberRemoved(id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setPickedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const togglePick = (id: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmPick = () => {
    if (!onPick) return;
    teamDirectoryEvents.pickerUsed(pickedIds.size);
    onPick(members.filter((m) => pickedIds.has(m.id)));
  };

  const isPicker = mode === 'picker';

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5} flexWrap="wrap">
        {!isPicker && (
          <Box>
            <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>
              Team-direktorat
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: '#fff5e8' }}>
              Hvem jobber du med
            </Typography>
          </Box>
        )}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk navn, e-post, tlf…"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(246,242,234,0.5)', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 240,
              '& .MuiOutlinedInput-root': {
                color: '#fff5e8',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
                '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
              },
            }}
          />
          <Button
            startIcon={<PersonAddIcon />}
            onClick={() => setAdding(true)}
            sx={{
              borderRadius: '999px',
              px: 2,
              py: 0.9,
              bgcolor: '#ffba6c',
              color: '#150d05',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: '#ffc788' },
            }}
          >
            Legg til
          </Button>
        </Stack>
      </Stack>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card sx={{
          p: 5,
          textAlign: 'center',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,186,108,0.32)',
          borderRadius: 3,
          boxShadow: 'none',
          color: 'rgba(246,242,234,0.72)',
        }}>
          <GroupIcon sx={{ fontSize: 48, color: 'rgba(255,186,108,0.4)', mb: 1 }} />
          <Typography variant="body1">{search ? 'Ingen treff' : 'Ingen team-medlemmer ennå'}</Typography>
          <Typography variant="caption">
            {search ? 'Prøv et annet søk' : 'Legg til personene du jobber sammen med'}
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
          {filtered.map((m) => {
            const role = ROLE_OPTIONS.find((r) => r.id === m.defaultRoleId);
            const isPicked = pickedIds.has(m.id);
            return (
              <Card
                key={m.id}
                onClick={isPicker ? () => togglePick(m.id) : undefined}
                sx={{
                  p: 2,
                  cursor: isPicker ? 'pointer' : 'default',
                  bgcolor: isPicked ? 'rgba(255,186,108,0.10)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isPicked ? '#ffba6c' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 2,
                  boxShadow: 'none',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(255,186,108,0.4)', transform: isPicker ? 'translateY(-2px)' : 'none' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  {isPicker && (
                    <Checkbox
                      checked={isPicked}
                      sx={{
                        p: 0.5,
                        color: 'rgba(246,242,234,0.5)',
                        '&.Mui-checked': { color: '#ffba6c' },
                      }}
                    />
                  )}
                  <Avatar
                    src={m.avatarUrl}
                    sx={{
                      width: 52,
                      height: 52,
                      bgcolor: alpha('#ffba6c', 0.18),
                      color: '#ffba6c',
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#fff5e8' }} noWrap>
                        {m.name}
                      </Typography>
                      {!isPicker && (
                        <Stack direction="row" spacing={0.25}>
                          <IconButton
                            size="small"
                            onClick={() => setEditing(m)}
                            sx={{ color: 'rgba(246,242,234,0.5)', '&:hover': { color: '#ffba6c' } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => removeMember(m.id)}
                            sx={{ color: 'rgba(246,242,234,0.5)', '&:hover': { color: '#f44336' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Stack>
                    {role && (
                      <Chip
                        label={role.label}
                        size="small"
                        sx={{
                          mt: 0.5,
                          height: 20,
                          fontSize: '0.66rem',
                          bgcolor: 'rgba(255,186,108,0.18)',
                          color: '#ffba6c',
                          fontWeight: 600,
                        }}
                      />
                    )}
                    <Stack spacing={0.25} sx={{ mt: 1 }}>
                      {m.email && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <EmailIcon sx={{ fontSize: 13, color: 'rgba(246,242,234,0.5)' }} />
                          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }} noWrap>
                            {m.email}
                          </Typography>
                        </Stack>
                      )}
                      {m.phone && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <PhoneIcon sx={{ fontSize: 13, color: 'rgba(246,242,234,0.5)' }} />
                          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }} noWrap>
                            {m.phone}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                    {m.notes && (
                      <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)', display: 'block', mt: 0.5, fontStyle: 'italic' }} noWrap>
                        {m.notes}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Picker bekreft-knapp */}
      {isPicker && (
        <Stack direction="row" justifyContent="flex-end" sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'rgba(246,242,234,0.72)', alignSelf: 'center', mr: 2 }}>
            {pickedIds.size} valgt
          </Typography>
          <Button
            variant="contained"
            disabled={pickedIds.size === 0}
            onClick={confirmPick}
            sx={{
              borderRadius: '999px',
              px: 3,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: '#ffba6c',
              color: '#150d05',
              '&:hover': { bgcolor: '#ffc788' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,186,108,0.3)', color: 'rgba(21,13,5,0.5)' },
            }}
          >
            Legg til {pickedIds.size > 0 ? `(${pickedIds.size})` : ''} i splitt
          </Button>
        </Stack>
      )}

      {/* Add/Edit dialog */}
      <MemberFormDialog
        open={adding || editing !== null}
        member={editing}
        roleOptions={roleOptions}
        onClose={() => { setAdding(false); setEditing(null); }}
        onSave={(m) => {
          upsertMember(m);
          setAdding(false);
          setEditing(null);
        }}
      />
    </Stack>
  );
};

// ─── Add/Edit dialog ───────────────────────────────────────────────
const MemberFormDialog: React.FC<{
  open: boolean;
  member: TeamMember | null;
  roleOptions: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSave: (m: TeamMember) => void;
}> = ({ open, member, roleOptions, onClose, onSave }) => {
  const defaultRoleId = roleOptions[0]?.id || 'photo';
  const [form, setForm] = useState<TeamMember>(() => member || {
    id: `tm-${Date.now()}`,
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',
    defaultRoleId,
    notes: '',
    createdAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (open) {
      setForm(member || {
        id: `tm-${Date.now()}`,
        name: '',
        email: '',
        phone: '',
        avatarUrl: '',
        defaultRoleId,
        notes: '',
        createdAt: new Date().toISOString(),
      });
    }
  }, [open, member]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          background: 'radial-gradient(circle at top, rgba(255,186,108,0.10) 0%, rgba(15,10,7,0.98) 40%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(255,186,108,0.18)',
          '& .MuiInputLabel-root': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#ffba6c' },
          '& .MuiOutlinedInput-root': {
            color: '#fff5e8',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
            '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
          },
          '& .MuiSelect-icon': { color: 'rgba(246,242,234,0.72)' },
        },
      }}
    >
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgba(255,186,108,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {member ? 'Rediger team-medlem' : 'Nytt team-medlem'}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(246,242,234,0.72)' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={form.avatarUrl}
              sx={{ width: 64, height: 64, bgcolor: alpha('#ffba6c', 0.18), color: '#ffba6c', fontWeight: 700, fontSize: 22 }}
            >
              {form.name.charAt(0).toUpperCase() || '?'}
            </Avatar>
            <TextField
              fullWidth
              label="Bilde-URL (valgfri)"
              size="small"
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              placeholder="https://…"
            />
          </Stack>
          <TextField
            label="Navn"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="E-post"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Telefon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              fullWidth
            />
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Default rolle</InputLabel>
            <Select
              label="Default rolle"
              value={form.defaultRoleId || ''}
              onChange={(e) => setForm({ ...form, defaultRoleId: e.target.value as string })}
            >
              {roleOptions.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Notater (valgfri)"
            multiline
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth
            placeholder="F.eks. spesialitet, preferanse, kontakt-tider…"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button onClick={onClose} sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          disabled={!form.name.trim()}
          onClick={() => onSave(form)}
          sx={{
            borderRadius: '999px',
            px: 3,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#ffba6c',
            color: '#150d05',
            '&:hover': { bgcolor: '#ffc788' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,186,108,0.3)', color: 'rgba(21,13,5,0.5)' },
          }}
        >
          Lagre
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamMembersDirectory;
