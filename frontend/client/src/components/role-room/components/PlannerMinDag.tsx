/**
 * PlannerMinDag — personlig «hva krever min oppmerksomhet i dag», på TVERS av
 * prosjekter. Bygger på useCrossProjectInbox (cross-prosjekt-aggregering).
 *
 * Bygge-spec fra adversarial-passet: ÉN «nå»-referanse (konsistente
 * nedtellinger), «om N dager» avledet fra ekte Date, WCAG-kontrast (muted
 * ≥0.78), status med ikon-form+tekst (ikke farge alene), ekte <button> m/
 * :focus-visible + 44px, heltalls type-skala, tom-tilstander, ellipsis.
 *
 * Vises kun i content-producer-modus.
 */
import { useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, Collapse } from '@mui/material';
import {
  ErrorOutline as UrgentIcon,
  TodayOutlined as TodayIcon,
  ScheduleOutlined as SoonIcon,
  NotificationsActiveOutlined as AttentionIcon,
  CheckCircleOutline as DoneIcon,
  ArrowForward as ArrowIcon,
  ExpandMore as ExpandIcon,
} from '@mui/icons-material';
import type { CastingProject } from '../models/casting';
import { useCrossProjectInbox, type CrossProjectInboxItem } from '../hooks/useCrossProjectInbox';

type PlannerMinDagProps = {
  projects: CastingProject[];
  onOpenProject?: (project: CastingProject) => void;
};

const MS_PER_DAY = 86_400_000;

function daysUntil(iso: string | undefined | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function dueLabel(iso: string | undefined | null, now: number): string {
  const d = daysUntil(iso, now);
  if (d === null) return '';
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d === -1) return 'forfalt i går';
  if (d > 1) return `om ${d} dager`;
  return `forfalt ${Math.abs(d)} dager siden`;
}

type Bucket = 'urgent' | 'today' | 'soon' | 'attention';

const BUCKET_META: Record<Bucket, { label: string; color: string; Icon: typeof UrgentIcon }> = {
  urgent: { label: 'Haster nå', color: '#fca5a5', Icon: UrgentIcon },
  today: { label: 'I dag', color: '#fbbf24', Icon: TodayIcon },
  soon: { label: 'Kommende', color: '#22d3ee', Icon: SoonIcon },
  attention: { label: 'Krever oppmerksomhet', color: '#c4b5fd', Icon: AttentionIcon },
};
const BUCKET_ORDER: Bucket[] = ['urgent', 'today', 'soon', 'attention'];

function bucketFor(item: CrossProjectInboxItem, now: number): Bucket {
  const d = daysUntil(item.due_at, now);
  if (d !== null) {
    if (d < 0) return 'urgent';
    if (d === 0) return 'today';
    if (d <= 7) return 'soon';
  }
  return 'attention';
}

export default function PlannerMinDag({ projects, onOpenProject }: PlannerMinDagProps) {
  const now = Date.now();
  const projectRefs = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );
  const { items, loading, unreadCount } = useCrossProjectInbox(projectRefs);
  const [collapsed, setCollapsed] = useState(false);

  const buckets = useMemo(() => {
    const map: Record<Bucket, CrossProjectInboxItem[]> = { urgent: [], today: [], soon: [], attention: [] };
    for (const item of items) map[bucketFor(item, now)].push(item);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now]);

  const totalActionable = buckets.urgent.length + buckets.today.length;

  // Vises ikke før vi har prosjekter; ingen grunn til tom ramme.
  if (projects.length === 0) return null;

  const findProject = (id: string) => projects.find((p) => p.id === id);

  return (
    <Box
      sx={{
        borderRadius: '16px',
        border: '1px solid rgba(148,163,184,0.14)',
        background: 'linear-gradient(180deg,#0c0a18,#0a0a14)',
        p: { xs: 2, md: 2.5 },
        mb: 2.5,
        boxShadow: '0 18px 44px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: collapsed ? 0 : 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '16px' }}>Min dag</Typography>
          {loading ? (
            <CircularProgress size={14} sx={{ color: '#a855f7' }} />
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
              {totalActionable > 0
                ? `${totalActionable} krever handling${unreadCount > 0 ? ` · ${unreadCount} uleste` : ''}`
                : 'Alt er ajour på tvers av prosjektene dine'}
            </Typography>
          )}
        </Stack>
        <Button
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Vis Min dag' : 'Skjul Min dag'}
          sx={{
            minWidth: 44, minHeight: 44, color: 'rgba(226,232,240,0.8)',
            '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 },
          }}
        >
          <ExpandIcon sx={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
        </Button>
      </Stack>

      <Collapse in={!collapsed}>
        {/* Tom-tilstand */}
        {!loading && items.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
            <DoneIcon sx={{ fontSize: 30, color: '#86efac' }} />
            <Typography sx={{ color: '#f5f3ff', fontWeight: 700, fontSize: '14px' }}>Ingenting venter — bra jobba</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '12px' }}>
              Nye godkjenninger, frister og klient-svar dukker opp her.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {BUCKET_ORDER.map((bucket) => {
              const list = buckets[bucket];
              if (list.length === 0) return null;
              const meta = BUCKET_META[bucket];
              const SectionIcon = meta.Icon;
              return (
                <Box key={bucket}>
                  <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 0.8 }}>
                    <SectionIcon sx={{ fontSize: 15, color: meta.color }} />
                    <Typography sx={{ color: meta.color, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {meta.label}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                      {list.length}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.8}>
                    {list.slice(0, 4).map((item) => (
                      <MinDagRow
                        key={item.id}
                        item={item}
                        accent={meta.color}
                        now={now}
                        onOpen={onOpenProject ? () => {
                          const p = findProject(item.projectId);
                          if (p) onOpenProject(p);
                        } : undefined}
                      />
                    ))}
                    {list.length > 4 ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '11.5px', pl: 0.4 }}>
                        +{list.length - 4} flere
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Collapse>
    </Box>
  );
}

function MinDagRow({
  item, accent, now, onOpen,
}: {
  item: CrossProjectInboxItem;
  accent: string;
  now: number;
  onOpen?: () => void;
}) {
  const due = dueLabel(item.due_at, now);
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.2,
        p: 1.1, borderRadius: '10px',
        border: '1px solid rgba(148,163,184,0.12)',
        borderLeft: `3px solid ${accent}`,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {!item.read ? (
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} aria-label="Ulest" />
      ) : (
        <Box sx={{ width: 8, flexShrink: 0 }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.2 }}>
          <Typography
            sx={{
              color: 'rgba(196,181,253,0.92)', fontSize: '10.5px', fontWeight: 700,
              px: 0.7, py: 0.1, borderRadius: '6px', background: 'rgba(168,85,247,0.14)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
            }}
            title={item.projectName}
          >
            {item.projectName}
          </Typography>
          {due ? (
            <Typography sx={{ color: accent, fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {due}
            </Typography>
          ) : null}
        </Stack>
        <Typography
          sx={{ color: '#f5f3ff', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={item.title}
        >
          {item.title}
        </Typography>
        {item.message ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.message}
          </Typography>
        ) : null}
      </Box>
      {onOpen ? (
        <Button
          onClick={onOpen}
          endIcon={<ArrowIcon sx={{ fontSize: 15 }} />}
          sx={{
            flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: '12px',
            minHeight: 44, px: 1.2, borderRadius: '9px', color: '#c4b5fd',
            '&:hover': { background: 'rgba(168,85,247,0.1)' },
            '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 },
          }}
        >
          Åpne
        </Button>
      ) : null}
    </Box>
  );
}
