import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  FileDownload,
  FileUpload,
  Notifications,
  Person,
  Schedule,
  Timeline,
  Work,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface WorkflowEvent {
  id: string;
  type: 'meeting' | 'project' | 'worklog' | 'file_upload' | 'file_download' | 'client' | 'showcase';
  title: string;
  description: string;
  timestamp: string;
  source: string;
  data: unknown;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface UnifiedWorkflowOrchestratorProps {
  profession: string;
  userId: string;
  selectedProject?: { id?: string; title?: string } | null;
  selectedClient?: { id?: string; name?: string } | null;
  selectedEquipment?: { id?: string; name?: string } | null;
  onProjectSelect?: (project: { id?: string; title?: string }) => void;
  onClientSelect?: (client: { id?: string; name?: string }) => void;
  onEquipmentSelect?: (equipment: { id?: string; name?: string }) => void;
}

function eventIcon(type: WorkflowEvent['type']): React.ReactNode {
  switch (type) {
    case 'project':
      return <Work color="primary" />;
    case 'worklog':
      return <Timeline color="warning" />;
    case 'file_upload':
      return <FileUpload color="secondary" />;
    case 'file_download':
      return <FileDownload color="action" />;
    case 'client':
      return <Person color="info" />;
    case 'showcase':
      return <CheckCircle color="success" />;
    case 'meeting':
    default:
      return <Schedule color="primary" />;
  }
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const deltaMs = now - new Date(isoString).getTime();
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

const UnifiedWorkflowOrchestrator: React.FC<UnifiedWorkflowOrchestratorProps> = ({
  profession,
  userId,
  selectedProject,
  selectedClient,
  selectedEquipment,
  onProjectSelect,
  onClientSelect,
  onEquipmentSelect,
}) => {
  const theming = useTheming(profession);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const event: WorkflowEvent = {
      id: `session-${Date.now()}`,
      type: 'project',
      title: 'Workflow session initialized',
      description: `Unified orchestration active for ${profession}`,
      timestamp: new Date().toISOString(),
      source: 'workflow-orchestrator',
      data: { userId, profession },
      status: 'completed',
    };
    setEvents([event]);
  }, [profession, userId]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    const event: WorkflowEvent = {
      id: `project-${Date.now()}`,
      type: 'project',
      title: selectedProject.title ? `Project selected: ${selectedProject.title}` : 'Project selected',
      description: 'Project context synchronized across modules.',
      timestamp: new Date().toISOString(),
      source: 'project-context',
      data: selectedProject,
      status: 'completed',
    };
    setEvents((previous) => [event, ...previous].slice(0, 50));
    onProjectSelect?.(selectedProject);
  }, [selectedProject, onProjectSelect]);

  useEffect(() => {
    if (!selectedClient) {
      return;
    }
    const event: WorkflowEvent = {
      id: `client-${Date.now()}`,
      type: 'client',
      title: selectedClient.name ? `Client selected: ${selectedClient.name}` : 'Client selected',
      description: 'Client context synchronized across modules.',
      timestamp: new Date().toISOString(),
      source: 'client-context',
      data: selectedClient,
      status: 'completed',
    };
    setEvents((previous) => [event, ...previous].slice(0, 50));
    onClientSelect?.(selectedClient);
  }, [selectedClient, onClientSelect]);

  useEffect(() => {
    if (!selectedEquipment) {
      return;
    }
    const event: WorkflowEvent = {
      id: `equipment-${Date.now()}`,
      type: 'worklog',
      title: selectedEquipment.name
        ? `Equipment selected: ${selectedEquipment.name}`
        : 'Equipment selected',
      description: 'Equipment context synchronized for production planning.',
      timestamp: new Date().toISOString(),
      source: 'equipment-context',
      data: selectedEquipment,
      status: 'completed',
    };
    setEvents((previous) => [event, ...previous].slice(0, 50));
    onEquipmentSelect?.(selectedEquipment);
  }, [selectedEquipment, onEquipmentSelect]);

  const completedCount = useMemo(
    () => events.filter((event) => event.status === 'completed').length,
    [events],
  );

  const beginSyntheticRun = (): void => {
    setIsProcessing(true);
    const event: WorkflowEvent = {
      id: `sync-${Date.now()}`,
      type: 'showcase',
      title: 'Cross-module sync',
      description: 'Triggering synchronization across timeline, assets, and communication systems.',
      timestamp: new Date().toISOString(),
      source: 'system',
      data: { userId },
      status: 'processing',
    };
    setEvents((previous) => [event, ...previous].slice(0, 50));

    window.setTimeout(() => {
      setEvents((previous) =>
        previous.map((item) =>
          item.id === event.id
            ? {
                ...item,
                status: 'completed',
                description: 'Cross-module sync completed successfully.',
              }
            : item,
        ),
      );
      setIsProcessing(false);
    }, 900);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Notifications color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Unified Workflow Orchestrator
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time event orchestration for project, client, equipment and showcase workflows.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={`${completedCount} completed`} color="success" />
            <Chip size="small" label={`${events.length} events`} />
            <Chip
              size="small"
              color={isProcessing ? 'warning' : 'default'}
              label={isProcessing ? 'processing' : 'idle'}
              onClick={beginSyntheticRun}
              clickable
            />
          </Stack>
        </Stack>
        {isProcessing ? <LinearProgress sx={{ mt: 1.5 }} /> : null}
      </Paper>

      {(selectedProject || selectedClient || selectedEquipment) ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          {selectedProject ? <Chip icon={<Work />} label={`Project: ${selectedProject.title ?? 'Selected'}`} /> : null}
          {selectedClient ? <Chip icon={<Person />} label={`Client: ${selectedClient.name ?? 'Selected'}`} /> : null}
          {selectedEquipment ? <Chip icon={<Timeline />} label={`Equipment: ${selectedEquipment.name ?? 'Selected'}`} /> : null}
        </Stack>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          No active contexts selected yet.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Event Timeline
          </Typography>
          <List>
            {events.map((event) => (
              <ListItem key={event.id}>
                <ListItemIcon>{eventIcon(event.type)}</ListItemIcon>
                <ListItemText
                  primary={event.title}
                  secondary={`${event.description} • ${formatRelativeTime(event.timestamp)} • ${event.source}`}
                />
                <Chip size="small" label={event.status} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UnifiedWorkflowOrchestrator;
