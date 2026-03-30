import * as React from 'react';
import { useState, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  type ChipProps,
} from '@mui/material';
import {
  Email,
  Send,
  Chat,
  Google,
  Refresh,
  CheckCircle,
  Error,
  Schedule,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDemoMode } from '../../contexts/DemoModeContext';

interface EmailMessage {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  body: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  chatThreadId?: string;
  snippet?: string;
  threadId?: string;
  labelIds?: string[]; 
}

interface ChatThread {
  id: string;
  subject: string;
  participants: string[];
  lastMessage: string;
  lastActivity: string;
  unreadCount: number;
  status: 'active' | 'archived'; 
}

export default function EmailChatIntegration() {
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // Enhanced Master Integration
  const { analytics, lifecycle, performance, debugging, auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer,');

  // Component registration and lifecycle management
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'email-chat-integration,',
      type: 'integration-component',
      version: '1.0.0',
      capabilities: {
        data: ['email:read','chat:create','google:api'],
        events: ['email:selected','chat:created','integration:success','integration:error'],
        actions: ['email:sync','chat:create','google:auth'],
        ui: ['email:list','chat:interface','integration:status'],
        system: ['google:integration','email:processing','chat:management'],
      },
      dependencies: ['@mui/material','@tanstack/react-query','google-api'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime:  0,
        memoryUsage: 0
    }
  });

    // Track component initialization
    analytics.trackEvent('email_chat_integration_mounted, ', {
      timestamp: Date.now()
  ,});

    return () => {
      lifecycle.unregisterComponent('email-chat-integration');
      analytics.trackEvent('email_chat_integration_unmounted', {
        timestamp: Date.now()
    ,});
  };
}, [lifecycle, analytics]);

  // Demo data for EmailChatIntegration
  const demoEmailMessages: EmailMessage[] = [
    {
      id: ', ',
      subject: 'Project Discussion - Wedding Photography',
      sender: 'client@example.com',
      recipient: 'photographer@creatorhub.no',
      body: 'Hi! I wanted to discuss the details for our wedding photography session...',
      timestamp: '2025-09-13T20:30:00',
      status: 'read',
      chatThreadId: 'thread-',
  },
    {
      id: ', ',
      subject: 'Video Editing Timeline',
      sender: 'videographer@creatorhub.no',
      recipient: 'client@example.com',
      body: 'Here is the updated timeline for your video project...',
      timestamp: '2025-09-13T19:45:00',
      status: 'delivered',
  },
    {
      id: ', ',
      subject: 'Equipment Rental Inquiry',
      sender: 'vendor@northtone.no',
      recipient: 'admin@creatorhub.no',
      body: 'We have new acoustic panels available for rent...',
      timestamp: '2025-09-13T18:20:00',
      status: 'sent',
  },
  ];

  const demoChatThreads: ChatThread[] = [
    {
      id: 'thread-',
      subject: 'Project Discussion - Wedding Photography',
      participants: ['client@example.com','photographer@creatorhub.no'],
      lastMessage: 'Perfect! I will send you the final photos by tomorrow.',
      lastActivity: '2025-09-13T20:35:00',
      unreadCount:  0,
      status: 'active',
  },
    {
      id: 'thread-',
      subject: 'Video Editing Collaboration',
      participants: ['videographer@creatorhub.no','editor@creatorhub.no'],
      lastMessage: 'The color grading is looking great, !',
      lastActivity: '2025-09-13T19:50:00',
      unreadCount:  2,
      status: 'active',
  },
  ];

  // Fetch email messages from Gmail API (using Service Account Impersonation)
  const { data: emailMessages = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['gmail-messages'],
    queryFn: async () => {
      if (isDemoMode) {
        // Return demo data with simulated delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return demoEmailMessages;
      }

      const headers = await auth.getAuthHeader();
      return apiRequest('/api/gmail/messages', {
        headers,
      });
    },
    retry: false,
  });

  // Fetch chat threads from Google Chat API
  const { data: chatThreads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['chat-threads'],
    queryFn: async () => {
      if (isDemoMode) {
        // Return demo data with simulated delay
        await new Promise(resolve => setTimeout(resolve, 300));
        return demoChatThreads;
      }

      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google/chat/threads', {
        headers,
      });
    },
    retry: false,
  });

  // Use real data from Google APIs
  const displayEmailMessages = emailMessages;
  const displayChatThreads = chatThreads;

  // Create chat thread from email
  const createChatThreadMutation = useMutation({
    mutationFn: async (email: EmailMessage) => {
      if (isDemoMode) {
        // Simulate creating chat thread in demo mode
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, threadId: `demo-thread-${Date.now()}` };
      }

      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google/chat/create-thread', {
        method: 'POST',
        headers,
        body: JSON.stringify({ emailId: email.id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-messages'] });
    },
  });

  // Send message to chat thread
  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, message }: { threadId: string; message: string }) => {
      if (isDemoMode) {
        // Simulate sending message in demo mode
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, messageId: `demo-message-${Date.now()}` };
      }

      const headers = await auth.getAuthHeader();
      return apiRequest('/api/google/chat/send-message', {
        method: 'POST',
        headers,
        body: JSON.stringify({ threadId, message }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      setNewMessage(', ');
    },
  });

  const handleCreateChatThread = (email: EmailMessage) => {
    const endTiming = performance.startTiming('create_chat_thread');

    analytics.trackEvent('create_chat_thread_started', {
      emailId: email.id,
      subject: email.subject,
      timestamp: Date.now(),
    });

    createChatThreadMutation.mutate(email, {
      onSuccess: () => {
        analytics.trackEvent('create_chat_thread_success', {
          emailId: email.id,
          subject: email.subject,
          timestamp: Date.now(),
        });
        endTiming();
      },
      onError: (error) => {
        analytics.trackEvent('create_chat_thread_error', {
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
        endTiming();
      },
    });
  };

  const handleSendMessage = (threadId: string) => {
    if (newMessage.trim()) {
      const endTiming = performance.startTiming('send_chat_message');
      
      analytics.trackEvent('send_chat_message_started', {
        threadId,
        messageLength: newMessage.length,
        timestamp: Date.now()
    ,});
      
      sendMessageMutation.mutate({ threadId, message: newMessage }, {
        onSuccess: () => {
          analytics.trackEvent('send_chat_message_success', {
            threadId,
            messageLength: newMessage.length,
            timestamp: Date.now()
        ,});
          endTiming();
      },
        onError: (error) => {
          analytics.trackEvent('send_chat_message_error', {
            threadId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        ,});
          endTiming();
      }
    });
  }
};

  const handleRefreshData = () => {
    debugging.logIntegration('info', 'Refreshing email chat integration data', {
      selectedEmailId: selectedEmail?.id,
      selectedThreadId: selectedThread?.id,
      timestamp: Date.now(),
    });
    void queryClient.invalidateQueries({ queryKey: ['gmail-messages'] });
    void queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
  };

  const activeThreadId = selectedThread?.id || selectedEmail?.chatThreadId || null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Schedule color="info" />;
      case 'delivered':
        return <CheckCircle color="success" />;
      case 'read':
        return <CheckCircle color="primary" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return theming.getThemedIcon(', ');
  }
};

  const getStatusColor = (status: string): ChipProps['color'] => {
    switch (status) {
      case 'sent':
        return 'info';
      case 'delivered':
        return 'success';
      case 'read':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'default';
  }
};

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h5" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
        <Email color="primary" />
        Email-Chat Integration
        {isDemoMode && <Chip label="Demo Mode" size="small" color="secondary" />}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Tooltip title="Oppdater e-post og chat-tråder">
          <IconButton onClick={handleRefreshData} color="primary">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, height: '70vh'}}>
        {/* Email Messages List */}
        <Card sx={{ flex: 1, minWidth: 300,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Email Messages
              {emailsLoading && <CircularProgress size={20} sx={{ ml:  1 }} />}
            </Typography>
            <List>
              {displayEmailMessages.map((email: EmailMessage) => (
                <ListItem
                  key={email.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius:  1,
                    mb: 1, '&:hover': { bgcolor: 'action.hover',}}}
                >
                  <ListItemButton
                    onClick={() => setSelectedEmail(email)}
                    selected={selectedEmail?.id === email.id}
                  >
                  <ListItemIcon>
                    {getStatusIcon(email.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={email.subject}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          From: {email.sender}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(email.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                  }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap:  1 }}>
                    <Chip
                      label={email.status}
                      size="small"
                      color={getStatusColor(email.status)}
                    />
                    {!email.chatThreadId && (
                      <Tooltip title="Create Chat Thread">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateChatThread(email);
                        }}
                          disabled={createChatThreadMutation.isPending}
                        >
                          {theming.getThemedIcon('chat')}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Divider orientation="vertical" flexItem />

        {/* Chat Threads List */}
        <Card sx={{ flex: 1, minWidth: 300,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chat color="primary" />
              Chat Threads
              {threadsLoading && <CircularProgress size={20} sx={{ ml:  1 }} />}
            </Typography>
            <List>
              {displayChatThreads.map((thread: ChatThread) => (
                <ListItem
                  key={thread.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius:  1,
                    mb: 1, '&:hover': { bgcolor: 'action.hover',}}}
                >
                  <ListItemButton
                    onClick={() => setSelectedThread(thread)}
                  >
                  <ListItemIcon>
                    <Google color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={thread.subject}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {thread.lastMessage}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(thread.lastActivity).toLocaleString()}
                        </Typography>
                      </Box>
                  }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap:  1 }}>
                    <Chip
                      label={thread.status}
                      size="small"
                      color={thread.status === 'active' ? 'success' : 'default'}
                    />
                    {thread.unreadCount > 0 && (
                      <Chip
                        label={thread.unreadCount}
                        size="small"
                        color="error"
                      />
                    )}
                  </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Message Input */}
      {(selectedEmail || selectedThread) && (
        <Card sx={{ mt:  2 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Reply to: {selectedThread?.subject || selectedEmail?.subject || 'Selected conversation'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end'}}>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                variant="outlined"
              />
              <Button variant="contained"
                startIcon={<Send />}
                onClick={() => {
                  if (activeThreadId) {
                    handleSendMessage(activeThreadId);
                  }
                }}
                disabled={!newMessage.trim() || sendMessageMutation.isPending || !activeThreadId}
              >
                {sendMessageMutation.isPending ? <CircularProgress size={20} /> :'Send'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Integration Status */}
      <Alert severity="info" sx={{ mt:  2 }}>
        <Typography variant="body2">
          <strong>Email-Chat Integration: </strong> Seamlessly convert email conversations into Google Chat threads
          for better collaboration and real-time communication.
        </Typography>
      </Alert>
    </Box>
  ); 
}
