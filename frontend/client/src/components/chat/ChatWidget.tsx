import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import ChatWidgetErrorBoundary from './ChatWidgetErrorBoundary';
import {
  Fab,
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Badge,
  Chip,
  Paper,
  Button,
  Tooltip,
  Slide,
  Tab,
  Tabs,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import {
  Chat,
  Close,
  Send,
  AttachFile as AttachDescription,
  EmojiEmotions,
  Person,
  Google,
  Groups,
  AddCircle as Add,
  MoreVert,
  AlternateEmail,
  VideoCall as VideocamCall,
} from '@mui/icons-material';

interface ChatWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

interface ChatContact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastMessage?: string;
  unreadCount?: number;
  type: 'client' | 'team' | 'support' | 'google_chat'
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'file' | 'image';
  status: 'sent' | 'delivered' | 'read'
}

interface ConversationRecord {
  id: string;
  contactName?: string;
  contactEmail?: string;
  status?: ChatContact['status'];
  lastMessage?: string;
  unreadCount?: number;
  type?: Exclude<ChatContact['type'], 'google_chat'>;
}

interface ConversationsResponse {
  conversations?: ConversationRecord[];
}

interface GoogleChatSpaceRecord {
  name: string;
  displayName?: string;
  spaceDetails?: {
    description?: string;
  };
  lastMessage?: {
    text?: string;
  };
}

interface GoogleChatSpacesResponse {
  spaces?: GoogleChatSpaceRecord[];
}

interface ChatMessagesResponse {
  messages?: ChatMessage[];
}

const UpwardSlide = React.forwardRef(function UpwardSlide(
  props: TransitionProps & {
    children: React.ReactElement<unknown>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function ChatWidget({
  position = 'bottom-right',
  profession = 'photographer',
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [tabValue, setTabValue] = useState(0); // 0 = Internal Chat, 1 = Google Chat
  const [isPageVisible, setIsPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming(profession);

  // CRM suggestion system states - SAME AS FULLSCREEN
  const [needsHelpMessage, setNeedsHelpMessage] = useState<any>(null);
  const [showHelpIndicator, setShowHelpIndicator] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get profession color - SAME AS FULLSCREEN
  const getProfessionColor = useCallback(() => {
    switch (profession) {
      case 'photographer':
        return '#ff8c00';
      case 'videographer':
        return '#e74c3c';
      case 'music_producer':
        return '#9b59b6';
      case 'vendor':
        return '#27ae60';
      default: return '#ff8c00';
    }
  }, [profession]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const conversationRefetchInterval = isPageVisible ? 10000 : 30000;
  const messageRefetchInterval = isPageVisible ? 2000 : 7000;

  // Fetch internal conversations - SAME AS FULLSCREEN
  const { data: conversationsResponse } = useQuery<ConversationsResponse>({
    queryKey: ['/api/communication/conversations'],
    queryFn: () => apiRequest('/api/communication/conversations'),
    enabled: open && tabValue === 0,
    refetchInterval: open && tabValue === 0 ? conversationRefetchInterval : false,
  });

  const contacts: ChatContact[] = (conversationsResponse?.conversations || []).map((conv) => ({
    id: conv.id,
    name: conv.contactName || 'Unknown Contact',
    email: conv.contactEmail || 'ukjent@creatorhub.no',
    status: conv.status || 'offline',
    lastMessage: conv.lastMessage || 'No messages',
    unreadCount: conv.unreadCount || 0,
    type: conv.type || 'client',
  }));

  // Fetch Google Chat spaces
  const { data: googleSpacesResponse } = useQuery<GoogleChatSpacesResponse>({
    queryKey: ['/api/google/chat/spaces'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google/chat/spaces', { headers });
    },
    enabled: open && tabValue === 1,
    refetchInterval: open && tabValue === 1 ? conversationRefetchInterval : false,
  });

  const googleSpaces: ChatContact[] = (googleSpacesResponse?.spaces || []).map((space) => ({
    id: space.name,
    name: space.displayName || 'Google Chat Space',
    email: space.spaceDetails?.description || 'Google Chat',
    status: 'online',
    lastMessage: space.lastMessage?.text || 'Ny Google Chat',
    unreadCount:  0,
    type: 'google_chat',
}));

  // Fetch messages for selected contact - SAME AS FULLSCREEN
  const { data: messagesResponse } = useQuery<ChatMessagesResponse | null>({
    queryKey: ['/api/communication/messages', selectedContact?.id],
    queryFn: () =>
      selectedContact?.id
        ? apiRequest(`/api/communication/messages/${selectedContact.id}`)
        : Promise.resolve(null),
    enabled: !!selectedContact && tabValue === 0,
    refetchInterval: selectedContact && tabValue === 0 ? messageRefetchInterval : false,
  });

  // Fetch Google Chat messages
  const { data: googleMessagesResponse } = useQuery<ChatMessagesResponse | null>({
    queryKey: ['/api/google/chat/messages', selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact?.id) return null;
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google/chat/messages?space=${selectedContact.id}`, { headers });
    },
    enabled: !!selectedContact && tabValue === 1 && selectedContact.type === 'google_chat',
    refetchInterval: selectedContact && tabValue === 1 ? messageRefetchInterval : false,
  });

  const messages: ChatMessage[] =
    tabValue === 0 ? messagesResponse?.messages || [] : googleMessagesResponse?.messages || [];
  const visibleContacts: ChatContact[] = tabValue === 0 ? contacts : googleSpaces;

  // Send message mutation - SAME AS FULLSCREEN
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      return apiRequest('/api/communication/send-message', {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/communication/messages'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/communication/conversations'],
      });
      setMessageInput('');
    },
  });

  // CRM Analysis Mutation - SAME AS FULLSCREEN
  const analyzeMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      return apiRequest('/api/chat-suggestions/analyze', {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
    },
    onSuccess: (data) => {
      if (data?.suggestions?.length > 0) {
        setShowSuggestions(true);
      }
    },
  });

  // Smart help indicator logic - SAME AS FULLSCREEN
  useEffect(() => {
    if (messages.length > 0) {
      // Find the last customer message (not from current user)
      const customerMessages = messages.filter((msg) => msg.senderId !== 'current-user');
      const lastCustomerMessage = customerMessages[customerMessages.length - 1];

      if (lastCustomerMessage) {
        // Check if message might need help responding to
        const needsHelp = checkIfNeedsHelpResponding(lastCustomerMessage.content);
        if (needsHelp) {
          setNeedsHelpMessage(lastCustomerMessage);
          setShowHelpIndicator(true);
      } else {
          setShowHelpIndicator(false);
          setNeedsHelpMessage(null);
      }
    }
  }
}, [messages]);

  // Check if user might need help responding - SAME AS FULLSCREEN
  const checkIfNeedsHelpResponding = (content: string): boolean => {
    const helpTriggers = [
      'pris','kost','betaling','pakke','tilbud','når','tid','ledig','dato','booking','inkludert','levering','hvordan','hvor','kan du','mulig å','rabatt','kampanje',
    ];

    const lowerContent = content.toLowerCase();
    return helpTriggers.some((trigger) => lowerContent.includes(trigger));
  };

  // Manual CRM activation - SAME AS FULLSCREEN
  const analyzeCustomerMessages = () => {
    if (needsHelpMessage) {
      analyzeMessageMutation.mutate({
        messages: [needsHelpMessage],
        profession: profession,
        context: 'customer_inquiry',
    });
  }
};

  // Message input change handler - SAME AS FULLSCREEN
  const handleMessageInputChange = (value: string) => {
    setMessageInput(value);
};

  // Google Chat mutation
  const sendGoogleChatMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google/chat/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(messageData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/google/chat/messages'],
      });
      setMessageInput('');
    },
  });

  // Create Google Chat space mutation
  const createGoogleSpaceMutation = useMutation({
    mutationFn: async (spaceData: any) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google/chat/create-space', {
        method: 'POST',
        headers,
        body: JSON.stringify(spaceData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
    },
  });

  // Send message handler
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;

    if (tabValue === 0) {
      // Internal chat
      sendMessageMutation.mutate({
        contactId: selectedContact.id,
        content: messageInput,
        type: 'text',
      });
    } else if (tabValue === 1 && selectedContact.type === 'google_chat') {
      // Google Chat
      sendGoogleChatMutation.mutate({
        space: selectedContact.id,
        message: messageInput,
      });
    }
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSelectedContact(null); // Clear selection when switching tabs
};

  // Handle menu actions
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
};

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
};

  const handleMentionUser = () => {
    if (!selectedContact) return;
    const mention = `@${selectedContact.name.split(' ')[0]}`;
    setMessageInput((prev) => `${prev}${prev ? ' ' : ''}${mention} `);
    handleMenuClose();
  };

  const handleStartMeet = () => {
    window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer');
    handleMenuClose();
  };

  // Create new Google Chat space
  const handleCreateGoogleSpace = () => {
    createGoogleSpaceMutation.mutate({
      displayName: 'Nytt prosjekt-team',
      spaceType: 'SPACE',
      threaded: true,
    });
    handleMenuClose();
  };

  // Key press handler
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
}
};

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth',});
}, [messages]);

  // Format time
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
  });
};

  const positionStyles = {
    position: 'fixed' as const,
    bottom: 16,
    zIndex: 1200,
    ...(position === 'bottom-right' ? { right: 24 } : { left: 24 }),
  };

  return (
    <ChatWidgetErrorBoundary widgetName="ChatWidget">
      <>
      {/* Chat Bubble Button */}
      <Fab
        sx={{
          ...positionStyles,
          bgcolor: getProfessionColor(), '&:hover': { bgcolor: getProfessionColor(),},
          width:  70,
          height:  70,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'}}
        onClick={() => setOpen(true)}
      >
        <Badge
          badgeContent={contacts.reduce((acc, contact) => acc + (contact.unreadCount || 0), 0)}
          color="error"
          max={99}
        >
          <Chat sx={{ fontSize:  28, color: 'white'}} />
        </Badge>
      </Fab>

      {/* UPDATED Chat Dialog with Google Chat Integration */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh',
            height: '700px',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.97), rgba(248,250,252,0.98))',
            backdropFilter: 'blur(10px)',
        }}}
        TransitionComponent={UpwardSlide}
      >
        <DialogTitle
          sx={{
            p: 0,
            borderBottom: '1px solid rgba(255,255,255,0.18)',
            background: `linear-gradient(132deg, ${getProfessionColor()} 0%, rgba(15,23,42,0.92) 130%)`,
            color: 'white',
          }}
        >
          {/* HEADER WITH TABS INTEGRATED */}
          <Box
          sx={{
            p: 2,
            pb: 1.25,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1.25,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <Chat sx={{ fontSize: 28}} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Google Chat Integration v2.1
              </Typography>
              <Chip
                label={tabValue === 0 ? 'CREATORHUB' : 'GOOGLE CHAT'}
                size="small"
                sx={{
                  bgcolor: tabValue === 0 ? 'rgba(251,146,60,0.95)' : 'rgba(66,133,244,0.95)',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              {tabValue === 1 && (
                <IconButton
                  onClick={handleMenuClick}
                  sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                  size="small"
                >
                  <MoreVert />
                </IconButton>
              )}
              <IconButton
                onClick={() => setOpen(false)}
                sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                size="small"
              >
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* PROMINENT TABS */}
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTabs-root': {
                minHeight: 60,
              },
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.75)',
                minHeight: 60,
                fontSize: '1rem',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 2,
                mx: 0.5,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                },
              },
              '& .Mui-selected': {
                color: 'white !important',
                bgcolor: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.55)',
              },
              '& .MuiTabs-indicator': {
                display: 'none',
              },
            }}
          >
            <Tab
              icon={<Chat sx={{ fontSize: 24}} />}
              label="INTERN CHAT"
              iconPosition="start"
              sx={{ textTransform: 'none'}}
            />
            <Tab
              icon={<Google sx={{ fontSize: 24}} />}
              label="GOOGLE CHAT"
              iconPosition="start"
              sx={{ textTransform: 'none'}}
            />
          </Tabs>
        </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, height: 500}}>
          <Box sx={{ display: 'flex', height: '100%'}}>
            {/* Contact List */}
            <Box
              sx={{
                width: 320,
                borderRight:  1,
                borderColor: 'divider',
                bgcolor: 'rgba(248, 250, 252, 0.95)',
              }}
            >
              <List sx={{ py:  0 }}>
                {visibleContacts.map((contact) => (
                  <ListItem
                    key={contact.id}
                    disablePadding
                    sx={{
                      '&.Mui-selected': {
                        bgcolor: `${getProfessionColor()}20`,
                    }}}
                  >
                    <ListItemButton
                      selected={selectedContact?.id === contact.id}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: contact.type === 'google_chat' ? '#4285F4' : getProfessionColor(),
                            width:  32,
                            height:  32}}
                        >
                          {contact.type === 'google_chat' ? (
                            <Google sx={{ fontSize:  18, color: 'white'}} />
                          ) : (
                            contact.name.charAt(0)
                          )}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5}}
                          >
                            <Typography variant="subtitle2" sx={{ flex:  1 }}>
                              {contact.name}
                            </Typography>
                            {(contact.unreadCount ?? 0) > 0 && (
                              <Badge badgeContent={contact.unreadCount} color="error" />
                            )}
                            {contact.type === 'google_chat' && (
                              <Chip
                                label="Google"
                                size="small"
                                sx={{
                                  height:  16,
                                  fontSize: '0.6rem',
                                  bgcolor: '#4285F0',
                                  color: 'white'}}
                              />
                            )}
                          </Box>
                      }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {typeof contact.lastMessage === 'string'
                              ? contact.lastMessage.slice(0, 20)
                              : 'Ny samtale'}
                            ...
                          </Typography>
                      }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}

                {/* Empty state */}
                {visibleContacts.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center'}}>
                    <Typography variant="caption" color="text.secondary">
                      {tabValue === 0 ? 'Ingen samtaler ennå' : 'Ingen Google Chat-rom'}
                    </Typography>
                    {tabValue === 1 && (
                      <Button
                        startIcon={<Add />}
                        size="small"
                        onClick={handleCreateGoogleSpace}
                        sx={{ mt: 1, display: 'block'}}
                      >
                        Opprett Chat-rom
                      </Button>
                    )}
                  </Box>
                )}
              </List>
            </Box>

            {/* Chat Area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column'}}>
              {selectedContact ? (
                <>
                  {/* Messages */}
                  <Box sx={{ flex: 1, p: 1, overflow: 'auto'}}>
                    {messages.map((message, index) => (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          justifyContent: message.senderId === 'current-user' ? 'flex-end' : 'flex-start',
                          mb: 1,
                          transitionDelay: `${Math.min(index * 24, 180)}ms`,
                        }}
                      >
                        <Paper
                          sx={[
                            {
                              p: 1.5,
                              maxWidth: '70%',
                              bgcolor: message.senderId === 'current-user'
                                ? getProfessionColor()
                                : 'grey.100',
                              color: message.senderId === 'current-user' ? 'white' : 'text.primary',
                              borderRadius: 2,
                            },
                            theming.getThemedCardSx(),
                          ]}
                        >
                          <Typography variant="body2">{message.content}</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: 0.8,
                              display: 'block',
                              textAlign: 'right',
                              mt: 0.5}}
                          >
                            {formatTime(message.timestamp)}
                          </Typography>
                        </Paper>
                      </Box>
                    ))}
                    <div ref={messagesEndRef} />
                  </Box>

                  {/* Input Area */}
                  <Box
                    sx={{
                      p:  1,
                      borderTop:  1,
                      borderColor: 'divider',
                      background: 'rgba(248, 250, 252, 0.98)',
                    }}
                  >
                    <TextField
                      fullWidth
                      multiline
                      maxRows={3}
                      placeholder="Skriv en melding..."
                      value={messageInput}
                      onChange={(e) => handleMessageInputChange(e.target.value)}
                      onKeyDown={handleKeyPress}
                      variant="outlined"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius:  3,
                      }}}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <IconButton size="small">
                              <AttachDescription />
                            </IconButton>
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5}}
                            >
                              {/* CRM Help Indicator - SAME AS FULLSCREEN */}
                              {showHelpIndicator && needsHelpMessage && (
                                <Tooltip
                                  title={`Trenger du hjelp med å svare på: "${needsHelpMessage.content.slice(0, 30)}..."?`}
                                >
                                  <IconButton
                                    onClick={analyzeCustomerMessages}
                                    size="small"
                                    sx={{
                                      bgcolor: `${getProfessionColor()}15`,
                                      color: getProfessionColor(),
                                      border: `1px solid ${getProfessionColor()}40`,
                                      animation: 'pulse 2s ease-in-out infinite','&:hover': {
                                        bgcolor: `${getProfessionColor()}25`,
                                        transform: 'scale(1.05)',
                                    }, '@keyframes pulse': {
                                        '0%, 100%': {
                                          opacity:  1,
                                          transform: 'scale(1)',
                                      }, '50%': {
                                          opacity: 0.8,
                                          transform: 'scale(1.02)',
                                      },
                                    }}}
                                  >
                                    🤖
                                  </IconButton>
                                </Tooltip>
                              )}

                              <IconButton size="small">
                                <EmojiEmotions />
                              </IconButton>
                              <IconButton
                                onClick={handleSendMessage}
                                disabled={
                                  !messageInput.trim() ||
                                  sendMessageMutation.isPending ||
                                  sendGoogleChatMutation.isPending
                                }
                                size="small"
                                sx={{
                                  bgcolor: messageInput.trim() ? getProfessionColor() : 'grey.300',
                                  color: 'white','&:hover': {
                                    bgcolor: messageInput.trim()
                                      ? getProfessionColor()
                                      : 'grey.300',
                                }}}
                              >
                                <Send />
                              </IconButton>
                            </Box>
                          </InputAdornment>
                        )}}
                    />

                    {/* CRM Response Suggestions - SAME AS FULLSCREEN */}
                    {showSuggestions && analyzeMessageMutation.data && (
                      <Box
                        sx={{
                          mt:  1,
                          p:  1,
                          bgcolor: 'rgba(255,255,255,0.96)',
                          borderRadius:  2,
                          border: `1px solid ${getProfessionColor()}30`,
                          maxHeight: 220,
                          overflow: 'auto'}}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb:  1}}
                        >
                          <Typography variant="subtitle2" sx={{ color: getProfessionColor()}}>
                            🤖 CRM Forslag
                          </Typography>
                          <IconButton size="small" onClick={() => setShowSuggestions(false)}>
                            {theming.getThemedIcon('close')}
                          </IconButton>
                        </Box>

                        {analyzeMessageMutation.data.suggestions?.map((suggestion: any, suggestionIndex: number) => (
                          <Paper
                            key={suggestion.id || `${suggestion.category || 'suggestion'}-${suggestionIndex}`}
                            sx={{
                              p:  1,
                              mb:  1,
                              cursor: 'pointer',
                              fontSize: '0.85rem','&:hover': {
                                borderColor: getProfessionColor(),
                                boxShadow: `0 2px 4px ${getProfessionColor()}20`,
                            }}}
                            onClick={() => {
                              setMessageInput(suggestion.content);
                              setShowSuggestions(false);
                          }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mb: 0.5}}
                            >
                              <Chip
                                label={suggestion.category || 'Generelt'}
                                size="small"
                                sx={{
                                  bgcolor: `${getProfessionColor()}15`,
                                  color: getProfessionColor(),
                                  fontSize: '0.6rem',
                                  height:  16}}
                              />
                              <Chip
                                label={`${Math.round(suggestion.confidence * 100)}%`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.6rem', height: 16}}
                              />
                            </Box>

                            <Typography variant="caption" sx={{ lineHeight: 1.3}}>
                              {suggestion.content}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    )}

                    {/* CRM Loading State - SAME AS FULLSCREEN */}
                    {analyzeMessageMutation.isPending && (
                      <Box
                        sx={{
                          mt:  1,
                          p:  1,
                          bgcolor: 'rgba(255,255,255,0.96)',
                          borderRadius:  2,
                          display: 'flex',
                          alignItems: 'center',
                          gap:  1}}
                      >
                        <Box
                          sx={{
                            width:  16,
                            height:  16,
                            border: `2px solid ${getProfessionColor()}`,
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite', '@keyframes spin': {
                              '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' },
                          }}}
                        />
                        <Typography variant="caption" color="text.secondary">
                          🤖 Analyserer...
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    flex:  1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap:  2}}
                >
                  <Person sx={{ fontSize:  60, color: 'grey.400'}} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Velg en samtale for å starte
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Google Chat Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        sx={{
          '& .MuiPaper-root': {
            borderRadius:  2,
            minWidth: 220,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}}
      >
        <MenuItem onClick={handleCreateGoogleSpace}>
          <Groups sx={{ mr: 1, color: '#4285F4'}} />
          Nytt Chat-rom
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMentionUser}>
          <AlternateEmail sx={{ mr: 1, color: 'text.secondary'}} />
          @Mention bruker
        </MenuItem>
        <MenuItem onClick={handleStartMeet}>
          <VideocamCall sx={{ mr: 1, color: 'text.secondary'}} />
          Start Meet
        </MenuItem>
      </Menu>
      </>
    </ChatWidgetErrorBoundary>
  );
}
