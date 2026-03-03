/**
 * Enhanced Chat Widget with Smart Response Integration
 * Floating communication widget for internal/customer messaging.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Fab,
  IconButton,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add,
  Chat as ChatIcon,
  Close,
  Send,
  SmartToy,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type IntegrationPayload = Record<string, unknown>;

interface ChatMessage {
  id: string;
  content: string;
  sender: 'customer' | 'photographer';
  timestamp: Date;
  leadId?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  participantName?: string;
  updatedAt?: string;
  unreadCount?: number;
}

interface ChatWidgetProps {
  userId: string;
  position?: 'bottom-right' | 'bottom-left';
  enableSmartSuggestions?: boolean;
  defaultExpanded?: boolean;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  onMeetingCreate?: (meeting: IntegrationPayload) => void;
  onProjectUpdate?: (project: IntegrationPayload) => void;
  onWorklogCreate?: (worklog: IntegrationPayload) => void;
  onClientSelect?: (client: IntegrationPayload) => void;
  onClientUpdate?: (client: IntegrationPayload) => void;
  onShowcaseCreate?: (showcase: IntegrationPayload) => void;
  onFileUpload?: (file: IntegrationPayload) => void;
  onFileDownload?: (file: IntegrationPayload) => void;
  selectedProject?: IntegrationPayload;
  onProjectSelect?: (project: IntegrationPayload) => void;
  selectedClient?: IntegrationPayload;
  onSettingsUpdate?: (settings: IntegrationPayload) => void;
  onNotificationCreate?: (notification: IntegrationPayload) => void;
}

function parseConversationList(payload: unknown): ConversationItem[] {
  if (Array.isArray(payload)) {
    return payload as ConversationItem[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: ConversationItem[] }).data;
  }

  return [];
}

function parseMessages(payload: unknown): ChatMessage[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];

  return source
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `message-${index}`,
      content: typeof item.content === 'string' ? item.content : '',
      sender:
        typeof item.sender === 'string' && item.sender === 'customer'
          ? 'customer'
          : typeof item.senderType === 'string' && item.senderType === 'customer'
            ? 'customer'
            : 'photographer',
      timestamp: item.timestamp ? new Date(String(item.timestamp)) : new Date(),
      leadId: typeof item.leadId === 'string' ? item.leadId : undefined,
    }))
    .filter((message) => message.content.length > 0);
}

function maybeExecuteSlashCommand(
  input: string,
  handlers: {
    onMeetingCreate?: (meeting: IntegrationPayload) => void;
    onProjectUpdate?: (project: IntegrationPayload) => void;
    onWorklogCreate?: (worklog: IntegrationPayload) => void;
    onClientSelect?: (client: IntegrationPayload) => void;
    onClientUpdate?: (client: IntegrationPayload) => void;
    onShowcaseCreate?: (showcase: IntegrationPayload) => void;
    onFileUpload?: (file: IntegrationPayload) => void;
    onFileDownload?: (file: IntegrationPayload) => void;
    onProjectSelect?: (project: IntegrationPayload) => void;
    onSettingsUpdate?: (settings: IntegrationPayload) => void;
    onNotificationCreate?: (notification: IntegrationPayload) => void;
  },
): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }

  const [command, ...parts] = trimmed.slice(1).split(' ');
  const detail = parts.join(' ').trim();

  if (command === 'meeting' && handlers.onMeetingCreate) {
    handlers.onMeetingCreate({ title: detail || 'Quick meeting request' });
    return true;
  }
  if (command === 'project' && handlers.onProjectUpdate) {
    handlers.onProjectUpdate({ update: detail || 'Project update from chat' });
    return true;
  }
  if (command === 'worklog' && handlers.onWorklogCreate) {
    handlers.onWorklogCreate({ note: detail || 'Worklog created from chat' });
    return true;
  }
  if (command === 'client' && handlers.onClientUpdate) {
    const payload = { note: detail || 'Client update from chat' };
    handlers.onClientUpdate(payload);
    handlers.onClientSelect?.(payload);
    return true;
  }
  if (command === 'showcase' && handlers.onShowcaseCreate) {
    handlers.onShowcaseCreate({ summary: detail || 'Showcase action from chat' });
    return true;
  }
  if (command === 'upload' && handlers.onFileUpload) {
    handlers.onFileUpload({ filename: detail || 'upload-placeholder' });
    return true;
  }
  if (command === 'download' && handlers.onFileDownload) {
    handlers.onFileDownload({ filename: detail || 'download-placeholder' });
    return true;
  }
  if (command === 'select-project' && handlers.onProjectSelect) {
    handlers.onProjectSelect({ id: detail || 'project-from-chat' });
    return true;
  }
  if (command === 'settings' && handlers.onSettingsUpdate) {
    handlers.onSettingsUpdate({ value: detail || 'chat-settings-updated' });
    return true;
  }
  if (command === 'notify' && handlers.onNotificationCreate) {
    handlers.onNotificationCreate({ message: detail || 'Chat notification' });
    return true;
  }

  return false;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  userId,
  position = 'bottom-right',
  enableSmartSuggestions = true,
  defaultExpanded = false,
  profession = 'photographer',
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [open, setOpen] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  const { data: conversations = [] } = useQuery({
    queryKey: ['communication-conversations', userId],
    queryFn: async () => {
      const payload = await apiRequest(`/api/communication/conversations?userId=${userId}`);
      return parseConversationList(payload);
    },
    refetchInterval: 10_000,
  });

  const { data: conversationMessages = [] } = useQuery({
    queryKey: ['communication-messages', activeConversationId],
    enabled: Boolean(activeConversationId),
    queryFn: async () => {
      const payload = await apiRequest(`/api/communication/conversations/${activeConversationId}/messages`);
      return parseMessages(payload);
    },
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  const messages = useMemo(() => {
    if (localMessages.length === 0) {
      return conversationMessages;
    }
    return [...conversationMessages, ...localMessages];
  }, [conversationMessages, localMessages]);

  const unreadCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0),
    [conversations],
  );

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content) {
      return;
    }

    const handledByCommand = maybeExecuteSlashCommand(content, {
      onMeetingCreate,
      onProjectUpdate,
      onWorklogCreate,
      onClientSelect,
      onClientUpdate,
      onShowcaseCreate,
      onFileUpload,
      onFileDownload,
      onProjectSelect,
      onSettingsUpdate,
      onNotificationCreate,
    });

    if (!handledByCommand && activeConversationId) {
      try {
        await apiRequest(`/api/communication/conversations/${activeConversationId}/messages`, {
          method: 'POST',
          body: {
            content,
            senderId: userId,
            senderType: 'photographer',
          },
        });
      } catch {
        // Keep local fallback message to avoid losing user input when API fails.
      }
    }

    setLocalMessages((previous) => [
      ...previous,
      {
        id: `local-${Date.now()}`,
        content,
        sender: 'photographer',
        timestamp: new Date(),
      },
    ]);
    setDraft('');
  };

  const quickSuggestions = useMemo(() => {
    if (!enableSmartSuggestions) {
      return [] as string[];
    }

    const base = ['Takk for meldingen! Jeg følger opp straks.', 'Kan du dele ønsket leveringsdato?', 'Skal jeg sette opp et tilbud?'];

    if (profession === 'photographer') {
      return [...base, 'Ønsker du forslag til foto-pakker?'];
    }
    if (profession === 'videographer') {
      return [...base, 'Skal vi avklare lengde og format på videoen?'];
    }
    if (profession === 'music_producer') {
      return [...base, 'Vil du at vi starter med demo-utkast?'];
    }
    return base;
  }, [enableSmartSuggestions, profession]);

  const floatingPosition = position === 'bottom-left' ? { left: 20 } : { right: 20 };

  if (!open) {
    return (
      <Fab
        color="primary"
        onClick={() => setOpen(true)}
        sx={{ position: 'fixed', bottom: 20, zIndex: 1200, ...floatingPosition }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <ChatIcon />
        </Badge>
      </Fab>
    );
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 20,
        width: isMobile ? 'calc(100vw - 24px)' : 430,
        height: isMobile ? '70vh' : 560,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...floatingPosition,
      }}
    >
      <Box sx={{ p: 1.25, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <ChatIcon fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Chat Widget
            </Typography>
            <Chip label={`${unreadCount} unread`} size="small" />
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="New conversation">
              <IconButton size="small" color="inherit">
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton size="small" color="inherit" onClick={() => setOpen(false)}>
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
        <Tab label="Conversations" />
        <Tab label="Smart Replies" icon={<SmartToy fontSize="small" />} iconPosition="start" />
      </Tabs>

      <Divider />

      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Box sx={{ width: 150, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto' }}>
            <List dense disablePadding>
              {conversations.map((conversation) => (
                <ListItemButton
                  key={conversation.id}
                  selected={activeConversationId === conversation.id}
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <ListItemText
                    primary={conversation.title || conversation.participantName || 'Conversation'}
                    secondary={conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString('nb-NO') : ''}
                    primaryTypographyProps={{ noWrap: true }}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {selectedProject ? <Chip size="small" label="Project linked" /> : null}
                {selectedClient ? <Chip size="small" label="Client linked" /> : null}
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 1.25 }}>
              <Stack spacing={1.25}>
                {messages.map((message) => (
                  <Card
                    key={message.id}
                    variant="outlined"
                    sx={{
                      maxWidth: '85%',
                      alignSelf: message.sender === 'photographer' ? 'flex-end' : 'flex-start',
                      bgcolor: message.sender === 'photographer' ? 'primary.50' : 'background.paper',
                    }}
                  >
                    <CardContent sx={{ p: '8px 10px !important' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Avatar sx={{ width: 22, height: 22 }}>
                          {message.sender === 'photographer' ? 'Y' : 'C'}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">
                          {message.timestamp.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Stack>
                      <Typography variant="body2">{message.content}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ p: 1.25 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Write a message or /command"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <Button variant="contained" onClick={() => void sendMessage()} startIcon={<Send fontSize="small" />}>
                  Send
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Smart Suggestions
          </Typography>
          <Stack spacing={1}>
            {quickSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outlined"
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                onClick={() => setDraft(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </Stack>

          <Alert severity="info" sx={{ mt: 1.5 }}>
            Pro tip: use commands like <strong>/meeting</strong>, <strong>/project</strong>, or <strong>/notify</strong> to trigger connected workflows.
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default ChatWidget;
