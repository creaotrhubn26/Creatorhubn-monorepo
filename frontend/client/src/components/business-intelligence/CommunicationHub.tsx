/**
 * Communication Hub - Unified Email, Meeting, Notes & Chat Management
 * Integrates SmartEmailComposer, SmartMeetingPreparation, Notes, and UniversalChatWidget
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Badge,
  IconButton,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Avatar,
  Divider,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  Stack,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  ListItemButton,
  Select,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Email as EmailIcon,
  Event as MeetingIcon,
  Notes as NotesIcon,
  Chat as ChatIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Comment as CommentIcon,
  CheckCircle as CheckCircleIcon,
  Payment as PaymentIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Inbox as InboxIcon,
  Send as SendIcon,
  Drafts as DraftsIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  CalendarToday as CalendarIcon,
  VideoCall as VideoIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Folder as FolderIcon,
  Label as LabelIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Phone as PhoneIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTheming } from '@/utils/theming-helper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import SmartEmailComposer from '../email/SmartEmailComposer';
import SmartMeetingPreparation from '../meet/SmartMeetingPreparation';
import UniversalChatWidget from '../chat/UniversalChatWidget';
import NoteEditor from '../notes/NoteEditor';
import Grid from '@mui/material/Grid2';

interface CommunicationHubProps {
  userId: string;
  profession: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`comm-tabpanel-${index}`}
      aria-labelledby={`comm-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface EmailInbox {
  id: string;
  name: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'other';
  unreadCount: number;
  isDefault: boolean;
}

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments: boolean;
  inboxId: string;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  attendees: string[];
  location: string;
  type: 'in-person' | 'video' | 'phone';
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  preparationStatus: 'not-started' | 'in-progress' | 'ready';
}

interface Note {
  id: string;
  title: string;
  content: string;
  category: 'meeting' | 'email' | 'project' | 'personal';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  linkedTo?: {
    type: 'email' | 'meeting' | 'project';
    id: string;
  };
}

type MeetingPreparationProfession =
  | 'photographer'
  | 'videographer'
  | 'music_producer'
  | 'vendor'
  | 'enterprise';

const isNoteCategory = (value: string): value is Note['category'] =>
  ['meeting', 'email', 'project', 'personal'].includes(value);

function normalizeMeetingPreparationProfession(profession: string): MeetingPreparationProfession {
  switch (profession) {
    case 'photographer':
    case 'videographer':
    case 'music_producer':
    case 'vendor':
    case 'enterprise':
      return profession;
    default:
      return 'vendor';
  }
}

const CommunicationHub: React.FC<CommunicationHubProps> = ({ userId, profession }) => {
  const theming = useTheming(profession);
  const queryClient = useQueryClient();
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Slice 9X.1 — gallery activity feed for the unified inbox tab.
  // Polled every 30s so live engagement feels responsive without
  // requiring a WebSocket subscription. Profession-aware terminology
  // is applied at render time (foto-galleri / video-galleri / lyd-
  // galleri) via the profession config the parent passes in.
  const galleryEventsQuery = useQuery<{
    events: Array<{
      id: string;
      type: 'comment' | 'selection' | 'payment';
      galleryId: string;
      galleryClientName: string | null;
      galleryProjectTitle: string | null;
      galleryShareUrl: string | null;
      imageId: string | null;
      clientName: string | null;
      clientEmail: string;
      detail: string;
      amount: number | null;
      currency: string | null;
      paymentStatus: string | null;
      timestamp: string;
    }>;
  }>({
    queryKey: ['/api/photographer/galleries/events'],
    queryFn: () =>
      apiRequest('/api/photographer/galleries/events') as Promise<{ events: never[] }>,
    refetchInterval: 30_000,
  });
  const galleryEvents = galleryEventsQuery.data?.events ?? [];

  // Slice 9X.1 — naive unread count: events from the last 24h that
  // weren't already in the cached set on first mount. Real "read /
  // unread" tracking would need a per-user lastSeenAt — Slice 9D.5
  // backlog. For now the badge surfaces "today's activity".
  const galleryEventsUnreadCount = React.useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return galleryEvents.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff,
    ).length;
  }, [galleryEvents]);

  // Slice 9X.1 — profession-aware terminology. The platform serves
  // photographers, videographers, and musicians; "bilder" is wrong
  // for the latter two. Map at render time so all the gallery copy
  // here matches the user's profession context. NOTE: the underlying
  // backend storage stays "image" — this is purely UI labels.
  const galleryTerm = React.useMemo(() => {
    const p = String(profession ?? '').toLowerCase();
    if (p.includes('video') || p.includes('film')) {
      return { collection: 'video-galleri', item: 'klipp', selectedVerb: 'valgt' };
    }
    if (p.includes('music') || p.includes('audio') || p.includes('musik')) {
      return { collection: 'lyd-galleri', item: 'spor', selectedVerb: 'valgt' };
    }
    return { collection: 'foto-galleri', item: 'bilde', selectedVerb: 'valgt' };
  }, [profession]);
  
  // Email state
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedInbox, setSelectedInbox] = useState<string>('all');
  const [emailFilter, setEmailFilter] = useState<'all' | 'unread' | 'starred' | 'sent' | 'drafts'>('all');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');

  // Meeting state
  const [meetingDialog, setMeetingDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingFilter, setMeetingFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming');

  // Notes state
  const [noteDialog, setNoteDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState<'meeting' | 'email' | 'project' | 'personal'>('personal');
  const noteCategories: Array<'meeting' | 'email' | 'project' | 'personal'> = [
    'meeting',
    'email',
    'project',
    'personal'
  ];

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);

  // Email action menu state
  const [emailMenuAnchor, setEmailMenuAnchor] = useState<null | HTMLElement>(null);
  const [emailMenuTarget, setEmailMenuTarget] = useState<Email | null>(null);
  const meetingPreparationProfession = normalizeMeetingPreparationProfession(profession);

  // Fetch inboxes
  const { data: inboxes = [] } = useQuery<EmailInbox[]>({
    queryKey: [`/api/communication/inboxes/${userId}`],
    queryFn: () => apiRequest(`/api/communication/inboxes/${userId}`),
  });

  // Fetch emails
  const { data: emails = [], refetch: refetchEmails } = useQuery<Email[]>({
    queryKey: [`/api/communication/emails/${userId}`, selectedInbox, emailFilter],
    queryFn: () => apiRequest(`/api/communication/emails/${userId}?inbox=${selectedInbox}&filter=${emailFilter}`),
  });

  // Fetch meetings
  const { data: meetings = [], refetch: refetchMeetings } = useQuery<Meeting[]>({
    queryKey: [`/api/communication/meetings/${userId}`, meetingFilter],
    queryFn: () => apiRequest(`/api/communication/meetings/${userId}?filter=${meetingFilter}`),
  });

  // Fetch notes
  const { data: notes = [], refetch: refetchNotes } = useQuery<Note[]>({
    queryKey: [`/api/communication/notes/${userId}`],
    queryFn: () => apiRequest(`/api/communication/notes/${userId}`),
  });

  // Mark email as read
  const markAsReadMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiRequest(`/api/communication/emails/${emailId}/read`, { method: 'PUT' }),
    onSuccess: () => refetchEmails(),
  });

  // Star/unstar email
  const toggleStarMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiRequest(`/api/communication/emails/${emailId}/star`, { method: 'PUT' }),
    onSuccess: () => refetchEmails(),
  });

  // Delete email
  const deleteEmailMutation = useMutation({
    mutationFn: (emailId: string) =>
      apiRequest(`/api/communication/emails/${emailId}`, { method: 'DELETE' }),
    onSuccess: () => refetchEmails(),
  });

  // Save note
  const saveNoteMutation = useMutation({
    mutationFn: (note: Partial<Note>) =>
      apiRequest(`/api/communication/notes`, {
        method: 'POST',
        body: { ...note, userId }
      }),
    onSuccess: () => {
      refetchNotes();
      setNoteDialog(false);
      setNoteTitle('');
      setNoteContent('');
    },
  });

  // Calculate unread counts
  const totalUnreadEmails = emails.filter(e => !e.isRead).length;
  const upcomingMeetingsCount = meetings.filter(m => m.status === 'upcoming').length;
  const totalNotes = notes.length;

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

  const handleReplyEmail = (email: Email) => {
    setSelectedEmail(email);
    setEmailComposerOpen(true);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setMeetingDialog(true);
  };

  const handleCreateNote = () => {
    setSelectedNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteDialog(true);
  };

  const handleSaveNote = () => {
    saveNoteMutation.mutate({
      title: noteTitle,
      content: noteContent,
      category: noteCategory,
      tags: [],
    });
  };

  const handleNoteCategoryChange = (value: string) => {
    if (isNoteCategory(value)) {
      setNoteCategory(value);
    }
  };

  useEffect(() => {
    setChatOpen(tabValue === 3);
  }, [tabValue]);

  const handleEmailMenuOpen = (event: React.MouseEvent<HTMLElement>, email: Email) => {
    setEmailMenuAnchor(event.currentTarget);
    setEmailMenuTarget(email);
  };

  const handleEmailMenuClose = () => {
    setEmailMenuAnchor(null);
    setEmailMenuTarget(null);
  };

  const filteredEmails = emails.filter(email => {
    if (emailSearchQuery) {
      return email.subject.toLowerCase().includes(emailSearchQuery.toLowerCase()) ||
             email.from.toLowerCase().includes(emailSearchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }} role="main" aria-label="Kommunikasjonshub">
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" component="h1" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
            Kommunikasjonshub
          </Typography>
          <Stack direction="row" spacing={1} role="group" aria-label="Verktøyhandlinger">
            <Tooltip title="Oppdater alle">
              <IconButton
                size="small"
                onClick={() => {
                  refetchEmails();
                  refetchMeetings();
                  refetchNotes();
                  queryClient.invalidateQueries({ queryKey: [`/api/communication/inboxes/${userId}`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/communication/emails/${userId}`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/communication/meetings/${userId}`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/communication/notes/${userId}`] });
                }}
                aria-label="Oppdater alle data"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  }}}
              >
                <RefreshIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Innstillinger">
              <IconButton
                size="small"
                aria-label="Åpne innstillinger"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  }}}
              >
                <SettingsIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx() }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          aria-label="Kommunikasjon navigasjon"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              color: theming.colors.primary,
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
            }}}
        >
          <Tab
            icon={
              <Badge badgeContent={totalUnreadEmails} color="error">
                <EmailIcon aria-hidden="true" />
              </Badge>
            }
            label="E-post"
            id="comm-tab-0"
            aria-controls="comm-tabpanel-0"
            aria-label={`E-post, ${totalUnreadEmails} uleste`}
          />
          <Tab
            icon={
              <Badge badgeContent={upcomingMeetingsCount} color="primary">
                <MeetingIcon aria-hidden="true" />
              </Badge>
            }
            label="Møter"
            id="comm-tab-1"
            aria-controls="comm-tabpanel-1"
            aria-label={`Møter, ${upcomingMeetingsCount} kommende`}
          />
          <Tab
            icon={
              <Badge badgeContent={totalNotes} color="info">
                <NotesIcon aria-hidden="true" />
              </Badge>
            }
            label="Notater"
            id="comm-tab-2"
            aria-controls="comm-tabpanel-2"
            aria-label={`Notater, ${totalNotes} totalt`}
          />
          <Tab
            icon={<ChatIcon aria-hidden="true" />}
            label="Chat"
            id="comm-tab-3"
            aria-controls="comm-tabpanel-3"
          />
          {/* Slice 9X.1 — unified inbox: gallery comments / selections /
              payments alongside email + chat. Photographer no longer has
              to context-switch to Klient-galleri-tab to see what their
              clients did. */}
          <Tab
            icon={
              <Badge badgeContent={galleryEventsUnreadCount} color="warning">
                <PhotoLibraryIcon aria-hidden="true" />
              </Badge>
            }
            label="Galleri"
            id="comm-tab-4"
            aria-controls="comm-tabpanel-4"
            aria-label={`Galleri-aktivitet, ${galleryEventsUnreadCount} nye`}
          />
        </Tabs>

        {/* Email Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
            {/* Email Sidebar */}
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack spacing={2}>
                {/* Compose Button */}
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={() => setEmailComposerOpen(true)}
                  sx={{ bgcolor: theming.colors.primary }}
                >
                  Compose Email
                </Button>

                {/* Inbox Selector */}
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Inboxes
                  </Typography>
                  <List dense>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={selectedInbox === 'all'}
                        onClick={() => setSelectedInbox('all')}
                      >
                        <ListItemIcon><InboxIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="All Inboxes" />
                        <Chip size="small" label={totalUnreadEmails} />
                      </ListItemButton>
                    </ListItem>
                    {inboxes.map((inbox) => (
                      <ListItem key={inbox.id} disablePadding>
                        <ListItemButton
                          selected={selectedInbox === inbox.id}
                          onClick={() => setSelectedInbox(inbox.id)}
                        >
                          <ListItemIcon>
                            <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                              {inbox.name[0]}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={inbox.name}
                            secondary={inbox.email}
                          />
                          {inbox.unreadCount > 0 && (
                            <Chip size="small" label={inbox.unreadCount} color="error" />
                          )}
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>

                {/* Filters */}
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <FilterIcon fontSize="small" />
                      Filters
                    </Box>
                  </Typography>
                  <List dense>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={emailFilter === 'all'}
                        onClick={() => setEmailFilter('all')}
                      >
                        <ListItemIcon><InboxIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="All Mail" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={emailFilter === 'unread'}
                        onClick={() => setEmailFilter('unread')}
                      >
                        <ListItemIcon><EmailIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Unread" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={emailFilter === 'starred'}
                        onClick={() => setEmailFilter('starred')}
                      >
                        <ListItemIcon><StarIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Starred" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={emailFilter === 'sent'}
                        onClick={() => setEmailFilter('sent')}
                      >
                        <ListItemIcon><SendIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Sent" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={emailFilter === 'drafts'}
                        onClick={() => setEmailFilter('drafts')}
                      >
                        <ListItemIcon><DraftsIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Drafts" />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Paper>
              </Stack>
            </Grid>

            {/* Email List */}
            <Grid size={{ xs: 12, md: selectedEmail ? 4 : 9 }}>
              <Paper elevation={1} sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
                {/* Search */}
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search emails..."
                  value={emailSearchQuery}
                  onChange={(e) => setEmailSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )}}
                  sx={{ mb: 2 }}
                />

                {/* Email List */}
                <List>
                  {filteredEmails.length === 0 ? (
                    <Alert severity="info">No emails found</Alert>
                  ) : (
                    filteredEmails.map((email) => (
                      <React.Fragment key={email.id}>
                        <ListItem disablePadding>
                          <ListItemButton
                            selected={selectedEmail?.id === email.id}
                            onClick={() => handleEmailClick(email)}
                            sx={{
                              bgcolor: email.isRead ? 'transparent' : 'action.hover',
                              borderRadius: 1,
                              mb: 1,
                            }}
                          >
                            <ListItemIcon>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStarMutation.mutate(email.id);
                                }}
                              >
                                <StarIcon
                                  fontSize="small"
                                  color={email.isStarred ? 'warning' : 'disabled'}
                                />
                              </IconButton>
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}
                                  >
                                    {email.from}
                                  </Typography>
                                  {email.hasAttachments && (
                                    <Chip size="small" label="📎" />
                                  )}
                                  {email.labels?.length > 0 && (
                                    <Chip
                                      size="small"
                                      label={`${email.labels.length} etiketter`}
                                      icon={<LabelIcon />}
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2" sx={{ fontWeight: email.isRead ? 'normal' : 'bold' }}>
                                    {email.subject}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(email.date).toLocaleString()}
                                  </Typography>
                                </>
                              }
                            />
                          </ListItemButton>
                          <ListItemSecondaryAction>
                            <IconButton
                              size="small"
                              aria-label="Flere handlinger"
                              onClick={(event) => handleEmailMenuOpen(event, email)}
                            >
                              <MoreIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Email Detail */}
            {selectedEmail && (
              <Grid size={{ xs: 12, md: 5 }}>
                <Paper elevation={1} sx={{ p: 3, height: '70vh', overflow: 'auto' }}>
                  {/* Email Header */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">{selectedEmail.subject}</Typography>
                      <IconButton size="small" onClick={() => setSelectedEmail(null)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar>{selectedEmail.from[0]}</Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {selectedEmail.from}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          to {selectedEmail.to}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(selectedEmail.date).toLocaleString()}
                    </Typography>
                  </Box>

                  <Divider sx={{ mb: 3 }} />

                  {/* Email Body */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedEmail.body}
                    </Typography>
                  </Box>

                  {/* Actions */}
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      startIcon={<ReplyIcon />}
                      onClick={() => handleReplyEmail(selectedEmail)}
                      sx={{ bgcolor: theming.colors.primary }}
                    >
                      Reply
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ForwardIcon />}
                    >
                      Forward
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ArchiveIcon />}
                    >
                      Archive
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        deleteEmailMutation.mutate(selectedEmail.id);
                        setSelectedEmail(null);
                      }}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Meetings Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            {/* Meeting Sidebar */}
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack spacing={2}>
                {/* Schedule Meeting Button */}
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<AddIcon />}
                  sx={{ bgcolor: theming.colors.primary }}
                >
                  Schedule Meeting
                </Button>

                {/* Filters */}
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <FilterIcon fontSize="small" />
                      Filters
                    </Box>
                  </Typography>
                  <List dense>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={meetingFilter === 'upcoming'}
                        onClick={() => setMeetingFilter('upcoming')}
                      >
                        <ListItemIcon><ScheduleIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Upcoming" />
                        <Chip size="small" label={upcomingMeetingsCount} />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={meetingFilter === 'all'}
                        onClick={() => setMeetingFilter('all')}
                      >
                        <ListItemIcon><CalendarIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="All Meetings" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={meetingFilter === 'completed'}
                        onClick={() => setMeetingFilter('completed')}
                      >
                        <ListItemIcon><CheckIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Completed" />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Paper>

                {/* Quick Stats */}
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    This Week
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total Meetings</Typography>
                      <Chip size="small" label={meetings.length} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Upcoming</Typography>
                      <Chip size="small" label={upcomingMeetingsCount} color="primary" />
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>

            {/* Meeting List */}
            <Grid size={{ xs: 12, md: 9 }}>
              <Paper elevation={1} sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  {meetingFilter === 'upcoming' ? 'Upcoming Meetings' :
                   meetingFilter === 'completed' ? 'Completed Meetings' : 'All Meetings'}
                </Typography>

                <List>
                  {meetings.length === 0 ? (
                    <Alert severity="info">No meetings found</Alert>
                  ) : (
                    meetings.map((meeting) => (
                      <Card key={meeting.id} sx={{ mb: 2, ...theming.getThemedCardSx() }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                                {meeting.title}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <Chip
                                  size="small"
                                  icon={meeting.type === 'video' ? <VideoIcon /> :
                                        meeting.type === 'phone' ? <PhoneIcon /> : <PersonIcon />}
                                  label={meeting.type}
                                />
                                <Chip
                                  size="small"
                                  label={meeting.status}
                                  color={
                                    meeting.status === 'upcoming' ? 'primary' :
                                    meeting.status === 'in-progress' ? 'success' :
                                    meeting.status === 'completed' ? 'default' : 'error'
                                  }
                                />
                                {meeting.preparationStatus === 'ready' && (
                                  <Chip size="small" label="✓ Prepared" color="success" />
                                )}
                              </Stack>
                            </Box>
                            <IconButton size="small">
                              <MoreIcon />
                            </IconButton>
                          </Box>

                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CalendarIcon fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {new Date(meeting.date).toLocaleDateString()}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <ScheduleIcon fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {meeting.time} ({meeting.duration} min)
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <GroupIcon fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {meeting.attendees.length} attendees
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonIcon fontSize="small" color="action" />
                                <Typography variant="body2">{meeting.location}</Typography>
                              </Box>
                            </Grid>
                          </Grid>

                          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleMeetingClick(meeting)}
                              sx={{ bgcolor: theming.colors.primary }}
                            >
                              View Details
                            </Button>
                            {meeting.preparationStatus !== 'ready' && (
                              <Button size="small" variant="outlined">
                                Prepare Meeting
                              </Button>
                            )}
                            <Button size="small" variant="outlined" startIcon={<NotesIcon />}>
                              Notes
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notes Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            {/* Notes Sidebar */}
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack spacing={2}>
                {/* Create Note Button */}
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={handleCreateNote}
                  sx={{ bgcolor: theming.colors.primary }}
                >
                  New Note
                </Button>

                {/* Categories */}
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Categories
                  </Typography>
                  <List dense>
                    <ListItem disablePadding>
                      <ListItemButton>
                        <ListItemIcon><NotesIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="All Notes" />
                        <Chip size="small" label={notes.length} />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton>
                        <ListItemIcon><MeetingIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Meeting Notes" />
                        <Chip size="small" label={notes.filter(n => n.category === 'meeting').length} />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton>
                        <ListItemIcon><EmailIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Email Notes" />
                        <Chip size="small" label={notes.filter(n => n.category === 'email').length} />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton>
                        <ListItemIcon><FolderIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Project Notes" />
                        <Chip size="small" label={notes.filter(n => n.category === 'project').length} />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Paper>
              </Stack>
            </Grid>

            {/* Notes List */}
            <Grid size={{ xs: 12, md: 9 }}>
              <Paper elevation={1} sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  All Notes
                </Typography>

                <Grid container spacing={2}>
                  {notes.length === 0 ? (
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="info">No notes yet. Create your first note!</Alert>
                    </Grid>
                  ) : (
                    notes.map((note) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={note.id}>
                        <Card
                          sx={{
                            cursor: 'pointer','&:hover': { boxShadow: 4 },
                            ...theming.getThemedCardSx()
                          }}
                          onClick={() => {
                            setSelectedNote(note);
                            setNoteTitle(note.title);
                            setNoteContent(note.content);
                            setNoteCategory(note.category);
                            setNoteDialog(true);
                          }}
                        >
                          <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                              {note.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical'}}
                            >
                              {note.content.replace(/<[^>]*>/g, '')}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Chip size="small" label={note.category} />
                              {note.tags.map((tag) => (
                                <Chip key={tag} size="small" label={tag} variant="outlined" />
                              ))}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              Updated: {new Date(note.updatedAt).toLocaleDateString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))
                  )}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Chat Tab */}
        {/* Slice 9X.1 — Galleri-aktivitet panel. Profession-aware
            terminology applied via galleryTerm (foto/video/lyd-galleri,
            bilde/klipp/spor). Backend route /api/photographer/galleries/
            events serves the union'd timeline across all galleries the
            photographer owns. */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {galleryTerm.collection.charAt(0).toUpperCase() + galleryTerm.collection.slice(1)} aktivitet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Kommentarer, valg og betalinger fra klienter — på tvers av alle dine {galleryTerm.collection}.
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => galleryEventsQuery.refetch()}
                disabled={galleryEventsQuery.isFetching}
              >
                {galleryEventsQuery.isFetching ? 'Oppdaterer…' : 'Oppdater'}
              </Button>
            </Stack>
            {galleryEventsQuery.isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
            {!galleryEventsQuery.isLoading && galleryEvents.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <PhotoLibraryIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body1">Ingen aktivitet ennå</Typography>
                <Typography variant="body2">
                  Klient-{galleryTerm.item}-aktivitet vil dukke opp her etter hvert som klientene dine åpner sine {galleryTerm.collection}.
                </Typography>
              </Box>
            )}
            <Stack spacing={1}>
              {galleryEvents.map((e) => {
                const titleClient = e.clientName ?? e.clientEmail;
                const galleryLabel = e.galleryProjectTitle || e.galleryClientName || 'galleri';
                let icon: React.ReactNode = <CommentIcon color="primary" fontSize="small" />;
                let label = '';
                if (e.type === 'comment') {
                  icon = <CommentIcon color="primary" fontSize="small" />;
                  const trimmed = e.detail.length > 80 ? `${e.detail.slice(0, 80)}…` : e.detail;
                  label = `${titleClient} kommenterte i "${galleryLabel}": "${trimmed}"`;
                } else if (e.type === 'selection') {
                  icon = <CheckCircleIcon color="success" fontSize="small" />;
                  label = `${titleClient} markerte ${galleryTerm.item} som ${e.detail} i "${galleryLabel}"`;
                } else if (e.type === 'payment') {
                  icon = <PaymentIcon color="warning" fontSize="small" />;
                  label = `${titleClient} betalte ${e.amount} ${e.currency ?? ''} (${e.paymentStatus ?? ''}) for "${galleryLabel}"`;
                }
                return (
                  <Paper
                    key={`${e.type}-${e.id}`}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      cursor: e.galleryShareUrl ? 'pointer' : 'default',
                      '&:hover': e.galleryShareUrl ? { bgcolor: 'action.hover' } : undefined,
                    }}
                    onClick={() => e.galleryShareUrl && window.open(e.galleryShareUrl, '_blank')}
                  >
                    <Box sx={{ pt: 0.25 }}>{icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2">{label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(e.timestamp).toLocaleString('nb-NO')}
                      </Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {chatOpen && (
            <Paper elevation={1} sx={{ height: '70vh', ...theming.getThemedCardSx() }}>
              <UniversalChatWidget />
            </Paper>
          )}
        </TabPanel>
      </Paper>

      {/* Email Composer Dialog */}
      <SmartEmailComposer
        open={emailComposerOpen}
        onClose={() => {
          setEmailComposerOpen(false);
          setSelectedEmail(null);
        }}
        profession={profession}
        userId={userId}
        initialTo={selectedEmail?.from || ''}
        initialSubject={selectedEmail ? `Re: ${selectedEmail.subject}` : ''}
        replyToEmail={selectedEmail}
      />

      {/* Meeting Preparation Dialog */}
      <Dialog
        open={meetingDialog}
        onClose={() => {
          setMeetingDialog(false);
          setSelectedMeeting(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Meeting Preparation</Typography>
            <IconButton onClick={() => setMeetingDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedMeeting && (
            <SmartMeetingPreparation
              meetingId={selectedMeeting.id}
              profession={meetingPreparationProfession}
              userId={userId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Note Editor Dialog */}
      <Dialog
        open={noteDialog}
        onClose={() => setNoteDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedNote ? 'Edit Note' : 'Create Note'}
            </Typography>
            <IconButton onClick={() => setNoteDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={noteCategory}
                onChange={(event: SelectChangeEvent<string>) => handleNoteCategoryChange(event.target.value)}
                label="Category"
              >
                {noteCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ height: 400 }}>
              <NoteEditor
                value={noteContent}
                onChange={setNoteContent}
                placeholder="Write your note here..."
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveNote}
            sx={{ bgcolor: theming.colors.primary }}
          >
            Save Note
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={emailMenuAnchor}
        open={Boolean(emailMenuAnchor)}
        onClose={handleEmailMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (emailMenuTarget) {
              handleReplyEmail(emailMenuTarget);
            }
            handleEmailMenuClose();
          }}
        >
          <ReplyIcon fontSize="small" style={{ marginRight: 8 }} />
          Reply
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (emailMenuTarget) {
              setEmailComposerOpen(true);
              setSelectedEmail(emailMenuTarget);
            }
            handleEmailMenuClose();
          }}
        >
          <ForwardIcon fontSize="small" style={{ marginRight: 8 }} />
          Forward
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (emailMenuTarget) {
              toggleStarMutation.mutate(emailMenuTarget.id);
            }
            handleEmailMenuClose();
          }}
        >
          <StarIcon fontSize="small" style={{ marginRight: 8 }} />
          Toggle Star
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (emailMenuTarget) {
              deleteEmailMutation.mutate(emailMenuTarget.id);
            }
            handleEmailMenuClose();
          }}
        >
          <DeleteIcon fontSize="small" style={{ marginRight: 8 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CommunicationHub;
