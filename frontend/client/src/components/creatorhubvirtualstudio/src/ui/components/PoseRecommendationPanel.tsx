/**
 * Pose Recommendation Panel
 * 
 * AI-powered pose suggestions based on photography type and scene analysis
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Card,
  CardContent,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  AutoAwesome,
  Person,
  Groups,
  DirectionsRun,
  Checkroom,
  WbSunny,
} from '@mui/icons-material';
import { poseRecommendationService, type PoseRecommendation } from '../../core/services/poseRecommendationService';

interface PoseRecommendationPanelProps {
  photographyType?: 'portrait' | 'group' | 'action' | 'casual' | 'formal';
  subjectCount?: number;
  onPoseSelect?: (pose: PoseRecommendation) => void;
}

export function PoseRecommendationPanel({
  photographyType,
  subjectCount,
  onPoseSelect,
}: PoseRecommendationPanelProps) {
  const [selectedType, setSelectedType] = useState<string>(photographyType || 'all');
  const [selectedPose, setSelectedPose] = useState<PoseRecommendation | null>(null);

  const recommendations = poseRecommendationService.getRecommendations({
    photographyType: selectedType !== 'all' ? selectedType as any : undefined,
    subjectCount,
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'portrait':
        return <Person />;
      case 'group':
        return <Groups />;
      case 'action':
        return <DirectionsRun />;
      case 'casual':
        return <WbSunny />;
      case 'formal':
        return <Checkroom />;
      default:
        return <Person />;
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy':
        return '#4CAF50';
      case 'medium':
        return '#FFC107';
      case 'advanced':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            Pose Recommendations
          </Typography>
          <Chip
            label={`${recommendations.length} poses`}
            size="small"
            color="primary"
          />
        </Box>

        {/* Filter */}
        <FormControl fullWidth>
          <InputLabel>Photography Type</InputLabel>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            label="Photography Type"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="portrait">Portrait</MenuItem>
            <MenuItem value="group">Group</MenuItem>
            <MenuItem value="action">Action</MenuItem>
            <MenuItem value="casual">Casual</MenuItem>
            <MenuItem value="formal">Formal</MenuItem>
          </Select>
        </FormControl>

        {/* Recommendations */}
        <Grid container spacing={2}>
          {recommendations.map((pose, idx) => (
            <Grid item xs={12} sm={6} key={idx}>
              <Card
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  border: selectedPose?.name === pose.name ? 2 : 1,
                  borderColor: selectedPose?.name === pose.name ? 'primary.main' : 'divider',
                  height: '100%'}}
                onClick={() => {
                  setSelectedPose(pose);
                  onPoseSelect?.(pose);
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {pose.name}
                      </Typography>
                      <Chip
                        icon={getCategoryIcon(pose.category)}
                        label={pose.category}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {pose.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={pose.difficulty}
                        size="small"
                        sx={{
                          bgcolor: getDifficultyColor(pose.difficulty),
                          color: 'white'}}
                      />
                      <Chip
                        label={`${pose.keyPoints.length} key points`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Selected Pose Details */}
        {selectedPose && (
          <>
            <Divider />
            <Card variant="outlined" sx={{ bgcolor: 'primary.light' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  {selectedPose.name} - Details
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Key Points:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selectedPose.keyPoints.map((point, idx) => (
                        <Chip key={idx} label={point} size="small" />
                      ))}
                    </Box>
                  </Box>
                  {Object.keys(selectedPose.idealAngles).length > 0 && (
                    <Box>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Ideal Angles:
                      </Typography>
                      <List dense>
                        {Object.entries(selectedPose.idealAngles).map(([key, value]) => (
                          <ListItem key={key}>
                            <ListItemText
                              primary={key.replace('_',',')}
                              secondary={`${value}°`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Tips:
                    </Typography>
                    <List dense>
                      {selectedPose.tips.map((tip, idx) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <AutoAwesome fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={tip} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => onPoseSelect?.(selectedPose)}
                  >
                    Apply This Pose
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </>
        )}

        {recommendations.length === 0 && (
          <Alert severity="info">
            No pose recommendations available for the selected type
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}


























