/**
 * Universal Dashboard Component Registry
 * Comprehensive registry of all components connected to UniversalDashboard.tsx
 * Enables Visual Editor to manage and customize every dashboard component
 */

export interface ComponentMetadata {
  id: string;
  name: string;
  category: 'orchestrator' | 'management' | 'communication' | 'showcase' | 'settings' | 'integration' | 'ai' | 'file' | 'equipment' | 'contract' | 'crm' | 'tutorial' | 'modal' | 'system' | 'admin' | 'business' | 'security' | 'format' | 'content' | 'accessibility' | 'testing' | 'calendar' | 'cms' | 'onboarding' | 'form' | 'marketing' | 'ui' | 'dashboard' | 'video' | 'project' | 'analytics' | 'landing' | 'academy' | 'community' | 'company' | 'legal' | 'pricing' | 'wedding' | 'vendor' | 'email' | 'seo' | 'prototype';
  description: string;
  profession: ('photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin')[];
  tabIndex?: number;
  dependencies: string[];
  props: {
    required: string[];
    optional: string[];
};
  customization: {
    styles: string[];
    layout: string[];
    behavior: string[];
};
  visualEditor: {
    editable: boolean;
    previewable: boolean;
    templateable: boolean;
    propsEditable: boolean;
};
  filePath: string;
  importPath: string;
}

export const UNIVERSAL_DASHBOARD_COMPONENTS: ComponentMetadata[] = [
  // PROFESSION-SPECIFIC ORCHESTRATORS
  {
    id: 'fotograf-orchestrator',
    name: 'FotografOrchestrator',
    category: 'orchestrator',
    description: 'Main orchestrator for photographer profession workflow management',
    profession: [''],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['profession','userId','onProjectUpdate','onWorklogCreate']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tabs'],
      behavior: ['workflow','navigation','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/FotografOrchestrator.tsx',
    importPath: './FotografOrchestrator'
},

  // WEDDING TIMELINE COMPONENTS
  {
    id: 'wedding-timeline-admin',
    name: 'WeddingTimelineAdmin',
    category: 'management',
    description: 'Wedding timeline administration and management interface',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTimelineUpdate','onTimelineCreate']
  },
    customization: {
      styles: ['layout','forms','tables','colors'],
      layout: ['grid','cards','tabs'],
      behavior: ['timeline','management','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineAdmin.tsx',
    importPath: '../wedding/WeddingTimelineAdmin'
},
  {
    id: 'wedding-timeline-client',
    name: 'WeddingTimelineClient',
    category: 'management',
    description: 'Wedding timeline client view and interaction interface',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onClientInteraction','readOnly']
  },
    customization: {
      styles: ['layout','timeline','colors','animations'],
      layout: ['timeline','cards','grid'],
      behavior: ['interaction','validation','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineClient.tsx',
    importPath: '../wedding/WeddingTimelineClient'
},
  {
    id: 'wedding-timeline-client-access',
    name: 'WeddingTimelineClientAccess',
    category: 'management',
    description: 'Wedding timeline client access control and permissions',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','accessLevel','onAccessChange']
  },
    customization: {
      styles: ['layout','forms','colors'],
      layout: ['grid','cards','forms'],
      behavior: ['permissions','validation','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineClientAccess.tsx',
    importPath: '../wedding/WeddingTimelineClientAccess'
},
  {
    id: 'wedding-timeline-client-view',
    name: 'WeddingTimelineClientView',
    category: 'management',
    description: 'Wedding timeline client viewing interface',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','viewMode','onViewChange']
  },
    customization: {
      styles: ['layout','timeline','colors'],
      layout: ['timeline','grid','cards'],
      behavior: ['viewing','navigation','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineClientView.tsx',
    importPath: '../wedding/WeddingTimelineClientView'
},
  {
    id: 'wedding-timeline-changes-overview',
    name: 'WeddingTimelineChangesOverview',
    category: 'management',
    description: 'Wedding timeline changes tracking and overview',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onChangeSelect','showHistory']
  },
    customization: {
      styles: ['layout','tables','colors'],
      layout: ['grid','tables','cards'],
      behavior: ['tracking','history','comparison']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineChangesOverview.tsx',
    importPath: '../wedding/WeddingTimelineChangesOverview'
},
  {
    id: 'wedding-timeline-overview',
    name: 'WeddingTimelineOverview',
    category: 'management',
    description: 'Wedding timeline overview and summary interface',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','summaryLevel','onOverviewAction']
  },
    customization: {
      styles: ['layout','cards','colors'],
      layout: ['grid','cards','summary'],
      behavior: ['overview','summary','navigation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineOverview.tsx',
    importPath: '../wedding/WeddingTimelineOverview'
},

  // COMMUNICATION & CHAT COMPONENTS
  {
    id: 'universal-chat-widget',
    name: 'UniversalChatWidget',
    category: 'communication',
    description: 'Universal chat widget for all communication needs',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onMessageSend','chatType','participants']
  },
    customization: {
      styles: ['layout','chat','colors','animations'],
      layout: ['chat','sidebar','main'],
      behavior: ['messaging','notifications','real-time']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/UniversalChatWidget.tsx',
    importPath: '../chat/UniversalChatWidget'
},
  
  // CHAT PRIVACY CONSENT
  {
    id: 'chat-privacy-consent',
    name: 'ChatPrivacyConsent',
    category: 'communication',
    description: 'GDPR-compliant privacy consent dialog for chat communication',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','react'],
    props: {
      required: ['open','customerName','onAccept','onDecline'],
      optional: ['projectName','profession','userEmail']
  },
    customization: {
      styles: ['layout','privacy','colors','typography'],
      layout: ['dialog','consent','buttons'],
      behavior: ['privacy','consent','gdpr']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/ChatPrivacyConsent.tsx',
    importPath: '../chat/ChatPrivacyConsent'
},
  
  // EMAIL CHAT INTEGRATION
  {
    id: 'email-chat-integration',
    name: 'EmailChatIntegration',
    category: 'communication',
    description: 'Integrates email messages with Google Chat threads',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['profession','userEmail','onEmailSent','onChatCreated']
  },
    customization: {
      styles: ['layout','email','chat','colors'],
      layout: ['integration','email','chat'],
      behavior: ['email','chat','integration','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/EmailChatIntegration.tsx',
    importPath: '../chat/EmailChatIntegration'
},
  
  // EXTERNAL COLLABORATOR INTERFACE
  {
    id: 'external-collaborator-interface',
    name: 'ExternalCollaboratorInterface',
    category: 'communication',
    description: 'Interface for managing external collaborators and team members',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['projectI','profession','onCollaboratorAdd','onCollaboratorRemove']
  },
    customization: {
      styles: ['layout','collaborators','colors','cards'],
      layout: ['interface','collaborators','management'],
      behavior: ['collaboration','management','external']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/ExternalCollaboratorInterface.tsx',
    importPath: '../chat/ExternalCollaboratorInterface'
},
  
  // EXTERNAL COLLABORATOR ONBOARDING
  {
    id: 'external-collaborator-onboarding',
    name: 'ExternalCollaboratorOnboarding',
    category: 'communication',
    description: 'Onboarding process for external collaborators with role and permission setup',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','react'],
    props: {
      required: ['open','onClose','onComplete'],
      optional: ['profession','userEmail','onStepChange','onPermissionSet']
  },
    customization: {
      styles: ['layout','onboarding','stepper','colors'],
      layout: ['onboarding','stepper','forms'],
      behavior: ['onboarding','permissions','collaboration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/ExternalCollaboratorOnboarding.tsx',
    importPath: '../chat/ExternalCollaboratorOnboarding'
},
  {
    id: 'fullscreen-chat-widget',
    name: 'FullscreenChatWidget',
    category: 'communication',
    description: 'Fullscreen chat widget for immersive communication',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onMessageSend','fullscreenMode','participants']
  },
    customization: {
      styles: ['layout','chat','colors','fullscreen'],
      layout: ['fullscreen','chat','overlay'],
      behavior: ['messaging','fullscreen','immersion']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/FullscreenChatWidget.tsx',
    importPath: '../chat/FullscreenChatWidget'
},
  {
    id: 'advanced-chat-protocols',
    name: 'AdvancedChatProtocols',
    category: 'communication',
    description: 'Advanced chat protocols and communication features',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','protocols','onProtocolChange']
  },
    customization: {
      styles: ['layout','protocols','colors'],
      layout: ['grid','cards','tabs'],
      behavior: ['protocols','communication','advanced']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/AdvancedChatProtocols.tsx',
    importPath: '../chat/AdvancedChatProtocols'
},
  {
    id: 'chat-widget',
    name: 'ChatWidget',
    category: 'communication',
    description: 'Basic chat widget for simple communication',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onMessageSend','simpleMode']
  },
    customization: {
      styles: ['layout','chat','colors'],
      layout: ['chat','simple','compact'],
      behavior: ['messaging','simple','basic']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/communication/ChatWidget.tsx',
    importPath: '../communication/ChatWidget'
},

  // FILE & ASSET MANAGEMENT COMPONENTS
  {
    id: 'asset-browser',
    name: 'AssetBrowser',
    category: 'file',
    description: 'Comprehensive asset browser for file management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileSelect','fileTypes','browseMode']
  },
    customization: {
      styles: ['layout','browser','colors','grid'],
      layout: ['grid','list','tiles','browser'],
      behavior: ['browsing','selection','preview','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AssetBrowser.tsx',
    importPath: '../AssetBrowser'
},
  {
    id: 'memory-card-manager',
    name: 'MemoryCardManager',
    category: 'file',
    description: 'Memory card management and backup system',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCardBackup','onCardFormat','cardType']
  },
    customization: {
      styles: ['layout','cards','colors','progress'],
      layout: ['grid','cards','tabs'],
      behavior: ['backup','formatting','management','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/MemoryCardManager.tsx',
    importPath: '../MemoryCardManager'
},
  {
    id: 'memory-card-backup-manager',
    name: 'MemoryCardBackupManager',
    category: 'file',
    description: 'Advanced memory card backup management system',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onBackupComplete','backupSettings','autoBackup']
  },
    customization: {
      styles: ['layout','backup','colors','progress'],
      layout: ['grid','cards','tabs','settings'],
      behavior: ['backup','scheduling','monitoring','automation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupManager.tsx',
    importPath: '../memory-card/MemoryCardBackupManager'
},
  {
    id: 'memory-card-backup-panel',
    name: 'MemoryCardBackupPanel',
    category: 'file',
    description: 'Memory card backup panel interface',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onBackupStart','panelMode','quickBackup']
  },
    customization: {
      styles: ['layout','panel','colors','compact'],
      layout: ['panel','compact','sidebar'],
      behavior: ['backup','quick','panel','interface']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupPanel.tsx',
    importPath: '../memory-card/MemoryCardBackupPanel'
},
  {
    id: 'file-detection-dashboard-widget',
    name: 'FileDetectionDashboardWidget',
    category: 'file',
    description: 'File detection dashboard widget for monitoring',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileDetected','detectionTypes','autoProcess']
  },
    customization: {
      styles: ['layout','widget','colors','compact'],
      layout: ['widget','compact','dashboard'],
      behavior: ['detection','monitoring','automation','alerts']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/FileDetectionDashboardWidget.tsx',
    importPath: '../FileDetectionDashboardWidget'
},
  {
    id: 'recent-uploads-widget',
    name: 'RecentUploadsWidget',
    category: 'file',
    description: 'Recent uploads widget for file tracking',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onUploadSelect','uploadLimit','showProgress']
  },
    customization: {
      styles: ['layout','widget','colors','list'],
      layout: ['widget','list','compact'],
      behavior: ['tracking','uploads','recent','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/RecentUploadsWidget.tsx',
    importPath: '../RecentUploadsWidget'
},

  // SPECIALIZED TOOL COMPONENTS
  {
    id: 'photography-tips-overlay',
    name: 'PhotographyTipsOverlay',
    category: 'ai',
    description: 'Photography tips overlay for contextual guidance',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTipSelect','tipCategories','overlayMode']
  },
    customization: {
      styles: ['layout','overlay','colors','animations'],
      layout: ['overlay','floating','modal'],
      behavior: ['tips','guidance','contextual','overlay']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/PhotographyTipsOverlay.tsx',
    importPath: '../photography-tips/PhotographyTipsOverlay'
},
  {
    id: 'camera-detector',
    name: 'CameraDetector',
    category: 'equipment',
    description: 'Camera detection and identification system',
    profession: ['photographer','videographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCameraDetected','detectionMode','autoConnect']
  },
    customization: {
      styles: ['layout','detector','colors','status'],
      layout: ['detector','status','cards'],
      behavior: ['detection','identification','connection','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/CameraDetector.tsx',
    importPath: '../photography-tips/CameraDetector'
},
  {
    id: 'contextual-photography-tips-overlay',
    name: 'ContextualPhotographyTipsOverlay',
    category: 'ai',
    description: 'Contextual photography tips overlay with smart suggestions',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTipAction','contextMode','smartSuggestions']
  },
    customization: {
      styles: ['layout','overlay','colors','smart'],
      layout: ['overlay','contextual','smart'],
      behavior: ['contextual','smart','suggestions','adaptive']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography/ContextualPhotographyTipsOverlay.tsx',
    importPath: '../photography/ContextualPhotographyTipsOverlay'
},
  {
    id: 'photography-tips-center',
    name: 'PhotographyTipsCenter',
    category: 'ai',
    description: 'Photography tips center for comprehensive guidance',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTipCategory','tipLevel','personalized']
  },
    customization: {
      styles: ['layout','center','colors','comprehensive'],
      layout: ['center','comprehensive','tabs'],
      behavior: ['comprehensive','categorized','personalized','learning']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/PhotographyTipsCenter.tsx',
    importPath: '../photography-tips/PhotographyTipsCenter'
},
  {
    id: 'camera-selection-step',
    name: 'CameraSelectionStep',
    category: 'equipment',
    description: 'Camera selection step for onboarding process',
    profession: ['photographer','videographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCameraSelect','selectionMode','onboardingStep']
  },
    customization: {
      styles: ['layout','selection','colors','onboarding'],
      layout: ['selection','onboarding','steps'],
      behavior: ['selection','onboarding','guided','step-by-step']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/onboarding/CameraSelectionStep.tsx',
    importPath: '../onboarding/CameraSelectionStep'
},
  {
    id: 'creator-hub-photo-enhancer',
    name: 'CreatorHubPhotoEnhancer',
    category: 'ai',
    description: 'CreatorHub photo enhancement tool',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEnhancementComplete','enhancementMode','batchMode']
  },
    customization: {
      styles: ['layout','enhancer','colors','processing'],
      layout: ['enhancer','processing','batch'],
      behavior: ['enhancement','processing','batch','ai-powered']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/misc/CreatorHubPhotoEnhancer.tsx',
    importPath: './misc/CreatorHubPhotoEnhancer'
},

  // VIDEO & AUDIO COMPONENTS
  {
    id: 'videographer-video-suite',
    name: 'VideographerVideoSuite',
    category: 'ai',
    description: 'Videographer video suite for professional video editing',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onVideoProcess','videoMode','professionalTools']
  },
    customization: {
      styles: ['layout','suite','colors','professional'],
      layout: ['suite','professional','tabs'],
      behavior: ['video','editing','professional','suite']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/videographer/VideographerVideoSuite.tsx',
    importPath: '../videographer/VideographerVideoSuite'
},
  {
    id: 'photographer-photo-suite',
    name: 'PhotographerPhotoSuite',
    category: 'ai',
    description: 'Photographer photo suite for professional photo editing',
    profession: ['photographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPhotoProcess','photoMode','professionalTools']
  },
    customization: {
      styles: ['layout','suite','colors','professional'],
      layout: ['suite','professional','tabs'],
      behavior: ['photo','editing','professional','suite']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photographer/PhotographerPhotoSuite.tsx',
    importPath: '../photographer/PhotographerPhotoSuite'
},
  {
    id: 'audio-enhancement-suite',
    name: 'AudioEnhancementSuite',
    category: 'ai',
    description: 'AI-powered audio enhancement suite with RNNoise, DCCRN and Demucs',
    profession: ['music_producer','videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileUpload','onFileDownload','onProjectUpdate','selectedProject','onProjectSelect']
  },
    customization: {
      styles: ['layout','suite','colors','ai-powered'],
      layout: ['suite','ai-powered','tabs','processing'],
      behavior: ['audio','enhancement','ai','processing','rnnoise','dccrn','demucs']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/enhancement/AudioEnhancementSuite.tsx',
    importPath: '../enhancement/AudioEnhancementSuite'
},
  {
    id: 'video-showcase-connector',
    name: 'VideoShowcaseConnector',
    category: 'showcase',
    description: 'Video showcase connector for video portfolio management',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onVideoSelect','showcaseMode','portfolioIntegration']
  },
    customization: {
      styles: ['layout','connector','colors','showcase'],
      layout: ['connector','showcase','portfolio'],
      behavior: ['video','showcase','portfolio','connection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/specialized-video-showcase/VideoShowcaseConnector.tsx',
    importPath: '../specialized-video-showcase/VideoShowcaseConnector'
},
  {
    id: 'resolve-project-creator',
    name: 'ResolveProjectCreator',
    category: 'integration',
    description: 'DaVinci Resolve project creator for video editing integration',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onProjectCreate','resolveVersion','projectTemplate']
  },
    customization: {
      styles: ['layout','creator','colors','integration'],
      layout: ['creator','integration','templates'],
      behavior: ['resolve','project','creation','integration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/davinci-resolve/ResolveProjectCreator.tsx',
    importPath: '../davinci-resolve/ResolveProjectCreator'
},

  // SYSTEM & UTILITY COMPONENTS
  {
    id: 'export-dialog',
    name: 'ExportDialog',
    category: 'modal',
    description: 'Export dialog for file and project exports',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['exportType','onExport','exportOptions','selectedItems']
  },
    customization: {
      styles: ['layout','dialog','colors','export'],
      layout: ['dialog','modal','export'],
      behavior: ['export','dialog','modal','file-handling']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExportDialog.tsx',
    importPath: '../ExportDialog'
},
  {
    id: 'project-selector-modal',
    name: 'ProjectSelectorModal',
    category: 'modal',
    description: 'Project selector modal for project selection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onProjectSelect','selectedProject','projectFilter','multiSelect']
  },
    customization: {
      styles: ['layout','modal','colors','selector'],
      layout: ['modal','selector','list'],
      behavior: ['selection','modal','project','filtering']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shared/ProjectSelectorModal.tsx',
    importPath: '../shared/ProjectSelectorModal'
},
  {
    id: 'create-category-modal',
    name: 'CreateCategoryModal',
    category: 'modal',
    description: 'Create category modal for category management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onCategoryCreate','parentCategory','categoryType','validation']
  },
    customization: {
      styles: ['layout','modal','colors','form'],
      layout: ['modal','form','creation'],
      behavior: ['creation','modal','category','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/CreateCategoryModal.tsx',
    importPath: '../modals/CreateCategoryModal'
},
  {
    id: 'quote-generator-modal',
    name: 'QuoteGeneratorModal',
    category: 'modal',
    description: 'Quote generator modal for creating quotes',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onQuoteGenerate','clientId','quoteTemplate','pricingData']
  },
    customization: {
      styles: ['layout','modal','colors','generator'],
      layout: ['modal','generator','form'],
      behavior: ['generation','modal','quote','pricing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/QuoteGeneratorModal.tsx',
    importPath: '../modals/QuoteGeneratorModal'
},
  {
    id: 'toll-calculation-modal',
    name: 'TollCalculationModal',
    category: 'modal',
    description: 'Toll calculation modal for travel cost calculation',
    profession: ['photographer','videographer','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onCalculationComplete','routeData','vehicleType','calculationMode']
  },
    customization: {
      styles: ['layout','modal','colors','calculation'],
      layout: ['modal','calculation','form'],
      behavior: ['calculation','modal','toll','travel']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/travel/TollCalculationModal.tsx',
    importPath: '../travel/TollCalculationModal'
},
  {
    id: 'client-auth-dialog',
    name: 'ClientAuthDialog',
    category: 'modal',
    description: 'Client authentication dialog for client access',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onAuthSuccess','authType','clientId','securityLevel']
  },
    customization: {
      styles: ['layout','dialog','colors','auth'],
      layout: ['dialog','auth','form'],
      behavior: ['authentication','dialog','client','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/proofing/ClientAuthDialog.tsx',
    importPath: '../proofing/ClientAuthDialog'
},
  {
    id: 'extra-image-pricing-dialog',
    name: 'ExtraImagePricingDialog',
    category: 'modal',
    description: 'Extra image pricing dialog for additional image pricing',
    profession: ['photographer','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onPricingUpdate','imageCount','pricingTier','discountLevel']
  },
    customization: {
      styles: ['layout','dialog','colors','pricing'],
      layout: ['dialog','pricing','form'],
      behavior: ['pricing','dialog','image','calculation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExtraImagePricingDialog.tsx',
    importPath: '../ExtraImagePricingDialog'
},
  {
    id: 'invite-request-form',
    name: 'InviteRequestForm',
    category: 'form',
    description: 'Invite request form for user invitations',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCancel','inviteType','userRole','validation']
  },
    customization: {
      styles: ['layout','form','colors','invite'],
      layout: ['form','invite','fields'],
      behavior: ['invitation','form','request','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/InviteRequestForm.tsx',
    importPath: '../InviteRequestForm'
},

  // SPECIALIZED INTEGRATION COMPONENTS
  {
    id: 'postal-code-validator',
    name: 'PostalCodeValidator',
    category: 'integration',
    description: 'Postal code validator for address validation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['country','onValidation','validationMode','autoComplete']
  },
    customization: {
      styles: ['layout','validator','colors','validation'],
      layout: ['validator','input','status'],
      behavior: ['validation','postal','address','geocoding']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shipping/PostalCodeValidator.tsx',
    importPath: '../shipping/PostalCodeValidator'
},
  {
    id: 'package-tracker',
    name: 'PackageTracker',
    category: 'integration',
    description: 'Package tracker for shipping monitoring',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['carrier','onStatusUpdate','autoRefresh','notifications']
  },
    customization: {
      styles: ['layout','tracker','colors','status'],
      layout: ['tracker','status','timeline'],
      behavior: ['tracking','shipping','monitoring','status']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shipping/PackageTracker.tsx',
    importPath: '../shipping/PackageTracker'
},
  {
    id: 'shipping-calculator',
    name: 'ShippingCalculator',
    category: 'integration',
    description: 'Shipping calculator for cost estimation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['origin','destination'],
      optional: ['weight','dimensions','serviceType','onCalculation']
  },
    customization: {
      styles: ['layout','calculator','colors','estimation'],
      layout: ['calculator','form','results'],
      behavior: ['calculation','shipping','cost','estimation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shipping/ShippingCalculator.tsx',
    importPath: '../shipping/ShippingCalculator'
},
  {
    id: 'norwegian-tax-calculator',
    name: 'NorwegianTaxCalculator',
    category: 'integration',
    description: 'Norwegian tax calculator for tax calculations',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['taxYear','deductions','onCalculation','taxType']
  },
    customization: {
      styles: ['layout','calculator','colors','tax'],
      layout: ['calculator','form','breakdown'],
      behavior: ['calculation','tax','norwegian','compliance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/unused/profession-specific/NorwegianTaxCalculator.tsx',
    importPath: '../unused/profession-specific/NorwegianTaxCalculator'
},
  {
    id: 'firmware-update-manager',
    name: 'FirmwareUpdateManager',
    category: 'integration',
    description: 'Firmware update manager for device updates',
    profession: ['photographer','videographer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onUpdateComplete','updateMode','backupSettings','autoUpdate']
  },
    customization: {
      styles: ['layout','manager','colors','update'],
      layout: ['manager','update','progress'],
      behavior: ['update','firmware','device','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/unused/profession-specific/FirmwareUpdateManager.tsx',
    importPath: '../unused/profession-specific/FirmwareUpdateManager'
},
  {
    id: 'royalties-management-dashboard',
    name: 'RoyaltiesManagementDashboard',
    category: 'integration',
    description: 'Royalties management dashboard for royalty tracking',
    profession: ['music_producer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onRoyaltyUpdate','royaltyPeriod','paymentMethod','reporting']
  },
    customization: {
      styles: ['layout','dashboard','colors','royalties'],
      layout: ['dashboard','tables','charts'],
      behavior: ['management','royalties','tracking','payments']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/royalties/RoyaltiesManagementDashboard.tsx',
    importPath: '../royalties/RoyaltiesManagementDashboard'
},

  // SOCIAL MEDIA & MARKETING COMPONENTS
  {
    id: 'algorithm-optimizer',
    name: 'AlgorithmOptimizer',
    category: 'ai',
    description: 'Algorithm optimizer for social media optimization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onOptimization','platform','optimizationMode']
  },
    customization: {
      styles: ['layout','optimizer','colors','ai'],
      layout: ['optimizer','ai','tabs'],
      behavior: ['optimization','algorithm','social-media','ai-powered']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/AlgorithmOptimizer.tsx',
    importPath: '../social-media/AlgorithmOptimizer'
},
  {
    id: 'social-media-formats',
    name: 'SocialMediaFormats',
    category: 'format',
    description: 'Social media formats for content optimization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormatSelect','platform','contentType']
  },
    customization: {
      styles: ['layout','formats','colors','grid'],
      layout: ['formats','grid','cards'],
      behavior: ['formats','social-media','optimization','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/SocialMediaFormats.tsx',
    importPath: '../social-media/SocialMediaFormats'
},
  {
    id: 'viral-content-creator',
    name: 'ViralContentCreator',
    category: 'ai',
    description: 'Viral content creator for trending content generation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentCreate','viralMode','trendingAnalysis']
  },
    customization: {
      styles: ['layout','creator','colors','viral'],
      layout: ['creator','viral','tabs'],
      behavior: ['viral','content','trending','ai-powered']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/ViralContentCreator.tsx',
    importPath: '../social-media/ViralContentCreator'
},

  // CALENDAR & SCHEDULING COMPONENTS
  {
    id: 'universal-calendar-widget',
    name: 'UniversalCalendarWidget',
    category: 'calendar',
    description: 'Universal calendar widget for scheduling and events',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEventSelect','calendarMode','eventTypes']
  },
    customization: {
      styles: ['layout','calendar','colors','events'],
      layout: ['calendar','widget','events'],
      behavior: ['calendar','scheduling','events','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/calendar/UniversalCalendarWidget.tsx',
    importPath: '../calendar/UniversalCalendarWidget'
},
  {
    id: 'super-smart-writing-interface',
    name: 'SuperSmartWritingInterface',
    category: 'ai',
    description: 'Super smart writing interface for content creation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentWrite','writingMode','aiAssistance']
  },
    customization: {
      styles: ['layout','interface','colors','writing'],
      layout: ['interface','writing','editor'],
      behavior: ['writing','ai','smart','content-creation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ai/SuperSmartWritingInterface.tsx',
    importPath: '../ai/SuperSmartWritingInterface'
},

  // EQUIPMENT & GEAR COMPONENTS
  {
    id: 'equipment-management',
    name: 'EquipmentManagement',
    category: 'equipment',
    description: 'Equipment management system for gear tracking',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEquipmentUpdate','equipmentType','maintenanceMode']
  },
    customization: {
      styles: ['layout','management','colors','equipment'],
      layout: ['management','equipment','tabs'],
      behavior: ['management','equipment','tracking','maintenance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/EquipmentManagement.tsx',
    importPath: '../equipment/EquipmentManagement'
},
  {
    id: 'camera-equipment-manager',
    name: 'CameraEquipmentManager',
    category: 'equipment',
    description: 'Camera equipment manager for camera gear management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCameraUpdate','cameraType','lensManagement']
  },
    customization: {
      styles: ['layout','manager','colors','camera'],
      layout: ['manager','camera','tabs'],
      behavior: ['management','camera','lens','equipment']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/CameraEquipmentManager.tsx',
    importPath: '../equipment/CameraEquipmentManager'
},
  {
    id: 'comprehensive-equipment-dashboard',
    name: 'ComprehensiveEquipmentDashboard',
    category: 'equipment',
    description: 'Comprehensive equipment dashboard for all gear management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onDashboardUpdate','dashboardMode','comprehensiveView']
  },
    customization: {
      styles: ['layout','dashboard','colors','comprehensive'],
      layout: ['dashboard','comprehensive','tabs'],
      behavior: ['dashboard','comprehensive','equipment','overview']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/ComprehensiveEquipmentDashboard.tsx',
    importPath: '../equipment/ComprehensiveEquipmentDashboard'
},

  // NEWS & CONTENT COMPONENTS
  {
    id: 'personalized-news-interface',
    name: 'PersonalizedNewsInterface',
    category: 'content',
    description: 'Personalized news interface for content consumption',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onNewsSelect','newsCategories','personalizationLevel']
  },
    customization: {
      styles: ['layout','interface','colors','news'],
      layout: ['interface','news','feed'],
      behavior: ['news','personalized','content','feed']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/news/PersonalizedNewsInterface.tsx',
    importPath: '../news/PersonalizedNewsInterface'
},
  {
    id: 'story-arc-auto-monitor',
    name: 'StoryArcAutoMonitor',
    category: 'ai',
    description: 'Story arc auto monitor for narrative tracking',
    profession: ['videographer','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onStoryUpdate','storyMode','autoMonitoring']
  },
    customization: {
      styles: ['layout','monitor','colors','story'],
      layout: ['monitor','story','arc'],
      behavior: ['monitoring','story','arc','narrative']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ai/StoryArcAutoMonitor.tsx',
    importPath: '../ai/StoryArcAutoMonitor'
},

  // KEYBOARD & ACCESSIBILITY COMPONENTS
  {
    id: 'keyboard-shortcuts-interface',
    name: 'KeyboardShortcutsInterface',
    category: 'accessibility',
    description: 'Keyboard shortcuts interface for accessibility',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  13,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShortcutUpdate','shortcutMode','accessibilityLevel']
  },
    customization: {
      styles: ['layout','interface','colors','shortcuts'],
      layout: ['interface','shortcuts','keys'],
      behavior: ['shortcuts','keyboard','accessibility','navigation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/accessibility/KeyboardShortcutsInterface.tsx',
    importPath: '../accessibility/KeyboardShortcutsInterface'
},
  {
    id: 'universal-keyboard-shortcuts',
    name: 'UniversalKeyboardShortcuts',
    category: 'accessibility',
    description: 'Universal keyboard shortcuts for platform-wide navigation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  13,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShortcutAction','shortcutScope','universalMode']
  },
    customization: {
      styles: ['layout','shortcuts','colors','universal'],
      layout: ['shortcuts','universal','keys'],
      behavior: ['shortcuts','universal','navigation','accessibility']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/accessibility/UniversalKeyboardShortcuts.tsx',
    importPath: '../accessibility/UniversalKeyboardShortcuts'
},

  // PROTOTYPE & TESTING COMPONENTS
  {
    id: 'prototype-feedback-tool',
    name: 'PrototypeFeedbackTool',
    category: 'testing',
    description: 'Prototype feedback tool for testing and feedback collection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFeedbackSubmit','feedbackType','testingMode']
  },
    customization: {
      styles: ['layout','tool','colors','feedback'],
      layout: ['tool','feedback','form'],
      behavior: ['feedback','prototype','testing','collection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/PrototypeFeedbackTool.tsx',
    importPath: '../testing/PrototypeFeedbackTool'
},
  {
    id: 'universal-prototype-feedback',
    name: 'UniversalPrototypeFeedback',
    category: 'testing',
    description: 'Universal prototype feedback for comprehensive testing',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFeedbackCollect','feedbackScope','universalMode']
  },
    customization: {
      styles: ['layout','feedback','colors','universal'],
      layout: ['feedback','universal','collection'],
      behavior: ['feedback','universal','prototype','testing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/UniversalPrototypeFeedback.tsx',
    importPath: '../testing/UniversalPrototypeFeedback'
},
  {
    id: 'admin-prototype-testing-dashboard',
    name: 'AdminPrototypeTestingDashboard',
    category: 'testing',
    description: 'Admin prototype testing dashboard for testing management',
    profession: [''],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestingUpdate','testingMode','adminControls','dashboardScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','admin'],
      layout: ['dashboard','admin','testing'],
      behavior: ['dashboard','admin','testing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/admin-prototype-testing-dashboard.tsx',
    importPath: '../admin/admin-prototype-testing-dashboard'
},

  // SHOWCASE & GALLERY COMPONENTS
  {
    id: 'showcase-manager',
    name: 'ShowcaseManager',
    category: 'showcase',
    description: 'Showcase manager for portfolio and gallery management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShowcaseUpdate','showcaseType','portfolioMode']
  },
    customization: {
      styles: ['layout','manager','colors','showcase'],
      layout: ['manager','showcase','portfolio'],
      behavior: ['management','showcase','portfolio','gallery']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseManager.tsx',
    importPath: '../showcase/ShowcaseManager'
},
  {
    id: 'showcase-drive-grid',
    name: 'ShowcaseDriveGrid',
    category: 'showcase',
    description: 'Showcase drive grid for file organization and display',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileSelect','gridMode','driveIntegration']
  },
    customization: {
      styles: ['layout','grid','colors','drive'],
      layout: ['grid','drive','files'],
      behavior: ['grid','drive','files','organization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseDriveGrid.tsx',
    importPath: '../showcase/ShowcaseDriveGrid'
},
  {
    id: 'showcase-pricing-integration',
    name: 'ShowcasePricingIntegration',
    category: 'showcase',
    description: 'Showcase pricing integration for portfolio monetization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingMode','monetizationLevel']
  },
    customization: {
      styles: ['layout','integration','colors','pricing'],
      layout: ['integration','pricing','showcase'],
      behavior: ['integration','pricing','showcase','monetization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcasePricingIntegration.tsx',
    importPath: '../showcase/ShowcasePricingIntegration'
},
  {
    id: 'category-manager',
    name: 'CategoryManager',
    category: 'management',
    description: 'Category manager for content categorization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCategoryUpdate','categoryType','hierarchicalMode']
  },
    customization: {
      styles: ['layout','manager','colors','categories'],
      layout: ['manager','categories','hierarchy'],
      behavior: ['management','categories','organization','hierarchy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CategoryManager.tsx',
    importPath: '../CategoryManager'
},

  // BUSINESS & PRICING COMPONENTS
  {
    id: 'pricing-management',
    name: 'PricingManagement',
    category: 'business',
    description: 'Pricing management for business pricing strategies',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingStrategy','businessMode']
  },
    customization: {
      styles: ['layout','management','colors','pricing'],
      layout: ['management','pricing','strategy'],
      behavior: ['management','pricing','business','strategy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/business/PricingManagement.tsx',
    importPath: '../business/PricingManagement'
},
  {
    id: 'business-logo-upload',
    name: 'BusinessLogoUpload',
    category: 'business',
    description: 'Business logo upload for branding management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onLogoUpload','logoType','brandingMode']
  },
    customization: {
      styles: ['layout','upload','colors','logo'],
      layout: ['upload','logo','branding'],
      behavior: ['upload','logo','branding','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/business/BusinessLogoUpload.tsx',
    importPath: '../business/BusinessLogoUpload'
},

  // SPECIALIZED FORM COMPONENTS
  {
    id: 'songflow-platform',
    name: 'SongflowPlatform',
    category: 'form',
    description: 'Songflow platform form for music production workflow',
    profession: ['music_producer','admin'],
    tabIndex:  17,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormSubmit','formType','workflowMode']
  },
    customization: {
      styles: ['layout','form','colors','songflow'],
      layout: ['form','songflow','workflow'],
      behavior: ['form','songflow','music','workflow']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/forms/songflow-platform.tsx',
    importPath: '../forms/songflow-platform'
},
  {
    id: 'videograf-orchestrator',
    name: 'VideografOrchestrator',
    category: 'orchestrator',
    description: 'Main orchestrator for videographer profession workflow management',
    profession: [''],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['profession','userId','onProjectUpdate','onWorklogCreate']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tabs'],
      behavior: ['workflow','navigation','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/VideografOrchestrator.tsx',
    importPath: './VideografOrchestrator'
},
  {
    id: 'musikk-produsent-orchestrator',
    name: 'MusikkProdusentOrchestrator',
    category: 'orchestrator',
    description: 'Main orchestrator for music producer profession workflow management',
    profession: ['music_producer', ],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['profession','userId','onProjectUpdate','onWorklogCreate']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tabs'],
      behavior: ['workflow','navigation','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/MusikkProdusentOrchestrator.tsx',
    importPath: './MusikkProdusentOrchestrator'
},
  {
    id: 'vendor-orchestrator',
    name: 'VendorOrchestrator',
    category: 'orchestrator',
    description: 'Main orchestrator for vendor profession workflow management',
    profession: [''],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['profession','userId','onProjectUpdate','onWorklogCreate']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tabs'],
      behavior: ['workflow','navigation','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/VendorOrchestrator.tsx',
    importPath: './VendorOrchestrator'
},

  // PROJECT MANAGEMENT
  {
    id: 'project-creation-memory-cards',
    name: 'ProjectCreationWithMemoryCards',
    category: 'modal',
    description: 'Advanced project creation modal with step wizard and memory card integration',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query','react-hook-form'],
    props: {
      required: [''],
      optional: ['userI','onProjectCreated','onMeetingCreate','onProjectUpdate','onWorklogCreate','selectedProject','onProjectSelect']
  },
    customization: {
      styles: ['modal','wizard','forms','colors'],
      layout: ['steps','cards','grid'],
      behavior: ['validation','navigation','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/project/ProjectCreationWithMemoryCards.tsx',
    importPath: '../project/ProjectCreationWithMemoryCards'
},

  // CONTRACT MANAGEMENT
  {
    id: 'universal-contract-hub',
    name: 'UniversalContractHub',
    category: 'contract',
    description: 'Universal contract management system for all professions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onContractUpdate','onContractCreate']
  },
    customization: {
      styles: ['layout','forms','tables','colors'],
      layout: ['grid','cards','tabs'],
      behavior: ['validation','workflow','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/contracts/UniversalContractHub.tsx',
    importPath: './contracts/UniversalContractHub'
},

  // SHOWCASE MANAGEMENT
  {
    id: 'showcase-admin',
    name: 'ShowcaseAdmin',
    category: 'showcase',
    description: 'Administrative interface for managing showcases and portfolios',
    profession: ['photographer','videographer','music_producer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['userI','profession'],
      optional: ['onShowcaseCreate','onShowcaseUpdate']
  },
    customization: {
      styles: ['layout','gallery','cards','colors'],
      layout: ['grid','masonry','tabs'],
      behavior: ['upload','preview','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseAdmin.tsx',
    importPath: '../showcase/ShowcaseAdmin'
},
  {
    id: 'universal-showcase',
    name: 'UniversalShowcase',
    category: 'showcase',
    description: 'Universal showcase viewer for all professions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','items','onItemSelect']
  },
    customization: {
      styles: ['gallery','layout','colors','animations'],
      layout: ['grid','masonry','carousel'],
      behavior: ['filtering','sorting','preview']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalShowcase.tsx',
    importPath: './UniversalShowcase'
},

  // FILE MANAGEMENT
  {
    id: 'universal-download',
    name: 'UniversalDownload',
    category: 'file',
    description: 'Universal download manager for all file types',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDownload','onBulkDownload','profession']
  },
    customization: {
      styles: ['layout','cards','colors','buttons'],
      layout: ['grid','list','tiles'],
      behavior: ['download','preview','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDownload.tsx',
    importPath: './UniversalDownload'
},
  {
    id: 'universal-file-upload',
    name: 'UniversalFileUpload',
    category: 'file',
    description: 'Universal file upload component with drag-and-drop support',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','react-dropzone'],
    props: {
      required: [''],
      optional: ['onFileUpload','onFileRemove','acceptedTypes','maxFiles']
  },
    customization: {
      styles: ['dropzone','progress','colors','layout'],
      layout: ['grid','list','cards'],
      behavior: ['upload','validation','progress']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalFileUpload.tsx',
    importPath: './UniversalFileUpload'
},

  // AI ENHANCEMENT SUITES
  {
    id: 'photo-enhancement-suite',
    name: 'PhotoEnhancementSuite',
    category: 'ai',
    description: 'AI-powered photo enhancement and editing suite',
    profession: ['photographer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEnhancementComplete']
  },
    customization: {
      styles: ['layout','controls','preview','colors'],
      layout: ['sidebar','main','tabs'],
      behavior: ['processing','preview','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/enhancement/PhotoEnhancementSuite.tsx',
    importPath: '../enhancement/PhotoEnhancementSuite'
},
  {
    id: 'audio-enhancement-suite',
    name: 'AudioEnhancementSuite',
    category: 'ai',
    description: 'AI-powered audio enhancement and editing suite',
    profession: ['music_producer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEnhancementComplete']
  },
    customization: {
      styles: ['layout','controls','waveform','colors'],
      layout: ['sidebar','main','tabs'],
      behavior: ['processing','preview','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/enhancement/AudioEnhancementSuite.tsx',
    importPath: '../enhancement/AudioEnhancementSuite'
},

  // COMMUNICATION
  {
    id: 'smart-email-center',
    name: 'SmartEmailCenter',
    category: 'communication',
    description: 'Integrated email management center for all professions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['profession','userId'],
      optional: ['onEmailSend','onEmailReply','selectedProject']
  },
    customization: {
      styles: ['layout','compose','inbox','colors'],
      layout: ['sidebar','main','tabs'],
      behavior: ['compose','reply','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/email/SmartEmailCenter.tsx',
    importPath: '../email/SmartEmailCenter'
},
  {
    id: 'universal-communication',
    name: 'UniversalCommunication',
    category: 'communication',
    description: 'Universal communication hub for all interaction types',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['profession','userId'],
      optional: ['onMessageSend','onNotificationCreate']
  },
    customization: {
      styles: ['layout','chat','notifications','colors'],
      layout: ['sidebar','main','tabs'],
      behavior: ['messaging','notifications','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/communication/UniversalCommunication.tsx',
    importPath: '../communication/UniversalCommunication'
},

  // CRM & CLIENT MANAGEMENT
  {
    id: 'universal-crm-dashboard',
    name: 'UniversalCRMDashboard',
    category: 'crm',
    description: 'Universal CRM system for client and customer management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onClientSelect','onClientUpdate','onClientCreate']
  },
    customization: {
      styles: ['layout','tables','forms','colors'],
      layout: ['grid','cards','tabs'],
      behavior: ['management','tracking','communication']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/crm/UniversalCRMDashboard.tsx',
    importPath: '../crm/UniversalCRMDashboard'
},

  // EQUIPMENT MANAGEMENT
  {
    id: 'enhanced-gear-tab',
    name: 'EnhancedGearTab',
    category: 'equipment',
    description: 'Enhanced equipment and gear management interface',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onEquipmentUpdate','onEquipmentAdd']
  },
    customization: {
      styles: ['layout','cards','tables','colors'],
      layout: ['grid','list','tabs'],
      behavior: ['management','tracking','inventory']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/dashboard/EnhancedGearTab.tsx',
    importPath: '../dashboard/EnhancedGearTab'
},

  // SETTINGS & ADMINISTRATION
  {
    id: 'universal-settings-panel',
    name: 'UniversalSettingsPanel',
    category: 'settings',
    description: 'Universal settings panel with automatic FAQ for all professions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onSettingsUpdate']
  },
    customization: {
      styles: ['layout','forms','tabs','colors'],
      layout: ['grid','cards','tabs'],
      behavior: ['configuration','validation','persistence']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalSettingsPanel.tsx',
    importPath: './UniversalSettingsPanel'
},

  // INTEGRATION & TESTING
  {
    id: 'universal-dashboard-integration-test',
    name: 'UniversalDashboardIntegrationTest',
    category: 'integration',
    description: 'Integration testing component for dashboard functionality',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  13,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['onTestComplete','testMode']
  },
    customization: {
      styles: ['layout','cards','colors','status'],
      layout: ['grid','list','tabs'],
      behavior: ['testing','validation','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDashboardIntegrationTest.tsx',
    importPath: './UniversalDashboardIntegrationTest'
},

  // SYSTEM & ADMINISTRATION COMPONENTS
  {
    id: 'system-messages-banner',
    name: 'SystemMessagesBanner',
    category: 'system',
    description: 'System messages banner for displaying notifications and alerts',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userProfession','onMessageDismiss','onMessageExpand']
  },
    customization: {
      styles: ['layout','banner','colors','alerts'],
      layout: ['banner','notifications','snackbar'],
      behavior: ['notifications','dismissal','expansion','priority']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/SystemMessagesBanner.tsx',
    importPath: '../SystemMessagesBanner'
},
  {
    id: 'access-restricted',
    name: 'AccessRestricted',
    category: 'system',
    description: 'Access restricted component for unauthorized access handling',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['onAccessRequest','accessLevel','restrictionReason']
  },
    customization: {
      styles: ['layout','restriction','colors','security'],
      layout: ['card','message','actions'],
      behavior: ['restriction','security','access-control']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/access-restricted.tsx',
    importPath: '../access-restricted'
},
  {
    id: 'admin-prof-analysis',
    name: 'AdminProffAnalysis',
    category: 'admin',
    description: 'Admin professional analysis component for business insights',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalysisComplete','analysisType','reportingMode']
  },
    customization: {
      styles: ['layout','analysis','colors','charts'],
      layout: ['dashboard','charts','tables'],
      behavior: ['analysis','reporting','insights','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AdminProffAnalysis.tsx',
    importPath: '../AdminProffAnalysis'
},
  {
    id: 'ai-color-grading',
    name: 'AIColorGrading',
    category: 'ai',
    description: 'AI-powered color grading tool for video and photo enhancement',
    profession: ['photographer','videographer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onGradingComplete','gradingMode','aiModel']
  },
    customization: {
      styles: ['layout','grading','colors','controls'],
      layout: ['sidebar','preview','controls'],
      behavior: ['grading','ai','enhancement','processing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AIColorGrading.tsx',
    importPath: '../AIColorGrading'
},
  {
    id: 'business-intelligence-dashboard',
    name: 'BusinessIntelligenceDashboard',
    category: 'business',
    description: 'Business intelligence dashboard for analytics and reporting',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDashboardUpdate','dashboardMode','reportingPeriod']
  },
    customization: {
      styles: ['layout','dashboard','colors','charts'],
      layout: ['grid','charts','tables','cards'],
      behavior: ['analytics','reporting','insights','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessIntelligenceDashboard.tsx',
    importPath: '../BusinessIntelligenceDashboard'
},
  {
    id: 'code-generation-studio',
    name: 'CodeGenerationStudio',
    category: 'ai',
    description: 'Code generation studio for automated code creation and analysis',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCodeGenerate','generationMode','codeType']
  },
    customization: {
      styles: ['layout','studio','colors','editor'],
      layout: ['editor','sidebar','tabs'],
      behavior: ['generation','analysis','code','ai']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CodeGenerationStudio.tsx',
    importPath: '../CodeGenerationStudio'
},
  {
    id: 'project-creation-wizard',
    name: 'ProjectCreationWizard',
    category: 'modal',
    description: 'Project creation wizard for guided project setup',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProjectCreate','wizardMode','stepValidation']
  },
    customization: {
      styles: ['layout','wizard','colors','steps'],
      layout: ['stepper','forms','navigation'],
      behavior: ['wizard','validation','navigation','creation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ProjectCreationWizard.tsx',
    importPath: '../ProjectCreationWizard'
},
  {
    id: 'price-administration',
    name: 'PriceAdministration',
    category: 'business',
    description: 'Price administration system for pricing management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPriceUpdate','pricingMode','administrationLevel']
  },
    customization: {
      styles: ['layout','administration','colors','tables'],
      layout: ['tables','forms','tabs'],
      behavior: ['administration','pricing','management','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/PriceAdministration.tsx',
    importPath: '../PriceAdministration'
},
  {
    id: 'two-factor-setup',
    name: 'TwoFactorSetup',
    category: 'security',
    description: 'Two-factor authentication setup component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSetupComplete','setupMode','securityLevel']
  },
    customization: {
      styles: ['layout','setup','colors','security'],
      layout: ['stepper','forms','verification'],
      behavior: ['setup','security','authentication','verification']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/TwoFactorSetup.tsx',
    importPath: '../TwoFactorSetup'
},

  // ADDITIONAL CORE COMPONENTS
  {
    id: 'creator-hub-notes',
    name: 'CreatorHubNotes',
    category: 'management',
    description: 'CreatorHub notes system for project documentation and collaboration',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onNoteCreate','onNoteUpdate','noteType']
  },
    customization: {
      styles: ['layout','editor','colors','typography'],
      layout: ['editor','sidebar','tabs'],
      behavior: ['editing','collaboration','documentation','notes']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/CreatorHubNotes.tsx',
    importPath: '../admin/CreatorHubNotes'
},
  {
    id: 'google-payments-configuration',
    name: 'GooglePaymentsConfiguration',
    category: 'integration',
    description: 'Google payments configuration for payment processing setup',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onConfigurationComplete','configurationMode','paymentType']
  },
    customization: {
      styles: ['layout','configuration','colors','forms'],
      layout: ['forms','tabs','settings'],
      behavior: ['configuration','payments','google','setup']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GooglePaymentsConfiguration.tsx',
    importPath: '../admin/GooglePaymentsConfiguration'
},
  {
    id: 'command-palette',
    name: 'CommandPalette',
    category: 'system',
    description: 'Universal command palette for quick actions and navigation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['onCommandExecute','commandScope','shortcutMode']
  },
    customization: {
      styles: ['layout','palette','colors','search'],
      layout: ['modal','search','results'],
      behavior: ['search','commands','navigation','shortcuts']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/CommandPalette.tsx',
    importPath: './CommandPalette'
},
  {
    id: 'scroll-story',
    name: 'ScrollStory',
    category: 'ai',
    description: 'ScrollStory component for interactive storytelling and animations',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onStoryCreate','storyMode','animationType']
  },
    customization: {
      styles: ['layout','story','colors','animations'],
      layout: ['timeline','canvas','controls'],
      behavior: ['storytelling','animations','interactive','scroll']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/scroll-story/ScrollStory.tsx',
    importPath: '../scroll-story/ScrollStory'
},
  {
    id: 'email-designer',
    name: 'EmailDesigner',
    category: 'communication',
    description: 'Email designer for creating and customizing email templates',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEmailDesign','templateType','designMode']
  },
    customization: {
      styles: ['layout','designer','colors','templates'],
      layout: ['canvas','sidebar','templates'],
      behavior: ['design','templates','email','customization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/EmailDesigner/EmailDesigner.tsx',
    importPath: '../EmailDesigner/EmailDesigner'
},
  {
    id: 'universal-visual-cms',
    name: 'UniversalVisualCM',
    category: 'cms',
    description: 'Universal visual CMS for content management and editing',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onContentUpdate','cmsMode','contentType']
  },
    customization: {
      styles: ['layout','cms','colors','editor'],
      layout: ['editor','sidebar','preview'],
      behavior: ['cms','content','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/cms/UniversalVisualCMS.tsx',
    importPath: '../cms/UniversalVisualCMS'
},
  {
    id: 'component-orchestrator',
    name: 'ComponentOrchestrator',
    category: 'orchestrator',
    description: 'Universal component orchestrator for managing component interactions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onComponentUpdate','orchestrationMode']
  },
    customization: {
      styles: ['layout','orchestrator','colors','coordination'],
      layout: ['grid','components','tabs'],
      behavior: ['orchestration','coordination','management','components']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/ComponentOrchestrator.tsx',
    importPath: './ComponentOrchestrator'
},
  {
    id: 'google-oauth-setup',
    name: 'GoogleOAuthSetup',
    category: 'integration',
    description: 'Google OAuth setup for authentication integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSetupComplete','oauthScope','integrationType']
  },
    customization: {
      styles: ['layout','setup','colors','oauth'],
      layout: ['forms','configuration','tabs'],
      behavior: ['oauth','authentication','google','setup']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/GoogleOAuthSetup.tsx',
    importPath: '../GoogleOAuthSetup'
},
  {
    id: 'universal-vendor-onboarding',
    name: 'UniversalVendorOnboarding',
    category: 'onboarding',
    description: 'Universal vendor onboarding system for new vendor setup',
    profession: ['vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onOnboardingComplete','onboardingStep','vendorType']
  },
    customization: {
      styles: ['layout','onboarding','colors','steps'],
      layout: ['stepper','forms','progress'],
      behavior: ['onboarding','setup','vendor','guided']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/UniversalVendorOnboarding.tsx',
    importPath: '../vendor/UniversalVendorOnboarding'
},
  {
    id: 'vendor-type-manager',
    name: 'VendorTypeManager',
    category: 'management',
    description: 'Vendor type manager for managing different vendor categories',
    profession: ['vendor','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTypeUpdate','vendorCategory','managementMode']
  },
    customization: {
      styles: ['layout','manager','colors','categories'],
      layout: ['tables','forms','tabs'],
      behavior: ['management','categories','vendor','types']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/VendorTypeManager.tsx',
    importPath: '../vendor/VendorTypeManager'
},
  {
    id: 'wedding-code-entry',
    name: 'WeddingCodeEntry',
    category: 'management',
    description: 'Wedding code entry component for wedding timeline access',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCodeValidation','codeType','accessLevel']
  },
    customization: {
      styles: ['layout','entry','colors','forms'],
      layout: ['form','input','validation'],
      behavior: ['entry','validation','wedding','access']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-code-entry.tsx',
    importPath: '../wedding-code-entry'
},
  {
    id: 'powerful-vendor-showcase',
    name: 'PowerfulVendorShowcase',
    category: 'showcase',
    description: 'Powerful vendor showcase for vendor portfolio display',
    profession: ['vendor','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onShowcaseUpdate','showcaseMode','vendorProfile']
  },
    customization: {
      styles: ['layout','showcase','colors','portfolio'],
      layout: ['grid','cards','gallery'],
      behavior: ['showcase','portfolio','vendor','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/PowerfulVendorShowcase.tsx',
    importPath: '../vendor/PowerfulVendorShowcase'
},
  {
    id: 'universal-vendor-dashboard',
    name: 'UniversalVendorDashboard',
    category: 'management',
    description: 'Universal vendor dashboard for vendor management interface',
    profession: ['vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDashboardUpdate','dashboardMode','vendorType']
  },
    customization: {
      styles: ['layout','dashboard','colors','management'],
      layout: ['grid','cards','tabs'],
      behavior: ['dashboard','management','vendor','interface']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/UniversalVendorDashboard.tsx',
    importPath: '../vendor/UniversalVendorDashboard'
},

  // ADMIN & MONITORING COMPONENTS
  {
    id: 'comprehensive-admin-dashboard',
    name: 'ComprehensiveAdminDashboard',
    category: 'admin',
    description: 'Comprehensive admin dashboard for system administration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDashboardUpdate','adminMode','systemScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','admin'],
      layout: ['grid','cards','tabs','charts'],
      behavior: ['administration','monitoring','system','comprehensive']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/comprehensive-admin-dashboard.tsx',
    importPath: './admin/comprehensive-admin-dashboard'
},
  {
    id: 'corner-buttons',
    name: 'CornerButtons',
    category: 'system',
    description: 'Corner buttons for quick access and navigation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material', ],
    props: {
      required: [],
      optional: ['onButtonClick','buttonType','cornerPosition']
  },
    customization: {
      styles: ['layout','buttons','colors','positioning'],
      layout: ['floating','corner','buttons'],
      behavior: ['navigation','quick-access','floating','corner']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/misc/corner-buttons.tsx',
    importPath: './misc/corner-buttons'
},
  {
    id: 'google-wallet-membership-manager',
    name: 'GoogleWalletMembershipManager',
    category: 'integration',
    description: 'Google Wallet membership manager for membership management',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMembershipUpdate','membershipType','walletIntegration']
  },
    customization: {
      styles: ['layout','manager','colors','membership'],
      layout: ['tables','forms','tabs'],
      behavior: ['membership','wallet','google','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GoogleWalletMembershipManager.tsx',
    importPath: '../admin/GoogleWalletMembershipManager'
},
  {
    id: 'lsd-monitoring-panel',
    name: 'LSDMonitoringPanel',
    category: 'admin',
    description: 'LSD monitoring panel for system monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMonitoringUpdate','monitoringScope','alertLevel']
  },
    customization: {
      styles: ['layout','monitoring','colors','alerts'],
      layout: ['panel','charts','alerts'],
      behavior: ['monitoring','alerts','system','lsd']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/LSDMonitoringPanel.tsx',
    importPath: '../admin/LSDMonitoringPanel'
},
  {
    id: 'api-endpoint-monitor',
    name: 'APIEndpointMonitor',
    category: 'admin',
    description: 'API endpoint monitor for API health monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEndpointUpdate','monitoringInterval','healthCheck']
  },
    customization: {
      styles: ['layout','monitor','colors','status'],
      layout: ['tables','charts','status'],
      behavior: ['monitoring','api','health','endpoints']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/APIEndpointMonitor.tsx',
    importPath: '../admin/APIEndpointMonitor'
},
  {
    id: 'dependencies-manager',
    name: 'DependenciesManager',
    category: 'admin',
    description: 'Dependencies manager for system dependency management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDependencyUpdate','dependencyScope','updateMode']
  },
    customization: {
      styles: ['layout','manager','colors','dependencies'],
      layout: ['tables','lists','tabs'],
      behavior: ['management','dependencies','updates','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/DependenciesManager.tsx',
    importPath: '../admin/DependenciesManager'
},
  {
    id: 'api-integration-process-monitor',
    name: 'ApiIntegrationProcessMonitor',
    category: 'admin',
    description: 'API integration process monitor for integration monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProcessUpdate','integrationType','monitoringLevel']
  },
    customization: {
      styles: ['layout','monitor','colors','process'],
      layout: ['timeline','charts','status'],
      behavior: ['monitoring','integration','process','api']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/ApiIntegrationProcessMonitor.tsx',
    importPath: '../admin/ApiIntegrationProcessMonitor'
},
  {
    id: 'database-integrity-checker',
    name: 'DatabaseIntegrityChecker',
    category: 'admin',
    description: 'Database integrity checker for database health monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrityCheck','checkScope','repairMode']
  },
    customization: {
      styles: ['layout','checker','colors','integrity'],
      layout: ['tables','reports','tabs'],
      behavior: ['checking','integrity','database','health']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/DatabaseIntegrityChecker.tsx',
    importPath: '../admin/DatabaseIntegrityChecker'
},
  {
    id: 'integrations-management-panel',
    name: 'IntegrationsManagementPanel',
    category: 'admin',
    description: 'Integrations management panel for system integrations',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrationUpdate','integrationScope','managementMode']
  },
    customization: {
      styles: ['layout','panel','colors','integrations'],
      layout: ['tables','cards','tabs'],
      behavior: ['management','integrations','system','panel']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/IntegrationsManagementPanel.tsx',
    importPath: '../admin/IntegrationsManagementPanel'
},
  {
    id: 'feature-management-with-publish',
    name: 'FeatureManagementWithPublish',
    category: 'admin',
    description: 'Feature management with publish functionality',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFeatureUpdate','publishMode','featureScope']
  },
    customization: {
      styles: ['layout','management','colors','features'],
      layout: ['tables','forms','tabs'],
      behavior: ['management','features','publishing','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/FeatureManagementWithPublish.tsx',
    importPath: '../admin/FeatureManagementWithPublish'
},
  {
    id: 'centralized-monitoring-console',
    name: 'CentralizedMonitoringConsole',
    category: 'admin',
    description: 'Centralized monitoring console for system monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMonitoringUpdate','consoleScope','monitoringLevel']
  },
    customization: {
      styles: ['layout','console','colors','monitoring'],
      layout: ['dashboard','charts','alerts'],
      behavior: ['monitoring','console','centralized','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/CentralizedMonitoringConsole.tsx',
    importPath: '../admin/CentralizedMonitoringConsole'
},
  {
    id: 'comprehensive-protocol-manager',
    name: 'ComprehensiveProtocolManager',
    category: 'admin',
    description: 'Comprehensive protocol manager for system protocols',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProtocolUpdate','protocolScope','managementMode']
  },
    customization: {
      styles: ['layout','manager','colors','protocols'],
      layout: ['tables','forms','tabs'],
      behavior: ['management','protocols','comprehensive','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/ComprehensiveProtocolManager.tsx',
    importPath: '../admin/ComprehensiveProtocolManager'
},
  {
    id: 'admin-floating-action-buttons',
    name: 'AdminFloatingActionButtons',
    category: 'admin',
    description: 'Admin floating action buttons for quick admin actions',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onActionClick','buttonType','floatingPosition']
  },
    customization: {
      styles: ['layout','buttons','colors','floating'],
      layout: ['floating','buttons','actions'],
      behavior: ['floating','actions','admin','quick-access']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AdminFloatingActionButtons.tsx',
    importPath: '../admin/AdminFloatingActionButtons'
},
  {
    id: 'system-backup-dashboard',
    name: 'SystemBackupDashboard',
    category: 'admin',
    description: 'System backup dashboard for backup management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onBackupUpdate','backupScope','backupMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','backup'],
      layout: ['tables','charts','tabs'],
      behavior: ['backup','system','management','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/SystemBackupDashboard.tsx',
    importPath: '../admin/SystemBackupDashboard'
},
  {
    id: 'automations-panel',
    name: 'AutomationsPanel',
    category: 'admin',
    description: 'Automations panel for system automation management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAutomationUpdate','automationScope','automationMode']
  },
    customization: {
      styles: ['layout','panel','colors','automations'],
      layout: ['tables','forms','tabs'],
      behavior: ['automations','management','system','panel']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AutomationsPanel.tsx',
    importPath: '../admin/AutomationsPanel'
},
  {
    id: 'gdpr-compliance-panel',
    name: 'GDPRCompliancePanel',
    category: 'admin',
    description: 'GDPR compliance panel for data protection compliance',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onComplianceUpdate','complianceScope','gdprMode']
  },
    customization: {
      styles: ['layout','panel','colors','compliance'],
      layout: ['tables','forms','reports'],
      behavior: ['compliance','gdpr','data-protection','panel']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GDPRCompliancePanel.tsx',
    importPath: '../admin/GDPRCompliancePanel'
},
  {
    id: 'feature-management',
    name: 'FeatureManagement',
    category: 'admin',
    description: 'Feature management system for feature toggles and management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFeatureUpdate','featureScope','managementMode']
  },
    customization: {
      styles: ['layout','management','colors','features'],
      layout: ['tables','toggles','tabs'],
      behavior: ['management','features','toggles','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/feature-management.tsx',
    importPath: '../admin/feature-management'
},
  {
    id: 'price-management-dashboard',
    name: 'PriceManagementDashboard',
    category: 'admin',
    description: 'Price management dashboard for pricing administration',
    profession: [''],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPriceUpdate','pricingScope','managementMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','pricing'],
      layout: ['tables','charts','tabs'],
      behavior: ['management','pricing','dashboard','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/PriceManagementDashboard.tsx',
    importPath: '../admin/PriceManagementDashboard'
},
  {
    id: 'admin-stats',
    name: 'AdminStats',
    category: 'admin',
    description: 'Admin statistics dashboard for system statistics',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onStatsUpdate','statsScope','statisticsMode']
  },
    customization: {
      styles: ['layout','stats','colors','charts'],
      layout: ['charts','cards','tabs'],
      behavior: ['statistics','admin','dashboard','stats']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AdminStats.tsx',
    importPath: '../admin/AdminStats'
},

  // VISUAL EDITOR COMPONENTS
  {
    id: 'color-picker',
    name: 'ColorPicker',
    category: 'system',
    description: 'Color picker component for color selection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onChange','colorFormat','presetColors']
  },
    customization: {
      styles: ['layout','picker','colors'],
      layout: ['picker','presets','input'],
      behavior: ['selection','color','picker']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/visual-editor/ColorPicker.tsx',
    importPath: '../visual-editor/ColorPicker'
},
  {
    id: 'visual-editor-with-page-selection',
    name: 'VisualEditorWithPageSelection',
    category: 'system',
    description: 'Visual editor with page selection functionality',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPageSelect','pageMode','editorType']
  },
    customization: {
      styles: ['layout','editor','colors','selection'],
      layout: ['editor','sidebar','pages'],
      behavior: ['editing','selection','pages','visual']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/visual-editor/VisualEditorWithPageSelection.tsx',
    importPath: '../visual-editor/VisualEditorWithPageSelection'
},
  {
    id: 'visual-cms-admin-dashboard',
    name: 'VisualCMSAdminDashboard',
    category: 'cms',
    description: 'Visual CMS admin dashboard for content management',
    profession: [''],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCMSUpdate','cmsMode','adminScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','cms'],
      layout: ['dashboard','tabs','editor'],
      behavior: ['cms','admin','content','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/VisualCMSAdminDashboard.tsx',
    importPath: '../admin/VisualCMSAdminDashboard'
},
  {
    id: 'profession-cms-manager',
    name: 'ProfessionCMSManager',
    category: 'cms',
    description: 'Profession CMS manager for profession-specific content',
    profession: [''],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProfessionUpdate','professionType','cmsScope']
  },
    customization: {
      styles: ['layout','manager','colors','profession'],
      layout: ['tabs','forms','tables'],
      behavior: ['cms','profession','management','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/ProfessionCMSManager.tsx',
    importPath: '../admin/ProfessionCMSManager'
},

  // WEDDING & TIMELINE COMPONENTS
  {
    id: 'wedding-timeline',
    name: 'WeddingTimeline',
    category: 'management',
    description: 'Wedding timeline component for wedding event management',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTimelineUpdate','timelineMode','eventTypes']
  },
    customization: {
      styles: ['layout','timeline','colors','events'],
      layout: ['timeline','events','tabs'],
      behavior: ['timeline','events','wedding','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-timeline.tsx',
    importPath: '../wedding-timeline'
},

  // SPECIALIZED VIDEO SHOWCASE COMPONENTS
  {
    id: 'video-showcase-connector',
    name: 'VideoShowcaseConnector',
    category: 'showcase',
    description: 'Video showcase connector for video portfolio management',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onVideoSelect','showcaseMode','portfolioIntegration']
  },
    customization: {
      styles: ['layout','connector','colors','showcase'],
      layout: ['connector','showcase','portfolio'],
      behavior: ['video','showcase','portfolio','connection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/specialized-video-showcase/VideoShowcaseConnector.tsx',
    importPath: '../specialized-video-showcase/VideoShowcaseConnector'
},

  // KEYBOARD SHORTCUTS COMPONENTS
  {
    id: 'keyboard-shortcuts-interface',
    name: 'KeyboardShortcutsInterface',
    category: 'accessibility',
    description: 'Keyboard shortcuts interface for accessibility',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  13,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onShortcutUpdate','shortcutMode','accessibilityLevel']
  },
    customization: {
      styles: ['layout','interface','colors','shortcuts'],
      layout: ['interface','shortcuts','keys'],
      behavior: ['shortcuts','keyboard','accessibility','navigation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/keyboard-shortcuts/KeyboardShortcutsInterface.tsx',
    importPath: '../keyboard-shortcuts/KeyboardShortcutsInterface'
},

  // PROTOTYPE COMPONENTS
  {
    id: 'prototype-feedback-tool',
    name: 'PrototypeFeedbackTool',
    category: 'testing',
    description: 'Prototype feedback tool for testing and feedback collection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFeedbackSubmit','feedbackType','testingMode']
  },
    customization: {
      styles: ['layout','tool','colors','feedback'],
      layout: ['tool','feedback','form'],
      behavior: ['feedback','prototype','testing','collection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/prototype/PrototypeFeedbackTool.tsx',
    importPath: '../prototype/PrototypeFeedbackTool'
},

  // FEEDBACK COMPONENTS
  {
    id: 'prototype-feedback-tool-alt',
    name: 'PrototypeFeedbackTool',
    category: 'testing',
    description: 'Alternative prototype feedback tool for testing',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFeedbackSubmit','feedbackType','testingMode']
  },
    customization: {
      styles: ['layout','tool','colors','feedback'],
      layout: ['tool','feedback','form'],
      behavior: ['feedback','prototype','testing','collection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/feedback/PrototypeFeedbackTool.tsx',
    importPath: '../feedback/PrototypeFeedbackTool'
},

  // SOCIAL MEDIA COMPONENTS
  {
    id: 'algorithm-optimizer',
    name: 'AlgorithmOptimizer',
    category: 'ai',
    description: 'Algorithm optimizer for social media optimization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onOptimization','platform','optimizationMode']
  },
    customization: {
      styles: ['layout','optimizer','colors','ai'],
      layout: ['optimizer','ai','tabs'],
      behavior: ['optimization','algorithm','social-media','ai-powered']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/AlgorithmOptimizer.tsx',
    importPath: '../social-media/AlgorithmOptimizer'
},
  {
    id: 'social-media-formats',
    name: 'SocialMediaFormats',
    category: 'format',
    description: 'Social media formats for content optimization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormatSelect','platform','contentType']
  },
    customization: {
      styles: ['layout','formats','colors','grid'],
      layout: ['formats','grid','cards'],
      behavior: ['formats','social-media','optimization','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/SocialMediaFormats.tsx',
    importPath: '../social-media/SocialMediaFormats'
},

  // UNIVERSAL COMPONENTS
  {
    id: 'component-orchestrator-alt',
    name: 'ComponentOrchestrator',
    category: 'orchestrator',
    description: 'Alternative component orchestrator for component management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onComponentUpdate','orchestrationMode']
  },
    customization: {
      styles: ['layout','orchestrator','colors','coordination'],
      layout: ['grid','components','tabs'],
      behavior: ['orchestration','coordination','management','components']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/ComponentOrchestrator.tsx',
    importPath: './ComponentOrchestrator'
},

  // CHAT COMPONENTS
  {
    id: 'advanced-chat-protocols',
    name: 'AdvancedChatProtocols',
    category: 'communication',
    description: 'Advanced chat protocols and communication features',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','protocols','onProtocolChange']
  },
    customization: {
      styles: ['layout','protocols','colors'],
      layout: ['grid','cards','tabs'],
      behavior: ['protocols','communication','advanced']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/AdvancedChatProtocols.tsx',
    importPath: '../chat/AdvancedChatProtocols'
},

  // UNIVERSAL ADMIN COMPONENTS
  {
    id: 'admin-prototype-testing-dashboard',
    name: 'AdminPrototypeTestingDashboard',
    category: 'testing',
    description: 'Admin prototype testing dashboard for testing management',
    profession: [''],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestingUpdate','testingMode','adminControls','dashboardScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','admin'],
      layout: ['dashboard','admin','testing'],
      behavior: ['dashboard','admin','testing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/admin-prototype-testing-dashboard.tsx',
    importPath: './admin/admin-prototype-testing-dashboard'
},

  // PHOTOGRAPHER COMPONENTS
  {
    id: 'photographer-showcase-manager',
    name: 'ShowcaseManager',
    category: 'showcase',
    description: 'Photographer showcase manager for portfolio management',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onShowcaseUpdate','showcaseType','portfolioMode']
  },
    customization: {
      styles: ['layout','manager','colors','showcase'],
      layout: ['manager','showcase','portfolio'],
      behavior: ['management','showcase','portfolio','gallery']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photographer/ShowcaseManager.tsx',
    importPath: '../photographer/ShowcaseManager'
},

  // CALENDAR COMPONENTS
  {
    id: 'universal-calendar-widget',
    name: 'UniversalCalendarWidget',
    category: 'calendar',
    description: 'Universal calendar widget for scheduling and events',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEventSelect','calendarMode','eventTypes']
  },
    customization: {
      styles: ['layout','calendar','colors','events'],
      layout: ['calendar','widget','events'],
      behavior: ['calendar','scheduling','events','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/calendar/UniversalCalendarWidget.tsx',
    importPath: '../calendar/UniversalCalendarWidget'
},

  // SYSTEM COMPONENTS
  {
    id: 'google-integration-test-dashboard',
    name: 'GoogleIntegrationTestDashboard',
    category: 'integration',
    description: 'Google integration test dashboard for testing Google services',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrationTest','testScope','googleServices']
  },
    customization: {
      styles: ['layout','dashboard','colors','testing'],
      layout: ['dashboard','tests','tabs'],
      behavior: ['testing','integration','google','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/system/GoogleIntegrationTestDashboard.tsx',
    importPath: '../system/GoogleIntegrationTestDashboard'
},

  // UNIVERSAL FORMS COMPONENTS
  {
    id: 'songflow-platform-form',
    name: 'SongflowPlatform',
    category: 'form',
    description: 'Songflow platform form for music production workflow',
    profession: ['music_producer','admin'],
    tabIndex:  17,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormSubmit','formType','workflowMode']
  },
    customization: {
      styles: ['layout','form','colors','songflow'],
      layout: ['form','songflow','workflow'],
      behavior: ['form','songflow','music','workflow']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/forms/songflow-platform.tsx',
    importPath: './forms/songflow-platform'
},

  // MEMORY CARD COMPONENTS
  {
    id: 'memory-card-backup-manager-alt',
    name: 'MemoryCardBackupManager',
    category: 'file',
    description: 'Alternative memory card backup management system',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onBackupComplete','backupSettings','autoBackup']
  },
    customization: {
      styles: ['layout','backup','colors','progress'],
      layout: ['grid','cards','tabs','settings'],
      behavior: ['backup','scheduling','monitoring','automation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupManager.tsx',
    importPath: '../memory-card/MemoryCardBackupManager'
},
  {
    id: 'memory-card-backup-panel-alt',
    name: 'MemoryCardBackupPanel',
    category: 'file',
    description: 'Alternative memory card backup panel interface',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onBackupStart','panelMode','quickBackup']
  },
    customization: {
      styles: ['layout','panel','colors','compact'],
      layout: ['panel','compact','sidebar'],
      behavior: ['backup','quick','panel','interface']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupPanel.tsx',
    importPath: '../memory-card/MemoryCardBackupPanel'
},

  // PRICING COMPONENTS
  {
    id: 'showcase-pricing-integration-alt',
    name: 'ShowcasePricingIntegration',
    category: 'showcase',
    description: 'Alternative showcase pricing integration for portfolio monetization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingMode','monetizationLevel']
  },
    customization: {
      styles: ['layout','integration','colors','pricing'],
      layout: ['integration','pricing','showcase'],
      behavior: ['integration','pricing','showcase','monetization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/pricing/ShowcasePricingIntegration.tsx',
    importPath: '../pricing/ShowcasePricingIntegration'
},

  // ADMIN VIRAL CONTENT COMPONENTS
  {
    id: 'viral-content-creator-admin',
    name: 'ViralContentCreator',
    category: 'ai',
    description: 'Admin viral content creator for trending content generation',
    profession: [''],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onContentCreate','viralMode','trendingAnalysis']
  },
    customization: {
      styles: ['layout','creator','colors','viral'],
      layout: ['creator','viral','tabs'],
      behavior: ['viral','content','trending','ai-powered']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/ViralContentCreator.tsx',
    importPath: '../admin/ViralContentCreator'
},

  // MEETINGS COMPONENTS
  {
    id: 'super-smart-writing-interface-alt',
    name: 'SuperSmartWritingInterface',
    category: 'ai',
    description: 'Alternative super smart writing interface for content creation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentWrite','writingMode','aiAssistance']
  },
    customization: {
      styles: ['layout','interface','colors','writing'],
      layout: ['interface','writing','editor'],
      behavior: ['writing','ai','smart','content-creation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/meetings/SuperSmartWritingInterface.tsx',
    importPath: '../meetings/SuperSmartWritingInterface'
},

  // EQUIPMENT COMPONENTS
  {
    id: 'equipment-management-alt',
    name: 'EquipmentManagement',
    category: 'equipment',
    description: 'Alternative equipment management system for gear tracking',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEquipmentUpdate','equipmentType','maintenanceMode']
  },
    customization: {
      styles: ['layout','management','colors','equipment'],
      layout: ['management','equipment','tabs'],
      behavior: ['management','equipment','tracking','maintenance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/EquipmentManagement.tsx',
    importPath: '../equipment/EquipmentManagement'
},

  // UNIVERSAL COMMUNICATION COMPONENTS
  {
    id: 'universal-communication-alt',
    name: 'UniversalCommunication',
    category: 'communication',
    description: 'Alternative universal communication hub for all interaction types',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['profession','userId'],
      optional: ['onMessageSend','onNotificationCreate']
  },
    customization: {
      styles: ['layout','chat','notifications','colors'],
      layout: ['sidebar','main','tabs'],
      behavior: ['messaging','notifications','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalCommunication.tsx',
    importPath: './UniversalCommunication'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS COMPONENTS
  {
    id: 'google-analytics-dashboard',
    name: 'GoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Google Analytics dashboard for analytics management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','reportingMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','charts','tabs'],
      behavior: ['analytics','google','dashboard','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/google-analytics-dashboard.tsx',
    importPath: './admin/google-analytics-dashboard'
},

  // ROYALTIES COMPONENTS
  {
    id: 'royalties-management-dashboard-alt',
    name: 'RoyaltiesManagementDashboard',
    category: 'integration',
    description: 'Alternative royalties management dashboard for royalty tracking',
    profession: ['music_producer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onRoyaltyUpdate','royaltyPeriod','paymentMethod','reporting']
  },
    customization: {
      styles: ['layout','dashboard','colors','royalties'],
      layout: ['dashboard','tables','charts'],
      behavior: ['management','royalties','tracking','payments']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/royalties/RoyaltiesManagementDashboard.tsx',
    importPath: '../royalties/RoyaltiesManagementDashboard'
},

  // ADDITIONAL ADMIN DASHBOARD COMPONENTS
  {
    id: 'design-system-dashboard',
    name: 'DesignSystemDashboard',
    category: 'admin',
    description: 'Design system dashboard for design system management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDesignSystemUpdate','systemScope','designMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','design'],
      layout: ['dashboard','tabs','components'],
      behavior: ['design','system','management','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/DesignSystemDashboard.tsx',
    importPath: './DesignSystemDashboard'
},
  {
    id: 'analytics-dashboard',
    name: 'AnalyticsDashboard',
    category: 'admin',
    description: 'Analytics dashboard for analytics and reporting',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','reportingMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','charts','tabs'],
      behavior: ['analytics','reporting','dashboard','insights']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/AnalyticsDashboard.tsx',
    importPath: './AnalyticsDashboard'
},
  {
    id: 'team-collaboration-dashboard',
    name: 'TeamCollaborationDashboard',
    category: 'admin',
    description: 'Team collaboration dashboard for team management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTeamUpdate','collaborationMode','teamScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','collaboration'],
      layout: ['dashboard','tabs','teams'],
      behavior: ['collaboration','team','management','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/TeamCollaborationDashboard.tsx',
    importPath: './TeamCollaborationDashboard'
},
  {
    id: 'template-preset-dashboard',
    name: 'TemplatePresetDashboard',
    category: 'admin',
    description: 'Template preset dashboard for template management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTemplateUpdate','templateScope','presetMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','templates'],
      layout: ['dashboard','tabs','templates'],
      behavior: ['templates','presets','management','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/TemplatePresetDashboard.tsx',
    importPath: './TemplatePresetDashboard'
},
  {
    id: 'system-management-dashboard',
    name: 'SystemManagementDashboard',
    category: 'admin',
    description: 'System management dashboard for system administration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSystemUpdate','systemScope','managementMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','system'],
      layout: ['dashboard','tabs','system'],
      behavior: ['system','management','administration','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/SystemManagementDashboard.tsx',
    importPath: './SystemManagementDashboard'
},
  {
    id: 'monitoring-dashboard',
    name: 'MonitoringDashboard',
    category: 'admin',
    description: 'Monitoring dashboard for system monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMonitoringUpdate','monitoringScope','alertMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','monitoring'],
      layout: ['dashboard','charts','alerts'],
      behavior: ['monitoring','alerts','system','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/MonitoringDashboard.tsx',
    importPath: './MonitoringDashboard'
},
  {
    id: 'visual-editor-properties',
    name: 'VisualEditorProperties',
    category: 'system',
    description: 'Visual editor properties panel for property editing',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPropertyUpdate','propertyScope','editorMode']
  },
    customization: {
      styles: ['layout','properties','colors','editor'],
      layout: ['panel','properties','forms'],
      behavior: ['properties','editing','visual','editor']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/visual-editor/VisualEditorProperties.tsx',
    importPath: './VisualEditorProperties'
},

  // UNIVERSAL DASHBOARD NOTIFICATION INTEGRATION
  {
    id: 'universal-dashboard-notification-integration',
    name: 'UniversalDashboardNotificationIntegration',
    category: 'system',
    description: 'Universal dashboard notification integration for notifications',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onNotificationUpdate','notificationScope','integrationMode']
  },
    customization: {
      styles: ['layout','integration','colors','notifications'],
      layout: ['integration','notifications','alerts'],
      behavior: ['notifications','integration','dashboard','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDashboardNotificationIntegration.tsx',
    importPath: './UniversalDashboardNotificationIntegration'
},

  // BACKUP MANAGEMENT COMPONENTS
  {
    id: 'backup-management-interface',
    name: 'BackupManagementInterface',
    category: 'admin',
    description: 'Backup management interface for backup operations',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onBackupUpdate','backupScope','managementMode']
  },
    customization: {
      styles: ['layout','interface','colors','backup'],
      layout: ['interface','backup','tabs'],
      behavior: ['backup','management','interface','operations']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/BackupManagementInterface.tsx',
    importPath: '../admin/BackupManagementInterface'
},

  // GOOGLE WALLET INTEGRATION TEST
  {
    id: 'google-wallet-integration-test',
    name: 'GoogleWalletIntegrationTest',
    category: 'integration',
    description: 'Google Wallet integration test for testing wallet functionality',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrationTest','testScope','walletServices']
  },
    customization: {
      styles: ['layout','test','colors','integration'],
      layout: ['test','integration','tabs'],
      behavior: ['testing','integration','wallet','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GoogleWalletIntegrationTest.tsx',
    importPath: '../admin/GoogleWalletIntegrationTest'
},

  // PAYMENT SYSTEMS INTEGRATION TEST
  {
    id: 'payment-systems-integration-test',
    name: 'PaymentSystemsIntegrationTest',
    category: 'integration',
    description: 'Payment systems integration test for testing payment functionality',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrationTest','testScope','paymentServices']
  },
    customization: {
      styles: ['layout','test','colors','integration'],
      layout: ['test','integration','tabs'],
      behavior: ['testing','integration','payment','systems']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/PaymentSystemsIntegrationTest.tsx',
    importPath: '../admin/PaymentSystemsIntegrationTest'
},

  // ADMIN DASHBOARD INTEGRATION TEST
  {
    id: 'admin-dashboard-integration-test',
    name: 'AdminDashboardIntegrationTest',
    category: 'integration',
    description: 'Admin dashboard integration test for testing dashboard functionality',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrationTest','testScope','dashboardServices']
  },
    customization: {
      styles: ['layout','test','colors','integration'],
      layout: ['test','integration','tabs'],
      behavior: ['testing','integration','dashboard','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AdminDashboardIntegrationTest.tsx',
    importPath: '../admin/AdminDashboardIntegrationTest'
},

  // STORY ARC AUTO MONITOR
  {
    id: 'story-arc-auto-monitor-alt',
    name: 'StoryArcAutoMonitor',
    category: 'ai',
    description: 'Alternative story arc auto monitor for narrative tracking',
    profession: ['videographer','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onStoryUpdate','storyMode','autoMonitoring']
  },
    customization: {
      styles: ['layout','monitor','colors','story'],
      layout: ['monitor','story','arc'],
      behavior: ['monitoring','story','arc','narrative']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/StoryArcAutoMonitor.tsx',
    importPath: '../StoryArcAutoMonitor'
},

  // TRAVEL COMPONENTS
  {
    id: 'toll-calculation-modal-alt',
    name: 'TollCalculationModal',
    category: 'modal',
    description: 'Alternative toll calculation modal for travel cost calculation',
    profession: ['photographer','videographer','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onCalculationComplete','routeData','vehicleType','calculationMode']
  },
    customization: {
      styles: ['layout','modal','colors','calculation'],
      layout: ['modal','calculation','form'],
      behavior: ['calculation','modal','toll','travel']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/travel/TollCalculationModal.tsx',
    importPath: '../travel/TollCalculationModal'
},

  // MODALS COMPONENTS
  {
    id: 'quote-generator-modal-alt',
    name: 'QuoteGeneratorModal',
    category: 'modal',
    description: 'Alternative quote generator modal for creating quotes',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onQuoteGenerate','clientId','quoteTemplate','pricingData']
  },
    customization: {
      styles: ['layout','modal','colors','generator'],
      layout: ['modal','generator','form'],
      behavior: ['generation','modal','quote','pricing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/QuoteGeneratorModal.tsx',
    importPath: '../modals/QuoteGeneratorModal'
},
  {
    id: 'create-category-modal-alt',
    name: 'CreateCategoryModal',
    category: 'modal',
    description: 'Alternative create category modal for category management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onCategoryCreate','parentCategory','categoryType','validation']
  },
    customization: {
      styles: ['layout','modal','colors','form'],
      layout: ['modal','form','creation'],
      behavior: ['creation','modal','category','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/CreateCategoryModal.tsx',
    importPath: '../modals/CreateCategoryModal'
},

  // WEDDING COMPONENTS
  {
    id: 'wedding-timeline-client-alt',
    name: 'WeddingTimelineClient',
    category: 'management',
    description: 'Alternative wedding timeline client view and interaction interface',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onClientInteraction','readOnly']
  },
    customization: {
      styles: ['layout','timeline','colors','animations'],
      layout: ['timeline','cards','grid'],
      behavior: ['interaction','validation','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineClient.tsx',
    importPath: '../wedding/WeddingTimelineClient'
},

  // SHIPPING COMPONENTS
  {
    id: 'postal-code-validator-alt',
    name: 'PostalCodeValidator',
    category: 'integration',
    description: 'Alternative postal code validator for address validation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['country','onValidation','validationMode','autoComplete']
  },
    customization: {
      styles: ['layout','validator','colors','validation'],
      layout: ['validator','input','status'],
      behavior: ['validation','postal','address','geocoding']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shipping/PostalCodeValidator.tsx',
    importPath: '../shipping/PostalCodeValidator'
},
  {
    id: 'package-tracker-alt',
    name: 'PackageTracker',
    category: 'integration',
    description: 'Alternative package tracker for shipping monitoring',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['carrier','onStatusUpdate','autoRefresh','notifications']
  },
    customization: {
      styles: ['layout','tracker','colors','status'],
      layout: ['tracker','status','timeline'],
      behavior: ['tracking','shipping','monitoring','status']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shipping/PackageTracker.tsx',
    importPath: '../shipping/PackageTracker'
},
  {
    id: 'shipping-calculator-alt',
    name: 'ShippingCalculator',
    category: 'integration',
    description: 'Alternative shipping calculator for cost estimation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['origin','destination'],
      optional: ['weight','dimensions','serviceType','onCalculation']
  },
    customization: {
      styles: ['layout','calculator','colors','estimation'],
      layout: ['calculator','form','results'],
      behavior: ['calculation','shipping','cost','estimation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shipping/ShippingCalculator.tsx',
    importPath: '../shipping/ShippingCalculator'
},

  // PHOTOGRAPHER COMPONENTS
  {
    id: 'photographer-photo-suite-alt',
    name: 'PhotographerPhotoSuite',
    category: 'ai',
    description: 'Alternative photographer photo suite for professional photo editing',
    profession: ['photographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPhotoProcess','photoMode','professionalTools']
  },
    customization: {
      styles: ['layout','suite','colors','professional'],
      layout: ['suite','professional','tabs'],
      behavior: ['photo','editing','professional','suite']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photographer/PhotographerPhotoSuite.tsx',
    importPath: '../photographer/PhotographerPhotoSuite'
},

  // PROOFING COMPONENTS
  {
    id: 'client-auth-dialog-alt',
    name: 'ClientAuthDialog',
    category: 'modal',
    description: 'Alternative client authentication dialog for client access',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onAuthSuccess','authType','clientId','securityLevel']
  },
    customization: {
      styles: ['layout','dialog','colors','auth'],
      layout: ['dialog','auth','form'],
      behavior: ['authentication','dialog','client','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/proofing/ClientAuthDialog.tsx',
    importPath: '../proofing/ClientAuthDialog'
},

  // SHARED COMPONENTS
  {
    id: 'project-selector-modal-alt',
    name: 'ProjectSelectorModal',
    category: 'modal',
    description: 'Alternative project selector modal for project selection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onProjectSelect','selectedProject','projectFilter','multiSelect']
  },
    customization: {
      styles: ['layout','modal','colors','selector'],
      layout: ['modal','selector','list'],
      behavior: ['selection','modal','project','filtering']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/shared/ProjectSelectorModal.tsx',
    importPath: '../shared/ProjectSelectorModal'
},

  // DAVINCI RESOLVE COMPONENTS
  {
    id: 'resolve-project-creator-alt',
    name: 'ResolveProjectCreator',
    category: 'integration',
    description: 'Alternative DaVinci Resolve project creator for video editing integration',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onProjectCreate','resolveVersion','projectTemplate']
  },
    customization: {
      styles: ['layout','creator','colors','integration'],
      layout: ['creator','integration','templates'],
      behavior: ['resolve','project','creation','integration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/davinci-resolve/ResolveProjectCreator.tsx',
    importPath: '../davinci-resolve/ResolveProjectCreator'
},

  // BUSINESS LOGO UPLOAD
  {
    id: 'business-logo-upload-alt',
    name: 'BusinessLogoUpload',
    category: 'business',
    description: 'Alternative business logo upload for branding management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onLogoUpload','logoType','brandingMode']
  },
    customization: {
      styles: ['layout','upload','colors','logo'],
      layout: ['upload','logo','branding'],
      behavior: ['upload','logo','branding','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessLogoUpload.tsx',
    importPath: '../BusinessLogoUpload'
},

  // UNIVERSAL MISC COMPONENTS
  {
    id: 'creator-hub-photo-enhancer-alt',
    name: 'CreatorHubPhotoEnhancer',
    category: 'ai',
    description: 'Alternative CreatorHub photo enhancement tool',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEnhancementComplete','enhancementMode','batchMode']
  },
    customization: {
      styles: ['layout','enhancer','colors','processing'],
      layout: ['enhancer','processing','batch'],
      behavior: ['enhancement','processing','batch','ai-powered']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/misc/CreatorHubPhotoEnhancer.tsx',
    importPath: './misc/CreatorHubPhotoEnhancer'
},

  // PHOTOGRAPHY TIPS COMPONENTS
  {
    id: 'photography-tips-overlay-alt',
    name: 'PhotographyTipsOverlay',
    category: 'ai',
    description: 'Alternative photography tips overlay for contextual guidance',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTipSelect','tipCategories','overlayMode']
  },
    customization: {
      styles: ['layout','overlay','colors','animations'],
      layout: ['overlay','floating','modal'],
      behavior: ['tips','guidance','contextual','overlay']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/PhotographyTipsOverlay.tsx',
    importPath: '../photography-tips/PhotographyTipsOverlay'
},
  {
    id: 'camera-detector-alt',
    name: 'CameraDetector',
    category: 'equipment',
    description: 'Alternative camera detection and identification system',
    profession: ['photographer','videographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCameraDetected','detectionMode','autoConnect']
  },
    customization: {
      styles: ['layout','detector','colors','status'],
      layout: ['detector','status','cards'],
      behavior: ['detection','identification','connection','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/CameraDetector.tsx',
    importPath: '../photography-tips/CameraDetector'
},

  // EXTRA IMAGE PRICING DIALOG
  {
    id: 'extra-image-pricing-dialog-alt',
    name: 'ExtraImagePricingDialog',
    category: 'modal',
    description: 'Alternative extra image pricing dialog for additional image pricing',
    profession: ['photographer','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onPricingUpdate','imageCount','pricingTier','discountLevel']
  },
    customization: {
      styles: ['layout','dialog','colors','pricing'],
      layout: ['dialog','pricing','form'],
      behavior: ['pricing','dialog','image','calculation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExtraImagePricingDialog.tsx',
    importPath: '../ExtraImagePricingDialog'
},

  // INVITE REQUEST FORM
  {
    id: 'invite-request-form-alt',
    name: 'InviteRequestForm',
    category: 'form',
    description: 'Alternative invite request form for user invitations',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCancel','inviteType','userRole','validation']
  },
    customization: {
      styles: ['layout','form','colors','invite'],
      layout: ['form','invite','fields'],
      behavior: ['invitation','form','request','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/InviteRequestForm.tsx',
    importPath: '../InviteRequestForm'
},

  // NEWS COMPONENTS
  {
    id: 'personalized-news-interface-alt',
    name: 'PersonalizedNewsInterface',
    category: 'content',
    description: 'Alternative personalized news interface for content consumption',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onNewsSelect','newsCategories','personalizationLevel']
  },
    customization: {
      styles: ['layout','interface','colors','news'],
      layout: ['interface','news','feed'],
      behavior: ['news','personalized','content','feed']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/news/PersonalizedNewsInterface.tsx',
    importPath: '../news/PersonalizedNewsInterface'
},

  // SHOWCASE COMPONENTS
  {
    id: 'showcase-drive-grid-alt',
    name: 'ShowcaseDriveGrid',
    category: 'showcase',
    description: 'Alternative showcase drive grid for file organization and display',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileSelect','gridMode','driveIntegration']
  },
    customization: {
      styles: ['layout','grid','colors','drive'],
      layout: ['grid','drive','files'],
      behavior: ['grid','drive','files','organization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseDriveGrid.tsx',
    importPath: '../showcase/ShowcaseDriveGrid'
},

  // CATEGORY MANAGER
  {
    id: 'category-manager-alt',
    name: 'CategoryManager',
    category: 'management',
    description: 'Alternative category manager for content categorization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCategoryUpdate','categoryType','hierarchicalMode']
  },
    customization: {
      styles: ['layout','manager','colors','categories'],
      layout: ['manager','categories','hierarchy'],
      behavior: ['management','categories','organization','hierarchy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/CategoryManager.tsx',
    importPath: '../showcase/CategoryManager'
},

  // PRICING MANAGEMENT
  {
    id: 'pricing-management-alt',
    name: 'PricingManagement',
    category: 'business',
    description: 'Alternative pricing management for business pricing strategies',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingStrategy','businessMode']
  },
    customization: {
      styles: ['layout','management','colors','pricing'],
      layout: ['management','pricing','strategy'],
      behavior: ['management','pricing','business','strategy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/pricing/PricingManagement.tsx',
    importPath: '../pricing/PricingManagement'
},

  // ADDITIONAL UNIVERSAL DASHBOARD COMPONENTS
  {
    id: 'universal-dashboard-integration',
    name: 'UniversalDashboardIntegration',
    category: 'system',
    description: 'Universal dashboard integration for cross-platform coordination',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onIntegrationUpdate','integrationMode','crossPlatform']
  },
    customization: {
      styles: ['layout','integration','colors','dashboard'],
      layout: ['integration','dashboard','coordination'],
      behavior: ['integration','dashboard','universal','coordination']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDashboardIntegration.tsx',
    importPath: './UniversalDashboardIntegration'
},

  // UNIVERSAL ADMIN COMPONENTS
  {
    id: 'universal-admin-dashboard',
    name: 'UniversalAdminDashboard',
    category: 'admin',
    description: 'Universal admin dashboard for comprehensive administration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAdminUpdate','adminScope','universalMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','admin'],
      layout: ['dashboard','admin','universal'],
      behavior: ['admin','dashboard','universal','administration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminDashboard.tsx',
    importPath: './admin/UniversalAdminDashboard'
},

  // UNIVERSAL MISC COMPONENTS
  {
    id: 'universal-misc-dashboard',
    name: 'UniversalMiscDashboard',
    category: 'admin',
    description: 'Universal misc dashboard for miscellaneous administration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMiscUpdate','miscScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','misc'],
      layout: ['dashboard','misc','tabs'],
      behavior: ['misc','dashboard','administration','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/misc/UniversalMiscDashboard.tsx',
    importPath: './misc/UniversalMiscDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS
  {
    id: 'universal-admin-google-analytics',
    name: 'UniversalAdminGoogleAnalytics',
    category: 'admin',
    description: 'Universal admin Google Analytics for comprehensive analytics',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','googleIntegration']
  },
    customization: {
      styles: ['layout','analytics','colors','google'],
      layout: ['analytics','google','charts'],
      behavior: ['analytics','google','admin','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalytics.tsx',
    importPath: './admin/UniversalAdminGoogleAnalytics'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD
  {
    id: 'universal-admin-google-analytics-dashboard',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Universal admin Google Analytics dashboard for analytics management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 2
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Second alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 3
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Third alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 4
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Fourth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 5
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Fifth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 6
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Sixth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 7
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Seventh alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 8
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Eighth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 9
  {
    id: 'universal-admin-google-analytics-dashboard-alt-',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Ninth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 10
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Tenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 11
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Eleventh alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 12
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Twelfth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 13
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Thirteenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 14
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Fourteenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 15
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Fifteenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 16
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Sixteenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 17
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Seventeenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 18
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Eighteenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 19
  {
    id: 'universal-admin-google-analytics-dashboard-alt-1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Nineteenth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // UNIVERSAL ADMIN GOOGLE ANALYTICS DASHBOARD ALT 20
  {
    id: 'universal-admin-google-analytics-dashboard-alt-2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Twentieth alternative universal admin Google Analytics dashboard',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsScope','dashboardMode']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','charts'],
      behavior: ['analytics','dashboard','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // ADDITIONAL COMPONENT CATEGORIES
  {
    id: 'export-dialog',
    name: 'ExportDialog',
    category: 'modal',
    description: 'Export dialog for exporting projects and content',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onExport','exportType','exportOptions','projectData']
  },
    customization: {
      styles: ['layout','dialog','colors','export'],
      layout: ['dialog','export','options'],
      behavior: ['export','dialog','project','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExportDialog.tsx',
    importPath: '../ExportDialog'
},

  // WEDDING TIMELINE COMPONENTS
  {
    id: 'wedding-timeline-admin',
    name: 'WeddingTimelineAdmin',
    category: 'management',
    description: 'Wedding timeline administration for wedding event management',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTimelineUpdate','adminMode','eventTypes','timelineScope']
  },
    customization: {
      styles: ['layout','admin','colors','timeline'],
      layout: ['admin','timeline','events'],
      behavior: ['admin','timeline','events','wedding']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineAdmin.tsx',
    importPath: '../wedding/WeddingTimelineAdmin'
},
  {
    id: 'wedding-timeline-client-access',
    name: 'WeddingTimelineClientAccess',
    category: 'management',
    description: 'Wedding timeline client access for client interaction',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onClientAccess','accessLevel','clientPermissions']
  },
    customization: {
      styles: ['layout','access','colors','client'],
      layout: ['access','client','permissions'],
      behavior: ['access','client','timeline','permissions']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineClientAccess.tsx',
    importPath: '../wedding/WeddingTimelineClientAccess'
},
  {
    id: 'wedding-timeline-client-view',
    name: 'WeddingTimelineClientView',
    category: 'management',
    description: 'Wedding timeline client view for client display',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onClientView','viewMode','clientSettings']
  },
    customization: {
      styles: ['layout','view','colors','client'],
      layout: ['view','client','display'],
      behavior: ['view','client','timeline','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineClientView.tsx',
    importPath: '../wedding/WeddingTimelineClientView'
},
  {
    id: 'wedding-timeline-changes-overview',
    name: 'WeddingTimelineChangesOverview',
    category: 'management',
    description: 'Wedding timeline changes overview for change tracking',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onChangesUpdate','changeTracking','overviewMode']
  },
    customization: {
      styles: ['layout','overview','colors','changes'],
      layout: ['overview','changes','tracking'],
      behavior: ['overview','changes','timeline','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineChangesOverview.tsx',
    importPath: '../wedding/WeddingTimelineChangesOverview'
},
  {
    id: 'wedding-timeline-overview',
    name: 'WeddingTimelineOverview',
    category: 'management',
    description: 'Wedding timeline overview for timeline summary',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onOverviewUpdate','overviewMode','summaryLevel']
  },
    customization: {
      styles: ['layout','overview','colors','summary'],
      layout: ['overview','summary','timeline'],
      behavior: ['overview','summary','timeline','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimelineOverview.tsx',
    importPath: '../wedding/WeddingTimelineOverview'
},

  // COMMUNICATION & CHAT COMPONENTS
  {
    id: 'universal-chat-widget',
    name: 'UniversalChatWidget',
    category: 'communication',
    description: 'Universal chat widget for communication',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onMessageSend','chatMode','widgetSettings']
  },
    customization: {
      styles: ['layout','widget','colors','chat'],
      layout: ['widget','chat','messages'],
      behavior: ['chat','widget','communication','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/UniversalChatWidget.tsx',
    importPath: '../chat/UniversalChatWidget'
},

  // FILE & ASSET MANAGEMENT COMPONENTS
  {
    id: 'asset-browser',
    name: 'AssetBrowser',
    category: 'file',
    description: 'Asset browser for file and asset management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onAssetSelect','browserMode','assetTypes']
  },
    customization: {
      styles: ['layout','browser','colors','assets'],
      layout: ['browser','assets','grid'],
      behavior: ['browser','assets','files','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/assets/AssetBrowser.tsx',
    importPath: '../assets/AssetBrowser'
},
  {
    id: 'memory-card-manager',
    name: 'MemoryCardManager',
    category: 'file',
    description: 'Memory card manager for memory card management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCardUpdate','cardType','managementMode']
  },
    customization: {
      styles: ['layout','manager','colors','cards'],
      layout: ['manager','cards','tabs'],
      behavior: ['manager','cards','memory','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardManager.tsx',
    importPath: '../memory-card/MemoryCardManager'
},
  {
    id: 'file-detection-dashboard-widget',
    name: 'FileDetectionDashboardWidget',
    category: 'file',
    description: 'File detection dashboard widget for file monitoring',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileDetected','detectionMode','widgetSettings']
  },
    customization: {
      styles: ['layout','widget','colors','detection'],
      layout: ['widget','detection','dashboard'],
      behavior: ['detection','widget','files','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/file-detection/FileDetectionDashboardWidget.tsx',
    importPath: '../file-detection/FileDetectionDashboardWidget'
},
  {
    id: 'recent-uploads-widget',
    name: 'RecentUploadsWidget',
    category: 'file',
    description: 'Recent uploads widget for upload tracking',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onUploadSelect','uploadTypes','widgetMode']
  },
    customization: {
      styles: ['layout','widget','colors','uploads'],
      layout: ['widget','uploads','recent'],
      behavior: ['uploads','widget','recent','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/uploads/RecentUploadsWidget.tsx',
    importPath: '../uploads/RecentUploadsWidget'
},

  // PHOTOGRAPHY TIPS COMPONENTS
  {
    id: 'photography-tips-overlay',
    name: 'PhotographyTipsOverlay',
    category: 'ai',
    description: 'Photography tips overlay for contextual guidance',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTipSelect','tipCategories','overlayMode']
  },
    customization: {
      styles: ['layout','overlay','colors','tips'],
      layout: ['overlay','tips','guidance'],
      behavior: ['tips','overlay','guidance','photography']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/PhotographyTipsOverlay.tsx',
    importPath: '../photography-tips/PhotographyTipsOverlay'
},
  {
    id: 'contextual-photography-tips-overlay',
    name: 'ContextualPhotographyTipsOverlay',
    category: 'ai',
    description: 'Contextual photography tips overlay for smart guidance',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContextualTip','contextMode','smartGuidance']
  },
    customization: {
      styles: ['layout','overlay','colors','contextual'],
      layout: ['overlay','contextual','smart'],
      behavior: ['contextual','tips','smart','guidance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/ContextualPhotographyTipsOverlay.tsx',
    importPath: '../photography-tips/ContextualPhotographyTipsOverlay'
},
  {
    id: 'photography-tips-center',
    name: 'PhotographyTipsCenter',
    category: 'ai',
    description: 'Photography tips center for comprehensive guidance',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTipCenterUpdate','centerMode','comprehensiveGuidance']
  },
    customization: {
      styles: ['layout','center','colors','tips'],
      layout: ['center','tips','comprehensive'],
      behavior: ['center','tips','comprehensive','guidance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/PhotographyTipsCenter.tsx',
    importPath: '../photography-tips/PhotographyTipsCenter'
},
  {
    id: 'camera-selection-step',
    name: 'CameraSelectionStep',
    category: 'equipment',
    description: 'Camera selection step for equipment selection',
    profession: ['photographer','videographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCameraSelect','selectionMode','equipmentType']
  },
    customization: {
      styles: ['layout','step','colors','selection'],
      layout: ['step','selection','camera'],
      behavior: ['selection','step','camera','equipment']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/CameraSelectionStep.tsx',
    importPath: '../photography-tips/CameraSelectionStep'
},

  // VIDEO & AUDIO COMPONENTS
  {
    id: 'videographer-video-suite',
    name: 'VideographerVideoSuite',
    category: 'ai',
    description: 'Videographer video suite for professional video editing',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onVideoProcess','videoMode','professionalTools']
  },
    customization: {
      styles: ['layout','suite','colors','video'],
      layout: ['suite','video','professional'],
      behavior: ['video','suite','professional','editing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/videographer/VideographerVideoSuite.tsx',
    importPath: '../videographer/VideographerVideoSuite'
},
  {
    id: 'audio-enhancement-suite',
    name: 'AudioEnhancementSuite',
    category: 'ai',
    description: 'Audio enhancement suite for professional audio processing',
    profession: ['music_producer','videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onAudioProcess','audioMode','enhancementTools']
  },
    customization: {
      styles: ['layout','suite','colors','audio'],
      layout: ['suite','audio','enhancement'],
      behavior: ['audio','suite','enhancement','processing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/audio/AudioEnhancementSuite.tsx',
    importPath: '../audio/AudioEnhancementSuite'
},

  // SYSTEM & UTILITY COMPONENTS
  {
    id: 'project-selector-modal',
    name: 'ProjectSelectorModal',
    category: 'modal',
    description: 'Project selector modal for project selection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onProjectSelect','selectedProject','projectFilter','multiSelect']
  },
    customization: {
      styles: ['layout','modal','colors','selector'],
      layout: ['modal','selector','projects'],
      behavior: ['selector','modal','project','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/ProjectSelectorModal.tsx',
    importPath: '../modals/ProjectSelectorModal'
},

  // SPECIALIZED INTEGRATION COMPONENTS
  {
    id: 'norwegian-tax-calculator',
    name: 'NorwegianTaxCalculator',
    category: 'integration',
    description: 'Norwegian tax calculator for tax calculation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTaxCalculate','taxYear','calculationMode']
  },
    customization: {
      styles: ['layout','calculator','colors','tax'],
      layout: ['calculator','tax','norwegian'],
      behavior: ['calculator','tax','norwegian','calculation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/tax/NorwegianTaxCalculator.tsx',
    importPath: '../tax/NorwegianTaxCalculator'
},
  {
    id: 'firmware-update-manager',
    name: 'FirmwareUpdateManager',
    category: 'integration',
    description: 'Firmware update manager for device firmware management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFirmwareUpdate','deviceType','updateMode']
  },
    customization: {
      styles: ['layout','manager','colors','firmware'],
      layout: ['manager','firmware','updates'],
      behavior: ['manager','firmware','updates','devices']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/firmware/FirmwareUpdateManager.tsx',
    importPath: '../firmware/FirmwareUpdateManager'
},

  // SOCIAL MEDIA & MARKETING COMPONENTS
  {
    id: 'viral-content-creator',
    name: 'ViralContentCreator',
    category: 'ai',
    description: 'Viral content creator for trending content generation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentCreate','viralMode','trendingAnalysis']
  },
    customization: {
      styles: ['layout','creator','colors','viral'],
      layout: ['creator','viral','content'],
      behavior: ['viral','creator','content','trending']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/ViralContentCreator.tsx',
    importPath: '../social-media/ViralContentCreator'
},

  // CALENDAR & SCHEDULING COMPONENTS
  {
    id: 'super-smart-writing-interface',
    name: 'SuperSmartWritingInterface',
    category: 'ai',
    description: 'Super smart writing interface for content creation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentWrite','writingMode','aiAssistance']
  },
    customization: {
      styles: ['layout','interface','colors','writing'],
      layout: ['interface','writing','smart'],
      behavior: ['writing','interface','smart','ai']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/writing/SuperSmartWritingInterface.tsx',
    importPath: '../writing/SuperSmartWritingInterface'
},

  // EQUIPMENT & GEAR COMPONENTS
  {
    id: 'camera-equipment-manager',
    name: 'CameraEquipmentManager',
    category: 'equipment',
    description: 'Camera equipment manager for camera gear management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEquipmentUpdate','equipmentType','cameraGear']
  },
    customization: {
      styles: ['layout','manager','colors','camera'],
      layout: ['manager','camera','equipment'],
      behavior: ['manager','camera','equipment','gear']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/CameraEquipmentManager.tsx',
    importPath: '../equipment/CameraEquipmentManager'
},
  {
    id: 'comprehensive-equipment-dashboard',
    name: 'ComprehensiveEquipmentDashboard',
    category: 'equipment',
    description: 'Comprehensive equipment dashboard for equipment management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEquipmentDashboardUpdate','dashboardMode','equipmentScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','equipment'],
      layout: ['dashboard','equipment','comprehensive'],
      behavior: ['dashboard','equipment','comprehensive','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/ComprehensiveEquipmentDashboard.tsx',
    importPath: '../equipment/ComprehensiveEquipmentDashboard'
},

  // NEWS & CONTENT COMPONENTS
  {
    id: 'personalized-news-interface',
    name: 'PersonalizedNewsInterface',
    category: 'content',
    description: 'Personalized news interface for content consumption',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onNewsSelect','newsCategories','personalizationLevel']
  },
    customization: {
      styles: ['layout','interface','colors','news'],
      layout: ['interface','news','personalized'],
      behavior: ['news','interface','personalized','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/news/PersonalizedNewsInterface.tsx',
    importPath: '../news/PersonalizedNewsInterface'
},

  // KEYBOARD & ACCESSIBILITY COMPONENTS
  {
    id: 'keyboard-shortcuts-interface',
    name: 'KeyboardShortcutsInterface',
    category: 'accessibility',
    description: 'Keyboard shortcuts interface for accessibility',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  13,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShortcutUpdate','shortcutMode','accessibilityLevel']
  },
    customization: {
      styles: ['layout','interface','colors','shortcuts'],
      layout: ['interface','shortcuts','keyboard'],
      behavior: ['shortcuts','interface','keyboard','accessibility']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/accessibility/KeyboardShortcutsInterface.tsx',
    importPath: '../accessibility/KeyboardShortcutsInterface'
},

  // PROTOTYPE & TESTING COMPONENTS
  {
    id: 'prototype-feedback-tool',
    name: 'PrototypeFeedbackTool',
    category: 'testing',
    description: 'Prototype feedback tool for testing and feedback collection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFeedbackSubmit','feedbackType','testingMode']
  },
    customization: {
      styles: ['layout','tool','colors','feedback'],
      layout: ['tool','feedback','prototype'],
      behavior: ['feedback','tool','prototype','testing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/PrototypeFeedbackTool.tsx',
    importPath: '../testing/PrototypeFeedbackTool'
},
  {
    id: 'universal-prototype-feedback',
    name: 'UniversalPrototypeFeedback',
    category: 'testing',
    description: 'Universal prototype feedback for comprehensive testing',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onUniversalFeedback','feedbackScope','universalMode']
  },
    customization: {
      styles: ['layout','feedback','colors','universal'],
      layout: ['feedback','universal','prototype'],
      behavior: ['feedback','universal','prototype','comprehensive']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/UniversalPrototypeFeedback.tsx',
    importPath: '../testing/UniversalPrototypeFeedback'
},

  // SHOWCASE & GALLERY COMPONENTS
  {
    id: 'showcase-manager',
    name: 'ShowcaseManager',
    category: 'showcase',
    description: 'Showcase manager for portfolio management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShowcaseUpdate','showcaseType','portfolioMode']
  },
    customization: {
      styles: ['layout','manager','colors','showcase'],
      layout: ['manager','showcase','portfolio'],
      behavior: ['manager','showcase','portfolio','gallery']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseManager.tsx',
    importPath: '../showcase/ShowcaseManager'
},
  {
    id: 'showcase-drive-grid',
    name: 'ShowcaseDriveGrid',
    category: 'showcase',
    description: 'Showcase drive grid for file organization and display',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFileSelect','gridMode','driveIntegration']
  },
    customization: {
      styles: ['layout','grid','colors','drive'],
      layout: ['grid','drive','showcase'],
      behavior: ['grid','drive','showcase','files']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseDriveGrid.tsx',
    importPath: '../showcase/ShowcaseDriveGrid'
},
  {
    id: 'showcase-pricing-integration',
    name: 'ShowcasePricingIntegration',
    category: 'showcase',
    description: 'Showcase pricing integration for portfolio monetization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingMode','monetizationLevel']
  },
    customization: {
      styles: ['layout','integration','colors','pricing'],
      layout: ['integration','pricing','showcase'],
      behavior: ['integration','pricing','showcase','monetization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcasePricingIntegration.tsx',
    importPath: '../showcase/ShowcasePricingIntegration'
},
  {
    id: 'category-manager',
    name: 'CategoryManager',
    category: 'management',
    description: 'Category manager for content categorization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCategoryUpdate','categoryType','hierarchicalMode']
  },
    customization: {
      styles: ['layout','manager','colors','categories'],
      layout: ['manager','categories','hierarchy'],
      behavior: ['manager','categories','organization','hierarchy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/categories/CategoryManager.tsx',
    importPath: '../categories/CategoryManager'
},

  // BUSINESS & PRICING COMPONENTS
  {
    id: 'pricing-management',
    name: 'PricingManagement',
    category: 'business',
    description: 'Pricing management for business pricing strategies',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingStrategy','businessMode']
  },
    customization: {
      styles: ['layout','management','colors','pricing'],
      layout: ['management','pricing','business'],
      behavior: ['management','pricing','business','strategy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/business/PricingManagement.tsx',
    importPath: '../business/PricingManagement'
},
  {
    id: 'business-logo-upload',
    name: 'BusinessLogoUpload',
    category: 'business',
    description: 'Business logo upload for branding management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onLogoUpload','logoType','brandingMode']
  },
    customization: {
      styles: ['layout','upload','colors','logo'],
      layout: ['upload','logo','branding'],
      behavior: ['upload','logo','branding','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/business/BusinessLogoUpload.tsx',
    importPath: '../business/BusinessLogoUpload'
},

  // SPECIALIZED FORM COMPONENTS
  {
    id: 'songflow-platform',
    name: 'SongflowPlatform',
    category: 'form',
    description: 'Songflow platform form for music production workflow',
    profession: ['music_producer','admin'],
    tabIndex:  17,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormSubmit','formType','workflowMode']
  },
    customization: {
      styles: ['layout','form','colors','songflow'],
      layout: ['form','songflow','platform'],
      behavior: ['form','songflow','platform','music']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/forms/SongflowPlatform.tsx',
    importPath: '../forms/SongflowPlatform'
},
  {
    id: 'invite-request-form',
    name: 'InviteRequestForm',
    category: 'form',
    description: 'Invite request form for user invitations',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  17,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCancel','inviteType','userRole','validation']
  },
    customization: {
      styles: ['layout','form','colors','invite'],
      layout: ['form','invite','request'],
      behavior: ['form','invite','request','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/forms/InviteRequestForm.tsx',
    importPath: '../forms/InviteRequestForm'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 2
  {
    id: 'access-restricted',
    name: 'AccessRestricted',
    category: 'security',
    description: 'Access restricted component for security and permissions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onAccessRequest','accessLevel','permissionType']
  },
    customization: {
      styles: ['layout','restricted','colors','security'],
      layout: ['restricted','access','permissions'],
      behavior: ['restricted','access','security','permissions']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/access-restricted.tsx',
    importPath: '../access-restricted'
},

  // ADMIN PROFESSIONAL ANALYSIS COMPONENTS
  {
    id: 'admin-prof-analysis',
    name: 'AdminProffAnalysis',
    category: 'admin',
    description: 'Admin professional analysis for professional insights',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalysisUpdate','analysisType','professionalScope']
  },
    customization: {
      styles: ['layout','analysis','colors','admin'],
      layout: ['analysis','admin','professional'],
      behavior: ['analysis','admin','professional','insights']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AdminProffAnalysis.tsx',
    importPath: '../AdminProffAnalysis'
},

  // AI COLOR GRADING COMPONENTS
  {
    id: 'ai-color-grading',
    name: 'AIColorGrading',
    category: 'ai',
    description: 'AI color grading for professional color enhancement',
    profession: ['photographer','videographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onColorGrade','gradingMode','aiEnhancement']
  },
    customization: {
      styles: ['layout','grading','colors','ai'],
      layout: ['grading','ai','color'],
      behavior: ['grading','ai','color','enhancement']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AIColorGrading.tsx',
    importPath: '../AIColorGrading'
},

  // BUSINESS INTELLIGENCE DASHBOARD
  {
    id: 'business-intelligence-dashboard',
    name: 'BusinessIntelligenceDashboard',
    category: 'business',
    description: 'Business intelligence dashboard for business analytics',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onIntelligenceUpdate','intelligenceMode','businessScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','intelligence'],
      layout: ['dashboard','intelligence','business'],
      behavior: ['dashboard','intelligence','business','analytics']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessIntelligenceDashboard.tsx',
    importPath: '../BusinessIntelligenceDashboard'
},

  // CODE GENERATION STUDIO
  {
    id: 'code-generation-studio',
    name: 'CodeGenerationStudio',
    category: 'ai',
    description: 'Code generation studio for automated code creation',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCodeGenerate','generationType','studioMode']
  },
    customization: {
      styles: ['layout','studio','colors','code'],
      layout: ['studio','code','generation'],
      behavior: ['studio','code','generation','automation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CodeGenerationStudio.tsx',
    importPath: '../CodeGenerationStudio'
},

  // PROJECT CREATION WIZARD
  {
    id: 'project-creation-wizard',
    name: 'ProjectCreationWizard',
    category: 'management',
    description: 'Project creation wizard for guided project setup',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onProjectCreate','wizardType','creationMode']
  },
    customization: {
      styles: ['layout','wizard','colors','creation'],
      layout: ['wizard','creation','steps'],
      behavior: ['wizard','creation','project','guided']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ProjectCreationWizard.tsx',
    importPath: '../ProjectCreationWizard'
},

  // PRICE ADMINISTRATION
  {
    id: 'price-administration',
    name: 'PriceAdministration',
    category: 'business',
    description: 'Price administration for pricing management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPriceUpdate','administrationMode','pricingScope']
  },
    customization: {
      styles: ['layout','administration','colors','pricing'],
      layout: ['administration','pricing','management'],
      behavior: ['administration','pricing','management','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/PriceAdministration.tsx',
    importPath: '../PriceAdministration'
},

  // TWO FACTOR SETUP
  {
    id: 'two-factor-setup',
    name: 'TwoFactorSetup',
    category: 'security',
    description: 'Two factor setup for enhanced security',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onTwoFactorSetup','setupMode','securityLevel']
  },
    customization: {
      styles: ['layout','setup','colors','security'],
      layout: ['setup','security','two-factor'],
      behavior: ['setup','security','two-factor','authentication']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/TwoFactorSetup.tsx',
    importPath: '../TwoFactorSetup'
},

  // CREATOR HUB NOTES
  {
    id: 'creator-hub-notes',
    name: 'CreatorHubNotes',
    category: 'content',
    description: 'Creator Hub notes for note-taking and organization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onNoteUpdate','noteType','organizationMode']
  },
    customization: {
      styles: ['layout','notes','colors','content'],
      layout: ['notes','content','organization'],
      behavior: ['notes','content','organization','creator-hub']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/CreatorHubNotes.tsx',
    importPath: '../admin/CreatorHubNotes'
},

  // GOOGLE PAYMENTS CONFIGURATION
  {
    id: 'google-payments-configuration',
    name: 'GooglePaymentsConfiguration',
    category: 'integration',
    description: 'Google payments configuration for payment setup',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPaymentConfig','configurationMode','paymentScope']
  },
    customization: {
      styles: ['layout','configuration','colors','payments'],
      layout: ['configuration','payments','google'],
      behavior: ['configuration','payments','google','setup']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GooglePaymentsConfiguration.tsx',
    importPath: '../admin/GooglePaymentsConfiguration'
},

  // COMMAND PALETTE
  {
    id: 'command-palette',
    name: 'CommandPalette',
    category: 'system',
    description: 'Command palette for quick actions and navigation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCommandExecute','paletteMode','commandScope']
  },
    customization: {
      styles: ['layout','palette','colors','commands'],
      layout: ['palette','commands','actions'],
      behavior: ['palette','commands','actions','navigation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/CommandPalette.tsx',
    importPath: './CommandPalette'
},

  // SCROLL STORY
  {
    id: 'scroll-story',
    name: 'ScrollStory',
    category: 'ai',
    description: 'Scroll story for interactive storytelling',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onStoryUpdate','storyType','interactiveMode']
  },
    customization: {
      styles: ['layout','story','colors','scroll'],
      layout: ['story','scroll','interactive'],
      behavior: ['story','scroll','interactive','storytelling']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/scroll-story/ScrollStory.tsx',
    importPath: '../scroll-story/ScrollStory'
},

  // EMAIL DESIGNER
  {
    id: 'email-designer',
    name: 'EmailDesigner',
    category: 'content',
    description: 'Email designer for email template creation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  12,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEmailDesign','designType','templateMode']
  },
    customization: {
      styles: ['layout','designer','colors','email'],
      layout: ['designer','email','templates'],
      behavior: ['designer','email','templates','creation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/EmailDesigner/EmailDesigner.tsx',
    importPath: '../EmailDesigner/EmailDesigner'
},

  // UNIVERSAL VISUAL CMS
  {
    id: 'universal-visual-cms',
    name: 'UniversalVisualCM',
    category: 'cms',
    description: 'Universal visual CMS for content management',
    profession: [''],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCMSUpdate','cmsMode','visualScope']
  },
    customization: {
      styles: ['layout','cms','colors','visual'],
      layout: ['cms','visual','content'],
      behavior: ['cms','visual','content','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/cms/UniversalVisualCMS.tsx',
    importPath: '../cms/UniversalVisualCMS'
},

  // COMPONENT ORCHESTRATOR
  {
    id: 'component-orchestrator',
    name: 'ComponentOrchestrator',
    category: 'orchestrator',
    description: 'Component orchestrator for component coordination',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onComponentUpdate','orchestrationMode']
  },
    customization: {
      styles: ['layout','orchestrator','colors','coordination'],
      layout: ['grid','components','tabs'],
      behavior: ['orchestration','coordination','management','components']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/ComponentOrchestrator.tsx',
    importPath: './ComponentOrchestrator'
},

  // GOOGLE OAUTH SETUP
  {
    id: 'google-oauth-setup',
    name: 'GoogleOAuthSetup',
    category: 'integration',
    description: 'Google OAuth setup for authentication integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onOAuthSetup','setupMode','oauthScope']
  },
    customization: {
      styles: ['layout','setup','colors','oauth'],
      layout: ['setup','oauth','google'],
      behavior: ['setup','oauth','google','authentication']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/GoogleOAuthSetup.tsx',
    importPath: '../GoogleOAuthSetup'
},

  // UNIVERSAL VENDOR ONBOARDING
  {
    id: 'universal-vendor-onboarding',
    name: 'UniversalVendorOnboarding',
    category: 'onboarding',
    description: 'Universal vendor onboarding for vendor setup',
    profession: ['vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onOnboardingUpdate','onboardingType','vendorScope']
  },
    customization: {
      styles: ['layout','onboarding','colors','vendor'],
      layout: ['onboarding','vendor','setup'],
      behavior: ['onboarding','vendor','setup','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/UniversalVendorOnboarding.tsx',
    importPath: '../vendor/UniversalVendorOnboarding'
},

  // VENDOR TYPE MANAGER
  {
    id: 'vendor-type-manager',
    name: 'VendorTypeManager',
    category: 'management',
    description: 'Vendor type manager for vendor categorization',
    profession: ['vendor','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onVendorTypeUpdate','managementMode','vendorScope']
  },
    customization: {
      styles: ['layout','manager','colors','vendor'],
      layout: ['manager','vendor','types'],
      behavior: ['manager','vendor','types','categorization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/VendorTypeManager.tsx',
    importPath: '../vendor/VendorTypeManager'
},

  // WEDDING CODE ENTRY
  {
    id: 'wedding-code-entry',
    name: 'WeddingCodeEntry',
    category: 'management',
    description: 'Wedding code entry for wedding access codes',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCodeEntry','entryMode','weddingScope']
  },
    customization: {
      styles: ['layout','entry','colors','wedding'],
      layout: ['entry','wedding','code'],
      behavior: ['entry','wedding','code','access']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-code-entry.tsx',
    importPath: '../wedding-code-entry'
},

  // POWERFUL VENDOR SHOWCASE
  {
    id: 'powerful-vendor-showcase',
    name: 'PowerfulVendorShowcase',
    category: 'showcase',
    description: 'Powerful vendor showcase for vendor portfolio display',
    profession: ['vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onShowcaseUpdate','showcaseMode','vendorScope']
  },
    customization: {
      styles: ['layout','showcase','colors','vendor'],
      layout: ['showcase','vendor','powerful'],
      behavior: ['showcase','vendor','powerful','portfolio']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/PowerfulVendorShowcase.tsx',
    importPath: '../vendor/PowerfulVendorShowcase'
},

  // UNIVERSAL VENDOR DASHBOARD
  {
    id: 'universal-vendor-dashboard',
    name: 'UniversalVendorDashboard',
    category: 'admin',
    description: 'Universal vendor dashboard for vendor management',
    profession: ['vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onVendorUpdate','dashboardMode','vendorScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','vendor'],
      layout: ['dashboard','vendor','universal'],
      behavior: ['dashboard','vendor','universal','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/vendor/UniversalVendorDashboard.tsx',
    importPath: '../vendor/UniversalVendorDashboard'
},

  // COMPREHENSIVE ADMIN DASHBOARD
  {
    id: 'comprehensive-admin-dashboard',
    name: 'ComprehensiveAdminDashboard',
    category: 'admin',
    description: 'Comprehensive admin dashboard for complete administration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAdminUpdate','dashboardMode','comprehensiveScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','admin'],
      layout: ['dashboard','admin','comprehensive'],
      behavior: ['dashboard','admin','comprehensive','administration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/comprehensive-admin-dashboard.tsx',
    importPath: './admin/comprehensive-admin-dashboard'
},

  // CORNER BUTTONS
  {
    id: 'corner-buttons',
    name: 'CornerButtons',
    category: 'system',
    description: 'Corner buttons for quick access actions',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onButtonClick','buttonType','cornerPosition']
  },
    customization: {
      styles: ['layout','buttons','colors','corner'],
      layout: ['buttons','corner','actions'],
      behavior: ['buttons','corner','actions','quick-access']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/misc/corner-buttons.tsx',
    importPath: './misc/corner-buttons'
},

  // GOOGLE WALLET MEMBERSHIP MANAGER
  {
    id: 'google-wallet-membership-manager',
    name: 'GoogleWalletMembershipManager',
    category: 'integration',
    description: 'Google Wallet membership manager for membership management',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMembershipUpdate','managementMode','walletScope']
  },
    customization: {
      styles: ['layout','manager','colors','membership'],
      layout: ['manager','membership','wallet'],
      behavior: ['manager','membership','wallet','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GoogleWalletMembershipManager.tsx',
    importPath: '../admin/GoogleWalletMembershipManager'
},

  // LSD MONITORING PANEL
  {
    id: 'lsd-monitoring-panel',
    name: 'LSDMonitoringPanel',
    category: 'admin',
    description: 'LSD monitoring panel for system monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMonitoringUpdate','monitoringMode','lsdScope']
  },
    customization: {
      styles: ['layout','panel','colors','monitoring'],
      layout: ['panel','monitoring','lsd'],
      behavior: ['panel','monitoring','lsd','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/LSDMonitoringPanel.tsx',
    importPath: '../admin/LSDMonitoringPanel'
},

  // API ENDPOINT MONITOR
  {
    id: 'api-endpoint-monitor',
    name: 'APIEndpointMonitor',
    category: 'admin',
    description: 'API endpoint monitor for API monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEndpointUpdate','monitoringMode','apiScope']
  },
    customization: {
      styles: ['layout','monitor','colors','api'],
      layout: ['monitor','api','endpoints'],
      behavior: ['monitor','api','endpoints','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/APIEndpointMonitor.tsx',
    importPath: '../admin/APIEndpointMonitor'
},

  // DEPENDENCIES MANAGER
  {
    id: 'dependencies-manager',
    name: 'DependenciesManager',
    category: 'admin',
    description: 'Dependencies manager for dependency management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDependencyUpdate','managementMode','dependencyScope']
  },
    customization: {
      styles: ['layout','manager','colors','dependencies'],
      layout: ['manager','dependencies','management'],
      behavior: ['manager','dependencies','management','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/DependenciesManager.tsx',
    importPath: '../admin/DependenciesManager'
},

  // API INTEGRATION PROCESS MONITOR
  {
    id: 'api-integration-process-monitor',
    name: 'ApiIntegrationProcessMonitor',
    category: 'integration',
    description: 'API integration process monitor for integration monitoring',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProcessUpdate','monitoringMode','integrationScope']
  },
    customization: {
      styles: ['layout','monitor','colors','integration'],
      layout: ['monitor','integration','process'],
      behavior: ['monitor','integration','process','api']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/ApiIntegrationProcessMonitor.tsx',
    importPath: '../admin/ApiIntegrationProcessMonitor'
},

  // DATABASE INTEGRITY CHECKER
  {
    id: 'database-integrity-checker',
    name: 'DatabaseIntegrityChecker',
    category: 'admin',
    description: 'Database integrity checker for database validation',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrityCheck','checkMode','databaseScope']
  },
    customization: {
      styles: ['layout','checker','colors','database'],
      layout: ['checker','database','integrity'],
      behavior: ['checker','database','integrity','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/DatabaseIntegrityChecker.tsx',
    importPath: '../admin/DatabaseIntegrityChecker'
},

  // INTEGRATIONS MANAGEMENT PANEL
  {
    id: 'integrations-management-panel',
    name: 'IntegrationsManagementPanel',
    category: 'integration',
    description: 'Integrations management panel for integration management',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onIntegrationUpdate','managementMode','integrationScope']
  },
    customization: {
      styles: ['layout','panel','colors','integrations'],
      layout: ['panel','integrations','management'],
      behavior: ['panel','integrations','management','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/IntegrationsManagementPanel.tsx',
    importPath: '../admin/IntegrationsManagementPanel'
},

  // FEATURE MANAGEMENT WITH PUBLISH
  {
    id: 'feature-management-with-publish',
    name: 'FeatureManagementWithPublish',
    category: 'admin',
    description: 'Feature management with publish for feature control',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFeatureUpdate','managementMode','publishScope']
  },
    customization: {
      styles: ['layout','management','colors','features'],
      layout: ['management','features','publish'],
      behavior: ['management','features','publish','control']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/FeatureManagementWithPublish.tsx',
    importPath: '../admin/FeatureManagementWithPublish'
},

  // CENTRALIZED MONITORING CONSOLE
  {
    id: 'centralized-monitoring-console',
    name: 'CentralizedMonitoringConsole',
    category: 'admin',
    description: 'Centralized monitoring console for system monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMonitoringUpdate','consoleMode','monitoringScope']
  },
    customization: {
      styles: ['layout','console','colors','monitoring'],
      layout: ['console','monitoring','centralized'],
      behavior: ['console','monitoring','centralized','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/CentralizedMonitoringConsole.tsx',
    importPath: '../admin/CentralizedMonitoringConsole'
},

  // COMPREHENSIVE PROTOCOL MANAGER
  {
    id: 'comprehensive-protocol-manager',
    name: 'ComprehensiveProtocolManager',
    category: 'admin',
    description: 'Comprehensive protocol manager for protocol management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProtocolUpdate','managementMode','protocolScope']
  },
    customization: {
      styles: ['layout','manager','colors','protocols'],
      layout: ['manager','protocols','comprehensive'],
      behavior: ['manager','protocols','comprehensive','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/ComprehensiveProtocolManager.tsx',
    importPath: '../admin/ComprehensiveProtocolManager'
},

  // ADMIN FLOATING ACTION BUTTONS
  {
    id: 'admin-floating-action-buttons',
    name: 'AdminFloatingActionButtons',
    category: 'admin',
    description: 'Admin floating action buttons for quick admin actions',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onActionClick','buttonType','floatingPosition']
  },
    customization: {
      styles: ['layout','buttons','colors','floating'],
      layout: ['buttons','floating','actions'],
      behavior: ['buttons','floating','actions','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AdminFloatingActionButtons.tsx',
    importPath: '../admin/AdminFloatingActionButtons'
},

  // SYSTEM BACKUP DASHBOARD
  {
    id: 'system-backup-dashboard',
    name: 'SystemBackupDashboard',
    category: 'admin',
    description: 'System backup dashboard for backup management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onBackupUpdate','dashboardMode','backupScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','backup'],
      layout: ['dashboard','backup','system'],
      behavior: ['dashboard','backup','system','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/SystemBackupDashboard.tsx',
    importPath: '../admin/SystemBackupDashboard'
},

  // AUTOMATIONS PANEL
  {
    id: 'automations-panel',
    name: 'AutomationsPanel',
    category: 'admin',
    description: 'Automations panel for automation management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAutomationUpdate','panelMode','automationScope']
  },
    customization: {
      styles: ['layout','panel','colors','automations'],
      layout: ['panel','automations','management'],
      behavior: ['panel','automations','management','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AutomationsPanel.tsx',
    importPath: '../admin/AutomationsPanel'
},

  // GDPR COMPLIANCE PANEL
  {
    id: 'gdpr-compliance-panel',
    name: 'GDPRCompliancePanel',
    category: 'security',
    description: 'GDPR compliance panel for compliance management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onComplianceUpdate','panelMode','gdprScope']
  },
    customization: {
      styles: ['layout','panel','colors','compliance'],
      layout: ['panel','compliance','gdpr'],
      behavior: ['panel','compliance','gdpr','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/GDPRCompliancePanel.tsx',
    importPath: '../admin/GDPRCompliancePanel'
},

  // FEATURE MANAGEMENT
  {
    id: 'feature-management',
    name: 'FeatureManagement',
    category: 'admin',
    description: 'Feature management for feature control',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFeatureUpdate','managementMode','featureScope']
  },
    customization: {
      styles: ['layout','management','colors','features'],
      layout: ['management','features','control'],
      behavior: ['management','features','control','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/feature-management.tsx',
    importPath: '../admin/feature-management'
},

  // PRICE MANAGEMENT DASHBOARD
  {
    id: 'price-management-dashboard',
    name: 'PriceManagementDashboard',
    category: 'business',
    description: 'Price management dashboard for pricing management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPriceUpdate','dashboardMode','pricingScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','pricing'],
      layout: ['dashboard','pricing','management'],
      behavior: ['dashboard','pricing','management','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/PriceManagementDashboard.tsx',
    importPath: '../admin/PriceManagementDashboard'
},

  // ADMIN STATS
  {
    id: 'admin-stats',
    name: 'AdminStats',
    category: 'admin',
    description: 'Admin stats for administrative statistics',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onStatsUpdate','statsMode','adminScope']
  },
    customization: {
      styles: ['layout','stats','colors','admin'],
      layout: ['stats','admin','statistics'],
      behavior: ['stats','admin','statistics','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AdminStats.tsx',
    importPath: '../admin/AdminStats'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 3
  {
    id: 'camera-detector',
    name: 'CameraDetector',
    category: 'equipment',
    description: 'Camera detector for camera detection and identification',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCameraDetect','detectionMode','cameraTypes']
  },
    customization: {
      styles: ['layout','detector','colors','camera'],
      layout: ['detector','camera','identification'],
      behavior: ['detector','camera','identification','equipment']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photography-tips/CameraDetector.tsx',
    importPath: '../photography-tips/CameraDetector'
},
  {
    id: 'resolve-project-creator',
    name: 'ResolveProjectCreator',
    category: 'ai',
    description: 'DaVinci Resolve project creator for video project generation',
    profession: ['videographer','admin'],
    tabIndex:  6,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onProjectCreate','resolveMode','projectType']
  },
    customization: {
      styles: ['layout','creator','colors','resolve'],
      layout: ['creator','resolve','project'],
      behavior: ['creator','resolve','project','davinci']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/videographer/ResolveProjectCreator.tsx',
    importPath: '../videographer/ResolveProjectCreator'
},
  {
    id: 'create-category-modal',
    name: 'CreateCategoryModal',
    category: 'modal',
    description: 'Create category modal for category creation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onCategoryCreate','categoryType','parentCategory','validation']
  },
    customization: {
      styles: ['layout','modal','colors','category'],
      layout: ['modal','category','creation'],
      behavior: ['modal','category','creation','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/CreateCategoryModal.tsx',
    importPath: '../modals/CreateCategoryModal'
},
  {
    id: 'quote-generator-modal',
    name: 'QuoteGeneratorModal',
    category: 'modal',
    description: 'Quote generator modal for quote generation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onQuoteGenerate','quoteType','clientData','serviceType']
  },
    customization: {
      styles: ['layout','modal','colors','quote'],
      layout: ['modal','quote','generator'],
      behavior: ['modal','quote','generator','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/QuoteGeneratorModal.tsx',
    importPath: '../modals/QuoteGeneratorModal'
},
  {
    id: 'toll-calculation-modal',
    name: 'TollCalculationModal',
    category: 'modal',
    description: 'Toll calculation modal for toll cost calculation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  7,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onTollCalculate','route','vehicleType','calculationMode']
  },
    customization: {
      styles: ['layout','modal','colors','toll'],
      layout: ['modal','toll','calculation'],
      behavior: ['modal','toll','calculation','transportation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/TollCalculationModal.tsx',
    importPath: '../modals/TollCalculationModal'
},
  {
    id: 'client-auth-dialog',
    name: 'ClientAuthDialog',
    category: 'security',
    description: 'Client authentication dialog for client login',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onAuthSuccess','authMode','clientType','securityLevel']
  },
    customization: {
      styles: ['layout','dialog','colors','auth'],
      layout: ['dialog','auth','client'],
      behavior: ['dialog','auth','client','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/ClientAuthDialog.tsx',
    importPath: '../modals/ClientAuthDialog'
},
  {
    id: 'extra-image-pricing-dialog',
    name: 'ExtraImagePricingDialog',
    category: 'business',
    description: 'Extra image pricing dialog for additional image pricing',
    profession: ['photographer','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['onPricingUpdate','imageCount','basePrice','pricingTier']
  },
    customization: {
      styles: ['layout','dialog','colors','pricing'],
      layout: ['dialog','pricing','images'],
      behavior: ['dialog','pricing','images','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/modals/ExtraImagePricingDialog.tsx',
    importPath: '../modals/ExtraImagePricingDialog'
},
  {
    id: 'postal-code-validator',
    name: 'PostalCodeValidator',
    category: 'integration',
    description: 'Postal code validator for address validation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['country','onValidation','validationMode','addressData']
  },
    customization: {
      styles: ['layout','validator','colors','postal'],
      layout: ['validator','postal','address'],
      behavior: ['validator','postal','address','integration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/integration/PostalCodeValidator.tsx',
    importPath: '../integration/PostalCodeValidator'
},
  {
    id: 'package-tracker',
    name: 'PackageTracker',
    category: 'integration',
    description: 'Package tracker for shipment tracking',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['carrier','onTrackingUpdate','trackingMode','shipmentData']
  },
    customization: {
      styles: ['layout','tracker','colors','package'],
      layout: ['tracker','package','shipment'],
      behavior: ['tracker','package','shipment','logistics']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/integration/PackageTracker.tsx',
    importPath: '../integration/PackageTracker'
},
  {
    id: 'shipping-calculator',
    name: 'ShippingCalculator',
    category: 'business',
    description: 'Shipping calculator for shipping cost calculation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['origin','destination'],
      optional: ['weight','dimensions','onCalculate','shippingMethod']
  },
    customization: {
      styles: ['layout','calculator','colors','shipping'],
      layout: ['calculator','shipping','cost'],
      behavior: ['calculator','shipping','cost','logistics']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/business/ShippingCalculator.tsx',
    importPath: '../business/ShippingCalculator'
},
  {
    id: 'photographer-photo-suite',
    name: 'PhotographerPhotoSuite',
    category: 'ai',
    description: 'Photographer photo suite for professional photo editing',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPhotoProcess','photoMode','editingTools']
  },
    customization: {
      styles: ['layout','suite','colors','photo'],
      layout: ['suite','photo','editing'],
      behavior: ['suite','photo','editing','professional']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photographer/PhotographerPhotoSuite.tsx',
    importPath: '../photographer/PhotographerPhotoSuite'
},
  {
    id: 'creator-hub-photo-enhancer',
    name: 'CreatorHubPhotoEnhancer',
    category: 'ai',
    description: 'Creator Hub photo enhancer for photo enhancement',
    profession: ['photographer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPhotoEnhance','enhancementMode','aiTools']
  },
    customization: {
      styles: ['layout','enhancer','colors','photo'],
      layout: ['enhancer','photo','ai'],
      behavior: ['enhancer','photo','ai','creator-hub']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/photographer/CreatorHubPhotoEnhancer.tsx',
    importPath: '../photographer/CreatorHubPhotoEnhancer'
},
  {
    id: 'algorithm-optimizer',
    name: 'AlgorithmOptimizer',
    category: 'ai',
    description: 'Algorithm optimizer for performance optimization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onOptimize','optimizationMode','algorithmType']
  },
    customization: {
      styles: ['layout','optimizer','colors','algorithm'],
      layout: ['optimizer','algorithm','performance'],
      behavior: ['optimizer','algorithm','performance','ai']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/AlgorithmOptimizer.tsx',
    importPath: '../social-media/AlgorithmOptimizer'
},
  {
    id: 'social-media-formats',
    name: 'SocialMediaFormats',
    category: 'format',
    description: 'Social media formats for content formatting',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  9,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormatSelect','formatType','platformTarget']
  },
    customization: {
      styles: ['layout','formats','colors','social'],
      layout: ['formats','social','platforms'],
      behavior: ['formats','social','platforms','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/SocialMediaFormats.tsx',
    importPath: '../social-media/SocialMediaFormats'
},
  {
    id: 'universal-calendar-widget',
    name: 'UniversalCalendarWidget',
    category: 'calendar',
    description: 'Universal calendar widget for scheduling and events',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEventSelect','calendarMode','eventTypes']
  },
    customization: {
      styles: ['layout','widget','colors','calendar'],
      layout: ['widget','calendar','events'],
      behavior: ['widget','calendar','events','scheduling']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/calendar/UniversalCalendarWidget.tsx',
    importPath: '../calendar/UniversalCalendarWidget'
},
  {
    id: 'google-integration-test-dashboard',
    name: 'GoogleIntegrationTestDashboard',
    category: 'integration',
    description: 'Google integration test dashboard for integration testing',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestUpdate','testMode','integrationScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','test'],
      layout: ['dashboard','test','integration'],
      behavior: ['dashboard','test','integration','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/GoogleIntegrationTestDashboard.tsx',
    importPath: '../testing/GoogleIntegrationTestDashboard'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 4
  {
    id: 'memory-card-backup-manager-alt',
    name: 'MemoryCardBackupManager',
    category: 'file',
    description: 'Memory card backup manager for backup management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onBackupUpdate','backupMode','cardType']
  },
    customization: {
      styles: ['layout','manager','colors','backup'],
      layout: ['manager','backup','cards'],
      behavior: ['manager','backup','cards','memory']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupManager.tsx',
    importPath: '../memory-card/MemoryCardBackupManager'
},
  {
    id: 'memory-card-backup-panel-alt',
    name: 'MemoryCardBackupPanel',
    category: 'file',
    description: 'Memory card backup panel for backup interface',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPanelUpdate','panelMode','backupScope']
  },
    customization: {
      styles: ['layout','panel','colors','backup'],
      layout: ['panel','backup','interface'],
      behavior: ['panel','backup','interface','cards']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupPanel.tsx',
    importPath: '../memory-card/MemoryCardBackupPanel'
},
  {
    id: 'showcase-pricing-integration-alt',
    name: 'ShowcasePricingIntegration',
    category: 'showcase',
    description: 'Showcase pricing integration for portfolio monetization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingMode','monetizationLevel']
  },
    customization: {
      styles: ['layout','integration','colors','pricing'],
      layout: ['integration','pricing','showcase'],
      behavior: ['integration','pricing','showcase','monetization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcasePricingIntegration.tsx',
    importPath: '../showcase/ShowcasePricingIntegration'
},
  {
    id: 'viral-content-creator-admin',
    name: 'ViralContentCreator',
    category: 'ai',
    description: 'Viral content creator for trending content generation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentCreate','viralMode','trendingAnalysis']
  },
    customization: {
      styles: ['layout','creator','colors','viral'],
      layout: ['creator','viral','content'],
      behavior: ['viral','creator','content','trending']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/social-media/ViralContentCreator.tsx',
    importPath: '../social-media/ViralContentCreator'
},
  {
    id: 'super-smart-writing-interface-alt',
    name: 'SuperSmartWritingInterface',
    category: 'ai',
    description: 'Super smart writing interface for content creation',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onContentWrite','writingMode','aiAssistance']
  },
    customization: {
      styles: ['layout','interface','colors','writing'],
      layout: ['interface','writing','smart'],
      behavior: ['writing','interface','smart','ai']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/writing/SuperSmartWritingInterface.tsx',
    importPath: '../writing/SuperSmartWritingInterface'
},
  {
    id: 'equipment-management-alt',
    name: 'EquipmentManagement',
    category: 'equipment',
    description: 'Equipment management for equipment organization',
    profession: ['photographer','videographer','admin'],
    tabIndex:  11,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEquipmentUpdate','equipmentType','managementMode']
  },
    customization: {
      styles: ['layout','management','colors','equipment'],
      layout: ['management','equipment','organization'],
      behavior: ['management','equipment','organization','tools']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/equipment/EquipmentManagement.tsx',
    importPath: '../equipment/EquipmentManagement'
},
  {
    id: 'universal-communication-alt',
    name: 'UniversalCommunication',
    category: 'communication',
    description: 'Universal communication for cross-platform messaging',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onMessageSend','communicationMode','platformScope']
  },
    customization: {
      styles: ['layout','communication','colors','universal'],
      layout: ['communication','universal','messaging'],
      behavior: ['communication','universal','messaging','cross-platform']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/communication/UniversalCommunication.tsx',
    importPath: '../communication/UniversalCommunication'
},
  {
    id: 'google-analytics-dashboard',
    name: 'GoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Google Analytics dashboard for analytics tracking',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/integration/GoogleAnalyticsDashboard.tsx',
    importPath: '../integration/GoogleAnalyticsDashboard'
},
  {
    id: 'royalties-management-dashboard-alt',
    name: 'RoyaltiesManagementDashboard',
    category: 'business',
    description: 'Royalties management dashboard for royalty tracking',
    profession: ['music_producer','admin'],
    tabIndex:  16,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onRoyaltiesUpdate','dashboardMode','royaltyScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','royalties'],
      layout: ['dashboard','royalties','management'],
      behavior: ['dashboard','royalties','management','music']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/business/RoyaltiesManagementDashboard.tsx',
    importPath: '../business/RoyaltiesManagementDashboard'
},
  {
    id: 'design-system-dashboard',
    name: 'DesignSystemDashboard',
    category: 'admin',
    description: 'Design system dashboard for design system management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDesignSystemUpdate','dashboardMode','designScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','design'],
      layout: ['dashboard','design','system'],
      behavior: ['dashboard','design','system','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/DesignSystemDashboard.tsx',
    importPath: '../admin/DesignSystemDashboard'
},
  {
    id: 'analytics-dashboard',
    name: 'AnalyticsDashboard',
    category: 'admin',
    description: 'Analytics dashboard for platform analytics',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','platform'],
      behavior: ['dashboard','analytics','platform','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/AnalyticsDashboard.tsx',
    importPath: '../admin/AnalyticsDashboard'
},
  {
    id: 'team-collaboration-dashboard',
    name: 'TeamCollaborationDashboard',
    category: 'communication',
    description: 'Team collaboration dashboard for team management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onCollaborationUpdate','dashboardMode','teamScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','collaboration'],
      layout: ['dashboard','collaboration','team'],
      behavior: ['dashboard','collaboration','team','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/communication/TeamCollaborationDashboard.tsx',
    importPath: '../communication/TeamCollaborationDashboard'
},
  {
    id: 'template-preset-dashboard',
    name: 'TemplatePresetDashboard',
    category: 'admin',
    description: 'Template preset dashboard for template management',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTemplateUpdate','dashboardMode','templateScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','templates'],
      layout: ['dashboard','templates','presets'],
      behavior: ['dashboard','templates','presets','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/TemplatePresetDashboard.tsx',
    importPath: '../admin/TemplatePresetDashboard'
},
  {
    id: 'system-management-dashboard',
    name: 'SystemManagementDashboard',
    category: 'admin',
    description: 'System management dashboard for system administration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSystemUpdate','dashboardMode','systemScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','system'],
      layout: ['dashboard','system','management'],
      behavior: ['dashboard','system','management','administration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/SystemManagementDashboard.tsx',
    importPath: '../admin/SystemManagementDashboard'
},
  {
    id: 'monitoring-dashboard',
    name: 'MonitoringDashboard',
    category: 'admin',
    description: 'Monitoring dashboard for system monitoring',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMonitoringUpdate','dashboardMode','monitoringScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','monitoring'],
      layout: ['dashboard','monitoring','system'],
      behavior: ['dashboard','monitoring','system','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/MonitoringDashboard.tsx',
    importPath: '../admin/MonitoringDashboard'
},
  {
    id: 'visual-editor-properties',
    name: 'VisualEditorProperties',
    category: 'admin',
    description: 'Visual editor properties for editor configuration',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPropertiesUpdate','propertiesMode','editorScope']
  },
    customization: {
      styles: ['layout','properties','colors','editor'],
      layout: ['properties','editor','visual'],
      behavior: ['properties','editor','visual','configuration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/VisualEditorProperties.tsx',
    importPath: '../admin/VisualEditorProperties'
},
  {
    id: 'universal-dashboard-notification-integration',
    name: 'UniversalDashboardNotificationIntegration',
    category: 'system',
    description: 'Universal dashboard notification integration for notifications',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onNotificationUpdate','integrationMode','notificationScope']
  },
    customization: {
      styles: ['layout','integration','colors','notifications'],
      layout: ['integration','notifications','universal'],
      behavior: ['integration','notifications','universal','dashboard']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDashboardNotificationIntegration.tsx',
    importPath: './UniversalDashboardNotificationIntegration'
},
  {
    id: 'backup-management-interface',
    name: 'BackupManagementInterface',
    category: 'admin',
    description: 'Backup management interface for backup operations',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onBackupUpdate','interfaceMode','backupScope']
  },
    customization: {
      styles: ['layout','interface','colors','backup'],
      layout: ['interface','backup','management'],
      behavior: ['interface','backup','management','operations']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/BackupManagementInterface.tsx',
    importPath: '../admin/BackupManagementInterface'
},
  {
    id: 'google-wallet-integration-test',
    name: 'GoogleWalletIntegrationTest',
    category: 'integration',
    description: 'Google Wallet integration test for wallet testing',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestUpdate','testMode','walletScope']
  },
    customization: {
      styles: ['layout','test','colors','wallet'],
      layout: ['test','wallet','integration'],
      behavior: ['test','wallet','integration','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/GoogleWalletIntegrationTest.tsx',
    importPath: '../testing/GoogleWalletIntegrationTest'
},
  {
    id: 'payment-systems-integration-test',
    name: 'PaymentSystemsIntegrationTest',
    category: 'integration',
    description: 'Payment systems integration test for payment testing',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestUpdate','testMode','paymentScope']
  },
    customization: {
      styles: ['layout','test','colors','payment'],
      layout: ['test','payment','systems'],
      behavior: ['test','payment','systems','integration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/PaymentSystemsIntegrationTest.tsx',
    importPath: '../testing/PaymentSystemsIntegrationTest'
},
  {
    id: 'admin-dashboard-integration-test',
    name: 'AdminDashboardIntegrationTest',
    category: 'integration',
    description: 'Admin dashboard integration test for dashboard testing',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestUpdate','testMode','dashboardScope']
  },
    customization: {
      styles: ['layout','test','colors','dashboard'],
      layout: ['test','dashboard','admin'],
      behavior: ['test','dashboard','admin','integration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/AdminDashboardIntegrationTest.tsx',
    importPath: '../testing/AdminDashboardIntegrationTest'
},
  {
    id: 'story-arc-auto-monitor',
    name: 'StoryArcAutoMonitor',
    category: 'ai',
    description: 'Story arc auto monitor for story monitoring',
    profession: ['photographer','videographer','music_producer','admin'],
    tabIndex:  5,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onStoryMonitor','monitorMode','storyScope']
  },
    customization: {
      styles: ['layout','monitor','colors','story'],
      layout: ['monitor','story','arc'],
      behavior: ['monitor','story','arc','auto']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ai/StoryArcAutoMonitor.tsx',
    importPath: '../ai/StoryArcAutoMonitor'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 5
  {
    id: 'songflow-platform-alt',
    name: 'SongflowPlatform',
    category: 'form',
    description: 'Songflow platform form for music production workflow',
    profession: ['music_producer','admin'],
    tabIndex:  17,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFormSubmit','formType','workflowMode']
  },
    customization: {
      styles: ['layout','form','colors','songflow'],
      layout: ['form','songflow','platform'],
      behavior: ['form','songflow','platform','music']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/forms/SongflowPlatform.tsx',
    importPath: '../forms/SongflowPlatform'
},
  {
    id: 'component-orchestrator-alt',
    name: 'ComponentOrchestrator',
    category: 'orchestrator',
    description: 'Component orchestrator for component coordination',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  1,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['userI','onComponentUpdate','orchestrationMode']
  },
    customization: {
      styles: ['layout','orchestrator','colors','coordination'],
      layout: ['grid','components','tabs'],
      behavior: ['orchestration','coordination','management','components']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/ComponentOrchestrator.tsx',
    importPath: './ComponentOrchestrator'
},
  {
    id: 'advanced-chat-protocols',
    name: 'AdvancedChatProtocols',
    category: 'communication',
    description: 'Advanced chat protocols for enhanced communication',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  3,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onProtocolUpdate','protocolMode','chatScope']
  },
    customization: {
      styles: ['layout','protocols','colors','chat'],
      layout: ['protocols','chat','advanced'],
      behavior: ['protocols','chat','advanced','communication']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/communication/AdvancedChatProtocols.tsx',
    importPath: '../communication/AdvancedChatProtocols'
},
  {
    id: 'admin-prototype-testing-dashboard',
    name: 'AdminPrototypeTestingDashboard',
    category: 'testing',
    description: 'Admin prototype testing dashboard for prototype testing',
    profession: [''],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestingUpdate','dashboardMode','testingScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','testing'],
      layout: ['dashboard','testing','prototype'],
      behavior: ['dashboard','testing','prototype','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/AdminPrototypeTestingDashboard.tsx',
    importPath: '../testing/AdminPrototypeTestingDashboard'
},
  {
    id: 'showcase-manager-photographer',
    name: 'ShowcaseManager',
    category: 'showcase',
    description: 'Showcase manager for photographer portfolio management',
    profession: ['photographer','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShowcaseUpdate','showcaseType','portfolioMode']
  },
    customization: {
      styles: ['layout','manager','colors','showcase'],
      layout: ['manager','showcase','portfolio'],
      behavior: ['manager','showcase','portfolio','photographer']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseManager.tsx',
    importPath: '../showcase/ShowcaseManager'
},
  {
    id: 'universal-calendar-widget-alt',
    name: 'UniversalCalendarWidget',
    category: 'calendar',
    description: 'Universal calendar widget for scheduling and events',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  10,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onEventSelect','calendarMode','eventTypes']
  },
    customization: {
      styles: ['layout','widget','colors','calendar'],
      layout: ['widget','calendar','events'],
      behavior: ['widget','calendar','events','scheduling']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/calendar/UniversalCalendarWidget.tsx',
    importPath: '../calendar/UniversalCalendarWidget'
},
  {
    id: 'google-integration-test-dashboard-alt',
    name: 'GoogleIntegrationTestDashboard',
    category: 'integration',
    description: 'Google integration test dashboard for integration testing',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTestUpdate','testMode','integrationScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','test'],
      layout: ['dashboard','test','integration'],
      behavior: ['dashboard','test','integration','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/GoogleIntegrationTestDashboard.tsx',
    importPath: '../testing/GoogleIntegrationTestDashboard'
},
  {
    id: 'memory-card-backup-manager-alt',
    name: 'MemoryCardBackupManager',
    category: 'file',
    description: 'Memory card backup manager for backup management',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onBackupUpdate','backupMode','cardType']
  },
    customization: {
      styles: ['layout','manager','colors','backup'],
      layout: ['manager','backup','cards'],
      behavior: ['manager','backup','cards','memory']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupManager.tsx',
    importPath: '../memory-card/MemoryCardBackupManager'
},
  {
    id: 'memory-card-backup-panel-alt',
    name: 'MemoryCardBackupPanel',
    category: 'file',
    description: 'Memory card backup panel for backup interface',
    profession: ['photographer','videographer','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPanelUpdate','panelMode','backupScope']
  },
    customization: {
      styles: ['layout','panel','colors','backup'],
      layout: ['panel','backup','interface'],
      behavior: ['panel','backup','interface','cards']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/memory-card/MemoryCardBackupPanel.tsx',
    importPath: '../memory-card/MemoryCardBackupPanel'
},
  {
    id: 'showcase-pricing-integration-alt',
    name: 'ShowcasePricingIntegration',
    category: 'showcase',
    description: 'Showcase pricing integration for portfolio monetization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onPricingUpdate','pricingMode','monetizationLevel']
  },
    customization: {
      styles: ['layout','integration','colors','pricing'],
      layout: ['integration','pricing','showcase'],
      behavior: ['integration','pricing','showcase','monetization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcasePricingIntegration.tsx',
    importPath: '../showcase/ShowcasePricingIntegration'
},
  {
    id: 'color-picker',
    name: 'ColorPicker',
    category: 'system',
    description: 'Color picker for color selection and customization',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['defaultColor','colorFormat','palette','customColors']
  },
    customization: {
      styles: ['layout','picker','colors','customization'],
      layout: ['picker','color','selection'],
      behavior: ['picker','color','selection','customization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/system/ColorPicker.tsx',
    importPath: '../system/ColorPicker'
},
  {
    id: 'visual-editor-with-page-selection',
    name: 'VisualEditorWithPageSelection',
    category: 'admin',
    description: 'Visual editor with page selection for multi-page editing',
    profession: [''],
    tabIndex:  0,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPageSelect','editorMode','pageScope']
  },
    customization: {
      styles: ['layout','editor','colors','pages'],
      layout: ['editor','pages','selection'],
      behavior: ['editor','pages','selection','multi-page']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/admin/VisualEditorWithPageSelection.tsx',
    importPath: '../admin/VisualEditorWithPageSelection'
},
  {
    id: 'visual-cms-admin-dashboard',
    name: 'VisualCMSAdminDashboard',
    category: 'cms',
    description: 'Visual CMS admin dashboard for CMS administration',
    profession: [''],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCMSUpdate','dashboardMode','cmsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','cms'],
      layout: ['dashboard','cms','admin'],
      behavior: ['dashboard','cms','admin','visual']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/cms/VisualCMSAdminDashboard.tsx',
    importPath: '../cms/VisualCMSAdminDashboard'
},
  {
    id: 'profession-cms-manager',
    name: 'ProfessionCMSManager',
    category: 'cms',
    description: 'Profession CMS manager for profession-specific content management',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  4,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['userI','profession'],
      optional: ['onCMSUpdate','managementMode','professionScope']
  },
    customization: {
      styles: ['layout','manager','colors','cms'],
      layout: ['manager','cms','profession'],
      behavior: ['manager','cms','profession','specific']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/cms/ProfessionCMSManager.tsx',
    importPath: '../cms/ProfessionCMSManager'
},
  {
    id: 'wedding-timeline',
    name: 'WeddingTimeline',
    category: 'management',
    description: 'Wedding timeline for wedding event planning',
    profession: ['photographer','admin'],
    tabIndex:  2,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTimelineUpdate','timelineMode','eventScope']
  },
    customization: {
      styles: ['layout','timeline','colors','wedding'],
      layout: ['timeline','wedding','events'],
      behavior: ['timeline','wedding','events','planning']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding/WeddingTimeline.tsx',
    importPath: '../wedding/WeddingTimeline'
},
  {
    id: 'video-showcase-connector',
    name: 'VideoShowcaseConnector',
    category: 'showcase',
    description: 'Video showcase connector for video portfolio integration',
    profession: ['videographer','admin'],
    tabIndex:  15,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShowcaseUpdate','connectorMode','videoScope']
  },
    customization: {
      styles: ['layout','connector','colors','video'],
      layout: ['connector','video','showcase'],
      behavior: ['connector','video','showcase','integration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/videographer/VideoShowcaseConnector.tsx',
    importPath: '../videographer/VideoShowcaseConnector'
},
  {
    id: 'keyboard-shortcuts-interface-alt',
    name: 'KeyboardShortcutsInterface',
    category: 'accessibility',
    description: 'Keyboard shortcuts interface for accessibility',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  13,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onShortcutUpdate','shortcutMode','accessibilityLevel']
  },
    customization: {
      styles: ['layout','interface','colors','shortcuts'],
      layout: ['interface','shortcuts','keyboard'],
      behavior: ['shortcuts','interface','keyboard','accessibility']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/accessibility/KeyboardShortcutsInterface.tsx',
    importPath: '../accessibility/KeyboardShortcutsInterface'
},
  {
    id: 'prototype-feedback-tool-alt',
    name: 'PrototypeFeedbackTool',
    category: 'testing',
    description: 'Prototype feedback tool for testing and feedback collection',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    tabIndex:  14,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onFeedbackSubmit','feedbackType','testingMode']
  },
    customization: {
      styles: ['layout','tool','colors','feedback'],
      layout: ['tool','feedback','prototype'],
      behavior: ['feedback','tool','prototype','testing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/testing/PrototypeFeedbackTool.tsx',
    importPath: '../testing/PrototypeFeedbackTool'
},
  {
    id: 'universal-admin-google-analytics-alt',
    name: 'UniversalAdminGoogleAnalytics',
    category: 'integration',
    description: 'Universal admin Google Analytics for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','analyticsMode','adminScope']
  },
    customization: {
      styles: ['layout','analytics','colors','admin'],
      layout: ['analytics','admin','universal'],
      behavior: ['analytics','admin','universal','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalytics.tsx',
    importPath: './admin/UniversalAdminGoogleAnalytics'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 6
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt1',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 7
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt2',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt3',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 8
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt4',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt5',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt6',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 9
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt7',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt8',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},

  // ADDITIONAL COMPONENT CATEGORIES - BATCH 10
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt9',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt10',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  {
    id: 'universal-admin-google-analytics-dashboard-alt11',
    name: 'UniversalAdminGoogleAnalyticsDashboard',
    category: 'integration',
    description: 'Universal admin Google Analytics dashboard for analytics integration',
    profession: [''],
    tabIndex:  8,
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyticsUpdate','dashboardMode','analyticsScope']
  },
    customization: {
      styles: ['layout','dashboard','colors','analytics'],
      layout: ['dashboard','analytics','google'],
      behavior: ['dashboard','analytics','google','admin']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/UniversalAdminGoogleAnalyticsDashboard.tsx',
    importPath: './admin/UniversalAdminGoogleAnalyticsDashboard'
},
  // ROOT-LEVEL ADMIN COMPONENTS - BATCH 1
  {
    id: 'verification-system-dashboard',
    name: 'VerificationSystemDashboard',
    category: 'admin',
    description: 'Dashboard for managing verification systems and processes',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','verificationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['sorting','filtering','pagination']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './VerificationSystemDashboard.tsx',
    importPath: './VerificationSystemDashboard'
},
  {
    id: 'gdpr-compliance-panel',
    name: 'GDPRCompliancePanel',
    category: 'admin',
    description: 'GDPR compliance management and monitoring panel',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','complianceData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['validation','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './GDPRCompliancePanel.tsx',
    importPath: './GDPRCompliancePanel'
},
  {
    id: 'integration-analytics-dashboard',
    name: 'IntegrationAnalyticsDashboard',
    category: 'admin',
    description: 'Analytics dashboard for system integrations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','analyticsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','charts','tables'],
      behavior: ['sorting','filtering','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './IntegrationAnalyticsDashboard.tsx',
    importPath: './IntegrationAnalyticsDashboard'
},
  {
    id: 'visual-cms-dashboard',
    name: 'VisualCMSDashboard',
    category: 'cms',
    description: 'Visual content management system dashboard',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','contentData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['editing','preview','publishing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './VisualCMSDashboard.tsx',
    importPath: './VisualCMSDashboard'
},
  {
    id: 'profession-trends-integration',
    name: 'ProfessionTrendsIntegration',
    category: 'admin',
    description: 'Integration for tracking profession-specific trends',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','trendsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','charts','cards'],
      behavior: ['tracking','analysis','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ProfessionTrendsIntegration.tsx',
    importPath: './ProfessionTrendsIntegration'
},
  {
    id: 'admin-notification-manager',
    name: 'AdminNotificationManager',
    category: 'admin',
    description: 'Admin notification management system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','notificationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','lists'],
      behavior: ['sending','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminNotificationManager.tsx',
    importPath: './AdminNotificationManager'
},
  {
    id: 'testing-dashboard',
    name: 'TestingDashboard',
    category: 'testing',
    description: 'Dashboard for managing testing processes and results',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','testData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['running','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './TestingDashboard.tsx',
    importPath: './TestingDashboard'
},
  {
    id: 'automations-panel',
    name: 'AutomationsPanel',
    category: 'admin',
    description: 'Panel for managing automated processes and workflows',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','automationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['creation','scheduling','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AutomationsPanel.tsx',
    importPath: './AutomationsPanel'
},
  {
    id: 'tutorial-approval-panel',
    name: 'TutorialApprovalPanel',
    category: 'tutorial',
    description: 'Panel for managing tutorial approvals and reviews',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','tutorialData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['approval','review','publishing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './TutorialApprovalPanel.tsx',
    importPath: './TutorialApprovalPanel'
},
  {
    id: 'payment-integration-panel',
    name: 'PaymentIntegrationPanel',
    category: 'admin',
    description: 'Panel for managing payment system integrations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','paymentData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['configuration','monitoring','testing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './PaymentIntegrationPanel.tsx',
    importPath: './PaymentIntegrationPanel'
},
  {
    id: 'profession-cms-manager',
    name: 'ProfessionCMSManager',
    category: 'cms',
    description: 'Content management system manager for professions',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','professionData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['editing','management','publishing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ProfessionCMSManager.tsx',
    importPath: './ProfessionCMSManager'
},
  {
    id: 'admin-console',
    name: 'AdminConsole',
    category: 'admin',
    description: 'Main administrative console for system management',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','consoleData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tabs'],
      behavior: ['navigation','management','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminConsole.tsx',
    importPath: './AdminConsole'
},
  {
    id: 'google-wallet-integration-test',
    name: 'GoogleWalletIntegrationTest',
    category: 'testing',
    description: 'Integration testing for Google Wallet functionality',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','testData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['testing','validation','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './GoogleWalletIntegrationTest.tsx',
    importPath: './GoogleWalletIntegrationTest'
},
  {
    id: 'admin-email-center',
    name: 'AdminEmailCenter',
    category: 'admin',
    description: 'Email management center for administrators',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','emailData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','lists'],
      behavior: ['sending','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminEmailCenter.tsx',
    importPath: './AdminEmailCenter'
},
  {
    id: 'complete-integration-overview',
    name: 'CompleteIntegrationOverview',
    category: 'integration',
    description: 'Comprehensive overview of all system integrations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','integrationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','charts'],
      behavior: ['monitoring','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CompleteIntegrationOverview.tsx',
    importPath: './CompleteIntegrationOverview'
},
  {
    id: 'deployment-pipeline',
    name: 'DeploymentPipeline',
    category: 'admin',
    description: 'Pipeline management for system deployments',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','pipelineData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','timeline'],
      behavior: ['execution','monitoring','rollback']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './DeploymentPipeline.tsx',
    importPath: './DeploymentPipeline'
},
  {
    id: 'dependencies-manager',
    name: 'DependenciesManager',
    category: 'admin',
    description: 'Manager for system dependencies and packages',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','dependencyData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['tracking','updating','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './DependenciesManager.tsx',
    importPath: './DependenciesManager'
},
  {
    id: 'system-backup-dashboard',
    name: 'SystemBackupDashboard',
    category: 'admin',
    description: 'Dashboard for managing system backups and recovery',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','backupData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['scheduling','monitoring','restoration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './SystemBackupDashboard.tsx',
    importPath: './SystemBackupDashboard'
},
  {
    id: 'product-manager',
    name: 'ProductManager',
    category: 'admin',
    description: 'Product management interface for administrators',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','productData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ProductManager.tsx',
    importPath: './ProductManager'
},
  {
    id: 'trial-management-panel',
    name: 'TrialManagementPanel',
    category: 'admin',
    description: 'Panel for managing trial accounts and subscriptions',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','trialData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['tracking','conversion','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './TrialManagementPanel.tsx',
    importPath: './TrialManagementPanel'
},
  // ROOT-LEVEL ADMIN COMPONENTS - BATCH 2
  {
    id: 'creatorhub-visual-editor-refactored',
    name: 'CreatorhubVisualEditorRefactored',
    category: 'admin',
    description: 'Refactored visual editor for CreatorHub platform',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','editorData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['editing','preview','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CreatorhubVisualEditorRefactored.tsx',
    importPath: './CreatorhubVisualEditorRefactored'
},
  {
    id: 'feature-management',
    name: 'FeatureManagement',
    category: 'admin',
    description: 'Feature management and configuration interface',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','featureData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['toggle','configuration','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './feature-management.tsx',
    importPath: './feature-management'
},
  {
    id: 'system-health-panel',
    name: 'SystemHealthPanel',
    category: 'admin',
    description: 'Panel for monitoring system health and performance',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','healthData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','charts'],
      behavior: ['monitoring','alerting','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './SystemHealthPanel.tsx',
    importPath: './SystemHealthPanel'
},
  {
    id: 'invite-management-dashboard',
    name: 'InviteManagementDashboard',
    category: 'admin',
    description: 'Dashboard for managing user invites and invitations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','inviteData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['sending','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './InviteManagementDashboard.tsx',
    importPath: './InviteManagementDashboard'
},
  {
    id: 'plan-logo-generator',
    name: 'PlanLogoGenerator',
    category: 'admin',
    description: 'Logo generator for subscription plans and tiers',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','logoData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['generation','customization','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './PlanLogoGenerator.tsx',
    importPath: './PlanLogoGenerator'
},
  {
    id: 'admin-user-management',
    name: 'AdminUserManagement',
    category: 'admin',
    description: 'User management interface for administrators',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','userData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminUserManagement.tsx',
    importPath: './AdminUserManagement'
},
  {
    id: 'google-wallet-membership-manager',
    name: 'GoogleWalletMembershipManager',
    category: 'admin',
    description: 'Manager for Google Wallet membership integration',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','membershipData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['management','integration','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './GoogleWalletMembershipManager.tsx',
    importPath: './GoogleWalletMembershipManager'
},
  {
    id: 'package-marketplace',
    name: 'PackageMarketplace',
    category: 'admin',
    description: 'Marketplace for managing packages and subscriptions',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','packageData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['browsing','purchasing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './PackageMarketplace.tsx',
    importPath: './PackageMarketplace'
},
  {
    id: 'payment-systems-integration-test',
    name: 'PaymentSystemsIntegrationTest',
    category: 'testing',
    description: 'Integration testing for payment systems',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','testData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['testing','validation','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './PaymentSystemsIntegrationTest.tsx',
    importPath: './PaymentSystemsIntegrationTest'
},
  {
    id: 'user-management-panel',
    name: 'UserManagementPanel',
    category: 'admin',
    description: 'Panel for managing users and user accounts',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','userData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './UserManagementPanel.tsx',
    importPath: './UserManagementPanel'
},
  {
    id: 'billing-management-panel',
    name: 'BillingManagementPanel',
    category: 'admin',
    description: 'Panel for managing billing and subscription processes',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','billingData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['processing','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './BillingManagementPanel.tsx',
    importPath: './BillingManagementPanel'
},
  {
    id: 'creator-hub-notes',
    name: 'CreatorHubNotes',
    category: 'admin',
    description: 'Notes management system for CreatorHub platform',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','notesData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CreatorHubNotes.tsx',
    importPath: './CreatorHubNotes'
},
  {
    id: 'customer-journey-builder',
    name: 'CustomerJourneyBuilder',
    category: 'admin',
    description: 'Builder for creating customer journey workflows',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','journeyData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','builder'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CustomerJourneyBuilder.tsx',
    importPath: './CustomerJourneyBuilder'
},
  {
    id: 'price-management-dashboard',
    name: 'PriceManagementDashboard',
    category: 'admin',
    description: 'Dashboard for managing pricing and subscription plans',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','priceData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['configuration','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './PriceManagementDashboard.tsx',
    importPath: './PriceManagementDashboard'
},
  {
    id: 'backup-management-interface',
    name: 'BackupManagementInterface',
    category: 'admin',
    description: 'Interface for managing system backups and recovery',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','backupData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['scheduling','monitoring','restoration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './BackupManagementInterface.tsx',
    importPath: './BackupManagementInterface'
},
  {
    id: 'visual-user-management',
    name: 'VisualUserManagement',
    category: 'admin',
    description: 'Visual interface for user management operations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','userData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './VisualUserManagement.tsx',
    importPath: './VisualUserManagement'
},
  {
    id: 'prototype-feedback-panel',
    name: 'PrototypeFeedbackPanel',
    category: 'testing',
    description: 'Panel for collecting and managing prototype feedback',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','feedbackData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['collection','tracking','analysis']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './PrototypeFeedbackPanel.tsx',
    importPath: './PrototypeFeedbackPanel'
},
  {
    id: 'integrations-management-panel',
    name: 'IntegrationsManagementPanel',
    category: 'integration',
    description: 'Panel for managing system integrations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','integrationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['configuration','monitoring','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './IntegrationsManagementPanel.tsx',
    importPath: './IntegrationsManagementPanel'
},
  {
    id: 'admin-dashboard-integration-test',
    name: 'AdminDashboardIntegrationTest',
    category: 'testing',
    description: 'Integration testing for admin dashboard functionality',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','testData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['testing','validation','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminDashboardIntegrationTest.tsx',
    importPath: './AdminDashboardIntegrationTest'
},
  {
    id: 'feature-management-with-publish',
    name: 'FeatureManagementWithPublish',
    category: 'admin',
    description: 'Feature management with publishing capabilities',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','featureData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['toggle','publishing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './FeatureManagementWithPublish.tsx',
    importPath: './FeatureManagementWithPublish'
},
  // ROOT-LEVEL ADMIN COMPONENTS - BATCH 3
  {
    id: 'installation-wizard',
    name: 'InstallationWizard',
    category: 'admin',
    description: 'Wizard for system installation and setup',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','installationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','wizard'],
      behavior: ['step-by-step','validation','completion']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './InstallationWizard.tsx',
    importPath: './InstallationWizard'
},
  {
    id: 'visual-cms-admin-dashboard',
    name: 'VisualCMSAdminDashboard',
    category: 'cms',
    description: 'Admin dashboard for visual CMS management',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','cmsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','dashboard'],
      behavior: ['management','editing','publishing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './VisualCMSAdminDashboard.tsx',
    importPath: './VisualCMSAdminDashboard'
},
  {
    id: 'database-integrity-checker',
    name: 'DatabaseIntegrityChecker',
    category: 'admin',
    description: 'Tool for checking database integrity and consistency',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','integrityData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['checking','validation','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './DatabaseIntegrityChecker.tsx',
    importPath: './DatabaseIntegrityChecker'
},
  {
    id: 'admin-floating-action-buttons',
    name: 'AdminFloatingActionButtons',
    category: 'admin',
    description: 'Floating action buttons for admin interface',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','buttonData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['floating','buttons','actions'],
      behavior: ['quick-actions','navigation','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminFloatingActionButtons.tsx',
    importPath: './AdminFloatingActionButtons'
},
  {
    id: 'viral-content-creator',
    name: 'ViralContentCreator',
    category: 'admin',
    description: 'Tool for creating viral content and campaigns',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','contentData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['creation','optimization','distribution']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ViralContentCreator.tsx',
    importPath: './ViralContentCreator'
},
  {
    id: 'seo-trends-dashboard',
    name: 'SEOTrendsDashboard',
    category: 'admin',
    description: 'Dashboard for tracking SEO trends and performance',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','seoData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','charts'],
      behavior: ['tracking','analysis','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './SEOTrendsDashboard.tsx',
    importPath: './SEOTrendsDashboard'
},
  {
    id: 'google-payments-configuration',
    name: 'GooglePaymentsConfiguration',
    category: 'admin',
    description: 'Configuration interface for Google Payments integration',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','paymentConfig']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['configuration','testing','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './GooglePaymentsConfiguration.tsx',
    importPath: './GooglePaymentsConfiguration'
},
  {
    id: 'admin-stats',
    name: 'AdminStats',
    category: 'admin',
    description: 'Statistics dashboard for admin monitoring',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','statsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','charts'],
      behavior: ['monitoring','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminStats.tsx',
    importPath: './AdminStats'
},
  {
    id: 'admin-widgets',
    name: 'AdminWidgets',
    category: 'admin',
    description: 'Widget collection for admin dashboard',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','widgetData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','widgets'],
      behavior: ['customization','management','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminWidgets.tsx',
    importPath: './AdminWidgets'
},
  {
    id: 'admin-notification-system',
    name: 'AdminNotificationSystem',
    category: 'admin',
    description: 'System for managing admin notifications',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','notificationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','lists'],
      behavior: ['sending','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminNotificationSystem.tsx',
    importPath: './AdminNotificationSystem'
},
  {
    id: 'customer-projects-panel',
    name: 'CustomerProjectsPanel',
    category: 'admin',
    description: 'Panel for managing customer projects',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','projectData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['management','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CustomerProjectsPanel.tsx',
    importPath: './CustomerProjectsPanel'
},
  {
    id: 'integrated-email-marketing-center',
    name: 'IntegratedEmailMarketingCenter',
    category: 'admin',
    description: 'Integrated center for email marketing management',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','emailData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['creation','campaigns','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './IntegratedEmailMarketingCenter.tsx',
    importPath: './IntegratedEmailMarketingCenter'
},
  {
    id: 'dam-admin-panel',
    name: 'DAMAdminPanel',
    category: 'admin',
    description: 'Digital Asset Management admin panel',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','assetData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','browser'],
      behavior: ['management','organization','access']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './DAMAdminPanel.tsx',
    importPath: './DAMAdminPanel'
},
  {
    id: 'admin-performance-dashboard',
    name: 'AdminPerformanceDashboard',
    category: 'admin',
    description: 'Performance monitoring dashboard for admins',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','performanceData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','charts'],
      behavior: ['monitoring','tracking','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminPerformanceDashboard.tsx',
    importPath: './AdminPerformanceDashboard'
},
  {
    id: 'live-verification-demo',
    name: 'LiveVerificationDemo',
    category: 'testing',
    description: 'Live demo for verification system testing',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','demoData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','demo'],
      behavior: ['demonstration','testing','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './LiveVerificationDemo.tsx',
    importPath: './LiveVerificationDemo'
},
  {
    id: 'automated-business-reports',
    name: 'AutomatedBusinessReports',
    category: 'admin',
    description: 'System for generating automated business reports',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','reportData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','reports'],
      behavior: ['generation','scheduling','distribution']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AutomatedBusinessReports.tsx',
    importPath: './AutomatedBusinessReports'
},
  {
    id: 'comprehensive-protocol-manager',
    name: 'ComprehensiveProtocolManager',
    category: 'admin',
    description: 'Manager for comprehensive protocol handling',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','protocolData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['management','configuration','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ComprehensiveProtocolManager.tsx',
    importPath: './ComprehensiveProtocolManager'
},
  {
    id: 'api-integration-process-monitor',
    name: 'ApiIntegrationProcessMonitor',
    category: 'admin',
    description: 'Monitor for API integration processes',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','integrationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','monitor'],
      behavior: ['monitoring','tracking','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ApiIntegrationProcessMonitor.tsx',
    importPath: './ApiIntegrationProcessMonitor'
},
  {
    id: 'admin-communication-panel',
    name: 'AdminCommunicationPanel',
    category: 'admin',
    description: 'Communication panel for admin operations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','communicationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','chat'],
      behavior: ['messaging','notifications','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminCommunicationPanel.tsx',
    importPath: './AdminCommunicationPanel'
},
  {
    id: 'unified-admin-analytics',
    name: 'UnifiedAdminAnalytics',
    category: 'admin',
    description: 'Unified analytics system for admin dashboard',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','analyticsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','charts'],
      behavior: ['tracking','analysis','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './UnifiedAdminAnalytics.tsx',
    importPath: './UnifiedAdminAnalytics'
},
  // ROOT-LEVEL ADMIN COMPONENTS - BATCH 4 (FINAL)
  {
    id: 'profession-type-manager',
    name: 'ProfessionTypeManager',
    category: 'admin',
    description: 'Manager for profession types and configurations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','professionData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['management','configuration','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ProfessionTypeManager.tsx',
    importPath: './ProfessionTypeManager'
},
  {
    id: 'admin-indicator',
    name: 'AdminIndicator',
    category: 'admin',
    description: 'Visual indicator for admin status and actions',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','indicatorData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['indicator','badge','status'],
      behavior: ['status-display','notification','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminIndicator.tsx',
    importPath: './AdminIndicator'
},
  {
    id: 'centralized-monitoring-console',
    name: 'CentralizedMonitoringConsole',
    category: 'admin',
    description: 'Centralized console for system monitoring',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','monitoringData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','dashboard'],
      behavior: ['monitoring','alerting','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CentralizedMonitoringConsole.tsx',
    importPath: './CentralizedMonitoringConsole'
},
  {
    id: 'api-endpoint-monitor',
    name: 'APIEndpointMonitor',
    category: 'admin',
    description: 'Monitor for API endpoints and performance',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','endpointData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','monitor'],
      behavior: ['monitoring','tracking','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './APIEndpointMonitor.tsx',
    importPath: './APIEndpointMonitor'
},
  {
    id: 'reports-panel',
    name: 'ReportsPanel',
    category: 'admin',
    description: 'Panel for generating and managing reports',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','reportData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','tables'],
      behavior: ['generation','scheduling','distribution']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './ReportsPanel.tsx',
    importPath: './ReportsPanel'
},
  {
    id: 'fix-validation-request',
    name: 'FixValidationRequest',
    category: 'admin',
    description: 'System for requesting and managing fix validations',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','validationData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','forms'],
      behavior: ['request','validation','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './FixValidationRequest.tsx',
    importPath: './FixValidationRequest'
},
  {
    id: 'deployment-status-widget',
    name: 'DeploymentStatusWidget',
    category: 'admin',
    description: 'Widget for monitoring deployment status',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','deploymentData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widget','status','progress'],
      behavior: ['monitoring','tracking','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './DeploymentStatusWidget.tsx',
    importPath: './DeploymentStatusWidget'
},
  {
    id: 'verification-system-demo',
    name: 'VerificationSystemDemo',
    category: 'testing',
    description: 'Demo system for verification processes',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','demoData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','demo'],
      behavior: ['demonstration','testing','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './VerificationSystemDemo.tsx',
    importPath: './VerificationSystemDemo'
},
  {
    id: 'task-list-visualizer',
    name: 'TaskListVisualizer',
    category: 'admin',
    description: 'Visualizer for task lists and project management',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','taskData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','lists'],
      behavior: ['visualization','tracking','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './TaskListVisualizer.tsx',
    importPath: './TaskListVisualizer'
},
  {
    id: 'visual-cms-admin',
    name: 'VisualCMSAdmin',
    category: 'cms',
    description: 'Visual CMS admin interface',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','cmsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','admin'],
      behavior: ['management','editing','publishing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './VisualCMSAdmin.tsx',
    importPath: './VisualCMSAdmin'
},
  {
    id: 'complete-deployment-manager',
    name: 'CompleteDeploymentManager',
    category: 'admin',
    description: 'Complete deployment management system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','deploymentData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','manager'],
      behavior: ['deployment','monitoring','rollback']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CompleteDeploymentManager.tsx',
    importPath: './CompleteDeploymentManager'
},
  {
    id: 'lsd-monitoring-panel',
    name: 'LSDMonitoringPanel',
    category: 'admin',
    description: 'Monitoring panel for LSD (Live System Data, )',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','lsdData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','monitor'],
      behavior: ['monitoring','tracking','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './LSDMonitoringPanel.tsx',
    importPath: './LSDMonitoringPanel'
},
  {
    id: 'creator-hub-notes-copy',
    name: 'CreatorHubNotesCopy',
    category: 'admin',
    description: 'Copy of CreatorHub Notes system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','notesData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['creation','editing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './CreatorHubNotes (copy).tsx',
    importPath: './CreatorHubNotes (copy)'
},
  {
    id: 'advanced-notes-manager',
    name: 'AdvancedNotesManager',
    category: 'admin',
    description: 'Advanced notes management system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','notesData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','editor'],
      behavior: ['advanced-editing','organization','collaboration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdvancedNotesManager.tsx',
    importPath: './AdvancedNotesManager'
},
  {
    id: 'admin-dashboard',
    name: 'AdminDashboard',
    category: 'admin',
    description: 'Main admin dashboard interface',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','dashboardData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','dashboard'],
      behavior: ['navigation','management','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './AdminDashboard.tsx',
    importPath: './AdminDashboard'
},
  {
    id: 'universal-admin-cms',
    name: 'UniversalAdminCM',
    category: 'cms',
    description: 'Universal admin CMS interface',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [],
      optional: ['userI','onUpdate','cmsData']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','cms'],
      behavior: ['universal-management','editing','publishing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: './UniversalAdminCMS.tsx',
    importPath: './UniversalAdminCMS'
},
  // INDIVIDUAL ROOT-LEVEL COMPONENTS FROM /client/src/components/
  {
    id: 'wedding-timeline',
    name: 'WeddingTimeline',
    category: 'management',
    description: 'Wedding timeline management and planning component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['weddingI','onTimelineUpdate','readOnly']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','timeline','cards'],
      behavior: ['editing','scheduling','collaboration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-timeline.tsx',
    importPath: './wedding-timeline'
},
  {
    id: 'export-dialog',
    name: 'ExportDialog',
    category: 'admin',
    description: 'Dialog component for exporting data and files',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose'],
      optional: ['data','exportType','onExport']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dialog','forms','buttons'],
      behavior: ['export','validation','progress']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExportDialog.tsx',
    importPath: './ExportDialog'
},
  {
    id: 'story-arc-auto-monitor',
    name: 'StoryArcAutoMonitor',
    category: 'ai',
    description: 'AI-powered story arc monitoring and analysis component',
    profession: ['videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalysis','autoMode','thresholds']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','charts','monitor'],
      behavior: ['monitoring','analysis','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/StoryArcAutoMonitor.tsx',
    importPath: './StoryArcAutoMonitor'
},
  {
    id: 'asset-browser',
    name: 'AssetBrowser',
    category: 'file',
    description: 'Browser component for managing and viewing assets',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','filterOptions','viewMode']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','list','preview'],
      behavior: ['browsing','filtering','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AssetBrowser.tsx',
    importPath: './AssetBrowser'
},
  {
    id: 'google-oauth-setup',
    name: 'GoogleOAuthSetup',
    category: 'integration',
    description: 'Google OAuth authentication setup component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['scope','redirectUri','clientId']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['forms','buttons','status'],
      behavior: ['authentication','validation','callback']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/GoogleOAuthSetup.tsx',
    importPath: './GoogleOAuthSetup'
},
  {
    id: 'business-logo-upload',
    name: 'BusinessLogoUpload',
    category: 'business',
    description: 'Component for uploading and managing business logos',
    profession: ['vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['currentLogo','maxSize','allowedFormats']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['upload','preview','crop'],
      behavior: ['upload','validation','cropping']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessLogoUpload.tsx',
    importPath: './BusinessLogoUpload'
},
  {
    id: 'wedding-code-entry',
    name: 'WeddingCodeEntry',
    category: 'management',
    description: 'Wedding code entry and validation component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['placeholder','validation','maxLength']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['forms','input','buttons'],
      behavior: ['validation','submission','feedback']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-code-entry.tsx',
    importPath: './wedding-code-entry'
},
  {
    id: 'extra-image-pricing-dialog',
    name: 'ExtraImagePricingDialog',
    category: 'business',
    description: 'Dialog for managing extra image pricing',
    profession: ['photographer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose','pricingData'],
      optional: ['onSave','readOnly','currency']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dialog','forms','tables'],
      behavior: ['pricing','calculation','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExtraImagePricingDialog.tsx',
    importPath: './ExtraImagePricingDialog'
},
  {
    id: 'invite-request-form',
    name: 'InviteRequestForm',
    category: 'communication',
    description: 'Form component for sending invite requests',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['recipients','template','customMessage']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['forms','inputs','buttons'],
      behavior: ['validation','submission','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/InviteRequestForm.tsx',
    importPath: './InviteRequestForm'
},
  {
    id: 'recent-uploads-widget',
    name: 'RecentUploadsWidget',
    category: 'file',
    description: 'Widget displaying recent file uploads',
    profession: ['photographer','videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','maxItems','showThumbnails']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','list','thumbnails'],
      behavior: ['display','navigation','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/RecentUploadsWidget.tsx',
    importPath: './RecentUploadsWidget'
},
  {
    id: 'file-detection-dashboard-widget',
    name: 'FileDetectionDashboardWidget',
    category: 'file',
    description: 'Dashboard widget for file detection and monitoring',
    profession: ['admin','photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDetection','autoScan','fileTypes']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widget','dashboard','status'],
      behavior: ['detection','monitoring','alerting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/FileDetectionDashboardWidget.tsx',
    importPath: './FileDetectionDashboardWidget'
},
  {
    id: 'memory-card-manager',
    name: 'MemoryCardManager',
    category: 'equipment',
    description: 'Memory card management and organization component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCardSelect','onBackup','cardStatus']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','cards','status'],
      behavior: ['management','backup','monitoring']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/MemoryCardManager.tsx',
    importPath: './MemoryCardManager'
},
  {
    id: 'business-intelligence-dashboard',
    name: 'BusinessIntelligenceDashboard',
    category: 'business',
    description: 'Business intelligence and analytics dashboard',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['metrics','timeRange','onFilter']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','charts','metrics'],
      behavior: ['analytics','filtering','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessIntelligenceDashboard.tsx',
    importPath: './BusinessIntelligenceDashboard'
},
  {
    id: 'project-creation-wizard',
    name: 'ProjectCreationWizard',
    category: 'management',
    description: 'Wizard component for creating new projects',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['steps','initialData','validation']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['wizard','forms','navigation'],
      behavior: ['step-by-step','validation','creation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ProjectCreationWizard.tsx',
    importPath: './ProjectCreationWizard'
},
  {
    id: 'two-factor-setup',
    name: 'TwoFactorSetup',
    category: 'security',
    description: 'Two-factor authentication setup component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['method','qrCode','backupCodes']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['forms','qr-code','setup'],
      behavior: ['setup','validation','verification']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/TwoFactorSetup.tsx',
    importPath: './TwoFactorSetup'
},
  {
    id: 'system-messages-banner',
    name: 'SystemMessagesBanner',
    category: 'admin',
    description: 'Banner component for displaying system messages',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDismiss','autoHide','type']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['banner','messages','actions'],
      behavior: ['display','dismissal','auto-hide']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/SystemMessagesBanner.tsx',
    importPath: './SystemMessagesBanner'
},
  {
    id: 'story-arc-generator',
    name: 'StoryArcGenerator',
    category: 'ai',
    description: 'AI-powered story arc generation component',
    profession: ['videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onGenerate','style','length']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['generator','preview','controls'],
      behavior: ['generation','preview','customization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/StoryArcGenerator.tsx',
    importPath: './StoryArcGenerator'
},
  {
    id: 'smart-router',
    name: 'SmartRouter',
    category: 'system',
    description: 'Intelligent routing component for navigation',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onNavigate','fallback','guards']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['router','navigation','guards'],
      behavior: ['routing','navigation','guards']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/smart-router.tsx',
    importPath: './smart-router'
},
  {
    id: 'price-administration',
    name: 'PriceAdministration',
    category: 'business',
    description: 'Price administration and management component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onUpdate','currency','taxSettings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['administration','tables','forms'],
      behavior: ['administration','calculation','validation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/PriceAdministration.tsx',
    importPath: './PriceAdministration'
},
  {
    id: 'project-file-manager',
    name: 'ProjectFileManager',
    category: 'file',
    description: 'File management component for projects',
    profession: ['photographer','videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['projectI','files'],
      optional: ['onUpload','onDelete','allowedTypes']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['manager','grid','preview'],
      behavior: ['upload','management','organization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/project-file-manager.tsx',
    importPath: './project-file-manager'
},
  // UNIVERSAL DIRECTORY COMPONENTS - BATCH 1
  {
    id: 'universal-dashboard',
    name: 'UniversalDashboard',
    category: 'orchestrator',
    description: 'Main universal dashboard orchestrator component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['profession','onProfessionChange','mode']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','grid','navigation'],
      behavior: ['orchestration','routing','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDashboard.tsx',
    importPath: './universal/UniversalDashboard'
},
  {
    id: 'fotograf-orchestrator',
    name: 'FotografOrchestrator',
    category: 'orchestrator',
    description: 'Photographer profession orchestrator',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProjectUpdate','onWorklogCreate','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['orchestrator','grid','workflow'],
      behavior: ['orchestration','workflow','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/FotografOrchestrator.tsx',
    importPath: './universal/FotografOrchestrator'
},
  {
    id: 'videograf-orchestrator',
    name: 'VideografOrchestrator',
    category: 'orchestrator',
    description: 'Videographer profession orchestrator',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProjectUpdate','onWorklogCreate','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['orchestrator','grid','workflow'],
      behavior: ['orchestration','workflow','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/VideografOrchestrator.tsx',
    importPath: './universal/VideografOrchestrator'
},
  {
    id: 'musikk-produsent-orchestrator',
    name: 'MusikkProdusentOrchestrator',
    category: 'orchestrator',
    description: 'Music producer profession orchestrator',
    profession: ['music_producer', ],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProjectUpdate','onWorklogCreate','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['orchestrator','grid','workflow'],
      behavior: ['orchestration','workflow','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/MusikkProdusentOrchestrator.tsx',
    importPath: './universal/MusikkProdusentOrchestrator'
},
  {
    id: 'vendor-orchestrator',
    name: 'VendorOrchestrator',
    category: 'orchestrator',
    description: 'Vendor profession orchestrator',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProjectUpdate','onWorklogCreate','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['orchestrator','grid','workflow'],
      behavior: ['orchestration','workflow','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/VendorOrchestrator.tsx',
    importPath: './universal/VendorOrchestrator'
},
  {
    id: 'component-orchestrator',
    name: 'ComponentOrchestrator',
    category: 'orchestrator',
    description: 'Component orchestration and management system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onComponentUpdate','layout','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['orchestrator','grid','components'],
      behavior: ['orchestration','management','coordination']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/ComponentOrchestrator.tsx',
    importPath: './universal/ComponentOrchestrator'
},
  {
    id: 'smart-workflow-system',
    name: 'SmartWorkflowSystem',
    category: 'orchestrator',
    description: 'Intelligent workflow management system',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onWorkflowUpdate','autoOptimization','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['workflow','builder','analytics'],
      behavior: ['automation','optimization','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/SmartWorkflowSystem.tsx',
    importPath: './universal/SmartWorkflowSystem'
},
  {
    id: 'unified-workflow-orchestrator',
    name: 'UnifiedWorkflowOrchestrator',
    category: 'orchestrator',
    description: 'Unified workflow orchestration system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onOrchestrate','priority','resourceManagement']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['orchestrator','dashboard','monitoring'],
      behavior: ['orchestration','monitoring','optimization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UnifiedWorkflowOrchestrator.tsx',
    importPath: './universal/UnifiedWorkflowOrchestrator'
},
  {
    id: 'universal-communication',
    name: 'UniversalCommunication',
    category: 'communication',
    description: 'Universal communication system component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['channels','onMessage','notifications']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['communication','chat','notifications'],
      behavior: ['messaging','notifications','collaboration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalCommunication.tsx',
    importPath: './universal/UniversalCommunication'
},
  {
    id: 'universal-showcase',
    name: 'UniversalShowcase',
    category: 'showcase',
    description: 'Universal showcase and gallery component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','layout','filters']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['showcase','gallery','grid'],
      behavior: ['display','filtering','interaction']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalShowcase.tsx',
    importPath: './universal/UniversalShowcase'
},
  {
    id: 'universal-file-upload',
    name: 'UniversalFileUpload',
    category: 'file',
    description: 'Universal file upload component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['maxSize','allowedTypes','multiple']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['upload','progress','preview'],
      behavior: ['upload','validation','progress']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalFileUpload.tsx',
    importPath: './universal/UniversalFileUpload'
},
  {
    id: 'universal-download',
    name: 'UniversalDownload',
    category: 'file',
    description: 'Universal file download component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onDownload','batchMode','compression']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['download','list','progress'],
      behavior: ['download','batch','compression']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalDownload.tsx',
    importPath: './universal/UniversalDownload'
},
  {
    id: 'universal-settings-panel',
    name: 'UniversalSettingsPanel',
    category: 'settings',
    description: 'Universal settings management panel',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSave','categories','permissions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['panel','tabs','forms'],
      behavior: ['settings','validation','persistence']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalSettingsPanel.tsx',
    importPath: './universal/UniversalSettingsPanel'
},
  {
    id: 'universal-notification-provider',
    name: 'UniversalNotificationProvider',
    category: 'communication',
    description: 'Universal notification provider component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['channels','preferences','realTime']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['provider','notifications','channels'],
      behavior: ['notifications','channels','real-time']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/UniversalNotificationProvider.tsx',
    importPath: './universal/UniversalNotificationProvider'
},
  {
    id: 'command-palette',
    name: 'CommandPalette',
    category: 'system',
    description: 'Universal command palette component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onExecute','shortcuts','search']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['palette','search','results'],
      behavior: ['search','execution','shortcuts']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/CommandPalette.tsx',
    importPath: './universal/CommandPalette'
},
  {
    id: 'comprehensive-admin-dashboard',
    name: 'ComprehensiveAdminDashboard',
    category: 'admin',
    description: 'Comprehensive admin dashboard component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['metrics','permissions','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','metrics','controls'],
      behavior: ['administration','monitoring','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/comprehensive-admin-dashboard.tsx',
    importPath: './universal/admin/comprehensive-admin-dashboard'
},
  {
    id: 'google-analytics-dashboard',
    name: 'GoogleAnalyticsDashboard',
    category: 'admin',
    description: 'Google Analytics integration dashboard',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['dateRange','metrics','onExport']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','charts','metrics'],
      behavior: ['analytics','reporting','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/google-analytics-dashboard.tsx',
    importPath: './universal/admin/google-analytics-dashboard'
},
  {
    id: 'advanced-cms-interface',
    name: 'AdvancedCMSInterface',
    category: 'cms',
    description: 'Advanced CMS interface component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSave','templates','permissions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['interface','editor','templates'],
      behavior: ['editing','templates','management']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/advanced-cms-interface.tsx',
    importPath: './universal/admin/advanced-cms-interface'
},
  {
    id: 'admin-prototype-testing-dashboard',
    name: 'AdminPrototypeTestingDashboard',
    category: 'testing',
    description: 'Admin prototype testing dashboard',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTest','testCases','reports']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','testing','reports'],
      behavior: ['testing','validation','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/admin/admin-prototype-testing-dashboard.tsx',
    importPath: './universal/admin/admin-prototype-testing-dashboard'
},
  {
    id: 'screenshot-capture',
    name: 'ScreenshotCapture',
    category: 'system',
    description: 'Screenshot capture utility component',
    profession: ['admin','photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['format','quality','annotations']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['capture','preview','controls'],
      behavior: ['capture','annotation','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/universal/ScreenshotCapture.tsx',
    importPath: './universal/ScreenshotCapture'
},
  // SHOWCASE DIRECTORY COMPONENTS
  {
    id: 'showcase-admin',
    name: 'ShowcaseAdmin',
    category: 'showcase',
    description: 'Showcase administration component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onUpdate','permissions','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['admin','grid','controls'],
      behavior: ['administration','management','settings']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseAdmin.tsx',
    importPath: './showcase/ShowcaseAdmin'
},
  {
    id: 'showcase-portal',
    name: 'ShowcasePortal',
    category: 'showcase',
    description: 'Main showcase portal component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','layout','filters']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['portal','grid','navigation'],
      behavior: ['display','navigation','filtering']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcasePortal.tsx',
    importPath: './showcase/ShowcasePortal'
},
  {
    id: 'showcase-drive-grid',
    name: 'ShowcaseDriveGrid',
    category: 'showcase',
    description: 'Showcase drive grid component',
    profession: ['photographer','videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','viewMode','filters']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','files','preview'],
      behavior: ['display','selection','navigation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseDriveGrid.tsx',
    importPath: './showcase/ShowcaseDriveGrid'
},
  {
    id: 'creative-showcase-system',
    name: 'CreativeShowcaseSystem',
    category: 'showcase',
    description: 'Creative showcase system component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCreate','templates','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['system','creator','templates'],
      behavior: ['creation','customization','templates']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/CreativeShowcaseSystem.tsx',
    importPath: './showcase/CreativeShowcaseSystem'
},
  {
    id: 'image-crop-editor',
    name: 'ImageCropEditor',
    category: 'showcase',
    description: 'Image crop editor component for showcases',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCrop','aspectRatio','quality']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['editor','preview','controls'],
      behavior: ['cropping','preview','export']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ImageCropEditor.tsx',
    importPath: './showcase/ImageCropEditor'
},
  {
    id: 'category-manager',
    name: 'CategoryManager',
    category: 'showcase',
    description: 'Category management component for showcases',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onUpdate','onDelete','onCreate']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['manager','list','forms'],
      behavior: ['management','crud','organization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/CategoryManager.tsx',
    importPath: './showcase/CategoryManager'
},
  {
    id: 'showcase-comment-system',
    name: 'ShowcaseCommentSystem',
    category: 'showcase',
    description: 'Comment system for showcases',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onComment','moderation','permissions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['comments','threads','input'],
      behavior: ['commenting','moderation','threading']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseCommentSystem.tsx',
    importPath: './showcase/ShowcaseCommentSystem'
},
  {
    id: 'showcase-template-selector',
    name: 'ShowcaseTemplateSelector',
    category: 'showcase',
    description: 'Template selector for showcases',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','preview','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['selector','preview','grid'],
      behavior: ['selection','preview','customization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/ShowcaseTemplateSelector.tsx',
    importPath: './showcase/ShowcaseTemplateSelector'
},
  {
    id: 'video-thumbnail-selector',
    name: 'VideoThumbnailSelector',
    category: 'showcase',
    description: 'Video thumbnail selector component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSelect','thumbnailCount','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['selector','thumbnails','preview'],
      behavior: ['selection','preview','generation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/VideoThumbnailSelector.tsx',
    importPath: './showcase/VideoThumbnailSelector'
},
  {
    id: 'universal-vendor-showcase',
    name: 'UniversalVendorShowcase',
    category: 'showcase',
    description: 'Universal vendor showcase component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['products','layout','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['showcase','products','grid'],
      behavior: ['display','filtering','interaction']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/showcase/UniversalVendorShowcase.tsx',
    importPath: './showcase/UniversalVendorShowcase'
},
  // CHAT DIRECTORY COMPONENTS
  {
    id: 'chat-widget',
    name: 'ChatWidget',
    category: 'communication',
    description: 'Basic chat widget component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['channel','onMessage','styling']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widget','messages','input'],
      behavior: ['messaging','real-time','notifications']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/ChatWidget.tsx',
    importPath: './chat/ChatWidget'
},
  {
    id: 'universal-chat-widget',
    name: 'UniversalChatWidget',
    category: 'communication',
    description: 'Universal chat widget component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['channels','onMessage','global']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widget','channels','messages'],
      behavior: ['messaging','channels','universal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/UniversalChatWidget.tsx',
    importPath: './chat/UniversalChatWidget'
},
  {
    id: 'global-chat-provider',
    name: 'GlobalChatProvider',
    category: 'communication',
    description: 'Global chat provider component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['channels','permissions','moderation']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['provider','context','global'],
      behavior: ['providing','context','global-state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/GlobalChatProvider.tsx',
    importPath: './chat/GlobalChatProvider'
},
  {
    id: 'fullscreen-chat-widget',
    name: 'FullscreenChatWidget',
    category: 'communication',
    description: 'Fullscreen chat widget component',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onToggle','fullscreen','channels']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['fullscreen','widget','overlay'],
      behavior: ['fullscreen','toggle','overlay']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/FullscreenChatWidget.tsx',
    importPath: './chat/FullscreenChatWidget'
},
  {
    id: 'chat-with-privacy',
    name: 'ChatWithPrivacy',
    category: 'communication',
    description: 'Chat component with privacy features',
    profession: ['photographer','videographer','music_producer','vendor','admin'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['privacySettings','encryption','consent']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['chat','privacy','settings'],
      behavior: ['privacy','encryption','consent']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/ChatWithPrivacy.tsx',
    importPath: './chat/ChatWithPrivacy'
},
  {
    id: 'advanced-chat-protocols',
    name: 'AdvancedChatProtocols',
    category: 'communication',
    description: 'Advanced chat protocols component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onConfigure','security','encryption']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['protocols','configuration','security'],
      behavior: ['protocols','configuration','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/AdvancedChatProtocols.tsx',
    importPath: './chat/AdvancedChatProtocols'
},
  {
    id: 'crm-assistant',
    name: 'CRMAssistant',
    category: 'communication',
    description: 'CRM assistant chat component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['assistant','context','history']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['assistant','chat','context'],
      behavior: ['assistant','crm','contextual']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/CRMAssistant.tsx',
    importPath: './chat/CRMAssistant'
},
  {
    id: 'quote-creation-modal',
    name: 'QuoteCreationModal',
    category: 'communication',
    description: 'Quote creation modal for chat',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: ['open','onClose','onCreate'],
      optional: ['clientI','template','items']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['modal','forms','preview'],
      behavior: ['creation','validation','preview']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/chat/QuoteCreationModal.tsx',
    importPath: './chat/QuoteCreationModal'
},
  // MARKETING DIRECTORY COMPONENTS
  {
    id: 'content-marketing-engine',
    name: 'ContentMarketingEngine',
    category: 'marketing',
    description: 'Content marketing engine component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPublish','scheduling','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['engine','content','scheduling'],
      behavior: ['content','publishing','scheduling']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/ContentMarketingEngine.tsx',
    importPath: './marketing/ContentMarketingEngine'
},
  {
    id: 'email-marketing-manager',
    name: 'EmailMarketingManager',
    category: 'marketing',
    description: 'Email marketing management component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSend','templates','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['manager','campaigns','templates'],
      behavior: ['management','sending','analytics']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/EmailMarketingManager.tsx',
    importPath: './marketing/EmailMarketingManager'
},
  {
    id: 'social-media-manager',
    name: 'SocialMediaManager',
    category: 'marketing',
    description: 'Social media management component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onPost','scheduling','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['manager','accounts','posts'],
      behavior: ['management','posting','scheduling']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/SocialMediaManager.tsx',
    importPath: './marketing/SocialMediaManager'
},
  {
    id: 'marketing-automation-engine',
    name: 'MarketingAutomationEngine',
    category: 'marketing',
    description: 'Marketing automation engine component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTrigger','rules','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['engine','workflows','rules'],
      behavior: ['automation','triggering','workflows']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/MarketingAutomationEngine.tsx',
    importPath: './marketing/MarketingAutomationEngine'
},
  {
    id: 'lead-generation-system',
    name: 'LeadGenerationSystem',
    category: 'marketing',
    description: 'Lead generation system component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCapture','qualification','tracking']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['system','leads','forms'],
      behavior: ['generation','capture','qualification']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/LeadGenerationSystem.tsx',
    importPath: './marketing/LeadGenerationSystem'
},
  {
    id: 'marketing-seo-dashboard',
    name: 'MarketingSEODashboard',
    category: 'marketing',
    description: 'Marketing SEO dashboard component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyze','keywords','reports']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','metrics','charts'],
      behavior: ['analysis','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/MarketingSEODashboard.tsx',
    importPath: './marketing/MarketingSEODashboard'
},
  {
    id: 'referral-growth-system',
    name: 'ReferralGrowthSystem',
    category: 'marketing',
    description: 'Referral growth system component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTrack','rewards','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['system','referrals','tracking'],
      behavior: ['tracking','rewards','growth']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/ReferralGrowthSystem.tsx',
    importPath: './marketing/ReferralGrowthSystem'
},
  {
    id: 'viral-portfolio-engine',
    name: 'ViralPortfolioEngine',
    category: 'marketing',
    description: 'Viral portfolio engine component',
    profession: ['photographer','videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onViralize','algorithms','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['engine','portfolio','viral'],
      behavior: ['viralization','algorithms','optimization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/ViralPortfolioEngine.tsx',
    importPath: './marketing/ViralPortfolioEngine'
},
  {
    id: 'events-management-platform',
    name: 'EventsManagementPlatform',
    category: 'marketing',
    description: 'Events management platform component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onManage','ticketing','analytics']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['platform','events','management'],
      behavior: ['management','ticketing','analytics']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/EventsManagementPlatform.tsx',
    importPath: './marketing/EventsManagementPlatform'
},
  {
    id: 'influencer-partnership-platform',
    name: 'InfluencerPartnershipPlatform',
    category: 'marketing',
    description: 'Influencer partnership platform component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onManage','collaboration','tracking']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['platform','partnerships','collaboration'],
      behavior: ['management','collaboration','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/marketing/InfluencerPartnershipPlatform.tsx',
    importPath: './marketing/InfluencerPartnershipPlatform'
},
  // UI DIRECTORY COMPONENTS
  {
    id: 'ui-button',
    name: 'Button',
    category: 'ui',
    description: 'Enhanced button component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['variant','color','size','onClick']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['button','icon','text'],
      behavior: ['click','hover','disabled']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/button.tsx',
    importPath: './ui/button'
},
  {
    id: 'ui-input',
    name: 'Input',
    category: 'ui',
    description: 'Enhanced input component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [],
      optional: ['value','onChange','placeholder','type']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['input','label','helper'],
      behavior: ['input','validation','focus']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/input.tsx',
    importPath: './ui/input'
},
  {
    id: 'ui-select',
    name: 'Select',
    category: 'ui',
    description: 'Enhanced select component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['value','onChange','multiple','placeholder']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['select','options','dropdown'],
      behavior: ['selection','dropdown','search']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/select.tsx',
    importPath: './ui/select'
},
  {
    id: 'ui-badge',
    name: 'Badge',
    category: 'ui',
    description: 'Enhanced badge component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['variant','color','size','count']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['badge','content','count'],
      behavior: ['display','notification','status']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/badge.tsx',
    importPath: './ui/badge'
},
  {
    id: 'ui-progress',
    name: 'Progress',
    category: 'ui',
    description: 'Enhanced progress component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['max','variant','color','label']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['progress','bar','label'],
      behavior: ['progress','animation','indeterminate']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/progress.tsx',
    importPath: './ui/progress'
},
  {
    id: 'ui-label',
    name: 'Label',
    category: 'ui',
    description: 'Enhanced label component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['required','error','color']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['label','text','indicator'],
      behavior: ['display','validation','state']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/label.tsx',
    importPath: './ui/label'
},
  {
    id: 'ui-toaster',
    name: 'Toaster',
    category: 'ui',
    description: 'Enhanced toaster component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onDismiss','position','duration']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['toaster','toast','position'],
      behavior: ['display','dismiss','animation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/toaster.tsx',
    importPath: './ui/toaster'
},
  {
    id: 'ui-accessibility',
    name: 'Accessibility',
    category: 'accessibility',
    description: 'Accessibility utilities component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['aria','focus','keyboard']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['accessibility','focus','indicators'],
      behavior: ['focus','keyboard','aria']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/accessibility.tsx',
    importPath: './ui/accessibility'
},
  {
    id: 'ui-animations',
    name: 'Animations',
    category: 'ui',
    description: 'Animation utilities component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['animation','duration','delay']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['animations','transitions','effects'],
      behavior: ['animation','transition','timing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/animations.tsx',
    importPath: './ui/animations'
},
  {
    id: 'ui-enhanced-loading',
    name: 'EnhancedLoading',
    category: 'ui',
    description: 'Enhanced loading component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['message','variant','size']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['loading','spinner','message'],
      behavior: ['loading','animation','indication']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/enhanced-loading.tsx',
    importPath: './ui/enhanced-loading'
},
  {
    id: 'ui-design-system',
    name: 'DesignSystem',
    category: 'ui',
    description: 'Design system component',
    profession: [''],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['components','tokens','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['system','tokens','components'],
      behavior: ['system','tokens','theming']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/design-system.tsx',
    importPath: './ui/design-system'
},
  {
    id: 'ui-responsive-design',
    name: 'ResponsiveDesign',
    category: 'ui',
    description: 'Responsive design utilities component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onBreakpoint','mobile','tablet','desktop']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['responsive','breakpoints','grid'],
      behavior: ['responsive','breakpoints','adaptation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/responsive-design.tsx',
    importPath: './ui/responsive-design'
},
  {
    id: 'memory-card-icon',
    name: 'MemoryCardIcon',
    category: 'ui',
    description: 'Memory card icon component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [],
      optional: ['size','color','status']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['icon','status','indicator'],
      behavior: ['display','status','indication']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/MemoryCardIcon.tsx',
    importPath: './ui/MemoryCardIcon'
},
  {
    id: 'story-arc-studio-logo',
    name: 'StoryArcStudioLogo',
    category: 'ui',
    description: 'Story Arc Studio logo component',
    profession: ['videographer','music_producer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [],
      optional: ['size','color','variant']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['logo','brand','variant'],
      behavior: ['display','brand','recognition']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ui/StoryArcStudioLogo.tsx',
    importPath: './ui/StoryArcStudioLogo'
},
  // NOTES DIRECTORY COMPONENTS - BATCH 1
  {
    id: 'note-editor',
    name: 'NoteEditor',
    category: 'content',
    description: 'Advanced note editor component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSave','readOnly','collaboration']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['editor','toolbar','sidebar'],
      behavior: ['editing','saving','collaboration']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/NoteEditor.tsx',
    importPath: './notes/NoteEditor'
},
  {
    id: 'creator-hub-notes',
    name: 'CreatorHubNotes',
    category: 'content',
    description: 'CreatorHub notes management system',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onNoteCreate','onNoteUpdate','categories']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['system','notes','management'],
      behavior: ['management','creation','organization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/CreatorHubNotes.tsx',
    importPath: './notes/CreatorHubNotes'
},
  {
    id: 'real-time-collaboration',
    name: 'RealTimeCollaboration',
    category: 'communication',
    description: 'Real-time collaboration system for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['users','onUpdate','permissions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['collaboration','users','cursors'],
      behavior: ['collaboration','real-time','synchronization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/RealTimeCollaboration.tsx',
    importPath: './notes/RealTimeCollaboration'
},
  {
    id: 'live-cursor-tracking',
    name: 'LiveCursorTracking',
    category: 'communication',
    description: 'Live cursor tracking for collaboration',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onCursorUpdate','userColors','animation']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['tracking','cursors','overlay'],
      behavior: ['tracking','animation','synchronization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/LiveCursorTracking.tsx',
    importPath: './notes/LiveCursorTracking'
},
  {
    id: 'mention-autocomplete',
    name: 'MentionAutocomplete',
    category: 'content',
    description: 'Mention autocomplete component for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onMention','trigger','position']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['autocomplete','mentions','dropdown'],
      behavior: ['autocomplete','mentions','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/MentionAutocomplete.tsx',
    importPath: './notes/MentionAutocomplete'
},
  {
    id: 'ai-content-analyzer',
    name: 'AIContentAnalyzer',
    category: 'ai',
    description: 'AI-powered content analysis for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyze','metrics','suggestions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['analyzer','metrics','suggestions'],
      behavior: ['analysis','ai','insights']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/AIContentAnalyzer.tsx',
    importPath: './notes/AIContentAnalyzer'
},
  {
    id: 'ai-learning-assistant',
    name: 'AILearningAssistant',
    category: 'ai',
    description: 'AI learning assistant for note-taking',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSuggest','learningData','personalization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['assistant','suggestions','learning'],
      behavior: ['learning','assistance','personalization']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/AILearningAssistant.tsx',
    importPath: './notes/AILearningAssistant'
},
  {
    id: 'smart-content-generator',
    name: 'SmartContentGenerator',
    category: 'ai',
    description: 'Smart content generation for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onGenerate','templates','style']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['generator','prompt','output'],
      behavior: ['generation','ai','content']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/SmartContentGenerator.tsx',
    importPath: './notes/SmartContentGenerator'
},
  {
    id: 'version-control',
    name: 'VersionControl',
    category: 'system',
    description: 'Version control system for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onVersion','history','branching']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['control','history','versions'],
      behavior: ['versioning','history','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/VersionControl.tsx',
    importPath: './notes/VersionControl'
},
  {
    id: 'analytics-dashboard',
    name: 'AnalyticsDashboard',
    category: 'admin',
    description: 'Analytics dashboard for notes usage',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['metrics','timeRange','onFilter']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','charts','metrics'],
      behavior: ['analytics','tracking','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/AnalyticsDashboard.tsx',
    importPath: './notes/AnalyticsDashboard'
},
  {
    id: 'performance-monitor',
    name: 'PerformanceMonitor',
    category: 'system',
    description: 'Performance monitoring for notes system',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAlert','thresholds','reporting']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['monitor','metrics','alerts'],
      behavior: ['monitoring','alerting','reporting']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/PerformanceMonitor.tsx',
    importPath: './notes/PerformanceMonitor'
},
  {
    id: 'theme-engine',
    name: 'ThemeEngine',
    category: 'ui',
    description: 'Theme engine for notes interface',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onThemeChange','customization','presets']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['engine','themes','customization'],
      behavior: ['theming','customization','presets']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/ThemeEngine.tsx',
    importPath: './notes/ThemeEngine'
},
  {
    id: 'responsive-layout',
    name: 'ResponsiveLayout',
    category: 'ui',
    description: 'Responsive layout system for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onBreakpoint','layouts','adaptive']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['responsive','breakpoints','adaptive'],
      behavior: ['responsive','adaptation','breakpoints']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/ResponsiveLayout.tsx',
    importPath: './notes/ResponsiveLayout'
},
  {
    id: 'mobile-navigation',
    name: 'MobileNavigation',
    category: 'ui',
    description: 'Mobile navigation for notes app',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onNavigate','active','collapsible']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['navigation','mobile','menu'],
      behavior: ['navigation','mobile','collapsible']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/MobileNavigation.tsx',
    importPath: './notes/MobileNavigation'
},
  {
    id: 'touch-gestures',
    name: 'TouchGestures',
    category: 'ui',
    description: 'Touch gesture support for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['gestures','onGesture','sensitivity']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['gestures','touch','interactions'],
      behavior: ['gestures','touch','interactions']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/TouchGestures.tsx',
    importPath: './notes/TouchGestures'
},
  {
    id: 'achievement-system',
    name: 'AchievementSystem',
    category: 'system',
    description: 'Achievement system for notes engagement',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAchievement','badges','progress']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['achievements','badges','progress'],
      behavior: ['achievements','badges','gamification']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/AchievementSystem.tsx',
    importPath: './notes/AchievementSystem'
},
  {
    id: 'reward-system',
    name: 'RewardSystem',
    category: 'system',
    description: 'Reward system for notes participation',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onReward','points','tiers']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['rewards','points','tiers'],
      behavior: ['rewards','points','gamification']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/RewardSystem.tsx',
    importPath: './notes/RewardSystem'
},
  {
    id: 'progress-tracking',
    name: 'ProgressTracking',
    category: 'system',
    description: 'Progress tracking for notes learning',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onProgress','goals','milestones']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['tracking','progress','milestones'],
      behavior: ['tracking','progress','goals']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/ProgressTracking.tsx',
    importPath: './notes/ProgressTracking'
},
  {
    id: 'user-behavior-tracker',
    name: 'UserBehaviorTracker',
    category: 'admin',
    description: 'User behavior tracking for notes analytics',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onTrack','analytics','privacy']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['tracker','analytics','events'],
      behavior: ['tracking','analytics','behavior']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/UserBehaviorTracker.tsx',
    importPath: './notes/UserBehaviorTracker'
},
  {
    id: 'data-encryption',
    name: 'DataEncryption',
    category: 'security',
    description: 'Data encryption system for notes security',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEncrypt','algorithm','keys']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['encryption','security','keys'],
      behavior: ['encryption','security','protection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/DataEncryption.tsx',
    importPath: './notes/DataEncryption'
},
  {
    id: 'privacy-controls',
    name: 'PrivacyControls',
    category: 'security',
    description: 'Privacy controls for notes system',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onUpdate','permissions','visibility']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['controls','privacy','settings'],
      behavior: ['privacy','controls','permissions']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/PrivacyControls.tsx',
    importPath: './notes/PrivacyControls'
},
  {
    id: 'access-control',
    name: 'AccessControl',
    category: 'security',
    description: 'Access control system for notes',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onUpdate','roles','policies']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['control','permissions','roles'],
      behavior: ['access','control','permissions']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/AccessControl.tsx',
    importPath: './notes/AccessControl'
},
  {
    id: 'animation-system',
    name: 'AnimationSystem',
    category: 'ui',
    description: 'Animation system for notes interface',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['animations','onAnimation','timing']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['animations','system','effects'],
      behavior: ['animations','effects','timing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/AnimationSystem.tsx',
    importPath: './notes/AnimationSystem'
},
  {
    id: 'visual-effects',
    name: 'VisualEffects',
    category: 'ui',
    description: 'Visual effects system for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['effects','onEffect','intensity']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['effects','visual','system'],
      behavior: ['effects','visual','enhancement']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/VisualEffects.tsx',
    importPath: './notes/VisualEffects'
},
  {
    id: 'table-of-contents',
    name: 'TableOfContents',
    category: 'content',
    description: 'Table of contents for notes navigation',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onNavigate','active','nested']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['contents','navigation','sections'],
      behavior: ['navigation','contents','sections']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/TableOfContents.tsx',
    importPath: './notes/TableOfContents'
},
  {
    id: 'interactive-diagram',
    name: 'InteractiveDiagram',
    category: 'content',
    description: 'Interactive diagram component for notes',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onInteract','editable','export']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['diagram','interactive','nodes'],
      behavior: ['interactive','diagram','editing']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/notes/InteractiveDiagram.tsx',
    importPath: './notes/InteractiveDiagram'
},
  // MATERIAL-UI DIRECTORY COMPONENTS
  {
    id: 'material-ui-showcase',
    name: 'MaterialUIShowcase',
    category: 'ui',
    description: 'Material-UI components showcase',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','category','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['showcase','components','preview'],
      behavior: ['showcase','preview','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialUIShowcase.tsx',
    importPath: './material-ui/MaterialUIShowcase'
},
  {
    id: 'material-button',
    name: 'MaterialButton',
    category: 'ui',
    description: 'Enhanced Material-UI button component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['variant','color','size','onClick']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['button','icon','text'],
      behavior: ['click','hover','disabled']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialButton.tsx',
    importPath: './material-ui/MaterialButton'
},
  {
    id: 'material-card',
    name: 'MaterialCard',
    category: 'ui',
    description: 'Enhanced Material-UI card component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['variant','elevation','onClick']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['card','content','actions'],
      behavior: ['display','interaction','elevation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialCard.tsx',
    importPath: './material-ui/MaterialCard'
},
  {
    id: 'material-input',
    name: 'MaterialInput',
    category: 'ui',
    description: 'Enhanced Material-UI input component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [],
      optional: ['value','onChange','placeholder','type']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['input','label','helper'],
      behavior: ['input','validation','focus']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialInput.tsx',
    importPath: './material-ui/MaterialInput'
},
  {
    id: 'material-form',
    name: 'MaterialForm',
    category: 'ui',
    description: 'Enhanced Material-UI form component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSubmit','validation','schema']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['form','fields','actions'],
      behavior: ['validation','submission','schema']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialForm.tsx',
    importPath: './material-ui/MaterialForm'
},
  {
    id: 'material-textarea',
    name: 'MaterialTextarea',
    category: 'ui',
    description: 'Enhanced Material-UI textarea component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [],
      optional: ['value','onChange','placeholder','rows']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['textarea','label','helper'],
      behavior: ['input','validation','resize']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialTextarea.tsx',
    importPath: './material-ui/MaterialTextarea'
},
  {
    id: 'material-badge',
    name: 'MaterialBadge',
    category: 'ui',
    description: 'Enhanced Material-UI badge component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['badgeContent','color','variant']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['badge','content','count'],
      behavior: ['display','notification','status']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/MaterialBadge.tsx',
    importPath: './material-ui/MaterialBadge'
},
  {
    id: 'advanced-card',
    name: 'AdvancedCard',
    category: 'ui',
    description: 'Advanced card component with enhanced features',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['header','footer','actions','elevation']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['card','header','content','footer'],
      behavior: ['display','interaction','expansion']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/AdvancedCard.tsx',
    importPath: './material-ui/AdvancedCard'
},
  {
    id: 'advanced-data-grid',
    name: 'AdvancedDataGrid',
    category: 'ui',
    description: 'Advanced data grid component with sorting and filtering',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@mui/x-data-grid'],
    props: {
      required: ['rows','columns'],
      optional: ['onRowClick','sorting','filtering']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','headers','rows'],
      behavior: ['sorting','filtering','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/AdvancedDataGrid.tsx',
    importPath: './material-ui/AdvancedDataGrid'
},
  {
    id: 'enhanced-table',
    name: 'EnhancedTable',
    category: 'ui',
    description: 'Enhanced table component with advanced features',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['columns','onSort','onFilter']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['table','headers','rows'],
      behavior: ['sorting','filtering','pagination']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/EnhancedTable.tsx',
    importPath: './material-ui/EnhancedTable'
},
  {
    id: 'animated-button',
    name: 'AnimatedButton',
    category: 'ui',
    description: 'Animated button component with Material-U',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['animation','onClick','disabled']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['button','animation','effects'],
      behavior: ['animation','click','hover']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/AnimatedButton.tsx',
    importPath: './material-ui/AnimatedButton'
},
  {
    id: 'floating-action-menu',
    name: 'FloatingActionMenu',
    category: 'ui',
    description: 'Floating action menu component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onAction','position','direction']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['menu','fab','actions'],
      behavior: ['floating','menu','actions']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/FloatingActionMenu.tsx',
    importPath: './material-ui/FloatingActionMenu'
},
  {
    id: 'accessibility-provider',
    name: 'AccessibilityProvider',
    category: 'accessibility',
    description: 'Accessibility provider for Material-UI components',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['settings','onSettingsChange']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['provider','accessibility','settings'],
      behavior: ['accessibility','provider','settings']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/AccessibilityProvider.tsx',
    importPath: './material-ui/AccessibilityProvider'
},
  {
    id: 'accessibility-toolbar',
    name: 'AccessibilityToolbar',
    category: 'accessibility',
    description: 'Accessibility toolbar for Material-UI interface',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onToolSelect','position','compact']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['toolbar','tools','controls'],
      behavior: ['accessibility','tools','controls']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/material-ui/AccessibilityToolbar.tsx',
    importPath: './material-ui/AccessibilityToolbar'
},
  // COMMON DIRECTORY COMPONENTS
  {
    id: 'gdpr-notice',
    name: 'GdprNotice',
    category: 'security',
    description: 'GDPR compliance notice component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onDecline','customizable','expiry']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['notice','modal','buttons'],
      behavior: ['compliance','acceptance','privacy']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/common/GdprNotice.tsx',
    importPath: './common/GdprNotice'
},
  {
    id: 'trial-activation-dialog',
    name: 'TrialActivationDialog',
    category: 'business',
    description: 'Trial activation dialog component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: ['open','onClose'],
      optional: ['onActivate','trialInfo','features']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dialog','trial','features'],
      behavior: ['activation','trial','features']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/common/TrialActivationDialog.tsx',
    importPath: './common/TrialActivationDialog'
},
  {
    id: 'trial-feature',
    name: 'TrialFeature',
    category: 'business',
    description: 'Trial feature component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onUpgrade','trialInfo','locked']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['feature','trial','upgrade'],
      behavior: ['trial','feature','upgrade']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/common/TrialFeature.tsx',
    importPath: './common/TrialFeature'
},
  {
    id: 'trial-feature-grid',
    name: 'TrialFeatureGrid',
    category: 'business',
    description: 'Trial feature grid component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onUpgrade','layout','columns']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','features','trial'],
      behavior: ['grid','features','upgrade']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/common/TrialFeatureGrid.tsx',
    importPath: './common/TrialFeatureGrid'
},
  {
    id: 'google-services-analytics-dashboard',
    name: 'GoogleServicesAnalyticsDashboard',
    category: 'admin',
    description: 'Google services analytics dashboard',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onRefresh','metrics','timeRange']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','analytics','metrics'],
      behavior: ['analytics','google','services']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/common/GoogleServicesAnalyticsDashboard.tsx',
    importPath: './common/GoogleServicesAnalyticsDashboard'
},
  // DASHBOARD DIRECTORY COMPONENTS
  {
    id: 'dashboard-widgets',
    name: 'DashboardWidgets',
    category: 'dashboard',
    description: 'Dashboard widgets container component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['layout','onReorder','customizable']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widgets','dashboard','grid'],
      behavior: ['widgets','dashboard','reorder']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/dashboard/DashboardWidgets.tsx',
    importPath: './dashboard/DashboardWidgets'
},
  {
    id: 'countdown-widget',
    name: 'CountdownWidget',
    category: 'dashboard',
    description: 'Countdown timer widget for dashboard',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onComplete','format','showUnits']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['countdown','timer','display'],
      behavior: ['countdown','timer','completion']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/dashboard/CountdownWidget.tsx',
    importPath: './dashboard/CountdownWidget'
},
  {
    id: 'comprehensive-gear-database',
    name: 'ComprehensiveGearDatabase',
    category: 'equipment',
    description: 'Comprehensive gear database component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onSearch','filters','categories']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['database','gear','search'],
      behavior: ['search','filter','database']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/dashboard/ComprehensiveGearDatabase.tsx',
    importPath: './dashboard/ComprehensiveGearDatabase'
},
  {
    id: 'universal-dashboard-calendar-integration',
    name: 'UniversalDashboardCalendarIntegration',
    category: 'calendar',
    description: 'Universal dashboard calendar integration',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEventClick','calendarView','integrations']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['calendar','integration','dashboard'],
      behavior: ['calendar','integration','events']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/dashboard/UniversalDashboardCalendarIntegration.tsx',
    importPath: './dashboard/UniversalDashboardCalendarIntegration'
},
  {
    id: 'upcoming-events-countdown-view',
    name: 'UpcomingEventsCountdownView',
    category: 'calendar',
    description: 'Upcoming events with countdown view',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEventClick','countdownFormat','showDetails']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['events','countdown','list'],
      behavior: ['events','countdown','navigation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/dashboard/UpcomingEventsCountdownView.tsx',
    importPath: './dashboard/UpcomingEventsCountdownView'
},
  // AI & CREATIVE TOOLS DIRECTORY COMPONENTS
  {
    id: 'creative-ai-protocols',
    name: 'CreativeAIProtocols',
    category: 'ai',
    description: 'Creative AI protocols component',
    profession: ['admin','photographer','videographer','music_producer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onExecute','customization','parameters']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['protocols','ai','creative'],
      behavior: ['ai','protocols','creative']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ai/CreativeAIProtocols.tsx',
    importPath: './ai/CreativeAIProtocols'
},
  {
    id: 'ai-photo-editor',
    name: 'AIPhotoEditor',
    category: 'ai',
    description: 'AI-powered photo editor component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEdit','filters','enhancement']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['editor','ai','photo'],
      behavior: ['editing','ai','enhancement']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ai-creative-tools/AIPhotoEditor.tsx',
    importPath: './ai-creative-tools/AIPhotoEditor'
},
  {
    id: 'contextual-ai-tooltip',
    name: 'ContextualAITooltip',
    category: 'ai',
    description: 'Contextual AI tooltip component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onInteract','context','suggestions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['tooltip','ai','contextual'],
      behavior: ['tooltip','ai','contextual']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ai-tooltips/ContextualAITooltip.tsx',
    importPath: './ai-tooltips/ContextualAITooltip'
},
  {
    id: 'ai-color-grading',
    name: 'AIColorGrading',
    category: 'ai',
    description: 'AI-powered color grading component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onGrading','presets','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grading','ai','color'],
      behavior: ['grading','ai','color']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AIColorGrading.tsx',
    importPath: './AIColorGrading'
},
  // VIDEO & MEDIA PRODUCTION COMPONENTS
  {
    id: 'video-editor',
    name: 'VideoEditor',
    category: 'video',
    description: 'Video editor component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEdit','tools','export']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['editor','video','timeline'],
      behavior: ['editing','video','timeline']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/VideoEditor.tsx',
    importPath: './VideoEditor'
},
  {
    id: 'video-gallery',
    name: 'VideoGallery',
    category: 'video',
    description: 'Video gallery component',
    profession: ['videographer','photographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','playback','filters']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['gallery','video','grid'],
      behavior: ['gallery','video','playback']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/VideoGallery.tsx',
    importPath: './VideoGallery'
},
  {
    id: 'elegant-video-player',
    name: 'ElegantVideoPlayer',
    category: 'video',
    description: 'Elegant video player component',
    profession: ['videographer','photographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['controls','autoplay','poster']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['player','video','controls'],
      behavior: ['playback','video','controls']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ElegantVideoPlayer.tsx',
    importPath: './ElegantVideoPlayer'
},
  {
    id: 'enhanced-timeline',
    name: 'EnhancedTimeline',
    category: 'video',
    description: 'Enhanced timeline component for video editing',
    profession: [''],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEdit','zoom','snapping']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['timeline','tracks','ruler'],
      behavior: ['timeline','editing','tracking']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/EnhancedTimeline.tsx',
    importPath: './EnhancedTimeline'
},
  {
    id: 'videographer-showcase',
    name: 'VideographerShowcase',
    category: 'showcase',
    description: 'Videographer showcase component',
    profession: [''],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','layout','filters']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['showcase','portfolio','grid'],
      behavior: ['showcase','portfolio','display']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/VideographerShowcase.tsx',
    importPath: './VideographerShowcase'
},
  // BUSINESS & CRM COMPONENTS
  {
    id: 'business-branding-settings',
    name: 'BusinessBrandingSettings',
    category: 'business',
    description: 'Business branding settings component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onUpdate','templates','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['settings','branding','business'],
      behavior: ['settings','branding','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessBrandingSettings.tsx',
    importPath: './BusinessBrandingSettings'
},
  {
    id: 'business-info-settings',
    name: 'BusinessInfoSettings',
    category: 'business',
    description: 'Business information settings component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onUpdate','validation','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['settings','info','business'],
      behavior: ['settings','info','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessInfoSettings.tsx',
    importPath: './BusinessInfoSettings'
},
  {
    id: 'business-intelligence-dashboard',
    name: 'BusinessIntelligenceDashboard',
    category: 'business',
    description: 'Business intelligence dashboard component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFilter','export','alerts']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','intelligence','business'],
      behavior: ['dashboard','intelligence','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessIntelligenceDashboard.tsx',
    importPath: './BusinessIntelligenceDashboard'
},
  {
    id: 'business-logo-upload',
    name: 'BusinessLogoUpload',
    category: 'business',
    description: 'Business logo upload component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['currentLogo','preview','validation']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['upload','logo','business'],
      behavior: ['upload','logo','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/BusinessLogoUpload.tsx',
    importPath: './BusinessLogoUpload'
},
  {
    id: 'company-profile-grid',
    name: 'CompanyProfileGrid',
    category: 'business',
    description: 'Company profile grid component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','filters','actions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['grid','profile','company'],
      behavior: ['grid','profile','company']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CompanyProfileGrid.tsx',
    importPath: './CompanyProfileGrid'
},
  {
    id: 'company-profile-quick-view',
    name: 'CompanyProfileQuickView',
    category: 'business',
    description: 'Company profile quick view component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEdit','actions','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['quickview','profile','company'],
      behavior: ['quickview','profile','company']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CompanyProfileQuickView.tsx',
    importPath: './CompanyProfileQuickView'
},
  {
    id: 'price-administration',
    name: 'PriceAdministration',
    category: 'business',
    description: 'Price administration component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onUpdate','tiers','discounts']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['administration','price','business'],
      behavior: ['administration','price','business']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/PriceAdministration.tsx',
    importPath: './PriceAdministration'
},
  // SYSTEM & INTEGRATION COMPONENTS
  {
    id: 'access-restricted',
    name: 'AccessRestricted',
    category: 'security',
    description: 'Access restricted component',
    profession: [''],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onRequest','message','actions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['restricted','access','security'],
      behavior: ['restricted','access','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/access-restricted.tsx',
    importPath: './access-restricted'
},
  {
    id: 'admin-prof-analysis',
    name: 'AdminProffAnalysis',
    category: 'admin',
    description: 'Admin professional analysis component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAnalyze','metrics','export']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['analysis','admin','professional'],
      behavior: ['analysis','admin','professional']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AdminProffAnalysis.tsx',
    importPath: './AdminProffAnalysis'
},
  {
    id: 'error-boundary',
    name: 'ErrorBoundary',
    category: 'system',
    description: 'Error boundary component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onError','fallback','reporting']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['boundary','error','system'],
      behavior: ['boundary','error','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ErrorBoundary.tsx',
    importPath: './ErrorBoundary'
},
  {
    id: 'system-messages-banner',
    name: 'SystemMessagesBanner',
    category: 'system',
    description: 'System messages banner component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onDismiss','autoHide','severity']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['banner','messages','system'],
      behavior: ['banner','messages','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/SystemMessagesBanner.tsx',
    importPath: './SystemMessagesBanner'
},
  {
    id: 'demo-mode-toggle',
    name: 'DemoModeToggle',
    category: 'system',
    description: 'Demo mode toggle component',
    profession: [''],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onToggle','message','warning']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['toggle','demo','mode'],
      behavior: ['toggle','demo','mode']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/DemoModeToggle.tsx',
    importPath: './DemoModeToggle'
},
  {
    id: 'google-oauth-setup',
    name: 'GoogleOAuthSetup',
    category: 'integration',
    description: 'Google OAuth setup component',
    profession: [''],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['config','validation','test']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['setup','oauth','google'],
      behavior: ['setup','oauth','google']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/GoogleOAuthSetup.tsx',
    importPath: './GoogleOAuthSetup'
},
  {
    id: 'code-generation-studio',
    name: 'CodeGenerationStudio',
    category: 'ai',
    description: 'Code generation studio component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onGenerate','customization','export']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['studio','code','generation'],
      behavior: ['studio','code','generation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CodeGenerationStudio.tsx',
    importPath: './CodeGenerationStudio'
},
  // PROJECT & WORKFLOW COMPONENTS
  {
    id: 'project-creation-wizard',
    name: 'ProjectCreationWizard',
    category: 'project',
    description: 'Project creation wizard component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['templates','validation','steps']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['wizard','project','creation'],
      behavior: ['wizard','project','creation']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ProjectCreationWizard.tsx',
    importPath: './ProjectCreationWizard'
},
  {
    id: 'project-file-manager',
    name: 'ProjectFileManager',
    category: 'project',
    description: 'Project file manager component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onUpload','onDelete','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['manager','file','project'],
      behavior: ['manager','file','project']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/project-file-manager.tsx',
    importPath: './project-file-manager'
},
  {
    id: 'professional-timeline',
    name: 'ProfessionalTimeline',
    category: 'project',
    description: 'Professional timeline component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEdit','onAdd','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['timeline','professional','events'],
      behavior: ['timeline','professional','events']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ProfessionalTimeline.tsx',
    importPath: './ProfessionalTimeline'
},
  {
    id: 'story-arc-generator',
    name: 'StoryArcGenerator',
    category: 'ai',
    description: 'Story arc generator component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onGenerate','templates','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['generator','story','arc'],
      behavior: ['generator','story','arc']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/StoryArcGenerator.tsx',
    importPath: './StoryArcGenerator'
},
  {
    id: 'story-arc-studio',
    name: 'StoryArcStudio',
    category: 'ai',
    description: 'Story arc studio component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onEdit','onSave','collaboration']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['studio','story','arc'],
      behavior: ['studio','story','arc']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/StoryArcStudio.tsx',
    importPath: './StoryArcStudio'
},
  {
    id: 'story-arc-auto-monitor',
    name: 'StoryArcAutoMonitor',
    category: 'ai',
    description: 'Story arc auto monitor component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onAlert','thresholds','reporting']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['monitor','story','auto'],
      behavior: ['monitor','story','auto']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/StoryArcAutoMonitor.tsx',
    importPath: './StoryArcAutoMonitor'
},
  {
    id: 'performance-analytics-dashboard',
    name: 'PerformanceAnalyticsDashboard',
    category: 'analytics',
    description: 'Performance analytics dashboard component',
    profession: [''],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['onFilter','export','alerts']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dashboard','analytics','performance'],
      behavior: ['dashboard','analytics','performance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/PerformanceAnalyticsDashboard.tsx',
    importPath: './PerformanceAnalyticsDashboard'
},
  // MISCELLANEOUS COMPONENTS
  {
    id: 'asset-browser',
    name: 'AssetBrowser',
    category: 'file',
    description: 'Asset browser component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','filters','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['browser','asset','file'],
      behavior: ['browser','asset','file']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/AssetBrowser.tsx',
    importPath: './AssetBrowser'
},
  {
    id: 'export-dialog',
    name: 'ExportDialog',
    category: 'modal',
    description: 'Export dialog component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['content','formats','settings']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dialog','export','modal'],
      behavior: ['dialog','export','modal']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExportDialog.tsx',
    importPath: './ExportDialog'
},
  {
    id: 'extra-image-pricing-dialog',
    name: 'ExtraImagePricingDialog',
    category: 'modal',
    description: 'Extra image pricing dialog component',
    profession: ['photographer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['images','rates','calculation']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dialog','pricing','image'],
      behavior: ['dialog','pricing','image']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ExtraImagePricingDialog.tsx',
    importPath: './ExtraImagePricingDialog'
},
  {
    id: 'invite-request-form',
    name: 'InviteRequestForm',
    category: 'form',
    description: 'Invite request form component',
    profession: ['admin','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['validation','fields','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['form','invite','request'],
      behavior: ['form','invite','request']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/InviteRequestForm.tsx',
    importPath: './InviteRequestForm'
},
  {
    id: 'memory-card-manager',
    name: 'MemoryCardManager',
    category: 'equipment',
    description: 'Memory card manager component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onManage','backup','status']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['manager','memory','card'],
      behavior: ['manager','memory','card']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/MemoryCardManager.tsx',
    importPath: './MemoryCardManager'
},
  {
    id: 'file-detection-dashboard-widget',
    name: 'FileDetectionDashboardWidget',
    category: 'dashboard',
    description: 'File detection dashboard widget component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onDetect','alerts','monitoring']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widget','detection','file'],
      behavior: ['widget','detection','file']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/FileDetectionDashboardWidget.tsx',
    importPath: './FileDetectionDashboardWidget'
},
  {
    id: 'recent-uploads-widget',
    name: 'RecentUploadsWidget',
    category: 'dashboard',
    description: 'Recent uploads widget component',
    profession: ['photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','preview','actions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['widget','uploads','recent'],
      behavior: ['widget','uploads','recent']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/RecentUploadsWidget.tsx',
    importPath: './RecentUploadsWidget'
},
  {
    id: 'gear-news-feed',
    name: 'GearNewsFeed',
    category: 'content',
    description: 'Gear news feed component',
    profession: ['photographer','videographer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onSelect','filters','categories']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['feed','news','gear'],
      behavior: ['feed','news','gear']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/GearNewsFeed.tsx',
    importPath: './GearNewsFeed'
},
  {
    id: 'pexels-video-search',
    name: 'PexelsVideoSearch',
    category: 'content',
    description: 'Pexels video search component',
    profession: ['videographer','photographer'],
    dependencies: ['@mui/material','@tanstack/react-query'],
    props: {
      required: [''],
      optional: ['query','filters','results']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['search','video','pexels'],
      behavior: ['search','video','pexels']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/PexelsVideoSearch.tsx',
    importPath: './PexelsVideoSearch'
},
  // WEDDING & SPECIALIZED COMPONENTS
  {
    id: 'wedding-timeline',
    name: 'WeddingTimeline',
    category: 'calendar',
    description: 'Wedding timeline component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEdit','customization','timing']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['timeline','wedding','events'],
      behavior: ['timeline','wedding','events']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-timeline.tsx',
    importPath: './wedding-timeline'
},
  {
    id: 'wedding-timeline-client-view',
    name: 'WeddingTimelineClientView',
    category: 'calendar',
    description: 'Wedding timeline client view component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onInteract','customization','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['view','wedding','client'],
      behavior: ['view','wedding','client']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-timeline-client-view.tsx',
    importPath: './wedding-timeline-client-view'
},
  {
    id: 'wedding-code-entry',
    name: 'WeddingCodeEntry',
    category: 'form',
    description: 'Wedding code entry component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['validation','preview','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['entry','wedding','code'],
      behavior: ['entry','wedding','code']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/wedding-code-entry.tsx',
    importPath: './wedding-code-entry'
},
  {
    id: 'two-factor-setup',
    name: 'TwoFactorSetup',
    category: 'security',
    description: 'Two factor authentication setup component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['validation','preview','backup']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['setup','twofactor','security'],
      behavior: ['setup','twofactor','security']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/TwoFactorSetup.tsx',
    importPath: './TwoFactorSetup'
},
  {
    id: 'terms-acceptance-dialog',
    name: 'TermsAcceptanceDialog',
    category: 'modal',
    description: 'Terms acceptance dialog component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['terms','version','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['dialog','terms','acceptance'],
      behavior: ['dialog','terms','acceptance']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/TermsAcceptanceDialog.tsx',
    importPath: './TermsAcceptanceDialog'
},
  {
    id: 'troubleshooting-link',
    name: 'TroubleshootingLink',
    category: 'system',
    description: 'Troubleshooting link component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onClick','resources','preview']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['link','troubleshooting','system'],
      behavior: ['link','troubleshooting','system']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/TroubleshootingLink.tsx',
    importPath: './TroubleshootingLink'
},
  {
    id: 'image-selection-warning',
    name: 'ImageSelectionWarning',
    category: 'ui',
    description: 'Image selection warning component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onDismiss','warning','actions']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['warning','image','selection'],
      behavior: ['warning','image','selection']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/ImageSelectionWarning.tsx',
    importPath: './ImageSelectionWarning'
},
  {
    id: 'inspector-panel',
    name: 'InspectorPanel',
    category: 'ui',
    description: 'Inspector panel component',
    profession: ['admin','photographer','videographer','music_producer','vendor'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEdit','properties','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['panel','inspector','properties'],
      behavior: ['panel','inspector','properties']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/InspectorPanel.tsx',
    importPath: './InspectorPanel'
},
  {
    id: 'composition-overlay',
    name: 'CompositionOverlay',
    category: 'ui',
    description: 'Composition overlay component',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material', ],
    props: {
      required: [''],
      optional: ['onEdit','preview','customization']
  },
    customization: {
      styles: ['layout','colors','spacing'],
      layout: ['overlay','composition','ui'],
      behavior: ['overlay','composition','ui']
  },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/CompositionOverlay.tsx',
    importPath: './CompositionOverlay'
},
  // CALENDAR CONFLICT CHECKER
  {
    id: 'calendar-conflict-checker',
    name: 'CalendarConflictChecker',
    category: 'calendar',
    description: 'Calendar conflict checker component for project scheduling',
    profession: ['photographer','videographer'],
    dependencies: ['@mui/material','@/hooks/useAutosave'],
    props: {
      required: ['draftData','open','onClose','onConfirm'],
      optional: ['conflictCheck','isChecking','selectedOption']
  },
  customization: {
    styles: ['layout','colors','spacing'],
    layout: ['dialog','conflict','calendar'],
    behavior: ['conflict','calendar','resolution']
},
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
},
    filePath: 'client/src/components/calendar/CalendarConflictChecker.tsx',
    importPath: '../calendar/CalendarConflictChecker'
},

  // ============================================
  // LANDING PAGES - Public-facing pages
  // ============================================
  {
    id: 'landing-desktop',
    name: 'LandingDesktop',
    category: 'landing',
    description: 'Main desktop landing page for CreatorHub Norge',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query', 'wouter'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'backgrounds'],
      layout: ['hero', 'features', 'bento-grid', 'cta', 'footer'],
      behavior: ['navigation', 'animations', 'micro-interactions']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/landing-desktop.tsx',
    importPath: '../pages/landing-desktop'
  },
  {
    id: 'landing-mobile',
    name: 'LandingMobile',
    category: 'landing',
    description: 'Mobile-optimized landing page for CreatorHub Norge',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query', 'wouter'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'backgrounds'],
      layout: ['hero', 'features', 'cta', 'footer'],
      behavior: ['navigation', 'animations', 'touch-interactions']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/landing-mobile.tsx',
    importPath: '../pages/landing-mobile'
  },

  // ============================================
  // ACADEMY PAGES
  // ============================================
  {
    id: 'academy-landing',
    name: 'AcademyLandingPage',
    category: 'academy',
    description: 'Academy landing page with courses, pricing, and testimonials',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query', 'wouter'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'glassmorphism'],
      layout: ['hero', 'features', 'courses', 'pricing', 'testimonials', 'faq', 'footer'],
      behavior: ['navigation', 'animations', 'video-preview']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/components/academy/AcademyLandingPage.tsx',
    importPath: '../components/academy/AcademyLandingPage'
  },

  // ============================================
  // COMMUNITY PAGES
  // ============================================
  {
    id: 'community-landing',
    name: 'CommunityLandingPage',
    category: 'community',
    description: 'Community landing page with dark theme and orange accents',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query', 'wouter'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'grid-patterns'],
      layout: ['hero', 'split-layout', 'cta', 'features'],
      behavior: ['navigation', 'animations']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/components/community/CommunityLandingPage.tsx',
    importPath: '../components/community/CommunityLandingPage'
  },

  // ============================================
  // COMPANY PAGES
  // ============================================
  {
    id: 'about',
    name: 'AboutPage',
    category: 'company',
    description: 'About Us page with team information and company mission',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query', 'wouter'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'dark-theme'],
      layout: ['hero', 'team', 'mission', 'professions', 'footer'],
      behavior: ['navigation', 'animations']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/about.tsx',
    importPath: '../pages/about'
  },

  // ============================================
  // LEGAL PAGES
  // ============================================
  {
    id: 'privacy-policy',
    name: 'PrivacyPolicyPage',
    category: 'legal',
    description: 'Privacy policy page with GDPR compliance information',
    profession: ['admin'],
    dependencies: ['@mui/material'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing'],
      layout: ['header', 'content', 'sections', 'footer'],
      behavior: ['navigation', 'scroll']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/privacy-policy.tsx',
    importPath: '../pages/privacy-policy'
  },
  {
    id: 'terms-and-conditions',
    name: 'TermsAndConditionsPage',
    category: 'legal',
    description: 'Terms and conditions page',
    profession: ['admin'],
    dependencies: ['@mui/material'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing'],
      layout: ['header', 'content', 'sections', 'footer'],
      behavior: ['navigation', 'scroll']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/terms-and-conditions.tsx',
    importPath: '../pages/terms-and-conditions'
  },
  {
    id: 'data-deletion',
    name: 'DataDeletionPage',
    category: 'legal',
    description: 'Data deletion request page for GDPR compliance',
    profession: ['admin'],
    dependencies: ['@mui/material'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing'],
      layout: ['header', 'form', 'content', 'footer'],
      behavior: ['navigation', 'form-validation']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/data-deletion.tsx',
    importPath: '../pages/data-deletion'
  },

  // ============================================
  // SHOWCASE PAGES
  // ============================================
  {
    id: 'music-showcase',
    name: 'MusicShowcasePage',
    category: 'showcase',
    description: 'Music producer showcase page for portfolio display',
    profession: ['admin', 'music_producer'],
    dependencies: ['@mui/material', '@tanstack/react-query'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave', 'producerId']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'audio-player'],
      layout: ['hero', 'tracks', 'albums', 'bio', 'contact'],
      behavior: ['audio-playback', 'navigation', 'animations']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/music-showcase.tsx',
    importPath: '../pages/music-showcase'
  },
  {
    id: 'vendor-showcase',
    name: 'UniversalVendorShowcasePage',
    category: 'showcase',
    description: 'Universal vendor showcase page for products and services',
    profession: ['admin', 'vendor'],
    dependencies: ['@mui/material', '@tanstack/react-query'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave', 'vendorId']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'product-cards'],
      layout: ['hero', 'products', 'services', 'reviews', 'contact'],
      behavior: ['product-gallery', 'navigation', 'animations']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/UniversalVendorShowcasePage.tsx',
    importPath: '../pages/UniversalVendorShowcasePage'
  },

  // ============================================
  // PRICING PAGES
  // ============================================
  {
    id: 'pricing-page',
    name: 'PricingPage',
    category: 'pricing',
    description: 'Pricing page with subscription plans and features',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'pricing-cards'],
      layout: ['hero', 'plans', 'features', 'faq', 'cta'],
      behavior: ['plan-selection', 'navigation', 'animations']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/PricingPage.tsx',
    importPath: '../pages/PricingPage'
  },
  {
    id: 'subscription-selection',
    name: 'SubscriptionSelectionPage',
    category: 'pricing',
    description: 'Subscription selection and checkout page',
    profession: ['admin'],
    dependencies: ['@mui/material', '@tanstack/react-query', 'stripe'],
    props: {
      required: [],
      optional: ['customizations', 'isEditing', 'onSave', 'preselectedPlan']
    },
    customization: {
      styles: ['colors', 'typography', 'spacing', 'checkout-form'],
      layout: ['plan-details', 'payment-form', 'summary'],
      behavior: ['checkout', 'validation', 'payment-processing']
    },
    visualEditor: {
      editable: true,
      previewable: true,
      templateable: true,
      propsEditable: true
    },
    filePath: 'client/src/pages/SubscriptionSelectionPage.tsx',
    importPath: '../pages/SubscriptionSelectionPage'
  }
];

// Helper functions for component management
export const getComponentsByCategory = (category: ComponentMetadata['category']) => {
  return UNIVERSAL_DASHBOARD_COMPONENTS.filter(component => component.category === category);
};

export const getComponentsByProfession = (profession: ComponentMetadata['profession'][0]) => {
  return UNIVERSAL_DASHBOARD_COMPONENTS.filter(component => 
    component.profession.includes(profession)
  );
};

export const getEditableComponents = () => {
  return UNIVERSAL_DASHBOARD_COMPONENTS.filter(component => 
    component.visualEditor.editable
  );
};

export const getComponentById = (id: string) => {
  return UNIVERSAL_DASHBOARD_COMPONENTS.find(component => component.id === id);
};

export const getComponentsByTabIndex = (tabIndex: number) => {
  return UNIVERSAL_DASHBOARD_COMPONENTS.filter(component => component.tabIndex === tabIndex);
};
