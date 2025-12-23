import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
/**
 * CreatorHub Norge - Tutorial System Constants
 * Comprehensive mapping of all platform components and services
 */

export interface TutorialDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  profession: string[];
  component: string;
  scenario: string;
  keyFeatures: string[];
  implementationStatus: 'planned' | 'in_development' | 'completed'
}

// Complete tutorial database for all 762 universal components
export const ALL_PLATFORM_TUTORIALS: TutorialDefinition[] = [
  // Core Platform Components
  {
    id: 'universal-dashboard',
    title: 'Universal Dashboard System',
    description: 'Hovedkontrollpanel som tilpasser seg din profesjon',
    category: 'core',
    difficulty: 'beginner',
    duration: '15 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'UniversalDashboard',
    scenario: 'Du logger inn første gang og må forstå hvordan dashboardet fungerer.',
    keyFeatures: ['5-tabs layout','Profession adaptation','Widget customization','Real-time updates'],
    implementationStatus: 'planned'
},

  // Google Integration Ecosystem (45 components)
  {
    id: 'google-drive-manager',
    title: 'Google Drive Mappestruktur',
    description: 'Automatisk opprettelse av profesjonelle mappestrukturer',
    category: 'google-integration',
    difficulty: 'beginner',
    duration: '18 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'GoogleDriveManager',
    scenario: 'Du starter nytt prosjekt og trenger organisert filstruktur i Google Drive.',
    keyFeatures: ['Auto-folder creation','Template structures','Permission management','GDPR compliance'],
    implementationStatus: 'planned'
},
  
  {
    id: 'google-meet-integration',
    title: 'Smart Meeting Forberedelser',
    description: 'Intelligent forberedelse av Google Meet møter med dokumenter',
    category: 'google-integration', 
    difficulty: 'intermediate',
    duration: '25 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'GoogleMeetIntegration',
    scenario: 'Du skal ha møte med klient og trenger alle dokumenter og kontrakter klare.',
    keyFeatures: ['Document preparation','Contract integration','Timeline sync','Auto-agenda'],
    implementationStatus: 'planned'
},

  // Photography-Specific Components
  {
    id: 'camera-detection',
    title: 'Kameradeteksjon og Kompatibilitet',
    description: 'Automatisk gjenkjenning av kamerautstyr og minnekort',
    category: 'profession-photography',
    difficulty: 'beginner',
    duration: '12 min',
    profession: [''],
    component: 'CameraDetection',
    scenario: 'Du kobler til nytt kamera og må sjekke kompatibilitet og backup.',
    keyFeatures: ['Auto-detection','Compatibility check','Memory card analysis','Backup setup'],
    implementationStatus: 'planned'
},

  {
    id: 'lighting-simulator',
    title: '3D Lysoppsett Simulator',
    description: 'Planlegg profesjonelle lysoppsett i 3D milj, ø',
    category: 'profession-photography',
    difficulty: 'advanced',
    duration: '35 min',
    profession: [''],
    component: 'LightingSimulator',
    scenario: 'Du skal planlegge komplekst studiooppsett og vil teste lys før fotografering.',
    keyFeatures: ['3D visualization','Equipment library','Light calculations','Setup export'],
    implementationStatus: 'planned'
},

  // Video Production Components
  {
    id: 'video-studio',
    title: 'Intelligent Video Produksjonsstudio',
    description: 'Avansert video editing med Intelligent-assistanse',
    category: 'profession-videography',
    difficulty: 'advanced',
    duration: '45 min',
    profession: [''],
    component: 'AIVideoStudio',
    scenario: 'Du skal produsere komplett video med Intelligent fra råmateriale til ferdig produkt.',
    keyFeatures: ['Intelligent editing','Auto-cuts','Color grading','Audio sync'],
    implementationStatus: 'planned'
},

  {
    id: 'davinci-integration',
    title: 'DaVinci Resolve Integrasjon',
    description: 'Sømløs kobling med professional editing software',
    category: 'profession-videography',
    difficulty: 'intermediate',
    duration: '28 min',
    profession: [', '],
    component: 'DaVinciIntegration',
    scenario: 'Du bruker DaVinci Resolve og vil integrere workflow med CreatorHub Norge.',
    keyFeatures: ['Project sync','Asset management','Render queue','Backup integration'],
    implementationStatus: 'planned'
},

  // Music Production Components
  {
    id: 'plugin-detection',
    title: 'Pro Tools Plugin Deteksjon',
    description: 'Scann og administrer ditt plugin-bibliotek',
    category: 'profession-music',
    difficulty: 'intermediate',
    duration: '18 min',
    profession: ['music_producer', ],
    component: 'PluginDetection',
    scenario: 'Du skal åpne prosjekt fra kollega og må sjekke plugin-kompatibilitet.',
    keyFeatures: ['XML parsing','Plugin inventory','Compatibility check','Missing plugin alerts'],
    implementationStatus: 'completed'
},

  {
    id: 'audio-enhancement',
    title: 'Intelligent Audio Enhancement',
    description: 'Profesjonell audio processing med Intelligent',
    category: 'profession-music',
    difficulty: 'advanced',
    duration: '42 min',
    profession: ['music_producer', ],
    component: 'AudioEnhancement',
    scenario: 'Du har råopptak som trenger profesjonell prosessering og mastering.',
    keyFeatures: ['Noise reduction','Auto-mastering','Spectral analysis','Plugin suggestions'],
    implementationStatus: 'planned'
},

  // Vendor/Business Components
  {
    id: 'brreg-integration',
    title: 'BRREG Forretningsintegrasjon',
    description: 'Norsk virksomhetsregistrering og MVA-håndtering',
    category: 'profession-vendor',
    difficulty: 'intermediate',
    duration: '30 min',
    profession: [''],
    component: 'BRREGIntegration',
    scenario: 'Du skal registrere virksomheten og sette opp norsk regnskapsintegrasjon.',
    keyFeatures: ['BRREG lookup','MVA calculation','Invoice generation','Tax reporting'],
    implementationStatus: 'planned'
},

  // Intelligent Tools & Enhancement
  {
    id: 'ai-photo-enhancer',
    title: 'Intelligent Foto Forbedring',
    description: 'Profesjonell bildeforbedring med Intelligent teknologi',
    category: 'ai-tools',
    difficulty: 'intermediate',
    duration: '25 min',
    profession: ['photographer','videographer'],
    component: 'AIPhotoEnhancer',
    scenario: 'Du har bilder som trenger forbedring og vil bruke Intelligent for profesjonelle resultater.',
    keyFeatures: ['Auto-enhance','Noise reduction','Upscaling','Style transfer'],
    implementationStatus: 'planned'
},

  {
    id: 'ai-writing-assistant',
    title: 'Intelligent Skriveassistent',
    description: 'Intelligent tekstgenerering for markedsføring',
    category: 'ai-tools',
    difficulty: 'beginner',
    duration: '20 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'AIWritingAssistant',
    scenario: 'Du trenger profesjonelle tekster for sosiale medier og markedsføring.',
    keyFeatures: ['Content generation','SEO optimization','Brand voice','Multi-language'],
    implementationStatus: 'planned'
},

  // Technical Components
  {
    id: 'keyboard-shortcuts',
    title: 'Intelligent Tastatursnarveger',
    description: 'Automatisk oppdaterte snarveier for editing-software',
    category: 'technical',
    difficulty: 'intermediate',
    duration: '16 min',
    profession: ['photographer','videographer','music_producer'],
    component: 'KeyboardShortcuts',
    scenario: 'Du vil jobbe mer effektivt og trenger oppdaterte snarveier for dine programmer.',
    keyFeatures: ['Auto-updates','Mac/PC detection','Software integration','Custom shortcuts'],
    implementationStatus: 'planned'
},

  {
    id: 'equipment-management',
    title: 'Utstyrshåndtering og Firmware',
    description: 'Komplett administrasjon av teknisk utstyr',
    category: 'technical',
    difficulty: 'advanced',
    duration: '38 min',
    profession: ['photographer','videographer','music_producer'],
    component: 'EquipmentManagement',
    scenario: 'Du har mye utstyr som trenger oppgradering og vedlikehold.',
    keyFeatures: ['Firmware tracking','Update notifications','Maintenance scheduling','Compatibility matrix'],
    implementationStatus: 'planned'
},

  // Mobile Platform
  {
    id: 'mobile-dashboard',
    title: 'Mobil Dashboard',
    description: 'Mobile-first interface optimalisert for alle profesjoner',
    category: 'mobile',
    difficulty: 'beginner',
    duration: '14 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'MobileDashboard',
    scenario: 'Du er på farten og trenger full tilgang til plattformen fra mobilen.',
    keyFeatures: ['Touch optimization','Offline mode','Quick actions','Voice commands'],
    implementationStatus: 'planned'
},

  // Backup & Security
  {
    id: 'enterprise-backup',
    title: 'Enterprise Backup System',
    description: 'Profesjonell backup med Google Drive integrasjon',
    category: 'technical',
    difficulty: 'advanced',
    duration: '32 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'EnterpriseBackup',
    scenario: 'Du trenger sikker backup av alle prosjekter og vil automatisere prosessen.',
    keyFeatures: ['Automated backup','Compression','Versioning','Recovery tools'],
    implementationStatus: 'planned'
},

  // Client Management
  {
    id: 'client-delivery',
    title: 'Klient Leveringssystem',
    description: 'Profesjonell leveranse av ferdige prosjekter',
    category: 'core',
    difficulty: 'intermediate',
    duration: '22 min',
    profession: ['photographer','videographer','music_producer'],
    component: 'ClientDelivery',
    scenario: 'Prosjektet er ferdig og du skal levere til klient på profesjonell måte.',
    keyFeatures: ['Showcase galleries','Download packages','Client feedback','Version control'],
    implementationStatus: 'planned'
},

  // Contract Management
  {
    id: 'contract-system',
    title: 'Automatisk Kontraktssystem',
    description: 'Generering og administrasjon av norske kontrakter',
    category: 'business',
    difficulty: 'intermediate',
    duration: '26 min',
    profession: ['photographer','videographer','music_producer','vendor'],
    component: 'ContractSystem',
    scenario: 'Du skal opprette profesjonell kontrakt for nytt oppdrag med norske standarder.',
    keyFeatures: ['Template generation','Digital signatures','Legal compliance','Payment integration'],
    implementationStatus: 'planned'
}
];

// Tutorial categories for organization
export const TUTORIAL_CATEGORIES = {
  core: {
    title: 'Kjernefunksjoner',
    description: 'Grunnleggende platform-funksjoner som alle bruker',
    color: '#2196F3'
}, 'google-integration': {
    title: 'Google Integrasjon',
    description: 'Komplett økosystem for Google-tjenester',
    color: '#4285F4'
}'profession-photography': {
    title: 'Fotografi Verktø',
    description: 'Spesialiserte verktøy for fotografer',
    color: '#FF9800'
}'profession-videography': {
    title: 'Video Produksjon',
    description: 'Avanserte video editing og produksjon verktø',
    color: '#9C27B0'
}'profession-music': {
    title: 'Musikk Produksjon',
    description: 'Audio produksjon og plugin management',
    color: '#FF5722'
}'profession-vendor': {
    title: 'Forretning & Leverandø',
    description: 'Norsk forretningsoptimalisering og leverandør verktø',
    color: '#4CAF50'
}'ai-tools': {
    title: 'Intelligent-verktø',
    description: 'Kunstig intelligens for kreativ arbeid',
    color: '#FF9800'
},
  technical: {
    title: 'Tekniske Verktø',
    description: 'Avanserte tekniske funksjoner og integrasjoner',
    color: '#607D8B'
},
  mobile: {
    title: 'Mobil Platform',
    description: 'Mobile-first funksjoner og responsiv design',
    color: '#E91E63'
},
  business: {
    title: 'Forretning',
    description: 'Kontrakter, fakturering og norsk compliance',
    color: '#795548'
}
};