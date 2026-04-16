// @ts-nocheck
/**
 * MobilePlannerCreateSheet — two-step "Opprett" sheet.
 *
 * Covers backlog items:
 *  - 077: only one primary CTA ("Opprett") opens this sheet
 *  - 078: four type choices (møte, milepæl, oppgave, levering)
 *
 * Step 1: type chooser. Step 2: minimal form with title + phase + due date.
 * No advanced fields — the desktop has the rich creator.
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  EventAvailable as MilestoneIcon,
  EventNote as MeetingIcon,
  LocalShipping as DeliveryIcon,
  TaskAlt as TaskIcon,
} from '@mui/icons-material';

import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';
import type {
  CreateProducerTimelineItemInput,
  ProducerPhase,
} from '../../services/producerWorkflowService';

export type PlannerCreateType = 'meeting' | 'milestone' | 'task' | 'delivery';

interface MobilePlannerCreateSheetProps {
  open: boolean;
  onClose: () => void;
  mode: RoleRoomViewportMode;
  anchorEl?: HTMLElement | null;
  onCreate: (payload: CreateProducerTimelineItemInput) => Promise<void>;
}

const TYPE_CHOICES: {
  value: PlannerCreateType;
  label: string;
  icon: React.ReactNode;
  metadata: Record<string, unknown>;
}[] = [
  { value: 'meeting', label: 'Møte', icon: <MeetingIcon />, metadata: { entryType: 'meeting' } },
  { value: 'milestone', label: 'Milepæl', icon: <MilestoneIcon />, metadata: { entryType: 'milestone' } },
  { value: 'task', label: 'Oppgave', icon: <TaskIcon />, metadata: { entryType: 'task' } },
  { value: 'delivery', label: 'Levering', icon: <DeliveryIcon />, metadata: { entryType: 'delivery' } },
];

export const MobilePlannerCreateSheet: React.FC<MobilePlannerCreateSheetProps> = ({
  open,
  onClose,
  mode,
  anchorEl,
  onCreate,
}) => {
  const usePopover = mode === 'tabletPortrait' || mode === 'tabletLandscape';
  const [selectedType, setSelectedType] = useState<PlannerCreateType | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<ProducerPhase>('preproduction');
  const [dueAt, setDueAt] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const resetAndClose = () => {
    setSelectedType(null);
    setTitle('');
    setPhase('preproduction');
    setDueAt('');
    setPending(false);
    setLocalError(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!selectedType || !title.trim()) return;
    setPending(true);
    setLocalError(null);
    try {
      const typeChoice = TYPE_CHOICES.find((t) => t.value === selectedType)!;
      await onCreate({
        phase,
        title: title.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        status: 'planned',
        metadata: typeChoice.metadata,
      });
      resetAndClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Kunne ikke opprette');
    } finally {
      setPending(false);
    }
  };

  const typeStep = (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Hva vil du legge til?
      </Typography>
      <ToggleButtonGroup
        exclusive
        orientation="vertical"
        fullWidth
        value={selectedType}
        onChange={(_, value: PlannerCreateType | null) => setSelectedType(value)}
      >
        {TYPE_CHOICES.map((choice) => (
          <ToggleButton
            key={choice.value}
            value={choice.value}
            sx={{
              minHeight: 'var(--rr-touch-target-min, 44px)',
              justifyContent: 'flex-start',
              textTransform: 'none',
              gap: 1.5,
            }}
          >
            {choice.icon}
            <Typography variant="body1" fontWeight={600}>{choice.label}</Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );

  const formStep = (
    <Stack spacing={2} sx={{ p: 2 }}>
      <TextField
        label="Tittel"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        fullWidth
        required
        autoFocus
      />
      <TextField
        label="Fase"
        value={phase}
        onChange={(event) => setPhase(event.target.value as ProducerPhase)}
        select
        fullWidth
      >
        <MenuItem value="preproduction">Pre-production</MenuItem>
        <MenuItem value="production">Production</MenuItem>
        <MenuItem value="postproduction">Post-production</MenuItem>
      </TextField>
      <TextField
        label="Frist"
        type="datetime-local"
        value={dueAt}
        onChange={(event) => setDueAt(event.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
      {localError ? <Alert severity="error">{localError}</Alert> : null}
    </Stack>
  );

  const header = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{
        px: 2,
        pt: usePopover ? 2 : 'calc(var(--rr-safe-top, 0px) + 12px)',
        pb: 1,
      }}
    >
      <Typography variant="h6" fontWeight={700}>
        {selectedType ? 'Nytt ' + TYPE_CHOICES.find((t) => t.value === selectedType)!.label.toLowerCase() : 'Opprett'}
      </Typography>
      <IconButton
        onClick={resetAndClose}
        aria-label="Lukk"
        sx={{ width: 'var(--rr-touch-target-min, 44px)', height: 'var(--rr-touch-target-min, 44px)' }}
      >
        <CloseIcon />
      </IconButton>
    </Stack>
  );

  const footer = selectedType ? (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        px: 2,
        py: 1.5,
        pb: 'calc(var(--rr-safe-bottom, 0px) + 8px)',
        display: 'flex',
        gap: 1,
      }}
    >
      <Button onClick={() => setSelectedType(null)} disabled={pending}>
        Tilbake
      </Button>
      <Box sx={{ flex: 1 }} />
      <Button
        variant="contained"
        onClick={handleCreate}
        disabled={!title.trim() || pending}
        sx={{ minHeight: 'var(--rr-touch-target-min, 44px)', fontWeight: 700 }}
      >
        {pending ? <CircularProgress size={20} color="inherit" /> : 'Opprett'}
      </Button>
    </Box>
  ) : null;

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {header}
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>{selectedType ? formStep : typeStep}</Box>
      {footer}
    </Box>
  );

  if (usePopover) {
    return (
      <Popover
        open={open}
        anchorEl={anchorEl ?? null}
        onClose={resetAndClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 'min(380px, 92vw)', borderRadius: 2 } } }}
      >
        {content}
      </Popover>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      fullScreen
      aria-labelledby="rr-planner-create-title"
      PaperProps={{
        className: 'rr-mobile-sheet',
        sx: {
          margin: 0,
          borderTopLeftRadius: 'var(--rr-bottom-sheet-radius, 16px)',
          borderTopRightRadius: 'var(--rr-bottom-sheet-radius, 16px)',
        },
      }}
    >
      <DialogTitle id="rr-planner-create-title" sx={{ p: 0 }}>
        <span className="sr-only">Opprett</span>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>{content}</DialogContent>
    </Dialog>
  );
};

export default MobilePlannerCreateSheet;
