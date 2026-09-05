import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddLink as AddLinkIcon,
  Close as CloseIcon,
  DesignServices as DesignServicesIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';
import type {
  RoleRoomFeedMockupLink,
  RoleRoomFeedPlatform,
  RoleRoomMockupProjectSummary,
} from '../../services/roleRoomAgentService';

type Props = {
  projectId: string;
  platform: RoleRoomFeedPlatform;
  postId: string;
};

function formatAppliedAt(value: string | null): string {
  if (!value) return 'Ikke sendt ennå';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sendt tidligere'
    : `Sendt ${date.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}`;
}

export default function FeedPostMockupLinks({ projectId, platform, postId }: Props) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<RoleRoomFeedMockupLink[]>([]);
  const [projects, setProjects] = useState<RoleRoomMockupProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supported = platform !== 'youtube';

  const refresh = async (includeProjects = open) => {
    if (!supported) return;
    setLoading(true);
    setError(null);
    try {
      const [allLinks, allProjects] = await Promise.all([
        roleRoomAgentService.listFeedMockupLinks({ workspaceProjectId: projectId }),
        includeProjects ? roleRoomAgentService.listMockupProjects() : Promise.resolve(projects),
      ]);
      setLinks(allLinks.filter((link) => link.platform === platform && link.feedPostId === postId));
      if (includeProjects) setProjects(allProjects);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke hente Mockup Studio-koblinger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(false);
    // Project/post switches must discard any previous search before refetching.
    setQuery('');
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, platform, postId]);

  useEffect(() => {
    if (open && projects.length === 0) void refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const linkedIds = useMemo(() => new Set(links.map((link) => link.mockupProjectId)), [links]);
  const available = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('nb-NO');
    return projects
      .filter((project) => !normalized || project.name.toLocaleLowerCase('nb-NO').includes(normalized))
      .sort((a, b) => {
        const aCurrent = a.workspaceProjectId === projectId ? 1 : 0;
        const bCurrent = b.workspaceProjectId === projectId ? 1 : 0;
        return bCurrent - aCurrent || b.projectUpdatedAt - a.projectUpdatedAt;
      });
  }, [projectId, projects, query]);

  const createLink = async (mockupProjectId: string) => {
    if (!supported) return;
    setBusyId(mockupProjectId);
    setError(null);
    try {
      const link = await roleRoomAgentService.createFeedMockupLink({
        workspaceProjectId: projectId,
        platform,
        feedPostId: postId,
        mockupProjectId,
      });
      setLinks((current) => current.some((item) => item.id === link.id) ? current : [link, ...current]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke koble mockupen.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteLink = async (link: RoleRoomFeedMockupLink) => {
    setBusyId(link.id);
    setError(null);
    try {
      await roleRoomAgentService.deleteFeedMockupLink(link.id);
      setLinks((current) => current.filter((item) => item.id !== link.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke fjerne koblingen.');
    } finally {
      setBusyId(null);
    }
  };

  if (!supported) return null;

  return (
    <Box
      sx={{
        border: '1px solid rgba(34,211,238,0.2)',
        borderRadius: 2,
        bgcolor: 'rgba(8,47,73,0.18)',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.4, py: 1.1 }}>
        <DesignServicesIcon sx={{ color: '#22d3ee', fontSize: 20 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 750 }}>
            Mockup Studio
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.7rem' }}>
            {links.length ? `${links.length} eksisterende design koblet` : 'Gjenbruk design som allerede finnes i Post Agent'}
          </Typography>
        </Box>
        {loading && <CircularProgress size={16} sx={{ color: '#22d3ee' }} />}
        <Button
          size="small"
          variant={links.length ? 'outlined' : 'contained'}
          startIcon={<AddLinkIcon />}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {open ? 'Lukk' : links.length ? 'Administrer' : 'Koble design'}
        </Button>
      </Stack>

      {links.length > 0 && (
        <Stack direction="row" gap={0.7} flexWrap="wrap" sx={{ px: 1.4, pb: open ? 1 : 1.2 }}>
          {links.map((link) => (
            <Chip
              key={link.id}
              size="small"
              label={`${link.mockupName} · ${link.stale ? 'ny versjon finnes' : formatAppliedAt(link.lastAppliedAt)}`}
              color={link.stale ? 'warning' : link.lastAppliedAt ? 'success' : 'default'}
              variant="outlined"
              sx={{ color: '#e2e8f0', maxWidth: '100%' }}
            />
          ))}
        </Stack>
      )}

      <Collapse in={open} unmountOnExit>
        <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />
        <Stack spacing={1.2} sx={{ p: 1.4 }}>
          <Alert severity="info" sx={{ py: 0.2, fontSize: '0.75rem' }}>
            Koblingen peker på originalprosjektet. Åpne det i Post Agent og velg «Send til Feed Planner» når designet er klart.
          </Alert>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {links.map((link) => (
            <Stack
              key={link.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.72)' }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ color: '#f8fafc', fontSize: '0.8rem', fontWeight: 700 }}>
                  {link.mockupName}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.56)', fontSize: '0.68rem' }}>
                  Versjon {link.mockupRevision} · {link.stale ? 'må sendes på nytt' : formatAppliedAt(link.lastAppliedAt)}
                </Typography>
              </Box>
              <Tooltip title="Fjern bare koblingen — originalprosjektet slettes ikke">
                <span>
                  <IconButton
                    size="small"
                    disabled={busyId === link.id}
                    onClick={() => void deleteLink(link)}
                    aria-label={`Fjern kobling til ${link.mockupName}`}
                    sx={{ color: 'rgba(248,113,113,0.9)' }}
                  >
                    {busyId === link.id ? <CircularProgress size={16} /> : <LinkOffIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ))}

          <Stack direction="row" spacing={0.8} alignItems="center">
            <TextField
              size="small"
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søk i eksisterende mockup-prosjekter"
              inputProps={{ 'aria-label': 'Søk i eksisterende mockup-prosjekter' }}
            />
            <Tooltip title="Oppdater listen">
              <IconButton onClick={() => void refresh(true)} aria-label="Oppdater mockup-listen">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack spacing={0.7} sx={{ maxHeight: 260, overflowY: 'auto' }}>
            {!loading && available.length === 0 && (
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem', py: 1 }}>
                Ingen tilgjengelige Mockup Studio-prosjekter matcher søket.
              </Typography>
            )}
            {available.map((project) => {
              const linked = linkedIds.has(project.id);
              const editable = project.accessRole === 'owner' || project.accessRole === 'editor';
              return (
                <Stack
                  key={`${project.id}:${project.projectUpdatedAt}`}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ p: 1, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <Typography noWrap sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 650 }}>
                        {project.name}
                      </Typography>
                      {project.workspaceProjectId === projectId && (
                        <Chip size="small" label="Dette prosjektet" color="info" sx={{ height: 19, fontSize: '0.61rem' }} />
                      )}
                    </Stack>
                    <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.66rem' }}>
                      Versjon {project.revision} · {project.status}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={linked ? <CloseIcon /> : <AddLinkIcon />}
                    disabled={linked || !editable || busyId === project.id}
                    onClick={() => void createLink(project.id)}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    {linked ? 'Koblet' : editable ? 'Koble' : 'Kun visning'}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  );
}
