// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert,
  Divider,
  LinearProgress,
  Switch,
  FormControlLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Gavel as GavelIcon,
  Assignment as AssignmentIcon,
  BusinessCenter as BusinessCenterIcon,
  Draw as SignatureIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ContractData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientOrgnr?: string;  // BRREG organization number
  projectType: string;
  projectDescription: string;
  eventDate: string;
  eventLocation: string;
  totalAmount: number;
  depositAmount: number;
  paymentSchedule: string;
  deliveryTimeline: string;
  usageRights: string;
  cancellationPolicy: string;
  additionalServices: string[];
  professionalNotes: string;
  vatIncluded: boolean;
  digitalSigningRequired: boolean;
  driveBackupEnabled: boolean
}

interface ContractGeneratorProps {
  projectData?: any;
  onContractGenerated?: (contractId: string) => void;
  onError?: (error: string) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  sessionId?: string;
  clientData?: any; // From BRREG validation
}

// Professional adaptation based on profession
const getProfessionConfig = (profession: string) => {
  switch (profession) {
    case 'photographer':
      return {
        title: 'Fotografikontrakt',
        projectTypes: ['Bryllup','Portrett','Event','Bedriftsfoto','Produktfoto'],
        services: ['Redigering','Utskrift','Online galleri','Ekstra timer','Reisekostnader'],
        usageRights: ['Personlig bruk','Kommersiell bruk','Sosiale medier','Webside','Alle rettigheter'],
        colors: { primary: '#f57c00', secondary: '#e65100' }
    };
    case 'videographer':
      return {
        title: 'Videokontrakt',
        projectTypes: ['Bryllupsvideo','Bedriftsvideo','Musikkvideo','Event','Dokumentar'],
        services: ['Redigering','Fargekorrigering','Lydmiksingw','Ekstra kameraer','Dronefilming'],
        usageRights: ['Personlig bruk','Kommersiell bruk','YouTube','TV-utsending','Alle rettigheter'],
        colors: { primary: '#2196f0', secondary: '#1976d2' }
    };
    case 'music_producer':
      return {
        title: 'Musikkproduksjonskontrakt',
        projectTypes: ['Album','Singel','Demo','Jingle','Lydbok'],
        services: ['Miksing','Mastering','Vokal-opptak''Instrumenter','Komponering'],
        usageRights: ['Artistrettigheter','Streaming','Radio','Kommersiell bruk','Eksklusive rettigheter'],
        colors: { primary: '#9c27b0', secondary: '#7b1fa2' }
    };
    case 'vendor':
      return {
        title: 'Leverandørkontrakt',
        projectTypes: ['Utstyrsleie','Produktlevering','Service','Konsulering','Support'],
        services: ['Levering','Oppsett','Support','Vedlikehold','Opplæring'],
        usageRights: ['Standard lisens','Utvidet lisens','Kommersiell bruk','Videresalg','Eksklusive rettigheter'],
        colors: { primary: '#4caf50', secondary: '#388e3c' }
    };
    default: return {
        title: 'Kontrakt',
        projectTypes: [''],
        services: [''],
        usageRights: [''],
        colors: { primary: '#666660', secondary: '#444444' }
    };
}
};

export default function ContractGenerator({
  projectData,
  onContractGenerated,
  onError,
  profession = 'photographer',
  sessionId,
  clientData
}: ContractGeneratorProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const professionConfig = getProfessionConfig(profession);
  
  const [activeStep, setActiveStep] = useState(0);
  const [contractData, setContractData] = useState<ContractData>({
    clientName: clientData?.name || projectData?.clientName ||'',
    clientEmail: clientData?.email || projectData?.clientEmail ||'',
    clientPhone: clientData?.phone || projectData?.clientPhone ||'',
    clientAddress: clientData?.address ||'',
    clientOrgnr: clientData?.organizationNumber ||'',
    projectType: projectData?.category || professionConfig.projectTypes[],
    projectDescription: projectData?.description ||'',
    eventDate: projectData?.eventDate ||'',
    eventLocation: projectData?.eventLocation ||'',
    totalAmount: projectData?.budget || 0,
    depositAmount:  0,
    paymentSchedule: 'Standard (50% forskudd, 50% ved levering)',
    deliveryTimeline: '2-4 uker etter arrangementet',
    usageRights: professionConfig.usageRights[],
    cancellationPolicy: 'Standard avbestillingsregler',
    additionalServices:  [],
    professionalNotes: '',
    vatIncluded: true,
    digitalSigningRequired: true,
    driveBackupEnabled: true
});

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<any>(null);
  const [signingUrl, setSigningUrl] = useState<string>('');

  // Fetch existing contracts for user
  const { data: existingContracts = [, ],} = useQuery({
    queryKey: ['/api/contracts,', ],
    queryFn: () => apiRequest('/api/contracts', ),
    retry: false,
});

  // Contract generation mutation
  const generateContract = useMutation({
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
          sessionId,
          template: `${profession}_${data.projectType.toLowerCase().replace(/\s+/g, '_')}`
      })
    });
  },
    onSuccess: (response) => {
      setGeneratedContract(response.contract);
      setActiveStep(2);
      onContractGenerated?.(response.contract.id);
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', ],});
  },
    onError: (error: any) => {
      onError?.(error.message || 'Kontraktgenerering feilet');
}
});

  // Digital signature mutation
  const setupDigitalSigning = useMutation({
    mutationFn: async (contractId: string) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/signature/create', {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({
          signatureData: `${contractData.clientName} - ${contractData.projectType}`,
          signerName: contractData.clientName,
          signerEmail: contractData.clientEmail,
          signerPhone: contractData.clientPhone,
          documentHash: contractd,
          documentType: `${profession}_contract`,
          transactionValue: contractData.totalAmount,
          crossBorder: false,
          requireQualified: contractData.totalAmount > 100000 // Qualified signature for large contracts
    })
    });
  },
    onSuccess: (response) => {
      setSigningUrl(response.verification?.url || '');
      setActiveStep(3);
}
});

  // Google Drive backup mutation
  const backupToGoogleDrive = useMutation({
    mutationFn: async (contractId: string) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/google-drive/backup-contract', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({
          contractd,
          clientName: contractData.clientName,
          projectType: contractData.projectType,
          profession
      })
    });
  }
});

  useEffect(() => {
    // Auto-calculate deposit (typically 50%)
    if (contractData.totalAmount > 0) {
      setContractData(prev => ({
        ...prev,
        depositAmount: Math.round(prev.totalAmount * 0.5)
  }));
  }
}, [contractData.totalAmount]);

  const handleInputChange = (field: keyof ContractData, value: any) => {
    setContractData(prev => ({ ...prev, [field]: value }));
};

  const handleGenerateContract = async () => {
    setIsGenerating(true);
    try {
      await generateContract.mutateAsync(contractData);
  } finally {
      setIsGenerating(false);
  }
};

  const handleSetupSigning = async () => {
    if (generatedContract?.id) {
      await setupDigitalSigning.mutateAsync(generatedContract.id);
      
      // Also backup to Google Drive if enabled
      if (contractData.driveBackupEnabled) {
        await backupToGoogleDrive.mutateAsync(generatedContract.id);
    }
  }
};

  const steps = [
    'Klientinformasjon','Prosjektdetaljer', 'Kontrakt generert', 'Digital signering'
  ];

  return (
    <Card sx={{ 
      maxWidth: 100, 
      mx: 'auto', 
      mt:  2,
      background: `linear-gradient(135deg, ${professionConfig.colors.primary}15 0%, ${professionConfig.colors.secondary}08 100%)`
  ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
          <GavelIcon sx={{ mr: 2, color: professionConfig.colors.primary, fontSize: 32}} />
          <Typography variant="h5" component="h2" sx={{  color: professionConfig.colors.primary, fontWeight: 600}}>
            {professionConfig.title}
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb:  3 }}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {index === 0 && (
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="Klientnavn"
                        value={contractData.clientName}
                        onChange={(e) => handleInputChange('clientName', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="E-post"
                        type="email"
                        value={contractData.clientEmail}
                        onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="Telefon"
                        value={contractData.clientPhone}
                        onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="Organisasjonsnummer"
                        value={contractData.clientOrgnr}
                        onChange={(e) => handleInputChange('clientOrgnr', e.target.value)}
                        helperText="Fra BRREG-validering"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Adresse"
                        value={contractData.clientAddress}
                        onChange={(e) => handleInputChange('clientAddress', e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Button variant="contained" 
                        onClick={() => setActiveStep(1)}
                        disabled={!contractData.clientName || !contractData.clientEmail}
                        sx={{ backgroundColor: professionConfig.colors.primary }}
                      >
                        Neste: Prosjektdetaljer
                      </Button>
                    </Grid>
                  </Grid>
               )}

                {index === 1 && (
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Prosjekttype</InputLabel>
                        <Select
                          value={contractData.projectType}
                          label="Prosjekttype"
                          onChange={(e) => handleInputChange('projectType', e.target.value)}
                        >
                          {professionConfig.projectTypes.map((type) => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="Dato for arrangement"
                        type="date"
                        value={contractData.eventDate}
                        onChange={(e) => handleInputChange('eventDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Prosjektbeskrivelse"
                        value={contractData.projectDescription}
                        onChange={(e) => handleInputChange('projectDescription', e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="Total beløp (NOK)"
                        type="number"
                        value={contractData.totalAmount}
                        onChange={(e) => handleInputChange('totalAmount', Number(e.target.value))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }} md={6}>
                      <TextField
                        fullWidth
                        label="Forskudd (NOK)"
                        type="number"
                        value={contractData.depositAmount}
                        onChange={(e) => handleInputChange('depositAmount', Number(e.target.value))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={contractData.vatIncluded}
                            onChange={(e) => handleInputChange('vatIncluded', e.target.checked)}
                          />
                      }
                        label="Inkludert 25% MVA"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={contractData.digitalSigningRequired}
                            onChange={(e) => handleInputChange('digitalSigningRequired', e.target.checked)}
                          />
                      }
                        label="Krever digital signering (EU eIDAS)"
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ display: 'flex', gap:  2 }}>
                        <Button onClick={() => setActiveStep(0)}>
                          Tilbake
                        </Button>
                        <Button variant="contained" 
                          onClick={handleGenerateContract}
                          disabled={isGenerating}
                          sx={{ backgroundColor: professionConfig.colors.primary }}
                         sx={theming.getThemedButtonSx()}>
                          {isGenerating ? 'Genererer...' : 'Generer kontrakt'}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                )}

                {index === 2 && generatedContract && (
                  <Box>
                    <Alert severity="success" sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CheckCircleIcon sx={{ mr:  1 }} />
                        Kontrakt generert med ID: {generatedContract.d}
                      </Box>
                    </Alert>
                    
                    <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f8f9fa' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        📄 Kontraktsammendrag
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs:  6 }}>
                          <Typography variant="body2">
                            <strong>Klient: </strong> {contractData.clientName}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs:  6 }}>
                          <Typography variant="body2">
                            <strong>Type: </strong> {contractData.projectType}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs:  6 }}>
                          <Typography variant="body2">
                            <strong>Total: </strong> {contractData.totalAmount.toLocaleString(', ')} NOK
                          </Typography>
                        </Grid>
                        <Grid size={{ xs:  6 }}>
                          <Typography variant="body2">
                            <strong>MVA: </strong> {contractData.vatIncluded ? 'Inkludert' : 'Ekskludert'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Button 
                        variant="outlined" 
                        startIcon={<DownloadIcon />}
                        onClick={() => window.open(`/api/contracts/${generatedContract.id}/download`', '_blank')}
                      >
                        Last ned PDF
                      </Button>
                      
                      {contractData.digitalSigningRequired && (
                        <Button variant="contained" 
                          startIcon={<SignatureIcon />}
                          onClick={handleSetupSigning}
                          sx={{ backgroundColor: professionConfig.colors.primary }}
                        >
                          Sett opp digital signering
                        </Button>
                      )}
                      
                      {contractData.driveBackupEnabled && (
                        <Button 
                          variant="outlined" 
                          startIcon={<CloudUploadIcon />}
                          onClick={() => backupToGoogleDrive.mutate(generatedContract.id)}
                        >
                          Sikkerhetskopi til Drive
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}

                {index === 3 && (
                  <Box>
                    <Alert severity="info" sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <SecurityIcon sx={{ mr:  1 }} />
                        EU eIDAS-kompatibel digital signering er satt opp
                      </Box>
                    </Alert>
                    
                    {signingUrl && (
                      <Box sx={{ p: 2, backgroundColor: '#f0f8ff', borderRadius: 1, mb:  2 }}>
                        <Typography variant="body2" gutterBottom>
                          <strong>Signeringslenke for klient: </strong>
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            wordBreak: 'break-all', 
                            fontFamily: 'monospace', 
                            backgroundColor: '#fff',
                            p:  1,
                            borderRadius: 0.5 }}
                        >
                          {signingUrl}
                        </Typography>
                      </Box>
                    )}
                    
                    <Button variant="contained" 
                      startIcon={<SendIcon />}
                      onClick={() => {
                        // Send signing link to client via email
                        const auth = await getAuthHeader();
                        return apiRequest('/api/contracts/send-signing-link', {
                          headers: auth,
        headers: {
    },
        
                          method: 'POST',
                          body: JSON.stringify({
                            contractId: generatedContract.d,
                            clientEmail: contractData.clientEmail,
                            signingUrl
                        })
                      });
                    }}
                      sx={{ backgroundColor: professionConfig.colors.primary }}
                    >
                      Send signeringslenke til klient
                    </Button>
                  </Box>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {isGenerating && (
          <Box sx={{ mt:  2 }}>
            <LinearProgress sx={{ 
              '& .MuiLinearProgress-bar': { 
                backgroundColor: professionConfig.colors.primary 
          }
          }} />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              Genererer kontrakt med norske templates og MVA-beregninger...
            </Typography>
          </Box>
        )}

        {existingContracts.length > 0 && (
          <Box sx={{ mt:  3 }}>
            <Divider sx={{ my:  2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              📋 Eksisterende kontrakter
            </Typography>
            <List>
              {existingContracts.slice(0, 3).map((contract: any) => (
                <ListItem key={contract.d}>
                  <ListItemIcon>
                    <AssignmentIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${contract.clientName} - ${contract.projectType}`}
                    secondary={`${contract.totalAmount?.toLocaleString('no-NO')} NOK - ${contract.status ||'Utkast'}`}
                  />
                  <IconButton 
                    size="small"
                    onClick={() => window.open(`/api/contracts/${contract.id}/download`', '_blank')}
                  >
                    <DownloadIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}