/**
 * ProjectMeetingsPanel — The Role Room prosjektrom-møtenotater (porter
 * ws-meetings-designet): tittel, dato, deltakere, agenda (nummerert) og
 * handlingspunkter (med eier + avhuking). Liste + enkel editor. Egen
 * Role Room-feature, prosjekt-scoped.
 *
 * Backend: /api/role-room/projects/:projectId/meetings (mig 288).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, IconButton, TextField, CircularProgress, Tooltip } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EventNoteIcon from '@mui/icons-material/EventNote';
import roleRoomAgentService, {
  type RoleRoomProjectMeeting, type RoleRoomMeetingInput, type RoleRoomMeetingActionItem,
} from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface ProjectMeetingsPanelProps { projectId: string; readOnly?: boolean }

function initials(n: string): string {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '—';
  return ((p[0][0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}
// "tekst @eier" → {text, owner}
function parseActionLine(line: string): RoleRoomMeetingActionItem | null {
  const t = line.trim();
  if (!t) return null;
  const m = /^(.*?)\s*@(.+)$/.exec(t);
  return m ? { text: m[1].trim(), owner: m[2].trim(), done: false } : { text: t, owner: null, done: false };
}

export default function ProjectMeetingsPanel({ projectId, readOnly }: ProjectMeetingsPanelProps): React.ReactElement {
  const [meetings, setMeetings] = React.useState<RoleRoomProjectMeeting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<string | 'new' | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ title: '', meetingDate: '', participants: '', agenda: '', actions: '' });

  const load = React.useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    void roleRoomAgentService.listProjectMeetings(projectId).then(setMeetings).finally(() => setLoading(false));
  }, [projectId]);
  React.useEffect(() => { load(); }, [load]);

  const openNew = (): void => {
    setForm({ title: '', meetingDate: '', participants: '', agenda: '', actions: '' });
    setEditing('new');
  };
  const openEdit = (m: RoleRoomProjectMeeting): void => {
    setForm({
      title: m.title, meetingDate: m.meeting_date ?? '',
      participants: m.participants.join(', '),
      agenda: m.agenda.join('\n'),
      actions: m.action_items.map((a) => (a.owner ? `${a.text} @${a.owner}` : a.text)).join('\n'),
    });
    setEditing(m.id);
  };

  const buildInput = (): RoleRoomMeetingInput => ({
    title: form.title.trim() || 'Møte',
    meetingDate: /^\d{4}-\d{2}-\d{2}$/.test(form.meetingDate) ? form.meetingDate : null,
    participants: form.participants.split(',').map((s) => s.trim()).filter(Boolean),
    agenda: form.agenda.split('\n').map((s) => s.trim()).filter(Boolean),
    actionItems: form.actions.split('\n').map(parseActionLine).filter((x): x is RoleRoomMeetingActionItem => Boolean(x)),
  });

  const save = async (): Promise<void> => {
    setSaving(true);
    const input = buildInput();
    const res = editing === 'new'
      ? await roleRoomAgentService.createProjectMeeting(projectId, input)
      : editing ? await roleRoomAgentService.updateProjectMeeting(editing, input) : null;
    setSaving(false);
    if (res) { setEditing(null); load(); }
  };

  const toggleAction = async (m: RoleRoomProjectMeeting, idx: number): Promise<void> => {
    const actionItems = m.action_items.map((a, i) => i === idx ? { ...a, done: !a.done } : a);
    const updated = await roleRoomAgentService.updateProjectMeeting(m.id, {
      title: m.title, meetingDate: m.meeting_date, participants: m.participants, agenda: m.agenda, actionItems,
    });
    if (updated) setMeetings((prev) => prev.map((x) => x.id === m.id ? updated : x));
  };

  const remove = async (id: string): Promise<void> => {
    if (!window.confirm('Slette dette møtenotatet?')) return;
    if (await roleRoomAgentService.deleteProjectMeeting(id)) setMeetings((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EventNoteIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: INK }}>Møter</Typography>
        </Stack>
        {!readOnly && editing === null ? (
          <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={openNew}
            sx={{ textTransform: 'none', fontWeight: 700, color: ACCENT }}>Nytt møte</Button>
        ) : null}
      </Stack>

      {/* Editor */}
      {editing !== null ? (
        <Box sx={{ p: 1.6, mb: 1.4, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(167,139,250,0.28)' }}>
          <Stack spacing={1.2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
              <TextField size="small" label="Tittel" fullWidth value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                sx={fieldSx} />
              <TextField size="small" label="Dato" type="date" InputLabelProps={{ shrink: true }} value={form.meetingDate}
                onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} sx={{ ...fieldSx, minWidth: 160 }} />
            </Stack>
            <TextField size="small" label="Deltakere (kommaseparert)" fullWidth value={form.participants}
              onChange={(e) => setForm({ ...form, participants: e.target.value })} sx={fieldSx} />
            <TextField size="small" label="Agenda (én per linje)" fullWidth multiline minRows={2} value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })} sx={fieldSx} />
            <TextField size="small" label="Handlingspunkter (én per linje — «tekst @eier»)" fullWidth multiline minRows={2} value={form.actions}
              onChange={(e) => setForm({ ...form, actions: e.target.value })} sx={fieldSx} />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" onClick={() => setEditing(null)} disabled={saving} sx={{ textTransform: 'none', color: MUTED }}>Avbryt</Button>
              <Button size="small" variant="contained" disableElevation onClick={() => void save()} disabled={saving}
                startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
                sx={{ textTransform: 'none', fontWeight: 700, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
                Lagre
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
      ) : meetings.length === 0 && editing === null ? (
        <Typography sx={{ fontSize: 12.5, color: MUTED, py: 1 }}>Ingen møtenotater ennå.</Typography>
      ) : (
        <Stack spacing={1.2}>
          {meetings.map((m) => (
            <Box key={m.id} sx={{
              borderRadius: 3, p: { xs: 1.8, md: 2.2 }, overflow: 'hidden',
              border: '1px solid rgba(167,139,250,0.2)',
              background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
            }}>
              {/* Header */}
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.4 }}>
                <Box>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.3, mb: 0.6, borderRadius: 999, background: GRAD }}>
                    <GroupsIcon sx={{ fontSize: 13, color: '#fff' }} />
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.1em' }}>MØTE</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: INK, lineHeight: 1.15 }}>{m.title}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: MUTED }}>{fmtDate(m.meeting_date)}</Typography>
                </Box>
                {!readOnly ? (
                  <Stack direction="row" spacing={0.2}>
                    <Tooltip title="Rediger"><IconButton size="small" onClick={() => openEdit(m)} sx={{ color: 'rgba(226,232,240,0.55)' }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                    <Tooltip title="Slett"><IconButton size="small" onClick={() => void remove(m.id)} sx={{ color: 'rgba(248,113,113,0.7)' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                  </Stack>
                ) : null}
              </Stack>

              {/* Deltakere */}
              {m.participants.length > 0 ? (
                <Box sx={{ mb: 1.4 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.6 }}>Deltakere</Typography>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                    {m.participants.map((p, i) => (
                      <Stack key={i} direction="row" alignItems="center" spacing={0.6} sx={{ px: 0.8, py: 0.4, borderRadius: 999, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)' }}>
                        <Box sx={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, color: '#fff', fontSize: 9, fontWeight: 800 }}>{initials(p)}</Box>
                        <Typography sx={{ fontSize: 12, color: INK }}>{p}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {/* Agenda */}
              {m.agenda.length > 0 ? (
                <Box sx={{ mb: 1.4 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.6 }}>Agenda</Typography>
                  <Stack spacing={0.5}>
                    {m.agenda.map((a, i) => (
                      <Stack key={i} direction="row" alignItems="flex-start" spacing={1}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: 'rgba(168,85,247,0.2)', color: '#e9d5ff', fontSize: 10, fontWeight: 800 }}>{i + 1}</Box>
                        <Typography sx={{ fontSize: 13, color: 'rgba(226,232,240,0.88)', lineHeight: 1.4 }}>{a}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {/* Handlingspunkter */}
              {m.action_items.length > 0 ? (
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.6 }}>Handlingspunkter</Typography>
                  <Stack spacing={0.5}>
                    {m.action_items.map((a, i) => (
                      <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ p: 0.8, borderRadius: 1.6, bgcolor: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.1)' }}>
                        <IconButton size="small" onClick={() => !readOnly && void toggleAction(m, i)} disabled={readOnly} sx={{ p: 0.2, color: a.done ? '#34d399' : 'rgba(226,232,240,0.4)' }}>
                          {a.done ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                        <Typography sx={{ fontSize: 13, flex: 1, color: a.done ? MUTED : INK, textDecoration: a.done ? 'line-through' : 'none' }}>{a.text}</Typography>
                        {a.owner ? <Typography sx={{ fontSize: 11.5, color: ACCENT, fontWeight: 600 }}>{a.owner}</Typography> : null}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': { color: '#f5f3ff', fontSize: 13, '& fieldset': { borderColor: 'rgba(167,139,250,0.3)' } },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.6)', fontSize: 13 },
} as const;
