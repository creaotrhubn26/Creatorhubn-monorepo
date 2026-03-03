import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Grid2 as Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  BugReport as BugReportIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Science as TestTubeIcon,
} from '@mui/icons-material';
import { useWireMock } from '@/hooks/useWireMock';
import { ContextualAITooltip } from '../ai-tooltips/ContextualAITooltip';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export function WireMockController() {
  const {
    status,
    endpoints,
    isLoading,
    toggleWireMock,
    switchMode,
    toggleEndpoint,
    testEndpoint,
    createEndpoint,
    refresh
} = useWireMock();

  const [activeTab, setActiveTab] = useState(0);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('all');
  type EndpointMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
  const [newEndpoint, setNewEndpoint] = useState({
    name: '',
    method: 'GET' as EndpointMethod,
    url: '',
    responseStatus: 200,
    responseBody: '{}',
    service: 'custom',
    delay: 0 });

  const handleCreateEndpoint = async () => {
    try {
      const endpoint = await createEndpoint({
        ...newEndpoint,
        responseBody: JSON.parse(newEndpoint.responseBody),
        isActive: true
  });
      
      if (endpoint) {
        setShowCreateDialog(false);
        setNewEndpoint({
          name: '',
          method: 'GET',
          url: '',
          responseStatus: 200,
          responseBody: '{}',
          service: 'custom',
          delay: 0 });
    }
  } catch (error) {
      console.error('Error creating endpoint: ', error);
  }
};

  const filteredEndpoints = selectedService === 'all' 
    ? endpoints 
    : endpoints.filter(ep => ep.service === selectedService);

  const uniqueServices = Array.from(new Set(endpoints.map(ep => ep.service)));

  const getServiceIcon = (service: string) => {
    const icons: Record<string, string> = {
      'google':'🔍','microsoft':'🏢','stripe':'💳','openai':'🧠','vipps':'📱','canon':'📷','spotify':'🎵','youtube':'📺','zoom':'📹', 'slack':'💬', 'custom' : '⚙️'
  };
    return icons[service] || '🔧';
};

  if (!status) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
}

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Controls */}
      <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
              🎭 WireMock Controller
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Administrer mock-tjenester for testing av alle platform-integrasjoner
            </Typography>
          </Grid>
          
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2}>
              <ContextualAITooltip
                context={{
                  type: 'integration',
                  data: { feature: 'wiremock', enabled: status.isEnabled },
                  currentState: { mode: 'toggle' }
              }}
                placement="bottom"
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={status.isEnabled}
                      onChange={(e) => toggleWireMock(e.target.checked)}
                      disabled={isLoading}
                    />
                }
                  label={`WireMock ${status.isEnabled ? 'Aktivert' : 'Deaktivert'}`}
                />
              </ContextualAITooltip>
              
              <ContextualAITooltip
                context={{
                  type: 'integration',
                  data: { feature: 'mode-switch', currentMode: status.currentMode },
                  currentState: { enabled: status.isEnabled }
              }}
                placement="bottom"
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={status.currentMode === 'mock'}
                      onChange={(e) => switchMode(e.target.checked ? 'mock' : 'production')}
                      disabled={isLoading || !status.isEnabled}
                    />
                }
                  label={`Modus: ${status.currentMode === 'mock' ? 'Mock' : 'Produksjon'}`}
                />
              </ContextualAITooltip>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="text.secondary" gutterBottom>
                Total Endpoints
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {status.totalEndpoints}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="text.secondary" gutterBottom>
                Aktive Endpoints
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {status.activeEndpoints}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="text.secondary" gutterBottom>
                Mock Services
              </Typography>
              <Typography variant="h4" color="primary.main" sx={{ color: theming.colors.primary }}>
                {status.mockServices.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="text.secondary" gutterBottom>
                Status
              </Typography>
              <Chip 
                label={status.currentMode}
                color={status.currentMode === 'mock' ? 'primary' : 'default'}
                variant="filled"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Paper sx={{ width: '100%', ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Endpoints" />
            <Tab label="Services" />
            <Tab label="Testing" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {/* Endpoints Tab */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120}}>
              <InputLabel>Service</InputLabel>
              <Select
                value={selectedService}
                label="Service"
                onChange={(e) => setSelectedService(e.target.value)}
              >
                <MenuItem value="all">Alle Services</MenuItem>
                {uniqueServices.map(service => (
                  <MenuItem key={service} value={service}>
                    {getServiceIcon(service)} {service}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
            >
              Nytt Endpoint
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={refresh}
            >
              Oppdater
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Navn</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Bruk</TableCell>
                  <TableCell>Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEndpoints.map((endpoint) => (
                  <TableRow key={endpoint.id}>
                    <TableCell>
                      <ContextualAITooltip
                        context={{
                          type: 'integration',
                          data: { service: endpoint.service, type: 'api' },
                          currentState: { isActive: endpoint.isActive, usageCount: endpoint.usageCount }
                      }}
                        placement="right"
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          {getServiceIcon(endpoint.service)} {endpoint.service}
                        </Box>
                      </ContextualAITooltip>
                    </TableCell>
                    <TableCell>
                      <ContextualAITooltip
                        context={{
                          type: 'endpoint',
                          data: endpoint,
                          currentState: { 
                            isActive: endpoint.isActive, 
                            usageCount: endpoint.usageCount,
                            errorRate: Math.random() * 20, // Mock error rate
                            avgResponseTime: 500 + Math.random() * 2000 // Mock response time
                      }
                      }}
                        placement="top"
                      >
                        <Typography variant="body2" sx={{ cursor: 'help', textDecoration: 'underline dotted' }}>
                          {endpoint.name}
                        </Typography>
                      </ContextualAITooltip>
                    </TableCell>
                    <TableCell>
                      <Chip label={endpoint.method} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {endpoint.url}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <ContextualAITooltip
                        context={{
                          type: endpoint.isActive ? 'performance' : 'error',
                          data: { status: endpoint.isActive ? 'active' : 'inactive', endpoint },
                          currentState: { isActive: endpoint.isActive }
                      }}
                        placement="top"
                      >
                        <Chip 
                          label={endpoint.isActive ? 'Aktiv' : 'Inaktiv'}
                          color={endpoint.isActive ? 'success' : 'default'}
                          size="small"
                          sx={{ cursor: 'help' }}
                        />
                      </ContextualAITooltip>
                    </TableCell>
                    <TableCell>{endpoint.usageCount}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap:  1 }}>
                        <ContextualAITooltip
                          context={{
                            type: 'endpoint',
                            data: endpoint,
                            currentState: { action: 'toggle', isActive: endpoint.isActive }
                        }}
                          placement="top"
                        >
                          <Tooltip title={endpoint.isActive ? 'Deaktiver' : 'Aktiver'}>
                            <IconButton 
                              size="small"
                              onClick={() => toggleEndpoint(endpoint.id, !endpoint.isActive)}
                            >
                              {endpoint.isActive ? <ToggleOnIcon /> : <ToggleOffIcon />}
                            </IconButton>
                          </Tooltip>
                        </ContextualAITooltip>
                        
                        <ContextualAITooltip
                          context={{
                            type: 'endpoint',
                            data: endpoint,
                            currentState: { action: 'test' }
                        }}
                          placement="top"
                        >
                          <Tooltip title="Test Endpoint">
                            <IconButton 
                              size="small"
                              onClick={() => testEndpoint(endpoint)}
                            >
                              <TestTubeIcon />
                            </IconButton>
                          </Tooltip>
                        </ContextualAITooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* Services Tab */}
          <Grid container spacing={2}>
            {uniqueServices.map(service => {
              const serviceEndpoints = endpoints.filter(ep => ep.service === service);
              const activeCount = serviceEndpoints.filter(ep => ep.isActive).length;
              
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {getServiceIcon(service)} {service}
                      </Typography>
                      <Typography color="text.secondary">
                        {serviceEndpoints.length} endpoints
                      </Typography>
                      <Typography color="success.main">
                        {activeCount} aktive
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt:  1 }}>
                        {serviceEndpoints.slice(0, 3).map(ep => (
                          <Chip 
                            key={ep.id}
                            label={ep.method}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {serviceEndpoints.length > 3 && (
                          <Chip 
                            label={`+${serviceEndpoints.length - 3}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
          })}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Testing Tab */}
          <Alert severity="info" sx={{ mb:  2 }}>
            Test alle platform-integrasjoner med mock-data. Dette inkluderer Google Pay, 
            Visual Editor, Feature Editor, og Code Generator.
          </Alert>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    📝 Visual Editor Testing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Test visuell redigering med mock-data
                  </Typography>
                  <ContextualAITooltip
                    context={{
                      type: 'integration',
                      data: { service: 'visual-editor', testType: 'ui-component' },
                      currentState: { action: 'test' }
                  }}
                    placement="top"
                  >
                    <Button
                      variant="outlined"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => testEndpoint(endpoints.find(ep => ep.id === 'visual-editor-test') || endpoints[0])}
                    >
                      Test Visual Editor
                    </Button>
                  </ContextualAITooltip>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    💳 Google Pay Testing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Test betalingsfunksjoner med mock-data
                  </Typography>
                  <ContextualAITooltip
                    context={{
                      type: 'integration',
                      data: { service: 'google-pay', testType: 'payment' },
                      currentState: { action: 'test', critical: true }
                  }}
                    placement="top"
                  >
                    <Button
                      variant="outlined"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => testEndpoint(endpoints.find(ep => ep.service === 'google-pay') || endpoints[0])}
                    >
                      Test Google Pay
                    </Button>
                  </ContextualAITooltip>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    🔧 Feature Editor Testing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Test funksjons-administrasjon
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => testEndpoint(endpoints.find(ep => ep.id === 'feature-editor-test') || endpoints[0])}
                  >
                    Test Feature Editor
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    🧠 Code Generator Testing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Test intelligent kodegenerering
                  </Typography>
                  <ContextualAITooltip
                    context={{
                      type: 'integration',
                      data: { service: 'openai', testType: 'ai-generation' },
                      currentState: { action: 'test', costSensitive: true }
                  }}
                    placement="top"
                  >
                    <Button
                      variant="outlined"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => testEndpoint(endpoints.find(ep => ep.service ==='openai') || endpoints[0])}
                    >
                      Test Code Generator
                    </Button>
                  </ContextualAITooltip>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Create Endpoint Dialog */}
      <Dialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Opprett Nytt Mock Endpoint</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Navn"
                value={newEndpoint.name}
                onChange={(e) => setNewEndpoint(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            
            <Grid size={{ xs:  6 }}>
              <FormControl fullWidth>
                <InputLabel>Method</InputLabel>
                <Select
                  value={newEndpoint.method}
                  label="Method"
                  onChange={(e) =>
                    setNewEndpoint((prev) => ({
                      ...prev,
                      method: e.target.value as EndpointMethod,
                    }))
                  }
                >
                  <MenuItem value="GET">GET</MenuItem>
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                  <MenuItem value="DELETE">DELETE</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid size={{ xs:  6 }}>
              <TextField
                fullWidth
                label="Service"
                value={newEndpoint.service}
                onChange={(e) => setNewEndpoint(prev => ({ ...prev, service: e.target.value }))}
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="URL"
                value={newEndpoint.url}
                onChange={(e) => setNewEndpoint(prev => ({ ...prev, url: e.target.value }))}
                placeholder="/api/custom-endpoint"
              />
            </Grid>
            
            <Grid size={{ xs:  6 }}>
              <TextField
                fullWidth
                type="number"
                label="Response Status"
                value={newEndpoint.responseStatus}
                onChange={(e) =>
                  setNewEndpoint((prev) => ({
                    ...prev,
                    responseStatus: parseInt(e.target.value, 10) || 200,
                  }))
                }
              />
            </Grid>
            
            <Grid size={{ xs:  6 }}>
              <TextField
                fullWidth
                type="number"
                label="Delay (ms)"
                value={newEndpoint.delay}
                onChange={(e) =>
                  setNewEndpoint((prev) => ({
                    ...prev,
                    delay: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Response Body (JSON)"
                value={newEndpoint.responseBody}
                onChange={(e) => setNewEndpoint(prev => ({ ...prev, responseBody: e.target.value }))}
                placeholder='{"success": true"message" : "Mock response"}'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreateEndpoint}
            variant="contained"
            disabled={!newEndpoint.name || !newEndpoint.url}
           sx={theming.getThemedButtonSx()}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
