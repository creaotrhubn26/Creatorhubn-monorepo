/**
 * ClientContentPlannerView — Content Planner (agenda/kalender). Planlagte poster
 * gruppert per måned, med plattform + status + dato. Legg til post, planlegg
 * dato, og push til feed-planneren. Skriver til role_room_content_plan.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, CircularProgress, Snackbar,
  Select, MenuItem, FormControl, InputLabel, IconButton,
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  CalendarMonthOutlined as CalendarIcon,
  CheckCircleOutline as PublishedIcon,
  ScheduleOutlined as ScheduledIcon,
  EditNoteOutlined as DraftIcon,
  SendOutlined as PushIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import {
  listContentPlan, createContentPlanItem, updateContentPlanItem, deleteContentPlanItem,
  CONTENT_PLATFORMS, PLATFORM_LABEL, type ContentPlanItem,
} from '../../services/roleRoomContentPlanApi';

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof DraftIcon }> = {
  draft: { label: 'Utkast', color: 'rgba(226,232,240,0.8)', Icon: DraftIcon },
  scheduled: { label: 'Planlagt', color: '#fcd34d', Icon: ScheduledIcon },
  published: { label: 'Publisert', color: '#6ee7b7', Icon: PublishedIcon },
};

function monthKey(iso: string | null): string {
  if (!iso) return 'Uplanlagt';
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
}
function dayLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ClientContentPlannerView({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ContentPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [date, setDate] = useState('');
  const [caption, setCaption] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listContentPlan(projectId)); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke hente plan'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, ContentPlanItem[]>();
    for (const it of items) {
      const k = monthKey(it.scheduledAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    // Uplanlagt sist.
    return Array.from(map.entries()).sort((a, b) => (a[0] === 'Uplanlagt' ? 1 : b[0] === 'Uplanlagt' ? -1 : 0));
  }, [items]);

  const add = useCallback(async () => {
    if (!title.trim()) { setToast('Gi posten en tittel.'); return; }
    setBusyId('add');
    try {
      await createContentPlanItem(projectId, {
        title: title.trim(), platform, caption: caption.trim() || undefined,
        scheduledAt: date ? new Date(`${date}T09:00:00`).toISOString() : null,
      });
      setToast('Lagt i content planner.');
      setTitle(''); setCaption(''); setDate(''); setAdding(false);
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke legge til.'); }
    finally { setBusyId(null); }
  }, [projectId, title, platform, caption, date, load]);

  const pushToFeed = useCallback(async (it: ContentPlanItem) => {
    setBusyId(it.id);
    try {
      await updateContentPlanItem(projectId, it.id, { feedPlanPushed: true, status: it.status === 'draft' ? 'scheduled' : it.status });
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, feedPlanPushed: true } : x)));
      setToast('Pushet til feed-planneren.');
    } catch { setToast('Kunne ikke pushe.'); }
    finally { setBusyId(null); }
  }, [projectId]);

  const remove = useCallback(async (it: ContentPlanItem) => {
    setBusyId(it.id);
    try { await deleteContentPlanItem(projectId, it.id); setItems((prev) => prev.filter((x) => x.id !== it.id)); }
    catch { setToast('Kunne ikke slette.'); }
    finally { setBusyId(null); }
  }, [projectId]);

  const fieldSx = { '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)' }, '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.8)' } };

  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>Content Planner</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.8)', mt: 0.3 }}>
          Planlegg innhold på en kalender — legg til poster, sett dato, og push til feed-planneren.
        </Typography>
      </Box>

      {!adding ? (
        <Button onClick={() => setAdding(true)} startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, minHeight: 44, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
          Legg til post
        </Button>
      ) : (
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(124,58,237,0.06)' }}>
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.95rem', mb: 1 }}>Ny post</Typography>
          <Stack spacing={1.25}>
            <TextField label="Tittel / idé" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth sx={fieldSx} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <FormControl size="small" fullWidth sx={fieldSx}>
                <InputLabel>Plattform</InputLabel>
                <Select label="Plattform" value={platform} onChange={(e) => setPlatform(e.target.value)} sx={{ color: '#f1f5f9' }}>
                  {CONTENT_PLATFORMS.map((p) => <MenuItem key={p} value={p}>{PLATFORM_LABEL[p]}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Dato" type="date" value={date} onChange={(e) => setDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={fieldSx} />
            </Stack>
            <TextField label="Caption (valgfritt)" value={caption} onChange={(e) => setCaption(e.target.value)} size="small" fullWidth multiline maxRows={4} sx={fieldSx} />
            <Stack direction="row" spacing={1}>
              <Button onClick={() => void add()} disabled={busyId === 'add'} startIcon={busyId === 'add' ? <CircularProgress size={15} color="inherit" /> : <AddIcon />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>Legg til</Button>
              <Button onClick={() => setAdding(false)} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 44, color: 'rgba(226,232,240,0.8)' }}>Avbryt</Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>
      ) : items.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
          <CalendarIcon sx={{ fontSize: 32, color: 'rgba(226,232,240,0.8)' }} />
          <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.85rem' }}>Ingen planlagte poster ennå.</Typography>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {groups.map(([month, monthItems]) => (
            <Box key={month}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                <CalendarIcon sx={{ fontSize: 16, color: '#c4b5fd' }} />
                <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 800, textTransform: 'capitalize' }}>{month}</Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.74rem' }}>· {monthItems.length}</Typography>
              </Stack>
              <Stack spacing={0.8}>
                {monthItems.map((it) => {
                  const sm = STATUS_META[it.status] ?? STATUS_META.draft;
                  const SIcon = sm.Icon;
                  return (
                    <Box key={it.id} sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.4)', p: 1.1, opacity: busyId === it.id ? 0.6 : 1 }}>
                      <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 64, textAlign: 'center', flexShrink: 0 }}>
                          <Typography sx={{ color: it.scheduledAt ? '#c4b5fd' : 'rgba(226,232,240,0.8)', fontSize: '0.72rem', fontWeight: 700 }}>
                            {it.scheduledAt ? dayLabel(it.scheduledAt) : 'Uplanlagt'}
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 700 }}>{it.title}</Typography>
                          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.3, flexWrap: 'wrap', rowGap: 0.3 }}>
                            {it.platform ? <Chip label={PLATFORM_LABEL[it.platform] ?? it.platform} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, color: '#c4b5fd', bgcolor: 'rgba(168,85,247,0.14)' }} /> : null}
                            <Chip icon={<SIcon sx={{ fontSize: 12, color: `${sm.color} !important` }} />} label={sm.label} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, color: sm.color, bgcolor: 'rgba(255,255,255,0.04)' }} />
                            {it.source === 'chat' ? <Chip label="fra chat" size="small" sx={{ height: 18, fontSize: '0.6rem', color: 'rgba(226,232,240,0.8)', bgcolor: 'rgba(148,163,184,0.14)' }} /> : null}
                            {it.feedPlanPushed ? <Chip label="i feed-planner" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: '#6ee7b7', bgcolor: 'rgba(16,185,129,0.12)' }} /> : null}
                          </Stack>
                          {it.caption ? <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.78rem', mt: 0.4, whiteSpace: 'pre-wrap' }}>{it.caption}</Typography> : null}
                        </Box>
                        <Stack direction="row" spacing={0.2} sx={{ flexShrink: 0 }}>
                          {!it.feedPlanPushed ? (
                            <IconButton aria-label="Push til feed-planner" onClick={() => void pushToFeed(it)} sx={{ width: 40, height: 40, color: '#c4b5fd' }}>
                              <PushIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          ) : null}
                          <IconButton aria-label="Slett" onClick={() => void remove(it)} sx={{ width: 40, height: 40, color: 'rgba(252,165,165,0.9)' }}>
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}
