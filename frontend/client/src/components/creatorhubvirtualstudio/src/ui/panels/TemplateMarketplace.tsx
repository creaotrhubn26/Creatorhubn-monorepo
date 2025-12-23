/**
 * Template Marketplace Panel
 * 
 * Browse and download shared templates from the community
 * Similar to Set A Light 3D's Community Tab
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  Rating,
  Button,
} from '@mui/material';
import { Download, Share, Star } from '@mui/icons-material';
import { projectSharingService, SharedProject } from '../../core/services/projectSharing';
import { logger } from '../../core/services/logger';

const log = logger.module('TemplateMarketplace');

export const TemplateMarketplace: React.FC = () => {
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadProjects();
  }, []);
  
  const loadProjects = async () => {
    setLoading(true);
    const sharedProjects = await projectSharingService.getSharedProjects();
    setProjects(sharedProjects);
    setLoading(false);
  };
  
  const handleDownload = async (projectId: string) => {
    const project = await projectSharingService.downloadProject(projectId);
    if (project) {
      log.info('Project downloaded:', project);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading marketplace...</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 2, bgcolor: '#1a1a1a', color: '#ffffff', minHeight: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Share sx={{ color: '#ffffff' }} />
        <Typography variant="h6" sx={{ color: '#ffffff' }}>
          Template Marketplace
        </Typography>
      </Box>
      
      <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 2 }}>
        Browse and download shared lighting setups from the community
      </Typography>
      
      {projects.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" sx={{ color: '#aaaaaa' }}>
            No shared templates available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: '#888888', mt: 1 }}>
            Share your own templates to help the community!
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
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
                {project.thumbnail && (
                  <CardMedia
                    component="img"
                    height="140"
                    image={project.thumbnail}
                    alt={project.name}
                  />
                )}
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                    {project.name}
                  </Typography>
                  {project.description && (
                    <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 1 }}>
                      {project.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Rating value={project.rating} readOnly size="small" />
                    <Typography variant="caption" sx={{ color: '#888888' }}>
                      ({project.downloadCount} downloads)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                    {project.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{ bgcolor: '#3a3a3a', color: '#ffffff' }}
                      />
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={() => handleDownload(project.id)}
                    fullWidth
                    sx={{
                      bgcolor: '#4a9eff',
                      color: '#ffffff',
                      '&:hover': { bgcolor: '#3a8eef' },
                    }}
                  >
                    Download
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};


