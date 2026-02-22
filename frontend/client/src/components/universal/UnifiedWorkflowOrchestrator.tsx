import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Schedule,
  Work,
  Person,
  FileDownload,
  FileUpload,
  Notifications,
  Timeline,
} from '@mui/icons-material';

interface WorkflowEvent {
  id: string;
  type: 'meeting' | 'project' | 'worklog' | 'file_upload' | 'file_download' | 'client' | 'showcase';
  title: string;
  description: string;
  timestamp: string;
  source: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'error'
}

interface UnifiedWorkflowOrchestratorProps {
  profession: string;
  userId: string;
  selectedProject?: any;
  selectedClient?: any;
  selectedEquipment?: any;
  onProjectSelect?: (project: any) => void;
  onClientSelect?: (client: any) => void;
  onEquipmentSelect?: (equipment: any) => void
}

const UnifiedWorkflowOrchestrator: React.FC<UnifiedWorkflowOrchestratorProps> = ({
  profession,
  userId,
  selectedProject,
  selectedClient,
  selectedEquipment,
  onProjectSelect,
  onClientSelect,
  onEquipmentSelect
}) => {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Unified callback system that all components can use
  const unifiedCallbacks = {
    // Meeting Management
    onMeetingCreate: useCallback((meeting: any) => {
      console.log('🎯 Universal Meeting Created, :', meeting);
      
      const event: WorkflowEvent = {
        id: `meeting_${Date.now()}`,
        type: 'meeting',
        title: `Meeting: ${meeting.title}`,
        description: `Scheduled meeting with ${meeting.clientName || 'client'}`,
        timestamp: new Date().toISOString(),
        source: meeting.source || 'unknown',
        data: meeting,
        status: 'completed'
  };
      
      setWorkflowEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', ],});
      
      // Auto-schedule worklog entry
      if (selectedProject) {
        const worklogEntry = {
          id: `worklog_${Date.now()}`,
          projectId: selectedProject.d,
          type: 'meeting',
          title: `Meeting: ${meeting.title}`,
          description: `Meeting scheduled with ${meeting.clientName}`,
          duration:  60, // Default 1 hour
          timestamp: new Date().toISOString(),
          source: 'meeting_created'
    };
        
        setWorkflowEvents(prev => [{
          id: `worklog_${Date.now()}`,
          type: 'worklog',
          title: `Worklog: ${worklogEntry.title}`,
          description: worklogEntry.description,
          timestamp: worklogEntry.timestamp,
          source: 'auto_generated',
          data: worklogEntry,
          status: 'completed'
    }, ...prev.slice(0, 49)]);
    }
  }, [queryClient, selectedProject]),

    onMeetingScheduled: useCallback((meeting: any) => {
      console.log('📅 Universal Meeting Scheduled, :', meeting);
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', ],});
  }, [queryClient]),

    onMeetingCompleted: useCallback((meeting: any) => {
      console.log('✅ Universal Meeting Completed, :', meeting);
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', ],});
  }, [queryClient]),

    // Project Management
    onProjectCreate: useCallback((project: any) => {
      console.log('🚀 Universal Project Created, :', project);
      
      const event: WorkflowEvent = {
        id: `project_${Date.now()}`,
        type: 'project',
        title: `Project: ${project.title}`,
        description: `New project created for ${project.clientName || 'client'}`,
        timestamp: new Date().toISOString(),
        source: project.source || 'unknown',
        data: project,
        status: 'completed'
  };
      
      setWorkflowEvents(prev => [event, ...prev.slice(0, 49)]);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', ],});
      
      if (onProjectSelect) {
        onProjectSelect(project);
    }
  }, [queryClient, onProjectSelect]),

    onProjectUpdate: useCallback((project: any) => {
      console.log('🔄 Universal Project Updated, :', project);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', ],});
  }, [queryClient]),

    onProjectSelect: useCallback((project: any) => {
      console.log('🎯 Universal Project Selected, :', project);
      if (onProjectSelect) {
        onProjectSelect(project);
    }
  }, [onProjectSelect]),

    // Worklog Management
    onWorklogCreate: useCallback((worklog: any) => {
      console.log('📝 Universal Worklog Created, :', worklog);
      
      const event: WorkflowEvent = {
        id: `worklog_${Date.now()}`,
        type: 'worklog',
        title: `Worklog: ${worklog.title}`,
        description: worklog.description || 'Work entry created',
        timestamp: new Date().toISOString(),
        source: worklog.source || 'unknown',
        data: worklog,
        status: 'completed'
  };
      
      setWorkflowEvents(prev => [event, ...prev.slice(0, 49)]);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', userId'worklog'] });
  }, [queryClient, userId]),

    onWorklogUpdate: useCallback((worklog: any) => {
      console.log('✏️ Universal Worklog Updated, :', worklog);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', userId'worklog'] });
  }, [queryClient, userId]),

    // Client Management
    onClientSelect: useCallback((client: any) => {
      console.log('👤 Universal Client Selected, :', client);
      if (onClientSelect) {
        onClientSelect(client);
    }
  }, [onClientSelect]),

    onClientUpdate: useCallback((client: any) => {
      console.log('🔄 Universal Client Updated, :', client);
      queryClient.invalidateQueries({ queryKey: ['/api/clients', ],});
  }, [queryClient]),

    // File Management
    onFileUpload: useCallback((file: any) => {
      console.log('📁 Universal File Uploaded, :', file);
      
      const event: WorkflowEvent = {
        id: `upload_${Date.now()}`,
        type: 'file_upload',
        title: `Upload: ${file.name}`,
        description: `File uploaded to ${file.projectId ? 'project' : 'general storage'}`,
        timestamp: new Date().toISOString(),
        source: 'file_upload',
        data: file,
        status: file.status || 'completed'
  };
      
      setWorkflowEvents(prev => [event, ...prev.slice(0, 49)]);
      queryClient.invalidateQueries({ queryKey: ['/api/files', ],});
      
      if (selectedProject) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject.id'files'] });
    }
  }, [queryClient, selectedProject]),

    onFileDownload: useCallback((file: any) => {
      console.log('⬇️ Universal File Downloaded, :', file);
      
      const event: WorkflowEvent = {
        id: `download_${Date.now()}`,
        type: 'file_download',
        title: `Download: ${file.filename}`,
        description: `File downloaded from ${file.projectId ? 'project' : 'general storage'}`,
        timestamp: new Date().toISOString(),
        source: 'file_download',
        data: file,
        status: 'completed'
  };
      
      setWorkflowEvents(prev => [event, ...prev.slice(0, 49)]);
  }, []),

    // Showcase Management
    onShowcaseCreate: useCallback((showcase: any) => {
      console.log('🎨 Universal Showcase Created, :', showcase);
      queryClient.invalidateQueries({ queryKey: ['/api/showcases', ],});
  }, [queryClient]),

    onShowcaseShare: useCallback((showcase: any, meeting: any) => {
      console.log('🔗 Universal Showcase Shared, :', showcase, meeting);
      queryClient.invalidateQueries({ queryKey: ['/api/showcases', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', ],});
  }, [queryClient]),

    // Settings & Configuration
    onSettingsUpdate: useCallback((settings: any) => {
      console.log('⚙️ Universal Settings Updated, :', settings);
      queryClient.invalidateQueries({ queryKey: ['/api/settings', ],});
  }, [queryClient]),

    // Equipment Management
    onEquipmentUpdate: useCallback((equipment: any) => {
      console.log('🔧 Universal Equipment Updated, :', equipment);
      queryClient.invalidateQueries({ queryKey: ['/api/equipment', ],});
      if (onEquipmentSelect) {
        onEquipmentSelect(equipment);
    }
  }, [queryClient, onEquipmentSelect])
};

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting': return theming.getThemedIcon(', ');
      case 'project': return <Work />;
      case 'worklog': return theming.getThemedIcon('timeline');
      case 'file_upload': return <FileUpload />;
      case 'file_download': return <FileDownload />;
      case 'client': return theming.getThemedIcon('person');
      case 'showcase': return theming.getThemedIcon('checkCircle');
      default: return theming.getThemedIcon(', ');
  }
};

  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting': return '#2196f3';
      case 'project': return '#4caf50';
      case 'worklog': return '#ff9800';
      case 'file_upload': return '#9c27b0';
      case 'file_download': return '#607d8b';
      case 'client': return '#e91e63';
      case 'showcase': return '#00bcd4';
      default: return '#757575';
}
};

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
};

  return (
    <Box sx={{ p:  2 }}>
      <Paper sx={{ p:  3, mb:  2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <CheckCircle color="success" />
          Unified Workflow System
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Real-time orchestration of all components working together seamlessly
        </Typography>
        
        {/* Current Context */}
        <Stack direction="row" spacing={2} sx={{ mb:  2 }}>
          {selectedProject && (
            <Chip 
              icon={<Work />} 
              label={`Project: ${selectedProject.title}`} 
              color="primary" 
              variant="outlined" 
            />
          )}
          {selectedClient && (
            <Chip 
              icon={theming.getThemedIcon('person')}} 
              label={`Client: ${selectedClient.name}`} 
              color="secondary" 
              variant="outlined" 
            />
          )}
          {selectedEquipment && (
            <Chip 
              icon={theming.getThemedIcon('checkCircle')}} 
              label={`Equipment: ${selectedEquipment.name}`} 
              color="success" 
              variant="outlined" 
            />
          )}
        </Stack>

        {/* Processing Status */}
        {isProcessing && (
          <Alert severity="info" sx={{ mb:  2 }}>
            <LinearProgress sx={{ mb:  1 }} />
            Processing workflow events...
          </Alert>
        )}
      </Paper>

      {/* Workflow Events Timeline */}
      <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Recent Workflow Events ({workflowEvents.length})
        </Typography>
        
        {workflowEvents.length === 0 ? (
          <Alert severity="info">
            No workflow events yet. Start using the system to see real-time integration!
          </Alert>
        ) : (
          <Stack spacing={1}>
            {workflowEvents.slice(0, 10).map((event) => (
              <Box
                key={event.id}
                sx={{
                  p:  2,
                  border:  1,
                  borderColor: 'divider',
                  borderRadius:  1,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2 }}
              >
                <Box sx={{ color: getEventColor(event.type, )}}>
                  {getEventIcon(event.type)}
                </Box>
                <Box sx={{ flexGrow:  1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600}>
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {event.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(event.timestamp)} • Source: {event.source}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={event.status}
                  color={event.status === 'completed' ? 'success' : 
                         event.status === 'processing' ? 'warning' : 
                         event.status === 'error' ? 'error' : 'default'}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
};

export default UnifiedWorkflowOrchestrator;




