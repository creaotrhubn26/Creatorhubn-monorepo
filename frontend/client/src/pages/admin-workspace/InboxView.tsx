/**
 * InboxView — «Innboks»-flaten.
 *
 * Flyttet ut av AdminWorkspace.tsx sammen med panel-registeret.
 *
 * Merk rekkefølgen i rendringen: FEIL før TOMHET. Det var nettopp
 * sammenblandingen av de to som gjorde at innboksen påsto «Alt klart»
 * mens backend var nede.
 */

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import type { WorkspaceNotification } from '../../services/adminRoomApi';
import { BRAND } from './brand';
import { PanelEmpty } from './panelKit';


export function InboxView({
  notifications,
  loading,
  error,
  onMarkSeen,
}: {
  notifications: WorkspaceNotification[];
  loading: boolean;
  error: string | null;
  onMarkSeen: (id: string) => void;
}) {
  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress sx={{ color: BRAND.accent }} />
      </Stack>
    );
  }

  // Feil FØR tomhet. «Tom innboks» når backend er nede er den dyreste
  // løgnen en driftsflate kan fortelle.
  if (error) {
    return (
      <Alert
        severity="error"
        sx={{
          bgcolor: 'rgba(220, 38, 38, 0.16)',
          color: '#fecaca',
          border: '1px solid rgba(220, 38, 38, 0.4)',
        }}
      >
        Kunne ikke hente varsler — {error}. Listen under kan være utdatert eller ufullstendig.
      </Alert>
    );
  }

  if (notifications.length === 0) {
    return (
      <PanelEmpty
        icon={<InboxOutlinedIcon />}
        title="Tom innboks"
        description="Du har ingen uleste varsler. Når noe trenger oppmerksomhet — fra leads, søknader, prosjekter eller systemvarsler — havner det her."
      />
    );
  }

  return (
    <Stack spacing={1}>
      {notifications.map((n) => (
        <Box
          key={n.id}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: BRAND.panelBg,
            border: `1px solid ${BRAND.border}`,
            '&:hover': { borderColor: BRAND.borderHover },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.92rem' }}>
                {n.title ?? n.type ?? 'Varsel'}
              </Typography>
              {n.message ? (
                <Typography sx={{ color: BRAND.textMuted, fontSize: '0.84rem', mt: 0.5, lineHeight: 1.5 }}>
                  {n.message}
                </Typography>
              ) : null}
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
                {n.createdAt ? (
                  <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}>
                    {new Date(n.createdAt).toLocaleString('nb-NO')}
                  </Typography>
                ) : null}
                {/* Click-through til kilden. Uten denne var innboksen en
                    liste du ikke kunne gjøre noe fra. */}
                {n.actionUrl ? (
                  <Button
                    size="small"
                    href={n.actionUrl}
                    endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      textTransform: 'none',
                      color: BRAND.accent,
                      fontSize: '0.76rem',
                      p: 0,
                      minWidth: 0,
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    {n.actionLabel ?? 'Åpne'}
                  </Button>
                ) : null}
              </Stack>
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {n.priority === 'urgent' || n.priority === 'high' ? (
                <Chip
                  label={n.priority === 'urgent' ? 'Haster' : 'Høy'}
                  size="small"
                  sx={{
                    bgcolor: n.priority === 'urgent' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: n.priority === 'urgent' ? '#fca5a5' : '#fcd34d',
                    fontWeight: 700,
                    height: 22,
                  }}
                />
              ) : null}
              {/* En innboks du ikke kan tømme slutter folk å åpne. */}
              <Tooltip title="Markér som lest">
                <IconButton
                  size="small"
                  onClick={() => onMarkSeen(n.id)}
                  aria-label={`Markér «${n.title ?? 'varsel'}» som lest`}
                  sx={{ color: BRAND.textDim, '&:hover': { color: BRAND.success } }}
                >
                  <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

export default InboxView;
