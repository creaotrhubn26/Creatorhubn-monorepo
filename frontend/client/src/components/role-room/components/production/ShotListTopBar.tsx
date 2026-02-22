/**
 * ShotListTopBar.tsx — Module A
 * ─────────────────────────────────────────────────────────────────────────────
 * Top App Bar: breadcrumb · title · Export · New Shot List
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Tooltip,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  FileDownload as ExportIcon,
  NavigateNext as SepIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  AssignmentInd as AssignIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';

import type { ConnectionStatus } from '../../hooks/useShotListRealTime';

export interface ShotListTopBarProps {
  projectName?: string;
  /** Number of currently selected shot lists (multi-select mode) */
  selectedCount: number;
  /** Realtime connection indicator, shown as a small dot in the bar. */
  connectionStatus?: ConnectionStatus;
  onNewShotList: () => void;
  onExportAll: () => void;
  /** Batch operations — only shown when selectedCount > 0 */
  onBatchDelete?: () => void;
  onBatchAssign?: () => void;
  onBatchExport?: () => void;
  /** Called when exactly one shot list is selected and user clicks the edit button. */
  onBatchEdit?: () => void;
  onClearSelection?: () => void;
  /** Opens the in-app walkthrough guide. */
  onGuide?: () => void;
}

export function ShotListTopBar({
  projectName,
  selectedCount,
  connectionStatus,
  onNewShotList,
  onExportAll,
  onBatchDelete,
  onBatchAssign,
  onBatchExport,
  onBatchEdit,
  onClearSelection,
  onGuide,
}: ShotListTopBarProps) {
  const isBatchMode = selectedCount > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 2, sm: 3 },
        py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        minHeight: 56,
        flexWrap: 'wrap',
      }}
    >
      {/* ── Left: breadcrumb OR batch mode banner ── */}
      {isBatchMode ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Chip
            label={`${selectedCount} selected`}
            size="small"
            onDelete={onClearSelection}
            sx={{ bgcolor: '#e91e6322', color: '#e91e63', border: '1px solid #e91e6344', fontWeight: 600 }}
          />
          <Tooltip title="Assign crew to selected">
            <IconButton size="small" onClick={onBatchAssign} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <AssignIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {selectedCount === 1 && (
            <Tooltip title="Edit selected shot list">
              <IconButton size="small" onClick={onBatchEdit} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <EditIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Export selected">
            <IconButton size="small" onClick={onBatchExport} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <ExportIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete selected">
            <IconButton size="small" onClick={onBatchDelete} sx={{ color: '#ef4444' }}>
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Breadcrumbs
            separator={<SepIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />}
            sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
          >
            <Link
              href="#"
              underline="hover"
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}
            >
              Projects
            </Link>
            {projectName && (
              <Link
                href="#"
                underline="hover"
                variant="caption"
                sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}
              >
                {projectName}
              </Link>
            )}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', fontWeight: 600 }}>
              Shot Lists
            </Typography>
          </Breadcrumbs>

          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, mt: 0.25 }}>
            Shot Lists
          </Typography>
        </Box>
      )}

      {/* ── Right: actions ── */}
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
        {/* Realtime connection dot */}
        {connectionStatus && connectionStatus !== 'offline' && (
          <Tooltip title={`Realtime: ${connectionStatus}`}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor:
                  connectionStatus === 'connected'
                    ? '#22c55e'
                    : connectionStatus === 'reconnecting'
                    ? '#f97316'
                    : '#6b7280',
              }}
            />
          </Tooltip>
        )}
        <Tooltip title="Export all shot lists as CSV">
          <IconButton
            onClick={onExportAll}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1 }}
          >
            <ExportIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="How it works — walkthrough guide">
          <IconButton
            onClick={onGuide}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1 }}
            aria-label="Open guide"
          >
            <HelpIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={onNewShotList}
          sx={{
            bgcolor: '#e91e63',
            '&:hover': { bgcolor: '#c2185b' },
            fontWeight: 600,
            fontSize: '0.78rem',
            textTransform: 'none',
            px: 2,
          }}
        >
          New Shot List
        </Button>
      </Box>
    </Box>
  );
}
