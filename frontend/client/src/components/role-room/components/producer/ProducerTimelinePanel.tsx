import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
  Save as SaveIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useProducerTimeline } from '../../hooks/useProducerTimeline';
import type { ProducerPhase } from '../../services/producerWorkflowService';

interface ProducerTimelinePanelProps {
  projectId: string;
  readOnly?: boolean;
}

const PHASE_LABELS: Record<ProducerPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjonsdag',
  postproduction: 'Post-produksjon',
};

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planlagt' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'blocked', label: 'Blokkert' },
  { value: 'completed', label: 'Fullført' },
] as const;

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'Ingen kobling' },
  { value: 'scene', label: 'Scene' },
  { value: 'shot', label: 'Shot' },
  { value: 'shotlist', label: 'Shotlist' },
  { value: 'manuscript', label: 'Manus' },
  { value: 'storyboard', label: 'Storyboard' },
  { value: 'economy', label: 'Økonomi' },
  { value: 'client_review', label: 'Klientreview' },
] as const;

export default function ProducerTimelinePanel({ projectId, readOnly = false }: ProducerTimelinePanelProps) {
  const { groupedByPhase, loading, error, createItem, updateItem, removeItem } = useProducerTimeline(projectId);
  const [phase, setPhase] = useState<ProducerPhase>('preproduction');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [itemStatus, setItemStatus] = useState<(typeof STATUS_OPTIONS)[number]['value']>('planned');
  const [linkedEntityType, setLinkedEntityType] = useState<(typeof ENTITY_TYPE_OPTIONS)[number]['value']>('');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [statusDraftById, setStatusDraftById] = useState<Record<string, string>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const totalItems = useMemo(
    () => groupedByPhase.preproduction.length + groupedByPhase.production.length + groupedByPhase.postproduction.length,
    [groupedByPhase],
  );
  const statusSummary = useMemo(() => {
    const counters = {
      planned: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
    };
    for (const phaseKey of Object.keys(groupedByPhase) as ProducerPhase[]) {
      for (const item of groupedByPhase[phaseKey]) {
        if (item.status === 'completed') counters.completed += 1;
        else if (item.status === 'in_progress') counters.in_progress += 1;
        else if (item.status === 'blocked') counters.blocked += 1;
        else counters.planned += 1;
      }
    }
    return counters;
  }, [groupedByPhase]);
  const completionPct = totalItems > 0 ? Math.round((statusSummary.completed / totalItems) * 100) : 0;

  const handleCreate = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    await createItem({
      phase,
      title: nextTitle,
      description: description.trim() || undefined,
      ownerUserId: ownerUserId.trim() || undefined,
      dueAt: dueAt || undefined,
      status: itemStatus,
      linkedEntityType: linkedEntityType || undefined,
      linkedEntityId: linkedEntityId.trim() || undefined,
    });
    setTitle('');
    setDescription('');
    setOwnerUserId('');
    setDueAt('');
    setItemStatus('planned');
    setLinkedEntityType('');
    setLinkedEntityId('');
  };

  const handleStatusDraftChange = (itemId: string, nextStatus: string) => {
    setStatusDraftById((prev) => ({ ...prev, [itemId]: nextStatus }));
  };

  const handleSaveItemStatus = async (itemId: string) => {
    const nextStatus = statusDraftById[itemId];
    if (!nextStatus) return;
    setBusyItemId(itemId);
    try {
      await updateItem(itemId, { status: nextStatus });
      setStatusDraftById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setBusyItemId(itemId);
    try {
      await removeItem(itemId);
      setStatusDraftById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <ScheduleIcon sx={{ color: '#38bdf8' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Fase-tidslinje
          </Typography>
        </Stack>
        <Chip
          size="small"
          label={`${totalItems} milepæler`}
          sx={{
            bgcolor: 'rgba(56,189,248,0.14)',
            color: '#bae6fd',
            border: '1px solid rgba(56,189,248,0.35)',
          }}
        />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip size="small" label={`Fullført ${statusSummary.completed}`} sx={{ bgcolor: 'rgba(74,222,128,0.16)', color: '#86efac' }} />
        <Chip size="small" label={`Pågår ${statusSummary.in_progress}`} sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#7dd3fc' }} />
        <Chip size="small" label={`Planlagt ${statusSummary.planned}`} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
        <Chip size="small" label={`Blokkert ${statusSummary.blocked}`} sx={{ bgcolor: 'rgba(248,113,113,0.16)', color: '#fca5a5' }} />
        <Chip size="small" label={`Fremdrift ${completionPct}%`} sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }} />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {!readOnly && (
        <Stack direction="column" spacing={1}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            <Box sx={{ minWidth: 180 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.8)', mb: 0.5, fontSize: '0.85rem' }}>Fase</Typography>
              <Select
                size="small"
                value={phase}
                onChange={(event) => setPhase(event.target.value as ProducerPhase)}
                fullWidth
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                {Object.entries(PHASE_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
            </Box>
            <TextField
              size="small"
              label="Milepæl"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <TextField
              size="small"
              label="Beskrivelse"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            <TextField
              size="small"
              label="Ansvarlig (bruker-id/e-post)"
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
              sx={{ flex: 1, minWidth: 240 }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <TextField
              size="small"
              label="Deadline"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              sx={{ minWidth: 220 }}
              InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <Box sx={{ minWidth: 160 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.8)', mb: 0.5, fontSize: '0.85rem' }}>Status</Typography>
              <Select
                size="small"
                value={itemStatus}
                onChange={(event) => setItemStatus(event.target.value as (typeof STATUS_OPTIONS)[number]['value'])}
                fullWidth
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ minWidth: 180 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.8)', mb: 0.5, fontSize: '0.85rem' }}>Koblingstype</Typography>
              <Select
                size="small"
                value={linkedEntityType}
                onChange={(event) => setLinkedEntityType(event.target.value as (typeof ENTITY_TYPE_OPTIONS)[number]['value'])}
                fullWidth
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                {ENTITY_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value || 'none'} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </Box>
            <TextField
              size="small"
              label="Koblings-ID"
              value={linkedEntityId}
              onChange={(event) => setLinkedEntityId(event.target.value)}
              sx={{ minWidth: 160 }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { void handleCreate(); }}
              disabled={loading || !title.trim()}
              sx={{ bgcolor: '#fbbf24', color: '#111827', fontWeight: 700, textTransform: 'none', minWidth: 170 }}
            >
              Legg til milepæl
            </Button>
          </Stack>
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

      <Stack spacing={1.5}>
        {(Object.keys(PHASE_LABELS) as ProducerPhase[]).map((phaseKey) => (
          <Box
            key={phaseKey}
            sx={{
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.2)',
              background: 'rgba(15,23,42,0.45)',
              p: 1.25,
            }}
          >
            <Typography sx={{ color: '#e2e8f0', fontWeight: 700, mb: 1 }}>
              {PHASE_LABELS[phaseKey]}
            </Typography>
            <Stack spacing={1}>
              {groupedByPhase[phaseKey].length === 0 ? (
                <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.9rem' }}>
                  Ingen milepæler i denne fasen.
                </Typography>
              ) : (
                groupedByPhase[phaseKey].map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      borderRadius: 1.25,
                      border: '1px solid rgba(148,163,184,0.24)',
                      p: 1,
                      bgcolor: 'rgba(2,6,23,0.45)',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{item.title}</Typography>
                      <Chip
                        size="small"
                        label={item.status}
                        sx={{
                          height: 22,
                          bgcolor: 'rgba(30,41,59,0.9)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(148,163,184,0.35)',
                        }}
                      />
                    </Stack>
                    {item.description && (
                      <Typography sx={{ color: 'rgba(203,213,225,0.86)', mt: 0.6, fontSize: '0.9rem' }}>
                        {item.description}
                      </Typography>
                    )}
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" sx={{ mt: 0.8 }}>
                      {item.owner_user_id && (
                        <Chip
                          size="small"
                          label={`Ansvarlig: ${item.owner_user_id}`}
                          sx={{
                            height: 22,
                            bgcolor: 'rgba(30,41,59,0.9)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(148,163,184,0.35)',
                          }}
                        />
                      )}
                      {item.due_at && (
                        <Chip
                          size="small"
                          label={`Frist: ${new Date(item.due_at).toLocaleString('nb-NO')}`}
                          sx={{
                            height: 22,
                            bgcolor: 'rgba(30,41,59,0.9)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(148,163,184,0.35)',
                          }}
                        />
                      )}
                      {item.linked_entity_type && (
                        <Chip
                          size="small"
                          label={`Kobling: ${item.linked_entity_type}${item.linked_entity_id ? ` (${item.linked_entity_id})` : ''}`}
                          sx={{
                            height: 22,
                            bgcolor: 'rgba(30,41,59,0.9)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(148,163,184,0.35)',
                          }}
                        />
                      )}
                    </Stack>
                    {!readOnly && (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} sx={{ mt: 1 }}>
                        <Box sx={{ minWidth: { xs: '100%', md: 180 } }}>
                          <Select
                            size="small"
                            value={statusDraftById[item.id] ?? item.status}
                            onChange={(event) => handleStatusDraftChange(item.id, String(event.target.value))}
                            fullWidth
                            sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                          </Select>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SaveIcon />}
                          onClick={() => { void handleSaveItemStatus(item.id); }}
                          disabled={loading || busyItemId === item.id || !statusDraftById[item.id] || statusDraftById[item.id] === item.status}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Lagre status
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => { void handleDeleteItem(item.id); }}
                          disabled={loading || busyItemId === item.id}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Fjern
                        </Button>
                      </Stack>
                    )}
                  </Box>
                ))
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
