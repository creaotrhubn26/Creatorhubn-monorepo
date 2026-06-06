/**
 * NextClientPointsButton — knapp + modal som viser «Neste klientpunkter» med
 * TALL på hva som må gjøres i klient-godkjenningsflyten. Tallene kommer fra
 * prosjektets producerWorkflowMeta (ekte review-status), ikke gjetting.
 */

import { useState } from 'react';
import {
  Badge, Button, Dialog, DialogTitle, DialogContent, DialogActions, Box, Chip, Typography, Divider, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Groups as ClientIcon,
  HourglassEmpty as WaitingIcon,
  EditNote as ActionIcon,
  CheckCircle as DoneIcon,
  SendOutlined as SendIcon,
} from '@mui/icons-material';
import type { ProducerWorkflowProjectMeta, ProducerWorkflowProjectStatus } from '../models/casting';

export type ClientPointTone = 'action' | 'waiting' | 'done' | 'info';

export interface ClientNextPoint {
  key: string;
  count: number | null; // null = ikke et tall (f.eks. "ingenting sendt ennå")
  label: string;
  tone: ClientPointTone;
}

export interface ClientNextPointsResult {
  /** Antall åpne punkter som krever oppfølging (badge-tall). */
  openCount: number;
  status: ProducerWorkflowProjectStatus;
  points: ClientNextPoint[];
}

const STATUS_LABEL: Record<ProducerWorkflowProjectStatus, string> = {
  planning: 'Planlegging',
  awaiting_client: 'Venter på klient',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
};

/**
 * Utleder «neste klientpunkter» fra review-metaen. Ren funksjon — testbar.
 * openCount = ting som faktisk krever handling/oppfølging (endringsønsker +
 * ting som venter på klient + «ingenting sendt ennå»).
 */
export function deriveClientNextPoints(
  meta: ProducerWorkflowProjectMeta | null | undefined,
  status: ProducerWorkflowProjectStatus | null | undefined,
  clientInputBeforeHandoff = 0,
): ClientNextPointsResult {
  const m: ProducerWorkflowProjectMeta = {
    totalReviews: 0, pendingReviews: 0, approvedReviews: 0, rejectedReviews: 0,
    changesRequestedReviews: 0, budgetReviewCount: 0, agreementReviewCount: 0, deliverableReviewCount: 0,
    ...(meta ?? {}),
  };
  const resolvedStatus: ProducerWorkflowProjectStatus = status ?? 'planning';
  const points: ClientNextPoint[] = [];

  if (clientInputBeforeHandoff > 0) {
    points.push({ key: 'handoff-input', count: clientInputBeforeHandoff, label: 'klientinnspill mangler før handoff (brief/materiale)', tone: 'action' });
  }
  if (m.changesRequestedReviews > 0) {
    points.push({ key: 'changes', count: m.changesRequestedReviews, label: 'endringsønsker fra klient å følge opp', tone: 'action' });
  }
  if (m.pendingReviews > 0) {
    points.push({ key: 'pending', count: m.pendingReviews, label: 'venter på svar fra klient', tone: 'waiting' });
  }
  if (m.totalReviews === 0) {
    points.push({ key: 'nothing-sent', count: null, label: 'Ingenting er sendt til klient ennå — send budsjett eller leveranse til godkjenning', tone: 'action' });
  }
  if (m.approvedReviews > 0) {
    points.push({ key: 'approved', count: m.approvedReviews, label: 'godkjent av klient', tone: 'done' });
  }
  if (points.length === 0) {
    points.push({ key: 'clear', count: null, label: 'Alt er i orden — ingen åpne klientpunkter', tone: 'done' });
  }

  const openCount = m.changesRequestedReviews + m.pendingReviews + clientInputBeforeHandoff + (m.totalReviews === 0 ? 1 : 0);
  return { openCount, status: resolvedStatus, points };
}

const TONE_ICON: Record<ClientPointTone, React.ReactElement> = {
  action: <ActionIcon sx={{ color: '#fbbf24' }} />,
  waiting: <WaitingIcon sx={{ color: '#60a5fa' }} />,
  done: <DoneIcon sx={{ color: '#34d399' }} />,
  info: <ClientIcon sx={{ color: '#a78bfa' }} />,
};

interface NextClientPointsButtonProps {
  meta?: ProducerWorkflowProjectMeta | null;
  status?: ProducerWorkflowProjectStatus | null;
  /** Antall klientinnspill som mangler før handoff (manifest.pendingClientMoments). */
  clientInputBeforeHandoff?: number;
  /** Naviger til godkjenning-/reviews-flaten. */
  onGoToReviews?: () => void;
  compact?: boolean;
}

export function NextClientPointsButton({ meta, status, clientInputBeforeHandoff = 0, onGoToReviews, compact = false }: NextClientPointsButtonProps) {
  const [open, setOpen] = useState(false);
  const { openCount, status: resolvedStatus, points } = deriveClientNextPoints(meta, status, clientInputBeforeHandoff);

  return (
    <>
      <Badge badgeContent={openCount} color="warning" overlap="rectangular" aria-label={`${openCount} åpne klientpunkter`}>
        <Button
          size={compact ? 'small' : 'medium'}
          variant="outlined"
          startIcon={<ClientIcon sx={{ fontSize: compact ? 16 : 20 }} />}
          onClick={() => setOpen(true)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {compact ? 'Klientpunkter' : 'Neste klientpunkter'}
        </Button>
      </Badge>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ClientIcon sx={{ color: '#a78bfa' }} />
          Neste klientpunkter
          <Chip size="small" label={STATUS_LABEL[resolvedStatus]} sx={{ ml: 'auto' }} />
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            {openCount > 0
              ? `${openCount} ${openCount === 1 ? 'punkt' : 'punkter'} krever oppfølging i klient-flyten.`
              : 'Ingen åpne punkter i klient-flyten akkurat nå.'}
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
          {onGoToReviews && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => { setOpen(false); onGoToReviews(); }}
            >
              Gå til godkjenning
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default NextClientPointsButton;
