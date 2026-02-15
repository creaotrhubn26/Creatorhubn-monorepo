/**
 * ConsentContractDialog - Professional consent contract creation and sending system
 * 
 * GDPR-compliant according to datatilsynet.no guidelines:
 * - Frivillig (voluntary)
 * - Spesifikt (specific purposes with separate consent options)
 * - Informert (informed about rights, data controller, purposes)
 * - Utvetydig (unambiguous through active action)
 * - Dokumenterbart (documented)
 * - Mulig å trekke tilbake (easy to withdraw)
 * 
 * Åndsverkloven § 104 compliant for photos/video:
 * - Portrait photos require consent
 * - Minor consent with parental approval
 * - Specific channel/purpose consent
 * 
 * Features:
 * - Beautiful professional contract preview with logo and branding
 * - Multiple consent types (Photo, Video, Audio, Location, Minor)
 * - GDPR-compliant usage rights checkboxes
 * - Publication channel selection
 * - Retention period settings
 * - Digital signature capability
 * - Email/SMS sending options
 * - Access code generation for remote signing
 * - Contract PDF generation
 */

import { useState, useRef, useEffect } from 'react';
import type { ComponentType, CSSProperties } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Stack,
  Chip,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
  InputAdornment,
  Collapse,
  Switch,
  Radio,
  RadioGroup,
  FormLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Description as DocumentIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  Lock as LockIcon,
  VerifiedUser as VerifiedIcon,
  PhotoCamera as PhotoIcon,
  Videocam as VideoIcon,
  Mic as AudioIcon,
  LocationOn as LocationIcon,
  ChildCare as MinorIcon,
  MoreHoriz as OtherIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  QrCode2 as QrCodeIcon,
  ExpandMore as ExpandMoreIcon,
  Web as WebIcon,
  Print as PrintIcon,
  Public as PublicIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  YouTube as YouTubeIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Gavel as GavelIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { ConsentsIcon } from './icons/CastingIcons';
import { Consent, ConsentType, Candidate, CastingProject, ConsentInvitationStatus } from '../models/casting';
import { consentService } from '../services/consentService';

// TikTok icon (not available in MUI)
const TikTokIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// WCAG 2.2 compliant touch target size
const TOUCH_TARGET_SIZE = 44;

interface ConsentContractDialogProps {
  open: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  project: CastingProject | null;
  existingConsent?: Consent | null;
  onConsentSent?: (consent: Consent) => void;
  onConsentUpdated?: () => void;
}

// GDPR-compliant usage rights structure
interface UsageRights {
  // Produksjonsformål
  productionUse: boolean;           // Bruk i selve produksjonen
  promotionalUse: boolean;          // Markedsføring av produksjonen
  behindTheScenes: boolean;         // Making-of / bak kulissene
  
  // Publiseringskanaler
  webPublishing: boolean;           // Åpen nettside
  passwordProtectedWeb: boolean;    // Passordbeskyttet nettside
  internalUse: boolean;             // Kun intern bruk
  
  // Sosiale medier
  socialMedia: {
    enabled: boolean;
    instagram: boolean;
    facebook: boolean;
    youtube: boolean;
    tiktok: boolean;
    linkedin: boolean;
    twitter: boolean;
    other: boolean;
  };
  
  // Trykte medier
  printMedia: boolean;              // Trykksaker
  pressRelease: boolean;            // Pressemelding
  
  // Spesifikke rettigheter
  editingAllowed: boolean;          // Tillater redigering/beskjæring
  nameCredit: boolean;              // Navnekreditering tillatt
  voiceoverUse: boolean;            // Bruk av stemme
  
  // Geografisk omfang
  territoryWorldwide: boolean;      // Verdensomspennende
  territoryNordic: boolean;         // Kun Norden
  territoryNorway: boolean;         // Kun Norge
}

// Data retention settings
interface RetentionSettings {
  retentionPeriod: 'project_duration' | '1_year' | '3_years' | '5_years' | 'indefinite' | 'custom';
  customPeriodMonths?: number;
  deleteAfterProject: boolean;
  archiveAfterUse: boolean;
}

// GDPR compliance settings
interface GDPRSettings {
  dataController: string;           // Behandlingsansvarlig
  dataControllerContact: string;    // Kontaktinfo behandlingsansvarlig
  purpose: string;                  // Formål med behandlingen
  legalBasis: 'consent' | 'legitimate_interest' | 'contract';
  thirdPartySharing: boolean;       // Deling med tredjeparter
  thirdPartyDetails: string;        // Hvem deles data med
  transferOutsideEEA: boolean;      // Overføring utenfor EØS
  transferDetails: string;          // Detaljer om overføring
  automatedDecisions: boolean;      // Automatiserte beslutninger
  withdrawalInfo: string;           // Info om tilbaketrekning
}

// Production type settings - for film, reklame, TV etc.
type ProductionType = 'feature_film' | 'short_film' | 'documentary' | 'tv_drama' | 'tv_series' | 'tv_entertainment' | 'commercial' | 'music_video' | 'corporate' | 'streaming' | 'student_film' | 'dubbing' | 'other';
type MaterialSource = 'set_photos' | 'bts_footage' | 'audition_tape' | 'production_stills' | 'promotional' | 'casting_photos';

// Simplified production settings - union/tariff agreements moved to Split Sheet system
interface ProductionSettings {
  productionType: ProductionType;
  productionTypeOther?: string;
  materialSources: MaterialSource[];
}

// Production type labels
const productionTypeLabels: Record<ProductionType, string> = {
  feature_film: 'Spillefilm (kino)',
  short_film: 'Kortfilm',
  documentary: 'Dokumentar',
  tv_drama: 'TV-drama',
  tv_series: 'TV-serie',
  tv_entertainment: 'TV-underholdning',
  commercial: 'Reklamefilm',
  music_video: 'Musikkvideo',
  corporate: 'Bedriftsfilm',
  streaming: 'Strømmeproduksjon (Netflix, etc.)',
  student_film: 'Studentfilm/Filmskole',
  dubbing: 'Dubbing/versjonering',
  other: 'Annet',
};

// Material source labels
const materialSourceLabels: Record<MaterialSource, string> = {
  set_photos: 'Stillbilder fra innspilling (filmfotograf)',
  bts_footage: 'Behind-the-scenes video',
  audition_tape: 'Audition-opptak (selvtape/video)',
  production_stills: 'Produksjonsstillbilder (scene/acting)',
  promotional: 'Promomateriell/markedsføring',
  casting_photos: 'Casting-bilder/headshots',
};

// Legal references - kilder
const legalReferences = {
  gdpr: {
    name: 'GDPR (Personvernforordningen)',
    url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38',
    description: 'EUs personvernforordning, implementert i norsk lov',
  },
  personopplysningsloven: {
    name: 'Personopplysningsloven',
    url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38',
    description: 'Norsk lov om behandling av personopplysninger',
  },
  åndsverkloven: {
    name: 'Åndsverkloven § 104',
    url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-40/KAPITTEL_7#%C2%A7104',
    description: 'Retten til eget bilde - portrettfoto krever samtykke',
  },
  datatilsynet: {
    name: 'Datatilsynet - Samtykke',
    url: 'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/behandlingsgrunnlag/samtykke/',
    description: 'Krav til gyldig samtykke: frivillig, spesifikt, informert, utvetydig',
  },
  datatilsynetBilde: {
    name: 'Datatilsynet - Bilder',
    url: 'https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/bilder-pa-nett/',
    description: 'Regler for bruk av bilder og video',
  },
  // Note: NSF/NFF tariff agreements moved to Split Sheet system for rights/compensation
};

// Minor consent settings
interface MinorConsentSettings {
  isMinor: boolean;
  minorAge?: number;
  guardianName: string;
  guardianRelation: 'parent' | 'guardian' | 'other';
  guardianContact: string;
  minorCanCoSign: boolean;          // For barn 13+
}

// Icon component type for consent types
type IconComponent = ComponentType<{ style?: CSSProperties }>;

// Consent type configuration
const consentTypeConfig: Record<ConsentType, {
  IconComponent: IconComponent;
  label: string;
  description: string;
  color: string;
  defaultTitle: string;
}> = {
  photo_release: {
    IconComponent: PhotoIcon,
    label: 'Foto-samtykke',
    description: 'Tillater bruk av fotografier tatt under produksjonen',
    color: '#00d4ff',
    defaultTitle: 'Samtykke for bruk av fotografier',
  },
  video_release: {
    IconComponent: VideoIcon,
    label: 'Video-samtykke',
    description: 'Tillater bruk av video-opptak fra produksjonen',
    color: '#10b981',
    defaultTitle: 'Samtykke for bruk av video-opptak',
  },
  audio_release: {
    IconComponent: AudioIcon,
    label: 'Lyd-samtykke',
    description: 'Tillater bruk av lyd-opptak og stemme',
    color: '#8b5cf6',
    defaultTitle: 'Samtykke for bruk av lyd-opptak',
  },
  location_release: {
    IconComponent: LocationIcon,
    label: 'Lokasjon-samtykke',
    description: 'Tillatelse for filming på angitt lokasjon',
    color: '#f59e0b',
    defaultTitle: 'Samtykke for filming på lokasjon',
  },
  minor_consent: {
    IconComponent: MinorIcon,
    label: 'Mindreårig-samtykke',
    description: 'Foresattes samtykke for mindreårig deltaker',
    color: '#ec4899',
    defaultTitle: 'Foresattes samtykke for mindreårig',
  },
  other: {
    IconComponent: OtherIcon,
    label: 'Annet samtykke',
    description: 'Egendefinert samtykketype',
    color: '#6b7280',
    defaultTitle: 'Generelt samtykke',
  },
};

export function ConsentContractDialog({
  open,
  onClose,
  candidate,
  project,
  existingConsent,
  onConsentSent,
  onConsentUpdated,
}: ConsentContractDialogProps) {
  // Stepper state
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Velg type', 'Tilpass kontrakt', 'Send'];

  // Form state
  const [consentType, setConsentType] = useState<ConsentType>('photo_release');
  const [customTitle, setCustomTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [includePin, setIncludePin] = useState(false);
  const [pin, setPin] = useState('');
  const [expiresDays, setExpiresDays] = useState(30);
  const [sendMethod, setSendMethod] = useState<'email' | 'sms' | 'link'>('email');
  
  // GDPR-compliant usage rights state
  const [usageRights, setUsageRights] = useState<UsageRights>({
    productionUse: true,
    promotionalUse: false,
    behindTheScenes: false,
    webPublishing: false,
    passwordProtectedWeb: false,
    internalUse: true,
    socialMedia: {
      enabled: false,
      instagram: false,
      facebook: false,
      youtube: false,
      tiktok: false,
      linkedin: false,
      twitter: false,
      other: false,
    },
    printMedia: false,
    pressRelease: false,
    editingAllowed: true,
    nameCredit: true,
    voiceoverUse: false,
    territoryWorldwide: false,
    territoryNordic: false,
    territoryNorway: true,
  });

  // Retention settings state
  const [retentionSettings, setRetentionSettings] = useState<RetentionSettings>({
    retentionPeriod: 'project_duration',
    deleteAfterProject: false,
    archiveAfterUse: true,
  });

  // GDPR settings state
  const [gdprSettings, setGdprSettings] = useState<GDPRSettings>({
    dataController: '',
    dataControllerContact: '',
    purpose: '',
    legalBasis: 'consent',
    thirdPartySharing: false,
    thirdPartyDetails: '',
    transferOutsideEEA: false,
    transferDetails: '',
    automatedDecisions: false,
    withdrawalInfo: 'Du kan når som helst trekke tilbake ditt samtykke ved å kontakte oss på e-post eller telefon. Tilbaketrekning påvirker ikke lovligheten av behandling basert på samtykke før tilbaketrekningen.',
  });

  // Minor consent settings
  const [minorSettings, setMinorSettings] = useState<MinorConsentSettings>({
    isMinor: false,
    guardianName: '',
    guardianRelation: 'parent',
    guardianContact: '',
    minorCanCoSign: false,
  });

  // Production settings state (simplified - tariff agreements in Split Sheet)
  const [productionSettings, setProductionSettings] = useState<ProductionSettings>({
    productionType: 'feature_film',
    materialSources: ['set_photos'],
  });

  // Show legal references
  const [showLegalReferences, setShowLegalReferences] = useState(false);

  // Expanded accordion state for Step 2
  const [expandedSection, setExpandedSection] = useState<string | false>('production');
  
  // UI state
  const [sending, setSending] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Company info state (would be loaded from project settings)
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setConsentType(existingConsent?.type || 'photo_release');
      setCustomTitle(existingConsent?.title || '');
      setDescription(existingConsent?.description || '');
      setNotes(existingConsent?.notes || '');
      setIncludePin(!!existingConsent?.pin);
      setPin(existingConsent?.pin || '');
      setExpiresDays(30);
      setSendMethod('email');
      setGeneratedCode(existingConsent?.accessCode || '');
      setError(null);
      setSuccess(false);
      setPreviewMode(false);
      setExpandedSection('usage');
      
      // Reset usage rights to defaults
      setUsageRights({
        productionUse: true,
        promotionalUse: false,
        behindTheScenes: false,
        webPublishing: false,
        passwordProtectedWeb: false,
        internalUse: true,
        socialMedia: {
          enabled: false,
          instagram: false,
          facebook: false,
          youtube: false,
          tiktok: false,
          linkedin: false,
          twitter: false,
          other: false,
        },
        printMedia: false,
        pressRelease: false,
        editingAllowed: true,
        nameCredit: true,
        voiceoverUse: false,
        territoryWorldwide: false,
        territoryNordic: false,
        territoryNorway: true,
      });

      // Reset retention settings
      setRetentionSettings({
        retentionPeriod: 'project_duration',
        deleteAfterProject: false,
        archiveAfterUse: true,
      });

      // Set GDPR settings from project
      setGdprSettings({
        dataController: project?.name || '',
        dataControllerContact: '',
        purpose: `Innhenting av samtykke for bruk av ${consentType === 'photo_release' ? 'fotografier' : consentType === 'video_release' ? 'video-opptak' : 'materiale'} i forbindelse med prosjektet "${project?.name || 'Produksjon'}"`,
        legalBasis: 'consent',
        thirdPartySharing: false,
        thirdPartyDetails: '',
        transferOutsideEEA: false,
        transferDetails: '',
        automatedDecisions: false,
        withdrawalInfo: 'Du kan når som helst trekke tilbake ditt samtykke ved å kontakte oss på e-post eller telefon. Tilbaketrekning påvirker ikke lovligheten av behandling basert på samtykke før tilbaketrekningen.',
      });

      // Reset minor settings
      setMinorSettings({
        isMinor: consentType === 'minor_consent',
        guardianName: '',
        guardianRelation: 'parent',
        guardianContact: '',
        minorCanCoSign: false,
      });

      // Reset production settings (simplified - tariff agreements in Split Sheet)
      setProductionSettings({
        productionType: 'feature_film',
        materialSources: ['set_photos'],
      });
      setShowLegalReferences(false);
      
      // Load company info from project
      if (project) {
        setCompanyName(project.name || 'Produksjonsselskap');
      }
    }
  }, [open, existingConsent, project, consentType]);

  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCopyLink = () => {
    const portalUrl = `${window.location.origin}/consent-portal?consent_code=${generatedCode}`;
    navigator.clipboard.writeText(portalUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleGenerateAndSend = async () => {
    if (!candidate || !project) {
      setError('Mangler kandidat eller prosjekt informasjon');
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Create or update consent
      let consent: Consent;
      
      if (existingConsent) {
        consent = {
          ...existingConsent,
          type: consentType,
          title: customTitle || consentTypeConfig[consentType].defaultTitle,
          description: description || consentTypeConfig[consentType].description,
          notes,
          updatedAt: new Date().toISOString(),
        };
        await consentService.updateConsent(project.id, candidate.id, consent);
      } else {
        const newConsent = await consentService.createConsent(
          project.id,
          candidate.id,
          consentType,
          customTitle || consentTypeConfig[consentType].defaultTitle
        );
        
        if (!newConsent) {
          throw new Error('Kunne ikke opprette samtykke');
        }
        
        consent = {
          ...newConsent,
          description: description || consentTypeConfig[consentType].description,
          notes,
        };
        await consentService.updateConsent(project.id, candidate.id, consent);
      }

      // Generate access code
      const response = await fetch('/api/consent/generate-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentId: consent.id,
          pin: includePin ? pin : null,
          expiresDays,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedCode(data.accessCode);
        
        // Update consent with invitation status
        consent.accessCode = data.accessCode;
        consent.invitationStatus = 'sent' as ConsentInvitationStatus;
        consent.invitationSentAt = new Date().toISOString();
        if (includePin) consent.pin = pin;
        
        await consentService.updateConsent(project.id, candidate.id, consent);

        // Send notification based on method
        if (sendMethod === 'email' && candidate.contactInfo.email) {
          // Would integrate with email service
          console.log('Sending email to:', candidate.contactInfo.email);
        } else if (sendMethod === 'sms' && candidate.contactInfo.phone) {
          // Would integrate with SMS service
          console.log('Sending SMS to:', candidate.contactInfo.phone);
        }

        setSuccess(true);
        
        if (onConsentSent) {
          onConsentSent(consent);
        }
        
        if (onConsentUpdated) {
          onConsentUpdated();
        }
      } else {
        throw new Error(data.error || 'Kunne ikke generere tilgangskode');
      }
    } catch (err) {
      console.error('Error sending consent:', err);
      setError(err instanceof Error ? err.message : 'En feil oppstod');
    } finally {
      setSending(false);
    }
  };

  const config = consentTypeConfig[consentType];
  const effectiveTitle = customTitle || config.defaultTitle;

  // Contract preview content - GDPR compliant
  const ContractPreview = () => {
    // Helper to get selected social media channels
    const getSelectedSocialMedia = () => {
      if (!usageRights.socialMedia.enabled) return [];
      const channels = [];
      if (usageRights.socialMedia.instagram) channels.push('Instagram');
      if (usageRights.socialMedia.facebook) channels.push('Facebook');
      if (usageRights.socialMedia.youtube) channels.push('YouTube');
      if (usageRights.socialMedia.tiktok) channels.push('TikTok');
      if (usageRights.socialMedia.linkedin) channels.push('LinkedIn');
      if (usageRights.socialMedia.twitter) channels.push('X (Twitter)');
      return channels;
    };

    // Helper to get territory text
    const getTerritoryText = () => {
      if (usageRights.territoryWorldwide) return 'Verdensomspennende';
      if (usageRights.territoryNordic) return 'Norden (Norge, Sverige, Danmark, Finland, Island)';
      return 'Norge';
    };

    // Helper to get retention text
    const getRetentionText = () => {
      switch (retentionSettings.retentionPeriod) {
        case 'project_duration': return 'Prosjektets varighet';
        case '1_year': return '1 år';
        case '3_years': return '3 år';
        case '5_years': return '5 år';
        case 'indefinite': return 'Uten tidsbegrensning';
        case 'custom': return `${retentionSettings.customPeriodMonths || 0} måneder`;
        default: return 'Ikke spesifisert';
      }
    };

    // Helper to get material sources text
    const getMaterialSourcesText = () => {
      return productionSettings.materialSources.map(s => materialSourceLabels[s]).join(', ');
    };

    return (
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#fff',
          color: '#1c2128',
          borderRadius: 2,
          overflow: 'hidden',
          maxHeight: 600,
          overflowY: 'auto',
        }}
      >
        {/* Contract Header with Logo */}
        <Box sx={{ 
          p: 4, 
          borderBottom: '2px solid #00d4ff',
          background: 'linear-gradient(135deg, #1c2128 0%, #2d3748 100%)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {companyLogo ? (
                <Box
                  component="img"
                  src={companyLogo}
                  alt={companyName}
                  sx={{ height: 48, width: 'auto' }}
                />
              ) : (
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: config.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ConsentsIcon sx={{ color: '#fff', fontSize: 28 }} />
                </Box>
              )}
              <Box>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                  {gdprSettings.dataController || companyName || project?.name || 'Produksjonsselskap'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Samtykkekontrakt
                </Typography>
              </Box>
            </Box>
            <Chip
              icon={<config.IconComponent style={{ color: '#fff', fontSize: 16 }} />}
              label={config.label}
              sx={{
                bgcolor: config.color,
                color: '#fff',
                fontWeight: 600,
                '& .MuiChip-icon': { color: '#fff' },
              }}
            />
          </Box>
          
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, textAlign: 'center' }}>
            {effectiveTitle}
          </Typography>
        </Box>

        {/* Contract Body */}
        <Box sx={{ p: 4 }}>
          {/* GDPR Notice */}
          <Box sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: '#f0f9ff', 
            borderRadius: 1, 
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
          }}>
            <GavelIcon sx={{ color: '#0284c7', fontSize: 20, mt: 0.3 }} />
            <Box>
              <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 600, mb: 0.5 }}>
                Juridisk grunnlag
              </Typography>
              <Typography variant="caption" sx={{ color: '#0c4a6e', lineHeight: 1.5, display: 'block' }}>
                Dette samtykket er utformet i henhold til:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, '& li': { color: '#0c4a6e', fontSize: '0.7rem', lineHeight: 1.4 } }}>
                <li><strong>GDPR</strong> (EUs personvernforordning) og <strong>Personopplysningsloven</strong></li>
                <li><strong>Åndsverkloven § 104</strong> - Retten til eget bilde</li>
                <li><strong>Datatilsynets veileder</strong> for samtykke til bilder/video</li>
              </Box>
              <Typography variant="caption" sx={{ color: '#0369a1', mt: 1, display: 'block' }}>
                Du har rett til å trekke tilbake samtykket når som helst.
              </Typography>
            </Box>
          </Box>

          {/* Production Info Section */}
          <Box sx={{ mb: 4, p: 2, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #fcd34d' }}>
            <Typography variant="subtitle2" sx={{ color: '#92400e', fontWeight: 600, mb: 1.5 }}>
              Produksjonsinformasjon
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 600 }}>Type produksjon:</Typography>
                <Typography variant="body2" sx={{ color: '#451a03' }}>
                  {productionTypeLabels[productionSettings.productionType]}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 600 }}>Materialet gjelder:</Typography>
                <Typography variant="body2" sx={{ color: '#451a03' }}>
                  {getMaterialSourcesText() || 'Ikke spesifisert'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Parties Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
              Parter
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Behandlingsansvarlig
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {gdprSettings.dataController || project?.name || 'Produksjonsselskap'}
                </Typography>
                {gdprSettings.dataControllerContact && (
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                    {gdprSettings.dataControllerContact}
                  </Typography>
                )}
              </Box>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {minorSettings.isMinor ? 'Deltaker (mindreårig)' : 'Deltaker'}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {candidate?.name || 'Navn'}
                </Typography>
                {candidate?.contactInfo.email && (
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    {candidate.contactInfo.email}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Guardian info for minors */}
            {minorSettings.isMinor && minorSettings.guardianName && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #fcd34d' }}>
                <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Foresatt / Verge
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, color: '#78350f' }}>
                  {minorSettings.guardianName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#92400e' }}>
                  {minorSettings.guardianRelation === 'parent' ? 'Forelder' : minorSettings.guardianRelation === 'guardian' ? 'Verge' : 'Foresatt'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Description/Purpose */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
              Formål med behandlingen
            </Typography>
            <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.7 }}>
              {description || config.description}
            </Typography>
          </Box>

          {/* Usage Rights - What the consent covers */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
              Hva samtykket omfatter
            </Typography>
            
            {/* Production use */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>
                Bruksformål:
              </Typography>
              <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 0.5 } }}>
                {usageRights.productionUse && <li>Bruk i produksjonen «{project?.name || 'Prosjektnavn'}»</li>}
                {usageRights.promotionalUse && <li>Markedsføring av produksjonen</li>}
                {usageRights.behindTheScenes && <li>Making-of / dokumentasjon fra innspilling</li>}
              </Box>
            </Box>

            {/* Publishing channels */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>
                Publiseringskanaler:
              </Typography>
              <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 0.5 } }}>
                {usageRights.internalUse && <li>Intern bruk (ikke offentlig publisert)</li>}
                {usageRights.passwordProtectedWeb && <li>Passordbeskyttet nettside</li>}
                {usageRights.webPublishing && <li>Åpen nettside (offentlig tilgjengelig)</li>}
                {usageRights.printMedia && <li>Trykte materialer (brosjyrer, plakater, etc.)</li>}
                {usageRights.pressRelease && <li>Pressemeldinger og medieomtale</li>}
                {usageRights.socialMedia.enabled && getSelectedSocialMedia().length > 0 && (
                  <li>Sosiale medier: {getSelectedSocialMedia().join(', ')}</li>
                )}
              </Box>
            </Box>

            {/* Territory */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>
                Geografisk omfang:
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                {getTerritoryText()}
              </Typography>
            </Box>

            {/* Special rights */}
            {(usageRights.editingAllowed || usageRights.nameCredit || usageRights.voiceoverUse) && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>
                  Spesielle rettigheter:
                </Typography>
                <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 0.5 } }}>
                  {usageRights.editingAllowed && <li>Redigering og beskjæring av materialet tillatt</li>}
                  {usageRights.nameCredit && <li>Navn kan brukes ved kreditering</li>}
                  {usageRights.voiceoverUse && <li>Stemme kan brukes til voiceover/dubbing</li>}
                </Box>
              </Box>
            )}
          </Box>

          {/* Data Retention */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
              Lagringstid
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              Materialet vil bli lagret i: <strong>{getRetentionText()}</strong>
            </Typography>
            {retentionSettings.deleteAfterProject && (
              <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                Materialet vil bli slettet etter prosjektslutt.
              </Typography>
            )}
          </Box>

          {/* Third party sharing */}
          {gdprSettings.thirdPartySharing && gdprSettings.thirdPartyDetails && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
                Deling med tredjeparter
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                {gdprSettings.thirdPartyDetails}
              </Typography>
            </Box>
          )}

          {/* Transfer outside EEA */}
          {gdprSettings.transferOutsideEEA && (
            <Box sx={{ mb: 4, p: 2, bgcolor: '#fef9c3', borderRadius: 1, border: '1px solid #fde047' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#854d0e', display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon sx={{ fontSize: 18 }} /> Overføring utenfor EØS
              </Typography>
              <Typography variant="body2" sx={{ color: '#713f12' }}>
                {gdprSettings.transferDetails || 'Opplysninger kan overføres til land utenfor EØS-området med tilstrekkelige garantier.'}
              </Typography>
            </Box>
          )}

          {/* Rights Section - Dine rettigheter */}
          <Box sx={{ mb: 4, p: 3, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #86efac' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#166534' }}>
              Dine rettigheter
            </Typography>
            <Box component="ul" sx={{ pl: 2, color: '#166534', '& li': { mb: 1, lineHeight: 1.5 } }}>
              <li><strong>Rett til innsyn:</strong> Du kan be om å få se hvilke opplysninger vi har om deg.</li>
              <li><strong>Rett til retting:</strong> Du kan be om at uriktige opplysninger rettes.</li>
              <li><strong>Rett til sletting:</strong> Du kan be om at opplysningene slettes.</li>
              <li><strong>Rett til å trekke samtykke:</strong> {gdprSettings.withdrawalInfo}</li>
              <li><strong>Rett til å klage:</strong> Du kan klage til Datatilsynet hvis du mener rettighetene dine er krenket.</li>
            </Box>
          </Box>

          {/* Terms */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
              Erklæring
            </Typography>
            <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 1.5, lineHeight: 1.6 } }}>
              <li>Jeg gir herved mitt frivillige samtykke til bruk av {consentType === 'photo_release' ? 'fotografier' : consentType === 'video_release' ? 'video-opptak' : consentType === 'audio_release' ? 'lyd-opptak' : 'materialet'} som beskrevet ovenfor.</li>
              <li>Jeg bekrefter at jeg har mottatt og forstått informasjonen om behandling av mine personopplysninger.</li>
              {minorSettings.isMinor ? (
                <li>Jeg bekrefter at jeg er foresatt/verge for den mindreårige og har myndighet til å gi samtykke på vegne av barnet.</li>
              ) : (
                <li>Jeg bekrefter at jeg har fylt 18 år og har rettslig handleevne til å gi dette samtykket.</li>
              )}
              <li>Jeg forstår at jeg kan trekke dette samtykket tilbake når som helst ved å kontakte behandlingsansvarlig.</li>
            </Box>
          </Box>

          {/* Signature Area */}
          <Box sx={{ 
            mt: 4, 
            pt: 4, 
            borderTop: '1px solid #e2e8f0',
          }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: minorSettings.isMinor && minorSettings.minorCanCoSign ? '1fr 1fr 1fr' : '1fr 1fr', gap: 3 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                  Dato
                </Typography>
                <Box sx={{ 
                  height: 40, 
                  borderBottom: '1px solid #1c2128',
                  display: 'flex',
                  alignItems: 'flex-end',
                  pb: 0.5,
                }}>
                  <Typography variant="body1" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    {new Date().toLocaleDateString('no-NO')}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                  {minorSettings.isMinor ? 'Foresattes signatur' : 'Signatur'}
                </Typography>
                <Box sx={{ 
                  height: 60, 
                  borderBottom: '1px solid #1c2128',
                  bgcolor: '#fef3c7',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Typography variant="body2" sx={{ color: '#92400e', fontStyle: 'italic' }}>
                    [Digital signatur vil vises her]
                  </Typography>
                </Box>
              </Box>
              {minorSettings.isMinor && minorSettings.minorCanCoSign && (
                <Box>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                    Barnets signatur (13+ år)
                  </Typography>
                  <Box sx={{ 
                    height: 60, 
                    borderBottom: '1px solid #1c2128',
                    bgcolor: '#fce7f3',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Typography variant="body2" sx={{ color: '#9d174d', fontStyle: 'italic' }}>
                      [Digital signatur]
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Footer */}
          <Box sx={{ 
            mt: 4, 
            pt: 3, 
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
              <VerifiedIcon sx={{ color: '#10b981', fontSize: 18 }} />
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Sikret med digital signatur via Virtual Studio
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>
              Dokument-ID: {existingConsent?.id || 'Ny kontrakt'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
              Produksjonstype: {productionTypeLabels[productionSettings.productionType]}
            </Typography>
            
            {/* Legal references */}
            <Box sx={{ 
              mt: 2, 
              pt: 2, 
              borderTop: '1px dashed #e2e8f0',
              textAlign: 'left',
              px: 2,
            }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1 }}>
                Juridiske referanser:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                <Chip 
                  label="GDPR" 
                  size="small" 
                  sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#dbeafe', color: '#1e40af' }} 
                />
                <Chip 
                  label="Personopplysningsloven" 
                  size="small" 
                  sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#dbeafe', color: '#1e40af' }} 
                />
                <Chip 
                  label="Åndsverkloven § 104" 
                  size="small" 
                  sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#dcfce7', color: '#166534' }} 
                />
                <Chip 
                  label="Datatilsynet.no" 
                  size="small" 
                  sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#fef3c7', color: '#92400e' }} 
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1, textAlign: 'center', fontSize: '0.6rem' }}>
                Kilder: datatilsynet.no • lovdata.no
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, textAlign: 'center', fontSize: '0.6rem', fontStyle: 'italic' }}>
                Tariffavtaler (NSF/NFF) og vederlagsordninger håndteres i Split Sheet
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  };
return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1c2128',
          color: '#fff',
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
        px: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: config.color + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ConsentsIcon sx={{ color: config.color, fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {existingConsent ? 'Send samtykkekontrakt' : 'Ny samtykkekontrakt'}
            </Typography>
            {candidate && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Til: {candidate.name}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Stepper */}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': {
                      color: index <= activeStep ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontWeight: index === activeStep ? 600 : 400,
                    },
                    '& .MuiStepIcon-root': {
                      color: index <= activeStep ? config.color : 'rgba(255,255,255,0.3)',
                    },
                    '& .MuiStepIcon-root.Mui-active': {
                      color: config.color,
                    },
                    '& .MuiStepIcon-root.Mui-completed': {
                      color: '#10b981',
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Error/Success alerts */}
        {error && (
          <Alert severity="error" sx={{ mx: 3, mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && generatedCode && (
          <Alert 
            severity="success" 
            sx={{ mx: 3, mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleCopyLink}
              >
                {copySuccess ? 'Kopiert!' : 'Kopier lenke'}
              </Button>
            }
          >
            Samtykkekontrakt sendt! Tilgangskode: <strong>{generatedCode}</strong>
          </Alert>
        )}

        {/* Step Content */}
        <Box sx={{ px: 3, pb: 3 }}>
          {/* Step 0: Select consent type */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
                Velg type samtykke du vil sende til {candidate?.name || 'kandidaten'}.
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                {(Object.keys(consentTypeConfig) as ConsentType[]).map((type) => {
                  const typeConfig = consentTypeConfig[type];
                  const isSelected = consentType === type;
                  
                  return (
                    <Paper
                      key={type}
                      onClick={() => setConsentType(type)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: isSelected ? typeConfig.color + '20' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? `2px solid ${typeConfig.color}` : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: typeConfig.color + '15',
                          borderColor: typeConfig.color,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <typeConfig.IconComponent style={{ color: typeConfig.color, fontSize: 24 }} />
                        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                          {typeConfig.label}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.8rem' }}>
                        {typeConfig.description}
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Step 1: Customize contract - GDPR Compliant */}
          {activeStep === 1 && (
            <Box sx={{ display: 'flex', gap: 3, minHeight: 500 }}>
              {/* Form side with accordions */}
              <Box sx={{ flex: 1.2, maxHeight: 550, overflowY: 'auto', pr: 1 }}>
                {/* GDPR Info Alert with source references */}
                <Alert 
                  severity="info" 
                  icon={<GavelIcon />}
                  sx={{ 
                    mb: 2, 
                    bgcolor: 'rgba(0,212,255,0.1)', 
                    color: '#00d4ff',
                    '& .MuiAlert-icon': { color: '#00d4ff' },
                  }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={() => setShowLegalReferences(!showLegalReferences)}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {showLegalReferences ? 'Skjul kilder' : 'Vis kilder'}
                    </Button>
                  }
                >
                  <Typography variant="body2">
                    Utformet iht. <strong>GDPR</strong>, <strong>Personopplysningsloven</strong>, <strong>Åndsverkloven § 104</strong> og <strong>NSF-tariffavtaler</strong>.
                  </Typography>
                </Alert>

                {/* Legal References Panel */}
                <Collapse in={showLegalReferences}>
                  <Paper sx={{ 
                    mb: 2, 
                    p: 2, 
                    bgcolor: 'rgba(16, 185, 129, 0.1)', 
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 2,
                  }}>
                    <Typography variant="subtitle2" sx={{ color: '#10b981', mb: 1.5, fontWeight: 600 }}>
                      📚 Juridiske kilder og referanser
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      {Object.entries(legalReferences).map(([key, ref]) => (
                        <Box 
                          key={key}
                          component="a"
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ 
                            p: 1, 
                            bgcolor: 'rgba(255,255,255,0.05)', 
                            borderRadius: 1,
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600, display: 'block' }}>
                            {ref.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.65rem' }}>
                            {ref.description}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                </Collapse>

                {/* Production Type & Settings - NEW SECTION */}
                <Accordion 
                  expanded={expandedSection === 'production'}
                  onChange={() => setExpandedSection(expandedSection === 'production' ? false : 'production')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <VideoIcon sx={{ color: '#f59e0b' }} />
                      <Typography fontWeight={600}>Produksjonstype og materialkilde</Typography>
                      <Chip 
                        label="Viktig" 
                        size="small" 
                        sx={{ bgcolor: '#f59e0b30', color: '#f59e0b', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2.5}>
                      {/* Production Type */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1.5 }}>
                          Type produksjon
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                          {(Object.entries(productionTypeLabels) as [ProductionType, string][]).map(([type, label]) => (
                            <Chip
                              key={type}
                              label={label}
                              onClick={() => setProductionSettings({...productionSettings, productionType: type})}
                              sx={{
                                bgcolor: productionSettings.productionType === type ? config.color + '30' : 'rgba(255,255,255,0.1)',
                                color: productionSettings.productionType === type ? config.color : '#fff',
                                border: productionSettings.productionType === type ? `1px solid ${config.color}` : '1px solid transparent',
                                '&:hover': { bgcolor: config.color + '20' },
                              }}
                            />
                          ))}
                        </Box>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Material Source - What kind of material */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PhotoIcon sx={{ fontSize: 18 }} /> Hvilken type materiale gjelder samtykket?
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1.5, display: 'block' }}>
                          Ref. Åndsverkloven § 104 og Datatilsynets veileder om bilder
                        </Typography>
                        <FormGroup>
                          {(Object.entries(materialSourceLabels) as [MaterialSource, string][]).map(([source, label]) => (
                            <FormControlLabel
                              key={source}
                              control={
                                <Checkbox 
                                  checked={productionSettings.materialSources.includes(source)} 
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setProductionSettings({
                                        ...productionSettings, 
                                        materialSources: [...productionSettings.materialSources, source]
                                      });
                                    } else {
                                      setProductionSettings({
                                        ...productionSettings, 
                                        materialSources: productionSettings.materialSources.filter(s => s !== source)
                                      });
                                    }
                                  }}
                                  sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                                />
                              }
                              label={label}
                              sx={{ color: '#fff' }}
                            />
                          ))}
                        </FormGroup>
                      </Box>

                      {/* Note about rights management */}
                      <Alert severity="info" sx={{ borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>Tariffavtaler og rettigheter:</strong> Fagforeningsavtaler (NSF/NFF) og vederlagsordninger håndteres i Split Sheet-systemet, ikke i samtykkekontrakter.
                        </Typography>
                      </Alert>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Title and Description */}
                <Accordion 
                  expanded={expandedSection === 'basic'}
                  onChange={() => setExpandedSection(expandedSection === 'basic' ? false : 'basic')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <EditIcon sx={{ color: config.color }} />
                      <Typography fontWeight={600}>Grunnleggende informasjon</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <TextField
                        label="Tittel på samtykke"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder={config.defaultTitle}
                        fullWidth
                        helperText="Tydelig tittel som beskriver hva samtykket gjelder"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            '&:hover fieldset': { borderColor: config.color },
                            '&.Mui-focused fieldset': { borderColor: config.color },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                        }}
                      />

                      <TextField
                        label="Beskrivelse av formål"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={config.description}
                        multiline
                        rows={3}
                        fullWidth
                        helperText="Beskriv presist hva materialet skal brukes til (GDPR krav: spesifikt formål)"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            '&:hover fieldset': { borderColor: config.color },
                            '&.Mui-focused fieldset': { borderColor: config.color },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                        }}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Usage Rights - Bruksrettigheter */}
                <Accordion 
                  expanded={expandedSection === 'usage'}
                  onChange={() => setExpandedSection(expandedSection === 'usage' ? false : 'usage')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <VerifiedIcon sx={{ color: '#10b981' }} />
                      <Typography fontWeight={600}>Bruksrettigheter</Typography>
                      <Chip 
                        label="GDPR" 
                        size="small" 
                        sx={{ bgcolor: '#10b98130', color: '#10b981', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {/* Production purposes */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <VideoIcon sx={{ fontSize: 18 }} /> Produksjonsformål
                        </Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.productionUse} 
                                onChange={(e) => setUsageRights({...usageRights, productionUse: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Bruk i selve produksjonen"
                            sx={{ color: '#fff' }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.promotionalUse} 
                                onChange={(e) => setUsageRights({...usageRights, promotionalUse: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Markedsføring av produksjonen"
                            sx={{ color: '#fff' }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.behindTheScenes} 
                                onChange={(e) => setUsageRights({...usageRights, behindTheScenes: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Making-of / bak kulissene"
                            sx={{ color: '#fff' }}
                          />
                        </FormGroup>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Web publishing */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WebIcon sx={{ fontSize: 18 }} /> Nettpublisering
                        </Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.internalUse} 
                                onChange={(e) => setUsageRights({...usageRights, internalUse: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Kun intern bruk (ikke publisert)"
                            sx={{ color: '#fff' }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.passwordProtectedWeb} 
                                onChange={(e) => setUsageRights({...usageRights, passwordProtectedWeb: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Passordbeskyttet nettside"
                            sx={{ color: '#fff' }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.webPublishing} 
                                onChange={(e) => setUsageRights({...usageRights, webPublishing: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Åpen nettside (offentlig tilgjengelig)"
                            sx={{ color: '#fff' }}
                          />
                        </FormGroup>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Social media */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PublicIcon sx={{ fontSize: 18 }} /> Sosiale medier
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch 
                              checked={usageRights.socialMedia.enabled} 
                              onChange={(e) => setUsageRights({
                                ...usageRights, 
                                socialMedia: {...usageRights.socialMedia, enabled: e.target.checked}
                              })}
                              sx={{ 
                                '& .MuiSwitch-switchBase.Mui-checked': { color: config.color },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: config.color },
                              }}
                            />
                          }
                          label="Tillat deling på sosiale medier"
                          sx={{ color: '#fff', mb: 1 }}
                        />
                        
                        <Collapse in={usageRights.socialMedia.enabled}>
                          <Box sx={{ pl: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                            {[
                              { key: 'instagram', label: 'Instagram', icon: <InstagramIcon sx={{ fontSize: 16 }} /> },
                              { key: 'facebook', label: 'Facebook', icon: <FacebookIcon sx={{ fontSize: 16 }} /> },
                              { key: 'youtube', label: 'YouTube', icon: <YouTubeIcon sx={{ fontSize: 16 }} /> },
                              { key: 'tiktok', label: 'TikTok', icon: <TikTokIcon /> },
                              { key: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon sx={{ fontSize: 16 }} /> },
                              { key: 'twitter', label: 'X (Twitter)', icon: <TwitterIcon sx={{ fontSize: 16 }} /> },
                            ].map(({ key, label, icon }) => (
                              <FormControlLabel
                                key={key}
                                control={
                                  <Checkbox 
                                    checked={usageRights.socialMedia[key as keyof typeof usageRights.socialMedia] as boolean} 
                                    onChange={(e) => setUsageRights({
                                      ...usageRights, 
                                      socialMedia: {...usageRights.socialMedia, [key]: e.target.checked}
                                    })}
                                    size="small"
                                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: config.color } }}
                                  />
                                }
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {icon}
                                    <Typography variant="body2">{label}</Typography>
                                  </Box>
                                }
                                sx={{ color: 'rgba(255,255,255,0.8)' }}
                              />
                            ))}
                          </Box>
                        </Collapse>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Print media */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PrintIcon sx={{ fontSize: 18 }} /> Trykte medier
                        </Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.printMedia} 
                                onChange={(e) => setUsageRights({...usageRights, printMedia: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Trykksaker (brosjyrer, plakater, etc.)"
                            sx={{ color: '#fff' }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.pressRelease} 
                                onChange={(e) => setUsageRights({...usageRights, pressRelease: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Pressemeldinger og medieomtale"
                            sx={{ color: '#fff' }}
                          />
                        </FormGroup>
                      </Box>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Territory and Special Rights */}
                <Accordion 
                  expanded={expandedSection === 'territory'}
                  onChange={() => setExpandedSection(expandedSection === 'territory' ? false : 'territory')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <PublicIcon sx={{ color: '#f59e0b' }} />
                      <Typography fontWeight={600}>Geografisk omfang og spesielle rettigheter</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {/* Territory */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                          Geografisk bruksområde
                        </Typography>
                        <FormControl component="fieldset">
                          <RadioGroup
                            value={usageRights.territoryWorldwide ? 'worldwide' : usageRights.territoryNordic ? 'nordic' : 'norway'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUsageRights({
                                ...usageRights,
                                territoryWorldwide: val === 'worldwide',
                                territoryNordic: val === 'nordic',
                                territoryNorway: val === 'norway',
                              });
                            }}
                          >
                            <FormControlLabel 
                              value="norway" 
                              control={<Radio sx={{ color: config.color, '&.Mui-checked': { color: config.color } }} />} 
                              label="Kun Norge" 
                              sx={{ color: '#fff' }}
                            />
                            <FormControlLabel 
                              value="nordic" 
                              control={<Radio sx={{ color: config.color, '&.Mui-checked': { color: config.color } }} />} 
                              label="Norden (Norge, Sverige, Danmark, Finland, Island)" 
                              sx={{ color: '#fff' }}
                            />
                            <FormControlLabel 
                              value="worldwide" 
                              control={<Radio sx={{ color: config.color, '&.Mui-checked': { color: config.color } }} />} 
                              label="Verdensomspennende" 
                              sx={{ color: '#fff' }}
                            />
                          </RadioGroup>
                        </FormControl>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Special rights */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                          Spesielle rettigheter
                        </Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.editingAllowed} 
                                onChange={(e) => setUsageRights({...usageRights, editingAllowed: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Tillater redigering og beskjæring av materialet"
                            sx={{ color: '#fff' }}
                          />
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.nameCredit} 
                                onChange={(e) => setUsageRights({...usageRights, nameCredit: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label="Navn kan brukes ved kreditering"
                            sx={{ color: '#fff' }}
                          />
                          {(consentType === 'video_release' || consentType === 'audio_release') && (
                            <FormControlLabel
                              control={
                                <Checkbox 
                                  checked={usageRights.voiceoverUse} 
                                  onChange={(e) => setUsageRights({...usageRights, voiceoverUse: e.target.checked})}
                                  sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                                />
                              }
                              label="Stemme kan brukes til voiceover/dubbing"
                              sx={{ color: '#fff' }}
                            />
                          )}
                        </FormGroup>
                      </Box>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Data Retention - Lagringstid */}
                <Accordion 
                  expanded={expandedSection === 'retention'}
                  onChange={() => setExpandedSection(expandedSection === 'retention' ? false : 'retention')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <StorageIcon sx={{ color: '#8b5cf6' }} />
                      <Typography fontWeight={600}>Lagringstid og sletting</Typography>
                      <Chip 
                        label="GDPR" 
                        size="small" 
                        sx={{ bgcolor: '#8b5cf630', color: '#8b5cf6', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <FormControl fullWidth>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Lagringsperiode</InputLabel>
                        <Select
                          value={retentionSettings.retentionPeriod}
                          onChange={(e) => setRetentionSettings({...retentionSettings, retentionPeriod: e.target.value as RetentionSettings['retentionPeriod']})}
                          label="Lagringsperiode"
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: config.color },
                            '& .MuiSvgIcon-root': { color: '#fff' },
                          }}
                        >
                          <MenuItem value="project_duration">Prosjektets varighet</MenuItem>
                          <MenuItem value="1_year">1 år</MenuItem>
                          <MenuItem value="3_years">3 år</MenuItem>
                          <MenuItem value="5_years">5 år</MenuItem>
                          <MenuItem value="indefinite">Uten tidsbegrensning (krever begrunnelse)</MenuItem>
                          <MenuItem value="custom">Egendefinert</MenuItem>
                        </Select>
                      </FormControl>

                      {retentionSettings.retentionPeriod === 'custom' && (
                        <TextField
                          label="Antall måneder"
                          type="number"
                          value={retentionSettings.customPeriodMonths || ''}
                          onChange={(e) => setRetentionSettings({...retentionSettings, customPeriodMonths: parseInt(e.target.value) || undefined})}
                          InputProps={{ inputProps: { min: 1, max: 120 } }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      )}

                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Checkbox 
                              checked={retentionSettings.deleteAfterProject} 
                              onChange={(e) => setRetentionSettings({...retentionSettings, deleteAfterProject: e.target.checked})}
                              sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                            />
                          }
                          label="Slett materiale etter prosjektslutt"
                          sx={{ color: '#fff' }}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox 
                              checked={retentionSettings.archiveAfterUse} 
                              onChange={(e) => setRetentionSettings({...retentionSettings, archiveAfterUse: e.target.checked})}
                              sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                            />
                          }
                          label="Arkiver materiale etter bruk (ikke slett)"
                          sx={{ color: '#fff' }}
                        />
                      </FormGroup>

                      <Alert severity="info" sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                        <Typography variant="body2">
                          Iht. GDPR skal personopplysninger ikke lagres lenger enn nødvendig for formålet.
                        </Typography>
                      </Alert>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* GDPR Settings - Behandlingsansvarlig */}
                <Accordion 
                  expanded={expandedSection === 'gdpr'}
                  onChange={() => setExpandedSection(expandedSection === 'gdpr' ? false : 'gdpr')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <SecurityIcon sx={{ color: '#ec4899' }} />
                      <Typography fontWeight={600}>GDPR og personvern</Typography>
                      <Chip 
                        label="Påkrevd" 
                        size="small" 
                        sx={{ bgcolor: '#ec489930', color: '#ec4899', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <TextField
                        label="Behandlingsansvarlig (virksomhet)"
                        value={gdprSettings.dataController}
                        onChange={(e) => setGdprSettings({...gdprSettings, dataController: e.target.value})}
                        placeholder={project?.name || 'Firmanavn AS'}
                        fullWidth
                        required
                        helperText="Hvem er ansvarlig for behandling av personopplysningene"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                        }}
                      />

                      <TextField
                        label="Kontaktinformasjon for behandlingsansvarlig"
                        value={gdprSettings.dataControllerContact}
                        onChange={(e) => setGdprSettings({...gdprSettings, dataControllerContact: e.target.value})}
                        placeholder="E-post eller telefon"
                        fullWidth
                        helperText="Hvordan kan den registrerte kontakte dere"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                        }}
                      />

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      <FormControlLabel
                        control={
                          <Switch 
                            checked={gdprSettings.thirdPartySharing} 
                            onChange={(e) => setGdprSettings({...gdprSettings, thirdPartySharing: e.target.checked})}
                            sx={{ 
                              '& .MuiSwitch-switchBase.Mui-checked': { color: '#ec4899' },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#ec4899' },
                            }}
                          />
                        }
                        label="Deling med tredjeparter"
                        sx={{ color: '#fff' }}
                      />

                      <Collapse in={gdprSettings.thirdPartySharing}>
                        <TextField
                          label="Hvem deles opplysningene med?"
                          value={gdprSettings.thirdPartyDetails}
                          onChange={(e) => setGdprSettings({...gdprSettings, thirdPartyDetails: e.target.value})}
                          placeholder="F.eks. TV-kanaler, strømmetjenester, distributører"
                          fullWidth
                          multiline
                          rows={2}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Collapse>

                      <FormControlLabel
                        control={
                          <Switch 
                            checked={gdprSettings.transferOutsideEEA} 
                            onChange={(e) => setGdprSettings({...gdprSettings, transferOutsideEEA: e.target.checked})}
                            sx={{ 
                              '& .MuiSwitch-switchBase.Mui-checked': { color: '#f59e0b' },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#f59e0b' },
                            }}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>Overføring utenfor EØS</span>
                            <Tooltip title="Krever spesielle sikkerhetstiltak iht. GDPR">
                              <WarningIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            </Tooltip>
                          </Box>
                        }
                        sx={{ color: '#fff' }}
                      />

                      <Collapse in={gdprSettings.transferOutsideEEA}>
                        <Alert severity="warning" sx={{ mb: 1, bgcolor: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
                          Overføring utenfor EØS krever tilstrekkelige garantier (f.eks. Standard Contractual Clauses).
                        </Alert>
                        <TextField
                          label="Detaljer om overføring"
                          value={gdprSettings.transferDetails}
                          onChange={(e) => setGdprSettings({...gdprSettings, transferDetails: e.target.value})}
                          placeholder="Hvilke land og hvilke sikkerhetstiltak"
                          fullWidth
                          multiline
                          rows={2}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Collapse>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      <TextField
                        label="Informasjon om tilbaketrekning av samtykke"
                        value={gdprSettings.withdrawalInfo}
                        onChange={(e) => setGdprSettings({...gdprSettings, withdrawalInfo: e.target.value})}
                        multiline
                        rows={2}
                        fullWidth
                        helperText="Må være like lett å trekke tilbake som å gi samtykke"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                        }}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Minor Consent - For mindreårige */}
                {(consentType === 'minor_consent' || minorSettings.isMinor) && (
                  <Accordion 
                    expanded={expandedSection === 'minor'}
                    onChange={() => setExpandedSection(expandedSection === 'minor' ? false : 'minor')}
                    sx={{ 
                      bgcolor: 'rgba(236,72,153,0.1)', 
                      color: '#fff',
                      '&:before': { display: 'none' },
                      borderRadius: '8px !important',
                      border: '1px solid rgba(236,72,153,0.3)',
                      mb: 1,
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <MinorIcon sx={{ color: '#ec4899' }} />
                        <Typography fontWeight={600}>Samtykke for mindreårig</Typography>
                        <Chip 
                          label="Viktig" 
                          size="small" 
                          sx={{ bgcolor: '#ec489950', color: '#fff', fontSize: '0.7rem', height: 20 }} 
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(236,72,153,0.2)', color: '#f9a8d4' }}>
                        <Typography variant="body2">
                          For barn under 13 år kreves foresattes samtykke. Barn over 13 år bør også signere selv i tillegg til foresatte.
                        </Typography>
                      </Alert>
                      <Stack spacing={2}>
                        <TextField
                          label="Barnets alder"
                          type="number"
                          value={minorSettings.minorAge || ''}
                          onChange={(e) => {
                            const age = parseInt(e.target.value) || 0;
                            setMinorSettings({
                              ...minorSettings, 
                              minorAge: age,
                              minorCanCoSign: age >= 13,
                            });
                          }}
                          InputProps={{ inputProps: { min: 0, max: 17 } }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />

                        <TextField
                          label="Foresattes navn"
                          value={minorSettings.guardianName}
                          onChange={(e) => setMinorSettings({...minorSettings, guardianName: e.target.value})}
                          fullWidth
                          required
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />

                        <FormControl fullWidth>
                          <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Relasjon til barnet</InputLabel>
                          <Select
                            value={minorSettings.guardianRelation}
                            onChange={(e) => setMinorSettings({...minorSettings, guardianRelation: e.target.value as MinorConsentSettings['guardianRelation']})}
                            label="Relasjon til barnet"
                            sx={{
                              color: '#fff',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                              '& .MuiSvgIcon-root': { color: '#fff' },
                            }}
                          >
                            <MenuItem value="parent">Forelder</MenuItem>
                            <MenuItem value="guardian">Verge</MenuItem>
                            <MenuItem value="other">Annen foresatt</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          label="Foresattes kontaktinformasjon"
                          value={minorSettings.guardianContact}
                          onChange={(e) => setMinorSettings({...minorSettings, guardianContact: e.target.value})}
                          placeholder="E-post eller telefon"
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />

                        {minorSettings.minorAge && minorSettings.minorAge >= 13 && (
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={minorSettings.minorCanCoSign} 
                                onChange={(e) => setMinorSettings({...minorSettings, minorCanCoSign: e.target.checked})}
                                sx={{ color: '#ec4899', '&.Mui-checked': { color: '#ec4899' } }}
                              />
                            }
                            label="Barnet skal også signere (anbefalt for 13+ år)"
                            sx={{ color: '#fff' }}
                          />
                        )}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}

                {/* Internal Notes */}
                <Accordion 
                  expanded={expandedSection === 'notes'}
                  onChange={() => setExpandedSection(expandedSection === 'notes' ? false : 'notes')}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                    '&:before': { display: 'none' },
                    borderRadius: '8px !important',
                    mb: 1,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <DocumentIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                      <Typography fontWeight={600}>Interne notater</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      label="Interne notater (vises ikke i kontrakten)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      multiline
                      rows={3}
                      fullWidth
                      placeholder="F.eks. spesielle avtaler, kontaktpersoner, etc."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                      }}
                    />
                  </AccordionDetails>
                </Accordion>
              </Box>

              {/* Preview side */}
              <Box sx={{ flex: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PreviewIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Forhåndsvisning
                  </Typography>
                </Box>
                <Box sx={{ maxHeight: 520, overflowY: 'auto', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <ContractPreview />
                </Box>
              </Box>
            </Box>
          )}

          {/* Step 2: Send options */}
          {activeStep === 2 && (
            <Box>
              {!success ? (
                <Box sx={{ display: 'flex', gap: 3 }}>
                  {/* Send options */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                      Sendemetode
                    </Typography>
                    
                    <Stack spacing={2}>
                      {/* Send method selection */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {[
                          { method: 'email' as const, icon: <EmailIcon />, label: 'E-post', available: !!candidate?.contactInfo.email },
                          { method: 'sms' as const, icon: <SmsIcon />, label: 'SMS', available: !!candidate?.contactInfo.phone },
                          { method: 'link' as const, icon: <LinkIcon />, label: 'Kun lenke', available: true },
                        ].map(({ method, icon, label, available }) => (
                          <Button
                            key={method}
                            variant={sendMethod === method ? 'contained' : 'outlined'}
                            onClick={() => setSendMethod(method)}
                            disabled={!available}
                            startIcon={icon}
                            sx={{
                              flex: 1,
                              bgcolor: sendMethod === method ? config.color : 'transparent',
                              borderColor: sendMethod === method ? config.color : 'rgba(255,255,255,0.2)',
                              color: sendMethod === method ? '#fff' : 'rgba(255,255,255,0.7)',
                              '&:hover': {
                                bgcolor: sendMethod === method ? config.color : 'rgba(255,255,255,0.1)',
                                borderColor: config.color,
                              },
                              '&.Mui-disabled': {
                                borderColor: 'rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)',
                              },
                            }}
                          >
                            {label}
                          </Button>
                        ))}
                      </Box>

                      {sendMethod === 'email' && candidate?.contactInfo.email && (
                        <Alert severity="info" sx={{ bgcolor: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          Kontrakten sendes til: <strong>{candidate.contactInfo.email}</strong>
                        </Alert>
                      )}

                      {sendMethod === 'sms' && candidate?.contactInfo.phone && (
                        <Alert severity="info" sx={{ bgcolor: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          SMS sendes til: <strong>{candidate.contactInfo.phone}</strong>
                        </Alert>
                      )}

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

                      {/* Security options */}
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                        Sikkerhet
                      </Typography>

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={includePin}
                            onChange={(e) => setIncludePin(e.target.checked)}
                            sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                          />
                        }
                        label="Krev PIN-kode for tilgang"
                        sx={{ color: 'rgba(255,255,255,0.87)' }}
                      />

                      <Collapse in={includePin}>
                        <TextField
                          label="PIN-kode"
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="4-6 sifre"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#fff',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                          }}
                        />
                      </Collapse>

                      <FormControl fullWidth>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Utløper etter</InputLabel>
                        <Select
                          value={expiresDays}
                          onChange={(e) => setExpiresDays(Number(e.target.value))}
                          label="Utløper etter"
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                          }}
                        >
                          <MenuItem value={7}>7 dager</MenuItem>
                          <MenuItem value={14}>14 dager</MenuItem>
                          <MenuItem value={30}>30 dager</MenuItem>
                          <MenuItem value={60}>60 dager</MenuItem>
                          <MenuItem value={90}>90 dager</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>

                  {/* Summary */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                      Oppsummering
                    </Typography>
                    
                    <Paper sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 3, borderRadius: 2 }}>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <config.IconComponent style={{ color: config.color, fontSize: 32 }} />
                          <Box>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              Type
                            </Typography>
                            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                              {config.label}
                            </Typography>
                          </Box>
                        </Box>

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            Mottaker
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {candidate?.name || 'Ikke valgt'}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            Prosjekt
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {project?.name || 'Ikke valgt'}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            Tittel
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {effectiveTitle}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            Sikkerhet
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {includePin ? `PIN-beskyttet (${pin || '****'})` : 'Standard tilgang'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Box>
                </Box>
              ) : (
                /* Success state */
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: '#10b98120',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}>
                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 48 }} />
                  </Box>
                  
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
                    Samtykkekontrakt sendt!
                  </Typography>
                  
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
                    {candidate?.name} har mottatt en invitasjon til å signere kontrakten.
                  </Typography>

                  {generatedCode && (
                    <Paper sx={{ 
                      bgcolor: config.color + '15', 
                      p: 3, 
                      borderRadius: 2, 
                      border: `1px solid ${config.color}40`,
                      display: 'inline-block',
                      minWidth: 300,
                    }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                        Tilgangskode
                      </Typography>
                      <Typography variant="h4" sx={{ 
                        fontFamily: 'monospace', 
                        fontWeight: 700, 
                        color: config.color,
                        letterSpacing: '0.15em',
                        mb: 2,
                      }}>
                        {generatedCode}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={copySuccess ? <CheckCircleIcon /> : <CopyIcon />}
                          onClick={handleCopyLink}
                          sx={{ 
                            color: copySuccess ? '#10b981' : config.color, 
                            borderColor: copySuccess ? '#10b981' : config.color,
                          }}
                        >
                          {copySuccess ? 'Kopiert!' : 'Kopier lenke'}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<LinkIcon />}
                          onClick={() => {
                            const url = `${window.location.origin}/consent-portal?consent_code=${generatedCode}`;
                            window.open(url, '_blank');
                          }}
                          sx={{ color: config.color, borderColor: config.color }}
                        >
                          Åpne portal
                        </Button>
                      </Stack>
                    </Paper>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        borderTop: '1px solid rgba(255,255,255,0.1)', 
        p: 2,
        gap: 1,
      }}>
        {activeStep > 0 && !success && (
          <Button
            onClick={handleBack}
            startIcon={<BackIcon />}
            sx={{ color: 'rgba(255,255,255,0.87)', mr: 'auto' }}
          >
            Tilbake
          </Button>
        )}

        <Button
          onClick={onClose}
          sx={{ color: 'rgba(255,255,255,0.87)' }}
        >
          {success ? 'Lukk' : 'Avbryt'}
        </Button>

        {!success && (
          activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NextIcon />}
              sx={{
                bgcolor: config.color,
                color: '#fff',
                fontWeight: 600,
                '&:hover': { bgcolor: config.color, filter: 'brightness(0.9)' },
              }}
            >
              Neste
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleGenerateAndSend}
              disabled={sending}
              startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              sx={{
                bgcolor: '#10b981',
                color: '#fff',
                fontWeight: 600,
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              {sending ? 'Sender...' : 'Send kontrakt'}
            </Button>
          )
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ConsentContractDialog;
