/**
 * RecentlyApprovedUsers Component
 * Displays recently approved users with onboarding progress indicators
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Tooltip,
  Alert,
  Skeleton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Cloud as CloudIcon,
  Dashboard as DashboardIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { AdminTableContainer, adminTokens } from './design-system';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profession?: string;
  businessName?: string;
  approvedAt?: string;
  hasCompletedUniversalOnboarding?: boolean;
  universalOnboardingCompletedAt?: string;
  hasEnteredUniversalDashboard?: boolean;
  universalDashboardFirstAccessAt?: string;
  googleWorkspaceConnected?: boolean;
  createdAt: string;
}

interface RecentlyApprovedUsersProps {
  days?: number;
}

export default function RecentlyApprovedUsers({ days = 30 }: RecentlyApprovedUsersProps) {
  const [search, setSearch] = React.useState('');
  const { data: recentUsers, isLoading } = useQuery({
    queryKey: ['/api/admin/users/recently-approved', days],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/recently-approved?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch recently approved users');
      return response.json() as Promise<User[]>;
    },
    select: (d) => (Array.isArray(d) ? d : []),
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // Refresh every 2 minutes
  });

  const calculateOnboardingProgress = (user: User): number => {
    let progress = 0;

    // 33% for completing onboarding
    if (user.hasCompletedUniversalOnboarding) progress += 33;

    // 33% for accessing dashboard
    if (user.hasEnteredUniversalDashboard) progress += 33;

    // 34% for Google Workspace connection
    if (user.googleWorkspaceConnected) progress += 34;

    return progress;
  };

  const getProgressColor = (progress: number): 'error' | 'warning' | 'info' | 'success' => {
    if (progress === 100) return 'success';
    if (progress >= 66) return 'info';
    if (progress >= 33) return 'warning';
    return 'error';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Ikke fullført';
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysSince = (dateString?: string): number => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: adminTokens.color.brand }} />
          Nylig Godkjente Brukere
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Brukere godkjent de siste {days} dagene med onboarding-status
        </Typography>
      </Box>

      {/* Summary Stats */}
      {recentUsers && recentUsers.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Totalt godkjent
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, color: adminTokens.color.brand }}>
                {recentUsers.length}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Fullført onboarding
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, color: adminTokens.color.success }}>
                {recentUsers.filter((u) => u.hasCompletedUniversalOnboarding).length}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Åpnet dashboard
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#2196f3' }}>
                {recentUsers.filter((u) => u.hasEnteredUniversalDashboard).length}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Google Workspace
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#ce93d8' }}>
                {recentUsers.filter((u) => u.googleWorkspaceConnected).length}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Søk etter navn, e-post eller bedrift …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Users Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <AdminTableContainer ariaLabel="Nylig godkjente brukere">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bruker</TableCell>
                  <TableCell>Godkjent</TableCell>
                  <TableCell align="center">Onboarding</TableCell>
                  <TableCell align="center">Dashboard</TableCell>
                  <TableCell align="center">Google Workspace</TableCell>
                  <TableCell align="center">Fremdrift</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !recentUsers || recentUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Alert severity="info" sx={{ my: 2 }}>
                        Ingen brukere godkjent de siste {days} dagene
                      </Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentUsers
                    .filter((user: User) =>
                      [user.firstName, user.lastName, user.email, user.businessName]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(search.toLowerCase())
                    )
                    .map((user: User) => {
                    const progress = calculateOnboardingProgress(user);
                    const daysSinceApproval = getDaysSince(user.approvedAt);

                    return (
                      <TableRow key={user.id} hover>
                        {/* User Info */}
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500}}>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email.split('@')[0]}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                            {user.businessName && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {user.businessName}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>

                        {/* Approved Date */}
                        <TableCell>
                          <Tooltip title={formatDate(user.approvedAt)}>
                            <Chip
                              icon={<ScheduleIcon />}
                              label={`${daysSinceApproval}d siden`}
                              size="small"
                              color={
                                daysSinceApproval <= 7
                                  ? 'success'
                                  : daysSinceApproval <= 14
                                    ? 'warning'
                                    : 'default'
                              }
                              variant="outlined"
                            />
                          </Tooltip>
                        </TableCell>

                        {/* Onboarding Status */}
                        <TableCell align="center">
                          <Tooltip
                            title={
                              user.hasCompletedUniversalOnboarding
                                ? `Fullført: ${formatDate(user.universalOnboardingCompletedAt)}`
                                : 'Ikke fullført'
                            }
                          >
                            <Box>
                              {user.hasCompletedUniversalOnboarding ? (
                                <Chip
                                  icon={<CheckCircleIcon />}
                                  label="Fullført"
                                  size="small"
                                  color="success"
                                  sx={{ minWidth: 100 }} />
                              ) : (
                                <Chip
                                  icon={<CancelIcon />}
                                  label="Ikke fullført"
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  sx={{ minWidth: 100 }} />
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>

                        {/* Dashboard Access */}
                        <TableCell align="center">
                          <Tooltip
                            title={
                              user.hasEnteredUniversalDashboard
                                ? `Først besøkt: ${formatDate(user.universalDashboardFirstAccessAt)}`
                                : 'Ikke besøkt'
                            }
                          >
                            <Box>
                              {user.hasEnteredUniversalDashboard ? (
                                <Chip
                                  icon={<DashboardIcon />}
                                  label="Besøkt"
                                  size="small"
                                  color="info"
                                  sx={{ minWidth: 100 }} />
                              ) : (
                                <Chip
                                  icon={<CancelIcon />}
                                  label="Ikke besøkt"
                                  size="small"
                                  color="default"
                                  variant="outlined"
                                  sx={{ minWidth: 100 }} />
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>

                        {/* Google Workspace */}
                        <TableCell align="center">
                          <Tooltip
                            title={
                              user.googleWorkspaceConnected
                                ? 'Google Workspace tilkoblet' : 'Google Workspace ikke tilkoblet'
                            }
                          >
                            <Box>
                              {user.googleWorkspaceConnected ? (
                                <Chip
                                  icon={<CloudIcon />}
                                  label="Tilkoblet"
                                  size="small"
                                  color="secondary"
                                  sx={{ minWidth: 100 }} />
                              ) : (
                                <Chip
                                  icon={<CancelIcon />}
                                  label="Ikke tilkoblet"
                                  size="small"
                                  color="default"
                                  variant="outlined"
                                  sx={{ minWidth: 100 }} />
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>

                        {/* Progress */}
                        <TableCell align="center">
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                            <LinearProgress
                              variant="determinate"
                              value={progress}
                              color={getProgressColor(progress)}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40 }}>
                              {progress}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </AdminTableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
