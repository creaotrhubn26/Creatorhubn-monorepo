// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AttachFile as AttachIcon,
  Notifications as NotificationsIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
  Send as SendIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  kind: 'text' | 'file' | 'system';
  conversationId: string;
  readBy: string[];
}

interface Conversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  participantIds: string[];
  unreadCount: number;
  lastMessage?: Message;
}

interface UniversalCommunicationProps {
  userId?: string;
  userType?: string;
  sessionId?: string;
}

const STORAGE_KEY_PREFIX = 'creatorhub:communication:';

function createSeedConversations(userId: string): Conversation[] {
  const welcomeMessage: Message = {
    id: `msg-welcome-${userId}`,
    senderId: 'system',
    senderName: 'CreatorHub',
    content: 'Velkommen til kommunikasjonssenteret. Start en samtale for samarbeid.',
    createdAt: new Date().toISOString(),
    kind: 'system',
    conversationId: 'conversation-welcome',
    readBy: [userId],
  };

  return [
    {
      id: 'conversation-welcome',
      name: 'Team Oppstart',
      type: 'group',
      participantIds: [userId, 'system'],
      unreadCount: 0,
      lastMessage: welcomeMessage,
    },
  ];
}

function createMessageStorage(conversations: Conversation[]): Record<string, Message[]> {
  const result: Record<string, Message[]> = {};
  for (const conversation of conversations) {
    result[conversation.id] = conversation.lastMessage ? [conversation.lastMessage] : [];
  }
  return result;
}

function useOptionalMasterIntegration() {
  try {
    return useEnhancedMasterIntegration();
  } catch {
    return null;
  }
}

export default function UniversalCommunication({
  userId = 'local-user',
  userType = 'photographer',
  sessionId,
}: UniversalCommunicationProps) {
  const integration = useOptionalMasterIntegration();
  const { pushEnabled, isSupported, toggle, isLoading: pushLoading } = usePushNotifications(userId);

  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
  const [conversations, setConversations] = useState<Conversation[]>(() => createSeedConversations(userId));
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>(() =>
    createMessageStorage(createSeedConversations(userId)),
  );
  const [selectedConversationId, setSelectedConversationId] = useState<string>('conversation-welcome');
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newConversationName, setNewConversationName] = useState('');
  const [newConversationType, setNewConversationType] = useState<'direct' | 'group'>('direct');
  const [showPushDialog, setShowPushDialog] = useState(false);

  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        conversations: Conversation[];
        messagesByConversation: Record<string, Message[]>;
      };

      if (Array.isArray(parsed.conversations) && parsed.messagesByConversation) {
        setConversations(parsed.conversations);
        setMessagesByConversation(parsed.messagesByConversation);

        if (parsed.conversations.length > 0) {
          setSelectedConversationId(parsed.conversations[0].id);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        conversations,
        messagesByConversation,
      }),
    );
  }, [conversations, messagesByConversation, storageKey]);

  useEffect(() => {
    if (!integration) {
      return;
    }

    integration.componentRegistry.register('universal-communication', {
      capabilities: ['chat', 'messaging', 'notifications'],
      componentCategory: 'communication',
      dataNodes: ['messages', 'conversations'],
    });

    return () => {
      integration.componentRegistry.unregister('universal-communication');
    };
  }, [integration]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, messagesByConversation]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const selectedMessages = useMemo(
    () => messagesByConversation[selectedConversationId] ?? [],
    [messagesByConversation, selectedConversationId],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        conversation.name.toLowerCase().includes(normalizedSearch) ||
        conversation.lastMessage?.content.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (tabIndex === 1) {
        return conversation.unreadCount > 0;
      }

      if (tabIndex === 2) {
        return conversation.type === 'group';
      }

      return true;
    });
  }, [conversations, searchQuery, tabIndex]);

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations],
  );

  const appendSystemMessage = (conversationId: string, content: string) => {
    const message: Message = {
      id: `msg-system-${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      content,
      createdAt: new Date().toISOString(),
      kind: 'system',
      conversationId,
      readBy: [userId],
    };

    setMessagesByConversation((previous) => ({
      ...previous,
      [conversationId]: [...(previous[conversationId] ?? []), message],
    }));

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              lastMessage: message,
            }
          : conversation,
      ),
    );
  };

  const sendMessage = () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selectedConversationId) {
      return;
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: userId,
      senderName: userType,
      content: trimmed,
      createdAt: new Date().toISOString(),
      kind: 'text',
      conversationId: selectedConversationId,
      readBy: [userId],
    };

    setMessagesByConversation((previous) => ({
      ...previous,
      [selectedConversationId]: [...(previous[selectedConversationId] ?? []), message],
    }));

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              lastMessage: message,
            }
          : conversation,
      ),
    );

    setNewMessage('');
  };

  const onSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              unreadCount: 0,
            }
          : conversation,
      ),
    );
  };

  const createConversation = () => {
    const trimmedName = newConversationName.trim();
    if (!trimmedName) {
      return;
    }

    const createdConversation: Conversation = {
      id: `conversation-${Date.now()}`,
      name: trimmedName,
      type: newConversationType,
      participantIds: [userId, `session-${sessionId ?? 'default'}`],
      unreadCount: 0,
    };

    const createdMessage: Message = {
      id: `msg-created-${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      content: `Samtalen "${trimmedName}" ble opprettet.`,
      createdAt: new Date().toISOString(),
      kind: 'system',
      conversationId: createdConversation.id,
      readBy: [userId],
    };

    setConversations((previous) => [
      {
        ...createdConversation,
        lastMessage: createdMessage,
      },
      ...previous,
    ]);

    setMessagesByConversation((previous) => ({
      ...previous,
      [createdConversation.id]: [createdMessage],
    }));

    setSelectedConversationId(createdConversation.id);
    setShowNewDialog(false);
    setNewConversationName('');
    setNewConversationType('direct');
  };

  const onAttachFileClick = () => {
    hiddenFileInputRef.current?.click();
  };

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversationId) {
      return;
    }

    appendSystemMessage(
      selectedConversationId,
      `Fil vedlagt: ${file.name} (${Math.round(file.size / 1024)} KB).`,
    );

    event.target.value = '';
  };

  const onStartVideoCall = () => {
    if (!selectedConversationId) {
      return;
    }

    appendSystemMessage(selectedConversationId, 'Videosamtale startet.');
  };

  const onStartPhoneCall = () => {
    if (!selectedConversationId) {
      return;
    }

    appendSystemMessage(selectedConversationId, 'Telefonsamtale startet.');
  };

  const onTogglePush = async () => {
    await toggle();
  };

  return (
    <Paper sx={{ p: 2, height: '100%', minHeight: 560 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Kommunikasjon</Typography>
          <Typography variant="body2" color="text.secondary">
            Rolle: {userType}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Badge color="error" badgeContent={unreadTotal} max={99}>
            <NotificationsIcon />
          </Badge>

          {isSupported ? (
            <Tooltip title={pushEnabled ? 'Push-varsler er aktivert' : 'Push-varsler er deaktivert'}>
              <Button
                size="small"
                variant={pushEnabled ? 'contained' : 'outlined'}
                onClick={onTogglePush}
                disabled={pushLoading}
              >
                {pushLoading ? 'Oppdaterer...' : pushEnabled ? 'Push På' : 'Push Av'}
              </Button>
            </Tooltip>
          ) : (
            <Chip size="small" label="Push ikke støttet" />
          )}

          <Button size="small" variant="outlined" onClick={() => setShowPushDialog(true)}>
            Innstillinger
          </Button>
          <Button size="small" variant="contained" onClick={() => setShowNewDialog(true)}>
            Ny samtale
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 2, height: 'calc(100% - 72px)' }}>
        <Paper variant="outlined" sx={{ p: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TextField
            size="small"
            placeholder="Søk i samtaler"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />

          <Tabs value={tabIndex} onChange={(_, value: number) => setTabIndex(value)} variant="fullWidth" sx={{ mb: 1 }}>
            <Tab label="Alle" />
            <Tab label="Ulest" />
            <Tab label="Grupper" />
          </Tabs>

          <List sx={{ overflowY: 'auto', flex: 1 }}>
            {filteredConversations.map((conversation) => (
              <ListItemButton
                key={conversation.id}
                selected={conversation.id === selectedConversationId}
                onClick={() => onSelectConversation(conversation.id)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <Badge color="error" badgeContent={conversation.unreadCount} max={99}>
                  <Avatar sx={{ width: 30, height: 30 }}>{conversation.name.charAt(0).toUpperCase()}</Avatar>
                </Badge>

                <ListItemText
                  sx={{ ml: 1 }}
                  primary={conversation.name}
                  secondary={conversation.lastMessage?.content ?? 'Ingen meldinger ennå'}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="subtitle1">{selectedConversation?.name ?? 'Ingen samtale valgt'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedConversation?.type === 'group' ? 'Gruppesamtale' : 'Direktemelding'}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <IconButton size="small" onClick={onStartPhoneCall}>
                  <PhoneIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={onStartVideoCall}>
                  <VideoCallIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
            {selectedMessages.length === 0 ? (
              <Alert severity="info">Ingen meldinger i samtalen ennå.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {selectedMessages.map((message) => {
                  const isMine = message.senderId === userId;

                  return (
                    <Box key={message.id} sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      <Card
                        variant="outlined"
                        sx={{
                          maxWidth: '70%',
                          borderColor: isMine ? 'primary.main' : 'divider',
                          backgroundColor: isMine ? 'primary.light' : 'background.paper',
                        }}
                      >
                        <CardContent sx={{ py: 1, px: 1.25, '&:last-child': { pb: 1 } }}>
                          <Typography variant="body2">{message.content}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {message.senderName} · {format(new Date(message.createdAt), 'HH:mm', { locale: nb })}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>
                  );
                })}
                <div ref={scrollRef} />
              </Stack>
            )}
          </Box>

          <Divider />

          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                minRows={1}
                maxRows={4}
                value={newMessage}
                placeholder="Skriv en melding"
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={onAttachFileClick}>
                        <AttachIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <IconButton color="primary" onClick={sendMessage} disabled={newMessage.trim().length === 0}>
                <SendIcon />
              </IconButton>
            </Stack>

            <input
              ref={hiddenFileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={onFileSelected}
              aria-label="Legg ved fil"
            />
          </Box>
        </Paper>
      </Box>

      <Dialog open={showNewDialog} onClose={() => setShowNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett ny samtale</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Tabs
              value={newConversationType === 'direct' ? 0 : 1}
              onChange={(_, value: number) => setNewConversationType(value === 0 ? 'direct' : 'group')}
            >
              <Tab label="Direkte" />
              <Tab label="Gruppe" />
            </Tabs>

            <TextField
              label={newConversationType === 'direct' ? 'Mottaker' : 'Gruppenavn'}
              value={newConversationName}
              onChange={(event) => setNewConversationName(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewDialog(false)}>Avbryt</Button>
          <Button onClick={createConversation} variant="contained" disabled={newConversationName.trim().length === 0}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPushDialog} onClose={() => setShowPushDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Push-varselinnstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <PushNotificationSettings userId={userId} showDescription />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPushDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
