import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest, getAuthHeader } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { AdminButton } from './design-system';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Badge,
  Tooltip,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Paper,
  LinearProgress,
  Collapse,
  Button,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Warning,
  Error,
  CheckCircle,
  Info,
  Notifications,
  Email,
  Chat,
  Dashboard,
  Storage,
  Security,
  Lan,
  Api,
  Memory,
  Speed as Speed,
  MonitorHeart,
  BugReport,
  ExpandMore,
  ExpandLess,
  Refresh,
  Settings,
  NotificationImportant,
  SystemSecurityUpdate,
  AdminPanelSettings,
  Timeline,
  TrendingUp,
  FilterList,
  Search,
  GraphicEq as MediaProtocolIcon,
  SmartToy as AiProtocolIcon,
  ChatBubble as ChatProtocolIcon,
  Shield as ShieldIcon,
  Search as SeoIcon,
  Movie as VideoIcon,
  AudioFile as AudioIcon,
  Psychology as MLIcon,
  Wifi as WebSocketIcon,
  Stream as RtmpIcon,
  Hd as HlsIcon,
  Group as ActivityPubIcon,
  CalendarToday as CalDavIcon,
  Contacts as CardDavIcon,
  CreditCard as PciIcon,
  VpnLock as ZeroTrustIcon,
  Security as AcmeIcon,
  AccountTree as GraphQLIcon,
  Memory as GrpcIcon,
  Business as IsoIcon,
  Description as JsonLdIcon,
} from '@mui/icons-material';

interface SystemEvent {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'database' | 'api' | 'security' | 'performance' | 'integration' | 'user_action' | 'system';
  source: string;
  message: string;
  details?: any;
  resolved: boolean;
  alertsSent: string[];
  metadata?: any;
}

interface ProtocolRule {
  id: string;
  name: string;
  category: string;
  severity: string;
  enabled: boolean;
  triggers: string[];
  actions: string[];
  description: string;
}

interface AlertChannel {
  type: 'email' | 'slack' | 'dashboard' | 'sms' | 'webhook';
  enabled: boolean;
  config: any;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`protocol-tabpanel-${index}`}
      aria-labelledby={`protocol-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface ComprehensiveProtocolManagerProps {
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

const ComprehensiveProtocolManager: React.FC<ComprehensiveProtocolManagerProps> = ({
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
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // ⚠️ OMFATTENDE PROTOKOLL STØTTE: Chat, Media, AI, Sikkerhet, SEO
  const [protocolCategories] = useState([
    {
      id: 'communication',
      name: 'Kommunikasjonsprotokoller',
      icon: <ChatProtocolIcon />,
      protocols: [
        { id: 'websocket', name: 'WebSocket (WSS)', status: 'active', description: 'Sanntids kommunikasjon for chat og live feedback' },
        { id: 'xmpp', name: 'XMPP', status: 'pending', description: 'Åpen standard for meldinger og chat' },
        { id: 'matrix', name: 'Matrix Protocol', status: 'pending', description: 'Moderne, åpen standard for kryptert chat og samarbeid' },
        { id: 'webrtc', name: 'WebRTC', status: 'active', description: 'Videomøter og sanntids lyd/video i nettleser' }
      ]
  },
    {
      id: 'api_protocols',
      name: 'API og Datautveksling',
      icon: <Api />,
      protocols: [
        { id: 'rest', name: 'REST API (HTTP/HTTPS)', status: 'active', description: 'Klassisk standard for datautveksling' },
        { id: 'graphql', name: 'GraphQL', status: 'active', description: 'Moderne alternativ for fleksible API-forespørsler' },
        { id: 'grpc', name: 'gRPC', status: 'pending', description: 'Effektiv binær protokoll for høyytelses backend kommunikasjon' },
        { id: 'acme', name: 'ACME Protocol', status: 'pending', description: 'Automatisert sertifikatfornyelse (Let\'s Encrypt)' }
      ]
  },
    {
      id: 'media_protocols',
      name: 'Kreativ Medie-håndtering',
      icon: <MediaProtocolIcon />,
      protocols: [
        { id: 'https_range', name: 'HTTPS + Range Requests', status: 'active', description: 'Streaming av store filer (bilder, videoer)' },
        { id: 'rtmp', name: 'RTMP', status: 'pending', description: 'Real-Time Messaging Protocol for live-streaming' },
        { id: 'hls', name: 'HLS / MPEG-DASH', status: 'pending', description: 'Standarder for videoavspilling i nettleser' },
        { id: 'ndi', name: 'NDI', status: 'pending', description: 'Network Device Interface for videostrømming over nettverk' },
        { id: 'srt', name: 'SRT', status: 'pending', description: 'Secure Reliable Transport for sikker video-streaming' },
        { id: 'webdav', name: 'WebDAV', status: 'pending', description: 'Filsynkronisering på Dropbox-lignende måte' }
      ]
  },
    {
      id: 'ai_protocols',
      name: 'AI og Maskinlæring',
      icon: <AiProtocolIcon />,
      protocols: [
        { id: 'onnx', name: 'ONNX', status: 'pending', description: 'Open Neural Network Exchange for AI-modeller på tvers av systemer' },
        { id: 'neural_compression', name: 'Neural Compression', status: 'pending', description: 'AI-baserte codec-er for smartere komprimering' },
        { id: 'mlflow', name: 'MLflow', status: 'pending', description: 'Standard for å tracke og kjøre AI-modeller' },
        { id: 'federated_learning', name: 'Federated Learning', status: 'pending', description: 'AI læring fra flere brukere uten sentralt datasamling (GDPR-vennlig)' }
      ]
  },
    {
      id: 'collaboration',
      name: 'Samarbeid og Deling',
      icon: <ActivityPubIcon />,
      protocols: [
        { id: 'activitypub', name: 'ActivityPub', status: 'pending', description: 'Protokoll for sosiale funksjoner (likes, følger)' },
        { id: 'caldav', name: 'CalDAV', status: 'pending', description: 'Kalenderintegrasjon med Google Calendar og Outlook' },
        { id: 'carddav', name: 'CardDAV', status: 'pending', description: 'Kontaktintegrasjon med adressebøker' }
      ]
  },
    {
      id: 'security_protocols',
      name: 'Sikkerhetsprotokoller',
      icon: <ShieldIcon />,
      protocols: [
        { id: 'pci_dss', name: 'PCI DSS', status: 'pending', description: 'Standard for sikker kortbetaling' },
        { id: '3d_secure', name: '3D Secure 2.0', status: 'pending', description: 'Ekstra autentisering ved kortbetaling' },
        { id: 'scim', name: 'SCIM', status: 'pending', description: 'System for Cross-domain Identity Management' },
        { id: 'zero_trust', name: 'Zero Trust', status: 'pending', description: 'Rammeverk for at hver forespørsel autentiseres' },
        { id: 'cors', name: 'CORS', status: 'active', description: 'Cross-Origin Resource Sharing for API sikkerhet' }
      ]
  },
    {
      id: 'vendor_protocols',
      name: 'Vendor og Business',
      icon: <IsoIcon />,
      protocols: [
        { id: 'iso_9001', name: 'ISO 9001', status: 'pending', description: 'Standard for kvalitetssikring' },
        { id: 'iso_27001', name: 'ISO 27001', status: 'pending', description: 'Standard for informasjonssikkerhet' },
        { id: 'gdpr_dpa', name: 'GDPR DPA', status: 'active', description: 'Databehandleravtale-protokoller' },
        { id: 'edi', name: 'EDI', status: 'pending', description: 'Electronic Data Interchange for B2B-partnere' },
        { id: 'open_banking', name: 'Open Banking API', status: 'pending', description: 'PSD2 for direkte betalingsløsninger i EU' }
      ]
  },
    {
      id: 'seo_protocols',
      name: 'SEO og Strukturert Data',
      icon: <SeoIcon />,
      protocols: [
        { id: 'json_ld', name: 'JSON-LD', status: 'pending', description: 'Strukturert metadata for SEO og Google integrasjon' },
        { id: 'schema_org', name: 'Schema.org', status: 'pending', description: 'Strukturert data for bedre søkemotorforståelse' },
        { id: 'openapi', name: 'OpenAPI (Swagger)', status: 'active', description: 'Dokumentering av API-er på en standard måte' }
      ]
  }
  ]);

  // Hent systemhendelser i sanntid
  const { data: systemEventsData = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/admin/system-events'],
    refetchInterval: 5000,
    queryFn: async () => {
      const authHeaders = await getAuthHeader();
      return apiRequest('/api/admin/system-events', {
        headers: authHeaders,
      });
    }, // Oppdater hver 5. sekund
  });

  // Hent protokollregler
  const { data: protocolRulesData = [] } = useQuery({
    queryKey: ['/api/admin/protocol-rules'],
    queryFn: async () => {
      const authHeaders = await getAuthHeader();
      return apiRequest('/api/admin/protocol-rules', {
        headers: authHeaders,
      });
    },
  });

  // Hent alert kanaler
  const { data: alertChannels = {} } = useQuery({
    queryKey: ['/api/admin/alert-channels'],
    queryFn: async () => {
      const authHeaders = await getAuthHeader();
      return apiRequest('/api/admin/alert-channels', {
        headers: authHeaders,
      });
    },
  });

  // Hent systemstatus
  const { data: systemStatus } = useQuery({
    queryKey: ['/api/admin/system-status'],
    refetchInterval: 10000,
    queryFn: async () => {
      const authHeaders = await getAuthHeader();
      return apiRequest('/api/admin/system-status', {
        headers: authHeaders,
      });
    }, // Oppdater hver 10. sekund
  });

  const systemEvents: SystemEvent[] = useMemo(
    () => (Array.isArray(systemEventsData) ? systemEventsData : []),
    [systemEventsData]
  );
  const protocolRules: ProtocolRule[] = Array.isArray(protocolRulesData) ? protocolRulesData : [];

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: '#f44336',
      high: '#ff9800',
      medium: '#2196f3',
      low: '#4caf50',
      info: '#9e9e9e'
  };
    return colors[severity] || colors.info;
};

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <Error sx={{ color: '#f44336' }} />;
      case 'high': return <Warning sx={{ color: '#ff9800' }} />;
      case 'medium': return <Info sx={{ color: '#2196f3' }} />;
      case 'low': return <CheckCircle sx={{ color: '#4caf50' }} />;
      default: return <Info sx={{ color: '#9e9e9e' }} />;
  }
};

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactElement> = {
      database: <Storage />,
      api: <Api />,
      security: <Security />,
      performance: <Speed />,
      integration: <Lan />,
      user_action: <AdminPanelSettings />,
      system: <MonitorHeart />
  };
    return icons[category] || <Info />;
};

  const filteredEvents = useMemo(() => systemEvents.filter((event: SystemEvent) => {
    const matchesSeverity = filterSeverity === 'all' || event.severity === filterSeverity;
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
    const matchesSearch = searchTerm.trim() === '' ||
      event.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.source.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSeverity && matchesCategory && matchesSearch;
}), [systemEvents, filterSeverity, filterCategory, searchTerm]);

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
  } else {
      newExpanded.add(eventId);
  }
    setExpandedEvents(newExpanded);
};

  const criticalEventsCount = useMemo(() => systemEvents.filter((e: SystemEvent) => e.severity === 'critical' && !e.resolved).length, [systemEvents]);
  const highEventsCount = useMemo(() => systemEvents.filter((e: SystemEvent) => e.severity === 'high' && !e.resolved).length, [systemEvents]);
  const unresolvedCount = useMemo(() => systemEvents.filter((e: SystemEvent) => !e.resolved).length, [systemEvents]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header med oversikt */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <CardContent>
          <Typography variant="h4" component="h2" sx={{ color: 'white', mb: 2, display: 'flex', alignItems: 'center' }}>
            <SystemSecurityUpdate sx={{ mr: 2 }} />
            Omfattende Protokollstyring
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Badge badgeContent={criticalEventsCount} color="error">
                    <Error sx={{ fontSize: 40, color: '#f44336' }} />
                  </Badge>
                  <Typography variant="h6" sx={{ mt: 1 }}>Kritiske Hendelser</Typography>
                  <Typography variant="h4" sx={{ color: '#f44336' }}>{criticalEventsCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Badge badgeContent={highEventsCount} color="warning">
                    <Warning sx={{ fontSize: 40, color: '#ff9800' }} />
                  </Badge>
                  <Typography variant="h6" sx={{ mt: 1 }}>Høy Prioritet</Typography>
                  <Typography variant="h4" sx={{ color: '#ff9800' }}>{highEventsCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Badge badgeContent={unresolvedCount} color="info">
                    <NotificationImportant sx={{ fontSize: 40, color: '#2196f3' }} />
                  </Badge>
                  <Typography variant="h6" sx={{ mt: 1 }}>Uløste Hendelser</Typography>
                  <Typography variant="h4" sx={{ color: '#2196f3' }}>{unresolvedCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <MonitorHeart sx={{ fontSize: 40, color: systemStatus?.overall === 'healthy' ? '#4caf50' : '#f44336' }} />
                  <Typography variant="h6" sx={{ mt: 1 }}>System Status</Typography>
                  <Typography variant="h4" sx={{ color: systemStatus?.overall === 'healthy' ? '#4caf50' : '#f44336' }}>
                    {systemStatus?.overall === 'healthy' ? 'OK' : 'FEIL'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs for forskjellige protokollvisninger */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Live Hendelser" icon={<Timeline />} />
          <Tab label="Protokollregler" icon={<Settings />} />
          <Tab label="Alert Kanaler" icon={<Notifications />} />
          <Tab label="Systemanalyse" icon={<TrendingUp />} />
          <Tab label="Hendelseshistorikk" icon={<BugReport />} />
        </Tabs>
      </Paper>

      {/* Tab 0: Live Hendelser */}
      <TabPanel value={currentTab} index={0}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <Timeline sx={{ mr: 1 }} />
              Live Systemhendelser
              <AdminButton
                tone="ghost"
                startIcon={<Refresh />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/system-events'] })}
                sx={{ ml: 'auto' }}
              >
                Oppdater
              </AdminButton>
            </Typography>
            
            {/* Filtere */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  aria-label="Søk i hendelser"
                  placeholder="Søk i hendelser..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Alvorlighetsgrad</InputLabel>
                  <Select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    label="Alvorlighetsgrad"
                  >
                    <MenuItem value="all">Alle</MenuItem>
                    <MenuItem value="critical">Kritisk</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="info">Info</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    label="Kategori"
                  >
                    <MenuItem value="all">Alle</MenuItem>
                    <MenuItem value="database">Database</MenuItem>
                    <MenuItem value="api">API</MenuItem>
                    <MenuItem value="security">Sikkerhet</MenuItem>
                    <MenuItem value="performance">Ytelse</MenuItem>
                    <MenuItem value="integration">Integrasjon</MenuItem>
                    <MenuItem value="user_action">Brukerhandling</MenuItem>
                    <MenuItem value="system">System</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {eventsLoading ? (
              <LinearProgress sx={{ mb: 2 }} />
            ) : (
              <List>
                {filteredEvents.map((event: SystemEvent) => (
                  <React.Fragment key={event.id}>
                    <ListItem
                      sx={{
                        border: `1px solid ${getSeverityColor(event.severity)}`,
                        borderRadius: 1,
                        mb: 1,
                        bgcolor: event.resolved ? 'rgba(76, 175, 80, 0.1)' : 'transparent'
                    }}
                    >
                      <ListItemIcon>
                        {getSeverityIcon(event.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <Typography variant="subtitle1">
                              {event.message}
                            </Typography>
                            <Chip
                              label={event.category}
                              icon={getCategoryIcon(event.category)}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              label={event.severity.toUpperCase()}
                              size="small"
                              sx={{ bgcolor: getSeverityColor(event.severity), color: 'white' }}
                            />
                            {event.resolved && (
                              <Chip
                                label="LØST"
                                size="small"
                                color="success"
                                variant="filled"
                              />
                            )}
                          </Box>
                      }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {event.source} • {new Date(event.timestamp).toLocaleString('no-NO')}
                            </Typography>
                            {event.alertsSent.length > 0 && (
                              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {event.alertsSent.map((channel) => (
                                  <Chip
                                    key={channel}
                                    label={`Alert: ${channel}`}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                      }
                      />
                      <IconButton
                        aria-label={expandedEvents.has(event.id) ? 'Skjul hendelsesdetaljer' : 'Vis hendelsesdetaljer'}
                        onClick={() => toggleEventExpansion(event.id)}
                      >
                        {expandedEvents.has(event.id) ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </ListItem>
                    
                    <Collapse in={expandedEvents.has(event.id)}>
                      <Card sx={{ ml: 4, mb: 2, bgcolor: 'rgba(0,0,0,0.02)' }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 2 }}>Hendelsesdetaljer</Typography>
                          {event.details && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tekniske detaljer:</Typography>
                              <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.05)' }}>
                                <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(event.details, null, 2)}
                                </pre>
                              </Paper>
                            </Box>
                          )}
                          {event.metadata && (
                            <Box>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata:</Typography>
                              <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.05)' }}>
                                <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              </Paper>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Collapse>
                  </React.Fragment>
                ))}
                
                {filteredEvents.length === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Ingen hendelser funnet med gjeldende filtre.
                  </Alert>
                )}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 1: Protokollregler */}
      <TabPanel value={currentTab} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <Settings sx={{ mr: 1 }} />
              Protokollregler og Triggere
            </Typography>
            
            <Grid container spacing={2}>
              {protocolRules.map((rule: ProtocolRule) => (
                <Grid item xs={12} md={6} lg={4} key={rule.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">{rule.name}</Typography>
                        <FormControlLabel
                          control={<Switch checked={rule.enabled} inputProps={{ 'aria-label': `Aktiver protokollregel ${rule.name}` }} />}
                          label=""
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {rule.description}
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label={rule.category} size="small" color="primary" sx={{ mr: 1 }} />
                        <Chip label={rule.severity} size="small" color="secondary" />
                      </Box>
                      
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Triggere:</Typography>
                      <Box sx={{ mb: 2 }}>
                        {rule.triggers.map((trigger, index) => (
                          <Chip key={index} label={trigger} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                      
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Handlinger:</Typography>
                      <Box>
                        {rule.actions.map((action, index) => (
                          <Chip key={index} label={action} size="small" color="success" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 2: Alert Kanaler */}
      <TabPanel value={currentTab} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <Notifications sx={{ mr: 1 }} />
              Alert Kanaler og Varslinger
            </Typography>
            
            <Grid container spacing={3}>
              {Object.entries(alertChannels).map(([channelType, config]) => {
                const channelConfig = config as AlertChannel;
                return (
                <Grid item xs={12} md={6} key={channelType}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {channelType === 'email' && <Email sx={{ mr: 1 }} />}
                          {channelType === 'slack' && <Chat sx={{ mr: 1 }} />}
                          {channelType === 'dashboard' && <Dashboard sx={{ mr: 1 }} />}
                          <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                            {channelType}
                          </Typography>
                        </Box>
                        <FormControlLabel
                          control={<Switch checked={channelConfig.enabled} inputProps={{ 'aria-label': `Aktiver varslingskanal ${channelType}` }} />}
                          label=""
                        />
                      </Box>
                      
                      <Alert severity={channelConfig.enabled ? 'success' : 'warning'} sx={{ mb: 2 }}>
                        {channelConfig.enabled ? 'Aktivert og operativ' : 'Deaktivert'}
                      </Alert>
                      
                      {channelConfig.config && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>Konfigurasjon:</Typography>
                          <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.05)' }}>
                            <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(channelConfig.config, null, 2)}
                            </pre>
                          </Paper>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                );
            })}
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 3: Systemanalyse */}
      <TabPanel value={currentTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Hendelser per Kategori (Siste 24t)
                </Typography>
                {/* Her kan du legge til grafer/charts */}
                <Alert severity="info">
                  Grafer og analyser kommer her når systemet samler mer data.
                </Alert>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Trend Analyse
                </Typography>
                <Alert severity="info">
                  Trend analyser og prediktive modeller kommer her.
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 4: Hendelseshistorikk */}
      <TabPanel value={currentTab} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Historisk Hendelseslogg
            </Typography>
            <Alert severity="info">
              Utvidet hendelseshistorikk med filtrering og eksport kommer her.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>
    </Box>
  );
};

export default ComprehensiveProtocolManager;
