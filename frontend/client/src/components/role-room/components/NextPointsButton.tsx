/**
 * NextPointsButton — generisk «neste punkter med tall»-knapp + modal.
 * Brukes for Content Logic, kontotilgang m.fl. Tar ferdig-utledede punkter
 * (se utils/producerNextPoints.ts) så all data-logikk er testbar separat.
 */

import { useState, type ReactElement } from 'react';
import {
  Badge, Button, Dialog, DialogTitle, DialogContent, DialogActions, Box, Chip, Typography, Divider, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  HourglassEmpty as WaitingIcon,
  EditNote as ActionIcon,
  CheckCircle as DoneIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { NextPoint, NextPointTone } from '../utils/producerNextPoints';

const TONE_ICON: Record<NextPointTone, ReactElement> = {
  action: <ActionIcon sx={{ color: '#fbbf24' }} />,
  waiting: <WaitingIcon sx={{ color: '#60a5fa' }} />,
  done: <DoneIcon sx={{ color: '#34d399' }} />,
  info: <InfoIcon sx={{ color: '#a78bfa' }} />,
};

interface NextPointsButtonProps {
  buttonLabel: string;
  compactLabel?: string;
  dialogTitle: string;
  icon: ReactElement;
  openCount: number;
  points: NextPoint[];
  /** Valgfri primær-handling (f.eks. «Åpne Content Logic»). */
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function NextPointsButton({
  buttonLabel, compactLabel, dialogTitle, icon, openCount, points, actionLabel, onAction, compact = false,
}: NextPointsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Badge badgeContent={openCount} color="warning" overlap="rectangular" aria-label={`${openCount} åpne punkter`}>
        <Button
          size={compact ? 'small' : 'medium'}
          variant="outlined"
          startIcon={icon}
          onClick={() => setOpen(true)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {compact ? (compactLabel ?? buttonLabel) : buttonLabel}
        </Button>
      </Badge>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          {dialogTitle}
          <Chip size="small" color={openCount > 0 ? 'warning' : 'success'} label={openCount > 0 ? `${openCount} å gjøre` : 'I orden'} sx={{ ml: 'auto' }} />
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            {openCount > 0
              ? `${openCount} ${openCount === 1 ? 'punkt' : 'punkter'} krever oppfølging.`
              : 'Ingen åpne punkter akkurat nå.'}
          </Typography>
          <Divider />
          <List dense>
            {points.map((p) => (
              <ListItem key={p.key} disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>{TONE_ICON[p.tone]}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      {p.count != null && (
                        <Typography component="span" sx={{ fontWeight: 800, fontSize: 18, minWidth: 24 }}>{p.count}</Typography>
                      )}
                      <Typography component="span" variant="body2">{p.label}</Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Lukk</Button>
          {onAction && actionLabel && (
            <Button variant="contained" onClick={() => { setOpen(false); onAction(); }}>
              {actionLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default NextPointsButton;
