import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  CheckCircle,
  CloudDone,
  CloudOff,
  CloudSync,
  Delete,
  Download,
  Google as GoogleIcon,
  Refresh,
  Share,
  TableChart,
  Visibility,
  Warning,
} from '@mui/icons-material';

interface GoogleSheet {
  id: string;
  name: string;
  url: string;
  lastModified: string;
  owners: string[];
  writers: string[];
  readers: string[];
  isPublic: boolean;
  rowCount: number;
  columnCount: number;
  projectId?: string;
}

interface GoogleSheetsIntegrationProps {
  projectId?: string;
  onSheetCreated?: (sheet: GoogleSheet) => void;
  onSheetUpdated?: (sheet: GoogleSheet) => void;
  onSheetDeleted?: (sheetId: string) => void;
}

type CreateSheetTemplate = 'blank' | 'project-tracker' | 'client-list' | 'equipment-inventory';

interface CreateSheetForm {
  name: string;
  description: string;
  isPublic: boolean;
  template: CreateSheetTemplate;
}

interface ShareForm {
  email: string;
  role: 'reader' | 'writer' | 'owner';
  message: string;
}

type SheetMatrix = string[][];

const defaultCreateForm: CreateSheetForm = {
  name: '',
  description: '',
  isPublic: false,
  template: 'blank',
};

const defaultShareForm: ShareForm = {
  email: '',
  role: 'reader',
  message: '',
};

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const token = localStorage.getItem('creatorhub_auth_token') ?? localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  projectId,
  onSheetCreated,
  onSheetUpdated,
  onSheetDeleted,
}) => {
  const { user } = useAuth();
  const masterIntegration = useEnhancedMasterIntegration();
  const theming = useTheming('photographer');

  const [isConnected, setIsConnected] = useState(false);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheets, setSheets] = useState<GoogleSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
  const [sheetData, setSheetData] = useState<SheetMatrix>([]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewSheetDialogOpen, setViewSheetDialogOpen] = useState(false);

  const [createForm, setCreateForm] = useState<CreateSheetForm>(defaultCreateForm);
  const [shareForm, setShareForm] = useState<ShareForm>(defaultShareForm);

  const headers = useMemo(() => getAuthHeaders(), [user?.id]);

  const registerIntegrationNodes = useCallback(() => {
    const componentRegistry = masterIntegration?.componentRegistry;
    const dataFlow = masterIntegration?.dataFlow;

    componentRegistry?.registerComponent({
      id: 'google-sheets-integration',
      name: 'Google Sheets Integration',
      type: 'widget',
      category: 'integrations',
      capabilities: ['sheet-creation', 'sheet-editing', 'sheet-sharing', 'data-management', 'collaboration'],
      dependencies: ['google-auth'],
      props: ['projectId'],
      events: ['sheet-created', 'sheet-updated', 'sheet-deleted', 'sheet-shared'],
      dataKeys: ['sheets', 'sheet-data', 'connection-status'],
      description: 'Google Sheets workspace integration for project data and sharing',
      version: '1.0.0',
    });

    const sheetsNodeId = dataFlow?.registerNode({
      type: 'source',
      componentId: 'google-sheets-integration',
      dataKey: 'sheets',
    });

    const sheetDataNodeId = dataFlow?.registerNode({
      type: 'source',
      componentId: 'google-sheets-integration',
      dataKey: 'sheet-data',
    });

    const statusNodeId = dataFlow?.registerNode({
      type: 'source',
      componentId: 'google-sheets-integration',
      dataKey: 'connection-status',
    });

    return { sheetsNodeId, sheetDataNodeId, statusNodeId };
  }, [masterIntegration]);

  const checkConnection = useCallback(async () => {
    setLoadingConnection(true);
    try {
      const response = await fetch('/api/google-sheets/status', { headers });
      if (!response.ok) {
        setIsConnected(false);
        return;
      }
      const data = (await response.json()) as { connected?: boolean };
      setIsConnected(Boolean(data.connected));
    } catch (error) {
      console.error('Error checking Google Sheets connection:', error);
      setIsConnected(false);
    } finally {
      setLoadingConnection(false);
    }
  }, [headers]);

  const fetchSheets = useCallback(async () => {
    setLoadingSheets(true);
    try {
      const response = await fetch('/api/google-sheets/sheets', { headers });
      if (!response.ok) {
        setSheets([]);
        return;
      }
      const data = (await response.json()) as { sheets?: GoogleSheet[] };
      const nextSheets = Array.isArray(data.sheets) ? data.sheets : [];
      setSheets(nextSheets);

      masterIntegration?.communication?.sendBroadcast('google-sheets:loaded', {
        projectId,
        count: nextSheets.length,
      });
    } catch (error) {
      console.error('Error fetching Google Sheets:', error);
      setSheets([]);
    } finally {
      setLoadingSheets(false);
    }
  }, [headers, masterIntegration, projectId]);

  useEffect(() => {
    const { sheetsNodeId, sheetDataNodeId, statusNodeId } = registerIntegrationNodes();

    checkConnection();

    const unsubscribeCreate = masterIntegration?.communication?.onMessageType('google-sheets:create-sheet', (message) => {
      const payload = message.data as Partial<CreateSheetForm> | undefined;
      if (payload) {
        setCreateForm((prev) => ({ ...prev, ...payload }));
      }
      setCreateDialogOpen(true);
    });

    const unsubscribeRefresh = masterIntegration?.communication?.onMessageType('google-sheets:refresh', () => {
      void fetchSheets();
    });

    return () => {
      unsubscribeCreate?.();
      unsubscribeRefresh?.();

      if (sheetsNodeId) masterIntegration?.dataFlow?.unregisterNode(sheetsNodeId);
      if (sheetDataNodeId) masterIntegration?.dataFlow?.unregisterNode(sheetDataNodeId);
      if (statusNodeId) masterIntegration?.dataFlow?.unregisterNode(statusNodeId);
      masterIntegration?.componentRegistry?.unregisterComponent('google-sheets-integration');
    };
  }, [checkConnection, fetchSheets, masterIntegration, registerIntegrationNodes]);

  useEffect(() => {
    if (!isConnected) {
      setSheets([]);
      return;
    }
    void fetchSheets();
  }, [fetchSheets, isConnected]);

  useEffect(() => {
    masterIntegration?.dataFlow?.syncData('google-sheets:sheets', sheets).catch((error: unknown) => {
      console.warn('Failed to sync sheets data to dataFlow:', error);
    });
  }, [masterIntegration, sheets]);

  useEffect(() => {
    masterIntegration?.dataFlow?.syncData('google-sheets:sheet-data', sheetData).catch((error: unknown) => {
      console.warn('Failed to sync sheet-data to dataFlow:', error);
    });
  }, [masterIntegration, sheetData]);

  useEffect(() => {
    masterIntegration?.dataFlow?.syncData('google-sheets:status', { isConnected, loadingConnection, loadingSheets }).catch((error: unknown) => {
      console.warn('Failed to sync status to dataFlow:', error);
    });
  }, [isConnected, loadingConnection, loadingSheets, masterIntegration]);

  const connectToGoogleSheets = async () => {
    setLoadingConnection(true);
    try {
      const response = await fetch('/api/google-sheets/connect', {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        setIsConnected(true);
        await fetchSheets();
      }
    } catch (error) {
      console.error('Error connecting to Google Sheets:', error);
    } finally {
      setLoadingConnection(false);
    }
  };

  const createSheet = async () => {
    try {
      const response = await fetch('/api/google-sheets/create', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...createForm, projectId }),
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { sheet?: GoogleSheet };
      if (!data.sheet) {
        return;
      }

      setSheets((prev) => [data.sheet as GoogleSheet, ...prev]);
      onSheetCreated?.(data.sheet);
      setCreateDialogOpen(false);
      setCreateForm(defaultCreateForm);

      masterIntegration?.communication?.sendBroadcast('google-sheets:sheet-created', {
        sheet: data.sheet,
        projectId,
      });
    } catch (error) {
      console.error('Error creating Google Sheet:', error);
    }
  };

  const shareSheet = async () => {
    if (!selectedSheet) {
      return;
    }

    try {
      const response = await fetch(`/api/google-sheets/${selectedSheet.id}/share`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shareForm),
      });

      if (!response.ok) {
        return;
      }

      setShareDialogOpen(false);
      setShareForm(defaultShareForm);

      masterIntegration?.communication?.sendBroadcast('google-sheets:sheet-shared', {
        sheet: selectedSheet,
        share: shareForm,
        projectId,
      });
    } catch (error) {
      console.error('Error sharing Google Sheet:', error);
    }
  };

  const deleteSheet = async (sheetId: string) => {
    try {
      const response = await fetch(`/api/google-sheets/${sheetId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        return;
      }

      setSheets((prev) => prev.filter((sheet) => sheet.id !== sheetId));
      onSheetDeleted?.(sheetId);

      masterIntegration?.communication?.sendBroadcast('google-sheets:sheet-deleted', {
        sheetId,
        projectId,
      });
    } catch (error) {
      console.error('Error deleting Google Sheet:', error);
    }
  };

  const viewSheet = async (sheet: GoogleSheet) => {
    setSelectedSheet(sheet);
    setViewSheetDialogOpen(true);
    setLoadingSheets(true);

    try {
      const response = await fetch(`/api/google-sheets/${sheet.id}/data`, { headers });
      if (!response.ok) {
        setSheetData([]);
        return;
      }

      const data = (await response.json()) as { rows?: SheetMatrix };
      setSheetData(Array.isArray(data.rows) ? data.rows : []);
      onSheetUpdated?.(sheet);
    } catch (error) {
      console.error('Error loading sheet data:', error);
      setSheetData([]);
    } finally {
      setLoadingSheets(false);
    }
  };

  const statusChip = isConnected ? (
    <Chip icon={<CloudDone />} color="success" label="Tilkoblet" size="small" />
  ) : (
    <Chip icon={<CloudOff />} color="warning" label="Ikke tilkoblet" size="small" />
  );

  return (
    <Box>
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <GoogleIcon /> Google Sheets
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Opprett, del og synkroniser prosjektark.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {statusChip}
              <Tooltip title="Oppdater liste">
                <span>
                  <IconButton onClick={() => void fetchSheets()} disabled={!isConnected || loadingSheets}>
                    <Refresh />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={isConnected ? <Add /> : <CloudSync />}
                onClick={isConnected ? () => setCreateDialogOpen(true) : () => void connectToGoogleSheets()}
                disabled={loadingConnection}
                sx={{ ...theming.getThemedButtonSx('primary') }}
              >
                {isConnected ? 'Nytt ark' : 'Koble til'}
              </Button>
            </Stack>
          </Stack>
          {(loadingConnection || loadingSheets) && <LinearProgress sx={{ mt: 2 }} />}
        </CardContent>
      </Card>

      {!isConnected ? (
        <Alert severity="warning" icon={<Warning />}>
          Google Sheets er ikke koblet til. Koble til for a bruke integrasjonen.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Tilgjengelige ark ({sheets.length})
              </Typography>

              {loadingSheets ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <List>
                  {sheets.map((sheet) => (
                    <ListItem key={sheet.id} divider>
                      <ListItemIcon>
                        <TableChart color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={sheet.name}
                        secondary={`Rader: ${sheet.rowCount} • Kolonner: ${sheet.columnCount}`}
                      />
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Vis">
                          <IconButton size="small" onClick={() => void viewSheet(sheet)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Del">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedSheet(sheet);
                              setShareDialogOpen(true);
                            }}
                          >
                            <Share fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett">
                          <IconButton size="small" color="error" onClick={() => void deleteSheet(sheet.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Integrasjonsstatus
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color={isConnected ? 'success' : 'disabled'} />
                  </ListItemIcon>
                  <ListItemText primary="Google-auth" secondary={isConnected ? 'Aktiv' : 'Frakoblet'} />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CloudDone color={sheets.length > 0 ? 'success' : 'disabled'} />
                  </ListItemIcon>
                  <ListItemText primary="Synkroniserte ark" secondary={`${sheets.length} registrert`} />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Download color={selectedSheet ? 'success' : 'disabled'} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Valgt ark"
                    secondary={selectedSheet ? `${selectedSheet.name} (${selectedSheet.rowCount}x${selectedSheet.columnCount})` : 'Ingen valgt'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt Google Sheet</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Navn"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel id="create-template-label">Template</InputLabel>
              <Select
                labelId="create-template-label"
                label="Template"
                value={createForm.template}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, template: event.target.value as CreateSheetTemplate }))
                }
              >
                <MenuItem value="blank">Blank</MenuItem>
                <MenuItem value="project-tracker">Project Tracker</MenuItem>
                <MenuItem value="client-list">Client List</MenuItem>
                <MenuItem value="equipment-inventory">Equipment Inventory</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={createForm.isPublic}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
                />
              }
              label="Offentlig ark"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void createSheet()} disabled={!createForm.name.trim()}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Del Sheet</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="E-post"
              type="email"
              value={shareForm.email}
              onChange={(event) => setShareForm((prev) => ({ ...prev, email: event.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="share-role-label">Rolle</InputLabel>
              <Select
                labelId="share-role-label"
                label="Rolle"
                value={shareForm.role}
                onChange={(event) => setShareForm((prev) => ({ ...prev, role: event.target.value as ShareForm['role'] }))}
              >
                <MenuItem value="reader">Reader</MenuItem>
                <MenuItem value="writer">Writer</MenuItem>
                <MenuItem value="owner">Owner</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Melding"
              value={shareForm.message}
              onChange={(event) => setShareForm((prev) => ({ ...prev, message: event.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void shareSheet()} disabled={!shareForm.email.trim()}>
            Del
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewSheetDialogOpen} onClose={() => setViewSheetDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{selectedSheet?.name ?? 'Sheet preview'}</DialogTitle>
        <DialogContent>
          {loadingSheets ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {(sheetData[0] ?? []).map((cell, index) => (
                      <TableCell key={`header-${index}`} sx={{ fontWeight: 'bold' }}>
                        {cell || `Kolonne ${index + 1}`}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sheetData.slice(1).map((row, rowIndex) => (
                    <TableRow key={`row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={`cell-${rowIndex}-${cellIndex}`}>{cell || ''}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewSheetDialogOpen(false)}>Lukk</Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={() => {
              if (selectedSheet?.url) {
                window.open(selectedSheet.url, '_blank', 'noopener,noreferrer');
              }
            }}
            sx={{ bgcolor: '#0F9D50', '&:hover': { bgcolor: '#0D8043' } }}
          >
            Apne i Google Sheets
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoogleSheetsIntegration;
