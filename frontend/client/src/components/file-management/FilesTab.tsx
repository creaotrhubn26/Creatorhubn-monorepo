// @ts-nocheck
 
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  FolderOpen,
  InsertDriveFile,
  Delete,
  CloudUpload,
  Sync,
  Visibility,
  Edit,
  Link as LinkIcon,
  Download,
  Share,
  Search,
  Undo,
  Redo,
  Backup,
  RestoreFromTrash,
  Build,
  AutoFixHigh,
  Lightbulb,
  RocketLaunch as Rocket,
  Construction,
  PhotoCamera,
  Palette,
  LocalShipping,
  Assignment,
  Chat,
  EventNote,
  Security,
  Collections,
  PhotoLibrary,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface FilesTabProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId?: string;
  // Integration props for universal connectivity
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void; 
}

interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
  mimeType: string; 
}

interface Project {
  id: string;
  title: string;
  type: string; 
}

const FilesTab: React.FC<FilesTabProps> = ({ 
  profession, 
  userId = '1', 
  onFileUpload,
  onFileDownload,
  onProjectUpdate,
  selectedProject,
  onProjectSelect
}) => {
  // Removed custom folder creation - all folders must follow system structure

  const queryClient = useQueryClient();

  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  const { auth } = useEnhancedMasterIntegration();

  // Fetch user's Google Drive folders
  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: [ '/api/google-drive/folders,', userId],
    queryFn: () => apiRequest(`/api/google-drive/folders?userId=${userId}`)
  });

  // Fetch user's projects for folder relations
  const { data: projects } = useQuery({
    queryKey: ['/api/projects,', userId],
    queryFn: () => apiRequest(`/api/projects?userId=${userId}`)
  });

  // Fetch current folder structure settings
  const { data: folderSettings } = useQuery({
    queryKey: ['/api/settings/folder-structure', userId],
    queryFn: () => apiRequest(`/api/settings/folder-structure?userId=${userId}`)
  });

  // Folder creation removed - all folders must be created via standard project structure

  // Sync folders mutation
    // Sync folders mutation
    const syncFoldersMutation = useMutation({
      mutationFn: async () => {
        const authHeaders = await auth.getAuthHeader();
        return apiRequest('/api/google-drive/sync', {
          headers: authHeaders,
          method: 'POST',
          body: JSON.stringify({ userId, profession }),
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/google-drive/folders'] });
        console.log('Zero Toast Compliance: Mapper synkronisert!, '); // No toast - using console only
      },
    });
    // Folder change tracking mutation - tracks and validates changes
    const trackFolderChangesMutation = useMutation({
      mutationFn: async (changes?: any[]) => {
        const authHeaders = await auth.getAuthHeader();
        return apiRequest('/api/google-drive/track-folder-changes', {
          headers: authHeaders,
          method: 'POST',
          body: JSON.stringify({
            userId,
            projectId: 'current',
            changes,
            action: 'validate',
          }),
        });
      },
      onSuccess: (data) => {
        if (data.validation && !data.validation.isValid) {
          console.log(
            `📝 Mappeendringer oppdaget: ${data.validation.deviations?.length || 0} avvik fra standard`
          );
          setChangeHistory(data.history);
        } else {
          console.log('✅ Alle mapper følger systemstandarden');
        }
      },
    });
  
  // Undo/Redo functionality
  const undoRedoMutation = useMutation({
    mutationFn: async (action: 'undo' | 'redo') => {
      const authHeaders = await auth.getAuthHeader();
      return apiRequest('/api/google-drive/undo-folder-changes', {
        headers: authHeaders,
        method: 'POST',
        body: JSON.stringify({
          userId,
          projectId: 'current',
          action,
        }),
      });
    },
    onSuccess: (data) => {
      console.log(
        `${data.result?.action === 'undo' ? '↩️ Angret' : '↪️ Gjentatt'} ${
          data.result?.changesReverted || 0 } endringer`
      );
      queryClient.invalidateQueries({ queryKey: ['/api/google-drive/folders'] });
    },
  });

  // State for change history tracking and dialogs
  const [changeHistory, setChangeHistory] = useState<any>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreComplete, setRestoreComplete] = useState(false);

  // Enhanced restore standard structure mutation with full user experience
  const restoreStandardMutation = useMutation({
    mutationFn: async () => {
      setIsRestoring(true);
      setRestoreComplete(false);

      const authHeaders = await auth.getAuthHeader();
      return apiRequest('/api/google-drive/restore-standard-structure', {
        headers: authHeaders,
        method: 'POST',
        body: JSON.stringify({
          userId,
          projectId: 'current',
          confirmRestore: true,
        }),
      });
    },
    onSuccess: (data) => {
      console.log(`🔄 Gjenopprettet standardstruktur: ${data.restoration?.restoredFolders || 0} mapper`);

      // Simulate realistic restoration time (2-3 seconds)
      setTimeout(() => {
        setIsRestoring(false);
        setRestoreComplete(true);
        queryClient.invalidateQueries({ queryKey: ['/api/google-drive/folders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/settings/folder-structure'] });
        setChangeHistory(null);

        // Auto-close success dialog after 3 seconds
        setTimeout(() => {
          setRestoreComplete(false);
          setShowRestoreDialog(false);
        }, 3000);
      }, 2500);
    },
    onError: () => {
      setIsRestoring(false);
      setRestoreComplete(false);
    },
  });

  // Handle restore button click - show confirmation dialog first
  const handleRestoreClick = () => {
    setShowRestoreDialog(true);
};

  // Handle confirmed restore with backup first
  const handleConfirmedRestore = () => {
    // First create backup, then restore
    backupFolderStructureMutation.mutate(`Automatisk backup før gjenoppretting ${new Date().toLocaleString('no-NO')}`);
    restoreStandardMutation.mutate();
};

  // Backup folder structure
  const backupFolderStructureMutation = useMutation({
    mutationFn: async (backupName?: string) => {
      const authHeaders = await auth.getAuthHeader();
      return apiRequest('/api/google-drive/backup-folder-structure', {
        headers: authHeaders,
        method: 'POST',
        body: JSON.stringify({
          userId,
          projectId: 'current',
          backupName,
        }),
      });
    },
    onSuccess: (data) => {
      console.log(
        `💾 Backup opprettet: ${
          data?.backup?.folderStructure?.length || 0 } mapper sikkerhetskopiert`
      );
      queryClient.invalidateQueries({ queryKey: ['/api/google-drive/folders'] });
    },
  });

  const getProfessionConfig = () => {
    switch (profession) {
      case 'photographer':
        return { color: '#ff8c00', label: getProfessionDisplayName('photographer') };
      case 'videographer':
        return { color: '#e74c3c', label: getProfessionDisplayName('videographer') };
      case 'music_producer':
        return { color: '#9b59b6', label: getProfessionDisplayName('music_producer') };
      case 'vendor':
        return { color: '#27ae60', label: getProfessionDisplayName('vendor') };
      default: return { color: '#ff8c00', label: getProfessionDisplayName('photographer') };
    }
  };

  const config = getProfessionConfig();

  // Generate dynamic folder structure display
  const getfolderStructureText = () => {
    if (folderSettings?.customStructure?.length > 0) {
      return folderSettings.customStructure.join(' • ');
}
    // Default 8-folder structure
    return 'RAW - Originale bilder • Bearbeidede bilder • Leveranse til klient • Kontrakter og dokumenter • Kommunikasjon • Timeline og notater • Backup og sikkerhetskopier • Referansebilder og inspirasjon';
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header with Google Drive logo and connection status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          {/* Google Drive logo */}
          <Box sx={{
            width:  40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M7.71 3.5L1.15 15h4.58l2.5-4.33 5.08-8.17H7.71z"/>
              <path d="M13.73 15l2.5 4.33h5.08L16.23 15H13.73z"/>
              <path d="M8.25 15l-2.5 4.33h8.5L16.75 15H8.25z"/>
            </svg>
          </Box>
          <Box>
            <Typography variant="h4" sx={{  fontWeight: 600, color: config.color, mb: 0.5 }}>
              Google Drive Filer
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Box sx={{ 
                width:  8, 
                height:  8, 
                borderRadius: '50%', 
                bgcolor: 'success.main',
                animation: 'pulse 2s infinite'
            }} />
              <Typography variant="caption" color="text.secondary">
                Tilkoblet Google Drive
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Change Tracking & Validation */}
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('search')}
            onClick={() => trackFolderChangesMutation.mutate()}
            disabled={trackFolderChangesMutation.isPending}
            sx={{ borderColor: 'warning.main', color: 'warning.main' }}
          >
            Spor Endringer
          </Button>
          
          {/* Undo/Redo Controls */}
          {changeHistory && (
            <>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('undo')}
                onClick={() => undoRedoMutation.mutate('undo')}
                disabled={undoRedoMutation.isPending || !changeHistory?.canUndo}
                sx={{ borderColor: 'error.main', color: 'error.main' }}
              >
                Angre
              </Button>
              <Button
                variant="outlined" 
                startIcon={theming.getThemedIcon('redo')}
                onClick={() => undoRedoMutation.mutate('redo')}
                disabled={undoRedoMutation.isPending || !changeHistory?.canRedo}
                sx={{ borderColor: 'success.main', color: 'success.main' }}
              >
                Gjenta
              </Button>
            </>
          )}

          {/* Backup & Restore */}
          <Button
            variant="outlined"
            startIcon={<Backup />}
            onClick={() => backupFolderStructureMutation.mutate()}
            disabled={backupFolderStructureMutation.isPending}
            sx={{ borderColor: 'info.main', color: 'info.main' }}
          >
            Sikkerhetskopi
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<RestoreFromTrash />}
            onClick={handleRestoreClick}
            disabled={restoreStandardMutation.isPending || isRestoring}
              sx={{ borderColor: 'error.main', color: 'error.main' }}
          >
            Gjenopprett Standard
          </Button>

          {/* Standard Sync */}
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('sync')}
            onClick={() => syncFoldersMutation.mutate()}
            disabled={syncFoldersMutation.isPending}
            sx={{ borderColor: config.color, color: config.color }}
          >
            Synkroniser
          </Button>
        </Box>
      </Box>

      {/* Enhanced Information Card */}
      <Paper sx={{ 
        p: 0,
        mb: 3, 
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(30,64,175,0.25) 0%, rgba(30,64,175,0.15) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        overflow: 'hidden' ,  ...theming.getThemedCardSx() }}>
        {/* Header */}
        <Box sx={{ 
          p:  3, 
          pb:  2,
          background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
          color: 'white'
      }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb:  1 }}>
            <Box sx={{ 
              p: 1,
              borderRadius: 2,  
              bgcolor: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
          }}>
                <FolderOpen sx={{ fontSize: 2 }} />
            </Box>
            <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>
              Standardisert mappestruktur-system
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.5, lineHeight: 1.6}}>
            Alle Google Drive-mapper opprettes automatisk med standardisert 8-mapper struktur. 
            Hvis du endrer mappenavn manuelt, bruker systemet "Valider Struktur" for å oppdage endringer og foreslå korrigeringer.
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ p:  3, pt:  2 }}>
          {/* Folder Structure Display */}
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600,
            color: 'text.primary',
              mb:  2,
              display: 'flex',
              alignItems: 'center',
              gap: 1}}>
            <Box sx={{
              width:  4,
              height:  20,
              bgcolor: 'rgba(255,255,255,0.5)',
              borderRadius: 1}} />
            Mappestruktur
          </Typography>
          
          <Grid container spacing={1} sx={{ mb:  3 }}>
            {(folderSettings?.customStructure || [
              'RAW - Originale bilder','Bearbeidede bilder','Leveranse til klient','Kontrakter og dokumenter','Kommunikasjon','Timeline og notater','Backup og sikkerhetskopier', 'Referansebilder og inspirasjon'
            ]).map((folder, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap:  1,
                  p: 1.5,
                  bgcolor: 'rgba(6, 115, 232, 0.05)',
                  borderRadius:  2,
                  border: '1px solid rgba(6, 115, 232, 0.1)',
                  transition: 'all 0.2s ease', '&:hover': {
                    bgcolor: 'rgba(6, 115, 232, 0.1)',
                    transform: 'translateY(-2px)'
                  }
            }}>
                  <FolderOpen sx={{ fontSize:  16, color: 'primary.main' }} />
                  <Typography variant="caption" sx={{ 
                    fontWeight: 500,
                    color: 'text.secondary'
                }}>
                    {folder}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Change History Status */}
          {changeHistory && (
            <Box sx={{ 
              p: 2,
              borderRadius:  2,
              bgcolor: 'success.light',
              border: '1px solid success.main',
              display: 'flex',
              alignItems: 'center',
              gap:  2,
              mb: 2}}>
              <Box sx={{ 
                p: 0,
                borderRadius:  1,
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Search sx={{ fontSize:  16, color: 'success.main' }} />
              </Box>
              <Box sx={{ flex:  1 }}>
                <Typography variant="subtitle2" sx={{ 
                  fontWeight: 600,
                  color: 'success.main',
                  mb: 0.5 }}>
                  Endringshistorikk aktivert
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: 'text.secondary',
                  lineHeight: 1.5 }}>
                  {changeHistory.totalChanges} endringer sporet - Du kan nå angre/gjenta operasjoner
                </Typography>
              </Box>
            </Box>
          )}

          {/* Warning */}
          <Box sx={{ 
            p: 2, 
            borderRadius:  2,
            bgcolor: 'warning.light',
            border: '1px solid warning.main',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2 }}>
            <Box sx={{ 
              p: 0,
              borderRadius:  1,
              bgcolor: 'warning.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mt: 0.5 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="warning.main">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </Box>
            <Box sx={{ flex:  1 }}>
              <Typography variant="subtitle2" sx={{ 
                fontWeight: 600,
                color: 'warning.main',
                mb: 0.5 }}>
                Fleksibel mappestruktur med gjenoppretting
              </Typography>
              <Typography variant="body2" sx={{ 
                color: 'text.secondary',
                lineHeight: 1.5,
                mb: 1 }}>
                Du kan endre mappenavn etter behov. Systemet sporer alle endringer og lar deg angre/gjenta operasjoner.
              </Typography>
              <Typography variant="body2" sx={{ 
                color: 'text.secondary',
                lineHeight: 1.5,
                fontWeight: 500}}>
                💡 Tips: Bruk "Sikkerhetskopi" før store endringer og "Gjenopprett Standard" for å tilbakestille til systemstandard.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

 {/* Folders Grid */}

      {foldersLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
            <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : (
        <Grid container spacing={1}>
          {folders?.map((folder: DriveFolder) => (
            <Grid item xs={12} sm={6} md={4} key={folder.id}>
              <MuiCard sx={{ 
                height: '100%',
                transition: 'transform 0.2s ease','&:hover': { transform: 'translateY(-4px)'},
                border: `1px solid ${'primary.main'}20`
          }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1, mb:  2 }}>
                    <FolderOpen sx={{ color: 'primary.main', fontSize: 3 }} />
                    <Box sx={{ flexGrow:  1 }}>
                      <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>
                        {folder.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Opprettet: {new Date(folder.createdTime).toLocaleDateString(', ')}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Sist endret: {new Date(folder.modifiedTime).toLocaleDateString(', ')}
                  </Typography>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb:  2 ,  ...theming.getThemedCardSx() }}>
                  <Button
                    size="small"
                    startIcon={theming.getThemedIcon('visibility')}
                    href={folder.webViewLink}
                    target="_blank"
                    sx={{ color: 'primary.main' }}
                  >
                    Åpne
                  </Button>
                  <Button
                    size="small"
                    startIcon={theming.getThemedIcon('share')}
                    sx={{ color: 'primary.main' }}
                  >
                    Del
                  </Button>
                </CardActions>
              </MuiCard>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty state */}
      {!foldersLoading && (!folders || folders.length === 0) && (
        <Paper sx={{ p:  4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' ,  ...theming.getThemedCardSx() }}>
          <FolderOpen sx={{ fontSize:  64, color: 'rgba(255,255,255,0.5)', mb:  2 }} />
          <Typography variant="h6" sx={{  mb:  1, color: '#fff'  }}>
            Ingen prosjektmapper funnet
          </Typography>
          <Typography variant="body2" sx={{ mb:  3, color: 'rgba(255,255,255,0.7)' }}>
            Prosjektmapper vises her når du oppretter dem via Google Drive-integrasjonen.
            Alle mapper følger systemets standardiserte struktur som definert i innstillinger.
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>
            💡 Tip: Bruk "Opprett Prosjektmappe" funksjonen i Google Drive-seksjonen for å lage strukturerte prosjektmapper
          </Typography>
        </Paper>
     )}

      {/* Gallery Management Section - Only for photographers */}
      {profession === 'photographer' && (
        <Box sx={{ mt:  4 }}>
          <Paper sx={{ 
            p:  0,
            borderRadius:  3,
            background: 'linear-gradient(135deg, info.light 0%, info.main 100%)',
            border: '1px solid info.main',
            overflow: 'hidden'
        ,  ...theming.getThemedCardSx() }}>
            {/* Header */}
            <Box sx={{ 
              p:  3, 
              pb:  2,
                background: 'linear-gradient(135deg, info.light 0%, info.main 100%)',
              color: 'info.main'
          }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1, mb:  1 }}>
                <Box sx={{ 
                  p: 1,
                  borderRadius: 2,
                  bgcolor: 'info.light',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center' }}>
                  <Collections sx={{ fontSize: 2 }} />
                </Box>
                <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>
                  Galleristyring & Klientleveranse
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.5, lineHeight: 1.6}}>
                Administrer og del gallerier med klienter. Opprett private eller offentlige gallerier for prosjektleveranse.
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p:  3, pt:  2 }}>
              <Box sx={{ display: 'flex', gap: 2, mb:  3, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={theming.getThemedIcon('photoLibrary')}
                  onClick={() => window.open('/gallery-manager', '_blank')}
                  sx={{
                    ...theming.getThemedButtonSx(),
                    bgcolor: 'secondary.light','&:hover': { bgcolor: 'secondary.main' }}}
                >
                  Åpne Galleristyring
                </Button>
                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('collections')}
                  sx={{ 
                      borderColor: 'secondary.main',
                    color: 'primary.main','&:hover': { 
                      borderColor: 'secondary.main',
                      bgcolor: 'secondary.light'
                },
                    borderRadius: 2 }}
                >
                  Nytt galleri
                </Button>
              </Box>

              {/* Quick Stats */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'secondary.light',
                      border: '1px solid',
                      borderColor: 'secondary.main' }}
                  >
                    <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600 }}>
                      3
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Aktive gallerier
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'secondary.light',
                      border: '1px solid',
                      borderColor: 'secondary.main',
                      textAlign: 'center' }}
                >
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary, fontWeight: 600}}
                  >
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Totale visninger
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'secondary.light',
                      border: '1px solid',
                      borderColor: 'secondary.main' }}
                  >
                    <Typography
                      variant="h6"
                      sx={{ color: theming.colors.primary, fontWeight: 600}}
                    >
                      45
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Nedlastinger
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Recent Galleries */}
              <Typography variant="subtitle2" sx={{ 
                fontWeight: 600,
                color: 'text.primary',
                mt:  3,
                mb:  2,
                display: 'flex',
                alignItems: 'center',
                gap: 1 }}>
                <Box sx={{ 
                  width:  4, 
                  height:  20, 
                    bgcolor: 'secondary.main', 
                  borderRadius: 1 }} />
                Siste gallerier
              </Typography>

              <List>
                {[
                  { name: 'Bryllup - Anna & Ole', status: 'Aktiv', views: 12,},
                  { name: 'Bedriftsfotografering - TechCorp', status: 'Fullført', views: 8,},
                  { name: 'Familie Hansen', status: 'Utkast', views:  0 }
                ].map((gallery, index) => (
                  <ListItem key={index} sx={{ 
                    borderRadius:  2,
                    mb:  1,
                    bgcolor: 'secondary.light',
                    border: '1px solid secondary.main'
              }}>
                    <ListItemIcon>
                      <PhotoLibrary sx={{ color: 'secondary.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={gallery.name}
                      secondary={`${gallery.status} • ${gallery.views} visninger`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" size="small">
                        <Visibility sx={{ color: 'secondary.main' }} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Zero Toast Compliance - All user feedback through Material UI components only */}

      {/* Engaging Restore Confirmation Dialog */}
      <Dialog 
        open={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(15,23,42,0.94)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff' }
    }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap:  2,
            background: 'linear-gradient(90deg, info.light 0%, info.main 100%)',
          color: 'info.main',
          mb: 2 }}>
          <RestoreFromTrash />
          {!isRestoring && !restoreComplete && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              Tilbakestill til standardstruktur?
              <RestoreFromTrash sx={{ fontSize: 2}} />
            </Box>
          )}
          {isRestoring && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              Vent litt, så hjelper vi deg med å havne på rett spor igjen!
                <Construction sx={{ fontSize: 2}} />
            </Box>
          )}
          {restoreComplete && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              Flott! Alt er gjenopprettet og skal fungere igjen!
              <CheckCircle sx={{ fontSize:  20, color: 'success.main' }} />
            </Box>
          )}
        </DialogTitle>
        
        <DialogContent>
          {!isRestoring && !restoreComplete && (
            <>
              {/* Fun and engaging Smart Backup Alert */}
              <Alert 
                severity="info" 
                sx={{ 
                  mb:  3,
                  backgroundColor: 'info.light',
                  border: '1px solid info.main',
                  borderRadius: 2
              }}
                icon={<Lightbulb sx={{ color: 'info.main' }} />}
              >
                <AlertTitle sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', gap: 1, fontWeight: 700}}>
                  <AutoFixHigh sx={{ fontSize: 2}} />
                  Ikke bekymre deg - vi tar hånd om alt!
                </AlertTitle>
                <Typography variant="body2" sx={{ mt: 1, flexGrow: 1, color: 'text.secondary',   lineHeight: 1.6}}>
                  Vi lager automatisk en trygg sikkerhetskopi før vi starter oppryddingen. 
                  Du finner den i "Backup og sikkerhetskopier"-mappen senere hvis du trenger den.
                </Typography>
              </Alert>
              
              {/* Engaging description with better visual hierarchy */}
              <Box sx={{ 
                p:  3, 
                mb:  3,
                background: 'linear-gradient(135deg, warning.light 0%, warning.main 100%)',
                borderRadius:  2,
                border: '1px solid warning.main'
          }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', gap: 2, mb:  2 }}>
                  <Construction sx={{ color: 'warning.main', fontSize: 2}} />
                  <Typography variant="h6" sx={{  flexGrow: 1, color: 'warning.main',   
                    fontWeight: 700, 
                    background: 'linear-gradient(45deg, warning.light, warning.main)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                 }}>
                    Tid for en kreativ oppfriskning!
                  </Typography>
                </Box>
                
                <Typography variant="body1" sx={{ 
                  mb: 2,
                  flexGrow: 1,
                  color: 'text.secondary',
                  lineHeight: 1.7,
                  fontSize: '1.05rem'
              }}>
                  Vi setter alt tilbake til den perfekte, ryddige strukturen som hjelper deg å jobbe mer effektivt. 
                  Som å få et helt nytt, organisert arbeidsrom!
                </Typography>
              </Box>

              {/* Visual folder structure preview with icons */}
              <Box sx={{ 
                p:  3, 
                background: 'linear-gradient(135deg, info.light 0%, info.main 100%)',
                  borderRadius:  2,
                  border: '1px solid info.main',
                position: 'relative',
                overflow: 'hidden'
            ,  ...theming.getThemedCardSx() }}>
                {/* Decorative background pattern */}
                <Box sx={{
                  position: 'absolute',
                  top:  0,
                  right:  0,
                  opacity: 0.1,
                  transform: 'rotate(15deg)',
                  fontSize: 60 }}>
                  <Rocket />
                </Box>
                
                <Typography variant="h6" sx={{  
                  fontWeight: 700, 
                  color: 'text.primary', 
                  mb:  2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
               }}>
                  <AutoFixHigh sx={{ color: 'text.primary' }} />
                  Din nye, organiserte mappestruktur: </Typography>
                
                <Grid container spacing={1.5}>
                  {[
                    { name: 'RAW - Originale bilder', icon: 'PhotoCamera' },
                      { name: 'Bearbeidede bilder', icon: 'Palette' },
                    { name: 'Leveranse til klient', icon: 'LocalShipping' },
                    { name: 'Kontrakter og dokumenter', icon: 'Assignment' },
                    { name: 'Kommunikasjon', icon: 'Chat' },
                    { name: 'Timeline og notater', icon: 'EventNote' },
                    { name: 'Backup og sikkerhetskopier', icon: 'Security' },
                    { name: 'Referansebilder og inspirasjon', icon: 'AutoFixHigh' }
                  ].map((folder, index) => {
                    const iconComponents: { [key: string]: any } = {
                      PhotoCamera: <PhotoCamera sx={{ fontSize: 18, color: 'info.main' }} />,
                      Palette: <Palette sx={{ fontSize: 18, color: 'info.main' }} />,
                      LocalShipping: <LocalShipping sx={{ fontSize: 18, color: 'info.main' }} />,
                      Assignment: <Assignment sx={{ fontSize: 18, color: 'info.main' }} />,
                      Chat: <Chat sx={{ fontSize: 18, color: 'info.main' }} />,
                      EventNote: <EventNote sx={{ fontSize: 18, color: 'info.main' }} />,
                      Security: <Security sx={{ fontSize: 18, color: 'info.main' }} />,
                      AutoFixHigh: <AutoFixHigh sx={{ fontSize: 18, color: 'info.main' }} />
                };
                    
                    return (
                      <Grid item xs={12} sm={6} key={index}>
                        <Paper sx={{ 
                          p: 1.5,
                          backgroundColor: 'rgba(255, 255, 255, 0.72)',
                          border: '1px solid info.main',
                          borderRadius:  1,
                          transition: 'all 0.2','&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            transform: 'translateY(-1px)'
                        }
                    ,  ...theming.getThemedCardSx() }}>
                          <Typography variant="body2" sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap:  1,
                            fontWeight: 500,
                            color: 'info.main'
                        }}>
                            {iconComponents[folder.icon]}
                            {folder.name}
                          </Typography>
                        </Paper>
                      </Grid>
                  );
              })}
                </Grid>
              </Box>
            </>
          )}

          {isRestoring && (
            <>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                gap:  3, 
                mb:  3,
                p:  3,
                background: `linear-gradient(135deg, info.light 0%, info.main 100%)`,
                borderRadius:  3,
                border: `2px solid info.main`
          }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                  <Construction 
                    sx={{ 
                      color: 'info.main', 
                      fontSize:  40,
                      animation: 'spin 2s linear infinite','@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' }
                  }
                }}
                  />
                    <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{  
                      color: 'info.main', 
                      fontWeight: 700,
                      mb: 0.5
                   }}>
                      Magien skjer nå!
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      color: 'text.secondary',
                      fontSize: '1.1rem'
                  }}>
                      Vi organiserer alt på den smarteste måten for deg...
                    </Typography>
                  </Box>
                </Box>
                
                <LinearProgress 
                  sx={{ 
                    width: '100%',
                    height:  12,
                    borderRadius:  6,
                    backgroundColor: 'rgba(255, 255, 255, 0.22)','& .MuiLinearProgress-bar': {
                      background: `linear-gradient(90deg, info.light 0%, info.main 50%, success.main 100%)`,
                      borderRadius: 6
                  }
              }}
                />
                
                <Box sx={{ 
                  textAlign: 'center',
                  p:  2,
                  backgroundColor: 'rgba(255, 255, 255, 0.56)',
                  borderRadius:  2,
                  border: '1px solid rgba(255, 255, 255, 0.22)'
            }}>
                  <Typography variant="h6" sx={{  
                    fontStyle: 'italic', 
                    color: 'info.main',
                    fontWeight: 60
                   , display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                 }}>
                    <Lightbulb sx={{ color: 'warning.main' }} />
                    En ryddig mappe er en kreativ hjerne!
                  </Typography>
                </Box>
              </Box>
            </>
          )}

          {restoreComplete && (
            <Box sx={{ 
              textAlign: 'center', 
              py:  4,
              background: `linear-gradient(135deg, info.light 0%, info.main 100%)`,
              borderRadius:  3,
              border: `2px solid info.main`
        }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: 2, mb: 3 
            }}>
                <CheckCircle sx={{ 
                  fontSize:  72, 
                  color: 'info.main',
                  animation: 'bounce 1s ease-in-out','@keyframes bounce': {
                    '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' }, '40%': { transform: 'translateY(-10px)' }, '60%': { transform: 'translateY(-5px)' }
              }
            }} />
                <Rocket sx={{ 
                  fontSize:  48, 
                  color: 'info.main',
                  animation: 'rocket 2s ease-in-out infinite','@keyframes rocket': {
                    '0%, 100%': { transform: 'translateY(0px) rotate(-10deg)' }, '50%': { transform: 'translateY(-8px) rotate(-10deg)' }
              }
            }} />
              </Box>
              
              <Typography variant="h4" sx={{  
                  color: 'info.main', 
                mb: 2, fontWeight: 8,
                background: `linear-gradient(45deg, info.light, info.main)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
             }}>
                Fantastisk! Du er klar for suksess!
              </Typography>
              
              <Typography variant="h6" sx={{  
                color: 'text.primary', 
                mb:  3,
                fontWeight: 50
             }}>
                Din kreative arbeidsflyt er nå optimalisert til perfektion
              </Typography>
              
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 2, mb:  3,
                flexWrap: 'wrap'
            }}>
                <Chip 
                  icon={theming.getThemedIcon('autoFixHigh')}
                  label="Mappestruktur: Perfekt!" 
                  variant="filled"
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '1rem',
                    padding: '8px 4px',
                    backgroundColor: 'info.main',
                    color: 'white','& .MuiChip-icon': { color: 'white' }
              }}
                />
                <Chip 
                  icon={<Backup />}
                  label="Sikkerhetskopi: Trygt lagret!" 
                  variant="filled"
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '1rem',
                    padding: '8px 4px',
                    backgroundColor: 'info.main',
                    color: 'white', '& .MuiChip-icon': { color: 'white' }
              }}
                />
              </Box>
              
              <Typography variant="body1" sx={{ 
                color: 'text.secondary', 
                mb:  2,
                maxWidth: 40,
                margin: '0 auto 16px'
            }}>
                Alle filene dine er trygge, organiserte og klar for din neste kreative utfordring. 
                La oss skape noe utrolig!
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        {!isRestoring && !restoreComplete && (
          <DialogActions sx={{ p:  3, gap:  2 }}>
            <Button 
              onClick={() => setShowRestoreDialog(false)}
              variant="outlined"
              sx={{ borderColor: 'text.secondary', color: 'text.secondary' }}
            >
              Avbryt
            </Button>
            <Button onClick={handleConfirmedRestore}
              variant="contained"
              startIcon={<RestoreFromTrash />}
              sx={{
                ...theming.getThemedButtonSx(),
                background: 'linear-gradient(90deg, warning.light 0%, warning.main 100%)',
                '&:hover': {
                  ...(theming.getThemedButtonSx()['&:hover'] ?? {}),
                  background: 'linear-gradient(90deg, warning.main 0%, warning.light 100%)',
                },
              }}
            >
              Ja, gjenopprett til standard! 
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
);
};

export default FilesTab;
