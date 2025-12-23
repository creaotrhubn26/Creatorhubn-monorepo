// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  AddCircle as AddIcon,
  List as ListIcon,
  Settings as SettingsIcon,
  Description as DescriptionIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  Launch as LaunchIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import UniversalContractDesigner from './PhotographerContractDesigner';
import SignatureStatusOverview from '../signatures/SignatureStatusOverview';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UniversalContractHubProps {
  profession: 'photographer' | 'videographer' | 'music_producer';
  userId?: string;
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
}

export default function UniversalContractHub({ 
  profession,
  userId: propsUserId,
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
  selectedClient
}: UniversalContractHubProps) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Theming system
  const theming = useTheming('photographer, ');
  const [showDesigner, setShowDesigner] = useState(false);
  const queryClient = useQueryClient();
  
  // Get authenticated user
  const { user } = useAuth();
  const userId = user?.id || propsUserId || 'guest';
  
  // Notification state
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: ', ',
    severity: 'info',
  });
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [contractStatus, setContractStatus] = useState<string>(', ');
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  // Get contracts for current user
  const { data: contracts, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/contracts,', userId],
    queryFn: () => apiRequest('/api/contracts'),
    retry: false,
    enabled: !!userId && userId !== 'guest',
  });

  const professionConfig = {
    photographer: {
      title: 'Fotografikontrakter',
      color: '#f57c00',
      description: 'Administrer alle fotografikontrakter',
      templates: ['Bryllup','Portrett','Event','Bedriftsfoto','Produktfoto'],
    },
    videographer: {
      title: 'Videokontrakter', 
      color: '#2196f0',
      description: 'Administrer alle videokontrakter',
      templates: ['Bryllupsvideo','Bedriftsvideo','Musikkvideo','Event','Dokumentar'],
    },
    music_producer: {
      title: 'Musikkproduksjonskontrakter',
      color: '#9c27b0',
      description: 'Administrer alle musikkproduksjonskontrakter',
      templates: ['Album','Singel','Demo','Jingle','Lydbok'],
    },
  };

  const config = professionConfig[profession] || {
    title: 'Kontrakter',
    color: '#f57c00',
    description: 'Administrer kontrakter',
    templates: [],
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleContractCreated = (contractId: string) => {
    console.log(`New contract created: ${contractId}`);
    queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
    setShowDesigner(false);
    setActiveTab(1); // Switch to contracts list
    showNotification('Kontrakt opprettet!','success');
    
    // Call integration callbacks
    if (onProjectUpdate && selectedProject) {
      onProjectUpdate({ ...selectedProject, contractId });
    }
  };

  // E-signature creation mutation
  const createESignatureMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return await apiRequest(`/api/contracts/${contractId}/google-esignature`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      showNotification('Signaturdokument opprettet! Klienten vil motta en e-post med lenke til signering.','success');
    },
    onError: (error: any) => {
      console.error('Error creating e-signature: ', error);
      showNotification(
        error?.message || 'Kunne ikke opprette signaturdokument. Prøv igjen.','error'
      );
    },
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ contractId, status }: { contractId: string; status: string }) => {
      return await apiRequest(`/api/contracts/${contractId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      setEditDialogOpen(false);
      showNotification('Kontraktstatus oppdatert!','success');
    },
    onError: (error: any) => {
      showNotification(
        error?.message || 'Kunne ikke oppdatere kontraktstatus.','error'
      );
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return await apiRequest(`/api/contracts/${contractId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', userId] });
      setDeleteDialogOpen(false);
      setDeletingContractId(null);
      showNotification('Kontrakt slettet!','success');
    },
    onError: (error: any) => {
      showNotification(
        error?.message || 'Kunne ikke slette kontrakt.','error'
      );
    },
  });

  const handleEdit = (contract: any) => {
    setEditingContract(contract);
    setContractStatus(contract.status || 'draft');
    setEditDialogOpen(true);
  };

  const handleSaveStatus = () => {
    if (editingContract) {
      updateStatusMutation.mutate({
        contractId: editingContract.id,
        status: contractStatus,
      });
    }
  };

  const handleDelete = (contractId: string) => {
    setDeletingContractId(contractId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingContractId) {
      deleteMutation.mutate(deletingContractId);
    }
  };

  const handleDownloadPDF = async (contractId: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ', '}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract-${contractId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification('PDF lastet ned!','success');
      } else {
        showNotification('Kunne ikke laste ned PDF. Endpoint kan være utilgjengelig.','warning');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showNotification('Kunne ikke laste ned PDF.', 'error');
    }
  };

  const formatContractNumber = (contractId: string) => {
    // Format UUID to readable format (first 8 chars)
    return contractId.substring(0, 8).toUpperCase();
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('no-NO', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  if (showDesigner) {
    return (
      <UniversalContractDesigner 
        profession={profession}
        onContractCreated={handleContractCreated}
        initialClient={selectedClient ? { name: selectedClient?.name || selectedClient?.clientName, email: selectedClient?.email } : null}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 4 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <GavelIcon sx={{ mr: 2, color: config.color, fontSize: 32 }} />
          <Box>
            <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
              {config.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {config.description} - Tvers på alle dashboards
            </Typography>
          </Box>
        </Box>
        
        <Button 
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowDesigner(true)}
          sx={{ 
            bgcolor: config.color'&:hover': { bgcolor: config.color + 'dd' }}}
        >
          Ny Kontrakt
        </Button>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <Tabs 
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<SettingsIcon />} label="System Status" />
          <Tab icon={<ListIcon />} label="Mine Kontrakter" />
          <Tab icon={<GavelIcon />} label="Kontrakt Designer" />
          <Tab icon={<DescriptionIcon />} label="E-Signaturer" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <SecurityIcon sx={{ mr: 2, color: config.color, fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                EU eIDAS Kontraktsystem Status
              </Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              ✅ Kontraktsystem er aktivt og koblet til alle dashboards via profesjonsadapteren
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  📋 Tilgjengelige Templates
                </Typography>
                <List dense>
                  {config.templates?.map((template: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon sx={{ color: config.color, fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary={template} />
                    </ListItem>
                  ))}
                </List>
              </Grid>

              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  ⚙️ Systemfunksjoner
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <DescriptionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Kontraktopprettelse"
                      secondary="Norsk MVA-beregning inkludert"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <SecurityIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="EU eIDAS Digital Signering"
                      secondary="Juridisk bindende signaturer"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <DescriptionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Google Docs E-Signatur"
                      secondary="Signerbare dokumenter via Google Drive"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AssignmentIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Google Drive Backup"
                      secondary="Automatisk sikkerhetskopi"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="BRREG Integration"
                      secondary="Norske organisasjonsnummer"
                    />
                    <Chip label="Aktiv" color="success" size="small" />
                  </ListItem>
                </List>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f0', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                🔗 Tverrfaglig Integrasjon: 
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kontraktsystemet fungerer "tvers på alle dashbordene og koblet til profesjonsadapteren" - 
                samme grunnleggende system med automatisk tilpasning til fotografer, videographere, 
                musikprodusenter og leverandører.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Kontrakt Oversikt
            </Typography>
            
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Feil ved lasting av kontrakter. Prøv å oppdatere siden.
                <Button size="small" onClick={() => refetch()} sx={{ ml: 2 }}>
                  Prøv igjen
                </Button>
              </Alert>
            )}

            {!isLoading && !error && contracts?.contracts && contracts.contracts.length > 0 ? (
              <Grid container spacing={2}>
                {contracts.contracts.map((contract: any) => (
                  <Grid size={{ xs: 12 }} md={6} key={contract.id}>
                    <Card variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {contract.clientName || 'Ukjent klient'}
                          </Typography>
                          <Chip 
                            label={contract.status || 'draft'}
                            color={contract.status === 'draft' ? 'warning' : contract.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {contract.projectDescription || 'Ingen beskrivelse'}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            NOK {contract.totalAmount || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Opprettet: {formatDate(contract.createdAt)}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Kontrakt #: {contract.contractNumber || formatContractNumber(contract.id)}
                        </Typography>
                        
                        {/* E-Signature Status */}
                        {contract.google_doc_id && (
                          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" fontWeight="bold">
                                E-Signatur Status:
                              </Typography>
                              <Chip
                                label={contract.signature_status === 'signed' ? 'Signert' : 'Venter'}
                                color={contract.signature_status === 'signed' ? 'success' : 'warning'}
                                size="small"
                              />
                            </Box>
                            {contract.google_doc_url && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<LaunchIcon />}
                                href={contract.google_doc_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                fullWidth
                                sx={{ mt: 1 }}
                              >
                                Åpne i Google Docs
                              </Button>
                            )}
                          </Box>
                        )}
                        
                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                          {!contract.google_doc_id && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={createESignatureMutation.isPending ? <CircularProgress size={16} /> : <DescriptionIcon />}
                              disabled={createESignatureMutation.isPending}
                              onClick={() => createESignatureMutation.mutate(contract.id)}
                            >
                              Opprett Signatur
                            </Button>
                          )}
                          <Tooltip title="Last ned PDF">
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadPDF(contract.id)}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => handleEdit(contract)}
                          >
                            Rediger
                          </Button>
                          <Tooltip title="Slett kontrakt">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(contract.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : !isLoading && !error ? (
              <Alert severity="info">
                Ingen kontrakter funnet. Opprett din første kontrakt ved å klikke "Ny Kontrakt".
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Opprett Ny Kontrakt
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Bruk vår profesjonelle kontraktdesigner for å lage juridisk bindende kontrakter.
            </Typography>
            <Button 
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => setShowDesigner(true)}
              sx={{ 
                bgcolor: config.color'&:hover': { bgcolor: config.color + 'dd' }}}
            >
              Start Kontraktdesigner
            </Button>
          </CardContent>
        </Card>
      )}

      {/* E-Signatures Tab - Shows all pending signatures across all document types */}
      {activeTab === 3 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <DescriptionIcon sx={{ mr: 2, color: config.color, fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                    E-Signaturer
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Oversikt over alle ventende signaturer på kontrakter, tilbud, split sheets og fakturaer
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 3 }} />
              
              <SignatureStatusOverview />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Edit Status Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Rediger Kontraktstatus
          <IconButton
            aria-label="close"
            onClick={() => setEditDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Status"
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="draft">Utkast</MenuItem>
            <MenuItem value="active">Aktiv</MenuItem>
            <MenuItem value="completed">Fullført</MenuItem>
            <MenuItem value="cancelled">Kansellert</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button 
            onClick={handleSaveStatus} 
            variant="contained"
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? <CircularProgress size={20} /> : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil slette denne kontrakten? Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button 
            onClick={confirmDelete} 
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <CircularProgress size={20} /> :'Slett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
