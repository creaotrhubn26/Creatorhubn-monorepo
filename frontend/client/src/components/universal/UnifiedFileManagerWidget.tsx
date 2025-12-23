import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  LinearProgress,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  Fab
} from '@mui/material';
import {
  CloudUpload,
  Download,
  ExpandLess,
  Pause,
  PlayArrow,
  Close,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  FileDownload,
  CloudQueue,
  SwapVert
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import backgroundUploadService, { UploadTask } from '@/services/BackgroundUploadService';
import { backgroundDownloadService, type DownloadTask } from '@/services/BackgroundDownloadService';

// Import profession system hooks and utilities
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

interface UnifiedFileManagerWidgetProps {
  profession?: string;
  className?: string;
}

export function UnifiedFileManagerWidget({ 
  profession: professionProp,
  className = ''
}: UnifiedFileManagerWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = uploads, 1 = downloads
  
  // Use dynamic profession system
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters
  const professionAdapter = useProfessionAdapter();
  
  // Get current profession (from prop or dynamic system)
  const currentUserProfession = professionAdapter.profession || professionProp || 'photographer';
  const profession = currentUserProfession;
  
  // Get profession icon
  const professionIcon = getProfessionIcon(profession);
  
  // Get profession config
  const professionConfig = professionConfigs?.[profession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[profession] || professionConfig;
  
  // Get profession color from dynamic system
  const professionColor = getUserProfessionColor(profession) || '#FF6B35';
  
  // Upload state
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploadStats, setUploadStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalUploaded: 0,
    overallProgress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    averageSpeed: 0
});

  // Download state
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [downloadStats, setDownloadStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalDownloaded: 0,
    averageSpeed: 0
});

  // Update upload data
  const updateUploadData = () => {
    const currentTasks = backgroundUploadService.getAllTasks();
    const serviceStats = backgroundUploadService.getStats();
    setUploadTasks(currentTasks);
    // Map service stats to component state format
    setUploadStats({
      totalTasks: serviceStats.totalTasks,
      activeTasks: serviceStats.uploading,
      completedTasks: serviceStats.completed,
      failedTasks: serviceStats.failed,
      totalUploaded: serviceStats.uploadedBytes,
      overallProgress: serviceStats.overallProgress,
      uploadedBytes: serviceStats.uploadedBytes,
      totalBytes: serviceStats.totalBytes,
      averageSpeed: 0 // Calculate if needed
    });
};

  // Update download data
  const updateDownloadData = () => {
    const currentTasks = backgroundDownloadService.getAllTasks();
    const currentStats = backgroundDownloadService.getStats();
    setDownloadTasks(currentTasks);
    setDownloadStats(currentStats);
};

  useEffect(() => {
    // Upload listeners
    const handleUploadUpdate = () => updateUploadData();
    backgroundUploadService.on('tasksAdded', handleUploadUpdate);
    backgroundUploadService.on('taskStarted', handleUploadUpdate);
    backgroundUploadService.on('taskProgress', handleUploadUpdate);
    backgroundUploadService.on('taskCompleted', handleUploadUpdate);
    backgroundUploadService.on('taskFailed', handleUploadUpdate);
    backgroundUploadService.on('taskRetried', handleUploadUpdate);
    backgroundUploadService.on('taskPaused', handleUploadUpdate);
    backgroundUploadService.on('taskResumed', handleUploadUpdate);
    backgroundUploadService.on('taskCancelled', handleUploadUpdate);

    // Download listeners
    const unsubscribeDownload = backgroundDownloadService.addGlobalListener((allTasks) => {
      setDownloadTasks(allTasks);
      setDownloadStats(backgroundDownloadService.getStats());
  });

    // Initial load
    updateUploadData();
    updateDownloadData();

    // Update interval
    const interval = setInterval(() => {
      updateUploadData();
      updateDownloadData();
  }, 1000);

    return () => {
      backgroundUploadService.removeAllListeners();
      unsubscribeDownload();
      clearInterval(interval);
  };
}, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

  const formatSpeed = (bytesPerSec: number): string => {
    return `${formatFileSize(bytesPerSec)}/s`;
};

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
};

  const getUploadStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return <CloudUpload sx={{ color: professionColor }} />;
      case 'completed': return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'failed': return <ErrorIcon sx={{ color: '#f44336' }} />;
      case 'paused': return <Pause sx={{ color: '#ff9800' }} />;
      case 'queued': return <CloudQueue sx={{ color: '#666' }} />;
      default: return <CloudUpload sx={{ color: '#666' }} />;
  }
};

  const getDownloadStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading': return <Download sx={{ color: professionColor }} />;
      case 'completed': return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'failed': return <ErrorIcon sx={{ color: '#f44336' }} />;
      case 'paused': return <Pause sx={{ color: '#ff9800' }} />;
      default: return <FileDownload sx={{ color: '#666' }} />;
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
      case 'downloading': return professionColor;
      case 'completed': return '#4caf50';
      case 'failed': return '#f44336';
      case 'paused': return '#ff9800';
      default: return '#666';
  }
};

  const handleUploadTaskAction = (task: UploadTask, action: string) => {
    switch (action) {
      case 'pause': backgroundUploadService.pauseTask(task.id); break;
      case 'resume': backgroundUploadService.resumeTask(task.id); break;
      case 'cancel': backgroundUploadService.cancelTask(task.id); break;
      case 'retry': backgroundUploadService.retryTask(task.id); break;
  }
};

  const handleDownloadTaskAction = (task: DownloadTask, action: string) => {
    switch (action) {
      case 'pause': backgroundDownloadService.pauseDownload(task.id); break;
      case 'resume': backgroundDownloadService.resumeDownload(task.id); break;
      case 'cancel': backgroundDownloadService.cancelDownload(task.id); break;
      case 'retry': backgroundDownloadService.retryDownload(task.id); break;
  }
};

  const activeUploads = uploadTasks.filter(task => 
    ['queued','uploading','retrying','paused'].includes(task.status)
  );
  const activeDownloads = downloadTasks.filter(task => 
    ['pending','downloading','paused'].includes(task.status)
  );

  const totalActiveTasks = activeUploads.length + activeDownloads.length;
  const hasActiveTasks = totalActiveTasks > 0;

  if (!hasActiveTasks && !isExpanded) {
    return null;
}

  return (
    <AnimatePresence>
      {(hasActiveTasks || isExpanded) && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.8 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 170, // Posisjonert mellom SpeedDial og andre elementer
            zIndex: 130,
            minWidth: isExpanded ? 420 : 80,
            maxWidth: 500
        }}
          className={className}
        >
          <Box
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(00, 0.12)'
          }}
          >
            {/* Collapsed view - Combined FAB */}
            {!isExpanded && (
              <Tooltip title={`${totalActiveTasks} fil-operasjoner aktive`}>
                <Fab
                  size="medium"
                  onClick={() => setIsExpanded(true)}
                  sx={{
                    background: `linear-gradient(45deg, ${professionColor} 30%, ${professionColor}dd 90%)`,
                    color: 'white',
                    position: 'relative',
                    overflow: 'visible'
                }}
                >
                  <SwapVert />
                  {totalActiveTasks > 0 && (
                    <Chip
                      label={totalActiveTasks}
                      size="small"
                      color="error"
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        minWidth: 20,
                        height: 20,
                        fontSize: '0.7rem'
                    }}
                    />
                  )}
                </Fab>
              </Tooltip>
            )}

            {/* Expanded view */}
            <Collapse in={isExpanded}>
              <Box>
                {/* Header */}
                <Box
                  sx={{
                    p: 2,
                    background: `linear-gradient(135deg, ${professionColor}15 0%, ${professionColor}08 100%)`,
                    borderBottom: `1px solid ${professionColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {professionIcon && (
                      <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center', mr: 0.5 }}>
                        {professionIcon}
                      </Box>
                    )}
                    <Badge 
                      badgeContent={totalActiveTasks}
                      color="primary"
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: professionColor,
                          color: 'white'
                      }
                    }}
                    >
                      <SwapVert sx={{ color: professionColor }} />
                    </Badge>
                    <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600}}>
                      {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                        ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Fil-operasjoner`
                        : 'Fil-operasjoner'}
                    </Typography>
                  </Box>
                  
                  <IconButton 
                    size="small" 
                    onClick={() => setIsExpanded(false)}
                  >
                    <ExpandLess />
                  </IconButton>
                </Box>

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs 
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    sx={{
                      '& .MuiTab-root': {
                        minHeight: 48,
                        textTransform: 'none',
                        fontWeight: 60
                    }, '& .Mui-selected': {
                        color: `${professionColor} !important`
                    }, '& .MuiTabs-indicator': {
                        backgroundColor: professionColor
                    }
                  }}
                  >
                    <Tab 
                      icon={<CloudUpload />}
                      label={`Opplasting (${activeUploads.length})`}
                      iconPosition="start"
                    />
                    <Tab 
                      icon={<Download />}
                      label={`Nedlasting (${activeDownloads.length})`}
                      iconPosition="start"
                    />
                  </Tabs>
                </Box>

                {/* Upload Tab */}
                {activeTab === 0 && (
                  <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                    {/* Upload Stats */}
                    <Box sx={{ px: 2, py: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        size="small" 
                        label={`${uploadStats.activeTasks} aktive`}
                        sx={{ 
                          backgroundColor: `${professionColor}20`,
                          color: professionColor,
                          fontWeight: 60
                      }}
                      />
                      {uploadStats.averageSpeed > 0 && (
                        <Chip 
                          size="small" 
                          label={formatSpeed(uploadStats.averageSpeed)}
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <List dense>
                      {uploadTasks.slice(0, 10).map((task) => (
                        <ListItem key={task.id} sx={{ py: 1 }}>
                          <ListItemIcon>
                            {getUploadStatusIcon(task.status)}
                          </ListItemIcon>
                          
                          <ListItemText
                            primary={
                              <Typography variant="body2" noWrap>
                                {task.fileName}
                              </Typography>
                          }
                            secondary={
                              <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {task.status === 'uploading' ? (
                                      <>
                                        {formatFileSize(task.fileSize)}
                                        {task.uploadSpeed && ` • ${backgroundUploadService.formatSpeed(task.uploadSpeed)}`}
                                      </>
                                    ) : task.status === 'completed' ? (
                                      `Fullført • ${formatFileSize(task.fileSize)}`
                                    ) : task.status === 'failed' ? (
                                      task.error || 'Opplasting feilet'
                                    ) : task.status === 'paused' ? (
                                      'Pauset'
                                    ) : (
                                      'Venter...'
                                    )}
                                  </Typography>
                                  
                                  {task.estimatedTimeRemaining && task.status === 'uploading' && (
                                    <Typography variant="caption" color="text.secondary">
                                      {formatTimeRemaining(task.estimatedTimeRemaining)}
                                    </Typography>
                                  )}
                                </Box>
                                
                                {['uploading','queued'].includes(task.status) && (
                                  <LinearProgress
                                    variant="determinate"
                                    value={task.progress}
                                    sx={{
                                      height: 4,
                                      borderRadius: 2,
                                      backgroundColor: `${getStatusColor(task.status)}20`,
                                      '& .MuiLinearProgress-bar': {
                                        backgroundColor: getStatusColor(task.status)
                                    }
                                  }}
                                  />
                                )}
                              </Box>
                          }
                          />
                          
                          <ListItemSecondaryAction>
                            {task.status === 'uploading' && (
                              <Tooltip title="Pause">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleUploadTaskAction(task, 'pause')}
                                >
                                  <Pause fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {task.status === 'paused' && (
                              <Tooltip title="Fortsett">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleUploadTaskAction(task, 'resume')}
                                >
                                  <PlayArrow fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {task.status === 'failed' && (
                              <Tooltip title="Prøv igjen">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleUploadTaskAction(task, 'retry')}
                                >
                                  <Refresh fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {['queued','uploading','paused'].includes(task.status) && (
                              <Tooltip title="Avbryt">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleUploadTaskAction(task, 'cancel')}
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>

                    {uploadTasks.length === 0 && (
                      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                        <CloudUpload sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="body2">
                          Ingen aktive opplastinger
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Download Tab */}
                {activeTab === 1 && (
                  <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
                    {/* Download Stats */}
                    <Box sx={{ px: 2, py: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        size="small" 
                        label={`${downloadStats.activeTasks} aktive`}
                        sx={{ 
                          backgroundColor: `${professionColor}20`,
                          color: professionColor,
                          fontWeight: 60
                      }}
                      />
                      {downloadStats.averageSpeed > 0 && (
                        <Chip 
                          size="small" 
                          label={formatSpeed(downloadStats.averageSpeed)}
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <List dense>
                      {downloadTasks.slice(0, 10).map((task) => (
                        <ListItem key={task.id} sx={{ py: 1 }}>
                          <ListItemIcon>
                            {getDownloadStatusIcon(task.status)}
                          </ListItemIcon>
                          
                          <ListItemText
                            primary={
                              <Typography variant="body2" noWrap>
                                {task.filename}
                              </Typography>
                          }
                            secondary={
                              <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {task.status === 'downloading' ? (
                                      <>
                                        {formatFileSize(task.downloadedSize)}
                                        {task.totalSize && ` / ${formatFileSize(task.totalSize)}`}
                                        {task.downloadSpeed && ` • ${formatSpeed(task.downloadSpeed)}`}
                                      </>
                                    ) : task.status === 'completed' ? (
                                      `Fullført • ${formatFileSize(task.downloadedSize)}`
                                    ) : task.status === 'failed' ? (
                                      task.error || 'Nedlasting feilet'
                                    ) : task.status === 'paused' ? (
                                      'Pauset'
                                    ) : (
                                      'Venter...'
                                    )}
                                  </Typography>
                                  
                                  {task.estimatedTimeRemaining && task.status === 'downloading' && (
                                    <Typography variant="caption" color="text.secondary">
                                      {formatTimeRemaining(task.estimatedTimeRemaining)}
                                    </Typography>
                                  )}
                                </Box>
                                
                                {['downloading','pending'].includes(task.status) && (
                                  <LinearProgress
                                    variant="determinate"
                                    value={task.progress}
                                    sx={{
                                      height: 4,
                                      borderRadius: 2,
                                      backgroundColor: `${getStatusColor(task.status)}20`,
                                      '& .MuiLinearProgress-bar': {
                                        backgroundColor: getStatusColor(task.status)
                                    }
                                  }}
                                  />
                                )}
                              </Box>
                          }
                          />
                          
                          <ListItemSecondaryAction>
                            {task.status === 'downloading' && (
                              <Tooltip title="Pause">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDownloadTaskAction(task, 'pause')}
                                >
                                  <Pause fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {task.status === 'paused' && (
                              <Tooltip title="Fortsett">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDownloadTaskAction(task, 'resume')}
                                >
                                  <PlayArrow fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {task.status === 'failed' && (
                              <Tooltip title="Prøv igjen">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDownloadTaskAction(task, 'retry')}
                                >
                                  <Refresh fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {['pending','downloading','paused'].includes(task.status) && (
                              <Tooltip title="Avbryt">
                                <IconButton 
                                  size="small" 
                                    onClick={() => handleDownloadTaskAction(task, 'cancel')}
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>

                    {downloadTasks.length === 0 && (
                      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                        <Download sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="body2">
                          Ingen aktive nedlastinger
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Footer Actions */}
                {isExpanded && (
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderTop: '1px solid rgba(00, 0.08)',
                      textAlign: 'center'
                  }}
                  >
                    {activeTab === 0 && uploadStats.completedTasks > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ 
                          cursor: 'pointer',
                          color: professionColor,
                          '&:hover': { textDecoration: 'underline' }
                      }}
                        onClick={() => backgroundUploadService.clearCompleted()}
                      >
                        Fjern fullførte opplastinger ({uploadStats.completedTasks})
                      </Typography>
                    )}
                    
                    {activeTab === 1 && downloadStats.completedTasks > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ 
                          cursor: 'pointer',
                          color: professionColor,
                          '&:hover': { textDecoration: 'underline' }
                      }}
                        onClick={() => backgroundDownloadService.clearCompleted()}
                      >
                        Fjern fullførte nedlastinger ({downloadStats.completedTasks})
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}