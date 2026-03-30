/**
 * CreatorHub Norge - Universal Communication Hub
 * Central interface connecting chat, email, notifications, meetings, and project communications
 * Material UI only, zero toast notifications
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  IconButton,
  Badge,
  Chip,
  Avatar,
  Divider,
  TextField,
  InputAdornment,
  Fab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Email as EmailIcon,
  Notifications as NotificationIcon,
  VideoCall as MeetingIcon,
  Folder as ProjectIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Send as SendIcon,
  AttachFile as AttachIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface CommunicationChannel {
  id: string;
  name: string;
  type: 'chat' | 'email' | 'notification' | 'meeting' | 'project' | 'system';
  description?: string;
  isActive: boolean;
  settings: any;
  participantCount?: number;
  lastActivity?: string;
  unreadCount?: number
}

interface CommunicationMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  messageType: 'text' | 'file' | 'system' | 'notification';
  content: string;
  metadata?: any;
  isRead: boolean;
  isPriority: boolean;
  createdAt: string;
  reactions?: any[];
  attachments?: any[]
}

interface UniversalCommunicationHubProps {
  userId: string;
  profession?: string; // Now supports dynamic profession types
  onChannelCreate?: (channel: CommunicationChannel) => void
}

export default function UniversalCommunicationHub({
  userId,
  profession,
  onChannelCreate,
}: UniversalCommunicationHubProps) {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = profession || user?.profession || 'photographer';

  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelData, setNewChannelData] = useState({
    name: '',
    type: 'chat' as any,
    description: '',
});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const communicationTypes = [
    { value: 'all', label: 'Alle kanaler', icon: GroupIcon, color: '#ff6f00' },
    { value: 'chat', label: 'Chat', icon: ChatIcon, color: '#4caf50' },
    { value: 'email', label: 'E-post', icon: EmailIcon, color: '#2196f3' },
    {
      value: 'notification',
      label: 'Varslinger',
      icon: NotificationIcon,
      color: '#ff9800' },
    { value: 'meeting', label: 'Møter', icon: MeetingIcon, color: '#9c27b0' },
    {
      value: 'project',
      label: 'Prosjekter',
      icon: ProjectIcon,
      color: '#607d80' },
  ];

  const currentType = communicationTypes[activeTab];

  // Fetch user's communication channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['/api/communication/channels', userId, currentType.value],
    queryFn: () =>
      apiRequest(
        `/api/communication/channels?userId=${userId}&type=${currentType.value !== 'all' ? currentType.value : ','}`,
      ),
    refetchInterval: 3000, // Refresh every 30 seconds
});

  // Fetch messages for selected channel
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/communication/messages', selectedChannel],
    queryFn: () =>
      selectedChannel
        ? apiRequest(`/api/communication/channels/${selectedChannel}/messages`)
        : Promise.resolve([]),
    enabled: !!selectedChannel,
    refetchInterval: 500, // Refresh messages every 5 seconds
});

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (channelData: any) =>
      apiRequest('/api/communication/channels', {
        method: 'POST',
        body: JSON.stringify(channelData),
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/communication/channels', ],
    });
      setCreateChannelOpen(false);
      setNewChannelData({ name: ', ', type: 'chat', description: ', ',});
      if (onChannelCreate && result.channel) {
        onChannelCreate(result.channel);
    }
  },
});

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) =>
      apiRequest('/api/communication/messages', {
        method: 'POST',
        body: JSON.stringify(messageData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/communication/messages', ],
    });
      setMessageInput(', ');
  },
});

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/communication?userId=${userId}`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setWsConnected(true);
        console.log('🔌 Universal Communication WebSocket connected');
    };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
      } catch (error) {
          console.error('WebSocket message error:', error);
      }
    };

      wsRef.current.onclose = () => {
        setWsConnected(false);
        console.log('🔌 Universal Communication WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
  };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
    }
  };
}, [userId]);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'channel_message':
        if (data.channelId === selectedChannel) {
          queryClient.invalidateQueries({
            queryKey: ['/api/communication/messages', ],
        });
      }
        queryClient.invalidateQueries({
          queryKey: ['/api/communication/channels', ],
      });
        break;
      case 'notification':
        queryClient.invalidateQueries({
          queryKey: ['/api/communication/channels', ],
      });
        break;
  }
};

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChannel) return;

    sendMessageMutation.mutate({
      channelId: selectedChannel,
      senderId: userId,
      messageType: 'text',
      content: messageInput.trim(),
      isPriority: false,
  });
};

  const handleCreateChannel = () => {
    if (!newChannelData.name.trim()) return;

    createChannelMutation.mutate({
      ...newChannelData,
      settings: {
        profession,
        autoNotify: true,
        allowFileSharing: true,
    },
  });
};

  const getChannelIcon = (type: string) => {
    const typeData = communicationTypes.find((t) => t.value === type);
    return typeData ? typeData.icon : ChatIcon;
};

  const getChannelColor = (type: string) => {
    const typeData = communicationTypes.find((t) => t.value === type);
    return typeData ? typeData.color : '#666';
  };

  const filteredChannels = channels.filter(
    (channel: CommunicationChannel) =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 0,
          background: 'linear-gradient(135deg, #ff6f00 0%, #ff8f00 100%)',
          color: 'white',
          ...theming.getThemedCardSx(),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between' }}
        >
          <Box>
            <Typography variant="h6" sx={{  fontWeight: 600}}>
              Universal Kommunikasjon
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              {wsConnected ? 'Tilkoblet' : 'Kobler til...'} • {filteredChannels.length} kanaler
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Chip
              icon={<PersonIcon />}
              label={profession}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }}
            />
            <IconButton sx={{ color: 'white' }}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Sidebar */}
        <Paper
          elevation={1}
          sx={{
            width: 30,
            borderRadius:  0,
            borderRight:  1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column' }}
         sx={theming.getThemedCardSx()}>
          {/* Channel Type Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 48}}
          >
            {communicationTypes.map((type, index) => {
              const Icon = type.icon;
              return (
                <Tab
                  key={type.value}
                  icon={<Icon />}
                  label={type.label}
                  sx={{
                    minWidth: 'auto',
                    px:  1,
                    color: activeTab === index ? type.color : 'text.secondary' }}
                />
              );
          })}
          </Tabs>

          {/* Search */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              placeholder="Søk i kanaler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Channel List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {channelsLoading ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">Laster kanaler...</Typography>
              </Box>
            ) : filteredChannels.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchQuery ? 'Ingen kanaler funnet' : 'Ingen kanaler ennå'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ p:  0 }}>
                {filteredChannels.map((channel: CommunicationChannel) => {
                  const Icon = getChannelIcon(channel.type);
                  const isSelected = selectedChannel === channel.id;

                  return (
                    <ListItemButton
                      key={channel.id}
                      selected={isSelected}
                      onClick={() => setSelectedChannel(channel.id)}
                      sx={{
                        borderLeft: isSelected ? 4 : 0,
                        borderColor: getChannelColor(channel.type),
                        bgcolor: isSelected ? 'action.selected' : 'transparent' }}
                    >
                      <ListItemIcon>
                        <Badge badgeContent={channel.unreadCount || 0} color="error">
                          <Icon sx={{ color: getChannelColor(channel.type, )}} />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap:  1}}
                          >
                            <Typography variant="subtitle2" noWrap>
                              {channel.name}
                            </Typography>
                            <Chip
                              label={channel.type}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20}}
                            />
                          </Box>
                      }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {channel.description || `${channel.participantCount || 0} deltakere`}
                            </Typography>
                            {channel.lastActivity && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Sist aktiv: {', '}
                                {new Date(channel.lastActivity).toLocaleDateString('no-NO')}
                              </Typography>
                            )}
                          </Box>
                      }
                      />
                    </ListItemButton>
                  );
              })}
              </List>
            )}
          </Box>

          {/* Create Channel FAB */}
          <Fab
            color="primary"
            size="medium"
            onClick={() => setCreateChannelOpen(true)}
            sx={{
              position: 'absolute',
              bottom:  80,
              right:  20,
              bgcolor: currentType.color,
              '&:hover': {
                bgcolor: currentType.color,
                filter: 'brightness(0.9)',
              },
            }}
          >
            <AddIcon />
          </Fab>
        </Paper>

        {/* Main Communication Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedChannel ? (
            <>
              {/* Channel Header */}
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  borderRadius: 0,
                  borderBottom: 1,
                  borderColor: 'divider',
                  ...theming.getThemedCardSx(),
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'between' }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {
                        filteredChannels.find((c: CommunicationChannel) => c.id === selectedChannel)
                          ?.name
                  }
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {messages.length} meldinger • Aktiv kanal
                    </Typography>
                  </Box>
                  <IconButton>
                    <MoreIcon />
                  </IconButton>
                </Box>
              </Paper>

              {/* Messages */}
              <Box sx={{ flex: 1, overflow: 'auto', p:  2 }}>
                {messagesLoading ? (
                  <Box sx={{ textAlign: 'center', py:  4 }}>
                    <Typography color="text.secondary">Laster meldinger...</Typography>
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py:  4 }}>
                    <Typography color="text.secondary">
                      Ingen meldinger ennå. Start en samtale!
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {messages.map((message: CommunicationMessage) => (
                      <ListItem key={message.d} sx={{ alignItems: 'flex-start', py:  1 }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          {message.senderName?.[0] || message.senderId[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex:  1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap:  1,
                              mb: 0.5}}
                          >
                            <Typography variant="subtitle2">
                              {message.senderName || message.senderId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(message.createdAt).toLocaleTimeString('no-NO')}
                            </Typography>
                            {message.isPriority && (
                              <Chip
                                label="Prioritet"
                                size="small"
                                color="error"
                                variant="outlined"
                                sx={{ height:  18, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2">{message.content}</Typography>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              {/* Message Input */}
              <Paper
                elevation={2}
                sx={{
                  p: 2,
                  borderRadius: 0,
                  borderTop: 1,
                  borderColor: 'divider',
                  ...theming.getThemedCardSx(),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <TextField
                    fullWidth
                    placeholder="Skriv en melding..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    multiline
                    maxRows={4}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <IconButton size="small">
                            <AttachIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <IconButton size="small">
                    <EmojiIcon />
                  </IconButton>
                  <IconButton
                    color="primary"
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    onClick={handleSendMessage}
                  >
                    <SendIcon />
                  </IconButton>
                </Box>
              </Paper>
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
              <Box sx={{ textAlign: 'center', opacity: 0.7}}>
                {React.createElement(currentType.icon, {
                  sx: { fontSize: 64, color: currentType.color },
              })}
                <Typography variant="h6" sx={{  mt:  2  }}>
                  Velg en kanal for å starte
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Velg en kanal fra listen til venstre for å se meldinger og delta i samtalen.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Create Channel Dialog */}
      <Dialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Opprett ny kommunikasjonskanal</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap:  2 }}>
            <TextField
              label="Kanalnavn"
              value={newChannelData.name}
              onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Type kommunikasjon</InputLabel>
              <Select
                value={newChannelData.type}
                onChange={(e) => setNewChannelData({ ...newChannelData, type: e.target.value })}
                label="Type kommunikasjon"
              >
                {communicationTypes.slice(1).map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems:'center', gap:  1 }}>
                      {React.createElement(type.icon, {
                        sx: { color: type.color },
                    })}
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Beskrivelse (valgfritt)"
              value={newChannelData.description}
              onChange={(e) =>
                setNewChannelData({
                  ...newChannelData,
                  description: e.target.value,
              })
            }
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateChannelOpen(false)}>Avbryt</Button>
          <Button onClick={handleCreateChannel}
            variant="contained"
            disabled={!newChannelData.name.trim() || createChannelMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
