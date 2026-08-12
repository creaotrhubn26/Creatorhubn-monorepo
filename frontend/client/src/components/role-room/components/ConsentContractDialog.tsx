// @ts-nocheck
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

import { useState, useEffect, useMemo, type ComponentType, type CSSProperties } from 'react';
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
  Email as EmailIcon,
  Sms as SmsIcon,
  Description as DocumentIcon,
  Preview as PreviewIcon,
  Edit as EditIcon,
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
  Gavel as GavelIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { ConsentsIcon } from './icons/CastingIcons';
import type { Consent, ConsentType, Candidate, CastingProject, ConsentInvitationStatus } from '../models/casting';
import { consentService } from '../services/consentService';
import { Z_INDEX } from '../config/zIndex';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useT } from '../../../i18n';

// TikTok icon (not available in MUI)
const TikTokIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

import { TOUCH_TARGET_SIZE } from '../constants/accessibility';
const CONSENT_DIALOG_ACCENT = 'var(--role-accent, #b86bff)';

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

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

// Production type labels are built in-component via t() (see useMemo)

// Material source labels are built in-component via t() (see useMemo)

// Legal references are built in-component via t() (URLs preserved, see useMemo)

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

// Consent type configuration is built in-component via t() (see useMemo)

export function ConsentContractDialog({
  open,
  onClose,
  candidate,
  project,
  existingConsent,
  onConsentSent,
  onConsentUpdated,
}: ConsentContractDialogProps) {
  const { t } = useT();

  const productionTypeLabels = useMemo(() => ({
    feature_film: t('consentDlg.prodType.feature_film'),
    short_film: t('consentDlg.prodType.short_film'),
    documentary: t('consentDlg.prodType.documentary'),
    tv_drama: t('consentDlg.prodType.tv_drama'),
    tv_series: t('consentDlg.prodType.tv_series'),
    tv_entertainment: t('consentDlg.prodType.tv_entertainment'),
    commercial: t('consentDlg.prodType.commercial'),
    music_video: t('consentDlg.prodType.music_video'),
    corporate: t('consentDlg.prodType.corporate'),
    streaming: t('consentDlg.prodType.streaming'),
    student_film: t('consentDlg.prodType.student_film'),
    dubbing: t('consentDlg.prodType.dubbing'),
    other: t('consentDlg.prodType.other'),
  }), [t]);

  const materialSourceLabels = useMemo(() => ({
    set_photos: t('consentDlg.material.set_photos'),
    bts_footage: t('consentDlg.material.bts_footage'),
    audition_tape: t('consentDlg.material.audition_tape'),
    production_stills: t('consentDlg.material.production_stills'),
    promotional: t('consentDlg.material.promotional'),
    casting_photos: t('consentDlg.material.casting_photos'),
  }), [t]);

  const legalReferences = useMemo(() => ({
    gdpr: {
      name: t('consentDlg.legal.gdpr.name'),
      url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38',
      description: t('consentDlg.legal.gdpr.description'),
    },
    personopplysningsloven: {
      name: t('consentDlg.legal.pol.name'),
      url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38',
      description: t('consentDlg.legal.pol.description'),
    },
    åndsverkloven: {
      name: t('consentDlg.legal.copyright.name'),
      url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-40/KAPITTEL_7#%C2%A7104',
      description: t('consentDlg.legal.copyright.description'),
    },
    datatilsynet: {
      name: t('consentDlg.legal.dt.name'),
      url: 'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/behandlingsgrunnlag/samtykke/',
      description: t('consentDlg.legal.dt.description'),
    },
    datatilsynetBilde: {
      name: t('consentDlg.legal.dtImg.name'),
      url: 'https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/bilder-pa-nett/',
      description: t('consentDlg.legal.dtImg.description'),
    },
  }), [t]);

  const consentTypeConfig = useMemo(() => ({
    photo_release: { IconComponent: PhotoIcon, label: t('consentDlg.type.photo.label'), description: t('consentDlg.type.photo.description'), color: 'var(--role-cyan, #00d4ff)', defaultTitle: t('consentDlg.type.photo.defaultTitle') },
    video_release: { IconComponent: VideoIcon, label: t('consentDlg.type.video.label'), description: t('consentDlg.type.video.description'), color: '#10b981', defaultTitle: t('consentDlg.type.video.defaultTitle') },
    audio_release: { IconComponent: AudioIcon, label: t('consentDlg.type.audio.label'), description: t('consentDlg.type.audio.description'), color: 'var(--role-violet, #8b5cf6)', defaultTitle: t('consentDlg.type.audio.defaultTitle') },
    location_release: { IconComponent: LocationIcon, label: t('consentDlg.type.location.label'), description: t('consentDlg.type.location.description'), color: '#f59e0b', defaultTitle: t('consentDlg.type.location.defaultTitle') },
    minor_consent: { IconComponent: MinorIcon, label: t('consentDlg.type.minor.label'), description: t('consentDlg.type.minor.description'), color: '#ec4899', defaultTitle: t('consentDlg.type.minor.defaultTitle') },
    other: { IconComponent: OtherIcon, label: t('consentDlg.type.other.label'), description: t('consentDlg.type.other.description'), color: '#6b7280', defaultTitle: t('consentDlg.type.other.defaultTitle') },
  }), [t]);

  // Stepper state
  const [activeStep, setActiveStep] = useState(0);
  const steps = useMemo(() => [t('consentDlg.step.type'), t('consentDlg.step.customize'), t('consentDlg.step.send')], [t]);

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
    withdrawalInfo: t('consentDlg.withdrawal.default'),
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Company info state (would be loaded from project settings)
  const [companyName, setCompanyName] = useState('');
  const mentionCandidates = [
    candidate?.name,
    project?.name,
    companyName,
    t('consentDlg.fallback.production'),
    t('consentDlg.mention.legal'),
    t('consentDlg.mention.consent'),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const companyLogo = useMemo(() => {
    if (!project || typeof project !== 'object') return null;
    const projectRecord = project as Record<string, unknown>;
    const logoCandidateKeys = ['companyLogo', 'companyLogoUrl', 'logo', 'logoUrl'];
    for (const key of logoCandidateKeys) {
      const value = projectRecord[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }, [project]);

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
        purpose: t('consentDlg.purpose.default', { type: consentType === 'photo_release' ? t('consentDlg.material.photos') : consentType === 'video_release' ? t('consentDlg.material.videos') : t('consentDlg.material.generic'), project: project?.name || t('consentDlg.fallback.production') }),
        legalBasis: 'consent',
        thirdPartySharing: false,
        thirdPartyDetails: '',
        transferOutsideEEA: false,
        transferDetails: '',
        automatedDecisions: false,
        withdrawalInfo: t('consentDlg.withdrawal.default'),
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
        setCompanyName(project.name || t('consentDlg.fallback.company'));
      }
    }
  }, [open, existingConsent, project, consentType, t]);

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
      setError(t('consentDlg.err.missingInfo'));
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
          throw new Error(t('consentDlg.err.createConsent'));
        }
        
        consent = {
          ...newConsent,
          description: description || consentTypeConfig[consentType].description,
          notes,
        };
        await consentService.updateConsent(project.id, candidate.id, consent);
      }

      // Generate access code
      const accessCode = await consentService.generateAccessCode(consent, {
        pin: includePin ? pin : undefined,
        expiresDays,
      });

      if (accessCode) {
        setGeneratedCode(accessCode);
        
        // Update consent with invitation status
        consent.accessCode = accessCode;
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
        throw new Error(t('consentDlg.err.generateCode'));
      }
    } catch (err) {
      console.error('Error sending consent:', err);
      setError(err instanceof Error ? err.message : t('consentDlg.err.generic'));
    } finally {
      setSending(false);
    }
  };

  const config = consentTypeConfig[consentType];
  const effectiveTitle = customTitle || config.defaultTitle;
  const consentModalZIndex = Z_INDEX.dialog + 40;
  const consentModalBackdropZIndex = consentModalZIndex - 1;
  const consentMenuProps = {
    container: typeof document !== 'undefined' ? document.body : undefined,
    sx: { zIndex: Z_INDEX.dialogSelect + 40 },
    PaperProps: {
      sx: { zIndex: Z_INDEX.dialogSelect + 40 },
    },
  };

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
      if (usageRights.territoryWorldwide) return t('consentDlg.territory.worldwide');
      if (usageRights.territoryNordic) return t('consentDlg.territory.nordic');
      return t('consentDlg.territory.norway');
    };

    // Helper to get retention text
    const getRetentionText = () => {
      switch (retentionSettings.retentionPeriod) {
        case 'project_duration': return t('consentDlg.retention.projectDuration');
        case '1_year': return t('consentDlg.retention.1year');
        case '3_years': return t('consentDlg.retention.3years');
        case '5_years': return t('consentDlg.retention.5years');
        case 'indefinite': return t('consentDlg.retention.indefinite');
        case 'custom': return t('consentDlg.retention.months', { n: retentionSettings.customPeriodMonths || 0 });
        default: return t('consentDlg.notSpecified');
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
                  {gdprSettings.dataController || companyName || project?.name || t('consentDlg.fallback.company')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.preview.subtitle')}</Typography>
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
              <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 600, mb: 0.5 }}>{t('consentDlg.preview.legalBasis')}</Typography>
              <Typography variant="caption" sx={{ color: '#0c4a6e', lineHeight: 1.5, display: 'block' }}>{t('consentDlg.preview.compliesWith')}</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, '& li': { color: '#0c4a6e', fontSize: '0.7rem', lineHeight: 1.4 } }}>
                <li><strong>GDPR</strong> {t('consentDlg.preview.gdprParen')} <strong>{t('consentDlg.law.personalData')}</strong></li>
                <li><strong>{t('consentDlg.law.copyright')}</strong> - {t('consentDlg.preview.rightOwnImage')}</li>
                <li><strong>{t('consentDlg.law.dtGuide')}</strong> {t('consentDlg.preview.forConsentImages')}</li>
              </Box>
              <Typography variant="caption" sx={{ color: '#0369a1', mt: 1, display: 'block' }}>{t('consentDlg.preview.rightToWithdraw')}</Typography>
            </Box>
          </Box>

          {/* Production Info Section */}
          <Box sx={{ mb: 4, p: 2, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #fcd34d' }}>
            <Typography variant="subtitle2" sx={{ color: '#92400e', fontWeight: 600, mb: 1.5 }}>{t('consentDlg.preview.productionInfo')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 600 }}>{t('consentDlg.preview.productionType')}</Typography>
                <Typography variant="body2" sx={{ color: '#451a03' }}>
                  {productionTypeLabels[productionSettings.productionType]}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 600 }}>{t('consentDlg.preview.materialCovers')}</Typography>
                <Typography variant="body2" sx={{ color: '#451a03' }}>
                  {getMaterialSourcesText() || t('consentDlg.notSpecified')}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Parties Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>{t('consentDlg.preview.parties')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('consentDlg.preview.dataController')}</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {gdprSettings.dataController || project?.name || t('consentDlg.fallback.company')}
                </Typography>
                {gdprSettings.dataControllerContact && (
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                    {gdprSettings.dataControllerContact}
                  </Typography>
                )}
              </Box>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {minorSettings.isMinor ? t('consentDlg.preview.participantMinor') : t('consentDlg.preview.participant')}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {candidate?.name || t('consentDlg.preview.name')}
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
                <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('consentDlg.preview.guardian')}</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, color: '#78350f' }}>
                  {minorSettings.guardianName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#92400e' }}>
                  {minorSettings.guardianRelation === 'parent' ? t('consentDlg.relation.parent') : minorSettings.guardianRelation === 'guardian' ? t('consentDlg.relation.guardian') : t('consentDlg.relation.otherGuardian')}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Description/Purpose */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>{t('consentDlg.preview.purposeHeading')}</Typography>
            <Typography variant="body1" sx={{ color: '#475569', lineHeight: 1.7 }}>
              {description || config.description}
            </Typography>
          </Box>

          {/* Usage Rights - What the consent covers */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>{t('consentDlg.preview.whatCovered')}</Typography>
            
            {/* Production use */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>{t('consentDlg.preview.usagePurposes')}</Typography>
              <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 0.5 } }}>
                {usageRights.productionUse && <li>{t('consentDlg.preview.usedInProduction', { project: project?.name || t('consentDlg.preview.projectName') })}</li>}
                {usageRights.promotionalUse && <li>{t('consentDlg.usage.promotion')}</li>}
                {usageRights.behindTheScenes && <li>{t('consentDlg.preview.makingOf')}</li>}
              </Box>
            </Box>

            {/* Publishing channels */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>{t('consentDlg.preview.publishingChannels')}</Typography>
              <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 0.5 } }}>
                {usageRights.internalUse && <li>{t('consentDlg.preview.internalUse')}</li>}
                {usageRights.passwordProtectedWeb && <li>{t('consentDlg.passwordWeb')}</li>}
                {usageRights.webPublishing && <li>{t('consentDlg.openWeb')}</li>}
                {usageRights.printMedia && <li>{t('consentDlg.preview.printMaterials')}</li>}
                {usageRights.pressRelease && <li>{t('consentDlg.pressRelease')}</li>}
                {usageRights.socialMedia.enabled && getSelectedSocialMedia().length > 0 && (
                  <li>{t('consentDlg.preview.socialMediaLabel')}: {getSelectedSocialMedia().join(', ')}</li>
                )}
              </Box>
            </Box>

            {/* Territory */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>{t('consentDlg.preview.geoScope')}</Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                {getTerritoryText()}
              </Typography>
            </Box>

            {/* Special rights */}
            {(usageRights.editingAllowed || usageRights.nameCredit || usageRights.voiceoverUse) && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#334155' }}>{t('consentDlg.preview.specialRights')}</Typography>
                <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 0.5 } }}>
                  {usageRights.editingAllowed && <li>{t('consentDlg.preview.editingAllowed')}</li>}
                  {usageRights.nameCredit && <li>{t('consentDlg.nameCredit')}</li>}
                  {usageRights.voiceoverUse && <li>{t('consentDlg.voiceover')}</li>}
                </Box>
              </Box>
            )}
          </Box>

          {/* Data Retention */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>{t('consentDlg.preview.retentionHeading')}</Typography>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              {t('consentDlg.preview.storedFor')} <strong>{getRetentionText()}</strong>
            </Typography>
            {retentionSettings.deleteAfterProject && (
              <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>{t('consentDlg.preview.deletedAfter')}</Typography>
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
                <WarningIcon sx={{ fontSize: 18 }} />{t('consentDlg.transferEEA')}</Typography>
              <Typography variant="body2" sx={{ color: '#713f12' }}>
                {gdprSettings.transferDetails || t('consentDlg.preview.transferDefault')}
              </Typography>
            </Box>
          )}

          {/* Rights Section - Dine rettigheter */}
          <Box sx={{ mb: 4, p: 3, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #86efac' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#166534' }}>{t('consentDlg.preview.yourRights')}</Typography>
            <Box component="ul" sx={{ pl: 2, color: '#166534', '& li': { mb: 1, lineHeight: 1.5 } }}>
              <li><strong>{t('consentDlg.rights.accessLabel')}</strong> {t('consentDlg.rights.accessText')}</li>
              <li><strong>{t('consentDlg.rights.rectLabel')}</strong> {t('consentDlg.rights.rectText')}</li>
              <li><strong>{t('consentDlg.rights.eraseLabel')}</strong> {t('consentDlg.rights.eraseText')}</li>
              <li><strong>{t('consentDlg.rights.withdrawLabel')}</strong> {gdprSettings.withdrawalInfo}</li>
              <li><strong>{t('consentDlg.rights.complainLabel')}</strong> {t('consentDlg.rights.complainText')}</li>
            </Box>
          </Box>

          {/* Terms */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>{t('consentDlg.preview.declaration')}</Typography>
            <Box component="ul" sx={{ pl: 2, color: '#475569', '& li': { mb: 1.5, lineHeight: 1.6 } }}>
              <li>{t('consentDlg.decl.voluntary', { material: consentType === 'photo_release' ? t('consentDlg.material.photos') : consentType === 'video_release' ? t('consentDlg.material.videos') : consentType === 'audio_release' ? t('consentDlg.material.audio') : t('consentDlg.material.definite') })}</li>
              <li>{t('consentDlg.decl.received')}</li>
              {minorSettings.isMinor ? (
                <li>{t('consentDlg.decl.guardianAuth')}</li>
              ) : (
                <li>{t('consentDlg.decl.adult')}</li>
              )}
              <li>{t('consentDlg.decl.canWithdraw')}</li>
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
                <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>{t('consentDlg.preview.date')}</Typography>
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
                  {minorSettings.isMinor ? t('consentDlg.preview.guardianSignature') : t('consentDlg.preview.signature')}
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
                  <Typography variant="body2" sx={{ color: '#92400e', fontStyle: 'italic' }}>{t('consentDlg.preview.digitalSigHere')}</Typography>
                </Box>
              </Box>
              {minorSettings.isMinor && minorSettings.minorCanCoSign && (
                <Box>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>{t('consentDlg.preview.childSignature')}</Typography>
                  <Box sx={{ 
                    height: 60, 
                    borderBottom: '1px solid #1c2128',
                    bgcolor: '#fce7f3',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Typography variant="body2" sx={{ color: '#9d174d', fontStyle: 'italic' }}>{t('consentDlg.preview.digitalSig')}</Typography>
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
              <Typography variant="caption" sx={{ color: '#64748b' }}>{t('consentDlg.preview.securedBy')}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>
              {t('consentDlg.preview.docId')} {existingConsent?.id || t('consentDlg.preview.newContract')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
              {t('consentDlg.preview.productionTypeFooter')} {productionTypeLabels[productionSettings.productionType]}
            </Typography>
            
            {/* Legal references */}
            <Box sx={{ 
              mt: 2, 
              pt: 2, 
              borderTop: '1px dashed #e2e8f0',
              textAlign: 'left',
              px: 2,
            }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1 }}>{t('consentDlg.preview.legalRefs')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                <Chip 
                  label="GDPR" 
                  size="small" 
                  sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#dbeafe', color: '#1e40af' }} 
                />
                <Chip 
                  label={t('consentDlg.legal.pol.name')} 
                  size="small" 
                  sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#dbeafe', color: '#1e40af' }} 
                />
                <Chip 
                  label={t('consentDlg.law.copyright')} 
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
                {t('consentDlg.preview.sourcesLabel')} datatilsynet.no • lovdata.no
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, textAlign: 'center', fontSize: '0.6rem', fontStyle: 'italic' }}>{t('consentDlg.preview.tariffNote')}</Typography>
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
      container={() => document.body}
      sx={{
        zIndex: consentModalZIndex,
        '& .MuiBackdrop-root': {
          zIndex: consentModalBackdropZIndex,
          bgcolor: 'rgba(8,5,20,0.86)',
          backdropFilter: 'blur(3px)',
        },
      }}
      PaperProps={{
        sx: {
          '--dialog-accent-color': CONSENT_DIALOG_ACCENT,
          '--dialog-accent-hover': 'rgba(184,107,255,0.15)',
          '--dialog-border-color': 'rgba(184,107,255,0.34)',
          '--dialog-text': '#ffffff',
          bgcolor: 'rgba(20,14,48,0.94)',
          color: 'var(--dialog-text)',
          border: '1px solid var(--dialog-border-color)',
          borderRadius: { xs: 0, sm: 2.5 },
          backgroundImage: [
            'linear-gradient(180deg, rgba(8,5,20,0.9) 0%, rgba(10,7,28,0.9) 100%)',
            'radial-gradient(circle at 16% -24%, rgba(184,107,255,0.28), transparent 55%)',
            'radial-gradient(circle at 82% -10%, rgba(106,76,207,0.24), transparent 48%)',
          ].join(', '),
          backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
          boxShadow: '0 28px 52px rgba(0,0,0,0.46)',
          maxHeight: '90vh',
          zIndex: consentModalZIndex,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid var(--dialog-border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: { xs: 2.25, sm: 2.5 },
        px: { xs: 2.5, sm: 3.5 },
        background: 'linear-gradient(180deg, rgba(184,107,255,0.14) 0%, rgba(184,107,255,0.04) 100%)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: 'rgba(184,107,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ConsentsIcon sx={{ color: 'var(--dialog-accent-color)', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {existingConsent ? t('consentDlg.title.send') : t('consentDlg.title.new')}
            </Typography>
            {candidate && (
              <Typography variant="body2" sx={{ color: 'var(--dialog-text)' }}>
                {t('consentDlg.toLabel')} {candidate.name}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label={t('consentDlg.aria.close')}
          sx={{
            color: 'var(--dialog-text)',
            border: '1px solid var(--dialog-border-color)',
            bgcolor: 'rgba(255,255,255,0.02)',
            '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: { xs: 3, sm: 3.5 }, px: { xs: 0, sm: 0 }, pb: { xs: 3.25, sm: 3.75 }, maxHeight: { xs: 'none', sm: '72vh' }, overflowY: 'auto' }}>
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
                {copySuccess ? t('consentDlg.copied') : t('consentDlg.copyLink')}
              </Button>
            }
          >
            {t('consentDlg.alert.sentCode')} <strong>{generatedCode}</strong>
          </Alert>
        )}

        {/* Step Content */}
        <Box sx={{ px: 3, pb: 3 }}>
          {/* Step 0: Select consent type */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
                {t('consentDlg.step0.prompt', { name: candidate?.name || t('consentDlg.step0.candidateFallback') })}
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
                    color: 'var(--role-cyan, #00d4ff)',
                    '& .MuiAlert-icon': { color: 'var(--role-cyan, #00d4ff)' },
                  }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={() => setShowLegalReferences(!showLegalReferences)}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {showLegalReferences ? t('consentDlg.hideSources') : t('consentDlg.showSources')}
                    </Button>
                  }
                >
                  <Typography variant="body2">
                    {t('consentDlg.alert.compliesPrefix')} <strong>GDPR</strong>, <strong>{t('consentDlg.law.personalData')}</strong>, <strong>{t('consentDlg.law.copyright')}</strong> {t('consentDlg.alert.andLabel')} <strong>{t('consentDlg.law.nsfTariff')}</strong>.
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
                    <Typography variant="subtitle2" sx={{ color: '#10b981', mb: 1.5, fontWeight: 600 }}>{t('consentDlg.legalSourcesTitle')}</Typography>
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
                      <Typography fontWeight={600}>{t('consentDlg.section.production')}</Typography>
                      <Chip 
                        label={t('consentDlg.chip.important')} 
                        size="small" 
                        sx={{ bgcolor: '#f59e0b30', color: '#f59e0b', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2.5}>
                      {/* Production Type */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1.5 }}>{t('consentDlg.field.productionType')}</Typography>
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
                          <PhotoIcon sx={{ fontSize: 18 }} />{t('consentDlg.field.materialQuestion')}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1.5, display: 'block' }}>{t('consentDlg.field.materialRef')}</Typography>
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
                          <strong>{t('consentDlg.info.tariffLabel')}</strong> {t('consentDlg.info.tariffText')}
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
                      <Typography fontWeight={600}>{t('consentDlg.section.basic')}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <TextField
                        label={t('consentDlg.field.title')}
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder={config.defaultTitle}
                        fullWidth
                        helperText={t('consentDlg.field.titleHelp')}
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
                        label={t('consentDlg.field.description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={config.description}
                        multiline
                        rows={3}
                        fullWidth
                        helperText={t('consentDlg.field.descHelp')}
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
                      <Typography fontWeight={600}>{t('consentDlg.section.usage')}</Typography>
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
                          <VideoIcon sx={{ fontSize: 18 }} />{t('consentDlg.usage.productionPurposes')}</Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.productionUse} 
                                onChange={(e) => setUsageRights({...usageRights, productionUse: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label={t('consentDlg.usage.inProduction')}
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
                            label={t('consentDlg.usage.promotion')}
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
                            label={t('consentDlg.usage.behindScenes')}
                            sx={{ color: '#fff' }}
                          />
                        </FormGroup>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Web publishing */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WebIcon sx={{ fontSize: 18 }} />{t('consentDlg.usage.webPublishing')}</Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.internalUse} 
                                onChange={(e) => setUsageRights({...usageRights, internalUse: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label={t('consentDlg.usage.internalOnly')}
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
                            label={t('consentDlg.passwordWeb')}
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
                            label={t('consentDlg.openWeb')}
                            sx={{ color: '#fff' }}
                          />
                        </FormGroup>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Social media */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PublicIcon sx={{ fontSize: 18 }} />{t('consentDlg.usage.socialMedia')}</Typography>
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
                          label={t('consentDlg.usage.allowSocial')}
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
                          <PrintIcon sx={{ fontSize: 18 }} />{t('consentDlg.usage.printMedia')}</Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.printMedia} 
                                onChange={(e) => setUsageRights({...usageRights, printMedia: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label={t('consentDlg.usage.printedMatter')}
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
                            label={t('consentDlg.pressRelease')}
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
                      <Typography fontWeight={600}>{t('consentDlg.section.territory')}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {/* Territory */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>{t('consentDlg.field.geoArea')}</Typography>
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
                              label={t('consentDlg.territory.norwayOnly')} 
                              sx={{ color: '#fff' }}
                            />
                            <FormControlLabel 
                              value="nordic" 
                              control={<Radio sx={{ color: config.color, '&.Mui-checked': { color: config.color } }} />} 
                              label={t('consentDlg.territory.nordic')} 
                              sx={{ color: '#fff' }}
                            />
                            <FormControlLabel 
                              value="worldwide" 
                              control={<Radio sx={{ color: config.color, '&.Mui-checked': { color: config.color } }} />} 
                              label={t('consentDlg.territory.worldwide')} 
                              sx={{ color: '#fff' }}
                            />
                          </RadioGroup>
                        </FormControl>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                      {/* Special rights */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>{t('consentDlg.field.specialRights')}</Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={
                              <Checkbox 
                                checked={usageRights.editingAllowed} 
                                onChange={(e) => setUsageRights({...usageRights, editingAllowed: e.target.checked})}
                                sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                              />
                            }
                            label={t('consentDlg.usage.editingCrop')}
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
                            label={t('consentDlg.nameCredit')}
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
                              label={t('consentDlg.voiceover')}
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
                      <StorageIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />
                      <Typography fontWeight={600}>{t('consentDlg.section.retention')}</Typography>
                      <Chip 
                        label="GDPR" 
                        size="small" 
                        sx={{ bgcolor: '#8b5cf630', color: 'var(--role-violet, #8b5cf6)', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <FormControl fullWidth>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.field.retentionPeriod')}</InputLabel>
                        <Select
                          value={retentionSettings.retentionPeriod}
                          onChange={(e) => setRetentionSettings({...retentionSettings, retentionPeriod: e.target.value as RetentionSettings['retentionPeriod']})}
                          label={t('consentDlg.field.retentionPeriod')}
                          MenuProps={consentMenuProps}
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: config.color },
                            '& .MuiSvgIcon-root': { color: '#fff' },
                          }}
                        >
                          <MenuItem value="project_duration">{t('consentDlg.retention.projectDuration')}</MenuItem>
                          <MenuItem value="1_year">{t('consentDlg.retention.1year')}</MenuItem>
                          <MenuItem value="3_years">{t('consentDlg.retention.3years')}</MenuItem>
                          <MenuItem value="5_years">{t('consentDlg.retention.5years')}</MenuItem>
                          <MenuItem value="indefinite">{t('consentDlg.retention.indefiniteOption')}</MenuItem>
                          <MenuItem value="custom">{t('consentDlg.retention.custom')}</MenuItem>
                        </Select>
                      </FormControl>

                      {retentionSettings.retentionPeriod === 'custom' && (
                        <TextField
                          label={t('consentDlg.field.months')}
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
                          label={t('consentDlg.retention.deleteAfter')}
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
                          label={t('consentDlg.retention.archive')}
                          sx={{ color: '#fff' }}
                        />
                      </FormGroup>

                      <Alert severity="info" sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
                        <Typography variant="body2">{t('consentDlg.retention.gdprNote')}</Typography>
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
                      <Typography fontWeight={600}>{t('consentDlg.section.gdpr')}</Typography>
                      <Chip 
                        label={t('consentDlg.chip.required')} 
                        size="small" 
                        sx={{ bgcolor: '#ec489930', color: '#ec4899', fontSize: '0.7rem', height: 20 }} 
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <TextField
                        label={t('consentDlg.field.dataController')}
                        value={gdprSettings.dataController}
                        onChange={(e) => setGdprSettings({...gdprSettings, dataController: e.target.value})}
                        placeholder={project?.name || t('consentDlg.field.companyPlaceholder')}
                        fullWidth
                        required
                        helperText={t('consentDlg.field.dataControllerHelp')}
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
                        label={t('consentDlg.field.controllerContact')}
                        value={gdprSettings.dataControllerContact}
                        onChange={(e) => setGdprSettings({...gdprSettings, dataControllerContact: e.target.value})}
                        placeholder={t('consentDlg.placeholder.emailPhone')}
                        fullWidth
                        helperText={t('consentDlg.field.controllerContactHelp')}
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
                        label={t('consentDlg.thirdParty')}
                        sx={{ color: '#fff' }}
                      />

                      <Collapse in={gdprSettings.thirdPartySharing}>
                        <TextField
                          label={t('consentDlg.field.thirdPartyWho')}
                          value={gdprSettings.thirdPartyDetails}
                          onChange={(e) => setGdprSettings({...gdprSettings, thirdPartyDetails: e.target.value})}
                          placeholder={t('consentDlg.placeholder.thirdParty')}
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
                            <span>{t('consentDlg.transferEEA')}</span>
                            <Tooltip title={t('consentDlg.tooltip.eeaSafeguards')}>
                              <WarningIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            </Tooltip>
                          </Box>
                        }
                        sx={{ color: '#fff' }}
                      />

                      <Collapse in={gdprSettings.transferOutsideEEA}>
                        <Alert severity="warning" sx={{ mb: 1, bgcolor: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>{t('consentDlg.alert.eeaTransfer')}</Alert>
                        <TextField
                          label={t('consentDlg.field.transferDetails')}
                          value={gdprSettings.transferDetails}
                          onChange={(e) => setGdprSettings({...gdprSettings, transferDetails: e.target.value})}
                          placeholder={t('consentDlg.placeholder.transferDetails')}
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
                        label={t('consentDlg.field.withdrawalInfo')}
                        value={gdprSettings.withdrawalInfo}
                        onChange={(e) => setGdprSettings({...gdprSettings, withdrawalInfo: e.target.value})}
                        multiline
                        rows={2}
                        fullWidth
                        helperText={t('consentDlg.field.withdrawalHelp')}
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
                        <Typography fontWeight={600}>{t('consentDlg.section.minor')}</Typography>
                        <Chip 
                          label={t('consentDlg.chip.important')} 
                          size="small" 
                          sx={{ bgcolor: '#ec489950', color: '#fff', fontSize: '0.7rem', height: 20 }} 
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(236,72,153,0.2)', color: '#f9a8d4' }}>
                        <Typography variant="body2">{t('consentDlg.minor.info')}</Typography>
                      </Alert>
                      <Stack spacing={2}>
                        <TextField
                          label={t('consentDlg.field.childAge')}
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
                          label={t('consentDlg.field.guardianName')}
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
                          <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.field.relation')}</InputLabel>
                          <Select
                            value={minorSettings.guardianRelation}
                            onChange={(e) => setMinorSettings({...minorSettings, guardianRelation: e.target.value as MinorConsentSettings['guardianRelation']})}
                            label={t('consentDlg.field.relation')}
                            MenuProps={consentMenuProps}
                            sx={{
                              color: '#fff',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                              '& .MuiSvgIcon-root': { color: '#fff' },
                            }}
                          >
                            <MenuItem value="parent">{t('consentDlg.relation.parent')}</MenuItem>
                            <MenuItem value="guardian">{t('consentDlg.relation.guardian')}</MenuItem>
                            <MenuItem value="other">{t('consentDlg.relation.otherOption')}</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          label={t('consentDlg.field.guardianContact')}
                          value={minorSettings.guardianContact}
                          onChange={(e) => setMinorSettings({...minorSettings, guardianContact: e.target.value})}
                          placeholder={t('consentDlg.placeholder.emailPhone')}
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
                            label={t('consentDlg.field.childCoSign')}
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
                      <Typography fontWeight={600}>{t('consentDlg.section.notes')}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      label={t('consentDlg.field.internalNotes')}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      multiline
                      rows={3}
                      fullWidth
                      placeholder={t('consentDlg.placeholder.notes')}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                      }}
                    />
                    <GlobalMentionHelper
                      text={notes}
                      localCandidates={mentionCandidates}
                      onApplySuggestion={(name) => setNotes((prev) => applyMentionSuggestion(prev, name))}
                      autoTagTitle={t('consentDlg.mention.autoTag')}
                      suggestionTitle={t('consentDlg.mention.suggestion')}
                    />
                  </AccordionDetails>
                </Accordion>
              </Box>

              {/* Preview side */}
              <Box sx={{ flex: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PreviewIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.preview.heading')}</Typography>
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
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>{t('consentDlg.send.method')}</Typography>
                    
                    <Stack spacing={2}>
                      {/* Send method selection */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {[
                          { method: 'email' as const, icon: <EmailIcon />, label: t('consentDlg.send.email'), available: !!candidate?.contactInfo.email },
                          { method: 'sms' as const, icon: <SmsIcon />, label: 'SMS', available: !!candidate?.contactInfo.phone },
                          { method: 'link' as const, icon: <LinkIcon />, label: t('consentDlg.send.linkOnly'), available: true },
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
                        <Alert severity="info" sx={{ bgcolor: 'rgba(0,212,255,0.1)', color: 'var(--role-cyan, #00d4ff)' }}>
                          {t('consentDlg.send.contractTo')} <strong>{candidate.contactInfo.email}</strong>
                        </Alert>
                      )}

                      {sendMethod === 'sms' && candidate?.contactInfo.phone && (
                        <Alert severity="info" sx={{ bgcolor: 'rgba(0,212,255,0.1)', color: 'var(--role-cyan, #00d4ff)' }}>
                          {t('consentDlg.send.smsTo')} <strong>{candidate.contactInfo.phone}</strong>
                        </Alert>
                      )}

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

                      {/* Security options */}
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.send.security')}</Typography>

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={includePin}
                            onChange={(e) => setIncludePin(e.target.checked)}
                            sx={{ color: config.color, '&.Mui-checked': { color: config.color } }}
                          />
                        }
                        label={t('consentDlg.send.requirePin')}
                        sx={{ color: 'rgba(255,255,255,0.87)' }}
                      />

                      <Collapse in={includePin}>
                        <TextField
                          label={t('consentDlg.send.pinCode')}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder={t('consentDlg.send.pinPlaceholder')}
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
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.send.expiresAfter')}</InputLabel>
                        <Select
                          value={expiresDays}
                          onChange={(e) => setExpiresDays(Number(e.target.value))}
                          label={t('consentDlg.send.expiresAfter')}
                          MenuProps={consentMenuProps}
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                          }}
                        >
                          <MenuItem value={7}>{t('consentDlg.send.days', { n: 7 })}</MenuItem>
                          <MenuItem value={14}>{t('consentDlg.send.days', { n: 14 })}</MenuItem>
                          <MenuItem value={30}>{t('consentDlg.send.days', { n: 30 })}</MenuItem>
                          <MenuItem value={60}>{t('consentDlg.send.days', { n: 60 })}</MenuItem>
                          <MenuItem value={90}>{t('consentDlg.send.days', { n: 90 })}</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>

                  {/* Summary */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>{t('consentDlg.summary.heading')}</Typography>
                    
                    <Paper sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 3, borderRadius: 2 }}>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <config.IconComponent style={{ color: config.color, fontSize: 32 }} />
                          <Box>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.summary.type')}</Typography>
                            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                              {config.label}
                            </Typography>
                          </Box>
                        </Box>

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.summary.recipient')}</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {candidate?.name || t('consentDlg.notSelected')}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.summary.project')}</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {project?.name || t('consentDlg.notSelected')}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.summary.title')}</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {effectiveTitle}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('consentDlg.send.security')}</Typography>
                          <Typography variant="body1" sx={{ color: '#fff' }}>
                            {includePin ? t('consentDlg.summary.pinProtected', { pin: pin || '****' }) : t('consentDlg.summary.standardAccess')}
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
                  
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>{t('consentDlg.success.title')}</Typography>
                  
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
                    {t('consentDlg.success.received', { name: candidate?.name ?? '' })}
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
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>{t('consentDlg.success.accessCode')}</Typography>
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
                          {copySuccess ? t('consentDlg.copied') : t('consentDlg.copyLink')}
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
                        >{t('consentDlg.success.openPortal')}</Button>
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
        borderTop: '1px solid var(--dialog-border-color)',
        px: { xs: 2.25, sm: 3, md: 3.25 },
        py: { xs: 1.6, sm: 1.85, md: 1.95 },
        gap: 1.2,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        justifyContent: 'flex-end',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.03) 100%)',
      }}>
        {activeStep > 0 && !success && (
          <Button
            onClick={handleBack}
            startIcon={<BackIcon />}
            sx={{
              color: 'var(--dialog-text)',
              minHeight: TOUCH_TARGET_SIZE,
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              mr: 'auto',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >{t('consentDlg.btn.back')}</Button>
        )}

        <Button
          onClick={onClose}
          sx={{
            color: 'var(--dialog-text)',
            minHeight: TOUCH_TARGET_SIZE,
            border: '1px solid var(--dialog-border-color)',
            bgcolor: 'rgba(255,255,255,0.02)',
            '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
          }}
        >
          {success ? t('consentDlg.btn.close') : t('consentDlg.btn.cancel')}
        </Button>

        {!success && (
          activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NextIcon />}
              sx={{
                bgcolor: 'var(--dialog-accent-color)',
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                fontWeight: 700,
                boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
                '&:hover': { bgcolor: 'var(--dialog-accent-color)', filter: 'brightness(0.92)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
              }}
            >{t('consentDlg.btn.next')}</Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleGenerateAndSend}
              disabled={sending}
              startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              sx={{
                bgcolor: '#10b981',
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                fontWeight: 700,
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              {sending ? t('consentDlg.btn.sending') : t('consentDlg.btn.send')}
            </Button>
          )
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ConsentContractDialog;
