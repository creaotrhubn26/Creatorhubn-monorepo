import React, { useState, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Card as MuiCard,
  CardContent,
  CardHeader,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  Badge,
  Fab,
  Tooltip,
  LinearProgress
} from '@mui/material';
import FullscreenChatWidget from '../chat/FullscreenChatWidget';
import {
  Help as HelpIcon,
  Add as AddIcon,
  Send as SendIcon,
  BugReport as BugReportIcon,
  Settings as FeatureIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Flag as PriorityIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Support as SupportIcon,
  Message as MessageIcon,
  Analytics as AnalyticsIcon,
  Warning as WarningIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';

interface HelpdeskTicket {
  id: string;
  title: string;
  description: string;
  category: 'bug' | 'feature_request' | 'question' | 'technical_issue' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  profession: string;
  dashboardFeature?: string;
  userEmail: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
  responses?: HelpdeskResponse[];
  systemLogs?: SystemLog[];
  attachments?: string[]
}

interface HelpdeskResponse {
  id: string;
  ticketId: string;
  message: string;
  isFromAdmin: boolean;
  authorEmail: string;
  authorName: string;
  createdAt: string
}

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  component: string;
  userAction?: string;
  errorStack?: string
}

interface HelpdeskSystemProps {
  profession: string;
  userId: string;
  dashboardFeatures: string[];
  isFloating?: boolean;
  // Integration props for universal connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

const HelpdeskSystem: React.FC<HelpdeskSystemProps> = ({ 
  profession, 
  userId,
  dashboardFeatures,
  isFloating = false,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'tickets' | 'faq'>('create');
  const [selectedTicket, setSelectedTicket] = useState<HelpdeskTicket | null>(null);
  
  const [newTicket, setNewTicket] = useState({
    title: ',',
    description: '',
    category: 'question' as const,
    priority: 'medium' as const,
    dashboardFeature: ''
});

  const [newResponse, setNewResponse] = useState('');

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Fetch user tickets
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/helpdesk/tickets', user?.email],
    queryFn: async () => {
      const response = await fetch(`/api/helpdesk/tickets?userEmail=${user?.email}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
  },
    enabled: !!user?.email && isOpen
});

  const tickets = ticketsData?.tickets || [];

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      const response = await fetch('/api/helpdesk/tickets', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(ticketData)
  });
      if (!response.ok) throw new Error('Failed to create ticket');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/helpdesk/tickets', ],});
      setNewTicket({
        title: ', ',
        description: ', ',
        category: 'question',
        priority: 'medium',
        dashboardFeature: ', '
  });
      setActiveTab('tickets');
  }
});

  // Add response mutation
  const addResponseMutation = useMutation({
    mutationFn: async ({ ticketd, message }: { ticketId: string; message: string }) => {
      const response = await fetch(`/api/helpdesk/tickets/${ticketId}/responses`, {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ message })
    });
      if (!response.ok) throw new Error('Failed to add response');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/helpdesk/tickets', ],});
      setNewResponse(', ');
  }
});

  // Log system error function
  const logSystemError = (error: Error, component: string, userAction?: string) => {
    // Send to backend for automatic ticket creation
    fetch('/api/helpdesk/log-error', {
      method: 'POS',
      headers: { 'Content-Type' : 'application/json',},
      body: JSON.stringify({
        error: {
          message: error.message,
          stack: error.stack
    },
        component,
        userAction,
        userEmail: user?.email,
        profession
    })
  }).then(response => {
      if (response.ok) {
        console.log('✅ System error logged automatically');
        // Refresh tickets to show the new auto-created ticket
        queryClient.invalidateQueries({ queryKey: ['/api/helpdesk/tickets', ],});
    }
  }).catch(logError => {
      console.error('❌ Failed to log system error: ', logError);
  });
};

  // Expose logSystemError globally for other components to use
  useEffect(() => {
    (window as any).logSystemError = logSystemError;
    return () => {
      delete (window as any).logSystemError;
  };
}, [profession, user]);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'HelpdeskSystem',
      name: 'Helpdesk System',
      type: 'universal',
      category: 'helpdesk',
      capabilities: ['ticket-management','faq-management','error-logging'],
      dependencies: ['admin-dashboard','user-interface'],
      props: ['tickets','faq-data','error-logs'],
      events: ['ticket:created','ticket:updated','error:logged'],
      dataKeys: ['tickets','faq-data','error-logs']
    });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'HelpdeskSystem',
      dataKey: 'tickets'
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'HelpdeskSystem',
      dataKey: 'faq-data'
    });

    // Listen for helpdesk events
    const ticketCreateUnsubscribe = communication.onMessageType('helpdesk: ticket-create', (data: any) => {
      if (data.ticket) {
        createTicketMutation.mutate(data.ticket);
  }
  });

    const ticketUpdateUnsubscribe = communication.onMessageType('helpdesk: ticket-update', (data: any) => {
      if (data.ticketId && data.response) {
        addResponseMutation.mutate({ ticketId: data.ticketd, message: data.response });
    }
  });

    const errorLogUnsubscribe = communication.onMessageType('helpdesk: error-log', (data: any) => {
      if (data.error) {
        logSystemError(data.error, data.component, data.userAction);
    }
  });

    return () => {
      componentRegistry.unregisterComponent('HelpdeskSystem');
      dataFlow.unregisterNode('HelpdeskSystem: tickets');
      dataFlow.unregisterNode('HelpdeskSystem:faq-data');
      ticketCreateUnsubscribe();
      ticketUpdateUnsubscribe();
      errorLogUnsubscribe();
};
}, [ticketsData, profession, dashboardFeatures, componentRegistry, dataFlow, communication, createTicketMutation, addResponseMutation, logSystemError]);

  const handleCreateTicket = () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) return;

    const ticketData = {
      ...newTicket,
      profession,
      userEmail: user?.email,
      userName: user?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Broadcast ticket creation event
    communication.sendBroadcast('helpdesk:ticket-created', {
      type: 'ticket_created',
      data: ticketData,
      component: 'HelpdeskSystem'
    }, 'medium');

    createTicketMutation.mutate(ticketData);
  };

  const handleAddResponse = () => {
    if (!selectedTicket || !newResponse.trim()) return;

    // Broadcast response added event
    communication.sendBroadcast('helpdesk:response-added', {
      type: 'response_added',
      data: { ticketId: selectedTicket.id, message: newResponse },
      component: 'HelpdeskSystem'
    }, 'medium');

    addResponseMutation.mutate({ ticketId: selectedTicket.id, message: newResponse });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug': return <BugReportIcon />;
      case 'feature_request': return <FeatureIcon />;
      case 'technical_issue': return <ErrorIcon />;
      case 'question': return <HelpIcon />;
      default: return <InfoIcon />;
}
};

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'bug': return '#f44336';
      case 'feature_request': return '#2196f3';
      case 'technical_issue': return '#ff9800';
      case 'question': return '#4caf50';
      default: return '#9e9e9e';
}
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#f44336';
      case 'in_progress': return '#ff9800';
      case 'resolved': return '#4caf50';
      case 'closed': return '#9e9e9e';
      default: return '#9e9e9e';
}
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#1976d2';
      case 'low': return '#388e3c';
      default: return '#1976d2';
}
};

  const openTickets = tickets.filter((t: HelpdeskTicket) => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedTickets = tickets.filter((t: HelpdeskTicket) => t.status === 'resolved').length;

  if (isFloating) {
    return (
      <>
        <Fab
          color="primary"
          onClick={() => setIsOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 10,
            right:  20,
            backgroundColor: '#ff8c00', '&:hover': { backgroundColor: '#e67c00',},
            zIndex: 1000}}
        >
          <Badge badgeContent={openTickets} color="error">
            <SupportIcon />
          </Badge>
        </Fab>

        <Dialog
          open={isOpen}
          onClose={() => setIsOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: { 
              backgroundColor: 'rgba(25, 255, 255, 0.05)', 
              backdropFilter: 'blur(10px)',
              minHeight: '80vh'
        }
        }}
        >
          <DialogTitle sx={{ color: 'white', display: 'flex', alignItems: 'center'}}>
            <SupportIcon sx={{ color: '#ff8c00', mr:  2 }} />
            HELPDESK - {profession.charAt(0).toUpperCase() + profession.slice(1)} Dashboard
            <Box sx={{ ml: 'auto'}}>
              <IconButton onClick={() => setIsOpen(false)} sx={{ color: 'white'}}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {/* Render full helpdesk content here */}
            {renderHelpdeskContent()}
          </DialogContent>
        </Dialog>
      </>
    );
}

  function renderHelpdeskContent() {
    return (
      <Box sx={{ width: '100%'}}>
        {/* Header with Statistics */}
        <Grid container spacing={3} sx={{ mb:  4 }}>
          <Grid item xs={12}>
            <MuiCard sx={{ backgroundColor: 'rgba(25, 255, 255, 0.02)' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center'}}>
                  <Avatar sx={{ backgroundColor: '#f44330', mr:  2 }}>
                    <MessageIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{  color: theming.colors.primary }}>
                      {openTickets}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>
                      Åpne saker
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={12}>
            <MuiCard sx={{ backgroundColor: 'rgba(25, 255, 255, 0.02)' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center'}}>
                  <Avatar sx={{ backgroundColor: '#4caf50', mr:  2 }}>
                    <CheckCircleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{  color: theming.colors.primary }}>
                      {resolvedTickets}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>
                      Løst
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={12}>
            <MuiCard sx={{ backgroundColor: 'rgba(25, 255, 255, 0.02)' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center'}}>
                  <Avatar sx={{ backgroundColor: '#2196f0', mr:  2 }}>
                    <AnalyticsIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{  color: theming.colors.primary }}>
                      {tickets.length}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>
                      Totalt
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>

        {/* Tab Navigation */}
        <Box sx={{ display: 'flex', mb:  3, gap:  2 }}>
          <Button
            variant={activeTab === 'create' ? 'contained' : 'outlined'}
            startIcon={<AddIcon />}
            onClick={() => setActiveTab('create')}
            sx={{
              backgroundColor: activeTab === 'create' ? '#ff8c00' : 'transparent',
              borderColor: '#ff8c00',
              color: activeTab === 'create' ? 'white' : '#ff8c00'
        }}
          >
            Opprett sak
          </Button>
          <Button
            variant={activeTab === 'tickets' ? 'contained' : 'outlined'}
            startIcon={<MessageIcon />}
            onClick={() => setActiveTab('tickets')}
            sx={{
              backgroundColor: activeTab === 'tickets' ? '#ff8c00' : 'transparent',
              borderColor: '#ff8c00',
              color: activeTab === 'tickets' ? 'white' : '#ff8c00'
        }}
          >
            Mine saker ({tickets.length})
          </Button>
          <Button
            variant={activeTab === 'faq' ? 'contained' : 'outlined'}
            startIcon={<HelpIcon />}
            onClick={() => setActiveTab('faq')}
            sx={{
              backgroundColor: activeTab === 'faq' ? '#ff8c00' : 'transparent',
              borderColor: '#ff8c00',
              color: activeTab === 'faq' ? 'white' : '#ff8c00'
        }}
          >
            FAQ
          </Button>
        </Box>

        {/* Create Ticket Tab */}
        {activeTab === 'create' && (
          <Paper sx={{ p:  3, backgroundColor: 'rgba(25, 255, 255, 0.05)' ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{  color: 'white', mb:  3  }}>
              Opprett ny support-sak
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tittel på saken"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white','& fieldset': { borderColor: 'rgba(25, 255, 255, 0.3)' }, '&:hover fieldset': { borderColor: '#ff8c00' }, '&.Mui-focused fieldset': { borderColor: '#ff8c00' }
                    }, '& .MuiInputLabel-root': { color: 'rgba(25, 255, 255, 0.7)' }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>Kategori</InputLabel>
                  <Select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value as any }))}
                    sx={{
                      color: 'white','& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(25, 255, 255, 0.3)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff8c00' }
                    }}
                  >
                    <MenuItem value="question">Spørsmål</MenuItem>
                    <MenuItem value="bug">Feilrapport</MenuItem>
                    <MenuItem value="feature_request">Funksjonsønske</MenuItem>
                    <MenuItem value="technical_issue">Teknisk problem</MenuItem>
                    <MenuItem value="account">Konto-relatert</MenuItem>
                    <MenuItem value="other">Annet</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>Prioritet</InputLabel>
                  <Select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as any }))}
                    sx={{
                      color: 'white','& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(25, 255, 255, 0.3)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff8c00' }
                    }}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Middels</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="critical">Kritisk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>Dashboard funksjon (valgfritt)</InputLabel>
                  <Select
                    value={newTicket.dashboardFeature}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, dashboardFeature: e.target.value }))}
                    sx={{
                      color: 'white','& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(25, 255, 255, 0.3)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff8c00' }
                    }}
                  >
                    <MenuItem value="">Velg funksjon...</MenuItem>
                    {dashboardFeatures.map((feature) => (
                      <MenuItem key={feature} value={feature}>{feature}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Detaljert beskrivelse"
                  placeholder="Beskriv problemet eller spørsmålet ditt så detaljert som mulig..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white','& fieldset': { borderColor: 'rgba(25, 255, 255, 0.3)' }, '&:hover fieldset': { borderColor: '#ff8c00' }, '&.Mui-focused fieldset': { borderColor: '#ff8c00' }
                    }, '& .MuiInputLabel-root': { color: 'rgba(25, 255, 255, 0.7)' }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleCreateTicket}
                  disabled={createTicketMutation.isPending || !newTicket.title.trim() || !newTicket.description.trim()}
                  sx={{
                    backgroundColor: '#ff8c00','&:hover': { backgroundColor: '#e67c00',}
                }}
                >
                  {createTicketMutation.isPending ? 'Sender...' : 'Opprett sak'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* My Tickets Tab */}
        {activeTab === 'tickets' && (
          <Box>
            {tickets.length === 0 ? (
              <Alert severity="info">Du har ingen support-saker ennå.</Alert>
            ) : (
              <Grid container spacing={2}>
                {tickets.map((ticket: HelpdeskTicket) => (
                  <Grid item xs={12} key={ticket.id}>
                    <MuiCard sx={{ backgroundColor: 'rgba(25, 255, 255, 0.02)' }}>
                      <CardHeader
                        avatar={
                          <Avatar sx={{ backgroundColor: getCategoryColor(ticket.category, ),  ...theming.getThemedCardSx() }}>
                            {getCategoryIcon(ticket.category)}
                          </Avatar>
                      }
                        title={
                          <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                            {ticket.title}
                          </Typography>
                      }
                        subheader={
                          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap'}}>
                            <Chip
                              label={ticket.status.toUpperCase()}
                              size="small"
                              sx={{
                                backgroundColor: getStatusColor(ticket.status),
                                color: 'white'
                          }}
                            />
                            <Chip
                              label={ticket.priority.toUpperCase()}
                              size="small"
                              sx={{
                                backgroundColor: getPriorityColor(ticket.priority),
                                color: 'white'
                              }}
                            />
                            <Chip
                              label={ticket.category.replace('_', ', ').toUpperCase()}
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: 'rgba(25, 255, 255, 0.3)', color: 'rgba(25, 255, 255, 0.7)' }}
                            />
                          </Box>
                        }
                        action={
                          <Button
                            size="small"
                            onClick={() => setSelectedTicket(ticket)}
                            sx={{ color: '#ff8c00' }}
                          >
                            Se detaljer
                          </Button>
                        }
                      />
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
                          {ticket.description.length > 200
                            ? `${ticket.description.substring(0, 200)}...`
                            : ticket.description
                          }
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(25, 255, 255, 0.6)', mt: 1, display: 'block' }}>
                          Opprettet: {new Date(ticket.createdAt).toLocaleDateString('nb-NO')}
                        </Typography>
                      </CardContent>
                    </MuiCard>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 3 }}>
              Ofte stilte spørsmål - {profession.charAt(0).toUpperCase() + profession.slice(1)} Dashboard
            </Typography>

            <FAQSection profession={profession} />
          </Box>
        )}

        {/* Ticket Detail Dialog */}
        <Dialog
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { backgroundColor: 'rgba(25, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }
          }}
        >
          {selectedTicket && (
            <>
              <DialogTitle sx={{ color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {selectedTicket.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <Chip
                      label={selectedTicket.status.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: getStatusColor(selectedTicket.status),
                        color: 'white'
                  }}
                    />
                    <IconButton onClick={() => setSelectedTicket(null)} sx={{ color: 'white'}}>
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent>
                <Typography variant="body1" sx={{ color: 'white', mb:  3 }}>
                  {selectedTicket.description}
                </Typography>
                
                {/* Add response section for open tickets */}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(25, 255, 255, 0.05)', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'white', mb: 2 }}>
                      Legg til mer informasjon:
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder="Skriv tilleggsinformasjon..."
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': { borderColor: 'rgba(25, 255, 255, 0.3)' },
                          '&:hover fieldset': { borderColor: '#ff8c00' },
                          '&.Mui-focused fieldset': { borderColor: '#ff8c00' }
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<SendIcon />}
                      onClick={handleAddResponse}
                      disabled={!newResponse.trim() || addResponseMutation.isPending}
                      sx={{
                        backgroundColor: '#ff8c00', '&:hover': { backgroundColor: '#e67c00' }
                      }}
                    >
                      Send
                    </Button>
                  </Box>
                )}
              </DialogContent>
            </>
          )}
        </Dialog>
      </Box>
    );
  };

  // For non-floating mode (when embedded in settings)
  return (
    <Box sx={{ width: '100%' }}>
      {renderHelpdeskContent()}
    </Box>
  );
};

// FAQ Section Component
const FAQSection: React.FC<{ profession: string }> = ({ profession }) => {
  const { data: faqData, isLoading } = useQuery({
    queryKey: ['/api/helpdesk/faq', profession],
    queryFn: async () => {
      const response = await fetch(`/api/helpdesk/faq/${profession}`);
      if (!response.ok) throw new Error('Failed to fetch FAQ');
      return response.json();
  }
});

  if (isLoading) {
    return <LinearProgress sx={{ mb:  2 }} />;
}

  const faqItems = faqData?.faq || [];

  if (faqItems.length === 0) {
    return (
      <Alert severity="info">
        FAQ-innhold vil bli tilgjengelig etter hvert som vi samler inn vanlige spørsmål fra {profession}-dashboardet.
      </Alert>
    );
  }

  return (
    <Box>
      {faqItems.map((item: any, index: number) => (
        <Accordion
          key={index}
          sx={{
            backgroundColor: 'rgba(25, 255, 255, 0.02)',
            mb: 1, '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#ff8c00' }} />}
            sx={{
              '& .MuiAccordionSummary-content': {
                alignItems: 'center'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <HelpIcon sx={{ color: '#ff8c00', mr: 2 }} />
              <Typography variant="subtitle1" sx={{ color: 'white' }}>
                {item.question}
              </Typography>
              <Chip
                label={item.category.toUpperCase()}
                size="small"
                sx={{
                  ml: 'auto',
                  backgroundColor: '#ff8c00',
                  color: 'white',
                  fontSize: '0.7rem'
                }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ color:'rgba(25, 255, 255, 0.8)' }}>
              {item.answer}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default HelpdeskSystem;