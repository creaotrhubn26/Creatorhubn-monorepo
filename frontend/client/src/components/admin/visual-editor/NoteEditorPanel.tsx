/**
 * Note Editor Integration Panel Component
 * Rich text editing with full NoteEditor integration for scroll stories
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
// import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import NoteEditor from '../../notes/NoteEditor';

interface NoteEditorPanelProps {
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onWorklogCreate?: (worklog: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
}

export const NoteEditorPanel: React.FC<NoteEditorPanelProps> = ({
  selectedProject,
  onProjectUpdate,
  onWorklogCreate,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  // const theming = useTheming('prototype_tester');
  const theming = {
    getThemedCardSx: () => ({ p: 2, m: 1 }),
    getThemedButtonSx: () => ({ mt: 2 }),
    getThemedIcon: (icon: string) => <span>{icon}</span>,
    colors: { primary: '#1976d2' }
};
  
  const [noteContent, setNoteContent] = useState(
    "<p>Create rich text content for your scroll stories...</p>"
  );

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('note_editor_panel_render,');
    
    lifecycle.registerComponent({
      id: 'NoteEditorPanel',
      type: 'note-editor-panel',
      version: '1.0.0',
      capabilities: {
        data: ['note:read','note:write','content:manage','worklog:create'],
        events: ['note:updated','content:changed','worklog:created'],
        actions: ['note:edit','content:save','worklog:create','scrollstory:create'],
        ui: ['note:editor','content:display','worklog:interface'],
        system: ['performance:monitor','analytics:track','debug:log']
    },
      dependencies: ['@mui/material','EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
    }
  });

    analytics.trackEvent('note_editor_panel_mounted', {
      componentId: 'NoteEditorPanel',
      projectId: selectedProject?.id,
      timestamp: Date.now()
  });

    debugging.logIntegration('info', 'NoteEditorPanel component mounted', {
      componentId: 'NoteEditorPanel',
      projectId: selectedProject?.id
  });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('NoteEditorPanel');
      analytics.trackEvent('note_editor_panel_unmounted', {
        componentId: 'NoteEditorPanel',
        timestamp: Date.now()
    });
  };
}, [analytics, lifecycle, performance, debugging, selectedProject?.id]);

  // Handle note editor changes with unified workflow integration
  const handleNoteChange = useCallback((html: string) => {
    setNoteContent(html);

    // Trigger project update
    onProjectUpdate?.({
      ...selectedProject,
      id: selectedProject?.id || 'unknown',
      name: selectedProject?.name || 'Unknown Project',
      description: selectedProject?.description || 'No description available',
      status: selectedProject?.status || 'in-progress',
      clientId: selectedProject?.clientId || 'default',
      dueDate: selectedProject?.dueDate || new Date(),
      priority: selectedProject?.priority || 'medium',
      tags: selectedProject?.tags || [],
      lastNoteUpdate: new Date().toISOString(),
      noteContent: html
  });
    
    onWorklogCreate?.({
      id: `note_updated_${Date.now()}`,
      projectId: selectedProject?.id || 'unknown',
      task: 'Content Update',
      description: 'Updated scroll story content in NoteEditor',
      timeSpent: 5,
      date: new Date(),
      status: 'completed',
      tags: ['content', 'update']
  });
    
    onNotificationCreate?.({
      id: `note_updated_${Date.now()}`,
      type: 'note_updated',
      title: 'Content Updated',
      message: 'Scroll story content has been updated',
      priority: 'low',
      source: 'visual_editor',
      timestamp: new Date().toISOString()
  });
}, [selectedProject, onProjectUpdate, onWorklogCreate, onNotificationCreate]);

  return (
    <Paper sx={{ p: 3, m: 2, ...theming.getThemedCardSx() }}>
      <Typography variant="h4" sx={{ mb: 3, color: theming.colors.primary }}>
        Note Editor Integration
      </Typography>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ 
            border: '1px solid #e0e0e0', 
            borderRadius: 1, 
            p: 2,
            backgroundColor: '#f9f9f9'
        }}>
            <NoteEditor
              value={noteContent}
              onChange={handleNoteChange}
            />
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="outlined">
              Save Content
            </Button>
            <Button variant="outlined">
              Export Notes
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Paper>
  );
};

export default NoteEditorPanel;
