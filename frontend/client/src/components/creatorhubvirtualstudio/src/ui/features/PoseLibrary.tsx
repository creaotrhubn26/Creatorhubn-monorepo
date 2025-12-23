import * as React from 'react';
import { 
  Box, 
  Button, 
  Grid, 
  Typography, 
  Tabs, 
  Tab, 
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Tooltip
} from '@mui/material';
import { 
  Person, 
  Accessibility, 
  Chair, 
  DirectionsRun,
  Face,
  Business,
  Mood
} from '@mui/icons-material';
import { POSE_PRESETS, PosePreset } from '../../core/animations/ActorAnimations';

const POSE_CATEGORIES = [
  { id: 'all', label: 'All', icon: <Person /> },
  { id: 'standing', label: 'Standing', icon: <Accessibility /> },
  { id: 'sitting', label: 'Sitting', icon: <Chair /> },
  { id: 'portrait', label: 'Portrait', icon: <Face /> },
  { id: 'fashion', label: 'Fashion', icon: <DirectionsRun /> },
  { id: 'business', label: 'Business', icon: <Business /> },
  { id: 'emotional', label: 'Emotional', icon: <Mood /> },
];

export default function PoseLibrary() {
  const [category, setCategory] = React.useState('all');
  const [selectedPose, setSelectedPose] = React.useState<string | null>(null);

  const filteredPoses = React.useMemo(() => {
    if (category === 'all') return Object.entries(POSE_PRESETS);
    return Object.entries(POSE_PRESETS).filter(([_, pose]) => 
      pose.category === category
    );
  }, [category]);

  const applyPose = (poseId: string, pose: PosePreset) => {
    setSelectedPose(poseId);
    
    // Dispatch event to apply pose to selected actor
    window.dispatchEvent(new CustomEvent('vs-apply-pose', {
      detail: { poseId, pose }
    }));
    
    window.dispatchEvent(new CustomEvent('vs-toast', {
      detail: { message: `Applied, pose: ${pose.name}`, severity: 'success' }
    }));
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Accessibility fontSize="small" />
        <Typography fontWeight={700}>Pose Library</Typography>
        <Chip label={`${Object.keys(POSE_PRESETS).length} poses`} size="small" />
      </Stack>

      <Tabs 
        value={category} 
        onChange={(_, v) => setCategory(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1, minHeight: 36 }}
      >
        {POSE_CATEGORIES.map(cat => (
          <Tab 
            key={cat.id} 
            value={cat.id} 
            label={cat.label}
            icon={cat.icon}
            iconPosition="start"
            sx={{ minHeight: 36, py: 0 }}
          />
        ))}
      </Tabs>

      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        <Grid container spacing={1}>
          {filteredPoses.map(([id, pose]) => (
            <Grid key={id} item xs={6} sm={4}>
              <Card 
                variant={selectedPose === id ? 'elevation' : 'outlined'}
                sx={{ 
                  borderColor: selectedPose === id ? 'primary.main' : 'divider',
                  borderWidth: selectedPose === id ? 2 : 1}}
              >
                <CardActionArea onClick={() => applyPose(id, pose)}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {pose.name}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        <Chip 
                          label={pose.category} 
                          size="small" 
                          sx={{ height: 18, fontSize: 10 }} 
                        />
                        {pose.mood && (
                          <Chip 
                            label={pose.mood} 
                            size="small" 
                            variant="outlined"
                            sx={{ height: 18, fontSize: 10 }} 
                          />
                        )}
                      </Stack>
                      {pose.description && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {pose.description}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {filteredPoses.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No poses in this category
        </Typography>
      )}
    </Box>
  );
}
