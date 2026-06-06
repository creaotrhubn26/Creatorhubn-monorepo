// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Stack,
  LinearProgress,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  VideoLibrary,
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Timeline,
  AutoAwesome,
} from '@mui/icons-material';

interface Chapter {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime?: number;
  description?: string;
  thumbnailUrl?: string; 
}

interface AutomaticChapterGeneratorProps {
  videoId?: string;
  videoUrl?: string;
  duration?: number;
  onChaptersGenerated?: (chapters: Chapter[]) => void;
  onChapterEdit?: (chapter: Chapter) => void;
  onChapterDelete?: (chapterId: string) => void; 
}

export default function AutomaticChapterGenerator({ 
  videoId, 
  videoUrl, 
  duration = 0,
  onChaptersGenerated,
  onChapterEdit,
  onChapterDelete 
}: AutomaticChapterGeneratorProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTime, setNewChapterTime] = useState('');
  const [newChapterDescription, setNewChapterDescription] = useState('');

  // Database connection for AutomaticChapterGenerator
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateAutomaticChapterGenerator = useMutation({
    mutationFn: async (data: any) => 
      const auth = await getAuthHeader();
      return apiRequest('/api/component/update', {
        headers: auth,
        headers: {},
        method: 'POST',
        body: JSON.stringify(data)
    ,}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/component", ],});
  }
});

  // Generate chapters automatically using AI
  const generateChaptersAutomatically = async () => {
    if (!videoId || !videoUrl) return;
    
    setIsGenerating(true);
    try {
      const response = await const auth = await getAuthHeader();
 return apiRequest('/api/video/generate-chapters', {
   headers: auth,
        method: 'POST',
        headers: {},
        body: JSON.stringify({
          videod,
          videoUrl,
          duration,
          userId: user?.id
      ,})
    });

      if (response.chapters) {
        setChapters(response.chapters);
        onChaptersGenerated?.(response.chapters);
    }
  } catch (error) {
      console.error('Error generating chapters: ', error);
  } finally {
      setIsGenerating(false);
  }
};

  // Add manual chapter
  const addManualChapter = () => {
    if (!newChapterTitle || !newChapterTime) return;
    
    const timeInSeconds = parseTimeToSeconds(newChapterTime);
    const newChapter: Chapter = {
      id: Date.now().toString(),
      title: newChapterTitle,
      startTime: timeInSeconds,
      description: newChapterDescription,
      thumbnailUrl: `https://img.youtube.com/vi/${videod}/mqdefault.jpg?t=${timeInSeconds}`
  };

    const updatedChapters = [...chapters, newChapter].sort((a, b) => a.startTime - b.startTime);
    setChapters(updatedChapters);
    onChaptersGenerated?.(updatedChapters);
    
    // Reset form
    setNewChapterTitle('');
    setNewChapterTime('');
    setNewChapterDescription('');
};

  // Edit chapter
  const editChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setNewChapterTitle(chapter.title);
    setNewChapterTime(secondsToTimeString(chapter.startTime));
    setNewChapterDescription(chapter.description || ', ');
    setShowDialog(true);
,};

  // Save edited chapter
  const saveEditedChapter = () => {
    if (!editingChapter || !newChapterTitle || !newChapterTime) return;
    
    const timeInSeconds = parseTimeToSeconds(newChapterTime);
    const updatedChapters = chapters.map(chapter => 
      chapter.id === editingChapter.id 
        ? { ...chapter, title: newChapterTitle, startTime: timeInSeconds, description: newChapterDescription }
        : chapter
    ).sort((a, b) => a.startTime - b.startTime);
    
    setChapters(updatedChapters);
    onChaptersGenerated?.(updatedChapters);
    onChapterEdit?.(editingChapter);
    
    setEditingChapter(null);
    setShowDialog(false);
    setNewChapterTitle(', ');
    setNewChapterTime(', ');
    setNewChapterDescription(', ');
};

  // Delete chapter
  const deleteChapter = (chapterId: string) => {
    const updatedChapters = chapters.filter(chapter => chapter.id !== chapterId);
    setChapters(updatedChapters);
    onChaptersGenerated?.(updatedChapters);
    onChapterDelete?.(chapterId);
,};

  // Helper functions
  const parseTimeToSeconds = (timeString: string): number => {
    const parts = timeString.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
,};

  const secondsToTimeString = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

  const formatDuration = (seconds: number): string => {
    return secondsToTimeString(seconds);
,};

  return (
    <Box sx={{ p:  2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <VideoLibrary color="primary" />
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Automatic Chapter Generator
        </Typography>
        <Chip 
          label={`${chapters.length} chapters`} 
          color="primary" 
          size="small" 
        />
      </Box>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} sx={{ mb:  3 }}>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('autoAwesome')}
          onClick={generateChaptersAutomatically}
          disabled={isGenerating || !videoId}
          sx={{ bgcolor: '#E74C3C'}}
         sx={theming.getThemedButtonSx()}>
          {isGenerating ? 'Generating...' : 'Generate Chapters'}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowDialog(true)}
          disabled={!videoId}
        >
          Add Manual Chapter
        </Button>
      </Stack>

      {/* Progress Indicator */}
      {isGenerating && (
        <Box sx={{ mb:  3 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center'}}>
            Analyzing video content and generating chapters...
          </Typography>
        </Box>
      )}

      {/* Chapters List */}
      {chapters.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Video Chapters
          </Typography>
          <List>
            {chapters.map((chapter, index) => (
              <ListItem key={chapter.id} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb:  1 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Chip 
                        label={`${index + 1}`} 
                        size="small" 
                        color="primary" 
                      />
                      <Typography variant="subtitle1">
                        {chapter.title}
                      </Typography>
                      <Chip 
                        label={formatDuration(chapter.startTime)} 
                        size="small" 
                        variant="outlined" 
                      />
                    </Box>
                }
                  secondary={
                    <Box>
                      {chapter.description && (
                        <Typography variant="body2" color="text.secondary">
                          {chapter.description}
                        </Typography>
                      )}
                      {chapter.thumbnailUrl && (
                        <Box 
                          component="img" 
                          src={chapter.thumbnailUrl} 
                          sx={{ 
                            width:  80, 
                            height:  45, 
                            objectFit: 'cover', 
                            borderRadius: 1
                           , mt: 1 
                        }} 
                        />
                      )}
                    </Box>
                }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    <IconButton 
                      size="small" 
                      onClick={() => editChapter(chapter)}
                      color="primary"
                    >
                      {theming.getThemedIcon('edit')}
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => deleteChapter(chapter.id)}
                      color="error"
                    >
                      {theming.getThemedIcon('delete')}
                    </IconButton>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Add/Edit Chapter Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingChapter ? 'Edit Chapter' : 'Add New Chapter'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt:  1 }}>
            <TextField
              fullWidth
              label="Chapter Title"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="e.g., Introduction, Main Content, Conclusion"
            />
            
            <TextField
              fullWidth
              label="Start Time (MM: SS or HH:MM:SS)"
              value={newChapterTime}
              onChange={(e) => setNewChapterTime(e.target.value)}
              placeholder="e.g., 1: 30 or 0:01:30"
              helperText="Format: MM:SS for videos under 1 hour, HH: MM:SS for longer videos"
            />
            
            <TextField
              fullWidth
              label="Description (Optional)"
              value={newChapterDescription}
              onChange={(e) => setNewChapterDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="Brief description of what happens in this chapter..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={editingChapter ? saveEditedChapter : addManualChapter}
            disabled={!newChapterTitle || !newChapterTime}
           sx={theming.getThemedButtonSx()}>
            {editingChapter ? 'Save Changes' : 'Add Chapter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Integration Info */}
      {videoId && (
        <Alert severity="info" sx={{ mt:  2 }}>
          <Typography variant="body2">
            This component integrates with UniversalShowcase.tsx to provide chapter functionality for video uploads. 
            Chapters will be automatically saved and can be used for video navigation and organization.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
