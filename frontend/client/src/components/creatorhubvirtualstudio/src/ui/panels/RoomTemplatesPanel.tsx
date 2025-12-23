/**
 * Room Templates Panel
 * 
 * UI for selecting and loading predefined room templates
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import { Home, Info } from '@mui/icons-material';
import { roomLoader, RoomTemplate } from '../../core/services/roomLoader';
import { logger } from '../../core/services/logger';

const log = logger.module('RoomTemplatesPanel');

interface RoomTemplatesPanelProps {
  onRoomLoaded?: (room: RoomTemplate) => void;
}

export const RoomTemplatesPanel: React.FC<RoomTemplatesPanelProps> = ({
  onRoomLoaded,
}) => {
  const [templates, setTemplates] = useState<RoomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<RoomTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  useEffect(() => {
    loadTemplates();
  }, []);
  
  const loadTemplates = async () => {
    setLoading(true);
    const templateIds = roomLoader.getAvailableTemplates();
    const loadedTemplates: RoomTemplate[] = [];
    
    for (const id of templateIds) {
      const template = await roomLoader.loadTemplate(id);
      if (template) {
        loadedTemplates.push(template);
      }
    }
    
    setTemplates(loadedTemplates);
    setLoading(false);
  };
  
  const handleTemplateClick = (template: RoomTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };
  
  const handleLoadTemplate = () => {
    if (selectedTemplate && onRoomLoaded) {
      onRoomLoaded(selectedTemplate);
      setDialogOpen(false);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading room templates...</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 2, bgcolor: '#1a1a1a', color: '#ffffff', minHeight: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Home sx={{ color: '#ffffff' }} />
        <Typography variant="h6" sx={{ color: '#ffffff' }}>
          Room Templates
        </Typography>
      </Box>
      
      <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 2 }}>
        Select a predefined studio room to get started
      </Typography>
      
      <Grid container spacing={2}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} key={template.id}>
            <Card
              sx={{
                bgcolor: '#2a2a2a',
                color: '#ffffff',
                '&:hover': {
                  bgcolor: '#333333',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              <CardActionArea onClick={() => handleTemplateClick(template)}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 2 }}>
                    {template.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${template.dimensions.width}×${template.dimensions.depth}m`}
                      size="small"
                      sx={{ bgcolor: '#3a3a3a', color: '#ffffff' }}
                    />
                    <Chip
                      label={`${template.dimensions.height}m height`}
                      size="small"
                      sx={{ bgcolor: '#3a3a3a', color: '#ffffff' }}
                    />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff' }}>
          {selectedTemplate?.name}
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <>
              <Typography variant="body1" sx={{ color: '#aaaaaa', mb: 2 }}>
                {selectedTemplate.description}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                  Dimensions
                </Typography>
                <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
                  {selectedTemplate.dimensions.width} × {selectedTemplate.dimensions.depth} × {selectedTemplate.dimensions.height} meters
                </Typography>
              </Box>
              {selectedTemplate.notes && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
                    {selectedTemplate.notes}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#aaaaaa' }}>
            Cancel
          </Button>
          <Button
            onClick={handleLoadTemplate}
            variant="contained"
            sx={{
              bgcolor: '#4a9eff',
              color: '#ffffff',
              '&:hover': { bgcolor: '#3a8eef' },
            }}
          >
            Load Room
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


