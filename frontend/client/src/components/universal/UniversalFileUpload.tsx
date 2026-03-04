/**
 * Universal File Upload Component
 * Supports all camera formats from database across all upload areas
 * Used throughout CreatorHub Norge for consistent file format support
 */

import React, { useState, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useFileManagementStatus } from '../../contexts/FileManagementStatusContext';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Divider,
  Badge,
  Card,
  CardContent,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  PhotoCamera as CameraIcon,
  Delete as DeleteIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Info as InfoIcon,
  QueueMusic as QueueIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { 
  validateFiles, 
  getFileAcceptAttribute, 
  getSupportedExtensions,
  universalFileFormatSupport
} from '../../utils/UniversalFileFormatSupport';
import backgroundUploadService from '../../services/BackgroundUploadService';
import { useUploadQueue } from '../../hooks/useUploadQueue';
import { usePhotoEnhancementWebSocket } from '../../hooks/usePhotoEnhancementWebSocket';
import type { ProcessingOptions as BatchProcessingOptions } from '@shared/photo-enhancement-contracts';
import GoogleWorkspaceStorageInfo from './GoogleWorkspaceStorageInfo';

interface UniversalFileUploadProps {
  // BEGIN-ACADEMY-UPLOAD-EXT
  // BEGIN-ACADEMY-UPLOAD-EXT
  /** Optional: allow all types as union, incl. "all" for Academy */
  allowedTypes?: "all" | "images" | "videos" | string;
  /** Max files */
  maxFiles?: number;
  /** Callback when user selects local files */
  onFilesSelected?: (files: File[]) => void;
  /** Shown by Academy UIs */
  showFormatInfo?: boolean;
  /** NEW: enable Google Drive sync toggle in Academy */
  enableGoogleDriveSync?: boolean;
  /** NEW: profession tag propagated by Academy (non-breaking) */
  profession?: string;
  /** NEW: show storage line in Academy */
  showStorageInfo?: boolean;
  // END-ACADEMY-UPLOAD-EXT
  /** Optional: allow all types as union, incl. "all" for Academy */
  allowedTypes?: "all" | "images" | "videos" | string;
  /** Max files */
  maxFiles?: number;
  /** Callback when user selects local files */
  onFilesSelected?: (files: File[]) => void;
  /** Shown by Academy UIs */
  showFormatInfo?: boolean;
  /** NEW: enable Google Drive sync toggle in Academy */
  enableGoogleDriveSync?: boolean;
  /** NEW: profession tag propagated by Academy (non-breaking) */
  profession?: string;
  /** NEW: show storage line in Academy */
  showStorageInfo?: boolean;
  // END-ACADEMY-UPLOAD-EXT
  onFilesSelected?: (files: File[]) => void;
  onUploadComplete?: (results?: any[]) => void;
  onUploadError?: (error: string, file?: File) => void;
  maxFiles?: number;
  maxFileSizeMB?: number;
  allowedTypes?: 'images' | 'videos' | 'audio' | 'documents' | 'design' | 'archives' | '3d' | 'all';
  showFormatInfo?: boolean;
  showFeatureMeta?: boolean;
  uploadEndpoint?: string;
  additionalMetadata?: Record<string, any>;
  className?: string;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  enableBackgroundUpload?: boolean; // NEW: Enable background upload
  maxRetries?: number; // NEW: Max retry attempts
  // Enhanced queue management props
  enableAdvancedQueue?: boolean;
  showStorageInfo?: boolean;
  userId?: string;
  projectId?: string;
  enhancementType?: 'basic' | 'advanced' | 'professional';
  queuePriority?: 'low' | 'normal' | 'high';
  showQueueStatus?: boolean;
  // Google Drive integration props
  enableGoogleDriveSync?: boolean;
  onGoogleDriveSync?: (items: any[]) => void;
  googleDriveFolderId?: string;
  integrationContext?: any;
  onItemSelect?: (item: any) => void;
  onItemUpdate?: (item: any) => void;
  onItemDelete?: (item: any) => void;
  enableRealTimeSync?: boolean;
  collaborationSessionId?: string;
  enableAIAnalysis?: boolean;
  enableAutoTagging?: boolean;
  enableSmartCollections?: boolean;
  enableMultipleFiles?: boolean;
  enableDragDrop?: boolean;
  // Integration props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export const UniversalFileUpload: React.FC<UniversalFileUploadProps> = ({
  onFilesSelected,
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  maxFileSizeMB = 100,
  allowedTypes = 'all',
  showFormatInfo = true,
  showFeatureMeta = true,
  uploadEndpoint = '/api/upload',
  additionalMetadata = {},
  className = '',
  profession = 'photographer',
  enableBackgroundUpload = true, // NEW: Default to true
  maxRetries = 3, // NEW: Default 3 retries
  // Enhanced queue management props with defaults
  enableAdvancedQueue = true,
  showStorageInfo = true,
  userId = 'current-user',
  projectId,
  enhancementType = 'basic',
  queuePriority = 'normal',
  showQueueStatus = true,
  // Google Drive integration props
  enableGoogleDriveSync = false,
  onGoogleDriveSync,
  googleDriveFolderId,
  integrationContext,
  onItemSelect,
  onItemUpdate,
  onItemDelete,
  enableRealTimeSync = false,
  collaborationSessionId,
  enableAIAnalysis = false,
  enableAutoTagging = false,
  enableSmartCollections = false,
  enableMultipleFiles = true,
  enableDragDrop = true,
  // Integration props
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id || user?.email || 'current-user';
  const normalizedEffectiveUserId = String(effectiveUserId || 'guest').trim().replace(/,+$/, '') || 'guest';
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [validationErrors, setValidationErrors] = useState<Array<{ file: File; reason: string }>>([]);
  const [showSupportedFormats, setShowSupportedFormats] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, auth, features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Comprehensive Feature System for Universal File Upload
  const universalFileUploadAccess = features.checkFeatureAccess('universal-file-upload');
  const fileUploadAccess = features.checkFeatureAccess('file-upload');
  const backgroundUploadAccess = features.checkFeatureAccess('background-upload');
  const googleDriveUploadAccess = features.checkFeatureAccess('google-drive-upload');
  const uploadQueueAccess = features.checkFeatureAccess('upload-queue');
  const uploadProgressAccess = features.checkFeatureAccess('upload-progress');
  const uploadAnalyticsAccess = features.checkFeatureAccess('upload-analytics');
  const uploadSchedulingAccess = features.checkFeatureAccess('upload-scheduling');

  // File Management Status
  const { status: fileManagementStatus } = useFileManagementStatus();

  // Enhanced upload queue management - Reduced for memory optimization
  const uploadQueue = useUploadQueue({
    maxConcurrentUploads: 2, // Reduced from 3 to 2 for memory optimization
    maxRetries,
    rateLimitDelay: 200, // Increased delay for memory management
    chunkSize: 2 * 1024 * 1024, // Reduced from 5MB to 2MB chunks
  });

  // WebSocket for real-time updates
  const { 
    connectionState, 
    isConnected 
} = usePhotoEnhancementWebSocket({ userId: normalizedEffectiveUserId });

  const { data: fileManagementStats = {}, isLoading: isFileStatsLoading } = useQuery({
    queryKey: ['/api/file-management/stats', normalizedEffectiveUserId],
    queryFn: () => apiRequest('/api/file-management/stats'),
    retry: false,
    refetchInterval: 20000
  });

  // Queue statistics
  const queueStats = uploadQueue.getQueueStats();

  // Google Drive integration state
  const [googleDriveSyncStatus, setGoogleDriveSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [googleDriveItems, setGoogleDriveItems] = useState<any[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);

  React.useEffect(() => {
    const percent = Number(
      fileManagementStats?.storageUsedPercent ??
      fileManagementStats?.storagePercent ??
      fileManagementStats?.usedPercent ??
      0
    );
    if (Number.isFinite(percent) && percent >= 90) {
      setStorageWarning(`Lagring er ${percent.toFixed(0)}% brukt`);
    } else if (storageWarning) {
      setStorageWarning(null);
    }
  }, [fileManagementStats, storageWarning]);

  // Google Drive Integration - Sync Function with Comprehensive Folder Structure
  const syncToGoogleDrive = React.useCallback(async () => {
    if (!enableGoogleDriveSync) return;

    setGoogleDriveSyncStatus('syncing');
    setSyncProgress(0);

    try {
      // Use unified auth header from Enhanced Master Integration (Google Drive scopes configured server-side)
      const authHeader = await auth.getAuthHeader();

      // Get current upload items
      const uploadItems = integration.getData(`universal-file-upload-${effectiveUserId}:items`) || [];

      // Get current project context from UniversalDashboard
      const currentProject = integration.getData(`universal-dashboard-${userId}:selectedProject`);
      
      // Sync to Google Drive with comprehensive folder structure
      const response = await fetch('/api/google-drive/sync-uploads-to-project-folders', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','Authorization': authHeader.Authorization,
      },
        body: JSON.stringify({
          items: uploadItems,
          profession,
          userId: effectiveUserId,
          projectId: currentProject?.id,
          projectName: currentProject?.title || currentProject?.name,
          clientName: currentProject?.clientName,
          // Comprehensive 180+ folder structure covering all CreatorHub Norge components
          folderStructure: {
            // CORE 8-FOLDER STRUCTURE (Foundation)
            '01_Raw':'Raw files and original content','02_Edited':'Edited and processed files','03_Proofing':'Client proofing and selection files','04_Deliverables':'Final deliverables for client','05_Archive':'Archived and backup files','06_Client_Communication':'Client communication and feedback','07_Project_Documents':'Contracts, invoices, and project docs','08_Showcase' : 'Showcase and portfolio files',
            
            // STORY ARC STUDIO (9-16)
            '09_Raw_Footage':'Original video recordings for story arcs','10_Edited_Files':'Processed video content','11_Client_Review':'Client review and approval files','12_Final_Delivery':'Final story arc deliverables','13_Scripts_Notes':'Video scripts and project notes','14_Moodboards_Inspiration':'Visual inspiration and moodboards','15_Contracts_Documents':'Story arc contracts and docs','16_Communication' : 'Client communication for story arcs',
            
            // DAVINCI RESOLVE INTEGRATION (17-24)
            '17_Resolve_Projects':'DaVinci Resolve project files','18_Resolve_Timelines':'Timeline configurations','19_Resolve_Clips':'Video clip assets','20_Resolve_Transitions':'Transition effects','21_Resolve_Color_Grading':'Color correction files','22_Resolve_Audio_Mix':'Audio mixing projects','23_Resolve_Graphics':'Motion graphics assets','24_Resolve_Exports' : 'Final export files',
            
            // VIDEO PRODUCTION (25-40)
            '25_Video_Projects':'Video production projects','26_Raw_Footage':'Original video recordings','27_Edited_Videos':'Processed video content','28_Color_Grading':'Color correction files','29_Audio_Mix':'Audio mixing and sound design','30_Graphics_Assets':'Motion graphics and overlays','31_Shot_Lists':'Video shot planning','32_Storyboards':'Visual storyboards','33_Equipment_Logs':'Video equipment tracking','34_Client_Reviews':'Video review and feedback','35_Drone_Footage':'Aerial video content','36_Time_Lapse':'Time-lapse sequences','37_Slow_Motion':'Slow-motion footage','38_Green_Screen':'Chroma key footage','39_Interview_Footage':'Interview recordings','40_B_Roll' : 'B-roll footage',
            
            // MUSIC PRODUCTION (41-60)
            '41_Music_Projects':'Music production projects','42_Audio_Samples':'Sample libraries and loops','43_Mastering':'Final mastered tracks','44_Contracts_Music':'Music-specific contracts','45_Session_Notes':'Recording session notes','46_Stems':'Individual track stems','47_Mix_Down':'Mix down versions','48_Reference_Tracks':'Reference music','49_Equipment_Setup':'Music equipment configs','50_Collaboration':'Artist collaboration files','51_VST_Plugins':'Virtual instruments','52_Audio_Effects':'Audio processing effects','53_MIDI_Files':'MIDI sequences','54_Tempo_Maps':'Tempo and timing','55_Vocal_Recordings':'Vocal tracks','56_Instrument_Recordings':'Instrument tracks','57_Backing_Tracks':'Backing music','58_Live_Recordings':'Live performance recordings','59_Studio_Sessions':'Studio session files','60_Music_Licensing' : 'Licensing agreements',
            
            // PHOTOGRAPHY-SPECIFIC (61-80)
            '61_Photo_Enhancement':'AI-enhanced photos','62_Composition_Analysis':'AI composition analysis','63_Moodboards':'Visual moodboards and inspiration','64_Equipment_Checklists':'Equipment management','65_Client_Galleries':'Wedding, Portrait, Commercial galleries','66_Editing_Presets':'Lightroom presets and templates','67_Location_Scouting':'Location photos and notes','68_Posing_References':'Posing guides and references','69_Color_Palettes':'Color schemes and palettes','70_Wedding_Timeline':'Wedding planning timelines','71_Engagement_Sessions':'Pre-wedding photography','72_Newborn_Sessions':'Newborn photography','73_Family_Sessions':'Family photography','74_Event_Coverage':'Event photography','75_Commercial_Shoots':'Commercial photography','76_Product_Photography':'Product shots','77_Headshots':'Professional headshots','78_Real_Estate':'Real estate photography','79_Food_Photography':'Food and restaurant shots','80_Street_Photography' : 'Street and documentary',
            
            // VENDOR/PRODUCT (81-100)
            '81_Product_Assets':'Product images and materials','82_Marketing_Materials':'Promotional content','83_Technical_Docs':'Technical documentation','84_Customer_Support':'Support materials and FAQs','85_Release_Notes':'Product release documentation','86_User_Guides':'User manuals and guides','87_Testing_Reports':'Quality assurance reports','88_Deployment':'Deployment configurations','89_Feedback_Collection':'Customer feedback','90_Product_Updates':'Update files and patches','91_Plugin_Builds':'Plugin builds and versions','92_VST_Files':'VST plugin files','93_AU_Files':'Audio Unit files','94_AAX_Files':'AAX plugin files','95_WAV_Samples':'WAV sample files','96_MIDI_Files':'MIDI files','97_Installation_Files':'Installation packages','98_License_Documents':'License agreements','99_Warranty_Info':'Warranty information','100_Receipts' : 'Purchase receipts',
            
            // BUSINESS ADMINISTRATION (101-120)
            '101_Financial_Records':'Invoicing and payments','102_Business_Analytics':'Business performance data','103_Lead_Management':'Lead tracking and CRM','104_Marketing_Campaigns':'Marketing materials','105_Client_Relations':'Client relationship management','106_Project_Timelines':'Project scheduling','107_Budget_Tracking':'Financial planning','108_Expense_Reports':'Expense documentation','109_Tax_Documents':'Tax-related files','110_Legal_Documents':'Legal compliance files','111_Contracts_General':'General contracts','112_Invoices':'Invoice documents','113_Time_Tracking':'Time registration','114_Meeting_Notes':'Meeting documentation','115_Project_Plans':'Project planning documents','116_Client_Profiles':'Client information','117_Proposals':'Project proposals','118_Quotes':'Price quotes','119_Agreements':'Service agreements','120_Policies' : 'Company policies',
            
            // UNIVERSAL COMPONENTS (121-140)
            '121_File_Uploads':'Universal file upload temp files','122_Downloads_Queue':'Download queue and batch processing','123_AI_Analysis':'AI analysis results and metadata','124_Real_Time_Collaboration':'Real-time collaboration files','125_System_Logs':'System integration logs','126_Error_Reports':'Error tracking and debugging','127_Performance_Metrics':'Performance monitoring data','128_User_Preferences':'User settings and preferences','129_Notification_History':'Notification logs','130_Session_Data':'User session information','131_Showcase_Categories':'Showcase category mappings','132_Showcase_Grids':'Grid layouts and display settings','133_Showcase_Thumbnails':'Generated thumbnails','134_Photo_Enhancement':'AI-enhanced photos','135_Composition_Analysis':'AI composition analysis','136_Moodboards':'Visual moodboards and inspiration','137_Equipment_Checklists':'Equipment management','138_Client_Galleries':'Wedding, Portrait, Commercial galleries','139_Editing_Presets':'Lightroom presets and templates','140_Location_Scouting' : 'Location photos and notes',
            
            // SYSTEM & BACKUP (141-160)
            '141_System_Backup':'System backup files','142_Memory_Card_Backup':'Memory card backups','143_Auto_Backup':'Automatic backup files','144_Disaster_Recovery':'Disaster recovery files','145_System_Updates':'System update files','146_Security_Logs':'Security monitoring','147_Access_Control':'Permission management','148_Data_Retention':'Data retention policies','149_Compliance_Reports':'GDPR compliance','150_Audit_Trails':'System audit logs','151_Backup_Verification':'Backup verification files','152_System_Health':'System health monitoring','153_Performance_Logs':'Performance monitoring','154_Error_Logs':'Error tracking','155_Access_Logs':'Access logging','156_Integration_Logs':'Integration monitoring','157_Backup_Schedules':'Backup scheduling','158_Recovery_Plans':'Recovery procedures','159_System_Configs':'System configurations','160_Monitoring_Dashboards' : 'Monitoring data',
            
            // ACADEMY & EDUCATION (161-170)
            '161_Photography_Courses':'Photography education','162_Videography_Courses':'Videography education','163_Music_Production_Courses':'Music production education','164_Tutorial_Content':'Tutorial materials','165_FAQ_Database':'Frequently asked questions','166_Help_Desk':'Support ticket system','167_Feature_Requests':'Feature request tracking','168_Bug_Reports':'Bug tracking and fixes','169_User_Feedback':'User feedback collection','170_Knowledge_Base' : 'Knowledge management',
            
                      // ADVANCED FEATURES (171-180)
                      '171_AI_Workflows':'AI automation workflows','172_Magic_Creator':'Magic Creator generated features','173_Smart_Notes':'Smart notes system','174_Google_Docs_Sync':'Google Docs integration','175_Cross_Platform_Sync':'Cross-platform synchronization','176_Real_Time_Updates':'Real-time data updates','177_Platform_Extensions':'Platform extensions','178_System_Integrations':'System integration files','179_User_Activity':'User activity tracking','180_Platform_Health' : 'Platform health monitoring',
                      
                      // GOOGLE PEOPLE & CONTACTS (181-190)
                      '181_Google_Contacts':'Google People API contacts','182_Contact_Search':'Contact search and discovery','183_Contact_Sync':'Contact synchronization','184_Collaborator_Contacts':'Project collaborator contacts','185_Client_Contacts':'Client contact management','186_Contact_Import':'Contact import from Google','187_Contact_Export':'Contact export to Google','188_Contact_Validation':'Contact data validation','189_Contact_History':'Contact interaction history','190_Contact_Integration' : 'Cross-platform contact integration',
          },
          targetFolder: '01_Raw', // Uploads typically go to raw folder
          googleDriveFolderId: googleDriveFolderId || currentProject?.driveFolderId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setGoogleDriveItems(result.items || []);
        setGoogleDriveSyncStatus('success');
        onGoogleDriveSync?.(result.items || []);
        
      // Broadcast sync completion to other components
      communication.sendMessage({
        type: 'uploads-synced-to-drive',
        from: `universal-file-upload-${effectiveUserId}`,
        to: 'all',
        priority: 'medium',
        data: {
          projectId: currentProject?.id,
          folderId: result.folderId,
          itemsCount: result.items?.length || 0,
          profession,
        },
      });
    } else {
        throw new Error('Failed to sync to Google Drive');
    }
  } catch (error) {
      console.error('Google Drive sync error: ', error);
      setGoogleDriveSyncStatus('error');
  } finally {
      setSyncProgress(100);
  }
}, [enableGoogleDriveSync, googleDriveFolderId, profession, effectiveUserId, componentRegistry, communication, onGoogleDriveSync, auth, integration, projectId]);

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'UniversalFileUpload',
      name: 'Universal File Upload',
      type: 'universal',
      category: 'file-service',
      capabilities: ['file-upload','file-validation','background-upload','queue-management'],
      dependencies: [],
      props: [],
      events: [],
      dataKeys: ['selected-files','upload-progress','validation-errors','queue-stats']
    });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalFileUpload',
      dataKey: 'selected-files'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalFileUpload',
      dataKey: 'upload-progress'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalFileUpload',
      dataKey: 'validation-errors'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalFileUpload',
      dataKey: 'queue-stats'
});

    // Listen for file upload events
    const unsubscribeStart = communication.onMessageType('file-upload:start', (data: any) => {
      if (data.files) {
        handleFileSelect(data.files);
  }
  });

    const unsubscribeClear = communication.onMessageType('file-upload:clear', () => {
      setSelectedFiles([]);
      setValidationErrors([]);
  });

    const unsubscribeValidate = communication.onMessageType('file-upload:validate', (data: any) => {
      if (data.files) {
        validateFiles(data.files).then(validation => {
          setSelectedFiles(validation.valid);
          setValidationErrors(validation.invalid);
    });
    }
  });

    // Track feature usage
    features.trackFeatureUsage('universal-file-upload', 'opened', {
      timestamp: Date.now(),
      component: 'UniversalFileUpload',
      profession: profession,
      userId: userId
    });

    return () => {
      componentRegistry.unregisterComponent('UniversalFileUpload');
      dataFlow.unregisterNode('selected-files');
      dataFlow.unregisterNode('upload-progress');
      dataFlow.unregisterNode('validation-errors');
      dataFlow.unregisterNode('queue-stats');
      unsubscribeStart();
      unsubscribeClear();
      unsubscribeValidate();
  };
}, [componentRegistry, dataFlow, communication, features, profession, effectiveUserId]);

  // Get profession-specific colors
  const getProfessionColors = () => {
    switch (profession) {
      case 'photographer': return { primary: '#FF6B30', secondary: '#FFA726',};
      case 'videographer': return { primary: '#E53E30', secondary: '#FC8181',};
      case 'music_producer': return { primary: '#9F7AE0', secondary: '#B794F6',};
      case 'vendor': return { primary: '#38B2A0', secondary: '#4FD1C7',};
      default: return { primary: '#FF6B30', secondary: '#FFA726',};
  }
};

  const colors = getProfessionColors();

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const limit = enableMultipleFiles ? maxFiles : 1;
    const fileArray = Array.from(files).slice(0, limit);
    
    // Validate files against camera database
    const validation = await validateFiles(fileArray);
    
    setSelectedFiles(validation.valid);
    setValidationErrors(validation.invalid);
    
    if (onFilesSelected) {
      onFilesSelected(validation.valid);
  }

    if (!selectedProject && onProjectSelect) {
      onProjectSelect({
        id: `upload-${Date.now()}`,
        name: 'Opplastingsprosjekt',
        createdAt: new Date().toISOString()
      });
    }

    onProjectUpdate?.({
      ...(selectedProject || {}),
      lastUploadAt: new Date().toISOString(),
      pendingFiles: validation.valid.length
    });

    onWorklogCreate?.({
      projectId: selectedProject?.id,
      description: `Valgte ${validation.valid.length} filer for opplasting`,
      loggedAt: new Date().toISOString(),
      metadata: {
        enableAIAnalysis,
        enableAutoTagging,
        enableSmartCollections,
        integrationContext
      }
    });

    integration.setData(`universal-file-upload-${effectiveUserId}:items`, validation.valid);
    communication.sendMessage({
      type: 'file-upload:selected',
      from: `universal-file-upload-${effectiveUserId}`,
      to: 'all',
      priority: 'low',
      data: {
        fileCount: validation.valid.length,
        projectId: selectedProject?.id,
        collaborationSessionId,
        enableRealTimeSync
      }
    });

    // Show validation results
    if (validation.invalid.length > 0) {
      console.warn('Noen filer ble avvist:', validation.invalid);
  }
}, [enableMultipleFiles, maxFiles, onFilesSelected, selectedProject, onProjectSelect, onProjectUpdate, onWorklogCreate, enableAIAnalysis, enableAutoTagging, enableSmartCollections, integrationContext, integration, communication, effectiveUserId, collaborationSessionId, enableRealTimeSync]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    if (!enableDragDrop) return;
    event.preventDefault();
    handleFileSelect(event.dataTransfer.files);
}, [handleFileSelect, enableDragDrop]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!enableDragDrop) return;
    event.preventDefault();
}, [enableDragDrop]);

  // Remove file from selection
  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    if (onFilesSelected) {
      onFilesSelected(newFiles);
    }
  }, [selectedFiles, onFilesSelected]);

  // Enhanced upload files with advanced queue management
  const uploadFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    const uploadMetadata = {
      ...additionalMetadata,
      integrationContext,
      projectId,
      collaborationSessionId,
      enableAIAnalysis,
      enableAutoTagging,
      enableSmartCollections
    };

    onWorklogCreate?.({
      projectId: selectedProject?.id,
      description: `Starter opplasting av ${selectedFiles.length} filer`,
      loggedAt: new Date().toISOString(),
      metadata: uploadMetadata
    });

    // Storage validation check
    if (showStorageInfo && storageWarning) {
      console.warn('Storage warning detected:', storageWarning);
      // Could show user confirmation dialog here
  }

    if (enableAdvancedQueue && enableBackgroundUpload) {
      // Use advanced upload queue system
      const processingOptions: BatchProcessingOptions = {
        enhancementType: enhancementType === 'professional' ? 'upscale' : enhancementType === 'basic' ? 'denoise' : 'upscale',
        upscaleFactor:  2,
        denoiseStrength: 0.5,
        colorizeStrength: 0.3,
        priority: queuePriority,
        outputFormat: 'png',
        outputQuality:  95,
        preserveOriginal: false
  };

      // Add files to the advanced queue
      const uploadIds = uploadQueue.addToQueue(
        selectedFiles,
        processingOptions,
        queuePriority
      );

      // Clear selected files immediately since they're now in the advanced queue
      setSelectedFiles([]);
      
      // Notify parent that files are queued
      if (onFilesSelected) {
        onFilesSelected([]);
    }

      // Enhanced notification with queue information
      if (onUploadComplete) {
        // Create immediate response for queue addition
        const queuedResults = selectedFiles.map((file, index) => ({
          file,
          uploadId: uploadIds[index],
          status: 'queued',
          queuePosition: queueStats.queued + index + 1,
          success: true,
          message: `Lagt til i opplastingskø (posisjon ${queueStats.queued + index + 1})`,
          metadata: uploadMetadata
        }));
        onUploadComplete(queuedResults);
      }

      onProjectUpdate?.({
        ...(selectedProject || {}),
        lastUploadAt: new Date().toISOString(),
        lastUploadCount: uploadIds.length
      });

      if (enableAIAnalysis) {
        onMeetingCreate?.({
          title: 'AI gjennomgang av opplastinger',
          projectId: selectedProject?.id,
          scheduledAt: new Date().toISOString(),
          context: uploadMetadata
        });
      }

    } else if (enableBackgroundUpload) {
      // Use legacy background upload service for compatibility
      const taskIds = backgroundUploadService.addFiles(
        selectedFiles,
        uploadEndpoint,
        uploadMetadata,
        maxRetries
      );

      // Clear selected files immediately since they're now in background queue
      setSelectedFiles([]);

      // Notify parent that files are queued
      if (onFilesSelected) {
        onFilesSelected([]);
      }

      // Listen for completion events for this batch
      const handleTaskCompleted = (taskId: string, result: any) => {
        if (taskIds.includes(taskId) && onUploadComplete) {
          // Collect all completed results from this batch
          const batchTasks = taskIds.map(id => backgroundUploadService.getTask(id));
          const completedBatch = batchTasks.filter(task => task?.status === 'completed');

          if (completedBatch.length === taskIds.length) {
            // All tasks in batch completed
            const results = completedBatch.map(task => ({
              file: task!.file,
              result: task!.result,
              success: true
            }));
            onUploadComplete(results);
          }
        }
      };

      const handleTaskFailed = (taskId: string, error: string) => {
        if (taskIds.includes(taskId) && onUploadError) {
          const task = backgroundUploadService.getTask(taskId);
          if (task) {
            onUploadError(error, task.file);
          }
        }
      };

      backgroundUploadService.on('taskCompleted', handleTaskCompleted);
      backgroundUploadService.on('taskFailed', handleTaskFailed);

      // Cleanup listeners after reasonable time
      setTimeout(() => {
        backgroundUploadService.removeListener('taskCompleted', handleTaskCompleted);
        backgroundUploadService.removeListener('taskFailed', handleTaskFailed);
    }, 300000); // 5 minutes

  } else {
      // Use immediate upload (legacy behavior)
      setUploading(true);
      const results: any[] = [];

      try {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const formData = new FormData();
          formData.append('file', file);
          
          // Add metadata
          Object.entries(uploadMetadata).forEach(([key, value]) => {
            formData.append(key, JSON.stringify(value));
        });

          try {
            const response = await fetch(uploadEndpoint, {
              method: 'POST',
              headers: {
                ...auth
          },
              body: formData
        });

            if (response.ok) {
              const result = await response.json();
              results.push({ file, result, success: true });
          } else {
              const error = await response.text();
              results.push({ file, error, success: false });
              if (onUploadError) {
                onUploadError(error, file);
            }
          }
        } catch (error: any) {
            results.push({ file, error: error.message, success: false });
            if (onUploadError) {
              onUploadError(error.message, file);
          }
        }
      }

        if (onUploadComplete) {
          onUploadComplete(results);
        }

        onProjectUpdate?.({
          ...(selectedProject || {}),
          lastUploadAt: new Date().toISOString(),
          lastUploadCount: results.length
        });

        // Clear successful uploads
        const failedFiles = results
          .filter(r => !r.success)
          .map(r => r.file);
        setSelectedFiles(failedFiles);

    } finally {
        setUploading(false);
        setUploadProgress({});
    }
  }
}, [selectedFiles, uploadEndpoint, additionalMetadata, integrationContext, onUploadComplete, onUploadError, onProjectUpdate, onWorklogCreate, onMeetingCreate, enableBackgroundUpload, maxRetries, onFilesSelected, enableAdvancedQueue, enhancementType, queuePriority, maxFiles, profession, projectId, showStorageInfo, storageWarning, uploadQueue, queueStats, selectedProject, collaborationSessionId, enableAIAnalysis, enableAutoTagging, enableSmartCollections]);

  // Get supported formats for display
  const supportedFormats = getSupportedExtensions();
  const databaseSupportedFormats = universalFileFormatSupport.getSupportedExtensions().length;
  const storagePercent = Number(
    fileManagementStats?.storageUsedPercent ??
    fileManagementStats?.storagePercent ??
    fileManagementStats?.usedPercent ??
    0
  );
  const storageUsed = fileManagementStats?.storageUsed ?? fileManagementStats?.usedBytes ?? fileManagementStats?.used;
  const storageTotal = fileManagementStats?.storageTotal ?? fileManagementStats?.totalBytes ?? fileManagementStats?.total;

  return (
    <Box className={className}>
      {showFeatureMeta && (
        <>
          {/* Feature Analytics Display */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, mb:  2,
            p:  1,
            backgroundColor: 'blur\(\s*([0-9]+px)\s*,\s*\)00.02)',
            borderRadius:  1,
            border: '1px solid blur\(\s*([0-9]+px)\s*,\s*\)00.1)'
        }}>
            <Typography variant="caption" color="text.secondary">
              Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
            </Typography>
            <Chip 
              label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18}}
            />
            {isFileStatsLoading ? (
              <Chip size="small" label="Laster lagring..." variant="outlined" />
            ) : (
              <Chip
                size="small"
                label={storagePercent ? `Lagring ${storagePercent.toFixed(0)}%` : 'Lagring ok'}
                color={storagePercent >= 90 ? 'warning' : 'default'}
                icon={storagePercent >= 90 ? <WarningIcon /> : <StorageIcon />}
                variant="outlined"
              />
            )}
            <Chip
              size="small"
              label={`Formater: ${databaseSupportedFormats}`}
              variant="outlined"
              icon={<InfoIcon />}
            />
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Chip size="small" label="Universal" color={universalFileUploadAccess ? 'success' : 'default'} />
            <Chip size="small" label="File upload" color={fileUploadAccess ? 'success' : 'default'} />
            <Chip size="small" label="Background" color={backgroundUploadAccess ? 'success' : 'default'} />
            <Chip size="small" label="Drive" color={googleDriveUploadAccess ? 'success' : 'default'} />
            <Chip size="small" label="Queue" color={uploadQueueAccess ? 'success' : 'default'} />
            <Chip size="small" label="Progress" color={uploadProgressAccess ? 'success' : 'default'} />
            <Chip size="small" label="Analytics" color={uploadAnalyticsAccess ? 'success' : 'default'} />
            <Chip size="small" label="Scheduling" color={uploadSchedulingAccess ? 'success' : 'default'} />
            <Chip size="small" label={`Sync: ${enableRealTimeSync ? 'Pa' : 'Av'}`} variant="outlined" />
            {collaborationSessionId && (
              <Chip size="small" label={`Session: ${collaborationSessionId}`} variant="outlined" />
            )}
            {enableAIAnalysis && <Chip size="small" label="AI analyse" color="primary" />}
            {enableAutoTagging && <Chip size="small" label="Auto-tag" color="primary" />}
            {enableSmartCollections && <Chip size="small" label="Smart collections" color="primary" />}
          </Stack>
        </>
      )}

      {/* Google Workspace Storage Information */}
      {showStorageInfo && (
        <GoogleWorkspaceStorageInfo
          userId={userId}
          compact={true}
          showDetailsButton={false}
          profession={profession}
        />
      )}

      {/* Advanced Queue Status */}
      {showQueueStatus && enableAdvancedQueue && (queueStats.total > 0 || uploadQueue.activeUploads.length > 0) && (
        <Card sx={{ mb: 2, background: 'linear-gradient(135deg, rgba(25, 107, 53, 0.1) 0%, rgba(25, 167, 38, 0.1) 100%)', ...theming.getThemedCardSx() }}>
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Badge badgeContent={queueStats.total} color="primary">
                  <QueueIcon sx={{ color: colors.primary }} />
                </Badge>
                <Typography variant="body2" fontWeight="600">
                  Opplastingskø
                </Typography>
                <Chip
                  label={connectionState === 'connected' || isConnected ? 'Tilkoblet' : 'Frakoblet'}
                  size="small"
                  color={connectionState === 'connected' || isConnected ? 'success' : 'warning'}
                  variant="outlined"
                />
                <Chip size="small" label={`Prioritet: ${queuePriority}`} variant="outlined" />
              </Stack>
              <Stack direction="row" spacing={1}>
                {queueStats.uploading > 0 && (
                  <Chip
                    label={`${queueStats.uploading} laster opp`}
                    size="small"
                    color="primary"
                    variant="filled"
                  />
                )}
                {queueStats.queued > 0 && (
                  <Chip
                    label={`${queueStats.queued} i kø`}
                    size="small"
                    color="default"
                    variant="outlined"
                  />
                )}
                {queueStats.completed > 0 && (
                  <Chip
                    label={`${queueStats.completed} fullført`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
                {queueStats.error > 0 && (
                  <Chip
                    label={`${queueStats.error} feilet`}
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
              </Stack>
            </Stack>
            {queueStats.total > 0 && (
              <Box sx={{ mt:  1 }}>
                <LinearProgress
                  variant="determinate"
                  value={queueStats.progress}
                  sx={{
                    height:  6,
                    borderRadius:  3,
                    backgroundColor: 'blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.1)', '& .MuiLinearProgress-bar': {
                      backgroundColor: colors.primary,
                      borderRadius: 3 }
                }}
                />
                <Typography variant="caption" color="text.secondary">
                  {queueStats.progress.toFixed(1)}% fullført av alle opplastinger
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Storage Warning */}
      {storageWarning && (
        <Alert severity="warning" sx={{ mb:  2 }}>
          <Typography variant="body2">
            <strong>Lagringsadvarsel: </strong> {storageWarning}
          </Typography>
        </Alert>
      )}

      {(storageUsed || storageTotal) && (
        <Alert severity={storagePercent >= 90 ? 'warning' : 'info'} sx={{ mb: 2 }}>
          <Typography variant="body2">
            Lagring brukt: {storageUsed || 'ukjent'} / {storageTotal || 'ukjent'}
          </Typography>
        </Alert>
      )}

      {/* File Drop Zone */}
      <Paper
        data-testid="universal-file-upload-dropzone"
        elevation={2}
        onDrop={enableDragDrop ? handleDrop : undefined}
        onDragOver={enableDragDrop ? handleDragOver : undefined}
        sx={{
          border: `2px dashed ${colors.primary}`,
          borderRadius:  2,
          p:  3,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease','&:hover': {
            borderColor: colors.secondary,
            backgroundColor: 'action.hover'
          },
          ...theming.getThemedCardSx()
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon sx={{ fontSize: 48, color: colors.primary, mb: 2 }} />
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Dra og slipp filer her eller klikk for å velge
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Støtter {allowedTypes === 'all' ? 'alle filtyper' : allowedTypes} • Kamera-RAW • Video • Lyd • PDF • Design • 3D
          <br />
          Maks {maxFiles} filer • {maxFileSizeMB}MB per fil • Over 150+ formater støttet
        </Typography>

        {/* Hidden file input */}
        <input
          data-testid="universal-file-upload-input"
          ref={fileInputRef}
          type="file"
          multiple={enableMultipleFiles}
          accept={getFileAcceptAttribute()}
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </Paper>

      {/* Format Information Toggle */}
      {showFormatInfo && (
        <Box sx={{ mt:  2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowSupportedFormats(!showSupportedFormats)}
            startIcon={showSupportedFormats ? <CollapseIcon /> : <ExpandIcon />}
            endIcon={<InfoIcon />}
          >
            Støttede formater ({supportedFormats.length})
          </Button>
          
          <Collapse in={showSupportedFormats}>
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'background.paper', borderRadius:  1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Alle filformater støttet via database ({supportedFormats.length} formater):
              </Typography>
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" color="primary" gutterBottom>
                  Bilder & RAW: C3, CR4, NEF, ARW, RAF, DNG, HEIC, AVIF, WebP, PNG, JPG, TIFF
                </Typography>
                <Typography variant="body2" color="secondary" gutterBottom>
                  Video: M4, MOV, MXF, MKV, AVI, WebM, R3D, ARRI, ProRes, AVCHD
                </Typography>
                <Typography variant="body2" color="info.main" gutterBottom>
                  Lyd: WV, FLAC, MP3, AAC, AIFF, BWF, RF64, MIDI, Opus
                </Typography>
                <Typography variant="body2" color="success.main" gutterBottom>
                  Dokumenter: PF, DOCX, XLSX, PPTX, ODT, RTF, HTML, JSON, XML
                </Typography>
                <Typography variant="body2" color="warning.main" gutterBottom>
                  Design: PD, AI, EPS, InDD, SVG, Sketch, Figma, XD
                </Typography>
                <Typography variant="body2" color="error.main" gutterBottom>
                  Arkiv: ZP, RAR, 7Z, TAR, GZ • 3D: OJ, FBX, Blend, C4D, Maya
                </Typography>
              </Box>
              <Grid container spacing={1}>
                {supportedFormats.slice(0, 30).map((ext, index) => (
                  <Grid key={index}>
                    <Chip
                      label={ext.toUpperCase()}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  </Grid>
                ))}
                {supportedFormats.length > 30 && (
                  <Grid>
                    <Chip
                      label={`+${supportedFormats.length - 30} flere`}
                      size="small"
                      variant="filled"
                      color="secondary"
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert severity="warning" sx={{ mt:  2 }}>
          <Typography variant="body2" gutterBottom>
            Noen filer ble avvist: </Typography>
          <List dense>
            {validationErrors.map((error, index) => (
              <ListItem key={index} disablePadding>
                <ListItemIcon>
                  <ErrorIcon color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={error.file.name}
                  secondary={error.reason}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <Box sx={{ mt:  2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Valgte filer ({selectedFiles.length}):
          </Typography>
          <List>
            {selectedFiles.map((file, index) => (
              <ListItem key={index} divider>
                <ListItemIcon>
                  <CameraIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type || 'Ukjent type'}`}
                />
                {uploading && uploadProgress[file.name] !== undefined && (
                  <Box sx={{ width: 10, mr:  1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress[file.name]}
                      color="primary"
                    />
                  </Box>
                )}
                <IconButton
                  edge="end"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Button
                data-testid="universal-file-upload-submit"
                variant="contained"
                onClick={uploadFiles}
                disabled={uploading}
                startIcon={uploading ? undefined : <UploadIcon />}
                sx={{
                  backgroundColor: colors.primary, '&:hover': {
                    backgroundColor: colors.secondary
                  },
                  ...theming.getThemedButtonSx()
                }}
              >
                {uploading
                  ? 'Laster opp...'
                  : enableAdvancedQueue && enableBackgroundUpload
                    ? `Legg til i avansert kø (${selectedFiles.length} fil${selectedFiles.length > 1 ? 'er' : ','})`
                    : enableBackgroundUpload
                      ? `Start opplasting (${selectedFiles.length} fil${selectedFiles.length > 1 ? 'er' : ','})`
                      : `Last opp ${selectedFiles.length} fil${selectedFiles.length > 1 ? 'er' : ','}`
                }
              </Button>

              {/* File Management Status Indicators */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  display: 'flex',
                  gap: 0.5
                }}
              >
                {/* Upload System Status */}
                <Tooltip
                  title={
                    fileManagementStatus.systemStatus === 'connected'
                      ? `Upload System: ${fileManagementStatus.uploadService}`
                      : `Upload System: ${fileManagementStatus.systemStatus}`
                  }
                  arrow
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: fileManagementStatus.systemStatus === 'connected' ? '#4caf50' : '#f44336',
                      border: '1px solid white'
                    }}
                  />
                </Tooltip>
                
                {/* Google Drive Status */}
                <Tooltip 
                  title={
                    fileManagementStatus.googleDriveStatus === 'connected' 
                      ? `Google Drive: ${fileManagementStatus.googleDriveResponse}` 
                      : `Google Drive: ${fileManagementStatus.googleDriveResponse || 'Not tested'}`
                }
                  arrow
                >
                  <Box
                    sx={{
                      width:  8,
                      height:  8,
                      borderRadius: '50%',
                      backgroundColor: fileManagementStatus.googleDriveStatus === 'connected' ? '#4caf50' : '#f44330',
                      border: '1px solid white'
                }}
                  />
                </Tooltip>
              </Box>
            </Box>
            
            {/* Google Drive Sync Button */}
            {enableGoogleDriveSync && (
              <Button
                variant="outlined"
                onClick={syncToGoogleDrive}
                disabled={googleDriveSyncStatus === 'syncing'}
                startIcon={
                  googleDriveSyncStatus === 'syncing' ? (
                    <StorageIcon />
                  ) : (
                    <Box
                      component="img"
                      src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                      alt="Google Drive"
                      sx={{ width: 20, height: 20 }}
                    />
                  )
                }
                sx={{
                  borderColor: googleDriveSyncStatus === 'success' ? 'success.main' :
                              googleDriveSyncStatus === 'error' ? 'error.main' : 'primary.main',
                  color: googleDriveSyncStatus === 'success' ? 'success.main' :
                         googleDriveSyncStatus === 'error' ? 'error.main' : 'primary.main', '&:hover': {
                    borderColor: googleDriveSyncStatus === 'success' ? 'success.dark' :
                                googleDriveSyncStatus === 'error' ? 'error.dark' : 'primary.dark',
                    backgroundColor: googleDriveSyncStatus === 'success' ? 'success.light' :
                                   googleDriveSyncStatus === 'error' ? 'error.light' : 'primary.light',
                }
              }}
              >
                {googleDriveSyncStatus === 'syncing' ? 'Synkroniserer...' :
                 googleDriveSyncStatus === 'success' ? 'Synkronisert' :
                 googleDriveSyncStatus === 'error' ? 'Feil' : 'Sync til Drive'}
              </Button>
            )}
          </Stack>
          
          {enableBackgroundUpload && (
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              💡 Opplasting fortsetter i bakgrunnen - du kan jobbe videre mens filene lastes opp
            </Typography>
          )}
          
          {/* Google Drive Sync Status */}
          {enableGoogleDriveSync && googleDriveSyncStatus === 'syncing' && (
            <Box sx={{ mt:  1 }}>
              <LinearProgress variant="determinate" value={syncProgress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5}}>
                Synkroniserer til Google Drive... {syncProgress}%
              </Typography>
            </Box>
          )}
          
          {enableGoogleDriveSync && googleDriveSyncStatus ==='success' && (
            <Chip 
              label="01_Raw" 
              size="small" 
              color="success" 
              variant="outlined"
              sx={{ mt:  1 }}
            />
          )}
        </Box>
      )}

      {enableGoogleDriveSync && googleDriveItems.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Synkroniserte filer ({googleDriveItems.length})
            </Typography>
            <List dense>
              {googleDriveItems.slice(0, 5).map((item, index) => (
                <ListItem key={item.id || index} divider>
                  <ListItemIcon>
                    <SuccessIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name || item.fileName || `Fil ${index + 1}`}
                    secondary={item.id || item.fileId || 'Ukjent ID'}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onItemSelect?.(item)}
                    >
                      Velg
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onItemUpdate?.({
                        ...item,
                        updatedAt: new Date().toISOString()
                      })}
                    >
                      Oppdater
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onItemDelete?.(item)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </ListItem>
              ))}
            </List>
            {googleDriveItems.length > 5 && (
              <Typography variant="caption" color="text.secondary">
                Viser 5 av {googleDriveItems.length} filer.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default UniversalFileUpload;
