import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  Drafts as DraftsIcon,
  Email as EmailIcon,
  Inbox as InboxIcon,
  MoreVert as MoreVertIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Refresh as RefreshIcon,
  Reply as ReplyIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import SmartEmailCenter from './SmartEmailCenter';

interface ComprehensiveEmailCenterProps {
  profession: string;
  userId: string;
}

interface EmailPerson {
  name: string;
  email: string;
  avatar?: string;
}

interface EmailMessage {
  id: string;
  from: EmailPerson;
  to: string[];
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
}

interface ComposeDraft {
  to: string;
  subject: string;
  body: string;
}

const EMPTY_DRAFT: ComposeDraft = {
  to: '',
  subject: '',
  body: '',
};

const TAB_DEFINITIONS = [
  { label: 'Innboks', icon: <InboxIcon />, filter: (email: EmailMessage) => !email.labels.includes('sent') && !email.labels.includes('archive') },
  { label: 'Sendt', icon: <SendIcon />, filter: (email: EmailMessage) => email.labels.includes('sent') },
  { label: 'Utkast', icon: <DraftsIcon />, filter: (email: EmailMessage) => email.labels.includes('draft') },
  { label: 'Stjernemerket', icon: <StarIcon />, filter: (email: EmailMessage) => email.isStarred },
  { label: 'Arkiv', icon: <ArchiveIcon />, filter: (email: EmailMessage) => email.labels.includes('archive') },
];

export default function ComprehensiveEmailCenter({ profession, userId }: ComprehensiveEmailCenterProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getProfessionDisplayName } = useDynamicProfessions();
  const theming = useTheming(profession);

  const resolvedUserId = userId || (typeof user?.id === 'string' ? user.id : 'guest');
  const { pushEnabled, isSupported } = usePushNotifications(resolvedUserId);

  const [tab, setTab] = useState(0);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState<ComposeDraft>(EMPTY_DRAFT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<'classic' | 'smart'>('classic');
  const [statusMessage, setStatusMessage] = useState<null | { message: string; severity: 'success' | 'error' | 'info' }>(null);

  const { data: emailsRaw, isLoading, refetch } = useQuery({
    queryKey: ['/api/emails/smart', profession, resolvedUserId, search],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/emails/smart?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(resolvedUserId)}&search=${encodeURIComponent(search)}`,
      );
      return response;
    },
    staleTime: 30_000,
  });

  const emails = useMemo(() => normalizeEmails(emailsRaw), [emailsRaw]);

  const visibleEmails = useMemo(() => {
    const predicate = TAB_DEFINITIONS[tab]?.filter ?? (() => true);
    const query = search.trim().toLowerCase();
    return emails.filter((email) => {
      const tabMatch = predicate(email);
      if (!tabMatch) {
        return false;
      }
      if (query.length === 0) {
        return true;
      }
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from.name.toLowerCase().includes(query) ||
        email.from.email.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query)
      );
    });
  }, [emails, search, tab]);

  const selectedEmail = useMemo(
    () => visibleEmails.find((email) => email.id === selectedEmailId) ?? visibleEmails[0] ?? null,
    [selectedEmailId, visibleEmails],
  );

  const updateEmailMutation = useMutation({
    mutationFn: async (payload: { id: string; patch: Record<string, unknown> }) =>
      apiRequest(`/api/emails/${payload.id}`, {
        method: 'PATCH',
        body: payload.patch,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails/smart'] });
    },
    onError: () => {
      setStatusMessage({ message: 'Kunne ikke oppdatere e-post', severity: 'error' });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/emails/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails/smart'] });
      setSelectedEmailId(null);
      setStatusMessage({ message: 'E-post slettet', severity: 'success' });
    },
    onError: () => {
      setStatusMessage({ message: 'Kunne ikke slette e-post', severity: 'error' });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (payload: ComposeDraft) =>
      apiRequest('/api/emails/send', {
        method: 'POST',
        body: {
          to: payload.to,
          subject: payload.subject,
          body: payload.body,
          profession,
          userId: resolvedUserId,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails/smart'] });
      setComposeOpen(false);
      setDraft(EMPTY_DRAFT);
      setStatusMessage({ message: 'E-post sendt', severity: 'success' });
    },
    onError: () => {
      setStatusMessage({ message: 'Kunne ikke sende e-post', severity: 'error' });
    },
  });

  if (mode === 'smart') {
    return (
      <Box sx={{ height: '100%' }}>
        <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Smart arbeidsflyt</Typography>
              <Button variant="outlined" onClick={() => setMode('classic')}>
                Bytt til klassisk visning
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <SmartEmailCenter profession={profession} userId={resolvedUserId} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: theming.colors.primary }}>
              <EmailIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
                Comprehensive Email Center
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getProfessionDisplayName(profession)} • bruker {resolvedUserId}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Push-varsler">
              <IconButton onClick={() => setSettingsOpen(true)}>
                {isSupported && pushEnabled ? <NotificationsActiveIcon /> : <NotificationsIcon />}
              </IconButton>
            </Tooltip>
            <Button startIcon={<RefreshIcon />} onClick={() => refetch()}>
              Oppdater
            </Button>
            <Button variant="outlined" onClick={() => setMode('smart')}>
              Smart visning
            </Button>
            <Button variant="contained" startIcon={<SendIcon />} onClick={() => setComposeOpen(true)}>
              Ny e-post
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {statusMessage && (
        <Alert severity={statusMessage.severity} sx={{ mb: 2 }} onClose={() => setStatusMessage(null)}>
          {statusMessage.message}
        </Alert>
      )}

      <Card sx={{ flex: 1, minHeight: 0 }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 0 }}>
          <Box sx={{ px: 2, pt: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Søk e-post..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" sx={{ px: 1 }}>
            {TAB_DEFINITIONS.map((definition) => {
              const count = emails.filter(definition.filter).length;
              return (
                <Tab
                  key={definition.label}
                  icon={
                    <Badge badgeContent={count} color="primary">
                      {definition.icon}
                    </Badge>
                  }
                  iconPosition="start"
                  label={definition.label}
                />
              );
            })}
          </Tabs>
          <Divider />

          <Box sx={{ display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 0, flex: 1 }}>
            <Box sx={{ borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto' }}>
              {isLoading ? (
                <Stack sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Laster e-poster...
                  </Typography>
                </Stack>
              ) : (
                <List disablePadding>
                  {visibleEmails.map((email) => (
                    <ListItemButton
                      key={email.id}
                      selected={selectedEmail?.id === email.id}
                      onClick={() => {
                        setSelectedEmailId(email.id);
                        if (!email.isRead) {
                          updateEmailMutation.mutate({
                            id: email.id,
                            patch: { isRead: true },
                          });
                        }
                      }}
                      sx={{ alignItems: 'flex-start', py: 1.5 }}
                    >
                      <ListItemAvatar>
                        <Avatar src={email.from.avatar}>
                          {email.from.name.slice(0, 1).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: email.isRead ? 500 : 700 }}
                              noWrap
                            >
                              {email.from.name}
                            </Typography>
                            {!email.isRead && <Chip size="small" color="primary" label="Ny" />}
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.5}>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ color: email.isRead ? 'text.secondary' : 'text.primary', fontWeight: email.isRead ? 400 : 600 }}
                            >
                              {email.subject}
                            </Typography>
                            <Typography variant="caption" noWrap color="text.secondary">
                              {email.body}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(email.date)}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  ))}
                  {visibleEmails.length === 0 && (
                    <ListItem>
                      <ListItemText primary="Ingen e-poster matcher filteret." />
                    </ListItem>
                  )}
                </List>
              )}
            </Box>

            <Box sx={{ p: 2, overflowY: 'auto' }}>
              {selectedEmail ? (
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="start">
                    <Box>
                      <Typography variant="h6">{selectedEmail.subject}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fra {selectedEmail.from.name} ({selectedEmail.from.email})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(selectedEmail.date)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Svar">
                        <IconButton>
                          <ReplyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={selectedEmail.isStarred ? 'Fjern stjerne' : 'Stjernemerk'}>
                        <IconButton
                          onClick={() =>
                            updateEmailMutation.mutate({
                              id: selectedEmail.id,
                              patch: { isStarred: !selectedEmail.isStarred },
                            })
                          }
                        >
                          {selectedEmail.isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Arkiver">
                        <IconButton
                          onClick={() =>
                            updateEmailMutation.mutate({
                              id: selectedEmail.id,
                              patch: { labels: Array.from(new Set([...selectedEmail.labels, 'archive'])) },
                            })
                          }
                        >
                          <ArchiveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => deleteEmailMutation.mutate(selectedEmail.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mer">
                        <IconButton>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  <Divider />
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {selectedEmail.body}
                  </Typography>
                </Stack>
              ) : (
                <Typography color="text.secondary">Velg en e-post for å lese innhold.</Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Ny e-post</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Til"
              placeholder="kunde@firma.no"
              value={draft.to}
              onChange={(event) => setDraft((previous) => ({ ...previous, to: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Emne"
              value={draft.subject}
              onChange={(event) => setDraft((previous) => ({ ...previous, subject: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Melding"
              value={draft.body}
              onChange={(event) => setDraft((previous) => ({ ...previous, body: event.target.value }))}
              fullWidth
              multiline
              minRows={10}
            />
            <Select
              size="small"
              value={profession}
              disabled
              fullWidth
              renderValue={() => `Profesjonskontekst: ${getProfessionDisplayName(profession)}`}
            >
              <MenuItem value={profession}>{profession}</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComposeOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => sendEmailMutation.mutate(draft)}
            disabled={
              sendEmailMutation.isPending ||
              draft.to.trim().length === 0 ||
              draft.subject.trim().length === 0 ||
              draft.body.trim().length === 0
            }
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Varslingsinnstillinger</DialogTitle>
        <DialogContent>
          <PushNotificationSettings userId={resolvedUserId} contextId="comprehensive-email-center" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function normalizeEmails(input: unknown): EmailMessage[] {
  const items = unwrapToArray(input);
  return items
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const id = toStringOrEmpty(record.id || record.messageId);
      const subject = toStringOrEmpty(record.subject);
      const body = toStringOrEmpty(record.body || record.snippet);
      if (!id || !subject) {
        return null;
      }

      const fromRecord = asRecord(record.from);
      const toRaw = Array.isArray(record.to) ? record.to : [];
      const labelsRaw = Array.isArray(record.labels) ? record.labels : [];
      return {
        id,
        from: {
          name: toStringOrEmpty(fromRecord?.name) || toStringOrEmpty(fromRecord?.email) || 'Ukjent',
          email: toStringOrEmpty(fromRecord?.email) || 'ukjent@ukjent.no',
          avatar: toStringOrUndefined(fromRecord?.avatar),
        },
        to: toRaw.map((entry) => String(entry)),
        subject,
        body,
        date: toStringOrEmpty(record.date) || new Date().toISOString(),
        isRead: Boolean(record.isRead),
        isStarred: Boolean(record.isStarred),
        hasAttachments: Boolean(record.hasAttachments),
        labels: labelsRaw.map((entry) => String(entry)),
      } satisfies EmailMessage;
    })
    .filter((email): email is EmailMessage => email !== null);
}

function unwrapToArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  const record = asRecord(input);
  if (!record) {
    return [];
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.emails)) {
    return record.emails;
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }
  return [];
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
