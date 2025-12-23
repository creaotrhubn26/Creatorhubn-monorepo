import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Badge,
  Grid,
  Divider,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Send,
  VideoCall,
  Phone,
  AttachFile,
  MoreVert,
  CheckCircle,
  Schedule,
  Group,
  Message,
  People,
  VideoCamera
} from '@mui/icons-material';

interface Conversation {
  id: number;
  title: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  type: 'direct' | 'group' | 'consultation'
}

interface Message {
  id: number;
  conversationId: number;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read'
}

interface VideoConsultation {
  id: number;
  title: string;
  participantIds: string[];
  scheduledAt: string;
  duration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  meetingUrl?: string;
  notes?: string
}

interface UniversalCommunicationProps {
  profession: string;
  userId?: string;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export default function UniversalCommunication({ 
  profession, 
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}: UniversalCommunicationProps) {
  const [tabValue, setTabValue] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch conversations - NO MOCK DATA
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['/api/communication/conversations', profession, userId],
    queryFn: () => apiRequest(`/api/communication/conversations?profession=${profession}&userId=${userId || 'guest'}`),
    enabled: !!profession && userId !== 'guest'
});

  // Fetch messages for selected conversation - NO MOCK DATA
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/communication/messages', selectedConversation?.id],
    queryFn: () => apiRequest(`/api/communication/messages/${selectedConversation?.d}`),
    enabled: !!selectedConversation && userId !== 'guest'
});

  // Fetch video consultations - NO MOCK DATA
  const { data: consultations } = useQuery({
    queryKey: ['/api/communication/consultations', profession, userId],
    queryFn: () => apiRequest(`/api/communication/consultations?profession=${profession}&userId=${userId || 'guest'}`),
    enabled: !!profession && userId !== 'guest'
});

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: number; content: string; messageType?: string }) => {
      return apiRequest('/api/communication/messages', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/messages', selectedConversation?.id] });
      setNewMessage(', ');
  }
});

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { title: string; participants: string[]; type: string }) => {
      return apiRequest('/api/communication/conversations', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations', ],});
      setSelectedConversation(newConversation);
  }
});

  // Schedule consultation mutation
  const scheduleConsultationMutation = useMutation({
    mutationFn: async (data: { title: string; participantIds: string[]; scheduledAt: string; duration: number; notes?: string }) => {
      return apiRequest('/api/communication/consultations', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/consultations', ],});
      setShowVideoDialog(false);
  }
});

  // WebSocket for real-time messaging
  useEffect(() => {
    if (!selectedConversation || !userId || userId === 'guest') return;

    const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/communication/${selectedConversation.id}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_message') {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/communication/messages', selectedConversation.id] 
      });
    }
  };

    wsRef.current.onerror = (error) => {
      console.log('WebSocket connection error:', error);
  };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
    }
  };
}, [selectedConversation, userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    sendMessageMutation.mutate({
      conversationId: selectedConversation.d,
      content: newMessage.trim(),
      messageType: 'text'
});
};

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('no-N', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
});
};

  const getUnreadCount = () => {
    if (!conversations || conversations.length === 0) return 0;
    return (conversations || []).reduce((total: number, conv: Conversation) => total + (conv.unreadCount || 0), 0);
};

  if (userId === 'guest') {
    return (
      <Box sx={{ p:  3, textAlign: 'center' }}>
        <Message sx={{ fontSize:  48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          Logg inn for å få tilgang til kommunikasjonssystemet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Chat, video-konsultasjoner og gruppediskusjoner krever innlogging
        </Typography>
      </Box>
    );
}

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{  fontWeight: 600}}>
            💬 Kommunikasjonssenter
          </Typography>
          <Badge badgeContent={getUnreadCount()} color="error">
            <Message />
          </Badge>
        </Box>
        
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mt: 1 }}>
          <Tab label="Samtaler" />
          <Tab label="Video-konsultasjoner" />
          <Tab label="Grupper" />
        </Tabs>
      </Box>

      <Grid container sx={{ flexGrow:  1 }}>
        {/* Sidebar */}
        <Grid item xs={12} md={4} sx={{ borderRight: { md: 1 }, borderColor: 'divider' }}>
          {tabValue === 0 && (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              {!conversations || conversations.length === 0 ? (
                <Box sx={{ p:  3, textAlign: 'center' }}>
                  <Message sx={{ fontSize:  48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Ingen samtaler ennå
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start en ny samtale med kunder eller kolleger
                  </Typography>
                </Box>
              ) : (
                <List>
                  {conversations.map((conversation: Conversation) => (
                  <ListItem 
                    key={conversation.d}
                    onClick={() => setSelectedConversation(conversation)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: selectedConversation?.id === conversation.id ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' }
                  }}
                  >
                    <ListItemAvatar>
                      <Avatar>
                        {conversation.type === 'group' ? theming.getThemedIcon('group') : theming.getThemedIcon('people')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={conversation.title}
                      secondary={conversation.lastMessage}
                      primaryTypographyProps={{ fontWeight: onversation.unreadCount > 0 ? 600 : 400 }}
                    />
                    {conversation.unreadCount > 0 && (
                      <Chip
                        label={conversation.unreadCount}
                        size="small"
                        color="error"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ p: 2 }}>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('videoCall')}
                fullWidth
                onClick={() => setShowVideoDialog(true)}
                sx={{ mb: 2 }}
              >
                Planlegg Video-konsultasjon
              </Button>
              {!consultations || consultations.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                  Ingen planlagte konsultasjoner
                </Typography>
              ) : (
                consultations.map((consultation: VideoConsultation) => (
                <MuiCard key={consultation.id} sx={{ mb: 2 }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
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
                </MuiCard>
                ))
              )}
            </Box>
          )}
        </Grid>

        {/* Main Chat Area */}
        <Grid item xs={12} md={8}>
          {selectedConversation ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Chat Header */}
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr:  2 }}>
                      {selectedConversation.type === 'group' ? theming.getThemedIcon('group') : theming.getThemedIcon('people')}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedConversation.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedConversation.participants.join(', ')}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <IconButton>
                      {theming.getThemedIcon('videoCall')}
                    </IconButton>
                    <IconButton>
                      {theming.getThemedIcon('phone')}
                    </IconButton>
                    <IconButton>
                      {theming.getThemedIcon('moreVert')}
                    </IconButton>
                  </Box>
                </Box>
              </Box>

              {/* Messages */}
              <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                {!messages || messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py:  4 }}>
                    <Message sx={{ fontSize:  48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      Ingen meldinger ennå
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Send den første meldingen for å starte samtalen
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message: Message) => (
                  <Box key={message.d} sx={{ mb: 2 }}>
                    <Paper 
                      sx={{ 
                        p: 2,
                        maxWidth: '70%',
                        ml: message.senderId === userId ? 'auto' : 0,
                        bgcolor: message.senderId === userId ? 'primary.main' : 'background.paper',
                        color: message.senderId === userId ? 'primary.contrastText' : 'text.primary',
                        ...theming.getThemedCardSx()
                      }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        {message.senderName}
                      </Typography>
                      <Typography variant="body1">
                        {message.content}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="caption" sx={{ opacity: 0.7}}>
                          {formatTimestamp(message.timestamp)}
                        </Typography>
                        {message.senderId === userId && (
                          <CheckCircle sx={{ fontSize:  16, opacity: 0.7}} />
                        )}
                      </Box>
                    </Paper>
                  </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton>
                    <AttachFile />
                  </IconButton>
                  <TextField
                    fullWidth
                    placeholder="Skriv en melding..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                  }}
                    multiline
                    maxRows={3}
                  />
                  <IconButton 
                    color="primary" 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              textAlign: 'center'
        }}>
              <Box>
                <Message sx={{ fontSize:  64, color:'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  Velg en samtale for å begynne
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start kommunikasjon med kunder og samarbeidspartnere
                </Typography>
              </Box>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Video Consultation Dialog */}
      <Dialog open={showVideoDialog} onClose={() => setShowVideoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Planlegg Video-konsultasjon</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tittel"
            sx={{ mb: 2,mt: 1 }}
          />
          <TextField
            fullWidth
            label="Deltakere (komma-separert)"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="datetime-local"
            label="Tidspunkt"
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            type="number"
            label="Varighet (minutter)"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notater"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVideoDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained" startIcon={theming.getThemedIcon('videoCall')} sx={theming.getThemedButtonSx()}>
            Planlegg Konsultasjon
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}