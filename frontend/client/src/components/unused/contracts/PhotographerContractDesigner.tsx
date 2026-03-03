// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Chip,
  IconButton,
  Divider,
  Alert,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Fab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
  Email as EmailIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Gavel as GavelIcon,
  CameraAlt as CameraIcon,
  Videocam as VideocamIcon,
  LibraryMusic as LibraryMusicIcon,
  AddCircle as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  FileCopy as FileCopyIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ContractSection {
  id: string;
  title: string;
  content: string;
  type: 'terms' | 'pricing' | 'schedule' | 'responsibilities' | 'custom';
  required: boolean
}

interface ContractData {
  clientName: string;
  clientEmail: string;
  projectDescription: string;
  totalAmount: string;
  eventDate: string;
  eventLocation: string;
  contractType: string;
  sections: ContractSection[]
}

interface UniversalContractDesignerProps {
  profession?: 'photographer' | 'videographer' | 'music_producer';
  onContractCreated?: (contractId: string) => void
}

export default function UniversalContractDesigner({ 
  profession = 'photographer,',
  onContractCreated
}: UniversalContractDesignerProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [contractData, setContractData] = useState<ContractData>({
    clientName: '',
    clientEmail: '',
    projectDescription: '',
    totalAmount: '',
    eventDate: '',
    eventLocation: '',
    contractType: 'wedding_photography',
    sections: []
});
  
  const [showSectionEditor, setShowSectionEditor] = useState(false);
  const [editingSection, setEditingSection] = useState<ContractSection | null>(null);
  const [importedSections, setImportedSections] = useState<ContractSection[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [signature, setSignature] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    extractedSections: ContractSection[];
    originalText: string;
    totalPages: number;
} | null>(null);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Profession-specific configuration
  const professionConfig = {
    photographer: {
      title: 'Fotografikontrakt Designer',
      icon: <CameraIcon sx={{ mr: 2, fontSize: 32}} />,
      color: '#f57c00',
      gradient: 'linear-gradient(135deg, #f57c00 0%, #ff9800 100%)',
      contractTypes: [
        { value: 'wedding_photography', label: 'Bryllupsfotografering' },
        { value: 'portrait_photography', label: 'Portrettfotografering' },
        { value: 'event_photography', label: 'Eventfotografering' },
        { value: 'product_photography', label: 'Produktfotografering' },
        { value: 'corporate_photography', label: 'Bedriftsfotografering' }
      ],
      projectPlaceholder: 'Bryllupsfotografering - lokasjon og tema',
      defaultDescription: 'Profesjonell fotografering med retusjering og levering'
},
    videographer: {
      title: 'Videokontrakt Designer',
      icon: <VideocamIcon sx={{ mr: 2, fontSize: 32}} />,
      color: '#2196f0',
      gradient: 'linear-gradient(135deg, #2196f3 0%, #03a9f4 100%)',
      contractTypes: [
        { value: 'wedding_videography', label: 'Bryllupsvideo' },
        { value: 'music_video', label: 'Musikkvideo' },
        { value: 'corporate_video', label: 'Bedriftsvideo' },
        { value: 'documentary', label: 'Dokumentar' },
        { value: 'commercial_video', label: 'Reklamefilm' }
      ],
      projectPlaceholder: 'Bryllupsvideo - seremoni og resepsjon',
      defaultDescription: 'Profesjonell videografi med redigering og levering'
},
    music_producer: {
      title: 'Musikkproduksjonskontrakt Designer',
      icon: <LibraryMusicIcon sx={{ mr: 2, fontSize: 32}} />,
      color: '#9c27b0',
      gradient: 'linear-gradient(135deg, #9c27b0 0%, #e91e63 100%)',
      contractTypes: [
        { value: 'album_production', label: 'Albumproduksjon' },
        { value: 'single_production', label: 'Singelproduksjon' },
        { value: 'demo_production', label: 'Demoproduksjon' },
        { value: 'mixing_mastering', label: 'Miksing og Mastering' },
        { value: 'sound_design', label: 'Lyddesign' }
      ],
      projectPlaceholder: 'Albumproduksjon - 10 spor med miksing',
      defaultDescription: 'Profesjonell musikkproduksjon med studio og mastering'
}
};

  const config = professionConfig[profession];

  const steps = [
    { label: 'Draft', description: 'Opprett kontraktgrunnlag' },
    { label: 'Creation', description: 'Utfyll kontraktdetaljer' },
    { label: 'Sections', description: 'Administrer kontraktseksjoner' },
    { label: 'Negotiation', description: 'Gjennomgang og godkjenning' },
    { label: 'eSignature', description: 'Digital signering' }
  ];

  // Default sections based on profession
  const getDefaultSections = (profession: string): ContractSection[] => {
    const baseId = Date.now();
    switch (profession) {
      case 'photographer':
        return [
          { id: `${baseId}-1`, title: 'Fotograferingstjenester', content: 'Beskrivelse av fotograferingsarbeid, antall timer, og leveranser.', type: 'responsibilities', required: true },
          { id: `${baseId}-2`, title: 'Prisstruktur og Betaling', content: 'Totalpris, betalingsplan og refunderingspolicy.', type: 'pricing', required: true },
          { id: `${baseId}-3`, title: 'Leveringsfrister', content: 'Tidspunkter for levering av bearbeidede bilder og endelige produkter.', type: 'schedule', required: true },
          { id: `${baseId}-4`, title: 'Opphavsrett og Bruksrettigheter', content: 'Rettighetsdefinisjon for bruk av bilder og krediteringsvilkår.', type: 'terms', required: true }
        ];
      case 'videographer':
        return [
          { id: `${baseId}-1`, title: 'Videoproduksjonstjenester', content: 'Beskrivelse av filming, redigering og leveranser.', type: 'responsibilities', required: true },
          { id: `${baseId}-2`, title: 'Kostnader og Betalingsbetingelser', content: 'Prisstruktur, betalingsfrister og tilleggsgebyrer.', type: 'pricing', required: true },
          { id: `${baseId}-3`, title: 'Produksjonsplan', content: 'Tidsplan for filming, post-produksjon og levering.', type: 'schedule', required: true },
          { id: `${baseId}-4`, title: 'Lisenser og Distribusjon', content: 'Bruksrettigheter for video og distribusjonsvilkår.', type: 'terms', required: true }
        ];
      case 'music_producer':
        return [
          { id: `${baseId}-1`, title: 'Produksjonstjenester', content: 'Studio-arbeid, miksing, mastering og leveranser.', type: 'responsibilities', required: true },
          { id: `${baseId}-2`, title: 'Honorar og Royalties', content: 'Produksjonshonorarer, royalty-andeler og betalingsvilkår.', type: 'pricing', required: true },
          { id: `${baseId}-3`, title: 'Studioplan og Deadlines', content: 'Studiotime, leveringsfrister og milepæler.', type: 'schedule', required: true },
          { id: `${baseId}-4`, title: 'Publiseringsrettigheter', content: 'Opphavsrett, krediteringsvilkår og distribusjon.', type: 'terms', required: true }
        ];
      default: return [];
}
};

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async (data: ContractData) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/contracts', {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({
          ...data,
          profession,
          contractType: data.contractType,
          templateUsed: `${config.title} v1.0`
      })
    });
  },
    onSuccess: (response) => {
      console.log('Contract created, :', response);
      setActiveStep(2);
      if (onContractCreated) {
        onContractCreated(response.contract?.id);
    }
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', ],});
  }
});

  // Backup to Google Drive mutation
  const backupContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const auth = await getAuthHeader();
      return apiRequest(`/api/contracts/${contractd}/backup-drive`, {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
      },
        method: 'POST'
  });
  },
    onSuccess: (response) => {
      console.log('Contract backed up, :', response);
  }
});

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/contracts/send-email', {
        headers: {
          ...auth, 'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          ...emailData,
          profession,
          contractTemplate: config.title
    })
    });
  },
    onSuccess: (response) => {
      console.log('Email sent, :', response);
      setActiveStep(3);
  }
});

  // Contract import mutation
  const importContractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('contractFile', file);
      const auth = await getAuthHeader();
      return apiRequest('/api/contracts/upload-import', {
        headers: {
          ...auth, 'Content-Type': 'application/json'
        },
        method: 'POST',
        body: formData,
    });
  },
    onSuccess: (data) => {
      setImportPreview(data);
      setIsImporting(false);
},
    onError: (error) => {
      console.error('Import error, :', error);
      setIsImporting(false);
  }
});

  // Initialize default sections
  React.useEffect(() => {
    if (contractData.sections.length === 0) {
      const defaultSections = getDefaultSections(profession);
      setContractData(prev => ({ ...prev, sections: defaultSections }));
  }
}, [profession]);

  const handleCreateContract = () => {
    createContractMutation.mutate(contractData);
};

  // Section management functions
  const addSection = (section: Omit<ContractSection, 'id, '>) => {
    const newSection: ContractSection = {
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
    setContractData(prev => ({ 
      ...prev, 
      sections: [...prev.sections, newSection] 
  }));
};

  const updateSection = (id: string, updates: Partial<ContractSection>) => {
    setContractData(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.id === id ? { ...section, ...updates } : section
      )
  }));
};

  const deleteSection = (id: string) => {
    setContractData(prev => ({
      ...prev,
      sections: prev.sections.filter(section => section.id !== id)
}));
};

  // Handle file import functionality
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setIsImporting(true);
      importContractMutation.mutate(file);
}
};

  const handleImportPreviewConfirm = () => {
    if (importPreview) {
      setImportedSections(importPreview.extractedSections);
      setShowImportDialog(true);
      setImportPreview(null);
  }
};

  const handleImportSections = (sectionsToImport: string[]) => {
    const newSections = importedSections
      .filter(section => sectionsToImport.includes(section.id))
      .map(section => ({ ...section, id: `imported-${Date.now()}-${section.id}` }));
    
    setContractData(prev => ({ 
      ...prev, 
      sections: [...prev.sections, ...newSections] 
  }));
    setShowImportDialog(false);
    setImportedSections([]);
};

  const handleSendForReview = () => {
    const emailData = {
      contractId: 'latest',
      photographerName: 'Daniel Nordhagen - CreatorHub Norge',
      photographerEmail: 'user?.email',
      targetEmail: contractData.clientEmail,
      message: `Hei ${contractData.clientName}! Hermed sender jeg kontraktsutkastet for ${contractData.projectDescription}. Vennligst gjennomgå og gi tilbakemelding.`
  };
    sendEmailMutation.mutate(emailData);
};

  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p:  3 }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb:  4,
        background: config.gradient,
        color: 'white',
        p:  3,
        borderRadius:  2,
        boxShadow: `0 8px 32px ${config.color}33`
    }}>
        {config.icon}
        <Typography variant="h4" sx={{  fontWeight: 600}}>
          {config.title}
        </Typography>
        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
          <Typography variant="body2" sx={{ opacity: 0.9}}>
            Prosjekt: THS Blonde 2020
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9}}>
            Type: #ACM-4888
          </Typography>
        </Box>
      </Box>

      {/* Progress Bar */}
      <Card sx={{ mb:  4 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <Typography variant="h6" sx={{  mr:  2  }}>FREMDRIFT</Typography>
            <LinearProgress 
              variant="determinate" 
              value={progress}
              sx={{ 
                flexGrow: 1
               , height:  8, 
                borderRadius:  4,
                bgcolor: '#e0e0e0','& .MuiLinearProgress-bar': {
                  bgcolor: '#4caf50'
            }
            }}
            />
            <Typography variant="body2" sx={{ ml: 2, fontWeight: 600 }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          
          {/* Steps */}
          <Grid container spacing={2}>
            {steps.map((step, index) => (
              <Grid size={{ xs: 12 }} sm={3} key={index}>
                <Card 
                  sx={{ 
                    border: activeStep >= index ? '2px solid #4caf50' : '1px solid #e0e0e0',
                    bgcolor: activeStep >= index ? '#f1f8e9' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
              }}
                  onClick={() => setActiveStep(index)}
                >
                  <CardContent sx={{ textAlign: 'center', py:  2 ,  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                      STEP {index + 1}
                    </Typography>
                    <Typography variant="h6" sx={{  mb:  1  }}>
                      {step.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                    {activeStep > index && (
                      <CheckCircleIcon sx={{ color: '#4caf50', mt:  1 }} />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Grid container spacing={4}>
        {/* Left Panel - Current Step */}
        <Grid size={{ xs: 12 }} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <Typography variant="h6" sx={{  flexGrow:  1  }}>
                  Step {activeStep + 1}: {steps[activeStep].label}
                </Typography>
                <Chip 
                  label="OPPDATER" 
                  variant="outlined" 
                  sx={{ mr:  1 }}
                  onClick={() => window.location.reload()}
                />
                <Button variant="contained" 
                  sx={{
                    ...theming.getThemedButtonSx(),
                    bgcolor: '#00bcd0', '&:hover': { bgcolor: '#00acc1' }
                  }}>
                  FULLFØR FLYT
                </Button>
              </Box>

              {/* Step Content */}
              {activeStep === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Opprett Kontraktgrunnlag
                  </Typography>
                  <TextField
                    fullWidth
                    label="Klientnavn"
                    value={contractData.clientName}
                    onChange={(e) => setContractData({...contractData, clientName: e.target.value})}
                    sx={{ mb:  2 }}
                  />
                  <TextField
                    fullWidth
                    label="E-post"
                    value={contractData.clientEmail}
                    onChange={(e) => setContractData({...contractData, clientEmail: e.target.value})}
                    sx={{ mb:  2 }}
                  />
                  <Button variant="contained" 
                    onClick={() => setActiveStep(1)}
                    sx={{ mt:  2 }}
                  >
                    Neste: Opprett Kontrakt
                  </Button>
                </Box>
             )}

              {activeStep === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Utfyll Kontraktdetaljer
                  </Typography>
                  <TextField
                    fullWidth
                    select
                    label="Kontrakttype"
                    value={contractData.contractType}
                    onChange={(e) => setContractData({...contractData, contractType: e.target.value})}
                    sx={{ mb:  2 }}
                  >
                    {config.contractTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label="Prosjektbeskrivelse"
                    placeholder={config.projectPlaceholder}
                    value={contractData.projectDescription}
                    onChange={(e) => setContractData({...contractData, projectDescription: e.target.value})}
                    sx={{ mb:  2 }}
                  />
                  <TextField
                    fullWidth
                    label="Totalbeløp (NOK)"
                    value={contractData.totalAmount}
                    onChange={(e) => setContractData({...contractData, totalAmount: e.target.value})}
                    sx={{ mb:  2 }}
                  />
                  <TextField
                    fullWidth
                    label="Eventdato"
                    type="date"
                    value={contractData.eventDate}
                    onChange={(e) => setContractData({...contractData, eventDate: e.target.value})}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb:  2 }}
                  />
                  <Button variant="contained" 
                    onClick={handleCreateContract}
                    disabled={createContractMutation.isPending}
                    sx={{
                      ...theming.getThemedButtonSx(),
                      mt: 2
                    }}>
                    {createContractMutation.isPending ? 'Oppretter...' : 'Opprett Kontrakt'}
                  </Button>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  3 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Administrer Kontraktseksjoner
                    </Typography>
                    <Box>
                      <input
                        accept=".pdf,.doc,.docx"
                        style={{ display: 'none' }}
                        id="contract-upload"
                        type="file"
                        onChange={handleFileUpload}
                      />
                      <label htmlFor="contract-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<UploadIcon />}
                          sx={{ mr:  2 }}
                          disabled={importContractMutation.isPending}
                        >
                          {importContractMutation.isPending ? 'Importerer...' : 'Importer Kontrakt'}
                        </Button>
                      </label>
                      <Button variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setShowSectionEditor(true)}
                        sx={{ bgcolor: config.color }}
                      >
                        Ny Seksjon
                      </Button>
                    </Box>
                  </Box>

                  {/* Sections List */}
                  <Box sx={{ mb:  3 }}>
                    {contractData.sections.map((section, index) => (
                      <Accordion key={section.id} sx={{ mb:  1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <DragIcon sx={{ mr: 2, color: 'text.secondary' }} />
                            <Typography variant="subtitle1" sx={{ flexGrow:  1 }}>
                              {section.title}
                            </Typography>
                            <Chip 
                              label={section.type}
                              size="small" 
                              variant="outlined"
                              sx={{ mr:  2 }}
                            />
                            {section.required && (
                              <Chip 
                                label="Påkrevd" 
                                size="small" 
                                color="error"
                                sx={{ mr:  2 }}
                              />
                            )}
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSection(section);
                                setShowSectionEditor(true);
                            }}
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSection(section.id);
                            }}
                              size="small"
                              disabled={section.required}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="body2" color="text.secondary">
                            {section.content}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Box>

                  <Button variant="contained" 
                    onClick={() => setActiveStep(3)}
                    sx={{ mt:  2 }}
                  >
                    Neste: Gjennomgang
                  </Button>
                </Box>
             )}

              {activeStep === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Gjennomgang og Godkjenning
                  </Typography>
                  <Alert severity="info" sx={{ mb:  2 }}>
                    Kontrakten er opprettet og klar for gjennomgang. Send til klient for godkjenning.
                  </Alert>
                  <Button variant="contained" 
                    startIcon={<EmailIcon />}
                    onClick={handleSendForReview}
                    disabled={sendEmailMutation.isPending}
                    sx={{ mt:  2 }}
                  >
                    {sendEmailMutation.isPending ? 'Sender...' : 'Send til Klient'}
                  </Button>
                </Box>
              )}

              {activeStep === 4 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Digital Signering
                  </Typography>
                  <Alert severity="success" sx={{ mb:  2 }}>
                    Kontrakt sendt til klient. Venter på digital signering.
                  </Alert>
                  <TextField
                    fullWidth
                    label="Din signatur"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    sx={{ mb:  2 }}
                  />
                  <Button variant="contained" 
                    startIcon={<CheckCircleIcon />}
                    sx={{ mt:  2 }}
                  >
                    Fullfør Kontrakt
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Preview */}
        <Grid size={{ xs: 12 }} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Kontraktforhåndsvisning
              </Typography>
              <Paper sx={{ p:  3, bgcolor: '#fafafa', minHeight: 400,  ...theming.getThemedCardSx() }}>
                <Typography variant="h5" gutterBottom sx={{  color: config.color  }}>
                  {config.title.replace(' Designer', ', ')}
                </Typography>
                <Divider sx={{ my:  2 }} />
                
                <Typography variant="body2" gutterBottom>
                  <strong>Klient: </strong> {contractData.clientName || 'Ikke utfylt'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>E-post: </strong> {contractData.clientEmail || 'Ikke utfylt'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Prosjekt: </strong> {contractData.projectDescription || 'Ikke utfylt'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Beløp: </strong> {contractData.totalAmount ? `${contractData.totalAmount} NOK (inkl. 25% MVA)` : 'Ikke utfylt'}
                </Typography>
                
                <Divider sx={{ my:  2 }} />
                
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Kontraktseksjoner ({contractData.sections.length})
                </Typography>
                {contractData.sections.map((section, index) => (
                  <Box key={section.id} sx={{ mb:  2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {index + 1}. {section.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {section.content.substring(0, 100)}...
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Section Editor Dialog */}
      <Dialog 
        open={showSectionEditor}
        onClose={() => {
          setShowSectionEditor(false);
          setEditingSection(null);
      }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingSection ? 'Rediger Seksjon' : 'Ny Kontraktseksjon'}
        </DialogTitle>
        <DialogContent>
          <SectionEditor
            section={editingSection}
            onSave={(section) => {
              if (editingSection) {
                updateSection(editingSection.id, section);
            } else {
                addSection(section);
            }
              setShowSectionEditor(false);
              setEditingSection(null);
          }}
            onCancel={() => {
              setShowSectionEditor(false);
              setEditingSection(null);
          }}
          />
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog 
        open={!!importPreview}
        onClose={() => setImportPreview(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Kontraktimport - Forhåndsvisning
        </DialogTitle>
        <DialogContent>
          {importPreview && (
            <Box>
              <Alert severity="info" sx={{ mb:  3 }}>
                PDF analysert! Funnet {importPreview.extractedSections.length} seksjoner fra {importPreview.totalPages} sider.
              </Alert>
              
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Ekstraherte Seksjoner
                  </Typography>
                  <List>
                    {importPreview.extractedSections.map((section, index) => (
                      <ListItem key={index} sx={{ border: '1px solid #e0e0e0', mb: 1, borderRadius:  1 }}>
                        <ListItemText
                          primary={section.title}
                          secondary={
                            <Box>
                              <Chip label={section.type} size="small" sx={{ mr:  1 }} />
                              <Typography variant="body2" sx={{ mt:  1 }}>
                                {section.content.substring(0, 150)}...
                              </Typography>
                            </Box>
                        }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
                
                <Grid size={{ xs: 12 }} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Original Tekst (Første 1000 tegn)
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: '#f5f5f0', maxHeight: 40, overflow: 'auto', ...theming.getThemedCardSx() }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {importPreview.originalText.substring(0, 1000)}
                      {importPreview.originalText.length > 1000 && '...'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportPreview(null)}>
            Avbryt
          </Button>
          <Button onClick={handleImportPreviewConfirm}
            variant="contained"
            startIcon={<UploadIcon />}
          >
            Fortsett med Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Sections Dialog */}
      <Dialog 
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Importer Seksjoner fra Kontrakt
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            Vi har funnet følgende seksjoner i den importerte kontrakten. Velg hvilke du vil legge til: </Typography>
          <ImportSectionsSelector
            sections={importedSections}
            onImport={handleImportSections}
            onCancel={() => setShowImportDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// Section Editor Component
function SectionEditor({ section, onSave, onCancel }: {
  section: ContractSection | null;
  onSave: (section: Omit<ContractSection, 'id'>) => void;
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    title: section?.title ||'',
    content: section?.content ||'',
    type: section?.type || 'custom' as ContractSection[', '],
    required: section?.required || false
});

  const sectionTypes = [
    { value: 'terms', label: 'Vilkår og betingelser' },
    { value: 'pricing', label: 'Prising og betaling' },
    { value: 'schedule', label: 'Tidsplan og frister' },
    { value: 'responsibilities', label: 'Ansvar og leveranser' },
    { value: 'custom', label: 'Tilpasset seksjon' }
  ];

  return (
    <Box sx={{ pt:  2 }}>
      <TextField
        fullWidth
        label="Seksjonstitle"
        value={formData.title}
        onChange={(e) => setFormData({...formData, title: e.target.value})}
        sx={{ mb:  2 }}
      />
      
      <FormControl fullWidth sx={{ mb:  2 }}>
        <InputLabel>Seksjonstype</InputLabel>
        <Select
          value={formData.type}
          onChange={(e) => setFormData({...formData, type: e.target.value as ContractSection['']})}
        >
          {sectionTypes.map(type => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        fullWidth
        multiline
        rows={6}
        label="Innhold"
        value={formData.content}
        onChange={(e) => setFormData({...formData, content: e.target.value})}
        sx={{ mb:  2 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={formData.required}
            onChange={(e) => setFormData({...formData, required: e.target.checked})}
          />
      }
        label="Påkrevd seksjon"
        sx={{ mb:  2 }}
      />

      <DialogActions>
        <Button onClick={onCancel} startIcon={<CancelIcon />}>
          Avbryt
        </Button>
        <Button 
          onClick={() => onSave(formData)}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!formData.title || !formData.content}
        >
          Lagre
        </Button>
      </DialogActions>
    </Box>
  );
}

// Import Sections Selector Component
function ImportSectionsSelector({ sections, onImport, onCancel }: {
  sections: ContractSection[];
  onImport: (sectionIds: string[]) => void;
  onCancel: () => void
}) {
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
};

  return (
    <Box>
      <List>
        {sections.map((section) => (
          <ListItem key={section.id}>
            <ListItemIcon>
              <Checkbox
                checked={selectedSections.includes(section.id)}
                onChange={() => toggleSection(section.id)}
              />
            </ListItemIcon>
            <ListItemText
              primary={section.title}
              secondary={`${section.type} - ${section.content.substring(0, 100)}...`}
            />
          </ListItem>
        ))}
      </List>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
        Ønsker du å legge til flere egne seksjoner etter import?
      </Typography>

      <DialogActions>
        <Button onClick={onCancel}>
          Avbryt
        </Button>
        <Button 
          onClick={() => onImport(selectedSections)}
          variant="contained"
          disabled={selectedSections.length === 0}
        >
          Importer {selectedSections.length} seksjoner
        </Button>
      </DialogActions>
    </Box>
  );
}