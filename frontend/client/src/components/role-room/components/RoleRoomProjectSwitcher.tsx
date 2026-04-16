// @ts-nocheck
/**
 * RoleRoomProjectSwitcher — project switcher with viewport-adaptive presentation.
 *
 *  - Phone  (item 029): fullscreen Dialog styled as a bottom sheet.
 *  - iPad   (item 030): Popover anchored to the topbar's project button.
 *
 * Accepts the same props in both modes; the parent decides whether to render
 * it at all and passes the correct mode via useRoleRoomViewportMode().
 */

import React, { useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  CloudDone as CloudDoneIcon,
} from '@mui/icons-material';

export interface SwitcherProject {
  id: string;
  name: string;
  creatorhub_project_id?: string | null;
}

interface RoleRoomProjectSwitcherProps {
  open: boolean;
  onClose: () => void;
  mode: 'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'desktop';
  anchorEl: HTMLElement | null;
  projects: SwitcherProject[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  /** Item 041: up to three most-recently-opened project IDs. */
  recentProjectIds?: string[];
}

export const RoleRoomProjectSwitcher: React.FC<RoleRoomProjectSwitcherProps> = ({
  open,
  onClose,
  mode,
  anchorEl,
  projects,
  selectedProjectId,
  onSelect,
  recentProjectIds,
}) => {
  const usePopover = mode === 'tabletPortrait' || mode === 'tabletLandscape';

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  const renderRow = (project: SwitcherProject) => {
    const selected = project.id === selectedProjectId;
    return (
      <ListItemButton
        key={project.id}
        selected={selected}
        onClick={() => handleSelect(project.id)}
        role="option"
        aria-selected={selected}
        sx={{
          minHeight: 'var(--rr-touch-target-min, 44px)',
          px: 2,
        }}
      >
        <ListItemText
          primary={project.name}
          primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
          secondary={project.creatorhub_project_id ? 'Synket med Creatorhub' : undefined}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          {project.creatorhub_project_id ? (
            <CloudDoneIcon fontSize="small" sx={{ color: '#16a34a' }} />
          ) : null}
          {selected ? <CheckIcon fontSize="small" color="primary" /> : null}
        </Stack>
      </ListItemButton>
    );
  };

  const { recent, remaining } = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    const recentOrdered = (recentProjectIds ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is SwitcherProject => Boolean(p))
      .slice(0, 3);
    const recentSet = new Set(recentOrdered.map((p) => p.id));
    return {
      recent: recentOrdered,
      remaining: projects.filter((p) => !recentSet.has(p.id)),
    };
  }, [projects, recentProjectIds]);

  const list = (
    <List role="listbox" aria-label="Velg prosjekt" disablePadding>
      {recent.length > 0 ? (
        <>
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography variant="overline" color="text.secondary">
              Sist brukt
            </Typography>
          </Box>
          {recent.map(renderRow)}
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography variant="overline" color="text.secondary">
              Alle prosjekter
            </Typography>
          </Box>
        </>
      ) : null}
      {remaining.map(renderRow)}
      {projects.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Ingen prosjekter ennå
          </Typography>
        </Box>
      ) : null}
    </List>
  );

  if (usePopover) {
    return (
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              width: 'min(420px, 90vw)',
              maxHeight: 'min(70vh, 560px)',
              borderRadius: 2,
            },
          },
        }}
      >
        {list}
      </Popover>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby="rr-project-switcher-title"
      PaperProps={{
        className: 'rr-mobile-sheet',
        sx: {
          margin: 0,
          borderTopLeftRadius: 'var(--rr-bottom-sheet-radius, 16px)',
          borderTopRightRadius: 'var(--rr-bottom-sheet-radius, 16px)',
        },
      }}
    >
      <DialogTitle
        id="rr-project-switcher-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 'calc(var(--rr-safe-top, 0px) + 12px)',
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          Velg prosjekt
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Lukk prosjektvelger"
          sx={{
            width: 'var(--rr-touch-target-min, 44px)',
            height: 'var(--rr-touch-target-min, 44px)',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent
        dividers={false}
        sx={{ p: 0, pb: 'var(--rr-safe-bottom, 0px)' }}
      >
        {list}
      </DialogContent>
    </Dialog>
  );
};

export default RoleRoomProjectSwitcher;
