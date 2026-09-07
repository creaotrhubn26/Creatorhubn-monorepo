/**
 * HrTab — «HR»-flaten i AdminWorkspace.
 *
 * EmptyState-TODO-en ba om et datamodell-valg («team_members + comp +
 * leave — eller integrer med ekstern HR-løsning»). Valget er tatt i
 * migrasjon 0350: en minimal egen modell, med valgfri kobling mot en
 * ekte brukerkonto, slik at frilansere uten konto også kan stå i teamet.
 * Ekstern HR-integrasjon er dyrere enn problemet på nåværende størrelse.
 *
 * Flaten dekker det et lite team faktisk trenger: hvem er med, i hvilken
 * rolle og engasjementsform, til hvilken sats — og hvem er borte når.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import {
  workspaceCollabApi,
  WORKSPACE_ABSENCE_LABELS,
  WORKSPACE_ENGAGEMENT_LABELS,
  WORKSPACE_MEMBER_STATUS_LABELS,
  type WorkspaceAbsenceType,
  type WorkspaceEngagementType,
  type WorkspaceMemberStatus,
  type WorkspaceProductScope,
  type WorkspaceTeamMember,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import { PanelEmpty, PanelError, PanelLoading, SectionHeading, formatDate } from './panelKit';

const STATUS_COLOR: Record<WorkspaceMemberStatus, string> = {
  active: '#22c55e',
  onboarding: '#22d3ee',
  paused: '#fbbf24',
  ended: 'rgba(241, 245, 249, 0.5)',
};

function todayKey(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date());
}

/** Er medlemmet borte akkurat nå? Det er den ene tilstanden som endrer planlegging. */
function currentAbsence(member: WorkspaceTeamMember) {
  const today = todayKey();
  return member.absences.find((a) => a.startDate <= today && a.endDate >= today) ?? null;
}

interface MemberDraft {
  fullName: string;
  email: string;
  roleTitle: string;
  engagementType: WorkspaceEngagementType;
  status: WorkspaceMemberStatus;
  startedOn: string;
  hourlyRate: string;
  notes: string;
}

const EMPTY_DRAFT: MemberDraft = {
  fullName: '',
  email: '',
  roleTitle: '',
  engagementType: 'freelancer',
  status: 'active',
  startedOn: '',
  hourlyRate: '',
  notes: '',
};

export function HrTab({ product }: { product: WorkspaceProductScope }) {
  const [members, setMembers] = useState<WorkspaceTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MemberDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const [absenceFor, setAbsenceFor] = useState<WorkspaceTeamMember | null>(null);
  const [absenceType, setAbsenceType] = useState<WorkspaceAbsenceType>('vacation');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await workspaceCollabApi.team(product));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste teamet');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((m: WorkspaceTeamMember) => {
    setEditingId(m.id);
    setDraft({
      fullName: m.fullName,
      email: m.email ?? '',
      roleTitle: m.roleTitle ?? '',
      engagementType: m.engagementType,
      status: m.status,
      startedOn: m.startedOn ? m.startedOn.slice(0, 10) : '',
      hourlyRate: m.hourlyRate === null ? '' : String(m.hourlyRate),
      notes: m.notes ?? '',
    });
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft.fullName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        fullName: draft.fullName.trim(),
        email: draft.email.trim() || null,
        roleTitle: draft.roleTitle.trim() || null,
        engagementType: draft.engagementType,
        status: draft.status,
        startedOn: draft.startedOn || null,
        hourlyRate: draft.hourlyRate.trim() ? Number(draft.hourlyRate) : null,
        notes: draft.notes.trim() || null,
      };
      if (editingId) await workspaceCollabApi.updateMember(editingId, payload);
      else await workspaceCollabApi.createMember(payload);
      setEditorOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre medlemmet');
    } finally {
      setSaving(false);
    }
  }, [draft, editingId, load]);

  const handleDelete = useCallback(async (m: WorkspaceTeamMember) => {
    if (!window.confirm(`Fjerne ${m.fullName} fra teamet?`)) return;
    try {
      await workspaceCollabApi.deleteMember(m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke fjerne medlemmet');
    }
  }, []);

  const handleAddAbsence = useCallback(async () => {
    if (!absenceFor || !absenceStart || !absenceEnd) return;
    try {
      await workspaceCollabApi.addAbsence(absenceFor.id, {
        absenceType,
        startDate: absenceStart,
        endDate: absenceEnd,
      });
      setAbsenceFor(null);
      setAbsenceStart('');
      setAbsenceEnd('');
      await load();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke registrere fraværet');
    }
  }, [absenceFor, absenceType, absenceStart, absenceEnd, load]);

  const activeCount = useMemo(() => members.filter((m) => m.status === 'active').length, [members]);
  const awayNow = useMemo(() => members.filter((m) => currentAbsence(m) !== null), [members]);

  if (loading) return <PanelLoading />;

  return (
    <Stack spacing={2}>
      {error ? <PanelError message={error} onClose={() => setError(null)} /> : null}

      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
        <Chip
          label={`${activeCount} aktive`}
          size="small"
          sx={{ height: 22, fontSize: '0.72rem', bgcolor: 'rgba(34,197,94,0.16)', color: '#86efac' }}
        />
        {awayNow.length > 0 ? (
          <Chip
            icon={<BeachAccessOutlinedIcon sx={{ fontSize: 14 }} />}
            label={`${awayNow.length} borte nå`}
            size="small"
            sx={{ height: 22, fontSize: '0.72rem', bgcolor: 'rgba(251,191,36,0.16)', color: '#fcd34d' }}
          />
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={openCreate}
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          Nytt medlem
        </Button>
      </Stack>

      {members.length === 0 ? (
        <PanelEmpty
          icon={<PersonOutlineOutlinedIcon />}
          title="Ingen i teamet ennå"
          description="Legg inn ansatte, frilansere og rådgivere med rolle, engasjementsform og sats. Fravær registreres per person, så du ser hvem som er tilgjengelig når du planlegger."
          action={
            <Button size="small" startIcon={<AddIcon />} onClick={openCreate} variant="contained" sx={{ textTransform: 'none' }}>
              Legg til første
            </Button>
          }
        />
      ) : (
        <Stack spacing={1}>
          {members.map((m) => {
            const away = currentAbsence(m);
            return (
              <Box
                key={m.id}
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: BRAND.panelBg,
                  border: `1px solid ${BRAND.border}`,
                  borderLeft: `3px solid ${STATUS_COLOR[m.status]}`,
                  '&:hover': { borderColor: BRAND.borderHover },
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                      <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
                        {m.fullName}
                      </Typography>
                      <Chip
                        label={WORKSPACE_MEMBER_STATUS_LABELS[m.status]}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.64rem',
                          bgcolor: `${STATUS_COLOR[m.status]}22`,
                          color: STATUS_COLOR[m.status],
                        }}
                      />
                      <Chip
                        label={WORKSPACE_ENGAGEMENT_LABELS[m.engagementType]}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.64rem',
                          bgcolor: 'rgba(167,139,250,0.14)',
                          color: '#ddd6fe',
                        }}
                      />
                      {away ? (
                        <Chip
                          icon={<BeachAccessOutlinedIcon sx={{ fontSize: 12 }} />}
                          label={`${WORKSPACE_ABSENCE_LABELS[away.absenceType]} til ${formatDate(away.endDate)}`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.64rem',
                            bgcolor: 'rgba(251,191,36,0.16)',
                            color: '#fcd34d',
                          }}
                        />
                      ) : null}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {m.roleTitle ? (
                        <Typography sx={{ color: BRAND.textMuted, fontSize: '0.8rem' }}>
                          {m.roleTitle}
                        </Typography>
                      ) : null}
                      {m.email ? (
                        <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>{m.email}</Typography>
                      ) : null}
                      {m.hourlyRate !== null ? (
                        <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
                          {m.hourlyRate} {m.currency}/t
                        </Typography>
                      ) : null}
                      {m.startedOn ? (
                        <Typography sx={{ color: BRAND.textDim, fontSize: '0.76rem' }}>
                          Fra {formatDate(m.startedOn)}
                        </Typography>
                      ) : null}
                    </Stack>

                    {m.notes ? (
                      <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem', mt: 0.75 }}>
                        {m.notes}
                      </Typography>
                    ) : null}
                  </Box>

                  <Stack direction="row" spacing={0.25}>
                    <Tooltip title="Registrer fravær">
                      <IconButton
                        size="small"
                        onClick={() => setAbsenceFor(m)}
                        sx={{ color: BRAND.textDim }}
                      >
                        <BeachAccessOutlinedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Rediger">
                      <IconButton size="small" onClick={() => openEdit(m)} sx={{ color: BRAND.textDim }}>
                        <EditOutlinedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Fjern">
                      <IconButton
                        size="small"
                        onClick={() => void handleDelete(m)}
                        sx={{ color: BRAND.textDim, '&:hover': { color: '#fca5a5' } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                {m.absences.length > 0 ? (
                  <Box sx={{ mt: 1.25, pt: 1, borderTop: `1px solid ${BRAND.border}` }}>
                    <SectionHeading label="Fravær" count={m.absences.length} />
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {m.absences.slice(0, 6).map((a) => (
                        <Chip
                          key={a.id}
                          label={`${WORKSPACE_ABSENCE_LABELS[a.absenceType]}: ${formatDate(a.startDate)} – ${formatDate(a.endDate)}`}
                          size="small"
                          onDelete={async () => {
                            try {
                              await workspaceCollabApi.deleteAbsence(a.id);
                              await load();
                            } catch (err) {
                              setError((err as Error).message || 'Kunne ikke slette fraværet');
                            }
                          }}
                          sx={{
                            height: 20,
                            fontSize: '0.68rem',
                            bgcolor: 'rgba(241,245,249,0.06)',
                            color: BRAND.textMuted,
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Medlem-editor */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { bgcolor: '#150a29', backgroundImage: 'none' } } }}
      >
        <DialogTitle sx={{ color: BRAND.text }}>
          {editingId ? 'Rediger medlem' : 'Nytt team-medlem'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              size="small"
              label="Navn"
              required
              value={draft.fullName}
              onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                label="E-post"
                fullWidth
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
              <TextField
                size="small"
                label="Rolle"
                fullWidth
                value={draft.roleTitle}
                onChange={(e) => setDraft((d) => ({ ...d, roleTitle: e.target.value }))}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                size="small"
                label="Engasjement"
                fullWidth
                value={draft.engagementType}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, engagementType: e.target.value as WorkspaceEngagementType }))
                }
              >
                {(Object.keys(WORKSPACE_ENGAGEMENT_LABELS) as WorkspaceEngagementType[]).map((k) => (
                  <MenuItem key={k} value={k}>
                    {WORKSPACE_ENGAGEMENT_LABELS[k]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Status"
                fullWidth
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value as WorkspaceMemberStatus }))
                }
              >
                {(Object.keys(WORKSPACE_MEMBER_STATUS_LABELS) as WorkspaceMemberStatus[]).map((k) => (
                  <MenuItem key={k} value={k}>
                    {WORKSPACE_MEMBER_STATUS_LABELS[k]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                type="date"
                label="Startet"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={draft.startedOn}
                onChange={(e) => setDraft((d) => ({ ...d, startedOn: e.target.value }))}
              />
              <TextField
                size="small"
                type="number"
                label="Timesats (NOK)"
                fullWidth
                value={draft.hourlyRate}
                onChange={(e) => setDraft((d) => ({ ...d, hourlyRate: e.target.value }))}
              />
            </Stack>
            <TextField
              size="small"
              label="Notat"
              multiline
              minRows={2}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} sx={{ color: BRAND.textMuted }}>
            Avbryt
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!draft.fullName.trim() || saving}
            variant="contained"
          >
            {saving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fravær */}
      <Dialog
        open={absenceFor !== null}
        onClose={() => setAbsenceFor(null)}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { bgcolor: '#150a29', backgroundImage: 'none' } } }}
      >
        <DialogTitle sx={{ color: BRAND.text }}>
          Fravær — {absenceFor?.fullName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              size="small"
              label="Type"
              value={absenceType}
              onChange={(e) => setAbsenceType(e.target.value as WorkspaceAbsenceType)}
            >
              {(Object.keys(WORKSPACE_ABSENCE_LABELS) as WorkspaceAbsenceType[]).map((k) => (
                <MenuItem key={k} value={k}>
                  {WORKSPACE_ABSENCE_LABELS[k]}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                size="small"
                type="date"
                label="Fra"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={absenceStart}
                onChange={(e) => setAbsenceStart(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="Til"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={absenceEnd}
                onChange={(e) => setAbsenceEnd(e.target.value)}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbsenceFor(null)} sx={{ color: BRAND.textMuted }}>
            Avbryt
          </Button>
          <Button
            onClick={() => void handleAddAbsence()}
            disabled={!absenceStart || !absenceEnd}
            variant="contained"
          >
            Registrer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default HrTab;
