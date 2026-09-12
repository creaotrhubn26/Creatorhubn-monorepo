/**
 * Tester Skill Ratings
 * - Rate testers based on bug quality, testing coverage, responsiveness
 * - Automated skill calculation
 * - Skill progression tracking
 * - Expertise badges
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Rating,
  Tooltip,
  IconButton,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  Science,
  Star,
  TrendingUp,
  EmojiEvents,
  CheckCircle,
  BugReport,
  Timer,
  Category,
  Refresh,
  Edit,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { AdminButton, useIsMobile } from './design-system';

interface TesterSkill {
  testerId: string;
  testerName: string;
  testerEmail: string;
  profession: string;
  overallRating: number;
  bugQuality: number;
  testingCoverage: number;
  responsiveness: number;
  totalBugs: number;
  totalMissionsCompleted: number;
  testingHours: number;
  expertise: 'novice' | 'intermediate' | 'advanced' | 'expert';
  badges: string[];
  lastActive: string;
}

export default function TesterSkillRatings() {
  const queryClient = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'prototype_tester';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const { auth } = useEnhancedMasterIntegration();

  const [selectedTester, setSelectedTester] = useState<TesterSkill | null>(null);

  // Fetch tester skills
  const { data: testers = [], isLoading } = useQuery({
    queryKey: ['/api/admin/tester-skills'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/tester-skills', { headers });
    },
    select: (data) => (Array.isArray(data) ? data : []),
    staleTime: 5 * 60 * 1000,
  });

  const getExpertiseColor = (expertise: string) => {
    switch (expertise) {
      case 'expert': return '#9c27b0';
      case 'advanced': return '#2196f3';
      case 'intermediate': return '#ff9800';
      case 'novice': return '#757575';
      default: return '#757575';
    }
  };

  const getSkillBadgeIcon = (badge: string) => {
    switch (badge) {
      case 'bug_hunter': return <BugReport />;
      case 'quick_responder': return <Timer />;
      case 'all_rounder': return <Category />;
      case 'top_contributor': return <EmojiEvents />;
      default: return <Star />;
    }
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Star sx={{ fontSize: 32, color: '#ffc107' }} />
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {professionIcon && (
                <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                  {professionIcon}
                </Box>
              )}
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600}}>
                {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                  ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Tester Skill Ratings`
                  : 'Tester Skill Ratings'}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Automated skill tracking based on testing performance
            </Typography>
          </Box>
        </Stack>
        
        <IconButton aria-label="Oppdater" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/tester-skills'] })}>
          <Refresh />
        </IconButton>
      </Stack>

      {/* Testers Grid */}
      <Grid container spacing={3}>
        {testers.map((tester: TesterSkill) => (
          <Grid item xs={12} md={6} lg={4} key={tester.testerId}>
            <Card
              role="button"
              tabIndex={0}
              aria-label={`Vis detaljer for ${tester.testerName}`}
              sx={{
                cursor: 'pointer', '&:hover': { boxShadow: 4 }
              }}
              onClick={() => setSelectedTester(tester)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedTester(tester);
                }
              }}
            >
              <CardContent>
                <Stack spacing={2}>
                  {/* Tester Info */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar 
                      sx={{ 
                        bgcolor: getExpertiseColor(tester.expertise),
                        width: 56,
                        height: 56
                      }}
                    >
                      <Science sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                        {tester.testerName}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={tester.profession} 
                          size="small"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                        <Chip 
                          label={tester.expertise.toUpperCase()} 
                          size="small"
                          sx={{ 
                            fontSize: '0.65rem', 
                            height: 18,
                            bgcolor: getExpertiseColor(tester.expertise),
                            color: 'white'
                          }}
                        />
                      </Stack>
                    </Box>
                  </Stack>

                  {/* Overall Rating */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Overall Rating
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {tester.overallRating.toFixed(1)}
                      </Typography>
                    </Stack>
                    <Rating value={tester.overallRating} readOnly precision={0.1} />
                  </Box>

                  <Divider />

                  {/* Skill Breakdown */}
                  <Stack spacing={1}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption">Bug Quality</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600}}>
                          {tester.bugQuality.toFixed(1)}/5
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={(tester.bugQuality / 5) * 100} 
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                    
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption">Test Coverage</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600}}>
                          {tester.testingCoverage.toFixed(1)}/5
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={(tester.testingCoverage / 5) * 100} 
                        sx={{ height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: '#ff9800' } }}
                      />
                    </Box>
                    
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption">Responsiveness</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600}}>
                          {tester.responsiveness.toFixed(1)}/5
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={(tester.responsiveness / 5) * 100} 
                        sx={{ height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: '#4caf50' } }}
                      />
                    </Box>
                  </Stack>

                  <Divider />

                  {/* Stats */}
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                          {tester.totalBugs}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Bugs
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                          {tester.totalMissionsCompleted}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Missions
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                          {tester.testingHours}h
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Hours
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Badges */}
                  {tester.badges && tester.badges.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {tester.badges.map((badge, index) => (
                        <Tooltip key={index} title={badge.replace(/_/g, '').toUpperCase()}>
                          <Chip
                            icon={getSkillBadgeIcon(badge)}
                            label={badge.replace(/_/g, ' ')}
                            size="small"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tester Details Dialog */}
      <Dialog open={!!selectedTester} onClose={() => setSelectedTester(null)} maxWidth="sm" fullWidth fullScreen={useIsMobile()}>
        {selectedTester && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: getExpertiseColor(selectedTester.expertise) }}>
                  <Science />
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedTester.testerName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedTester.profession} • {selectedTester.expertise.toUpperCase()}
                  </Typography>
                </Box>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                Overall Performance: <strong>{selectedTester.overallRating.toFixed(2)}/5</strong>
              </Alert>
              
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Detailed Breakdown:
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2">Bug Quality: {selectedTester.bugQuality}/5</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Based on bug report clarity, reproducibility, and impact
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2">Testing Coverage: {selectedTester.testingCoverage}/5</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Percentage of features tested in assigned profession
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2">Responsiveness: {selectedTester.responsiveness}/5</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Response time to missions and feedback requests
                  </Typography>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <AdminButton tone="ghost" onClick={() => setSelectedTester(null)}>Close</AdminButton>
              <AdminButton tone="primary">View Full Profile</AdminButton>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}

