/**
 * ShotListCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Part C of the Shot List UI architecture.
 *
 * Layout:
 *   ┌─── HEADER ──────────────────────────────────────────────────────────────┐
 *   │  [checkbox]  INT/EXT  SCENE TITLE        [colorTag]  [⋮ menu]           │
 *   │              DAY/NIGHT  │  Location                                      │
 *   ├─── BODY ────────────────────────────────────────────────────────────────┤
 *   │  Scene heading / notes  (1-2 lines)                                     │
 *   │  [page length] [estimated time]                                         │
 *   ├─── FOOTER ──────────────────────────────────────────────────────────────┤
 *   │  [progress bar]  5/12  "3 unassigned"  2.5h  [assignee chips]  [badge] │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * DnD: card is a droppable target for Person-drag (assign crew to list).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Avatar,
  AvatarGroup,
  IconButton,
  Checkbox,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  useTheme,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  WbSunny as DayIcon,
  NightsStay as NightIcon,
  Home as IntIcon,
  Landscape as ExtIcon,
  AccessTime as TimeIcon,
  PersonOff as UnassignedIcon,
  HourglassEmpty as WaitingIcon,
  Autorenew as InProgressIcon,
  CheckCircle as CompletedIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  FileDownload as ExportIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useDroppable } from '@dnd-kit/core';
import type { ShotListSummary, TopAssignee } from '../../models/derivedState';

// ─── COLOR TAGS ───────────────────────────────────────────────────────────────

const COLOR_TAG_MAP: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  gray: '#6b7280',
};

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({ pct }: { pct: number }) {
  const { color, label, icon } =
    pct === 100
      ? { color: '#22c55e', label: 'Fullført', icon: <CompletedIcon sx={{ fontSize: 12 }} /> }
      : pct > 0
        ? { color: '#f97316', label: 'Pågår', icon: <InProgressIcon sx={{ fontSize: 12 }} /> }
        : { color: '#6b7280', label: 'Venter', icon: <WaitingIcon sx={{ fontSize: 12 }} /> };

  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        bgcolor: color + '22',
        color,
        border: `1px solid ${color}44`,
        fontWeight: 600,
        fontSize: '0.65rem',
        height: 20,
        px: 0.25,
        '& .MuiChip-icon': {
          color,
          ml: '4px',
          mr: '-2px',
        },
      }}
    />
  );
}

// ─── INT/EXT BADGE ────────────────────────────────────────────────────────────

function IntExtBadge({ value }: { value?: 'INT' | 'EXT' | 'INT/EXT' }) {
  if (!value) return null;
  const isInt = value.startsWith('INT');
  const isExt = value.endsWith('EXT');
  return (
    <Chip
      size="small"
      icon={isInt && !isExt ? <IntIcon sx={{ fontSize: 12 }} /> : <ExtIcon sx={{ fontSize: 12 }} />}
      label={value}
      sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.08)', px: 0 }}
    />
  );
}

// ─── ASSIGNEE AVATARS ─────────────────────────────────────────────────────────

function AssigneeAvatars({ assignees }: { assignees: TopAssignee[] }) {
  if (assignees.length === 0) return null;
  return (
    <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.6rem' } }}>
      {assignees.map((a) => (
        <Tooltip key={a.personId} title={a.name ?? a.personId}>
          <Avatar sx={{ bgcolor: '#e91e63', width: 22, height: 22 }}>
            {(a.name ?? a.personId).charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShotListCardProps {
  summary: ShotListSummary;
  /** Whether this card is selected (multi-select mode) */
  selected?: boolean;
  /** Whether any card is currently selected (shows checkboxes on all) */
  selectionActive?: boolean;
  /** Called when the card body is clicked (open detail view) */
  onOpen: (shotListId: string) => void;
  onSelect: (shotListId: string, value: boolean) => void;
  onEdit: (shotListId: string) => void;
  onDuplicate: (shotListId: string) => void;
  onDelete: (shotListId: string) => void;
  onExport: (shotListId: string) => void;
  /** @dnd-kit drag handle — pass through from SortableContext if in sort mode */
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

// ─── ShotListCard ─────────────────────────────────────────────────────────────

export function ShotListCard({
  summary,
  selected = false,
  selectionActive = false,
  onOpen,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  dragHandleProps,
  isDragging = false,
}: ShotListCardProps) {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // ── DnD: this card is a drop target for Person drags ─────────────────────
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `shotlist-${summary.shotListId}`,
    data: { type: 'shotList', shotListId: summary.shotListId },
  });

  const openMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }, []);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  const sm = summary;
  const scene = sm.sceneMeta;
  const hasUnassigned = sm.unassignedShots > 0;

  // ── Derived visual values ─────────────────────────────────────────────────
  const progressColor = sm.completionPct === 100 ? '#22c55e' : sm.completionPct >= 50 ? '#f97316' : '#3b82f6';
  const timeLabel = sm.estimatedHours > 0
    ? sm.estimatedHours >= 1
      ? `${sm.estimatedHours}h`
      : `${sm.estimatedMinutes}m`
    : null;

  return (
    <Card
      ref={setDropRef}
      elevation={isDragging ? 8 : isOver ? 4 : 1}
      sx={{
        position: 'relative',
        bgcolor: isDragging
          ? 'rgba(233,30,99,0.12)'
          : isOver
          ? 'rgba(233,30,99,0.08)'
          : 'rgba(255,255,255,0.04)',
        border: selected
          ? '2px solid #e91e63'
          : isOver
          ? '2px solid rgba(233,30,99,0.4)'
          : `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
        '&:hover': {
          border: selected ? '2px solid #e91e63' : `1px solid ${theme.palette.action.selected}`,
          bgcolor: 'rgba(255,255,255,0.06)',
        },
        opacity: isDragging ? 0.6 : 1,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* ── Drag handle (shown on hover) */}
      {dragHandleProps && (
        <Box
          {...dragHandleProps}
          sx={{
            position: 'absolute',
            top: 8,
            left: 4,
            color: 'rgba(255,255,255,0.3)',
            cursor: 'grab',
            '&:hover': { color: 'rgba(255,255,255,0.7)' },
            '&:active': { cursor: 'grabbing' },
            zIndex: 2,
          }}
        >
          <DragIcon sx={{ fontSize: 16 }} />
        </Box>
      )}

      {/* ── Selection checkbox */}
      <Box
        sx={{
          position: 'absolute',
          top: 6,
          left: dragHandleProps ? 24 : 6,
          zIndex: 2,
          opacity: selectionActive || selected ? 1 : 0,
          transition: 'opacity 0.15s',
          '.MuiCard-root:hover &': { opacity: 1 },
        }}
      >
        <Checkbox
          size="small"
          checked={selected}
          onChange={(e) => onSelect(sm.shotListId, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          sx={{ p: 0.25, color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: '#e91e63' } }}
        />
      </Box>

      <CardActionArea
        onClick={() => onOpen(sm.shotListId)}
        sx={{ borderRadius: 2, p: 0 }}
      >
        <CardContent sx={{ p: 2, pb: '12px !important', pl: selectionActive ? 4 : 2 }}>

          {/* ══ HEADER ══════════════════════════════════════════════════════ */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
            {/* INT/EXT + scene title */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <IntExtBadge value={scene?.intExt} />
                {scene?.timeOfDay && (
                  <Chip
                    size="small"
                    icon={
                      scene.timeOfDay === 'NIGHT' || scene.timeOfDay === 'DUSK'
                        ? <NightIcon sx={{ fontSize: 11 }} />
                        : <DayIcon sx={{ fontSize: 11 }} />
                    }
                    label={scene.timeOfDay}
                    sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.06)', px: 0 }}
                  />
                )}
                {scene?.sceneNumber && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.65rem' }}>
                    Sc. {scene.sceneNumber}
                  </Typography>
                )}
              </Box>

              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: 'rgba(255,255,255,0.92)',
                  mt: 0.25,
                  lineHeight: 1.3,
                }}
              >
                {sm.sceneName ?? scene?.locationName ?? sm.shotListId}
              </Typography>

              {scene?.locationName && sm.sceneName && (
                <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
                  {scene.locationName}
                </Typography>
              )}
            </Box>

            {/* Color tag dot — rendered from COLOR_TAG_MAP when a tag is set */}
            {sm.colorTag && COLOR_TAG_MAP[sm.colorTag] && (
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: COLOR_TAG_MAP[sm.colorTag],
                  flexShrink: 0,
                  alignSelf: 'center',
                  boxShadow: `0 0 6px ${COLOR_TAG_MAP[sm.colorTag]}88`,
                }}
              />
            )}

            {/* Context menu */}
            <IconButton
              size="small"
              onClick={openMenu}
              sx={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, '&:hover': { color: 'rgba(255,255,255,0.87)' } }}
              aria-label="Shot list options"
            >
              <MoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* ══ BODY ════════════════════════════════════════════════════════ */}
          {scene?.heading && (
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                mb: 1,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {scene.heading}
            </Typography>
          )}

          {/* Page length + time row */}
          {(scene?.pageLength != null || timeLabel) && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              {scene?.pageLength != null && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>
                  {scene.pageLength}p
                </Typography>
              )}
              {timeLabel && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <TimeIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>
                    {timeLabel}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* ══ PROGRESS BAR ════════════════════════════════════════════════ */}
          <LinearProgress
            variant="determinate"
            value={sm.completionPct}
            sx={{
              height: 3,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.08)',
              mb: 1.25,
              '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 2 },
            }}
          />

          {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {/* Shot counts */}
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)' }}
            >
              {sm.completedShots}/{sm.totalShots}
            </Typography>

            {/* Unassigned warning */}
            {hasUnassigned && (
              <Tooltip title={`${sm.unassignedShots} unassigned shot${sm.unassignedShots > 1 ? 's' : ''}`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <UnassignedIcon sx={{ fontSize: 12, color: '#f97316' }} />
                  <Typography variant="caption" sx={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 600 }}>
                    {sm.unassignedShots}
                  </Typography>
                </Box>
              </Tooltip>
            )}

            {/* Status badge */}
            <StatusBadge pct={sm.completionPct} />

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Assignee avatars */}
            <AssigneeAvatars assignees={sm.topAssignees} />
          </Box>

          {/* Drop-target overlay */}
          {isOver && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: 2,
                border: '2px dashed #e91e63',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(233,30,99,0.06)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: '#e91e63', fontWeight: 600 }}>
                Drop to assign
              </Typography>
            </Box>
          )}

        </CardContent>
      </CardActionArea>

      {/* ── Context menu ──────────────────────────────────────────────────── */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        PaperProps={{ sx: { bgcolor: '#1e1e2e', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.1)' } }}
      >
        <MenuItem onClick={() => { onEdit(sm.shotListId); closeMenu(); }} dense>
          <EditIcon sx={{ fontSize: 16, mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(sm.shotListId); closeMenu(); }} dense>
          <DuplicateIcon sx={{ fontSize: 16, mr: 1 }} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => { onExport(sm.shotListId); closeMenu(); }} dense>
          <ExportIcon sx={{ fontSize: 16, mr: 1 }} /> Export CSV
        </MenuItem>
        <Divider sx={{ my: 0.25, borderColor: 'rgba(255,255,255,0.08)' }} />
        <MenuItem
          onClick={() => { onDelete(sm.shotListId); closeMenu(); }}
          dense
          sx={{ color: '#ef4444' }}
        >
          <DeleteIcon sx={{ fontSize: 16, mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Card>
  );
}
