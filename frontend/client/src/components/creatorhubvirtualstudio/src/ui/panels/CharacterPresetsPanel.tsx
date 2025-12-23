/**
 * Character Presets Panel
 * 
 * UI for selecting and applying character poses and expressions
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Chip,
} from '@mui/material';
import { Person, SentimentSatisfied, DirectionsWalk } from '@mui/icons-material';
import { presetLoader, PosePresetData, ExpressionPresetData } from '../../core/services/presetLoader';
import { logger } from '../../core/services/logger';

const log = logger.module('CharacterPresetsPanel');

interface CharacterPresetsPanelProps {
  onPoseSelected?: (pose: PosePresetData) => void;
  onExpressionSelected?: (expression: ExpressionPresetData) => void;
}

export const CharacterPresetsPanel: React.FC<CharacterPresetsPanelProps> = ({
  onPoseSelected,
  onExpressionSelected,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [poses, setPoses] = useState<PosePresetData[]>([]);
  const [expressions, setExpressions] = useState<ExpressionPresetData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadPresets();
  }, []);
  
  const loadPresets = async () => {
    setLoading(true);
    
    // Load poses
    const poseIds = presetLoader.getAvailablePosePresets();
    const loadedPoses: PosePresetData[] = [];
    for (const id of poseIds) {
      const pose = await presetLoader.loadPosePreset(id);
      if (pose) {
        loadedPoses.push(pose);
      }
    }
    setPoses(loadedPoses);
    
    // Load expressions
    const expressionIds = presetLoader.getAvailableExpressionPresets();
    const loadedExpressions: ExpressionPresetData[] = [];
    for (const id of expressionIds) {
      const expression = await presetLoader.loadExpressionPreset(id);
      if (expression) {
        loadedExpressions.push(expression);
      }
    }
    setExpressions(loadedExpressions);
    
    setLoading(false);
  };
  
  const handlePoseClick = (pose: PosePresetData) => {
    if (onPoseSelected) {
      onPoseSelected(pose);
    }
  };
  
  const handleExpressionClick = (expression: ExpressionPresetData) => {
    if (onExpressionSelected) {
      onExpressionSelected(expression);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading presets...</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ bgcolor: '#1a1a1a', color: '#ffffff', minHeight: '100%' }}>
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{
          borderBottom: '1px solid #333',
          '& .MuiTab-root': {
            color: '#aaaaaa',
            '&.Mui-selected': { color: '#ffffff' },
          },
        }}
      >
        <Tab icon={<DirectionsWalk />} label="Poses" />
        <Tab icon={<SentimentSatisfied />} label="Expressions" />
      </Tabs>
      
      <Box sx={{ p: 2 }}>
        {tabValue === 0 && (
          <Box>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
              Poses
            </Typography>
            <Grid container spacing={2}>
              {poses.map((pose) => (
                <Grid item xs={12} sm={6} key={pose.id}>
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
                    <CardActionArea onClick={() => handlePoseClick(pose)}>
                      <CardContent>
                        <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                          {pose.name}
                        </Typography>
                        {pose.description && (
                          <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 1 }}>
                            {pose.description}
                          </Typography>
                        )}
                        <Chip
                          label={pose.category}
                          size="small"
                          sx={{ bgcolor: '#3a3a3a', color: '#ffffff' }}
                        />
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
        
        {tabValue === 1 && (
          <Box>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
              Expressions
            </Typography>
            <Grid container spacing={2}>
              {expressions.map((expression) => (
                <Grid item xs={12} sm={6} key={expression.id}>
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
                    <CardActionArea onClick={() => handleExpressionClick(expression)}>
                      <CardContent>
                        <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                          {expression.name}
                        </Typography>
                        {expression.description && (
                          <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 1 }}>
                            {expression.description}
                          </Typography>
                        )}
                        <Chip
                          label={expression.category}
                          size="small"
                          sx={{ bgcolor: '#3a3a3a', color: '#ffffff' }}
                        />
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    </Box>
  );
};


