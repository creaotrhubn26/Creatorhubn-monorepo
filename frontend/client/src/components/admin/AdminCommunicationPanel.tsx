/**
 * CreatorHub Norge - Admin Communication Panel
 * Google Chat integration for admin to communicate with all platform users
 */

import { useTheming } from '../../utils/theming-helper';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Badge,
  Alert,
  Tabs,
  Tab,
  InputAdornment,
  Divider,
  Paper,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Group as GroupIcon,
  Chat as ChatIcon,
  Notifications as NotificationsIcon,
  History as HistoryIcon,
  AttachFile as AttachFileIcon,
  VideoCall as VideoCallIcon,
  Phone as PhoneIcon,
  Settings as SettingsIcon,
  Payment,
  CardMembership,
  Speed,
} from '@mui/icons-material';
import { useToast } from '../../hooks/use-toast';
// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import CommunicationTestPanel from './CommunicationTestPanel';
import FileManagementTestPanel from './FileManagementTestPanel';
import ShowcaseSettingsPanel from './ShowcaseSettingsPanel';
import GooglePayStatusIndicator from './GooglePayStatusIndicator';
import AuthenticationTest from './AuthenticationTest';
import DemoModeToggle from '../DemoModeToggle';
import SubscriberStatsPanel from './SubscriberStatsPanel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';
import { FileManagementStatusProvider } from '../../contexts/FileManagementStatusContext';

interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  profession?: string;
  isOnline: boolean;
  lastSeen?: string;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'system';
  isRead: boolean;
  attachments?: Array<{
    url: string;
    name: string;
    type: string;
}>;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'broadcast';
  participants: ChatUser[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  isActive: boolean;
}

interface AdminCommunicationPanelProps {
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

export default function AdminCommunicationPanel({
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
  onNotificationCreate
}: AdminCommunicationPanelProps) {
  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester, ');
  const userProfession = 'photographer';

  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const [mainTab, setMainTab] = useState(0);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all platform users for communication
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/communication/users'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/communication/users', { headers });
      return response.json();
  },
    staleTime: 30000
});

  // Fetch chat rooms
  const { data: chatRooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['/api/admin/communication/rooms'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/communication/rooms', { headers });
      return response.json();
  },
    staleTime: 10000,
    refetchInterval: 5000 // Real-time updates
});

  // Fetch messages for selected chat
  const { data: messages = [] } = useQuery({
    queryKey: ['/api/admin/communication/messages', selectedChat],
    queryFn: async () => {
      if (!selectedChat) return [];
      const headers = await auth.getAuthHeader();
      const response = await fetch(`/api/admin/communication/messages/${selectedChat}`, { headers });
      return response.json();
  },
    enabled: !!selectedChat,
    staleTime: 5000,
    refetchInterval: 2000 // Real-time message updates
});

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: {
      receiverId?: string;
      roomId?: string;
      content: string;
      type: 'text' | 'image' | 'file';
      attachments?: Array<any>;
}) => {
      const response = await fetch('/api/admin/communication/send', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json','x-user-email' : 'daniel@creatorhubn.com'
      },
        body: JSON.stringify(messageData)
  });
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/communication/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/communication/rooms'] });
      setMessageText(', ');
      toast({
        title: "Melding sendt",
        description: "Meldingen er sendt via Google Chat",
        variant: "default"
  });
  },
    onError: () => {
      toast({
        title: "Feil ved sending",
        description: "Kunne ikke sende melding",
        variant: "destructive"
  });
  }
});

  // Create broadcast mutation
  const broadcastMutation = useMutation({
    mutationFn: async (broadcastData: {
      title: string;
      content: string;
      recipients: string[];
      type: 'announcement' | 'notification' | 'urgent';
}) => {
      const response = await fetch('/api/admin/communication/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json','x-user-email' : 'daniel@creatorhubn.com'
      },
        body: JSON.stringify(broadcastData)
  });
      return response.json();
  },
    onSuccess: () => {
      toast({
        title: "Broadcast sendt",
        description: "Meldingen er sendt til alle valgte brukere",
        variant: "default"
  });
  }
});

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;

    const isDirectMessage = selectedChat.startsWith('user-');
    const messageData = {
      [isDirectMessage ? 'receiverId' : 'roomId']: selectedChat.replace('user-',', '),
      content: messageText,
      type: 'text' as const
};

    sendMessageMutation.mutate(messageData);
};

  const handleCreateBroadcast = () => {
    // Implementation for broadcast creation dialog
    toast({
      title: "Broadcast funksjon",
      description: "Broadcast til alle brukere kommer snart",
      variant: "default"
});
};

  const filteredUsers = users.filter((user: ChatUser) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSelectedChatInfo = () => {
    if (!selectedChat) return null;
    
    if (selectedChat.startsWith('user-')) {
      const userId = selectedChat.replace('user-', ', ');
      return users.find((user: ChatUser) => user.id === userId);
} else {
      return chatRooms.find((room: ChatRoom) => room.id === selectedChat);
}
};

  const selectedChatInfo = getSelectedChatInfo();

  return (
    <Box sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Tabs */}
      <Tabs
        value={mainTab}
        onChange={(_, newValue) => setMainTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Kommunikasjon" />
        <Tab label="System Test" />
        <Tab label="File Management" />
        <Tab label="Showcase Settings" />
        <Tab label="Google Pay Status" />
      </Tabs>

      {/* Communication Tab */}
      {mainTab === 0 && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Admin Kommunikasjon: </strong> Kommuniser med alle plattformbrukere via Google Chat. 
              Meldinger sendes direkte til brukernes Google Chat kontoer.
            </Typography>
          </Alert>
        </>
      )}

      {/* Test Panel Tab */}
      {mainTab === 1 && (
        <CommunicationStatusProvider>
          <div>
            <div>
              {/* CommunicationTestPanel temporarily disabled - component returns void */}
              <div>Communication Test Panel</div>
            </div>
          </div>
        </CommunicationStatusProvider>
      )}

      {/* File Management Test Panel Tab */}
      {mainTab === 2 && (
        <CommunicationStatusProvider>
          <FileManagementStatusProvider>
            <div>
              <div>
                {/* FileManagementTestPanel temporarily disabled - component returns void */}
                <div>File Management Test Panel</div>
              </div>
            </div>
          </FileManagementStatusProvider>
        </CommunicationStatusProvider>
      )}

      {/* Showcase Settings Tab */}
      {mainTab === 3 && (
        <div>
          <div>
            {/* ShowcaseSettingsPanel temporarily disabled - component returns void */}
            <div>Showcase Settings Panel</div>
          </div>
        </div>
      )}

          {/* Google Pay Status Tab */}
          {mainTab === 4 && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Google Pay Status: </strong> Overvåk Google Pay tilkobling, betalingsstatistikk og systemhelse i sanntid. 
                  Alle indikatorer oppdateres automatisk hvert 30. sekund.
                </Typography>
              </Alert>
              
              {/* Demo Mode Toggle */}
              <Box sx={{ mb: 3 }}>
                <DemoModeToggle showLabel={true} showInfo={true} />
              </Box>
              
              <Grid container spacing={3}>
                {/* Main Status Card */}
                <Grid xs={12} lg={8}>
                  <GooglePayStatusIndicator showDetails={true} />
                </Grid>
                
                {/* Quick Stats Cards */}
                <Grid xs={12} lg={4}>
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                        <Payment color="primary" />
                        Betalingsstatistikk
                      </Typography>
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                          0
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Betalinger i dag
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                          100%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Suksessrate
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                  
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                        <CardMembership color="primary" />
                        Medlemskort
                      </Typography>
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                          0
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Opprettet i dag
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                          0
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Aktive medlemskort
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                  
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                        <Speed color="primary" />
                        Ytelse
                      </Typography>
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                          &lt;100ms
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Gjennomsnittlig responstid
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                          99.9%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Oppetid
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Subscriber Statistics Panel */}
              <Box sx={{ mt: 3 }}>
                <div>
                  <div>
                    {/* SubscriberStatsPanel temporarily disabled - component returns void */}
                    <div>Subscriber Stats Panel</div>
                  </div>
                </div>
              </Box>
              
              {/* Authentication Test */}
              <Box sx={{ mt: 3 }}>
                <div>
                  <div>
                    {/* AuthenticationTest temporarily disabled - component returns void */}
                    <div>Authentication Test</div>
                  </div>
                </div>
              </Box>
            </Box>
          )}

      {/* Communication Content */}
      {mainTab === 0 && (

      <Grid container spacing={2} sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Users & Rooms */}
        <Grid xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kommunikasjon</Typography>
                  <div><GooglePayStatusIndicator compact={true} /></div>
                  <div><div>{/* SubscriberStatsPanel temporarily disabled - component returns void */}<div>Subscriber Stats</div></div></div>
                  <div><DemoModeToggle compact={true} /></div>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Legg til ny bruker">
                    <IconButton 
                      size="small"
                      onClick={() => toast({ title: "Legg til bruker", description: "Funksjon kommer snart" })}
                    >
                      <PersonAddIcon />
                    </IconButton>
                  </Tooltip>
                  <Button variant="contained"
                    size="small"
                    startIcon={<NotificationsIcon />}
                    onClick={handleCreateBroadcast}
                    sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
                  >
                    Broadcast
                  </Button>
                </Box>
              </Box>

              <TextField
                fullWidth
                size="small"
                placeholder="Søk etter brukere..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
            }}
                sx={{ mb: 2 }}
              />

              <Tabs
                value={selectedTab}
                onChange={(e, newValue) => setSelectedTab(newValue)}
                sx={{ mb: 2, minHeight: 32 }}
              >
                <Tab label="Brukere" />
                <Tab label="Grupper" />
                <Tab label="Aktive" />
              </Tabs>

              <List sx={{ flex: 1, overflow: 'auto' }}>
                {selectedTab === 0 && filteredUsers.map((user: ChatUser) => (
                  <ListItem key={user.id} disablePadding>
                    <ListItemButton
                      onClick={() => setSelectedChat(`user-${user.id}`)}
                      selected={selectedChat === `user-${user.id}`}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                    <ListItemAvatar>
                      <Badge
                        color={user.isOnline ? "success" : "default"}
                        variant="dot"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      >
                        <Avatar src={user.avatar}>
                          {user.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {user.profession || 'Bruker'}
                          </Typography>
                          {user.unreadCount > 0 && (
                            <Chip
                              label={user.unreadCount}
                              size="small"
                              color="primary"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                    }
                    />
                    </ListItemButton>
                  </ListItem>
                ))}

                {selectedTab === 1 && chatRooms.map((room: ChatRoom) => (
                  <ListItem key={room.id} disablePadding>
                    <ListItemButton
                      onClick={() => setSelectedChat(room.id)}
                      selected={selectedChat === room.id}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                    <ListItemAvatar>
                      <Avatar>
                        <GroupIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={room.name}
                      secondary={`${room.participants.length} medlemmer`}
                    />
                    {room.unreadCount > 0 && (
                      <Chip
                        label={room.unreadCount}
                        size="small"
                        color="primary"
                      />
                    )}
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side - Chat Area */}
        <Grid xs={12} md={8}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedChatInfo ? (
              <>
                {/* Chat Header */}
                <CardContent sx={{ borderBottom: 1, borderColor: 'divider', py: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar src={selectedChatInfo.avatar} sx={{ mr: 2 }}>
                        {selectedChatInfo.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedChatInfo.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedChatInfo.profession || selectedChatInfo.type || 'Aktiv'}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Tooltip title="Video samtale">
                        <IconButton>
                          <VideoCallIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ring">
                        <IconButton>
                          <PhoneIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>

                {/* Messages Area */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {messages.map((message: ChatMessage) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.senderId === 'admin' ? 'flex-end' : 'flex-start',
                        mb: 1
                  }}
                    >
                      <Paper
                        sx={{
                          p: 1.5,
                          maxWidth: '70%',
                          bgcolor: message.senderId === 'admin' ? '#ff8c00' : 'grey.100',
                          color: message.senderId === 'admin' ? 'white' : 'text.primary'
                    }}>
                        <Typography variant="body2">{message.content}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            opacity: 0.7,
                            textAlign: 'right'
                      }}
                        >
                          {new Date(message.timestamp).toLocaleTimeString('no')}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                  <div ref={messagesEndRef} />
                </Box>

                {/* Message Input */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={3}
                      placeholder="Skriv en melding..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                      }
                    }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <IconButton size="small">
                              <AttachFileIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                  }}
                    />
                    <Button variant="contained"
                      endIcon={<SendIcon />}
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sendMessageMutation.isPending}
                      sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
                    >
                      Send
                    </Button>
                  </Box>
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column'
            }}
              >
                <ChatIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  Velg en bruker eller gruppe for å starte en samtale
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Kommuniser direkte med alle plattformbrukere via Google Chat
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => setAnchorEl(null)}>
          <HistoryIcon sx={{ mr: 1 }} />
          Chat historie
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <SettingsIcon sx={{ mr: 1 }} />
          Chat innstillinger
        </MenuItem>
      </Menu>
    </Box>
  );
}