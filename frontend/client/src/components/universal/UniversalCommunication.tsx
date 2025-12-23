import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Badge,
  InputAdornment,
  Divider,
  Tab,
  Tabs,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Send as SendIcon,
  AttachDescription as AttachIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  VideocamCall as VideoIcon,
  Phone as PhoneIcon,
  PersonAdd as PersonAddIcon,
  Group as GroupIcon,
  Notifications as NotificationIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'system';
  conversationId: string;
  isRead: boolean
}

interface Conversation {
  id: string;
  name: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  type: 'direct' | 'group';
  avatar?: string;
  isOnline?: boolean
}

interface UniversalCommunicationProps {
  userId?: string;
  userType?: string;
  sessionId?: string;
}

export default function UniversalCommunication({
  userId = 'dev-photographer,',
  userType = 'photographer',
  sessionId,
}: UniversalCommunicationProps) {
  // Enhanced Master Integration
  const { features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession (userType) instead of hardcoded value
  const theming = useTheming(userType);
  
  // Push notifications
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Comprehensive Feature System for Universal Communication
  const universalCommunicationAccess = features.checkFeatureAccess('universal-communication,');
  const messagingAccess = features.checkFeatureAccess('messaging, ');
  const videoCallAccess = features.checkFeatureAccess('video-call');
  const fileSharingAccess = features.checkFeatureAccess('file-sharing');
  const notificationAccess = features.checkFeatureAccess('notification');
  const conversationHistoryAccess = features.checkFeatureAccess('conversation-history');
  const realTimeSyncAccess = features.checkFeatureAccess('real-time-sync');
  const communicationAnalyticsAccess = features.checkFeatureAccess('communication-analytics');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [newChatDialog, setNewChatDialog] = useState(false);
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [newChatName, setNewChatName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ Connected to communication WebSocket, ');
        // Send authentication
        wsRef.current?.send(
          JSON.stringify({
            type: 'auth',
            userId,
            userType,
            sessionId,
        }),
        );
    };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
      } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
      }
    };

      wsRef.current.onclose = () => {
        console.log('🔌 Communication WebSocket disconnected');
    };

      wsRef.current.onerror = (error) => {
        console.error('❌ Communication WebSocket error:', error);
    };
  } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error);
  }

    return () => {
      wsRef.current?.close();
  };
}, [userId, userType, sessionId]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    
    // Track feature usage
    features.trackFeatureUsage('universal-communication','opened', {
      timestamp: Date.now(),
      component: 'UniversalCommunication',
      userId: userd,
      userType: userType
});
}, [features, userId, userType]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
}, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth',});
};

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/communication/conversations', {
        headers: {
          'Content-Type' : 'application/json',
      },
    });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
    } else {
        console.error('Failed to load conversations');
    }
  } catch (error) {
      console.error('Error loading conversations:', error);
  }
};

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/communication/messages/${conversationd}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
    } else {
        console.error('Failed to load messages');
    }
  } catch (error) {
      console.error('Error loading messages:', error);
  }
};

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'new_message':
        if (data.message.conversationId === selectedConversation) {
          setMessages((prev) => [...(prev || []), data.message]);
      }
        // Update conversation last message
        setConversations((prev) =>
          (prev || []).map((conv) =>
            conv.id === data.message.conversationId
              ? {
                  ...conv,
                  lastMessage: data.message,
                  unreadCount: conv.unreadCount +, 1,
              }
              : conv,
          ),
        );
        break;
      case 'message_read':
        setMessages((prev) =>
          prev.map((msg) => (msg.id === data.messageId ? { ...msg, isRead: true } : msg)),
        );
        break;
      case 'user_status':
        setConversations((prev) =>
          (prev || []).map((conv) =>
            conv.participants.includes(data.userId)
              ? { ...conv, isOnline: data.status === 'online',}
              : conv,
          ),
        );
        break;
      default: console.log('Unknown WebSocket message type, :', data.type);
  }
};

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageData = {
      conversationId: selectedConversation,
      content: newMessage.trim(),
      type: 'text',
  };

    try {
      const response = await fetch('/api/communication/send-message', {
        method: 'POS',
        headers: {
          'Content-Type' : 'application/json',
      },
        body: JSON.stringify(messageData),
    });

      if (response.ok) {
        const data = await response.json();

        // Add message to local state immediately
        setMessages((prev) => [...(prev || []), data.message]);

        // Send via WebSocket for real-time updates
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'send_message',
              ...messageData,
          }),
          );
      }

        setNewMessage(', ');
    } else {
        console.error('Failed to send message');
    }
  } catch (error) {
      console.error('Error sending message:', error);
  }
};

  const createNewChat = async () => {
    if (!newChatName.trim()) return;

    try {
      const response = await fetch('/api/communication/create-conversation', {
        method: 'POS',
        headers: {
          'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          name: newChatName,
          type: newChatType,
      }),
    });

      if (response.ok) {
        const data = await response.json();
        setConversations((prev) => [...(prev || []), data.conversation]);
        setNewChatDialog(false);
        setNewChatName(', ');
        setSelectedConversation(data.conversation.id);
    } else {
        console.error('Failed to create conversation');
    }
  } catch (error) {
      console.error('Error creating conversation:', error);
  }
};

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
    loadMessages(conversationId);

    // Mark conversation as read
    setConversations((prev) =>
      (prev || []).map((conv) => (conv.id === conversationId ? { ...conv, unreadCount:  0 } : conv)),
    );
};

  const filteredConversations = (conversations || []).filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedConv = (conversations || []).find((conv) => conv.id === selectedConversation);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'}}
        >
          <Box>
            <Typography variant="h5" sx={{  fontWeight: 600, color: theming.colors.primary }}>
              💬 Kommunikasjon
            </Typography>
            
            {/* Feature Analytics Display */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip 
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 18}}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap:  1 }}>
            {isSupported && (
              <IconButton
                onClick={() => setPushSettingsOpen(true)}
                color={pushEnabled ? 'primary' : 'default'}
                title="Push-varsler innstillinger"
              >
                <NotificationIcon />
              </IconButton>
            )}
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setNewChatDialog(true)}
              sx={{
                borderColor: '#f57c00',
                color: '#f57c00', '&:hover': {
                  borderColor: '#e65100',
                  backgroundColor: 'rgba(25, 1240.04)',
              }}}
            >
              Ny samtale
            </Button>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', height: 'calc(100% - 100px, )', gap:  2 }}>
        {/* Conversation List */}
        <Paper sx={{ width: '350px', display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
          {/* Search */}
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0'}}>
            <TextField
              fullWidth
              size="small"
              placeholder="Søk i samtaler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#f57c00'}} />
                  </InputAdornment>
                )}}
            />
          </Box>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: '1px solid #e0e0e0','& .MuiTab-root': {
                color: '#66','&.Mui-selected': {
                  color: '#f57c00',
              },
            }, '& .MuiTabs-indicator': {
                backgroundColor: '#f57c00',
            }}}
          >
            <Tab label="Alle" />
            <Tab label="Direkte" />
            <Tab label="Grupper" />
          </Tabs>

          {/* Conversation List */}
          <List sx={{ flex: 1, overflow: 'auto'}}>
            {filteredConversations.length === 0 ? (
              <Box sx={{ p:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  Ingen samtaler funnet
                </Typography>
              </Box>
            ) : (
              filteredConversations.map((conversation) => (
                <ListItem
                  key={conversation.id}
                  button
                  selected={selectedConversation === conversation.id}
                  onClick={() => handleConversationSelect(conversation.id)}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(25, 1240.08)',
                  }}}
                >
                  <ListItemAvatar>
                    <Badge color="success" variant="dot" invisible={!conversation.isOnline}>
                      <Avatar sx={{ bgcolor: '#f57c00'}}>
                        {conversation.type === 'group' ? (
                          <GroupIcon />
                        ) : (
                          conversation.name.charAt(0)
                        )}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'}}
                      >
                        <Typography variant="subtitle2" noWrap>
                          {conversation.name}
                        </Typography>
                        {conversation.unreadCount > 0 && (
                          <Chip
                            label={conversation.unreadCount}
                            size="small"
                            sx={{
                              backgroundColor: '#f57c00',
                              color: 'white',
                              height: '20px',
                              fontSize: '11px'}}
                          />
                        )}
                      </Box>
                  }
                    secondary={
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {conversation.lastMessage?.content || 'Ingen meldinger'}
                      </Typography>
                  }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Paper>

        {/* Chat Area */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <Box
                sx={{
                  p:  2,
                  borderBottom: '1px solid #e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                  <Avatar sx={{ bgcolor: '#f57c00'}}>
                    {selectedConv?.type === 'group' ? <GroupIcon /> : selectedConv?.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedConv?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedConv?.isOnline ? 'Pålogget' : 'Sist sett for en stund siden'}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap:  1 }}>
                  <IconButton sx={{ color: '#f57c00'}}>
                    <PhoneIcon />
                  </IconButton>
                  <IconButton sx={{ color: '#f57c00'}}>
                    <VideoIcon />
                  </IconButton>
                  <IconButton sx={{ color: '#f57c00'}}>
                    <MoreIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflow: 'auto', p:  1 }}>
                {messages.length === 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%'}}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Start en samtale ved å sende en melding
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.senderId === userId ? 'flex-end' : 'flex-start',
                        mb:  1}}
                    >
                      <Card
                        sx={{
                          maxWidth: '70, %',
                          backgroundColor: message.senderId === userId ? '#f57c00' : '#f5f5f0',
                          color: message.senderId === userId ? 'white' : 'inherit'}}
                       sx={theming.getThemedCardSx()}>
                        <CardContent sx={{ p: 1,, '&:last-child': { pb: 1.5,} ,  ...theming.getThemedCardSx() }}>
                          <Typography variant="body2">{message.content}</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: message.senderId === userId
                                  ? 'rgba(25,255,255,0.8)'
                                  : 'text.secondary',
                              display: 'block',
                              mt: 0.5}}
                          >
                            {format(new Date(message.timestamp)'HH: mm', {
                              locale:  b,
                          })}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0'}}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end'}}>
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Skriv en melding..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                  }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton sx={{ color: '#666'}}>
                            <AttachIcon />
                          </IconButton>
                        </InputAdornment>
                      )}}
                  />
                  <IconButton
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    sx={{
                      backgroundColor: '#f57c00',
                      color: 'white','&:hover': {
                        backgroundColor: '#e65100',
                    }, '&:disabled': {
                        backgroundColor: '#e0e0e0',
                    }}}
                  >
                    <SendIcon />
                  </IconButton>
                </Box>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'}}
            >
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h6" color="text.secondary" sx={{  mb:  1  }}>
                  Velg en samtale for å starte
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Eller opprett en ny samtale for å komme i gang
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      {/* New Chat Dialog */}
      <Dialog open={newChatDialog} onClose={() => setNewChatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett ny samtale</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Type samtale</InputLabel>
            <Select
              value={newChatType}
              label="Type samtale"
              onChange={(e) => setNewChatType(e.target.value as 'direct' | 'group')}
            >
              <MenuItem value="direct">Direkte melding</MenuItem>
              <MenuItem value="group">Gruppe</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label={newChatType === 'group' ? 'Gruppenavn' : 'Mottakers navn'}
            value={newChatName}
            onChange={(e) => setNewChatName(e.target.value)}
            placeholder={newChatType === 'group' ? 'Min gruppe' : 'ola.nordmann@email.com'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewChatDialog(false)}>Avbryt</Button>
          <Button onClick={createNewChat}
            variant="contained"
            sx={{
              backgroundColor: '#f57c00', '&:hover': {
                backgroundColor:'#e65100',
            }}}
           sx={theming.getThemedButtonSx()}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
