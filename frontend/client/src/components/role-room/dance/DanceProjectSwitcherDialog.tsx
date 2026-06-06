/**
 * DanceProjectSwitcherDialog — modal som lar bruker velge mellom egne
 * prosjekter. Triggers fra "Project: <name> ▼"-knappen i
 * DanceAnnotateLayout's topp-bar.
 *
 * Henter prosjekter via getCastingProjectsFromDb (eksisterende
 * /api/casting/projects-endepunkt). Filter på søk + click bytter aktiv
 * project via dance:set-active-project CustomEvent (parent kan lytte
 * eller bruke onSwitch-callback direkte).
 */
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  CheckCircle as CheckIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

import { getCastingProjectsFromDb } from '../services/castingDbService';
import { danceFlowColors } from './danceFlowTheme';

interface ProjectRow {
  id: string;
  name: string;
  subtitle?: string;
}

export interface DanceProjectSwitcherDialogProps {
  open: boolean;
  /** Nåværende prosjekt-ID. Marker som aktiv i listen. */
  currentProjectId: string | null;
  onClose: () => void;
  /** Kalles med valgt project-ID. Parent ansvarlig for state-bytte. */
  onSwitch: (projectId: string) => void;
}

export default function DanceProjectSwitcherDialog({
  open,
  currentProjectId,
  onClose,
  onSwitch,
}: DanceProjectSwitcherDialogProps): React.ReactElement {
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState<string>('');

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getCastingProjectsFromDb()
      .then((rows) => {
        // Backend returnerer enten { id, name, ... } eller diverse felt-navn.
        // Vi normaliserer til { id, name, subtitle? } for robust visning.
        const normalized: ProjectRow[] = [];
        for (const r of rows) {
          const obj = r as Record<string, unknown>;
          const id = typeof obj.id === 'string' ? obj.id : null;
          const name = typeof obj.name === 'string' && obj.name.trim()
            ? obj.name.trim()
            : (typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : null);
          if (!id || !name) continue;
          const subtitle = typeof obj.status === 'string'
            ? obj.status
            : (typeof obj.updatedAt === 'string' ? obj.updatedAt.slice(0, 10) : undefined);
          normalized.push({ id, name, subtitle });
        }
        setProjects(normalized);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kunne ikke laste prosjekter');
        setLoading(false);
      });
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const handlePick = (id: string): void => {
    onSwitch(id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      data-testid="dance-project-switcher"
      PaperProps={{
        sx: {
          bgcolor: danceFlowColors.bgPanel,
          color: danceFlowColors.textPrimary,
          border: `1px solid ${danceFlowColors.borderStrong}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
          py: 1.5,
        }}
      >
        <Typography component="span" sx={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
          Bytt prosjekt
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Lukk" data-testid="dance-project-switcher-close">
          <CloseIcon sx={{ color: danceFlowColors.textMuted }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {/* Search */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center',
            bgcolor: danceFlowColors.bgInset,
            border: `1px solid ${danceFlowColors.borderSoft}`,
            borderRadius: 1, px: 1, py: 0.25,
            mx: 2, mt: 2, mb: 1,
            '&:focus-within': { borderColor: danceFlowColors.lavender },
          }}
        >
          <SearchIcon sx={{ fontSize: 16, color: danceFlowColors.textDisabled, mr: 0.5 }} />
          <InputBase
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk prosjekt…"
            data-testid="dance-project-switcher-search"
            autoFocus
            sx={{
              flex: 1, fontSize: 13, color: danceFlowColors.textSecondary,
              '& input': { p: 0.5 },
              '& input::placeholder': { color: danceFlowColors.textDisabled, opacity: 1 },
            }}
          />
          {search ? (
            <IconButton
              size="small"
              onClick={() => setSearch('')}
              sx={{ p: 0.25, color: danceFlowColors.textDisabled }}
            >
              <ClearIcon sx={{ fontSize: 14 }} />
            </IconButton>
          ) : null}
        </Box>

        {/* List */}
        <Box sx={{ maxHeight: 400, overflowY: 'auto', pb: 2 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={20} sx={{ color: danceFlowColors.lavender }} />
            </Stack>
          ) : error ? (
            <Box sx={{ px: 3, py: 2 }}>
              <Typography sx={{ fontSize: 12, color: danceFlowColors.errorPrimary }}>
                {error}
              </Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: danceFlowColors.textMuted, mb: 0.5 }}>
                {projects.length === 0 ? 'Ingen prosjekter ennå' : `Ingen matchet «${search}»`}
              </Typography>
              {projects.length === 0 ? (
                <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled }}>
                  Opprett et prosjekt i Role Room først.
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Stack spacing={0.25} sx={{ px: 1 }}>
              {filtered.map((p) => {
                const isActive = p.id === currentProjectId;
                return (
                  <Box
                    key={p.id}
                    component="button"
                    type="button"
                    onClick={() => handlePick(p.id)}
                    data-testid={`dance-project-switcher-row-${p.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      width: '100%', px: 1.25, py: 1,
                      border: 'none', borderRadius: 1,
                      bgcolor: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
                      color: isActive ? danceFlowColors.lavender : danceFlowColors.textSecondary,
                      cursor: 'pointer', font: 'inherit',
                      textAlign: 'left',
                      transition: 'background-color 120ms',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
                      },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: 13, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'inherit',
                      }}>
                        {p.name}
                      </Typography>
                      {p.subtitle ? (
                        <Typography sx={{
                          fontSize: 11, color: danceFlowColors.textDisabled,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {p.subtitle}
                        </Typography>
                      ) : null}
                    </Box>
                    {isActive ? (
                      <CheckIcon sx={{ fontSize: 16, color: danceFlowColors.lavender }} />
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
