/**
 * PlannerDeliverablesBoard — Leveranser-board (Utkast → Intern review →
 * Klient-review → Levert) på den strukturerte leveranse-modellen (mig 291 /
 * roleRoomDeliverablesApi). Pris-nivå mot bygge-spec'en: ekte datoer,
 * WCAG-kontrast, status med ikon+tekst, ekte <button> m/ :focus-visible +44px,
 * tom-tilstander, forfall-varsler.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Add as AddIcon,
  ErrorOutline as OverdueIcon,
  ScheduleOutlined as DueSoonIcon,
  CheckCircleOutline as DeliveredIcon,
  HourglassEmptyOutlined as WaitingIcon,
} from '@mui/icons-material';
import {
  listDeliverables,
  createDeliverable,
  updateDeliverable,
  DELIVERABLE_STATUS_ORDER,
  DELIVERABLE_STATUS_LABELS,
  type RoleRoomDeliverable,
  type DeliverableStatus,
} from '../services/roleRoomDeliverablesApi';

type PlannerDeliverablesBoardProps = { projectId: string };

const MS_PER_DAY = 86_400_000;
function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}
function dueLabel(iso: string | null, now: number): string {
  const d = daysUntil(iso, now);
  if (d === null) return '';
  if (d === 0) return 'frist i dag';
  if (d === 1) return 'frist i morgen';
  if (d === -1) return 'forfalt i går';
  if (d > 1) return `frist om ${d} dager`;
  return `forfalt ${Math.abs(d)} dager siden`;
}

const COLUMN_ACCENT: Record<DeliverableStatus, string> = {
  draft: 'rgba(148,163,184,0.7)',
  internal_review: '#c4b5fd',
  client_review: '#fbbf24',
  delivered: '#86efac',
};

export default function PlannerDeliverablesBoard({ projectId }: PlannerDeliverablesBoardProps) {
  const now = Date.now();
  const [items, setItems] = useState<RoleRoomDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setItems(await listDeliverables(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente leveranser');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const byStatus = useMemo(() => {
    const map: Record<DeliverableStatus, RoleRoomDeliverable[]> = {
      draft: [], internal_review: [], client_review: [], delivered: [],
    };
    for (const d of items) map[d.status].push(d);
    return map;
  }, [items]);

  const summary = useMemo(() => {
    const open = items.filter((d) => d.status !== 'delivered');
    const overdue = open.filter((d) => {
      const days = daysUntil(d.dueAt, now);
      return days !== null && days < 0;
    }).length;
    const awaitingClient = byStatus.client_review.length;
    return { total: items.length, overdue, awaitingClient, delivered: byStatus.delivered.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, byStatus, now]);

  const moveStatus = useCallback(async (item: RoleRoomDeliverable, dir: -1 | 1) => {
    const idx = DELIVERABLE_STATUS_ORDER.indexOf(item.status);
    const next = DELIVERABLE_STATUS_ORDER[idx + dir];
    if (!next) return;
    setBusyId(item.id);
    // Optimistisk oppdatering.
    setItems((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: next } : d)));
    try {
      const updated = await updateDeliverable(projectId, item.id, { status: next });
      setItems((prev) => prev.map((d) => (d.id === item.id ? updated : d)));
    } catch {
      void load(); // rull tilbake til serverens sannhet
    } finally {
      setBusyId(null);
    }
  }, [projectId, load]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const created = await createDeliverable(projectId, { title, status: 'draft' });
      setItems((prev) => [...prev, created]);
      setNewTitle(''); setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette leveranse');
    } finally {
      setCreating(false);
    }
  }, [projectId, newTitle]);

  return (
    <Box
      sx={{
        borderRadius: '16px', border: '1px solid rgba(148,163,184,0.14)',
        background: 'linear-gradient(180deg,#0c0a18,#0a0a14)',
        p: { xs: 2, md: 2.5 }, mb: 2.5, boxShadow: '0 18px 44px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header + sammendrag */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '16px' }}>Leveranser</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
            {loading ? 'Laster…' : `${summary.total} leveranser · ${summary.overdue} forsinket · ${summary.awaitingClient} venter på klient · ${summary.delivered} levert`}
          </Typography>
        </Box>
      </Stack>

      {error ? (
        <Typography sx={{ color: '#fca5a5', fontSize: '12.5px', mb: 1 }}>{error}</Typography>
      ) : null}

      {loading && items.length === 0 ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} sx={{ color: '#a855f7' }} />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
          {DELIVERABLE_STATUS_ORDER.map((status) => {
            const col = byStatus[status];
            const accent = COLUMN_ACCENT[status];
            return (
              <Box key={status} sx={{ borderRadius: '12px', border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(255,255,255,0.02)', p: 1.2, minHeight: 120 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
                    <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '12px', fontWeight: 700 }}>
                      {DELIVERABLE_STATUS_LABELS[status]}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{col.length}</Typography>
                  </Stack>
                  {status === 'draft' ? (
                    <Tooltip title="Ny leveranse">
                      <IconButton
                        size="small" onClick={() => setAdding((a) => !a)}
                        aria-label="Ny leveranse"
                        sx={{ width: 44, height: 44, color: '#c4b5fd', '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 } }}
                      >
                        <AddIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>

                {/* Inline opprett (kun Utkast-kolonnen) */}
                {status === 'draft' && adding ? (
                  <Stack spacing={0.8} sx={{ mb: 1 }}>
                    <TextField
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
                      placeholder="F.eks. Hovedfilm 30s"
                      size="small" autoFocus fullWidth
                      InputProps={{ sx: { fontSize: '13px', color: '#f5f3ff', background: 'rgba(15,23,42,0.55)' } }}
                    />
                    <Stack direction="row" spacing={0.8}>
                      <Button
                        onClick={() => void handleCreate()} disabled={creating || !newTitle.trim()}
                        size="small"
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: '12px', minHeight: 36, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 }, '&.Mui-disabled': { opacity: 0.5, color: '#fff' } }}
                      >
                        {creating ? 'Legger til…' : 'Legg til'}
                      </Button>
                      <Button onClick={() => { setAdding(false); setNewTitle(''); }} size="small" sx={{ textTransform: 'none', fontSize: '12px', minHeight: 36, color: 'rgba(226,232,240,0.7)' }}>Avbryt</Button>
                    </Stack>
                  </Stack>
                ) : null}

                <Stack spacing={0.8}>
                  {col.map((item) => (
                    <DeliverableCard
                      key={item.id} item={item} accent={accent} now={now}
                      busy={busyId === item.id}
                      onPrev={DELIVERABLE_STATUS_ORDER.indexOf(item.status) > 0 ? () => void moveStatus(item, -1) : undefined}
                      onNext={DELIVERABLE_STATUS_ORDER.indexOf(item.status) < DELIVERABLE_STATUS_ORDER.length - 1 ? () => void moveStatus(item, 1) : undefined}
                    />
                  ))}
                  {col.length === 0 && !(status === 'draft' && adding) ? (
                    <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '11.5px', py: 1, textAlign: 'center' }}>
                      {status === 'delivered' ? 'Ingen levert ennå' : 'Tom'}
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function DeliverableCard({
  item, accent, now, busy, onPrev, onNext,
}: {
  item: RoleRoomDeliverable;
  accent: string;
  now: number;
  busy: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const days = daysUntil(item.dueAt, now);
  const overdue = item.status !== 'delivered' && days !== null && days < 0;
  const dueSoon = item.status !== 'delivered' && days !== null && days >= 0 && days <= 3;
  const due = dueLabel(item.dueAt, now);
  const DueIcon = item.status === 'delivered' ? DeliveredIcon : overdue ? OverdueIcon : dueSoon ? DueSoonIcon : WaitingIcon;
  const dueColor = item.status === 'delivered' ? '#86efac' : overdue ? '#fca5a5' : dueSoon ? '#fbbf24' : 'rgba(226,232,240,0.7)';

  return (
    <Box sx={{ borderRadius: '10px', border: '1px solid rgba(148,163,184,0.12)', borderLeft: `3px solid ${accent}`, background: 'rgba(2,6,23,0.4)', p: 1.1, opacity: busy ? 0.6 : 1 }}>
      <Typography sx={{ color: '#f5f3ff', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
        {item.title}
      </Typography>
      <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" sx={{ mt: 0.4, rowGap: 0.3 }}>
        {item.format ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '11px' }}>{item.format}</Typography>
        ) : null}
        <Typography sx={{ color: 'rgba(196,181,253,0.9)', fontSize: '10.5px', fontWeight: 700, px: 0.6, py: 0.1, borderRadius: '5px', background: 'rgba(168,85,247,0.14)', fontVariantNumeric: 'tabular-nums' }}>
          v{item.version}
        </Typography>
      </Stack>
      {due ? (
        <Stack direction="row" spacing={0.4} alignItems="center" sx={{ mt: 0.5 }}>
          <DueIcon sx={{ fontSize: 13, color: dueColor }} />
          <Typography sx={{ color: dueColor, fontSize: '11px', fontWeight: 600 }}>{due}</Typography>
        </Stack>
      ) : null}
      {item.waitingOn ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '11px', mt: 0.3 }}>Venter på: {item.waitingOn}</Typography>
      ) : null}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.6 }}>
        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '10.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
          {item.assigneeLabel ?? ''}
        </Typography>
        <Stack direction="row" spacing={0.2}>
          <Tooltip title="Flytt tilbake">
            <span>
              <IconButton size="small" disabled={!onPrev || busy} onClick={onPrev} aria-label="Flytt tilbake"
                sx={{ width: 44, height: 44, color: 'rgba(226,232,240,0.7)', '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 } }}>
                <PrevIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Flytt fremover">
            <span>
              <IconButton size="small" disabled={!onNext || busy} onClick={onNext} aria-label="Flytt fremover"
                sx={{ width: 44, height: 44, color: '#c4b5fd', '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 } }}>
                <NextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}
