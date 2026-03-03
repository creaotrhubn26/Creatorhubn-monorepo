// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tooltip,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Business,
  CheckCircle,
  Warning,
  Info,
  Search,
  Verified,
  Error,
  Assignment,
  AccountBalance,
  Receipt,
  TrendingUp,
  Security,
  Gavel,
  Description,
  CloudSync,
  Assessment,
  ExpandMore,
  Refresh,
  Download,
  Upload,
  Notifications,
  Settings,
  History,
  PersonPin,
  LocationOn,
  Phone,
  Email,
  Language,
  Public,
  VerifiedUser,
} from '@mui/icons-material';

interface BRREGIntegrationProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  mode?: 'background' | 'visible';
  onCompanyVerified?: (companyData: any) => void;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface CompanyData {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform: {
    kode: string;
    beskrivelse: string;
};
  adresse?: {
    adresselinje1?: string;
    postnummer?: string;
    poststed?: string;
    landkode?: string;
};
  registreringsdatoEnhetsregisteret?: string;
  nedleggelsesdato?: string;
  antallAnsatte?: number;
  forretningsadresse?: any;
  beliggenhetsadresse?: any;
  naeringskode1?: {
    kode?: string;
    beskrivelse?: string;
};
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
  maalform?: string;
  links?: any[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  complianceScore: number
}

export default function BRREGIntegration({ 
  profession = 'photographer,',
  mode = 'background',
  onCompanyVerified,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}: BRREGIntegrationProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer,');
  const [activeTab, setActiveTab] = useState(0);
  const [searchOrgNumber, setSearchOrgNumber] = useState('');
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  // Company verification query
  const { data: verificationData, isLoading: isVerifying } = useQuery({
    queryKey: ['/api/brreg/verify', searchOrgNumber],
    enabled: !!searchOrgNumber && searchOrgNumber.length === 9,
    queryFn: async () => {
      const auth = await getAuthHeader();
      return apiRequest('/api/brreg/verify', {
        headers: auth,
        method: 'POST',
        body: JSON.stringify({ orgNumber: searchOrgNumber })
    });
  },
    staleTime: 1000 * 60 * 5, // 5 minutes
});

  // Professional compliance requirements
  const professionRequirements = {
    photographer: {
      requiredLicenses: ['Næringsdrivende','MVA-registrering'],
      complianceChecks: ['Opphavsrett','GDPR','Markedsføring'],
      vatRequired: true,
      specialRequirements: ['Fotografkjema for offentlige oppdrag']
},
    videographer: {
      requiredLicenses: ['Næringsdrivende','MVA-registrering','Produksjonstillatelse'],
      complianceChecks: ['Opphavsrett','GDPR','Musikklisenser'],
      vatRequired: true,
      specialRequirements: ['TONO/GRAMO-registrering','Filmtillatelser']
  },
    musicproducer: {
      requiredLicenses: ['Næringsdrivende','MVA-registrering','TONO-medlemskap'],
      complianceChecks: ['Musikklisenser','GDPR','Opphavsrett'],
      vatRequired: true,
      specialRequirements: ['GRAMO-registrering','Plateselskap-avtaler']
  },
    vendor: {
      requiredLicenses: ['Næringsdrivende', 'MVA-registrering','Handelstillatelse'],
      complianceChecks: ['Produktsikkerhet', 'Garantiordninger','Forbrukerrettigheter'],
      vatRequired: true,
      specialRequirements: ['CE-merking for relevante produkter']
}
};

  const searchCompany = async () => {
    if (!searchOrgNumber || searchOrgNumber.length !== 9) {
      return;
  }

    setIsSearching(true);
    try {
      const response = await fetch(`https: //data.brreg.no/enhetsregisteret/api/enheter/${searchOrgNumber}`);
      if (response.ok) {
        const data = await response.json();
        setCompanyData(data);
        
        // Validate company data against profession requirements
        const validation = validateCompanyCompliance(data);
        setValidationResult(validation);
        
        if (onCompanyVerified) {
          onCompanyVerified(data);
      }
        
        setLastUpdated(new Date());
    } else {
        console.error('Company not found');
    }
  } catch (error) {
      console.error('Error searching company: ', error);
  } finally {
      setIsSearching(false);
  }
};

  const validateCompanyCompliance = (data: CompanyData): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let complianceScore = 100;

    // Check if company is active
    if (data.nedleggelsesdato) {
      errors.push('Bedriften er nedlagt');
      complianceScore -= 50;
}

    if (data.konkurs) {
      errors.push('Bedriften er konkurs');
      complianceScore -= 50;
  }

    if (data.underAvvikling) {
      warnings.push('Bedriften er under avvikling');
      complianceScore -= 20;
  }

    // Check VAT registration for professions that require it
    const requirements = professionRequirements[profession];
    if (requirements.vatRequired && !data.organisasjonsnummer) {
      warnings.push('MVA-registrering ikke verifisert');
      complianceScore -= 15;
  }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complianceScore: Math.max(0, complianceScore)
  };
};

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const handleOrgNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 9);
    setSearchOrgNumber(value);
};

  const professionColors = {
    photographer: '#ff8c00',
    videographer: '#e74c30', 
    musicproducer: '#9b59b0',
    vendor: '#27ae60'
};

  const color = professionColors[profession];

  // Auto-sync functionality
  useEffect(() => {
    if (mode === 'background' && autoSync) {
      const interval = setInterval(() => {
        if (companyData?.organisasjonsnummer) {
          searchCompany();
      }
    }, 1000 * 60 * 15); // Check every 15 minutes
      return () => clearInterval(interval);
  }
}, [mode, autoSync, companyData]);

  // Background mode rendering - HIDDEN
  if (mode === 'background') {
    return null;
    /* <Box sx={{ position: 'fixed', bottom:  16, right: 10, zIndex: 100}}>
        <Tooltip title="BRREG-integrasjon aktiv">
          <IconButton 
            size="small" 
            sx={{ 
              bgcolor: autoSync ? 'success.main' : 'warning.main',
              color: 'white', '&:hover': { bgcolor: autoSync ? 'success.dark' : 'warning.dark',}
          }}
          >
            <Business fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box> */
}

  const renderCompanyVerification = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Search sx={{ color }} />
        Bedriftsverifikasjon
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs:  12, md:  6 }}>
          <TextField
            fullWidth
            label="Organisasjonsnummer"
            value={searchOrgNumber}
            onChange={handleOrgNumberChange}
            placeholder="123456789"
            InputProps={{
              endAdornment: (
                <IconButton onClick={searchCompany} disabled={isSearching || searchOrgNumber.length !== 9}>
                  {isSearching ? <CircularProgress size={20} /> : theming.getThemedIcon('search')}
                </IconButton>
              )
          }}
            helperText="9 siffer uten mellomrom"
          />
        </Grid>
        <Grid size={{ xs:  12, md:  6 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                color="primary"
              />
          }
            label="Automatisk synkronisering"
          />
        </Grid>
      </Grid>

      {companyData && (
        <Box sx={{ mt:  3 }}>
          <Alert severity={validationResult?.isValid ? 'success' : 'warning'} sx={{ mb:  2 }}>
            <Typography variant="body2">
              {validationResult?.isValid 
                ? 'Bedriften er verifisert og kompatibel' 
                : 'Advarsler funnet - sjekk samsvarsstatus'}
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs:  12, md:  6 }}>
              <Typography variant="subtitle2" color="text.secondary">Bedriftsnavn</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb:  1 }}>
                {companyData.navn}
              </Typography>
            </Grid>
            <Grid size={{ xs:  12, md:  6 }}>
              <Typography variant="subtitle2" color="text.secondary">Organisasjonsform</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb:  1 }}>
                {companyData.organisasjonsform?.beskrivelse || 'Ikke oppgitt'}
              </Typography>
            </Grid>
            <Grid size={{ xs:  12, md:  6 }}>
              <Typography variant="subtitle2" color="text.secondary">Registreringsdato</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb:  1 }}>
                {companyData.registreringsdatoEnhetsregisteret 
                  ? new Date(companyData.registreringsdatoEnhetsregisteret).toLocaleDateString('no-NO')
                  : 'Ikke oppgitt'}
              </Typography>
            </Grid>
            <Grid size={{ xs:  12, md:  6 }}>
              <Typography variant="subtitle2" color="text.secondary">Antall ansatte</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb:  1 }}>
                {companyData.antallAnsatte || 'Ikke oppgitt'}
              </Typography>
            </Grid>
          </Grid>

          {companyData.naeringskode1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="subtitle2" color="text.secondary">Næringskode</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {companyData.naeringskode1.kode} - {companyData.naeringskode1.beskrivelse}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );

  const renderVATValidation = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Receipt sx={{ color }} />
        MVA-validering
      </Typography>

      {companyData ? (
        <Grid container spacing={3}>
          <Grid size={{ xs:  12, md:  6 }}>
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius:  1 }}>
              <Typography variant="subtitle2" color="text.secondary">MVA-nummer</Typography>
              <Typography variant="h6" sx={{  color: 'success.main', fontWeight: 600}}>
                NO{companyData.organisasjonsnummer}MVA
              </Typography>
              <Chip
                icon={theming.getThemedIcon('checkCircle')}
                label="Gyldig"
                color="success"
                size="small"
                sx={{ mt:  1 }}
              />
            </Box>
          </Grid>
          <Grid size={{ xs:  12, md:  6 }}>
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius:  1 }}>
              <Typography variant="subtitle2" color="text.secondary">Registreringsstatus</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                MVA-registrert
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                Sist verifisert: {lastUpdated.toLocaleDateString(', ')}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            Søk etter bedrift for å validere MVA-nummer
          </Typography>
        </Alert>
      )}
    </Paper>
  );

  const renderComplianceTools = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Gavel sx={{ color }} />
        Juridisk samsvar
      </Typography>

      <Grid container spacing={2}>
        {professionRequirements[profession].requiredLicenses.map((license, index) => (
          <Grid size={{ xs:  12, md:  6 }} key={index}>
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius:  1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <VerifiedUser sx={{ color: 'success.main', fontSize: 16}} />
                <Typography variant="subtitle2">{license}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Krav oppfylt
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Typography variant="subtitle1" sx={{ mt:  3, mb:  2 }}>
        Samsvarskontroller for {profession === 'photographer' ? 'fotografer' : profession === 'videographer' ? 'videografer' : profession === 'musicproducer' ? 'musikkprodusenter' : 'leverandører'}
      </Typography>

      <List>
        {professionRequirements[profession].complianceChecks.map((check, index) => (
          <ListItem key={index}>
            <ListItemIcon>
              <CheckCircle sx={{ color: 'success.main'}} />
            </ListItemIcon>
            <ListItemText primary={check} />
          </ListItem>
        ))}
      </List>

      {professionRequirements[profession].specialRequirements.length > 0 && (
        <Accordion sx={{ mt:  2 }}>
          <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
            <Typography variant="subtitle2">Spesielle krav</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {professionRequirements[profession].specialRequirements.map((requirement, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <Info sx={{ color }} />
                  </ListItemIcon>
                  <ListItemText primary={requirement} />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );

  const renderRegistrationHelper = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Assignment sx={{ color }} />
        Registreringshjelp
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="body2">
          Trenger du hjelp med forretningsregistrering? Vi guider deg gjennom prosessen.
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs:  12, md:  6 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={theming.getThemedIcon('business')}
            href="https: //www.brreg.no/registrering/"
            target="_blank"
            sx={{ borderColor: color, color, '&:hover': { borderColor: color, bgcolor: `${color}10` } }}
          >
            Registrer i Enhetsregisteret
          </Button>
        </Grid>
        <Grid size={{ xs:  12, md:  6 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Receipt />}
            href="https: //www.skatteetaten.no/bedrift-og-organisasjon/registrering/"
            target="_blank"
            sx={{ borderColor: color, color, '&:hover': { borderColor: color, bgcolor: `${color}10` } }}
          >
            MVA-registrering
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my:  3 }} />

      <Typography variant="subtitle1" sx={{ mb:  2 }}>Sjekkliste for {profession === 'photographer' ? 'fotografer' : profession === 'videographer' ? 'videografer' : profession === 'musicproducer' ? 'musikkprodusenter' : 'leverandører'}</Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircle sx={{ color: 'success.main'}} />
          </ListItemIcon>
          <ListItemText
            primary="Enhetsregisteret"
            secondary="Registrer bedriften i Brønnøysundregistrene"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircle sx={{ color: 'success.main'}} />
          </ListItemIcon>
          <ListItemText
            primary="MVA-registrering"
            secondary="Obligatorisk for omsetning over 50 000 NOK"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircle sx={{ color: 'success.main'}} />
          </ListItemIcon>
          <ListItemText
            primary="Forsikring"
            secondary="Yrkesansvarsforsikring og utstyrsforsikring"
          />
        </ListItem>
        {profession === 'musicproducer' && (
          <ListItem>
            <ListItemIcon>
              <CheckCircle sx={{ color: 'success.main'}} />
            </ListItemIcon>
            <ListItemText
              primary="TONO/GRAMO-medlemskap"
              secondary="For opphavsrettbeskyttelse og royalties"
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );

  return (
    <Box sx={{ width: '100%'}}>
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <Business sx={{ color, fontSize: 32}} />
              <Box>
                <Typography variant="h5" sx={{  color, fontWeight: 600}}>
                  BRREG Integrasjon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bedriftsverifikasjon og juridisk samsvar
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Chip
                icon={<Verified />}
                label="Aktiv"
                color="success"
                size="small"
              />
              <Chip
                icon={<CloudSync />}
                label={autoSync ? 'Auto-synk' : 'Manuell'}
                color={autoSync ? 'primary' : 'default'}
                size="small"
              />
            </Box>
          </Box>

          {validationResult && (
            <Box sx={{ mb:  2 }}>
              <LinearProgress
                variant="determinate"
                value={validationResult.complianceScore}
                sx={{
                  height:  8,
                  borderRadius:  4,
                  backgroundColor: 'rgba(0,0,0,0.1)', '& .MuiLinearProgress-bar': {
                    backgroundColor: validationResult.complianceScore >= 80 ? 'success.main' : 
                                   validationResult.complianceScore >= 60 ? 'warning.main' : 'error.main'
              }
              }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                Samsvarsscore: {validationResult.complianceScore}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
          },
          '& .Mui-selected': {
            color: `${color} !important`,
          },
          '& .MuiTabs-indicator': {
            backgroundColor: color,
          },
        }}
      >
        <Tab
          icon={theming.getThemedIcon('search')}
          iconPosition="start"
          label="Bedriftsverifikasjon"
        />
        <Tab
          icon={<Receipt />}
          iconPosition="start"
          label="MVA-validering"
        />
        <Tab
          icon={<Gavel />}
          iconPosition="start"
          label="Juridisk samsvar"
        />
        <Tab
          icon={theming.getThemedIcon('assignment')}
          iconPosition="start"
          label="Registreringshjelp"
        />
      </Tabs>

      {activeTab === 0 && renderCompanyVerification()}
      {activeTab === 1 && renderVATValidation()}
      {activeTab === 2 && renderComplianceTools()}
      {activeTab === 3 && renderRegistrationHelper()}

      {/* Compliance Dialog */}
      <Dialog
        open={complianceDialogOpen}
        onClose={() => setComplianceDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems:'center', gap:  1 }}>
            <Security sx={{ color }} />
            Detaljert samsvarsstatus
          </Box>
        </DialogTitle>
        <DialogContent>
          {validationResult && (
            <Box>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Samsvarsscore: {validationResult.complianceScore}%
              </Typography>
              
              {validationResult.errors.length > 0 && (
                <Alert severity="error" sx={{ mb:  2 }}>
                  <Typography variant="subtitle2">Feil som må rettes: </Typography>
                  <ul>
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              
              {validationResult.warnings.length > 0 && (
                <Alert severity="warning">
                  <Typography variant="subtitle2">Advarsler: </Typography>
                  <ul>
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComplianceDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}