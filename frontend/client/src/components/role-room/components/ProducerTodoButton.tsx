/**
 * ProducerTodoButton — ÉN samlet «Å gjøre»-knapp + modal som erstatter de
 * separate «neste punkter»-knappene. Aggregerer alle kilder (klient, Content
 * Logic, kontotilgang, …) til grupperte, kollapsbare seksjoner med ett
 * total-badge. Ferdige seksjoner vises kollapset nederst. Skalerer til nye
 * domener uten å legge til flere knapper i headeren.
 */

import { useState, type ReactElement } from 'react';
import {
  Badge, Button, Dialog, DialogTitle, DialogContent, DialogActions, Box, Chip, Typography, Divider, List, ListItem, ListItemIcon, ListItemText, Collapse, IconButton,
} from '@mui/material';
import {
  ChecklistRtl as TodoIcon,
  Groups as ClientIcon,
  Lightbulb as ContentLogicIcon,
  VpnKey as AccessIcon,
  HourglassEmpty as WaitingIcon,
  EditNote as ActionIcon,
  CheckCircle as DoneIcon,
  InfoOutlined as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { ProducerWorkflowProjectMeta, ProducerWorkflowProjectStatus } from '../models/casting';
import { deriveClientNextPoints } from './NextClientPointsButton';
import {
  deriveContentLogicPoints, deriveAccessPoints,
  type ContentLogicInput, type AccountAccessInput, type NextPoint, type NextPointTone,
} from '../utils/producerNextPoints';

const TONE_ICON: Record<NextPointTone, ReactElement> = {
  action: <ActionIcon sx={{ color: '#fbbf24' }} />,
  waiting: <WaitingIcon sx={{ color: '#60a5fa' }} />,
  done: <DoneIcon sx={{ color: '#34d399' }} />,
  info: <InfoIcon sx={{ color: '#a78bfa' }} />,
};

interface ProducerTodoButtonProps {
  meta?: ProducerWorkflowProjectMeta | null;
  status?: ProducerWorkflowProjectStatus | null;
  clientInputBeforeHandoff?: number;
  contentLogic?: ContentLogicInput | null;
  access?: AccountAccessInput | null;
  onGoToReviews?: () => void;
  compact?: boolean;
}

interface TodoSection {
  key: string;
  title: string;
  icon: ReactElement;
  openCount: number;
  points: NextPoint[];
}

export function ProducerTodoButton({
  meta, status, clientInputBeforeHandoff = 0, contentLogic, access, onGoToReviews, compact = false,
}: ProducerTodoButtonProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const client = deriveClientNextPoints(meta, status, clientInputBeforeHandoff);
  const cl = deriveContentLogicPoints(contentLogic);
  const ac = deriveAccessPoints(access);

  const sections: TodoSection[] = [
    { key: 'client', title: 'Klient', icon: <ClientIcon sx={{ color: '#a78bfa' }} />, openCount: client.openCount, points: client.points },
    { key: 'content-logic', title: 'Content Logic', icon: <ContentLogicIcon sx={{ color: '#a78bfa' }} />, openCount: cl.openCount, points: cl.points },
    { key: 'access', title: 'Kontotilgang', icon: <AccessIcon sx={{ color: '#a78bfa' }} />, openCount: ac.openCount, points: ac.points },
  ];

  const totalOpen = sections.reduce((sum, s) => sum + s.openCount, 0);
  const openSections = sections.filter((s) => s.openCount > 0);
  const doneSections = sections.filter((s) => s.openCount === 0);

  const isExpanded = (s: TodoSection): boolean => expanded[s.key] ?? s.openCount > 0;
  const toggle = (key: string, fallback: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? fallback) }));

  const renderSection = (s: TodoSection) => {
    const exp = isExpanded(s);
    return (
      <Box key={s.key} sx={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <Box
          onClick={() => toggle(s.key, s.openCount > 0)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, cursor: 'pointer' }}
        >
          {s.icon}
          <Typography sx={{ fontWeight: 600 }}>{s.title}</Typography>
          <Chip
            size="small"
            color={s.openCount > 0 ? 'warning' : 'success'}
            label={s.openCount > 0 ? `${s.openCount} å gjøre` : 'i orden'}
            sx={{ ml: 0.5 }}
          />
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" aria-label={exp ? 'Skjul' : 'Vis'}>
            {exp ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={exp}>
          <List dense sx={{ pl: 1 }}>
            {s.points.map((p) => (
              <ListItem key={`${s.key}-${p.key}`} disableGutters>
                <ListItemIcon sx={{ minWidth: 34 }}>{TONE_ICON[p.tone]}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      {p.count != null && (
                        <Typography component="span" sx={{ fontWeight: 800, fontSize: 17, minWidth: 22 }}>{p.count}</Typography>
                      )}
                      <Typography component="span" variant="body2">{p.label}</Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </Box>
    );
  };

  return (
    <>
      <Badge badgeContent={totalOpen} color="warning" overlap="rectangular" aria-label={`${totalOpen} ting å gjøre`}>
        <Button
          size={compact ? 'small' : 'medium'}
          variant="outlined"
          startIcon={<TodoIcon sx={{ fontSize: compact ? 16 : 20 }} />}
          onClick={() => setOpen(true)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Å gjøre
        </Button>
      </Badge>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TodoIcon sx={{ color: '#a78bfa' }} />
          Å gjøre
          <Chip size="small" color={totalOpen > 0 ? 'warning' : 'success'} label={totalOpen > 0 ? `${totalOpen} totalt` : 'Alt i orden'} sx={{ ml: 'auto' }} />
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            {totalOpen > 0
              ? `${totalOpen} ${totalOpen === 1 ? 'ting' : 'ting'} krever oppfølging — gruppert nedenfor.`
              : 'Ingenting krever oppfølging akkurat nå.'}
          </Typography>

          {openSections.map(renderSection)}

          {doneSections.length > 0 && (
            <>
              {openSections.length > 0 && <Divider sx={{ my: 1 }} />}
              <Typography variant="caption" sx={{ color: 'rgba(52,211,153,0.85)' }}>
                ✓ I orden: {doneSections.map((s) => s.title).join(' · ')}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Lukk</Button>
          {onGoToReviews && (
            <Button variant="contained" onClick={() => { setOpen(false); onGoToReviews(); }}>
              Gå til godkjenning
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ProducerTodoButton;
