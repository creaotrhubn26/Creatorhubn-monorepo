import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
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
  Button,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Warning,
  Error,
  CheckCircle,
  Info,
  Search,
  Code,
  Build,
  BugReport,
  ExpandMore,
  ExpandLess,
  Refresh,
  FilterList,
  FindInPage,
  Assignment,
  Schedule,
  Report,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

interface PlaceholderMatch {
  id: string;
  file: string;
  line: number;
  content: string;
  type: 'kommer_snart' | 'placeholder' | 'todo' | 'mock_data' | 'fallback';
  severity: 'high' | 'medium' | 'low';
  component: string;
  context: string
}

interface PlaceholderScanResult {
  totalFiles: number;
  scannedFiles: number;
  totalMatches: number;
  matchesByType: Record<string, number>;
  matchesBySeverity: Record<string, number>;
  matches: PlaceholderMatch[];
  lastScan: Date
}

interface PlaceholderTextScannerProps {
  // Integration props for unified workflow connectivity
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
  onNotificationCreate?: (notification: any) => void
}

const PlaceholderTextScanner: React.FC<PlaceholderTextScannerProps> = ({
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
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer,');

  // Hent placeholder scan resultater
  const { data: scanResult, isLoading, error } = useQuery({
    queryKey: ['/api/development/placeholder-scan', ],
    refetchInterval: 3000000, // Oppdater hver 30. sekund
});

  // Trigger ny scan
  const { data: scanStatus, refetch: triggerScan } = useQuery({
    queryKey: ['/api/development/trigger-scan', ],
    enabled: false,
});

  const getSeverityColor = (severity: string) => {
    const colors = {
      high: '#f44330',
      medium: '#ff9800', 
      low: '#4caf50'
};
    return colors[severity] || colors.low;
};

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <Error sx={{ color: '#f44336' }} />;
      case 'medium': return <Warning sx={{ color: '#ff9800' }} />;
      case 'low': return <Info sx={{ color: '#4caf50' }} />;
      default: return <Info sx={{ color: '#9e9e9e' }} />;
  }
};

  const getTypeIcon = (type: string) => {
    const icons = {
      kommer_snart: theming.getThemedIcon(', '),
      placeholder: <FindInPage />,
      todo: theming.getThemedIcon(', '),
      mock_data: <BugReport />,
      fallback: theming.getThemedIcon(', ')
  };
    return icons[type] || <Code />;
};

  const filteredMatches = scanResult?.matches?.filter((match: PlaceholderMatch) => {
    const matchesType = filterType === 'all' || match.type === filterType;
    const matchesSeverity = filterSeverity === 'all' || match.severity === filterSeverity;
    const matchesSearch = searchTerm === ', ' || 
      match.file.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.component.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesType && matchesSeverity && matchesSearch;
}) || [];

  const toggleMatchExpansion = (matchId: string) => {
    const newExpanded = new Set(expandedMatches);
    if (newExpanded.has(matchId)) {
      newExpanded.delete(matchId);
} else {
      newExpanded.add(matchId);
  }
    setExpandedMatches(newExpanded);
};

  const handleTriggerScan = () => {
    triggerScan();
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/development/placeholder-scan', ],});
  }, 2000);
};

  if (isLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <LinearProgress sx={{ mb:  2 }} />
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Skanner tsx-filer for placeholder tekster...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vent mens vi analyserer alle komponenter og sider for "kommer snart" og lignende tekster.
        </Typography>
      </Box>
    );
}

  if (error) {
    return (
      <Alert severity="error" sx={{ m:  3 }}>
        Kunne ikke laste placeholder scan data. Sjekk at API-endepunktet fungerer.
      </Alert>
    );
}

  const scanData = scanResult || {
    totalFiles:  0,
    scannedFiles:  0,
    totalMatches:  0,
    matchesByType: {},
    matchesBySeverity: {},
    matches:  [],
    lastScan: new Date()
};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header med oversikt */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h4" sx={{ color: theming.colors.primary, mb: 2, display: 'flex', alignItems: 'center' }}>
            <FindInPage sx={{ mr: 2 }} />
            Placeholder Tekst Scanner
          </Typography>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ bgcolor: 'rgba(25,255,255,0.9)', ...theming.getThemedCardSx() }}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Typography variant="h3" sx={{ color: theming.colors.primary, mb: 1 }}>
                    {scanData.totalMatches}
                  </Typography>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Totale Treff</Typography>
                  <Typography variant="body2" color="text.secondary">
                    i {scanData.scannedFiles} filer
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ bgcolor: 'rgba(25,255,255,0.9)', ...theming.getThemedCardSx() }}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Badge badgeContent={scanData.matchesBySeverity?.high || 0} color="error">
                    <Error sx={{ fontSize: 40, color: '#f44336' }} />
                  </Badge>
                  <Typography variant="h6" sx={{ mt: 1, color: theming.colors.primary }}>Høy Prioritet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Krever umiddelbar handling
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ bgcolor: 'rgba(25,255,255,0.9)', ...theming.getThemedCardSx() }}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Badge badgeContent={scanData.matchesByType?.kommer_snart || 0} color="warning">
                    <Schedule sx={{ fontSize: 40, color: '#ff9800' }} />
                  </Badge>
                  <Typography variant="h6" sx={{ mt: 1, color: theming.colors.primary }}>"Kommer Snart"</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Placeholder tekster
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ bgcolor: 'rgba(25,255,255,0.9)', ...theming.getThemedCardSx() }}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Sist skannet
                  </Typography>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {new Date(scanData.lastScan).toLocaleString('no-NO')}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={theming.getThemedIcon('refresh')}
                    onClick={handleTriggerScan}
                    sx={{ mt: 1 }}
                  >
                    Ny Scan
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Filtre og søk */}
      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
            <FilterList sx={{ mr:  1 }} />
            Filtrering og Søk
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }} md={3}>
              <TextField
                fullWidth
                placeholder="Søk i filer, innhold, komponenter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              />
            </Grid>
            <Grid size={{ xs: 12 }} md={3}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="Type"
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="kommer_snart">Kommer Snart</MenuItem>
                  <MenuItem value="placeholder">Placeholder</MenuItem>
                  <MenuItem value="todo">TODO</MenuItem>
                  <MenuItem value="mock_data">Mock Data</MenuItem>
                  <MenuItem value="fallback">Fallback</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }} md={3}>
              <FormControl fullWidth>
                <InputLabel>Alvorlighetsgrad</InputLabel>
                <Select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  label="Alvorlighetsgrad"
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="high">Høy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Lav</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={showResolved ? theming.getThemedIcon('visibilityOff') : theming.getThemedIcon('visibility')}
                onClick={() => setShowResolved(!showResolved)}
                sx={{ height: '56px' }}
              >
                {showResolved ? 'Skjul Løste' : 'Vis Løste'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Resultater */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center'  }}>
            <Report sx={{ mr:  1 }} />
            Funnet Placeholder Tekster ({filteredMatches.length})
          </Typography>
          
          {filteredMatches.length === 0 ? (
            <Alert severity="success" sx={{ mt:  2 }}>
              {scanData.totalMatches === 0 
                ? '🎉 Ingen placeholder tekster funnet! Plattformen er komplett.' : 'Ingen treff med gjeldende filtre.'}
            </Alert>
          ) : (
            <List>
              {filteredMatches.map((match: PlaceholderMatch) => (
                <React.Fragment key={match.d}>
                  <ListItem
                    sx={{
                      border: `1px solid ${getSeverityColor(match.severity)}`,
                      borderRadius:  1,
                      mb:  1,
                      bgcolor: 'rgba(0,0,0,0.02)'
                  }}
                  >
                    <ListItemIcon>
                      {getSeverityIcon(match.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap:  1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {match.file}
                          </Typography>
                          <Chip
                            label={`Linje ${match.line}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            label={match.type.replace('_', ', ').toUpperCase()}
                            icon={getTypeIcon(match.type)}
                            size="small"
                            color="secondary"
                          />
                          <Chip
                            label={match.severity.toUpperCase()}
                            size="small"
                            sx={{ bgcolor: getSeverityColor(match.severity), color: 'white' }}
                          />
                        </Box>
                    }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                            Komponent: {match.component}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontFamily: 'monospace', 
                            bgcolor: 'rgba(0,0,0,0.05)', 
                            p: 1, borderRadius:  1,
                            border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                            {match.content}
                          </Typography>
                        </Box>
                    }
                    />
                    <IconButton onClick={() => toggleMatchExpansion(match.id)}>
                      {expandedMatches.has(match.id) ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
                    </IconButton>
                  </ListItem>
                  
                  <Collapse in={expandedMatches.has(match.id)}>
                    <Card sx={{ ml: 4, mb: 2, bgcolor: 'rgba(0,0,0,0.02)', ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Kontekst og Detaljer</Typography>

                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" sx={{ mb:  1 }}>Fil informasjon: </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Fil: </strong> {match.file}
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Linje: </strong> {match.line}
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Komponent: </strong> {match.component}
                            </Typography>
                          </Grid>
                          
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Klassifisering: </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Type: </strong> {match.type.replace('_', ', ')}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Alvorlighetsgrad: </strong> {match.severity}
                            </Typography>
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Kontekst: </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              {match.context}
                            </Typography>

                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Kode snippet: </Typography>
                            <Box sx={{
                              fontFamily: 'monospace',
                              bgcolor: 'rgba(0, 0, 0, 0.05)',
                              p: 2,
                              borderRadius: 1,
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              overflow: 'auto'
                            }}>
                              <pre style={{ margin: 0, fontSize: '13px' }}>
                                {match.content}
                              </pre>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Collapse>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PlaceholderTextScanner;