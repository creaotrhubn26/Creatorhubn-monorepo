/**
 * JobApplicationKanban — drag-drop Kanban-board for jobbsøknader.
 *
 * Kolonner: Lagret → Søkt → Intervju → Tilbud → Avvist
 * (Withdrawn er skjult som default; vises via filter.)
 *
 * Hvert kort viser: stilling, selskap, status-farge, neste milepæl,
 * prioritet, og opprinnelse-chip (finn.no / linkedin / etc).
 *
 * Drag mellom kolonner oppdaterer status via PATCH-mutation. Klikk
 * på kort åpner detalj-dialog der bruker kan redigere felt og legge
 * til/justere milepæler.
 *
 * Henter data via /api/job-applications (eksisterende) og
 * /api/job-application-milestones/upcoming for milepæl-badges.
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Paper, Typography, Chip, IconButton, Button,
  Card, CardContent, Tooltip, Avatar, Skeleton,
} from '@mui/material';
import {
  DragDropContext, Droppable, Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Add as AddIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
  LocationOn as LocationIcon,
  Flag as FlagIcon,
  PlayCircleOutline as PlayCircleIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

type Status =
  | 'saved' | 'applied' | 'interviewing'
  | 'offer' | 'accepted' | 'rejected' | 'withdrawn';

interface JobApp {
  id: string;
  jobTitle: string;
  company: string;
  location?: string | null;
  jobUrl?: string | null;
  source?: string | null;
  status: Status;
  priority: 'low' | 'medium' | 'high';
  salary?: string | null;
  tags?: string[];
  appliedDate?: string | null;
  interviewDate?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Milestone {
  id: string;
  applicationId: string;
  kind: 'application_deadline' | 'case_deadline' | 'interview' | 'expected_response' | 'custom';
  title: string;
  dueAt: string;
  completedAt: string | null;
  jobTitle?: string;
  company?: string;
}

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: 'saved',        label: 'Lagret',   color: '#9CA3AF' },
  { id: 'applied',      label: 'Søkt',     color: '#3B82F6' },
  { id: 'interviewing', label: 'Intervju', color: '#F5B82E' },
  { id: 'offer',        label: 'Tilbud',   color: '#10B981' },
  { id: 'rejected',     label: 'Avvist',   color: '#DC2626' },
];

const PRIORITY_COLOR: Record<JobApp['priority'], string> = {
  low: '#9CA3AF',
  medium: '#F5B82E',
  high: '#DC2626',
};

const MILESTONE_LABEL: Record<Milestone['kind'], string> = {
  application_deadline: 'Søknadsfrist',
  case_deadline: 'Case-frist',
  interview: 'Intervju',
  expected_response: 'Forventet svar',
  custom: 'Egen frist',
};

function daysUntil(iso: string): number {
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDeadline(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `forfalt for ${Math.abs(d)} d`;
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d <= 7) return `om ${d} dager`;
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
}

function deadlineColor(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return '#DC2626';
  if (d <= 1) return '#DC2626';
  if (d <= 3) return '#F5B82E';
  return '#6B7280';
}

interface Props {
  onAddNew?: () => void;
  onCardClick?: (app: JobApp) => void;
  /** Når satt: viser "Tren på intervju"-knapp på hvert kort som
   *  åpner Mock Interview pre-koblet til søknaden. */
  onPracticeInterview?: (app: JobApp) => void;
}

export const JobApplicationKanban: React.FC<Props> = ({ onAddNew, onCardClick, onPracticeInterview }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  const { data: applications = [], isLoading } = useQuery<JobApp[]>({
    queryKey: ['job-applications', user?.id],
    queryFn: async () => {
      const data = (await apiRequest('/api/job-applications', {
        headers: { 'x-user-id': user?.id || '' },
      })) as JobApp[];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id,
  });

  const { data: upcomingMilestones = [] } = useQuery<Milestone[]>({
    queryKey: ['job-milestones-upcoming', user?.id],
    queryFn: async () => {
      const data = (await apiRequest(
        '/api/job-application-milestones/upcoming?days=30',
        { headers: { 'x-user-id': user?.id || '' } },
      )) as { milestones: Milestone[] };
      return data.milestones ?? [];
    },
    enabled: !!user?.id,
  });

  const milestonesByApp = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    for (const m of upcomingMilestones) {
      const arr = map.get(m.applicationId) ?? [];
      arr.push(m);
      map.set(m.applicationId, arr);
    }
    return map;
  }, [upcomingMilestones]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      return await apiRequest(`/api/job-applications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-applications', user?.id] }),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const fromStatus = result.source.droppableId as Status;
    const toStatus = result.destination.droppableId as Status;
    if (fromStatus === toStatus) return;
    const appId = result.draggableId;
    updateStatusMutation.mutate({ id: appId, status: toStatus });
    trackGA4('nextrole_kanban_card_moved', {
      application_id: appId,
      from_status: fromStatus,
      to_status: toStatus,
    });
  };

  const grouped = useMemo(() => {
    const cols = new Map<Status, JobApp[]>();
    for (const col of COLUMNS) cols.set(col.id, []);
    for (const a of applications) {
      const list = cols.get(a.status) ?? cols.get('saved')!;
      list.push(a);
    }
    return cols;
  }, [applications]);

  const overdueCount = useMemo(
    () =>
      upcomingMilestones.filter(
        (m) => !m.completedAt && daysUntil(m.dueAt) < 0,
      ).length,
    [upcomingMilestones],
  );

  if (isLoading) {
    return (
      <Stack direction="row" spacing={2} sx={{ p: 2, overflowX: 'auto' }}>
        {COLUMNS.map((c) => (
          <Skeleton key={c.id} variant="rectangular" width={280} height={400} />
        ))}
      </Stack>
    );
  }

  return (
    <Box>
      {/* Topp-rad */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, px: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Mine søknader
          </Typography>
          <Chip
            label={`${applications.length} totalt`}
            size="small"
            variant="outlined"
          />
          {overdueCount > 0 && (
            <Chip
              icon={<WarningIcon sx={{ fontSize: 14 }} />}
              label={`${overdueCount} forfalt`}
              size="small"
              color="error"
            />
          )}
        </Stack>
        {onAddNew && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddNew}
            sx={{
              bgcolor: '#F5B82E',
              '&:hover': { bgcolor: '#D49B1A' },
              color: '#1F2937',
              fontWeight: 700,
            }}
          >
            Ny søknad
          </Button>
        )}
      </Stack>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            px: 1, pb: 2,
            overflowX: 'auto',
            alignItems: 'flex-start',
          }}
        >
          {COLUMNS.map((col) => {
            const cards = grouped.get(col.id) ?? [];
            return (
              <Box
                key={col.id}
                sx={{
                  minWidth: 280,
                  width: 280,
                  flexShrink: 0,
                }}
              >
                {/* Kolonne-header */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    px: 1.5, py: 1, mb: 1,
                    bgcolor: '#FAFAFA',
                    borderRadius: 1,
                    borderTop: `3px solid ${col.color}`,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: col.color, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {col.label}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Chip label={cards.length} size="small" sx={{ height: 18, fontSize: 11 }} />
                </Stack>

                <Droppable droppableId={col.id}>
                  {(provided, snap) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        minHeight: 200,
                        p: 0.5,
                        bgcolor: snap.isDraggingOver ? 'rgba(245, 184, 46, 0.06)' : 'transparent',
                        borderRadius: 1,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {cards.map((app, idx) => {
                        const ms = milestonesByApp.get(app.id) ?? [];
                        const nextMs = ms[0];
                        return (
                          <Draggable
                            key={app.id}
                            draggableId={app.id}
                            index={idx}
                          >
                            {(prov, dragSnap) => (
                              <Card
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                variant="outlined"
                                onClick={() => onCardClick?.(app)}
                                sx={{
                                  mb: 1.2,
                                  cursor: 'pointer',
                                  boxShadow: dragSnap.isDragging
                                    ? '0 8px 24px rgba(15,23,42,0.18)'
                                    : '0 1px 2px rgba(15,23,42,0.04)',
                                  transform: dragSnap.isDragging
                                    ? `${prov.draggableProps.style?.transform ?? ''} rotate(2deg)`
                                    : prov.draggableProps.style?.transform,
                                  borderLeft: `3px solid ${PRIORITY_COLOR[app.priority]}`,
                                  '&:hover': { boxShadow: '0 4px 12px rgba(15,23,42,0.10)' },
                                }}
                              >
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}
                                    noWrap
                                  >
                                    {app.jobTitle}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.7 }}>
                                    {app.company}
                                    {app.location && (
                                      <Box component="span" sx={{ ml: 0.5, color: 'text.disabled' }}>
                                        · {app.location}
                                      </Box>
                                    )}
                                  </Typography>

                                  {nextMs && (
                                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                                      <ScheduleIcon sx={{ fontSize: 14, color: deadlineColor(nextMs.dueAt) }} />
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: deadlineColor(nextMs.dueAt),
                                          fontWeight: 600,
                                          fontSize: 11,
                                        }}
                                      >
                                        {MILESTONE_LABEL[nextMs.kind]} · {formatDeadline(nextMs.dueAt)}
                                      </Typography>
                                    </Stack>
                                  )}

                                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                                    {app.source && (
                                      <Chip
                                        label={app.source}
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 18, fontSize: 10 }}
                                      />
                                    )}
                                    {app.priority === 'high' && (
                                      <Tooltip title="Høy prioritet">
                                        <FlagIcon sx={{ fontSize: 16, color: '#DC2626' }} />
                                      </Tooltip>
                                    )}
                                    {onPracticeInterview && (
                                      <Tooltip title="Tren på intervju for denne stillingen">
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onPracticeInterview(app);
                                          }}
                                          sx={{
                                            p: 0.4,
                                            ml: 'auto',
                                            bgcolor: '#FFF8E1',
                                            '&:hover': { bgcolor: '#F5B82E', color: '#fff' },
                                          }}
                                        >
                                          <PlayCircleIcon sx={{ fontSize: 16, color: '#7A5A0B' }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {app.jobUrl && (
                                      <Tooltip title="Åpne stillingsannonse">
                                        <IconButton
                                          size="small"
                                          href={app.jobUrl}
                                          target="_blank"
                                          rel="noopener"
                                          onClick={(e) => e.stopPropagation()}
                                          sx={{ p: 0, ml: onPracticeInterview ? 0 : 'auto' }}
                                        >
                                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Stack>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {cards.length === 0 && !snap.isDraggingOver && (
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: 'block', textAlign: 'center', mt: 4 }}
                        >
                          Ingen kort her
                        </Typography>
                      )}
                    </Box>
                  )}
                </Droppable>
              </Box>
            );
          })}
        </Stack>
      </DragDropContext>
    </Box>
  );
};

export default JobApplicationKanban;
