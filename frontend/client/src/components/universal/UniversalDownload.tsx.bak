import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  Box,
  Divider
} from '@mui/material';
import {
  Download,
  GetApp,
  FileDownload,
  PictureAsPdf,
  VideoFile,
  AudioFile,
  InsertDriveFile,
  Archive,
  CloudDownload
} from '@mui/icons-material';
import { backgroundDownloadService } from '@/services/BackgroundDownloadService';
import { usePhotoEnhancementWebSocket } from '@/hooks/usePhotoEnhancementWebSocket';

interface DownloadItem {
  url: string;
  filename: string;
  type?: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  size?: number;
  description?: string;
}

interface UniversalDownloadProps {
  items: DownloadItem[];
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'designer';
  variant?: 'button' | 'icon' | 'menu';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success';
  disabled?: boolean;
  className?: string;
  onDownloadStart?: (item: DownloadItem) => void;
  onDownloadComplete?: (item: DownloadItem, taskId: string) => void;
  enableBackground?: boolean;
  // Google Drive Integration
  enableGoogleDriveSync?: boolean;
  onGoogleDriveSync?: (items: any[]) => void;
  googleDriveFolderId?: string;
  // Enhanced Master Integration
  integrationContext?: any;
  onItemSelect?: (item: any) => void;
  onItemUpdate?: (item: any) => void;
  onItemDelete?: (item: any) => void;
  // Real-time collaboration
  enableRealTimeSync?: boolean;
  collaborationSessionId?: string;
  // AI Features
  enableAIAnalysis?: boolean;
  enableAutoTagging?: boolean;
  enableSmartCollections?: boolean;
  // Batch download features
  enableBatchDownload?: boolean;
  enableZipDownload?: boolean;
  enableProgressTracking?: boolean;
  maxRetries?: number;
  category?: string;
  // Enhanced download props
  userId?: string;
  enableSecureDownloads?: boolean;
  showProgress?: boolean;
  enableWebSocketUpdates?: boolean;
  // Integration props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
}

export function UniversalDownload({
  items,
  profession = 'photographer',
  variant = 'button',
  size = 'medium',
  color = 'primary',
  disabled = false,
  className = ', ',
  onDownloadStart,
  onDownloadComplete,
  enableBackground = true,
  // Google Drive Integration
  enableGoogleDriveSync = false,
  onGoogleDriveSync,
  googleDriveFolderId,
  // Enhanced Master Integration
  integrationContext,
  onItemSelect,
  onItemUpdate,
  onItemDelete,
  // Real-time collaboration
  enableRealTimeSync = false,
  collaborationSessionId,
  // AI Features
  enableAIAnalysis = false,
  enableAutoTagging = false,
  enableSmartCollections = false,
  // Batch download features
  enableBatchDownload = false,
  enableZipDownload = false,
  enableProgressTracking = false,
  maxRetries = 3,
  category = 'download',
  // Enhanced download props with defaults
  userId = 'current-user',
  enableSecureDownloads = true,
  showProgress = true,
  enableWebSocketUpdates = true
}: UniversalDownloadProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // Enhanced Master Integration (including unified auth for Google services)
  const {
    integration,
    communication,
    dataFlow,
    componentRegistry,
    auth,
  } = useEnhancedMasterIntegration();

  // Google Drive Integration State
  const [googleDriveSyncStatus, setGoogleDriveSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [googleDriveItems, setGoogleDriveItems] = useState<any[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentGoogleDriveFolderId, setCurrentGoogleDriveFolderId] = useState<string | null>(null);

  // AI Analysis State
  const [aiAnalysisResults, setAiAnalysisResults] = useState<Map<string, any>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Real-time Collaboration State
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [activeCollaborators, setActiveCollaborators] = useState<Set<string>>(new Set());

  // Batch Download State
  const [batchDownloadItems, setBatchDownloadItems] = useState<Set<string>>(new Set());
  const [batchDownloadProgress, setBatchDownloadProgress] = useState(0);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  // Enhanced WebSocket integration for real-time download updates
  const webSocketResult = usePhotoEnhancementWebSocket({ userId });
  const connectionState = 'disconnected';
  const isConnected = false;

  const professionColors = {
    photographer: '#FF6B35',
    videographer: '#4ECDC4',
    music_producer: '#45B7D1',
    designer: '#96CEB4'
};

  const professionColor = professionColors[profession];

  // Enhanced Master Integration - Component Registration
  React.useEffect(() => {
    const componentId = `universal-download-${userId}`;
    componentRegistry.registerComponent({
      id: componentId,
      name: 'Universal Download',
      type: 'universal',
      category: 'file-service',
      capabilities: ['file-download','secure-download','background-download','progress-tracking'],
      dependencies: [],
      props: ['items','profession','userId'],
      events: ['download-start','download-complete','download-error'],
      dataKeys: ['download-items','download-progress','download-status']
  });

    return () => {
      componentRegistry.unregisterComponent(componentId);
  };
}, [componentRegistry, userId, profession, items, downloadProgress, batchDownloadItems, isDownloading, isBatchDownloading]);

  // Enhanced Master Integration - Event Subscriptions
  React.useEffect(() => {
    const handleShowcaseItemSelected = (data: any) => {
      if (data.itemId && enableBatchDownload) {
        // Add selected item to download queue
        setBatchDownloadItems(prev => new Set(Array.from(prev).concat(data.itemId)));
        onItemSelect?.(data.item);
    }
  };

    const handleDownloadRequest = (data: any) => {
      if (data.itemId) {
        const item = items.find(i => i.url === data.itemId || i.filename === data.itemId);
        if (item) {
          handleDownload(item);
      }
    }
  };

    const handleFolderCreated = (data: any) => {
      if (data.projectId && data.folderId) {
        // Update Google Drive folder ID when project folders are created
        setCurrentGoogleDriveFolderId(data.folderId);
        console.log('Project folders created, updating download folder ID: ', data.folderId);
    }
  };

    const handleDownloadsSynced = (data: any) => {
      if (data.projectId) {
        // Refresh download data when synced to Drive
        console.log('Downloads synced to Drive: ', data);
    }
  };

    // Communication events are handled by the Enhanced Master Integration system
    // No manual subscription needed
}, [communication, enableBatchDownload, items, onItemSelect]);

  // Google Drive Integration - Sync Function with Automatic Folder Structure
  const syncToGoogleDrive = React.useCallback(async () => {
    if (!enableGoogleDriveSync) return;

    setGoogleDriveSyncStatus('syncing,');
    setSyncProgress(0);

    try {
      // Use unified auth header from Enhanced Master Integration
      const authHeader = await auth.getAuthHeader();

      // Get current download items
      const downloadItems = integration.getData(`universal-download-${userId}:items, `) || [];

      // Get current project context from UniversalDashboard
      const currentProject = integration.getData(`universal-dashboard-${userId}:selectedProject`);

      // Sync to Google Drive with automatic folder structure
      const response = await fetch('/api/google-drive/sync-downloads-to-project-folders,', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: authHeader.Authorization,
        },
        body: JSON.stringify({
          items: downloadItems,
          profession,
          userId,
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
                      '181_Google_Contacts':'Google People API contacts','182_Contact_Search':'Contact search and discovery','183_Contact_Sync':'Contact synchronization','184_Collaborator_Contacts':'Project collaborator contacts','185_Client_Contacts':'Client contact management','186_Contact_Import':'Contact import from Google','187_Contact_Export':'Contact export to Google','188_Contact_Validation':'Contact data validation','189_Contact_History':'Contact interaction history','190_Contact_Integration' : 'Cross-platform contact integration'
             },
          targetFolder: '04_Deliverables', // Downloads typically go to deliverables folder
          googleDriveFolderId: googleDriveFolderId || currentProject?.driveFolderId
      })
    });

      if (response.ok) {
        const result = await response.json();
        setGoogleDriveItems(result.items || []);
        setGoogleDriveSyncStatus('success, ');
        onGoogleDriveSync?.(result.items || []);
        
      // Broadcast sync completion to other components
      communication.sendMessage({
        type: 'downloads-synced-to-drive',
        from: `universal-download-${userId}`,
        to: 'all',
        priority: 'medium',
        data: {
          projectId: currentProject?.id,
          folderId: result.folderId,
          itemsCount: result.items?.length || 0,
          profession
      }
    });
    } else {
        throw new Error('Failed to sync to Google Drive');
    }
  } catch (error) {
      console.error('Google Drive sync error:', error);
      setGoogleDriveSyncStatus('error');
  } finally {
      setSyncProgress(100);
  }
}, [enableGoogleDriveSync, googleDriveFolderId, profession, userId, componentRegistry, communication, onGoogleDriveSync]);

  // Batch Download Function
  const handleBatchDownload = React.useCallback(async () => {
    if (!enableBatchDownload || batchDownloadItems.size === 0) return;

    setIsBatchDownloading(true);
    setBatchDownloadProgress(0);

    try {
      const itemsToDownload = Array.from(batchDownloadItems).map(itemId => 
        items.find(item => item.url === itemId || item.filename === itemId)
      ).filter(Boolean);

      if (enableZipDownload) {
        // Create ZIP download
        const response = await fetch('/api/downloads/create-zip', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            items: itemsToDownload,
            profession,
            userId
        })
      });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${profession}-downloads-${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
      }
    } else {
        // Download individual files
        for (let i = 0; i < itemsToDownload.length; i++) {
          const item = itemsToDownload[i];
          if (item) {
            await handleDownload(item);
            setBatchDownloadProgress(((i + 1) / itemsToDownload.length) * 100);
        }
      }
    }
  } catch (error) {
      console.error('Batch download error:', error);
  } finally {
      setIsBatchDownloading(false);
      setBatchDownloadProgress(0);
      setBatchDownloadItems(new Set());
  }
}, [enableBatchDownload, enableZipDownload, batchDownloadItems, items, profession, userId]);

  // AI Analysis for Music Producers
  const analyzeDownloadContent = React.useCallback(async (item: DownloadItem) => {
    if (profession !== 'music_producer' || !enableAIAnalysis) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze-download', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          itemId: item.url,
          filename: item.filename,
          profession
      })
    });

      if (response.ok) {
        const analysis = await response.json();
        setAiAnalysisResults(prev => new Map(prev.set(item.url, analysis)));
        
        // Auto-tagging if enabled
        if (enableAutoTagging && analysis.tags) {
          const updatedItem = { ...item, tags: analysis.tags };
          onItemUpdate?.(updatedItem);
      }
    }
  } catch (error) {
      console.error('AI analysis error:', error);
  } finally {
      setIsAnalyzing(false);
  }
}, [profession, enableAIAnalysis, enableAutoTagging, onItemUpdate]);

  // Real-time Collaboration - WebSocket Connection
  React.useEffect(() => {
    if (!enableRealTimeSync || !collaborationSessionId) return;

    const ws = new WebSocket(`ws://localhost:3001/collaboration/${collaborationSessionId}`);
    
    ws.onopen = () => {
      console.log('Download Collaboration WebSocket connected');
  };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'collaborator-joined':
          setCollaborators(prev => [...prev, data.collaborator]);
          setActiveCollaborators(prev => new Set(Array.from(prev).concat(data.collaborator.id)));
          break;
        case 'collaborator-left':
          setActiveCollaborators(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.collaboratorId);
            return newSet;
        });
          break;
        case 'download-requested':
          if (data.itemId) {
            const item = items.find(i => i.url === data.itemId || i.filename === data.itemId);
            if (item) {
              handleDownload(item);
          }
        }
          break;
    }
  };

    ws.onclose = () => {
      console.log('Download Collaboration WebSocket disconnected');
  };

    return () => {
      ws.close();
  };
}, [enableRealTimeSync, collaborationSessionId, items]);

  // Register component with MasterIntegrationProvider (legacy)
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'UniversalDownload',
      name: 'Universal Download Service',
      type: 'universal',
      category: 'file-service',
      capabilities: ['file-download','secure-download','background-download','progress-tracking'],
      dependencies: [],
      props: ['items','profession','userId'],
      events: ['download-start','download-complete','download-error'],
      dataKeys: ['download-items','download-progress','download-status']
  });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalDownload',
      dataKey: 'download-items',
      transform: (data: any) => data,
      filter: (data: any) => true
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalDownload',
      dataKey: 'download-progress',
      transform: (data: any) => data,
      filter: (data: any) => true
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalDownload',
      dataKey: 'download-status',
      transform: (data: any) => data,
      filter: (data: any) => true
  });

    // Communication events are handled by the Enhanced Master Integration system
    // No manual subscription needed

    return () => {
      componentRegistry.unregisterComponent('UniversalDownload');
      dataFlow.unregisterNode('download-items');
      dataFlow.unregisterNode('download-progress');
      dataFlow.unregisterNode('download-status');
  };
}, [items, downloadProgress, isDownloading, connectionState, componentRegistry, dataFlow, communication]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'document': return <PictureAsPdf />;
      case 'image': return <GetApp />;
      case 'video': return <VideoFile />;
      case 'audio': return <AudioFile />;
      case 'archive': return <Archive />;
      default: return <InsertDriveFile />;
  }
};

  // Enhanced download function with secure URLs and progress tracking
  const handleDownload = async (item: DownloadItem) => {
    setIsDownloading(true);
    onDownloadStart?.(item);

    try {
      if (enableSecureDownloads && enableBackground) {
        // Enhanced secure download with signed URLs
        const downloadRequestId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // First, get a secure signed URL for the download using unified auth
        const authHeader = await auth.getAuthHeader();
        const signedUrlResponse = await fetch('/api/photo-enhancement/download/signed-url', {
          method: 'POST',
          headers: {
            ...authHeader, 'Content-Type' : 'application/json',
        },
          body: JSON.stringify({
            originalUrl: item.url,
            filename: item.filename,
            userId,
            expiresIn: 3600, // 1 hour
        }),
      });

        if (!signedUrlResponse.ok) {
          throw new Error(`Failed to get secure download URL: ${signedUrlResponse.statusText}`);
      }

        const { signedUrl, taskId } = await signedUrlResponse.json();

        // Use background download service with secure URL
        const backgroundTaskId = await backgroundDownloadService.startDownload(
          signedUrl,
          item.filename,
          {
            maxRetries,
            profession,
            category,
            chunkSize: 2 * 1024 * 1024,
            maxConcurrent: 1,
        },
          userId,
          onDownloadComplete,
          (progress: number) => {
            if (showProgress) {
              setDownloadProgress(prev => ({ ...prev, [backgroundTaskId]: progress }));
          }
        }
        );

        // Enhanced progress tracking
        if (showProgress) {
          setDownloadProgress(prev => ({ ...prev, [backgroundTaskId]: 0 }));
      }

        // Progress tracking is handled by the callback in startDownload
        // Completion is handled by the onDownloadComplete callback

    } else if (enableBackground) {
        // Use standard background download service
        const taskId = await backgroundDownloadService.startDownload(
          item.url,
          item.filename,
          {
            maxRetries,
            profession,
            category,
            chunkSize: 2 * 1024 * 1024,
            maxConcurrent: 1,
        },
          userId,
          onDownloadComplete,
          (progress: number) => {
            if (showProgress) {
              setDownloadProgress(prev => ({ ...prev, [taskId]: progress }));
          }
        }
        );

        // Completion is handled by the onDownloadComplete callback
    } else {
        // Direct download with enhanced security headers using unified auth
        const authHeader = await auth.getAuthHeader();
        const response = await fetch(item.url, {
          headers: {
            ...authHeader, 'X-Download-Source' : 'CreatorHub-Norge','X-User-ID': userId,
        },
      });

        if (!response.ok) {
          throw new Error(`Download failed: ${response.statusText}`);
      }
        
        const blob = await response.blob();
        
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = item.filename;
        a.rel = 'noopener noreferrer'; // Security enhancement
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(downloadUrl);
        onDownloadComplete?.(item, 'direct');
    }
  } catch (error) {
      console.error('Enhanced download failed:', error);
      // Enhanced error handling with user-friendly Norwegian messages
      const errorMessage = error instanceof Error ? error.message : 'Ukjent feil ved nedlasting';
      console.error('Nedlasting feilet:', errorMessage);
  } finally {
      setIsDownloading(false);
      setAnchorEl(null);
  }
};

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
};

  const handleMenuClose = () => {
    setAnchorEl(null);
};

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return ', ';
    const k = 1024;
    const sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ', ' + sizes[i];
};

  // Single item download
  if (items.length === 1) {
    const item = items[0];
    
    if (variant === 'icon') {
      return (
        <Tooltip title={`Last ned ${item.filename}`}>
          <IconButton
            onClick={() => handleDownload(item)}
            disabled={disabled || isDownloading}
            size={size}
            className={className}
            sx={{
              color: professionColor,
              '&:hover': {
                backgroundColor: `${professionColor}20`
              }
            }}
          >
            <Download />
          </IconButton>
        </Tooltip>
      );
  }

    return (
      <Button
        variant="contained"
        startIcon={isDownloading ? <CloudDownload /> : <Download />}
        onClick={() => handleDownload(item)}
        disabled={disabled || isDownloading}
        size={size}
        color={color}
        className={className}
        sx={{
          backgroundColor: professionColor,
          '&:hover': {
            backgroundColor: `${professionColor}dd`
          }
        }}
      >
        {isDownloading ? 'Laster ned...' : 'Last ned'}
      </Button>
    );
}

  // Multiple items - show menu
  return (
    <>
      <Button
        variant={variant === 'button' ? 'contained' : 'outlined'}
        startIcon={<Download />}
        onClick={handleMenuOpen}
        disabled={disabled || isDownloading}
        size={size}
        color={color}
        className={className}
        sx={{
          backgroundColor: variant === 'button' ? professionColor : 'transparent',
          borderColor: professionColor,
          color: variant === 'button' ? 'white' : professionColor,
          '&:hover': {
            backgroundColor: variant === 'button' ? `${professionColor}dd` : `${professionColor}20`
          }
        }}
      >
        Last ned ({items.length})
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 320,
            '& .MuiMenuItem-root': {
              py: 1
            }
          }
        }}
      >
        {/* Google Drive Sync Option */}
        {enableGoogleDriveSync && (
          <>
            <MenuItem onClick={syncToGoogleDrive} disabled={googleDriveSyncStatus === 'syncing'}>
              <ListItemIcon sx={{ color: professionColor }}>
                <CloudDownload />
              </ListItemIcon>
              <ListItemText
                primary="Sync til Google Drive"
                secondary="04_Deliverables mappe"
              />
            </MenuItem>
            <Divider />
          </>
        )}
        
        {items.map((item, index) => (
          <MenuItem
            key={index}
            onClick={() => handleDownload(item)}
            disabled={isDownloading}
          >
            <ListItemIcon sx={{ color: professionColor }}>
              {getFileIcon(item.type || 'other')}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" noWrap>
                  {item.filename}
                </Typography>
            }
              secondary={
                <Box sx={{ display: 'flex', justifyContent:'space-between' }}>
                  {item.description && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {item.description}
                    </Typography>
                  )}
                  {item.size && (
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(item.size)}
                    </Typography>
                  )}
                </Box>
            }
            />
          </MenuItem>
        ))}
        
        {items.length > 1 && (
          <>
            <MenuItem divider />
            <MenuItem
              onClick={() => {
                items.forEach(item => handleDownload(item));
            }}
              disabled={isDownloading}
              sx={{ 
                color: professionColor,
                fontWeight: 60
            }}
            >
              <ListItemIcon sx={{ color: professionColor }}>
                <CloudDownload />
              </ListItemIcon>
              <ListItemText primary="Last ned alle" />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}