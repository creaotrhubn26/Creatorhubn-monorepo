/**
 * RehearsalPlanner — koblet mot ChoreographyBuilder + FormationView.
 *
 * Layout:
 *   ┌─ Header (tittel, tid, sted, status, opptak-knapp) ───────────────┐
 *   │                                                                  │
 *   │  ┌─── PRE: fokus-områder ────┐  ┌── POST: review + oppfølging ──┐│
 *   │  │ - Refrenget               │  │ Segment-reviews:              ││
 *   │  │ - Formasjon B→C           │  │   ✓ seg-3  Approved           ││
 *   │  │ - Lift-sekvens            │  │   ⟲ seg-4  Needs repeat       ││
 *   │  │ + Add focus area          │  │                               ││
 *   │  └──────────────────────────┘  │ Dancer follow-ups:            ││
 *   │                                  │   Ingrid: timing på lift     ││
 *   │  Pre-notes (textarea)           │   Martin: stabilitet         ││
 *   │                                  │ Post-notes                    ││
 *   │                                  └─────────────────────────────┘│
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Hver fokus-area er klikkbart — kaller `onJumpToSegment(segmentId, sec)`
 * eller `onJumpToFormationTransition(fromId, toId)` slik at brukeren
 * lander direkte i Builder eller Formation View på riktig sted.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Button,
  MenuItem,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  LocationOn as LocationIcon,
  Group as GroupIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayCircle as PlayIcon,
  CheckCircle as CheckIcon,
  Replay as ReplayIcon,
  RadioButtonUnchecked as PendingIcon,
  Movie as VideoIcon,
  ChevronRight as ChevronRightIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  buildDemoRehearsal,
  type Rehearsal,
  type RehearsalFocusArea,
  type RehearsalOutcome,
  type RehearsalStatus,
} from './rehearsalTypes';
import {
  buildDemoChoreography,
  formatTime,
  getSegmentMeta,
  type Choreography,
  type Segment,
} from './choreographyTypes';
import {
  DEMO_DANCERS,
  DEMO_FORMATIONS,
  type Dancer,
  type Formation,
} from './formationTypes';

// ─── Props ──────────────────────────────────────────────────────────────

export interface RehearsalPlannerProps {
  rehearsal?: Rehearsal;
  choreography?: Choreography;
  dancers?: readonly Dancer[];
  formations?: readonly Formation[];
  /** Klikk på fokus-område med segment-ref. */
  onJumpToSegment?: (segmentId: string, startSec: number) => void;
  /** Klikk på fokus-område med formasjon-ref. */
  onJumpToFormation?: (formationId: string) => void;
  /** Persistent endring (autosave). */
  onChange?: (rehearsal: Rehearsal) => void;
}

// ─── Komponent ──────────────────────────────────────────────────────────

export const RehearsalPlanner: React.FC<RehearsalPlannerProps> = ({
  rehearsal: initialRehearsal,
  choreography: initialChoreo,
  dancers = DEMO_DANCERS,
  formations = DEMO_FORMATIONS,
  onJumpToSegment,
  onJumpToFormation,
  onChange,
}) => {
  const [choreography] = useState<Choreography>(() => initialChoreo ?? buildDemoChoreography());
  const [rehearsal, setRehearsal] = useState<Rehearsal>(
    () => initialRehearsal ?? buildDemoRehearsal(choreography.id),
  );

  const dancersById = useMemo(() => new Map(dancers.map((d) => [d.id, d])), [dancers]);
  const formationsById = useMemo(() => new Map(formations.map((f) => [f.id, f])), [formations]);
  const segmentsById = useMemo(() => new Map(choreography.segments.map((s) => [s.id, s])), [choreography.segments]);

  const update = useCallback((patch: Partial<Rehearsal>) => {
    setRehearsal((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const updateFocusArea = useCallback((id: string, patch: Partial<RehearsalFocusArea>) => {
    setRehearsal((prev) => {
      const next = {
        ...prev,
        focusAreas: prev.focusAreas.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        updatedAt: new Date().toISOString(),
      };
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const addFocusArea = useCallback(() => {
    const newArea: RehearsalFocusArea = {
      id: `fa-${Date.now()}`,
      title: 'Nytt fokus-område',
      estimatedMinutes: 20,
    };
    update({ focusAreas: [...rehearsal.focusAreas, newArea] });
  }, [rehearsal.focusAreas, update]);

  const deleteFocusArea = useCallback((id: string) => {
    update({ focusAreas: rehearsal.focusAreas.filter((f) => f.id !== id) });
  }, [rehearsal.focusAreas, update]);

  const setSegmentOutcome = useCallback((segmentId: string, outcome: RehearsalOutcome, note?: string) => {
    setRehearsal((prev) => {
      const existing = prev.segmentReviews.find((r) => r.segmentId === segmentId);
      const next = existing
        ? prev.segmentReviews.map((r) => (r.segmentId === segmentId ? { ...r, outcome, note } : r))
        : [...prev.segmentReviews, { segmentId, outcome, note }];
      const updated = { ...prev, segmentReviews: next, updatedAt: new Date().toISOString() };
      onChange?.(updated);
      return updated;
    });
  }, [onChange]);

  const totalEstimatedMin = rehearsal.focusAreas.reduce((sum, f) => sum + (f.estimatedMinutes ?? 0), 0);
  const focusProgressPct = rehearsal.estimatedMinutes > 0
    ? Math.round((totalEstimatedMin / rehearsal.estimatedMinutes) * 100)
    : 0;

  const approvedCount = rehearsal.segmentReviews.filter((r) => r.outcome === 'approved').length;
  const repeatCount = rehearsal.segmentReviews.filter((r) => r.outcome === 'needs_repeat').length;

  return (
    <Box
      data-testid="rehearsal-planner"
      sx={{
        bgcolor: '#0a0a0a',
        color: '#e5e7eb',
        minHeight: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        p: { xs: 2, md: 3 },
      }}
    >
      {/* ─── Header ────────────────────────────────────── */}
      <RehearsalHeader
        rehearsal={rehearsal}
        choreographyTitle={choreography.title}
        invitedCount={rehearsal.invitedDancerIds.length || dancers.length}
        onUpdate={update}
      />

      {/* ─── Pre-/post-tabs ─────────────────────────────── */}
      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' },
          gap: 2,
        }}
      >
        {/* ─── PRE: Fokus-områder ────────────────────── */}
        <Card sx={{ bgcolor: '#0f1318', border: '1px solid #1e2536', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Box>
                <Typography sx={{ fontSize: 10, letterSpacing: 1.8, color: '#a78bfa', fontWeight: 700 }}>
                  FØR PRØVEN · FOKUS-OMRÅDER
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.25 }}>
                  {rehearsal.focusAreas.length} områder · estimert {totalEstimatedMin} min av {rehearsal.estimatedMinutes} min
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={addFocusArea}
                sx={{ textTransform: 'none', fontSize: 11, color: '#c4b5fd', borderColor: 'rgba(139,92,246,0.4)' }}
                variant="outlined"
                data-testid="rehearsal-add-focus"
              >
                Legg til
              </Button>
            </Stack>

            <LinearProgress
              variant="determinate"
              value={Math.min(focusProgressPct, 100)}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: '#1e2536',
                mb: 1.5,
                '& .MuiLinearProgress-bar': {
                  bgcolor: focusProgressPct > 100 ? '#f87171' : '#a78bfa',
                },
              }}
            />

            <Stack spacing={1}>
              {rehearsal.focusAreas.map((area) => (
                <FocusAreaCard
                  key={area.id}
                  area={area}
                  segment={area.segmentId ? segmentsById.get(area.segmentId) : undefined}
                  formationFrom={area.formationFromId ? formationsById.get(area.formationFromId) : undefined}
                  formationTo={area.formationToId ? formationsById.get(area.formationToId) : undefined}
                  onUpdate={(patch) => updateFocusArea(area.id, patch)}
                  onDelete={() => deleteFocusArea(area.id)}
                  onJumpToSegment={onJumpToSegment}
                  onJumpToFormation={onJumpToFormation}
                />
              ))}
              {rehearsal.focusAreas.length === 0 && (
                <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                  Ingen fokus-områder ennå. Legg til hva prøven skal handle om.
                </Typography>
              )}
            </Stack>

            <Box sx={{ mt: 2 }}>
              <FieldLabel>Pre-notater</FieldLabel>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                value={rehearsal.preNotes ?? ''}
                onChange={(e) => update({ preNotes: e.target.value || undefined })}
                placeholder="Ting å huske før prøven starter — kostyme-skifter, innfall i programmet, varselsignaler…"
                sx={textareaSx}
              />
            </Box>
          </CardContent>
        </Card>

        {/* ─── POST: Reviews + oppfølging ────────────── */}
        <Card sx={{ bgcolor: '#0f1318', border: '1px solid #1e2536', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Box>
                <Typography sx={{ fontSize: 10, letterSpacing: 1.8, color: '#fde68a', fontWeight: 700 }}>
                  ETTER PRØVEN · REVIEW
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.25 }}>
                  {approvedCount} godkjent · {repeatCount} må repeteres
                </Typography>
              </Box>
              {rehearsal.recordingUrl && (
                <Tooltip title="Åpne opptak">
                  <IconButton
                    size="small"
                    onClick={() => window.open(rehearsal.recordingUrl, '_blank', 'noopener')}
                    sx={{ color: '#a78bfa' }}
                  >
                    <VideoIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {/* Segment-reviews — kun de segmenter som er fokus-mål */}
            <Stack spacing={0.75}>
              {choreography.segments
                .filter((s) => rehearsal.focusAreas.some((f) => f.segmentId === s.id))
                .map((seg) => {
                  const review = rehearsal.segmentReviews.find((r) => r.segmentId === seg.id);
                  return (
                    <SegmentReviewRow
                      key={seg.id}
                      segment={seg}
                      outcome={review?.outcome ?? 'pending'}
                      note={review?.note}
                      onSetOutcome={(outcome, note) => setSegmentOutcome(seg.id, outcome, note)}
                    />
                  );
                })}
              {rehearsal.focusAreas.every((f) => !f.segmentId) && (
                <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', textAlign: 'center', py: 1 }}>
                  Ingen segmenter er knyttet til fokus-områder ennå.
                </Typography>
              )}
            </Stack>

            <Divider sx={{ borderColor: '#1e2536', my: 1.5 }} />

            {/* Dancer follow-ups */}
            <FieldLabel>Danser-oppfølging</FieldLabel>
            <Stack spacing={0.75}>
              {rehearsal.dancerFollowUps.length === 0 ? (
                <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                  Ingen oppfølginger lagt til ennå.
                </Typography>
              ) : (
                rehearsal.dancerFollowUps.map((fu) => {
                  const d = dancersById.get(fu.dancerId);
                  return (
                    <Box
                      key={fu.dancerId}
                      sx={{
                        p: 1, borderRadius: 1,
                        border: '1px solid #1e2536', bgcolor: 'rgba(251,191,36,0.04)',
                      }}
                    >
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fde68a' }}>
                        {d?.name ?? fu.dancerId}
                      </Typography>
                      <Typography sx={{ fontSize: 10.5, color: '#cbd5e1' }}>
                        {fu.followUp}
                      </Typography>
                      {fu.dueBy && (
                        <Typography sx={{ fontSize: 9, color: '#9ca3af', mt: 0.25 }}>
                          Frist: {fu.dueBy}
                        </Typography>
                      )}
                    </Box>
                  );
                })
              )}
              <DancerFollowUpAdder
                dancers={dancers}
                onAdd={(dancerId, followUp, dueBy) => {
                  update({
                    dancerFollowUps: [
                      ...rehearsal.dancerFollowUps,
                      { dancerId, followUp, dueBy },
                    ],
                  });
                }}
              />
            </Stack>

            <Box sx={{ mt: 1.5 }}>
              <FieldLabel>Post-notater</FieldLabel>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                value={rehearsal.postNotes ?? ''}
                onChange={(e) => update({ postNotes: e.target.value || undefined })}
                placeholder="Hvordan gikk prøven? Hva må følges opp neste gang?"
                sx={textareaSx}
              />
            </Box>

            <Box sx={{ mt: 1.5 }}>
              <FieldLabel>Koreografi-endringer (versjons-logg)</FieldLabel>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                value={rehearsal.choreographyChangelog ?? ''}
                onChange={(e) => update({ choreographyChangelog: e.target.value || undefined })}
                placeholder="Hvis prøven medførte endringer i koreografien, beskriv dem her."
                sx={textareaSx}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

// ═══════════════════════ HEADER ═══════════════════════

const RehearsalHeader: React.FC<{
  rehearsal: Rehearsal;
  choreographyTitle: string;
  invitedCount: number;
  onUpdate: (patch: Partial<Rehearsal>) => void;
}> = ({ rehearsal, choreographyTitle, invitedCount, onUpdate }) => {
  return (
    <Card sx={{ bgcolor: '#0f1318', border: '1px solid #1e2536', boxShadow: 'none' }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 10, letterSpacing: 2, color: '#a78bfa', fontWeight: 700, mb: 0.5 }}>
              REHEARSAL PLANNER
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
              {rehearsal.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#9ca3af', mt: 0.25 }}>
              For: {choreographyTitle}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <HeaderPill icon={<CalendarIcon sx={{ fontSize: 12 }} />} label={formatScheduledAt(rehearsal.scheduledAt)} />
              <HeaderPill icon={<LocationIcon sx={{ fontSize: 12 }} />} label={rehearsal.location ?? 'Sted ikke valgt'} />
              <HeaderPill icon={<GroupIcon sx={{ fontSize: 12 }} />} label={`${invitedCount} dansere`} />
              <HeaderPill label={`${rehearsal.estimatedMinutes} min`} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusChip status={rehearsal.status} onChange={(s) => onUpdate({ status: s })} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

const HeaderPill: React.FC<{ label: string; icon?: React.ReactNode }> = ({ label, icon }) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.4, borderRadius: 12, bgcolor: '#1e2536', border: '1px solid #2a3142' }}>
    {icon && <Box sx={{ color: '#9ca3af', display: 'flex' }}>{icon}</Box>}
    <Typography sx={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500 }}>{label}</Typography>
  </Stack>
);

const STATUS_META: Record<RehearsalStatus, { label: string; color: string }> = {
  planned:     { label: 'Planlagt',     color: '#60a5fa' },
  in_progress: { label: 'I gang',       color: '#fbbf24' },
  completed:   { label: 'Fullført',     color: '#34d399' },
  cancelled:   { label: 'Avlyst',       color: '#9ca3af' },
};

const StatusChip: React.FC<{ status: RehearsalStatus; onChange: (s: RehearsalStatus) => void }> = ({ status, onChange }) => {
  const m = STATUS_META[status];
  return (
    <TextField
      select
      size="small"
      value={status}
      onChange={(e) => onChange(e.target.value as RehearsalStatus)}
      sx={{
        minWidth: 130,
        '& .MuiInputBase-input': { fontSize: 11, color: m.color, fontWeight: 700, py: 0.5 },
        '& .MuiOutlinedInput-root': {
          bgcolor: `${m.color}15`,
          '& fieldset': { borderColor: `${m.color}55` },
        },
      }}
    >
      {(Object.keys(STATUS_META) as RehearsalStatus[]).map((s) => (
        <MenuItem key={s} value={s} sx={{ fontSize: 11 }}>
          <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_META[s].color, mr: 1 }} />
          {STATUS_META[s].label}
        </MenuItem>
      ))}
    </TextField>
  );
};

// ═══════════════════════ FOCUS-AREA CARD ═══════════════════════

interface FocusAreaCardProps {
  area: RehearsalFocusArea;
  segment?: Segment;
  formationFrom?: Formation;
  formationTo?: Formation;
  onUpdate: (patch: Partial<RehearsalFocusArea>) => void;
  onDelete: () => void;
  onJumpToSegment?: (segmentId: string, startSec: number) => void;
  onJumpToFormation?: (formationId: string) => void;
}

const FocusAreaCard: React.FC<FocusAreaCardProps> = ({
  area, segment, formationFrom, formationTo, onUpdate, onDelete, onJumpToSegment, onJumpToFormation,
}) => {
  const [editing, setEditing] = useState(false);
  const meta = segment ? getSegmentMeta(segment.kind) : null;

  return (
    <Box
      data-testid={`focus-area-${area.id}`}
      sx={{
        p: 1.25,
        borderRadius: 1,
        border: '1px solid #1e2536',
        bgcolor: 'rgba(139,92,246,0.04)',
        borderLeft: meta ? `3px solid ${meta.color}` : '3px solid #a78bfa',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 0.5 }}>
        {editing ? (
          <TextField
            size="small"
            value={area.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
            autoFocus
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, color: '#fff', fontWeight: 600 } }}
          />
        ) : (
          <Typography
            sx={{ fontSize: 12, fontWeight: 700, color: '#fff', flex: 1, cursor: 'text' }}
            onClick={() => setEditing(true)}
          >
            {area.title}
          </Typography>
        )}
        <Stack direction="row" spacing={0.25}>
          <IconButton size="small" onClick={() => setEditing(true)} sx={{ color: '#9ca3af', p: 0.25 }}>
            <EditIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <IconButton size="small" onClick={onDelete} sx={{ color: '#9ca3af', p: 0.25, '&:hover': { color: '#f87171' } }}>
            <DeleteIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Linker: segment + formation + estimat */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
        {segment && meta && (
          <Chip
            size="small"
            label={`${segment.label ?? meta.kind} · ${formatTime(segment.startSec)}–${formatTime(segment.endSec)}`}
            onClick={() => onJumpToSegment?.(segment.id, area.startSec ?? segment.startSec)}
            sx={{
              height: 20, fontSize: 9.5, cursor: 'pointer',
              bgcolor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55`,
              '&:hover': { bgcolor: `${meta.color}33` },
            }}
          />
        )}
        {formationFrom && (
          <Chip
            size="small"
            label={formationTo
              ? `${formationFrom.name} → ${formationTo.name}`
              : formationFrom.name}
            onClick={() => onJumpToFormation?.(formationFrom.id)}
            sx={{
              height: 20, fontSize: 9.5, cursor: 'pointer',
              bgcolor: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.4)',
              '&:hover': { bgcolor: 'rgba(6,182,212,0.25)' },
            }}
          />
        )}
        {area.estimatedMinutes !== undefined && (
          <Chip
            size="small"
            label={`${area.estimatedMinutes} min`}
            sx={{ height: 20, fontSize: 9.5, bgcolor: '#1e2536', color: '#cbd5e1' }}
          />
        )}
      </Stack>

      {area.goal && (
        <Typography sx={{ fontSize: 10.5, color: '#9ca3af', fontStyle: 'italic' }}>
          Mål: {area.goal}
        </Typography>
      )}
    </Box>
  );
};

// ═══════════════════════ SEGMENT REVIEW ROW ═══════════════════════

const SegmentReviewRow: React.FC<{
  segment: Segment;
  outcome: RehearsalOutcome;
  note?: string;
  onSetOutcome: (outcome: RehearsalOutcome, note?: string) => void;
}> = ({ segment, outcome, note, onSetOutcome }) => {
  const meta = getSegmentMeta(segment.kind);
  return (
    <Box
      data-testid={`segment-review-${segment.id}`}
      sx={{
        p: 1, borderRadius: 1,
        border: '1px solid #1e2536',
        borderLeft: `3px solid ${meta.color}`,
        bgcolor: outcome === 'approved'    ? 'rgba(52,211,153,0.06)'
              : outcome === 'needs_repeat' ? 'rgba(251,191,36,0.06)'
                                            : 'transparent',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#e5e7eb', flex: 1 }} noWrap>
          {segment.label ?? meta.kind}
          <Box component="span" sx={{ color: '#6b7280', fontSize: 9, ml: 0.5, fontFamily: 'monospace' }}>
            {formatTime(segment.startSec)}–{formatTime(segment.endSec)}
          </Box>
        </Typography>
        <Stack direction="row" spacing={0.25}>
          <OutcomeButton outcome="approved"     active={outcome === 'approved'}     onClick={() => onSetOutcome('approved', note)} />
          <OutcomeButton outcome="needs_repeat" active={outcome === 'needs_repeat'} onClick={() => onSetOutcome('needs_repeat', note)} />
          <OutcomeButton outcome="pending"      active={outcome === 'pending'}      onClick={() => onSetOutcome('pending', note)} />
        </Stack>
      </Stack>
      <TextField
        size="small"
        fullWidth
        variant="standard"
        value={note ?? ''}
        onChange={(e) => onSetOutcome(outcome, e.target.value)}
        placeholder="Notat (valgfri)"
        InputProps={{ disableUnderline: true, sx: { fontSize: 10, color: '#cbd5e1' } }}
      />
    </Box>
  );
};

const OutcomeButton: React.FC<{ outcome: RehearsalOutcome; active: boolean; onClick: () => void }> = ({ outcome, active, onClick }) => {
  const cfg = {
    approved:     { Icon: CheckIcon,   color: '#34d399', tip: 'Godkjent'        },
    needs_repeat: { Icon: ReplayIcon,  color: '#fbbf24', tip: 'Må repeteres'    },
    pending:      { Icon: PendingIcon, color: '#9ca3af', tip: 'Avventer'        },
  }[outcome];
  return (
    <Tooltip title={cfg.tip}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          p: 0.4,
          color: active ? cfg.color : '#4b5563',
          bgcolor: active ? `${cfg.color}22` : 'transparent',
          border: active ? `1px solid ${cfg.color}55` : '1px solid transparent',
        }}
      >
        <cfg.Icon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
};

// ═══════════════════════ DANCER FOLLOW-UP ADDER ═══════════════════════

const DancerFollowUpAdder: React.FC<{
  dancers: readonly Dancer[];
  onAdd: (dancerId: string, followUp: string, dueBy?: string) => void;
}> = ({ dancers, onAdd }) => {
  const [dancerId, setDancerId] = useState<string>('');
  const [followUp, setFollowUp] = useState('');

  const handleAdd = useCallback(() => {
    if (!dancerId || !followUp.trim()) return;
    onAdd(dancerId, followUp.trim());
    setFollowUp('');
  }, [dancerId, followUp, onAdd]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 36px', gap: 0.5, alignItems: 'center' }}>
      <TextField
        select
        size="small"
        value={dancerId}
        onChange={(e) => setDancerId(e.target.value)}
        SelectProps={{ displayEmpty: true }}
        sx={inputSx}
      >
        <MenuItem value="" sx={{ fontSize: 10, color: '#6b7280' }}>Velg…</MenuItem>
        {dancers.map((d) => (
          <MenuItem key={d.id} value={d.id} sx={{ fontSize: 10 }}>{d.name}</MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        value={followUp}
        onChange={(e) => setFollowUp(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        placeholder="Hva trenger danseren å jobbe med?"
        sx={inputSx}
      />
      <IconButton
        size="small"
        onClick={handleAdd}
        disabled={!dancerId || !followUp.trim()}
        sx={{
          bgcolor: '#1e2536', color: '#a78bfa',
          '&:hover': { bgcolor: '#2a3142' },
          '&.Mui-disabled': { color: '#4b5563' },
        }}
      >
        <AddIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
};

// ═══════════════════════ HELPERS ═══════════════════════

function formatScheduledAt(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('nb-NO', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
    {children}
  </Typography>
);

const inputSx = {
  '& .MuiInputBase-input': { fontSize: 10, color: '#e5e7eb' },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#0a0a0a',
    '& fieldset': { borderColor: '#1e2536' },
  },
} as const;

const textareaSx = {
  '& .MuiInputBase-input': { fontSize: 11, color: '#e5e7eb' },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#0a0a0a',
    '& fieldset': { borderColor: '#1e2536' },
    '&:hover fieldset': { borderColor: '#374151' },
    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
  },
} as const;

export default RehearsalPlanner;
