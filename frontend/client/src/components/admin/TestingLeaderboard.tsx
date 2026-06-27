/**
 * Testing Leaderboard
 * - Rankings based on bugs found, missions completed, testing hours
 * - Weekly/Monthly/All-time leaderboards
 * - Achievement tracking
 * - Gamification rewards
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Avatar,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  LinearProgress,
  Tooltip,
  Badge,
  Grid,
  ThemeProvider,
  TextField,
  InputAdornment,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  EmojiEvents,
  Star,
  TrendingUp,
  Refresh,
  Science,
  BugReport,
  Assignment,
  Timer,
  LocalFireDepartment,
  Search,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { AdminCard, AdminTableContainer, AdminEmpty } from './design-system';

interface LeaderboardEntry {
  rank: number;
  testerId: string;
  name: string;
  profession: string;
  assignedProfession: string;
  totalScore: number;
  bugsFound: number;
  missionsCompleted: number;
  testingHours: number;
  dicePoints: number;
  streak: number;
  achievements: string[];
  avatar?: string;
}

export default function TestingLeaderboard() {
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester');
  const themeColors = { ...theming.colors, primary: '#ff8c00' };
  const { auth } = useEnhancedMasterIntegration();

  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [search, setSearch] = useState("");

  // Fetch leaderboard
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['/api/admin/testing-leaderboard', { timeRange }],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/testing-leaderboard?range=${timeRange}`, { headers });
    },
    select: (data) => (Array.isArray(data) ? data : []),
    staleTime: 2 * 60 * 1000,
  });

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const getMedalColor = (rank: number) => {
    if (rank === 1) return '#ffd700';
    if (rank === 2) return '#c0c0c0';
    if (rank === 3) return '#cd7f32';
    return '#e0e0e0';
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <EmojiEvents aria-hidden sx={{ fontSize: 32, color: '#ffd700' }} />
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600}}>
              Testing Leaderboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Top performing prototype testers • {leaderboard.length} active testers
            </Typography>
          </Box>
        </Stack>
        
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup
            size="small"
            value={timeRange}
            exclusive
            onChange={(_, newValue) => newValue && setTimeRange(newValue)}
          >
            <ToggleButton value="week">This Week</ToggleButton>
            <ToggleButton value="month">This Month</ToggleButton>
            <ToggleButton value="all">All Time</ToggleButton>
          </ToggleButtonGroup>
          
          <IconButton aria-label="Oppdater ledertavle" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/testing-leaderboard'] })}>
            <Refresh />
          </IconButton>
        </Stack>
      </Stack>

      {/* Top 3 Spotlight */}
      {leaderboard.length >= 3 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {leaderboard.slice(0, 3).map((tester: LeaderboardEntry) => (
            <Grid item xs={12} md={4} key={tester.testerId}>
              <Card 
                sx={{ 
                  position: 'relative',
                  background: `linear-gradient(135deg, ${getMedalColor(tester.rank)}20 0%, ${getMedalColor(tester.rank)}05 100%)`,
                  border: `2px solid ${getMedalColor(tester.rank)}`
                }}
              >
                <CardContent>
                  <Stack spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        bgcolor: getMedalColor(tester.rank),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: 'white',
                        boxShadow: 4
                      }}
                    >
                      {getMedalIcon(tester.rank)}
                    </Box>
                    
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {tester.name}
                      </Typography>
                      <Chip 
                        label={tester.assignedProfession} 
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                    
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: getMedalColor(tester.rank) }}>
                      {tester.totalScore.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Points
                    </Typography>
                    
                    <Grid container spacing={1} sx={{ width: '100%' }}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {tester.bugsFound}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Bugs
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {tester.missionsCompleted}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Missions
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {tester.testingHours}h
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Hours
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    
                    {tester.streak > 0 && (
                      <Chip
                        icon={<LocalFireDepartment />}
                        label={`${tester.streak} day streak`}
                        size="small"
                        color="error"
                        sx={{ fontWeight: 'bold' }}
                      />
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Full Leaderboard Table */}
      <AdminCard title="Full Rankings" disablePadding>
          <Box sx={{ p: 2, pb: 0 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Søk etter navn eller profesjon …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <AdminTableContainer ariaLabel="Full Rankings">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Tester</TableCell>
                  <TableCell>Profession</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Bugs</TableCell>
                  <TableCell align="right">Missions</TableCell>
                  <TableCell align="right">Hours</TableCell>
                  <TableCell>Achievements</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboard.filter((tester: LeaderboardEntry) =>
                  `${tester.name ?? ''} ${tester.assignedProfession ?? ''} ${tester.profession ?? ''}`.toLowerCase().includes(search.toLowerCase())
                ).map((tester: LeaderboardEntry) => (
                  <TableRow 
                    key={tester.testerId}
                    sx={{
                      bgcolor: tester.rank <= 3 ? `${getMedalColor(tester.rank)}10` : 'transparent'
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={getMedalIcon(tester.rank)}
                        size="small"
                        sx={{
                          bgcolor: getMedalColor(tester.rank),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: themeColors.primary }}>
                          <Science aria-hidden sx={{ fontSize: 18 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600}}>
                            {tester.name}
                          </Typography>
                          {tester.streak > 0 && (
                            <Typography variant="caption" color="error.main">
                              <LocalFireDepartment aria-hidden sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                              {tester.streak} day streak
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={tester.assignedProfession} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
                        {tester.totalScore.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{tester.bugsFound}</TableCell>
                    <TableCell align="right">{tester.missionsCompleted}</TableCell>
                    <TableCell align="right">{tester.testingHours}h</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {(Array.isArray(tester.achievements) ? tester.achievements : []).slice(0, 3).map((achievement, index) => (
                          <Tooltip key={index} title={achievement}>
                            <Star sx={{ fontSize: 16, color: '#ffc107' }} />
                          </Tooltip>
                        ))}
                        {tester.achievements.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{tester.achievements.length - 3}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableContainer>

          {leaderboard.length === 0 && (
            <AdminEmpty title="No testers in leaderboard yet" />
          )}
      </AdminCard>
    </Box>
    </ThemeProvider>
  );
}

