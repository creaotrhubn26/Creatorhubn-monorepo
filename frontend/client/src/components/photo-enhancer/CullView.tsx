import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Chip,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import type {
  CullFilter,
  SessionImage,
  SessionImageFlag,
  StarRating,
} from '../../lib/enhancer-session/types';
import { burstSiblings, filterVisibleImages } from '../../lib/enhancer-session/session-reducer';
import type { SessionState } from '../../lib/enhancer-session/types';
import { Filmstrip } from './Filmstrip';

export interface CullViewProps {
  open: boolean;
  onClose: () => void;
  state: SessionState;
  activeId: string | null;
  onSelect: (id: string) => void;
  onRating: (id: string, rating: StarRating) => void;
  onFlag: (id: string, flag: SessionImageFlag) => void;
  onApplyRatingToBurst: (burstId: string, rating: StarRating) => void;
  onApplyFlagToBurst: (burstId: string, flag: SessionImageFlag) => void;
  onFilterChange: (filter: CullFilter) => void;
}

const FILTERS: Array<{ key: CullFilter; label: string }> = [
  { key: 'all', label: 'Alle' },
  { key: 'picks', label: 'Picks' },
  { key: 'rejects', label: 'Rejects' },
  { key: 'unrated', label: 'Uvurdert' },
  { key: 'five_star', label: '★★★★★' },
  { key: 'in_burst', label: 'I burst' },
];

export function CullView(props: CullViewProps) {
  const {
    open,
    onClose,
    state,
    activeId,
    onSelect,
    onRating,
    onFlag,
    onApplyRatingToBurst,
    onApplyFlagToBurst,
    onFilterChange,
  } = props;

  const visible = useMemo(() => filterVisibleImages(state), [state]);
  const active = useMemo(() => visible.find((i) => i.id === activeId) ?? visible[0] ?? null, [visible, activeId]);
  const burstMembers = useMemo(
    () => (active ? burstSiblings(state, active.burstId) : []),
    [state, active],
  );

  const moveRelative = useCallback(
    (delta: number) => {
      if (!active) return;
      const idx = visible.findIndex((i) => i.id === active.id);
      if (idx < 0 || visible.length === 0) return;
      const next = visible[(idx + delta + visible.length) % visible.length];
      onSelect(next.id);
    },
    [visible, active, onSelect],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveRelative(-1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveRelative(1);
        return;
      }

      if (!active) return;

      if (event.key >= '0' && event.key <= '5') {
        event.preventDefault();
        const rating = Number(event.key) as StarRating;
        if (event.shiftKey && active.burstId) {
          onApplyRatingToBurst(active.burstId, rating);
        } else {
          onRating(active.id, rating);
        }
        return;
      }

      const lower = event.key.toLowerCase();
      if (lower === 'p') {
        event.preventDefault();
        if (event.shiftKey && active.burstId) onApplyFlagToBurst(active.burstId, 'pick');
        else onFlag(active.id, 'pick');
      } else if (lower === 'x') {
        event.preventDefault();
        if (event.shiftKey && active.burstId) onApplyFlagToBurst(active.burstId, 'reject');
        else onFlag(active.id, 'reject');
      } else if (lower === 'u') {
        event.preventDefault();
        if (event.shiftKey && active.burstId) onApplyFlagToBurst(active.burstId, 'none');
        else onFlag(active.id, 'none');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, active, moveRelative, onClose, onRating, onFlag, onApplyRatingToBurst, onApplyFlagToBurst]);

  if (!open) return null;

  return (
    <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: 'common.black', color: 'common.white' } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'grey.800' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Cull-modus
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                size="small"
                label={f.label}
                clickable
                color={state.cullFilter === f.key ? 'primary' : 'default'}
                variant={state.cullFilter === f.key ? 'filled' : 'outlined'}
                onClick={() => onFilterChange(f.key)}
                sx={{ color: 'common.white', borderColor: 'grey.600' }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="grey.400" sx={{ ml: 2 }}>
            {visible.length} av {state.images.length}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="grey.400">
            1-5 stjerner · P pick · X reject · U unflag · Shift+tast = hele burst · Esc lukker
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'common.white' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <IconButton
            onClick={() => moveRelative(-1)}
            sx={{ position: 'absolute', left: 8, color: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' }}
            disabled={visible.length < 2}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
          {active ? (
            <img
              src={active.enhancedUrl || active.previewUrl}
              alt={active.fileName}
              style={{ maxWidth: '96%', maxHeight: '96%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Typography color="grey.500">Ingen bilder i det aktive filteret.</Typography>
          )}
          <IconButton
            onClick={() => moveRelative(1)}
            sx={{ position: 'absolute', right: 8, color: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' }}
            disabled={visible.length < 2}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>

          {active && (
            <Box sx={{ position: 'absolute', top: 12, left: 12 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="grey.400">
                  {active.fileName}
                </Typography>
                {active.burstId && (
                  <Chip
                    size="small"
                    label={`Burst · ${burstMembers.findIndex((i) => i.id === active.id) + 1}/${burstMembers.length}`}
                    color="info"
                    variant="outlined"
                    sx={{ color: 'common.white', borderColor: 'info.main' }}
                  />
                )}
              </Stack>
            </Box>
          )}
        </Box>

        {active && (
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'grey.800' }}>
            <Stack direction="row" spacing={0.25}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = active.rating >= n;
                return (
                  <Tooltip key={n} title={`Sett rating til ${n}`}>
                    <IconButton
                      size="small"
                      onClick={() => onRating(active.id, n as StarRating)}
                      sx={{ color: on ? 'warning.light' : 'grey.600' }}
                    >
                      {on ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                );
              })}
              <Tooltip title="Nullstill rating">
                <IconButton size="small" onClick={() => onRating(active.id, 0)} sx={{ color: 'grey.600' }}>
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={0.5}>
              <Chip
                icon={<CheckIcon />}
                size="small"
                label="Pick (P)"
                clickable
                color={active.flag === 'pick' ? 'success' : 'default'}
                variant={active.flag === 'pick' ? 'filled' : 'outlined'}
                onClick={() => onFlag(active.id, active.flag === 'pick' ? 'none' : 'pick')}
                sx={{ color: 'common.white', borderColor: 'grey.600' }}
              />
              <Chip
                icon={<CloseIcon />}
                size="small"
                label="Reject (X)"
                clickable
                color={active.flag === 'reject' ? 'error' : 'default'}
                variant={active.flag === 'reject' ? 'filled' : 'outlined'}
                onClick={() => onFlag(active.id, active.flag === 'reject' ? 'none' : 'reject')}
                sx={{ color: 'common.white', borderColor: 'grey.600' }}
              />
            </Stack>

            {active.burstId && burstMembers.length > 1 && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="grey.400">
                  Hele burst:
                </Typography>
                <Chip
                  size="small"
                  label="Pick alle"
                  clickable
                  onClick={() => onApplyFlagToBurst(active.burstId!, 'pick')}
                  sx={{ color: 'common.white', borderColor: 'grey.600' }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label="Reject alle"
                  clickable
                  onClick={() => onApplyFlagToBurst(active.burstId!, 'reject')}
                  sx={{ color: 'common.white', borderColor: 'grey.600' }}
                  variant="outlined"
                />
              </Stack>
            )}
          </Stack>
        )}

        <Box sx={{ px: 1, pb: 1 }}>
          <Filmstrip
            images={visible}
            selectedId={active?.id ?? null}
            multiSelectIds={[]}
            onSelect={(id) => onSelect(id)}
          />
        </Box>
      </Box>
    </Dialog>
  );
}
