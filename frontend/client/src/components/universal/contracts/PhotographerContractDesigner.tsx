// @ts-nocheck
import { useTheming } from '../../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
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
  ContentCopy as FileCopyIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ContractSection {
  id: string;
  title: string;
  content: string;
  type: 'terms' | 'pricing' | 'schedule' | 'responsibilities' | 'custom';
  required: boolean
}

interface ContractData {
  contractTitle: string;
  logoUrl?: string;
  clientName: string;
  clientEmail: string;
  customerType: 'private' | 'business';
  organizationNumber?: string;
  organizationName?: string;
  businessAddress?: string;
  projectDescription: string;
  totalAmount: string;
  eventDate: string;
  eventLocation: string;
  contractType: string;
  sections: ContractSection[]
}

interface BrregData {
  navn: string;
  organisasjonsnummer: string;
  forretningsadresse?: {
    adresse: string[];
    postnummer: string;
    poststed: string;
  };
}

interface UniversalContractDesignerProps {
  profession?: 'photographer' | 'videographer' | 'music_producer';
  onContractCreated?: (contractId: string) => void;
  initialClient?: { name?: string; email?: string } | null;
}

export default function UniversalContractDesigner({
  profession = 'photographer,',
  onContractCreated,
  initialClient,
}: UniversalContractDesignerProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [contractData, setContractData] = useState<ContractData>({
    contractTitle: 'Fotografikontrakt',
    logoUrl: '',
    clientName: '',
    clientEmail: '',
    customerType: 'private',
    organizationNumber: '',
    organizationName: '',
    businessAddress: '',
    projectDescription: '',
    totalAmount: '',
    eventDate: '',
    eventLocation: '',
    contractType: 'wedding_photography',
    sections:  [],
});
  const [brregLoading, setBrregLoading] = useState(false);
  const [brregError, setBrregError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BrregData[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  React.useEffect(() => {
    if (initialClient && (!contractData.clientName && !contractData.clientEmail)) {
      setContractData((prev) => ({
        ...prev,
        clientName: initialClient.name || prev.clientName,
        clientEmail: initialClient.email || prev.clientEmail,
      }));
    }
  }, [initialClient]);

  const [showSectionEditor, setShowSectionEditor] = useState(false);
  const [editingSection, setEditingSection] = useState<ContractSection | null>(null);
  const [importedSections, setImportedSections] = useState<ContractSection[]>([]);
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const signaturePadRef = useRef<SignatureCanvas | null>(null);
  const [signatureData, setSignatureData] = useState('');
  const [isSignaturePadEmpty, setIsSignaturePadEmpty] = useState(true);
  const [isSigned, setIsSigned] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    isTampered: boolean;
    verifiedAt: string;
    message: string;
  } | null>(null);

  // Brreg lookup function
  const lookupOrganization = async (orgNumber: string) => {
    const cleanOrgNumber = orgNumber.replace(/\s/g, '');
    if (cleanOrgNumber.length !== 9) {
      setBrregError('Organisasjonsnummer må være 9 siffer');
      return;
    }

    setBrregLoading(true);
    setBrregError(null);

    try {
      const response = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrgNumber}`);
      
      if (!response.ok) {
        throw new Error('Fant ikke organisasjon');
      }

      const data: BrregData = await response.json();
      
      setContractData(prev => ({
        ...prev,
        organizationNumber: cleanOrgNumber,
        organizationName: data.navn,
        clientName: data.navn,
        businessAddress: data.forretningsadresse 
          ? `${data.forretningsadresse.adresse.join(', ')}, ${data.forretningsadresse.postnummer} ${data.forretningsadresse.poststed}`
          : ''
      }));
    } catch (error) {
      setBrregError('Kunne ikke hente organisasjonsinformasjon. Sjekk organisasjonsnummeret.');
    } finally {
      setBrregLoading(false);
    }
  };

  // Search organizations by name
  const searchOrganizations = async (name: string) => {
    if (name.length < 2) {
      setBrregError('Søk må være minst 2 tegn');
      return;
    }

    setBrregLoading(true);
    setBrregError(null);
    setSearchResults([]);

    try {
      const response = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(name)}&size=10`);
      
      if (!response.ok) {
        throw new Error('Søk feilet');
      }

      const data = await response.json();
      
      if (data._embedded && data._embedded.enheter) {
        setSearchResults(data._embedded.enheter);
        setShowSearchResults(true);
      } else {
        setBrregError('Ingen bedrifter funnet med dette navnet');
      }
    } catch (error) {
      setBrregError('Kunne ikke søke i Brønnøysundregistrene.');
    } finally {
      setBrregLoading(false);
    }
  };

  // Select organization from search results
  const selectOrganization = (org: BrregData) => {
    setContractData(prev => ({
      ...prev,
      organizationNumber: org.organisasjonsnummer,
      organizationName: org.navn,
      clientName: org.navn,
      businessAddress: org.forretningsadresse 
        ? `${org.forretningsadresse.adresse.join(', ')}, ${org.forretningsadresse.postnummer} ${org.forretningsadresse.poststed}`
        : ''
    }));
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Debounced search effect - search as user types
  React.useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchOrganizations(searchQuery);
      }, 500); // Wait 500ms after user stops typing

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [signature, setSignature] = useState('');
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signatureIpAddress, setSignatureIpAddress] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<Description | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    extractedSections: ContractSection[];
    originalText: string;
    totalPages: number;
} | null>(null);
  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

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
        { value: 'corporate_photography', label: 'Bedriftsfotografering' },
      ],
      projectPlaceholder: 'Bryllupsfotografering - lokasjon og tema',
      defaultDescription: 'Profesjonell fotografering med retusjering og levering' },
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
        { value: 'commercial_video', label: 'Reklamefilm' },
      ],
      projectPlaceholder: 'Bryllupsvideo - seremoni og resepsjon',
      defaultDescription: 'Profesjonell videografi med redigering og levering' },
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
        { value: 'sound_design', label: 'Lyddesign' },
      ],
      projectPlaceholder: 'Albumproduksjon - 10 spor med miksing',
      defaultDescription: 'Profesjonell musikkproduksjon med studio og mastering' },
};

  // Helper function to translate section type to Norwegian label
  const getSectionTypeLabel = (type: ContractSection['type']): string => {
    const sectionTypes: Record<ContractSection['type'], string> = {
      'terms': 'Vilkår og betingelser',
      'pricing': 'Prising og betaling',
      'schedule': 'Tidsplan og frister',
      'responsibilities': 'Ansvar og leveranser',
      'custom': 'Tilpasset seksjon'
    };
    return sectionTypes[type] || type;
  };

  const config = professionConfig[profession];

  const steps = [
    { label: 'Utkast', description: 'Opprett kontraktgrunnlag' },
    { label: 'Detaljer', description: 'Utfyll kontraktdetaljer' },
    { label: 'Seksjoner', description: 'Administrer kontraktseksjoner' },
    { label: 'Gjennomgang', description: 'Gjennomgang og godkjenning' },
    { label: 'Signering', description: 'Digital signering' },
  ];

  // Default sections based on profession
  const getDefaultSections = (profession: string): ContractSection[] => {
    const baseId = Date.now();
    switch (profession) {
      case 'photographer':
        return [
          {
            id: `${baseId}-1`,
            title: 'Fotograferingstjenester',
            content: 'Beskrivelse av fotograferingsarbeid, antall timer, og leveranser.',
            type: 'responsibilities',
            required: true,
        },
          {
            id: `${baseId}-2`,
            title: 'Prisstruktur og Betaling',
            content: 'Totalpris, betalingsplan og refunderingspolicy.',
            type: 'pricing',
            required: true,
        },
          {
            id: `${baseId}-3`,
            title: 'Leveringsfrister',
            content: 'Tidspunkter for levering av bearbeidede bilder og endelige produkter.',
            type: 'schedule',
            required: true,
        },
          {
            id: `${baseId}-4`,
            title: 'Opphavsrett og Bruksrettigheter',
            content: 'Rettighetsdefinisjon for bruk av bilder og krediteringsvilkår.',
            type: 'terms',
            required: true,
        },
        ];
      case 'videographer':
        return [
          {
            id: `${baseId}-1`,
            title: 'Videoproduksjonstjenester',
            content: 'Beskrivelse av filming, redigering og leveranser.',
            type: 'responsibilities',
            required: true,
        },
          {
            id: `${baseId}-2`,
            title: 'Kostnader og Betalingsbetingelser',
            content: 'Prisstruktur, betalingsfrister og tilleggsgebyrer.',
            type: 'pricing',
            required: true,
        },
          {
            id: `${baseId}-3`,
            title: 'Produksjonsplan',
            content: 'Tidsplan for filming, post-produksjon og levering.',
            type: 'schedule',
            required: true,
        },
          {
            id: `${baseId}-4`,
            title: 'Lisenser og Distribusjon',
            content: 'Bruksrettigheter for video og distribusjonsvilkår.',
            type: 'terms',
            required: true,
        },
        ];
      case 'music_producer':
        return [
          {
            id: `${baseId}-1`,
            title: 'Produksjonstjenester',
            content: 'Studio-arbeid, miksing, mastering og leveranser.',
            type: 'responsibilities',
            required: true,
        },
          {
            id: `${baseId}-2`,
            title: 'Honorar og Royalties',
            content: 'Produksjonshonorarer, royalty-andeler og betalingsvilkår.',
            type: 'pricing',
            required: true,
        },
          {
            id: `${baseId}-3`,
            title: 'Studioplan og Deadlines',
            content: 'Studiotime, leveringsfrister og milepæler.',
            type: 'schedule',
            required: true,
        },
          {
            id: `${baseId}-4`,
            title: 'Publiseringsrettigheter',
            content: 'Opphavsrett, krediteringsvilkår og distribusjon.',
            type: 'terms',
            required: true,
        },
        ];
      default: return [];
}
};

  const buildContractPayload = () => ({
    contractTitle: contractData.contractTitle,
    logoUrl: contractData.logoUrl,
    customerType: contractData.customerType,
    clientName: contractData.clientName,
    clientEmail: contractData.clientEmail,
    projectDescription: contractData.projectDescription,
    totalAmount: contractData.totalAmount,
    eventDate: contractData.eventDate,
    eventLocation: contractData.eventLocation,
    contractType: contractData.contractType,
    sections: contractData.sections,
    profession,
    templateUsed: `${config.title} v1.0`,
    ...(contractData.customerType === 'business' && {
      organizationNumber: contractData.organizationNumber,
      organizationName: contractData.organizationName,
      businessAddress: contractData.businessAddress,
    })
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: (data: ContractData) =>
      apiRequest('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          profession,
          contractType: data.contractType,
          templateUsed: `${config.title} v1.0`,
      }),
    }),
    onSuccess: (response) => {
      console.log('Contract created:', response);
      setCurrentContractId(response.contract?.id || response.contractId || null);
      setActiveStep(2);
      if (onContractCreated) {
        onContractCreated(response.contract?.id);
    }
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
  },
    onError: (error: any) => {
      console.error('Contract creation error:', error);
      alert(`Kunne ikke opprette kontrakt: ${error.message || 'Ukjent feil'}`);
    },
});

  // Update draft mutation
  const updateDraftMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest(`/api/contracts/${currentContractId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (response) => {
      console.log('Draft updated:', response);
      setCurrentContractId(response.contract?.id || response.contractId || currentContractId);
      alert('Utkast lagret');
    },
    onError: (error: any) => {
      console.error('Draft update error:', error);
      alert(`Kunne ikke lagre utkast: ${error.message || 'Ukjent feil'}`);
    },
  });

  // Backup to Google Drive mutation
  const backupContractMutation = useMutation({
    mutationFn: (contractId: string) =>
      apiRequest(`/api/contracts/${contractId}/backup-drive`, {
        method: 'POST' }),
    onSuccess: (response) => {
      console.log('Contract backed up:', response);
      alert('Kontrakten er klargjort i Google Drive.');
  },
});

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: (emailData: any) =>
      apiRequest('/api/contracts/send-email', {
        method: 'POST',
        body: JSON.stringify({
          ...emailData,
          profession,
          contractTemplate: config.title,
      }),
    }),
    onSuccess: (response) => {
      console.log('Email sent:', response);
      setCurrentContractId(response.contract?.id || response.contractId || currentContractId);
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      setActiveStep(4);
  },
    onError: (error: any) => {
      console.error('Email sending error:', error);
      alert(`E-post kunne ikke sendes: ${error.message || 'Ukjent feil'}`);
    },
});

  // Sign contract mutation
  const signContractMutation = useMutation({
    mutationFn: (payload: { contractId: string; signerName: string; signerEmail?: string; signatureData?: string }) =>
      apiRequest(`/api/contracts/${payload.contractId}/sign`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (response) => {
      console.log('Contract signed:', response);
      if (response.contract) {
        setSignedAt(response.contract.signedAt);
        setSignatureIpAddress(response.contract.signatureIpAddress);
        setIsSigned(true);
      }
      if (response.contract._verification) {
        setVerificationStatus({
          isTampered: false,
          verifiedAt: response.contract._verification.verifiedAt,
          message: '✅ Kontrakt signert og verifisert'
        });
      }
      alert('Kontrakten er signert og låst for videre redigering');
    },
    onError: (error: any) => {
      console.error('Sign error:', error);
      alert(`Kunne ikke signere kontrakt: ${error.message || 'Ukjent feil'}`);
    },
  });

  // Contract import mutation
  const importContractMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file before upload
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Ugyldig filformat. Kun PDF og DOCX støttes.');
      }
      
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Filen er for stor. Maksimal størrelse er 10MB.');
      }
      
      const formData = new FormData();
      formData.append('contractFile', file);
      return apiRequest('/api/contracts/upload-import', {
        method: 'POST',
        body: formData,
    });
  },
    onSuccess: (data) => {
      setImportPreview(data);
      setIsImporting(false);
},
    onError: (error: any) => {
      console.error('Import error:', error);
      alert(`Import feilet: ${error.message || 'Ukjent feil'}`);
      setIsImporting(false);
  },
});

  // Initialize default sections
  React.useEffect(() => {
    if (contractData.sections.length === 0) {
      const defaultSections = getDefaultSections(profession);
      setContractData((prev) => ({ ...prev, sections: defaultSections }));
  }
}, [profession]);

  const handleCreateContract = () => {
    createContractMutation.mutate(buildContractPayload());
  };

  const handleSaveDraft = () => {
    const payload = buildContractPayload();
    if (currentContractId) {
      updateDraftMutation.mutate(payload);
      return;
    }
    createContractMutation.mutate(payload);
  };

  const handleSignContract = () => {
    if (!currentContractId) {
      alert('Ingen kontrakt funnet. Opprett kontrakten før signering.');
      return;
    }
    if (!signature.trim()) {
      alert('Skriv inn navn før signering.');
      return;
    }
    if (!signatureData) {
      alert('Signer i signaturfeltet før du fullfører.');
      return;
    }
    signContractMutation.mutate({
      contractId: currentContractId,
      signerName: signature,
      signerEmail: contractData.clientEmail,
      signatureData,
    });
  };

  // Section management functions
  const addSection = (section: Omit<ContractSection, 'id, '>) => {
    const newSection: ContractSection = {
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
    setContractData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
  }));
};

  const updateSection = (id: string, updates: Partial<ContractSection>) => {
    setContractData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === id ? { ...section, ...updates } : section,
      ),
  }));
};

  const deleteSection = (id: string) => {
    setContractData((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== id),
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
      .filter((section) => sectionsToImport.includes(section.id))
      .map((section) => ({
        ...section,
        id: `imported-${Date.now()}-${section.id}`,
    }));

    setContractData((prev) => ({
      ...prev,
      sections: [...prev.sections, ...newSections],
  }));
    setShowImportDialog(false);
    setImportedSections([]);
};

  const handleSendForReview = () => {
    if (!currentContractId) {
      alert('Opprett eller lagre kontrakten før du sender den til signering.');
      return;
    }
    const emailData = {
      contractId: currentContractId,
      photographerName: 'Daniel Nordhagen - CreatorHub Norge',
      photographerEmail: 'daniel@creatorhubn.com',
      targetEmail: contractData.clientEmail,
      message: `Hei ${contractData.clientName}! Hermed sender jeg kontraktsutkastet for ${contractData.projectDescription}. Vennligst gjennomgå og gi tilbakemelding.`,
  };
    sendEmailMutation.mutate(emailData);
};

  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p:  3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 4,
          background: config.gradient,
          color: 'white',
          p: 4,
          borderRadius: 3,
          boxShadow: `0 4px 20px ${config.color}40`
        }}
      >
        <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
          {config.icon}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            {config.title}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Opprett profesjonelle kontrakter på minutter
          </Typography>
        </Box>
        {contractData.clientName && (
          <Box sx={{ textAlign: 'right', ml: 2 }}>
            <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>
              Klient: {contractData.clientName}
            </Typography>
            {contractData.projectDescription && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {contractData.projectDescription}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Progress Bar */}
      <Card sx={{ mb: 4, ...theming.getThemedCardSx() }}>
        <CardContent sx={{ ...theming.getThemedCardSx(), p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                Fremdrift
              </Typography>
              <Chip 
                label={`${Math.round(progress)}% fullført`}
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: 'rgba(33,150,243,0.08)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: config.color,
                  borderRadius: 5
                }
              }}
            />
          </Box>

          {/* Steps */}
          <Grid container spacing={2}>
            {steps.map((step, index) => {
              const isActive = activeStep === index;
              const isCompleted = activeStep > index;
              const isAccessible = index <= activeStep;
              
              return (
                <Grid item xs={12} sm={6} md key={index}>
                  <Card
                    sx={{
                      border: isActive ? `2px solid ${config.color}` : isCompleted ? '2px solid #4caf50' : '1px solid rgba(255,255,255,0.10)',
                      bgcolor: isActive ? `${config.color}15` : isCompleted ? '#f1f8e9' : 'rgba(255,255,255,0.04)',
                      cursor: isAccessible ? 'pointer' : 'not-allowed',
                      opacity: isAccessible ? 1 : 0.6,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      '&:hover': isAccessible ? {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 8px 16px ${config.color}20`
                      } : {},
                      ...theming.getThemedCardSx()
                    }}
                    onClick={() => isAccessible && setActiveStep(index)}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 2.5, px: 2, ...theming.getThemedCardSx() }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        mb: 1
                      }}>
                        <Box sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: isActive ? config.color : isCompleted ? '#4caf50' : '#e0e0e0',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          mr: 1
                        }}>
                          {isCompleted ? '✓' : index + 1}
                        </Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {step.label}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {step.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Grid container spacing={4}>
        {/* Left Panel - Current Step */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ ...theming.getThemedCardSx(), p: 3 }}>
              <Box sx={{ mb: 3, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Steg {activeStep + 1} av {steps.length}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary, mt: 0.5 }}>
                  {steps[activeStep].label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {steps[activeStep].description}
                </Typography>
              </Box>

              {/* Step Content */}
              {activeStep === 0 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Start med å legge inn grunnleggende klientinformasjon. Dette vil bli brukt gjennom hele kontrakten.
                  </Alert>

                  {/* Contract Title and Logo */}
                  <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Kontraktinformasjon
                    </Typography>
                    <TextField
                      fullWidth
                      label="Kontrakttittel"
                      placeholder="F.eks. Bryllupskontrakt - Ola & Kari"
                      value={contractData.contractTitle}
                      onChange={(e) =>
                        setContractData({
                          ...contractData,
                          contractTitle: e.target.value,
                        })
                      }
                      disabled={isSigned}
                      required
                      helperText={isSigned ? "Kontrakten er signert og kan ikke redigeres" : "Skriv inn en beskrivende tittel for denne kontrakten"}
                      sx={{ mb: 2 }}
                    />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Logo (valgfritt)
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        {contractData.logoUrl && (
                          <Box
                            sx={{
                              position: 'relative',
                              width: 100,
                              height: 100,
                              border: '2px dashed rgba(255,255,255,0.10)',
                              borderRadius: 1,
                              p: 1,
                              bgcolor: 'rgba(255,255,255,0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Box
                              component="img"
                              src={contractData.logoUrl}
                              alt="Logo"
                              sx={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                              }}
                            />
                            <IconButton
                              onClick={() => setContractData({ ...contractData, logoUrl: '' })}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                bgcolor: 'error.main',
                                color: 'white',
                                '&:hover': { bgcolor: 'error.dark' },
                                width: 24,
                                height: 24
                              }}
                            >
                              <CancelIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Box>
                        )}
                        <Box sx={{ flex: 1 }}>
                          <input
                            accept="image/png,image/jpeg,image/jpg"
                            style={{ display: 'none' }}
                            id="logo-upload"
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Validate file size (max 2MB)
                                if (file.size > 2 * 1024 * 1024) {
                                  alert('Filen er for stor. Maksimal størrelse er 2MB.');
                                  return;
                                }
                                
                                // Validate file type
                                const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
                                if (!validTypes.includes(file.type)) {
                                  alert('Ugyldig filformat. Kun PNG og JPG er støttet.');
                                  return;
                                }
                                
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setContractData({
                                    ...contractData,
                                    logoUrl: reader.result as string,
                                  });
                                };
                                reader.onerror = () => {
                                  alert('Feil ved opplasting av fil. Vennligst prøv igjen.');
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label htmlFor="logo-upload">
                            <Button
                              variant="outlined"
                              component="span"
                              startIcon={<CloudUploadIcon />}
                              fullWidth
                            >
                              {contractData.logoUrl ? 'Endre logo' : 'Last opp logo'}
                            </Button>
                          </label>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Støttede formater: PNG, JPG. Maks 2MB.
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Customer Type Selection */}
                  <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Kundetype
                    </Typography>
                    <FormControl component="fieldset">
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={contractData.customerType === 'private'}
                              onChange={() => setContractData({ ...contractData, customerType: 'private', organizationNumber: '', organizationName: '', businessAddress: '' })}
                            />
                          }
                          label="Privatkunde"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={contractData.customerType === 'business'}
                              onChange={() => setContractData({ ...contractData, customerType: 'business' })}
                            />
                          }
                          label="Bedrift"
                        />
                      </Box>
                    </FormControl>
                  </Paper>

                  {/* Business Information */}
                  {contractData.customerType === 'business' && (
                    <Paper sx={{ p: 3, mb: 3, border: '2px solid rgba(33,150,243,0.20)', bgcolor: 'rgba(255,255,255,0.04)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                          Bedriftsinformasjon
                        </Typography>
                        <Chip label="Brreg.no" size="small" variant="outlined" />
                      </Box>

                      {/* Search by Name */}
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Søk på bedriftsnavn
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                          <TextField
                            fullWidth
                            label="Søk bedrift"
                            placeholder="F.eks. Acme AS"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setBrregError(null);
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && searchQuery) {
                                searchOrganizations(searchQuery);
                              }
                            }}
                          />
                          <Button
                            variant="outlined"
                            onClick={() => searchOrganizations(searchQuery)}
                            disabled={!searchQuery || searchQuery.length < 2 || brregLoading}
                            sx={{ minWidth: 100 }}
                          >
                            {brregLoading ? 'Søker...' : 'Søk'}
                          </Button>
                        </Box>

                        {/* Search Results */}
                        {showSearchResults && searchResults.length > 0 && (
                          <Paper sx={{ mt: 2, maxHeight: 300, overflow: 'auto', border: '1px solid rgba(255,255,255,0.10)' }}>
                            <List>
                              {searchResults.map((org, index) => (
                                <ListItem
                                  key={org.organisasjonsnummer}
                                  button
                                  onClick={() => selectOrganization(org)}
                                  sx={{
                                    borderBottom: index < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                                  }}
                                >
                                  <ListItemText
                                    primary={org.navn}
                                    secondary={
                                      <Box>
                                        <Typography variant="caption" component="span">
                                          Org.nr: {org.organisasjonsnummer}
                                        </Typography>
                                        {org.forretningsadresse && (
                                          <Typography variant="caption" component="span" sx={{ ml: 2 }}>
                                            {org.forretningsadresse.poststed}
                                          </Typography>
                                        )}
                                      </Box>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Paper>
                        )}
                      </Box>

                      <Divider sx={{ my: 2 }}>
                        <Chip label="eller" size="small" />
                      </Divider>

                      {/* Search by Organization Number */}
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Slå opp på organisasjonsnummer
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                          <TextField
                            fullWidth
                            label="Organisasjonsnummer"
                            placeholder="123456789"
                            value={contractData.organizationNumber || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\\D/g, '').slice(0, 9);
                              setContractData({ ...contractData, organizationNumber: value });
                              setBrregError(null);
                            }}
                            helperText={brregError || "9 siffer"}
                            error={!!brregError}
                            inputProps={{ maxLength: 9 }}
                          />
                          <Button
                            variant="contained"
                            onClick={() => contractData.organizationNumber && lookupOrganization(contractData.organizationNumber)}
                            disabled={!contractData.organizationNumber || contractData.organizationNumber.length !== 9 || brregLoading}
                            sx={{ minWidth: 120, ...theming.getThemedButtonSx() }}
                          >
                            {brregLoading ? 'Henter...' : 'Slå opp'}
                          </Button>
                        </Box>
                      </Box>

                      {/* Organization Details */}
                      {contractData.organizationName && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {contractData.organizationName}
                          </Typography>
                          {contractData.organizationNumber && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Org.nr: {contractData.organizationNumber}
                            </Typography>
                          )}
                          {contractData.businessAddress && (
                            <Typography variant="caption" color="text.secondary">
                              {contractData.businessAddress}
                            </Typography>
                          )}
                        </Alert>
                      )}

                      <TextField
                        fullWidth
                        label="Bedriftsnavn"
                        value={contractData.organizationName || ''}
                        onChange={(e) => setContractData({ ...contractData, organizationName: e.target.value, clientName: e.target.value })}
                        required
                        helperText="Automatisk utfylt fra Brreg, kan redigeres"
                        sx={{ mb: 2 }}
                      />

                      <TextField
                        fullWidth
                        label="Forretningsadresse"
                        value={contractData.businessAddress || ''}
                        onChange={(e) => setContractData({ ...contractData, businessAddress: e.target.value })}
                        disabled={isSigned}
                        helperText="Automatisk utfylt fra Brreg, kan redigeres"
                      />
                    </Paper>
                  )}

                  {/* Private Customer or Business Contact */}
                  {contractData.customerType === 'private' && (
                    <TextField
                      fullWidth
                      label="Klientnavn"
                      placeholder="F.eks. John Doe"
                      value={contractData.clientName}
                      onChange={(e) =>
                        setContractData({
                          ...contractData,
                          clientName: e.target.value,
                      })
                    }
                      disabled={isSigned}
                      required
                      helperText="Full navn på personen som skal signere kontrakten"
                      sx={{ mb: 3 }}
                    />
                  )}

                  <TextField
                    fullWidth
                    label={contractData.customerType === 'business' ? 'Kontaktperson e-post' : 'E-postadresse'}
                    type="email"
                    placeholder="klient@example.com"
                    value={contractData.clientEmail}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        clientEmail: e.target.value,
                    })
                  }
                    disabled={isSigned}
                    required
                    helperText={contractData.customerType === 'business' 
                      ? 'E-post til kontaktperson i bedriften' 
                      : 'Klienten vil motta kontrakten og oppdateringer på denne e-postadressen'}
                    sx={{ mb: 3 }}
                  />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
                    <Button 
                      variant="contained" 
                      size="large"
                      onClick={() => setActiveStep(1)} 
                      disabled={
                        !contractData.clientEmail || 
                        (contractData.customerType === 'private' && !contractData.clientName) ||
                        (contractData.customerType === 'business' && (!contractData.organizationNumber || !contractData.organizationName))
                      }
                      sx={{ ...theming.getThemedButtonSx(), px: 4 }}
                    >
                      Neste: Kontraktdetaljer →
                    </Button>
                  </Box>
                </Box>
             )}

              {activeStep === 1 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Fyll inn detaljene for dette spesifikke oppdraget. Disse vil bli inkludert i kontrakten.
                  </Alert>

                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                    Oppdragstype
                  </Typography>
                  <TextField
                    fullWidth
                    select
                    label="Kontrakttype"
                    value={contractData.contractType}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        contractType: e.target.value,
                    })
                  }
                    required
                    helperText="Velg hvilken type oppdrag dette gjelder"
                    sx={{ mb: 4 }}
                  >
                    {config.contractTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                    Oppdragsdetaljer
                  </Typography>
                  <TextField
                    fullWidth
                    label="Prosjektbeskrivelse"
                    placeholder={config.projectPlaceholder}
                    multiline
                    rows={3}
                    value={contractData.projectDescription}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        projectDescription: e.target.value,
                    })
                  }
                    disabled={isSigned}
                    required
                    helperText="Beskriv hva oppdraget omfatter"
                    sx={{ mb: 3 }}
                  />
                  
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Totalbeløp (NOK)"
                        type="number"
                        placeholder="15000"
                        value={contractData.totalAmount}
                        onChange={(e) =>
                          setContractData({
                            ...contractData,
                            totalAmount: e.target.value,
                        })
                      }
                        disabled={isSigned}
                        required
                        helperText="Avtalt pris for oppdraget"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Eventdato"
                        type="date"
                        value={contractData.eventDate}
                        onChange={(e) =>
                          setContractData({
                            ...contractData,
                            eventDate: e.target.value,
                        })
                      }
                        disabled={isSigned}
                        InputLabelProps={{ shrink: true }}
                        required
                        helperText="Dato for arrangementet/oppdraget"
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    fullWidth
                    label="Lokasjon"
                    placeholder="F.eks. Oslo Plaza Hotell, Oslo"
                    value={contractData.eventLocation}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        eventLocation: e.target.value,
                      })
                    }
                    disabled={isSigned}
                    helperText="Hvor skal oppdraget utføres?"
                    sx={{ mb: 4 }}
                  />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button 
                      variant="outlined" 
                      size="large"
                      onClick={() => setActiveStep(0)}
                    >
                      ← Tilbake
                    </Button>
                    <Button 
                      variant="contained"
                      size="large"
                      onClick={handleCreateContract}
                      disabled={createContractMutation.isPending || !contractData.contractType || !contractData.projectDescription || !contractData.totalAmount || !contractData.eventDate}
                      sx={{ ...theming.getThemedButtonSx(), px: 4 }}
                    >
                      {createContractMutation.isPending ? 'Oppretter...' : 'Opprett Kontrakt →'}
                    </Button>
                  </Box>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Tilpass kontraktseksjonene etter dine behov. Du kan legge til, redigere eller slette seksjoner.
                  </Alert>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 3,
                      flexWrap: 'wrap',
                      gap: 2
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                      Kontraktseksjoner ({contractData.sections.length})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
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
                          size="small"
                          disabled={importContractMutation.isPending}
                        >
                          {importContractMutation.isPending ? 'Importerer...' : 'Importer'}
                        </Button>
                      </label>
                      <Button variant="contained"
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={() => setShowSectionEditor(true)}
                        disabled={isSigned}
                        sx={{ bgcolor: config.color }}
                      >
                        Ny Seksjon
                      </Button>
                    </Box>
                  </Box>

                  {/* Sections List */}
                  <Box sx={{ mb: 3 }}>
                    {contractData.sections.length === 0 ? (
                      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                          Ingen seksjoner lagt til ennå
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Klikk "Ny Seksjon" for å legge til innhold i kontrakten
                        </Typography>
                      </Paper>
                    ) : (
                      contractData.sections.map((section, index) => (
                        <Accordion 
                          key={section.id} 
                          sx={{ 
                            mb: 1.5,
                            '&:before': { display: 'none' },
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            '&:hover': {
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }
                          }}
                        >
                          <AccordionSummary 
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.04)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                gap: 1.5
                              }}
                            >
                              <Box sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: config.color + '20',
                                color: config.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.875rem'
                              }}>
                                {index + 1}
                              </Box>
                              <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
                                {section.title}
                              </Typography>
                              <Chip
                                label={getSectionTypeLabel(section.type)}
                                size="small"
                                variant="outlined"
                              />
                              {section.required && (
                                <Chip label="Påkrevd" size="small" color="error" variant="outlined" />
                              )}
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSection(section);
                                  setShowSectionEditor(true);
                                }}
                                size="small"
                                sx={{ '&:hover': { color: config.color } }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSection(section.id);
                                }}
                                size="small"
                                disabled={section.required}
                                sx={{ '&:hover': { color: 'error.main' } }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 2, pb: 3 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                              {section.content}
                            </Typography>
                          </AccordionDetails>
                        </Accordion>
                      ))
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button 
                      variant="outlined" 
                      size="large"
                      onClick={() => setActiveStep(1)}
                    >
                      ← Tilbake
                    </Button>
                    <Button 
                      variant="contained" 
                      size="large"
                      onClick={() => setActiveStep(3)} 
                      disabled={contractData.sections.length === 0}
                      sx={{ ...theming.getThemedButtonSx(), px: 4 }}
                    >
                      Neste: Gjennomgang →
                    </Button>
                  </Box>
                </Box>
             )}

              {activeStep === 3 && (
                <Box>
                  <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Kontrakt klar for gjennomgang!
                    </Typography>
                    <Typography variant="body2">
                      Gjennomgå kontrakten til høyre og send den til klienten for godkjenning når du er fornøyd.
                    </Typography>
                  </Alert>

                  <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(255,255,255,0.04)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Sammendrag
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Klient</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{contractData.clientName || 'Ikke utfylt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">E-post</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{contractData.clientEmail || 'Ikke utfylt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Beløp</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>NOK {contractData.totalAmount || 'Ikke utfylt'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Seksjoner</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{contractData.sections.length} seksjoner</Typography>
                      </Grid>
                    </Grid>
                  </Paper>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 4 }}>
                    <Button 
                      variant="outlined" 
                      size="large"
                      onClick={() => setActiveStep(2)}
                    >
                      ← Tilbake
                    </Button>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        size="large"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveDraft}
                        disabled={createContractMutation.isPending || updateDraftMutation.isPending}
                      >
                        Lagre utkast
                      </Button>
                      <Button 
                        variant="contained"
                        size="large"
                        startIcon={<EmailIcon />}
                        onClick={handleSendForReview}
                        disabled={sendEmailMutation.isPending}
                        sx={{ ...theming.getThemedButtonSx(), px: 4 }}
                      >
                        {sendEmailMutation.isPending ? 'Sender...' : 'Send til klient →'}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}

              {activeStep === 4 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 3 }} icon={<EmailIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      E-post sendt til klient!
                    </Typography>
                    <Typography variant="body2">
                      Venter på at klienten skal gjennomgå og signere kontrakten digitalt.
                    </Typography>
                  </Alert>

                  <Paper sx={{ p: 3, mb: 3, border: '2px dashed rgba(255,255,255,0.10)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Digital signatur
                    </Typography>
                    <TextField
                      fullWidth
                      label="Din signatur"
                      placeholder="Skriv ditt fulle navn"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      helperText="Din signatur vil bli lagt til kontrakten"
                      sx={{ mb: 2 }}
                    />
                    <Box
                      sx={{
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 1,
                        bgcolor: 'white',
                        mb: 2,
                        p: 1
                      }}
                    >
                      <SignatureCanvas
                        ref={signaturePadRef}
                        penColor="#1a1a1a"
                        canvasProps={{
                          width: 520,
                          height: 180,
                          style: { width: '100%', height: 180 }
                        }}
                        onEnd={() => {
                          const dataUrl = signaturePadRef.current?.toDataURL('image/png') || '';
                          setSignatureData(dataUrl);
                          setIsSignaturePadEmpty(signaturePadRef.current?.isEmpty() ?? true);
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          signaturePadRef.current?.clear();
                          setSignatureData('');
                          setIsSignaturePadEmpty(true);
                        }}
                      >
                        Tøm signatur
                      </Button>
                    </Box>
                    <Button 
                      variant="contained" 
                      startIcon={<CheckCircleIcon />}
                      disabled={!signature || isSignaturePadEmpty || signContractMutation.isPending}
                      fullWidth
                      size="large"
                      onClick={handleSignContract}
                      sx={{ ...theming.getThemedButtonSx() }}
                    >
                      {signContractMutation.isPending ? 'Signerer...' : 'Signer kontrakt'}
                    </Button>
                  </Paper>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button 
                      variant="outlined" 
                      size="large"
                      onClick={() => setActiveStep(3)}
                    >
                      ← Tilbake
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Preview */}
        <Grid item xs={12} md={6}>
          <Card sx={{ position: 'sticky', top: 16, ...theming.getThemedCardSx() }}>
            <CardContent sx={{ ...theming.getThemedCardSx(), p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Forhåndsvisning
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                    Kontraktforhåndsvisning
                  </Typography>
                </Box>
                <Chip 
                  icon={<DescriptionIcon />} 
                  label="PDF" 
                  size="small" 
                  variant="outlined"
                />
              </Box>

              <Paper
                sx={{
                  p: 4,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  minHeight: 500,
                  maxHeight: 'calc(100vh - 280px)',
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  ...theming.getThemedCardSx() 
                }}
              >
                {/* Verification Status */}
                {isSigned && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CheckCircleIcon sx={{ color: '#2e7d32', fontSize: 24 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                        ✅ Kontrakt signert og låst
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Denne kontrakten kan ikke endres etter signering
                      </Typography>
                    </Box>
                  </Box>
                )}

                {verificationStatus?.isTampered && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(244,67,54,0.10)', border: '2px solid #f44336', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CancelIcon sx={{ color: '#c62828', fontSize: 24 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#c62828' }}>
                        ⚠️  TAMPERING DETECTED
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Denne kontrakten har blitt endret etter signering. Det kan indikere forfalskelse.
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Contract Header */}
                <Box sx={{ mb: 4, pb: 3, borderBottom: `2px solid ${config.color}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                    {/* Logo on the left */}
                    {contractData.logoUrl && (
                      <Box
                        component="img"
                        src={contractData.logoUrl}
                        alt="Logo"
                        sx={{
                          width: 100,
                          height: 100,
                          objectFit: 'contain',
                          flexShrink: 0
                        }}
                      />
                    )}
                    {/* Title and date */}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h4" sx={{ color: config.color, fontWeight: 700, mb: 1 }}>
                        {contractData.contractTitle || config.title.replace(' Designer', '')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Opprettet {new Date().toLocaleDateString('nb-NO')}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Contract Details */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: theming.colors.primary }}>
                    Parter
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
                        <Typography variant="caption" color="text.secondary">Klient</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {contractData.clientName || 'Ikke utfylt'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {contractData.clientEmail || 'E-post ikke utfylt'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
                        <Typography variant="caption" color="text.secondary">Oppdrag</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {contractData.projectDescription || 'Ikke beskrevet'}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                {/* Financial Info */}
                {contractData.totalAmount && (
                  <Paper sx={{ p: 2.5, mb: 4, bgcolor: `${config.color}10`, border: `1px solid ${config.color}40` }}>
                    <Typography variant="caption" color="text.secondary">Totalbeløp</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: config.color }}>
                      NOK {contractData.totalAmount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (inkl. 25% MVA)
                    </Typography>
                  </Paper>
                )}

                {/* Contract Sections */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: theming.colors.primary }}>
                    Kontraktseksjoner {contractData.sections.length > 0 && `(${contractData.sections.length})`}
                  </Typography>
                  {contractData.sections.length === 0 ? (
                    <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
                      <Typography variant="body2" color="text.secondary">
                        Ingen seksjoner lagt til ennå
                      </Typography>
                    </Paper>
                  ) : (
                    contractData.sections.map((section, index) => (
                      <Paper key={section.id} sx={{ p: 2.5, mb: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
                          <Chip 
                            label={index + 1} 
                            size="small" 
                            sx={{ 
                              bgcolor: config.color, 
                              color: 'white',
                              fontWeight: 700,
                              minWidth: 28
                            }} 
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {section.title}
                            </Typography>
                            <Typography variant="caption" sx={{
                              display: 'inline-block',
                              px: 1,
                              py: 0.25,
                              bgcolor: 'rgba(255,255,255,0.10)',
                              borderRadius: 1,
                              textTransform: 'uppercase',
                              fontSize: '0.65rem'
                            }}>
                              {getSectionTypeLabel(section.type)}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
                          {section.content.substring(0, 150)}{section.content.length > 150 ? '...' : ''}
                        </Typography>
                      </Paper>
                    ))
                  )}
                </Box>

                {(signatureData || signature) && (
                  <Paper sx={{ p: 2.5, mt: 4, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Signatur
                    </Typography>
                    {signatureData && (
                      <Box
                        component="img"
                        src={signatureData}
                        alt="Signatur"
                        sx={{
                          width: '100%',
                          maxWidth: 420,
                          height: 140,
                          objectFit: 'contain',
                          bgcolor: 'white',
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: 1,
                          p: 1,
                          mb: 1
                        }}
                      />
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {signature}
                    </Typography>
                    {signedAt && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#666', mb: 0.5 }}>
                        Signert: {new Date(signedAt).toLocaleString('no-NO')}
                      </Typography>
                    )}
                    {signatureIpAddress && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>
                        Fra IP: {signatureIpAddress}
                      </Typography>
                    )}
                  </Paper>
                )}
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
        <DialogTitle>{editingSection ? 'Rediger Seksjon' : 'Ny Kontraktseksjon'}</DialogTitle>
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
      <Dialog open={!!importPreview} onClose={() => setImportPreview(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Kontraktimport - Forhåndsvisning</DialogTitle>
        <DialogContent>
          {importPreview && (
            <Box>
              <Alert severity="info" sx={{ mb:  3 }}>
                PDF analysert! Funnet {importPreview.extractedSections.length} seksjoner fra{''}
                {importPreview.totalPages} sider.
              </Alert>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Ekstraherte Seksjoner
                  </Typography>
                  <List>
                    {importPreview.extractedSections.map((section, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          border: '1px solid rgba(255,255,255,0.10)',
                          mb:  1,
                          borderRadius:  1}}
                      >
                        <ListItemText
                          primary={section.title}
                          secondary={
                            <Box>
                              <Chip label={getSectionTypeLabel(section.type)} size="small" sx={{ mr:  1 }} />
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

                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Original Tekst (Første 1000 tegn)
                  </Typography>
                  <Paper
                    sx={{
                      p:  2,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      maxHeight: 40,
                      overflow: 'auto',
                      ...theming.getThemedCardSx()
                    }}>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    >
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
          <Button onClick={() => setImportPreview(null)}>Avbryt</Button>
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
        <DialogTitle>Importer Seksjoner fra Kontrakt</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            Vi har funnet følgende seksjoner i den importerte kontrakten. Velg hvilke du vil legge
            til: </Typography>
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
function SectionEditor({
  section,
  onSave,
  onCancel,
}: {
  section: ContractSection | null;
  onSave: (section: Omit<ContractSection, 'id'>) => void;
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    title: section?.title ||'',
    content: section?.content ||', ',
    type: section?.type || ('custom' as ContractSection['type']),
    required: section?.required || false,
});

  const sectionTypes = [
    { value: 'terms', label: 'Vilkår og betingelser' },
    { value: 'pricing', label: 'Prising og betaling' },
    { value: 'schedule', label: 'Tidsplan og frister' },
    { value: 'responsibilities', label: 'Ansvar og leveranser' },
    { value: 'custom', label: 'Tilpasset seksjon' },
  ];

  return (
    <Box sx={{ pt:  2 }}>
      <TextField
        fullWidth
        label="Seksjonstitel"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        sx={{ mb:  2 }}
      />

      <FormControl fullWidth sx={{ mb:  2 }}>
        <InputLabel>Seksjonstype</InputLabel>
        <Select
          value={formData.type}
          onChange={(e) =>
            setFormData({
              ...formData,
              type: e.target.value as ContractSection['type'],
          })
        }
        >
          {sectionTypes.map((type) => (
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
        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
        sx={{ mb:  2 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={formData.required}
            onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
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
function ImportSectionsSelector({
  sections,
  onImport,
  onCancel,
}: {
  sections: ContractSection[];
  onImport: (sectionIds: string[]) => void;
  onCancel: () => void
}) {
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
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
        <Button onClick={onCancel}>Avbryt</Button>
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
