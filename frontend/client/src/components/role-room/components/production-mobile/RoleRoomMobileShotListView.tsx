// @ts-nocheck
/**
 * RoleRoomMobileShotListView — compact shot list for mobile + iPad.
 *
 * Covers backlog items 161 (shot-status chips), 162 (quick actions per
 * shot card), 164 (show only selected scene), 199 (log changes implicit
 * via updateShot). On-set use — producer/DP toggles shot status quickly.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Divider,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  HourglassTop as PlannedIcon,
  Star as SelectedIcon,
  ErrorOutline as MissingIcon,
} from '@mui/icons-material';

import { useShotListData } from '../production/useShotListData';
import IPadMasterDetailLayout from '../ipad/IPadMasterDetailLayout';
import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';

interface RoleRoomMobileShotListViewProps {
  projectId: string | null;
  mode: RoleRoomViewportMode;
}

type MobileShotStatus = 'planned' | 'shot' | 'selected' | 'missing';

const STATUS_META: Record<MobileShotStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  planned: { label: 'Planlagt', icon: <PlannedIcon fontSize="small" />, color: '#475569', bg: 'rgba(100,116,139,0.12)' },
  shot: { label: 'Tatt', icon: <CheckCircleIcon fontSize="small" />, color: '#047857', bg: 'rgba(16,185,129,0.16)' },
  selected: { label: 'Valgt', icon: <SelectedIcon fontSize="small" />, color: '#6d28d9', bg: 'rgba(124,58,237,0.16)' },
  missing: { label: 'Mangler', icon: <MissingIcon fontSize="small" />, color: '#b91c1c', bg: 'rgba(239,68,68,0.16)' },
};

function normalizeStatus(raw: string | undefined): MobileShotStatus {
  const value = (raw ?? '').toLowerCase();
  if (value.includes('select')) return 'selected';
  if (value.includes('complete') || value.includes('shot') || value.includes('taken')) return 'shot';
  if (value.includes('missing') || value.includes('miss')) return 'missing';
  return 'planned';
}

export const RoleRoomMobileShotListView: React.FC<RoleRoomMobileShotListViewProps> = ({
  projectId,
  mode,
}) => {
  const {
    summaries,
    summariesLoading,
    summariesError,
    openShotList,
    shotListLoading,
    openShotListById,
    closeShotList,
    updateShot,
  } = useShotListData(projectId ?? '');

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [sceneFilter, setSceneFilter] = useState<string | null>(null);

  const handleOpen = async (id: string) => {
    setSelectedListId(id);
    await openShotListById(id);
  };

  const handleClose = () => {
    setSelectedListId(null);
    closeShotList();
  };

  const shots = openShotList?.shots ?? [];
  const sceneIds = useMemo(
    () => Array.from(new Set(shots.map((s: any) => s.sceneId).filter(Boolean))),
    [shots],
  );
  const filteredShots = useMemo(
    () => (sceneFilter ? shots.filter((s: any) => s.sceneId === sceneFilter) : shots),
    [shots, sceneFilter],
  );

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å åpne shotlisten.
      </Alert>
    );
  }

  if (summariesLoading && summaries.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={80} />
        <Skeleton variant="rounded" height={80} />
      </Stack>
    );
  }

  if (summariesError) {
    return <Alert severity="error">{summariesError}</Alert>;
  }

  const isTabletMode = mode === 'tabletPortrait' || mode === 'tabletLandscape';

  const master = summaries.length === 0 ? (
    <Alert severity="info" variant="outlined">Ingen shotlister ennå.</Alert>
  ) : (
    <Stack spacing={1}>
      {summaries.map((summary) => {
        const selected = summary.id === selectedListId;
        return (
          <Box
            key={summary.id}
            role="button"
            tabIndex={0}
            onClick={() => handleOpen(summary.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void handleOpen(summary.id);
              }
            }}
            sx={{
              p: 1.5,
              borderRadius: 'var(--rr-card-radius, 12px)',
              border: '1px solid',
              borderColor: selected ? '#6366f1' : 'divider',
              bgcolor: 'background.paper',
              cursor: 'pointer',
            }}
          >
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {summary.sceneName || `Scene ${summary.sceneId}`}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} useFlexGap flexWrap="wrap">
              <Chip size="small" label={`${summary.totalShots ?? 0} shots`} variant="outlined" />
              {summary.completedShots !== undefined ? (
                <Chip
                  size="small"
                  label={`${summary.completedShots}/${summary.totalShots} tatt`}
                  sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#047857', fontWeight: 600 }}
                />
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );

  const detail = selectedListId ? (
    <ShotListDetail
      loading={shotListLoading}
      shots={filteredShots}
      sceneIds={sceneIds}
      sceneFilter={sceneFilter}
      onSceneFilter={setSceneFilter}
      onStatusChange={(shot, status) => {
        const raw =
          status === 'shot' ? 'completed' :
          status === 'selected' ? 'selected' :
          status === 'missing' ? 'missing' :
          'planned';
        updateShot({ ...shot, status: raw } as any);
      }}
    />
  ) : null;

  if (isTabletMode) {
    return (
      <IPadMasterDetailLayout
        mode={mode}
        enabled
        hasSelection={selectedListId !== null}
        onCloseDetail={handleClose}
        detailTitle={openShotList?.sceneName}
        master={master}
        detail={detail}
      />
    );
  }

  return (
    <>
      {master}
      {selectedListId ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'background.paper',
            zIndex: 1300,
            overflowY: 'auto',
            pt: 'calc(var(--rr-safe-top, 0px) + 12px)',
            px: 2,
            pb: 'calc(var(--rr-safe-bottom, 0px) + 12px)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              {openShotList?.sceneName ?? 'Shotliste'}
            </Typography>
            <Chip
              label="Lukk"
              onClick={handleClose}
              clickable
              sx={{ fontWeight: 600 }}
            />
          </Stack>
          {detail}
        </Box>
      ) : null}
    </>
  );
};

interface ShotListDetailProps {
  loading?: boolean;
  shots: any[];
  sceneIds: string[];
  sceneFilter: string | null;
  onSceneFilter: (id: string | null) => void;
  onStatusChange: (shot: any, status: MobileShotStatus) => void;
}

const ShotListDetail: React.FC<ShotListDetailProps> = ({
  loading,
  shots,
  sceneIds,
  sceneFilter,
  onSceneFilter,
  onStatusChange,
}) => {
  if (loading) {
    return (
      <Stack spacing={1} sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={60} />
        <Skeleton variant="rounded" height={60} />
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      {sceneIds.length > 1 ? (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            label="Alle scener"
            onClick={() => onSceneFilter(null)}
            color={sceneFilter === null ? 'primary' : 'default'}
            variant={sceneFilter === null ? 'filled' : 'outlined'}
          />
          {sceneIds.map((id) => (
            <Chip
              key={id}
              size="small"
              label={id}
              onClick={() => onSceneFilter(sceneFilter === id ? null : id)}
              color={sceneFilter === id ? 'primary' : 'default'}
              variant={sceneFilter === id ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      ) : null}

      {shots.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Ingen shots matcher filteret.</Typography>
      ) : (
        shots.map((shot, index) => (
          <React.Fragment key={shot.id}>
            <ShotCard shot={shot} onStatusChange={(status) => onStatusChange(shot, status)} />
            {index < shots.length - 1 ? <Divider flexItem /> : null}
          </React.Fragment>
        ))
      )}
    </Stack>
  );
};

interface ShotCardProps {
  shot: any;
  onStatusChange: (status: MobileShotStatus) => void;
}

const ShotCard: React.FC<ShotCardProps> = ({ shot, onStatusChange }) => {
  const current = normalizeStatus(shot.status);
  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {shot.shotType || 'Shot'}
            {shot.cameraAngle ? ` • ${shot.cameraAngle}` : ''}
          </Typography>
          {shot.description ? (
            <Typography variant="caption" color="text.secondary" sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {shot.description}
            </Typography>
          ) : null}
        </Box>
      </Stack>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={current}
        onChange={(_, value) => value && onStatusChange(value as MobileShotStatus)}
        sx={{ mt: 1 }}
      >
        {(['planned', 'shot', 'selected', 'missing'] as MobileShotStatus[]).map((status) => {
          const meta = STATUS_META[status];
          return (
            <ToggleButton
              key={status}
              value={status}
              sx={{
                minHeight: 'var(--rr-touch-target-min, 44px)',
                textTransform: 'none',
                color: meta.color,
                '&.Mui-selected': { bgcolor: meta.bg, color: meta.color, fontWeight: 700 },
              }}
            >
              {meta.icon}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
};

export default RoleRoomMobileShotListView;
