import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AttachFile,
  CheckCircle,
  Message,
  MoreVert,
  Phone,
  VideoCall,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Conversation {
  id: number;
  title: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  type: 'direct' | 'group' | 'consultation';
}

interface MessageItem {
  id: number;
  conversationId: number;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

interface VideoConsultation {
  id: number;
  title: string;
  participantIds: string[];
  scheduledAt: string;
  duration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  meetingUrl?: string;
  notes?: string;
}

interface ConsultationDraft {
  title: string;
  participants: string;
  scheduledAt: string;
  duration: number;
  notes: string;
}

interface UniversalCommunicationProps {
  profession: string;
  userId?: string;
  onMeetingCreate?: (meeting: {
    title: string;
    participantIds: string[];
    scheduledAt: string;
    duration: number;
    notes?: string;
  }) => void;
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onWorklogCreate?: (worklog: Record<string, unknown>) => void;
  selectedProject?: Record<string, unknown>;
  onProjectSelect?: (project: Record<string, unknown>) => void;
}

const parseArrayPayload = <T,>(
  payload: unknown,
  parser: (value: unknown) => T | null,
): T[] => {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)
      ? payload.data
      : [];

  return list
    .map(parser)
    .filter((item): item is T => item !== null);
};

const parseConversation = (value: unknown): Conversation | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'number' || typeof record.title !== 'string' || !Array.isArray(record.participants)) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    participants: record.participants.filter((participant): participant is string => typeof participant === 'string'),
    ...(typeof record.lastMessage === 'string' ? { lastMessage: record.lastMessage } : {}),
    ...(typeof record.lastMessageAt === 'string' ? { lastMessageAt: record.lastMessageAt } : {}),
    unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0,
    type:
      record.type === 'group' || record.type === 'consultation' ? record.type : 'direct',
  };
};

const parseMessage = (value: unknown): MessageItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'number' ||
    typeof record.conversationId !== 'number' ||
    typeof record.senderId !== 'string' ||
    typeof record.senderName !== 'string' ||
    typeof record.content !== 'string' ||
    typeof record.timestamp !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    conversationId: record.conversationId,
    senderId: record.senderId,
    senderName: record.senderName,
    content: record.content,
    messageType:
      record.messageType === 'image' || record.messageType === 'file' || record.messageType === 'system'
        ? record.messageType
        : 'text',
    timestamp: record.timestamp,
    status:
      record.status === 'delivered' || record.status === 'read'
        ? record.status
        : 'sent',
  };
};

const parseConsultation = (value: unknown): VideoConsultation | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'number' ||
    typeof record.title !== 'string' ||
    !Array.isArray(record.participantIds) ||
    typeof record.scheduledAt !== 'string' ||
    typeof record.duration !== 'number'
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    participantIds: record.participantIds.filter((item): item is string => typeof item === 'string'),
    scheduledAt: record.scheduledAt,
    duration: record.duration,
    status:
      record.status === 'active' || record.status === 'completed' || record.status === 'cancelled'
        ? record.status
        : 'scheduled',
    ...(typeof record.meetingUrl === 'string' ? { meetingUrl: record.meetingUrl } : {}),
    ...(typeof record.notes === 'string' ? { notes: record.notes } : {}),
  };
};

export default function UniversalCommunication({
  profession,
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
}: UniversalCommunicationProps) {
  const { user } = useAuth();
  const theming = useTheming('photographer');
  const effectiveUserId = userId ?? user?.id ?? 'guest';
  const [tabValue, setTabValue] = useState(0);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [consultationDraft, setConsultationDraft] = useState<ConsultationDraft>({
    title: '',
    participants: '',
    scheduledAt: '',
    duration: 30,
    notes: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/communication/conversations', profession, effectiveUserId],
    enabled: Boolean(profession) && effectiveUserId !== 'guest',
    queryFn: async () => {
      const payload = await apiRequest(
        `/api/communication/conversations?profession=${profession}&userId=${effectiveUserId}`,
      );
      return parseArrayPayload(payload, parseConversation);
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['/api/communication/messages', selectedConversation?.id],
    enabled: selectedConversation !== null && effectiveUserId !== 'guest',
    queryFn: async () => {
      const payload = await apiRequest(`/api/communication/messages/${selectedConversation?.id}`);
      return parseArrayPayload(payload, parseMessage);
    },
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ['/api/communication/consultations', profession, effectiveUserId],
    enabled: Boolean(profession) && effectiveUserId !== 'guest',
    queryFn: async () => {
      const payload = await apiRequest(
        `/api/communication/consultations?profession=${profession}&userId=${effectiveUserId}`,
      );
      return parseArrayPayload(payload, parseConsultation);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { conversationId: number; content: string; messageType?: 'text' | 'file' }) =>
      apiRequest('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['/api/communication/messages', selectedConversation?.id],
      });

      if (selectedProject && onProjectUpdate) {
        onProjectUpdate({
          ...selectedProject,
          communicationEvent: 'message_sent',
          conversationId: selectedConversation?.id,
        });
      }

      if (onWorklogCreate && selectedConversation) {
        onWorklogCreate({
          type: 'communication',
          action: 'message_sent',
          conversationId: selectedConversation.id,
          profession,
        });
      }

      setNewMessage('');
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (payload: { title: string; participants: string[]; type: Conversation['type'] }) =>
      apiRequest('/api/communication/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations', profession, effectiveUserId] });
    },
  });

  const scheduleConsultationMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      participantIds: string[];
      scheduledAt: string;
      duration: number;
      notes?: string;
    }) =>
      apiRequest('/api/communication/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/communication/consultations', profession, effectiveUserId] });
      onMeetingCreate?.(variables);
      setShowVideoDialog(false);
      setConsultationDraft({
        title: '',
        participants: '',
        scheduledAt: '',
        duration: 30,
        notes: '',
      });
    },
  });

  useEffect(() => {
    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation || effectiveUserId === 'guest') {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/communication/${selectedConversation.id}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type?: string };
      if (payload.type === 'new_message') {
        void queryClient.invalidateQueries({
          queryKey: ['/api/communication/messages', selectedConversation.id],
        });
      }
    };

    return () => {
      wsRef.current?.close();
    };
  }, [effectiveUserId, selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations],
  );

  const formatTimestamp = (timestamp: string) =>
    new Date(timestamp).toLocaleString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });

  const handleSendMessage = () => {
    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: newMessage.trim(),
      messageType: 'text',
    });
  };

  const handleScheduleConsultation = () => {
    const participantIds = consultationDraft.participants
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!consultationDraft.title || !consultationDraft.scheduledAt || participantIds.length === 0) {
      return;
    }

    scheduleConsultationMutation.mutate({
      title: consultationDraft.title,
      participantIds,
      scheduledAt: consultationDraft.scheduledAt,
      duration: consultationDraft.duration,
      ...(consultationDraft.notes ? { notes: consultationDraft.notes } : {}),
    });
  };

  if (effectiveUserId === 'guest') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Message sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          Logg inn for å få tilgang til kommunikasjonssystemet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Chat, video-konsultasjoner og gruppediskusjoner krever innlogging.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            💬 Kommunikasjonssenter
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedProject && (
              <Chip
                label="Prosjekt koblet"
                size="small"
                onClick={() => onProjectSelect?.(selectedProject)}
                variant="outlined"
              />
            )}
            <Badge badgeContent={unreadCount} color="error">
              <Message />
            </Badge>
          </Box>
        </Box>

        <Tabs value={tabValue} onChange={(_event, next) => setTabValue(next)} sx={{ mt: 1 }}>
          <Tab label="Samtaler" />
          <Tab label="Video-konsultasjoner" />
          <Tab label="Grupper" />
        </Tabs>
      </Box>

      <Grid container sx={{ flexGrow: 1 }}>
        <Grid item xs={12} md={4} sx={{ borderRight: { md: 1 }, borderColor: 'divider' }}>
          {tabValue === 0 && (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              <Box sx={{ p: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() =>
                    createConversationMutation.mutate({
                      title: `${profession} samtale`,
                      participants: [effectiveUserId],
                      type: 'direct',
                    })
                  }
                >
                  Ny samtale
                </Button>
              </Box>

              {conversations.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    Ingen samtaler ennå.
                  </Typography>
                </Box>
              ) : (
                <List>
                  {conversations.map((conversation) => (
                    <ListItem key={conversation.id} disablePadding>
                      <ListItemButton
                        selected={selectedConversation?.id === conversation.id}
                        onClick={() => setSelectedConversation(conversation)}
                      >
                        <ListItemAvatar>
                          <Avatar>{conversation.type === 'group' ? 'G' : 'C'}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={conversation.title}
                          secondary={conversation.lastMessage}
                          primaryTypographyProps={{
                            fontWeight: conversation.unreadCount > 0 ? 600 : 400,
                          }}
                        />
                        {conversation.unreadCount > 0 && (
                          <Chip label={conversation.unreadCount} size="small" color="error" />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ p: 2 }}>
              <Button variant="contained" startIcon={<VideoCall />} fullWidth onClick={() => setShowVideoDialog(true)} sx={{ mb: 2 }}>
                Planlegg video-konsultasjon
              </Button>
              {consultations.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                  Ingen planlagte konsultasjoner.
                </Typography>
              ) : (
                consultations.map((consultation) => (
                  <Card key={consultation.id} sx={{ mb: 2 }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {consultation.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(consultation.scheduledAt)}
                      </Typography>
                      <Chip
                        label={consultation.status}
                        size="small"
                        color={consultation.status === 'active' ? 'success' : 'default'}
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          )}

          {tabValue === 2 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Gruppearbeid
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Opprett en ny gruppesamtale fra fanen "Samtaler" for å samle kunder og samarbeidspartnere.
              </Typography>
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={8}>
          {selectedConversation ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2 }}>{selectedConversation.type === 'group' ? 'G' : 'C'}</Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {selectedConversation.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedConversation.participants.join(', ')}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <IconButton>
                      <VideoCall />
                    </IconButton>
                    <IconButton>
                      <Phone />
                    </IconButton>
                    <IconButton>
                      <MoreVert />
                    </IconButton>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      Ingen meldinger ennå.
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => (
                    <Box key={message.id} sx={{ mb: 2 }}>
                      <Paper
                        sx={{
                          p: 2,
                          maxWidth: '70%',
                          ml: message.senderId === effectiveUserId ? 'auto' : 0,
                          bgcolor:
                            message.senderId === effectiveUserId ? 'primary.main' : 'background.paper',
                          color:
                            message.senderId === effectiveUserId
                              ? 'primary.contrastText'
                              : 'text.primary',
                          ...theming.getThemedCardSx(),
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                          {message.senderName}
                        </Typography>
                        <Typography variant="body1">{message.content}</Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mt: 1,
                          }}
                        >
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {formatTimestamp(message.timestamp)}
                          </Typography>
                          {message.senderId === effectiveUserId && (
                            <CheckCircle sx={{ fontSize: 16, opacity: 0.7 }} />
                          )}
                        </Box>
                      </Paper>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton>
                    <AttachFile />
                  </IconButton>
                  <TextField
                    fullWidth
                    multiline
                    maxRows={3}
                    placeholder="Skriv en melding..."
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <IconButton
                    color="primary"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Message />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <Box>
                <Message sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  Velg en samtale for å begynne
                </Typography>
              </Box>
            </Box>
          )}
        </Grid>
      </Grid>

      <Dialog open={showVideoDialog} onClose={() => setShowVideoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Planlegg video-konsultasjon</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tittel"
            value={consultationDraft.title}
            onChange={(event) =>
              setConsultationDraft((previous) => ({ ...previous, title: event.target.value }))
            }
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Deltakere (komma-separert)"
            value={consultationDraft.participants}
            onChange={(event) =>
              setConsultationDraft((previous) => ({ ...previous, participants: event.target.value }))
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="datetime-local"
            label="Tidspunkt"
            value={consultationDraft.scheduledAt}
            onChange={(event) =>
              setConsultationDraft((previous) => ({ ...previous, scheduledAt: event.target.value }))
            }
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            type="number"
            label="Varighet (minutter)"
            value={consultationDraft.duration}
            onChange={(event) =>
              setConsultationDraft((previous) => ({
                ...previous,
                duration: Math.max(15, Number(event.target.value) || 30),
              }))
            }
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notater"
            value={consultationDraft.notes}
            onChange={(event) =>
              setConsultationDraft((previous) => ({ ...previous, notes: event.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVideoDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={<VideoCall />}
            onClick={handleScheduleConsultation}
            disabled={scheduleConsultationMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            Planlegg konsultasjon
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
